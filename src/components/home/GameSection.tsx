import { useEffect, useState, useMemo, useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { loadGameImage } from '../../services/imageCache'
import type { ColorScheme } from '../../types/colors'
import type { Game } from '../../types'

export function GameSection({ title, icon: Icon, games, color, onGameClick, onSeeAll, colors }: { title: string; icon: any; games: Game[]; color: string; onGameClick: (g: Game) => void; onSeeAll?: () => void; colors: ColorScheme }) {
  const ref = useRef<HTMLDivElement>(null)
  const [l, setL] = useState(false)
  const [r, setR] = useState(true)
  const [loadedCovers, setLoadedCovers] = useState<Set<string>>(new Set())
  const [failedCovers, setFailedCovers] = useState<Set<string>>(new Set())
  const [coverUrls, setCoverUrls] = useState<Record<string, string>>({})
  useEffect(() => {
    let mounted = true
    const loadAll = async () => {
      const results = await Promise.all(
        games.slice(0, 30).map(g =>
          loadGameImage(g.appid, g.header_image || undefined, g.name || undefined, ['header.jpg'])
            .then(url => ({ appid: g.appid, url }))
            .catch(() => ({ appid: g.appid, url: null }))
        )
      )
      if (!mounted) return
      const urls: Record<string, string> = {}
      for (const { appid, url } of results) {
        if (url) urls[appid] = url
      }
      setCoverUrls(urls)
    }
    loadAll()
    return () => { mounted = false }
  }, [games.map(g => g.appid).join(',')])
  const validGames = useMemo(() => games.slice(0, 30).filter(g => loadedCovers.has(g.appid)), [games, loadedCovers])
  const totalGames = useMemo(() => games.slice(0, 30), [games])
  if (totalGames.length === 0) return null
  const sc = () => { if (ref.current) { const { scrollLeft: sl, scrollWidth: sw, clientWidth: cw } = ref.current; setL(sl > 0); setR(sl < sw - cw - 10) } }
  const scroll = (d: 'l' | 'r') => { if (ref.current) ref.current.scrollBy({ left: d === 'l' ? -500 : 500, behavior: 'smooth' }) }
  return (
    <div className="mb-10 relative">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2"><Icon size={22} style={{ color }} /><h3 className="text-xl font-bold" style={{ color: colors.text }}>{title}</h3><span className="text-xs px-2 py-0.5 rounded-full" style={{ background: color + '20', color }}>{validGames.length}</span></div>
        {onSeeAll && <button onClick={onSeeAll} className="text-sm px-4 py-2 rounded-xl cursor-pointer hover:brightness-110 entrance-fade" style={{ background: color + '20', color, border: `1px solid ${color}40` }}>See All →</button>}
      </div>
      <div className="relative">
        {l && <button onClick={() => scroll('l')} className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full flex items-center justify-center hover-lift" style={{ background: colors.bgCard, border: `1px solid ${colors.border}` }}><ChevronLeft size={24} style={{ color: colors.text }} /></button>}
        {r && <button onClick={() => scroll('r')} className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full flex items-center justify-center hover-lift" style={{ background: colors.bgCard, border: `1px solid ${colors.border}` }}><ChevronRight size={24} style={{ color: colors.text }} /></button>}
        <div ref={ref} onScroll={sc} className="flex gap-5 overflow-x-auto scrollbar-hide pb-2 px-1">
          {totalGames.map((g, i) => {
            const hasCover = loadedCovers.has(g.appid) && !failedCovers.has(g.appid)
            if (!hasCover && failedCovers.has(g.appid)) return null
            return (
              <div key={g.appid} onClick={() => onGameClick(g)} className="flex-shrink-0 w-[280px] cursor-pointer group entrance-slide-right" style={{ animationDelay: `${i * 0.015}s`, display: hasCover ? 'block' : 'none' }}>
                <div className="relative h-[160px] rounded-2xl overflow-hidden mb-3" style={{ background: colors.violet + '20', border: `1px solid ${colors.border}` }}>
                <img 
                  src={coverUrls[g.appid]} 
                  alt={g.name} 
                  className="w-full h-full object-cover transition-transform duration-100 group-hover:scale-115" 
                  loading="lazy"
                  decoding="async"
                  onLoad={() => setLoadedCovers(prev => new Set(prev).add(g.appid))}
                  onError={() => setFailedCovers(prev => new Set(prev).add(g.appid))}
                />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-base font-semibold truncate" style={{ color: colors.text }}>{g.name}</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
