import { useMemo, useCallback, memo } from 'react'
import { Heart, Search } from 'lucide-react'
import { Game } from '../types'
import { useGameStore, useUserStore, useInstalledGames, useReducedMotion } from '../store'
import { useShallow } from 'zustand/react/shallow'
import { useSetCurrentPage } from '../store/uiStore'
import { type ColorScheme } from '../components/shared'
import { PosterCard } from '../components/cards/PosterCard'
import { PageBanner, PageEmpty, VirtualRows, useVirtualGrid } from '../components/PageParts'
import { useImagePrefetch } from '../hooks/useImagePrefetch'
import { useT } from '../i18n'

const RED = '#f87171'

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

const FavouritesPage = memo(function FavouritesPage({ handlers }: FavouritesPageProps) {
  const t = useT()
  // ── Store Selectors ──
  const { games, searchQuery } = useGameStore(
    useShallow(s => ({ games: s.games, searchQuery: s.searchQuery }))
  ) as { games: Game[]; searchQuery: string }
  const favorites = useUserStore(s => s.favorites)
  const installedGames = useInstalledGames()
  const installedAppids = useMemo(() => new Set(installedGames.map(g => g.appid)), [installedGames])
  const reduced = useReducedMotion()

  // ── Computed Values ──
  const favGames = useMemo(
    () => games.filter(g => favorites.has(g.appid) && g.header_image && g.header_image.length > 0),
    [games, favorites]
  )
  // The header search box drives this page's filter.
  const filteredGames = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return q ? favGames.filter(g => g.name?.toLowerCase().includes(q) || g.appid.includes(q)) : favGames
  }, [favGames, searchQuery])
  const inLibraryCount = useMemo(() => favGames.filter(g => installedAppids.has(g.appid)).length, [favGames, installedAppids])

  const setCurrentPage = useSetCurrentPage()
  const { handleGameClick, toggleFavorite, handleContextMenu } = handlers

  // ── Virtual scrolling ──
  const { scrollRef, columns, virtualizer } = useVirtualGrid(filteredGames.length, { grid: true, listRow: 88 })

  useImagePrefetch(virtualizer, useCallback((rowIndex: number) => {
    const startIdx = rowIndex * columns
    return filteredGames.slice(startIdx, startIdx + columns)
  }, [filteredGames, columns]))

  return (
    <div key="favourites" className="flex flex-col h-full" style={{ padding: 24, gap: 24, maxWidth: 1680, margin: '0 auto', width: '100%' }}>
      <PageBanner
        icon={Heart} color={RED} eyebrow={t('app.fav.eyebrow')} title={t('app.nav.favourites')}
        sub={t('app.fav.sub')}
        games={favGames.slice(0, 4)} reduced={reduced}
        stats={[
          { v: favorites.size.toLocaleString(), label: t('app.fav.saved') },
          { v: inLibraryCount.toLocaleString(), label: t('app.home.inLibrary'), color: '#86efac' },
        ]}
      />

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto" style={{ scrollbarWidth: 'thin' }}>
        {favGames.length === 0 ? (
          <PageEmpty reduced={reduced} icon={Heart} tint={RED} title={t('app.fav.emptyTitle')}
            subtitle={t('app.fav.emptySub')}
            action={{ label: t('app.common.browseGames'), onClick: () => setCurrentPage('browse') }} />
        ) : filteredGames.length === 0 ? (
          <PageEmpty reduced={reduced} icon={Search} tint={RED} title={t('app.fav.noMatch')}
            subtitle={t('app.fav.noMatchSub', { q: searchQuery })} />
        ) : (
          <VirtualRows items={filteredGames} grid columns={columns} virtualizer={virtualizer} renderItem={(game, idx) => (
            <div key={game.appid} onContextMenu={(e) => handleContextMenu(e, game)}>
              <PosterCard
                game={game} isFavorite isInstalled={installedAppids.has(game.appid)}
                onClick={() => handleGameClick(game)} onFavorite={() => toggleFavorite(game.appid)}
                delay={reduced ? 0 : Math.min(idx * 0.02, 0.3)}
              />
            </div>
          )} />
        )}
      </div>
    </div>
  )
})

export default FavouritesPage
