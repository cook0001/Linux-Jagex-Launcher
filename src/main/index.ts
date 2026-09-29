import { app, BrowserWindow, ipcMain, shell, clipboard, nativeImage } from 'electron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { store } from './store';
import { auth } from './auth';
import { installer } from './installer';
import { launcher } from './launcher';
import { osrs } from './osrs';
import { doctor } from './diagnostics';
import { updater } from './updater';
import { deck } from './deck';
import { steamShortcuts } from './steam-shortcuts';
import { worldPing } from './ping';

if (process.platform === 'linux' && typeof process.getuid === 'function' && process.getuid() === 0) {
  console.warn('[Security] WARNING: Running with sudo/root privileges causes permission corruption on user game data and cache directories!');
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getAppIcon(): Electron.NativeImage | string {
  const iconCandidates = [
    path.join(__dirname, '../../resources/icon.png'),
    path.join(__dirname, '../renderer/assets/icon.png'),
    path.join(process.resourcesPath, 'resources/icon.png'),
    path.join(process.resourcesPath, 'icon.png')
  ];

  for (const candidate of iconCandidates) {
    try {
      if (fs.existsSync(candidate)) {
        const icon = nativeImage.createFromPath(candidate);
        if (!icon.isEmpty()) {
          return icon;
        }
      }
    } catch {
      // Continue to next candidate
    }
  }
  return path.join(__dirname, '../../resources/icon.png');
}

// Performance & Chromium switches
app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');
app.commandLine.appendSwitch('force-webrtc-ip-handling-policy', 'default');
if (process.platform === 'linux') {
  // Prevent Chromium from falling back to software SwiftShader rendering on older Intel/AMD/NVIDIA GPUs
  app.commandLine.appendSwitch('ignore-gpu-blocklist');
  app.commandLine.appendSwitch('enable-gpu-rasterization');
  app.commandLine.appendSwitch('enable-zero-copy');
}

// Register custom protocol for Jagex launcher redirects
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('jagex', process.execPath, [path.resolve(process.argv[1])]);
    app.setAsDefaultProtocolClient('jagex-launcher', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('jagex');
  app.setAsDefaultProtocolClient('jagex-launcher');
}

let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow() {
  const appIcon = getAppIcon();
  const deckInfo = deck.getDeckInfo();
  const isGameMode = deckInfo.isGameMode || (deckInfo.isSteamDeck && !process.env.DESKTOP_START);

  mainWindow = new BrowserWindow({
    width: isGameMode ? 1280 : 1080,
    height: isGameMode ? 800 : 720,
    minWidth: isGameMode ? 800 : 960,
    minHeight: isGameMode ? 600 : 640,
    frame: false,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: -100, y: -100 },
    backgroundColor: '#0a0d14',
    show: false,
    icon: appIcon,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  if (isGameMode) {
    mainWindow.maximize();
  }

  if (typeof appIcon !== 'string') {
    mainWindow.setIcon(appIcon);
  }

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.on('show', () => {
    const settings = store.getSettings();
    if (Date.now() - (settings.lastUpdateCheck || 0) > 12 * 60 * 60 * 1000) {
      checkUpdatesInBackground();
    }
  });
}

async function checkUpdatesInBackground() {
  try {
    const settings = store.getSettings();
    if (settings.autoCheckUpdates !== false) {
      const result = await updater.checkForUpdates();
      if (result.updateAvailable && result.releaseInfo) {
        if (settings.skippedVersion !== result.releaseInfo.version) {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('updater:update-available', result);
          }
        }
      }
    }
  } catch (err) {
    console.warn('[Updater] Background check error:', err);
  }
}

// App lifecycle
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // Initial update check 4s after launch
  setTimeout(checkUpdatesInBackground, 4000);

  // Gentle periodic update check every 12 hours
  setInterval(checkUpdatesInBackground, 12 * 60 * 60 * 1000);
});

app.on('window-all-closed', () => {
  const settings = store.getSettings();
  if (settings.minimizeToTray && launcher.isGameRunning()) {
    // Keep alive in tray if game is still active
  } else {
    app.quit();
  }
});

// IPC: Window controls
ipcMain.handle('window:minimize', () => {
  mainWindow?.minimize();
});

ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.handle('window:close', () => {
  const settings = store.getSettings();
  if (settings.minimizeToTray) {
    mainWindow?.hide();
  } else {
    mainWindow?.close();
  }
});

ipcMain.handle('utils:openExternal', async (_, url: string) => {
  if (url.startsWith('https://') || url.startsWith('http://')) {
    await shell.openExternal(url);
  }
});

ipcMain.handle('utils:readClipboard', () => {
  return clipboard.readText();
});

// IPC: Auth
ipcMain.handle('auth:login', async () => {
  return await auth.startLoginFlow(mainWindow || undefined);
});

ipcMain.handle('auth:startBrowserLogin', async () => {
  return await auth.startBrowserLogin();
});

