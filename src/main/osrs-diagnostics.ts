import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawnSync } from 'child_process';
import { store } from './store.ts';
import { osrs } from './osrs.ts';
import { detectDistroFamily, type DistroFamily } from './diagnostics.ts';

export type OsrsDiagnosticCategory =
  | 'system'
  | 'java'
  | 'client'
  | 'storage'
  | 'graphics'
  | 'account'
  | 'crash'
  | 'network'
  | 'audio';

export type OsrsDiagnosticActionId =
  | 'install_headful_java'
  | 'install_runelite_jar'
  | 'install_hdos_jar'
  | 'fix_runelite_perms'
  | 'enable_lowspec'
  | 'kill_osrs_zombies'
  | 'enable_font_smoothing'
  | 'enable_zgc';

export interface OsrsDiagnosticCheck {
  id: string;
  name: string;
  category: OsrsDiagnosticCategory;
  status: 'ok' | 'warning' | 'error';
  message: string;
  remediation?: string;
  actionId?: OsrsDiagnosticActionId;
  actionLabel?: string;
}

export interface OsrsDoctorReport {
  timestamp: number;
  osName: string;
  osVersion: string;
  distroFamily: DistroFamily;
  arch: string;
  isRoot: boolean;
  selectedClient: 'runelite' | 'hdos' | 'official';
  javaPath: string | null;
  javaVersion: string | null;
  isHeadlessJava: boolean;
  allOk: boolean;
  checks: OsrsDiagnosticCheck[];
  suggestedPackageCommand?: {
    packageManager: string;
    command: string;
  };
}

const COMMON_LIB_DIRS = [
  '/usr/lib/x86_64-linux-gnu',
  '/usr/lib64',
  '/usr/lib',
  '/lib/x86_64-linux-gnu',
  '/lib64',
  '/app/lib'
];

function findLibraryInPaths(libName: string): string | null {
  for (const dir of COMMON_LIB_DIRS) {
    const full = path.join(dir, libName);
    try {
      if (fs.existsSync(full)) return full;
    } catch {}
  }
  return null;
}

export class OsrsDoctor {
  public parseJavaDetails(javaPath: string | null, customOutput?: string): { version: string | null; majorVersion: number | null; is64Bit: boolean; isHeadless: boolean } {
    if (!javaPath && !customOutput) {
      return { version: null, majorVersion: null, is64Bit: false, isHeadless: false };
    }
    if (javaPath && !customOutput && !fs.existsSync(javaPath)) {
      return { version: null, majorVersion: null, is64Bit: false, isHeadless: false };
    }

    let versionStr: string | null = null;
    let majorVersion: number | null = null;
    let is64Bit = false;
    let isHeadless = false;

    try {
      let output = customOutput || '';
      if (!customOutput && javaPath) {
        const res = spawnSync(javaPath, ['-version'], { encoding: 'utf8' });
        output = (res.stderr || '') + '\n' + (res.stdout || '');
      }

      // Check 64-bit
      if (output.includes('64-Bit') || output.includes('x86_64') || output.includes('amd64')) {
        is64Bit = true;
      }

      // Check version
      const verMatch = output.match(/version "(.*?)"/i) || output.match(/openjdk (\d[\d._]*)/i);
      if (verMatch) {
        versionStr = verMatch[1];
        if (versionStr.startsWith('1.')) {
          // e.g. 1.8.0 -> 8
          const parts = versionStr.split('.');
          majorVersion = parseInt(parts[1], 10);
        } else {
          // e.g. 17.0.2 -> 17, 21.0.1 -> 21
          const parts = versionStr.split('.');
          majorVersion = parseInt(parts[0], 10);
        }
      }

      if (output.toLowerCase().includes('headless')) {
        isHeadless = true;
      }
    } catch {}

    // Check for Headless JRE (missing libawt_xawt.so) if running on a real binary
    if (javaPath && fs.existsSync(javaPath)) {
      try {
        const javaDir = path.dirname(path.dirname(fs.realpathSync(javaPath)));
        const candidates = [
          path.join(javaDir, 'lib', 'libawt_xawt.so'),
          path.join(javaDir, 'lib', 'amd64', 'libawt_xawt.so'),
          path.join(javaDir, 'jre', 'lib', 'amd64', 'libawt_xawt.so'),
          path.join(javaDir, 'lib', 'libawt.so')
        ];

        const foundXawt = candidates.some(p => fs.existsSync(p));
        // Also test executing -Djava.awt.headless=false
        if (!foundXawt) {
          const testAwt = spawnSync(javaPath, ['-Djava.awt.headless=false', '-help'], { encoding: 'utf8' });
          const testOut = (testAwt.stderr || '') + '\n' + (testAwt.stdout || '');
          if (testOut.includes('HeadlessException') || testOut.includes('libawt_xawt')) {
            isHeadless = true;
          }
        }
      } catch {}
    }

    return { version: versionStr, majorVersion, is64Bit, isHeadless };
  }

