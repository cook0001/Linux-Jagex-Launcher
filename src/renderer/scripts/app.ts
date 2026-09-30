import { GamepadNavigator } from './gamepad.ts';
import { COMMUNITY_RESOURCES } from './resources.ts';

// Declare the injected IPC API from preload.ts
declare global {
  interface Window {
    jagexApi: {
      minimize: () => Promise<void>;
      maximize: () => Promise<void>;
      close: () => Promise<void>;
      openExternal: (url: string) => Promise<void>;
      readClipboard: () => Promise<string>;
      login: () => Promise<any>;
      startBrowserLogin: () => Promise<string>;
      completeBrowserLogin: (codeOrUrl: string) => Promise<any>;
      logout: (sub?: string) => Promise<any>;
      switchAccount: (sub: string) => Promise<any>;
      refreshAccount: (sub: string) => Promise<any>;
      getSessions: () => Promise<any>;
      getActiveAccount: () => Promise<any>;
      syncCharacters: (sub?: string) => Promise<any[]>;
      getSettings: () => Promise<any>;
      saveSettings: (settings: any) => Promise<any>;
      checkClientStatus: () => Promise<{ isReady: boolean; version?: string; hash?: string; error?: string }>;
      installClient: () => Promise<string>;
      checkOsrsStatus: (clientType?: string) => Promise<{ hasJava: boolean; javaPath: string | null; hasClient: boolean; clientPath: string; clientType: string; isSystemClient?: boolean }>;
      installOsrsClient: (clientType?: string) => Promise<string>;
      getJavaInfo: () => Promise<{ javaPath: string | null; hasJava: boolean }>;
      onInstallProgress: (callback: (data: any) => void) => () => void;
      launchGame: (options?: any) => Promise<void>;
      isGameRunning: () => Promise<boolean>;
      onGameStateChanged: (callback: (data: any) => void) => () => void;
      fetchPsa: (game: string) => Promise<any>;
      fetchNews: (game?: string) => Promise<any[]>;
      runRs3Doctor: () => Promise<any>;
      installRs3CompatLibs: () => Promise<string>;
      clearRs3Cache: () => Promise<{ cleared: string[]; errors: string[] }>;
      getLastCrash: () => Promise<any>;
      clearLastCrash: () => Promise<boolean>;
      killZombieProcesses: () => Promise<number>;
      generateDoctorReportMarkdown: (report?: any) => Promise<string>;
      saveDoctorReportToFile: (content: string) => Promise<{ success: boolean; filePath?: string; error?: string }>;
      launchGameInSafeMode: (options?: any) => Promise<void>;
      runOsrsDoctor: () => Promise<any>;
      getOsrsLastCrash: () => Promise<any>;
      clearOsrsLastCrash: () => Promise<boolean>;
      repairOsrsPermissions: (targetDir: string) => Promise<{ repaired: boolean; error?: string }>;
      generateOsrsDoctorMarkdown: (report?: any) => Promise<string>;
      saveOsrsDoctorReportToFile: (content: string) => Promise<{ success: boolean; filePath?: string; error?: string }>;
      killOsrsZombieProcesses: () => Promise<number>;
      checkForUpdates: () => Promise<{
        updateAvailable: boolean;
        currentVersion: string;
        latestVersion: string;
        packageFormat: string;
        systemFamily?: string;
        supportedFormats?: string[];
        releaseInfo?: any;
        error?: string;
      }>;
      downloadUpdate: (releaseInfo: any, targetFormat?: string) => Promise<{ success: boolean; filePath?: string; format?: string; error?: string }>;
      installUpdate: (filePath?: string, format?: string) => Promise<{
        success: boolean;
        requiresRestart?: boolean;
        message?: string;
        installedPath?: string;
        manualCommand?: string;
        cancelled?: boolean;
        error?: string;
      }>;
      applyUpdateAndRestart: () => Promise<boolean>;
      getUpdaterFormatInfo: () => Promise<{ format: string; label: string; currentVersion: string }>;
      skipUpdateVersion: (version: string) => Promise<any>;
      onUpdateAvailable: (callback: (data: any) => void) => () => void;
      onUpdateProgress: (callback: (data: any) => void) => () => void;
      getDeckInfo: () => Promise<{
        isSteamDeck: boolean;
        isSteamOS: boolean;
        isGameMode: boolean;
        model: string;
        productName: string;
        refreshRateTarget: number;
        steamPath: string | null;
      }>;
      addToSteam: () => Promise<{
        success: boolean;
        message: string;
        shortcutsModified: number;
        artworkCopied: number;
        error?: string;
      }>;
      pingRs3Worlds: (worldIds?: number[]) => Promise<any[]>;
      pingOsrsWorlds: (subIds?: number[]) => Promise<any[]>;
      repairDesktopShortcuts: () => Promise<{ success: boolean; error?: string }>;
      openFolder: (folderIdOrPath: string) => Promise<{ success: boolean; path: string; error?: string }>;
      getQuickFolders: () => Promise<any[]>;
    };
  }
}

class JagexLauncherApp {
  private activeGame: 'rs3' | 'osrs' | 'dragonwilds' = 'rs3';
  private selectedOsrsClient: 'runelite' | 'hdos' | 'official' = 'runelite';
  private currentSessions: any = { accounts: {}, activeSub: null };
  private currentSettings: any = {};
  private selectedCharacterId: string | null = null;
  private isClientInstalled: boolean = false;
  private isGameRunning: boolean = false;
  private featuredBannerUrl: string | null = null;
  private pendingUpdateResult: any = null;
  private isUpdateDownloaded: boolean = false;
  private isUpdateInstalled: boolean = false;
  private selectedUpdaterFormat: 'deb' | 'appimage' = 'deb';
  private downloadedUpdatePath: string | null = null;
  private deckInfo: any = null;
  private gamepadNav: GamepadNavigator | null = null;
  private currentPingGame: 'rs3' | 'osrs' = 'rs3';
  private currentPingResults: any[] = [];
  private currentPingFilter: 'all' | 'us' | 'uk' | 'aus' = 'all';
  private currentResourceGame: 'rs3' | 'osrs' | 'dragonwilds' = 'rs3';
  private resourceSearchQuery: string = '';

  public async init() {
    this.setupWindowControls();
    this.setupNavigation();
    this.setupClientSelector();
    this.setupModals();
    this.setupCharacterDropdown();
    this.setupPlayButton();
    this.setupGamepad();
    this.setupWorldPing();
    this.setupResourcesModal();
    this.listenToIPC();

    await this.applyDeckAdaptations();
    await this.loadInitialData();
  }

  private setupWindowControls() {
    document.getElementById('btn-minimize')?.addEventListener('click', () => {
      window.jagexApi?.minimize();
    });

    document.getElementById('btn-maximize')?.addEventListener('click', () => {
      window.jagexApi?.maximize();
    });

    document.getElementById('btn-close')?.addEventListener('click', () => {
      window.jagexApi?.close();
    });
  }

  private setupNavigation() {
    const rs3Btn = document.getElementById('nav-game-rs3');
    const osrsBtn = document.getElementById('nav-game-osrs');
    const dragonwildsBtn = document.getElementById('nav-game-dragonwilds');

    rs3Btn?.addEventListener('click', () => {
      this.switchGame('rs3');
    });

    osrsBtn?.addEventListener('click', () => {
      this.switchGame('osrs');
    });

    dragonwildsBtn?.addEventListener('click', () => {
      this.switchGame('dragonwilds');
    });

    document.getElementById('view-all-news-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      const url = this.activeGame === 'dragonwilds'
        ? 'https://store.steampowered.com/app/1374490/RuneScape_Dragonwilds/'
        : (this.activeGame === 'rs3' ? 'https://secure.runescape.com/m=news' : 'https://oldschool.runescape.com');
      if (window.jagexApi) window.jagexApi.openExternal(url);
      else window.open(url, '_blank');
    });

    document.getElementById('hero-cta-btn')?.addEventListener('click', () => {
      const url = this.featuredBannerUrl || (
        this.activeGame === 'dragonwilds'
          ? 'https://store.steampowered.com/app/1374490/RuneScape_Dragonwilds/'
          : (this.activeGame === 'rs3' ? 'https://secure.runescape.com/m=news' : 'https://oldschool.runescape.com')
      );
      if (window.jagexApi) window.jagexApi.openExternal(url);
      else window.open(url, '_blank');
    });

