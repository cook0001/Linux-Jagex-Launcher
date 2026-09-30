import fs from 'fs';
import path from 'path';
import os from 'os';
import https from 'https';
import { spawn, spawnSync, ChildProcess } from 'child_process';
import type { BrowserWindow } from 'electron';
import * as electron from 'electron';
const app = (electron as any)?.app || ((electron as any)?.default?.app) || undefined;
import { store } from './store.ts';
import { sanitizeReportText } from './launcher.ts';
import { desktopIntegration } from './desktop.ts';

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

export interface OsrsCrashReport {
  timestamp: number;
  clientType: 'runelite' | 'hdos' | 'official';
  exitCode: number | null;
  signal: string | null;
  category: 'headless_jre' | 'jvm_oom' | 'unsatisfied_link' | 'bad_java_version' | 'permission_denied' | 'jvm_fatal' | 'unknown';
  title: string;
  summary: string;
  remediation: string;
  actionId?: string;
  actionLabel?: string;
  stderrSnippet: string;
  stdoutSnippet: string;
  systemInfo: {
    javaPath: string | null;
    displayServer: string;
    ramGb: string;
  };
}

export function classifyOsrsCrash(
  code: number | null,
  signal: string | null,
  stderr: string,
  stdout: string
): {
  category: OsrsCrashReport['category'];
  title: string;
  summary: string;
  remediation: string;
  actionId?: string;
  actionLabel?: string;
} {
  const combined = (stderr + '\n' + stdout).toLowerCase();

  // 1. Headless JRE Exception
  if (combined.includes('headless') || combined.includes('no x11 display') || combined.includes('libawt_xawt') || combined.includes('headlessexception')) {
    return {
      category: 'headless_jre',
      title: 'Headless JRE Detected (AWT / Swing Missing)',
      summary: 'The active Java runtime is a headless package lacking GUI/AWT display libraries.',
      remediation: 'Install a headful OpenJDK JRE package (e.g. "sudo apt install default-jre" or "sudo pacman -S jre-openjdk").',
      actionId: 'install_headful_java',
      actionLabel: 'Install Headful JRE'
    };
  }

  // 2. Out of Memory Error
  if (combined.includes('outofmemoryerror') || combined.includes('could not reserve enough space') || signal === 'SIGKILL' || code === 137) {
    return {
      category: 'jvm_oom',
      title: 'Java Heap Out-Of-Memory (OOM) Exhaustion',
      summary: 'The JVM ran out of memory or exceeded the physical RAM limit.',
      remediation: 'Enable Low-Spec Mode or adjust Custom JVM Parameters (e.g. -Xmx768m) in Settings.',
      actionId: 'enable_lowspec',
      actionLabel: 'Enable Low-Spec Heap'
    };
  }

  // 3. Unsupported Class Version Error (Java too old)
  if (combined.includes('unsupportedclassversionerror') || combined.includes('has been compiled by a more recent version of the java')) {
    return {
      category: 'bad_java_version',
      title: 'Incompatible / Outdated Java Version',
      summary: 'The active Java version is too old to execute this client (Java 11+ is required).',
      remediation: 'Install OpenJDK 17 or 21 and configure it in Settings > Old School RuneScape.'
    };
  }

  // 4. Unsatisfied Link Error (Native libraries)
  if (combined.includes('unsatisfiedlinkerror') || combined.includes('cannot open shared object file')) {
    const match = stderr.match(/cannot open shared object file:\s*([^\s:]+)/i);
    const lib = match ? match[1] : 'native library';
    return {
      category: 'unsatisfied_link',
      title: `Missing Native Library: ${lib}`,
      summary: `The client could not load the native library ${lib}.`,
      remediation: 'Run OSRS Doctor in Settings to identify and install missing system packages.'
    };
  }

  // 5. Permission Denied
  if (combined.includes('permission denied') || combined.includes('eacces')) {
    return {
      category: 'permission_denied',
      title: 'Filesystem Permission Denied (~/.runelite or ~/.hdos)',
      summary: 'Client directories contain root-owned files from prior sudo usage.',
      remediation: 'Run "Fix Permissions" in Settings > Old School RuneScape.',
      actionId: 'fix_runelite_perms',
      actionLabel: 'Fix Permissions'
    };
  }

  // 6. JVM Fatal Crash Dump (hs_err_pid)
  if (combined.includes('fatal error has been detected by the java runtime') || combined.includes('hs_err_pid') || signal === 'SIGSEGV' || code === 139) {
    return {
      category: 'jvm_fatal',
      title: 'JVM Core Crash / Fatal Signal',
      summary: 'The Java runtime crashed fatally in native code or graphics dispatch.',
      remediation: 'Enable Mesa Compatibility Profile override in Settings > RS3 / Low-Spec Mode, or update graphics drivers.'
    };
  }

  return {
    category: 'unknown',
    title: `Unexpected OSRS Exit (${signal ? `Signal ${signal}` : `Code ${code}`})`,
    summary: `Client terminated unexpectedly with exit code ${code ?? 'N/A'}.`,
    remediation: 'Run OSRS Diagnostics in Settings or click "Report Issue" to copy sanitized logs.'
  };
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
  private gamePid: number | null = null;
  private monitorInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private wasKilledByUser: boolean = false;
  private crashFile: string;

  constructor() {
    this.baseDir = path.join(os.homedir(), '.local', 'share', 'linux-jagex-launcher');
    this.runeliteDir = path.join(this.baseDir, 'runelite');
    this.hdosDir = path.join(this.baseDir, 'hdos');
    const configDir = path.join(os.homedir(), '.config', 'linux-jagex-launcher');
    if (!fs.existsSync(configDir)) {
      try {
        fs.mkdirSync(configDir, { recursive: true });
      } catch {}
    }
    this.crashFile = path.join(configDir, 'last_crash_osrs.json');

    if (!fs.existsSync(this.runeliteDir)) fs.mkdirSync(this.runeliteDir, { recursive: true });
    if (!fs.existsSync(this.hdosDir)) fs.mkdirSync(this.hdosDir, { recursive: true });
  }

  public getGamePid(): number | null {
    return this.gamePid || this.findOsrsPid();
  }

  public findOsrsPid(): number | null {
    if (process.platform !== 'linux') return null;
    try {
      const pids = fs.readdirSync('/proc').filter((p) => /^\d+$/.test(p));
      for (const pid of pids) {
        try {
          const numPid = parseInt(pid, 10);
          if (numPid === process.pid) continue;

          const cmdline = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8');
          if (
            (cmdline.includes('net.runelite.client.RuneLite') ||
             cmdline.includes('RuneLite.jar') ||
             cmdline.includes('hdos-launcher.jar') ||
             cmdline.includes('com.hdos') ||
             cmdline.includes('hdos.dev') ||
             cmdline.includes('/hdos/') ||
             cmdline.includes('jagexapp.osrs') ||
             cmdline.includes('osrs-launcher')) &&
            !cmdline.includes('linux-jagex-launcher') &&
            !cmdline.includes('oxlint') &&
            !cmdline.includes('tsx')
          ) {
            return numPid;
          }
        } catch {}
      }
    } catch {}
    return null;
  }

  private startMonitoring(targetPid: number, mainWindow?: BrowserWindow): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }
    this.gamePid = targetPid;
    this.isRunning = true;

    this.monitorInterval = setInterval(() => {
      try {
        process.kill(targetPid, 0);
      } catch (err: any) {
        if (err.code === 'ESRCH') {
          // Process no longer exists
          this.stopMonitoring();
          this.isRunning = false;
          this.gamePid = null;
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('game-state-changed', { isRunning: false, game: 'osrs' });
            const settings = store.getSettings();
            if (settings.minimizeToTray && !settings.closeOnLaunch) {
              mainWindow.show();
            }
          }
        }
      }
    }, 1000);
  }

  private stopMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
  }

  public getLastCrash(): OsrsCrashReport | null {
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

    if (clientType === 'runelite') {
      desktopIntegration.installRuneliteIntegration();
      desktopIntegration.updateCaches();
    } else if (clientType === 'hdos') {
      desktopIntegration.installHdosIntegration();
      desktopIntegration.updateCaches();
    }

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

    // Ensure official desktop entry and icon are registered in GNOME/KDE
    if (clientType === 'runelite') {
      desktopIntegration.installRuneliteIntegration();
    } else if (clientType === 'hdos') {
      desktopIntegration.installHdosIntegration();
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

    // Strip Electron, Chromium, and Wayland runtime variables
    delete env.OZONE_PLATFORM;
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.ELECTRON_NO_ATTACH;
    delete env.NODE_OPTIONS;
    delete env.CHROME_DESKTOP;
    delete env.ORIGINAL_XDG_CURRENT_DESKTOP;
    delete env.EGL_PLATFORM;
    delete env.NO_AT_BRIDGE;

    if (settings.lowSpecMode) {
      env.mesa_glthread = 'true';
      env.LIBGL_ALWAYS_SOFTWARE = '0';
      if (settings.rs3CompatProfileOverride !== false) {
        env.MESA_GL_VERSION_OVERRIDE = '4.5COMPAT';
        env.MESA_GLSL_VERSION_OVERRIDE = '450';
      }
    }

    const customJvmArgs = (settings.osrsJvmArgs || '').trim().split(/\s+/).filter(Boolean);
    const customClientArgs = (settings.osrsClientArgs || '').trim().split(/\s+/).filter(Boolean);

    // If Low-Spec Mode is active and user has not specified custom JVM parameters,
    // apply optimized flags: 768MB max heap (avoids OOM/swapping on 4GB-8GB systems), G1GC with low pause times,
    // and force hardware OpenGL acceleration on older GPUs
    const effectiveJvmArgs = customJvmArgs.length > 0
      ? customJvmArgs
      : (settings.lowSpecMode ? ['-Xmx768m', '-XX:+UseG1GC', '-XX:MaxGCPauseMillis=20', '-Dsun.java2d.opengl=true'] : []);

    let baseCmd = targetExecutable;
    let baseArgs: string[] = [];

    if (systemClient?.startsWith('flatpak:')) {
      const flatpakAppId = systemClient.replace('flatpak:', '');
      baseCmd = 'flatpak';
      baseArgs = ['run', flatpakAppId, ...customClientArgs];
    } else if (isJar) {
      baseArgs = [
        ...effectiveJvmArgs,
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
    let stderrBuffer = '';
    const stdoutRing: string[] = [];
    const stderrRing: string[] = [];
    const maxRingLines = 150;

    try {
      this.wasKilledByUser = false;
      const child = spawn(baseCmd, baseArgs, {
        env,
        cwd: os.homedir(),
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
        console.error(`[OSRS stderr] ${str.trim()}`);
      });

      child.stdout?.on('data', (chunk) => {
        const str = chunk.toString();
        for (const line of str.split('\n')) {
          if (line.trim()) {
            stdoutRing.push(line.trim());
            if (stdoutRing.length > maxRingLines) stdoutRing.shift();
          }
        }
        console.log(`[OSRS stdout] ${chunk.toString().trim()}`);
      });

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('game-state-changed', { isRunning: true, game: 'osrs', client: clientType });
      }

      let checkTimer: NodeJS.Timeout | null = null;

      child.on('error', (err) => {
        console.error('[OSRS] Process error:', err);
        if (quitTimeout) {
          clearTimeout(quitTimeout);
          quitTimeout = null;
        }
        if (checkTimer) {
          clearTimeout(checkTimer);
          checkTimer = null;
        }
        this.isRunning = false;
        this.activeProcess = null;
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.show();
          mainWindow.webContents.send('game-state-changed', { isRunning: false, error: err.message });
        }
      });

      // Check for spawned OSRS game client if bootstrap wrapper exits quickly
      checkTimer = setTimeout(() => {
        const activePid = this.findOsrsPid();
        if (activePid) {
          console.log(`[OSRS] Active client confirmed running with PID ${activePid}. Monitoring process...`);
          this.startMonitoring(activePid, mainWindow);
        }
      }, 2500);

      child.on('exit', (code, signal) => {
        console.log(`[OSRS] Process terminated with code: ${code}, signal: ${signal}`);
        if (checkTimer) {
          clearTimeout(checkTimer);
          checkTimer = null;
        }
        this.activeProcess = null;

        // If the wrapper exited cleanly (code 0 or null), check if the actual client process
        // was spawned and is still running. If so, do not reset running state or send exit event!
        const activePid = this.findOsrsPid();
        if ((code === 0 || code === null) && activePid) {
          console.log(`[OSRS] Wrapper exited cleanly, but client is running (PID ${activePid}). Retaining active state.`);
          this.startMonitoring(activePid, mainWindow);
          return;
        }

        // Check if an active process appears within a 3-second grace period (JVM fork delay)
        if (code === 0 || code === null) {
          let attempts = 0;
          const pollInterval = setInterval(() => {
            attempts++;
            const delayedPid = this.findOsrsPid();
            if (delayedPid) {
              clearInterval(pollInterval);
              console.log(`[OSRS] Discovered spawned client PID ${delayedPid}. Monitoring process...`);
              this.startMonitoring(delayedPid, mainWindow);
              return;
            }
            if (attempts >= 6) {
              clearInterval(pollInterval);
              this.isRunning = false;
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('game-state-changed', { isRunning: false, game: 'osrs' });
                if (settings.minimizeToTray && !settings.closeOnLaunch) {
                  mainWindow.show();
                }
              }
            }
          }, 500);
          return;
        }

        this.isRunning = false;

        if (code !== 0 && code !== null && !this.wasKilledByUser) {
          const classification = classifyOsrsCrash(code, signal, stderrBuffer, stdoutRing.join('\n'));
          const displayServer = process.env.XDG_SESSION_TYPE || (process.env.WAYLAND_DISPLAY ? 'wayland' : 'x11');
          const totalRamGb = (os.totalmem() / (1024 * 1024 * 1024)).toFixed(1);

          const crashReport: OsrsCrashReport = {
            timestamp: Date.now(),
            clientType,
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
              javaPath: javaBin,
              displayServer,
              ramGb: totalRamGb
            }
          };

          try {
            fs.writeFileSync(this.crashFile, JSON.stringify(crashReport, null, 2), 'utf8');
          } catch (writeErr) {
            console.error('[OSRS] Failed to write crash log:', writeErr);
          }

          let helpfulMsg = `${classification.title}: ${classification.summary}`;
          if (classification.remediation) {
            helpfulMsg += ` (${classification.remediation})`;
          }

          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.show();
            mainWindow.webContents.send('game-state-changed', {
              isRunning: false,
              game: 'osrs',
              client: clientType,
              error: helpfulMsg,
              crashReport
            });
          }
        } else if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('game-state-changed', { isRunning: false, game: 'osrs' });
          if (settings.minimizeToTray && !settings.closeOnLaunch) {
            mainWindow.show();
          }
        }
      });

      if (settings.closeOnLaunch) {
        console.log('[OSRS] Close on launch enabled. Minimizing/exiting launcher to free RAM in 3s...');
        quitTimeout = setTimeout(() => {
          app?.quit();
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
    if (this.gamePid) {
      try {
        process.kill(this.gamePid, 0);
        return true;
      } catch {
        this.stopMonitoring();
        this.gamePid = null;
        this.isRunning = false;
        return false;
      }
    }
    const detected = this.findOsrsPid();
    if (detected) {
      this.startMonitoring(detected);
      return true;
    }
    return this.isRunning;
  }

  public killGame(): void {
    this.wasKilledByUser = true;
    this.stopMonitoring();
    if (this.activeProcess && !this.activeProcess.killed) {
      this.activeProcess.kill('SIGTERM');
      this.activeProcess = null;
    }
    const pid = this.gamePid || this.findOsrsPid();
    if (pid) {
      try {
        process.kill(pid, 'SIGTERM');
        setTimeout(() => {
          try {
            process.kill(pid, 'SIGKILL');
          } catch {}
        }, 1500);
      } catch {}
    }
    this.gamePid = null;
    this.isRunning = false;
  }
}

export const osrs = new OsrsManager();
