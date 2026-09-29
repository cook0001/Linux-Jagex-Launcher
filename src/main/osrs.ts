import fs from 'fs';
import path from 'path';
import os from 'os';
import https from 'https';
import { spawn, spawnSync, ChildProcess } from 'child_process';
import { app, BrowserWindow } from 'electron';
import { store } from './store';

const RUNELITE_DOWNLOAD_URL = 'https://github.com/runelite/launcher/releases/latest/download/RuneLite.jar';
const HDOS_DOWNLOAD_URL = 'https://cdn.hdos.dev/launcher/latest/hdos-launcher.jar';

export interface OsrsClientStatus {
  hasJava: boolean;
  javaPath: string | null;
  hasClient: boolean;
  clientPath: string;
  clientType: 'runelite' | 'hdos' | 'official';
  isSystemClient?: boolean;
}

function commandExists(cmd: string): boolean {
  try {
    const checkCmd = process.platform === 'win32' ? 'where' : 'which';
    const res = spawnSync(checkCmd, [cmd], { stdio: 'ignore' });
    return res.status === 0;
  } catch {
    return false;
  }
}

function resolveExecutable(cmd: string): string | null {
  try {
    const checkCmd = process.platform === 'win32' ? 'where' : 'which';
    const res = spawnSync(checkCmd, [cmd], { encoding: 'utf8' });
    if (res.status === 0 && res.stdout) {
      const firstLine = res.stdout.split('\n')[0].trim();
      if (firstLine && fs.existsSync(firstLine)) return firstLine;
    }
  } catch {}
  return null;
}

export class OsrsManager {
  private baseDir: string;
  private runeliteDir: string;
  private hdosDir: string;
  private activeProcess: ChildProcess | null = null;
  private isRunning: boolean = false;

  constructor() {
    this.baseDir = path.join(os.homedir(), '.local', 'share', 'linux-jagex-launcher');
    this.runeliteDir = path.join(this.baseDir, 'runelite');
    this.hdosDir = path.join(this.baseDir, 'hdos');

    if (!fs.existsSync(this.runeliteDir)) fs.mkdirSync(this.runeliteDir, { recursive: true });
    if (!fs.existsSync(this.hdosDir)) fs.mkdirSync(this.hdosDir, { recursive: true });
  }

  public getRuneliteJarPath(): string {
    return path.join(this.runeliteDir, 'RuneLite.jar');
  }

  public getHdosJarPath(): string {
    return path.join(this.hdosDir, 'hdos-launcher.jar');
  }

  public getRuneliteDataDir(): string {
    return this.runeliteDir;
  }

  public findJava(customPath?: string): string | null {
    const settings = store.getSettings();
    const candidate = customPath || settings.customJavaPath;

    // 0. User-specified custom Java binary path
    if (candidate && candidate.trim()) {
      const trimmed = candidate.trim();
      if (fs.existsSync(trimmed)) {
        try {
          fs.accessSync(trimmed, fs.constants.X_OK);
          return trimmed;
        } catch {}
      }
    }

    // 1. Check JAVA_HOME
    if (process.env.JAVA_HOME) {
      const javaBin = path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java');
      if (fs.existsSync(javaBin)) {
        try {
          fs.accessSync(javaBin, fs.constants.X_OK);
          return javaBin;
        } catch {}
      }
    }

    // 2. Check PATH
    const pathEnv = process.env.PATH || '';
    const dirs = pathEnv.split(path.delimiter);
    const exeName = process.platform === 'win32' ? 'java.exe' : 'java';
    for (const dir of dirs) {
      const full = path.join(dir, exeName);
      if (fs.existsSync(full)) {
        try {
          fs.accessSync(full, fs.constants.X_OK);
          return full;
        } catch {}
      }
    }

    // 3. System resolution via `which java`
    const resolvedJava = resolveExecutable('java');
    if (resolvedJava) return resolvedJava;

    // 4. Dynamic scan of /usr/lib/jvm subdirectories on Linux
    if (fs.existsSync('/usr/lib/jvm')) {
      try {
        const jvmEntries = fs.readdirSync('/usr/lib/jvm');
        for (const entry of jvmEntries) {
          const full = path.join('/usr/lib/jvm', entry, 'bin', 'java');
          if (fs.existsSync(full)) {
            try {
              fs.accessSync(full, fs.constants.X_OK);
              return full;
            } catch {}
          }
        }
      } catch {}
    }

    // 5. Common Linux / Unix / macOS JVM installation paths
    const commonPaths = [
      '/usr/bin/java',
      '/usr/local/bin/java',
      '/opt/homebrew/bin/java',
      '/etc/alternatives/java',
      '/app/jre/bin/java', // Flatpak runtime
      '/usr/local/opt/openjdk@17/bin/java',
      '/usr/local/opt/openjdk@21/bin/java',
      '/usr/local/opt/openjdk/bin/java',
      '/usr/local/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home/bin/java',
      '/usr/local/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home/bin/java',
      '/usr/lib/jvm/default-runtime/bin/java',
      '/usr/lib/jvm/default/bin/java',
      '/usr/lib/jvm/java-21-openjdk/bin/java',
      '/usr/lib/jvm/java-17-openjdk/bin/java',
      '/usr/lib/jvm/java-11-openjdk/bin/java',
      '/usr/lib/jvm/java-21-openjdk-amd64/bin/java',
      '/usr/lib/jvm/java-17-openjdk-amd64/bin/java',
      '/usr/lib/jvm/java-11-openjdk-amd64/bin/java',
    ];

    for (const p of commonPaths) {
      if (fs.existsSync(p)) {
        try {
          fs.accessSync(p, fs.constants.X_OK);
          return p;
        } catch {}
      }
    }

    return null;
  }

