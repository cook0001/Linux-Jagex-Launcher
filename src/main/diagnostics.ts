import fs from 'fs';
import path from 'path';
import os from 'os';
import { installer } from './installer.ts';
import { store } from './store.ts';
import { launcher } from './launcher.ts';

export type DiagnosticCategory =
  | 'system'
  | 'dependency'
  | 'graphics'
  | 'audio'
  | 'storage'
  | 'network'
  | 'tools'
  | 'account'
  | 'crash';

export type DiagnosticActionId =
  | 'install_ssl'
  | 'clear_cache'
  | 'enable_lowspec'
  | 'enable_audio_fix'
  | 'enable_zink'
  | 'enable_prime'
  | 'enable_x11'
  | 'kill_zombies';

export interface DiagnosticCheck {
  id: string;
  name: string;
  category: DiagnosticCategory;
  status: 'ok' | 'warning' | 'error';
  message: string;
  remediation?: string;
  actionId?: DiagnosticActionId;
  actionLabel?: string;
}

export type DistroFamily = 'debian' | 'arch' | 'fedora' | 'opensuse' | 'generic';

export interface DistroPackageInfo {
  name: string;
  commandPrefix: string;
  packages: Record<string, string[]>;
}

export const DISTRO_PACKAGES: Record<DistroFamily, DistroPackageInfo> = {
  debian: {
    name: 'Debian / Ubuntu / Mint',
    commandPrefix: 'sudo apt update && sudo apt install -y',
    packages: {
      opengl: ['libopengl0'],
      vulkan: ['mesa-vulkan-drivers', 'libvulkan1'],
      gtk2: ['libgtk2.0-0'],
      sdl2: ['libsdl2-2.0-0'],
      audio: ['libpulse0', 'libasound2'],
    }
  },
  arch: {
    name: 'Arch Linux / Manjaro / SteamOS',
    commandPrefix: 'sudo pacman -S --needed',
    packages: {
      opengl: ['libglvnd'],
      vulkan: ['vulkan-icd-loader'],
      gtk2: ['gtk2'],
      sdl2: ['sdl2'],
      audio: ['libpulse', 'alsa-lib'],
    }
  },
  fedora: {
    name: 'Fedora / RHEL / Bazzite',
    commandPrefix: 'sudo dnf install -y',
    packages: {
      opengl: ['libglvnd-glx'],
      vulkan: ['vulkan-loader', 'mesa-vulkan-drivers'],
      gtk2: ['gtk2'],
      sdl2: ['SDL2'],
      audio: ['pulseaudio-libs', 'alsa-lib'],
    }
  },
  opensuse: {
    name: 'openSUSE',
    commandPrefix: 'sudo zypper install -y',
    packages: {
      opengl: ['libglvnd'],
      vulkan: ['libvulkan1'],
      gtk2: ['gtk2'],
      sdl2: ['libSDL2-2_0-0'],
      audio: ['libpulse0', 'alsa'],
    }
  },
  generic: {
    name: 'Linux',
    commandPrefix: 'sudo apt install -y',
    packages: {
      opengl: ['libopengl0'],
      vulkan: ['libvulkan1'],
      gtk2: ['libgtk2.0-0'],
      sdl2: ['libsdl2-2.0-0'],
      audio: ['libpulse0'],
    }
  }
};

export function detectDistroFamily(): DistroFamily {
  try {
    if (fs.existsSync('/etc/os-release')) {
      const content = fs.readFileSync('/etc/os-release', 'utf8').toLowerCase();
      if (content.includes('id=arch') || content.includes('id_like=arch') || content.includes('manjaro') || content.includes('steamos') || content.includes('endeavouros')) {
        return 'arch';
      }
      if (content.includes('id=fedora') || content.includes('id_like=fedora') || content.includes('rhel') || content.includes('centos') || content.includes('nobara') || content.includes('bazzite')) {
        return 'fedora';
      }
      if (content.includes('id=opensuse') || content.includes('id_like=suse') || content.includes('suse')) {
        return 'opensuse';
      }
      if (content.includes('id=ubuntu') || content.includes('id=debian') || content.includes('id_like=debian') || content.includes('linuxmint') || content.includes('pop')) {
        return 'debian';
      }
    }
  } catch {}
  return 'debian';
}

export interface DoctorReport {
  timestamp: number;
  osName: string;
  osVersion: string;
  distroFamily: DistroFamily;
  arch: string;
  isRoot: boolean;
  displayServer: string;
  clientInstalled: boolean;
  hasCompatLibssl: boolean;
  allOk: boolean;
  checks: DiagnosticCheck[];
  suggestedPackageCommand?: {
    packageManager: string;
    command: string;
  };
  suggestedAptCommand?: string; // Maintained for backward compatibility
}

