import { memo, useEffect, useState } from 'react'
import { Sparkles, Star as StarIcon2 } from 'lucide-react'
import { loadGameImage } from '../../services/imageCache'
import type { ColorScheme } from '../../types/colors'
import type { Game } from '../../types'
import { getSteamImage } from '../../utils/gameHelpers'

export const AIRecommendationsCard = memo(function AIRecommendationsCard({ games, onGameClick, colors }: { games: Game[]; onGameClick: (g: Game) => void; colors: ColorScheme }) {
  const [coverUrls, setCoverUrls] = useState<Record<string, string>>({})
  useEffect(() => {
    let mounted = true
    const loadAll = async () => {
      const urls: Record<string, string> = {}
      for (const g of games.slice(0, 12)) {
        try {
          const url = await loadGameImage(g.appid, g.header_image || undefined, g.name || undefined)
          if (url) urls[g.appid] = url
        } catch {}
      }
      if (mounted) setCoverUrls(urls)
    }
    loadAll()
    return () => { mounted = false }
  }, [games])
  return (
    <div 
      className="rounded-3xl p-6 entrance-fade-up"
      style={{ 
        background: `linear-gradient(135deg, ${colors.amber}15 0%, ${colors.bgCard} 100%)`,
        border: `1px solid ${colors.amber}30`,
        boxShadow: `0 8px 32px ${colors.amber}10, inset 0 1px 0 ${colors.amber}10`
      }}
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center glow-pulse"
            style={{ background: `${colors.amber}25`, '--glow-start': `0 0 12px ${colors.amber}20`, '--glow-peak': `0 0 24px ${colors.amber}40` } as React.CSSProperties}
          >
            <Sparkles size={24} style={{ color: colors.amber }} />
          </div>
          <div>
            <h3 className="text-xl font-bold" style={{ color: colors.text }}>AI Recommendations</h3>
            <p className="text-sm" style={{ color: colors.textMuted }}>Based on your installed games</p>
          </div>
        </div>
        <div className="px-4 py-2 rounded-xl" style={{ background: `${colors.amber}20`, color: colors.amber }}>
          <span className="text-sm font-bold">{games.length} Suggestions</span>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {games.slice(0, 12).map((game, i) => (
          <div
            key={game.appid}
            className="cursor-pointer group entrance-scale"
            style={{ animationDelay: `${i * 0.05}s` }}
            onClick={() => onGameClick(game)}
          >
            <div
              className="relative h-[140px] rounded-xl overflow-hidden mb-2 transition-all duration-80"
              style={{
                border: `1px solid ${colors.border}`,
                background: `linear-gradient(135deg, ${colors.violet}20, ${colors.blue}15)`,
              }}
            >
              {/* Hover glow overlay */}
              <div
                className="absolute inset-0 pointer-events-none z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-80"
                style={{ background: `radial-gradient(ellipse at 50% 50%, ${colors.amber}25 0%, transparent 70%)` }}
              />
              <img 
                src={coverUrls[game.appid] || game.header_image || getSteamImage(game.appid)} 
                alt=""
                className="w-full h-full object-cover transition-transform duration-80 ease-[cubic-bezier(0.4,0,0.2,1)] group-hover:scale-125"
                loading="lazy" decoding="async"
                onError={e => { e.currentTarget.style.display = 'none'; const p = e.currentTarget.parentElement?.querySelector('.img-fallback') as HTMLElement; if (p) p.style.display = 'flex'; }}
              />
              <div className="img-fallback absolute inset-0 hidden items-center justify-center">
                <span className="text-3xl font-bold" style={{ color: colors.violet, textShadow: `0 2px 10px ${colors.violet}60` }}>{game.name?.[0]?.toUpperCase() || '?'}</span>
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              <div className="absolute bottom-2 left-2 right-2 z-20">
                <div className="flex items-center gap-1 text-xs" style={{ color: colors.amber }}>
                  <StarIcon2 size={12} className="fill-current" />
                  <span>Recommended</span>
                </div>
              </div>
            </div>
            <p className="text-sm font-semibold truncate" style={{ color: colors.text }}>{game.name}</p>
            <p className="text-xs truncate" style={{ color: colors.textMuted }}>{game.appid}</p>
          </div>
        ))}
      </div>
    </div>
  )
})
