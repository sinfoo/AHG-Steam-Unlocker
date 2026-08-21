import { useMemo, useRef, useCallback, useDeferredValue, useState, useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useGameStore, useUserStore, useUIStore } from '../store'
import type { Game, Fix } from '../types'
import { COLORS } from '../constants/colors'
import { fuzzySearch } from './useFuzzySearch'

// ── Lucide icons for nav items ──
import {
  Sparkles, LayoutGrid, FolderHeart, Heart,
  Clock, Wrench, Settings,
} from 'lucide-react'

// ── Game ID lists loaded from JSON data files ──
// (same relative path as App.tsx: ../data/ → ../../data/ from src/hooks/)
import popularGamesData from '../../data/popular_games.json'
import popularIdsData from '../../data/popular_ids.json'
import veryPopularIdsData from '../../data/very_popular_ids.json'
import actionIdsData from '../../data/action_ids.json'
import rpgIdsData from '../../data/rpg_ids.json'
import multiplayerIdsData from '../../data/multiplayer_ids.json'
import indieIdsData from '../../data/indie_ids.json'
import casualIdsData from '../../data/casual_ids.json'
import strategyIdsData from '../../data/strategy_ids.json'
import freeToPlayIdsData from '../../data/free_to_play_ids.json'

// ══════════════════════════════════════════════════════════════
// Module-level constants (same as App.tsx top-level)
// ══════════════════════════════════════════════════════════════

const POPULAR_GAMES: string[] = popularGamesData

export const FIX_FILTERS = [
  { id: 'All', label: 'All', color: COLORS.textSecondary },
  { id: 'Online', label: 'Online', color: COLORS.green },
  { id: 'Tested', label: 'Tested', color: COLORS.blue },
  { id: 'Bypass', label: 'Bypass', color: COLORS.amber },
  { id: 'sinfo', label: 'sinfo', color: COLORS.red },
  { id: 'Hypervisor', label: 'Hypervisor', color: COLORS.cyan },
  { id: 'Unstable', label: 'Unstable', color: COLORS.red },
  { id: 'Extra Steps', label: 'Extra Steps', color: COLORS.purple },
  { id: 'Specific Version', label: 'Specific Version', color: COLORS.amber },
]

const POPULAR_IDS: string[] = popularIdsData
const ACTION_IDS: string[] = actionIdsData
const RPG_IDS: string[] = rpgIdsData
const MULTIPLAYER_IDS: string[] = multiplayerIdsData
const INDIE_IDS: string[] = indieIdsData
const CASUAL_IDS: string[] = casualIdsData
const STRATEGY_IDS: string[] = strategyIdsData
const VERY_POPULAR_IDS: string[] = veryPopularIdsData

const FREE_TO_PLAY_IDS: Set<string> = new Set(freeToPlayIdsData)

const F2P_NAME_PATTERNS = ['free to play', 'free-to-play', 'f2p', 'demo', 'trial', 'play free', 'free game', 'open beta', 'free access']

// Home-section category Sets — lifted to module level so they're created once, not on every homeSections recomputation
const HOME_SECTION_SETS = {
  popular: new Set(POPULAR_IDS),
  veryPopular: new Set(VERY_POPULAR_IDS),
  action: new Set(ACTION_IDS),
  rpg: new Set(RPG_IDS),
  multiplayer: new Set(MULTIPLAYER_IDS),
  indie: new Set(INDIE_IDS),
  casual: new Set(CASUAL_IDS),
  strategy: new Set(STRATEGY_IDS),
}

export function isF2PGame(g: any, dynamicFreeIds: Set<string>): boolean {
  if (FREE_TO_PLAY_IDS.has(g.appid) || dynamicFreeIds.has(g.appid)) return true
  const name = (g.name || '').toLowerCase()
  return F2P_NAME_PATTERNS.some(p => name.includes(p))
}

const FIXES_PER_PAGE = 50

// ══════════════════════════════════════════════════════════════
// Hook
// ══════════════════════════════════════════════════════════════

