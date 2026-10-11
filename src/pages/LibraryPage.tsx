import { useState, useMemo, memo, useCallback, useEffect, useDeferredValue } from 'react'
import { FolderHeart, Search, X, Library, Heart, Ellipsis, HardDrive, Puzzle, Play, RefreshCw, CircleCheck, Wrench, Minus } from 'lucide-react'
import { useGameStore, useUserStore, useSettingsStore, useReducedMotion } from '../store'
import { useShallow } from 'zustand/react/shallow'
import { useSetCurrentPage } from '../store/uiStore'
import { useImagePrefetch } from '../hooks/useImagePrefetch'
import { useDirectionalCoverPrefetch } from '../hooks/useDirectionalCoverPrefetch'
import { useVirtualKeyboardNav } from '../hooks/useVirtualKeyboardNav'
import { fuzzySearch } from '../hooks/useFuzzySearch'
import type { PageHandlers } from '../types/pages'
import { loadAllCachedImages, preloadLibraryImages } from '../services/imageCache'
import { bridge } from '../bridge'
import { useFixState } from '../components/fixes/fixState'
import { t as tr } from '../i18n'
import GameCover from '../components/GameCover'
import { IMAGE_TYPES } from '../services/imageCache'
import { getGenreHue, getGenreTag, formatBytes } from '../utils/gameHelpers'
import type { Game } from '../types'
import { PageBanner, PageEmpty, VirtualRows, useVirtualGrid, MONO, ACC, panelStyle, rise } from '../components/PageParts'
import { LibrarySkeleton } from '../components/Skeletons'
import { useT } from '../i18n'
import { useGenreLabel } from '../utils/genreLabel'

// ── Props ──
interface LibraryPageProps {
  handlers: Pick<PageHandlers, 'handleGameClick' | 'handleDeleteGame' | 'handleContextMenu' | 'toggleFavorite' | 'handleInstallGame' | 'handleInstallFromZip' | 'showToast'>
  colors: typeof import('../constants/colors').COLORS
}

