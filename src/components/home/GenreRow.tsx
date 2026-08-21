import { memo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import GameCover from '../GameCover'
import { IMAGE_TYPES } from '../../services/imageCache'
import { getGenreHue } from '../../utils/gameHelpers'
import type { ColorScheme } from '../../types/colors'
import type { Game } from '../../types'

/**
 * GenreRow — horizontal rail of landscape (header) cover cards.
 *
 * Previously this loaded covers SEQUENTIALLY in a for/await loop and only
 * committed state once every cover resolved, so a single slow/missing cover
 * (up to an 8s network timeout) stalled the whole row and the banners never
 * appeared. It now renders each card through the GameCover pipeline, which
 * loads in parallel, serves from the disk/memory cache, and always shows a
 * fallback — so banners pop in immediately and never block each other.
 */
export const GenreRow = memo(function GenreRow({ title, icon: Icon, color, games, onGameClick, colors }: {
  title: string; icon: any; color: string; games: Game[]; onGameClick: (g: Game) => void; colors: ColorScheme
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [l, setL] = useState(false)
  const [r, setR] = useState(true)
  const list = games.slice(0, 20)
  if (list.length === 0) return null

  const onScroll = () => {
    const el = ref.current; if (!el) return
    setL(el.scrollLeft > 4)
    setR(el.scrollLeft < el.scrollWidth - el.clientWidth - 4)
  }

  return (
    <div className="rounded-3xl p-5 entrance-fade-up" style={{ background: colors.bgCard, border: `1px solid ${colors.border}` }}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: color + '22' }}>
          <Icon size={20} style={{ color }} />
        </div>
        <h3 className="text-lg font-bold" style={{ color: colors.text }}>{title}</h3>
      </div>
      <div className="relative">
        {l && (
          <button onClick={() => ref.current?.scrollBy({ left: -440, behavior: 'smooth' })}
            className="absolute left-1 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full flex items-center justify-center hover:scale-110"
            style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, boxShadow: '0 6px 20px rgba(0,0,0,0.4)', transition: 'transform 0.1s' }}>
            <ChevronLeft size={22} style={{ color: colors.text }} />
          </button>
        )}
        {r && (
          <button onClick={() => ref.current?.scrollBy({ left: 440, behavior: 'smooth' })}
            className="absolute right-1 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full flex items-center justify-center hover:scale-110"
            style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, boxShadow: '0 6px 20px rgba(0,0,0,0.4)', transition: 'transform 0.1s' }}>
            <ChevronRight size={22} style={{ color: colors.text }} />
          </button>
        )}
        <div ref={ref} onScroll={onScroll} className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
          {list.map((game, i) => {
            const hue = getGenreHue(game)
            return (
              <div
                key={game.appid}
                onClick={() => onGameClick(game)}
                className="group flex-shrink-0 w-[208px] cursor-pointer entrance-slide-right"
                style={{ animationDelay: `${i * 0.025}s` }}
              >
                <div
                  className="relative rounded-xl overflow-hidden mb-2"
                  style={{ height: 116, border: `1px solid ${colors.border}`, transition: 'transform 0.12s, box-shadow 0.12s' }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px) scale(1.03)'; e.currentTarget.style.boxShadow = `0 18px 40px hsla(${hue},55%,18%,0.5), 0 0 50px hsla(${hue},60%,45%,0.16)` }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0) scale(1)'; e.currentTarget.style.boxShadow = 'none' }}
                >
                  <GameCover
                    appid={game.appid}
                    name={game.name}
                    localHeader={game.header_image || undefined}
                    preferredImageTypes={IMAGE_TYPES.HEADER}
                    genreHue={hue}
                    webglDisabled
                    className="w-full h-full"
                  />
                  <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to top, rgba(8,8,16,0.6) 0%, transparent 55%)' }} />
                  <div className="absolute bottom-2 left-2">
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-md" style={{ background: color + '33', color, backdropFilter: 'blur(4px)' }}>Game</span>
                  </div>
                </div>
                <p className="text-sm font-medium truncate group-hover:text-white" style={{ color: colors.textSecondary, transition: 'color 0.1s' }}>{game.name}</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
})
