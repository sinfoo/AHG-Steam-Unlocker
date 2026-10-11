import { memo, useRef } from 'react'
import { PosterCard } from '../cards/PosterCard'
import { SectionHeader } from './SectionHeader'
import type { ColorScheme } from '../../types/colors'
import type { Game } from '../../types'

/**
 * PosterRail — v2 rail of 2:3 poster cards. `ranked` switches to the "Top 10" look
 * (huge outlined numerals beside each card). Cards render through GameCover (LQIP/cache).
 */
export const PosterRail = memo(function PosterRail({
  title, subtitle, icon, color, games, onGameClick, onSeeAll, ranked = false,
}: {
  title: string; subtitle?: string; icon: any; color: string; games: Game[];
  onGameClick: (g: Game) => void; onSeeAll?: () => void; colors?: ColorScheme; ranked?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const list = games.slice(0, ranked ? 10 : 18)
  if (list.length === 0) return null

  return (
    <section className="flex flex-col gap-3.5 v2-rise">
      <SectionHeader icon={icon} color={color} title={title} sub={subtitle} scrollRef={ref} onSeeAll={onSeeAll} />
      <div ref={ref} className="flex overflow-x-auto scrollbar-hide" style={{ gap: ranked ? 4 : 16, scrollBehavior: 'smooth', padding: '8px 2px 14px', margin: '-8px -2px -14px' }}>
        {list.map((game, i) => ranked ? (
          <div key={game.appid} className="flex-none flex items-end">
            <span className="select-none" style={{ fontSize: 160, fontWeight: 800, lineHeight: .76, letterSpacing: '-.09em', color: 'transparent', WebkitTextStroke: '2px rgba(255,255,255,.2)', marginInlineEnd: -22, paddingBottom: 44 }}>{i + 1}</span>
            <div className="relative" style={{ width: 148 }}>
              <PosterCard game={game} onClick={() => onGameClick(game)} delay={Math.min(i * 0.03, 0.4)} />
            </div>
          </div>
        ) : (
          <div key={game.appid} className="flex-none" style={{ width: 172 }}>
            <PosterCard game={game} onClick={() => onGameClick(game)} delay={Math.min(i * 0.03, 0.4)} />
          </div>
        ))}
      </div>
    </section>
  )
})
