import fs from 'fs';
import path from 'path';
import os from 'os';
import { deck } from './deck.ts';

export interface AddToSteamResult {
  success: boolean;
  message: string;
  shortcutsModified: number;
  artworkCopied: number;
  error?: string;
}

/**
 * Standard CRC32 calculation for Steam Non-Steam AppID generation.
 */
function crc32(str: string): number {
  let crc = 0 ^ (-1);
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ code) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

const CRC_TABLE: number[] = (() => {
  let c: number;
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) {
      c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
    }
    table[n] = c;
  }
  return table;
})();

export function computeSteamShortcutAppId(exe: string, appName: string): number {
  const combined = exe + appName;
  const hash = crc32(combined);
  return (hash | 0x80000000) >>> 0;
}

export class SteamShortcutManager {
  /**
   * Find all Steam user directories where shortcuts.vdf may reside.
   */
  public getUserDataDirs(): string[] {
    const steamRoot = deck.findSteamPath();
    if (!steamRoot) return [];

    const userDataDir = path.join(steamRoot, 'userdata');
    if (!fs.existsSync(userDataDir)) return [];

    try {
      return fs.readdirSync(userDataDir, { withFileTypes: true })
        .filter(d => d.isDirectory() && /^\d+$/.test(d.name) && d.name !== '0')
        .map(d => path.join(userDataDir, d.name));
    } catch {
      return [];
    }
  }

  /**
   * Determine current running executable path (AppImage, binary, or script).
   */
  public getExecutablePath(): string {
    if (process.env.APPIMAGE && fs.existsSync(process.env.APPIMAGE)) {
      return process.env.APPIMAGE;
    }
    if (process.env.FLATPAK_ID) {
      return `flatpak run ${process.env.FLATPAK_ID}`;
    }
    if (process.env.SNAP) {
      const snapBin = `/snap/bin/${process.env.SNAP_NAME || 'linux-jagex-launcher'}`;
      if (fs.existsSync(snapBin)) return snapBin;
      return 'linux-jagex-launcher';
    }
    if (fs.existsSync('/usr/bin/linux-jagex-launcher')) {
      return '/usr/bin/linux-jagex-launcher';
    }
    return process.execPath;
  }

  /**
   * Adds Linux Jagex Launcher to Steam shortcuts.vdf and sets up custom grid artwork.
   */
  public addToSteam(): AddToSteamResult {
    const userDirs = this.getUserDataDirs();
    if (userDirs.length === 0) {
      return {
        success: false,
        message: 'No Steam user data directories found. Please launch Steam at least once.',
        shortcutsModified: 0,
        artworkCopied: 0
      };
    }

    const exe = this.getExecutablePath();
    const appName = 'Jagex Launcher';
    const appId = computeSteamShortcutAppId(exe, appName);
    const startDir = path.dirname(exe);
    const icon = path.join(os.homedir(), '.local', 'share', 'linux-jagex-launcher', 'icon.png');

    let shortcutsModified = 0;
    let artworkCopied = 0;

    for (const uDir of userDirs) {
      const configDir = path.join(uDir, 'config');
      if (!fs.existsSync(configDir)) {
        try { fs.mkdirSync(configDir, { recursive: true }); } catch {}
      }

      const shortcutsFile = path.join(configDir, 'shortcuts.vdf');
      const gridDir = path.join(configDir, 'grid');
      if (!fs.existsSync(gridDir)) {
        try { fs.mkdirSync(gridDir, { recursive: true }); } catch {}
      }

      try {
        const appended = this.appendShortcutIfMissing(shortcutsFile, {
          appId,
          appName,
          exe,
          startDir,
          icon
        });
        if (appended) shortcutsModified++;

        const artCount = this.copySteamArtwork(gridDir, appId);
        artworkCopied += artCount;
      } catch (err: any) {
        console.error(`[SteamShortcuts] Error configuring ${configDir}:`, err);
      }
    }

    // Ensure desktop entry exists for GNOME/KDE and Steam detection
    this.ensureDesktopEntry(exe, icon);

    return {
      success: true,
      message: `Successfully registered in Steam (${shortcutsModified} profile(s) updated, ${artworkCopied} artwork asset(s) linked).`,
      shortcutsModified,
      artworkCopied
    };
  }

  private appendShortcutIfMissing(filePath: string, item: {
    appId: number;
    appName: string;
    exe: string;
    startDir: string;
    icon: string;
  }): boolean {
    let existingBuffer: Buffer | null = null;
    if (fs.existsSync(filePath)) {
      try {
        existingBuffer = fs.readFileSync(filePath);
        // If already present by name, skip re-adding
        if (existingBuffer.includes(Buffer.from(item.appName, 'utf8'))) {
          return false;
        }
      } catch {
        existingBuffer = null;
      }
    }

    // Determine next sequential entry index to avoid key collisions with existing non-Steam shortcuts
    let nextIndex = 0;
    if (existingBuffer && existingBuffer.length >= 10) {
      const str = existingBuffer.toString('binary');
      // eslint-disable-next-line no-control-regex
      const matches = str.matchAll(/\x00(\d+)\x00/g);
      for (const m of matches) {
        const val = parseInt(m[1], 10);
        if (!isNaN(val) && val >= nextIndex) {
          nextIndex = val + 1;
        }
      }
    }

    // Generate binary entry chunk with sequential index
    const chunk = this.createShortcutEntryBuffer(nextIndex, item);

    if (!existingBuffer || existingBuffer.length < 10) {
      // Create new shortcuts.vdf with header: \x00shortcuts\x00 ... \x08\x08
      const header = Buffer.from('\x00shortcuts\x00', 'binary');
      const footer = Buffer.from('\x08\x08', 'binary');
      fs.writeFileSync(filePath, Buffer.concat([header, chunk, footer]));
      return true;
    }

    // Append into existing shortcuts.vdf before trailing double-null / 0x08 0x08
    let insertPos = existingBuffer.length - 2;
    if (insertPos < 0) insertPos = existingBuffer.length;

    // Scan backwards for terminating 0x08 0x08
    for (let i = existingBuffer.length - 1; i >= 1; i--) {
      if (existingBuffer[i] === 0x08 && existingBuffer[i - 1] === 0x08) {
        insertPos = i - 1;
        break;
      }
    }

    const before = existingBuffer.subarray(0, insertPos);
    const after = Buffer.from('\x08\x08', 'binary');
    fs.writeFileSync(filePath, Buffer.concat([before, chunk, after]));
    return true;
  }