export function useGameFilters() {
  // ── Store selectors ──
  const { games, searchQuery, sortBy, fixes, fixSearchQuery, fixFilter, installedGames, librarySearchQuery, dynamicFreeIds, fixPage, knownDlcIds } = useGameStore(
    useShallow(s => ({
      games: s.games, searchQuery: s.searchQuery, sortBy: s.sortBy,
      fixes: s.fixes, fixSearchQuery: s.fixSearchQuery,
      fixFilter: s.fixFilter, installedGames: s.installedGames, librarySearchQuery: s.librarySearchQuery,
      dynamicFreeIds: s.dynamicFreeIds, fixPage: s.fixPage, knownDlcIds: s.knownDlcIds
    }))
  )
  const setFixFilter = useGameStore(s => s.setFixFilter)
  const setFixPage = useGameStore(s => s.setFixPage)
  const setStoreGamesWithCover = useGameStore(s => s.setGamesWithCover)

  const { favorites, recentGames } = useUserStore(
    useShallow(s => ({ favorites: s.favorites, recentGames: s.recentGames }))
  )

  const currentPage = useUIStore(s => s.currentPage)

  // ── Deferred values ──
  const deferredSearchQuery = useDeferredValue(searchQuery)

  // Mutable ref to the latest games array — the worker response handler (closed over
  // mount-time scope) uses this to map result indices back to Game objects.
  const gamesRef = useRef<Game[]>([])
  gamesRef.current = games

  // Refs for fuzzy fallback in worker response handler
  const currentPageRef = useRef(currentPage)
  currentPageRef.current = currentPage
  const deferredSearchQueryRef = useRef(deferredSearchQuery)
  deferredSearchQueryRef.current = deferredSearchQuery
  const f2pFilteredGamesRef = useRef<Game[]>([])

  // Cache for per-page filteredGames results — prevents redundant re-filtering when inputs
  // haven't meaningfully changed (e.g., games array reference changed via store update,
  // but filter params are identical). Key encodes page + array sizes + all filter inputs.
  const prevFilterResultRef = useRef<{ key: string; result: Game[] } | null>(null)

  // ── Web Worker for offloaded search+sort ──
  const workerRef = useRef<Worker | null>(null)
  const requestIdRef = useRef(0)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingWorkRef = useRef<{ preFilteredIndices: number[]; query: string; sortBy: string; key: string } | null>(null)
  const pendingCacheKeyRef = useRef<string | null>(null)

  // Spawn worker on mount, terminate on unmount
  useEffect(() => {
    const worker = new Worker(
      new URL('../workers/searchWorker.ts', import.meta.url),
      { type: 'module' }
    )
    workerRef.current = worker

    worker.onmessage = (e: MessageEvent) => {
      const data = e.data
      if (data.type === 'result' && data.queryId === requestIdRef.current) {
        // Worker returns indices into the original games array (sent via INIT).
        // Map them back to full Game objects from the main-thread copy.
        const indices = data.indices as number[]
        const result = indices.map(idx => gamesRef.current[idx]!).filter(Boolean)
        // Fuzzy fallback: on the browse page, if exact Trie search yields < 3
        // results and the query is long enough, fall back to Levenshtein fuzzy
        // search over the pre-filtered (non-F2P, has cover) game list.
        if (currentPageRef.current === 'browse' && result.length < 3) {
          const query = deferredSearchQueryRef.current.trim()
          if (query.length > 2) {
            const fuzzyResults = fuzzySearch(f2pFilteredGamesRef.current, query.toLowerCase(), 0.35)
            if (fuzzyResults.length > 0) {
              if (pendingCacheKeyRef.current) {
                prevFilterResultRef.current = { key: pendingCacheKeyRef.current, result: fuzzyResults }
                pendingCacheKeyRef.current = null
              }
              setFilteredGames(fuzzyResults)
              return
            }
          }
        }
        // Populate cache so a subsequent identical filter resolves immediately
        if (pendingCacheKeyRef.current) {
          prevFilterResultRef.current = { key: pendingCacheKeyRef.current, result }
          pendingCacheKeyRef.current = null
        }
        setFilteredGames(result)
      }
    }

    return () => {
      worker.terminate()
      workerRef.current = null
    }
  }, [])

  // ── INIT: send slimmed-down game data once for Trie building ──
  // Re-sent whenever the games array reference changes so the worker's Trie
  // stays in sync with the main thread's game data.
  useEffect(() => {
    if (games.length === 0 || !workerRef.current) return

    // Strip to only the fields needed for search indexing + sorting
    const slimGames = games.map(g => {
      // Access fields that may exist at runtime but aren't on the Game type
      const ext = g as Record<string, unknown>
      return {
        appid: g.appid,
        name: g.name || '',
        developer: typeof ext.developer === 'string' ? ext.developer : undefined,
        publisher: typeof ext.publisher === 'string' ? ext.publisher : undefined,
        storeId: typeof ext.storeId === 'string' ? ext.storeId : undefined,
      }
    })

    workerRef.current.postMessage({
      type: 'init',
      queryId: -1, // distinct from any search queryId so the handler ignores this response
      payload: { games: slimGames },
    })
  }, [games])

  // ── Derived state (useMemo, same order & deps as App.tsx) ──

  // Lines 583 — pure filter, no side-effect
  const gamesWithCover = useMemo(
    () => games.filter(g => g.header_image && g.header_image.length > 0),
    [games]
  )

  // Side-effect pushed to useEffect — avoids setState-during-render anti-pattern
  // that blocks concurrent rendering and causes double-render in dev strict mode
  useEffect(() => { setStoreGamesWithCover(gamesWithCover) }, [gamesWithCover, setStoreGamesWithCover])

  // Lines 585-586
  const veryPopularSet = useMemo(() => new Set(VERY_POPULAR_IDS), [])

  // Pre-compute not-F2P filtered list (single pass instead of 9+ redundant passes)
  const f2pFilteredGames = useMemo(
    () => gamesWithCover.filter(g => !isF2PGame(g, dynamicFreeIds)),
    [gamesWithCover, dynamicFreeIds]
  )
  f2pFilteredGamesRef.current = f2pFilteredGames

  // Stable empty state for non-home pages — prevents re-render cascades when currentPage changes.
  // MUST be declared BEFORE popularGamesWithCover useMemo to avoid TDZ on navigation.
  const emptyHomeSectionsRef = useRef({
    aaaGames: [] as Game[], hotGames: [] as Game[], popularGames: [] as Game[], justAddedGames: [] as Game[],
    hardGames: [] as Game[], actionGames: [] as Game[], rpgGames: [] as Game[], multiplayerGames: [] as Game[],
    indieGames: [] as Game[], casualGames: [] as Game[],
  })

  // Stable empty array ref for popularGamesWithCover on non-home pages — declared before the useMemo to avoid TDZ
  const emptyPopularRef = useRef<Game[]>([])

  const popularGamesWithCover = useMemo(() => {
    if (currentPage !== 'home' && currentPage !== 'browse') {
      // Return stable empty ref — avoids creating new [] on every page navigation away from home/browse
      return emptyPopularRef.current
    }
    return f2pFilteredGames.filter(g => veryPopularSet.has(g.appid))
  }, [f2pFilteredGames, veryPopularSet, currentPage])

  // Content fingerprint for f2pFilteredGames — captures actual data identity, not just length,
  // so homeSections cache stays valid when the games array reference changes but content is identical
  const f2pFingerprint = useMemo(() => {
    const len = f2pFilteredGames.length
    if (len === 0) return '0'
    // Sample first, quarter, midpoint, three-quarter, last appids for a cheap content signature
    const q1 = f2pFilteredGames[Math.floor(len * 0.25)]?.appid ?? ''
    const mid = f2pFilteredGames[Math.floor(len * 0.5)]?.appid ?? ''
    const q3 = f2pFilteredGames[Math.floor(len * 0.75)]?.appid ?? ''
    return `${len}|${f2pFilteredGames[0]?.appid}|${q1}|${mid}|${q3}|${f2pFilteredGames[len - 1]?.appid}`
  }, [f2pFilteredGames])

  // Cache for homeSections — keyed by content fingerprint + currentPage so identical data
  // across page navigations avoids redundant 9-pass filtering of 100K items
  const homeSectionsCacheRef = useRef<{ key: string; value: typeof emptyHomeSectionsRef.current } | null>(null)

  // Lines 589-624: Home page sections with shuffled refs
  const popularShuffledRef = useRef<Game[] | null>(null)
  const aaaShuffledRef = useRef<Game[] | null>(null)

  const homeSections = useMemo(() => {
    // Only compute on the Home page — 9 filter passes over ~100K items is expensive
    if (currentPage !== 'home') {
      return emptyHomeSectionsRef.current
    }
    // Cache check: content fingerprint (f2pFingerprint captures actual data identity via sampled appids)
    // prevents redundant 9-pass filtering when f2pFilteredGames reference changes but content is identical
    const cacheKey = `${currentPage}|${f2pFingerprint}`
    if (homeSectionsCacheRef.current?.key === cacheKey) {
      return homeSectionsCacheRef.current.value
    }
    const { popular: popularSet, veryPopular: veryPopularSet2, action: actionSet, rpg: rpgSet, multiplayer: multiplayerSet, indie: indieSet, casual: casualSet, strategy: strategySet } = HOME_SECTION_SETS

    // AAA games first (highest priority)
    const aaaGames = f2pFilteredGames.filter(g => veryPopularSet2.has(g.appid))
    if (!aaaShuffledRef.current || aaaShuffledRef.current.length !== aaaGames.length) {
      aaaShuffledRef.current = [...aaaGames].sort(() => Math.random() - 0.5)
    }

    const popularFiltered = f2pFilteredGames.filter(g => popularSet.has(g.appid))
    if (!popularShuffledRef.current || popularShuffledRef.current.length !== popularFiltered.length) {
      popularShuffledRef.current = [...popularFiltered].sort(() => Math.random() - 0.5)
    }

    // Fallback: if F2P filtering stripped all games for a section, try unfiltered gamesWithCover
    const sectionFallback = (filtered: Game[], set: Set<string>) => {
      if (filtered.length > 0) return filtered
      const unfiltered = gamesWithCover.filter(g => set.has(g.appid))
      if (unfiltered.length > 0) {
        return unfiltered.slice(0, 20)
      }
      return filtered
    }
    const aaaResult = (aaaShuffledRef.current || aaaGames).slice(0, 50)
    const popularResult = (popularShuffledRef.current || popularFiltered).slice(0, 100)
    const actionResult = sectionFallback(f2pFilteredGames.filter(g => actionSet.has(g.appid)).slice(0, 20), actionSet)
    const rpgResult = sectionFallback(f2pFilteredGames.filter(g => rpgSet.has(g.appid)).slice(0, 20), rpgSet)
    const multiplayerResult = sectionFallback(f2pFilteredGames.filter(g => multiplayerSet.has(g.appid)).slice(0, 20), multiplayerSet)
    const indieResult = sectionFallback(f2pFilteredGames.filter(g => indieSet.has(g.appid)).slice(0, 20), indieSet)
    const casualResult = sectionFallback(f2pFilteredGames.filter(g => casualSet.has(g.appid)).slice(0, 20), casualSet)
    const strategyResult = sectionFallback(f2pFilteredGames.filter(g => strategySet.has(g.appid)).slice(0, 20), strategySet)

    if (f2pFilteredGames.length > 0) {
      const emptySections = [
        aaaResult.length === 0 && 'aaaGames',
        popularResult.length === 0 && 'popularGames',
        actionResult.length === 0 && 'actionGames',
        rpgResult.length === 0 && 'rpgGames',
        multiplayerResult.length === 0 && 'multiplayerGames',
        indieResult.length === 0 && 'indieGames',
        casualResult.length === 0 && 'casualGames',
        strategyResult.length === 0 && 'hardGames',
      ].filter(Boolean)
      if (emptySections.length > 1) {
        console.warn(`[useGameFilters] Empty home sections: ${emptySections.join(', ')} (f2pFilteredGames: ${f2pFilteredGames.length}, gamesWithCover: ${gamesWithCover.length})`)
      }
    }

    const result = {
      aaaGames: aaaResult,
      hotGames: popularFiltered.slice(0, 30),
      popularGames: popularResult,
      justAddedGames: [...f2pFilteredGames].sort((a, b) => Number(b.appid) - Number(a.appid)).slice(0, 20),
      hardGames: strategyResult,
      actionGames: actionResult,
      rpgGames: rpgResult,
      multiplayerGames: multiplayerResult,
      indieGames: indieResult,
      casualGames: casualResult,
    }
    homeSectionsCacheRef.current = { key: cacheKey, value: result }
    return result
  }, [f2pFingerprint, currentPage])

  // Lines 626-628
  const gamesMap = useMemo(() => new Map(games.map(g => [g.appid, g])), [games])

  const recentGamesList = useMemo(() => {
    return recentGames
      .map(id => gamesMap.get(id))
      .filter((g): g is Game => g !== undefined && !!g.header_image)
      .slice(0, 40)
  }, [recentGames, gamesMap])

  // Snapshot key for installed games — only changes when actual appids change (not just array reference).
  // This prevents expensive recomputation in aiRecommendations and similarGames when the installedGames
  // array reference changes but the contents are the same.
  const installedKey = useMemo(() => installedGames.map(g => g.appid).join(','), [installedGames])

  // Lines 631-644
  const aiRecommendations = useMemo(() => {
    if (installedGames.length === 0) return []
    const installedIds = new Set(installedGames.map(g => g.appid))
    const recIds: string[] = []
    installedGames.forEach(g => {
      const gameGenres = (g as any).genres
      if (gameGenres) {
        if (gameGenres.includes('Action') && !installedIds.has('730')) recIds.push('730')
        if (gameGenres.includes('RPG') && !installedIds.has('374320')) recIds.push('374320')
        if (gameGenres.includes('Strategy') && !installedIds.has('295950')) recIds.push('295950')
        if (gameGenres.includes('Multiplayer') && !installedIds.has('730')) recIds.push('730')
      }
    })
    return games.filter(g => recIds.includes(g.appid) && g.header_image).slice(0, 10)
  }, [installedKey, games])

  // Lines 647-652
  const similarGames = useMemo(() => {
    if (installedGames.length === 0) return gamesWithCover.slice(0, 15)
    const genres = new Set<string>()
    installedGames.slice(0, 5).forEach(g => { const gGenres = (g as any).genres; if (gGenres) gGenres.forEach((x: string) => genres.add(x)) })
    return games.filter(g => (g as any).genres && (g as any).genres.some((x: string) => genres.has(x)) && g.header_image).slice(0, 15)
  }, [installedKey, games])

  // Lines 654-656
  const fixableAppids = useMemo(() => new Set(
    fixes.filter(f => f.download_url || (f.download_urls && f.download_urls.length > 0)).map(f => f.appid)
  ), [fixes])

  // Lines 657-659
  const comingSoonAppids = useMemo(() => new Set(
    fixes.filter(f => !f.download_url || f.download_url.trim() === '').map(f => f.appid)
  ), [fixes])

  // Build set of known DLC appids from master games.json and session-discovered DLCs
  const dlcAppids = useMemo(() => {
    const ids = new Set(games.filter(g => (g.type || '').toLowerCase() === 'dlc' || g.isDlc).map(g => g.appid))
    for (const id of knownDlcIds) ids.add(id)
    return ids
  }, [games, knownDlcIds])

  // Lines 662-678
  const filteredLibraryGames = useMemo(() => {
    let result = installedGames.filter(g => {
      if (g.isDlc || (g.type || '').toLowerCase() === 'dlc' || (g.type || '').toLowerCase() === 'software') return false
      if (dlcAppids.has(g.appid)) return false
      // Filter soundtracks (Steam music-type apps)
      if ((g.type || '').toLowerCase() === 'music') return false
      if ((g.name || '').toLowerCase().includes('soundtrack')) return false
      if (!g.name || g.name.trim() === '') return false
      if (/^App\s+\d+$/i.test(g.name.trim())) return false
      if (g.name.trim() === g.appid) return false
      return true
    })
    if (librarySearchQuery.trim()) {
      const q = librarySearchQuery.toLowerCase().trim()
      result = result.filter(g =>
        (g.name || '').toLowerCase().includes(q) ||
        g.appid.includes(q)
      )
    }
    return result
  }, [installedGames, librarySearchQuery, dlcAppids])

  // Lines 1293-1350
  // Deferred to useEffect to avoid blocking the render phase with 100K+ game sorting
  const [filteredGames, setFilteredGames] = useState<Game[]>([])
  // Lines 1380-1384 — moved before applyGameFilters to avoid TDZ
  const popularOrder = useMemo(() => {
    const order: Record<string, number> = {}
    POPULAR_IDS.forEach((id, i) => { order[id] = i })
    return order
  }, [])

  // Separate popularity index for the catalogue (from POPULAR_GAMES — 1123 entries with AAA games)
  const popularGamesOrder = useMemo(() => {
    const order: Record<string, number> = {}
    const unique = [...new Set(POPULAR_GAMES)]
    unique.forEach((id, i) => { order[id] = i })
    return order
  }, [])

  // ── Worker-based search+sort dispatch (debounced, deduped) ──
  // Pre-filtered games are sent to the Web Worker, keeping the main thread
  // free for rendering. Rapid keystrokes are collapsed to max 1 msg / 33ms.
  const scheduleWorkerWork = useCallback(() => {
    if (debounceTimerRef.current) return

    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null
      const work = pendingWorkRef.current
      if (!work) return
      pendingWorkRef.current = null

      const requestId = ++requestIdRef.current
      pendingCacheKeyRef.current = work.key
      workerRef.current?.postMessage({
        type: 'search',
        queryId: requestId,
        payload: {
          query: work.query,
          sortBy: work.sortBy,
          popularGamesOrder,
          maxPopIdx: POPULAR_GAMES.length,
          preFilteredIndices: work.preFilteredIndices,
        },
      })
    }, 33)
  }, [popularGamesOrder])

  const sendToWorkerDebounced = useCallback((
    preFilteredIndices: number[],
    query: string,
    sortByVal: string,
    key: string
  ) => {
    pendingWorkRef.current = { preFilteredIndices, query, sortBy: sortByVal, key }
    scheduleWorkerWork()
  }, [scheduleWorkerWork])
  // 🔥 PER-PAGE EFFECTS with MINIMAL deps — browse doesn't re-run when recentGames changes
  // Each effect caches its last result keyed by filter inputs; identical inputs return cached value
  // without re-filtering (avoids redundant work when store updates trigger the same filter params).
  // Browse filter — pre-filter on main thread, send search+sort to worker
  useEffect(() => {
    if (currentPage !== 'browse') return
    const cacheKey = `browse|${games.length}|${deferredSearchQuery}|${sortBy}`
    if (prevFilterResultRef.current?.key === cacheKey) {
      setFilteredGames(prevFilterResultRef.current.result)
      return
    }
    // Compute indices of pre-filtered games (instead of sending full Game objects)
    const preFilteredIndices = games.reduce((acc, g, idx) => {
      if (g.header_image && g.header_image.length > 0 && !isF2PGame(g, dynamicFreeIds)) {
        acc.push(idx)
      }
      return acc
    }, [] as number[])
    sendToWorkerDebounced(preFilteredIndices, deferredSearchQuery, sortBy, cacheKey)
  }, [games, currentPage, deferredSearchQuery, sortBy, sendToWorkerDebounced, dynamicFreeIds])
  // Favourites filter — pre-filter on main thread, send search+sort to worker
  useEffect(() => {
    if (currentPage !== 'favourites') return
    const cacheKey = `favourites|${games.length}|${favorites.size}|${deferredSearchQuery}|${sortBy}`
    if (prevFilterResultRef.current?.key === cacheKey) {
      setFilteredGames(prevFilterResultRef.current.result)
      return
    }
    const preFilteredIndices = games.reduce((acc, g, idx) => {
      if (favorites.has(g.appid) && !!g.header_image && !isF2PGame(g, dynamicFreeIds)) {
        acc.push(idx)
      }
      return acc
    }, [] as number[])
    sendToWorkerDebounced(preFilteredIndices, deferredSearchQuery, sortBy, cacheKey)
  }, [games, currentPage, favorites, deferredSearchQuery, sortBy, sendToWorkerDebounced, dynamicFreeIds])
  // Recent filter — pre-filter on main thread, send search+sort to worker
  useEffect(() => {
    if (currentPage !== 'recent') return
    const cacheKey = `recent|${games.length}|${recentGames.length}|${deferredSearchQuery}|${sortBy}`
    if (prevFilterResultRef.current?.key === cacheKey) {
      setFilteredGames(prevFilterResultRef.current.result)
      return
    }
    const preFilteredIndices = games.reduce((acc, g, idx) => {
      if (recentGames.includes(g.appid) && !!g.header_image && !isF2PGame(g, dynamicFreeIds)) {
        acc.push(idx)
      }
      return acc
    }, [] as number[])
    sendToWorkerDebounced(preFilteredIndices, deferredSearchQuery, sortBy, cacheKey)
  }, [games, currentPage, recentGames, deferredSearchQuery, sortBy, sendToWorkerDebounced, dynamicFreeIds])

  // Lines 1359-1362
  const realInstalledGamesCount = useMemo(
    () => installedGames.filter((g: any) => !g.isDlc).length,
    [installedGames]
  )


  // Nav items — original structure
  const navItems = useMemo(() => [
    { id: 'home', label: 'Home', icon: Sparkles, color: COLORS.amber, count: 0 },
    { id: 'browse', label: 'Catalogue', icon: LayoutGrid, color: COLORS.green, count: games.length },
    { id: 'library', label: 'My Library', icon: FolderHeart, color: COLORS.violet, count: installedGames.length },
    { id: 'favourites', label: 'Favourites', icon: Heart, color: COLORS.pink, count: favorites.size },
    { id: 'recent', label: 'Recently Viewed', icon: Clock, color: COLORS.amber, count: recentGames.length },
    { id: 'fixes', label: 'Steam Fixes', icon: Wrench, color: COLORS.blue, count: fixes.length },
    { id: 'settings', label: 'Settings', icon: Settings, color: COLORS.violet, count: 0 },
  ], [games.length, favorites.size, fixes.length, installedGames.length, recentGames.length])

  // Lines 1386-1434
  const filteredFixes = useMemo(() => {
    const query = fixSearchQuery ? fixSearchQuery.toLowerCase().trim() : ''
    const allFixes = (fixes || []) as unknown as Fix[]
    let result: Fix[] = []

    // Only show fixes that have a download URL and are not free-to-play games
    const validFixes = allFixes.filter(f => {
      const hasUrl = f.download_url && f.download_url.trim() !== ''
      const hasUrls = f.download_urls && f.download_urls.length > 0
      const isF2P = isF2PGame(f, dynamicFreeIds)
      return (hasUrl || hasUrls) && !isF2P
    })

    if (query === '') {
      // Sort by POPULAR order first, then alphabetical
      result = [...validFixes].sort((a, b) => {
        const orderA = popularOrder[a.appid]
        const orderB = popularOrder[b.appid]

        if (orderA !== undefined && orderB === undefined) return -1
        if (orderB !== undefined && orderA === undefined) return 1

        if (orderA !== undefined && orderB !== undefined) {
          return orderA - orderB
        }

        return (a.name || '').localeCompare(b.name || '')
      })
    } else {
      const isAppId = /^\d+$/.test(query)
      result = validFixes.filter(f => {
        const name = (f.name || '').toLowerCase()
        const appid = f.appid || ''
        if (isAppId) return appid === query
        return name.includes(query)
      })
      result.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    }

    // Badge filter (AND logic - must have ALL selected badges)
    if (fixFilter && !fixFilter.includes('All') && fixFilter.length > 0) {
      result = result.filter(f => {
        if (!f.badges || f.badges.length === 0) return false
        return fixFilter.every(filter => f.badges.includes(filter))
      })
    }

    return result
  }, [fixes, fixSearchQuery, fixFilter, popularOrder, dynamicFreeIds])

  // Lines 1439-1440
  const paginatedFixes = useMemo(
    () => filteredFixes.slice(fixPage * FIXES_PER_PAGE, (fixPage + 1) * FIXES_PER_PAGE),
    [filteredFixes, fixPage]
  )

  // Lines 1442-1455
  const toggleFixFilter = (id: string) => {
    if (id === 'All') {
      setFixFilter(['All'])
    } else {
      setFixFilter(prev => {
        if (prev.includes(id)) {
          const next = prev.filter(f => f !== id)
          return next.length === 0 ? ['All'] : next
        } else {
          return prev.filter(f => f !== 'All').concat(id)
        }
      })
    }
  }

  return {
    // Home page sections
    homeSections,
    recentGamesList,
    aiRecommendations,
    similarGames,
    fixableAppids,
    comingSoonAppids,
    filteredLibraryGames,
    // Browser
    filteredGames,
    popularGamesWithCover,
    // Fixes
    filteredFixes,
    paginatedFixes,
    fixPage,
    setFixPage,
    toggleFixFilter,
    // Navigation
    navItems,
    realInstalledGamesCount,
    // Constants
    FIX_FILTERS,
    gamesWithCover,
    // Filter helpers
    isF2PGame,
  }
}

export default useGameFilters
