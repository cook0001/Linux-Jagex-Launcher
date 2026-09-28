import { app, BrowserWindow, ipcMain, shell, Tray, Menu, clipboard } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { store } from './store';
import { auth } from './auth';
import { installer } from './installer';
import { launcher } from './launcher';
import { osrs } from './osrs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Disable Blink automation features so Chromium behaves like a standard browser
app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');
app.commandLine.appendSwitch('force-webrtc-ip-handling-policy', 'default');

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
let tray: Tray | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1080,
    height: 720,
    minWidth: 960,
    minHeight: 640,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0a0d14',
    icon: path.join(__dirname, '../../resources/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App lifecycle
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
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

ipcMain.handle('auth:getSessions', () => {
  return store.getSessions();
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

// IPC: Feed & News
ipcMain.handle('feed:getPsa', async (_, game: string) => {
  const targetGame = game === 'osrs' ? 'osrs' : 'runescape';
  const url = `https://files.publishing.production.jxp.jagex.com/${targetGame}/${targetGame}.json?ts=${Date.now()}`;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.error('[Feed] Failed to fetch PSA:', e);
    return null;
  }
});

ipcMain.handle('feed:getNews', async (_, game?: string) => {
  const isOsrs = game === 'osrs';
  const rssUrl = isOsrs
    ? 'https://secure.runescape.com/m=news/latest_news.rss?oldschool=true'
    : 'https://secure.runescape.com/m=news/latest_news.rss';
  try {
    const res = await fetch(rssUrl);
    if (!res.ok) return [];
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

    return items;
  } catch (e) {
    console.error('[Feed] Failed to fetch RSS news:', e);
    return [];
  }
});