  public findSystemClient(clientType: 'runelite' | 'hdos' | 'official'): string | null {
    const settings = store.getSettings();

    // 1. If user configured a custom client path
    if (settings.osrsCustomClientPath && settings.osrsCustomClientPath.trim()) {
      const p = settings.osrsCustomClientPath.trim();
      if (fs.existsSync(p)) return p;
    }

    // 2. Check for system installed binary
    if (clientType === 'runelite') {
      const runeliteBin = resolveExecutable('runelite');
      if (runeliteBin) return runeliteBin;

      const appImageCandidates = [
        path.join(os.homedir(), 'Applications', 'RuneLite.AppImage'),
        path.join(os.homedir(), '.local', 'bin', 'RuneLite.AppImage'),
        path.join(os.homedir(), 'bin', 'RuneLite.AppImage'),
      ];
      for (const ai of appImageCandidates) {
        if (fs.existsSync(ai)) return ai;
      }

      // Check Flatpak runtime
      if (commandExists('flatpak')) {
        try {
          const res = spawnSync('flatpak', ['info', 'net.runelite.RuneLite'], { stdio: 'ignore' });
          if (res.status === 0) return 'flatpak:net.runelite.RuneLite';
        } catch {}
      }
    } else if (clientType === 'hdos') {
      const hdosBin = resolveExecutable('hdos');
      if (hdosBin) return hdosBin;
    }

    return null;
  }

  public checkClientStatus(clientType: 'runelite' | 'hdos' | 'official' = 'runelite'): OsrsClientStatus {
    const javaPath = this.findJava();
    const systemClient = this.findSystemClient(clientType);

    if (systemClient) {
      const isFlatpak = systemClient.startsWith('flatpak:');
      return {
        hasJava: isFlatpak ? true : javaPath !== null,
        javaPath: isFlatpak ? 'Flatpak Bundled JRE' : javaPath,
        hasClient: true,
        clientPath: systemClient,
        clientType,
        isSystemClient: true,
      };
    }

    let clientPath = this.getRuneliteJarPath();
    if (clientType === 'hdos') {
      clientPath = this.getHdosJarPath();
    } else if (clientType === 'official') {
      clientPath = 'steam://rungameid/1343400';
    }

    const hasClient = clientType === 'official'
      ? false // Official client requires user setup on Linux
      : fs.existsSync(clientPath) && fs.statSync(clientPath).size > 1024;

    return {
      hasJava: javaPath !== null,
      javaPath,
      hasClient,
      clientPath,
      clientType,
      isSystemClient: false,
    };
  }