// ── Page Component ──
const LibraryPage = memo(function LibraryPage({ handlers, colors }: LibraryPageProps) {
  const t = useT()

  const { librarySearchQuery, setLibrarySearchQuery, games, knownDlcIds, installedGames, gamesWithUpdates, fixes } = useGameStore(useShallow(s => ({
    librarySearchQuery: s.librarySearchQuery,
    setLibrarySearchQuery: s.setLibrarySearchQuery,
    games: s.games,
    knownDlcIds: s.knownDlcIds,
    installedGames: s.installedGames,
    gamesWithUpdates: s.gamesWithUpdates,
    fixes: s.fixes,
  })))
  const deferredLibrarySearchQuery = useDeferredValue(librarySearchQuery)

  const favorites = useUserStore(s => s.favorites)

  const compactMode = useSettingsStore(s => s.compactMode)
  const reduced = useReducedMotion()
  const [tab, setTab] = useState<'all' | 'ready' | 'update' | 'fav'>('all')

  const setCurrentPage = useSetCurrentPage()
  const { handleGameClick, handleContextMenu, handleInstallGame, showToast } = handlers

  const [isLoading, setIsLoading] = useState(true)
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 300)
    return () => clearTimeout(timer)
  }, [])

  // Build set of known DLC appids from master games.json and session-discovered DLCs
  const dlcAppids = useMemo(() => {
    const ids = new Set(games.filter(g => (g.type || '').toLowerCase() === 'dlc' || g.isDlc).map(g => g.appid))
    for (const id of knownDlcIds) ids.add(id)
    return ids
  }, [games, knownDlcIds])

  // ── Cache hydration & background preloader ──
  // On mount: bulk-read ALL cached entries from IndexedDB into memory (one transaction instead of N)
  // Then kick off low-priority preloading for all installed games
  useEffect(() => {
    loadAllCachedImages().then(count => {
      if (count > 0) {
        // console.log(`[Cache] Hydrated ${count} entries from IndexedDB`);
      }
    })
    // Kick off background preloading for all installed games (chunked, idle-priority)
    preloadLibraryImages(installedGames)
  }, [installedGames])

  // Library filtering: exclude DLCs + soundtracks + software + truly nameless entries, filter by search
  const filteredLibraryGames = useMemo(() => {
    const preFilter = installedGames.filter(g => {
      if (g.isDlc || (g.type || '').toLowerCase() === 'dlc' || (g.type || '').toLowerCase() === 'software') return false
      if (dlcAppids.has(g.appid)) return false
      // Filter soundtracks (Steam music-type apps)
      if ((g.type || '').toLowerCase() === 'music') return false
      if ((g.name || '').toLowerCase().includes('soundtrack')) return false
      if (!g.name || g.name.trim() === '') return false
      // Allow "App {appid}" names — these are legitimately installed games whose name
      // couldn't be resolved from games.json. Better to show them than hide them.
      if (g.name.trim() === g.appid) return false
      return true
    })
    if (deferredLibrarySearchQuery.trim()) {
      const q = deferredLibrarySearchQuery.toLowerCase().trim()
      const result = preFilter.filter(g =>
        g.name?.toLowerCase().includes(q) ||
        g.appid.includes(q)
      )
      if (result.length < 3 && q.length > 2) {
        const fuzzyResults = fuzzySearch(preFilter, q)
        if (fuzzyResults.length > 0) {
          return fuzzyResults
        }
      }
      return result
    }
    return preFilter
  }, [installedGames, deferredLibrarySearchQuery, dlcAppids])

  // ── Fuzzy match detection (for badge display) ──
  const libraryFuzzyActive = useMemo(() => {
    const query = deferredLibrarySearchQuery.trim()
    if (!query || query.length <= 2) return false
    const q = query.toLowerCase()
    const preFilter = installedGames.filter(g => {
      if (g.isDlc || (g.type || '').toLowerCase() === 'dlc' || (g.type || '').toLowerCase() === 'software') return false
      if (dlcAppids.has(g.appid)) return false
      if ((g.type || '').toLowerCase() === 'music') return false
      if ((g.name || '').toLowerCase().includes('soundtrack')) return false
      if (!g.name || g.name.trim() === '') return false
      if (g.name.trim() === g.appid) return false
      return true
    })
    const exact = preFilter.filter(g =>
      g.name?.toLowerCase().includes(q) ||
      g.appid.includes(q)
    )
    if (exact.length >= 3) return false
    const fuzzyResults = fuzzySearch(preFilter, q, 0.35)
    return fuzzyResults.length > 0
  }, [installedGames, deferredLibrarySearchQuery, dlcAppids])

  // ── Tabs (All / Ready / Updates / Favourites) over the search-filtered set ──
  const isUpd = useCallback((g: Game) => gamesWithUpdates.has(String(g.appid)), [gamesWithUpdates])
  const counts = useMemo(() => {
    const upd = filteredLibraryGames.filter(isUpd).length
    return { all: filteredLibraryGames.length, ready: filteredLibraryGames.length - upd, update: upd, fav: filteredLibraryGames.filter(g => favorites.has(g.appid)).length }
  }, [filteredLibraryGames, isUpd, favorites])
  const shown = useMemo(
    () => tab === 'all' ? filteredLibraryGames
      : tab === 'fav' ? filteredLibraryGames.filter(g => favorites.has(g.appid))
      : filteredLibraryGames.filter(g => isUpd(g) === (tab === 'update')),
    [tab, filteredLibraryGames, favorites, isUpd],
  )
  const fixAppids = useMemo(() => new Set(fixes.filter(f => f.download_url || f.download_urls?.length).map(f => String(f.appid))), [fixes])
  const appliedMap = useFixState(s => s.applied)
  const appliedInLib = useMemo(() => installedGames.filter(g => appliedMap[g.appid]).length, [installedGames, appliedMap])

  // ── Virtual scrolling (list rows, as in the design) ──
  const { scrollRef, columns, virtualizer } = useVirtualGrid(shown.length, {
    grid: false, listRow: compactMode ? 72 : 102, overscan: 2,
  })

  useImagePrefetch(virtualizer, useCallback((rowIndex: number) => {
    const startIdx = rowIndex * columns
    return shown.slice(startIdx, startIdx + columns)
  }, [shown, columns]))

  useDirectionalCoverPrefetch(virtualizer, shown, 20)

  // ── Keyboard navigation ──
  const { focusedIndex, keyboardProps } = useVirtualKeyboardNav(
    virtualizer, shown, (game) => handleGameClick(game), columns,
  )

  const tabs = [['all', t('app.common.all'), counts.all], ['ready', t('app.lib.ready'), counts.ready], ['update', t('app.lib.updates'), counts.update], ['fav', t('app.nav.favourites'), counts.fav]] as const

  const launch = useCallback(async (game: Game) => {
    useUserStore.getState().addToRecent(game.appid)
    try {
      const r = await bridge.launchGame(game.appid)
      if (!r?.success) showToast(r?.message || tr('app.lib.launchFail', { name: game.name ?? '' }), 'error')
    } catch { showToast(tr('app.lib.launchFail', { name: game.name ?? '' }), 'error') }
  }, [showToast])
  const update = useCallback((game: Game) => { useGameStore.getState().setSelectedGame(game as any); void (handleInstallGame as (g?: Game) => Promise<void>)(game) }, [handleInstallGame])

  return (
    <div key="library" className="flex flex-col h-full" style={{ padding: 24, gap: 18, maxWidth: 1680, margin: '0 auto', width: '100%' }}>
      <PageBanner
        icon={Library} color={ACC} eyebrow={t('app.side.yourGames')} title={t('app.nav.library')}
        sub={t('app.lib.sub')}
        games={installedGames.length ? shown.slice(0, 4) : []} reduced={reduced}
        stats={[
          { v: installedGames.length.toLocaleString(), label: t('app.lib.games') },
          { v: counts.update.toLocaleString(), label: t('app.lib.updates'), color: counts.update ? '#fbbf24' : '#fff' },
          { v: appliedInLib.toLocaleString(), label: t('app.lib.fixesApplied'), color: '#86efac' },
        ]}
      />

      {/* Toolbar: tabs · search · view */}
      <div className="shrink-0" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', animation: rise(reduced, '.35s', '.03s') }}>
        <div role="tablist" aria-label={t('app.lib.filter')} style={{ display: 'flex', gap: 2, padding: 3, borderRadius: 12, background: 'var(--s2,#151524)', border: '1px solid rgba(255,255,255,.08)' }}>
          {tabs.map(([id, label, n]) => {
            const on = tab === id
            return (
              <button key={id} role="tab" aria-selected={on} onClick={() => setTab(id)} className="v2-seg-btn"
                style={{ height: 32, padding: '0 14px', border: 'none', borderRadius: 9, background: on ? 'rgba(255,255,255,.1)' : 'transparent', color: on ? '#fff' : '#a6a5bb', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                {label}<span style={{ fontFamily: MONO, fontSize: 11, opacity: .65 }}>{n}</span>
              </button>
            )
          })}
        </div>
        <span style={{ flex: 1 }} />
        <div style={{ position: 'relative', width: 'min(280px,100%)' }}>
          <Search size={15} style={{ position: 'absolute', insetInlineStart: 13, top: '50%', transform: 'translateY(-50%)', color: '#8b8aa3', pointerEvents: 'none' }} />
          <input
            type="text" aria-label={t('app.lib.search')} placeholder={t('app.lib.search')}
            value={librarySearchQuery} onChange={(e) => setLibrarySearchQuery(e.target.value)}
            className="v2-field"
            style={{ width: '100%', height: 38, borderRadius: 12, border: '1px solid rgba(255,255,255,.09)', background: 'var(--s2,#151524)', color: '#fff', fontSize: 13, paddingInlineStart: 36, paddingInlineEnd: 34, outline: 'none' }}
          />
          {libraryFuzzyActive && (
            <span style={{ position: 'absolute', insetInlineEnd: 34, top: '50%', transform: 'translateY(-50%)', fontFamily: MONO, fontSize: 10, fontWeight: 600, letterSpacing: '.08em', padding: '2px 6px', borderRadius: 6, background: 'color-mix(in oklch, var(--acc,#a77dff) 18%, transparent)', color: ACC }}>{t('app.fixes.fuzzy')}</span>
          )}
          {librarySearchQuery && (
            <button onClick={() => setLibrarySearchQuery('')} aria-label={t('app.header.clearSearch')} className="v2-icobtn"
              style={{ position: 'absolute', insetInlineEnd: 6, top: 6, width: 26, height: 26, border: 'none', borderRadius: 8, background: 'transparent', color: '#8b8aa3', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Game listing — virtualized */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-auto outline-none"
        style={!isLoading && shown.length > 0 ? { ...panelStyle, animation: rise(reduced, '.35s', '.05s') } : undefined}
        {...keyboardProps}
      >
        {isLoading ? (
          <LibrarySkeleton colors={colors} columns={columns > 1 ? columns : 1} />
        ) : installedGames.length === 0 ? (
          <PageEmpty reduced={reduced} icon={FolderHeart} tint={ACC} title={t('app.lib.emptyTitle')} subtitle={t('app.lib.emptySub')} action={{ label: t('app.common.browseGames'), onClick: () => setCurrentPage('browse') }} />
        ) : shown.length === 0 ? (
          <PageEmpty reduced={reduced} icon={tab === 'fav' && !librarySearchQuery ? Heart : Search} tint={ACC}
            title={tab === 'fav' && !librarySearchQuery ? t('app.lib.noFavInstalled') : t('app.lib.noMatch')}
            subtitle={librarySearchQuery ? t('app.lib.noMatchQ', { q: librarySearchQuery }) : t('app.lib.heartHint')} />
        ) : (
          <VirtualRows items={shown} grid={false} columns={columns} virtualizer={virtualizer} renderItem={(game, idx) => {
            const focused = idx === focusedIndex
            return (
              <div key={game.appid} style={{ outline: focused ? `2px solid ${ACC}` : 'none', outlineOffset: -2, transition: 'outline-color 80ms cubic-bezier(0.4, 0, 0.2, 1)' }}>
                <LibraryRow game={game} compact={compactMode} reduced={reduced} delay={Math.min(idx * 0.02, 0.3)}
                  hasUpdate={isUpd(game)} fixState={appliedMap[game.appid] ? 'applied' : fixAppids.has(String(game.appid)) ? 'available' : 'none'}
                  onOpen={handleGameClick} onLaunch={launch} onUpdate={update} onContextMenu={handleContextMenu} />
              </div>
            )
          }} />
        )}
      </div>
    </div>
  )
})

// ── List row (design: cover, title/genre, status, meta, actions) ──
const COL_LABEL: React.CSSProperties = { fontFamily: MONO, fontSize: 10, fontWeight: 600, letterSpacing: '.14em', color: '#6f6e86' }

const LibraryRow = memo(function LibraryRow({ game, compact, reduced, delay, hasUpdate, fixState, onOpen, onLaunch, onUpdate, onContextMenu }: {
  game: Game; compact: boolean; reduced: boolean; delay: number; hasUpdate: boolean; fixState: 'applied' | 'available' | 'none'
  onOpen: (g: Game) => void; onLaunch: (g: Game) => void; onUpdate: (g: Game) => void; onContextMenu: (e: React.MouseEvent, g: Game) => void
}) {
  const t = useT()
  const gl = useGenreLabel()
  const rawTag = getGenreTag(game)
  const tag = rawTag ? gl(rawTag) : rawTag
  const dlc = game.dlc_count ?? (game.dlc ? Object.keys(game.dlc).length : 0)
  const size = game.size ? formatBytes(game.size) : ''
  const w = compact ? 40 : 52
  const sc = hasUpdate ? '#fbbf24' : '#4ade80'
  const fx = fixState === 'applied' ? { c: '#86efac', I: CircleCheck, l: t('app.fix.applied') } : fixState === 'available' ? { c: '#fbbf24', I: Wrench, l: t('app.lib.fixAvail') } : { c: '#6f6e86', I: Minus, l: t('app.lib.fixNone') }
  return (
    <div
      className="v2-lrow"
      onContextMenu={(e) => onContextMenu(e, game)}
      style={{
        height: compact ? 72 : 102, display: 'flex', alignItems: 'center', gap: 28, boxSizing: 'border-box',
        paddingBlock: compact ? 8 : 14, paddingInlineStart: compact ? 16 : 20, paddingInlineEnd: compact ? 14 : 18, borderBottom: '1px solid rgba(255,255,255,.045)',
        animation: reduced ? undefined : `v2-riseIn .3s cubic-bezier(.16,1,.3,1) ${delay}s both`,
      }}
    >
      <div onClick={() => onOpen(game)} style={{ flex: '1 1 240px', display: 'flex', alignItems: 'center', gap: 16, minWidth: 0, cursor: 'pointer' }}>
        <div style={{ width: w, height: Math.round(w * 1.42), flex: 'none', borderRadius: 10, overflow: 'hidden', background: '#10101c', boxShadow: '0 10px 24px -10px rgba(0,0,0,.9)' }}>
          <GameCover appid={game.appid} name={game.name} localHeader={game.header_image || undefined}
            preferredImageTypes={IMAGE_TYPES.PORTRAIT} genreHue={getGenreHue(game)} webglDisabled className="w-full h-full" />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15.5, fontWeight: 650, color: '#f3f2fa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{game.name}</div>
          <div style={{ fontSize: 12.5, color: '#8b8aa3', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{[tag, t('app.card.appId', { id: game.appid })].filter(Boolean).join(' · ')}</div>
        </div>
      </div>
      <div className="hidden md:flex" style={{ gap: 28, flex: 'none' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 108 }}>
          <span style={COL_LABEL}>{t('app.lib.status')}</span>
          <span style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 7, height: 24, padding: '0 9px', borderRadius: 8, background: hasUpdate ? 'rgba(245,158,11,.12)' : 'rgba(34,197,94,.12)', color: sc, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: sc, boxShadow: `0 0 8px ${sc}` }} />{hasUpdate ? t('app.lib.updateAvail') : t('app.lib.ready')}
          </span>
        </div>
        <div className="hidden lg:flex" style={{ flexDirection: 'column', gap: 6, minWidth: 96 }}>
          <span style={COL_LABEL}>{t('app.lib.size')}</span>
          <span style={{ fontSize: 13, color: '#c9c8da', lineHeight: '24px', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}><HardDrive size={14} />{size || '—'}</span>
        </div>
        <div className="hidden xl:flex" style={{ flexDirection: 'column', gap: 6, minWidth: 70 }}>
          <span style={COL_LABEL}>DLC</span>
          <span style={{ fontSize: 13, color: dlc ? '#c9c8da' : '#6f6e86', lineHeight: '24px', display: 'flex', alignItems: 'center', gap: 6 }}><Puzzle size={14} />{dlc || '—'}</span>
        </div>
        <div className="hidden lg:flex" style={{ flexDirection: 'column', gap: 6, minWidth: 86 }}>
          <span style={COL_LABEL}>{t('app.lib.fixes')}</span>
          <span style={{ fontSize: 13, color: fx.c, lineHeight: '24px', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}><fx.I size={14} />{fx.l}</span>
        </div>
      </div>
      <div style={{ flex: 'none', display: 'flex', gap: 8, marginInlineStart: 'auto' }}>
        <button onClick={() => hasUpdate ? onUpdate(game) : onLaunch(game)} className="v2-pill"
          aria-label={`${hasUpdate ? t('app.card.update') : t('app.lib.launch')} ${game.name ?? ''}`}
          style={{ height: 38, minWidth: 108, padding: '0 14px', borderRadius: 11, border: 'none', background: hasUpdate ? '#f59e0b' : 'var(--acc,#a77dff)', color: hasUpdate ? '#1f1300' : '#0b0614', fontSize: 13, fontWeight: 650, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, transition: 'transform .15s, filter .15s' }}>
          {hasUpdate ? <RefreshCw size={14} /> : <Play size={14} />}{hasUpdate ? t('app.card.update') : t('app.lib.launch')}
        </button>
        <button onClick={(e) => onContextMenu(e, game)} aria-label={t('app.lib.moreNamed', { name: game.name ?? '' })} title={t('app.lib.more')} className="v2-icobtn"
          style={{ width: 38, height: 38, flex: 'none', borderRadius: 11, border: '1px solid rgba(255,255,255,.09)', background: 'transparent', color: '#a6a5bb', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Ellipsis size={16} />
        </button>
      </div>
    </div>
  )
})

export default LibraryPage
