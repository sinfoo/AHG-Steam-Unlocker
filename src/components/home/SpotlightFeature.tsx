import { memo } from 'react'
import { Eye } from 'lucide-react'
import GameCover from '../GameCover'
import { IMAGE_TYPES } from '../../services/imageCache'
import { getGenreHue } from '../../utils/gameHelpers'
import type { ColorScheme } from '../../types/colors'
import type { Game } from '../../types'
import { useT } from '../../i18n'
import { useGenreLabel } from '../../utils/genreLabel'

/** SpotlightFeature — v2 wide hero panel: Ken Burns art, mono eyebrow, big title, genre chips, accent CTA. */
export const SpotlightFeature = memo(function SpotlightFeature({
  game, label, onGameClick,
}: {
  game?: Game; label?: string; onGameClick: (g: Game) => void; colors?: ColorScheme
}) {
  const t = useT()
  const gl = useGenreLabel()
  if (!game) return null
  const hue = getGenreHue(game)

  return (
    <section
      className="relative w-full overflow-hidden cursor-pointer v2-rise"
      style={{ minHeight: 280, height: 'clamp(280px,30vw,400px)', borderRadius: 26, border: '1px solid rgba(255,255,255,.08)', background: '#10101c' }}
      onClick={() => onGameClick(game)}
    >
      <div className="absolute inset-0">
        <GameCover appid={game.appid} name={game.name} localHeader={game.header_image || undefined}
          preferredImageTypes={IMAGE_TYPES.HERO} genreHue={hue} eager webglDisabled className="w-full h-full" />
      </div>
      <div className="absolute inset-0 pointer-events-none rtl-flip" style={{ background: 'linear-gradient(90deg, rgba(7,7,14,.95) 0%, rgba(7,7,14,.7) 40%, rgba(7,7,14,0) 75%)' }} />
      <div className="absolute flex flex-col gap-3.5" style={{ insetInlineStart: 'clamp(24px,4vw,48px)', top: '50%', transform: 'translateY(-50%)', maxWidth: 'min(520px,55%)' }}>
        <span className="mono text-[11px] font-semibold uppercase" style={{ letterSpacing: '.16em', color: 'var(--acc)' }}>{label ?? t('app.home.spotlight')}</span>
        <h2 className="m-0 font-bold line-clamp-2 break-words" style={{ fontSize: 'clamp(30px,3.4vw,46px)', letterSpacing: '-.035em', lineHeight: 1, color: '#f3f2fa' }}>{game.name}</h2>
        {game.genres && game.genres.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {game.genres.slice(0, 3).map(g => <span key={g} className="text-[11.5px] font-semibold px-2.5 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,.1)', color: '#e4e3f0' }}>{gl(g)}</span>)}
          </div>
        )}
        <div className="flex gap-2.5 mt-1">
          <button onClick={(e) => { e.stopPropagation(); onGameClick(game) }}
            className="v2-btn-acc h-[46px] px-[22px] rounded-[13px] text-sm font-semibold flex items-center gap-2">
            <Eye size={16} /> {t('app.home.viewGame')}
          </button>
        </div>
      </div>
    </section>
  )
})
