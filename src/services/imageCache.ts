import { getBestImage, SGDBImageType } from './steamGridDb'
import { bridge } from '../bridge'
import { convertToWebP } from './imageProcessor'
import { getFormatQueryParam } from '../utils/formatDetect'
import { ipcBatcher } from './ipcBatcher'

// ── Local image manifest (loaded once on first request) ──
let localManifest: Record<string, { header: boolean }> | null = null
let manifestLoadAttempted = false

function cacheKey(appid: string, preferredImageTypes?: readonly string[]): string {
  if (preferredImageTypes && preferredImageTypes.length > 0) return `${appid}:${preferredImageTypes.join(',')}`
  return appid
}

/**
 * Read cached image from the disk cache via IPC (batched).
 * Returns an image-cache:// URL that the custom protocol handler serves directly from disk.
 * Uses the IPC batcher so concurrent calls from multiple GameCover instances within
 * one animation frame get coalesced into a single batchGet request.
 */
async function getCachedFromDisk(appid: string, preferredImageTypes?: readonly string[]): Promise<string | null> {
  try {
    const types = preferredImageTypes ? [...preferredImageTypes] : undefined
    const result = await ipcBatcher.call<{success: boolean, entries?: Array<{cacheKey: string, dataUrl: string|null, mimeType: string|null, lqip: string|null}>}>(
      'image-cache:batchGet',
      appid,  // dedup key: same appid within one frame = one IPC call
      [[{ appid, preferredImageTypes: types }]],
    )
    if (!result.success || !result.entries || !result.entries[0]?.dataUrl) return null
    const entry = result.entries[0]
    // Warm LQIP into memory map if available
    if (entry.lqip) setLqipMemory(cacheKey(appid, preferredImageTypes), entry.lqip)
    return entry.dataUrl  // image-cache:///cacheKey
  } catch (err) {
    console.error('[imageCache] Disk cache read error:', err)
    return null
  }
}

/**
 * Store image blob data in the disk cache via IPC.
 * Converts the blob to base64 for IPC transport, then the main process writes to disk.
 */
async function cacheImageToDisk(appid: string, blob: Blob, preferredImageTypes?: readonly string[], lqip?: string): Promise<void> {
  try {
    // FileReader encodes off the main thread — the old byte-by-byte string concat
    // built multi-MB strings on the render thread and caused visible jank whenever
    // a fresh cover was persisted.
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result).split(',', 2)[1] || '')
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
    const mimeType = blob.type || 'image/webp'
    const types = preferredImageTypes ? [...preferredImageTypes] : undefined
    await bridge.imageCacheSet(appid, types, base64Data, mimeType, lqip)
  } catch (err) {
    console.error('[imageCache] Disk cache write error:', err)
  }
}

/**
 * Legacy alias for cacheImageToDisk — keeps existing callers working.
 * Will be inlined after full migration.
 */
async function cacheImage(appid: string, blob: Blob, preferredImageTypes?: readonly string[], lqip?: string): Promise<void> {
  return cacheImageToDisk(appid, blob, preferredImageTypes, lqip)
}

// ── LQIP memory map ─────────────────────────────────────────────────────
// Stores LQIP base64 data URLs keyed by cache key for blur-placeholder rendering.

const lqipMap = new Map<string, string>()
// Cap LQIP retention so a long session over the 176K-game catalog can't grow the map
// without bound. Far exceeds any realistic on-screen working set; evicts oldest (FIFO/LRU).
const LQIP_MAX = 3000

function setLqipMemory(key: string, lqip: string): void {
  // Refresh MRU position so recently-used LQIPs survive eviction
  if (lqipMap.has(key)) lqipMap.delete(key)
  lqipMap.set(key, lqip)
  if (lqipMap.size > LQIP_MAX) {
    const oldest = lqipMap.keys().next().value
    if (oldest !== undefined) lqipMap.delete(oldest)
  }
}

/**
 * Retrieve the LQIP (blur placeholder) data URL for a given game image.
 * Returns null if no LQIP is available yet.
 */
export function getLqipData(appid: string, preferredImageTypes?: readonly string[]): string | null {
  return lqipMap.get(cacheKey(appid, preferredImageTypes)) ?? null
}

