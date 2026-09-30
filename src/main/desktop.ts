import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawnSync } from 'child_process';
import * as electron from 'electron';
const app = (electron as any)?.app || ((electron as any)?.default?.app) || undefined;

export class DesktopIntegrationManager {
  private appsDir: string;
  private iconsBaseDir: string;

  constructor() {
    this.appsDir = path.join(os.homedir(), '.local', 'share', 'applications');
    this.iconsBaseDir = path.join(os.homedir(), '.local', 'share', 'icons', 'hicolor');
  }

  public ensureDirectories(): void {
    if (process.platform !== 'linux') return;
    try {
      if (!fs.existsSync(this.appsDir)) {
        fs.mkdirSync(this.appsDir, { recursive: true });
      }
      const sizes = ['16x16', '24x24', '32x32', '48x48', '64x64', '128x128', '256x256', '512x512', '1024x1024'];
      for (const size of sizes) {
        const dir = path.join(this.iconsBaseDir, size, 'apps');
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      }
    } catch (e) {
      console.warn('[DesktopIntegration] Failed to ensure base directories:', e);
    }
  }

  public installLauncherIntegration(): void {
    if (process.platform !== 'linux') return;
    try {
      this.ensureDirectories();

      // Find icons from resources or build
      const rootDir = process.cwd();
      const iconSizes = ['16x16', '32x32', '48x48', '64x64', '128x128', '256x256', '512x512', '1024x1024'];
      for (const size of iconSizes) {
        const candidates = [
          path.join(rootDir, 'resources', 'icons', `${size}.png`),
          path.join(rootDir, 'build', 'icons', `${size}.png`),
          path.join(process.resourcesPath || '', 'resources', 'icons', `${size}.png`)
        ];
        for (const src of candidates) {
          if (fs.existsSync(src)) {
            const dest1 = path.join(this.iconsBaseDir, size, 'apps', 'linux-jagex-launcher.png');
            const dest2 = path.join(this.iconsBaseDir, size, 'apps', 'io.github.cook0001.LinuxJagexLauncher.png');
            try {
              fs.copyFileSync(src, dest1);
              fs.copyFileSync(src, dest2);
            } catch {}
            break;
          }
        }
      }

      // Master 512x512 icon fallback
      const masterCandidates = [
        path.join(rootDir, 'resources', 'icon.png'),
        path.join(rootDir, 'build', 'icon.png'),
        path.join(rootDir, 'src', 'renderer', 'assets', 'icon.png'),
        path.join(process.resourcesPath || '', 'resources', 'icon.png')
      ];
      for (const src of masterCandidates) {
        if (fs.existsSync(src)) {
          const dest = path.join(this.iconsBaseDir, '512x512', 'apps', 'linux-jagex-launcher.png');
          try {
            if (!fs.existsSync(dest)) fs.copyFileSync(src, dest);
          } catch {}
          break;
        }
      }

      // Determine correct Exec command
      const isAppImage = Boolean(process.env.APPIMAGE);
      let execCmd = `"${process.execPath}" %U`;
      if (isAppImage) {
        execCmd = `"${process.env.APPIMAGE}" %U`;
      } else if (!app?.isPackaged) {
        const mainScript = path.resolve(rootDir, 'dist/main/index.js');
        execCmd = `"${process.execPath}" --no-sandbox "${mainScript}" %U`;
      }

      const desktopContent = `[Desktop Entry]
Name=Jagex Launcher
Comment=Authentic Linux Jagex Launcher for RuneScape 3, Old School RuneScape, and Dragonwilds
Exec=${execCmd}
Icon=linux-jagex-launcher
Terminal=false
Type=Application
Categories=Game;
StartupWMClass=linux-jagex-launcher
MimeType=x-scheme-handler/jagex;x-scheme-handler/jagex-launcher;
PrefersNonDefaultGPU=true
`;

      const primaryDesktop = path.join(this.appsDir, 'linux-jagex-launcher.desktop');
      const flatpakCompatDesktop = path.join(this.appsDir, 'io.github.cook0001.LinuxJagexLauncher.desktop');

      fs.writeFileSync(primaryDesktop, desktopContent, 'utf8');
      fs.chmodSync(primaryDesktop, 0o755);

      fs.writeFileSync(flatpakCompatDesktop, desktopContent, 'utf8');
      fs.chmodSync(flatpakCompatDesktop, 0o755);
    } catch (e) {
      console.warn('[DesktopIntegration] Failed to install launcher desktop entry:', e);
    }
  }

