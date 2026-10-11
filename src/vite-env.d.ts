declare module "*.css" {
  const content: string;
  export default content;
}

declare module "*.svg" {
  const content: string;
  export default content;
}

declare module "*.png" {
  const content: string;
  export default content;
}

declare module "*.jpg" {
  const content: string;
  export default content;
}

// Electron preload API exposed via contextBridge.exposeInMainWorld('electronAPI', {...})
// All methods are optional since they only exist at runtime in the Electron context.
interface ElectronAPI {
  // ── Basic App Paths ──
  getAppPath?: () => Promise<string>
  getUserDataPath?: () => Promise<string>
  getResourcePath?: (relativePath: string) => Promise<string>

  setOnlineFixAuth?: (username: string, password: string) => Promise<{ success: boolean }>

  getAppVersion?: () => Promise<string>

  // ── Browsing / Installation ──
  browsePath?: (key: string) => Promise<string | null>
  addToSteam?: (appid: string) => Promise<{ success: boolean; message: string; repo?: string }>
  installGameWithLogs?: (appid: string) => Promise<{ success: boolean; message: string; installLog?: string[] }>
  installGameFromZip?: (appid: string) => Promise<{ success: boolean; message: string; manifestCount?: number; totalSize?: number }>
  downloadFix?: (appid: string, name?: string, gameUrl?: string) => Promise<{ success: boolean; message: string }>
  extractFix?: (filePath: string) => Promise<{ success: boolean; message: string; extractedDir?: string }>
  openFileLocation?: (filePath: string) => Promise<{ success: boolean }>

  // ── Quick Tools ──
  fixNoInternet?: () => Promise<{ success: boolean; message: string }>
  fixNoGames?: () => Promise<{ success: boolean; message: string }>
  copyManifest?: (appid: string) => Promise<{ success: boolean; message: string; manifests?: number }>
  clearCache?: () => Promise<{ success: boolean; message: string }>
  scanNewManifests?: () => Promise<{ success: boolean; newCount?: number; message?: string }>
  fixGamesNotShowing?: () => Promise<{ success: boolean; message: string; output?: string; error?: string }>
  onFixGamesProgress?: (callback: (data: { output?: string; done?: boolean; success?: boolean; error?: string }) => void) => () => void
  scanForNewGames?: () => Promise<{ success: boolean; newCount?: number; message?: string; added?: any[]; found?: number }>

  // ── Library ──
  getInstalledGames?: () => Promise<{ success: boolean; games: any[] }>
  removeInstalledGame?: (appid: string) => Promise<{ success: boolean; message: string }>
  saveInstalled?: (appids: string[]) => Promise<any>
  recordInstallVersion?: (appid: string, updatedDate: string | null) => Promise<{ success: boolean }>
  ryuuUpdateGame?: (appid: string) => Promise<{ success: boolean; message: string }>
  getInstallVersions?: () => Promise<Record<string, { installedAt: string; updatedDate: string | null }>>
  clearInstallVersion?: (appid: string) => Promise<{ success: boolean }>

  // ── Steam Path Operations ──
  restartSteam?: () => Promise<{ success: boolean; message: string }>
  openSteamFolder?: () => Promise<{ success: boolean; message: string }>

  // ── Update Checker ──
  checkForUpdates?: () => Promise<{
    success: boolean
    hasUpdate: boolean
    currentVersion: string
    latestVersion: string
    releaseNotes: string
    releaseUrl: string
    downloadUrl: string | null
    downloadSize: number
  }>
  downloadUpdate?: (downloadUrl: string, savePath: string) => Promise<{ success: boolean; message: string; path: string }>
  installUpdate?: () => Promise<{ success: boolean; message: string; filesCopied: number }>
  getDownloadPath?: () => Promise<string | null>
  getLastSeenVersion?: () => Promise<{ version: string; date: string } | null>
  setLastSeenVersion?: (version: string) => Promise<{ success: boolean }>

  // ── Favorites Persistence ──
  saveFavorites?: (favorites: string[]) => Promise<{ success: boolean }>
  loadFavorites?: () => Promise<string[]>

  // ── Recent Games Persistence ──
  saveRecent?: (recentGames: string[]) => Promise<{ success: boolean }>
  loadRecent?: () => Promise<string[]>
  getRecentlyAdded?: () => Promise<any[]>
  clearRecentlyAdded?: () => Promise<{ success: boolean; error?: string }>

