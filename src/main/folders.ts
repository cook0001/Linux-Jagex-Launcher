import * as electron from 'electron';
import fs from 'fs';
import path from 'path';
import os from 'os';

const electronModule = (electron as any)?.default || electron;
const shell = electronModule?.shell;

export interface QuickFolderDefinition {
  id: string;
  name: string;
  category: 'screenshots' | 'cache' | 'logs' | 'config';
  client: 'runelite' | 'rs3' | 'hdos' | 'launcher';
  label: string;
  primaryPath: string;
  fallbackPaths?: string[];
}

export class QuickFoldersManager {
  private folders: QuickFolderDefinition[];

  constructor() {
    const home = os.homedir();
    const ljlData = path.join(home, '.local', 'share', 'linux-jagex-launcher', 'game-data');

    this.folders = [
      // Screenshots
      {
        id: 'rl-screenshots',
        name: 'RuneLite Screenshots',
        category: 'screenshots',
        client: 'runelite',
        label: 'RuneLite Screenshots',
        primaryPath: path.join(home, '.runelite', 'screenshots'),
      },
      {
        id: 'rs3-screenshots',
        name: 'RuneScape 3 Screenshots',
        category: 'screenshots',
        client: 'rs3',
        label: 'RS3 Screenshots',
        primaryPath: path.join(home, 'Pictures', 'RuneScape'),
        fallbackPaths: [path.join(ljlData, 'screenshots')],
      },
      {
        id: 'hdos-screenshots',
        name: 'HDOS Screenshots',
        category: 'screenshots',
        client: 'hdos',
        label: 'HDOS Screenshots',
        primaryPath: path.join(home, '.hdos', 'screenshots'),
      },

      // Caches
      {
        id: 'rl-cache',
        name: 'RuneLite Cache',
        category: 'cache',
        client: 'runelite',
        label: 'RuneLite Cache',
        primaryPath: path.join(home, '.runelite', 'cache'),
      },
      {
        id: 'rs3-cache',
        name: 'RuneScape 3 Cache',
        category: 'cache',
        client: 'rs3',
        label: 'RS3 NXT Cache',
        primaryPath: path.join(ljlData, '.runescape'),
        fallbackPaths: [path.join(ljlData, 'RuneScape')],
      },
      {
        id: 'hdos-cache',
        name: 'HDOS Cache',
        category: 'cache',
        client: 'hdos',
        label: 'HDOS Cache',
        primaryPath: path.join(home, '.hdos', 'cache'),
      },

      // Logs
      {
        id: 'rl-logs',
        name: 'RuneLite Logs',
        category: 'logs',
        client: 'runelite',
        label: 'RuneLite Logs',
        primaryPath: path.join(home, '.runelite', 'logs'),
      },
      {
        id: 'rs3-logs',
        name: 'RuneScape 3 Logs',
        category: 'logs',
        client: 'rs3',
        label: 'RS3 Client Logs',
        primaryPath: path.join(ljlData, 'logs'),
      },
      {
        id: 'hdos-logs',
        name: 'HDOS Logs',
        category: 'logs',
        client: 'hdos',
        label: 'HDOS Logs',
        primaryPath: path.join(home, '.hdos', 'logs'),
      },

      // Launcher Settings & Diagnostics
      {
        id: 'launcher-config',
        name: 'Launcher Config',
        category: 'config',
        client: 'launcher',
        label: 'Launcher Data & Config',
        primaryPath: path.join(home, '.config', 'linux-jagex-launcher'),
      },
    ];
  }

  public getFolders(): QuickFolderDefinition[] {
    return [...this.folders];
  }

  public resolvePath(folderIdOrPath: string): string {
    const found = this.folders.find((f) => f.id === folderIdOrPath);
    if (found) {
      if (found.fallbackPaths) {
        for (const alt of found.fallbackPaths) {
          if (fs.existsSync(alt)) return alt;
        }
      }
      return found.primaryPath;
    }

    // Direct path resolution with tilde expansion
    let target = folderIdOrPath;
    if (target.startsWith('~/')) {
      target = path.join(os.homedir(), target.slice(2));
    }
    return path.resolve(target);
  }

  public async openFolder(folderIdOrPath: string): Promise<{ success: boolean; path: string; error?: string }> {
    const resolved = this.resolvePath(folderIdOrPath);

    try {
      if (!fs.existsSync(resolved)) {
        fs.mkdirSync(resolved, { recursive: true });
      }

      if (shell?.openPath) {
        const err = await shell.openPath(resolved);
        if (err) {
          return { success: false, path: resolved, error: err };
        }
      }
      return { success: true, path: resolved };
    } catch (err: any) {
      return { success: false, path: resolved, error: err?.message || String(err) };
    }
  }
}

export const quickFolders = new QuickFoldersManager();
