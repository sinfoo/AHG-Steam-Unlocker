/// <reference lib="webworker" />

// ══════════════════════════════════════════════════════════════
// Game Loader Worker — Boot-time game processing + client-side
// filtering/pagination, off the renderer main thread.
//
// Protocol:
//   Main → Worker:  { type: 'process', queryId, games, freeIds }
//   Worker → Main:  { type: 'processed', queryId, games }
//   Main → Worker:  { type: 'filter',   queryId, page, limit, search?, genre? }
//   Worker → Main:  { type: 'filtered', queryId, games, total, hasMore }
//   Main → Worker:  { type: 'init',     queryId, games }
//   Worker → Main:  { type: 'ready',    queryId }
// ══════════════════════════════════════════════════════════════

// ── F2P constants (mirrors useGameFilters.ts) ──
const F2P_NAME_PATTERNS = [
  'free to play', 'free-to-play', 'f2p', 'demo', 'trial',
  'play free', 'free game', 'open beta', 'free access',
]

function isF2PGame(g: any, dynamicFreeIds: Set<string>): boolean {
  if (dynamicFreeIds.has(g.appid)) return true
  const name = (g.name || '').toLowerCase()
  return F2P_NAME_PATTERNS.some(p => name.includes(p))
}

// ── Filter + dedup pipeline ──
// Mirrors the logic in App.tsx lines 411-425.
function processGames(games: any[], freeIds: string[]): any[] {
  const dynamicFreeSet = new Set(freeIds)

  // Filter out F2P games and DLC-only entries
  const filtered = games.filter(
    (g: any) => !isF2PGame(g, dynamicFreeSet) && (g.type || '').toLowerCase() !== 'dlc',
  )

  // Deduplicate by appid, keep entry with best header_image
  const deduped = new Map<string, any>()
  for (const g of filtered) {
    const key = String(g.appid)
    const existing = deduped.get(key)
    if (
      !existing ||
      (g.header_image || '').length > (existing.header_image || '').length
    ) {
      deduped.set(key, { ...g, appid: key })
    }
  }

  return [...deduped.values()]
}

// ── Module-level cache ──
// Holds the processed games array for subsequent filter queries.
let gamesCache: any[] | null = null

// ══════════════════════════════════════════════════════════════
// Message handler
// ══════════════════════════════════════════════════════════════

self.onmessage = (e: MessageEvent) => {
  const msg = e.data

  try {
    switch (msg.type) {
      case 'init': {
        // Just cache games for subsequent filter queries (no processing)
        gamesCache = msg.games
        self.postMessage({ type: 'ready', queryId: msg.queryId })
        break
      }

      case 'process': {
        // Full boot-time pipeline: filter + dedup
        const result = processGames(msg.games, msg.freeIds || [])
        gamesCache = result
        self.postMessage({
          type: 'processed',
          queryId: msg.queryId,
          games: result,
        })
        break
      }

      case 'filter': {
        const games = gamesCache || []
        const { page = 1, limit = 50, search, genre } = msg

        let filtered = games

        if (search) {
          const q = search.toLowerCase()
          filtered = filtered.filter(
            (g: any) =>
              g.name?.toLowerCase().includes(q) ||
              g.tags?.some((t: string) => t.toLowerCase().includes(q)),
          )
        }

        if (genre && genre !== 'All') {
          filtered = filtered.filter((g: any) => g.tags?.includes(genre))
        }

        const start = (page - 1) * limit
        const sliced = filtered.slice(start, start + limit)

        self.postMessage({
          type: 'filtered',
          queryId: msg.queryId,
          games: sliced,
          total: filtered.length,
          hasMore: start + limit < filtered.length,
        })
        break
      }

      default:
        console.warn('[GameLoader Worker] Unknown message type:', msg.type)
    }
  } catch (err: any) {
    self.postMessage({
      type: 'error',
      queryId: msg?.queryId ?? -1,
      error: String(err?.message ?? err),
    })
  }
}
