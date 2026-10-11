import { useEffect, useState, useMemo, useRef } from 'react'
import { SectionHeader } from './SectionHeader'
import { loadGameImage } from '../../services/imageCache'
import type { ColorScheme } from '../../types/colors'
import type { Game } from '../../types'
import { useT } from '../../i18n'

export function GameSection({ title, icon: Icon, games, color, onGameClick, onSeeAll, colors }: { title: string; icon: any; games: Game[]; color: string; onGameClick: (g: Game) => void; onSeeAll?: () => void; colors: ColorScheme }) {
  const t = useT()
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
    <section className="flex flex-col gap-3.5 v2-rise">
      <SectionHeader icon={Icon} color={color} title={title} sub={t('app.count.games', { n: validGames.length || totalGames.length })} scrollRef={ref} step={700} onSeeAll={onSeeAll} />
      <div ref={ref} onScroll={sc} className="flex gap-4 overflow-x-auto scrollbar-hide" style={{ scrollBehavior: 'smooth', padding: '8px 2px 14px', margin: '-8px -2px -14px' }}>
        {totalGames.map((g, i) => {
          const hasCover = loadedCovers.has(g.appid) && !failedCovers.has(g.appid)
          if (!hasCover && failedCovers.has(g.appid)) return null
          return (
            <div key={g.appid} onClick={() => onGameClick(g)} className="v2-lift relative flex-none cursor-pointer overflow-hidden rounded-[18px]"
              style={{ width: 340, aspectRatio: '16/9', background: '#10101c', border: '1px solid rgba(255,255,255,.07)', animation: `v2-riseIn .4s var(--ease-out) ${Math.min(i * 0.02, 0.4)}s both`, display: hasCover ? 'block' : 'none' }}>
              <img src={coverUrls[g.appid]} alt={g.name} className="absolute inset-0 w-full h-full object-cover" loading="lazy" decoding="async"
                onLoad={() => setLoadedCovers(prev => new Set(prev).add(g.appid))}
                onError={() => setFailedCovers(prev => new Set(prev).add(g.appid))} />
              <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(0deg, rgba(6,6,12,.95) 0%, rgba(6,6,12,.1) 60%)' }} />
              <div className="absolute inset-x-3.5 bottom-3 text-[15px] font-semibold whitespace-nowrap overflow-hidden text-ellipsis" style={{ color: '#f3f2fa' }}>{g.name}</div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