  public async installClient(
    clientType: 'runelite' | 'hdos' = 'runelite',
    onProgress?: (progress: { status: string; progress: number; message: string }) => void
  ): Promise<string> {
    const targetPath = clientType === 'hdos' ? this.getHdosJarPath() : this.getRuneliteJarPath();
    const downloadUrl = clientType === 'hdos' ? HDOS_DOWNLOAD_URL : RUNELITE_DOWNLOAD_URL;
    const clientName = clientType === 'hdos' ? 'HDOS' : 'RuneLite';

    onProgress?.({
      status: 'downloading',
      progress: 10,
      message: `Downloading latest ${clientName} launcher...`
    });

    await this.downloadFileWithRedirects(downloadUrl, targetPath, (loaded, total) => {
      if (total > 0) {
        const pct = Math.min(95, Math.round((loaded / total) * 90) + 10);
        onProgress?.({
          status: 'downloading',
          progress: pct,
          message: `Downloading ${clientName}... (${(loaded / 1024 / 1024).toFixed(1)} MB / ${(total / 1024 / 1024).toFixed(1)} MB)`
        });
      } else {
        onProgress?.({
          status: 'downloading',
          progress: 50,
          message: `Downloading ${clientName}... (${(loaded / 1024 / 1024).toFixed(1)} MB)`
        });
      }
    });

    onProgress?.({
      status: 'ready',
      progress: 100,
      message: `${clientName} is ready to play!`
    });

    return targetPath;
  }