// ── Global concurrency semaphore ────────────────────────────────────────
// Limits simultaneous CDN fetches to prevent browser connection pool saturation,
// especially when IntersectionObserver fires 30+ GameCover images at once on
// window restore from minimize.
// The CDN path issues ~1 request per cover (primary-host first, fan-out only on
// miss), so a higher ceiling lets many DIFFERENT covers load in parallel rather
// than starving the pool with one cover's host race. 16 comfortably covers a full
// viewport of a virtualized grid while staying well under Steam-CDN rate limits.
const MAX_CONCURRENT_FETCHES = 16
let activeFetches = 0
const fetchQueue: (() => void)[] = []

function dequeueNext(): void {
  while (activeFetches < MAX_CONCURRENT_FETCHES && fetchQueue.length > 0) {
    const next = fetchQueue.shift()
    activeFetches++
    next!()
  }
}

async function withConcurrencyLimit<T>(fn: () => Promise<T>): Promise<T> {
  if (activeFetches < MAX_CONCURRENT_FETCHES) {
    activeFetches++
    try { return await fn() }
    finally { activeFetches--; dequeueNext() }
  }
  return new Promise<T>((resolve, reject) => {
    fetchQueue.push(async () => {
      try { resolve(await fn()) }
      catch (e) { reject(e) }
      finally { activeFetches--; dequeueNext() }
    })
  })
}

// ── WebP conversion helper ──────────────────────────────────────────────
// Fetches a raw image, converts it to WebP + LQIP in one pass.

async function fetchAndConvertToWebP(
  url: string,
  timeoutMs = 8000
): Promise<{ webpBlob: Blob; blobUrl: string; lqip: string } | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const resp = await withConcurrencyLimit(() => fetch(url, { signal: controller.signal }))
      if (!resp.ok) return null
      const rawBlob = await resp.blob()
      if (rawBlob.size < 500) return null

      const { webpBlob, lqipDataUrl } = await convertToWebP(rawBlob)
      return { webpBlob, blobUrl: URL.createObjectURL(webpBlob), lqip: lqipDataUrl }
    } finally {
      clearTimeout(timeout)
    }
  } catch { return null }
}

// ── Background convert + cache ──────────────────────────────────────────
// The hot path now displays the RAW fetched image immediately (time-to-pixel =
// network only). This converts that blob to WebP + LQIP OFF the critical path,
// then warms the LQIP memory map and persists the WebP to the disk cache so the
// NEXT session (and the recipient of a zipped build) gets a fast disk hit.
// Decoupling the encode also avoids 90+ concurrent OffscreenCanvas conversions
// fighting for the GPU/CPU on the home page (a source of slow paints and the
// occasional corrupted cover).
function backgroundConvertAndCache(appid: string, blob: Blob, preferredImageTypes: readonly string[] | undefined, key: string): void {
  // Defer to idle so it never competes with on-screen rendering.
  const run = () => {
    convertToWebP(blob)
      .then(({ webpBlob, lqipDataUrl }) => {
        setLqipMemory(key, lqipDataUrl)
        cacheImageToDisk(appid, webpBlob, preferredImageTypes, lqipDataUrl)
      })
      .catch(() => {
        // Conversion failed — still persist the raw blob so next session has a disk hit.
        cacheImageToDisk(appid, blob, preferredImageTypes)
      })
  }
  if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 2000 })
  else setTimeout(run, 0)
}

// ── Local manifest loading ──────────────────────────────────────────────

async function loadLocalManifest(): Promise<Record<string, { header: boolean }> | null> {
  if (manifestLoadAttempted) return localManifest
  manifestLoadAttempted = true
  try {
    localManifest = await bridge.getLocalImageManifest()
    if (localManifest && import.meta.env.DEV) {
      console.log(`[imageCache] Local manifest loaded: ${Object.keys(localManifest).length} images`)
    }
  } catch {
    localManifest = null
  }
  return localManifest
}

// ── Generational in-memory cache (hot / warm / cold LRU) ─────────────────

const HOT_MAX = 500
const WARM_MAX = 1000
const COLD_MAX = 500

