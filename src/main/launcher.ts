import fs from 'fs';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { app, BrowserWindow } from 'electron';
import { store } from './store';
import { installer } from './installer';

export interface GameLaunchOptions {
  sessionId?: string;
  characterId?: string;
  displayName?: string;
}

function commandExists(cmd: string): boolean {
  if (path.isAbsolute(cmd)) {
    return fs.existsSync(cmd);
  }
  const pathEnv = process.env.PATH || '';
  const dirs = pathEnv.split(path.delimiter);
  for (const dir of dirs) {
    const full = path.join(dir, cmd);
    if (fs.existsSync(full)) {
      try {
        fs.accessSync(full, fs.constants.X_OK);
        return true;
      } catch {}
    }
  }
  return false;
}

export class GameLauncher {
  private activeProcess: ChildProcess | null = null;
  private isRunning: boolean = false;

  public isGameRunning(): boolean {
    return this.isRunning;
  }

  public async launchRs3(mainWindow?: BrowserWindow, options?: GameLaunchOptions): Promise<void> {
    if (this.isRunning) {
      throw new Error('Game is already running');
    }

    const settings = store.getSettings();
    const activeAccount = store.getActiveAccount();

    const sessionId = options?.sessionId || activeAccount?.sessionId;
    const characterId = options?.characterId || settings.selectedCharacterId || (activeAccount?.characters[0]?.id);
    const charObj = activeAccount?.characters.find(c => c.id === characterId);
    const displayName = options?.displayName || charObj?.displayName || 'Player';

    if (!sessionId || !characterId) {
      throw new Error('Please log in with a Jagex Account and select a character before playing.');
    }

    // Ensure client is downloaded/extracted
    const binaryPath = await installer.installOrUpdate();
    const gameHome = installer.getGameDataDir();

    // Warn if attempting to execute Linux ELF binary directly on macOS Darwin
    if (process.platform === 'darwin') {
      const msg = 'Notice: The game client binary is an official Linux x86_64 ELF executable and cannot run directly on macOS Darwin. To play, package or run this launcher on your Linux system.';
      console.warn(`[Launcher] ${msg}`);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('game-state-changed', { isRunning: false, error: msg });
      }
      throw new Error(msg);
    }

    // Isolated library path to resolve libssl1.1 on Ubuntu 22.04 and 24.04 without breaking host apt
    const compatLibDir = installer.getCompatLibDir();
    let ldLibraryPath = process.env.LD_LIBRARY_PATH || '';
    if (fs.existsSync(compatLibDir)) {
      ldLibraryPath = [compatLibDir, ldLibraryPath].filter(Boolean).join(':');
    }

