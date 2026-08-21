// src/services/offlineCache.ts
// Wraps IPC handlers from P3: cache-manifest-offline, get-offline-manifest, get-offline-cache-list

interface OfflineCacheEntry {
  appid: string
  name?: string
  cachedAt: string
  manifestCount: number
}

export const offlineCache = {
  async cacheManifest(appid: string): Promise<boolean> {
    try {
      const result = await (window as any).electronAPI?.cacheManifestOffline?.(appid)
      return result?.success ?? false
    } catch {
      return false
    }
  },

  async getOfflineManifest(appid: string): Promise<any> {
    try {
      const result = await (window as any).electronAPI?.getOfflineManifest?.(appid)
      return result?.manifest ?? null
    } catch {
      return null
    }
  },

  async getCacheList(): Promise<OfflineCacheEntry[]> {
    try {
      const result = await (window as any).electronAPI?.getOfflineCacheList?.()
      return result?.entries ?? []
    } catch {
      return []
    }
  },
}
