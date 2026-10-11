import { memo } from 'react'
import { Sparkles } from 'lucide-react'
import GameCover from '../GameCover'
import { SectionHeader } from './SectionHeader'
import { IMAGE_TYPES } from '../../services/imageCache'
import { getGenreHue, getGenreTag } from '../../utils/gameHelpers'
import type { ColorScheme } from '../../types/colors'
import type { Game } from '../../types'
import { useT } from '../../i18n'
import { useGenreLabel } from '../../utils/genreLabel'

function MosaicTile({ game, variant, onClick, big = false }: {
  game: Game; variant: 'tall' | 'wide'; onClick: () => void; big?: boolean
}) {
  const gl = useGenreLabel()
  const hue = getGenreHue(game)
  const tag = getGenreTag(game)
  return (
    <div onClick={onClick} className="v2-lift relative rounded-[18px] overflow-hidden cursor-pointer h-full w-full"
      style={{ background: '#10101c', border: '1px solid rgba(255,255,255,.07)' }}>
      <GameCover appid={game.appid} name={game.name} localHeader={game.header_image || undefined}
        preferredImageTypes={variant === 'tall' ? IMAGE_TYPES.PORTRAIT : IMAGE_TYPES.HEADER}
        genreHue={hue} webglDisabled className="absolute inset-0 w-full h-full" />
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(0deg, rgba(6,6,12,.92) 0%, rgba(6,6,12,0) 55%)' }} />
      <div className="absolute inset-x-4 bottom-3.5">
        {tag && <span className="text-[10.5px] font-semibold px-2 py-[3px] rounded-md" style={{ background: 'rgba(255,255,255,.14)' }}>{gl(tag)}</span>}
        <div className="font-bold truncate mt-2" style={{ fontSize: big ? 22 : 15, letterSpacing: '-.02em', lineHeight: 1.05, color: '#f3f2fa' }}>{game.name}</div>
      </div>
    </div>
  )
}

/** FeatureMosaic — v2 mosaic: one tall tile beside a grid of wide tiles (5 games). */
export const FeatureMosaic = memo(function FeatureMosaic({ games, onGameClick }: {
  games: Game[]; onGameClick: (g: Game) => void; colors?: ColorScheme
}) {
  const t = useT()
  const list = games.slice(0, 5)
  if (list.length < 5) return null
  const [a, b, c, d, e] = list

  return (
    <section className="flex flex-col gap-3.5 v2-rise">
      <SectionHeader icon={Sparkles} color="#f472b6" title={t('app.home.featuredPicks')} sub={t('app.home.featuredPicksSub')} />
      <div className="grid grid-cols-12 gap-3" style={{ gridAutoRows: '190px' }}>
        <div className="col-span-12 sm:col-span-6 lg:col-span-5 row-span-2"><MosaicTile game={a!} variant="tall" big onClick={() => onGameClick(a!)} /></div>
        <div className="col-span-6 lg:col-span-4"><MosaicTile game={b!} variant="wide" onClick={() => onGameClick(b!)} /></div>
        <div className="col-span-6 lg:col-span-3"><MosaicTile game={c!} variant="wide" onClick={() => onGameClick(c!)} /></div>
        <div className="col-span-6 lg:col-span-4"><MosaicTile game={d!} variant="wide" onClick={() => onGameClick(d!)} /></div>
        <div className="col-span-6 lg:col-span-3"><MosaicTile game={e!} variant="wide" onClick={() => onGameClick(e!)} /></div>
      </div>
    </section>
  )
})