ipcMain.handle('auth:completeBrowserLogin', async (_, codeOrUrl: string) => {
  return await auth.completeBrowserLogin(codeOrUrl);
});

ipcMain.handle('auth:logout', (_, sub?: string) => {
  const targetSub = sub || store.getSessions().activeSub;
  if (targetSub) {
    auth.removeAccount(targetSub);
  }
  return store.getSessions();
});

ipcMain.handle('auth:refresh', async (_, sub: string) => {
  return await auth.refreshAccountSession(sub);
});

ipcMain.handle('auth:switchAccount', (_, sub: string) => {
  return auth.switchAccount(sub);
});

ipcMain.handle('auth:getSessions', () => {
  return store.getSessions();
});

ipcMain.handle('auth:syncCharacters', async (_, sub?: string) => {
  const targetSub = sub || store.getSessions().activeSub;
  if (!targetSub) return [];
  return await auth.syncCharacters(targetSub);
});

ipcMain.handle('auth:getActiveAccount', () => {
  return store.getActiveAccount();
});

// IPC: Settings
ipcMain.handle('settings:get', () => {
  return store.getSettings();
});

ipcMain.handle('settings:save', (_, newSettings: any) => {
  return store.saveSettings(newSettings);
});

// IPC: Installer
ipcMain.handle('installer:checkStatus', async () => {
  try {
    const isReady = await installer.isInstalledAndUpToDate();
    const meta = await installer.checkLatestPackage().catch(() => null);
    return { isReady, version: meta?.version || '2.2.12', hash: installer.getInstalledHash() };
  } catch (e: any) {
    return { isReady: false, error: e.message };
  }
});

ipcMain.handle('installer:install', async () => {
  return await installer.installOrUpdate((progress) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('install-progress', progress);
    }
  });
});

// IPC: Launcher
ipcMain.handle('launcher:launch', async (_, options?: any) => {
  const settings = store.getSettings();
  const game = options?.game || settings.selectedGame || 'rs3';
  if (game === 'osrs') {
    return await osrs.launchOsrs(mainWindow || undefined, options);
  }
  if (game === 'dragonwilds') {
    await shell.openExternal('steam://run/1374490');
    return;
  }
  return await launcher.launchRs3(mainWindow || undefined, options);
});

ipcMain.handle('launcher:isRunning', () => {
  return launcher.isGameRunning() || osrs.isGameRunning();
});

// IPC: OSRS Client Management
ipcMain.handle('osrs:checkStatus', (_, clientType?: 'runelite' | 'hdos' | 'official') => {
  return osrs.checkClientStatus(clientType);
});

ipcMain.handle('osrs:getJavaInfo', () => {
  const javaPath = osrs.findJava();
  return { javaPath, hasJava: javaPath !== null };
});

ipcMain.handle('osrs:install', async (_, clientType?: 'runelite' | 'hdos') => {
  return await osrs.installClient(clientType, (progress) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('install-progress', progress);
    }
  });
});

// IPC: Diagnostics & Compatibility
ipcMain.handle('diagnostics:runRs3Doctor', () => {
  return doctor.runDoctor();
});

ipcMain.handle('diagnostics:installRs3CompatLibs', async () => {
  return await installer.installLibSslCompat((progress) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('install-progress', progress);
    }
  });
});

ipcMain.handle('diagnostics:clearRs3Cache', () => {
  return installer.clearClientCache();
});

// IPC: Feed & News with TTL In-Memory Caching (3min for PSA, 5min for News)
const psaCache = new Map<string, { timestamp: number; data: any }>();
const newsCache = new Map<string, { timestamp: number; data: any[] }>();

ipcMain.handle('feed:getPsa', async (_, game: string) => {
  const targetGame = game === 'osrs' ? 'osrs' : 'runescape';
  const now = Date.now();
  const cached = psaCache.get(targetGame);
  if (cached && now - cached.timestamp < 3 * 60 * 1000) {
    return cached.data;
  }

  const url = `https://files.publishing.production.jxp.jagex.com/${targetGame}/${targetGame}.json?ts=${now}`;
  try {
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(6000) });
    if (!res.ok) return cached?.data || null;
    const data = await res.json();
    psaCache.set(targetGame, { timestamp: now, data });
    return data;
  } catch (e) {
    console.error('[Feed] Failed to fetch PSA:', e);
    return cached?.data || null;
  }
});