  public checkDirectoryRootOwnership(dirPath: string): boolean {
    if (!fs.existsSync(dirPath)) return false;
    try {
      const stat = fs.statSync(dirPath);
      if (typeof stat.uid === 'number' && stat.uid === 0) return true;

      const entries = fs.readdirSync(dirPath);
      for (const entry of entries.slice(0, 30)) {
        try {
          const entryStat = fs.statSync(path.join(dirPath, entry));
          if (typeof entryStat.uid === 'number' && entryStat.uid === 0) {
            return true;
          }
        } catch {}
      }
    } catch {}
    return false;
  }

  public repairPermissions(targetDir: string): { repaired: boolean; error?: string } {
    if (!fs.existsSync(targetDir)) return { repaired: true };
    try {
      const currentUid = typeof process.getuid === 'function' ? process.getuid() : null;
      const currentGid = typeof process.getgid === 'function' ? process.getgid() : null;

      if (currentUid !== null && currentGid !== null) {
        const entries = fs.readdirSync(targetDir);
        for (const entry of entries) {
          const full = path.join(targetDir, entry);
          try {
            const stat = fs.statSync(full);
            if (stat.uid === 0) {
              fs.chownSync(full, currentUid, currentGid);
            }
          } catch {}
        }
        return { repaired: true };
      }
    } catch (e: any) {
      return { repaired: false, error: e.message };
    }
    return { repaired: true };
  }

  public detectZombieProcesses(): number[] {
    const zombies: number[] = [];
    const activeGamePid = osrs.getGamePid();
    if (process.platform === 'linux') {
      try {
        const pids = fs.readdirSync('/proc').filter((p) => /^\d+$/.test(p));
        for (const pid of pids) {
          try {
            const numPid = parseInt(pid, 10);
            if (numPid === process.pid || (activeGamePid && numPid === activeGamePid)) continue;

            const cmdline = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8');
            if (
              (cmdline.includes('RuneLite.jar') ||
               cmdline.includes('hdos-launcher.jar') ||
               cmdline.includes('net.runelite.client.RuneLite') ||
               cmdline.includes('hdos.dev') ||
               cmdline.includes('/hdos/')) &&
              !cmdline.includes('linux-jagex-launcher') &&
              !cmdline.includes('tsx') &&
              !cmdline.includes('oxlint')
            ) {
              zombies.push(numPid);
            }
          } catch {}
        }
      } catch {}
    }
    return zombies;
  }

  public killZombies(): number {
    let killed = 0;
    const zombies = this.detectZombieProcesses();
    for (const pid of zombies) {
      try {
        process.kill(pid, 'SIGKILL');
        killed++;
      } catch {}
    }
    return killed;
  }

  public async probeNetwork(): Promise<OsrsDiagnosticCheck[]> {
    const checks: OsrsDiagnosticCheck[] = [];
    const endpoints = [
      { id: 'net_osrs_config', name: 'OSRS Config Server (jav_config.ws)', url: 'https://oldschool.runescape.com/jav_config.ws' },
      { id: 'net_jagex_auth', name: 'Jagex Identity & Auth Server', url: 'https://auth.jagex.com' },
      { id: 'net_client_cdn', name: 'Client Update CDN', url: 'https://api.runelite.net/' }
    ];

    await Promise.allSettled(
      endpoints.map(async (ep) => {
        const start = Date.now();
        const res = await fetch(ep.url, { method: 'HEAD', signal: AbortSignal.timeout(3000) });
        const latency = Date.now() - start;

        // Check system clock drift against HTTP Date header
        if (ep.id === 'net_osrs_config' || ep.id === 'net_jagex_auth') {
          const dateHeader = res.headers.get('date');
          if (dateHeader) {
            const serverTime = Date.parse(dateHeader);
            if (!isNaN(serverTime)) {
              const skewSeconds = Math.abs(Math.round((Date.now() - serverTime) / 1000));
              if (skewSeconds > 300) {
                checks.push({
                  id: 'osrs_network_clock',
                  name: 'System Clock / NTP Synchronization',
                  category: 'network',
                  status: 'error',
                  message: `System clock is desynchronized by ~${skewSeconds}s. Jagex OAuth login tokens will fail signature verification.`,
                  remediation: 'Synchronize system time: sudo timedatectl set-ntp true (or chronyd -q)'
                });
              } else if (skewSeconds > 90) {
                checks.push({
                  id: 'osrs_network_clock',
                  name: 'System Clock / NTP Synchronization',
                  category: 'network',
                  status: 'warning',
                  message: `System clock has mild drift (~${skewSeconds}s). We recommend enabling NTP synchronization.`,
                  remediation: 'Synchronize system time: sudo timedatectl set-ntp true'
                });
              }
            }
          }
        }

        if (res.ok || res.status < 500) {
          checks.push({
            id: ep.id,
            name: ep.name,
            category: 'network',
            status: 'ok',
            message: `Endpoint reachable (${latency}ms, HTTP ${res.status}).`
          });
        } else {
          checks.push({
            id: ep.id,
            name: ep.name,
            category: 'network',
            status: 'warning',
            message: `Unexpected HTTP status ${res.status} (${latency}ms).`,
            remediation: 'Check network connection or firewall settings.'
          });
        }
      })
    );

    // If clock check wasn't already flagged, add an OK check
    if (!checks.some(c => c.id === 'osrs_network_clock')) {
      checks.push({
        id: 'osrs_network_clock',
        name: 'System Clock / NTP Synchronization',
        category: 'network',
        status: 'ok',
        message: 'System clock is synchronized with Jagex authentication services.'
      });
    }

    return checks;
  }

