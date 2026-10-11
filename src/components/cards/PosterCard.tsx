import { memo, type ReactNode } from 'react'
import { Heart, Eye, Clock } from 'lucide-react'
import GameCover from '../GameCover'
import { IMAGE_TYPES } from '../../services/imageCache'
import { getGenreHue, getGenreTag } from '../../utils/gameHelpers'
import type { Game } from '../../types'
import { useT } from '../../i18n'
import { useGenreLabel } from '../../utils/genreLabel'

/** v2 poster card (GameCard.dc): 2:3 cover, hover overlay (genre chip + CTA), badges, title + meta below. */
export const PosterCard = memo(function PosterCard({ game, rank, isInstalled, isFavorite, onClick, onFavorite, delay = 0, cta, onContextMenu, selected, comingSoon, focused }: {
  game: Game; rank?: number; isInstalled?: boolean; isFavorite?: boolean
  onClick: () => void; onFavorite?: () => void; delay?: number
  /** Overlay call-to-action (defaults to View). */
  cta?: { label: string; icon: ReactNode; onClick: () => void }
  onContextMenu?: (e: React.MouseEvent) => void
  selected?: boolean; comingSoon?: boolean; focused?: boolean
}) {
  const t = useT()
  const gl = useGenreLabel()
  const hue = getGenreHue(game)
  const rawTag = getGenreTag(game)
  const tag = rawTag ? gl(rawTag) : null
  const year = (game as any).release_date?.split?.('-')?.[0]
  return (
    <div className="v2-card" role="button" tabIndex={0} aria-label={game.name} aria-pressed={selected}
      onClick={onClick} onContextMenu={onContextMenu}
      onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick() } }}
      style={{ animation: `v2-riseIn .4s var(--ease-out) ${delay}s both`, outline: focused ? '2px solid var(--acc,#a77dff)' : undefined, outlineOffset: 4, borderRadius: 14 }}>
      <div className="v2-card-cover" style={selected ? { borderColor: 'var(--acc,#a77dff)', boxShadow: '0 0 0 2px var(--acc,#a77dff)' } : undefined}>
        <GameCover appid={game.appid} name={game.name} localHeader={game.header_image || undefined}
          preferredImageTypes={IMAGE_TYPES.PORTRAIT} genreHue={hue} webglDisabled className="w-full h-full" />
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(180deg,rgba(0,0,0,.35) 0%,transparent 22%,transparent 70%,rgba(0,0,0,.4) 100%)' }} />
        <div className="absolute top-2 inset-x-2 flex items-center gap-1.5 pointer-events-none">
          {rank != null && (
            <span className="mono text-[11px] font-semibold text-white px-[7px] py-[3px] rounded-[7px]"
              style={{ background: 'rgba(8,8,16,.72)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,.12)' }}>#{rank}</span>
          )}
          {isInstalled && (
            <span className="flex items-center gap-[5px] text-[10.5px] font-semibold px-[7px] py-[3px] rounded-[7px]"
              style={{ color: '#d7ffe4', background: 'rgba(8,20,12,.75)', backdropFilter: 'blur(8px)', border: '1px solid rgba(34,197,94,.35)' }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#22c55e', boxShadow: '0 0 8px #22c55e' }} />{t('app.card.installed')}
            </span>
          )}
          {comingSoon && (
            <span className="mono flex items-center gap-1.5 text-[10.5px] font-semibold uppercase px-[7px] py-[3px] rounded-[7px]"
              style={{ color: '#fff', background: 'rgba(8,8,16,.75)', backdropFilter: 'blur(8px)', border: '1px solid color-mix(in oklch, var(--acc) 50%, transparent)', letterSpacing: '.1em' }}>
              <Clock size={10} />{t('app.card.soon')}
            </span>
          )}
          <span className="flex-1" />
          {isFavorite && (
            <span className="w-[26px] h-[26px] rounded-lg flex items-center justify-center text-white"
              style={{ background: 'rgba(239,68,68,.9)', boxShadow: '0 4px 14px rgba(239,68,68,.5)' }}><Heart size={13} className="fill-white" /></span>
          )}
        </div>
        <div className="v2-card-ov">
          {tag && (
            <div className="flex gap-1.5">
              <span className="text-[10.5px] px-[7px] py-[3px] rounded-md" style={{ color: '#d9d7ea', background: 'rgba(255,255,255,.1)' }}>{tag}</span>
            </div>
          )}
          {onFavorite && (
            <button className="v2-card-fav" title={t('app.hero.favourite')} onClick={(e) => { e.stopPropagation(); onFavorite() }}>
              <Heart size={14} className={isFavorite ? 'fill-white' : ''} />
            </button>
          )}
          <div className="flex">
            <button className="v2-card-cta" onClick={(e) => { e.stopPropagation(); (cta?.onClick ?? onClick)() }}>{cta?.icon ?? <Eye size={14} className="flex-none" />}<span>{cta?.label ?? t('app.card.view')}</span></button>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-[3px] px-0.5 min-w-0">
        <div className="text-[13.5px] font-semibold whitespace-nowrap overflow-hidden text-ellipsis" style={{ color: '#f3f2fa' }}>{game.name}</div>
        <div className="mono text-[11px] whitespace-nowrap overflow-hidden text-ellipsis" style={{ color: '#8b8aa3' }}>{[tag, year].filter(Boolean).join(' · ') || ' '}</div>
      </div>
    </div>
  )
})