  // ── License System ──
  checkLicense?: () => Promise<{ activated: boolean; machineId?: string; integrityFailed?: boolean; machineMismatch?: boolean }>
  activateLicense?: (licenseKey: string) => Promise<{ success: boolean; error?: string; message?: string }>
  deactivateLicense?: () => Promise<{ success: boolean; message?: string }>
  onLicenseStateChanged?: (callback: (data: { activated: boolean }) => void) => void
  getSupportLink?: () => Promise<string>

  // ── Event Listeners ──
  onDownloadProgress?: (callback: (data: { percent: number; bytes: number; total: number; speed?: number }) => void) => void
  onScanProgress?: (callback: (data: { current: number; total: number; appid?: string; status?: string }) => void) => void
  onFixProgress?: (callback: (data: any) => void) => () => void
  onInstallLog?: (callback: (data: { appid: string; message: string }) => void) => void
  // ── Image Fetching (Steam images as base64 data URLs) ──
  fetchImage?: (appid: string, localHeaderUrl?: string, preferredImageTypes?: string[]) => Promise<string | null>

  // ── Local Image Serving (Phase 2 — local-first) ──
  getLocalImage?: (appid: string, suffix?: string) => Promise<string | null>
  getLocalImageManifest?: () => Promise<Record<string, { header: boolean }> | null>

  // ── Runtime Properties ──
  platform: string
  isPackaged: boolean

  // ── Open External URL in Default Browser ──
  openExternal?: (url: string) => Promise<{ success: boolean }>

  // ── v0.8 Auto-Apply Fixes ──
  saveAutoFix?: (appid: string, fixData: any) => Promise<{ success: boolean }>
  loadAutoFix?: (appid: string) => Promise<any>
  getAllAutoFixes?: () => Promise<Record<string, any>>

  // ── v0.8 Game Tags ──
  saveGameTags?: (appid: string, tags: string[]) => Promise<{ success: boolean }>
  loadGameTags?: (appid: string) => Promise<string[]>
  getAllGameTags?: () => Promise<Record<string, string[]>>

  // ── v0.8 Offline Mode - Local Manifest Cache ──
  cacheManifestOffline?: (appid: string, manifestData: any) => Promise<{ success: boolean }>
  getOfflineManifest?: (appid: string) => Promise<any>
  getOfflineCacheList?: () => Promise<string[]>

  // ── v0.8 Mirror Health Check ──
  checkMirrorHealth?: () => Promise<{ healthy: boolean; mirrors: any[] }>

  // ── v0.8 OS Notifications ──
  sendNotification?: (opts: { title: string; body: string }) => Promise<{ success: boolean; message?: string }>

  // ── v0.8 Window Size Persistence ──
  saveWindowState?: (bounds: any) => Promise<{ success: boolean }>
  loadWindowState?: () => Promise<any>

  // ── v0.8 Scheduled Scans ──
  saveSchedule?: (scheduleData: any) => Promise<{ success: boolean }>
  loadSchedule?: () => Promise<any>

  // ── v0.8 Manifest Verification ──
  verifyManifest?: (appid: string) => Promise<{ valid: boolean; details: { manifestExists: boolean; depotExists: boolean } }>

  // ── v0.8 Secure Downloads ──
  secureDownload?: (url: string, expectedHash: string) => Promise<{ success: boolean; path?: string; error?: string }>

  // ── v0.8 Installation Stats ──
  recordInstall?: (appid: string, size: number) => Promise<{ success: boolean }>
  getInstallStats?: () => Promise<{ totalInstalls: number; totalSize: number }>

  // ── v0.8 Activity Heatmap ──
  getActivityData?: () => Promise<{ daily: any[]; weekly: any[]; monthly: any[] }>

  // ── v0.8 UI Settings (sidebar toggle etc.) ──
  saveUISettings?: (settings: any) => Promise<{ success: boolean }>
  loadUISettings?: () => Promise<any>

  // ── v0.8 Right-click Context Menu ──
  showContextMenu?: (items: { label: string; action: string; enabled?: boolean }[]) => Promise<void>
  onContextMenuAction?: (callback: (action: string, data?: any) => void) => void

