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

    // Environment variables matching official Jagex Launcher and Bolt
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      HOME: gameHome,
      PULSE_PROP_OVERRIDE: "application.name='RuneScape' application.icon_name='runescape' media.role='game'",
      SDL_VIDEODRIVER: 'x11',
      SDL_VIDEO_X11_WMCLASS: 'RuneScape',
      JX_SESSION_ID: sessionId,
      JX_CHARACTER_ID: characterId,
      JX_DISPLAY_NAME: displayName,
    };

    const configUri = settings.configUri || 'https://www.runescape.com/k=5/l=0/jav_config.ws';
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

    let quitTimeout: NodeJS.Timeout | null = null;

    try {
      const child = spawn(baseCmd, baseArgs, {
        env,
        detached: true,
        stdio: 'ignore'
      });

      this.activeProcess = child;
      this.isRunning = true;

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
        if (mainWindow && !mainWindow.isDestroyed()) {
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
