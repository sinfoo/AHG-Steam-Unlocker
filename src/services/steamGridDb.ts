// src/services/steamGridDb.ts
// SteamGridDB API v2 client — fetches game image URLs (grids, heroes, logos, icons)
// Replaces the 5-method CDN brute-force pipeline in imageCache.ts:tryLoadImage()

const SGDB_API_BASE = 'https://www.steamgriddb.com/api/v2'

// Preferred image dimensions for grid type.
// We request 460×215 (landscape grid) and 600×900 (portrait) from the SGDB API
// so the server filters results to only images matching these dimensions,
// reducing response size and client-side filtering work.
const SGDB_DIMENSIONS = '460x215,600x900'

export type SGDBImageType = 'grid' | 'hero' | 'logo' | 'icon'

export interface SGDBImage {
  id: number
  type: SGDBImageType
  url: string
  thumb: string
  width: number
  height: number
  mime: string
  notes: string | null
  nsfw: boolean
  humor: boolean
  score: number
}

interface CachedEntry {
  images: SGDBImage[]
  timestamp: number
}

const cache = new Map<string, CachedEntry>()
const CACHE_TTL = 90 * 24 * 60 * 60 * 1000 // 90 days (images rarely change after release)
const SGDB_CACHE_MAX = 4000 // entry-count cap (LRU) on top of TTL — keeps long sessions stable
const pendingRequests = new Map<string, Promise<SGDBImage[]>>()

function cacheKey(appid: string, type: SGDBImageType): string {
  return `${appid}:${type}`
}

function getApiKey(): string {
  // Check localStorage first, fall back to compile-time default
  try {
    const stored = localStorage.getItem('sgdb_api_key')
    if (stored) return stored
  } catch { /* localStorage unavailable (e.g. SSR) */ }
  // Compile-time default from env or hardcoded
  const key = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SGDB_API_KEY) || ''
  return key as string
}

export function setApiKey(key: string): void {
  try {
    localStorage.setItem('sgdb_api_key', key)
  } catch { /* ignore */ }
  // Clear cache so next requests use new key
  cache.clear()
  pendingRequests.clear()
}

export function clearSgdbCache(): void {
  cache.clear()
  pendingRequests.clear()
}

async function fetchImages(appid: string, type: SGDBImageType): Promise<SGDBImage[]> {
  const ck = cacheKey(appid, type)
  const cached = cache.get(ck)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.images
  }

  let pending = pendingRequests.get(ck)
  if (!pending) {
    pending = (async () => {
      try {
        const apiKey = getApiKey()
        const endpoint = type === 'grid'
          ? `grids/steam/${appid}`
          : `${type}s/steam/${appid}`
        // Add dimensions query param for grid type to reduce server response size
        // Only grids support dimension filtering; heroes/logos/icons don't
        const dimensionsParam = type === 'grid' ? `?dimensions=${SGDB_DIMENSIONS}` : ''
        const url = `${SGDB_API_BASE}/${endpoint}${dimensionsParam}`

        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 8000)

        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: controller.signal,
        })
        clearTimeout(timeout)

        if (!response.ok) {
          if (response.status === 404) return []
          if (import.meta.env.DEV) console.warn(`[SGDB] ${response.status} for ${appid}/${type}`)
          return []
        }

        const json = await response.json()
        const images: SGDBImage[] = (json.data || []).map((item: any) => ({
          id: item.id,
          type,
          url: item.url,
          thumb: item.thumb || '',
          width: item.width || 0,
          height: item.height || 0,
          mime: item.mime || 'image/png',
          notes: item.notes || null,
          nsfw: item.nsfw ?? false,
          humor: item.humor ?? false,
          score: item.score || 0,
        }))

        if (images.length > 0) {
          // Bound by entry count (not just TTL) so long sessions stay memory-stable
          if (cache.size >= SGDB_CACHE_MAX) {
            const oldest = cache.keys().next().value
            if (oldest !== undefined) cache.delete(oldest)
          }
          cache.set(ck, { images, timestamp: Date.now() })
        }
        return images
      } catch {
        return []
      } finally {
        pendingRequests.delete(ck)
      }
    })()
    pendingRequests.set(ck, pending)
  }

  return pending
}