const COMMON_LIB_DIRS = [
  '/usr/lib/x86_64-linux-gnu',
  '/usr/lib64',
  '/usr/lib',
  '/lib/x86_64-linux-gnu',
  '/lib64',
  '/app/lib' // Flatpak runtime
];

function findLibraryInPaths(libName: string, extraDirs: string[] = []): string | null {
  const dirs = [...extraDirs, ...COMMON_LIB_DIRS];
  for (const dir of dirs) {
    const full = path.join(dir, libName);
    try {
      if (fs.existsSync(full)) {
        return full;
      }
    } catch {
      // Ignore filesystem permission errors
    }
  }
  return null;
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

export class Rs3Doctor {
  public getOsInfo(): { name: string; version: string } {
    try {
      if (fs.existsSync('/etc/os-release')) {
        const content = fs.readFileSync('/etc/os-release', 'utf8');
        const lines = content.split('\n');
        let name = 'Linux';
        let version = '';
        for (const line of lines) {
          if (line.startsWith('PRETTY_NAME=')) {
            return { name: line.replace('PRETTY_NAME=', '').replace(/"/g, '').trim(), version: '' };
          }
          if (line.startsWith('NAME=')) {
            name = line.replace('NAME=', '').replace(/"/g, '').trim();
          }
          if (line.startsWith('VERSION=')) {
            version = line.replace('VERSION=', '').replace(/"/g, '').trim();
          }
        }
        return { name, version };
      }
    } catch {
      // Fallback
    }
    return { name: os.type(), version: os.release() };
  }

  public killZombies(): number {
    let killed = 0;
    if (process.platform === 'linux') {
      try {
        const pids = fs.readdirSync('/proc').filter(p => /^\d+$/.test(p));
        for (const pid of pids) {
          try {
            const numPid = parseInt(pid, 10);
            if (numPid === process.pid) continue;

            let isGame = false;
            try {
              const comm = fs.readFileSync(`/proc/${pid}/comm`, 'utf8').trim();
              if (comm === 'runescape' || comm === 'rs2client') {
                isGame = true;
              }
            } catch {}

            if (!isGame) {
              const cmdline = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8');
              if (cmdline.includes('runescape-launcher') || cmdline.includes('rs2client') || cmdline.endsWith('runescape\0') || cmdline.includes('/games/runescape-launcher/runescape')) {
                isGame = true;
              }
            }

            if (isGame) {
              process.kill(numPid, 'SIGKILL');
              killed++;
            }
          } catch {}
        }
      } catch {}
    }
    return killed;
  }

  public async probeNetwork(): Promise<DiagnosticCheck[]> {
    const checks: DiagnosticCheck[] = [];
    const endpoints = [
      { id: 'net_config', name: 'Jagex Config Server (jav_config.ws)', url: 'https://rs.config.runescape.com/k=5/l=0/jav_config.ws' },
      { id: 'net_cdn', name: 'RuneScape Client CDN', url: 'https://content.runescape.com/downloads/ubuntu/Packages' },
      { id: 'net_auth', name: 'Jagex Identity & Auth (account.jagex.com)', url: 'https://account.jagex.com' }
    ];

    const results = await Promise.allSettled(
      endpoints.map(async (ep) => {
        const start = Date.now();
        const res = await fetch(ep.url, { method: 'HEAD', signal: AbortSignal.timeout(2500) });
        const latency = Date.now() - start;

        // Check system clock drift against HTTP Date header
        if (ep.id === 'net_config' || ep.id === 'net_auth') {
          const dateHeader = res.headers.get('date');
          if (dateHeader) {
            const serverTime = Date.parse(dateHeader);
            if (!isNaN(serverTime)) {
              const skewSeconds = Math.abs(Math.round((Date.now() - serverTime) / 1000));
              if (skewSeconds > 90) {
                checks.push({
                  id: 'clock_sync',
                  name: 'System Clock / NTP Synchronization',
                  category: 'network',
                  status: 'warning',
                  message: `System clock is desynchronized by ~${skewSeconds}s compared to Jagex servers. Dual-boot clock skew causes OAuth token verification failures.`,
                  remediation: 'Synchronize system time: sudo timedatectl set-ntp true'
                });
              }
            }
          }
        }

        if (res.ok || res.status < 500) {
          return {
            id: ep.id,
            name: ep.name,
            category: 'network' as DiagnosticCategory,
            status: 'ok' as const,
            message: `Reachable (${latency}ms, HTTP ${res.status}).`
          };
        } else {
          return {
            id: ep.id,
            name: ep.name,
            category: 'network' as DiagnosticCategory,
            status: 'warning' as const,
            message: `Server returned HTTP ${res.status} (${latency}ms).`,
            remediation: 'Check network or Jagex service status for maintenance.'
          };
        }
      })
    );

    for (const r of results) {
      if (r.status === 'fulfilled') {
        checks.push(r.value);
      } else {
        checks.push({
          id: 'net_probe_error',
          name: 'Jagex Network Reachability',
          category: 'network',
          status: 'warning',
          message: `Network probe failed: ${r.reason?.message || 'Connection timed out'}. Possible DNS block or offline state.`,
          remediation: 'Check internet connection, DNS configuration, or firewall rules.'
        });
      }
    }

    return checks;
  }

  public runDoctor(): DoctorReport {
    const osInfo = this.getOsInfo();
    const distroFamily = detectDistroFamily();
    const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;
    const displayServer = process.env.XDG_SESSION_TYPE || (process.env.WAYLAND_DISPLAY ? 'wayland' : (process.env.DISPLAY ? 'x11' : 'unknown'));
    const compatDir = installer.getCompatLibDir();
    const clientPath = installer.getClientExecutablePath();
    const clientInstalled = fs.existsSync(clientPath);
    const settings = store.getSettings();

    const checks: DiagnosticCheck[] = [];
    const missingCategories: string[] = [];

    // 1. Root / Sudo privilege check (Addresses Issue 2: Permission corruption)
    if (isRoot) {
      checks.push({
        id: 'user_root',
        name: 'Process User Permissions',
        category: 'system',
        status: 'error',
        message: 'Running launcher with sudo/root privileges causes permission corruption in ~/.local/share, ~/.config, and game cache directories.',
        remediation: 'Do not use "sudo" or root to launch the app. Run the launcher as your normal desktop user.'
      });
    } else {
      checks.push({
        id: 'user_root',
        name: 'Process User Permissions',
        category: 'system',
        status: 'ok',
        message: `Running cleanly as standard user (UID ${typeof process.getuid === 'function' ? process.getuid() : 1000}).`
      });
    }

    // System Memory / RAM Capacity check (Identifies older hardware memory limits)
    const totalMemBytes = os.totalmem();
    const totalMemGb = (totalMemBytes / (1024 * 1024 * 1024)).toFixed(1);
    if (totalMemBytes < 4.5 * 1024 * 1024 * 1024) {
      checks.push({
        id: 'sys_memory',
        name: 'System RAM Capacity',
        category: 'system',
        status: 'warning',
        message: `System has ${totalMemGb} GB of RAM. Low system memory can trigger Linux Out-Of-Memory (OOM) killer or heavy swap thrashing while playing.`,
        remediation: 'Enable "Performance Mode (Low-Spec / Older Hardware)" and "Close Launcher when Game Starts" in Settings to minimize memory footprint.',
        actionId: 'enable_lowspec',
        actionLabel: 'Enable Performance Mode'
      });
    } else {
      checks.push({
        id: 'sys_memory',
        name: 'System RAM Capacity',
        category: 'system',
        status: 'ok',
        message: `System has ${totalMemGb} GB of RAM (sufficient for game clients and desktop environment).`
      });
    }

    // CPU Architecture & Multi-Core check
    const cpus = os.cpus() || [];
    const cpuCount = cpus.length;
    const cpuModel = cpus[0]?.model || 'Generic Processor';
    if (cpuCount <= 2) {
      checks.push({
        id: 'cpu_hardware',
        name: 'CPU Core Availability',
        category: 'system',
        status: 'warning',
        message: `Detected ${cpuCount}-core CPU (${cpuModel}). Dual-core systems benefit significantly from Mesa Threaded OpenGL and Feral GameMode.`,
        remediation: 'Ensure "Mesa Threaded OpenGL" and "Feral GameMode" are enabled in Settings.'
      });
    } else {
      checks.push({
        id: 'cpu_hardware',
        name: 'CPU Core Availability',
        category: 'system',
        status: 'ok',
        message: `Detected ${cpuCount} CPU threads (${cpuModel}).`
      });
    }

    // Kernel vm.max_map_count check
    try {
      if (fs.existsSync('/proc/sys/vm/max_map_count')) {
        const valStr = fs.readFileSync('/proc/sys/vm/max_map_count', 'utf8').trim();
        const mapCount = parseInt(valStr, 10);
        if (mapCount < 262144) {
          checks.push({
            id: 'kernel_max_map_count',
            name: 'Kernel Virtual Memory Maps (vm.max_map_count)',
            category: 'system',
            status: 'warning',
            message: `Kernel vm.max_map_count is ${mapCount} (default is 65530). High-resolution RuneScape 3 caches can exhaust map slots and crash with SIGSEGV.`,
            remediation: 'Raise vm.max_map_count via: sudo sysctl -w vm.max_map_count=1048576'
          });
        } else {
          checks.push({
            id: 'kernel_max_map_count',
            name: 'Kernel Virtual Memory Maps (vm.max_map_count)',
            category: 'system',
            status: 'ok',
            message: `Kernel vm.max_map_count is ${mapCount} (optimal for large game memory maps).`
          });
        }
      }
    } catch {}

    // Process file descriptor limit (nofile)
    try {
      if (fs.existsSync('/proc/self/limits')) {
        const limitsText = fs.readFileSync('/proc/self/limits', 'utf8');
        const match = limitsText.match(/Max open files\s+(\d+)/);
        if (match) {
          const softLimit = parseInt(match[1], 10);
          if (softLimit < 2048) {
            checks.push({
              id: 'system_nofile',
              name: 'Process File Descriptor Limit (nofile)',
              category: 'system',
              status: 'warning',
              message: `Current open file limit is ${softLimit}. RuneScape 3 concurrent texture and cache reads can exceed 1024 handles, causing EMFILE crashes.`,
              remediation: 'Consider increasing nofile limit in /etc/security/limits.conf or systemd user config to 4096.'
            });
          } else {
            checks.push({
              id: 'system_nofile',
              name: 'Process File Descriptor Limit (nofile)',
              category: 'system',
              status: 'ok',
              message: `Soft file limit is ${softLimit} (sufficient for multi-handle asset streaming).`
            });
          }
        }
      }
    } catch {}

    // Orphan / Zombie Process check
    if (!launcher.isGameRunning() && process.platform === 'linux') {
      try {
        if (fs.existsSync('/proc')) {
          const pids = fs.readdirSync('/proc').filter(p => /^\d+$/.test(p));
          let zombiePid: number | null = null;
          for (const pid of pids) {
            try {
              const numPid = parseInt(pid, 10);
              if (numPid === process.pid) continue;

              let isGame = false;
              try {
                const comm = fs.readFileSync(`/proc/${pid}/comm`, 'utf8').trim();
                if (comm === 'runescape' || comm === 'rs2client') {
                  isGame = true;
                }
              } catch {}

              if (!isGame) {
                const cmdline = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8');
                if (cmdline.includes('runescape-launcher') || cmdline.includes('rs2client') || cmdline.endsWith('runescape\0') || cmdline.includes('/games/runescape-launcher/runescape')) {
                  isGame = true;
                }
              }

              if (isGame) {
                zombiePid = numPid;
                break;
              }
            } catch {}
          }
          if (zombiePid) {
            checks.push({
              id: 'zombie_process',
              name: 'Orphaned Game Process',
              category: 'system',
              status: 'warning',
              message: `Detected running RuneScape process (PID: ${zombiePid}) while game is not active in launcher. It may hold asset cache file locks.`,
              remediation: 'Click "Terminate Orphan" to clear process locks.',
              actionId: 'kill_zombies',
              actionLabel: 'Terminate Orphan'
            });
          }
        }
      } catch {}
    }

    // 2. OpenSSL 1.1 dependency check (Addresses Issue 1: libssl1.1 mismatch on Ubuntu 22.04 & 24.04)
    const compatSsl = path.join(compatDir, 'libssl.so.1.1');
    const compatCrypto = path.join(compatDir, 'libcrypto.so.1.1');
    const hasCompatLibssl = fs.existsSync(compatSsl) && fs.existsSync(compatCrypto);
    const systemSsl = findLibraryInPaths('libssl.so.1.1');
    const systemCrypto = findLibraryInPaths('libcrypto.so.1.1');

    if (hasCompatLibssl) {
      checks.push({
        id: 'libssl11',
        name: 'OpenSSL 1.1 Compatibility (libssl.so.1.1 / libcrypto.so.1.1)',
        category: 'dependency',
        status: 'ok',
        message: `Isolated compat libraries installed in ${compatDir}. Zero host package manager conflicts with OpenSSL 3.`
      });
    } else if (systemSsl && systemCrypto) {
      checks.push({
        id: 'libssl11',
        name: 'OpenSSL 1.1 Compatibility (libssl.so.1.1 / libcrypto.so.1.1)',
        category: 'dependency',
        status: 'ok',
        message: `Found system OpenSSL 1.1 runtime at ${systemSsl}.`
      });
    } else {
      checks.push({
        id: 'libssl11',
        name: 'OpenSSL 1.1 Compatibility (libssl.so.1.1 / libcrypto.so.1.1)',
        category: 'dependency',
        status: 'warning',
        message: 'Modern Ubuntu (22.04 / 24.04+) removed libssl1.1 in favor of OpenSSL 3. The launcher will automatically download isolated compat libraries to avoid breaking system apt.',
        remediation: 'Click "Install libssl1.1 Compat" to safely download isolated libraries without touching system packages.',
        actionId: 'install_ssl',
        actionLabel: 'Install libssl1.1 Compat'
      });
    }

    // 3. OpenGL / libglvnd check (Specifically requires libOpenGL.so.0 for rs2client)
    const openglLib = findLibraryInPaths('libOpenGL.so.0');
    if (openglLib) {
      checks.push({
        id: 'opengl',
        name: 'OpenGL Dispatch Library (libOpenGL.so.0)',
        category: 'graphics',
        status: 'ok',
        message: `Found OpenGL dispatch library at ${openglLib}.`
      });
    } else {
      missingCategories.push('opengl');
      checks.push({
        id: 'opengl',
        name: 'OpenGL Dispatch Library (libOpenGL.so.0)',
        category: 'graphics',
        status: 'error',
        message: 'Missing libOpenGL.so.0. The official rs2client ELF binary strictly requires libOpenGL.so.0 to initialize graphics.',
        remediation: distroFamily === 'debian'
          ? 'Install libopengl0: sudo apt install -y libopengl0'
          : (distroFamily === 'arch' ? 'Install libglvnd: sudo pacman -S --needed libglvnd' : 'Install libglvnd / libopengl via your package manager.')
      });
    }

    // 4. Vulkan runtime check (Addresses Issue 3: Graphics initialization & "Loading application resources" hang)
    const vulkanLib = findLibraryInPaths('libvulkan.so.1');
    if (vulkanLib) {
      checks.push({
        id: 'vulkan',
        name: 'Vulkan Graphics Driver (libvulkan.so.1)',
        category: 'graphics',
        status: 'ok',
        message: `Found Vulkan runtime library at ${vulkanLib}.`
      });
    } else {
      missingCategories.push('vulkan');
      checks.push({
        id: 'vulkan',
        name: 'Vulkan Graphics Driver (libvulkan.so.1)',
        category: 'graphics',
        status: 'warning',
        message: 'Vulkan drivers not detected. The RS3 NXT client may hang on "Loading application resources" or experience low FPS without Vulkan.',
        remediation: 'Install Mesa Vulkan drivers via your package manager.'
      });
    }

    // 5. GTK 2.0 runtime check
    const gtk2Lib = findLibraryInPaths('libgtk-x11-2.0.so.0');
    if (gtk2Lib) {
      checks.push({
        id: 'gtk2',
        name: 'GTK 2.0 Runtime (libgtk-x11-2.0.so.0)',
        category: 'dependency',
        status: 'ok',
        message: `Found GTK2 runtime library at ${gtk2Lib}.`
      });
    } else {
      missingCategories.push('gtk2');
      checks.push({
        id: 'gtk2',
        name: 'GTK 2.0 Runtime (libgtk-x11-2.0.so.0)',
        category: 'dependency',
        status: 'error',
        message: 'Missing libgtk-x11-2.0.so.0. The native RS3 bootstrap launcher window requires GTK2.',
        remediation: 'Install GTK 2.0 runtime via your package manager.'
      });
    }

    // 6. SDL2 runtime check
    const sdl2Lib = findLibraryInPaths('libSDL2-2.0.so.0');
    if (sdl2Lib) {
      checks.push({
        id: 'sdl2',
        name: 'SDL 2.0 Runtime (libsdl2-2.0.so.0)',
        category: 'dependency',
        status: 'ok',
        message: `Found SDL2 library at ${sdl2Lib}.`
      });
    } else {
      missingCategories.push('sdl2');
      checks.push({
        id: 'sdl2',
        name: 'SDL 2.0 Runtime (libsdl2-2.0.so.0)',
        category: 'dependency',
        status: 'error',
        message: 'Missing libsdl2-2.0-0. Required for game window and input handling.',
        remediation: 'Install SDL2 via your package manager.'
      });
    }

    // Direct Rendering Node (/dev/dri/renderD128) Access
    if (process.platform === 'linux' && fs.existsSync('/dev/dri')) {
      const renderNode = '/dev/dri/renderD128';
      if (fs.existsSync(renderNode)) {
        try {
          fs.accessSync(renderNode, fs.constants.R_OK | fs.constants.W_OK);
          checks.push({
            id: 'dri_permissions',
            name: 'Direct Rendering Hardware Node (/dev/dri/renderD128)',
            category: 'graphics',
            status: 'ok',
            message: 'Direct GPU hardware acceleration node is accessible with read/write permissions.'
          });
        } catch {
          checks.push({
            id: 'dri_permissions',
            name: 'Direct Rendering Hardware Node (/dev/dri/renderD128)',
            category: 'graphics',
            status: 'error',
            message: 'User does not have read/write permissions for /dev/dri/renderD128. GPU acceleration will fail or fallback to software rendering.',
            remediation: 'Add user to the render group: sudo usermod -aG render $USER (then re-login).'
          });
        }
      }
    }

    // NVIDIA Kernel Driver vs. Nouveau
    if (process.platform === 'linux') {
      const isNouveau = fs.existsSync('/sys/module/nouveau');
      const isNvidiaProprietary = fs.existsSync('/proc/driver/nvidia/version');
      if (isNouveau && !isNvidiaProprietary) {
        checks.push({
          id: 'nvidia_driver',
          name: 'NVIDIA GPU Kernel Driver',
          category: 'graphics',
          status: 'warning',
          message: 'Open-source Nouveau driver is active. The RS3 NXT client experiences known freezes and shader compilation failures on Nouveau.',
          remediation: 'Install the proprietary NVIDIA driver or enable "Mesa Zink Override" in Settings > RuneScape 3.',
          actionId: 'enable_zink',
          actionLabel: 'Enable Zink Override'
        });
      } else if (isNvidiaProprietary) {
        checks.push({
          id: 'nvidia_driver',
          name: 'NVIDIA GPU Kernel Driver',
          category: 'graphics',
          status: 'ok',
          message: 'Official NVIDIA proprietary graphics driver is loaded and active.'
        });
      }
    }

    // Audio Subsystem & PipeWire/PulseAudio check
    const pulseLib = findLibraryInPaths('libpulse.so.0');
    const alsaLib = findLibraryInPaths('libasound.so.2');
    const runtimeDir = process.env.XDG_RUNTIME_DIR || (typeof process.getuid === 'function' ? `/run/user/${process.getuid()}` : '');
    const hasPipewire = runtimeDir ? fs.existsSync(path.join(runtimeDir, 'pipewire-0')) : false;
    const hasPulse = runtimeDir ? (fs.existsSync(path.join(runtimeDir, 'pulse', 'native')) || Boolean(process.env.PULSE_SERVER)) : false;

    if (pulseLib || alsaLib) {
      const serverDesc = hasPipewire ? 'PipeWire' : (hasPulse ? 'PulseAudio' : 'ALSA / System Audio');
      checks.push({
        id: 'audio_runtime',
        name: 'Audio Subsystem & Drivers (PulseAudio / PipeWire)',
        category: 'audio',
        status: 'ok',
        message: `Found audio driver libraries (${[pulseLib ? 'PulseAudio' : null, alsaLib ? 'ALSA' : null].filter(Boolean).join(', ')}). Active sound server: ${serverDesc}.`
      });
    } else {
      missingCategories.push('audio');
      checks.push({
        id: 'audio_runtime',
        name: 'Audio Subsystem & Drivers (PulseAudio / PipeWire)',
        category: 'audio',
        status: 'warning',
        message: 'PulseAudio and ALSA sound libraries not detected. RS3 client may experience sound initialization lockup.',
        remediation: 'Install audio packages (libpulse / alsa) to prevent sound engine startup deadlock.'
      });
    }

    // Audio Latency Fix check
    if ((hasPipewire || hasPulse) && settings.rs3AudioLatencyFix === false) {
      checks.push({
        id: 'audio_latency_setting',
        name: 'PulseAudio / PipeWire Latency Mitigation',
        category: 'audio',
        status: 'warning',
        message: 'Audio latency fix is disabled in Settings. Modern PipeWire/PulseAudio servers underflow during asset loading, freezing the main game thread.',
        remediation: 'Enable "Audio Latency Mitigation" in Settings > RuneScape 3.',
        actionId: 'enable_audio_fix',
        actionLabel: 'Enable Audio Fix'
      });
    }

    // Storage & Cache Check (Addresses 10-15GB NXT cache requirement)
    try {
      if (typeof fs.statfsSync === 'function') {
        const stats = fs.statfsSync(installer.getGameDataDir());
        const freeBytes = stats.bavail * stats.bsize;
        const freeGb = (freeBytes / (1024 * 1024 * 1024)).toFixed(1);
        const freeGbNum = freeBytes / (1024 * 1024 * 1024);

        if (freeGbNum < 3.0) {
          checks.push({
            id: 'disk_space',
            name: 'Available Storage for Game Cache',
            category: 'storage',
            status: 'error',
            message: `Only ${freeGb} GB of free disk space available in ${installer.getGameDataDir()}. RuneScape 3 NXT cache requires 10-15 GB and may crash or fail to load models.`,
            remediation: 'Free up disk space on the home partition or clear old cache files.',
            actionId: 'clear_cache',
            actionLabel: 'Clear Cache'
          });
        } else if (freeGbNum < 15.0) {
          checks.push({
            id: 'disk_space',
            name: 'Available Storage for Game Cache',
            category: 'storage',
            status: 'warning',
            message: `${freeGb} GB free in ${installer.getGameDataDir()}. Low disk space for full ~15 GB client cache.`,
            remediation: 'Ensure at least 15 GB of free space for optimal texture streaming.'
          });
        } else {
          checks.push({
            id: 'disk_space',
            name: 'Available Storage for Game Cache',
            category: 'storage',
            status: 'ok',
            message: `${freeGb} GB free disk space available (sufficient for complete 10-15 GB NXT cache).`
          });
        }
      }
    } catch {
      // Fallback if statfsSync is unsupported
    }

    // 7. Display Server & Wayland Workaround check (Addresses Issue 3: Wayland compositing bugs)
    if (displayServer === 'wayland') {
      checks.push({
        id: 'wayland',
        name: 'Wayland Compositor Compatibility',
        category: 'graphics',
        status: 'ok',
        message: 'Wayland session detected. The launcher automatically isolates the display environment (stripping Wayland EGL platform overrides, forcing GDK_BACKEND=x11 and SDL_VIDEODRIVER=x11) to run via XWayland and prevent startup freezes.'
      });
    } else {
      checks.push({
        id: 'wayland',
        name: 'X11 Display Server',
        category: 'graphics',
        status: 'ok',
        message: 'Standard X11 display session active. Native hardware rendering is supported.'
      });
    }

    // 8. Mesa OpenGL Compatibility Layer check for legacy Intel / AMD GPUs
    checks.push({
      id: 'mesa_compat',
      name: 'Mesa OpenGL Compatibility Layer',
      category: 'graphics',
      status: 'ok',
      message: 'Mesa Compatibility Profile override (MESA_GL_VERSION_OVERRIDE=4.5COMPAT) is supported to unlock full hardware acceleration on older Intel HD Graphics (2000-4600) and legacy AMD GPUs.'
    });

    // 9. Tooling checks (GameMode, MangoHud)
    if (settings.useGameMode) {
      if (commandExists('gamemoderun')) {
        checks.push({
          id: 'tool_gamemode',
          name: 'Feral GameMode Integration',
          category: 'tools',
          status: 'ok',
          message: 'Feral GameMode (gamemoderun) is installed and ready to prioritize client CPU/GPU threads.'
        });
      } else {
        checks.push({
          id: 'tool_gamemode',
          name: 'Feral GameMode Integration',
          category: 'tools',
          status: 'warning',
          message: 'GameMode is enabled in Settings, but "gamemoderun" was not found in PATH.',
          remediation: 'Install gamemode via your package manager.'
        });
      }
    }

    if (settings.useMangoHud) {
      if (commandExists('mangohud')) {
        checks.push({
          id: 'tool_mangohud',
          name: 'MangoHud Performance Overlay',
          category: 'tools',
          status: 'ok',
          message: 'MangoHud overlay binary found in PATH.'
        });
      } else {
        checks.push({
          id: 'tool_mangohud',
          name: 'MangoHud Performance Overlay',
          category: 'tools',
          status: 'warning',
          message: 'MangoHud is enabled in Settings, but "mangohud" was not found in PATH.',
          remediation: 'Install mangohud via your package manager.'
        });
      }
    }

    // 10. Crash Detection & Post-Mortem history
    const lastCrash = launcher.getLastCrash();
    if (lastCrash && Date.now() - lastCrash.timestamp < 48 * 60 * 60 * 1000) {
      const elapsedMinutes = Math.round((Date.now() - lastCrash.timestamp) / 60000);
      const timeStr = elapsedMinutes < 60 ? `${elapsedMinutes}m ago` : `${Math.round(elapsedMinutes / 60)}h ago`;
      checks.push({
        id: 'recent_crash',
        name: 'Recent Client Crash Detection',
        category: 'crash',
        status: 'warning',
        message: `Detected crash ${timeStr}: ${lastCrash.title} (${lastCrash.summary}).`,
        remediation: lastCrash.remediation,
        actionId: (lastCrash.actionId as DiagnosticActionId) || undefined,
        actionLabel: lastCrash.actionLabel
      });
    } else {
      checks.push({
        id: 'recent_crash',
        name: 'Recent Client Stability',
        category: 'crash',
        status: 'ok',
        message: 'No client crashes detected in recent game sessions.'
      });
    }

    // 11. Jagex Account Authentication check (Addresses Issue 2: Jagex Account requirement)
    const activeAccount = store.getActiveAccount();
    const characterId = settings.selectedCharacterId || activeAccount?.characters[0]?.id;

    if (activeAccount?.sessionId && characterId) {
      const charName = activeAccount.characters.find(c => c.id === characterId)?.displayName || 'Character';
      checks.push({
        id: 'jagex_auth',
        name: 'Jagex Account Authentication & Characters',
        category: 'account',
        status: 'ok',
        message: `Active session linked: ${charName} (Jagex Account: ${activeAccount.displayName || activeAccount.email || 'Connected'}). Session tokens ready for RS3 launch.`
      });
    } else if (activeAccount?.sessionId) {
      checks.push({
        id: 'jagex_auth',
        name: 'Jagex Account Authentication & Characters',
        category: 'account',
        status: 'warning',
        message: 'Logged in to Jagex Account, but no character has been selected yet. Select a character in the launcher dock before playing.',
        remediation: 'Click on the character selector at the bottom to choose an active character.'
      });
    } else {
      checks.push({
        id: 'jagex_auth',
        name: 'Jagex Account Authentication & Characters',
        category: 'account',
        status: 'warning',
        message: 'Migrated Jagex Accounts cannot log in via legacy client credentials. Sign in via OAuth 2.0 in the launcher top bar.',
        remediation: 'Click "Log In" in the top bar to connect your Jagex Account.'
      });
    }

    // 12. Client installation check
    if (clientInstalled) {
      checks.push({
        id: 'client_installed',
        name: 'RuneScape 3 Client Binary',
        category: 'system',
        status: 'ok',
        message: `Client installed in ${clientPath}.`
      });
    } else {
      checks.push({
        id: 'client_installed',
        name: 'RuneScape 3 Client Binary',
        category: 'system',
        status: 'warning',
        message: 'Client not yet downloaded. Clicking "PLAY" will automatically download and extract the official package without root.',
        remediation: 'Click "PLAY" on the main launcher screen to install.'
      });
    }

    // Multi-Distro package command generation
    const distroInfo = DISTRO_PACKAGES[distroFamily] || DISTRO_PACKAGES.debian;
    const requiredPkgs: string[] = [];
    for (const cat of missingCategories) {
      if (distroInfo.packages[cat]) {
        requiredPkgs.push(...distroInfo.packages[cat]);
      }
    }
    const uniqueMissing = Array.from(new Set(requiredPkgs));
    const suggestedPackageCommand = uniqueMissing.length > 0
      ? {
          packageManager: distroFamily,
          command: `${distroInfo.commandPrefix} ${uniqueMissing.join(' ')}`
        }
      : undefined;

    // Debian package suggestion for backward compatibility
    const debianPkgs: string[] = [];
    for (const cat of missingCategories) {
      if (DISTRO_PACKAGES.debian.packages[cat]) {
        debianPkgs.push(...DISTRO_PACKAGES.debian.packages[cat]);
      }
    }
    const uniqueDebian = Array.from(new Set(debianPkgs));
    const suggestedAptCommand = uniqueDebian.length > 0
      ? `sudo apt update && sudo apt install -y ${uniqueDebian.join(' ')}`
      : undefined;

    const hasErrors = checks.some(c => c.status === 'error');

    return {
      timestamp: Date.now(),
      osName: osInfo.name,
      osVersion: osInfo.version,
      distroFamily,
      arch: os.arch(),
      isRoot,
      displayServer,
      clientInstalled,
      hasCompatLibssl,
      allOk: !hasErrors,
      checks,
      suggestedPackageCommand,
      suggestedAptCommand
    };
  }

  public async runDoctorWithProbes(): Promise<DoctorReport> {
    const report = this.runDoctor();
    try {
      const netChecks = await this.probeNetwork();
      report.checks.push(...netChecks);
      report.allOk = !report.checks.some(c => c.status === 'error');
    } catch {}
    return report;
  }

  public generateMarkdownReport(report: DoctorReport): string {
    const lines: string[] = [];
    lines.push('### Linux Jagex Launcher - RS3 Doctor Diagnostic Report');
    lines.push(`- **Generated**: ${new Date(report.timestamp).toISOString()}`);
    lines.push(`- **OS**: ${report.osName} ${report.osVersion} (${report.arch}) | **Distro Family**: ${report.distroFamily}`);
    lines.push(`- **Display Server**: ${report.displayServer.toUpperCase()}`);
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

    const lastCrash = launcher.getLastCrash();
    if (lastCrash) {
      lines.push('');
      lines.push('#### Recent Crash Post-Mortem:');
      lines.push(`- **Title**: ${lastCrash.title}`);
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

export const doctor = new Rs3Doctor();