  // ── v0.8 Custom Steam Path Config ──
  getCustomSteamConfig?: () => Promise<any>
  saveCustomSteamConfig?: (config: any) => Promise<any>

  // ── v0.8 User Stats Persistence ──
  saveUserStats?: (stats: any) => Promise<{ success: boolean }>
  getUserStats?: () => Promise<any>

  // ── v0.8 Achievements Persistence ──
  saveAchievements?: (achievements: any[]) => Promise<{ success: boolean }>
  getAchievements?: () => Promise<any[]>

  // ── v0.8 Pinned Games (Quick Launch) ──
  savePinnedGames?: (pinned: string[]) => Promise<{ success: boolean }>
  getPinnedGames?: () => Promise<string[]>

  // ── v0.8 Owned Games (Steam library sync) ──
  saveOwnedGames?: (owned: string[]) => Promise<{ success: boolean }>
  getOwnedGames?: () => Promise<string[]>
  detectOwnedGames?: () => Promise<number[]>
  onOwnedGamesUpdated?: (callback: (newGames: string[]) => void) => void

  // ── v0.8 Fix Health Data ──
  saveFixHealth?: (health: any) => Promise<{ success: boolean }>
  getFixHealth?: () => Promise<any>

  // ── v0.8 DLC Support ──
  getDlcRegistry?: () => Promise<{ success: boolean; registry: Record<string, string[]> }>
  fetchDLCs?: (appid: string, gameName: string) => Promise<{
    count: number
    dlcs: string[]
    dlcNames?: Record<string, string>
    dlcDetails?: Record<string, { name: string; header_image?: string }>
  } | null>
  registerDlcs?: (appid: string, dlcIds: string[], dlcDetails?: Record<string, { name: string; header_image?: string }>, sourceRepo?: string) => Promise<{ success: boolean; message: string; count: number }>

  // ── v0.8 Discord Integration ──
  discordLogin?: () => Promise<{ success: boolean; user?: any; isInGuild?: boolean; message?: string; diagnostics?: any }>
  checkDiscordAuth?: () => Promise<{ authenticated: boolean; user?: any; isInGuild?: boolean }>
  discordLogout?: () => Promise<{ success: boolean }>
  setGameSharing?: (enabled: boolean) => Promise<{ success: boolean }>
  getGameSharing?: () => Promise<{ enabled: boolean }>
  shareGameToDiscord?: (appid: string, gameName: string, coverUrl?: string, dlcCount?: number) => Promise<{ success: boolean; message?: string }>
  getDiscordStartupPref?: () => Promise<{ showOnStartup: boolean }>
  setDiscordStartupPref?: (pref: { showOnStartup: boolean }) => Promise<{ success: boolean; message?: string }>
  getSecretsDiag?: () => Promise<any>

  // ── v0.8 Restart App (after update) ──
  restartApp?: () => Promise<void>

  // ── v0.8 Steam Status ──
  getSteamStatus?: () => Promise<{ running: boolean; version: string }>

  // ── v0.9 Cover Fetcher ──
  fetchMissingCovers?: () => Promise<{ success: boolean; scanned?: number; fixed?: number; message?: string; error?: string }>
  onCoverFetchProgress?: (callback: (data: { progress: number; status: string }) => void) => void

  // ── v0.9 NEW FEATURES ──
  cancelDownload?: (appid?: string) => Promise<{ success: boolean; aborted: number }>
  checkFreeGames?: (appids: string[]) => Promise<string[]>

  // ── Window Controls (ipcRenderer.send — fire-and-forget) ──
  minimizeWindow?: () => void
  maximizeWindow?: () => void
  closeWindow?: () => void
  isMaximized?: () => Promise<boolean>
  onMaximizeChange?: (callback: (isMaximized: boolean) => void) => void

  // Allow dynamic access for forward-compatibility

  // -- Native Image Processing (C++ decode addon with sharp fallback) --
  nativeProcessImage?: (base64Data: string, mimeType?: string) => Promise<{ success: boolean; webpBase64?: string; lqip?: string; width?: number; height?: number; message?: string }>
  nativeGpuSupported?: () => Promise<{ success: boolean; supported?: boolean }>

  [key: string]: any
}

interface Window {
  electronAPI?: ElectronAPI
}