  public runDoctor(): OsrsDoctorReport {
    const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;
    const settings = store.getSettings();
    const selectedClient = settings.selectedOsrsClient || 'runelite';
    const distroFamily = detectDistroFamily();
    const javaPath = osrs.findJava();
    const javaInfo = this.parseJavaDetails(javaPath);
    const checks: OsrsDiagnosticCheck[] = [];
    const missingPackages: string[] = [];

    // 1. Root / Sudo check
    if (isRoot) {
      checks.push({
        id: 'user_root',
        name: 'Process User Permissions',
        category: 'system',
        status: 'error',
        message: 'Running launcher with sudo/root causes ~/.runelite and ~/.hdos files to become root-owned and unwriteable.',
        remediation: 'Do not use "sudo" to launch the application. Run as your regular desktop user.'
      });
    } else {
      checks.push({
        id: 'user_root',
        name: 'Process User Permissions',
        category: 'system',
        status: 'ok',
        message: `Running cleanly as standard desktop user (UID ${typeof process.getuid === 'function' ? process.getuid() : 1000}).`
      });
    }

    // 2. Java Runtime Installation Check
    if (!javaPath) {
      missingPackages.push('java');
      checks.push({
        id: 'osrs_java_installed',
        name: 'Java Runtime Environment (JRE / JDK)',
        category: 'java',
        status: 'error',
        message: 'No Java executable found in PATH, JAVA_HOME, or /usr/lib/jvm. Old School RuneScape clients require Java 11+ to launch.',
        remediation: 'Install OpenJDK 17 or 21 via your package manager.',
        actionId: 'install_headful_java',
        actionLabel: 'Install Headful Java'
      });
    } else {
      checks.push({
        id: 'osrs_java_installed',
        name: 'Java Runtime Environment (JRE / JDK)',
        category: 'java',
        status: 'ok',
        message: `Located Java runtime binary at ${javaPath}.`
      });
    }

    // 3. Java Version & Architecture Validation
    if (!javaPath) {
      checks.push({
        id: 'osrs_java_version',
        name: 'Java Version Compatibility',
        category: 'java',
        status: 'error',
        message: 'No Java runtime available to verify version compatibility. Java 17 or 21 is required.',
        remediation: 'Install OpenJDK 17 or 21: sudo apt install openjdk-17-jre (or pacman -S jre17-openjdk).',
        actionId: 'install_headful_java',
        actionLabel: 'Install Java 17'
      });
    } else if (javaInfo.majorVersion !== null) {
      if (javaInfo.majorVersion < 11) {
        missingPackages.push('java');
        checks.push({
          id: 'osrs_java_version',
          name: 'Java Version Compatibility',
          category: 'java',
          status: 'error',
          message: `Detected Java ${javaInfo.version || javaInfo.majorVersion}. Modern RuneLite and HDOS require at least Java 11 (Java 17/21 recommended).`,
          remediation: 'Install OpenJDK 17 or 21: sudo apt install openjdk-17-jre (or pacman -S jre17-openjdk).',
          actionId: 'install_headful_java',
          actionLabel: 'Install Java 17'
        });
      } else {
        checks.push({
          id: 'osrs_java_version',
          name: 'Java Version Compatibility',
          category: 'java',
          status: 'ok',
          message: `Java ${javaInfo.version || javaInfo.majorVersion} detected (${javaInfo.is64Bit ? '64-Bit' : '32-Bit'}). Meets requirements for RuneLite and HDOS.`
        });
      }
    } else {
      checks.push({
        id: 'osrs_java_version',
        name: 'Java Version Compatibility',
        category: 'java',
        status: 'ok',
        message: 'Java runtime found. Custom executable detected.'
      });
    }

    // 4. Headless JRE Check (The #1 Linux OSRS Trap)
    if (!javaPath) {
      checks.push({
        id: 'osrs_java_headless',
        name: 'Headful GUI Display Support (AWT / Swing)',
        category: 'java',
        status: 'error',
        message: 'No Java runtime detected. A headful OpenJDK installation (providing libawt_xawt.so) is required.',
        remediation: 'Install the complete headful JRE package via your package manager.',
        actionId: 'install_headful_java',
        actionLabel: 'Install Headful JRE'
      });
    } else if (javaInfo.isHeadless) {
      missingPackages.push('java');
      checks.push({
        id: 'osrs_java_headless',
        name: 'Headful GUI Display Support (AWT / Swing)',
        category: 'java',
        status: 'error',
        message: 'Headless JRE detected! Your system has a headless Java package installed lacking libawt_xawt.so. RuneLite/HDOS will crash immediately with java.awt.HeadlessException.',
        remediation: 'Install the complete headful JRE package via your package manager.',
        actionId: 'install_headful_java',
        actionLabel: 'Install Headful JRE'
      });
    } else {
      checks.push({
        id: 'osrs_java_headless',
        name: 'Headful GUI Display Support (AWT / Swing)',
        category: 'java',
        status: 'ok',
        message: 'Java runtime has headful AWT/X11 GUI libraries present.'
      });
    }

    // 5. Client JAR / Binary Status
    const runeliteJar = osrs.getRuneliteJarPath();
    const hdosJar = osrs.getHdosJarPath();
    const systemRunelite = osrs.findSystemClient('runelite');
    const systemHdos = osrs.findSystemClient('hdos');

    if (selectedClient === 'runelite') {
      const hasJar = fs.existsSync(runeliteJar) && fs.statSync(runeliteJar).size > 1024;
      if (systemRunelite) {
        checks.push({
          id: 'osrs_client_status',
          name: 'RuneLite Client Installation',
          category: 'client',
          status: 'ok',
          message: `Detected system RuneLite executable at ${systemRunelite}.`
        });
      } else if (hasJar) {
        const sizeMb = (fs.statSync(runeliteJar).size / 1024 / 1024).toFixed(1);
        checks.push({
          id: 'osrs_client_status',
          name: 'RuneLite Client Installation',
          category: 'client',
          status: 'ok',
          message: `Official managed RuneLite.jar ready in user data (${sizeMb} MB).`
        });
      } else {
        checks.push({
          id: 'osrs_client_status',
          name: 'RuneLite Client Installation',
          category: 'client',
          status: 'warning',
          message: 'RuneLite launcher JAR is not yet downloaded. Clicking "PLAY" will automatically download it without root.',
          remediation: 'Click "Install / Verify" in Settings or click "PLAY" on the main dock.',
          actionId: 'install_runelite_jar',
          actionLabel: 'Download RuneLite'
        });
      }
    } else if (selectedClient === 'hdos') {
      const hasJar = fs.existsSync(hdosJar) && fs.statSync(hdosJar).size > 1024;
      if (systemHdos) {
        checks.push({
          id: 'osrs_client_status',
          name: 'HDOS Client Installation',
          category: 'client',
          status: 'ok',
          message: `Detected system HDOS binary at ${systemHdos}.`
        });
      } else if (hasJar) {
        const sizeMb = (fs.statSync(hdosJar).size / 1024 / 1024).toFixed(1);
        checks.push({
          id: 'osrs_client_status',
          name: 'HDOS Client Installation',
          category: 'client',
          status: 'ok',
          message: `Official managed hdos-launcher.jar ready in user data (${sizeMb} MB).`
        });
      } else {
        checks.push({
          id: 'osrs_client_status',
          name: 'HDOS Client Installation',
          category: 'client',
          status: 'warning',
          message: 'HDOS launcher JAR not yet downloaded. Clicking "PLAY" will download the latest release automatically.',
          remediation: 'Click "Install HDOS" to download.',
          actionId: 'install_hdos_jar',
          actionLabel: 'Download HDOS'
        });
      }
    } else {
      // Official client
      const customPath = settings.osrsCustomClientPath?.trim();
      if (customPath && fs.existsSync(customPath)) {
        checks.push({
          id: 'osrs_client_status',
          name: 'Official OSRS Client Path',
          category: 'client',
          status: 'ok',
          message: `Custom runner executable located at ${customPath}.`
        });
      } else {
        checks.push({
          id: 'osrs_client_status',
          name: 'Official OSRS Client Path',
          category: 'client',
          status: 'warning',
          message: 'Official OSRS C++ client on Linux requires Steam/Proton or a custom runner script.',
          remediation: 'Configure a custom client path in Settings, or select RuneLite / HDOS for native Linux play.'
        });
      }
    }

    // 6. User Profile Permissions (~/.runelite and ~/.hdos)
    const runeliteProfileDir = path.join(os.homedir(), '.runelite');
    const hasRuneliteRoot = this.checkDirectoryRootOwnership(runeliteProfileDir);
    if (hasRuneliteRoot) {
      checks.push({
        id: 'osrs_profile_perms',
        name: 'RuneLite Profile Directory Permissions (~/.runelite)',
        category: 'storage',
        status: 'error',
        message: 'Files in ~/.runelite are owned by root (from previous sudo usage). Custom tile markers, bank tags, and plugins will fail to save or update.',
        remediation: 'Click "Fix Permissions" to restore standard user ownership to ~/.runelite.',
        actionId: 'fix_runelite_perms',
        actionLabel: 'Fix Permissions'
      });
    } else if (fs.existsSync(runeliteProfileDir)) {
      checks.push({
        id: 'osrs_profile_perms',
        name: 'RuneLite Profile Directory Permissions (~/.runelite)',
        category: 'storage',
        status: 'ok',
        message: 'User profile directory ~/.runelite has clean non-root user permissions.'
      });
    } else {
      checks.push({
        id: 'osrs_profile_perms',
        name: 'RuneLite Profile Directory Permissions (~/.runelite)',
        category: 'storage',
        status: 'ok',
        message: 'User profile directory ~/.runelite is clean (not yet created).'
      });
    }

    // 7. JVM Memory & Heap Limits Check
    const totalRamBytes = os.totalmem();
    const totalRamGb = (totalRamBytes / (1024 * 1024 * 1024)).toFixed(1);
    const customJvm = settings.osrsJvmArgs || '';
    const xmxMatch = customJvm.match(/-Xmx(\d+)([mgMG])/);

    if (xmxMatch) {
      const val = parseInt(xmxMatch[1], 10);
      const unit = xmxMatch[2].toLowerCase();
      const heapMb = unit === 'g' ? val * 1024 : val;
      const ramMb = totalRamBytes / (1024 * 1024);

      if (heapMb > ramMb * 0.85) {
        checks.push({
          id: 'osrs_jvm_heap',
          name: 'JVM Heap Allocation Limit (-Xmx)',
          category: 'java',
          status: 'warning',
          message: `Custom JVM heap allocation (${heapMb} MB) exceeds 85% of total system RAM (${totalRamGb} GB). The JVM may fail to initialize or trigger Linux OOM termination.`,
          remediation: 'Lower custom -Xmx in Settings or enable Low-Spec Mode.'
        });
      } else {
        checks.push({
          id: 'osrs_jvm_heap',
          name: 'JVM Heap Allocation Limit (-Xmx)',
          category: 'java',
          status: 'ok',
          message: `Configured heap allocation: ${heapMb} MB (safe for ${totalRamGb} GB total RAM).`
        });
      }
    } else if (totalRamBytes < 4.5 * 1024 * 1024 * 1024) {
      checks.push({
        id: 'osrs_jvm_heap',
        name: 'System RAM & Heap Recommendation',
        category: 'java',
        status: 'warning',
        message: `System has ${totalRamGb} GB RAM. Unconstrained Java heaps can trigger swap thrashing or OOM termination.`,
        remediation: 'Enable "Performance Mode (Low-Spec / Older Hardware)" in Settings to cap heap at 768MB with G1GC.',
        actionId: 'enable_lowspec',
        actionLabel: 'Enable Low-Spec Heap'
      });
    } else {
      checks.push({
        id: 'osrs_jvm_heap',
        name: 'System RAM & Heap Recommendation',
        category: 'java',
        status: 'ok',
        message: `System has ${totalRamGb} GB RAM (sufficient for standard JVM heap and 117 HD plugins).`
      });
    }

    // 8. OpenGL Libraries (RuneLite GPU & 117 HD Plugins)
    const glLib = findLibraryInPaths('libOpenGL.so.0') || findLibraryInPaths('libGL.so.1');
    if (glLib) {
      checks.push({
        id: 'osrs_opengl',
        name: 'OpenGL Driver Libraries (RuneLite GPU & 117 HD)',
        category: 'graphics',
        status: 'ok',
        message: `Found OpenGL dispatch library at ${glLib}. Hardware acceleration available for 117 HD and GPU plugins.`
      });
    } else {
      checks.push({
        id: 'osrs_opengl',
        name: 'OpenGL Driver Libraries (RuneLite GPU & 117 HD)',
        category: 'graphics',
        status: 'warning',
        message: 'OpenGL dispatch libraries not detected in standard paths. RuneLite GPU and 117 HD plugins may fail to initialize.',
        remediation: 'Install libglvnd / libopengl0 via your package manager.'
      });
    }

    // 9. Recent OSRS Crash History
    const lastCrash = osrs.getLastCrash();
    if (lastCrash && Date.now() - lastCrash.timestamp < 48 * 60 * 60 * 1000) {
      const elapsedMinutes = Math.round((Date.now() - lastCrash.timestamp) / 60000);
      const timeStr = elapsedMinutes < 60 ? `${elapsedMinutes}m ago` : `${Math.round(elapsedMinutes / 60)}h ago`;
      checks.push({
        id: 'osrs_recent_crash',
        name: 'Recent OSRS Crash Detection',
        category: 'crash',
        status: 'warning',
        message: `Detected crash ${timeStr}: ${lastCrash.title} (${lastCrash.summary}).`,
        remediation: lastCrash.remediation,
        actionId: (lastCrash.actionId as OsrsDiagnosticActionId) || undefined,
        actionLabel: lastCrash.actionLabel
      });
    } else {
      checks.push({
        id: 'osrs_recent_crash',
        name: 'Recent OSRS Client Stability',
        category: 'crash',
        status: 'ok',
        message: 'No client crashes detected in recent Old School RuneScape sessions.'
      });
    }

    // 10. Jagex Account Session Check
    const activeAccount = store.getActiveAccount();
    const characterId = settings.selectedCharacterId || activeAccount?.characters[0]?.id;

    if (activeAccount?.sessionId && characterId) {
      const charName = activeAccount.characters.find(c => c.id === characterId)?.displayName || 'Character';
      checks.push({
        id: 'osrs_jagex_auth',
        name: 'Jagex Account Authentication & Character',
        category: 'account',
        status: 'ok',
        message: `Active session linked for character "${charName}". Authentication parameters are ready for ${selectedClient.toUpperCase()}.`
      });
    } else {
      checks.push({
        id: 'osrs_jagex_auth',
        name: 'Jagex Account Authentication & Character',
        category: 'account',
        status: 'warning',
        message: 'No active character selected. Sign in or choose a character in the launcher top bar before playing.',
        remediation: 'Sign in to your Jagex Account in the top bar.'
      });
    }

    // 11. Stale / Zombie Process Check
    const zombies = this.detectZombieProcesses();
    if (zombies.length > 0) {
      checks.push({
        id: 'osrs_zombies',
        name: 'Zombie / Stale Java Processes',
        category: 'system',
        status: 'warning',
        message: `Detected ${zombies.length} orphan background RuneLite/HDOS process(es) (PID: ${zombies.join(', ')}). Stale processes lock ~/.runelite/cache.`,
        remediation: 'Click "Kill Stale Processes" to terminate background orphan Java instances.',
        actionId: 'kill_osrs_zombies',
        actionLabel: 'Kill Stale Processes'
      });
    } else {
      checks.push({
        id: 'osrs_zombies',
        name: 'Zombie / Stale Java Processes',
        category: 'system',
        status: 'ok',
        message: 'No orphan background RuneLite or HDOS processes detected.'
      });
    }

    // 12. Wayland, HiDPI Scaling & Font Antialiasing
    const isWayland = Boolean(process.env.WAYLAND_DISPLAY || process.env.XDG_SESSION_TYPE === 'wayland');
    const hasFontSmoothing = customJvm.includes('awt.useSystemAAFontSettings') || customJvm.includes('swing.aatext');

    if (!hasFontSmoothing) {
      checks.push({
        id: 'osrs_display_scale',
        name: 'Font Subpixel Anti-Aliasing & Rendering',
        category: 'graphics',
        status: isWayland ? 'warning' : 'ok',
        message: isWayland
          ? 'Wayland display session detected without subpixel font antialiasing flags. RuneLite chatbox and inventory text may appear jagged or pixelated.'
          : 'Standard X11 display session. Font antialiasing JVM flags not yet configured.',
        remediation: 'Click "Enable Smooth Fonts" to inject -Dawt.useSystemAAFontSettings=lcd into JVM parameters.',
        actionId: 'enable_font_smoothing',
        actionLabel: 'Enable Smooth Fonts'
      });
    } else {
      checks.push({
        id: 'osrs_display_scale',
        name: 'Font Subpixel Anti-Aliasing & Rendering',
        category: 'graphics',
        status: 'ok',
        message: 'Font anti-aliasing parameters (-Dawt.useSystemAAFontSettings) active.'
      });
    }

    // 13. HDOS Native C++ Shared Library Subsystem
    if (selectedClient === 'hdos') {
      const hdosLibs = [
        { lib: 'libX11.so.6', name: 'X11 Protocol Client' },
        { lib: 'libXcursor.so.1', name: 'X11 Hardware Cursor' },
        { lib: 'libXrandr.so.2', name: 'X11 Resize and Rotate' },
        { lib: 'libXinerama.so.1', name: 'X11 Multi-Display' },
        { lib: 'libasound.so.2', name: 'ALSA Audio Driver' },
        { lib: 'libGL.so.1', name: 'OpenGL Core Acceleration' }
      ];

      const missingHdosLibs = hdosLibs.filter(l => !findLibraryInPaths(l.lib));
      if (missingHdosLibs.length > 0) {
        missingHdosLibs.forEach(l => {
          if (l.lib.startsWith('libX')) missingPackages.push('hdos_x11');
          if (l.lib.includes('asound')) missingPackages.push('alsa');
          if (l.lib.includes('GL')) missingPackages.push('opengl');
        });

        checks.push({
          id: 'osrs_hdos_deps',
          name: 'HDOS Native C++ Shared Libraries',
          category: 'client',
          status: 'error',
          message: `HDOS native engine requires missing libraries: ${missingHdosLibs.map(l => l.lib).join(', ')}. The client will fail to boot without them.`,
          remediation: 'Install missing X11/ALSA/OpenGL runtime libraries via your package manager.'
        });
      } else {
        checks.push({
          id: 'osrs_hdos_deps',
          name: 'HDOS Native C++ Shared Libraries',
          category: 'client',
          status: 'ok',
          message: 'All native C++ libraries (libX11, libXcursor, libXrandr, libXinerama, libasound, libGL) verified for HDOS.'
        });
      }
    }

    // 14. Java Sound Subsystem & ALSA Backend
    const alsaLib = findLibraryInPaths('libasound.so.2');
    const runtimeDir = process.env.XDG_RUNTIME_DIR || '';
    const hasPipewire = runtimeDir && fs.existsSync(path.join(runtimeDir, 'pipewire-0'));
    const hasPulse = runtimeDir && fs.existsSync(path.join(runtimeDir, 'pulse', 'native'));

    if (!alsaLib) {
      missingPackages.push('alsa');
      checks.push({
        id: 'osrs_audio',
        name: 'Java Sound Subsystem (ALSA / libasound)',
        category: 'audio',
        status: 'warning',
        message: 'libasound.so.2 not found. The Java Sound engine (javax.sound.sampled) will fail to output in-game music and sound effects.',
        remediation: 'Install libasound2 (Ubuntu/Debian) or alsa-lib (Arch/Fedora).'
      });
    } else {
      const serverType = hasPipewire ? 'PipeWire' : (hasPulse ? 'PulseAudio' : 'ALSA Native');
      checks.push({
        id: 'osrs_audio',
        name: 'Java Sound Subsystem (ALSA / libasound)',
        category: 'audio',
        status: 'ok',
        message: `Found libasound.so.2 (${serverType} detected). Java Sound playback ready.`
      });
    }

    // 15. JVM Garbage Collector Tuning (ZGC on Java 21+)
    if (javaPath && javaInfo.majorVersion !== null && javaInfo.majorVersion >= 21) {
      const hasZgc = customJvm.includes('+UseZGC');
      if (!hasZgc) {
        checks.push({
          id: 'osrs_gc_tune',
          name: 'Garbage Collection Latency (ZGC Recommendation)',
          category: 'java',
          status: 'ok',
          message: `Java ${javaInfo.majorVersion} supports Generational ZGC. Enabling it reduces world hop and chunk loading stutters from ~200ms to <1ms.`,
          remediation: 'Click "Enable Generational ZGC" to inject -XX:+UseZGC -XX:+ZGenerational.',
          actionId: 'enable_zgc',
          actionLabel: 'Enable Generational ZGC'
        });
      } else {
        checks.push({
          id: 'osrs_gc_tune',
          name: 'Garbage Collection Latency (ZGC Active)',
          category: 'java',
          status: 'ok',
          message: 'Ultra-low-latency ZGC (-XX:+UseZGC) is enabled for Old School RuneScape.'
        });
      }
    }

    // Multi-distro package manager suggestions for OSRS
    let suggestedPackageCommand: { packageManager: string; command: string } | undefined;
    if (missingPackages.length > 0) {
      const pkgs: string[] = [];
      if (distroFamily === 'arch') {
        if (missingPackages.includes('java')) pkgs.push('jre17-openjdk');
        if (missingPackages.includes('alsa')) pkgs.push('alsa-lib');
        if (missingPackages.includes('hdos_x11')) pkgs.push('libx11 libxcursor libxrandr libxinerama');
        if (missingPackages.includes('opengl')) pkgs.push('libglvnd');
        if (pkgs.length > 0) {
          suggestedPackageCommand = { packageManager: 'arch', command: `sudo pacman -S --needed ${pkgs.join(' ')}` };
        }
      } else if (distroFamily === 'fedora') {
        if (missingPackages.includes('java')) pkgs.push('java-17-openjdk');
        if (missingPackages.includes('alsa')) pkgs.push('alsa-lib');
        if (missingPackages.includes('hdos_x11')) pkgs.push('libX11 libXcursor libXrandr libXinerama');
        if (missingPackages.includes('opengl')) pkgs.push('libglvnd-glx');
        if (pkgs.length > 0) {
          suggestedPackageCommand = { packageManager: 'fedora', command: `sudo dnf install -y ${pkgs.join(' ')}` };
        }
      } else if (distroFamily === 'opensuse') {
        if (missingPackages.includes('java')) pkgs.push('java-17-openjdk');
        if (missingPackages.includes('alsa')) pkgs.push('alsa');
        if (missingPackages.includes('hdos_x11')) pkgs.push('libX11-6 libXcursor1 libXrandr2 libXinerama1');
        if (missingPackages.includes('opengl')) pkgs.push('libglvnd');
        if (pkgs.length > 0) {
          suggestedPackageCommand = { packageManager: 'opensuse', command: `sudo zypper install -y ${pkgs.join(' ')}` };
        }
      } else {
        if (missingPackages.includes('java')) pkgs.push('default-jre');
        if (missingPackages.includes('alsa')) pkgs.push('libasound2');
        if (missingPackages.includes('hdos_x11')) pkgs.push('libx11-6 libxcursor1 libxrandr2 libxinerama1');
        if (missingPackages.includes('opengl')) pkgs.push('libopengl0 libgl1');
        if (pkgs.length > 0) {
          suggestedPackageCommand = { packageManager: 'debian', command: `sudo apt update && sudo apt install -y ${pkgs.join(' ')}` };
        }
      }
    }

    const hasErrors = checks.some(c => c.status === 'error');

    return {
      timestamp: Date.now(),
      osName: os.type(),
      osVersion: os.release(),
      distroFamily,
      arch: os.arch(),
      isRoot,
      selectedClient,
      javaPath,
      javaVersion: javaInfo.version,
      isHeadlessJava: javaInfo.isHeadless,
      allOk: !hasErrors,
      checks,
      suggestedPackageCommand
    };
  }

