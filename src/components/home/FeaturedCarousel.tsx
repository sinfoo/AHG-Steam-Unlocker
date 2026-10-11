import { memo, useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { ChevronLeft, ChevronRight, Heart } from 'lucide-react'
import { loadGameImage } from '../../services/imageCache'
import type { ColorScheme } from '../../types/colors'
import type { Game } from '../../types'
import { useUserStore, useFavorites } from '../../store'
import { useT } from '../../i18n'

export const FeaturedCarousel = memo(function FeaturedCarousel({ title, subtitle, icon: Icon, color, games, onGameClick, colors, onToggleFavorite }: {
  title: string; subtitle: string; icon: any; color: string; games: Game[]; onGameClick: (g: Game) => void; colors: ColorScheme; onToggleFavorite?: (appid: string) => void
}) {
  const t = useT()
  const trackRef = useRef<HTMLDivElement>(null)
  const carouselRef = useRef<HTMLDivElement>(null)
  const storeToggleFavorite = useUserStore(s => s.toggleFavorite)
  const toggleFavorite = onToggleFavorite || storeToggleFavorite
  const favorites = useFavorites()
  const [isPaused, setIsPaused] = useState(false)
  const [coverUrls, setCoverUrls] = useState<Record<string, string>>({})
  useEffect(() => {
    let mounted = true
    const loadAll = async () => {
      const urls: Record<string, string> = {}
      for (const g of games) {
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

  // 2x duplication for seamless CSS marquee (was 3x with rAF)
  const looped = useMemo(() => [...games, ...games], [games])
  // ~2.5s per game, min 15s for short lists
  const duration = useMemo(() => Math.max(games.length * 2.5, 15), [games.length])
  const animName = useMemo(() => `mq-${Math.random().toString(36).slice(2, 8)}`, [])

  // Jump the marquee forward/backward by N cards on arrow click
  const handleScroll = useCallback((dir: 'l' | 'r') => {
    const el = trackRef.current
    if (!el) return
    // 200px card + 16px gap = 216px per item; jump 3 cards
    const itemStep = 216 * 3
    const copyWidth = games.length * 216
    // Pause, read current translateX
    el.style.animationPlayState = 'paused'
    const matrix = getComputedStyle(el).transform
    let curX = 0
    if (matrix && matrix !== 'none') {
      const vals = matrix.match(/[-.\d]+/g)
      if (vals && vals.length >= 5) curX = parseFloat(vals[4]!)
    }
    // New position, wrap within [0, -copyWidth)
    let newX = curX + (dir === 'l' ? itemStep : -itemStep)
    if (newX > 0) newX -= copyWidth
    if (newX <= -copyWidth) newX += copyWidth
    // Remove animation, set transform directly
    el.style.animation = 'none'
    el.style.transform = `translateX(${newX}px)`
    void el.offsetWidth // force reflow
    // Re-apply animation; negative delay starts at the right position
    const progress = Math.abs(newX) / copyWidth // 0..1
    el.style.animation = `${animName} ${duration}s linear infinite`
    el.style.animationDelay = `-${(duration * progress).toFixed(2)}s`
    if (isPaused) el.style.animationPlayState = 'paused'
  }, [games.length, animName, duration, isPaused])

  return (
    <div
      ref={carouselRef}
      className="rounded-3xl overflow-hidden"
      style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, animation: 'fadeInUp 0.3s ease-out' }}
    >
      {/* Header */}
      <div className="p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: color + '25' }}>
            <Icon size={20} style={{ color }} />
          </div>
          <div>
            <h3 className="text-lg font-bold" style={{ color: colors.text }}>{title}</h3>
            <p className="text-xs" style={{ color: colors.textMuted }}>{subtitle}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleScroll('l')}
            aria-label={t('app.scroll.left')}
            className="w-9 h-9 rounded-full flex items-center justify-center feat-btn-hover"
            style={{ background: colors.bgHover, border: `1px solid ${colors.border}` }}
          >
            <ChevronLeft size={18} style={{ color: colors.text }} />
          </button>
          <button
            onClick={() => handleScroll('r')}
            aria-label={t('app.scroll.right')}
            className="w-9 h-9 rounded-full flex items-center justify-center feat-btn-hover"
            style={{ background: colors.bgHover, border: `1px solid ${colors.border}` }}
          >
            <ChevronRight size={18} style={{ color: colors.text }} />
          </button>
        </div>
      </div>

      {/* CSS-only marquee — overflow hidden, animated via @keyframes */}
      <div
        className="overflow-hidden"
        onMouseEnter={() => { setIsPaused(true); if (trackRef.current) trackRef.current.style.animationPlayState = 'paused' }}
        onMouseLeave={() => { setIsPaused(false); if (trackRef.current) trackRef.current.style.animationPlayState = 'running' }}
      >
        <style>{`
@keyframes ${animName} {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
.feat-btn-hover { transition: transform 80ms cubic-bezier(0.4,0,0.2,1); }
.feat-btn-hover:hover { transform: scale(1.1); }
.feat-btn-view { transition: transform 80ms cubic-bezier(0.4,0,0.2,1); }
.feat-btn-view:hover { transform: scale(1.05); }
.feat-card-lift { transition: transform 80ms cubic-bezier(0.4,0,0.2,1); }
.feat-card-lift:hover { transform: translateY(-6px) scale(1.02); }
.feat-reveal { transition: opacity 80ms cubic-bezier(0.4,0,0.2,1); }
        `}</style>
        <div
          ref={trackRef}
          className="flex gap-4 px-5 pb-5"
          style={{
            width: 'max-content',
            animation: `${animName} ${duration}s linear infinite`,
            willChange: 'transform',
          }}
        >
          {looped.map((game, i) => {
            const isFav = favorites.has(game.appid)
            return (
              <div
                key={`${game.appid}-${i}`}
                className="relative shrink-0 w-[200px] rounded-2xl overflow-hidden cursor-pointer group feat-card-lift"
                style={{ background: colors.bgHover, border: `1px solid ${colors.border}` }}
                onClick={() => onGameClick(game)}
              >
                {/* Cover image */}
                <div className="aspect-[16/9] overflow-hidden">
                  <img
                    src={coverUrls[game.appid]}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={e => {
                      e.currentTarget.style.display = 'none'
                      const p = e.currentTarget.parentElement?.querySelector('.feat-fallback') as HTMLElement
                      if (p) p.style.display = 'flex'
                    }}
                  />
                  <div className="feat-fallback absolute inset-0 hidden items-center justify-center" style={{ background: `linear-gradient(135deg, ${colors.violet}30, ${colors.blue}20)` }}>
                    <span className="text-2xl font-bold" style={{ color: colors.violet }}>{game.name?.[0]?.toUpperCase() || '?'}</span>
                  </div>
                </div>

                {/* Info overlay on hover */}
                <div
                  className="absolute inset-0 flex flex-col justify-end p-3 opacity-0 group-hover:opacity-100 feat-reveal"
                  style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.3) 60%, transparent 100%)' }}
                >
                  <p className="text-sm font-bold truncate" style={{ color: colors.text }}>{game.name}</p>
                  <p className="text-xs truncate mt-0.5" style={{ color: colors.textSecondary }}>{(game as any).genre || t('app.card.game')}</p>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); onGameClick(game) }}
                      className="flex-1 text-[10px] font-bold py-2 rounded-lg feat-btn-view"
                      style={{ background: color, color: 'white' }}
                    >
                      {t('app.card.view')}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(game.appid) }}
                      className="w-8 h-8 rounded-lg flex items-center justify-center feat-btn-hover"
                      style={{ background: isFav ? 'rgba(239,68,68,0.9)' : 'rgba(255,255,255,0.15)' }}
                    >
                      <Heart size={12} className={isFav ? 'text-white fill-white' : 'text-white'} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
})