  private createShortcutEntryBuffer(index: number, item: {
    appId: number;
    appName: string;
    exe: string;
    startDir: string;
    icon: string;
  }): Buffer {
    const buffers: Buffer[] = [];

    // Type 0 = Object
    buffers.push(Buffer.from(`\x00${index}\x00`, 'binary'));

    // appId (integer, type 2)
    const appIdBuf = Buffer.alloc(4);
    appIdBuf.writeUInt32LE(item.appId, 0);
    buffers.push(Buffer.from('\x02appid\x00', 'binary'), appIdBuf);

    // AppName (string, type 1)
    buffers.push(Buffer.from(`\x01AppName\x00${item.appName}\x00`, 'utf8'));

    // Exe (string, type 1)
    buffers.push(Buffer.from(`\x01Exe\x00"${item.exe}"\x00`, 'utf8'));

    // StartDir (string, type 1)
    buffers.push(Buffer.from(`\x01StartDir\x00"${item.startDir}"\x00`, 'utf8'));

    // icon (string, type 1)
    buffers.push(Buffer.from(`\x01icon\x00${item.icon}\x00`, 'utf8'));

    // LaunchOptions (string, type 1)
    buffers.push(Buffer.from('\x01LaunchOptions\x00GDK_BACKEND=x11 SDL_VIDEODRIVER=x11 %command%\x00', 'utf8'));

    // IsHidden (integer, type 2, value 0)
    const zero = Buffer.alloc(4, 0);
    const one = Buffer.alloc(4, 0);
    one.writeInt32LE(1, 0);

    buffers.push(Buffer.from('\x02IsHidden\x00', 'binary'), zero);
    buffers.push(Buffer.from('\x02AllowDesktopConfig\x00', 'binary'), one);
    buffers.push(Buffer.from('\x02AllowOverlay\x00', 'binary'), one);
    buffers.push(Buffer.from('\x02OpenVR\x00', 'binary'), zero);
    buffers.push(Buffer.from('\x02Devkit\x00', 'binary'), zero);
    buffers.push(Buffer.from('\x01DevkitGameID\x00\x00', 'binary'));
    buffers.push(Buffer.from('\x02DevkitOverrideAppID\x00', 'binary'), zero);
    buffers.push(Buffer.from('\x02LastPlayTime\x00', 'binary'), zero);
    buffers.push(Buffer.from('\x01FlatpakAppID\x00\x00', 'binary'));

    // Tags array (empty)
    buffers.push(Buffer.from('\x00tags\x00\x08', 'binary'));

    // Close entry object
    buffers.push(Buffer.from('\x08', 'binary'));

    return Buffer.concat(buffers);
  }

  private copySteamArtwork(gridDir: string, appId: number): number {
    let count = 0;
    // Look for bundled artwork in resources or assets
    const candidateSources = [
      path.join(process.cwd(), 'docs', 'assets'),
      path.join(process.cwd(), 'resources'),
      path.join(process.resourcesPath || '', 'resources')
    ];

    let assetsDir = candidateSources.find(d => fs.existsSync(d)) || '';
    if (!assetsDir) return count;

    // Map targets for Steam Grid formats
    const targetMap: Array<{ sourceName: string; targetFile: string }> = [
      { sourceName: 'icon.png', targetFile: `${appId}.png` }, // Vertical cover
      { sourceName: 'banner.png', targetFile: `${appId}_hero.png` }, // Hero banner
      { sourceName: 'banner.png', targetFile: `${appId}p.png` }, // Horizontal banner
      { sourceName: 'icon.png', targetFile: `${appId}_logo.png` } // Logo
    ];

    for (const item of targetMap) {
      const src = path.join(assetsDir, item.sourceName);
      const dest = path.join(gridDir, item.targetFile);
      if (fs.existsSync(src)) {
        try {
          fs.copyFileSync(src, dest);
          count++;
        } catch {
          // Ignore
        }
      }
    }

    return count;
  }

  private ensureDesktopEntry(exe: string, icon: string) {
    const appsDir = path.join(os.homedir(), '.local', 'share', 'applications');
    if (!fs.existsSync(appsDir)) {
      try { fs.mkdirSync(appsDir, { recursive: true }); } catch {}
    }

    const desktopFile = path.join(appsDir, 'io.github.cook0001.LinuxJagexLauncher.desktop');
    const content = `[Desktop Entry]
Name=Jagex Launcher
Comment=Authentic Linux Jagex Launcher for RuneScape 3, Old School RuneScape, and Dragonwilds
Exec="${exe}" %U
Icon=${icon}
Terminal=false
Type=Application
Categories=Game;
StartupWMClass=linux-jagex-launcher
MimeType=x-scheme-handler/jagex;x-scheme-handler/jagex-launcher;
PrefersNonDefaultGPU=true
`;

    try {
      fs.writeFileSync(desktopFile, content, 'utf8');
      fs.chmodSync(desktopFile, 0o755);
    } catch {
      // Ignore
    }
  }
}

export const steamShortcuts = new SteamShortcutManager();