interface CacheEntry {
  url: string
  isBlob: boolean
  format?: string
}

const hotCache = new Map<string, CacheEntry>()
const warmCache = new Map<string, CacheEntry>()
const coldCache = new Map<string, CacheEntry>()

/** Read a key from the memory cache, promoting accessed entries to hot. Returns the URL or null. */
function accessMemoryCache(key: string): string | null {
  if (hotCache.has(key)) {
    // Refresh MRU position
    const entry = hotCache.get(key)!
    hotCache.delete(key)
    hotCache.set(key, entry)
    return entry.url
  }

  let entry: CacheEntry | undefined

  if (warmCache.has(key)) {
    entry = warmCache.get(key)!
    warmCache.delete(key)
  } else if (coldCache.has(key)) {
    entry = coldCache.get(key)!
    coldCache.delete(key)
  }

  if (entry) {
    hotCache.set(key, entry)
    enforceHotLimit()
    return entry.url
  }

  return null
}

function hasInMemoryCache(key: string): boolean {
  return hotCache.has(key) || warmCache.has(key) || coldCache.has(key)
}

/**
 * Synchronous peek into the in-memory cache. Returns the resolved URL if the
 * image is already resident in the hot/warm/cold tiers, else null. Lets the UI
 * paint instantly on revisits, scroll-back, and window-restore — no async
 * round-trip, no IntersectionObserver wait, no stagger, no blur-up flash.
 */
export function getCachedImageSync(appid: string, preferredImageTypes?: readonly string[]): string | null {
  return accessMemoryCache(cacheKey(appid, preferredImageTypes))
}

function enforceHotLimit(): void {
  if (hotCache.size <= HOT_MAX) return
  const oldest = hotCache.keys().next().value!
  const entry = hotCache.get(oldest)!
  hotCache.delete(oldest)
  warmCache.set(oldest, entry)
  enforceWarmLimit()
}

function enforceWarmLimit(): void {
  if (warmCache.size <= WARM_MAX) return
  const oldest = warmCache.keys().next().value!
  const entry = warmCache.get(oldest)!
  warmCache.delete(oldest)
  coldCache.set(oldest, entry)
  enforceColdLimit()
}

function enforceColdLimit(): void {
  if (coldCache.size <= COLD_MAX) return
  const oldest = coldCache.keys().next().value!
  const entry = coldCache.get(oldest)!
  coldCache.delete(oldest)
  if (entry.isBlob) URL.revokeObjectURL(entry.url)
}

/** Insert/update an entry in the memory cache. Revokes old blob URL if key already exists. */
function setMemoryCache(key: string, url: string, isBlob: boolean, format?: string): void {
  // Remove prior entry from any tier (revokes blob URL if applicable)
  const hotEntry = hotCache.get(key)
  if (hotEntry) { hotCache.delete(key); if (hotEntry.isBlob) URL.revokeObjectURL(hotEntry.url) }
  const warmEntry = warmCache.get(key)
  if (warmEntry) { warmCache.delete(key); if (warmEntry.isBlob) URL.revokeObjectURL(warmEntry.url) }
  const coldEntry = coldCache.get(key)
  if (coldEntry) { coldCache.delete(key); if (coldEntry.isBlob) URL.revokeObjectURL(coldEntry.url) }

  // Insert at MRU position in hot
  hotCache.set(key, { url, isBlob, format })
  enforceHotLimit()
}

/**
 * Invalidate an image cache entry from all memory caches AND IndexedDB.
 * Revokes blob URLs and removes from hot/warm/cold caches + LQIP map.
 * Next loadGameImage call will fetch fresh from network.
 */
export function invalidateCacheKey(key: string): void {
  const removeFromCache = (cache: Map<string, CacheEntry>) => {
    const entry = cache.get(key)
    if (entry) {
      if (entry.isBlob) URL.revokeObjectURL(entry.url)
      cache.delete(key)
    }
  }
  removeFromCache(hotCache)
  removeFromCache(warmCache)
  removeFromCache(coldCache)
  lqipMap.delete(key)

  // Note: disk cache is TTL-managed — individual key eviction
  // is not needed since the disk cache has 30-day TTL + LRU eviction.
  // Stale entries are naturally purged.
}

