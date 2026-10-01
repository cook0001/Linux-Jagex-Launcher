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
  onAuthCompleted: (callback: () => void) => {
    const sub = () => callback();
    ipcRenderer.on('auth:completed', sub);
    return () => ipcRenderer.removeListener('auth:completed', sub);
  },

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
  isGameRunning: (game?: string) => ipcRenderer.invoke('launcher:isRunning', game),
  killGame: (game?: string) => ipcRenderer.invoke('launcher:killGame', game),
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
  getLastCrash: () => ipcRenderer.invoke('diagnostics:getLastCrash'),
  clearLastCrash: () => ipcRenderer.invoke('diagnostics:clearLastCrash'),
  killZombieProcesses: () => ipcRenderer.invoke('diagnostics:killZombies'),
  generateDoctorReportMarkdown: (report?: any) => ipcRenderer.invoke('diagnostics:generateMarkdown', report),
  saveDoctorReportToFile: (content: string) => ipcRenderer.invoke('diagnostics:saveReportToFile', content),
  launchGameInSafeMode: (options?: any) => ipcRenderer.invoke('launcher:launchSafeMode', options),

  // OSRS Diagnostics
  runOsrsDoctor: () => ipcRenderer.invoke('diagnostics:runOsrsDoctor'),
  getOsrsLastCrash: () => ipcRenderer.invoke('diagnostics:getOsrsLastCrash'),
  clearOsrsLastCrash: () => ipcRenderer.invoke('diagnostics:clearOsrsLastCrash'),
  repairOsrsPermissions: (targetDir: string) => ipcRenderer.invoke('diagnostics:repairOsrsPermissions', targetDir),
  generateOsrsDoctorMarkdown: (report?: any) => ipcRenderer.invoke('diagnostics:generateOsrsDoctorMarkdown', report),
  saveOsrsDoctorReportToFile: (content: string) => ipcRenderer.invoke('diagnostics:saveOsrsDoctorReportToFile', content),
  killOsrsZombieProcesses: () => ipcRenderer.invoke('diagnostics:killOsrsZombies'),

  // PSA & News proxy (to avoid CORS in renderer)
  fetchPsa: (game: string) => ipcRenderer.invoke('feed:getPsa', game),
  fetchNews: (game?: string) => ipcRenderer.invoke('feed:getNews', game),

  // Auto Updater
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  downloadUpdate: (releaseInfo: any, targetFormat?: string) => ipcRenderer.invoke('updater:download', releaseInfo, targetFormat),
  installUpdate: (filePath?: string, format?: string) => ipcRenderer.invoke('updater:install', filePath, format),
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

  // World Latency & Ping
  pingRs3Worlds: (worldIds?: number[]) => ipcRenderer.invoke('ping:rs3-worlds', worldIds),
  pingOsrsWorlds: (subIds?: number[]) => ipcRenderer.invoke('ping:osrs-worlds', subIds),

  // Desktop shortcuts & icons
  repairDesktopShortcuts: () => ipcRenderer.invoke('desktop:repairShortcuts'),

  // Quick Folders Hub
  openFolder: (folderIdOrPath: string) => ipcRenderer.invoke('utils:openFolder', folderIdOrPath),
  getQuickFolders: () => ipcRenderer.invoke('utils:getQuickFolders'),

  // Multi-GPU / Dedicated GPU
  getGpuInfo: () => ipcRenderer.invoke('gpu:getInfo'),

  // Live Client Logger
  getLogEntries: (limit?: number) => ipcRenderer.invoke('logger:getEntries', limit),
  clearLogs: () => ipcRenderer.invoke('logger:clear'),
  exportLogs: () => ipcRenderer.invoke('logger:export'),
  onLogEntry: (callback: (data: any) => void) => {
    const sub = (_: any, val: any) => callback(val);
    ipcRenderer.on('logger:entry', sub);
    return () => ipcRenderer.removeListener('logger:entry', sub);
  },
  onLogsCleared: (callback: () => void) => {
    const sub = () => callback();
    ipcRenderer.on('logger:cleared', sub);
    return () => ipcRenderer.removeListener('logger:cleared', sub);
  },

  // Multi-Instance Client Manager
  getInstances: () => ipcRenderer.invoke('instances:list'),
  terminateInstance: (id: string) => ipcRenderer.invoke('instances:terminate', id),
  terminateAllInstances: (game?: string) => ipcRenderer.invoke('instances:terminateAll', game),
  onInstancesChanged: (callback: (instances: any[]) => void) => {
    const sub = (_: any, val: any) => callback(val);
    ipcRenderer.on('instances:changed', sub);
    return () => ipcRenderer.removeListener('instances:changed', sub);
  },
};

contextBridge.exposeInMainWorld('jagexApi', api);