function scoreImage(img: SGDBImage): number {
  // Higher score = better match for our use case
  let s = img.score
  // Prefer PNG (transparency support for logos/icons)
  if (img.mime === 'image/png') s += 5
  // Prefer 16:9 aspect ratio for grids/heroes
  if (img.width > 0 && img.height > 0) {
    const ratio = img.width / img.height
    if (ratio > 1.7 && ratio < 1.8) s += 3 // ~16:9
    if (ratio > 1.5 && ratio < 1.6) s += 2 // ~3:2
  }
  // Penalize nsfw/humor
  if (img.nsfw) s -= 20
  if (img.humor) s -= 10
  return s
}

/** Get the best image for a given appid + type, filtering by preferred dimensions.
 *  `orientation` HARD-filters by aspect ratio: SGDB grids come in both landscape
 *  (460×215, 920×430) and portrait (600×900). A landscape cover box must NEVER
 *  receive a portrait grid (it gets object-fit:cover cropped into a squished mess),
 *  so for an orientation-constrained request we return null rather than fall back
 *  to the wrong orientation. */
export async function getBestImage(
  appid: string,
  type: SGDBImageType = 'grid',
  minWidth?: number,
  minHeight?: number,
  orientation?: 'landscape' | 'portrait',
): Promise<SGDBImage | null> {
  const images = await fetchImages(appid, type)
  if (images.length === 0) return null

  let candidates = images
  if (minWidth) candidates = candidates.filter(i => i.width >= minWidth)
  if (minHeight) candidates = candidates.filter(i => i.height >= minHeight)

  if (orientation === 'landscape') {
    // header 2.14:1, hero 16:9, capsule 1.75:1 — all ≥ 1.4; portrait 600×900 = 0.67
    candidates = candidates.filter(i => i.width > 0 && i.height > 0 && i.width / i.height >= 1.4)
  } else if (orientation === 'portrait') {
    candidates = candidates.filter(i => i.width > 0 && i.height > 0 && i.height / i.width >= 1.2)
  }

  if (candidates.length === 0) {
    // For an orientation-constrained request, do NOT serve the wrong orientation.
    if (orientation) return null
    // Otherwise no images meet min dimensions; return the highest-scored overall.
    candidates = images
  }

  candidates.sort((a, b) => scoreImage(b) - scoreImage(a))
  return candidates[0] ?? null
}

/** Get ALL images of a given type for an appid (sorted by score descending) */
export async function getImages(
  appid: string,
  type: SGDBImageType = 'grid',
): Promise<SGDBImage[]> {
  const images = await fetchImages(appid, type)
  return images.sort((a, b) => scoreImage(b) - scoreImage(a))
}

/** Get the raw image URL for an appid (convenience wrapper — used by imageCache.ts) */
export async function getImageUrl(
  appid: string,
  type: SGDBImageType = 'grid',
): Promise<string | null> {
  const best = await getBestImage(appid, type)
  return best?.url || null
}

/** Get a hero image URL for an appid (convenience wrapper) */
export async function getHeroUrl(appid: string): Promise<string | null> {
  return getImageUrl(appid, 'hero')
}

/** Prefetch images for a batch of appids (call during idle time) */
export async function prefetchImages(
  appids: string[],
  types: SGDBImageType[] = ['grid', 'hero', 'logo'],
): Promise<void> {
  const promises = appids.flatMap(appid =>
    types.map(type => fetchImages(appid, type).catch(() => {})),
  )
  await Promise.allSettled(promises)
}

// Expose globally for development debugging
if (typeof window !== 'undefined') {
  (window as any).__sgdb = { getBestImage, getImages, getImageUrl, getHeroUrl, prefetchImages, clearSgdbCache, setApiKey }
}