  public installRuneliteIntegration(): void {
    if (process.platform !== 'linux') return;
    try {
      this.ensureDirectories();

      const homeDir = os.homedir();
      const dotRuneliteIcon = path.join(homeDir, '.runelite', 'icon.png');
      const runeliteJar = path.join(homeDir, '.local', 'share', 'linux-jagex-launcher', 'runelite', 'RuneLite.jar');

      let iconBuffer: Buffer | null = null;
      if (fs.existsSync(dotRuneliteIcon)) {
        try {
          iconBuffer = fs.readFileSync(dotRuneliteIcon);
        } catch {}
      }

      if (!iconBuffer && fs.existsSync(runeliteJar)) {
        try {
          const res = spawnSync('unzip', ['-p', runeliteJar, 'net/runelite/launcher/runelite_128.png']);
          if (res.status === 0 && res.stdout && res.stdout.length > 500) {
            iconBuffer = res.stdout;
          }
        } catch {}
      }

      if (iconBuffer) {
        const targetSizes = ['48x48', '64x64', '128x128', '256x256'];
        for (const size of targetSizes) {
          const iconNames = ['runelite.png', 'net.runelite.RuneLite.png', 'net-runelite-client-RuneLite.png'];
          for (const name of iconNames) {
            const dest = path.join(this.iconsBaseDir, size, 'apps', name);
            try {
              fs.writeFileSync(dest, iconBuffer);
            } catch {}
          }
        }
      }

      const javaCmd = 'java';
      const execLine = fs.existsSync(runeliteJar)
        ? `${javaCmd} -jar "${runeliteJar}"`
        : 'runelite';

      // 1. net.runelite.RuneLite.desktop (matches Flatpak and XWayland WM_CLASS hyphenated)
      const desktop1 = path.join(this.appsDir, 'net.runelite.RuneLite.desktop');
      const content1 = `[Desktop Entry]
Name=RuneLite
Comment=Open source Old School RuneScape client
Exec=${execLine}
Icon=runelite
Terminal=false
Type=Application
Categories=Game;
StartupWMClass=net-runelite-client-RuneLite
`;
      fs.writeFileSync(desktop1, content1, 'utf8');
      fs.chmodSync(desktop1, 0o755);

      // 2. runelite.desktop (matches standard launcher package and dotted class)
      const desktop2 = path.join(this.appsDir, 'runelite.desktop');
      const content2 = `[Desktop Entry]
Name=RuneLite
Comment=Open source Old School RuneScape client
Exec=${execLine}
Icon=runelite
Terminal=false
Type=Application
Categories=Game;
StartupWMClass=net.runelite.client.RuneLite
`;
      fs.writeFileSync(desktop2, content2, 'utf8');
      fs.chmodSync(desktop2, 0o755);

      // 3. net-runelite-client-RuneLite.desktop (direct WM_CLASS matching)
      const desktop3 = path.join(this.appsDir, 'net-runelite-client-RuneLite.desktop');
      fs.writeFileSync(desktop3, content1, 'utf8');
      fs.chmodSync(desktop3, 0o755);
    } catch (e) {
      console.warn('[DesktopIntegration] Failed to install RuneLite desktop entry:', e);
    }
  }

