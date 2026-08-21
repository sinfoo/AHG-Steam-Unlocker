import { memo, useMemo, useState, useCallback } from 'react'
import { Download as DownloadIcon, FolderOpen, Heart } from 'lucide-react'
import GameCover from '../GameCover'
import { CardShell } from './CardShell'
import { InstallSpeedBadge } from './InstallSpeedBadge'
import { getGenreHue, formatBytes, isRecentlyAdded } from '../../utils/gameHelpers'
import { COLORS } from '../../constants/colors'
import type { Game } from '../../types'
import type { ColorScheme } from '../../types/colors'

const T = '0.08s cubic-bezier(0.4, 0, 0.2, 1)'

interface HeroCardProps {
  game: Game
  index?: number
  colors: ColorScheme
  isFavorite?: boolean
  isInLibrary?: boolean
  onInstallGame?: (game?: any) => void
  onInstallFromZip?: (game?: any) => void
  onFavorite?: () => void
  onContextMenu?: (e: React.MouseEvent, game: Game) => void
  onRemoveFromLibrary?: (game: Game) => void
}

export const HeroCard = memo(function HeroCard({
  game, index = 0, colors, isFavorite = false, isInLibrary = false,
  onInstallGame, onInstallFromZip, onFavorite, onContextMenu, onRemoveFromLibrary,
}: HeroCardProps) {
  const [btnHovered, setBtnHovered] = useState<'add' | 'zip' | null>(null)
  const genreHue = useMemo(() => getGenreHue(game), [game])

  const handleCtx = useCallback((e: React.MouseEvent) => {
    onContextMenu?.(e, game)
  }, [game, onContextMenu])

  return (
    <CardShell
      variant="hero"
      genreHue={genreHue}
      index={index}
      onContextMenu={handleCtx}
    >
      <div className="relative w-full" style={{ aspectRatio: '21/9' }}>
        {/* Full-bleed cover */}
        <GameCover
          appid={game.appid}
          name={game.name}
          localHeader={game.header_image}
          className="absolute inset-0 w-full h-full"
          genreHue={genreHue}
          eager
        />

        {/* Cinematic gradient overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(to right, rgba(10,10,15,0.92) 0%, rgba(10,10,15,0.50) 40%, rgba(10,10,15,0.20) 60%, rgba(10,10,15,0.40) 100%)',
          }}
        />
        {/* Bottom fade for text */}
        <div
          className="absolute inset-x-0 bottom-0 h-1/2 pointer-events-none"
          style={{
            background: 'linear-gradient(to top, rgba(10,10,15,0.85) 0%, transparent 100%)',
          }}
        />

        {/* Content overlay */}
        <div className="absolute inset-0 z-10 flex flex-col justify-end p-6 md:p-8">
          {/* Genre + "New" badges row */}
          <div className="flex items-center gap-2 mb-2">
            {isRecentlyAdded(game) && (
              <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider"
                style={{
                  background: 'linear-gradient(135deg, rgba(16,185,129,0.85), rgba(5,150,105,0.7))',
                  color: 'white',
                }}
              >
                New
              </span>
            )}
            {(game.type || '').toLowerCase() === 'dlc' && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-lg"
                style={{ background: `${COLORS.green}33`, color: COLORS.green, border: `1px solid ${COLORS.green}40` }}
              >
                DLC
              </span>
            )}
            {game.size && <InstallSpeedBadge sizeBytes={game.size} />}
          </div>

          {/* Game title */}
          <h2
            className="text-2xl md:text-3xl font-bold mb-1 leading-tight"
            style={{ color: COLORS.white, textShadow: '0 2px 12px rgba(0,0,0,0.5)' }}
          >
            {game.name}
          </h2>

          {/* Metadata */}
          <div className="flex items-center gap-3 text-sm mb-3" style={{ color: COLORS.textMuted }}>
            {game.size && <span>{formatBytes(game.size)}</span>}
            {(game as any).release_date && (
              <>
                <span className="opacity-40">•</span>
                <span>{(game as any).release_date.split('-')[0]}</span>
              </>
            )}
            {game.platforms && game.platforms.length > 0 && (
              <>
                <span className="opacity-40">•</span>
                <span>{game.platforms.map(p => p === 'windows' ? 'Win' : p === 'mac' ? 'Mac' : p === 'linux' ? 'Linux' : p).join(', ')}</span>
              </>
            )}
          </div>

          {/* Action buttons row */}
          <div className="flex items-center gap-3">
            {isInLibrary ? (
              <button
                onClick={(e) => { e.stopPropagation(); onRemoveFromLibrary?.(game) }}
                className="px-5 py-2.5 rounded-xl text-sm font-bold cursor-pointer"
                style={{
                  background: `${colors.red}22`,
                  color: colors.red,
                  border: `1px solid ${colors.red}40`,
                  transition: `background ${T}, transform ${T}`,
                }}
                onMouseEnter={() => setBtnHovered('add')}
                onMouseLeave={() => setBtnHovered(null)}
              >
                Remove from Library
              </button>
            ) : (
              <>
                <button
                  onMouseEnter={() => setBtnHovered('add')}
                  onMouseLeave={() => setBtnHovered(null)}
                  onClick={(e) => { e.stopPropagation(); onInstallGame?.(game) }}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 cursor-pointer"
                  style={{
                    background: btnHovered === 'add'
                      ? `linear-gradient(135deg, hsl(${genreHue}, 60%, 35%), hsl(${genreHue}, 50%, 25%))`
                      : `linear-gradient(135deg, hsl(${genreHue}, 55%, 30%), hsl(${genreHue}, 45%, 20%))`,
                    color: 'white',
                    boxShadow: btnHovered === 'add'
                      ? `0 8px 24px hsla(${genreHue}, 50%, 20%, 0.50)`
                      : '0 4px 12px rgba(0,0,0,0.30)',
                    transition: `background ${T}, box-shadow ${T}, transform ${T}`,
                    transform: btnHovered === 'add' ? 'translateY(-1px)' : 'translateY(0)',
                  }}
                >
                  <DownloadIcon size={16} />
                  <span>Add to Steam</span>
                </button>
                <button
                  onMouseEnter={() => setBtnHovered('zip')}
                  onMouseLeave={() => setBtnHovered(null)}
                  onClick={(e) => { e.stopPropagation(); onInstallFromZip?.(game) }}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 cursor-pointer"
                  style={{
                    background: btnHovered === 'zip' ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)',
                    color: COLORS.white,
                    border: '1px solid rgba(255,255,255,0.15)',
                    transition: `background ${T}, transform ${T}`,
                    transform: btnHovered === 'zip' ? 'translateY(-1px)' : 'translateY(0)',
                  }}
                >
                  <FolderOpen size={16} />
                  <span>Install Zip</span>
                </button>
              </>
            )}

            {onFavorite && (
              <button
                onClick={(e) => { e.stopPropagation(); onFavorite() }}
                className="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer"
                style={{
                  background: 'rgba(0,0,0,0.45)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  transition: `transform ${T}`,
                }}
              >
                <Heart size={16} className={isFavorite ? 'text-white fill-white' : 'text-white'} />
              </button>
            )}
          </div>
        </div>
      </div>
    </CardShell>
  )
}, (prev, next) => {
  return prev.game.appid === next.game.appid
    && prev.index === next.index
    && prev.isFavorite === next.isFavorite
    && prev.isInLibrary === next.isInLibrary
    && prev.colors === next.colors
})
