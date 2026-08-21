import { useMemo, memo, useRef, useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Clock, Layout } from 'lucide-react'
import { Game } from '../types'
import { useGameStore, useUserStore, useInstalledGames } from '../store'
import { useShallow } from 'zustand/react/shallow'
import { useSetCurrentPage } from '../store/uiStore'
import { COLORS } from '../constants/colors'
import { GameCardCell, PortraitCard, EmptyState, type ColorScheme } from '../components/shared'
import { PageHeroBackdrop } from '../components/PageHeroBackdrop'
import { useImagePrefetch } from '../hooks/useImagePrefetch'
import { useVirtualizer } from '@tanstack/react-virtual'
import { LibrarySkeleton } from '../components/Skeletons'

export interface RecentPageProps {
  handlers: {
    handleGameClick: (game: Game) => void
    toggleFavorite: (appid: string) => void
    handleContextMenu: (e: React.MouseEvent, game: Game) => void
    handleInstallGame: (game?: any) => void
    handleInstallFromZip: (game?: any) => void
    handleDeleteGame: (appid: string) => void
  }
  colors: ColorScheme
}

const RecentPage = memo(function RecentPage({ handlers, colors }: RecentPageProps) {
  // ── Store Selectors ──
  const { games, viewMode } = useGameStore(
    useShallow(s => ({ games: s.games, viewMode: s.viewMode }))
  ) as { games: Game[]; viewMode: string }
  const setViewMode = useGameStore(s => s.setViewMode)
  const { recentGames, favorites } = useUserStore(
    useShallow(s => ({ recentGames: s.recentGames, favorites: s.favorites }))
  )
  const installedGames = useInstalledGames()
  const installedAppids = useMemo(() => new Set(installedGames.map(g => g.appid)), [installedGames])

  const [isLoading, setIsLoading] = useState(true)
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 500)
    return () => clearTimeout(timer)
  }, [])

  // ── Computed Values ──
  const filteredGames = useMemo(
    () => games.filter(g => recentGames.includes(g.appid) && g.header_image && g.header_image.length > 0),
    [games, recentGames]
  )

  const setCurrentPage = useSetCurrentPage()
  const { handleGameClick, toggleFavorite, handleContextMenu, handleInstallGame, handleInstallFromZip, handleDeleteGame } = handlers
  const handleRemoveFromLibrary = useCallback((game: Game) => handleDeleteGame(game.appid), [handleDeleteGame])

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
  const rowCount = Math.ceil(filteredGames.length / effectiveColumns)

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: useCallback(() => scrollRef.current, []),
    estimateSize: () => rowHeight,
    overscan: 5,
  })

  useImagePrefetch(rowVirtualizer, useCallback((rowIndex: number) => {
    const startIdx = rowIndex * effectiveColumns
    return filteredGames.slice(startIdx, startIdx + effectiveColumns)
  }, [filteredGames, effectiveColumns]))

  // ── Hero visibility guard ──
  const heroRef = useRef<HTMLDivElement>(null)
  const [isHeroVisible, setIsHeroVisible] = useState(true)
  useEffect(() => {
    const el = heroRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => setIsHeroVisible(entry!.isIntersecting),
      { rootMargin: '100px 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Hero hover state for mesh gradient overlay
  const [isHeroHovered, setIsHeroHovered] = useState(false)

  return (
    <div
      key="recent"
      ref={scrollRef}
      className="lg:pl-8 px-5 pt-2 pb-6 flex flex-col h-full overflow-auto"
      style={{ scrollbarWidth: 'thin', scrollbarColor: `${COLORS.bgActive} ${COLORS.bgMid}` }}
    >
      {/* ── Hero — Compact Premium ── */}
      <motion.div
        ref={heroRef}
        className="relative min-h-[160px] lg:min-h-[180px] overflow-hidden rounded-2xl mb-8 shrink-0"
        style={{
          background: `linear-gradient(135deg, ${colors.bgDark} 0%, ${colors.bgCard} 50%, ${colors.bgDark} 100%)`,
          border: `1px solid ${colors.amber}20`,
          boxShadow: `0 8px 32px ${colors.amber}10`,
        }}
        whileHover={{ scale: 1.003 }}
        transition={{ duration: 0.3 }}
        onHoverStart={() => setIsHeroHovered(true)}
        onHoverEnd={() => setIsHeroHovered(false)}
      >
        {/* Content-driven cover backdrop (your most recent game) */}
        <PageHeroBackdrop game={filteredGames[0]} accent={colors.amber} />

        {/* Grid dot pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.3) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* Ambient glow orbs */}
        <motion.div
          className="absolute -right-12 -top-12 w-[180px] h-[180px] rounded-full blur-[70px] pointer-events-none"
          style={{ background: `radial-gradient(circle, ${colors.amber}25 0%, transparent 70%)` }}
          animate={isHeroVisible ? { x: [0, 15, 0], y: [0, -12, 0], scale: [1, 1.06, 1] } : {}}
          transition={isHeroVisible ? { duration: 8, repeat: Infinity, ease: 'easeInOut' } : {}}
        />
        <motion.div
          className="absolute -left-8 bottom-0 w-[140px] h-[140px] rounded-full blur-[50px] pointer-events-none"
          style={{ background: `radial-gradient(circle, ${colors.orange}20 0%, transparent 70%)` }}
          animate={isHeroVisible ? { x: [0, -12, 0], y: [0, 16, 0], scale: [1, 1.08, 1] } : {}}
          transition={isHeroVisible ? { duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 1 } : {}}
        />

        {/* Floating particles */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <motion.div
              key={`recent-particle-${i}`}
              className="absolute w-1 h-1 rounded-full"
              style={{
                background: colors.amber,
                left: `${15 + i * 24}%`,
                top: `${25 + (i % 2) * 45}%`,
                opacity: 0.1 + i * 0.04,
              }}
              animate={isHeroVisible ? {
                y: [0, -(12 + i * 6), 0],
                x: [0, (i % 2 === 0 ? 6 : -6), 0],
                scale: [1, 1.3, 1],
                opacity: [0.08 + i * 0.02, 0.2 + i * 0.04, 0.08 + i * 0.02],
              } : {}}
              transition={isHeroVisible ? {
                duration: 4 + i * 1.2,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: i * 0.7,
              } : {}}
            />
          ))}
        </div>

        {/* Animated mesh gradient hover overlay */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          animate={{ opacity: isHeroHovered ? 1 : 0 }}
          transition={{ duration: 0.08, ease: [0.4, 0, 0.2, 1] }}
          style={{
            background: `radial-gradient(circle at 50% 50%, ${COLORS.whiteGlass} 0%, transparent 70%)`,
          }}
        />

        {/* ── Content ── */}
        <div className="relative z-10 flex flex-col items-center justify-center h-full min-h-[160px] lg:min-h-[180px] px-6 text-center">
          {/* Top Row: Badge + Stats | View Toggle */}
          <div className="flex items-center justify-between gap-4 w-full">
            <motion.div
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.04, ease: [0.34, 1.56, 0.64, 1] }}
              className="flex items-center gap-2.5"
            >
              <span
                className="text-[10px] font-semibold tracking-[0.18em] uppercase px-3 py-1 rounded-full flex items-center gap-1.5"
                style={{
                  background: `${colors.amber}20`,
                  color: colors.amber,
                  border: `1px solid ${colors.amber}40`,
                }}
              >
                <Clock size={10} />
                Recent
              </span>
              <motion.span
                animate={{
                  opacity: [0.4, 1, 0.4],
                  scale: [1, 1.35, 1],
                  boxShadow: [
                    `0 0 6px ${colors.amber}40`,
                    `0 0 18px ${colors.amber}80`,
                    `0 0 6px ${colors.amber}40`,
                  ],
                }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: colors.amber }}
              />
              <span className="text-[11px] font-medium" style={{ color: colors.textMuted }}>
                {recentGames.length.toLocaleString()} titles
              </span>
            </motion.div>

            {/* View Toggle */}
            <motion.div
              initial={{ opacity: 0, x: 16, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.2, ease: [0.34, 1.56, 0.64, 1] }}
            >
              <motion.button
                onClick={() => setViewMode(v => v === 'grid' ? 'list' : 'grid')}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="h-9 px-4 rounded-xl flex items-center gap-2 text-xs font-semibold"
                style={{ background: `${colors.bgCard}cc`, border: `1px solid ${colors.border}`, backdropFilter: 'blur(8px)' }}
              >
                {viewMode === 'grid' ? <Layout size={14} style={{ color: colors.amber }} /> : <Layout size={14} style={{ color: colors.textSecondary }} />}
                <span style={{ color: viewMode === 'grid' ? colors.amber : colors.textSecondary }}>
                  {viewMode === 'grid' ? 'Grid' : 'List'}
                </span>
              </motion.button>
            </motion.div>
          </div>

          {/* Title Block — Clean */}
          <div className="flex flex-col justify-center flex-1">
            <motion.h1
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 100, damping: 18, mass: 0.6, delay: 0.14 }}
              className="text-3xl lg:text-4xl xl:text-5xl font-bold tracking-tight leading-tight"
              style={{
                background: `linear-gradient(135deg, ${colors.text} 15%, var(--accent) 85%, ${colors.orange} 100%)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Recently Viewed
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 180, damping: 18, mass: 0.9, delay: 0.28 }}
              className="text-xs mt-1 leading-relaxed"
              style={{ color: colors.textDim }}
            >
              Games you've checked out recently
            </motion.p>
          </div>
        </div>
      </motion.div>

      {isLoading ? (
        <div className="flex-1 min-h-0">
          <LibrarySkeleton colors={colors} columns={effectiveColumns > 1 ? effectiveColumns : 1} />
        </div>
      ) : filteredGames.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No recent games"
          subtitle="Games you browse will appear here for quick access"
          color={colors.amber}
          action={{ label: 'Browse Games', onClick: () => setCurrentPage('browse') }}
        />
      ) : (
        <div className="flex-1 min-h-0">
          <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative', width: '100%' }}>
            {rowVirtualizer.getVirtualItems().map(virtualRow => {
              const startIdx = virtualRow.index * effectiveColumns
              const rowItems = filteredGames.slice(startIdx, startIdx + effectiveColumns)
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
                    return viewMode === 'grid' ? (
                      <PortraitCard
                        key={game.appid}
                        game={game}
                        index={gameIdx}
                        isFavorite={favorites.has(game.appid)}
                        onClick={() => handleGameClick(game)}
                        onFavorite={() => toggleFavorite(game.appid)}
                        onContextMenu={(e) => handleContextMenu(e, game)}
                        onDelete={() => handleDeleteGame(game.appid)}
                        colors={colors}
                      />
                    ) : (
                      <GameCardCell
                        key={game.appid}
                        game={game}
                        index={gameIdx}
                        viewMode={viewMode}
                        isFavorite={favorites.has(game.appid)}
                        colors={colors}
                        onGameClick={handleGameClick}
                        onFavoriteToggle={toggleFavorite}
                        onContextMenu={handleContextMenu}
                        onInstallGame={handleInstallGame}
                        onInstallFromZip={handleInstallFromZip}
                        isInLibrary={installedAppids.has(game.appid)}
                        onRemoveFromLibrary={handleRemoveFromLibrary}
                      />
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
})

export default RecentPage
