import { useState, useMemo, memo, useRef, useCallback, useEffect, useDeferredValue } from 'react'
import { motion } from 'framer-motion'
import { FolderHeart, Layout, List, Search, X, Sparkles } from 'lucide-react'
import '../styles/browse-animations.css'
import { useGameStore, useUserStore, useSettingsStore } from '../store'
import { useShallow } from 'zustand/react/shallow'
import { COLORS } from '../constants/colors'
import { useSetCurrentPage } from '../store/uiStore'
import { useImagePrefetch } from '../hooks/useImagePrefetch'
import { useDirectionalCoverPrefetch } from '../hooks/useDirectionalCoverPrefetch'
import { useVirtualKeyboardNav } from '../hooks/useVirtualKeyboardNav'
import { useVirtualizer } from '@tanstack/react-virtual'
import { fuzzySearch } from '../hooks/useFuzzySearch'
import type { PageHandlers } from '../types/pages'
import { loadAllCachedImages, preloadLibraryImages } from '../services/imageCache'
import { PortraitCard, LibraryListCard } from '../components/shared'
import { LibrarySkeleton } from '../components/Skeletons'
import { PageHeroBackdrop } from '../components/PageHeroBackdrop'

// ── Sub-components ──
const EmptyState = memo(function EmptyState({ icon: Icon, title, subtitle, color, action }: {
  icon: any; title: string; subtitle: string; color: string; action?: { label: string; onClick: () => void }
}) {
  return (
    <div className="text-center py-24">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', damping: 10 }}
        className="relative w-24 h-24 mx-auto mb-6 rounded-3xl flex items-center justify-center"
        style={{
          background: `linear-gradient(135deg, ${color}25 0%, ${color}10 100%)`,
          border: `1px solid ${color}30`,
          boxShadow: `0 0 40px ${color}15, 0 0 80px ${color}08`,
        }}
      >
        <div
          className="absolute inset-0 rounded-3xl opacity-50"
          style={{ background: `radial-gradient(circle at 50% 50%, ${color}15 0%, transparent 70%)` }}
        />
        <Icon size={44} style={{ color, position: 'relative', zIndex: 1 }} />
      </motion.div>
      <h3 className="text-2xl font-extrabold text-white mb-2 tracking-tight">{title}</h3>
      <p className="text-base mb-7" style={{ color: COLORS.textMuted }}>{subtitle}</p>
      {action && (
        <motion.button
          onClick={action.onClick}
          whileHover={{ scale: 1.04, boxShadow: `0 0 30px ${color}40, 0 0 60px ${color}15` }}
          whileTap={{ scale: 0.96, filter: 'brightness(0.85)' }}
          className="px-7 py-3 rounded-xl text-sm font-bold inline-flex items-center gap-2 cursor-pointer"
          style={{
            background: `linear-gradient(135deg, ${color}25 0%, ${color}12 100%)`,
            color,
            border: `1px solid ${color}45`,
            boxShadow: `0 4px 16px ${color}20`,
            transition: 'all 80ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {action.label}
        </motion.button>
      )}
    </div>
  )
})

// ── Props ──
interface LibraryPageProps {
  handlers: Pick<PageHandlers, 'handleGameClick' | 'handleDeleteGame' | 'handleContextMenu' | 'toggleFavorite' | 'handleInstallGame' | 'handleInstallFromZip'>
  colors: typeof import('../constants/colors').COLORS
}

// ── Page Component ──
const LibraryPage = memo(function LibraryPage({ handlers, colors }: LibraryPageProps) {

  const { librarySearchQuery, setLibrarySearchQuery, setViewMode, games, knownDlcIds, installedGames, viewMode } = useGameStore(useShallow(s => ({
    librarySearchQuery: s.librarySearchQuery,
    setLibrarySearchQuery: s.setLibrarySearchQuery,
    setViewMode: s.setViewMode,
    games: s.games,
    knownDlcIds: s.knownDlcIds,
    installedGames: s.installedGames,
    viewMode: s.viewMode,
  })))
  const deferredLibrarySearchQuery = useDeferredValue(librarySearchQuery)

  const favorites = useUserStore(s => s.favorites)

  const compactMode = useSettingsStore(s => s.compactMode)

  const setCurrentPage = useSetCurrentPage()
  const { handleGameClick, handleDeleteGame, handleContextMenu } = handlers

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

  // ── Hero visibility guard (saves GPU cycles when hero is off-screen) ──
  const heroRef = useRef<HTMLDivElement>(null)
  const [, setIsHeroVisible] = useState(true)
  useEffect(() => {
    const el = heroRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const obs = new IntersectionObserver(([entry]) => setIsHeroVisible(entry!.isIntersecting), { rootMargin: '100px 0px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

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

  // ── Virtual scrolling ──
  const scrollRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width)
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const CELL_WIDTH = 200
  const GRID_GAP = 24
  const ROW_GAP = 24
  const effectiveColumns = viewMode === 'grid'
    ? Math.max(1, Math.floor((containerWidth + GRID_GAP) / (CELL_WIDTH + GRID_GAP)))
    : 1
  const actualCellWidth = effectiveColumns > 1
    ? (containerWidth - (effectiveColumns - 1) * GRID_GAP) / effectiveColumns
    : CELL_WIDTH
  const computedCardHeight = Math.ceil(actualCellWidth * 3 / 2)
  const rowHeight = viewMode === 'grid' ? computedCardHeight + ROW_GAP : 88 + 8
  const rowCount = Math.ceil(filteredLibraryGames.length / effectiveColumns)

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: useCallback(() => scrollRef.current, []),
    estimateSize: () => rowHeight,
    overscan: 2,
  })

  useImagePrefetch(virtualizer, useCallback((rowIndex: number) => {
    const startIdx = rowIndex * effectiveColumns
    return filteredLibraryGames.slice(startIdx, startIdx + effectiveColumns)
  }, [filteredLibraryGames, effectiveColumns]))

  useDirectionalCoverPrefetch(virtualizer, filteredLibraryGames, 20)

  // ── Keyboard navigation ──
  const { focusedIndex, keyboardProps } = useVirtualKeyboardNav(
    virtualizer,
    filteredLibraryGames,
    (game) => handleGameClick(game),
    effectiveColumns,
  )

  return (
    <div key="library" className="lg:pl-8 px-5 pt-2 pb-6 flex flex-col h-full">
      {/* ── Hero — Compact Premium ── */}
      <motion.div
        ref={heroRef}
        className="relative min-h-[160px] lg:min-h-[180px] overflow-hidden rounded-2xl mb-8"
        style={{
          background: `linear-gradient(135deg, ${colors.bgDark} 0%, ${colors.bgCard} 50%, ${colors.bgDark} 100%)`,
          border: `1px solid ${colors.violet}20`,
          boxShadow: `0 8px 32px ${colors.violet}10, inset 0 0 30px ${colors.violet}03`,
        }}
        whileHover={{ scale: 1.003 }}
        transition={{ duration: 0.3 }}
      >
        {/* Content-driven cover backdrop (your top installed game) */}
        <PageHeroBackdrop game={filteredLibraryGames[0]} accent={colors.violet} />

        {/* Rotating ambient orbs */}
        <div className="absolute -top-20 -right-10 w-[300px] h-[300px] rounded-full blur-[60px] animate-[heroOrbRotate_45s_linear_infinite] pointer-events-none"
          style={{ background: `radial-gradient(circle, ${colors.violet}30 0%, transparent 70%)` }}
        />
        <div className="absolute -bottom-20 -left-10 w-[240px] h-[240px] rounded-full blur-[50px] animate-[heroOrbRotate_55s_linear_infinite] pointer-events-none"
          style={{ animationDirection: 'reverse', background: `radial-gradient(circle, ${colors.blue}25 0%, transparent 70%)` }}
        />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[200px] h-[200px] rounded-full blur-[45px] animate-[heroOrbRotate_40s_linear_infinite] pointer-events-none"
          style={{ background: `radial-gradient(circle, ${colors.purple}20 0%, transparent 70%)` }}
        />

        {/* Floating particles */}
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={`library-particle-${i}`}
            className="absolute rounded-full pointer-events-none animate-[heroParticleFloat_8s_ease-in-out_infinite]"
            style={{
              width: 1.5 + (i % 3) * 1, height: 1.5 + (i % 3) * 1,
              background: i % 2 === 0
                ? `radial-gradient(circle, ${colors.violet}80 0%, transparent 100%)`
                : `radial-gradient(circle, ${colors.blue}80 0%, transparent 100%)`,
              left: `${(i * 10) % 100}%`, top: `${((i * 13 + 7) % 100)}%`,
              animationDuration: `${6 + (i % 4) * 2}s`, animationDelay: `${(i % 8) * 0.3}s`,
            }}
          />
        ))}

        {/* Animated grid dot pattern */}
        <div
          className="absolute inset-0 animate-[gridDotPulse_5s_ease-in-out_infinite] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle, ${colors.violet}80 0.5px, transparent 0.5px)`,
            backgroundSize: '24px 24px',
            maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 100%)',
            WebkitMaskImage: 'linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 100%)',
          }}
        />

        {/* Pulsing glow ring */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] rounded-full pointer-events-none animate-[glowRingPulse_4s_ease-in-out_infinite,glowRingRotate_30s_linear_infinite]"
          style={{
            border: `1px solid ${colors.violet}20`,
            boxShadow: `0 0 60px ${colors.violet}10, inset 0 0 60px ${colors.violet}05`,
          }}
        />

        {/* Bottom vignette */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(180deg, transparent 0%, rgba(3,3,8,0.6) 100%)' }} />

        {/* Light sweep animation */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            className="absolute inset-0 animate-[lightSweep_8s_ease-in-out_2s_infinite]"
            style={{ background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.04) 50%, transparent 70%)' }}
          />
        </div>

        {/* ── Content ── */}
        <div className="relative z-10 flex flex-col items-center justify-center h-full min-h-[160px] lg:min-h-[180px] px-6 text-center">
          {/* Top Row: Badge + Stats | View Toggle */}
          <div className="flex items-center justify-between gap-4 w-full">
            <motion.div
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: 'spring', stiffness: 120, damping: 15, delay: 0.04 }}
              className="flex items-center gap-2.5"
            >
              <span
                className="text-[10px] font-semibold tracking-[0.18em] uppercase px-3 py-1 rounded-full flex items-center gap-1.5"
                style={{
                  background: `${colors.violet}25`,
                  color: colors.violetLight,
                  border: `1px solid ${colors.violet}40`,
                }}
              >
                <FolderHeart size={10} />
                Library
              </span>
              <div className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: colors.violet, boxShadow: `0 0 8px ${colors.violet}` }}
              />
              <span className="text-[11px] font-medium" style={{ color: colors.textMuted }}>
                {filteredLibraryGames.length.toLocaleString()} installed
              </span>
            </motion.div>

            {/* View Toggle Button */}
            <motion.div
              initial={{ opacity: 0, x: 14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: 'spring', stiffness: 100, damping: 20, delay: 0.18 }}
              className="flex items-center gap-2"
            >
              <motion.button
                onClick={() => setViewMode(v => v === 'grid' ? 'list' : 'grid')}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95, filter: 'brightness(0.85)' }}
                className="h-9 px-4 rounded-xl flex items-center gap-2 text-xs font-semibold"
                style={{ background: `${colors.bgCard}cc`, border: `1px solid ${colors.border}`, backdropFilter: 'blur(8px)' }}
              >
                {viewMode === 'grid' ? <Layout size={14} style={{ color: colors.violet }} /> : <List size={14} style={{ color: colors.textSecondary }} />}
                <span style={{ color: viewMode === 'grid' ? colors.violet : colors.textSecondary }}>{viewMode === 'grid' ? 'Grid' : 'List'}</span>
              </motion.button>
            </motion.div>
          </div>

          {/* Title Block — Clean */}
          <div className="flex flex-col justify-center flex-1">
            <motion.h1
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 100, damping: 18, delay: 0.08, mass: 0.6 }}
              className="text-3xl lg:text-4xl xl:text-5xl font-bold tracking-tight leading-tight"
              style={{
                background: `linear-gradient(135deg, ${colors.text} 15%, var(--accent) 85%, ${colors.purple} 100%)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              My Library
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 80, damping: 22, delay: 0.15 }}
              className="text-xs mt-1 leading-relaxed"
              style={{ color: colors.textDim }}
            >
              Your installed game collection
            </motion.p>
          </div>
        </div>
      </motion.div>

      {/* Search Bar */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="flex-1 relative min-w-[200px] max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2" size={16} style={{ color: COLORS.textMuted }} />
          <input
            type="text"
            placeholder="Search installed games..."
            value={librarySearchQuery}
            onChange={(e) => setLibrarySearchQuery(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-xl text-sm outline-none transition-all"
            style={{
              background: colors.bgCard,
              border: `1px solid ${librarySearchQuery ? colors.violet + '40' : colors.border}`,
              color: colors.text,
              boxShadow: librarySearchQuery ? `0 0 15px ${colors.violet}15` : 'none'
            }}
          />
          {libraryFuzzyActive && (
            <span
              className="absolute right-12 top-1/2 -translate-y-1/2 text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded"
              style={{ background: `${colors.violet}20`, color: colors.violetLight }}
            >
              Fuzzy
            </span>
          )}
          {librarySearchQuery && (
            <motion.button
              onClick={() => setLibrarySearchQuery('')}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9, filter: 'brightness(0.85)' }}
              className="absolute right-3 top-1/2 -translate-y-1/2"
              style={{ color: colors.textMuted }}
            >
              <X size={14} />
            </motion.button>
          )}
        </div>
      </div>

      {/* Game listing — virtualized */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto outline-none" {...keyboardProps}>
        {isLoading ? (
          <LibrarySkeleton colors={colors} columns={effectiveColumns > 1 ? effectiveColumns : 1} />
        ) : installedGames.length === 0 ? (
          <EmptyState icon={FolderHeart} title="No games installed" subtitle="Use 'Add to Steam' to install games" color={colors.violet} action={{ label: 'Browse Games', onClick: () => setCurrentPage('browse') }} />
        ) : filteredLibraryGames.length === 0 ? (
          <EmptyState icon={Search} title="No Results Found" subtitle={`No games match "${librarySearchQuery}"`} color={colors.violet} />
        ) : (
          <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative', width: '100%' }}>
            {virtualizer.getVirtualItems().map(virtualRow => {
              const startIdx = virtualRow.index * effectiveColumns
              const rowItems = filteredLibraryGames.slice(startIdx, startIdx + effectiveColumns)
              return (
                <div
                  key={virtualRow.key}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                    contain: 'layout style',
                    display: effectiveColumns > 1 ? 'grid' : 'flex',
                    gridTemplateColumns: effectiveColumns > 1 ? `repeat(${effectiveColumns}, 1fr)` : undefined,
                    flexDirection: effectiveColumns > 1 ? undefined : 'column',
                    gap: effectiveColumns > 1 ? GRID_GAP + 'px' : '0.5rem',
                    alignItems: effectiveColumns > 1 ? 'start' : undefined,
                  }}
                >
                  {rowItems.map((game, i) => {
                    const gameIdx = startIdx + i
                    const isFocused = gameIdx === focusedIndex
                    const focusStyle: React.CSSProperties = {
                      outline: isFocused ? `2px solid ${colors.violet}` : 'none',
                      outlineOffset: '2px',
                      borderRadius: '12px',
                      transform: isFocused ? 'scale(1.02)' : 'scale(1)',
                      transition: 'all 80ms cubic-bezier(0.4, 0, 0.2, 1)',
                    }
                    if (viewMode === 'list') {
                      return (
                        <div key={game.appid} style={focusStyle}>
                          <LibraryListCard game={game} index={gameIdx} onDelete={handleDeleteGame} onContextMenu={handleContextMenu} colors={colors} compactMode={compactMode} />
                        </div>
                      )
                    }
                    return (
                      <div key={game.appid} style={focusStyle}>
                        <PortraitCard
                          game={game}
                          index={gameIdx}
                          isFavorite={favorites.has(game.appid)}
                          isInstalled={true}
                          onClick={() => handleGameClick(game)}
                          onFavorite={() => handlers.toggleFavorite(game.appid)}
                          onDelete={() => handleDeleteGame(game.appid)}
                          onContextMenu={handleContextMenu}
                          colors={colors}
                        />
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
})

export default LibraryPage