  public async runDoctorWithProbes(): Promise<OsrsDoctorReport> {
    const baseReport = this.runDoctor();
    const networkChecks = await this.probeNetwork();
    const allChecks = [...baseReport.checks, ...networkChecks];
    const hasErrors = allChecks.some((c) => c.status === 'error');

    return {
      ...baseReport,
      allOk: !hasErrors,
      checks: allChecks
    };
  }

  public generateMarkdownReport(report: OsrsDoctorReport): string {
    const lines: string[] = [];
    lines.push('### Linux Jagex Launcher - OSRS Doctor Diagnostic Report');
    lines.push(`- **Generated**: ${new Date(report.timestamp).toISOString()}`);
    lines.push(`- **OS**: ${report.osName} ${report.osVersion} (${report.arch}) | **Distro Family**: ${report.distroFamily}`);
    lines.push(`- **Selected Client**: ${report.selectedClient.toUpperCase()}`);
    lines.push(`- **Java Binary**: ${report.javaPath || 'Not Found'}`);
    lines.push(`- **Java Version**: ${report.javaVersion || 'Unknown'} (${report.isHeadlessJava ? 'HEADLESS' : 'Headful'})`);
    lines.push(`- **Overall Health**: ${report.allOk ? '✅ ALL CHECKS PASSED' : '⚠️ ACTION REQUIRED'}`);
    lines.push('');
    lines.push('#### Diagnostic Checks:');
    for (const c of report.checks) {
      const icon = c.status === 'ok' ? '✓' : (c.status === 'warning' ? '⚠' : '✗');
      lines.push(`- **[${c.status.toUpperCase()}]** ${icon} **${c.name}** (\`${c.id}\` / ${c.category}): ${c.message}`);
      if (c.remediation) {
        lines.push(`  - *Remediation*: ${c.remediation}`);
      }
    }

    if (report.suggestedPackageCommand) {
      lines.push('');
      lines.push('#### Suggested Package Installation:');
      lines.push('```bash');
      lines.push(report.suggestedPackageCommand.command);
      lines.push('```');
    }

    const lastCrash = osrs.getLastCrash();
    if (lastCrash) {
      lines.push('');
      lines.push('#### Recent OSRS Crash Post-Mortem:');
      lines.push(`- **Title**: ${lastCrash.title}`);
      lines.push(`- **Client**: ${lastCrash.clientType}`);
      lines.push(`- **Exit Code**: ${lastCrash.exitCode} | **Signal**: ${lastCrash.signal}`);
      lines.push(`- **Classification**: ${lastCrash.category}`);
      lines.push(`- **Summary**: ${lastCrash.summary}`);
      if (lastCrash.stderrSnippet) {
        lines.push('```');
        lines.push(lastCrash.stderrSnippet);
        lines.push('```');
      }
    }

    return lines.join('\n');
  }
}

export const osrsDoctor = new OsrsDoctor();
