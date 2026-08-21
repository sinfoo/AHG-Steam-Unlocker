import { useMemo, useRef, useState, useEffect, useCallback, memo } from 'react'
import { motion } from 'framer-motion'
import { Heart, Layout } from 'lucide-react'
import { Game } from '../types'
import { useGameStore, useUserStore, useInstalledGames } from '../store'
import { useShallow } from 'zustand/react/shallow'
import { useSetCurrentPage } from '../store/uiStore'
import { GameCardCell, PortraitCard, EmptyState, type ColorScheme } from '../components/shared'
import { PageHeroBackdrop } from '../components/PageHeroBackdrop'
import { useImagePrefetch } from '../hooks/useImagePrefetch'
import { useVirtualizer } from '@tanstack/react-virtual'
import { DARK_COLORS } from '../constants/colors'
import { LibrarySkeleton } from '../components/Skeletons'

export interface FavouritesPageProps {
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

const FavouritesPage = memo(function FavouritesPage({ handlers, colors }: FavouritesPageProps) {
  // ── Store Selectors ──
  const { games, viewMode } = useGameStore(
    useShallow(s => ({ games: s.games, viewMode: s.viewMode }))
  ) as { games: Game[]; viewMode: string }
  const setViewMode = useGameStore(s => s.setViewMode)
  const favorites = useUserStore(s => s.favorites)
  const installedGames = useInstalledGames()
  const installedAppids = useMemo(() => new Set(installedGames.map(g => g.appid)), [installedGames])

  const [isLoading, setIsLoading] = useState(true)
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 500)
    return () => clearTimeout(timer)
  }, [])

  // ── Computed Values ──
  const filteredGames = useMemo(
    () => games.filter(g => favorites.has(g.appid) && g.header_image && g.header_image.length > 0),
    [games, favorites]
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
      key="favourites"
      ref={scrollRef}
      className="lg:pl-8 px-5 pt-2 pb-6 flex flex-col h-full overflow-auto"
      style={{ scrollbarWidth: 'thin', scrollbarColor: `${DARK_COLORS.bgActive} ${DARK_COLORS.bgMid}` }}
    >
      {/* ── Hero — Compact Premium ── */}
      <motion.div
        ref={heroRef}
        className="relative min-h-[160px] lg:min-h-[180px] overflow-hidden rounded-2xl mb-8 shrink-0"
        style={{
          background: `linear-gradient(135deg, ${colors.bgDark} 0%, ${colors.bgCard} 50%, ${colors.bgDark} 100%)`,
          border: `1px solid ${colors.pink}20`,
          boxShadow: `0 8px 32px ${colors.pink}10`,
        }}
        whileHover={{ scale: 1.003 }}
        transition={{ duration: 0.3 }}
        onHoverStart={() => setIsHeroHovered(true)}
        onHoverEnd={() => setIsHeroHovered(false)}
      >
        {/* Content-driven cover backdrop (your top favourite) */}
        <PageHeroBackdrop game={filteredGames[0]} accent={colors.pink} />

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
          style={{ background: `radial-gradient(circle, ${colors.pink}25 0%, transparent 70%)` }}
          animate={isHeroVisible ? { x: [0, 15, 0], y: [0, -12, 0], scale: [1, 1.06, 1] } : {}}
          transition={isHeroVisible ? { duration: 8, repeat: Infinity, ease: 'easeInOut' } : {}}
        />
        <motion.div
          className="absolute -left-8 bottom-0 w-[140px] h-[140px] rounded-full blur-[50px] pointer-events-none"
          style={{ background: `radial-gradient(circle, ${colors.purple}20 0%, transparent 70%)` }}
          animate={isHeroVisible ? { x: [0, -12, 0], y: [0, 16, 0], scale: [1, 1.08, 1] } : {}}
          transition={isHeroVisible ? { duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 1 } : {}}
        />

        {/* Floating particles */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <motion.div
              key={`fav-particle-${i}`}
              className="absolute w-1 h-1 rounded-full"
              style={{
                background: colors.pink,
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
            background: `radial-gradient(circle at 50% 50%, ${DARK_COLORS.whiteGlass} 0%, transparent 70%)`,
          }}
        />

        {/* ── Content ── */}
        <div className="relative z-10 flex flex-col items-center justify-center h-full min-h-[160px] lg:min-h-[180px] px-6 text-center">
          {/* Top Row: Badge + Stats | View Toggle */}
          <div className="flex items-center justify-between gap-4 w-full">
            <motion.div
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: 'spring', stiffness: 120, damping: 18, delay: 0.05 }}
              className="flex items-center gap-2.5"
            >
              <span
                className="text-[10px] font-semibold tracking-[0.18em] uppercase px-3 py-1 rounded-full flex items-center gap-1.5"
                style={{
                  background: `${colors.pink}20`,
                  color: colors.pink,
                  border: `1px solid ${colors.pink}40`,
                }}
              >
                <Heart size={10} />
                Favourites
              </span>
              <motion.span
                animate={{
                  opacity: [0.4, 1, 0.4],
                  scale: [1, 1.35, 1],
                }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{
                  background: colors.pink,
                  boxShadow: `0 0 12px ${colors.pink}, 0 0 24px ${colors.pink}40`,
                }}
              />
              <span className="text-[11px] font-medium" style={{ color: colors.textMuted }}>
                {favorites.size.toLocaleString()} titles
              </span>
            </motion.div>

            {/* View Toggle */}
            <motion.div
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: 'spring', stiffness: 100, damping: 20, delay: 0.2 }}
            >
              <motion.button
                onClick={() => setViewMode(v => v === 'grid' ? 'list' : 'grid')}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="h-9 px-4 rounded-xl flex items-center gap-2 text-xs font-semibold"
                style={{ background: `${colors.bgCard}cc`, border: `1px solid ${colors.border}`, backdropFilter: 'blur(8px)' }}
              >
                {viewMode === 'grid' ? <Layout size={14} style={{ color: colors.pink }} /> : <Layout size={14} style={{ color: colors.textSecondary }} />}
                <span style={{ color: viewMode === 'grid' ? colors.pink : colors.textSecondary }}>
                  {viewMode === 'grid' ? 'Grid' : 'List'}
                </span>
              </motion.button>
            </motion.div>
          </div>

          {/* Title Block — Clean */}
          <div className="flex flex-col justify-center flex-1">
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 90, damping: 22, delay: 0.1 }}
              className="text-3xl lg:text-4xl xl:text-5xl font-bold tracking-tight leading-tight"
              style={{
                background: `linear-gradient(135deg, ${colors.text} 15%, var(--accent) 85%, ${colors.violet} 100%)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: `0 0 40px ${colors.pink}30, 0 0 80px ${colors.pink}15`,
              }}
            >
              Favourites
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ type: 'spring', stiffness: 70, damping: 24, delay: 0.2 }}
              className="text-xs mt-1 leading-relaxed"
              style={{ color: colors.textDim }}
            >
              Your personally curated game collection
            </motion.p>
          </div>
        </div>
      </motion.div>

      <div className="flex-1 min-h-0">
        {isLoading ? (
          <LibrarySkeleton colors={colors} columns={effectiveColumns > 1 ? effectiveColumns : 1} />
        ) : filteredGames.length === 0 ? (
          <EmptyState
            icon={Heart}
            title="No favorites yet"
            subtitle="Click the heart icon on any game to add it to your collection"
            color={colors.pink}
            action={{ label: 'Browse Games', onClick: () => setCurrentPage('browse') }}
          />
        ) : (
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
        )}
      </div>
    </div>
  )
})

export default FavouritesPage