  public installRs3Integration(): void {
    if (process.platform !== 'linux') return;
    try {
      this.ensureDirectories();

      const homeDir = os.homedir();
      const rs3Base = path.join(homeDir, '.local', 'share', 'linux-jagex-launcher', 'client');
      const rs3IconsDir = path.join(rs3Base, 'usr', 'share', 'icons', 'hicolor');
      const rs3MasterIcon = path.join(rs3Base, 'usr', 'share', 'games', 'runescape-launcher', 'runescape.png');
      const rs3LauncherBin = path.join(rs3Base, 'usr', 'bin', 'runescape-launcher');

      // Copy all installed sizes from extracted deb package if available
      if (fs.existsSync(rs3IconsDir)) {
        try {
          const sizes = fs.readdirSync(rs3IconsDir);
          for (const size of sizes) {
            const src = path.join(rs3IconsDir, size, 'apps', 'runescape.png');
            if (fs.existsSync(src)) {
              const destDir = path.join(this.iconsBaseDir, size, 'apps');
              if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
              fs.copyFileSync(src, path.join(destDir, 'runescape.png'));
            }
          }
        } catch {}
      }

      if (fs.existsSync(rs3MasterIcon)) {
        const dest = path.join(this.iconsBaseDir, '512x512', 'apps', 'runescape.png');
        try {
          if (!fs.existsSync(dest)) fs.copyFileSync(rs3MasterIcon, dest);
        } catch {}
      }

      const execLine = fs.existsSync(rs3LauncherBin) ? `"${rs3LauncherBin}" %u` : 'runescape-launcher %u';

      // 1. runescape.desktop
      const desktop1 = path.join(this.appsDir, 'runescape.desktop');
      const content1 = `[Desktop Entry]
Name=RuneScape
Comment=RuneScape - A Free MMORPG from Jagex Ltd.
Exec=${execLine}
Icon=runescape
Terminal=false
Type=Application
Categories=Game;
StartupWMClass=runescape
MimeType=x-scheme-handler/rs-launch;x-scheme-handler/rs-launchs;
`;
      fs.writeFileSync(desktop1, content1, 'utf8');
      fs.chmodSync(desktop1, 0o755);

      // 2. runescape-launcher.desktop
      const desktop2 = path.join(this.appsDir, 'runescape-launcher.desktop');
      fs.writeFileSync(desktop2, content1, 'utf8');
      fs.chmodSync(desktop2, 0o755);

      // 3. rs2client.desktop (matches the NXT native engine window class)
      const desktop3 = path.join(this.appsDir, 'rs2client.desktop');
      const content3 = `[Desktop Entry]
Name=RuneScape
Comment=RuneScape NXT Client
Exec=${execLine}
Icon=runescape
Terminal=false
Type=Application
Categories=Game;
StartupWMClass=rs2client
`;
      fs.writeFileSync(desktop3, content3, 'utf8');
      fs.chmodSync(desktop3, 0o755);
    } catch (e) {
      console.warn('[DesktopIntegration] Failed to install RuneScape 3 desktop entry:', e);
    }
  }