    // Environment variables addressing:
    // 1. libssl1.1 mismatch: via isolated LD_LIBRARY_PATH
    // 2. Wayland compositing bugs: via GDK_BACKEND=x11 and SDL_VIDEODRIVER=x11
    // 3. Audio underrun startup hangs: via PULSE_LATENCY_MSEC=100
    // 4. Input method hangs: via unsetting XMODIFIERS
    // 5. Jagex Account auth: via JX_SESSION_ID, JX_CHARACTER_ID, JX_DISPLAY_NAME
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      HOME: gameHome,
      PULSE_PROP_OVERRIDE: "application.name='RuneScape' application.icon_name='runescape' media.role='game'",
      PULSE_LATENCY_MSEC: settings.rs3AudioLatencyFix !== false ? '100' : (process.env.PULSE_LATENCY_MSEC || '100'),
      SDL_VIDEODRIVER: settings.rs3ForceX11 !== false ? 'x11' : (process.env.SDL_VIDEODRIVER || 'x11'),
      SDL_VIDEO_X11_WMCLASS: 'RuneScape',
      GDK_BACKEND: settings.rs3ForceX11 !== false ? 'x11' : (process.env.GDK_BACKEND || 'x11'),
      JX_SESSION_ID: sessionId,
      JX_CHARACTER_ID: characterId,
      JX_DISPLAY_NAME: displayName,
    };

    if (ldLibraryPath) {
      env.LD_LIBRARY_PATH = ldLibraryPath;
    }

    // Unset XMODIFIERS to prevent IBus / Fcitx GTK2 deadlocks during startup
    delete env.XMODIFIERS;

    // GPU Workarounds for NVIDIA Wayland / "Loading Application Resources" freezes
    if (settings.rs3GpuWorkaround === 'zink') {
      env.MESA_LOADER_DRIVER_OVERRIDE = 'zink';
      env.ZINK_DEBUG = 'flushsync';
    } else if (settings.rs3GpuWorkaround === 'prime') {
      env.__NV_PRIME_RENDER_OFFLOAD = '1';
      env.__GLX_VENDOR_LIBRARY_NAME = 'nvidia';
    }

    // Mesa Threaded OpenGL optimization (reduces CPU bottlenecks and shader hitching)
    if (settings.rs3MesaGlThread !== false || settings.lowSpecMode) {
      env.mesa_glthread = 'true';
    }

    // Mesa OpenGL Compatibility Profile Override (forces Mesa to expose 4.5 in compatibility mode for older Intel/AMD GPUs)
    if (settings.rs3CompatProfileOverride !== false) {
      env.MESA_GL_VERSION_OVERRIDE = '4.5COMPAT';
      env.MESA_GLSL_VERSION_OVERRIDE = '450';
    }

    // DRI3 disable / DRI2 fallback (prevents window lockups on older Intel Sandy Bridge/Ivy Bridge X11 drivers)
    if (settings.rs3DisableDri3) {
      env.LIBGL_DRI3_DISABLE = '1';
    }

    // Mesa disk shader cache to prevent runtime shader compilation hitches on slower CPUs
    const shaderCacheDir = path.join(gameHome, '.cache', 'mesa_shader_cache');
    try {
      if (!fs.existsSync(shaderCacheDir)) {
        fs.mkdirSync(shaderCacheDir, { recursive: true });
      }
      env.MESA_SHADER_CACHE_DIR = shaderCacheDir;
      env.MESA_SHADER_CACHE_MAX_SIZE = '512M';
    } catch {
      // Non-fatal if cache dir cannot be created
    }

    const configUri = settings.configUri || 'https://rs.config.runescape.com/k=5/l=0/jav_config.ws';
    let baseCmd = binaryPath;
    let baseArgs = ['--configURI', configUri];

    // Handle GameMode, MangoHud or Custom Command Wrapper
    if (settings.customLaunchCommand && settings.customLaunchCommand.includes('%command%')) {
      const parts = settings.customLaunchCommand.split(' ');
      const fullCmd = [binaryPath, ...baseArgs].join(' ');
      const replaced = parts.map(p => p === '%command%' ? fullCmd : p);
      baseCmd = replaced[0];
      baseArgs = replaced.slice(1);
    } else {
      if (settings.useGameMode) {
        if (commandExists('gamemoderun')) {
          baseArgs = [baseCmd, ...baseArgs];
          baseCmd = 'gamemoderun';
        } else {
          console.warn('[Launcher] gamemoderun not found in PATH; launching directly without GameMode.');
        }
      }
      if (settings.useMangoHud) {
        if (commandExists('mangohud')) {
          baseArgs = [baseCmd, ...baseArgs];
          baseCmd = 'mangohud';
        } else {
          console.warn('[Launcher] mangohud not found in PATH; launching directly without MangoHud.');
        }
      }
    }

    console.log(`[Launcher] Launching RuneScape 3: ${baseCmd} ${baseArgs.join(' ')}`);
    console.log(`[Launcher] Character: ${displayName} (${characterId})`);
    if (ldLibraryPath) {
      console.log(`[Launcher] LD_LIBRARY_PATH: ${ldLibraryPath}`);
    }

    let quitTimeout: NodeJS.Timeout | null = null;
    let stderrBuffer = '';

    try {
      const child = spawn(baseCmd, baseArgs, {
        env,
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      this.activeProcess = child;
      this.isRunning = true;

      child.stderr?.on('data', (chunk) => {
        const str = chunk.toString();
        stderrBuffer += str;
        console.error(`[RS3 Client stderr] ${str.trim()}`);
      });

      child.stdout?.on('data', (chunk) => {
        console.log(`[RS3 Client stdout] ${chunk.toString().trim()}`);
      });

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('game-state-changed', { isRunning: true });
      }

      child.on('error', (err) => {
        console.error('[Launcher] Process error:', err);
        if (quitTimeout) {
          clearTimeout(quitTimeout);
          quitTimeout = null;
        }
        this.isRunning = false;
        this.activeProcess = null;
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.show();
          mainWindow.webContents.send('game-state-changed', { isRunning: false, error: err.message });
        }
      });

      child.on('exit', (code, signal) => {
        console.log(`[Launcher] RuneScape process terminated with code: ${code}, signal: ${signal}`);
        this.isRunning = false;
        this.activeProcess = null;

        if (code !== 0 && code !== null) {
          let helpfulMsg = `RuneScape client exited with code ${code}.`;
          if (stderrBuffer.includes('libssl.so.1.1') || stderrBuffer.includes('libcrypto.so.1.1')) {
            helpfulMsg = 'Missing OpenSSL 1.1 library. Go to Settings > RuneScape 3 to install compatibility libraries.';
          } else if (stderrBuffer.includes('libOpenGL.so') || stderrBuffer.includes('libGL.so')) {
            helpfulMsg = 'Missing OpenGL driver (libOpenGL.so.0). Run "sudo apt install libopengl0" to resolve.';
          } else if (stderrBuffer.includes('cannot open shared object file')) {
            const match = stderrBuffer.match(/cannot open shared object file: (.*)/);
            helpfulMsg = `Missing system library: ${match ? match[1] : 'dependency'}. Run Diagnostics in Settings to fix.`;
          }

          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.show();
            mainWindow.webContents.send('game-state-changed', { isRunning: false, error: helpfulMsg });
          }
        } else if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('game-state-changed', { isRunning: false });
          if (settings.minimizeToTray && !settings.closeOnLaunch) {
            mainWindow.show();
          }
        }
      });

      // Handle launcher window behavior after launch
      if (settings.closeOnLaunch) {
        console.log('[Launcher] Close on launch enabled. Exiting launcher to free RAM in 2s...');
        quitTimeout = setTimeout(() => {
          app.quit();
        }, 2000);
      } else if (settings.minimizeToTray && mainWindow && !mainWindow.isDestroyed()) {
        console.log('[Launcher] Minimizing launcher to tray...');
        mainWindow.hide();
      }
    } catch (spawnErr: any) {
      this.isRunning = false;
      this.activeProcess = null;
      throw spawnErr;
    }
  }

  public killGame(): void {
    if (this.activeProcess && !this.activeProcess.killed) {
      this.activeProcess.kill('SIGTERM');
      this.isRunning = false;
      this.activeProcess = null;
    }
  }
}

export const launcher = new GameLauncher();
