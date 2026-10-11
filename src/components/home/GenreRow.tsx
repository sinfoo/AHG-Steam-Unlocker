import { memo, useRef } from 'react'
import { Eye } from 'lucide-react'
import GameCover from '../GameCover'
import { SectionHeader } from './SectionHeader'
import { IMAGE_TYPES } from '../../services/imageCache'
import { getGenreHue, getGenreTag } from '../../utils/gameHelpers'
import type { ColorScheme } from '../../types/colors'
import type { Game } from '../../types'
import { useGenreLabel } from '../../utils/genreLabel'

/**
 * GenreRow — v2 rail of wide 16:9 cards (covers via the GameCover pipeline: parallel loads,
 * disk/memory cache, guaranteed fallback — a slow cover never stalls the row).
 */
export const GenreRow = memo(function GenreRow({ title, icon, color, games, onGameClick }: {
  title: string; icon: any; color: string; games: Game[]; onGameClick: (g: Game) => void; colors?: ColorScheme
}) {
  const gl = useGenreLabel()
  const ref = useRef<HTMLDivElement>(null)
  const list = games.slice(0, 20)
  if (list.length === 0) return null

  return (
    <section className="flex flex-col gap-3.5 v2-rise">
      <SectionHeader icon={icon} color={color} title={title} scrollRef={ref} step={700} />
      <div ref={ref} className="flex gap-4 overflow-x-auto scrollbar-hide" style={{ scrollBehavior: 'smooth', padding: '8px 2px 14px', margin: '-8px -2px -14px' }}>
        {list.map((game, i) => {
          const hue = getGenreHue(game)
          const tag = getGenreTag(game)
          return (
            <div key={game.appid} onClick={() => onGameClick(game)}
              className="v2-lift relative flex-none cursor-pointer overflow-hidden rounded-[18px]"
              style={{ width: 340, aspectRatio: '16/9', background: '#10101c', border: '1px solid rgba(255,255,255,.07)', animation: `v2-riseIn .4s var(--ease-out) ${Math.min(i * 0.03, 0.4)}s both` }}>
              <GameCover appid={game.appid} name={game.name} localHeader={game.header_image || undefined}
                preferredImageTypes={IMAGE_TYPES.HEADER} genreHue={hue} webglDisabled className="absolute inset-0 w-full h-full" />
              <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(0deg, rgba(6,6,12,.95) 0%, rgba(6,6,12,.1) 60%)' }} />
              <div className="absolute inset-x-3.5 bottom-3 flex items-end gap-2.5">
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] font-semibold whitespace-nowrap overflow-hidden text-ellipsis" style={{ color: '#f3f2fa' }}>{game.name}</div>
                  {tag && <div className="flex gap-1.5 mt-1.5"><span className="text-[10.5px] px-[7px] py-0.5 rounded-md" style={{ background: 'rgba(255,255,255,.12)', color: '#e4e3f0' }}>{gl(tag)}</span></div>}
                </div>
                <span className="w-[38px] h-[38px] flex-none rounded-xl flex items-center justify-center" style={{ background: 'var(--acc)', color: '#0b0614' }}><Eye size={16} /></span>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
})