/**
 * Validate an image URL's natural dimensions to check orientation.
 * Useful to reject landscape images when portrait is expected.
 * @returns true if the image matches the required orientation
 */
export function validateImageOrientation(url: string, expectPortrait: boolean): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const isPortrait = img.naturalHeight > img.naturalWidth
      const isSquare = img.naturalHeight === img.naturalWidth
      URL.revokeObjectURL(img.src)
      if (expectPortrait) {
        resolve(isPortrait || isSquare)
      } else {
        resolve(!isPortrait || isSquare)
      }
    }
    img.onerror = () => resolve(true) // Can't validate — assume correct
    img.src = url
  })
}

const pendingRequests = new Map<string, Promise<string | null>>()

// ── CDN fallback hosts ──────────────────────────────────────────────────

const FALLBACK_HOSTS = ['shared.akamai.steamstatic.com', 'cdn.cloudflare.steamstatic.com', 'cdn.akamai.steamstatic.com']
const FALLBACK_TYPES = ['header.jpg', 'library_600x900.jpg', 'portrait.jpg']

/**
 * Standard preferredImageTypes combinations for consistent cache keys across all components.
 * Using these constants ensures the same appid produces a single cache key per orientation,
 * reducing redundant CDN fetches and improving LQIP hit rates.
 */
export const IMAGE_TYPES = {
  /** Portrait (2:3): library_600x900 FIRST — that's the real Steam-CDN portrait
   *  filename; `portrait.jpg` 404s on Steam hosts, so trying it first wasted a
   *  full round-trip per cover. Kept only as a late fallback (some non-Steam
   *  sources use it), then header. */
  PORTRAIT: ['library_600x900.jpg', 'portrait.jpg', 'header.jpg'],
  /** Grid/list fallback: 600x900 first (real Steam portrait), then portrait. */
  GRID: ['library_600x900.jpg', 'portrait.jpg'],
  /** Header-only fallback */
  HEADER: ['header.jpg'],
  /** Home page grid: 600x900 first for visual consistency, then portrait, then header */
  HOME_GRID: ['library_600x900.jpg', 'portrait.jpg', 'header.jpg'],
  /** Hero banner: wide library_hero (real Steam file) → 600x900 → header.
   *  Dropped 'hero.jpg'/'portrait.jpg' — they 404 on Steam hosts and only added
   *  wasted round-trips before the banner could paint. */
  HERO: ['library_hero.jpg', 'library_600x900.jpg', 'header.jpg'],
} as const

/** Fetch an image URL as a Blob and create an object URL. Returns `null` on any failure. */
async function fetchAsBlob(url: string, timeoutMs = 8000): Promise<{ blob: Blob; blobUrl: string } | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const resp = await withConcurrencyLimit(() => fetch(url, { signal: controller.signal }))
      if (!resp.ok) return null
      const blob = await resp.blob()
      if (blob.size < 500) return null
      return { blob, blobUrl: URL.createObjectURL(blob) }
    } finally {
      clearTimeout(timeout)
    }
  } catch { return null }
}

function mapToSgdbType(preferredImageTypes?: readonly string[]): SGDBImageType {
  return preferredImageTypes?.some(t => t.includes('hero')) ? 'hero' : 'grid'
}

