import { useMemo, useRef, useState, useEffect, useLayoutEffect, useCallback, useDeferredValue, memo } from 'react'
import { Compass } from 'lucide-react'
import '../styles/card-animations.css'
import { Game } from '../types'
import { useGameStore, useUserStore, useSettingsStore, useInstalledGames, useReducedMotion } from '../store'
import { useShallow } from 'zustand/react/shallow'
import type { ColorScheme } from '../components/shared'
import { useImagePrefetch } from '../hooks/useImagePrefetch'
import { useVirtualizer } from '@tanstack/react-virtual'
import { PageBanner } from '../components/PageParts'
import {
  BrowseToolbar, BrowseGameGrid, BrowseEmpty, FilterPanel, EMPTY_FILTERS, TOGGLES,
  GAP_X, GRID_GAP_Y, GRID_META_H, WIDE_MIN, LIST_ROW_H, LIST_GAP,
  type BrowseFilters, type BrowseView, type CardHandlers, type SortKey, type ToggleKey,
} from '../components/browse'
import { useT } from '../i18n'
import { useGenreLabel } from '../utils/genreLabel'

export interface BrowsePageProps {
  handlers: {
    handleGameClick: (game: Game) => void
    toggleFavorite: (appid: string) => void
    handleContextMenu: (e: React.MouseEvent, game: Game) => void
    handleInstallGame: (game?: any) => void
    handleInstallFromZip: (game?: any) => void
    handleDeleteGame: (appid: string) => void
  }
  colors: ColorScheme
  gamesWithCover: Game[]
  filteredGames: Game[]
  popularGamesWithCover: Game[]
}

const COOP_RE = /co-?op|multiplayer/i
// Genre data lives in `genres`, or in Steam `tags` when the row has no genres (same fallback as getGenreTag).
const genresOf = (g: Game) => (g.genres && g.genres.length ? g.genres : g.tags) ?? []
const isCoop = (g: Game) => !!g.genres?.some(x => COOP_RE.test(x)) || !!g.tags?.some(x => COOP_RE.test(x))
const HIDDEN_GENRES = /^(free to play|early access)$/i
const VIEW_KEY = 'ahg.browse.view'

