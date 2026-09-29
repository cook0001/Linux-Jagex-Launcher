import { GamepadNavigator } from './gamepad.ts';

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
      checkForUpdates: () => Promise<{
        updateAvailable: boolean;
        currentVersion: string;
        latestVersion: string;
        packageFormat: string;
        releaseInfo?: any;
        error?: string;
      }>;
      downloadUpdate: (releaseInfo: any) => Promise<{ success: boolean; filePath?: string; error?: string }>;
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
  private deckInfo: any = null;
  private gamepadNav: GamepadNavigator | null = null;

  public async init() {
    this.setupWindowControls();
    this.setupNavigation();
    this.setupClientSelector();
    this.setupModals();
    this.setupCharacterDropdown();
    this.setupPlayButton();
    this.setupGamepad();
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

    rs3Btn?.classList.remove('active');
    osrsBtn?.classList.remove('active');
    dragonwildsBtn?.classList.remove('active');

    if (game === 'rs3') {
      rs3Btn?.classList.add('active');
      clientSelector?.classList.add('hidden');
      characterSelector?.classList.remove('hidden');
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
      if (stageTitle) stageTitle.textContent = 'RuneScape: Dragonwilds';
      if (stageSubtitle) stageSubtitle.textContent = 'Open-World Survival Action RPG';
      if (viewAllLink) {
        viewAllLink.textContent = 'View All On Steam Store →';
        viewAllLink.href = 'https://store.steampowered.com/app/1374490/RuneScape_Dragonwilds/';
      }
    }

    this.updatePlaySubtext();
    await this.checkGameClientStatus();
    this.fetchPsaAndBanner();
    this.fetchNewsFeed();
  }

  private async loadInitialData() {
    try {
      if (window.jagexApi) {
        this.currentSettings = await window.jagexApi.getSettings();
        this.currentSessions = await window.jagexApi.getSessions();
      } else {
        this.currentSettings = { selectedGame: 'rs3', selectedOsrsClient: 'runelite' };
        this.currentSessions = { accounts: {}, activeSub: null };
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
    const formatDesc = document.getElementById('modal-updater-format-desc');
    const notesBox = document.getElementById('modal-updater-notes');
    const actionBtn = document.getElementById('btn-action-updater');
    const distroNotice = document.getElementById('modal-updater-distro-notice');
    const distroText = document.getElementById('modal-updater-distro-text');
    const progressSection = document.getElementById('modal-updater-progress-section');

    if (versionTag) versionTag.textContent = `v${res.currentVersion} → v${res.latestVersion}`;
    if (formatDesc) formatDesc.textContent = `Package Format: ${res.packageFormat.toUpperCase()}`;
    if (notesBox) notesBox.innerHTML = this.formatReleaseNotesForHumans(res.releaseInfo?.releaseNotes, res.latestVersion);

    if (progressSection) progressSection.classList.add('hidden');

    if (res.packageFormat === 'appimage') {
      if (actionBtn) actionBtn.textContent = this.isUpdateDownloaded ? 'Restart & Install' : 'Download & Install';
      if (distroNotice) distroNotice.classList.add('hidden');
    } else if (res.packageFormat === 'deb') {
      if (actionBtn) actionBtn.textContent = 'Download .deb Package';
      if (distroNotice) distroNotice.classList.add('hidden');
    } else if (res.packageFormat === 'flatpak') {
      if (actionBtn) actionBtn.textContent = 'View on GitHub';
      if (distroNotice && distroText) {
        distroNotice.classList.remove('hidden');
        distroText.innerHTML = 'Flatpak packages update via your software center or <code>flatpak update</code>.';
      }
    } else if (res.packageFormat === 'aur') {
      if (actionBtn) actionBtn.textContent = 'View on GitHub';
      if (distroNotice && distroText) {
        distroNotice.classList.remove('hidden');
        distroText.innerHTML = 'Arch Linux packages update via AUR. Run <code>yay -Syu</code> or <code>paru -Syu</code>.';
      }
    } else {
      if (actionBtn) actionBtn.textContent = 'View on GitHub';
      if (distroNotice) distroNotice.classList.add('hidden');
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
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const targetId = btn.getAttribute('data-tab');
        document.querySelectorAll('.settings-tab-content').forEach(tc => {
          if (tc.id === targetId) {
            tc.classList.remove('hidden');
          } else {
            tc.classList.add('hidden');
          }
        });
      });
    });

    const openSettings = () => {
      const s = this.currentSettings;

      // General settings
      const closeOnLaunchInput = document.getElementById('setting-close-on-launch') as HTMLInputElement;
      const minimizeInput = document.getElementById('setting-minimize-to-tray') as HTMLInputElement;
      const gameModeInput = document.getElementById('setting-use-gamemode') as HTMLInputElement;
      const mangoHudInput = document.getElementById('setting-use-mangohud') as HTMLInputElement;

      if (closeOnLaunchInput) closeOnLaunchInput.checked = s.closeOnLaunch ?? false;
      if (minimizeInput) minimizeInput.checked = s.minimizeToTray ?? false;
      if (gameModeInput) gameModeInput.checked = s.useGameMode ?? false;
      if (mangoHudInput) mangoHudInput.checked = s.useMangoHud ?? false;

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
      const rs3GpuWorkaroundSelect = document.getElementById('setting-rs3-gpu-workaround') as HTMLSelectElement;

      if (configUriInput) configUriInput.value = s.configUri || 'https://rs.config.runescape.com/k=5/l=0/jav_config.ws';
      if (customCmdInput) customCmdInput.value = s.customLaunchCommand || '';
      if (rs3ForceX11Input) rs3ForceX11Input.checked = s.rs3ForceX11 !== false;
      if (rs3AudioLatencyInput) rs3AudioLatencyInput.checked = s.rs3AudioLatencyFix !== false;
      if (rs3MesaGlThreadInput) rs3MesaGlThreadInput.checked = s.rs3MesaGlThread !== false;
      if (rs3GpuWorkaroundSelect) rs3GpuWorkaroundSelect.value = s.rs3GpuWorkaround || 'none';

      settingsModal?.classList.remove('hidden');
    };

    openSettingsBtn?.addEventListener('click', openSettings);
    quickSettingsBtn?.addEventListener('click', openSettings);
    const cancelSettingsBtn = document.getElementById('btn-cancel-settings');
    closeSettingsBtn?.addEventListener('click', () => settingsModal?.classList.add('hidden'));
    cancelSettingsBtn?.addEventListener('click', () => settingsModal?.classList.add('hidden'));

    saveSettingsBtn?.addEventListener('click', async () => {
      const closeOnLaunchInput = document.getElementById('setting-close-on-launch') as HTMLInputElement;
      const minimizeInput = document.getElementById('setting-minimize-to-tray') as HTMLInputElement;
      const gameModeInput = document.getElementById('setting-use-gamemode') as HTMLInputElement;
      const mangoHudInput = document.getElementById('setting-use-mangohud') as HTMLInputElement;
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
      const rs3GpuWorkaroundSelect = document.getElementById('setting-rs3-gpu-workaround') as HTMLSelectElement;

      const newSettings = {
        closeOnLaunch: closeOnLaunchInput?.checked ?? false,
        minimizeToTray: minimizeInput?.checked ?? false,
        useGameMode: gameModeInput?.checked ?? false,
        useMangoHud: mangoHudInput?.checked ?? false,
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
        rs3GpuWorkaround: rs3GpuWorkaroundSelect?.value || 'none'
      };

      this.currentSettings = await window.jagexApi.saveSettings(newSettings);
      this.selectedOsrsClient = this.currentSettings.selectedOsrsClient;
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

    // Pre-flight Doctor Runner
    const runDoctorBtn = document.getElementById('btn-run-doctor');
    const doctorItemsList = document.getElementById('doctor-items-list');
    const doctorStatusText = document.getElementById('doctor-status-text');
    const doctorBadge = document.getElementById('doctor-badge');
    const doctorAptSuggestion = document.getElementById('doctor-apt-suggestion');
    const doctorAptCode = document.getElementById('doctor-apt-code');

    const executeDoctor = async () => {
      if (!window.jagexApi?.runRs3Doctor) return;
      if (doctorStatusText) doctorStatusText.textContent = 'Running diagnostics...';
      try {
        const report = await window.jagexApi.runRs3Doctor();
        if (doctorStatusText) {
          doctorStatusText.textContent = `${report.osName} (${report.arch}) - Display: ${report.displayServer.toUpperCase()}`;
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

        if (doctorItemsList) {
          doctorItemsList.innerHTML = report.checks.map((c: any) => {
            const icon = c.status === 'ok' ? '✓' : (c.status === 'warning' ? '⚠' : '✗');
            const color = c.status === 'ok' ? '#34d399' : (c.status === 'warning' ? '#fde047' : '#f87171');
            return `
              <div style="display: flex; gap: 8px; align-items: flex-start; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.04);">
                <span style="font-weight: 700; color: ${color}; width: 14px; text-align: center;">${icon}</span>
                <div style="flex: 1;">
                  <div style="font-weight: 600; color: #e2e8f0;">${c.name}</div>
                  <div style="color: #94a3b8; font-size: 10.5px; margin-top: 1px;">${c.message}</div>
                  ${c.remediation ? `<div style="color: #60a5fa; font-size: 10.5px; margin-top: 2px;">💡 <em>${c.remediation}</em></div>` : ''}
                </div>
              </div>
            `;
          }).join('');
        }

        if (doctorAptSuggestion && doctorAptCode) {
          if (report.suggestedAptCommand) {
            doctorAptSuggestion.classList.remove('hidden');
            doctorAptCode.textContent = report.suggestedAptCommand;
          } else {
            doctorAptSuggestion.classList.add('hidden');
          }
        }
      } catch (err: any) {
        if (doctorStatusText) doctorStatusText.textContent = `Diagnostics error: ${err.message}`;
      }
    };

    runDoctorBtn?.addEventListener('click', executeDoctor);

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
            updateStatusMsg.textContent = `You are running the latest version (v${res.currentVersion}).`;
            updateStatusMsg.style.color = '#34d399';
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
    const actionUpdaterBtn = document.getElementById('btn-action-updater');
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
      const format = res.packageFormat;

      if (format === 'appimage') {
        if (this.isUpdateDownloaded) {
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

        progressSection?.classList.remove('hidden');
        actionUpdaterBtn.setAttribute('disabled', 'true');
        actionUpdaterBtn.textContent = 'Downloading...';

        const unsub = window.jagexApi.onUpdateProgress((p: any) => {
          if (progressBar) progressBar.style.width = `${p.progress}%`;
          if (progressStatus) progressStatus.textContent = p.message;
          if (progressPercent) progressPercent.textContent = `${p.progress}%`;
        });

        try {
          const dlRes = await window.jagexApi.downloadUpdate(res.releaseInfo);
          unsub();
          if (dlRes.success) {
            this.isUpdateDownloaded = true;
            actionUpdaterBtn.removeAttribute('disabled');
            actionUpdaterBtn.textContent = 'Restart & Install';
            if (progressStatus) progressStatus.textContent = 'Update verified & ready to install!';
          } else {
            actionUpdaterBtn.removeAttribute('disabled');
            actionUpdaterBtn.textContent = 'Retry Download';
            alert(`Download failed: ${dlRes.error}`);
          }
        } catch (e: any) {
          unsub();
          actionUpdaterBtn.removeAttribute('disabled');
          actionUpdaterBtn.textContent = 'Retry Download';
          alert(`Download error: ${e.message}`);
        }
      } else if (format === 'deb') {
        actionUpdaterBtn.setAttribute('disabled', 'true');
        actionUpdaterBtn.textContent = 'Downloading...';
        try {
          const dlRes = await window.jagexApi.downloadUpdate(res.releaseInfo);
          actionUpdaterBtn.removeAttribute('disabled');
          if (dlRes.success) {
            actionUpdaterBtn.textContent = 'Downloaded (.deb)';
            const distroNotice = document.getElementById('modal-updater-distro-notice');
            const distroText = document.getElementById('modal-updater-distro-text');
            if (distroNotice && distroText) {
              distroNotice.classList.remove('hidden');
              distroText.innerHTML = `Saved to <strong>${dlRes.filePath}</strong>.<br>Install via: <code>sudo apt install ${dlRes.filePath}</code>`;
            }
          } else {
            actionUpdaterBtn.textContent = 'Retry Download';
            alert(`Download failed: ${dlRes.error}`);
          }
        } catch (e: any) {
          actionUpdaterBtn.removeAttribute('disabled');
          actionUpdaterBtn.textContent = 'Retry Download';
          alert(`Download error: ${e.message}`);
        }
      } else {
        const url = res.releaseInfo?.htmlUrl || 'https://github.com/cook0001/Linux-Jagex-Launcher/releases';
        if (window.jagexApi) {
          window.jagexApi.openExternal(url);
        } else {
          window.open(url, '_blank');
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
}

// Instantiate and initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new JagexLauncherApp();
  app.init();
});
