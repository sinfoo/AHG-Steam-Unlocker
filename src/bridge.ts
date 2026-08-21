import { Game, Fix } from './types'

// ── SQLite Query Types ──
export interface QueryGamesOpts {
  page?: number
  limit?: number
  search?: string
  platform?: string
  type?: string
  sort?: 'name_asc' | 'name_desc' | 'added' | 'added_asc'
}

export interface QueryGamesResult {
  games: Game[]
  total: number
  page: number
  pageSize: number
}

export interface GameMeta {
  appid: string
  name: string
  header_image: string
}

export interface InitData {
  fixes: Fix[]
  customFixes: any[]
  favorites: string[]
  recent: any[]
  recentlyAdded: any[]
}

// LRU page cache (max 10 pages = ~500 games in memory)
const pageCache = new Map<string, { data: Game[]; expiry: number }>()
const PAGE_CACHE_TTL = 30_000 // 30s

function getPageCacheKey(opts: QueryGamesOpts): string {
  return `${opts.page || 1}:${opts.limit || 50}:${opts.search || ''}:${opts.platform || ''}:${opts.sort || ''}`
}

// ── Cached values ──
let _appPathCache: string | null = null
let _userDataPathCache: string | null = null

// ── Electron API accessor ──
function getAPI<T = any>(): T | undefined {
  return (window as any).electronAPI
}

// ── IPC timing wrapper (dev-mode only) ──
function withTiming<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now()
  return fn().finally(() => console.info(`[IPC] ${name} ${(performance.now() - start).toFixed(1)}ms`))
}