const BrowsePage = memo(({ handlers, gamesWithCover, filteredGames, popularGamesWithCover }: BrowsePageProps) => {
  const t = useT()
  const gl = useGenreLabel()
  const reduced = useReducedMotion()

  const { sortBy, fixes } = useGameStore(useShallow(s => ({ sortBy: s.sortBy, fixes: s.fixes })))
  const setSortBy = useGameStore(s => s.setSortBy)
  const selectedGames = useGameStore(s => s.selectedGames)
  const setSelectedGames = useGameStore(s => s.setSelectedGames)
  const favorites = useUserStore(s => s.favorites)
  const ownedGameIds = useUserStore(s => s.ownedGameIds)
  const { batchMode, compactMode, showOnlyOwned } = useSettingsStore(
    useShallow(s => ({ batchMode: s.batchMode, compactMode: s.compactMode, showOnlyOwned: s.showOnlyOwned }))
  )
  const installedGames = useInstalledGames()
  const installedAppids = useMemo(() => new Set(installedGames.map(g => g.appid)), [installedGames])
  const comingSoonAppids = useMemo(
    () => new Set(fixes.filter(f => !f.download_url || f.download_url.trim() === '').map(f => f.appid)),
    [fixes]
  )
  const fixableAppids = useMemo(
    () => new Set(fixes.filter(f => f.download_url || (f.download_urls && f.download_urls.length > 0)).map(f => f.appid)),
    [fixes]
  )

  const { handleGameClick, toggleFavorite, handleContextMenu, handleInstallGame } = handlers

  // ── Local UI state (design: bf filters, q, view, sort) ──
  const [q, setQ] = useState('')
  const dq = useDeferredValue(q)
  const [filters, setFilters] = useState<BrowseFilters>(EMPTY_FILTERS)
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [view, setViewState] = useState<BrowseView>(() => {
    try { const v = localStorage.getItem(VIEW_KEY); if (v === 'grid' || v === 'wide' || v === 'list') return v } catch { /* storage unavailable */ }
    return 'grid'
  })
  const setView = useCallback((v: BrowseView) => {
    setViewState(v)
    try { localStorage.setItem(VIEW_KEY, v) } catch { /* storage unavailable */ }
  }, [])
  // Newest / Smallest are applied here; popular / A-Z / Z-A ride the store's worker sort.
  const [extraSort, setExtraSort] = useState<'newest' | 'smallest' | null>(null)
  const sort: SortKey = extraSort ?? (sortBy === 'name_asc' ? 'az' : sortBy === 'name_desc' ? 'za' : 'popular')
  const setSort = useCallback((k: SortKey) => {
    setExtraSort(k === 'newest' || k === 'smallest' ? k : null)
    setSortBy(k === 'az' ? 'name_asc' : k === 'za' ? 'name_desc' : 'popularity')
  }, [setSortBy])

  // Brief fade while the grid swaps (design: discOut 100ms)
  const [fade, setFade] = useState(false)
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (fadeTimer.current) clearTimeout(fadeTimer.current) }, [])
  const applyFilters = useCallback((next: BrowseFilters) => {
    if (reduced) { setFilters(next); return }
    setFade(true)
    if (fadeTimer.current) clearTimeout(fadeTimer.current)
    fadeTimer.current = setTimeout(() => { setFilters(next); setFade(false) }, 100)
  }, [reduced])
  const onGenre = useCallback((id: string) => applyFilters({ ...filters, genres: filters.genres.includes(id) ? filters.genres.filter(x => x !== id) : [...filters.genres, id] }), [filters, applyFilters])
  const onToggle = useCallback((k: ToggleKey) => applyFilters({ ...filters, [k]: !filters[k] }), [filters, applyFilters])
  const clearAll = useCallback(() => applyFilters(EMPTY_FILTERS), [applyFilters])

  // Don't flash the empty state while the first worker result is still in flight
  const [settled, setSettled] = useState(false)
  useEffect(() => { const id = setTimeout(() => setSettled(true), 400); return () => clearTimeout(id) }, [])

  // ── Genre checklist: top genres by catalogue count (computed once per catalogue) ──
  const genreOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const g of gamesWithCover) {
      for (const x of genresOf(g)) if (x && !HIDDEN_GENRES.test(x)) counts.set(x, (counts.get(x) ?? 0) + 1)
    }
    return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, n]) => ({ id, n }))
  }, [gamesWithCover])

  // ── Results pipeline ──
  const results = useMemo(() => {
    let r = filteredGames
    if (showOnlyOwned) r = r.filter(g => ownedGameIds.has(String(g.appid)))
    const ql = dq.trim().toLowerCase()
    const f = filters
    if (ql || f.genres.length || f.fix || f.coop || f.lib || f.notLib || f.fav) {
      r = r.filter(g =>
        (!f.genres.length || genresOf(g).some(x => f.genres.includes(x))) &&
        (!f.fix || fixableAppids.has(g.appid)) &&
        (!f.coop || isCoop(g)) &&
        (!f.lib || installedAppids.has(g.appid)) &&
        (!f.notLib || !installedAppids.has(g.appid)) &&
        (!f.fav || favorites.has(g.appid)) &&
        (!ql || (g.name || '').toLowerCase().includes(ql) || ((g as { developer?: string }).developer || '').toLowerCase().includes(ql))
      )
    }
    if (extraSort === 'newest') r = [...r].sort((a, b) => (b.added_date || '').localeCompare(a.added_date || ''))
    else if (extraSort === 'smallest') r = [...r].sort((a, b) => (a.size || Infinity) - (b.size || Infinity))
    return r
  }, [filteredGames, showOnlyOwned, ownedGameIds, dq, filters, fixableAppids, installedAppids, favorites, extraSort])

  const filterCount = filters.genres.length + TOGGLES.filter(([k]) => filters[k]).length
  const pills = useMemo(() => [
    ...filters.genres.map(id => ({ key: 'g:' + id, label: gl(id), remove: () => onGenre(id) })),
    ...TOGGLES.filter(([k]) => filters[k]).map(([k, label]) => ({ key: k, label: t(label), remove: () => onToggle(k) })),
  ], [filters, gl, t, onGenre, onToggle])

  // ── Virtual rows: the whole page scrolls; rows are offset by the grid's top (scrollMargin) ──
  const scrollRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [scrollMargin, setScrollMargin] = useState(0)
  useLayoutEffect(() => {
    const s = scrollRef.current, c = contentRef.current, g = gridRef.current
    if (!s || !c || !g) return
    const update = () => {
      setWidth(g.clientWidth)
      setScrollMargin(Math.round(g.getBoundingClientRect().top - s.getBoundingClientRect().top + s.scrollTop))
    }
    const ro = new ResizeObserver(update)
    ro.observe(g); ro.observe(c)
    update()
    return () => ro.disconnect()
  }, [])

  const { columns, rowHeight } = useMemo(() => {
    if (view === 'list') return { columns: 1, rowHeight: LIST_ROW_H + LIST_GAP }
    const min = view === 'wide' ? WIDE_MIN : compactMode ? 142 : 172
    const cols = Math.max(1, Math.floor((width + GAP_X) / (min + GAP_X)))
    const cardW = (width - (cols - 1) * GAP_X) / cols
    return { columns: cols, rowHeight: view === 'wide' ? Math.ceil(cardW * 9 / 16) + GAP_X : Math.ceil(cardW * 1.5) + GRID_META_H + GRID_GAP_Y }
  }, [view, width, compactMode])

  const virtualizer = useVirtualizer({
    count: Math.ceil(results.length / columns),
    getScrollElement: useCallback(() => scrollRef.current, []),
    estimateSize: () => rowHeight,
    overscan: 3,
    scrollMargin,
  })
  useEffect(() => { virtualizer.measure() }, [rowHeight, virtualizer])

  useImagePrefetch(virtualizer, useCallback((rowIndex: number) => {
    const start = rowIndex * columns
    return results.slice(start, start + columns)
  }, [results, columns]))

  const h: CardHandlers = useMemo(() => ({
    open: handleGameClick, fav: toggleFavorite, ctx: handleContextMenu, install: handleInstallGame,
    select: (appid: string) => setSelectedGames(prev => { const n = new Set(prev); if (n.has(appid)) n.delete(appid); else n.add(appid); return n }),
  }), [handleGameClick, toggleFavorite, handleContextMenu, handleInstallGame, setSelectedGames])
  const flags = useMemo(() => ({ batchMode, selected: selectedGames, favorites, installed: installedAppids, comingSoon: comingSoonAppids }),
    [batchMode, selectedGames, favorites, installedAppids, comingSoonAppids])

  const bannerGames = popularGamesWithCover.length >= 4 ? popularGamesWithCover : gamesWithCover
  const banner = useMemo(() => bannerGames.slice(0, 4), [bannerGames])

  return (
    <div ref={scrollRef} key="browse" className="h-full" style={{ overflow: 'auto', position: 'relative', scrollbarWidth: 'thin' }}>
      <div ref={contentRef} style={{ padding: 24, maxWidth: 1680, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <PageBanner
          icon={Compass} color="#60a5fa" eyebrow={t('app.browse.hdrEyebrow')} title={t('app.nav.browse')} sub={t('app.browse.hdrSub')}
          games={banner} reduced={reduced}
          stats={[
            { v: results.length.toLocaleString(), label: t('app.browse.matching') },
            { v: gamesWithCover.length.toLocaleString(), label: t('app.browse.inCatalogue') },
            { v: fixableAppids.size.toLocaleString(), label: t('app.browse.withFixes') },
          ]}
        />

        <BrowseToolbar
          q={q} setQ={setQ} filtersOpen={filtersOpen} toggleFilters={() => setFiltersOpen(o => !o)}
          filterCount={filterCount} pills={pills} clearAll={clearAll}
          sort={sort} setSort={setSort} view={view} setView={setView}
        />

        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
          {filtersOpen && <FilterPanel genres={genreOptions} filters={filters} onGenre={onGenre} onToggle={onToggle} />}
          <div ref={gridRef} style={{ flex: 1, minWidth: 0, transition: 'opacity .12s', opacity: fade ? 0 : 1 }}>
            {results.length === 0
              ? (settled ? <BrowseEmpty onClear={() => { setQ(''); applyFilters(EMPTY_FILTERS) }} /> : null)
              : <BrowseGameGrid items={results} view={view} columns={columns} scrollMargin={scrollMargin} virtualizer={virtualizer} h={h} flags={flags} />}
          </div>
        </div>
      </div>
    </div>
  )
})

export default BrowsePage
