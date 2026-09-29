import fs from 'fs';
import path from 'path';
import os from 'os';

export interface AppSettings {
  closeOnLaunch: boolean;
  minimizeToTray: boolean;
  useGameMode: boolean;
  useMangoHud: boolean;
  customLaunchCommand: string;
  configUri: string;
  selectedCharacterId: string | null;
  selectedGame: 'rs3' | 'osrs' | 'dragonwilds';
  selectedOsrsClient: 'runelite' | 'hdos' | 'official';
  activeAccountId: string | null;
  customJavaPath: string;
  osrsJvmArgs: string;
  osrsClientArgs: string;
  osrsCustomClientPath: string;
  rs3GpuWorkaround: 'none' | 'zink' | 'prime';
  rs3ForceX11: boolean;
  rs3AudioLatencyFix: boolean;
  autoCheckUpdates: boolean;
  lastUpdateCheck: number;
  skippedVersion: string | null;
}

export interface JagexCharacter {
  id: string;
  displayName: string;
  isMember?: boolean;
  isIronman?: boolean;
  isHardcore?: boolean;
  avatarUrl?: string;
}

export interface JagexAccountSession {
  sub: string;
  email?: string;
  displayName: string;
  refreshToken: string;
  idToken: string;
  sessionId: string;
  sessionExpiresAt?: number;
  characters: JagexCharacter[];
}

export interface SessionData {
  accounts: Record<string, JagexAccountSession>;
  activeSub: string | null;
}

const DEFAULT_SETTINGS: AppSettings = {
  closeOnLaunch: false,
  minimizeToTray: false,
  useGameMode: false,
  useMangoHud: false,
  customLaunchCommand: '',
  configUri: 'https://rs.config.runescape.com/k=5/l=0/jav_config.ws',
  selectedCharacterId: null,
  selectedGame: 'rs3',
  selectedOsrsClient: 'runelite',
  activeAccountId: null,
  customJavaPath: '',
  osrsJvmArgs: '',
  osrsClientArgs: '',
  osrsCustomClientPath: '',
  rs3GpuWorkaround: 'none',
  rs3ForceX11: true,
  rs3AudioLatencyFix: true,
  autoCheckUpdates: true,
  lastUpdateCheck: 0,
  skippedVersion: null,
};

export class StoreManager {
  private configDir: string;
  private settingsFile: string;
  private sessionFile: string;
  private settings: AppSettings;
  private sessions: SessionData;

  constructor() {
    this.configDir = path.join(os.homedir(), '.config', 'linux-jagex-launcher');
    this.settingsFile = path.join(this.configDir, 'settings.json');
    this.sessionFile = path.join(this.configDir, 'session.json');

    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }

    this.settings = this.loadSettings();
    this.sessions = this.loadSessions();
  }

  private loadSettings(): AppSettings {
    try {
      if (fs.existsSync(this.settingsFile)) {
        const raw = fs.readFileSync(this.settingsFile, 'utf8');
        return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
      }
    } catch (e) {
      console.error('[Store] Failed to load settings:', e);
    }
    return { ...DEFAULT_SETTINGS };
  }

  public saveSettings(updated: Partial<AppSettings>): AppSettings {
    this.settings = { ...this.settings, ...updated };
    try {
      fs.writeFileSync(this.settingsFile, JSON.stringify(this.settings, null, 2), 'utf8');
    } catch (e) {
      console.error('[Store] Failed to save settings:', e);
    }
    return this.settings;
  }

  public getSettings(): AppSettings {
    return { ...this.settings };
  }

  private loadSessions(): SessionData {
    try {
      if (fs.existsSync(this.sessionFile)) {
        const raw = fs.readFileSync(this.sessionFile, 'utf8');
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error('[Store] Failed to load session:', e);
    }
    return { accounts: {}, activeSub: null };
  }

  public saveSessions(sessions: SessionData) {
    this.sessions = sessions;
    try {
      // Save with strict file permissions for security
      fs.writeFileSync(this.sessionFile, JSON.stringify(this.sessions, null, 2), {
        encoding: 'utf8',
        mode: 0o600
      });
    } catch (e) {
      console.error('[Store] Failed to save session:', e);
    }
  }

  public getSessions(): SessionData {
    return this.sessions;
  }

  public getActiveAccount(): JagexAccountSession | null {
    if (!this.sessions.activeSub) return null;
    return this.sessions.accounts[this.sessions.activeSub] || null;
  }
}

export const store = new StoreManager();
