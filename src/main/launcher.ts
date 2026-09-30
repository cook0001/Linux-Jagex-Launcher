import fs from 'fs';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import type { BrowserWindow } from 'electron';
import * as electron from 'electron';
const app = (electron as any)?.app || ((electron as any)?.default?.app) || undefined;
import os from 'os';
import { store } from './store.ts';
import { installer } from './installer.ts';

export interface GameLaunchOptions {
  sessionId?: string;
  characterId?: string;
  displayName?: string;
  safeMode?: boolean;
}

export interface CrashReport {
  timestamp: number;
  game: 'rs3' | 'osrs';
  exitCode: number | null;
  signal: string | null;
  category: 'vulkan_gpu' | 'oom_kill' | 'missing_lib' | 'display_wayland' | 'audio_stall' | 'cache_corrupt' | 'unknown';
  title: string;
  summary: string;
  remediation: string;
  actionId?: string;
  actionLabel?: string;
  stderrSnippet: string;
  stdoutSnippet: string;
  systemInfo: {
    os: string;
    displayServer: string;
    gpuWorkaround: string;
    ramGb: string;
  };
}

export function sanitizeReportText(text: string): string {
  if (!text) return '';
  const home = os.homedir();
  let sanitized = text.split(home).join('~');
  // Redact session IDs, character IDs, and potential token strings
  sanitized = sanitized.replace(/(JX_SESSION_ID=)[^\s&]+/gi, '$1[REDACTED]');
  sanitized = sanitized.replace(/(JX_CHARACTER_ID=)[^\s&]+/gi, '$1[REDACTED]');
  sanitized = sanitized.replace(/(session_id|sessionId|token)=["']?[a-zA-Z0-9_\-.]+["']?/gi, '$1=[REDACTED]');
  return sanitized;
}

export function classifyCrash(
  code: number | null,
  signal: string | null,
  stderr: string,
  stdout: string
): {
  category: CrashReport['category'];
  title: string;
  summary: string;
  remediation: string;
  actionId?: string;
  actionLabel?: string;
} {
  const combined = (stderr + '\n' + stdout).toLowerCase();

  // 1. Missing Dynamic Shared Library
  const missingLibMatch = stderr.match(/cannot open shared object file:\s*([^\s:]+)/i);
  if (missingLibMatch || combined.includes('libssl.so.1.1') || combined.includes('libcrypto.so.1.1')) {
    const lib = missingLibMatch ? missingLibMatch[1] : (combined.includes('libssl') ? 'libssl.so.1.1' : 'library');
    if (lib.includes('libssl') || lib.includes('libcrypto')) {
      return {
        category: 'missing_lib',
        title: 'Missing OpenSSL 1.1 Compatibility Library',
        summary: `The client could not load ${lib}. Ubuntu 22.04+ removed OpenSSL 1.1.`,
        remediation: 'Click "Install libssl1.1 Compat" to safely download isolated libraries.',
        actionId: 'install_ssl',
        actionLabel: 'Install libssl1.1'
      };
    }
    return {
      category: 'missing_lib',
      title: `Missing System Library: ${lib}`,
      summary: `The dynamic linker could not locate ${lib}.`,
      remediation: 'Run Doctor Diagnostics in Settings to inspect required system packages.'
    };
  }

  // 2. Kernel OOM Kill
  if (signal === 'SIGKILL' || code === 137) {
    return {
      category: 'oom_kill',
      title: 'Out-Of-Memory (OOM) Process Termination',
      summary: 'The client was forcefully terminated by the Linux kernel (SIGKILL), typically triggered by the Out-Of-Memory killer.',
      remediation: 'Enable "Performance Mode" and "Close Launcher when Game Starts" in Settings to minimize RAM usage.',
      actionId: 'enable_lowspec',
      actionLabel: 'Enable Performance Mode'
    };
  }

  // 3. Vulkan / GPU Driver Segfault
  const isSegfault = signal === 'SIGSEGV' || code === 139 || signal === 'SIGBUS';
  if (isSegfault || combined.includes('libvulkan') || combined.includes('radv') || combined.includes('radeonsi') || combined.includes('iris_dri') || combined.includes('nouveau') || combined.includes('gpu hang')) {
    return {
      category: 'vulkan_gpu',
      title: 'Graphics Driver / Vulkan Segmentation Fault',
      summary: `The client crashed during graphics dispatch (${signal || `code ${code}`}). Vulkan or OpenGL drivers encountered an unrecoverable fault.`,
      remediation: 'Switch GPU Driver to "Mesa Zink Override" in Settings > RuneScape 3.',
      actionId: 'enable_zink',
      actionLabel: 'Enable Zink Override'
    };
  }

  // 4. Wayland / X11 Disconnect
  if (combined.includes('x connection to :') || combined.includes('gdk_backend') || combined.includes('wayland') || combined.includes('badwindow') || combined.includes('badalloc')) {
    return {
      category: 'display_wayland',
      title: 'Display Server / XWayland Compositor Failure',
      summary: 'The X11 / XWayland display server connection was severed or rejected by the window manager.',
      remediation: 'Ensure "Force X11 / XWayland" is enabled in Settings > RuneScape 3.',
      actionId: 'enable_x11',
      actionLabel: 'Force X11 Mode'
    };
  }

  // 5. Audio Buffer Starvation
  if (combined.includes('alsa lib') || combined.includes('pulseaudio: connection') || combined.includes('snd_pcm_avail')) {
    return {
      category: 'audio_stall',
      title: 'Audio Buffer Underrun / Sound Thread Stall',
      summary: 'The PulseAudio / PipeWire audio subsystem encountered a buffer underrun or deadlock on startup.',
      remediation: 'Enable "PulseAudio Latency Mitigation" in Settings > RuneScape 3.',
      actionId: 'enable_audio_fix',
      actionLabel: 'Apply Audio Fix'
    };
  }

  // 6. Cache Checksum / Corruption
  if (combined.includes('archive checksum') || combined.includes('corrupt') || combined.includes('unexpected eof') || combined.includes('cache error')) {
    return {
      category: 'cache_corrupt',
      title: 'Corrupted Game Asset Cache',
      summary: 'The NXT client encountered an archive read or checksum error loading cached game models/textures.',
      remediation: 'Clear the RuneScape 3 client cache in Settings > RuneScape 3.',
      actionId: 'clear_cache',
      actionLabel: 'Clear Game Cache'
    };
  }

  // Default fallback
  return {
    category: 'unknown',
    title: `Unexpected Client Exit (${signal ? `Signal ${signal}` : `Code ${code}`})`,
    summary: `The client process terminated unexpectedly with code ${code ?? 'N/A'}${signal ? ` and signal ${signal}` : ''}.`,
    remediation: 'Run Diagnostics in Settings or click "Report Issue" to copy sanitized error logs for support.'
  };
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
  private wasKilledByUser: boolean = false;
  private crashFile: string;

  constructor() {
    const configDir = path.join(os.homedir(), '.config', 'linux-jagex-launcher');
    if (!fs.existsSync(configDir)) {
      try {
        fs.mkdirSync(configDir, { recursive: true });
      } catch {}
    }
    this.crashFile = path.join(configDir, 'last_crash.json');
  }

  public isGameRunning(): boolean {
    return this.isRunning;
  }

  public getLastCrash(): CrashReport | null {
    try {
      if (fs.existsSync(this.crashFile)) {
        return JSON.parse(fs.readFileSync(this.crashFile, 'utf8'));
      }
    } catch {
      return null;
    }
    return null;
  }

  public clearLastCrash(): void {
    try {
      if (fs.existsSync(this.crashFile)) {
        fs.unlinkSync(this.crashFile);
      }
    } catch {}
  }

  public async launchRs3(mainWindow?: BrowserWindow, options?: GameLaunchOptions): Promise<void> {
    if (this.isRunning) {
      throw new Error('Game is already running');
    }

    this.wasKilledByUser = false;
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

    // Determine effective settings (Safe Mode overrides experimental options)
    const isSafeMode = Boolean(options?.safeMode);
    const forceX11 = isSafeMode ? true : (settings.rs3ForceX11 !== false);
    const audioLatencyFix = isSafeMode ? true : (settings.rs3AudioLatencyFix !== false);
    const gpuWorkaround = isSafeMode ? 'zink' : settings.rs3GpuWorkaround;
    const mesaGlThread = isSafeMode ? false : (settings.rs3MesaGlThread !== false || settings.lowSpecMode);
    const compatProfile = isSafeMode ? true : (settings.rs3CompatProfileOverride !== false);
    const disableDri3 = isSafeMode ? true : settings.rs3DisableDri3;

    // Environment variables addressing:
    // 1. libssl1.1 mismatch: via isolated LD_LIBRARY_PATH
    // 2. Wayland compositing bugs: via GDK_BACKEND=x11 and SDL_VIDEODRIVER=x11
    // 3. Audio underrun startup hangs: via PULSE_LATENCY_MSEC=100
    // 4. Input method hangs: via unsetting XMODIFIERS
    // 5. Decimal formatting crash on non-English locales: via LC_NUMERIC=C
    // 6. Jagex Account auth: via JX_SESSION_ID, JX_CHARACTER_ID, JX_DISPLAY_NAME
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      HOME: gameHome,
      LC_NUMERIC: 'C',
      PULSE_PROP_OVERRIDE: "application.name='RuneScape' application.icon_name='runescape' media.role='game'",
      PULSE_LATENCY_MSEC: audioLatencyFix ? '100' : (process.env.PULSE_LATENCY_MSEC || '100'),
      SDL_VIDEODRIVER: forceX11 ? 'x11' : (process.env.SDL_VIDEODRIVER || 'x11'),
      SDL_VIDEO_X11_WMCLASS: 'RuneScape',
      GDK_BACKEND: forceX11 ? 'x11' : (process.env.GDK_BACKEND || 'x11'),
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
    if (gpuWorkaround === 'zink') {
      env.MESA_LOADER_DRIVER_OVERRIDE = 'zink';
      env.ZINK_DEBUG = 'flushsync';
    } else if (gpuWorkaround === 'prime') {
      env.__NV_PRIME_RENDER_OFFLOAD = '1';
      env.__GLX_VENDOR_LIBRARY_NAME = 'nvidia';
    }

    // Mesa Threaded OpenGL optimization (reduces CPU bottlenecks and shader hitching)
    if (mesaGlThread) {
      env.mesa_glthread = 'true';
    }

    // Mesa OpenGL Compatibility Profile Override (forces Mesa to expose 4.5 in compatibility mode for older Intel/AMD GPUs)
    if (compatProfile) {
      env.MESA_GL_VERSION_OVERRIDE = '4.5COMPAT';
      env.MESA_GLSL_VERSION_OVERRIDE = '450';
    }

    // DRI3 disable / DRI2 fallback (prevents window lockups on older Intel Sandy Bridge/Ivy Bridge X11 drivers)
    if (disableDri3) {
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
      if (settings.useGameMode && !isSafeMode) {
        if (commandExists('gamemoderun')) {
          baseArgs = [baseCmd, ...baseArgs];
          baseCmd = 'gamemoderun';
        } else {
          console.warn('[Launcher] gamemoderun not found in PATH; launching directly without GameMode.');
        }
      }
      if (settings.useMangoHud && !isSafeMode) {
        if (commandExists('mangohud')) {
          baseArgs = [baseCmd, ...baseArgs];
          baseCmd = 'mangohud';
        } else {
          console.warn('[Launcher] mangohud not found in PATH; launching directly without MangoHud.');
        }
      }
    }

    console.log(`[Launcher] Launching RuneScape 3${isSafeMode ? ' (Safe Compatibility Mode)' : ''}: ${baseCmd} ${baseArgs.join(' ')}`);
    console.log(`[Launcher] Character: ${displayName} (${characterId})`);
    if (ldLibraryPath) {
      console.log(`[Launcher] LD_LIBRARY_PATH: ${ldLibraryPath}`);
    }

    let quitTimeout: NodeJS.Timeout | null = null;
    let stderrBuffer = '';
    const stdoutRing: string[] = [];
    const stderrRing: string[] = [];
    const maxRingLines = 150;

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
        for (const line of str.split('\n')) {
          if (line.trim()) {
            stderrRing.push(line.trim());
            if (stderrRing.length > maxRingLines) stderrRing.shift();
          }
        }
        console.error(`[RS3 Client stderr] ${str.trim()}`);
      });

      child.stdout?.on('data', (chunk) => {
        const str = chunk.toString();
        for (const line of str.split('\n')) {
          if (line.trim()) {
            stdoutRing.push(line.trim());
            if (stdoutRing.length > maxRingLines) stdoutRing.shift();
          }
        }
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

        if (code !== 0 && code !== null && !this.wasKilledByUser) {
          const classification = classifyCrash(code, signal, stderrBuffer, stdoutRing.join('\n'));
          const displayServer = process.env.XDG_SESSION_TYPE || (process.env.WAYLAND_DISPLAY ? 'wayland' : 'x11');
          const totalRamGb = (os.totalmem() / (1024 * 1024 * 1024)).toFixed(1);

          const crashReport: CrashReport = {
            timestamp: Date.now(),
            game: 'rs3',
            exitCode: code,
            signal,
            category: classification.category,
            title: classification.title,
            summary: classification.summary,
            remediation: classification.remediation,
            actionId: classification.actionId,
            actionLabel: classification.actionLabel,
            stderrSnippet: sanitizeReportText(stderrRing.slice(-40).join('\n')),
            stdoutSnippet: sanitizeReportText(stdoutRing.slice(-20).join('\n')),
            systemInfo: {
              os: `${os.type()} ${os.release()} (${os.arch()})`,
              displayServer,
              gpuWorkaround,
              ramGb: totalRamGb
            }
          };

          try {
            fs.writeFileSync(this.crashFile, JSON.stringify(crashReport, null, 2), 'utf8');
          } catch (writeErr) {
            console.error('[Launcher] Failed to write crash log:', writeErr);
          }

          let helpfulMsg = `${classification.title}: ${classification.summary}`;
          if (classification.remediation) {
            helpfulMsg += ` (${classification.remediation})`;
          }

          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.show();
            mainWindow.webContents.send('game-state-changed', {
              isRunning: false,
              error: helpfulMsg,
              crashReport
            });
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
          app?.quit();
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
      this.wasKilledByUser = true;
      this.activeProcess.kill('SIGTERM');
      this.isRunning = false;
      this.activeProcess = null;
    }
  }
}

export const launcher = new GameLauncher();

