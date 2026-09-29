import { contextBridge, ipcRenderer } from 'electron';

export const api = {
  // Window controls
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  openExternal: (url: string) => ipcRenderer.invoke('utils:openExternal', url),
  readClipboard: () => ipcRenderer.invoke('utils:readClipboard'),

  // Auth
  login: () => ipcRenderer.invoke('auth:login'),
  startBrowserLogin: () => ipcRenderer.invoke('auth:startBrowserLogin'),
  completeBrowserLogin: (codeOrUrl: string) => ipcRenderer.invoke('auth:completeBrowserLogin', codeOrUrl),
  logout: (sub?: string) => ipcRenderer.invoke('auth:logout', sub),
  refreshAccount: (sub: string) => ipcRenderer.invoke('auth:refresh', sub),
  switchAccount: (sub: string) => ipcRenderer.invoke('auth:switchAccount', sub),
  getSessions: () => ipcRenderer.invoke('auth:getSessions'),
  getActiveAccount: () => ipcRenderer.invoke('auth:getActiveAccount'),
  syncCharacters: (sub?: string) => ipcRenderer.invoke('auth:syncCharacters', sub),

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings: any) => ipcRenderer.invoke('settings:save', settings),

  // Installer & Game Client
  checkClientStatus: () => ipcRenderer.invoke('installer:checkStatus'),
  installClient: () => ipcRenderer.invoke('installer:install'),
  onInstallProgress: (callback: (data: any) => void) => {
    const sub = (_: any, val: any) => callback(val);
    ipcRenderer.on('install-progress', sub);
    return () => ipcRenderer.removeListener('install-progress', sub);
  },

  // Launcher
  launchGame: (options?: any) => ipcRenderer.invoke('launcher:launch', options),
  isGameRunning: () => ipcRenderer.invoke('launcher:isRunning'),
  onGameStateChanged: (callback: (data: any) => void) => {
    const sub = (_: any, val: any) => callback(val);
    ipcRenderer.on('game-state-changed', sub);
    return () => ipcRenderer.removeListener('game-state-changed', sub);
  },

  // OSRS Client
  checkOsrsStatus: (clientType?: string) => ipcRenderer.invoke('osrs:checkStatus', clientType),
  installOsrsClient: (clientType?: string) => ipcRenderer.invoke('osrs:install', clientType),
  getJavaInfo: () => ipcRenderer.invoke('osrs:getJavaInfo'),

  // Diagnostics & Compatibility
  runRs3Doctor: () => ipcRenderer.invoke('diagnostics:runRs3Doctor'),
  installRs3CompatLibs: () => ipcRenderer.invoke('diagnostics:installRs3CompatLibs'),
  clearRs3Cache: () => ipcRenderer.invoke('diagnostics:clearRs3Cache'),

  // PSA & News proxy (to avoid CORS in renderer)
  fetchPsa: (game: string) => ipcRenderer.invoke('feed:getPsa', game),
  fetchNews: (game?: string) => ipcRenderer.invoke('feed:getNews', game),

  // Auto Updater
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  downloadUpdate: (releaseInfo: any) => ipcRenderer.invoke('updater:download', releaseInfo),
  applyUpdateAndRestart: () => ipcRenderer.invoke('updater:applyAndRestart'),
  getUpdaterFormatInfo: () => ipcRenderer.invoke('updater:getFormatInfo'),
  skipUpdateVersion: (version: string) => ipcRenderer.invoke('updater:skipVersion', version),
  onUpdateAvailable: (callback: (data: any) => void) => {
    const sub = (_: any, val: any) => callback(val);
    ipcRenderer.on('updater:update-available', sub);
    return () => ipcRenderer.removeListener('updater:update-available', sub);
  },
  onUpdateProgress: (callback: (data: any) => void) => {
    const sub = (_: any, val: any) => callback(val);
    ipcRenderer.on('updater:progress', sub);
    return () => ipcRenderer.removeListener('updater:progress', sub);
  },

  // Steam Deck & SteamOS
  getDeckInfo: () => ipcRenderer.invoke('deck:getInfo'),
  addToSteam: () => ipcRenderer.invoke('steam:addToSteam'),
};

contextBridge.exposeInMainWorld('jagexApi', api);
