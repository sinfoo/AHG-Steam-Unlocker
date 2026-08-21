import { memo } from 'react'
import GameCover from '../GameCover'
import { IMAGE_TYPES } from '../../services/imageCache'
import { getGenreHue, getGenreTag } from '../../utils/gameHelpers'
import type { ColorScheme } from '../../types/colors'
import type { Game } from '../../types'

type Variant = 'tall' | 'wide'

function MosaicTile({ game, variant, onClick, colors, big = false }: {
  game: Game; variant: Variant; onClick: () => void; colors: ColorScheme; big?: boolean
}) {
  const hue = getGenreHue(game)
  const tag = getGenreTag(game)
  return (
    <div
      onClick={onClick}
      className="group relative rounded-2xl overflow-hidden cursor-pointer h-full w-full"
      style={{
        border: `1px solid ${colors.border}`,
        boxShadow: '0 6px 20px rgba(0,0,0,0.35)',
        transition: 'transform 0.12s cubic-bezier(0.4,0,0.2,1), box-shadow 0.12s',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.015)'; e.currentTarget.style.boxShadow = `0 22px 50px hsla(${hue},55%,18%,0.5), 0 0 70px hsla(${hue},60%,45%,0.16)` }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.35)' }}
    >
      <GameCover
        appid={game.appid}
        name={game.name}
        localHeader={game.header_image || undefined}
        preferredImageTypes={variant === 'tall' ? IMAGE_TYPES.PORTRAIT : IMAGE_TYPES.HEADER}
        genreHue={hue}
        webglDisabled
        className="w-full h-full"
        style={{ transition: 'transform 0.25s ease' }}
      />
      <div className="absolute inset-x-0 bottom-0 pointer-events-none" style={{ height: big ? '55%' : '70%', background: 'linear-gradient(to top, rgba(8,8,16,0.94) 8%, rgba(8,8,16,0.45) 45%, transparent 100%)' }} />
      {/* genre-hue hover glow */}
      <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100" style={{ background: `radial-gradient(ellipse at 50% 60%, hsla(${hue},70%,55%,0.22), transparent 70%)`, transition: 'opacity 0.12s' }} />
      <div className="absolute inset-x-0 bottom-0 p-3">
        {tag && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md inline-block mb-1.5"
            style={{ background: `hsla(${hue},60%,45%,0.4)`, color: '#fff', backdropFilter: 'blur(4px)' }}>{tag}</span>
        )}
        <p className={`font-bold truncate ${big ? 'text-lg' : 'text-sm'}`} style={{ color: '#fff', textShadow: '0 1px 8px rgba(0,0,0,0.5)' }}>{game.name}</p>
      </div>
    </div>
  )
}

/**
 * FeatureMosaic — asymmetric premium bento: one tall portrait hero tile beside a
 * grid of wide landscape tiles. Mixes cover dimensions for visual variety.
 * Consumes up to 5 games.
 */
export const FeatureMosaic = memo(function FeatureMosaic({ games, onGameClick, colors }: {
  games: Game[]; onGameClick: (g: Game) => void; colors: ColorScheme
}) {
  const list = games.slice(0, 5)
  if (list.length < 5) return null
  const [a, b, c, d, e] = list

  return (
    <div className="grid grid-cols-12 gap-3 entrance-fade-up" style={{ gridAutoRows: '152px' }}>
      {/* Tall portrait feature — spans 2 rows */}
      <div className="col-span-12 sm:col-span-6 lg:col-span-5 row-span-2">
        <MosaicTile game={a!} variant="tall" big onClick={() => onGameClick(a!)} colors={colors} />
      </div>
      {/* Wide tiles */}
      <div className="col-span-6 lg:col-span-4"><MosaicTile game={b!} variant="wide" onClick={() => onGameClick(b!)} colors={colors} /></div>
      <div className="col-span-6 lg:col-span-3"><MosaicTile game={c!} variant="wide" onClick={() => onGameClick(c!)} colors={colors} /></div>
      <div className="col-span-6 lg:col-span-4"><MosaicTile game={d!} variant="wide" onClick={() => onGameClick(d!)} colors={colors} /></div>
      <div className="col-span-6 lg:col-span-3"><MosaicTile game={e!} variant="wide" onClick={() => onGameClick(e!)} colors={colors} /></div>
    </div>
  )
})