ipcMain.handle('feed:getNews', async (_, game?: string) => {
  const cacheKey = game || 'rs3';
  const now = Date.now();
  const cached = newsCache.get(cacheKey);
  if (cached && now - cached.timestamp < 5 * 60 * 1000) {
    return cached.data;
  }

  if (game === 'dragonwilds') {
    try {
      const res = await fetch('https://store.steampowered.com/feeds/news/app/1374490', { signal: AbortSignal.timeout(6000) });
      if (!res.ok) return cached?.data || [];
      const text = await res.text();

      const items: Array<{
        title: string;
        link: string;
        description: string;
        category: string;
        pubDate: string;
        imageUrl?: string;
      }> = [];

      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      let match;
      while ((match = itemRegex.exec(text)) !== null && items.length < 8) {
        const itemContent = match[1];
        const titleMatch = /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/.exec(itemContent);
        const linkMatch = /<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/.exec(itemContent);
        const descMatch = /<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/.exec(itemContent);
        const dateMatch = /<pubDate>(.*?)<\/pubDate>/.exec(itemContent);
        const imgMatch = /<enclosure[^>]*url="([^"]+)"/.exec(itemContent);

        let title = titleMatch ? titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '';
        title = title.replace(/&apos;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"');
        const link = linkMatch ? linkMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '';

        let description = descMatch ? descMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '') : '';
        description = description
          .replace(/&lt;[^&>]*&gt;/gi, ' ')
          .replace(/<[^>]*>/g, ' ')
          .replace(/&quot;/gi, '"')
          .replace(/&apos;/gi, "'")
          .replace(/&amp;/gi, '&')
          .replace(/\s+/g, ' ')
          .trim();
        if (description.length > 160) {
          description = description.slice(0, 157) + '...';
        }

        const category = 'Dragonwilds Update';
        const pubDate = dateMatch ? dateMatch[1] : '';
        const imageUrl = imgMatch ? imgMatch[1] : 'https://clan.fastly.steamstatic.com/images/45564297/7feb3c34244308ecf776059dc0477e9122b0caf7.png';

        items.push({ title, link, description, category, pubDate, imageUrl });
      }

      newsCache.set(cacheKey, { timestamp: now, data: items });
      return items;
    } catch (e) {
      console.error('[Feed] Failed to fetch Dragonwilds Steam news:', e);
      return cached?.data || [];
    }
  }

  const isOsrs = game === 'osrs';
  const rssUrl = isOsrs
    ? 'https://secure.runescape.com/m=news/latest_news.rss?oldschool=true'
    : 'https://secure.runescape.com/m=news/latest_news.rss';
  try {
    const res = await fetch(rssUrl, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return cached?.data || [];
    const text = await res.text();

    // Parse RSS XML items cleanly
    const items: Array<{
      title: string;
      link: string;
      description: string;
      category: string;
      pubDate: string;
      imageUrl?: string;
    }> = [];

    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(text)) !== null && items.length < 8) {
      const itemContent = match[1];
      const titleMatch = /<title>(.*?)<\/title>/.exec(itemContent);
      const linkMatch = /<link>(.*?)<\/link>/.exec(itemContent);
      const descMatch = /<description>([\s\S]*?)<\/description>/.exec(itemContent);
      const catMatch = /<category>(.*?)<\/category>/.exec(itemContent);
      const dateMatch = /<pubDate>(.*?)<\/pubDate>/.exec(itemContent);
      const imgMatch = /<enclosure[^>]*url="([^"]+)"/.exec(itemContent);

      const title = titleMatch ? titleMatch[1].replace(/&apos;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"') : '';
      const link = linkMatch ? linkMatch[1] : '';
      const description = descMatch ? descMatch[1].trim().replace(/&apos;/g, "'").replace(/&amp;/g, '&') : '';
      const category = catMatch ? catMatch[1] : 'Game Updates';
      const pubDate = dateMatch ? dateMatch[1] : '';
      const imageUrl = imgMatch ? imgMatch[1] : undefined;

      items.push({ title, link, description, category, pubDate, imageUrl });
    }

    newsCache.set(cacheKey, { timestamp: now, data: items });
    return items;
  } catch (e) {
    console.error('[Feed] Failed to fetch RSS news:', e);
    return cached?.data || [];
  }
});

// IPC: Auto Updater
ipcMain.handle('updater:check', async () => {
  return await updater.checkForUpdates();
});

ipcMain.handle('updater:download', async (_, releaseInfo: any) => {
  return await updater.downloadUpdate(releaseInfo, (progress) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:progress', progress);
    }
  });
});

ipcMain.handle('updater:applyAndRestart', () => {
  return updater.applyUpdateAndRestart();
});

ipcMain.handle('updater:getFormatInfo', () => {
  return {
    format: updater.getPackageFormat(),
    label: updater.getFormatDisplayLabel(),
    currentVersion: updater.getCurrentVersion()
  };
});

ipcMain.handle('updater:skipVersion', (_, version: string) => {
  return store.saveSettings({ skippedVersion: version });
});

// IPC: Steam Deck & SteamOS Handheld Support
ipcMain.handle('deck:getInfo', () => {
  return deck.getDeckInfo();
});

ipcMain.handle('steam:addToSteam', () => {
  return steamShortcuts.addToSteam();
});

// IPC: World Latency & Ping
ipcMain.handle('ping:rs3-worlds', async (_, worldIds?: number[]) => {
  return await worldPing.pingRs3Worlds(worldIds);
});

ipcMain.handle('ping:osrs-worlds', async (_, subIds?: number[]) => {
  return await worldPing.pingOsrsWorlds(subIds);
});