    document.getElementById('hero-patch-btn')?.addEventListener('click', () => {
      const url = this.activeGame === 'dragonwilds'
        ? 'https://store.steampowered.com/news/app/1374490'
        : (this.activeGame === 'rs3'
          ? 'https://secure.runescape.com/m=news/latest_news.rss'
          : 'https://secure.runescape.com/m=news/latest_news.rss?oldschool=true');
      if (window.jagexApi) window.jagexApi.openExternal(url);
      else window.open(url, '_blank');
    });
  }

  private setupClientSelector() {
    const preview = document.getElementById('client-preview');
    const menu = document.getElementById('client-list-menu');
    const items = document.querySelectorAll('.client-dropdown-item');

    preview?.addEventListener('click', (e) => {
      e.stopPropagation();
      menu?.classList.toggle('hidden');
    });

    document.addEventListener('click', () => {
      menu?.classList.add('hidden');
    });

    items.forEach((item) => {
      item.addEventListener('click', async (e) => {
        e.stopPropagation();
        const client = item.getAttribute('data-client') as 'runelite' | 'hdos' | 'official';
        if (client) {
          await this.setOsrsClient(client);
          menu?.classList.add('hidden');
        }
      });
    });
  }

  private async setOsrsClient(client: 'runelite' | 'hdos' | 'official') {
    this.selectedOsrsClient = client;
    if (window.jagexApi) await window.jagexApi.saveSettings({ selectedOsrsClient: client });
    this.updateClientSelectorUI();
    this.updatePlaySubtext();
    await this.checkGameClientStatus();
  }

  private updateClientSelectorUI() {
    const nameEl = document.getElementById('selected-client-name');
    const typeEl = document.getElementById('selected-client-type');
    const avatarEl = document.getElementById('client-avatar-preview');
    const items = document.querySelectorAll('.client-dropdown-item');

    items.forEach((item) => {
      if (item.getAttribute('data-client') === this.selectedOsrsClient) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    if (this.selectedOsrsClient === 'hdos') {
      if (nameEl) nameEl.textContent = 'HDOS';
      if (typeEl) typeEl.textContent = '2009 Era HD Graphics';
      if (avatarEl) {
        avatarEl.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l8 4.5v9L12 20l-8-4.5v-9L12 2zm0 2.3L6 7.7v6.6l6 3.4 6-3.4V7.7L12 4.3z"/></svg>`;
      }
    } else if (this.selectedOsrsClient === 'official') {
      if (nameEl) nameEl.textContent = 'Official Client';
      if (typeEl) typeEl.textContent = 'Steam / Proton / Custom';
      if (avatarEl) {
        avatarEl.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>`;
      }
    } else {
      if (nameEl) nameEl.textContent = 'RuneLite';
      if (typeEl) typeEl.textContent = 'Recommended';
      if (avatarEl) {
        avatarEl.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14.5 2.5l2 2-7.5 7.5-2-2 7.5-7.5zm4 4l2 2-2 2-2-2 2-2zM3 21l3-1 2-2-2-2-2 2-1 3zm3.5-3.5l1.5-1.5-1-1-1.5 1.5 1 1z"/></svg>`;
      }
    }
  }

  private updatePlaySubtext() {
    const playSubtext = document.getElementById('play-subtext');
    if (!playSubtext) return;
    if (this.activeGame === 'rs3') {
      playSubtext.textContent = 'RuneScape 3';
    } else if (this.activeGame === 'dragonwilds') {
      playSubtext.textContent = 'Dragonwilds 1.0 (Steam)';
    } else {
      const clientLabel = this.selectedOsrsClient === 'hdos' ? 'HDOS' : (this.selectedOsrsClient === 'official' ? 'Official' : 'RuneLite');
      playSubtext.textContent = `Old School (${clientLabel})`;
    }
  }

  private async switchGame(game: 'rs3' | 'osrs' | 'dragonwilds') {
    this.activeGame = game;
    if (window.jagexApi) window.jagexApi.saveSettings({ selectedGame: game });

    const rs3Btn = document.getElementById('nav-game-rs3');
    const osrsBtn = document.getElementById('nav-game-osrs');
    const dragonwildsBtn = document.getElementById('nav-game-dragonwilds');
    const stageTitle = document.getElementById('stage-game-title');
    const stageSubtitle = document.getElementById('stage-game-subtitle');
    const clientSelector = document.getElementById('client-selector-container');
    const characterSelector = document.getElementById('character-selector-container');
    const viewAllLink = document.getElementById('view-all-news-link') as HTMLAnchorElement | null;
    const worldPingBtn = document.getElementById('btn-world-ping');

    rs3Btn?.classList.remove('active');
    osrsBtn?.classList.remove('active');
    dragonwildsBtn?.classList.remove('active');

    if (game === 'rs3') {
      rs3Btn?.classList.add('active');
      clientSelector?.classList.add('hidden');
      characterSelector?.classList.remove('hidden');
      worldPingBtn?.classList.remove('hidden');
      if (stageTitle) stageTitle.textContent = 'RuneScape';
      if (stageSubtitle) stageSubtitle.textContent = 'The Classic Adventure';
      if (viewAllLink) {
        viewAllLink.textContent = 'View All On RuneScape.com →';
        viewAllLink.href = 'https://secure.runescape.com/m=news';
      }
    } else if (game === 'osrs') {
      osrsBtn?.classList.add('active');
      clientSelector?.classList.remove('hidden');
      characterSelector?.classList.remove('hidden');
      worldPingBtn?.classList.remove('hidden');
      if (stageTitle) stageTitle.textContent = 'Old School RuneScape';
      if (stageSubtitle) stageSubtitle.textContent = 'The Iconic MMORPG';
      if (viewAllLink) {
        viewAllLink.textContent = 'View All On OldSchool.RuneScape.com →';
        viewAllLink.href = 'https://oldschool.runescape.com';
      }
      this.updateClientSelectorUI();
    } else if (game === 'dragonwilds') {
      dragonwildsBtn?.classList.add('active');
      clientSelector?.classList.add('hidden');
      characterSelector?.classList.add('hidden');
      worldPingBtn?.classList.add('hidden');
      document.getElementById('modal-world-ping')?.classList.add('hidden');
      if (stageTitle) stageTitle.textContent = 'RuneScape: Dragonwilds';
      if (stageSubtitle) stageSubtitle.textContent = 'Open-World Survival Action RPG';
      if (viewAllLink) {
        viewAllLink.textContent = 'View All On Steam Store →';
        viewAllLink.href = 'https://store.steampowered.com/app/1374490/RuneScape_Dragonwilds/';
      }
    }

    this.updatePlaySubtext();
    // Non-blocking concurrent execution of client inspection, PSA banner, and news feed
    Promise.allSettled([
      this.checkGameClientStatus(),
      this.fetchPsaAndBanner(),
      this.fetchNewsFeed()
    ]);
  }

  private async loadInitialData() {
    try {
      if (window.jagexApi) {
        const [settings, sessions] = await Promise.all([
          window.jagexApi.getSettings(),
          window.jagexApi.getSessions()
        ]);
        this.currentSettings = settings;
        this.currentSessions = sessions;
        this.applyLowSpecMode(this.currentSettings?.lowSpecMode);
      } else {
        this.currentSettings = { selectedGame: 'rs3', selectedOsrsClient: 'runelite' };
        this.currentSessions = { accounts: {}, activeSub: null };
        this.applyLowSpecMode(false);
      }
      this.selectedCharacterId = this.currentSettings?.selectedCharacterId || null;
      const urlParams = new URLSearchParams(window.location.search);
      const urlGame = urlParams.get('game') as 'rs3' | 'osrs' | 'dragonwilds' | null;
      if (urlGame && ['rs3', 'osrs', 'dragonwilds'].includes(urlGame)) {
        this.activeGame = urlGame;
      } else {
        this.activeGame = this.currentSettings?.selectedGame || 'rs3';
      }

      this.updateClientSelectorUI();
      await this.switchGame(this.activeGame);
      this.updateAccountUI();

      // Background character membership synchronization
      if (window.jagexApi && this.currentSessions?.activeSub) {
        window.jagexApi.syncCharacters(this.currentSessions.activeSub).then((updatedChars) => {
          if (updatedChars && updatedChars.length > 0) {
            const activeSub = this.currentSessions.activeSub;
            if (this.currentSessions.accounts[activeSub]) {
              this.currentSessions.accounts[activeSub].characters = updatedChars;
              this.updateAccountUI();
            }
          }
        }).catch((err) => console.warn('[App] Character sync warning:', err));
      }
    } catch (e) {
      console.error('[App] Error during initialization:', e);
    }
  }

  private applyLowSpecMode(enabled?: boolean): void {
    const appEl = document.getElementById('app');
    if (appEl) {
      appEl.classList.toggle('low-spec-mode', !!enabled);
    }
  }

  private updateAccountUI() {
    const loginGroup = document.getElementById('login-trigger-group');
    const accountPill = document.getElementById('account-logged-in');
    const accountUsername = document.getElementById('account-username');
    const accountInitials = document.getElementById('account-initials');

    const activeAcc = this.getActiveAccount();

    if (activeAcc) {
      loginGroup?.classList.add('hidden');
      accountPill?.classList.remove('hidden');

      const name = activeAcc.displayName || 'Jagex Account';
      if (accountUsername) accountUsername.textContent = name;
      if (accountInitials) accountInitials.textContent = name.charAt(0).toUpperCase();

      this.populateCharacterList(activeAcc);
    } else {
      loginGroup?.classList.remove('hidden');
      accountPill?.classList.add('hidden');
      this.clearCharacterSelector();
    }

    this.populateSavedAccountsList();

    if (this.activeGame === 'dragonwilds') {
      document.getElementById('character-selector-container')?.classList.add('hidden');
    }

    this.updatePlayButtonState();
  }

  private getActiveAccount() {
    if (!this.currentSessions.activeSub) return null;
    return this.currentSessions.accounts[this.currentSessions.activeSub] || null;
  }

  private populateSavedAccountsList() {
    const listEl = document.getElementById('modal-saved-accounts-list');
    const countEl = document.getElementById('saved-accounts-count');
    const modalAccountName = document.getElementById('modal-account-name');
    const modalAccountEmail = document.getElementById('modal-account-email');
    const modalAccountInitials = document.getElementById('modal-account-initials');

    if (!listEl) return;
    listEl.innerHTML = '';

    const accounts = this.currentSessions.accounts || {};
    const subs = Object.keys(accounts);
    if (countEl) countEl.textContent = `${subs.length} account${subs.length === 1 ? '' : 's'}`;

    const activeSub = this.currentSessions.activeSub;
    const activeAcc = activeSub ? accounts[activeSub] : null;

    if (activeAcc) {
      if (modalAccountName) modalAccountName.textContent = activeAcc.displayName || 'Jagex Account';
      if (modalAccountEmail) modalAccountEmail.textContent = activeAcc.email || `${activeAcc.characters?.length || 0} Linked Character(s)`;
      if (modalAccountInitials) modalAccountInitials.textContent = (activeAcc.displayName || 'J').charAt(0).toUpperCase();
    } else {
      if (modalAccountName) modalAccountName.textContent = 'No Account Signed In';
      if (modalAccountEmail) modalAccountEmail.textContent = 'Please log in to manage accounts.';
      if (modalAccountInitials) modalAccountInitials.textContent = '?';
    }

    if (subs.length === 0) {
      listEl.innerHTML = '<div style="font-size: 11px; color: #94a3b8; font-style: italic;">No saved accounts found. Click "Add Another Account" to sign in.</div>';
      return;
    }

    subs.forEach(sub => {
      const acc = accounts[sub];
      const isActive = sub === activeSub;
      const row = document.createElement('div');
      row.className = 'saved-account-row';
      row.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        background: ${isActive ? 'rgba(229, 179, 82, 0.08)' : 'rgba(15, 23, 42, 0.6)'};
        border: 1px solid ${isActive ? 'rgba(229, 179, 82, 0.3)' : 'rgba(255, 255, 255, 0.08)'};
        border-radius: 6px;
      `;

      row.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 28px; height: 28px; border-radius: 50%; background: ${isActive ? '#e5b352' : '#334155'}; color: ${isActive ? '#0f172a' : '#f8fafc'}; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 12px;">
            ${(acc.displayName || 'J').charAt(0).toUpperCase()}
          </div>
          <div>
            <div style="font-size: 12px; font-weight: 600; color: #f1f5f9;">${acc.displayName || 'Jagex Account'}</div>
            <div style="font-size: 10px; color: #94a3b8;">${acc.characters?.length || 0} character(s)</div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          ${isActive 
            ? '<span style="font-size: 10px; font-weight: 700; color: #e5b352; background: rgba(229, 179, 82, 0.15); padding: 2px 8px; border-radius: 4px; border: 1px solid rgba(229, 179, 82, 0.3);">ACTIVE</span>' 
            : `<button class="btn-secondary btn-switch-sub" data-sub="${sub}" style="font-size: 10px; padding: 4px 10px;">Switch</button>`}
          <button class="btn-icon-danger btn-remove-sub" data-sub="${sub}" title="Remove this account" style="background: none; border: none; cursor: pointer; color: #94a3b8; padding: 4px; display: flex; align-items: center;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      `;

      const switchBtn = row.querySelector('.btn-switch-sub');
      switchBtn?.addEventListener('click', async () => {
        await window.jagexApi.switchAccount(sub);
        this.currentSessions = await window.jagexApi.getSessions();
        const settings = await window.jagexApi.getSettings();
        this.selectedCharacterId = settings.selectedCharacterId;
        this.updateAccountUI();
      });

      const removeBtn = row.querySelector('.btn-remove-sub');
      removeBtn?.addEventListener('click', async () => {
        await window.jagexApi.logout(sub);
        this.currentSessions = await window.jagexApi.getSessions();
        const settings = await window.jagexApi.getSettings();
        this.selectedCharacterId = settings.selectedCharacterId;
        this.updateAccountUI();
      });

      listEl.appendChild(row);
    });
  }

  private populateCharacterList(account: any) {
    const menuList = document.getElementById('character-list-menu');
    const charName = document.getElementById('selected-character-name');
    const charType = document.getElementById('selected-character-type');
    const modalCharList = document.getElementById('modal-character-list');

    if (!menuList) return;
    menuList.innerHTML = '';

    const characters = account.characters || [];
    if (characters.length === 0) {
      if (charName) charName.textContent = 'No characters found';
      if (charType) charType.textContent = 'Add character on Jagex.com';
      if (modalCharList) modalCharList.innerHTML = '<div style="font-size: 12px; color: #94a3b8; padding: 8px;">No characters linked. Click "Manage On Jagex.com" to link characters.</div>';
      return;
    }

    // Default to first character if none selected
    let selectedChar = characters.find((c: any) => c.id === this.selectedCharacterId);
    if (!selectedChar && characters.length > 0) {
      selectedChar = characters[0];
      this.selectedCharacterId = selectedChar.id;
      window.jagexApi.saveSettings({ selectedCharacterId: selectedChar.id });
    }

    if (selectedChar) {
      if (charName) charName.textContent = selectedChar.displayName;
      if (charType) charType.textContent = selectedChar.isMember ? 'Membership Active' : 'Free to Play';
    }

    // Populate dropdown items
    characters.forEach((char: any) => {
      const item = document.createElement('div');
      item.className = `character-dropdown-item ${char.id === this.selectedCharacterId ? 'active' : ''}`;
      item.innerHTML = `
        <div class="character-avatar">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>
        </div>
        <div class="character-meta">
          <span class="character-name">${char.displayName}</span>
          <span class="character-type">${char.isMember ? 'Member' : 'Free to Play'}</span>
        </div>
        ${char.isMember ? '<span class="badge-member">MEMBER</span>' : '<span class="badge-f2p">F2P</span>'}
      `;

      item.addEventListener('click', async () => {
        this.selectedCharacterId = char.id;
        await window.jagexApi.saveSettings({ selectedCharacterId: char.id });
        this.populateCharacterList(account);
        document.getElementById('character-list-menu')?.classList.add('hidden');
      });

      menuList.appendChild(item);
    });

    // Also populate characters in Account Management modal
    if (modalCharList) {
      modalCharList.innerHTML = '';
      characters.forEach((char: any) => {
        const isSelected = char.id === this.selectedCharacterId;
        const charRow = document.createElement('div');
        charRow.className = 'modal-character-row';
        charRow.style.cssText = `
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          background: ${isSelected ? 'rgba(229, 179, 82, 0.08)' : 'rgba(15, 23, 42, 0.6)'};
          border: 1px solid ${isSelected ? 'rgba(229, 179, 82, 0.3)' : 'rgba(255, 255, 255, 0.08)'};
          border-radius: 6px;
          margin-bottom: 6px;
        `;
        charRow.innerHTML = `
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="width: 8px; height: 8px; border-radius: 50%; background: ${char.isMember ? '#e5b352' : '#94a3b8'};"></span>
            <span style="font-weight: 600; font-size: 13px; color: #f1f5f9;">${char.displayName}</span>
            ${char.isMember ? '<span class="badge-member" style="font-size: 9px; padding: 1px 6px;">MEMBER</span>' : '<span class="badge-f2p" style="font-size: 9px; padding: 1px 6px;">F2P</span>'}
          </div>
          ${isSelected ? '<span style="font-size: 11px; color: #e5b352; font-weight: 600;">Active</span>' : `<button class="btn-secondary btn-select-char" style="font-size: 10px; padding: 3px 8px;">Select</button>`}
        `;

        const selectBtn = charRow.querySelector('.btn-select-char');
        selectBtn?.addEventListener('click', async () => {
          this.selectedCharacterId = char.id;
          await window.jagexApi.saveSettings({ selectedCharacterId: char.id });
          this.populateCharacterList(account);
        });

        modalCharList.appendChild(charRow);
      });
    }
  }

  private clearCharacterSelector() {
    const charName = document.getElementById('selected-character-name');
    const charType = document.getElementById('selected-character-type');
    const menuList = document.getElementById('character-list-menu');
    const modalCharList = document.getElementById('modal-character-list');

    if (charName) charName.textContent = 'Select an account';
    if (charType) charType.textContent = 'Sign in required';
    if (menuList) menuList.innerHTML = '';
    if (modalCharList) modalCharList.innerHTML = '';
  }

  private setupCharacterDropdown() {
    const preview = document.getElementById('character-preview');
    const menu = document.getElementById('character-list-menu');

    preview?.addEventListener('click', (e) => {
      e.stopPropagation();
      const activeAcc = this.getActiveAccount();
      if (!activeAcc) {
        this.triggerLogin();
        return;
      }
      menu?.classList.toggle('hidden');
    });

    document.addEventListener('click', () => {
      menu?.classList.add('hidden');
    });
  }

  private async checkGameClientStatus() {
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');
    const versionText = document.getElementById('client-version-text');

    if (this.activeGame === 'dragonwilds') {
      this.isClientInstalled = true;
      if (statusDot) statusDot.className = 'status-pulse-dot';
      if (statusText) statusText.textContent = 'Ready to play';
      if (versionText) versionText.textContent = 'Dragonwilds 1.0 (Steam • App 1374490)';
      this.updatePlayButtonState();
      return;
    }

    if (!window.jagexApi) {
      this.isClientInstalled = true;
      if (statusDot) statusDot.className = 'status-pulse-dot';
      if (statusText) statusText.textContent = this.activeGame === 'osrs' ? 'Ready to play (RuneLite)' : 'Ready to play';
      if (versionText) versionText.textContent = this.activeGame === 'osrs' ? 'RuneLite • Ready' : 'Official Linux NXT Client (v2.2.12)';
      this.updatePlayButtonState();
      return;
    }

    if (this.activeGame === 'osrs') {
      const osrsResult = await window.jagexApi.checkOsrsStatus(this.selectedOsrsClient);
      const clientLabel = this.selectedOsrsClient === 'hdos' ? 'HDOS' : (this.selectedOsrsClient === 'official' ? 'Official Client' : 'RuneLite');
      this.isClientInstalled = osrsResult.hasClient && osrsResult.hasJava;

      if (osrsResult.hasClient && osrsResult.hasJava) {
        if (statusDot) statusDot.className = 'status-pulse-dot';
        if (statusText) statusText.textContent = `Ready to play (${clientLabel})`;
        if (versionText) {
          const modeTag = osrsResult.isSystemClient ? 'System Client' : 'Native Managed';
          versionText.textContent = `${clientLabel} • ${modeTag}`;
        }
      } else if (!osrsResult.hasJava) {
        if (statusDot) statusDot.className = 'status-pulse-dot updating';
        if (statusText) statusText.textContent = 'Java 11+ required';
        if (versionText) versionText.textContent = 'Please install OpenJDK (default-jre)';
      } else {
        if (statusDot) statusDot.className = 'status-pulse-dot updating';
        if (statusText) statusText.textContent = `${clientLabel} install required`;
        if (versionText) versionText.textContent = 'Click INSTALL or PLAY to download';
      }
    } else {
      const result = await window.jagexApi.checkClientStatus();
      this.isClientInstalled = result.isReady;

      if (result.isReady) {
        if (statusDot) statusDot.className = 'status-pulse-dot';
        if (statusText) statusText.textContent = 'Ready to play';
        if (versionText && result.version) {
          versionText.textContent = `Official Linux NXT Client (v${result.version})`;
        }
      } else {
        if (statusDot) statusDot.className = 'status-pulse-dot updating';
        if (statusText) statusText.textContent = 'Client install required';
        if (versionText) versionText.textContent = 'Official Linux NXT Client';
      }
    }

    this.updatePlayButtonState();
  }

  private updatePlayButtonState() {
    const btnPlay = document.getElementById('btn-play') as HTMLButtonElement | null;
    const playText = document.getElementById('play-text');
    const activeAcc = this.getActiveAccount();

    if (!btnPlay || !playText) return;

    if (this.isGameRunning) {
      btnPlay.disabled = true;
      btnPlay.classList.add('playing');
      playText.textContent = 'PLAYING';
      return;
    }

    btnPlay.classList.remove('playing');

    if (!activeAcc && this.activeGame !== 'dragonwilds') {
      btnPlay.disabled = false;
      playText.textContent = 'LOG IN';
    } else if (!this.isClientInstalled) {
      btnPlay.disabled = false;
      playText.textContent = 'INSTALL';
    } else {
      btnPlay.disabled = false;
      playText.textContent = 'PLAY';
    }
  }

  private setupPlayButton() {
    const btnPlay = document.getElementById('btn-play');
    btnPlay?.addEventListener('click', async () => {
      const activeAcc = this.getActiveAccount();
      if (!activeAcc && this.activeGame !== 'dragonwilds') {
        await this.triggerLogin();
        return;
      }

      if (!this.isClientInstalled) {
        await this.installGameClient();
        return;
      }

      await this.launchGame();
    });
  }

  private async triggerLogin() {
    try {
      await window.jagexApi.login();
      this.currentSessions = await window.jagexApi.getSessions();
      this.updateAccountUI();
    } catch (e: any) {
      console.warn('[App] In-app login window closed or encountered an issue:', e);
      if (e?.message && (e.message.includes('closed by the user') || e.message.includes('already open'))) {
        return;
      }
      // Show fallback browser modal only if an actual unexpected error occurred
      const modal = document.getElementById('modal-browser-login');
      modal?.classList.remove('hidden');
      this.checkClipboardForCode();
    }
  }

  private async triggerEmbeddedLogin() {
    await this.triggerLogin();
  }

  private async checkClipboardForCode() {
    try {
      const text = await window.jagexApi.readClipboard();
      if (!text) return;
      const trimmed = text.trim();
      if (trimmed.includes('code=') || (trimmed.startsWith('http') && trimmed.includes('launcher-redirect'))) {
        const input = document.getElementById('input-browser-redirect-url') as HTMLInputElement;
        const indicator = document.getElementById('clipboard-detect-indicator');
        const hint = document.getElementById('login-flow-hint');
        if (input && input.value !== trimmed) {
          input.value = trimmed;
          indicator?.classList.remove('hidden');
          if (hint) {
            hint.innerHTML = `<span style="color: #34d399; font-weight: 600;">✓ Authorization code detected from clipboard! Click Complete Sign In.</span>`;
          }
        }
      }
    } catch {
      // Ignore clipboard read errors
    }
  }

  private async installGameClient(targetGameOrClient?: string) {
    const overlay = document.getElementById('overlay-progress');
    const title = document.getElementById('progress-title');
    const subtitle = document.getElementById('progress-subtitle');
    const bar = document.getElementById('progress-bar-fill');
    const statusText = document.getElementById('progress-status-text');
    const pctText = document.getElementById('progress-percent-text');

    overlay?.classList.remove('hidden');

    const unsubscribe = window.jagexApi.onInstallProgress((data: any) => {
      if (bar) bar.style.width = `${data.progress}%`;
      if (statusText) statusText.textContent = data.message;
      if (pctText) pctText.textContent = `${data.progress}%`;
    });

    const isOsrs = targetGameOrClient === 'runelite' || targetGameOrClient === 'hdos' || (this.activeGame === 'osrs' && targetGameOrClient !== 'rs3');

    if (isOsrs) {
      const clientType = (targetGameOrClient === 'hdos' || targetGameOrClient === 'runelite')
        ? targetGameOrClient
        : (this.selectedOsrsClient === 'hdos' ? 'hdos' : 'runelite');
      const clientLabel = clientType === 'hdos' ? 'HDOS' : 'RuneLite';

      if (title) title.textContent = `Installing ${clientLabel}`;
      if (subtitle) subtitle.textContent = `Downloading latest ${clientLabel} launcher...`;

      try {
        await window.jagexApi.installOsrsClient(clientType);
        this.isClientInstalled = true;
        overlay?.classList.add('hidden');
        await this.checkGameClientStatus();
      } catch (e: any) {
        alert(`Installation failed: ${e.message}`);
        overlay?.classList.add('hidden');
      } finally {
        unsubscribe();
      }
      return;
    }

    if (targetGameOrClient === 'compat-libs') {
      if (title) title.textContent = 'Installing OpenSSL 1.1 Compatibility';
      if (subtitle) subtitle.textContent = 'Downloading isolated libssl1.1 libraries from Ubuntu security archive...';
      try {
        await window.jagexApi.installRs3CompatLibs();
        overlay?.classList.add('hidden');
        alert('OpenSSL 1.1 compatibility libraries installed successfully in ~/.local/share/linux-jagex-launcher/compat/lib64/');
      } catch (e: any) {
        alert(`Failed to install compat libraries: ${e.message}`);
        overlay?.classList.add('hidden');
      } finally {
        unsubscribe();
      }
      return;
    }

    // RS3 install logic
    if (title) title.textContent = 'Installing RuneScape 3';
    if (subtitle) subtitle.textContent = 'Downloading native Linux package from Jagex CDN...';

    try {
      await window.jagexApi.installClient();
      this.isClientInstalled = true;
      overlay?.classList.add('hidden');
      await this.checkGameClientStatus();
    } catch (e: any) {
      alert(`Installation failed: ${e.message}`);
      overlay?.classList.add('hidden');
    } finally {
      unsubscribe();
    }
  }

  private async launchGame() {
    try {
      this.isGameRunning = true;
      this.updatePlayButtonState();

      const statusDot = document.getElementById('status-dot');
      const statusText = document.getElementById('status-text');
      if (statusDot) statusDot.className = 'status-pulse-dot running';
      if (statusText) statusText.textContent = 'In Game';

      await window.jagexApi.launchGame({
        game: this.activeGame,
        clientType: this.selectedOsrsClient,
        characterId: this.selectedCharacterId
      });
    } catch (e: any) {
      alert(`Launch error: ${e.message}`);
      this.isGameRunning = false;
      this.updatePlayButtonState();
      this.checkGameClientStatus();
    }
  }

  private listenToIPC() {
    if (!window.jagexApi) return;
    window.jagexApi.onGameStateChanged((data: any) => {
      this.isGameRunning = data.isRunning;
      this.updatePlayButtonState();
    });

    if (window.jagexApi.onUpdateAvailable) {
      window.jagexApi.onUpdateAvailable((res: any) => {
        this.displayUpdateAvailable(res);
      });
    }
  }

  private displayUpdateAvailable(res: any) {
    this.pendingUpdateResult = res;
    const banner = document.getElementById('titlebar-update-banner');
    const bannerText = document.getElementById('titlebar-update-text');
    if (banner) banner.classList.remove('hidden');
    if (bannerText) bannerText.textContent = `Update v${res.latestVersion} Available`;
  }

  private openUpdateModal(result?: any) {
    if (result) this.pendingUpdateResult = result;
    const res = this.pendingUpdateResult;
    if (!res) return;

    const modal = document.getElementById('modal-updater');
    const versionTag = document.getElementById('modal-updater-version-tag');
    const headline = document.getElementById('modal-updater-headline');
    const formatDesc = document.getElementById('modal-updater-format-desc');
    const notesBox = document.getElementById('modal-updater-notes');
    const actionBtn = document.getElementById('btn-action-updater') as HTMLButtonElement | null;
    const distroNotice = document.getElementById('modal-updater-distro-notice');
    const progressSection = document.getElementById('modal-updater-progress-section');
    const statusAlert = document.getElementById('modal-updater-status-alert');
    const formatRow = document.getElementById('modal-updater-format-row');
    const btnDeb = document.getElementById('btn-updater-fmt-deb');
    const btnAppImage = document.getElementById('btn-updater-fmt-appimage');

    const isSameVersion = res.currentVersion === res.latestVersion;
    if (versionTag) {
      versionTag.textContent = isSameVersion
        ? `v${res.currentVersion} (Latest Published)`
        : `v${res.currentVersion} → v${res.latestVersion}`;
    }

    if (headline) {
      headline.textContent = isSameVersion
        ? 'Latest Release is already installed'
        : 'A new version of Linux Jagex Launcher is ready!';
    }

    if (notesBox) {
      notesBox.innerHTML = this.formatReleaseNotesForHumans(res.releaseInfo?.releaseNotes, res.latestVersion);
    }

    if (progressSection) progressSection.classList.add('hidden');
    if (statusAlert) statusAlert.classList.add('hidden');
    if (distroNotice) distroNotice.classList.add('hidden');

    this.isUpdateDownloaded = false;
    this.isUpdateInstalled = false;
    this.downloadedUpdatePath = null;

    const hasDeb = Boolean(res.releaseInfo?.assets?.deb);
    const hasAppImage = Boolean(res.releaseInfo?.assets?.appImage);

    // Initial selected format
    if (res.packageFormat === 'appimage') {
      this.selectedUpdaterFormat = 'appimage';
    } else if (res.packageFormat === 'deb' || res.systemFamily === 'debian') {
      this.selectedUpdaterFormat = hasDeb ? 'deb' : 'appimage';
    } else {
      this.selectedUpdaterFormat = hasAppImage ? 'appimage' : 'deb';
    }

    const updateFormatUI = () => {
      if (formatDesc) {
        formatDesc.textContent = this.selectedUpdaterFormat === 'deb'
          ? 'Package: Debian / Ubuntu (.deb via PolicyKit)'
          : 'Package: AppImage (Portable Linux Binary)';
      }
      if (btnDeb) {
        if (this.selectedUpdaterFormat === 'deb') btnDeb.classList.add('active');
        else btnDeb.classList.remove('active');
      }
      if (btnAppImage) {
        if (this.selectedUpdaterFormat === 'appimage') btnAppImage.classList.add('active');
        else btnAppImage.classList.remove('active');
      }
    };

    if (hasDeb && hasAppImage) {
      formatRow?.classList.remove('hidden');
      updateFormatUI();

      btnDeb?.replaceWith(btnDeb.cloneNode(true));
      btnAppImage?.replaceWith(btnAppImage.cloneNode(true));

      const newBtnDeb = document.getElementById('btn-updater-fmt-deb');
      const newBtnAppImage = document.getElementById('btn-updater-fmt-appimage');

      newBtnDeb?.addEventListener('click', () => {
        this.selectedUpdaterFormat = 'deb';
        updateFormatUI();
      });
      newBtnAppImage?.addEventListener('click', () => {
        this.selectedUpdaterFormat = 'appimage';
        updateFormatUI();
      });
    } else {
      formatRow?.classList.add('hidden');
      updateFormatUI();
    }

    if (actionBtn) {
      actionBtn.removeAttribute('disabled');
      actionBtn.textContent = isSameVersion ? 'Download & Reinstall' : 'Download & Install';
      actionBtn.style.background = '';
      actionBtn.style.borderColor = '';
    }

    modal?.classList.remove('hidden');
  }

  private formatReleaseNotesForHumans(rawNotes?: string, version?: string): string {
    if (!rawNotes || !rawNotes.trim()) {
      return `
        <div style="padding: 10px 12px; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 6px;">
          <p style="font-weight: 600; color: #34d399; margin-bottom: 4px; font-size: 13px;">🎉 Version ${this.escapeHtml(version || '')} is ready to install!</p>
          <p style="font-size: 12px; color: #94a3b8; margin: 0;">This release brings reliability improvements, Linux gaming optimizations, and client stability updates.</p>
        </div>
      `;
    }

    const lines = rawNotes.split('\n');
    const formattedHtml: string[] = [];
    let inList = false;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        if (inList) {
          formattedHtml.push('</ul>');
          inList = false;
        }
        continue;
      }

      // Check for headings: #, ##, ###
      const headingMatch = line.match(/^#{1,3}\s+(.*)$/);
      if (headingMatch) {
        if (inList) {
          formattedHtml.push('</ul>');
          inList = false;
        }
        let headingText = headingMatch[1].trim();
        // Translate technical headings into everyday, human-friendly headings
        if (/feat|new|added/i.test(headingText)) headingText = '✨ What’s New';
        else if (/fix|bug/i.test(headingText)) headingText = '🛠️ Fixes & Improvements';
        else if (/perf|speed|opt/i.test(headingText)) headingText = '⚡ Performance Updates';
        else if (/break|deprecat/i.test(headingText)) headingText = '⚠️ Important Changes';
        formattedHtml.push(`<h4 style="color: #34d399; font-weight: 600; font-size: 13px; margin: 12px 0 6px 0;">${this.escapeHtml(headingText)}</h4>`);
        continue;
      }

      // Check for bullet items
      const bulletMatch = line.match(/^[-*•]\s+(.*)$/);
      if (bulletMatch) {
        if (!inList) {
          formattedHtml.push('<ul style="list-style-type: disc; padding-left: 20px; margin: 6px 0; font-size: 12px; color: #cbd5e1; line-height: 1.5;">');
          inList = true;
        }
        const itemText = bulletMatch[1].trim();
        formattedHtml.push(`<li style="margin-bottom: 4px;">${this.formatInlineMarkdown(itemText)}</li>`);
        continue;
      }

      // Normal paragraph line
      if (inList) {
        formattedHtml.push('</ul>');
        inList = false;
      }
      formattedHtml.push(`<p style="font-size: 12px; color: #cbd5e1; margin-bottom: 6px; line-height: 1.4;">${this.formatInlineMarkdown(line)}</p>`);
    }

    if (inList) {
      formattedHtml.push('</ul>');
    }

    return formattedHtml.join('\n');
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private formatInlineMarkdown(text: string): string {
    let escaped = this.escapeHtml(text);

    // Convert conventional commit prefixes to human-friendly phrases
    escaped = escaped
      .replace(/^feat(?:\([^)]+\))?:\s*/i, '<strong style="color: #34d399;">New:</strong> ')
      .replace(/^fix(?:\([^)]+\))?:\s*/i, '<strong style="color: #fbbf24;">Fixed:</strong> ')
      .replace(/^perf(?:\([^)]+\))?:\s*/i, '<strong style="color: #38bdf8;">Improved:</strong> ')
      .replace(/^docs(?:\([^)]+\))?:\s*/i, '<strong style="color: #818cf8;">Guide:</strong> ')
      .replace(/^(?:refactor|chore|build|ci)(?:\([^)]+\))?:\s*/i, '<strong style="color: #94a3b8;">Update:</strong> ');

    // Clean trailing commit SHA e.g. (abc1234)
    escaped = escaped.replace(/\s*\([0-9a-f]{7,}\)$/i, '');

    // Format bold **word**
    escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong style="color: #f1f5f9;">$1</strong>');

    // Format inline code `code`
    escaped = escaped.replace(/`([^`]+)`/g, '<code style="background: rgba(30, 41, 59, 0.8); color: #6ee7b7; padding: 1px 5px; border-radius: 4px; font-family: monospace; font-size: 11px;">$1</code>');

    return escaped;
  }

  private setupGamepad() {
    this.gamepadNav = new GamepadNavigator({
      onSwitchGame: (dir) => {
        const games: Array<'rs3' | 'osrs' | 'dragonwilds'> = ['rs3', 'osrs', 'dragonwilds'];
        const idx = games.indexOf(this.activeGame);
        let nextIdx = dir === 'next' ? idx + 1 : idx - 1;
        if (nextIdx >= games.length) nextIdx = 0;
        if (nextIdx < 0) nextIdx = games.length - 1;
        this.switchGame(games[nextIdx]);
      },
      onToggleCharacterMenu: () => {
        const preview = document.getElementById('character-preview');
        preview?.click();
      },
      onToggleClientMenu: () => {
        if (this.activeGame === 'osrs') {
          const preview = document.getElementById('client-preview');
          preview?.click();
        } else {
          document.getElementById('btn-quick-settings')?.click();
        }
      },
      onToggleSettings: () => {
        const settingsModal = document.getElementById('modal-settings');
        if (settingsModal && !settingsModal.classList.contains('hidden')) {
          settingsModal.classList.add('hidden');
        } else {
          document.getElementById('btn-open-settings')?.click();
        }
      },
      onCloseModalOrMenu: () => {
        const clientMenu = document.getElementById('client-list-menu');
        if (clientMenu && !clientMenu.classList.contains('hidden')) {
          clientMenu.classList.add('hidden');
          return;
        }
        const charMenu = document.getElementById('character-list-menu');
        if (charMenu && !charMenu.classList.contains('hidden')) {
          charMenu.classList.add('hidden');
          return;
        }
        const openModal = Array.from(document.querySelectorAll('.modal-overlay:not(.hidden)')).pop();
        if (openModal) {
          openModal.classList.add('hidden');
        }
      },
      onPrimaryAction: () => {
        const playBtn = document.getElementById('btn-play') as HTMLButtonElement;
        if (playBtn && !playBtn.disabled) {
          playBtn.click();
        }
      }
    });
    this.gamepadNav.init();
  }

  private async applyDeckAdaptations() {
    if (!window.jagexApi?.getDeckInfo) return;
    try {
      this.deckInfo = await window.jagexApi.getDeckInfo();
      const appContainer = document.getElementById('app');
      const deckBadge = document.getElementById('deck-badge');

      if (this.deckInfo.isSteamDeck || this.deckInfo.isGameMode) {
        appContainer?.classList.add('steam-deck-mode');

        if (this.deckInfo.isGameMode) {
          appContainer?.classList.add('game-mode-active');
        }

        if (deckBadge) {
          deckBadge.classList.remove('hidden');
          if (this.deckInfo.model === 'OLED') {
            deckBadge.textContent = '🎮 DECK OLED (90Hz)';
          } else if (this.deckInfo.model === 'LCD') {
            deckBadge.textContent = '🎮 DECK LCD';
          } else if (this.deckInfo.isGameMode) {
            deckBadge.textContent = '🎮 GAMESCOPE';
          } else {
            deckBadge.textContent = '🎮 STEAM DECK';
          }
        }

        // Auto-invoke Steam On-Screen Keyboard on input focus in Game Mode
        if (this.deckInfo.isGameMode) {
          document.querySelectorAll('input').forEach((inp) => {
            inp.addEventListener('focus', () => {
              window.jagexApi.openExternal('steam://open/keyboard').catch(() => {});
            });
          });
        }
      }
    } catch (e) {
      console.warn('[Deck] Failed to apply handheld adaptations:', e);
    }
  }



  private async fetchPsaAndBanner() {
    try {
      const psaData = window.jagexApi ? await window.jagexApi.fetchPsa(this.activeGame) : null;
      const psaBanner = document.getElementById('psa-banner');
      const psaMsg = document.getElementById('psa-message');
      const heroTitle = document.getElementById('hero-title');
      const heroDesc = document.getElementById('hero-description');
      const heroImg = document.getElementById('hero-image');

      if (psaData && psaData.psaEnabled && psaData.psaMessage) {
        psaBanner?.classList.remove('hidden');
        if (psaMsg) psaMsg.textContent = psaData.psaMessage;
      } else {
        psaBanner?.classList.add('hidden');
      }

      if (this.activeGame === 'osrs') {
        if (heroTitle) heroTitle.textContent = 'Old School RuneScape';
        if (heroDesc) heroDesc.textContent = 'Experience the classic MMO adventure. Explore Gielinor, challenge epic bosses, and forge your legend with RuneLite and HDOS.';
      } else if (this.activeGame === 'dragonwilds') {
        if (heroTitle) heroTitle.textContent = 'RuneScape: Dragonwilds';
        if (heroDesc) heroDesc.textContent = 'Embark on an epic new wilderness expedition in Ashenfall. Discover ancient wyrm ruins, forge powerful draconic equipment, and conquer fearsome trials.';
      } else {
        if (heroTitle) heroTitle.textContent = 'RuneScape 3';
        if (heroDesc) heroDesc.textContent = 'Embark on epic quests, master 29 unique skills, and battle ancient elder gods across the vast realms of Gielinor.';
      }

      if (this.activeGame === 'dragonwilds') {
        if (heroImg) {
          heroImg.style.backgroundImage = "url('https://clan.fastly.steamstatic.com/images/45564297/7feb3c34244308ecf776059dc0477e9122b0caf7.png')";
        }
      } else if (psaData && psaData.banner && psaData.banner.fileName) {
        const gameFolder = this.activeGame === 'rs3' ? 'runescape' : 'osrs';
        const fullUrl = `https://files.publishing.production.jxp.jagex.com/${gameFolder}/${psaData.banner.fileName}`;
        if (heroImg) {
          heroImg.style.backgroundImage = `url('${fullUrl}')`;
        }
      } else if (this.activeGame === 'osrs') {
        if (heroImg) {
          heroImg.style.backgroundImage = "url('https://cdn.runescape.com/assets/img/external/oldschool/2026/Newsposts/2026-09-23/23-09-TN.jpg')";
        }
      } else {
        if (heroImg) {
          heroImg.style.backgroundImage = "url('https://cdn.runescape.com/assets/img/external/runescape/2026/Newsposts/2026-09-18/18-09-TN.jpg')";
        }
      }
    } catch (e) {
      console.warn('[App] PSA fetch warning:', e);
    }
  }

  private async fetchNewsFeed() {
    const grid = document.getElementById('news-grid');
    if (!grid) return;

    try {
      const newsItems = window.jagexApi ? await window.jagexApi.fetchNews(this.activeGame) : [];
      if (!newsItems || newsItems.length === 0) return;

      grid.innerHTML = '';
      newsItems.slice(0, 4).forEach((item: any) => {
        const card = document.createElement('a');
        card.href = item.link || '#';
        card.className = 'news-card';
        card.addEventListener('click', (e) => {
          e.preventDefault();
          if (item.link) window.jagexApi.openExternal(item.link);
        });

        const bgStyle = item.imageUrl ? `style="background-image: url('${item.imageUrl}');"` : '';

        card.innerHTML = `
          <div class="news-card-thumb" ${bgStyle}>
            <span class="news-card-tag">${item.category || 'News'}</span>
          </div>
          <div class="news-card-body">
            <span class="news-card-date">${item.pubDate ? new Date(item.pubDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : ''}</span>
            <h4 class="news-card-title">${item.title}</h4>
            <p class="news-card-snippet">${item.description}</p>
          </div>
        `;

        grid.appendChild(card);
      });
    } catch (e) {
      console.error('[App] Failed to load news feed:', e);
    }
  }

  private setupModals() {
    // Settings modal
    const settingsModal = document.getElementById('modal-settings');
    const openSettingsBtn = document.getElementById('btn-open-settings');
    const quickSettingsBtn = document.getElementById('btn-quick-settings');
    const closeSettingsBtn = document.getElementById('btn-close-settings');
    const saveSettingsBtn = document.getElementById('btn-save-settings');

    // Tab navigation in Settings
    const tabBtns = document.querySelectorAll('.settings-tab-btn');
    const switchSettingsTab = (targetId: string) => {
      tabBtns.forEach(btn => {
        if (btn.getAttribute('data-tab') === targetId) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
      document.querySelectorAll('.settings-tab-content').forEach(tc => {
        if (tc.id === targetId) {
          tc.classList.remove('hidden');
        } else {
          tc.classList.add('hidden');
        }
      });
    };

    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-tab');
        if (targetId) switchSettingsTab(targetId);
      });
    });

    const openSettings = (targetTabId = 'tab-general') => {
      const s = this.currentSettings;

      // Ensure the designated tab is active on open
      switchSettingsTab(targetTabId);

      // General settings
      const closeOnLaunchInput = document.getElementById('setting-close-on-launch') as HTMLInputElement;
      const minimizeInput = document.getElementById('setting-minimize-to-tray') as HTMLInputElement;
      const gameModeInput = document.getElementById('setting-use-gamemode') as HTMLInputElement;
      const mangoHudInput = document.getElementById('setting-use-mangohud') as HTMLInputElement;
      const lowSpecModeInput = document.getElementById('setting-low-spec-mode') as HTMLInputElement;

      if (closeOnLaunchInput) closeOnLaunchInput.checked = s.closeOnLaunch ?? false;
      if (minimizeInput) minimizeInput.checked = s.minimizeToTray ?? false;
      if (gameModeInput) gameModeInput.checked = s.useGameMode ?? false;
      if (mangoHudInput) mangoHudInput.checked = s.useMangoHud ?? false;
      if (lowSpecModeInput) {
        lowSpecModeInput.checked = s.lowSpecMode ?? false;
        lowSpecModeInput.onchange = () => {
          this.applyLowSpecMode(lowSpecModeInput.checked);
        };
      }

      // Software updates in General tab
      const autoCheckUpdatesInput = document.getElementById('setting-auto-check-updates') as HTMLInputElement;
      if (autoCheckUpdatesInput) autoCheckUpdatesInput.checked = s.autoCheckUpdates !== false;

      if (window.jagexApi?.getUpdaterFormatInfo) {
        window.jagexApi.getUpdaterFormatInfo().then((info: any) => {
          const vLabel = document.getElementById('setting-updater-version-label');
          const fLabel = document.getElementById('setting-updater-format-label');
          if (vLabel) vLabel.textContent = `Linux Jagex Launcher v${info.currentVersion}`;
          if (fLabel) fLabel.textContent = info.label;
        });
      }

      // Steam Deck & Handheld in General tab
      const deckHardwareLabel = document.getElementById('setting-deck-hardware-label');
      const deckModelLabel = document.getElementById('setting-deck-model-label');
      if (this.deckInfo) {
        if (deckHardwareLabel) {
          deckHardwareLabel.textContent = this.deckInfo.isSteamDeck
            ? `Valve Steam Deck (${this.deckInfo.model})`
            : (this.deckInfo.isSteamOS ? 'SteamOS Handheld Device' : 'Standard Linux PC / Desktop');
        }
        if (deckModelLabel) {
          deckModelLabel.textContent = `Display: ${this.deckInfo.refreshRateTarget}Hz target • Mode: ${this.deckInfo.isGameMode ? 'Gamescope (Game Mode)' : 'Desktop Mode'}`;
        }
      }

      // OSRS settings
      const osrsDefaultClientSelect = document.getElementById('setting-osrs-default-client') as HTMLSelectElement;
      const osrsJavaPathInput = document.getElementById('setting-osrs-java-path') as HTMLInputElement;
      const osrsCustomClientInput = document.getElementById('setting-osrs-custom-client') as HTMLInputElement;
      const osrsJvmArgsInput = document.getElementById('setting-osrs-jvm-args') as HTMLInputElement;
      const osrsClientArgsInput = document.getElementById('setting-osrs-client-args') as HTMLInputElement;
      const javaLabel = document.getElementById('setting-java-detected-label');

      if (osrsDefaultClientSelect) osrsDefaultClientSelect.value = s.selectedOsrsClient || 'runelite';
      if (osrsJavaPathInput) osrsJavaPathInput.value = s.customJavaPath || '';
      if (osrsCustomClientInput) osrsCustomClientInput.value = s.osrsCustomClientPath || '';
      if (osrsJvmArgsInput) osrsJvmArgsInput.value = s.osrsJvmArgs || '';
      if (osrsClientArgsInput) osrsClientArgsInput.value = s.osrsClientArgs || '';

      if (window.jagexApi) {
        window.jagexApi.getJavaInfo().then((info: any) => {
          if (javaLabel) {
            if (info.hasJava && info.javaPath) {
              javaLabel.textContent = info.javaPath;
              javaLabel.style.color = '#34d399';
            } else {
              javaLabel.textContent = 'No Java runtime found (install default-jre)';
              javaLabel.style.color = '#f87171';
            }
          }
        });
      } else if (javaLabel) {
        javaLabel.textContent = '/usr/bin/java (OpenJDK 21)';
        javaLabel.style.color = '#34d399';
      }

      // RS3 settings
      const configUriInput = document.getElementById('setting-config-uri') as HTMLInputElement;
      const customCmdInput = document.getElementById('setting-custom-cmd') as HTMLInputElement;
      const rs3ForceX11Input = document.getElementById('setting-rs3-force-x11') as HTMLInputElement;
      const rs3AudioLatencyInput = document.getElementById('setting-rs3-audio-latency') as HTMLInputElement;
      const rs3MesaGlThreadInput = document.getElementById('setting-rs3-mesa-glthread') as HTMLInputElement;
      const rs3CompatOverrideInput = document.getElementById('setting-rs3-compat-override') as HTMLInputElement;
      const rs3DisableDri3Input = document.getElementById('setting-rs3-disable-dri3') as HTMLInputElement;
      const rs3GpuWorkaroundSelect = document.getElementById('setting-rs3-gpu-workaround') as HTMLSelectElement;

      if (configUriInput) configUriInput.value = s.configUri || 'https://rs.config.runescape.com/k=5/l=0/jav_config.ws';
      if (customCmdInput) customCmdInput.value = s.customLaunchCommand || '';
      if (rs3ForceX11Input) rs3ForceX11Input.checked = s.rs3ForceX11 !== false;
      if (rs3AudioLatencyInput) rs3AudioLatencyInput.checked = s.rs3AudioLatencyFix !== false;
      if (rs3MesaGlThreadInput) rs3MesaGlThreadInput.checked = s.rs3MesaGlThread !== false;
      if (rs3CompatOverrideInput) rs3CompatOverrideInput.checked = s.rs3CompatProfileOverride !== false;
      if (rs3DisableDri3Input) rs3DisableDri3Input.checked = s.rs3DisableDri3 ?? false;
      if (rs3GpuWorkaroundSelect) rs3GpuWorkaroundSelect.value = s.rs3GpuWorkaround || 'none';

      settingsModal?.classList.remove('hidden');
    };

    // Sidebar settings button: Always opens to the general settings tab
    openSettingsBtn?.addEventListener('click', () => {
      openSettings('tab-general');
    });

    // Quick settings button next to the Play button:
    // If on RS3 -> opens RuneScape 3 settings tab (tab-rs3)
    // If on OSRS -> opens Old School RuneScape settings tab (tab-osrs)
    // Otherwise -> opens General settings tab (tab-general)
    quickSettingsBtn?.addEventListener('click', () => {
      if (this.activeGame === 'rs3') {
        openSettings('tab-rs3');
      } else if (this.activeGame === 'osrs') {
        openSettings('tab-osrs');
      } else {
        openSettings('tab-general');
      }
    });
    const cancelSettingsBtn = document.getElementById('btn-cancel-settings');
    const revertAndCloseSettings = () => {
      this.applyLowSpecMode(this.currentSettings?.lowSpecMode);
      settingsModal?.classList.add('hidden');
    };
    closeSettingsBtn?.addEventListener('click', revertAndCloseSettings);
    cancelSettingsBtn?.addEventListener('click', revertAndCloseSettings);

    saveSettingsBtn?.addEventListener('click', async () => {
      const closeOnLaunchInput = document.getElementById('setting-close-on-launch') as HTMLInputElement;
      const minimizeInput = document.getElementById('setting-minimize-to-tray') as HTMLInputElement;
      const gameModeInput = document.getElementById('setting-use-gamemode') as HTMLInputElement;
      const mangoHudInput = document.getElementById('setting-use-mangohud') as HTMLInputElement;
      const lowSpecModeInput = document.getElementById('setting-low-spec-mode') as HTMLInputElement;
      const autoCheckUpdatesInput = document.getElementById('setting-auto-check-updates') as HTMLInputElement;

      const osrsDefaultClientSelect = document.getElementById('setting-osrs-default-client') as HTMLSelectElement;
      const osrsJavaPathInput = document.getElementById('setting-osrs-java-path') as HTMLInputElement;
      const osrsCustomClientInput = document.getElementById('setting-osrs-custom-client') as HTMLInputElement;
      const osrsJvmArgsInput = document.getElementById('setting-osrs-jvm-args') as HTMLInputElement;
      const osrsClientArgsInput = document.getElementById('setting-osrs-client-args') as HTMLInputElement;

      const configUriInput = document.getElementById('setting-config-uri') as HTMLInputElement;
      const customCmdInput = document.getElementById('setting-custom-cmd') as HTMLInputElement;
      const rs3ForceX11Input = document.getElementById('setting-rs3-force-x11') as HTMLInputElement;
      const rs3AudioLatencyInput = document.getElementById('setting-rs3-audio-latency') as HTMLInputElement;
      const rs3MesaGlThreadInput = document.getElementById('setting-rs3-mesa-glthread') as HTMLInputElement;
      const rs3CompatOverrideInput = document.getElementById('setting-rs3-compat-override') as HTMLInputElement;
      const rs3DisableDri3Input = document.getElementById('setting-rs3-disable-dri3') as HTMLInputElement;
      const rs3GpuWorkaroundSelect = document.getElementById('setting-rs3-gpu-workaround') as HTMLSelectElement;

      const newSettings = {
        closeOnLaunch: closeOnLaunchInput?.checked ?? false,
        minimizeToTray: minimizeInput?.checked ?? false,
        useGameMode: gameModeInput?.checked ?? false,
        useMangoHud: mangoHudInput?.checked ?? false,
        lowSpecMode: lowSpecModeInput?.checked ?? false,
        autoCheckUpdates: autoCheckUpdatesInput?.checked ?? true,
        selectedOsrsClient: osrsDefaultClientSelect?.value || this.selectedOsrsClient,
        customJavaPath: osrsJavaPathInput?.value.trim() || '',
        osrsCustomClientPath: osrsCustomClientInput?.value.trim() || '',
        osrsJvmArgs: osrsJvmArgsInput?.value.trim() || '',
        osrsClientArgs: osrsClientArgsInput?.value.trim() || '',
        configUri: configUriInput?.value || 'https://rs.config.runescape.com/k=5/l=0/jav_config.ws',
        customLaunchCommand: customCmdInput?.value || '',
        rs3ForceX11: rs3ForceX11Input?.checked ?? true,
        rs3AudioLatencyFix: rs3AudioLatencyInput?.checked ?? true,
        rs3MesaGlThread: rs3MesaGlThreadInput?.checked ?? true,
        rs3CompatProfileOverride: rs3CompatOverrideInput?.checked ?? true,
        rs3DisableDri3: rs3DisableDri3Input?.checked ?? false,
        rs3GpuWorkaround: rs3GpuWorkaroundSelect?.value || 'none'
      };

      this.currentSettings = await window.jagexApi.saveSettings(newSettings);
      this.selectedOsrsClient = this.currentSettings.selectedOsrsClient;
      this.applyLowSpecMode(this.currentSettings.lowSpecMode);
      this.updateClientSelectorUI();
      this.updatePlaySubtext();
      await this.checkGameClientStatus();

      settingsModal?.classList.add('hidden');
    });

    // Reinstall buttons in settings modal
    document.getElementById('btn-reinstall-runelite')?.addEventListener('click', async () => {
      settingsModal?.classList.add('hidden');
      await this.installGameClient('runelite');
    });

    document.getElementById('btn-reinstall-hdos')?.addEventListener('click', async () => {
      settingsModal?.classList.add('hidden');
      await this.installGameClient('hdos');
    });

    document.getElementById('btn-reinstall-client')?.addEventListener('click', async () => {
      settingsModal?.classList.add('hidden');
      await this.installGameClient('rs3');
    });

    document.getElementById('btn-install-compat-libs')?.addEventListener('click', async () => {
      settingsModal?.classList.add('hidden');
      await this.installGameClient('compat-libs');
    });

    document.getElementById('btn-clear-rs3-cache')?.addEventListener('click', async () => {
      if (!window.jagexApi?.clearRs3Cache) return;
      if (confirm('Clear RuneScape client caches and temporary resources? This helps fix the "Loading application resources" startup hang.')) {
        try {
          const res = await window.jagexApi.clearRs3Cache();
          if (res.cleared.length > 0) {
            alert(`Cleared ${res.cleared.length} cache location(s):\n${res.cleared.join('\n')}`);
          } else {
            alert('No existing cache folders needed cleaning.');
          }
        } catch (e: any) {
          alert(`Error clearing cache: ${e.message}`);
        }
      }
    });

    // Pre-flight Doctor Runner & Diagnostic Suite
    const runDoctorBtn = document.getElementById('btn-run-doctor');
    const doctorItemsList = document.getElementById('doctor-items-list');
    const doctorStatusText = document.getElementById('doctor-status-text');
    const doctorBadge = document.getElementById('doctor-badge');
    const doctorAptSuggestion = document.getElementById('doctor-apt-suggestion');
    const doctorAptCode = document.getElementById('doctor-apt-code');
    const doctorPkgTitle = document.getElementById('doctor-pkg-title');
    const copyPkgCmdBtn = document.getElementById('btn-copy-pkg-cmd');
    const copyReportBtn = document.getElementById('btn-copy-doctor-report');
    const exportReportBtn = document.getElementById('btn-export-doctor-report');
    const crashBanner = document.getElementById('doctor-crash-banner');
    const crashTitle = document.getElementById('doctor-crash-title');
    const crashSummary = document.getElementById('doctor-crash-summary');
    const crashQuickFixBtn = document.getElementById('btn-crash-quick-fix');
    const reportGithubBtn = document.getElementById('btn-report-github');
    const launchSafeModeBtn = document.getElementById('btn-launch-safe-mode');
    const killZombiesBtn = document.getElementById('btn-kill-zombies');

    let currentDoctorReport: any = null;

    const executeDoctor = async () => {
      if (!window.jagexApi?.runRs3Doctor) return;
      if (doctorStatusText) doctorStatusText.textContent = 'Running full diagnostics & pre-flight probes...';
      try {
        const report = await window.jagexApi.runRs3Doctor();
        currentDoctorReport = report;

        if (doctorStatusText) {
          doctorStatusText.textContent = `${report.osName} (${report.arch}) - Distro: ${report.distroFamily.toUpperCase()} | Display: ${report.displayServer.toUpperCase()}`;
        }
        if (doctorBadge) {
          doctorBadge.classList.remove('hidden');
          if (report.allOk) {
            doctorBadge.textContent = 'ALL CHECKS PASSED';
            doctorBadge.style.background = 'rgba(16, 185, 129, 0.2)';
            doctorBadge.style.color = '#34d399';
            doctorBadge.style.borderColor = 'rgba(16, 185, 129, 0.4)';
          } else {
            doctorBadge.textContent = 'ACTION REQUIRED';
            doctorBadge.style.background = 'rgba(239, 68, 68, 0.2)';
            doctorBadge.style.color = '#f87171';
            doctorBadge.style.borderColor = 'rgba(239, 68, 68, 0.4)';
          }
        }

        // Render Crash Banner if recent crash detected
        try {
          const lastCrash = await window.jagexApi.getLastCrash();
          if (lastCrash && Date.now() - lastCrash.timestamp < 48 * 60 * 60 * 1000 && crashBanner && crashTitle && crashSummary) {
            crashBanner.classList.remove('hidden');
            crashTitle.textContent = `${lastCrash.title} (${lastCrash.category})`;
            crashSummary.textContent = `${lastCrash.summary} — Exit code: ${lastCrash.exitCode ?? 'N/A'}, Signal: ${lastCrash.signal ?? 'None'}`;

            if (crashQuickFixBtn) {
              if (lastCrash.actionId && lastCrash.actionLabel) {
                crashQuickFixBtn.textContent = lastCrash.actionLabel;
                crashQuickFixBtn.classList.remove('hidden');
                crashQuickFixBtn.onclick = async () => {
                  await handleDoctorAction(lastCrash.actionId);
                };
              } else {
                crashQuickFixBtn.classList.add('hidden');
              }
            }

            if (reportGithubBtn) {
              reportGithubBtn.onclick = async () => {
                const md = await window.jagexApi.generateDoctorReportMarkdown(report);
                const issueTitle = encodeURIComponent(`[Crash] ${lastCrash.title} (${lastCrash.signal || lastCrash.exitCode})`);
                const issueBody = encodeURIComponent(`### Crash Description\n\n### Doctor Diagnostic Report\n\n${md}`);
                const url = `https://github.com/cook0001/Linux-Jagex-Launcher/issues/new?title=${issueTitle}&body=${issueBody}`;
                await window.jagexApi.openExternal(url);
              };
            }
          } else if (crashBanner) {
            crashBanner.classList.add('hidden');
          }
        } catch {}

        if (doctorItemsList) {
          doctorItemsList.innerHTML = report.checks.map((c: any) => {
            const icon = c.status === 'ok' ? '✓' : (c.status === 'warning' ? '⚠' : '✗');
            const color = c.status === 'ok' ? '#34d399' : (c.status === 'warning' ? '#fde047' : '#f87171');
            const catBadge = `<span style="font-size: 9px; padding: 1px 4px; border-radius: 3px; background: rgba(255,255,255,0.06); color: #94a3b8; text-transform: uppercase;">${c.category}</span>`;
            const actionBtn = c.actionId && c.actionLabel
              ? `<button class="btn-secondary doctor-quick-action" data-action="${c.actionId}" style="font-size: 10px; padding: 2px 7px; margin-top: 4px; border-color: rgba(96, 165, 250, 0.4); color: #93c5fd; cursor: pointer;">💡 ${c.actionLabel}</button>`
              : '';

            return `
              <div style="display: flex; gap: 8px; align-items: flex-start; padding: 5px 0; border-bottom: 1px solid rgba(255,255,255,0.04);">
                <span style="font-weight: 700; color: ${color}; width: 14px; text-align: center; margin-top: 2px;">${icon}</span>
                <div style="flex: 1;">
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="font-weight: 600; color: #e2e8f0;">${c.name}</span>
                    ${catBadge}
                  </div>
                  <div style="color: #94a3b8; font-size: 10.5px; margin-top: 2px;">${c.message}</div>
                  ${c.remediation ? `<div style="color: #60a5fa; font-size: 10.5px; margin-top: 2px;">💡 <em>${c.remediation}</em></div>` : ''}
                  ${actionBtn}
                </div>
              </div>
            `;
          }).join('');

          // Wire click handlers for dynamic quick action buttons
          doctorItemsList.querySelectorAll('.doctor-quick-action').forEach((btn) => {
            btn.addEventListener('click', async (e) => {
              const actionId = (e.currentTarget as HTMLElement).getAttribute('data-action');
              if (actionId) {
                await handleDoctorAction(actionId);
              }
            });
          });
        }

        // Package suggestions display
        const pkgCmd = report.suggestedPackageCommand?.command || report.suggestedAptCommand;
        if (doctorAptSuggestion && doctorAptCode) {
          if (pkgCmd) {
            doctorAptSuggestion.classList.remove('hidden');
            if (doctorPkgTitle && report.suggestedPackageCommand) {
              doctorPkgTitle.textContent = `Recommended Package Installation (${report.suggestedPackageCommand.packageManager}):`;
            }
            doctorAptCode.textContent = pkgCmd;
          } else {
            doctorAptSuggestion.classList.add('hidden');
          }
        }
      } catch (err: any) {
        if (doctorStatusText) doctorStatusText.textContent = `Diagnostics error: ${err.message}`;
      }
    };

    const handleDoctorAction = async (actionId: string) => {
      try {
        if (actionId === 'install_ssl') {
          if (doctorStatusText) doctorStatusText.textContent = 'Installing OpenSSL 1.1 compat libraries...';
          await window.jagexApi.installRs3CompatLibs();
          alert('OpenSSL 1.1 compatibility libraries installed successfully.');
        } else if (actionId === 'clear_cache') {
          const res = await window.jagexApi.clearRs3Cache();
          alert(`Cleared ${res.cleared.length} cache folders.`);
        } else if (actionId === 'enable_lowspec') {
          await window.jagexApi.saveSettings({ lowSpecMode: true });
          const lowSpecToggle = document.getElementById('setting-low-spec-mode') as HTMLInputElement | null;
          if (lowSpecToggle) lowSpecToggle.checked = true;
          document.body.classList.add('low-spec-active');
        } else if (actionId === 'enable_audio_fix') {
          await window.jagexApi.saveSettings({ rs3AudioLatencyFix: true });
          const audioToggle = document.getElementById('setting-rs3-audio-latency') as HTMLInputElement | null;
          if (audioToggle) audioToggle.checked = true;
        } else if (actionId === 'enable_zink') {
          await window.jagexApi.saveSettings({ rs3GpuWorkaround: 'zink' });
          const gpuSelect = document.getElementById('setting-rs3-gpu-workaround') as HTMLSelectElement | null;
          if (gpuSelect) gpuSelect.value = 'zink';
        } else if (actionId === 'enable_prime') {
          await window.jagexApi.saveSettings({ rs3GpuWorkaround: 'prime' });
          const gpuSelect = document.getElementById('setting-rs3-gpu-workaround') as HTMLSelectElement | null;
          if (gpuSelect) gpuSelect.value = 'prime';
        } else if (actionId === 'enable_x11') {
          await window.jagexApi.saveSettings({ rs3ForceX11: true });
          const x11Toggle = document.getElementById('setting-rs3-force-x11') as HTMLInputElement | null;
          if (x11Toggle) x11Toggle.checked = true;
        } else if (actionId === 'kill_zombies') {
          const count = await window.jagexApi.killZombieProcesses();
          alert(`Terminated ${count} orphan game process(es).`);
        }
        await executeDoctor();
      } catch (err: any) {
        alert(`Action failed: ${err.message}`);
      }
    };

    runDoctorBtn?.addEventListener('click', executeDoctor);

    // Copy diagnostic report to clipboard
    copyReportBtn?.addEventListener('click', async () => {
      try {
        const md = await window.jagexApi.generateDoctorReportMarkdown(currentDoctorReport);
        await navigator.clipboard.writeText(md);
        const originalText = copyReportBtn.querySelector('span')?.textContent || 'Copy Report';
        if (copyReportBtn.querySelector('span')) {
          copyReportBtn.querySelector('span')!.textContent = 'Copied!';
        }
        setTimeout(() => {
          if (copyReportBtn.querySelector('span')) {
            copyReportBtn.querySelector('span')!.textContent = originalText;
          }
        }, 2000);
      } catch (err: any) {
        alert(`Failed to copy report: ${err.message}`);
      }
    });

    // Save diagnostic report to file
    exportReportBtn?.addEventListener('click', async () => {
      try {
        const md = await window.jagexApi.generateDoctorReportMarkdown(currentDoctorReport);
        const res = await window.jagexApi.saveDoctorReportToFile(md);
        if (res.success) {
          alert(`Diagnostic report saved successfully:\n${res.filePath}`);
        } else {
          alert(`Failed to save report: ${res.error}`);
        }
      } catch (err: any) {
        alert(`Failed to export report: ${err.message}`);
      }
    });

    // Copy package install command
    copyPkgCmdBtn?.addEventListener('click', async () => {
      const code = doctorAptCode?.textContent;
      if (code) {
        await navigator.clipboard.writeText(code);
        copyPkgCmdBtn.textContent = 'Copied!';
        setTimeout(() => {
          copyPkgCmdBtn.textContent = 'Copy Command';
        }, 2000);
      }
    });

    // Launch in Safe Compatibility Mode
    launchSafeModeBtn?.addEventListener('click', async () => {
      if (confirm('Launch RuneScape 3 in Safe Compatibility Mode?\n\nThis enforces X11/XWayland, Mesa Zink over Vulkan, Audio Latency Fix, and DRI2 fallback to bypass driver or compositor crashes.')) {
        try {
          if (window.jagexApi?.launchGameInSafeMode) {
            await window.jagexApi.launchGameInSafeMode();
          }
        } catch (err: any) {
          alert(`Failed to launch safe mode: ${err.message}`);
        }
      }
    });

    // Kill Zombie Processes
    killZombiesBtn?.addEventListener('click', async () => {
      try {
        const killed = await window.jagexApi.killZombieProcesses();
        alert(`Terminated ${killed} orphan game process(es).`);
        await executeDoctor();
      } catch (err: any) {
        alert(`Error killing processes: ${err.message}`);
      }
    });

    // ==========================================
    // OSRS Doctor Diagnostic Suite & Crash Reporter
    // ==========================================
    const runOsrsDoctorBtn = document.getElementById('btn-run-osrs-doctor');
    const osrsDoctorItemsList = document.getElementById('osrs-doctor-items-list');
    const osrsDoctorStatusText = document.getElementById('osrs-doctor-status-text');
    const osrsDoctorBadge = document.getElementById('osrs-doctor-badge');
    const osrsDoctorAptSuggestion = document.getElementById('osrs-doctor-apt-suggestion');
    const osrsDoctorAptCode = document.getElementById('osrs-doctor-apt-code');
    const osrsDoctorPkgTitle = document.getElementById('osrs-doctor-pkg-title');
    const copyOsrsPkgCmdBtn = document.getElementById('btn-copy-osrs-pkg-cmd');
    const copyOsrsReportBtn = document.getElementById('btn-copy-osrs-doctor-report');
    const exportOsrsReportBtn = document.getElementById('btn-export-osrs-doctor-report');
    const osrsCrashBanner = document.getElementById('osrs-crash-banner');
    const osrsCrashTitle = document.getElementById('osrs-crash-title');
    const osrsCrashSummary = document.getElementById('osrs-crash-summary');
    const osrsCrashQuickFixBtn = document.getElementById('btn-osrs-crash-quick-fix');
    const osrsReportGithubBtn = document.getElementById('btn-osrs-report-github');

    let currentOsrsDoctorReport: any = null;

    const executeOsrsDoctor = async () => {
      if (!window.jagexApi?.runOsrsDoctor) return;
      if (osrsDoctorStatusText) osrsDoctorStatusText.textContent = 'Running OSRS pre-flight diagnostics...';
      try {
        const report = await window.jagexApi.runOsrsDoctor();
        currentOsrsDoctorReport = report;

        if (osrsDoctorStatusText) {
          osrsDoctorStatusText.textContent = `${report.osName} (${report.arch}) - Client: ${report.selectedClient.toUpperCase()} | Java: ${report.javaVersion || 'Not Found'}`;
        }
        if (osrsDoctorBadge) {
          osrsDoctorBadge.classList.remove('hidden');
          if (report.allOk) {
            osrsDoctorBadge.textContent = 'ALL CHECKS PASSED';
            osrsDoctorBadge.style.background = 'rgba(16, 185, 129, 0.2)';
            osrsDoctorBadge.style.color = '#34d399';
            osrsDoctorBadge.style.borderColor = 'rgba(16, 185, 129, 0.4)';
          } else {
            osrsDoctorBadge.textContent = 'ACTION REQUIRED';
            osrsDoctorBadge.style.background = 'rgba(239, 68, 68, 0.2)';
            osrsDoctorBadge.style.color = '#f87171';
            osrsDoctorBadge.style.borderColor = 'rgba(239, 68, 68, 0.4)';
          }
        }

        // Render Crash Banner if recent crash detected
        try {
          const lastCrash = await window.jagexApi.getOsrsLastCrash();
          if (lastCrash && Date.now() - lastCrash.timestamp < 48 * 60 * 60 * 1000 && osrsCrashBanner && osrsCrashTitle && osrsCrashSummary) {
            osrsCrashBanner.classList.remove('hidden');
            osrsCrashTitle.textContent = `${lastCrash.title} (${lastCrash.category})`;
            osrsCrashSummary.textContent = `${lastCrash.summary} — Client: ${lastCrash.clientType.toUpperCase()}, Exit code: ${lastCrash.exitCode ?? 'N/A'}, Signal: ${lastCrash.signal ?? 'None'}`;

            if (osrsCrashQuickFixBtn) {
              if (lastCrash.actionId && lastCrash.actionLabel) {
                osrsCrashQuickFixBtn.textContent = lastCrash.actionLabel;
                osrsCrashQuickFixBtn.classList.remove('hidden');
                osrsCrashQuickFixBtn.onclick = async () => {
                  await handleOsrsDoctorAction(lastCrash.actionId);
                };
              } else {
                osrsCrashQuickFixBtn.classList.add('hidden');
              }
            }

            if (osrsReportGithubBtn) {
              osrsReportGithubBtn.onclick = async () => {
                const md = await window.jagexApi.generateOsrsDoctorMarkdown(report);
                const issueTitle = encodeURIComponent(`[OSRS Crash] ${lastCrash.title} (${lastCrash.clientType})`);
                const issueBody = encodeURIComponent(`### Crash Description\n\n### OSRS Doctor Diagnostic Report\n\n${md}`);
                const url = `https://github.com/cook0001/Linux-Jagex-Launcher/issues/new?title=${issueTitle}&body=${issueBody}`;
                await window.jagexApi.openExternal(url);
              };
            }
          } else if (osrsCrashBanner) {
            osrsCrashBanner.classList.add('hidden');
          }
        } catch {}

        if (osrsDoctorItemsList) {
          osrsDoctorItemsList.innerHTML = report.checks.map((c: any) => {
            const icon = c.status === 'ok' ? '✓' : (c.status === 'warning' ? '⚠' : '✗');
            const color = c.status === 'ok' ? '#34d399' : (c.status === 'warning' ? '#fde047' : '#f87171');
            const catBadge = `<span style="font-size: 9px; padding: 1px 4px; border-radius: 3px; background: rgba(255,255,255,0.06); color: #94a3b8; text-transform: uppercase;">${c.category}</span>`;
            const actionBtn = c.actionId && c.actionLabel
              ? `<button class="btn-secondary osrs-doctor-quick-action" data-action="${c.actionId}" style="font-size: 10px; padding: 2px 7px; margin-top: 4px; border-color: rgba(96, 165, 250, 0.4); color: #93c5fd; cursor: pointer;">💡 ${c.actionLabel}</button>`
              : '';

            return `
              <div style="display: flex; gap: 8px; align-items: flex-start; padding: 5px 0; border-bottom: 1px solid rgba(255,255,255,0.04);">
                <span style="font-weight: 700; color: ${color}; width: 14px; text-align: center; margin-top: 2px;">${icon}</span>
                <div style="flex: 1;">
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="font-weight: 600; color: #e2e8f0;">${c.name}</span>
                    ${catBadge}
                  </div>
                  <div style="color: #94a3b8; font-size: 10.5px; margin-top: 2px;">${c.message}</div>
                  ${c.remediation ? `<div style="color: #60a5fa; font-size: 10.5px; margin-top: 2px;">💡 <em>${c.remediation}</em></div>` : ''}
                  ${actionBtn}
                </div>
              </div>
            `;
          }).join('');

          // Wire click handlers for dynamic quick action buttons
          osrsDoctorItemsList.querySelectorAll('.osrs-doctor-quick-action').forEach((btn) => {
            btn.addEventListener('click', async (e) => {
              const actionId = (e.currentTarget as HTMLElement).getAttribute('data-action');
              if (actionId) {
                await handleOsrsDoctorAction(actionId);
              }
            });
          });
        }

        // Package suggestions display
        const pkgCmd = report.suggestedPackageCommand?.command;
        if (osrsDoctorAptSuggestion && osrsDoctorAptCode) {
          if (pkgCmd) {
            osrsDoctorAptSuggestion.classList.remove('hidden');
            if (osrsDoctorPkgTitle && report.suggestedPackageCommand) {
              osrsDoctorPkgTitle.textContent = `Recommended Headful Java Package (${report.suggestedPackageCommand.packageManager}):`;
            }
            osrsDoctorAptCode.textContent = pkgCmd;
          } else {
            osrsDoctorAptSuggestion.classList.add('hidden');
          }
        }
      } catch (err: any) {
        if (osrsDoctorStatusText) osrsDoctorStatusText.textContent = `Diagnostics error: ${err.message}`;
      }
    };

    const handleOsrsDoctorAction = async (actionId: string) => {
      try {
        if (actionId === 'install_headful_java') {
          const pkgCmd = currentOsrsDoctorReport?.suggestedPackageCommand?.command;
          if (pkgCmd) {
            await navigator.clipboard.writeText(pkgCmd);
            alert(`Package installation command copied to clipboard:\n\n${pkgCmd}\n\nRun this command in your terminal to install headful Java with graphical display support.`);
          } else {
            alert('Please install a headful JRE (e.g. default-jre or openjdk-17-jre) using your package manager.');
          }
        } else if (actionId === 'install_runelite_jar') {
          if (osrsDoctorStatusText) osrsDoctorStatusText.textContent = 'Installing RuneLite JAR...';
          await window.jagexApi.installOsrsClient('runelite');
          alert('RuneLite launcher JAR installed successfully.');
        } else if (actionId === 'install_hdos_jar') {
          if (osrsDoctorStatusText) osrsDoctorStatusText.textContent = 'Installing HDOS JAR...';
          await window.jagexApi.installOsrsClient('hdos');
          alert('HDOS launcher JAR installed successfully.');
        } else if (actionId === 'fix_runelite_perms') {
          const runeliteDir = '~/.runelite';
          const res = await window.jagexApi.repairOsrsPermissions(runeliteDir);
          if (res.repaired) {
            alert('Repaired file permissions for ~/.runelite directory.');
          } else {
            alert(`Failed to repair permissions: ${res.error || 'Unknown error'}`);
          }
        } else if (actionId === 'enable_lowspec') {
          await window.jagexApi.saveSettings({ lowSpecMode: true });
          const lowSpecToggle = document.getElementById('setting-low-spec-mode') as HTMLInputElement | null;
          if (lowSpecToggle) lowSpecToggle.checked = true;
          document.body.classList.add('low-spec-active');
          alert('Low-Spec / Performance mode enabled.');
        } else if (actionId === 'kill_osrs_zombies') {
          const count = await window.jagexApi.killOsrsZombieProcesses();
          alert(`Terminated ${count} orphan OSRS process(es).`);
        } else if (actionId === 'enable_font_smoothing') {
          const currentSettings = await window.jagexApi.getSettings();
          let jvmArgs = (currentSettings.osrsJvmArgs || '').trim();
          if (!jvmArgs.includes('awt.useSystemAAFontSettings')) {
            jvmArgs = `${jvmArgs} -Dawt.useSystemAAFontSettings=lcd -Dswing.aatext=true`.trim();
            await window.jagexApi.saveSettings({ osrsJvmArgs: jvmArgs });
            const jvmInput = document.getElementById('setting-osrs-jvm-args') as HTMLInputElement | null;
            if (jvmInput) jvmInput.value = jvmArgs;
            alert('Enabled subpixel font antialiasing (-Dawt.useSystemAAFontSettings=lcd).');
          }
        } else if (actionId === 'enable_zgc') {
          const currentSettings = await window.jagexApi.getSettings();
          let jvmArgs = (currentSettings.osrsJvmArgs || '').trim();
          if (!jvmArgs.includes('+UseZGC')) {
            jvmArgs = `${jvmArgs} -XX:+UseZGC -XX:+ZGenerational`.trim();
            await window.jagexApi.saveSettings({ osrsJvmArgs: jvmArgs });
            const jvmInput = document.getElementById('setting-osrs-jvm-args') as HTMLInputElement | null;
            if (jvmInput) jvmInput.value = jvmArgs;
            alert('Enabled ultra-low-latency Generational ZGC (-XX:+UseZGC -XX:+ZGenerational).');
          }
        }
        await executeOsrsDoctor();
      } catch (err: any) {
        alert(`Action failed: ${err.message}`);
      }
    };

    runOsrsDoctorBtn?.addEventListener('click', executeOsrsDoctor);

    const killOsrsZombiesBtn = document.getElementById('btn-kill-osrs-zombies');
    killOsrsZombiesBtn?.addEventListener('click', async () => {
      try {
        const killed = await window.jagexApi.killOsrsZombieProcesses();
        alert(`Terminated ${killed} orphan OSRS process(es).`);
        await executeOsrsDoctor();
      } catch (err: any) {
        alert(`Error killing processes: ${err.message}`);
      }
    });

    // Copy OSRS diagnostic report to clipboard
    copyOsrsReportBtn?.addEventListener('click', async () => {
      try {
        const md = await window.jagexApi.generateOsrsDoctorMarkdown(currentOsrsDoctorReport);
        await navigator.clipboard.writeText(md);
        const originalText = copyOsrsReportBtn.querySelector('span')?.textContent || 'Copy Report';
        if (copyOsrsReportBtn.querySelector('span')) {
          copyOsrsReportBtn.querySelector('span')!.textContent = 'Copied!';
        }
        setTimeout(() => {
          if (copyOsrsReportBtn.querySelector('span')) {
            copyOsrsReportBtn.querySelector('span')!.textContent = originalText;
          }
        }, 2000);
      } catch (err: any) {
        alert(`Failed to copy report: ${err.message}`);
      }
    });

    // Save OSRS diagnostic report to file
    exportOsrsReportBtn?.addEventListener('click', async () => {
      try {
        const md = await window.jagexApi.generateOsrsDoctorMarkdown(currentOsrsDoctorReport);
        const res = await window.jagexApi.saveOsrsDoctorReportToFile(md);
        if (res.success) {
          alert(`OSRS diagnostic report saved successfully:\n${res.filePath}`);
        } else {
          alert(`Failed to save report: ${res.error}`);
        }
      } catch (err: any) {
        alert(`Failed to export report: ${err.message}`);
      }
    });

    // Copy OSRS package install command
    copyOsrsPkgCmdBtn?.addEventListener('click', async () => {
      const code = osrsDoctorAptCode?.textContent;
      if (code) {
        await navigator.clipboard.writeText(code);
        copyOsrsPkgCmdBtn.textContent = 'Copied!';
        setTimeout(() => {
          copyOsrsPkgCmdBtn.textContent = 'Copy Command';
        }, 2000);
      }
    });

    // Browser login modal
    const browserLoginModal = document.getElementById('modal-browser-login');
    const closeBrowserLoginBtn = document.getElementById('btn-close-browser-login');
    const openBrowserAuthBtn = document.getElementById('btn-open-browser-auth');
    const pasteClipboardBtn = document.getElementById('btn-paste-clipboard');
    const submitBrowserCodeBtn = document.getElementById('btn-submit-browser-code');
    const tryEmbeddedAgainBtn = document.getElementById('btn-try-embedded-again');
    const browserUrlInput = document.getElementById('input-browser-redirect-url') as HTMLInputElement;
    const indicator = document.getElementById('clipboard-detect-indicator');
    const hint = document.getElementById('login-flow-hint');

    closeBrowserLoginBtn?.addEventListener('click', () => {
      browserLoginModal?.classList.add('hidden');
      indicator?.classList.add('hidden');
    });

    openBrowserAuthBtn?.addEventListener('click', async () => {
      try {
        if (hint) {
          hint.innerHTML = `<span style="color: #60a5fa; font-weight: 600;">Opening default browser... Complete login on Jagex and copy the redirect URL.</span>`;
        }
        await window.jagexApi.startBrowserLogin();
      } catch (e: any) {
        alert(`Failed to open browser: ${e.message}`);
      }
    });

    pasteClipboardBtn?.addEventListener('click', async () => {
      try {
        const text = await window.jagexApi.readClipboard();
        if (text && browserUrlInput) {
          browserUrlInput.value = text.trim();
          indicator?.classList.remove('hidden');
          if (hint) {
            hint.innerHTML = `<span style="color: #34d399; font-weight: 600;">✓ Pasted from clipboard! Click Complete Sign In.</span>`;
          }
        }
      } catch (e) {
        console.warn('Failed to read clipboard:', e);
      }
    });

    submitBrowserCodeBtn?.addEventListener('click', async () => {
      const codeOrUrl = browserUrlInput?.value.trim();
      if (!codeOrUrl) {
        alert('Please paste the redirect URL or authorization code from your browser.');
        return;
      }

      submitBrowserCodeBtn.textContent = 'Signing in...';
      try {
        await window.jagexApi.completeBrowserLogin(codeOrUrl);
        this.currentSessions = await window.jagexApi.getSessions();
        this.updateAccountUI();
        browserLoginModal?.classList.add('hidden');
        if (browserUrlInput) browserUrlInput.value = '';
        indicator?.classList.add('hidden');
      } catch (e: any) {
        alert(`Login failed: ${e.message}`);
      } finally {
        submitBrowserCodeBtn.textContent = 'Complete Sign In';
      }
    });

    tryEmbeddedAgainBtn?.addEventListener('click', () => {
      browserLoginModal?.classList.add('hidden');
      this.triggerEmbeddedLogin();
    });

    // Check clipboard on window focus while login modal is visible
    window.addEventListener('focus', () => {
      if (browserLoginModal && !browserLoginModal.classList.contains('hidden')) {
        this.checkClipboardForCode();
      }
    });

    // Periodic clipboard inspection while login modal is open
    setInterval(() => {
      if (browserLoginModal && !browserLoginModal.classList.contains('hidden')) {
        this.checkClipboardForCode();
      }
    }, 1000);

    // Top bar login triggers
    const loginBtn = document.getElementById('btn-login');
    loginBtn?.addEventListener('click', async () => {
      await this.triggerLogin();
    });

    const browserLoginHelpBtn = document.getElementById('btn-browser-login-help');
    browserLoginHelpBtn?.addEventListener('click', () => {
      const modal = document.getElementById('modal-browser-login');
      modal?.classList.remove('hidden');
      this.checkClipboardForCode();
    });

    // Account modal
    const accountModal = document.getElementById('modal-account');
    const accountPill = document.getElementById('account-logged-in');
    const closeAccountBtn = document.getElementById('btn-close-account');
    const signOutBtn = document.getElementById('btn-sign-out');
    const switchAccountBtn = document.getElementById('btn-switch-account');

    accountPill?.addEventListener('click', () => {
      accountModal?.classList.remove('hidden');
    });

    closeAccountBtn?.addEventListener('click', () => {
      accountModal?.classList.add('hidden');
    });

    signOutBtn?.addEventListener('click', async () => {
      await window.jagexApi.logout();
      this.currentSessions = await window.jagexApi.getSessions();
      this.selectedCharacterId = null;
      this.updateAccountUI();
      accountModal?.classList.add('hidden');
    });

    switchAccountBtn?.addEventListener('click', async () => {
      accountModal?.classList.add('hidden');
      await this.triggerLogin();
    });

    // Software updates button in General Settings tab
    const checkUpdatesNowBtn = document.getElementById('btn-check-updates-now');
    const updateStatusMsg = document.getElementById('setting-update-status-msg');

    checkUpdatesNowBtn?.addEventListener('click', async () => {
      if (!window.jagexApi?.checkForUpdates) return;
      if (updateStatusMsg) {
        updateStatusMsg.style.display = 'block';
        updateStatusMsg.textContent = 'Checking GitHub releases for updates...';
        updateStatusMsg.style.color = '#94a3b8';
      }
      try {
        const res = await window.jagexApi.checkForUpdates();
        if (res.updateAvailable) {
          if (updateStatusMsg) {
            updateStatusMsg.textContent = `Update available: v${res.latestVersion}`;
            updateStatusMsg.style.color = '#34d399';
          }
          this.displayUpdateAvailable(res);
          this.openUpdateModal(res);
        } else if (res.error) {
          if (updateStatusMsg) {
            updateStatusMsg.textContent = `Check error: ${res.error}`;
            updateStatusMsg.style.color = '#f87171';
          }
        } else {
          if (updateStatusMsg) {
            updateStatusMsg.innerHTML = `You are running the latest version (v${res.currentVersion}). <a href="#" id="link-reinstall-latest" style="color: #60a5fa; text-decoration: underline; margin-left: 6px; cursor: pointer;">Open Updater / Reinstall</a>`;
            updateStatusMsg.style.color = '#34d399';
            document.getElementById('link-reinstall-latest')?.addEventListener('click', (e) => {
              e.preventDefault();
              this.openUpdateModal(res);
            });
          }
        }
      } catch (err: any) {
        if (updateStatusMsg) {
          updateStatusMsg.textContent = `Failed to check for updates: ${err.message}`;
          updateStatusMsg.style.color = '#f87171';
        }
      }
    });

    // Auto Updater modal wiring
    const updaterModal = document.getElementById('modal-updater');
    const closeUpdaterBtn = document.getElementById('btn-close-updater');
    const cancelUpdaterBtn = document.getElementById('btn-cancel-updater');
    const actionUpdaterBtn = document.getElementById('btn-action-updater') as HTMLButtonElement | null;
    const skipUpdateBtn = document.getElementById('btn-skip-update-version');
    const titlebarUpdateBanner = document.getElementById('titlebar-update-banner');

    titlebarUpdateBanner?.addEventListener('click', () => {
      this.openUpdateModal();
    });

    closeUpdaterBtn?.addEventListener('click', () => {
      updaterModal?.classList.add('hidden');
    });

    cancelUpdaterBtn?.addEventListener('click', () => {
      updaterModal?.classList.add('hidden');
    });

    skipUpdateBtn?.addEventListener('click', async () => {
      if (this.pendingUpdateResult?.latestVersion && window.jagexApi?.skipUpdateVersion) {
        await window.jagexApi.skipUpdateVersion(this.pendingUpdateResult.latestVersion);
      }
      titlebarUpdateBanner?.classList.add('hidden');
      updaterModal?.classList.add('hidden');
    });

    actionUpdaterBtn?.addEventListener('click', async () => {
      if (!this.pendingUpdateResult) return;
      const res = this.pendingUpdateResult;

      // If update is already installed, restart and launch
      if (this.isUpdateInstalled) {
        try {
          await window.jagexApi.applyUpdateAndRestart();
        } catch (e: any) {
          alert(`Failed to restart: ${e.message}`);
        }
        return;
      }

      const progressSection = document.getElementById('modal-updater-progress-section');
      const progressBar = document.getElementById('modal-updater-progress-bar');
      const progressStatus = document.getElementById('modal-updater-progress-status');
      const progressPercent = document.getElementById('modal-updater-progress-percent');
      const statusAlert = document.getElementById('modal-updater-status-alert');
      const distroNotice = document.getElementById('modal-updater-distro-notice');
      const distroText = document.getElementById('modal-updater-distro-text');

      statusAlert?.classList.add('hidden');
      distroNotice?.classList.add('hidden');

      // Step 1: Download phase (if not already downloaded)
      if (!this.isUpdateDownloaded || !this.downloadedUpdatePath) {
        progressSection?.classList.remove('hidden');
        actionUpdaterBtn.setAttribute('disabled', 'true');
        actionUpdaterBtn.textContent = 'Downloading...';

        const unsub = window.jagexApi.onUpdateProgress((p: any) => {
          if (progressBar) progressBar.style.width = `${p.progress}%`;
          if (progressStatus) progressStatus.textContent = p.message;
          if (progressPercent) progressPercent.textContent = `${p.progress}%`;
        });

        try {
          const dlRes = await window.jagexApi.downloadUpdate(res.releaseInfo, this.selectedUpdaterFormat);
          unsub();

          if (!dlRes.success || !dlRes.filePath) {
            actionUpdaterBtn.removeAttribute('disabled');
            actionUpdaterBtn.textContent = 'Retry Download';
            if (statusAlert) {
              statusAlert.style.background = 'rgba(239, 68, 68, 0.15)';
              statusAlert.style.border = '1px solid rgba(239, 68, 68, 0.3)';
              statusAlert.style.color = '#fca5a5';
              statusAlert.textContent = `❌ Download failed: ${dlRes.error || 'Unknown error'}`;
              statusAlert.classList.remove('hidden');
            }
            return;
          }

          this.isUpdateDownloaded = true;
          this.downloadedUpdatePath = dlRes.filePath;
          if (dlRes.format) this.selectedUpdaterFormat = dlRes.format as any;
        } catch (e: any) {
          unsub();
          actionUpdaterBtn.removeAttribute('disabled');
          actionUpdaterBtn.textContent = 'Retry Download';
          if (statusAlert) {
            statusAlert.style.background = 'rgba(239, 68, 68, 0.15)';
            statusAlert.style.border = '1px solid rgba(239, 68, 68, 0.3)';
            statusAlert.style.color = '#fca5a5';
            statusAlert.textContent = `❌ Download error: ${e.message}`;
            statusAlert.classList.remove('hidden');
          }
          return;
        }
      }

      // Step 2: Installation phase
      actionUpdaterBtn.setAttribute('disabled', 'true');
      actionUpdaterBtn.textContent = this.selectedUpdaterFormat === 'deb'
        ? 'Installing (Admin Prompt)...'
        : 'Installing AppImage...';

      if (progressStatus) {
        progressStatus.textContent = this.selectedUpdaterFormat === 'deb'
          ? 'Prompting for root authentication to install .deb...'
          : 'Configuring AppImage and updating desktop shortcuts...';
      }

      const unsubInstall = window.jagexApi.onUpdateProgress((p: any) => {
        if (progressBar) progressBar.style.width = `${p.progress}%`;
        if (progressStatus) progressStatus.textContent = p.message;
        if (progressPercent) progressPercent.textContent = `${p.progress}%`;
      });

      try {
        const installRes = await window.jagexApi.installUpdate(this.downloadedUpdatePath, this.selectedUpdaterFormat);
        unsubInstall();

        if (installRes.success) {
          this.isUpdateInstalled = true;
          actionUpdaterBtn.removeAttribute('disabled');
          actionUpdaterBtn.textContent = 'Restart & Launch Updated Version';
          actionUpdaterBtn.style.background = 'linear-gradient(135deg, #059669 0%, #10b981 100%)';
          actionUpdaterBtn.style.borderColor = '#34d399';

          if (statusAlert) {
            statusAlert.style.background = 'rgba(16, 185, 129, 0.15)';
            statusAlert.style.border = '1px solid rgba(52, 211, 153, 0.3)';
            statusAlert.style.color = '#34d399';
            statusAlert.innerHTML = `
              <div style="font-weight: 700; margin-bottom: 2px;">🎉 ${installRes.message || 'Installation Successful!'}</div>
              <div style="color: #94a3b8;">${this.selectedUpdaterFormat === 'deb' ? 'Package installed to /usr/bin/jagex-launcher.' : 'AppImage configured and desktop entries updated.'} Click below to restart.</div>
            `;
            statusAlert.classList.remove('hidden');
          }
          if (progressStatus) progressStatus.textContent = 'Ready to launch!';
        } else if (installRes.cancelled) {
          actionUpdaterBtn.removeAttribute('disabled');
          actionUpdaterBtn.textContent = 'Try Install Again';
          if (distroNotice && distroText) {
            distroNotice.classList.remove('hidden');
            distroText.innerHTML = `
              <div style="font-weight: 600; color: #facc15; margin-bottom: 4px;">⚠️ System authentication was cancelled</div>
              <div style="margin-bottom: 8px; color: #cbd5e1;">You can install the downloaded package manually in your terminal:</div>
              <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.4); padding: 6px 10px; border-radius: 4px; font-family: monospace; font-size: 11px;">
                <span id="text-copy-deb-cmd">${installRes.manualCommand || `sudo apt install "${this.downloadedUpdatePath}"`}</span>
                <button type="button" id="btn-copy-install-cmd" class="btn-secondary" style="padding: 2px 8px; font-size: 10px; margin-left: 8px;">Copy</button>
              </div>
            `;
            document.getElementById('btn-copy-install-cmd')?.addEventListener('click', () => {
              const cmd = installRes.manualCommand || `sudo apt install "${this.downloadedUpdatePath}"`;
              navigator.clipboard.writeText(cmd);
              const btn = document.getElementById('btn-copy-install-cmd');
              if (btn) btn.textContent = 'Copied!';
            });
          }
        } else {
          actionUpdaterBtn.removeAttribute('disabled');
          actionUpdaterBtn.textContent = 'Retry Install';
          if (statusAlert) {
            statusAlert.style.background = 'rgba(239, 68, 68, 0.15)';
            statusAlert.style.border = '1px solid rgba(239, 68, 68, 0.3)';
            statusAlert.style.color = '#fca5a5';
            statusAlert.textContent = `❌ ${installRes.error || 'Installation failed.'}`;
            statusAlert.classList.remove('hidden');
          }
        }
      } catch (e: any) {
        unsubInstall();
        actionUpdaterBtn.removeAttribute('disabled');
        actionUpdaterBtn.textContent = 'Retry Install';
        if (statusAlert) {
          statusAlert.style.background = 'rgba(239, 68, 68, 0.15)';
          statusAlert.style.border = '1px solid rgba(239, 68, 68, 0.3)';
          statusAlert.style.color = '#fca5a5';
          statusAlert.textContent = `❌ Error during installation: ${e.message}`;
          statusAlert.classList.remove('hidden');
        }
      }
    });

    // Steam Deck & Handheld: Add to Steam button
    const addToSteamBtn = document.getElementById('btn-add-to-steam');
    const deckStatusMsg = document.getElementById('setting-deck-status-msg');

    addToSteamBtn?.addEventListener('click', async () => {
      if (!window.jagexApi?.addToSteam) return;
      if (deckStatusMsg) {
        deckStatusMsg.style.display = 'block';
        deckStatusMsg.textContent = 'Registering Non-Steam shortcut and grid artwork...';
        deckStatusMsg.style.color = '#94a3b8';
      }
      try {
        const res = await window.jagexApi.addToSteam();
        if (deckStatusMsg) {
          deckStatusMsg.textContent = res.success
            ? `${res.message} (Restart Steam or switch to Gaming Mode for changes to appear in your Library).`
            : res.message;
          deckStatusMsg.style.color = res.success ? '#34d399' : '#f87171';
        }
      } catch (err: any) {
        if (deckStatusMsg) {
          deckStatusMsg.textContent = `Error adding to Steam: ${err.message}`;
          deckStatusMsg.style.color = '#f87171';
        }
      }
    });

    // Desktop & System Integration: Re-register shortcuts & dock icons
    const reRegisterShortcutsBtn = document.getElementById('btn-re-register-shortcuts');
    const shortcutsStatusMsg = document.getElementById('setting-shortcuts-status-msg');

    reRegisterShortcutsBtn?.addEventListener('click', async () => {
      if (!window.jagexApi?.repairDesktopShortcuts) return;
      if (shortcutsStatusMsg) {
        shortcutsStatusMsg.style.display = 'block';
        shortcutsStatusMsg.textContent = 'Updating desktop entries, MIME types, and hicolor icon caches...';
        shortcutsStatusMsg.style.color = '#94a3b8';
      }
      try {
        await window.jagexApi.repairDesktopShortcuts();
        if (shortcutsStatusMsg) {
          shortcutsStatusMsg.textContent = '✓ Desktop shortcuts and dock icon caches successfully updated!';
          shortcutsStatusMsg.style.color = '#34d399';
          setTimeout(() => {
            if (shortcutsStatusMsg) shortcutsStatusMsg.style.display = 'none';
          }, 6000);
        }
      } catch (err: any) {
        if (shortcutsStatusMsg) {
          shortcutsStatusMsg.textContent = `Error updating shortcuts: ${err?.message || err}`;
          shortcutsStatusMsg.style.color = '#f87171';
        }
      }
    });

    // Quick Folders Hub: Open Folders
    document.querySelectorAll('.btn-quick-folder[data-folder]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const folderKey = btn.getAttribute('data-folder');
        if (!folderKey || !window.jagexApi?.openFolder) return;
        try {
          await window.jagexApi.openFolder(folderKey);
        } catch (err) {
          console.error('[Folders] Failed to open folder:', err);
        }
      });
    });

    const openLauncherConfigBtn = document.getElementById('btn-open-launcher-config');
    openLauncherConfigBtn?.addEventListener('click', async () => {
      if (window.jagexApi?.openFolder) {
        await window.jagexApi.openFolder('launcher-config');
      }
    });

    // Close modals on overlay backdrop click (excluding progress overlay)
    document.querySelectorAll('.modal-overlay').forEach((modal) => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          if (modal.id === 'overlay-progress') return;
          modal.classList.add('hidden');
        }
      });
    });

    // Close open menus and modals on Escape key press
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const clientMenu = document.getElementById('client-list-menu');
        if (clientMenu && !clientMenu.classList.contains('hidden')) {
          clientMenu.classList.add('hidden');
          return;
        }
        const charMenu = document.getElementById('character-list-menu');
        if (charMenu && !charMenu.classList.contains('hidden')) {
          charMenu.classList.add('hidden');
          return;
        }
        const openModal = Array.from(document.querySelectorAll('.modal-overlay:not(.hidden)'))
          .filter(m => m.id !== 'overlay-progress')
          .pop();
        if (openModal) {
          openModal.classList.add('hidden');
        }
      }
    });
  }

  private setupWorldPing() {
    const pingModal = document.getElementById('modal-world-ping');
    const openPingBtn = document.getElementById('btn-world-ping');
    const closePingBtn = document.getElementById('btn-close-world-ping');
    const donePingBtn = document.getElementById('btn-done-world-ping');
    const tabRs3Btn = document.getElementById('tab-btn-ping-rs3');
    const tabOsrsBtn = document.getElementById('tab-btn-ping-osrs');
    const runPingBtn = document.getElementById('btn-run-world-ping');
    const filterBtns = document.querySelectorAll('#ping-filter-group .btn-filter-region');

    // Settings tab buttons
    const settingsPingRs3Btn = document.getElementById('btn-settings-ping-rs3');
    const settingsPingOsrsBtn = document.getElementById('btn-settings-ping-osrs');

    const switchPingGameTab = (game: 'rs3' | 'osrs') => {
      this.currentPingGame = game;
      if (game === 'rs3') {
        tabRs3Btn?.classList.add('active');
        tabOsrsBtn?.classList.remove('active');
      } else {
        tabRs3Btn?.classList.remove('active');
        tabOsrsBtn?.classList.add('active');
      }
      this.renderWorldPingList();
    };

    tabRs3Btn?.addEventListener('click', () => switchPingGameTab('rs3'));
    tabOsrsBtn?.addEventListener('click', () => switchPingGameTab('osrs'));

    openPingBtn?.addEventListener('click', () => {
      if (this.activeGame === 'dragonwilds') return;
      const targetGame = this.activeGame === 'osrs' ? 'osrs' : 'rs3';
      switchPingGameTab(targetGame);
      pingModal?.classList.remove('hidden');
      if (this.currentPingResults.length === 0) {
        this.executeWorldPing(targetGame);
      }
    });

    closePingBtn?.addEventListener('click', () => {
      pingModal?.classList.add('hidden');
    });

    donePingBtn?.addEventListener('click', () => {
      pingModal?.classList.add('hidden');
    });

    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentPingFilter = (btn.getAttribute('data-region') as any) || 'all';
        this.renderWorldPingList();
      });
    });

    runPingBtn?.addEventListener('click', () => {
      this.executeWorldPing(this.currentPingGame);
    });

    // Settings tab triggers
    settingsPingRs3Btn?.addEventListener('click', async () => {
      settingsPingRs3Btn.setAttribute('disabled', 'true');
      settingsPingRs3Btn.innerHTML = '<span>Pinging RS3...</span>';
      try {
        const results = await window.jagexApi.pingRs3Worlds();
        this.renderSettingsPingResults('settings-rs3-ping-results', results);
      } catch (err: any) {
        const container = document.getElementById('settings-rs3-ping-results');
        if (container) container.innerHTML = `<span style="color: #f87171; font-size: 11px;">Ping error: ${err.message}</span>`;
      } finally {
        settingsPingRs3Btn.removeAttribute('disabled');
        settingsPingRs3Btn.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
          <span>Test RS3 Worlds</span>
        `;
      }
    });

    settingsPingOsrsBtn?.addEventListener('click', async () => {
      settingsPingOsrsBtn.setAttribute('disabled', 'true');
      settingsPingOsrsBtn.innerHTML = '<span>Pinging OSRS...</span>';
      try {
        const results = await window.jagexApi.pingOsrsWorlds();
        this.renderSettingsPingResults('settings-osrs-ping-results', results);
      } catch (err: any) {
        const container = document.getElementById('settings-osrs-ping-results');
        if (container) container.innerHTML = `<span style="color: #f87171; font-size: 11px;">Ping error: ${err.message}</span>`;
      } finally {
        settingsPingOsrsBtn.removeAttribute('disabled');
        settingsPingOsrsBtn.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
          <span>Test OSRS Worlds</span>
        `;
      }
    });
  }

  private async executeWorldPing(game: 'rs3' | 'osrs') {
    const runBtn = document.getElementById('btn-run-world-ping');
    const runBtnText = document.getElementById('btn-run-world-ping-text');
    const statusText = document.getElementById('ping-status-indicator');
    const progressBar = document.getElementById('ping-progress-bar-container');
    const listEl = document.getElementById('world-ping-results-list');

    if (runBtn) runBtn.setAttribute('disabled', 'true');
    if (runBtnText) runBtnText.textContent = 'Pinging Worlds...';
    if (statusText) statusText.textContent = `Probing ${game === 'rs3' ? 'RuneScape 3' : 'Old School'} servers in parallel...`;
    if (progressBar) progressBar.classList.remove('hidden');

    try {
      const results = game === 'rs3'
        ? await window.jagexApi.pingRs3Worlds()
        : await window.jagexApi.pingOsrsWorlds();

      this.currentPingResults = results;
      this.renderWorldPingList();

      if (results.length > 0) {
        const best = results[0];
        if (statusText) statusText.textContent = `Completed: ${results.length} reachable worlds. Best: World ${best.world} (${best.ping}ms)`;
        const headerLabel = document.getElementById('label-world-ping-text');
        const headerBtn = document.getElementById('btn-world-ping');
        if (headerLabel) headerLabel.textContent = `Best: ${best.ping}ms`;
        if (headerBtn) headerBtn.classList.add('ping-optimal');
      } else {
        if (statusText) statusText.textContent = 'No world responses received. Check your internet connection.';
      }
    } catch (err: any) {
      if (statusText) statusText.textContent = `Ping failed: ${err.message}`;
      if (listEl) listEl.innerHTML = `<div style="text-align: center; color: #f87171; padding: 20px; font-size: 12px;">Failed to ping servers: ${err.message}</div>`;
    } finally {
      if (runBtn) runBtn.removeAttribute('disabled');
      if (runBtnText) runBtnText.textContent = '⚡ Ping All Worlds';
      if (progressBar) progressBar.classList.add('hidden');
    }
  }

  private renderWorldPingList() {
    const listEl = document.getElementById('world-ping-results-list');
    if (!listEl) return;

    const filtered = this.currentPingResults.filter(r => {
      if (r.game !== this.currentPingGame) return false;
      if (this.currentPingFilter === 'all') return true;
      const reg = (r.region || '').toLowerCase();
      if (this.currentPingFilter === 'us') return reg.includes('us');
      if (this.currentPingFilter === 'uk') return reg.includes('united kingdom') || reg.includes('germany') || reg.includes('eu');
      if (this.currentPingFilter === 'aus') return reg.includes('australia');
      return true;
    });

    if (filtered.length === 0) {
      listEl.innerHTML = `
        <div style="text-align: center; padding: 30px 10px; color: #94a3b8; font-size: 12px;">
          ${this.currentPingResults.length === 0 ? 'Click "⚡ Ping All Worlds" to test live latency across all game servers.' : 'No worlds match the selected region filter.'}
        </div>
      `;
      return;
    }

    listEl.innerHTML = '';
    filtered.forEach((r, idx) => {
      const card = document.createElement('div');
      card.className = 'world-ping-card';

      let pingBadgeClass = 'ping-badge-optimal';
      if (r.ping > 150) pingBadgeClass = 'ping-badge-high';
      else if (r.ping > 90) pingBadgeClass = 'ping-badge-moderate';
      else if (r.ping > 50) pingBadgeClass = 'ping-badge-good';

      card.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 11px; font-weight: 700; color: #64748b; width: 22px;">#${idx + 1}</span>
          <div style="font-size: 15px;">${r.flag || '🌐'}</div>
          <div>
            <div style="font-weight: 600; font-size: 13px; color: #f1f5f9; display: flex; align-items: center; gap: 6px;">
              <span>World ${r.world}</span>
              ${r.serverSubId ? `<span style="font-size: 10px; color: #64748b;">(Server ${r.serverSubId})</span>` : ''}
              ${idx === 0 ? '<span class="badge-member" style="font-size: 8px; padding: 1px 5px; background: #059669; color: #fff;">LOWEST PING</span>' : ''}
            </div>
            <div style="font-size: 10px; color: #94a3b8; margin-top: 1px;">${r.region} • <span style="font-family: monospace;">${r.hostname}</span></div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="${pingBadgeClass}">${r.ping.toFixed(1)} ms</span>
        </div>
      `;

      listEl.appendChild(card);
    });
  }

  private renderSettingsPingResults(containerId: string, results: any[]) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!results || results.length === 0) {
      container.innerHTML = '<span style="font-size: 11px; color: #f87171;">No reachable servers found.</span>';
      return;
    }

    const top = results.slice(0, 6);
    container.innerHTML = '';
    top.forEach((r, idx) => {
      let pingBadgeClass = 'ping-badge-optimal';
      if (r.ping > 150) pingBadgeClass = 'ping-badge-high';
      else if (r.ping > 90) pingBadgeClass = 'ping-badge-moderate';
      else if (r.ping > 50) pingBadgeClass = 'ping-badge-good';

      const pill = document.createElement('div');
      pill.style.cssText = `
        display: flex;
        align-items: center;
        gap: 6px;
        background: rgba(15, 23, 42, 0.7);
        border: 1px solid ${idx === 0 ? 'rgba(52, 211, 153, 0.4)' : 'rgba(255, 255, 255, 0.08)'};
        border-radius: 6px;
        padding: 5px 10px;
        font-size: 11px;
      `;
      pill.innerHTML = `
        <span>${r.flag || '🌐'}</span>
        <strong style="color: #f1f5f9;">W${r.world}</strong>
        <span class="${pingBadgeClass}" style="font-size: 10px; padding: 1px 5px;">${r.ping.toFixed(1)}ms</span>
      `;
      container.appendChild(pill);
    });
  }

  private setupResourcesModal() {
    const resModal = document.getElementById('modal-resources');
    const openResBtn = document.getElementById('btn-open-resources');
    const closeResBtn = document.getElementById('btn-close-resources');
    const doneResBtn = document.getElementById('btn-done-resources');
    const tabBtns = document.querySelectorAll('.res-tab-btn');
    const searchInput = document.getElementById('res-search-input') as HTMLInputElement | null;

    const switchResourceTab = (game: 'rs3' | 'osrs' | 'dragonwilds') => {
      this.currentResourceGame = game;
      tabBtns.forEach(b => {
        if (b.getAttribute('data-res-game') === game) {
          b.classList.add('active');
        } else {
          b.classList.remove('active');
        }
      });
      this.renderResourceCards();
    };

    openResBtn?.addEventListener('click', () => {
      this.currentResourceGame = this.activeGame;
      if (searchInput) {
        searchInput.value = '';
        this.resourceSearchQuery = '';
      }
      switchResourceTab(this.currentResourceGame);
      resModal?.classList.remove('hidden');
    });

    closeResBtn?.addEventListener('click', () => {
      resModal?.classList.add('hidden');
    });

    doneResBtn?.addEventListener('click', () => {
      resModal?.classList.add('hidden');
    });

    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const game = (btn.getAttribute('data-res-game') as 'rs3' | 'osrs' | 'dragonwilds') || 'rs3';
        switchResourceTab(game);
      });
    });

    searchInput?.addEventListener('input', () => {
      this.resourceSearchQuery = searchInput.value.trim().toLowerCase();
      this.renderResourceCards();
    });
  }

  private renderResourceCards() {
    const grid = document.getElementById('res-card-grid');
    if (!grid) return;

    const query = this.resourceSearchQuery.toLowerCase();
    const items = COMMUNITY_RESOURCES.filter(r => {
      if (r.game !== this.currentResourceGame) return false;
      if (!query) return true;
      return (
        r.title.toLowerCase().includes(query) ||
        r.category.toLowerCase().includes(query) ||
        r.description.toLowerCase().includes(query)
      );
    });

    if (items.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px 10px; color: #94a3b8; font-size: 13px;">
          ${this.resourceSearchQuery ? `No resources found matching "${this.resourceSearchQuery}".` : 'No resources available for this game.'}
        </div>
      `;
      return;
    }

    grid.innerHTML = '';
    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'resource-card';
      card.setAttribute('data-url', item.url);
      card.title = `Open ${item.title} in default browser`;

      card.innerHTML = `
        <div>
          <div class="resource-card-top">
            <div class="resource-card-header">
              <span class="resource-icon">${item.icon}</span>
              <span class="resource-title">${item.title}</span>
            </div>
            <span class="resource-badge">${item.category}</span>
          </div>
          <p class="resource-desc">${item.description}</p>
        </div>
        <div class="resource-footer">
          <span style="font-family: monospace; color: #64748b; font-size: 9px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 190px;">
            ${item.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
          </span>
          <span class="resource-link-label">
            <span>Open</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
          </span>
        </div>
      `;

      card.addEventListener('click', (e) => {
        e.preventDefault();
        if (window.jagexApi) {
          window.jagexApi.openExternal(item.url);
        } else {
          window.open(item.url, '_blank');
        }
      });

      grid.appendChild(card);
    });
  }
}

// Instantiate and initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new JagexLauncherApp();
  app.init();
});
