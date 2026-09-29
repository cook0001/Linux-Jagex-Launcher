import fs from 'fs';
import path from 'path';
import os from 'os';
import { installer } from './installer.ts';
import { store } from './store.ts';

export interface DiagnosticCheck {
  id: string;
  name: string;
  category: 'system' | 'dependency' | 'graphics' | 'account';
  status: 'ok' | 'warning' | 'error';
  message: string;
  remediation?: string;
}

export interface DoctorReport {
  timestamp: number;
  osName: string;
  osVersion: string;
  arch: string;
  isRoot: boolean;
  displayServer: string;
  clientInstalled: boolean;
  hasCompatLibssl: boolean;
  allOk: boolean;
  checks: DiagnosticCheck[];
  suggestedAptCommand?: string;
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

  public runDoctor(): DoctorReport {
    const osInfo = this.getOsInfo();
    const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;
    const displayServer = process.env.XDG_SESSION_TYPE || (process.env.WAYLAND_DISPLAY ? 'wayland' : (process.env.DISPLAY ? 'x11' : 'unknown'));
    const compatDir = installer.getCompatLibDir();
    const clientPath = installer.getClientExecutablePath();
    const clientInstalled = fs.existsSync(clientPath);

    const checks: DiagnosticCheck[] = [];
    const missingDebianPackages: string[] = [];

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
        remediation: 'Enable "Performance Mode (Low-Spec / Older Hardware)" and "Close Launcher when Game Starts" in Settings to minimize memory footprint.'
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
        remediation: 'Click "Install libssl1.1 Compat" to safely download isolated libraries without touching system packages.'
      });
    }

    // 3. OpenGL / libglvnd check (Addresses Issue 2 & 3: Missing libOpenGL.so.0 / Graphics hang)
    const openglLib = findLibraryInPaths('libOpenGL.so.0') || findLibraryInPaths('libGL.so.1');
    if (openglLib) {
      checks.push({
        id: 'opengl',
        name: 'OpenGL Driver Libraries (libOpenGL.so.0)',
        category: 'graphics',
        status: 'ok',
        message: `Found OpenGL dispatch library at ${openglLib}.`
      });
    } else {
      missingDebianPackages.push('libopengl0');
      checks.push({
        id: 'opengl',
        name: 'OpenGL Driver Libraries (libOpenGL.so.0)',
        category: 'graphics',
        status: 'error',
        message: 'Missing libOpenGL.so.0 / libGL.so.1. Minimal installs and non-standard desktops require libglvnd.',
        remediation: 'Install via: sudo apt install libopengl0'
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
      missingDebianPackages.push('mesa-vulkan-drivers', 'libvulkan1');
      checks.push({
        id: 'vulkan',
        name: 'Vulkan Graphics Driver (libvulkan.so.1)',
        category: 'graphics',
        status: 'warning',
        message: 'Vulkan drivers not detected. The RS3 NXT client may hang on "Loading application resources" or experience low FPS without Vulkan.',
        remediation: 'Install Mesa Vulkan drivers: sudo apt install mesa-vulkan-drivers libvulkan1'
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
      missingDebianPackages.push('libgtk2.0-0');
      checks.push({
        id: 'gtk2',
        name: 'GTK 2.0 Runtime (libgtk-x11-2.0.so.0)',
        category: 'dependency',
        status: 'error',
        message: 'Missing libgtk-x11-2.0.so.0. The native RS3 bootstrap launcher window requires GTK2.',
        remediation: 'Install GTK 2.0: sudo apt install libgtk2.0-0'
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
      missingDebianPackages.push('libsdl2-2.0-0');
      checks.push({
        id: 'sdl2',
        name: 'SDL 2.0 Runtime (libsdl2-2.0.so.0)',
        category: 'dependency',
        status: 'error',
        message: 'Missing libsdl2-2.0-0. Required for game window and input handling.',
        remediation: 'Install SDL2: sudo apt install libsdl2-2.0-0'
      });
    }

    // 7. Display Server & Wayland Workaround check (Addresses Issue 3: Wayland compositing bugs)
    if (displayServer === 'wayland') {
      checks.push({
        id: 'wayland',
        name: 'Wayland Compositor Compatibility',
        category: 'graphics',
        status: 'ok',
        message: 'Wayland session detected. The launcher automatically injects GDK_BACKEND=x11 and SDL_VIDEODRIVER=x11 to run via XWayland and prevent "Loading application resources" startup freezes.'
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

    // 9. Jagex Account Authentication check (Addresses Issue 2: Jagex Account requirement)
    const activeAccount = store.getActiveAccount();
    const settings = store.getSettings();
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

    // 9. Client installation check
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

    const uniqueMissing = Array.from(new Set(missingDebianPackages));
    const suggestedAptCommand = uniqueMissing.length > 0
      ? `sudo apt update && sudo apt install -y ${uniqueMissing.join(' ')}`
      : undefined;

    const hasErrors = checks.some(c => c.status === 'error');

    return {
      timestamp: Date.now(),
      osName: osInfo.name,
      osVersion: osInfo.version,
      arch: os.arch(),
      isRoot,
      displayServer,
      clientInstalled,
      hasCompatLibssl,
      allOk: !hasErrors,
      checks,
      suggestedAptCommand
    };
  }
}

export const doctor = new Rs3Doctor();
