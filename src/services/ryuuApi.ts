// src/services/ryuuApi.ts
// Ryuu API client — primary manifest source for installing Steam games/DLC
// Generator endpoint: generator.ryuu.lol/secure_download
// Replaces Stages 1-2 of the 6-stage mirror-repo pipeline in installSteamGame()

const RYUU_API_BASE = 'https://generator.ryuu.lol'
const DEFAULT_AUTH_CODE = 'RYUUMANIFESTv78r6h'

// ── Types ──

export interface RyuuManifestInfo {
  appid: string
  available: boolean
  /** Size of the download in bytes (0 if unknown) */
  size: number
  /** Number of manifest files in the ZIP */
  manifestCount: number
  /** Whether this includes DLC manifests */
  hasDlc: boolean
}

export interface RyuuInstallResult {
  success: boolean
  appid: string
  manifestCount: number
  totalSize: number
  message: string
}

// ── Configuration ──

function getAuthCode(): string {
  try {
    const stored = localStorage.getItem('ryuu_auth_code')
    if (stored) return stored
  } catch { /* ignore */ }
  return DEFAULT_AUTH_CODE
}

export function setAuthCode(code: string): void {
  try {
    localStorage.setItem('ryuu_auth_code', code)
  } catch { /* ignore */ }
}

export function getConfiguredAuthCode(): string {
  return getAuthCode()
}

// ── In-memory availability cache ──

const availabilityCache = new Map<string, { available: boolean; timestamp: number }>()
const AVAILABILITY_TTL = 5 * 60 * 1000 // 5 minutes
const pendingChecks = new Map<string, Promise<boolean>>()

// ── API Methods ──

/**
 * Check if a game manifest is available on the Ryuu generator.
 * Uses HEAD request (fast, ~2s timeout) + in-memory cache.
 */
export async function checkAvailability(appid: string): Promise<boolean> {
  const cached = availabilityCache.get(appid)
  if (cached && Date.now() - cached.timestamp < AVAILABILITY_TTL) {
    return cached.available
  }

  let pending = pendingChecks.get(appid)
  if (!pending) {
    pending = (async () => {
      try {
        const authCode = getAuthCode()
        const url = `${RYUU_API_BASE}/secure_download?appid=${appid}&auth_code=${authCode}`

        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 5000)

        const response = await fetch(url, { method: 'HEAD', signal: controller.signal })
        clearTimeout(timeout)

        const available = response.ok
        availabilityCache.set(appid, { available, timestamp: Date.now() })
        return available
      } catch {
        availabilityCache.set(appid, { available: false, timestamp: Date.now() })
        return false
      } finally {
        pendingChecks.delete(appid)
      }
    })()
    pendingChecks.set(appid, pending)
  }

  return pending
}

/**
 * Check availability for a batch of appids (parallel).
 * Useful for pre-populating the cache when browsing.
 */
export async function checkBatchAvailability(appids: string[]): Promise<Record<string, boolean>> {
  const results = await Promise.allSettled(
    appids.map(async (appid) => {
      const available = await checkAvailability(appid)
      return { appid, available }
    }),
  )

  const map: Record<string, boolean> = {}
  for (const result of results) {
    if (result.status === 'fulfilled') {
      map[result.value.appid] = result.value.available
    }
  }
  return map
}

/**
 * Download and install a game via Ryuu API using IPC (main process).
 * Falls back to mirror-repo pipeline if Ryuu fails.
 */
export async function downloadGame(appid: string): Promise<RyuuInstallResult> {
  const api = (window as any).electronAPI

  // Check if the app has a dedicated Ryuu IPC channel
  if (api?.installGameRyuu) {
    try {
      return await api.installGameRyuu(appid)
    } catch (e) {
      if (import.meta.env.DEV) console.warn('[RYUU] installGameRyuu failed, falling back to installGame:', e)
    }
  }

  // Fallback: use addToSteam IPC (mirror-repo pipeline)
  if (api?.addToSteam) {
    try {
      const result = await api.addToSteam(appid)
      return {
        success: result.success ?? true,
        appid,
        manifestCount: result.manifests ?? 0,
        totalSize: result.totalSize ?? 0,
        message: result.message ?? '',
      }
    } catch (e: any) {
      return {
        success: false,
        appid,
        manifestCount: 0,
        totalSize: 0,
        message: e.message || 'Install failed',
      }
    }
  }

  return {
    success: false,
    appid,
    manifestCount: 0,
    totalSize: 0,
    message: 'Not available in browser',
  }
}

/**
 * Download DLC manifests for a base game via Ryuu API.
 */
export async function downloadDlcManifests(
  appid: string,
  dlcIds: string[],
): Promise<RyuuInstallResult> {
  const api = (window as any).electronAPI

  if (api?.installRyuuDlcs) {
    try {
      return await api.installRyuuDlcs(appid, dlcIds)
    } catch (e) {
      if (import.meta.env.DEV) console.warn('[RYUU] installRyuuDlcs failed:', e)
    }
  }

  return {
    success: false,
    appid,
    manifestCount: 0,
    totalSize: 0,
    message: 'DLC install not available',
  }
}

// ── Cache Management ──

/** Clear the availability check cache */
export function clearAvailabilityCache(): void {
  availabilityCache.clear()
  pendingChecks.clear()
}

// Expose globally for development debugging
if (typeof window !== 'undefined') {
  (window as any).__ryuu = {
    checkAvailability,
    checkBatchAvailability,
    downloadGame,
    downloadDlcManifests,
    setAuthCode,
    clearAvailabilityCache,
  }
}
