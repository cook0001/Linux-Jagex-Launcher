import fs from 'fs';
import path from 'path';
import os from 'os';

export interface SteamDeckInfo {
  isSteamDeck: boolean;
  isSteamOS: boolean;
  isGameMode: boolean; // Running inside Gamescope compositor
  model: 'LCD' | 'OLED' | 'Generic Handheld' | 'Desktop/Other';
  productName: string;
  refreshRateTarget: number; // 60 for LCD, 90 for OLED
  steamPath: string | null;
}

export class SteamDeckManager {
  private cachedInfo: SteamDeckInfo | null = null;

  public getDeckInfo(): SteamDeckInfo {
    if (this.cachedInfo) {
      return this.cachedInfo;
    }

    const productName = this.readDmiProductName();
    const isLcd = productName.toLowerCase().includes('jupiter');
    const isOled = productName.toLowerCase().includes('galileo');
    const isSteamDeck = isLcd || isOled || process.env.STEAM_DECK === '1';

    let model: SteamDeckInfo['model'] = 'Desktop/Other';
    if (isLcd) model = 'LCD';
    else if (isOled) model = 'OLED';
    else if (isSteamDeck) model = 'Generic Handheld';

    const isSteamOS = this.detectSteamOS();
    const isGameMode = this.detectGameMode();
    const refreshRateTarget = isOled ? 90 : 60;
    const steamPath = this.findSteamPath();

    this.cachedInfo = {
      isSteamDeck,
      isSteamOS,
      isGameMode,
      model,
      productName,
      refreshRateTarget,
      steamPath
    };

    return this.cachedInfo;
  }

  private readDmiProductName(): string {
    const dmiPath = '/sys/devices/virtual/dmi/id/product_name';
    try {
      if (fs.existsSync(dmiPath)) {
        return fs.readFileSync(dmiPath, 'utf8').trim();
      }
    } catch {
      // DMI might not be readable in sandboxes or non-Linux
    }
    return '';
  }

  private detectSteamOS(): boolean {
    if (process.env.STEAM_OS === '1') return true;

    const osReleasePath = '/etc/os-release';
    try {
      if (fs.existsSync(osReleasePath)) {
        const content = fs.readFileSync(osReleasePath, 'utf8');
        if (content.includes('ID=steamos') || content.includes('ID_LIKE="arch"') && content.includes('steamos')) {
          return true;
        }
      }
    } catch {
      // Ignore
    }
    return false;
  }

  private detectGameMode(): boolean {
    // Gamescope Wayland compositor indicates Steam Game Mode
    if (process.env.GAMESCOPE_WAYLAND_DISPLAY) return true;
    if (process.env.XDG_CURRENT_DESKTOP?.toLowerCase() === 'gamescope') return true;
    return false;
  }

  public findSteamPath(): string | null {
    const home = os.homedir();
    const candidatePaths = [
      path.join(home, '.steam', 'steam'),
      path.join(home, '.local', 'share', 'Steam'),
      path.join(home, '.var', 'app', 'com.valvesoftware.Steam', '.steam', 'steam')
    ];

    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }
    return null;
  }
}

export const deck = new SteamDeckManager();
