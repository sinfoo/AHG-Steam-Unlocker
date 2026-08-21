import { memo } from 'react'
import { Play, Sparkles, ChevronRight } from 'lucide-react'
import GameCover from '../GameCover'
import { IMAGE_TYPES } from '../../services/imageCache'
import { getGenreHue } from '../../utils/gameHelpers'
import type { ColorScheme } from '../../types/colors'
import type { Game } from '../../types'

/**
 * SpotlightFeature — a wide cinematic hero block for one standout game using the
 * library_hero (wide) cover dimension. Differentiated, large, and eye-catching;
 * sits between rows to break the rhythm of repeated card grids.
 */
export const SpotlightFeature = memo(function SpotlightFeature({
  game, label = 'Spotlight', onGameClick, colors,
}: {
  game?: Game; label?: string; onGameClick: (g: Game) => void; colors: ColorScheme
}) {
  if (!game) return null
  const hue = getGenreHue(game)
  const accent = `hsl(${hue}, 65%, 60%)`

  return (
    <div
      className="relative w-full rounded-3xl overflow-hidden entrance-fade-up cursor-pointer group"
      style={{ minHeight: 320, border: `1px solid ${colors.border}`, boxShadow: '0 18px 60px rgba(0,0,0,0.45)' }}
      onClick={() => onGameClick(game)}
    >
      {/* Wide hero cover */}
      <div className="absolute inset-0">
        <GameCover
          appid={game.appid}
          name={game.name}
          localHeader={game.header_image || undefined}
          preferredImageTypes={IMAGE_TYPES.HERO}
          genreHue={hue}
          eager
          webglDisabled
          className="w-full h-full"
          style={{ transform: 'scale(1.02)', transition: 'transform 0.4s cubic-bezier(0.4,0,0.2,1)' }}
        />
      </div>

      {/* Cinematic overlays */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: `linear-gradient(95deg, rgba(8,8,16,0.95) 0%, rgba(8,8,16,0.8) 30%, rgba(8,8,16,0.35) 55%, transparent 80%)` }} />
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(ellipse 60% 100% at 0% 100%, hsla(${hue},60%,40%,0.25) 0%, transparent 60%)` }} />

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col justify-end p-7 lg:p-10" style={{ minHeight: 320 }}>
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
            style={{ background: accent, color: '#0b0b16', boxShadow: `0 4px 20px hsla(${hue},65%,45%,0.5)` }}>
            <Sparkles size={12} className="fill-current" /> {label}
          </span>
          {game.genres?.slice(0, 2).map(g => (
            <span key={g} className="px-2.5 py-1 rounded-full text-xs font-medium hidden sm:inline-block"
              style={{ background: 'rgba(255,255,255,0.08)', color: colors.textSecondary, border: '1px solid rgba(255,255,255,0.1)' }}>{g}</span>
          ))}
        </div>

        <h2 className="text-4xl lg:text-6xl font-black mb-2 max-w-2xl leading-[1.05] line-clamp-2 break-words"
          style={{ color: '#fff', textShadow: '0 4px 24px rgba(0,0,0,0.6)' }}>
          {game.name}
        </h2>

        {game.short_description && (
          <p className="text-sm lg:text-base max-w-xl mb-5 line-clamp-2" style={{ color: colors.textSecondary }}>
            {game.short_description}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={(e) => { e.stopPropagation(); onGameClick(game) }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold hover:scale-105 active:scale-95"
            style={{ background: accent, color: '#0b0b16', boxShadow: `0 8px 28px hsla(${hue},65%,45%,0.45)`, transition: 'transform 0.1s' }}>
            <Play size={16} className="fill-current" /> View Game
          </button>
          <span className="inline-flex items-center gap-1 text-sm font-medium group-hover:translate-x-1"
            style={{ color: colors.textMuted, transition: 'transform 0.15s' }}>
            Details <ChevronRight size={16} />
          </span>
        </div>
      </div>
    </div>
  )
})
