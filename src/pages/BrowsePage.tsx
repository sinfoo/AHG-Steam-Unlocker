import { useMemo, useRef, useState, useEffect, useCallback, memo } from 'react'
import { useScroll, useTransform } from 'framer-motion'
import '../styles/browse-animations.css'
import '../styles/card-animations.css'
import { Game } from '../types'
import { useGameStore, useUserStore, useSettingsStore, useInstalledGames } from '../store'
import { useShallow } from 'zustand/react/shallow'
import type { ColorScheme } from '../components/shared'
import { POPULAR_RANK } from '../components/GameGrid'
import { useImagePrefetch } from '../hooks/useImagePrefetch'
import { useVirtualizer } from '@tanstack/react-virtual'
import { BrowseToolbar, BrowseHero, BrowseGameGrid, GRID_GAP, GRID_CARD_HEIGHT, LIST_CARD_HEIGHT, ROW_GAP, CELL_WIDTH } from '../components/browse'

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

const BrowsePage = memo(({
  handlers, colors, gamesWithCover, filteredGames, popularGamesWithCover,
}: BrowsePageProps) => {

  // ── Game Store ──
  const { sortBy, viewMode, selectedGames, fixes, searchQuery } = useGameStore(
    useShallow(s => ({
      sortBy: s.sortBy,
      viewMode: s.viewMode, selectedGames: s.selectedGames, fixes: s.fixes,
      searchQuery: s.searchQuery,
    }))
  )
  const setSelectedGames = useGameStore(s => s.setSelectedGames)

  // ── User Store ──
  const { favorites, ownedGameIds } = useUserStore(
    useShallow(s => ({ favorites: s.favorites, ownedGameIds: s.ownedGameIds }))
  )

  // ── Settings Store ──
  const { batchMode, compactMode, showOnlyOwned } = useSettingsStore(
    useShallow(s => ({ batchMode: s.batchMode, compactMode: s.compactMode, showOnlyOwned: s.showOnlyOwned }))
  )

  const installedGames = useInstalledGames()
  const installedAppids = useMemo(() => new Set(installedGames.map(g => g.appid)), [installedGames])

  const comingSoonAppids = useMemo(
    () => new Set(
      fixes.filter(f => !f.download_url || f.download_url.trim() === '').map(f => f.appid)
    ),
    [fixes]
  )

  const { handleGameClick, toggleFavorite, handleContextMenu, handleInstallGame, handleInstallFromZip, handleDeleteGame } = handlers
  const handleRemoveFromLibrary = useCallback((game: Game) => handleDeleteGame(game.appid), [handleDeleteGame])

  // ── Popular Only toggle ──
  const [popularOnly, setPopularOnly] = useState(false)

  // ── Skeleton visible for at least 200ms to prevent flash ──
  const [showSkeleton, setShowSkeleton] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setShowSkeleton(false), 200)
    return () => clearTimeout(t)
  }, [])

  // ── Owned + Popular filters ──
  const ownedFilteredGames = useMemo(() => {
    let result = filteredGames
    if (showOnlyOwned) {
      result = result.filter((g: any) => ownedGameIds.has(String(g.appid)))
    }
    if (popularOnly) {
      result = result.filter((g: any) => POPULAR_RANK.has(String(g.appid)))
    }
    return result
  }, [filteredGames, showOnlyOwned, ownedGameIds, popularOnly])

  // ── Fixed-grid virtual scrolling ──
  const gridRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  useEffect(() => {
    const el = gridRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width)
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const colGap = compactMode ? 8 : GRID_GAP
  const effectiveColumns = viewMode === 'grid'
    ? Math.max(1, Math.floor((containerWidth + colGap) / (CELL_WIDTH + colGap)))
    : 1
  const INFO_PANEL_HEIGHT = compactMode ? 155 : 175
  const rowHeight = useMemo(() => {
    if (viewMode !== 'grid') return LIST_CARD_HEIGHT + 8
    if (effectiveColumns === 0) return GRID_CARD_HEIGHT + ROW_GAP
    const colWidth = (containerWidth - (effectiveColumns - 1) * colGap) / effectiveColumns
    return Math.ceil(colWidth * 9 / 16) + INFO_PANEL_HEIGHT + ROW_GAP
  }, [viewMode, containerWidth, effectiveColumns, compactMode])
  const rowCount = Math.ceil(ownedFilteredGames.length / effectiveColumns)

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: useCallback(() => gridRef.current, []),
    estimateSize: () => rowHeight,
    overscan: 2,
    measureElement: (element: Element) => element?.getBoundingClientRect().height || rowHeight,
  })

  // Re-measure rows when the per-row height changes (viewMode / compactMode /
  // container width). Without this the virtualizer keeps stale row offsets after
  // a toggle, leaving rows overlapping or over-gapped until the next scroll/resize.
  useEffect(() => {
    rowVirtualizer.measure()
  }, [rowHeight, rowVirtualizer])

  useImagePrefetch(rowVirtualizer, useCallback((rowIndex: number) => {
    const startIdx = rowIndex * effectiveColumns
    return ownedFilteredGames.slice(startIdx, startIdx + effectiveColumns)
  }, [ownedFilteredGames, effectiveColumns]))

  // ── Game Showcase Carousel (popular/AAA games only, random selection) ──
  const [carouselIdx, setCarouselIdx] = useState(0)
  const [carouselSeed] = useState(() => Math.random())
  const carouselGames = useMemo(() => {
    const pool = popularGamesWithCover.length >= 8 ? popularGamesWithCover : gamesWithCover
    // Fisher-Yates shuffle for unbiased random selection
    const arr = [...pool]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = arr[i]!
      arr[i] = arr[j]!
      arr[j] = tmp
    }
    return arr.slice(0, 8)
  }, [popularGamesWithCover, gamesWithCover, carouselSeed])

  // ── Hero scroll parallax ──
  const { scrollY: pageScrollY } = useScroll({ container: gridRef })
  const heroParallaxY = useTransform(pageScrollY, [0, 400], [0, -60])

  // ── Parallax Mouse Tracking (direct DOM, no React re-render) ──
  const heroRef = useRef<HTMLDivElement>(null)
  const [isHeroVisible, setIsHeroVisible] = useState(true)
  useEffect(() => {
    const el = heroRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const obs = new IntersectionObserver(([entry]) => setIsHeroVisible(entry!.isIntersecting), { rootMargin: '100px 0px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const onHeroMouseMove = useCallback((e: React.MouseEvent) => {
    const el = heroRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5
    el.style.transform = `perspective(1200px) rotateX(${y * -1.5}deg) rotateY(${x * 1.5}deg)`
  }, [])

  // ── Random Game Handler ──
  const handleRandomGame = useCallback(() => {
    if (carouselGames.length === 0) return
    const rand = Math.floor(Math.random() * carouselGames.length)
    setCarouselIdx(rand)
  }, [carouselGames])

  return (
    <div
      key="browse"
      className="lg:pl-8 px-5 pt-2 pb-6 flex flex-col h-full"
    >

      <BrowseToolbar
        colors={colors}
        gameCount={ownedFilteredGames.length}
        totalCount={gamesWithCover.length}
        searchQuery={searchQuery}
        popularOnly={popularOnly}
        setPopularOnly={setPopularOnly}
      />

      {/* ── Game Grid ── */}
      <div
        ref={gridRef}
        className="card-grid"
        style={{ 
          flex: 1, 
          minHeight: 0,
          position: 'relative',
          overflow: 'auto',
          scrollbarWidth: 'thin',
          transform: 'translateZ(0)',
          containIntrinsicSize: 'auto 1000px',
        }}
      >
        <BrowseHero
          heroRef={heroRef}
          isHeroVisible={isHeroVisible}
          heroParallaxY={heroParallaxY}
          onHeroMouseMove={onHeroMouseMove}
          handleRandomGame={handleRandomGame}
          handleGameClick={handleGameClick}
          colors={colors}
          carouselGames={carouselGames}
          carouselIdx={carouselIdx}
          setCarouselIdx={setCarouselIdx}
          gamesWithCover={gamesWithCover}
        />

          <BrowseGameGrid
          ownedFilteredGames={ownedFilteredGames}
          viewMode={viewMode}
          effectiveColumns={effectiveColumns}
          rowVirtualizer={rowVirtualizer}
          colors={colors}
          showSkeleton={showSkeleton}
          batchMode={batchMode}
          selectedGames={selectedGames}
          handleGameClick={handleGameClick}
          toggleFavorite={toggleFavorite}
          handleContextMenu={handleContextMenu}
          handleInstallGame={handleInstallGame}
          handleInstallFromZip={handleInstallFromZip}
          handleRemoveFromLibrary={handleRemoveFromLibrary}
          comingSoonAppids={comingSoonAppids}
          favorites={favorites}
          setSelectedGames={setSelectedGames}
          installedAppids={installedAppids}
          compactMode={compactMode}
        />
      </div>


    </div>
  )
})

export default BrowsePage