export async function loadGameImage(appid: string, localHeaderUrl?: string, _gameName?: string, preferredImageTypes?: readonly string[]): Promise<string | null> {
  const key = cacheKey(appid, preferredImageTypes)

  // 1. Check in-memory cache (session-speed)
  const cached = accessMemoryCache(key)
  if (cached) return cached

    // 2. Check local images (Phase 2 — build-time pre-cached headers)
    const manifest = await loadLocalManifest()
    // Only use local manifest header when preferredImageTypes includes a header type
    const prefersAnyHeader = !preferredImageTypes?.length || preferredImageTypes.some(t => t.includes('header'))
    if (prefersAnyHeader && manifest?.[appid]?.header) {
      const localUrl = await bridge.getLocalImage(appid, 'header.jpg')
      if (localUrl) {
        const result = await fetchAndConvertToWebP(localUrl)
        if (result) {
          setMemoryCache(key, result.blobUrl, true)
          setLqipMemory(key, result.lqip)
          cacheImage(appid, result.webpBlob, preferredImageTypes, result.lqip)
          return result.blobUrl
        }
        setMemoryCache(key, localUrl, false)
        return localUrl
      }
  }

  // 3. Check disk cache (images fetched in previous sessions, served via image-cache:// protocol)
  const diskCached = await getCachedFromDisk(appid, preferredImageTypes)
  if (diskCached) { setMemoryCache(key, diskCached, false); return diskCached }

  if (!navigator.onLine) { return null }

  // 5. Deduplicate concurrent requests for the same image
  let pending = pendingRequests.get(key)
  if (!pending) {
    pending = (async (): Promise<string | null> => {
      type RawHit = { blob: Blob; blobUrl: string }
      const fetchRawOrThrow = async (url: string, timeoutMs = 8000): Promise<RawHit> => {
        const r = await fetchAsBlob(url, timeoutMs)
        if (!r) throw new Error('miss')
        return { blob: r.blob, blobUrl: r.blobUrl }
      }

      // 4. RACED FETCH: localHeader (games-DB header_image) vs Steam CDN vs
      // SteamGridDB — ALL IN PARALLEL, first success wins. The winner is cached +
      // background-converted uniformly below.
      //
      // NOTE: localHeaderUrl used to be awaited SERIALLY for up to 5s *before* the
      // CDN/SGDB race even started, so every cold-cache cover paid that latency up
      // front. It's now just another racer — if the hashed games-DB URL is slow, the
      // standard CDN header wins instead of blocking.
      const typesToTry = preferredImageTypes?.length ? preferredImageTypes : FALLBACK_TYPES

      let deferredResolve!: (value: RawHit) => void
      const firstSuccess = new Promise<RawHit>(resolve => { deferredResolve = resolve })

      // localHeader source: the games-DB header_image (only when a header is wanted).
      const prefersHeaderFirst = !preferredImageTypes?.length || preferredImageTypes[0]?.includes('header')
      const localWork = (localHeaderUrl && prefersHeaderFirst)
        ? (async () => {
            try {
              const r = await fetchAsBlob(localHeaderUrl, 5000)
              if (r) deferredResolve({ blob: r.blob, blobUrl: r.blobUrl })
            } catch {}
          })().catch(() => {})
        : Promise.resolve()

      // CDN source: try the fastest host/path FIRST (a single request) and only
      // fan out to the remaining host/path combos if that misses. This keeps
      // requests-per-cover at ~1 in the common case, so the concurrency pool
      // serves many DIFFERENT covers at once instead of being monopolised by a
      // single cover's 6-way host race — the core cause of slow grid rendering.
      const fmtParam = getFormatQueryParam()
      const cdnWork = (async () => {
        for (const fileType of typesToTry) {
          const primaryUrl = `https://${FALLBACK_HOSTS[0]}/steam/apps/${appid}/${fileType}${fmtParam}`
          try { deferredResolve(await fetchRawOrThrow(primaryUrl)); return } catch {}
          const rest: string[] = []
          for (const host of FALLBACK_HOSTS) {
            for (const path of ['/steam/apps/', '/store_item_assets/steam/apps/']) {
              const u = `https://${host}${path}${appid}/${fileType}${fmtParam}`
              if (u !== primaryUrl) rest.push(u)
            }
          }
          try { deferredResolve(await Promise.any(rest.map(u => fetchRawOrThrow(u)))); return } catch { continue }
        }
      })().catch(() => {})

      // SGDB source: fires in parallel with CDN
      const sgdbWork = (async () => {
        try {
          const sgdbType = mapToSgdbType(preferredImageTypes)
          // Match the cover box orientation. SGDB grids exist in both landscape
          // (460×215) and portrait (600×900); a landscape header box must never get
          // a portrait grid (it would crop into a squished cover). Heroes are always
          // landscape. Only portrait-typed requests (library_600x900 / portrait) want
          // a portrait grid.
          const wantsPortrait = !!preferredImageTypes?.some(t => t.includes('portrait') || t.includes('600x900'))
          const orientation: 'landscape' | 'portrait' = sgdbType === 'hero' ? 'landscape' : (wantsPortrait ? 'portrait' : 'landscape')
          const minWidth = sgdbType === 'grid' ? 460 : sgdbType === 'hero' ? 920 : undefined
          const minHeight = sgdbType === 'grid' ? 215 : sgdbType === 'hero' ? 430 : undefined
          const best = await getBestImage(appid, sgdbType, minWidth, minHeight, orientation)
          if (best?.url) {
            const r = await fetchAsBlob(best.url)
            if (r) deferredResolve({ blob: r.blob, blobUrl: r.blobUrl })
          }
        } catch {}
      })().catch(() => {})

      // Race: first success wins; if all fail, allSettled branch rejects → caught → null
      const winner = await Promise.race([
        firstSuccess,
        Promise.allSettled([localWork, cdnWork, sgdbWork]).then(() => { throw new Error('all failed') }),
      ]).catch(() => null)

      if (winner) {
        setMemoryCache(key, winner.blobUrl, true)
        backgroundConvertAndCache(appid, winner.blob, preferredImageTypes, key)
        return winner.blobUrl
      }
      return null
    })()
    pendingRequests.set(key, pending)
    pending.finally(() => { if (pendingRequests.get(key) === pending) pendingRequests.delete(key) })
  }
  return pending
}

