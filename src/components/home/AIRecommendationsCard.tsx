import { memo, useEffect, useState } from 'react'
import { loadGameImage } from '../../services/imageCache'
import type { ColorScheme } from '../../types/colors'
import type { Game } from '../../types'
import { getSteamImage, getGenreTag } from '../../utils/gameHelpers'
import { useT } from '../../i18n'
import { useGenreLabel } from '../../utils/genreLabel'

export const AIRecommendationsCard = memo(function AIRecommendationsCard({ games, onGameClick }: { games: Game[]; onGameClick: (g: Game) => void; colors?: ColorScheme }) {
  const t = useT()
  const gl = useGenreLabel()
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
    <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))' }}>
      {games.slice(0, 12).map((game, i) => (
        <div
          key={game.appid}
          onClick={() => onGameClick(game)}
          className="v2-lift relative cursor-pointer overflow-hidden rounded-2xl"
          style={{ background: '#10101c', border: '1px solid rgba(255,255,255,.07)', animation: `v2-riseIn .35s ${Math.min(i * 0.04, 0.4)}s both` }}
        >
          <img
            src={coverUrls[game.appid] || game.header_image || getSteamImage(game.appid)}
            alt="" loading="lazy" decoding="async"
            className="w-full block object-cover" style={{ aspectRatio: '460/215' }}
            onError={e => { e.currentTarget.style.visibility = 'hidden' }}
          />
          <div className="px-3 pt-2.5 pb-3 min-w-0">
            <div className="text-[13.5px] font-semibold truncate" style={{ color: '#f3f2fa' }}>{game.name}</div>
            <div className="mono text-[11px] mt-[3px] truncate" style={{ color: '#8b8aa3' }}>{(() => { const g = getGenreTag(game); return g ? gl(g) : t('app.home.recommended') })()}</div>
          </div>
        </div>
      ))}
    </div>
  )
})
