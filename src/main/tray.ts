import * as electron from 'electron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { launcher } from './launcher.js';
import { osrs } from './osrs.js';
import { updater } from './updater.js';

const electronModule = (electron as any)?.default || electron;
const Tray = electronModule?.Tray;
const Menu = electronModule?.Menu;
const app = electronModule?.app;
const nativeImage = electronModule?.nativeImage;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class TrayManager {
  private tray: Electron.Tray | null = null;
  private mainWindow: Electron.BrowserWindow | null = null;
  private isQuitting = false;
  private statusUpdateInterval: NodeJS.Timeout | null = null;

  public getTrayIcon(): Electron.NativeImage | string | null {
    const candidates = [
      path.join(__dirname, '../../resources/icons/32x32.png'),
      path.join(__dirname, '../../resources/icons/24x24.png'),
      path.join(__dirname, '../../resources/icons/16x16.png'),
      path.join(__dirname, '../../resources/icon.png'),
      path.join(process.resourcesPath || '', 'resources/icons/32x32.png'),
      path.join(process.resourcesPath || '', 'resources/icon.png'),
    ];

    for (const candidate of candidates) {
      try {
        if (fs.existsSync(candidate)) {
          if (nativeImage) {
            const img = nativeImage.createFromPath(candidate);
            if (!img.isEmpty()) {
              return img.resize({ width: 22, height: 22 });
            }
          }
          return candidate;
        }
      } catch {
        // Fallback to next candidate
      }
    }
    return null;
  }

  public init(window: Electron.BrowserWindow): void {
    this.mainWindow = window;
    if (!Tray || !Menu) return;

    if (this.tray) {
      this.updateContextMenu();
      return;
    }

    const icon = this.getTrayIcon();
    if (!icon) return;

    try {
      const tray = new Tray(icon);
      this.tray = tray;
      tray.setToolTip('Linux Jagex Launcher');

      tray.on('click', () => {
        this.restoreWindow();
      });

      tray.on('double-click', () => {
        this.restoreWindow();
      });

      this.updateContextMenu();

      // Periodically refresh game running status in the tray menu
      if (!this.statusUpdateInterval) {
        this.statusUpdateInterval = setInterval(() => {
          this.updateContextMenu();
        }, 4000);
      }
    } catch (err) {
      console.warn('[Tray] Failed to initialize system tray:', err);
    }
  }

  public getStatusText(): string {
    const rs3Running = launcher.isGameRunning();
    const osrsRunning = osrs.isGameRunning();

    if (rs3Running && osrsRunning) {
      return 'Status: RS3 & OSRS Active';
    } else if (rs3Running) {
      return 'Status: RuneScape 3 Running';
    } else if (osrsRunning) {
      return 'Status: Old School RuneScape Running';
    }
    return 'Status: Idle';
  }

  public buildMenuTemplate(): Electron.MenuItemConstructorOptions[] {
    const statusText = this.getStatusText();

    return [
      {
        label: 'Open Linux Jagex Launcher',
        type: 'normal',
        click: () => this.restoreWindow(),
      },
      { type: 'separator' },
      {
        label: statusText,
        enabled: false,
      },
      { type: 'separator' },
      {
        label: 'Play RuneScape 3',
        type: 'normal',
        click: () => {
          this.restoreWindow();
          launcher.launchRs3(this.mainWindow || undefined).catch((err) => {
            console.error('[Tray] Launch RS3 error:', err);
          });
        },
      },
      {
        label: 'Play Old School RuneScape',
        type: 'normal',
        click: () => {
          this.restoreWindow();
          osrs.launchOsrs(this.mainWindow || undefined).catch((err) => {
            console.error('[Tray] Launch OSRS error:', err);
          });
        },
      },
      { type: 'separator' },
      {
        label: 'Check for Updates...',
        type: 'normal',
        click: async () => {
          this.restoreWindow();
          try {
            const res = await updater.checkForUpdates();
            if (this.mainWindow && !this.mainWindow.isDestroyed() && res.updateAvailable) {
              this.mainWindow.webContents.send('updater:update-available', res);
            }
          } catch (err) {
            console.warn('[Tray] Update check error:', err);
          }
        },
      },
      { type: 'separator' },
      {
        label: 'Quit',
        type: 'normal',
        click: () => {
          this.isQuitting = true;
          if (app) {
            app.quit();
          }
        },
      },
    ];
  }

  public updateContextMenu(): void {
    if (!this.tray || !Menu) return;

    try {
      const template = this.buildMenuTemplate();
      const contextMenu = Menu.buildFromTemplate(template);
      this.tray.setContextMenu(contextMenu);
    } catch (err) {
      console.warn('[Tray] Failed to update context menu:', err);
    }
  }

  public restoreWindow(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;

    if (!this.mainWindow.isVisible()) {
      this.mainWindow.show();
    }
    if (this.mainWindow.isMinimized()) {
      this.mainWindow.restore();
    }
    this.mainWindow.focus();
  }

  public setQuitting(val: boolean): void {
    this.isQuitting = val;
  }

  public getIsQuitting(): boolean {
    return this.isQuitting;
  }

  public destroy(): void {
    if (this.statusUpdateInterval) {
      clearInterval(this.statusUpdateInterval);
      this.statusUpdateInterval = null;
    }
    if (this.tray) {
      try {
        this.tray.destroy();
      } catch {
        // Ignored
      }
      this.tray = null;
    }
  }
}

export const trayManager = new TrayManager();