// ── Priority-based prefetch queue ──────────────────────────────────────
// Three-tier strategy for loading images based on viewport proximity:
//   HIGH   (2) → visible (intersecting) — executes via microtask (immediate)
//   MEDIUM (1) → near-viewport — via requestIdleCallback({timeout: 1000})
//   LOW    (0) → below-fold — via requestIdleCallback({timeout: 2000})
//
// Uses only native browser APIs: requestIdleCallback (setTimeout fallback),
// queueMicrotask for HIGH priority, no external dependencies.
// The queue processes in batches of 4, sorted by priority descending.

const PRIORITY_HIGH = 2
const PRIORITY_MEDIUM = 1
const PRIORITY_LOW = 0
const PREFETCH_BATCH_SIZE = 4

/** Cache for URL-prefetched blob URLs (separate from appid-keyed generational cache) */
const urlPrefetchCache = new Map<string, string>()
const URL_PREFETCH_CACHE_MAX = 300
const urlPrefetchInFlight = new Set<string>()

interface PrefetchTask {
  id: string
  priority: number
  /** Raw image URL to fetch and cache as blob */
  url?: string
  /** App ID for the existing loadGameImage path */
  appid?: string
  localHeaderUrl?: string
  gameName?: string
  preferredImageTypes?: string[]
}

/**
 * Simple priority queue for image prefetch tasks.
 * Processes tasks in descending priority order, in batches of PREFETCH_BATCH_SIZE.
 * The schedule urgency depends on the highest-priority task in the queue:
 *   HIGH   → queueMicrotask (immediate, async but not deferred)
 *   MEDIUM → requestIdleCallback with 1s timeout
 *   LOW    → requestIdleCallback with 2s timeout
 */
class PriorityQueue {
  private tasks = new Map<string, PrefetchTask>()
  private scheduled = false

  /** Add a task, or upgrade its priority if a lower-priority task with the same id exists */
  enqueue(task: PrefetchTask): void {
    const existing = this.tasks.get(task.id)
    if (existing) {
      if (task.priority > existing.priority) existing.priority = task.priority
      return
    }
    this.tasks.set(task.id, task)
    this.schedule()
  }

  /** Upgrade a task's priority if currently lower than newPriority */
  promote(id: string, newPriority: number): void {
    const task = this.tasks.get(id)
    if (task && task.priority < newPriority) {
      task.priority = newPriority
    }
  }

  /** Check if a task exists in the queue */
  has(id: string): boolean {
    return this.tasks.has(id)
  }

  /** Current queue depth */
  size(): number {
    return this.tasks.size
  }

  /** Remove and return tasks matching a predicate */
  removeMatching(predicate: (t: PrefetchTask) => boolean): PrefetchTask[] {
    const removed: PrefetchTask[] = []
    for (const [id, task] of this.tasks) {
      if (predicate(task)) {
        this.tasks.delete(id)
        removed.push(task)
      }
    }
    return removed
  }