  public installHdosIntegration(): void {
    if (process.platform !== 'linux') return;
    try {
      this.ensureDirectories();

      const homeDir = os.homedir();
      const hdosJar = path.join(homeDir, '.local', 'share', 'linux-jagex-launcher', 'hdos', 'hdos-launcher.jar');
      const execLine = fs.existsSync(hdosJar) ? `java -jar "${hdosJar}"` : 'hdos';

      // Deploy HDOS icon if present in resources
      const rootDir = process.cwd();
      const hdosIconSrc = path.join(rootDir, 'resources', 'icons', 'hdos.png');
      if (fs.existsSync(hdosIconSrc)) {
        const sizes = ['48x48', '64x64', '128x128', '256x256'];
        for (const size of sizes) {
          const names = ['hdos.png', 'dev.hdos.HDOS.png', 'com-hdos-client-Client.png'];
          for (const name of names) {
            const dest = path.join(this.iconsBaseDir, size, 'apps', name);
            try {
              fs.copyFileSync(hdosIconSrc, dest);
            } catch {}
          }
        }
      }

      // hdos.desktop
      const desktop1 = path.join(this.appsDir, 'hdos.desktop');
      const content1 = `[Desktop Entry]
Name=HDOS
Comment=High Definition Old School RuneScape Client
Exec=${execLine}
Icon=hdos
Terminal=false
Type=Application
Categories=Game;
StartupWMClass=hdos
`;
      fs.writeFileSync(desktop1, content1, 'utf8');
      fs.chmodSync(desktop1, 0o755);

      // com-hdos-client-Client.desktop
      const desktop2 = path.join(this.appsDir, 'com-hdos-client-Client.desktop');
      const content2 = `[Desktop Entry]
Name=HDOS
Comment=High Definition Old School RuneScape Client
Exec=${execLine}
Icon=hdos
Terminal=false
Type=Application
Categories=Game;
StartupWMClass=com-hdos-client-Client
`;
      fs.writeFileSync(desktop2, content2, 'utf8');
      fs.chmodSync(desktop2, 0o755);
    } catch (e) {
      console.warn('[DesktopIntegration] Failed to install HDOS desktop entry:', e);
    }
  }

  public installOfficialOsrsIntegration(): void {
    if (process.platform !== 'linux') return;
    try {
      this.ensureDirectories();

      // Deploy Official OSRS icon if present in resources
      const rootDir = process.cwd();
      const osrsIconSrc = path.join(rootDir, 'resources', 'icons', 'osrs.png');
      if (fs.existsSync(osrsIconSrc)) {
        const sizes = ['48x48', '64x64', '128x128', '256x256', '512x512'];
        for (const size of sizes) {
          const names = ['osrs.png', 'jagexapp-osrs.png', 'oldschool.png'];
          for (const name of names) {
            const dest = path.join(this.iconsBaseDir, size, 'apps', name);
            try {
              fs.copyFileSync(osrsIconSrc, dest);
            } catch {}
          }
        }
      }

      const execLine = 'steam steam://rungameid/1343400';

      // 1. osrs.desktop
      const desktop1 = path.join(this.appsDir, 'osrs.desktop');
      const content1 = `[Desktop Entry]
Name=Old School RuneScape
Comment=Old School RuneScape Official Client
Exec=${execLine}
Icon=osrs
Terminal=false
Type=Application
Categories=Game;
StartupWMClass=osrs
`;
      fs.writeFileSync(desktop1, content1, 'utf8');
      fs.chmodSync(desktop1, 0o755);

      // 2. jagexapp-osrs.desktop (matches official launcher steam runner WM_CLASS)
      const desktop2 = path.join(this.appsDir, 'jagexapp-osrs.desktop');
      const content2 = `[Desktop Entry]
Name=Old School RuneScape
Comment=Old School RuneScape Official Client
Exec=${execLine}
Icon=osrs
Terminal=false
Type=Application
Categories=Game;
StartupWMClass=jagexapp.osrs
`;
      fs.writeFileSync(desktop2, content2, 'utf8');
      fs.chmodSync(desktop2, 0o755);
    } catch (e) {
      console.warn('[DesktopIntegration] Failed to install Official OSRS desktop entry:', e);
    }
  }

  public updateCaches(): void {
    if (process.platform !== 'linux') return;
    try {
      spawnSync('update-desktop-database', [this.appsDir], { stdio: 'ignore' });
    } catch {}
    try {
      spawnSync('gtk-update-icon-cache', ['-f', '-t', this.iconsBaseDir], { stdio: 'ignore' });
    } catch {}
  }

  public ensureAll(): void {
    if (process.platform !== 'linux') return;
    this.installLauncherIntegration();
    this.installRuneliteIntegration();
    this.installRs3Integration();
    this.installHdosIntegration();
    this.installOfficialOsrsIntegration();
    this.updateCaches();
  }
}

export const desktopIntegration = new DesktopIntegrationManager();
