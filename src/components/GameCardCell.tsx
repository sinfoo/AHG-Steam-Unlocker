import { memo, useCallback } from 'react'
import { Clock } from 'lucide-react'
import { GameCard } from './cards/GameCard'
import type { Game } from '../types'
import type { ColorScheme } from '../types/colors'
import { useT } from '../i18n'

export interface GameCardCellProps {
  game: Game
  index: number
  comingSoon?: boolean
  viewMode: string
  isFavorite: boolean
  colors: ColorScheme
  batchMode?: boolean
  isSelected?: boolean
  onGameClick: (game: Game) => void
  onFavoriteToggle: (appid: string) => void
  onContextMenu: (e: React.MouseEvent, game: Game) => void
  setSelectedGames?: (fn: (prev: Set<string>) => Set<string>) => void
  onInstallGame?: (game?: any) => void
  onInstallFromZip?: (game?: any) => void
  isInLibrary?: boolean
  onRemoveFromLibrary?: (game: Game) => void
  compactMode?: boolean
}

/**
 * Memoized GameCard wrapper that creates stable callbacks to preserve
 * GameCard's React.memo optimization across all game grid pages.
 *
 * Supports optional comingSoon badge, batch selection mode,
 * and all GameCard props.
 */
const GameCardCell = memo(function GameCardCell({
  game, index, comingSoon, viewMode, isFavorite, colors,
  batchMode, isSelected,
  onGameClick, onFavoriteToggle, onContextMenu, setSelectedGames,
  onInstallGame, onInstallFromZip, isInLibrary, onRemoveFromLibrary,
  compactMode,
}: GameCardCellProps) {
  const t = useT()
  const handleClick = useCallback(() => onGameClick(game), [onGameClick, game])
  const handleFavorite = useCallback(() => onFavoriteToggle(game.appid), [onFavoriteToggle, game.appid])
  const handleContextMenuCallback = useCallback(
    (e: React.MouseEvent) => onContextMenu(e, game),
    [onContextMenu, game],
  )
  const handleSelect = useCallback(() => {
    setSelectedGames?.(prev => {
      const next = new Set(prev)
      if (next.has(game.appid)) next.delete(game.appid)
      else next.add(game.appid)
      return next
    })
  }, [setSelectedGames, game.appid])

  return (
    <div className="relative" style={{ contentVisibility: 'auto', contain: 'layout style paint', containIntrinsicSize: viewMode === 'list' ? 'auto 88px' : 'auto 340px' }}>
      {comingSoon && (
        <div className="absolute top-2 start-2 z-30 px-2 py-[3px] rounded-[7px] mono text-[10.5px] font-semibold flex items-center gap-1.5 pointer-events-none"
          style={{
            background: 'rgba(8,8,16,.75)',
            color: '#fff',
            border: '1px solid color-mix(in oklch, var(--acc) 50%, transparent)',
            letterSpacing: '.1em',
          }}
        >
          <Clock size={11} />
          <span className="uppercase">{t('app.card.soon')}</span>
        </div>
      )}
      <GameCard
        game={game}
        index={index}
        viewMode={viewMode}
        isFavorite={isFavorite}
        onClick={handleClick}
        onFavorite={handleFavorite}
        onContextMenu={handleContextMenuCallback}
        onInstallGame={onInstallGame}
        onInstallFromZip={onInstallFromZip}
        colors={colors}
        batchMode={batchMode}
        isSelected={isSelected}
        onSelect={batchMode ? handleSelect : undefined}
        isInLibrary={isInLibrary}
        onRemoveFromLibrary={onRemoveFromLibrary}
        compactMode={compactMode}
      />
    </div>
  )
})

export default GameCardCell