  private schedule(): void {
    if (this.scheduled) return
    this.scheduled = true

    // Determine scheduling urgency from highest priority in queue
    let highest = PRIORITY_LOW
    for (const task of this.tasks.values()) {
      if (task.priority > highest) highest = task.priority
    }

    const run = (): void => {
      this.scheduled = false
      this.processBatch()
    }

    if (highest >= PRIORITY_HIGH) {
      queueMicrotask(run)
    } else if (highest >= PRIORITY_MEDIUM) {
      if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(run, { timeout: 1000 })
      } else {
        setTimeout(run, 100)
      }
    } else {
      if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(run, { timeout: 2000 })
      } else {
        setTimeout(run, 500)
      }
    }
  }

  private processBatch(): void {
    const sorted = Array.from(this.tasks.values()).sort((a, b) => b.priority - a.priority)
    const batch = sorted.slice(0, PREFETCH_BATCH_SIZE)
    for (const task of batch) {
      this.tasks.delete(task.id)
      this.executeTask(task)
    }
    if (this.tasks.size > 0) this.schedule()
  }

  private executeTask(task: PrefetchTask): void {
    if (task.url) {
      executeUrlPrefetch(task.url)
    } else if (task.appid) {
      loadGameImage(task.appid, task.localHeaderUrl, task.gameName, task.preferredImageTypes)
    }
  }
}

const prefetchQueue = new PriorityQueue()

/** Extract numeric appid from a Steam CDN URL for proximity heuristics */
function extractAppIdFromUrl(url: string): number | null {
  const match = url.match(/\/(\d{1,10})\/(?:header|portrait|library|hero)\./)
  return match ? parseInt(match[1]!, 10) : null
}

/** Determine if a URL's appid is numerically close to any visible URL's appid (threshold=30) */
function isNearViewportUrl(url: string, visibleUrls: string[]): boolean {
  const urlAppid = extractAppIdFromUrl(url)
  if (urlAppid === null) return false
  const threshold = 30
  for (const vu of visibleUrls) {
    const vuAppid = extractAppIdFromUrl(vu)
    if (vuAppid !== null && Math.abs(urlAppid - vuAppid) <= threshold) return true
  }
  return false
}

/** Fetch a raw URL, cache as blob, and create object URL */
async function executeUrlPrefetch(url: string): Promise<void> {
  if (urlPrefetchCache.has(url) || urlPrefetchInFlight.has(url)) return
  urlPrefetchInFlight.add(url)
  try {
    const result = await fetchAsBlob(url)
    if (!result) return
    // Evict oldest entry if at capacity
    if (urlPrefetchCache.size >= URL_PREFETCH_CACHE_MAX) {
      const oldest = urlPrefetchCache.keys().next().value!
      const oldBlob = urlPrefetchCache.get(oldest)!
      URL.revokeObjectURL(oldBlob)
      urlPrefetchCache.delete(oldest)
    }
    urlPrefetchCache.set(url, result.blobUrl)
  } finally {
    urlPrefetchInFlight.delete(url)
  }
}

/**
 * Enqueue an image URL for priority-based prefetching.
 * HIGH priority starts immediately; MEDIUM and LOW defer to idle callbacks.
 */
export function queuePrefetch(url: string, priority: number): void {
  if (priority >= PRIORITY_HIGH) {
    executeUrlPrefetch(url)
    return
  }
  if (urlPrefetchCache.has(url) || urlPrefetchInFlight.has(url)) return
  if (prefetchQueue.has(url)) {
    prefetchQueue.promote(url, priority)
    return
  }
  prefetchQueue.enqueue({ id: url, url, priority })
}

/**
 * Classify an array of image URLs by viewport priority and enqueue them.
 * @param urls       Flat array of all image URLs in scroll order
 * @param visibleSet Set of URLs currently intersecting the viewport
 */
export function prefetchByPriority(urls: string[], visibleSet: Set<string>): void {
  const visibleArr = Array.from(visibleSet)
  for (const url of urls) {
    let priority: number
    if (visibleSet.has(url)) {
      priority = PRIORITY_HIGH
    } else if (isNearViewportUrl(url, visibleArr)) {
      priority = PRIORITY_MEDIUM
    } else {
      priority = PRIORITY_LOW
    }
    queuePrefetch(url, priority)
  }
}