  private downloadFileWithRedirects(
    urlStr: string,
    destPath: string,
    onProgress?: (loaded: number, total: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const get = (currentUrl: string, redirectCount = 0) => {
        if (redirectCount > 10) {
          return reject(new Error('Too many redirects while downloading client'));
        }

        const req = https.get(currentUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Accept': '*/*'
          }
        }, (res) => {
          // Handle HTTP 301, 302, 303, 307, 308 redirects
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            const redirectUrl = new URL(res.headers.location, currentUrl).toString();
            return get(redirectUrl, redirectCount + 1);
          }

          if (res.statusCode !== 200) {
            return reject(new Error(`Download failed with HTTP status ${res.statusCode}`));
          }

          const total = parseInt(res.headers['content-length'] || '0', 10);
          let loaded = 0;

          const tmpPath = destPath + '.tmp';
          const fileStream = fs.createWriteStream(tmpPath);

          res.on('data', (chunk) => {
            loaded += chunk.length;
            onProgress?.(loaded, total);
          });

          res.pipe(fileStream);

          fileStream.on('finish', () => {
            fileStream.close(() => {
              fs.rename(tmpPath, destPath, (err) => {
                if (err) reject(err);
                else resolve();
              });
            });
          });

          fileStream.on('error', (err) => {
            fs.unlink(tmpPath, () => {});
            reject(err);
          });
        });

        req.on('error', (err) => {
          reject(err);
        });
      };

      get(urlStr);
    });
  }

  public async launchOsrs(mainWindow?: BrowserWindow, options?: {
    sessionId?: string;
    characterId?: string;
    displayName?: string;
    clientType?: 'runelite' | 'hdos' | 'official';
  }): Promise<void> {
    if (this.isRunning) {
      throw new Error('Old School RuneScape is already running');
    }

    const settings = store.getSettings();
    const activeAccount = store.getActiveAccount();

    const sessionId = options?.sessionId || activeAccount?.sessionId;
    const characterId = options?.characterId || settings.selectedCharacterId || (activeAccount?.characters[0]?.id);
    const charObj = activeAccount?.characters.find(c => c.id === characterId);
    const displayName = options?.displayName || charObj?.displayName || 'Player';
    const clientType = options?.clientType || settings.selectedOsrsClient || 'runelite';

    if (!sessionId || !characterId) {
      throw new Error('Please sign in with a Jagex Account and select a character before playing.');
    }

    if (clientType === 'official') {
      const customPath = settings.osrsCustomClientPath?.trim();
      if (!customPath || !fs.existsSync(customPath)) {
        throw new Error(
          'Official OSRS C++ Client on Linux requires Steam/Proton or a custom runner path. ' +
          'Please configure a custom client path in Settings, or select RuneLite / HDOS (native Linux).'
        );
      }
    }

    const javaBin = this.findJava();
    if (!javaBin && clientType !== 'official') {
      throw new Error(
        'Java 11+ is required to launch Old School RuneScape (RuneLite/HDOS). ' +
        'Please install OpenJDK (e.g. `sudo apt install default-jre` or `sudo pacman -S jre-openjdk`).'
      );
    }

    // Check if custom system executable exists
    const systemClient = this.findSystemClient(clientType);
    let isJar = true;
    let targetExecutable = javaBin!;
    let jarPath = clientType === 'hdos' ? this.getHdosJarPath() : this.getRuneliteJarPath();

    if (systemClient) {
      if (systemClient.startsWith('flatpak:')) {
        targetExecutable = 'flatpak';
        isJar = false;
      } else if (systemClient.endsWith('.jar')) {
        jarPath = systemClient;
        isJar = true;
      } else {
        targetExecutable = systemClient;
        isJar = false;
      }
    }

    // Auto-download managed client JAR if not already present on disk
    if (isJar && (!fs.existsSync(jarPath) || fs.statSync(jarPath).size < 1024)) {
      console.log(`[OSRS] Client JAR not found on disk. Downloading ${clientType}...`);
      await this.installClient(clientType === 'hdos' ? 'hdos' : 'runelite');
    }

    // Environment variables passing Jagex Account session to RuneLite / HDOS
    // CRITICAL: Keep HOME pointing to user's real home folder so ~/.runelite is used
    // and default system browser links open in user's profile!
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      HOME: process.env.HOME || os.homedir(),
      PULSE_PROP_OVERRIDE: clientType === 'hdos'
        ? "application.name='HDOS' application.icon_name='hdos' media.role='game'"
        : "application.name='RuneLite' application.icon_name='runelite' media.role='game'",
      JX_SESSION_ID: sessionId,
      JX_CHARACTER_ID: characterId,
      JX_DISPLAY_NAME: displayName,
    };

    const customJvmArgs = (settings.osrsJvmArgs || '').trim().split(/\s+/).filter(Boolean);
    const customClientArgs = (settings.osrsClientArgs || '').trim().split(/\s+/).filter(Boolean);

    let baseCmd = targetExecutable;
    let baseArgs: string[] = [];

    if (systemClient?.startsWith('flatpak:')) {
      const flatpakAppId = systemClient.replace('flatpak:', '');
      baseCmd = 'flatpak';
      baseArgs = ['run', flatpakAppId, ...customClientArgs];
    } else if (isJar) {
      baseArgs = [
        ...customJvmArgs,
        '-jar',
        jarPath,
        ...customClientArgs,
      ];
    } else {
      baseArgs = [...customClientArgs];
    }

    // Apply GameMode (gamemoderun) optimization if enabled and available
    if (settings.useGameMode && commandExists('gamemoderun')) {
      baseArgs = [baseCmd, ...baseArgs];
      baseCmd = 'gamemoderun';
    }

    // Apply MangoHud overlay if enabled and available
    if (settings.useMangoHud && commandExists('mangohud')) {
      baseArgs = [baseCmd, ...baseArgs];
      baseCmd = 'mangohud';
    }

    console.log(`[OSRS] Launching ${clientType.toUpperCase()}: ${baseCmd} ${baseArgs.join(' ')}`);
    console.log(`[OSRS] Authenticated Character: ${displayName} (${characterId})`);

    let quitTimeout: NodeJS.Timeout | null = null;

    try {
      const child = spawn(baseCmd, baseArgs, {
        env,
        cwd: os.homedir(),
        detached: true,
        stdio: 'ignore'
      });

      this.activeProcess = child;
      this.isRunning = true;

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('game-state-changed', { isRunning: true, game: 'osrs', client: clientType });
      }

      child.on('error', (err) => {
        console.error('[OSRS] Process error:', err);
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
        console.log(`[OSRS] Process terminated with code: ${code}, signal: ${signal}`);
        this.isRunning = false;
        this.activeProcess = null;
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('game-state-changed', { isRunning: false, game: 'osrs' });
          if (settings.minimizeToTray && !settings.closeOnLaunch) {
            mainWindow.show();
          }
        }
      });

      if (settings.closeOnLaunch) {
        console.log('[OSRS] Close on launch enabled. Minimizing/exiting launcher to free RAM in 3s...');
        quitTimeout = setTimeout(() => {
          app.quit();
        }, 3000);
      } else if (settings.minimizeToTray && mainWindow && !mainWindow.isDestroyed()) {
        console.log('[OSRS] Minimizing launcher to tray...');
        mainWindow.hide();
      }
    } catch (spawnErr: any) {
      this.isRunning = false;
      this.activeProcess = null;
      throw spawnErr;
    }
  }

  public isGameRunning(): boolean {
    return this.isRunning;
  }

  public killGame(): void {
    if (this.activeProcess && !this.activeProcess.killed) {
      this.activeProcess.kill('SIGTERM');
      this.isRunning = false;
      this.activeProcess = null;
    }
  }
}

export const osrs = new OsrsManager();
