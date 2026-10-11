import { memo, useMemo } from 'react'
import { Sword, Shield, Target, Zap, Gem, Users, Shapes, Smile } from 'lucide-react'
import { SectionHeader } from './SectionHeader'
import { HOME_SECTION_SETS } from '../../hooks/useGameFilters'
import { steamPortrait, coverFallback } from '../../utils/gameHelpers'
import type { Game } from '../../types'
import type { ColorScheme } from '../../types/colors'
import { useT } from '../../i18n'
import { useGenreLabel } from '../../utils/genreLabel'

type Tile = { name: string; icon: any; color: string; n: number; covers: string[] }

const compact = (n: number) => n.toLocaleString()

/** Explore by genre — v2 tiles with a 3-cover fan + live count (design: "Explore by genre"). */
export const CategoriesShowcase = memo(function CategoriesShowcase({ onCategoryClick, colors, games }: { onCategoryClick: (genre: string) => void; colors: ColorScheme; games: Game[] }) {
  const t = useT()
  const gl = useGenreLabel()
  // One pass over the catalogue (65k+) — set lookups only; recomputed only when the games array identity changes.
  const tiles = useMemo<Tile[]>(() => {
    const S = HOME_SECTION_SETS
    const defs = [
      { name: 'Action', icon: Sword, color: colors.red, has: (g: Game) => S.action.has(g.appid) },
      { name: 'RPG', icon: Shield, color: colors.blue, has: (g: Game) => S.rpg.has(g.appid) },
      { name: 'Strategy', icon: Target, color: colors.amber, has: (g: Game) => S.strategy.has(g.appid) },
      { name: 'Indie', icon: Gem, color: colors.violet, has: (g: Game) => S.indie.has(g.appid) },
      { name: 'Multiplayer', icon: Users, color: colors.green, has: (g: Game) => S.multiplayer.has(g.appid) },
      { name: 'Casual', icon: Smile, color: colors.cyan, has: (g: Game) => S.casual.has(g.appid) },
      { name: 'Racing', icon: Zap, color: colors.pink, has: (g: Game) => !!g.genres?.some(x => /racing/i.test(x)) || !!g.tags?.some(x => /racing/i.test(x)) },
    ]
    const acc = defs.map(() => ({ n: 0, pop: [] as string[], any: [] as string[] }))
    for (const g of games) {
      for (let i = 0; i < defs.length; i++) {
        if (!defs[i]!.has(g)) continue
        const a = acc[i]!
        a.n++
        if (a.any.length < 3) a.any.push(g.appid)
        if (a.pop.length < 3 && S.popular.has(g.appid)) a.pop.push(g.appid)
      }
    }
    return defs.map((d, i) => ({ name: d.name, icon: d.icon, color: d.color, n: acc[i]!.n, covers: acc[i]!.pop.length === 3 ? acc[i]!.pop : acc[i]!.any }))
  }, [games, colors])

  const fan = (appid: string | undefined, style: React.CSSProperties) =>
    appid ? <img src={steamPortrait(appid)} onError={e => coverFallback(e, appid)} alt="" loading="lazy" decoding="async" style={{ position: 'absolute', objectFit: 'cover', ...style }} /> : null

  return (
    <section className="flex flex-col gap-3.5 v2-rise">
      <SectionHeader icon={Shapes} color={colors.pink} title={t('app.home.byGenre')} sub={t('app.home.byGenreSub')} />
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(236px,1fr))' }}>
        {tiles.map((cat, i) => (
          <button
            key={cat.name}
            onClick={() => onCategoryClick(cat.name)}
            className="v2-genre relative overflow-hidden text-start cursor-pointer text-white"
            style={{
              height: 118, borderRadius: 18, padding: 16,
              border: `1px solid color-mix(in oklch, ${cat.color} 32%, transparent)`,
              background: `linear-gradient(135deg, color-mix(in oklch, ${cat.color} 28%, #0d0d18) 0%, #0d0d18 78%)`,
              transition: 'transform .35s var(--ease-out), box-shadow .35s',
              animation: `v2-riseIn .4s ${i * 0.04}s both`,
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = `0 22px 40px -20px ${cat.color}` }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
          >
            <div className="v2-genre-fan pointer-events-none" style={{ position: 'absolute', insetInlineEnd: -4, top: 16, width: 130, height: 110 }}>
              {fan(cat.covers[0], { insetInlineEnd: 64, top: 12, width: 50, height: 75, borderRadius: 7, transform: 'rotate(-14deg)', boxShadow: '0 8px 20px rgba(0,0,0,.6)', opacity: .8 })}
              {fan(cat.covers[2], { insetInlineEnd: 6, top: 12, width: 50, height: 75, borderRadius: 7, transform: 'rotate(12deg)', boxShadow: '0 8px 20px rgba(0,0,0,.6)', opacity: .8 })}
              {fan(cat.covers[1], { insetInlineEnd: 33, top: 0, width: 56, height: 84, borderRadius: 8, boxShadow: '0 10px 24px rgba(0,0,0,.7)' })}
            </div>
            <div className="relative flex flex-col h-full justify-between">
              <cat.icon size={20} style={{ color: cat.color }} />
              <div>
                <div className="text-base font-semibold">{gl(cat.name)}</div>
                <div className="mono" style={{ fontSize: 11, color: '#c9c8da', marginTop: 2 }}>{t('app.count.games', { n: compact(cat.n) })}</div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  )
})
