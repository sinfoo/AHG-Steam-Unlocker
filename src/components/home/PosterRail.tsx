import { memo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import GameCover from '../GameCover'
import { IMAGE_TYPES } from '../../services/imageCache'
import { getGenreHue, getGenreTag } from '../../utils/gameHelpers'
import type { ColorScheme } from '../../types/colors'
import type { Game } from '../../types'

/**
 * PosterRail — horizontal rail of tall PORTRAIT (2:3) poster cards.
 * A differentiated cover dimension vs. the landscape rows; renders through the
 * GameCover pipeline (LQIP, disk/memory cache, instant-paint, guaranteed
 * fallback) so banners never stall. Optional rank badges for "chart" feel.
 */
export const PosterRail = memo(function PosterRail({
  title, subtitle, icon: Icon, color, games, onGameClick, onSeeAll, colors, ranked = false,
}: {
  title: string; subtitle?: string; icon: any; color: string; games: Game[];
  onGameClick: (g: Game) => void; onSeeAll?: () => void; colors: ColorScheme; ranked?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [l, setL] = useState(false)
  const [r, setR] = useState(true)
  const list = games.slice(0, 18)
  if (list.length === 0) return null

  const onScroll = () => {
    const el = ref.current; if (!el) return
    setL(el.scrollLeft > 4)
    setR(el.scrollLeft < el.scrollWidth - el.clientWidth - 4)
  }
  const scrollBy = (d: number) => ref.current?.scrollBy({ left: d, behavior: 'smooth' })

  return (
    <div
      className="rounded-3xl p-5 entrance-fade-up relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${color}0c 0%, ${colors.bgCard} 55%)`,
        border: `1px solid ${color}22`,
      }}
    >
      {/* ambient corner glow */}
      <div className="pointer-events-none absolute -top-16 -right-10 w-64 h-64 rounded-full"
        style={{ background: `radial-gradient(circle, ${color}1f 0%, transparent 70%)`, filter: 'blur(20px)' }} />

      <div className="flex items-center justify-between mb-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: color + '22', border: `1px solid ${color}33` }}>
            <Icon size={20} style={{ color }} />
          </div>
          <div>
            <h3 className="text-lg font-bold leading-tight" style={{ color: colors.text }}>{title}</h3>
            <p className="text-xs" style={{ color: colors.textMuted }}>{subtitle || `${list.length} games`}</p>
          </div>
        </div>
        {onSeeAll && (
          <button onClick={onSeeAll}
            className="px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-1.5 hover:scale-105 active:scale-95"
            style={{ background: color + '1c', color, border: `1px solid ${color}3a`, transition: 'transform 0.1s' }}>
            See All <ChevronRight size={15} />
          </button>
        )}
      </div>

      <div className="relative">
        {l && (
          <button onClick={() => scrollBy(-560)} aria-label="Scroll left"
            className="absolute left-1 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full flex items-center justify-center hover:scale-110 active:scale-95"
            style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, boxShadow: '0 6px 20px rgba(0,0,0,0.4)', transition: 'transform 0.1s' }}>
            <ChevronLeft size={22} style={{ color: colors.text }} />
          </button>
        )}
        {r && (
          <button onClick={() => scrollBy(560)} aria-label="Scroll right"
            className="absolute right-1 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full flex items-center justify-center hover:scale-110 active:scale-95"
            style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, boxShadow: '0 6px 20px rgba(0,0,0,0.4)', transition: 'transform 0.1s' }}>
            <ChevronRight size={22} style={{ color: colors.text }} />
          </button>
        )}

        <div ref={ref} onScroll={onScroll} className="flex gap-4 overflow-x-auto scrollbar-hide pb-1">
          {list.map((game, i) => {
            const hue = getGenreHue(game)
            const tag = getGenreTag(game)
            return (
              <div
                key={game.appid}
                onClick={() => onGameClick(game)}
                className="group flex-shrink-0 w-[152px] cursor-pointer entrance-slide-right"
                style={{ animationDelay: `${i * 0.025}s` }}
              >
                <div
                  className="relative rounded-2xl overflow-hidden"
                  style={{
                    aspectRatio: '2 / 3',
                    border: `1px solid ${colors.border}`,
                    boxShadow: '0 6px 20px rgba(0,0,0,0.35)',
                    transition: 'transform 0.12s cubic-bezier(0.4,0,0.2,1), box-shadow 0.12s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-6px) scale(1.03)'; e.currentTarget.style.boxShadow = `0 22px 50px hsla(${hue},55%,20%,0.5), 0 0 60px hsla(${hue},60%,45%,0.18)` }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0) scale(1)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.35)' }}
                >
                  <GameCover
                    appid={game.appid}
                    name={game.name}
                    localHeader={game.header_image || undefined}
                    preferredImageTypes={IMAGE_TYPES.PORTRAIT}
                    genreHue={hue}
                    webglDisabled
                    className="w-full h-full"
                  />
                  {/* readability gradient */}
                  <div className="absolute inset-x-0 bottom-0 h-2/5 pointer-events-none"
                    style={{ background: 'linear-gradient(to top, rgba(8,8,16,0.92) 10%, rgba(8,8,16,0.4) 50%, transparent 100%)' }} />
                  {/* rank badge */}
                  {ranked && (
                    <div className="absolute top-2 left-2 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black"
                      style={{ background: 'rgba(8,8,16,0.6)', color: '#fff', backdropFilter: 'blur(6px)', border: `1px solid ${color}55` }}>
                      {i + 1}
                    </div>
                  )}
                  {/* genre chip */}
                  {tag && (
                    <div className="absolute bottom-2 left-2 right-2">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md inline-block"
                        style={{ background: `hsla(${hue},60%,45%,0.35)`, color: '#fff', backdropFilter: 'blur(4px)' }}>
                        {tag}
                      </span>
                    </div>
                  )}
                </div>
                <p className="text-sm font-medium truncate mt-2 px-0.5 group-hover:text-white"
                  style={{ color: colors.textSecondary, transition: 'color 0.1s' }}>
                  {game.name}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
})