/**
 * Called from the UI layer's IntersectionObserver callback.
 * Promotes URLs that just became visible to HIGH priority and starts
 * loading any uncached, unqueued visible URLs immediately.
 */
export function updateVisibleSet(visibleUrls: string[]): void {
  for (const url of visibleUrls) {
    prefetchQueue.promote(url, PRIORITY_HIGH)
    if (!urlPrefetchCache.has(url) && !urlPrefetchInFlight.has(url) && !prefetchQueue.has(url)) {
      executeUrlPrefetch(url)
    }
  }
}

/** Retrieve a prefetched blob URL for a URL, or null if not yet cached */
export function getPrefetchedUrl(url: string): string | null {
  return urlPrefetchCache.get(url) ?? null
}

/**
 * Fire-and-forget preload for a list of app IDs.
 * Delegates to the priority queue at LOW priority so images are loaded
 * during idle periods without competing with visible-content fetches.
 */
export function preloadImages(appids: string[], localHeaders?: Record<string, string>, gameNames?: Record<string, string>): void {
  for (const appid of appids) {
    const key = cacheKey(appid)
    if (!hasInMemoryCache(key) && !pendingRequests.has(key)) {
      prefetchQueue.enqueue({
        id: key,
        appid,
        localHeaderUrl: localHeaders?.[appid],
        gameName: gameNames?.[appid],
        priority: PRIORITY_LOW
      })
    }
  }
}

export function clearImageCache(): void {
  // Revoke all blob URLs to prevent leaks
  for (const entry of [...hotCache.values(), ...warmCache.values(), ...coldCache.values()]) {
    if (entry.isBlob) URL.revokeObjectURL(entry.url)
  }
  hotCache.clear()
  warmCache.clear()
  coldCache.clear()
  pendingRequests.clear()
  localManifest = null
  manifestLoadAttempted = false
  lqipMap.clear()
  // Clear URL prefetch cache
  for (const blobUrl of urlPrefetchCache.values()) URL.revokeObjectURL(blobUrl)
  urlPrefetchCache.clear()
  urlPrefetchInFlight.clear()
  // Clear disk cache
  bridge.imageCacheClear().catch(() => {})
}

export async function loadAllCachedImages(): Promise<number> {
  // Disk cache is accessed on-demand via loadGameImage() step 3.
  // No startup pre-warming needed — the image-cache:// protocol
  // serves files directly from disk, and the in-memory LRU fills
  // naturally as images are requested.
  return 0
}

const PRELOAD_CHUNK_SIZE = 6
const PRELOAD_INTERVAL_MS = 100

/**
 * Fire-and-forget browser-level image prefetch.
 * Creates a lightweight Image element to trigger browser-level preloading
 * and caching without involving the full image pipeline (IndexedDB, WebP
 * conversion, generational LRU). Ideal for directional scroll prefetch
 * where we just need the image in the browser's HTTP cache.
 */
export function prefetchCover(url: string): void {
  if (!url) return
  const img = new Image()
  img.fetchPriority = 'low'
  img.src = url
}

export function preloadLibraryImages(games: { appid: string; name?: string; header_image?: string }[]): void {
  if (!games.length) return
  let index = 0
  const preferredTypes = ['portrait.jpg', 'library_600x900.jpg']
  const scheduleNext = () => {
    if (index >= games.length) return
    const chunk = games.slice(index, index + PRELOAD_CHUNK_SIZE)
    index += PRELOAD_CHUNK_SIZE
    for (const game of chunk) {
      const key = cacheKey(game.appid, preferredTypes)
      if (!hasInMemoryCache(key) && !pendingRequests.has(key)) loadGameImage(game.appid, game.header_image, game.name, preferredTypes)
    }
    if (typeof requestIdleCallback === 'function') requestIdleCallback(() => scheduleNext(), { timeout: 3000 })
    else setTimeout(scheduleNext, PRELOAD_INTERVAL_MS)
  }
  scheduleNext()
}