export const bridge = {
  // ═══════════════════════════════════════════════════════════════════════
  // SQLite Query Methods — server-side, paginated (Phase 1)
  // ═══════════════════════════════════════════════════════════════════════

  /** Paginated game query with search/sort/platform filter — uses SQLite */
  async queryGames(opts: QueryGamesOpts = {}): Promise<QueryGamesResult> {
    const cacheKey = getPageCacheKey(opts)
    const cached = pageCache.get(cacheKey)
    if (cached && Date.now() < cached.expiry) {
      return { games: cached.data, total: cached.data.length, page: opts.page || 1, pageSize: opts.limit || 50 }
    }

    const api = getAPI()
    if (api?.queryGames) {
      try {
        const result = await withTiming('queryGames', () => api.queryGames(opts)) as QueryGamesResult
        if (result.games?.length > 0) {
          pageCache.set(cacheKey, { data: result.games, expiry: Date.now() + PAGE_CACHE_TTL })
          // Evict old entries if cache exceeds 10 pages
          if (pageCache.size > 10) {
            const oldest = pageCache.entries().next().value
            if (oldest) pageCache.delete(oldest[0])
          }
        }
        return result
      } catch (e) {
        console.error('[BRIDGE] queryGames error:', e)
      }
    }
    return { games: [], total: 0, page: 1, pageSize: 50 }
  },

  /** Single game by appid */
  async getGame(appid: string): Promise<Game | null> {
    const api = getAPI()
    if (api?.getGame) {
      try {
        return await api.getGame(appid)
      } catch (e) {
        console.error('[BRIDGE] getGame error:', e)
      }
    }
    return null
  },

  /** Batch name/header lookup */
  async getGamesMeta(appids: string[]): Promise<GameMeta[]> {
    const api = getAPI()
    if (api?.getGamesMeta) {
      try {
        return await api.getGamesMeta(appids)
      } catch (e) {
        console.error('[BRIDGE] getGamesMeta error:', e)
      }
    }
    return []
  },

  /** Batch full game details (supports IpcBatcher coalescing; optional fields filtering) */
  async batchGetGameDetails(appids: string[], fields?: string[]): Promise<(Game | null)[]> {
    const api = getAPI()
    if (api?.batchGetGameDetails) {
      try {
        return await api.batchGetGameDetails(appids, fields)
      } catch (e) {
        console.error('[BRIDGE] batchGetGameDetails error:', e)
      }
    }
    // Fallback: call individually
    const results: (Game | null)[] = []
    for (const id of appids) {
      results.push(await this.getGame(id))
    }
    return results
  },

  /** Batch paginated queries (supports IpcBatcher coalescing) */
  async batchQueryGames(queryOptsList: QueryGamesOpts[]): Promise<QueryGamesResult[]> {
    const api = getAPI()
    if (api?.batchQueryGames) {
      try {
        return await api.batchQueryGames(queryOptsList)
      } catch (e) {
        console.error('[BRIDGE] batchQueryGames error:', e)
      }
    }
    // Fallback: call individually
    const results: QueryGamesResult[] = []
    for (const opts of queryOptsList) {
      results.push(await this.queryGames(opts))
    }
    return results
  },

  /** Range-based game query (for rapid scroll / virtual lists) */
  async queryGameRange(startIndex: number, count: number): Promise<Game[]> {
    const api = getAPI()
    if (api?.queryGameRange) {
      try {
        return await api.queryGameRange(startIndex, count)
      } catch (e) {
        console.error('[BRIDGE] queryGameRange error:', e)
      }
    }
    return []
  },

  /** Total game count */
  async getGameCount(): Promise<number> {
    const api = getAPI()
    if (api?.getGameCount) {
      try {
        return await api.getGameCount()
      } catch (e) {
        console.error('[BRIDGE] getGameCount error:', e)
      }
    }
    return 0
  },

  /** Get a local game cover image as base64 data URL, or null */
  async getLocalImage(appid: string, suffix?: string): Promise<string | null> {
    const api = getAPI()
    if (api?.getLocalImage) {
      try {
        return await api.getLocalImage(appid, suffix || 'header.jpg')
      } catch (e) {
        console.error('[BRIDGE] getLocalImage error:', e)
      }
    }
    return null
  },

  /** Get the local image manifest (appid → available suffixes) */
  async getLocalImageManifest(): Promise<Record<string, { header: boolean }> | null> {
    const api = getAPI()
    if (api?.getLocalImageManifest) {
      try {
        return await api.getLocalImageManifest()
      } catch (e) {
        console.error('[BRIDGE] getLocalImageManifest error:', e)
      }
    }
    return null
  },

  /** Check if a game exists */
  async gameExists(appid: string): Promise<boolean> {
    const api = getAPI()
    if (api?.gameExists) {
      try {
        return await api.gameExists(appid)
      } catch (e) {
        console.error('[BRIDGE] gameExists error:', e)
      }
    }
    return false
  },

  /** Single fix by appid */
  async getFix(appid: string): Promise<Fix | null> {
    const api = getAPI()
    if (api?.getFix) {
      try {
        return await api.getFix(appid)
      } catch (e) {
        console.error('[BRIDGE] getFix error:', e)
      }
    }
    return null
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Legacy Methods — now backed by SQLite pagination
  // ═══════════════════════════════════════════════════════════════════════

  /** Loads ALL games from SQLite — full 176K dataset */
  async loadGames(forceRefresh = false): Promise<Game[]> {
    console.info('[BRIDGE] loadGames called' + (forceRefresh ? ' (force refresh)' : ''))
    const api = getAPI()
    if (api?.loadGames) {
      try {
        const games = await withTiming('loadGames', () => api.loadGames())
        if (Array.isArray(games)) return games
      } catch (e) {
        console.error('[BRIDGE] loadGames IPC error:', e)
      }
    }
    // Fallback: paginated query (unlikely to reach here in Electron)
    const result = await this.queryGames({ page: 1, limit: 500000, sort: 'name_asc' })
    return result.games || []
  },

  async installGame(appid: string): Promise<{ success: boolean; message: string; manifests?: number; totalSize?: number; alreadyInstalled?: boolean }> {
    const api = getAPI()
    if (api && api.addToSteam) {
      return api.addToSteam(appid)
    }
    console.error('[BRIDGE] electronAPI.addToSteam not available')
    return { success: false, message: `Cannot install: bridge API not available. Run inside Electron.` }
  },

  async installGameFromZip(appid: string): Promise<{ success: boolean; message: string; manifestCount?: number; totalSize?: number }> {
    const api = getAPI()
    if (api && api.installGameFromZip) {
      return api.installGameFromZip(appid)
    }
    return { success: false, message: 'Not available in browser' }
  },

  async installGameRyuu(appid: string): Promise<{ success: boolean; manifestCount: number; totalSize: number; hasLua: boolean; message: string }> {
    const api = getAPI()
    if (api && api.installGameRyuu) {
      return api.installGameRyuu(appid)
    }
    // Fallback: use the existing installGame IPC
    return this.installGame(appid) as any
  },

  async ryuuUpdateGame(appid: string): Promise<{ success: boolean; message: string }> {
    const api = getAPI()
    if (api && api.ryuuUpdateGame) {
      try { return await api.ryuuUpdateGame(appid) } catch (e) { return { success: false, message: String(e) } }
    }
    return { success: false, message: 'Not available in browser' }
  },

  async installRyuuDlcs(baseAppid: string, dlcAppids: string[]): Promise<{ success: boolean; totalManifests: number; results: any[]; message: string }> {
    const api = getAPI()
    if (api && api.installRyuuDlcs) {
      return api.installRyuuDlcs(baseAppid, dlcAppids)
    }
    return { success: false, totalManifests: 0, results: [], message: 'Not available in browser' }
  },

  async getSteamStatus(): Promise<{ running: boolean; version: string }> {
    const api = getAPI()
    if (api && api.getSteamStatus) {
      return api.getSteamStatus()
    }
    return { running: false, version: '3.0' }
  },
  
  async checkLicense(): Promise<{ valid: boolean; activated?: boolean }> {
    const api = getAPI()
    if (api && api.checkLicense) {
      const result = await api.checkLicense()
      return { valid: result.activated === true, ...result }
    }
    return { valid: false }
  },

  // Quick Tools
  async fixNoInternet(): Promise<{ success: boolean; message: string }> {
    const api = getAPI()
    if (api && api.fixNoInternet) {
      return api.fixNoInternet()
    }
    return { success: false, message: 'Not available in browser' }
  },

  async fixNoGames(): Promise<{ success: boolean; message: string }> {
    const api = getAPI()
    if (api && api.fixNoGames) {
      return api.fixNoGames()
    }
    return { success: false, message: 'Not available in browser' }
  },

  async clearCache(): Promise<{ success: boolean; message: string }> {
    const api = getAPI()
    if (api && api.clearCache) {
      return api.clearCache()
    }
    return { success: false, message: 'Not available in browser' }
  },

  async restartSteam(): Promise<{ success: boolean; message: string }> {
    const api = getAPI()
    if (api && api.restartSteam) {
      return api.restartSteam()
    }
    return { success: false, message: 'Not available in browser' }
  },

  async openSteamFolder(): Promise<{ success: boolean; message: string }> {
    const api = getAPI()
    if (api && api.openSteamFolder) {
      return api.openSteamFolder()
    }
    return { success: false, message: 'Not available in browser' }
  },

  async getInstalledGames(): Promise<{ success: boolean; games: any[] }> {
    const api = getAPI()
    if (api && api.getInstalledGames) {
      return api.getInstalledGames()
    }
    return { success: false, games: [] }
  },

  async removeInstalledGame(appid: string): Promise<{ success: boolean; message: string }> {
    const api = getAPI()
    if (api && api.removeInstalledGame) {
      return api.removeInstalledGame(appid)
    }
    return { success: false, message: 'Not available in browser' }
  },

  async downloadFix(url: string, name?: string, gameUrl?: string): Promise<{ success: boolean; message: string }> {
    const api = getAPI()
    if (api && api.downloadFix) {
      return api.downloadFix(url, name, gameUrl)
    }
    return { success: false, message: 'Not available in browser' }
  },

  async extractFix(filePath: string): Promise<{ success: boolean; message: string; extractedDir?: string }> {
    const api = getAPI()
    if (api && api.extractFix) {
      return api.extractFix(filePath)
    }
    return { success: false, message: 'Not available in browser' }
  },

  async openFileLocation(filePath: string): Promise<{ success: boolean }> {
    const api = getAPI()
    if (api && api.openFileLocation) {
      return api.openFileLocation(filePath)
    }
    return { success: false }
  },

  async copyManifest(appid: string): Promise<{ success: boolean; message: string }> {
    const api = getAPI()
    if (api && api.copyManifest) {
      return api.copyManifest(appid)
    }
    return { success: false, message: 'Not available in browser' }
  },

  // Update checker
  async checkForUpdates(): Promise<{
    success: boolean;
    hasUpdate: boolean;
    currentVersion: string;
    latestVersion: string;
    releaseNotes: string;
    releaseUrl: string;
    downloadUrl: string | null;
    downloadSize: number;
  }> {
    const api = getAPI()
    if (api && api.checkForUpdates) {
      return api.checkForUpdates()
    }
    return { success: false, hasUpdate: false, currentVersion: '0.5', latestVersion: '', releaseNotes: '', releaseUrl: '', downloadUrl: null, downloadSize: 0 }
  },

  async downloadUpdate(downloadUrl: string, savePath: string): Promise<{ success: boolean; message: string; path: string }> {
    const api = getAPI()
    if (api && api.downloadUpdate) {
      return api.downloadUpdate(downloadUrl, savePath)
    }
    return { success: false, message: 'Not available in browser', path: '' }
  },

  async installUpdate(): Promise<{ success: boolean; message: string; filesCopied: number }> {
    const api = getAPI()
    if (api && api.installUpdate) {
      return api.installUpdate()
    }
    return { success: false, message: 'Not available in browser', filesCopied: 0 }
  },

  async registerDlcs(appid: string, dlcIds: string[], dlcDetails?: Record<string, { name: string; header_image?: string }>, sourceRepo?: string): Promise<{ success: boolean; message: string; count: number }> {
    const api = getAPI()
    if (api && api.registerDlcs) {
      return api.registerDlcs(appid, dlcIds, dlcDetails, sourceRepo)
    }
    return { success: false, message: 'Not available in browser', count: 0 }
  },

  async fetchDLCs(appid: string, gameName: string): Promise<{ count: number; dlcs: string[]; dlcNames?: Record<string, string>; dlcDetails?: Record<string, { name: string; header_image?: string }> } | null> {
    const api = getAPI()
    if (api && api.fetchDLCs) {
      return api.fetchDLCs(appid, gameName)
    }
    return null
  },

  async getDownloadPath(): Promise<string | null> {
    const api = getAPI()
    if (api && api.getDownloadPath) {
      return api.getDownloadPath()
    }
    return null
  },

  async getLastSeenVersion(): Promise<{ version: string; date: string } | null> {
    const api = getAPI()
    if (api && api.getLastSeenVersion) {
      return api.getLastSeenVersion()
    }
    return null
  },

  async setLastSeenVersion(version: string): Promise<{ success: boolean }> {
    const api = getAPI()
    if (api && api.setLastSeenVersion) {
      return api.setLastSeenVersion(version)
    }
    return { success: false }
  },

  async checkFreeGames(appids: string[]): Promise<string[]> {
    const api = getAPI()
    if (api && api.checkFreeGames) {
      try {
        return await api.checkFreeGames(appids)
      } catch {
        return []
      }
    }
    return []
  },

  async fetchSteamGenres(appids: string[]): Promise<Record<string, string[]>> {
    const api = getAPI()
    if (api && api.fetchSteamGenres) {
      try {
        return await api.fetchSteamGenres(appids)
      } catch {
        return {}
      }
    }
    return {}
  },

  // ── Discord Integration ──

  async discordLogin(): Promise<{ success: boolean; user?: any; isInGuild?: boolean; message?: string; diagnostics?: any }> {
    const api = getAPI()
    if (api && api.discordLogin) return api.discordLogin()
    return { success: false, message: 'Not available' }
  },

  async checkDiscordAuth(): Promise<{ authenticated: boolean; user?: any; isInGuild?: boolean }> {
    const api = getAPI()
    if (api && api.checkDiscordAuth) return api.checkDiscordAuth()
    return { authenticated: false }
  },

  async discordLogout(): Promise<{ success: boolean }> {
    const api = getAPI()
    if (api && api.discordLogout) return api.discordLogout()
    return { success: false }
  },

  async getSecretsDiag(): Promise<any> {
    const api = getAPI()
    if (api && api.getSecretsDiag) return api.getSecretsDiag()
    return { loaded: false, keysFound: 'none' }
  },

  async setDiscordConfig(config: { clientSecret?: string }): Promise<{ success: boolean; message?: string }> {
    const api = getAPI()
    if (api && api.setDiscordConfig) return api.setDiscordConfig(config)
    return { success: false, message: 'Not available' }
  },

  async setGameSharing(enabled: boolean): Promise<{ success: boolean }> {
    const api = getAPI()
    if (api && api.setGameSharing) return api.setGameSharing(enabled)
    return { success: false }
  },

  async getGameSharing(): Promise<{ enabled: boolean }> {
    const api = getAPI()
    if (api && api.getGameSharing) return api.getGameSharing()
    return { enabled: false }
  },

  async shareGameToDiscord(appid: string, gameName: string, coverUrl?: string, dlcCount?: number): Promise<{ success: boolean; message?: string }> {
    const api = getAPI()
    if (api && api.shareGameToDiscord) return api.shareGameToDiscord(appid, gameName, coverUrl, dlcCount)
    return { success: false, message: 'Not available' }
  },

  async getDiscordStartupPref(): Promise<{ showOnStartup: boolean }> {
    const api = getAPI()
    if (api && api.getDiscordStartupPref) return api.getDiscordStartupPref()
    return { showOnStartup: true }
  },

  async setDiscordStartupPref(pref: { showOnStartup: boolean }): Promise<{ success: boolean; message?: string }> {
    const api = getAPI()
    if (api && api.setDiscordStartupPref) return api.setDiscordStartupPref(pref)
    return { success: false, message: 'Not available' }
  },

  // ── Cancel download (optional appid — cancels all by default) ──
  async cancelDownload(appid?: string): Promise<{ success: boolean; aborted: number }> {
    const api = getAPI()
    if (api && api.cancelDownload) {
      return api.cancelDownload(appid)
    }
    return { success: false, aborted: 0 }
  },

  // ── Mirror health check ──
  async checkMirrorHealth(): Promise<{ healthy: boolean; mirrors: any[] }> {
    const api = getAPI()
    if (api && api.checkMirrorHealth) {
      return api.checkMirrorHealth()
    }
    return { healthy: false, mirrors: [] }
  },

  // ── NEW FEATURES v0.9 ──

  async launchGame(appid: string): Promise<{ success: boolean; message?: string }> {
    const api = getAPI()
    if (api && api.launchGame) return api.launchGame(appid)
    return { success: false, message: 'Not available' }
  },

  async checkConnectivity(): Promise<boolean> {
    const api = getAPI()
    if (api && api.checkConnectivity) {
      try { return await api.checkConnectivity() } catch { return false }
    }
    return false
  },

  async showMainWindow(): Promise<{ success: boolean }> {
    const api = getAPI()
    if (api && api.showMainWindow) return api.showMainWindow()
    return { success: false }
  },

  onFixProgress(callback: (data: any) => void): void {
    const api = getAPI()
    if (api && api.onFixProgress) api.onFixProgress(callback)
  },

  // ── Cover Fetcher ──
  async fetchMissingCovers(): Promise<{ success: boolean; scanned?: number; fixed?: number; message?: string; error?: string }> {
    const api = getAPI()
    if (api && api.fetchMissingCovers) return api.fetchMissingCovers()
    return { success: false, error: 'Not available' }
  },

  onCoverFetchProgress(callback: (data: any) => void): void {
    const api = getAPI()
    if (api && api.onCoverFetchProgress) api.onCoverFetchProgress(callback)
  },

  // ── Custom Fixes ──
  async getCustomFixes(): Promise<any[]> {
    const api = getAPI()
    if (api && api.getCustomFixes) {
      try { return await api.getCustomFixes() } catch (e) { console.error('[BRIDGE] getCustomFixes error:', e) }
    }
    return []
  },

  async checkNewCustomFixes(): Promise<{ newFixes: any[]; allFixes: any[]; error?: string }> {
    const api = getAPI()
    if (api && api.checkNewCustomFixes) {
      try { return await api.checkNewCustomFixes() } catch (e) { console.error('[BRIDGE] checkNewCustomFixes error:', e) }
    }
    return { newFixes: [], allFixes: [] }
  },

  onCustomFixesUpdated(callback: (data: any) => void): void {
    const api = getAPI()
    if (api && api.onCustomFixesUpdated) api.onCustomFixesUpdated(callback)
  },

  // ── Remote Sync ──
  async checkRemoteSync(): Promise<{ newGames: any[]; newFixes: any[]; errors: string[] }> {
    const api = getAPI()
    if (api && api.checkRemoteSync) {
      try { return await api.checkRemoteSync() } catch (e) { console.error('[BRIDGE] checkRemoteSync error:', e) }
    }
    return { newGames: [], newFixes: [], errors: ['Not available'] }
  },

  onRemoteSyncUpdated(callback: (data: any) => void): void {
    const api = getAPI()
    if (api && api.onRemoteSyncUpdated) api.onRemoteSyncUpdated(callback)
  },

  // ── API Config (Ryuu auth_code, SteamGridDB api_key) ──

  async getApiConfig(): Promise<{ ryuu: any; steamgriddb: any }> {
    const api = getAPI()
    if (api && api.getApiConfig) {
      try { return await api.getApiConfig() } catch (e) { console.error('[BRIDGE] getApiConfig error:', e) }
    }
    return { ryuu: {}, steamgriddb: {} }
  },

  async setApiConfig(config: { ryuu?: any; steamgriddb?: any }): Promise<{ success: boolean }> {
    const api = getAPI()
    if (api && api.setApiConfig) {
      try { return await api.setApiConfig(config) } catch (e) { console.error('[BRIDGE] setApiConfig error:', e) }
    }
    return { success: false }
  },

  // ═══════════════════════════════════════════════════════════════════════
  // App / Path Info
  // ═══════════════════════════════════════════════════════════════════════

  async getAppVersion(): Promise<string> {
    const api = getAPI()
    if (api && api.getAppVersion) {
      try { return await api.getAppVersion() } catch (e) { console.error('[BRIDGE] getAppVersion error:', e) }
    }
    return '0.0.0'
  },

  async getAppPath(): Promise<string> {
    if (_appPathCache !== null) return _appPathCache
    const api = getAPI()
    if (api && api.getAppPath) {
      try {
        const path = await api.getAppPath()
        _appPathCache = path
        return path
      } catch (e) { console.error('[BRIDGE] getAppPath error:', e) }
    }
    return ''
  },

  async getUserDataPath(): Promise<string> {
    if (_userDataPathCache !== null) return _userDataPathCache
    const api = getAPI()
    if (api && api.getUserDataPath) {
      try {
        const path = await api.getUserDataPath()
        _userDataPathCache = path
        return path
      } catch (e) { console.error('[BRIDGE] getUserDataPath error:', e) }
    }
    return ''
  },

  async getResourcePath(relativePath: string): Promise<string | null> {
    const api = getAPI()
    if (api && api.getResourcePath) {
      try { return await api.getResourcePath(relativePath) } catch (e) { console.error('[BRIDGE] getResourcePath error:', e) }
    }
    return null
  },

  get platform(): string {
    const api = getAPI() as any
    return api?.platform || 'win32'
  },

  get isPackaged(): boolean {
    const api = getAPI() as any
    return api?.isPackaged || false
  },

  async openExternal(url: string): Promise<void> {
    const api = getAPI()
    if (api && api.openExternal) {
      try { return await api.openExternal(url) } catch (e) { console.error('[BRIDGE] openExternal error:', e) }
    }
  },

  // ═══════════════════════════════════════════════════════════════════════
  // DB Operations — Bulk & Mutation
  // ═══════════════════════════════════════════════════════════════════════

  async getAllGameIds(): Promise<string[]> {
    const api = getAPI()
    if (api && api.getAllGameIds) {
      try { return await api.getAllGameIds() } catch (e) { console.error('[BRIDGE] getAllGameIds error:', e) }
    }
    return []
  },

  async upsertGame(game: any): Promise<{ success: boolean }> {
    const api = getAPI()
    if (api && api.upsertGame) {
      try { return await api.upsertGame(game) } catch (e) { console.error('[BRIDGE] upsertGame error:', e) }
    }
    return { success: false }
  },

  async updateGameCover(appid: string, image: string): Promise<{ success: boolean }> {
    const api = getAPI()
    if (api && api.updateGameCover) {
      try { return await api.updateGameCover(appid, image) } catch (e) { console.error('[BRIDGE] updateGameCover error:', e) }
    }
    return { success: false }
  },

  async upsertGames(games: any[]): Promise<{ success: boolean }> {
    const api = getAPI()
    if (api && api.upsertGames) {
      try { return await api.upsertGames(games) } catch (e) { console.error('[BRIDGE] upsertGames error:', e) }
    }
    return { success: false }
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Install / Browse / Paths
  // ═══════════════════════════════════════════════════════════════════════

  async browsePath(key: string): Promise<string | null> {
    const api = getAPI()
    if (api && api.browsePath) {
      try { return await api.browsePath(key) } catch (e) { console.error('[BRIDGE] browsePath error:', e) }
    }
    return null
  },

  async installGameWithLogs(appid: string): Promise<{ success: boolean; message: string }> {
    const api = getAPI()
    if (api && api.installGameWithLogs) {
      try { return await api.installGameWithLogs(appid) } catch (e) { console.error('[BRIDGE] installGameWithLogs error:', e) }
    }
    return { success: false, message: 'Not available' }
  },

  async saveInstalled(appids: string[]): Promise<{ success: boolean }> {
    const api = getAPI()
    if (api && api.saveInstalled) {
      try { return await api.saveInstalled(appids) } catch (e) { console.error('[BRIDGE] saveInstalled error:', e) }
    }
    return { success: false }
  },

  // ── Update detection ──
  async recordInstallVersion(appid: string, updatedDate?: string | null): Promise<{ success: boolean }> {
    const api = getAPI()
    if (api && api.recordInstallVersion) {
      try { return await api.recordInstallVersion(appid, updatedDate ?? null) } catch (e) { console.error('[BRIDGE] recordInstallVersion error:', e) }
    }
    return { success: false }
  },
  async getInstallVersions(): Promise<Record<string, { installedAt: string; updatedDate: string | null }>> {
    const api = getAPI()
    if (api && api.getInstallVersions) {
      try { return await api.getInstallVersions() } catch (e) { console.error('[BRIDGE] getInstallVersions error:', e) }
    }
    return {}
  },
  async clearInstallVersion(appid: string): Promise<{ success: boolean }> {
    const api = getAPI()
    if (api && api.clearInstallVersion) {
      try { return await api.clearInstallVersion(appid) } catch (e) { console.error('[BRIDGE] clearInstallVersion error:', e) }
    }
    return { success: false }
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Scanner / Maintenance Tools
  // ═══════════════════════════════════════════════════════════════════════

  async scanNewManifests(): Promise<{ success: boolean; message: string }> {
    const api = getAPI()
    if (api && api.scanNewManifests) {
      try { return await api.scanNewManifests() } catch (e) { console.error('[BRIDGE] scanNewManifests error:', e) }
    }
    return { success: false, message: 'Not available' }
  },

  async fixGamesNotShowing(): Promise<{ success: boolean; message: string }> {
    const api = getAPI()
    if (api && api.fixGamesNotShowing) {
      try { return await api.fixGamesNotShowing() } catch (e) { console.error('[BRIDGE] fixGamesNotShowing error:', e) }
    }
    return { success: false, message: 'Not available' }
  },

  onFixGamesProgress(callback: (data: { output?: string; done?: boolean; success?: boolean; error?: string }) => void): (() => void) | undefined {
    const api = getAPI()
    if (api && api.onFixGamesProgress) {
      return api.onFixGamesProgress(callback)
    }
    return undefined
  },

  async scanForNewGames(): Promise<{ success: boolean; message: string }> {
    const api = getAPI()
    if (api && api.scanForNewGames) {
      try { return await api.scanForNewGames() } catch (e) { console.error('[BRIDGE] scanForNewGames error:', e) }
    }
    return { success: false, message: 'Not available' }
  },

  // ═══════════════════════════════════════════════════════════════════════
  // License System
  // ═══════════════════════════════════════════════════════════════════════

  async activateLicense(licenseKey: string): Promise<{ success: boolean; message?: string }> {
    const api = getAPI()
    if (api && api.activateLicense) {
      try { return await api.activateLicense(licenseKey) } catch (e) { console.error('[BRIDGE] activateLicense error:', e) }
    }
    return { success: false, message: 'Not available' }
  },

  async deactivateLicense(): Promise<{ success: boolean; message?: string }> {
    const api = getAPI()
    if (api && api.deactivateLicense) {
      try { return await api.deactivateLicense() } catch (e) { console.error('[BRIDGE] deactivateLicense error:', e) }
    }
    return { success: false, message: 'Not available' }
  },

  onLicenseStateChanged(callback: (data: any) => void): void {
    const api = getAPI()
    if (api && api.onLicenseStateChanged) api.onLicenseStateChanged(callback)
  },

  async getSupportLink(): Promise<string | null> {
    const api = getAPI()
    if (api && api.getSupportLink) {
      try { return await api.getSupportLink() } catch (e) { console.error('[BRIDGE] getSupportLink error:', e) }
    }
    return null
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Favorites Persistence
  // ═══════════════════════════════════════════════════════════════════════

  async saveFavorites(favorites: any[]): Promise<{ success: boolean }> {
    const api = getAPI()
    if (api && api.saveFavorites) {
      try { return await api.saveFavorites(favorites) } catch (e) { console.error('[BRIDGE] saveFavorites error:', e) }
    }
    return { success: false }
  },

  async loadFavorites(): Promise<any[]> {
    const api = getAPI()
    if (api && api.loadFavorites) {
      try { return await withTiming('loadFavorites', () => api.loadFavorites()) } catch (e) { console.error('[BRIDGE] loadFavorites error:', e) }
    }
    return []
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Recent Games Persistence
  // ═══════════════════════════════════════════════════════════════════════

  async saveRecent(recent: any[]): Promise<{ success: boolean }> {
    const api = getAPI()
    if (api && api.saveRecent) {
      try { return await api.saveRecent(recent) } catch (e) { console.error('[BRIDGE] saveRecent error:', e) }
    }
    return { success: false }
  },

  async loadRecent(): Promise<any[]> {
    const api = getAPI()
    if (api && api.loadRecent) {
      try { return await withTiming('loadRecent', () => api.loadRecent()) } catch (e) { console.error('[BRIDGE] loadRecent error:', e) }
    }
    return []
  },

  async getRecentlyAdded(): Promise<any[]> {
    const api = getAPI()
    if (api && api.getRecentlyAdded) {
      try { return await api.getRecentlyAdded() } catch (e) { console.error('[BRIDGE] getRecentlyAdded error:', e) }
    }
    return []
  },

  async clearRecentlyAdded(): Promise<{ success: boolean }> {
    const api = getAPI()
    if (api && api.clearRecentlyAdded) {
      try { return await api.clearRecentlyAdded() } catch (e) { console.error('[BRIDGE] clearRecentlyAdded error:', e) }
    }
    return { success: false }
  },

  /** Batched init-data — replaces 5+ individual startup IPC calls */
  async getInitData(): Promise<InitData> {
    const api = getAPI()
    if (api && api.getInitData) {
      try { return await api.getInitData() } catch (e) { console.error('[BRIDGE] getInitData error:', e) }
    }
    return { fixes: [], customFixes: [], favorites: [], recent: [], recentlyAdded: [] }
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Auto-Apply Fixes
  // ═══════════════════════════════════════════════════════════════════════

  async saveAutoFix(appid: string, fixData: any): Promise<{ success: boolean }> {
    const api = getAPI()
    if (api && api.saveAutoFix) {
      try { return await api.saveAutoFix(appid, fixData) } catch (e) { console.error('[BRIDGE] saveAutoFix error:', e) }
    }
    return { success: false }
  },

  async getAllAutoFixes(): Promise<any[]> {
    const api = getAPI()
    if (api && api.getAllAutoFixes) {
      try { return await api.getAllAutoFixes() } catch (e) { console.error('[BRIDGE] getAllAutoFixes error:', e) }
    }
    return []
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Game Tags
  // ═══════════════════════════════════════════════════════════════════════

  async saveGameTags(appid: string, tags: string[]): Promise<{ success: boolean }> {
    const api = getAPI()
    if (api && api.saveGameTags) {
      try { return await api.saveGameTags(appid, tags) } catch (e) { console.error('[BRIDGE] saveGameTags error:', e) }
    }
    return { success: false }
  },

  async loadGameTags(appid: string): Promise<string[]> {
    const api = getAPI()
    if (api && api.loadGameTags) {
      try { return await api.loadGameTags(appid) } catch (e) { console.error('[BRIDGE] loadGameTags error:', e) }
    }
    return []
  },

  async getAllGameTags(): Promise<Record<string, string[]>> {
    const api = getAPI()
    if (api && api.getAllGameTags) {
      try { return await api.getAllGameTags() } catch (e) { console.error('[BRIDGE] getAllGameTags error:', e) }
    }
    return {}
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Offline Mode — Local Manifest Cache
  // ═══════════════════════════════════════════════════════════════════════

  async cacheManifestOffline(appid: string, manifestData: any): Promise<{ success: boolean }> {
    const api = getAPI()
    if (api && api.cacheManifestOffline) {
      try { return await api.cacheManifestOffline(appid, manifestData) } catch (e) { console.error('[BRIDGE] cacheManifestOffline error:', e) }
    }
    return { success: false }
  },

  async getOfflineManifest(appid: string): Promise<any | null> {
    const api = getAPI()
    if (api && api.getOfflineManifest) {
      try { return await api.getOfflineManifest(appid) } catch (e) { console.error('[BRIDGE] getOfflineManifest error:', e) }
    }
    return null
  },

  async getOfflineCacheList(): Promise<string[]> {
    const api = getAPI()
    if (api && api.getOfflineCacheList) {
      try { return await api.getOfflineCacheList() } catch (e) { console.error('[BRIDGE] getOfflineCacheList error:', e) }
    }
    return []
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Window State Persistence
  // ═══════════════════════════════════════════════════════════════════════

  async saveWindowState(bounds: any): Promise<{ success: boolean }> {
    const api = getAPI()
    if (api && api.saveWindowState) {
      try { return await api.saveWindowState(bounds) } catch (e) { console.error('[BRIDGE] saveWindowState error:', e) }
    }
    return { success: false }
  },

  async loadWindowState(): Promise<any | null> {
    const api = getAPI()
    if (api && api.loadWindowState) {
      try { return await api.loadWindowState() } catch (e) { console.error('[BRIDGE] loadWindowState error:', e) }
    }
    return null
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Scheduled Scans
  // ═══════════════════════════════════════════════════════════════════════

  async saveSchedule(scheduleData: any): Promise<{ success: boolean }> {
    const api = getAPI()
    if (api && api.saveSchedule) {
      try { return await api.saveSchedule(scheduleData) } catch (e) { console.error('[BRIDGE] saveSchedule error:', e) }
    }
    return { success: false }
  },

  async loadSchedule(): Promise<any | null> {
    const api = getAPI()
    if (api && api.loadSchedule) {
      try { return await api.loadSchedule() } catch (e) { console.error('[BRIDGE] loadSchedule error:', e) }
    }
    return null
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Manifest Verification & Secure Downloads
  // ═══════════════════════════════════════════════════════════════════════

  async verifyManifest(appid: string): Promise<{ success: boolean; message: string }> {
    const api = getAPI()
    if (api && api.verifyManifest) {
      try { return await api.verifyManifest(appid) } catch (e) { console.error('[BRIDGE] verifyManifest error:', e) }
    }
    return { success: false, message: 'Not available' }
  },

  async secureDownload(url: string, expectedHash: string): Promise<{ success: boolean; message: string; path?: string }> {
    const api = getAPI()
    if (api && api.secureDownload) {
      try { return await api.secureDownload(url, expectedHash) } catch (e) { console.error('[BRIDGE] secureDownload error:', e) }
    }
    return { success: false, message: 'Not available' }
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Installation Stats & Activity
  // ═══════════════════════════════════════════════════════════════════════

  async recordInstall(appid: string, size: number): Promise<{ success: boolean }> {
    const api = getAPI()
    if (api && api.recordInstall) {
      try { return await api.recordInstall(appid, size) } catch (e) { console.error('[BRIDGE] recordInstall error:', e) }
    }
    return { success: false }
  },

  async getInstallStats(): Promise<any> {
    const api = getAPI()
    if (api && api.getInstallStats) {
      try { return await api.getInstallStats() } catch (e) { console.error('[BRIDGE] getInstallStats error:', e) }
    }
    return null
  },

  async getActivityData(): Promise<any> {
    const api = getAPI()
    if (api && api.getActivityData) {
      try { return await api.getActivityData() } catch (e) { console.error('[BRIDGE] getActivityData error:', e) }
    }
    return null
  },

  // ═══════════════════════════════════════════════════════════════════════
  // UI Settings
  // ═══════════════════════════════════════════════════════════════════════

  async saveUISettings(settings: any): Promise<{ success: boolean }> {
    const api = getAPI()
    if (api && api.saveUISettings) {
      try { return await api.saveUISettings(settings) } catch (e) { console.error('[BRIDGE] saveUISettings error:', e) }
    }
    return { success: false }
  },

  async loadUISettings(): Promise<any> {
    const api = getAPI()
    if (api && api.loadUISettings) {
      try { return await api.loadUISettings() } catch (e) { console.error('[BRIDGE] loadUISettings error:', e) }
    }
    return null
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Context Menu
  // ═══════════════════════════════════════════════════════════════════════

  async showContextMenu(items: any[]): Promise<void> {
    const api = getAPI()
    if (api && api.showContextMenu) {
      try { return await api.showContextMenu(items) } catch (e) { console.error('[BRIDGE] showContextMenu error:', e) }
    }
  },

  onContextMenuAction(callback: (action: string, data: any) => void): void {
    const api = getAPI()
    if (api && api.onContextMenuAction) api.onContextMenuAction(callback)
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Custom Steam Config
  // ═══════════════════════════════════════════════════════════════════════

  async getCustomSteamConfig(): Promise<any | null> {
    const api = getAPI()
    if (api && api.getCustomSteamConfig) {
      try { return await api.getCustomSteamConfig() } catch (e) { console.error('[BRIDGE] getCustomSteamConfig error:', e) }
    }
    return null
  },

  async saveCustomSteamConfig(config: any): Promise<{ success: boolean }> {
    const api = getAPI()
    if (api && api.saveCustomSteamConfig) {
      try { return await api.saveCustomSteamConfig(config) } catch (e) { console.error('[BRIDGE] saveCustomSteamConfig error:', e) }
    }
    return { success: false }
  },

  // ═══════════════════════════════════════════════════════════════════════
  // User Data — Stats, Achievements, Collections, Pinned, Owned, FixHealth
  // ═══════════════════════════════════════════════════════════════════════

  async saveUserStats(stats: any): Promise<{ success: boolean }> {
    const api = getAPI()
    if (api && api.saveUserStats) {
      try { return await api.saveUserStats(stats) } catch (e) { console.error('[BRIDGE] saveUserStats error:', e) }
    }
    return { success: false }
  },

  async getUserStats(): Promise<any | null> {
    const api = getAPI()
    if (api && api.getUserStats) {
      try { return await api.getUserStats() } catch (e) { console.error('[BRIDGE] getUserStats error:', e) }
    }
    return null
  },

  async saveAchievements(achievements: any[]): Promise<{ success: boolean }> {
    const api = getAPI()
    if (api && api.saveAchievements) {
      try { return await api.saveAchievements(achievements) } catch (e) { console.error('[BRIDGE] saveAchievements error:', e) }
    }
    return { success: false }
  },

  async getAchievements(): Promise<any[]> {
    const api = getAPI()
    if (api && api.getAchievements) {
      try { return await api.getAchievements() } catch (e) { console.error('[BRIDGE] getAchievements error:', e) }
    }
    return []
  },

  async savePinnedGames(pinned: string[]): Promise<{ success: boolean }> {
    const api = getAPI()
    if (api && api.savePinnedGames) {
      try { return await api.savePinnedGames(pinned) } catch (e) { console.error('[BRIDGE] savePinnedGames error:', e) }
    }
    return { success: false }
  },

  async getPinnedGames(): Promise<string[]> {
    const api = getAPI()
    if (api && api.getPinnedGames) {
      try { return await api.getPinnedGames() } catch (e) { console.error('[BRIDGE] getPinnedGames error:', e) }
    }
    return []
  },

  async saveOwnedGames(owned: string[]): Promise<{ success: boolean }> {
    const api = getAPI()
    if (api && api.saveOwnedGames) {
      try { return await api.saveOwnedGames(owned) } catch (e) { console.error('[BRIDGE] saveOwnedGames error:', e) }
    }
    return { success: false }
  },

  async getOwnedGames(): Promise<any[]> {
    const api = getAPI()
    if (api && api.getOwnedGames) {
      try { return await api.getOwnedGames() } catch (e) { console.error('[BRIDGE] getOwnedGames error:', e) }
    }
    return []
  },

  async detectOwnedGames(): Promise<{ success: boolean; count?: number }> {
    const api = getAPI()
    if (api && api.detectOwnedGames) {
      try { return await api.detectOwnedGames() } catch (e) { console.error('[BRIDGE] detectOwnedGames error:', e) }
    }
    return { success: false }
  },

  onOwnedGamesUpdated(callback: (newGames: string[]) => void): void {
    const api = getAPI()
    if (api && api.onOwnedGamesUpdated) {
      try { api.onOwnedGamesUpdated(callback) } catch (e) { console.error('[BRIDGE] onOwnedGamesUpdated error:', e) }
    }
  },

  async saveFixHealth(health: any): Promise<{ success: boolean }> {
    const api = getAPI()
    if (api && api.saveFixHealth) {
      try { return await api.saveFixHealth(health) } catch (e) { console.error('[BRIDGE] saveFixHealth error:', e) }
    }
    return { success: false }
  },

  async getFixHealth(): Promise<any | null> {
    const api = getAPI()
    if (api && api.getFixHealth) {
      try { return await api.getFixHealth() } catch (e) { console.error('[BRIDGE] getFixHealth error:', e) }
    }
    return null
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Online Fix Auth
  // ═══════════════════════════════════════════════════════════════════════

  async setOnlineFixAuth(username: string, password: string): Promise<{ success: boolean; message?: string }> {
    const api = getAPI()
    if (api && api.setOnlineFixAuth) {
      try { return await api.setOnlineFixAuth(username, password) } catch (e) { console.error('[BRIDGE] setOnlineFixAuth error:', e) }
    }
    return { success: false, message: 'Not available' }
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Notifications, Restart & Refresh
  // ═══════════════════════════════════════════════════════════════════════

  async sendNotification(notification: { title: string; body: string }): Promise<void> {
    const api = getAPI()
    if (api && api.sendNotification) {
      try { return await api.sendNotification(notification) } catch (e) { console.error('[BRIDGE] sendNotification error:', e) }
    }
  },

  async restartApp(): Promise<void> {
    const api = getAPI()
    if (api && api.restartApp) {
      try { return await api.restartApp() } catch (e) { console.error('[BRIDGE] restartApp error:', e) }
    }
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Image Fetch (multi-CDN fallback)
  // ═══════════════════════════════════════════════════════════════════════

  async fetchImage(appid: string, localHeaderUrl?: string, preferredImageTypes?: string[]): Promise<string> {
    const api = getAPI()
    if (api && api.fetchImage) {
      try { return await api.fetchImage(appid, localHeaderUrl, preferredImageTypes) } catch (e) { console.error('[BRIDGE] fetchImage error:', e) }
    }
    throw new Error('fetchImage not available')
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Event Listeners — Install Log, Download Progress, Scan Progress
  // ═══════════════════════════════════════════════════════════════════════

  onInstallLog(callback: (data: any) => void): void {
    const api = getAPI()
    if (api && api.onInstallLog) api.onInstallLog(callback)
  },

  onDownloadProgress(callback: (data: any) => void): void {
    const api = getAPI()
    if (api && api.onDownloadProgress) api.onDownloadProgress(callback)
  },

  onScanProgress(callback: (data: any) => void): void {
    const api = getAPI()
    if (api && api.onScanProgress) api.onScanProgress(callback)
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Window Controls — Minimize, Maximize, Close
  // ═══════════════════════════════════════════════════════════════════════

  minimizeWindow(): void {
    const api = getAPI()
    if (api && api.minimizeWindow) api.minimizeWindow()
  },

  maximizeWindow(): void {
    const api = getAPI()
    if (api && api.maximizeWindow) api.maximizeWindow()
  },

  closeWindow(): void {
    const api = getAPI()
    if (api && api.closeWindow) api.closeWindow()
  },

  async isMaximized(): Promise<boolean> {
    const api = getAPI()
    if (api && api.isMaximized) {
      try { return await api.isMaximized() } catch (e) { console.error('[BRIDGE] isMaximized error:', e) }
    }
    return false
  },

  onMaximizeChange(callback: (isMaximized: boolean) => void): void {
    const api = getAPI()
    if (api && api.onMaximizeChange) api.onMaximizeChange(callback)
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Fullscreen Controls
  // ═══════════════════════════════════════════════════════════════════════

  async toggleFullscreen(): Promise<boolean> {
    const api = getAPI()
    if (api && api.toggleFullscreen) {
      try { return await api.toggleFullscreen() } catch (e) { console.error('[BRIDGE] toggleFullscreen error:', e) }
    }
    return false
  },

  async isFullscreen(): Promise<boolean> {
    const api = getAPI()
    if (api && api.isFullscreen) {
      try { return await api.isFullscreen() } catch (e) { console.error('[BRIDGE] isFullscreen error:', e) }
    }
    return false
  },

  onFullscreenChange(callback: (isFullscreen: boolean) => void): void {
    const api = getAPI()
    if (api && api.onFullscreenChange) api.onFullscreenChange(callback)
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Image Disk Cache
  // ═══════════════════════════════════════════════════════════════════════

  async imageCacheBatchGet(requests: Array<{appid: string, preferredImageTypes?: string[]}>): Promise<{success: boolean, entries?: Array<{cacheKey: string, dataUrl: string|null, mimeType: string|null, lqip: string|null}>, message?: string}> {
    const api = getAPI()
    if (api && api.imageCacheBatchGet) {
      try { return await api.imageCacheBatchGet(requests) } catch (e) { console.error('[BRIDGE] imageCacheBatchGet error:', e) }
    }
    return { success: false, message: 'API not available' }
  },

  async imageCacheHas(appid: string, preferredImageTypes?: string[]): Promise<{success: boolean, exists?: boolean, message?: string}> {
    const api = getAPI()
    if (api && api.imageCacheHas) {
      try { return await api.imageCacheHas(appid, preferredImageTypes) } catch (e) { console.error('[BRIDGE] imageCacheHas error:', e) }
    }
    return { success: false, message: 'API not available' }
  },

  async imageCacheSet(appid: string, preferredImageTypes: string[] | undefined, base64Data: string, mimeType: string, lqip?: string): Promise<{success: boolean, message?: string}> {
    const api = getAPI()
    if (api && api.imageCacheSet) {
      try { return await api.imageCacheSet(appid, preferredImageTypes, base64Data, mimeType, lqip) } catch (e) { console.error('[BRIDGE] imageCacheSet error:', e) }
    }
    return { success: false, message: 'API not available' }
  },

  async imageCacheClear(): Promise<{success: boolean, message?: string}> {
    const api = getAPI()
    if (api && api.imageCacheClear) {
      try { return await api.imageCacheClear() } catch (e) { console.error('[BRIDGE] imageCacheClear error:', e) }
    }
    return { success: false, message: 'API not available' }
  },

  async imageCacheStats(): Promise<{success: boolean, stats?: any, message?: string}> {
    const api = getAPI()
    if (api && api.imageCacheStats) {
      try { return await api.imageCacheStats() } catch (e) { console.error('[BRIDGE] imageCacheStats error:', e) }
    }
    return { success: false, message: 'API not available' }
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Image Preloader
  // ═══════════════════════════════════════════════════════════════════════

  async preloaderStart(priorityAppids: string[], options?: { fileTypes?: string[], batchSize?: number }): Promise<{success: boolean, processed?: number, failed?: number, skipped?: number, cancelled?: boolean, message?: string}> {
    const api = getAPI()
    if (api && api.preloaderStart) {
      try { return await api.preloaderStart(priorityAppids, options) } catch (e) { console.error('[BRIDGE] preloaderStart error:', e) }
    }
    return { success: false, message: 'API not available' }
  },

  async preloaderPause(): Promise<{success: boolean}> {
    const api = getAPI()
    if (api && api.preloaderPause) {
      try { return await api.preloaderPause() } catch (e) { console.error('[BRIDGE] preloaderPause error:', e) }
    }
    return { success: false }
  },

  async preloaderResume(): Promise<{success: boolean}> {
    const api = getAPI()
    if (api && api.preloaderResume) {
      try { return await api.preloaderResume() } catch (e) { console.error('[BRIDGE] preloaderResume error:', e) }
    }
    return { success: false }
  },

  async preloaderCancel(): Promise<{success: boolean}> {
    const api = getAPI()
    if (api && api.preloaderCancel) {
      try { return await api.preloaderCancel() } catch (e) { console.error('[BRIDGE] preloaderCancel error:', e) }
    }
    return { success: false }
  },

  async preloaderStatus(): Promise<{success: boolean, status?: {running: boolean, paused: boolean, idle: boolean, processed: number, failed: number, skipped: number, total: number, remaining: number, currentAppid: string}}> {
    const api = getAPI()
    if (api && api.preloaderStatus) {
      try { return await api.preloaderStatus() } catch (e) { console.error('[BRIDGE] preloaderStatus error:', e) }
    }
    return { success: false }
  },

  onPreloaderProgress(callback: (data: {processed: number, failed: number, skipped: number, total: number, percent: number, currentAppid: string, status: string}) => void): void {
    const api = getAPI()
    if (api && api.onPreloaderProgress) api.onPreloaderProgress(callback)
  },

  onPreloaderComplete(callback: (data: {processed: number, failed: number, skipped: number, total: number}) => void): void {
    const api = getAPI()
    if (api && api.onPreloaderComplete) api.onPreloaderComplete(callback)
  },

  onPreloaderPaused(callback: (data: {processed: number, total: number}) => void): void {
    const api = getAPI()
    if (api && api.onPreloaderPaused) api.onPreloaderPaused(callback)
  },

  onPreloaderResumed(callback: (data: {processed: number, total: number}) => void): void {
    const api = getAPI()
    if (api && api.onPreloaderResumed) api.onPreloaderResumed(callback)
  },

  onPreloaderCancelled(callback: (data: {processed: number, total: number}) => void): void {
    const api = getAPI()
    if (api && api.onPreloaderCancelled) api.onPreloaderCancelled(callback)
  },

  // -----------------------------------------------------------------------
  // Native Image Processing (C++ decode addon with sharp fallback)
  // -----------------------------------------------------------------------

  async nativeProcessImage(base64Data: string, mimeType?: string): Promise<{success: boolean, webpBase64?: string, lqip?: string, width?: number, height?: number, message?: string}> {
    const api = getAPI()
    if (api && api.nativeProcessImage) {
      try { return await api.nativeProcessImage(base64Data, mimeType) } catch (e) { console.error('[BRIDGE] nativeProcessImage error:', e) }
    }
    return { success: false, message: 'API not available' }
  },

  async nativeGpuSupported(): Promise<{success: boolean, supported?: boolean}> {
    const api = getAPI()
    if (api && api.nativeGpuSupported) {
      try { return await api.nativeGpuSupported() } catch (e) { console.error('[BRIDGE] nativeGpuSupported error:', e) }
    }
    return { success: false }
  },

  /**
   * Gen-2 native LQIP — send raw image buffer (WebP/JPEG) to main process.
   * Returns LQIP data URL (base64 WebP) — ~5-7× faster than OffscreenCanvas path.
   * Falls back to null if native addon not loaded.
   */
  async nativeGenerateLQIP(buffer: ArrayBuffer | Uint8Array, lqipWidth = 20): Promise<{ lqip: string | null; error?: string }> {
    const api = getAPI()
    if (api && api.nativeGenerateLQIP) {
      try { return await api.nativeGenerateLQIP(buffer, lqipWidth) } catch (e) { console.error('[BRIDGE] nativeGenerateLQIP error:', e) }
    }
    return { lqip: null, error: 'API not available' }
  },

  /** Gen-2 native image decode — returns dimensions */
  async nativeImageDecode(buffer: ArrayBuffer): Promise<{ width: number; height: number; format: string; error?: string }> {
    const api = getAPI()
    if (api && api.nativeImageDecode) {
      try { return await api.nativeImageDecode(buffer) } catch (e) { console.error('[BRIDGE] nativeImageDecode error:', e) }
    }
    return { width: 0, height: 0, format: 'unknown', error: 'API not available' }
  },

  /** Gen-2 native image health check */
  async nativeImageHealth(): Promise<{ loaded: boolean; gpu: boolean }> {
    const api = getAPI()
    if (api && api.nativeImageHealth) {
      try { return await api.nativeImageHealth() } catch (e) { console.error('[BRIDGE] nativeImageHealth error:', e) }
    }
    return { loaded: false, gpu: false }
  },

}
