import { memo, useState, useEffect } from 'react'
import { ChevronRight } from 'lucide-react'
import { loadGameImage } from '../../services/imageCache'
import type { ColorScheme } from '../../types/colors'
import type { Game } from '../../types'
import { getSteamImage, getGenreTag } from '../../utils/gameHelpers'
import { SectionHeader } from './SectionHeader'
import { useT } from '../../i18n'
import { useGenreLabel } from '../../utils/genreLabel'

function useHeaderImg(game: Game) {
  const [imgUrl, setImgUrl] = useState<string | null>(null)
  useEffect(() => {
    let mounted = true
    loadGameImage(game.appid, game.header_image || undefined, game.name || undefined, ['header.jpg']).then(url => {
      if (mounted) setImgUrl(url)
    }).catch(() => {})
    return () => { mounted = false }
  }, [game.appid, game.header_image, game.name])
  return imgUrl || game.header_image || getSteamImage(game.appid)
}

// ── BentoGameCard — v2 wide tile: cover, bottom gradient, title + genre chip ──
const BentoGameCard = function BentoGameCard({ game, size, onClick, delay }: {
  game: Game; size: 'large' | 'medium' | 'small'; onClick: () => void; delay: number
}) {
  const gl = useGenreLabel()
  const src = useHeaderImg(game)
  const tag = getGenreTag(game)
  const heights = { large: 'h-[160px]', medium: 'h-[140px]', small: 'h-[100px]' }
  return (
    <div onClick={onClick}
      className={`v2-lift relative ${heights[size]} rounded-[18px] overflow-hidden cursor-pointer`}
      style={{ background: '#10101c', border: '1px solid rgba(255,255,255,.07)', animation: `v2-riseIn .4s var(--ease-out) ${delay}s both` }}>
      <img src={src} alt={game.name} className="absolute inset-0 w-full h-full object-cover" loading="lazy" decoding="async"
        onError={e => { e.currentTarget.style.visibility = 'hidden' }} />
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(0deg, rgba(6,6,12,.92) 0%, rgba(6,6,12,0) 60%)' }} />
      <div className="absolute inset-x-3.5 bottom-3 min-w-0">
        {size !== 'small' && tag && <span className="text-[10.5px] font-semibold px-2 py-[3px] rounded-md inline-block mb-1.5" style={{ background: 'rgba(255,255,255,.14)' }}>{gl(tag)}</span>}
        <p className={`${size === 'small' ? 'text-[13px]' : 'text-[15px]'} font-semibold truncate`} style={{ color: '#f3f2fa' }}>{game.name}</p>
      </div>
    </div>
  )
}

// ── BentoListCard — v2 row ──
const BentoListCard = function BentoListCard({ game, onClick }: { game: Game; onClick: () => void }) {
  const src = useHeaderImg(game)
  return (
    <div onClick={onClick} className="v2-row flex items-center gap-3 px-2 py-1.5 rounded-xl cursor-pointer">
      <div className="w-14 h-8 rounded-md overflow-hidden relative shrink-0" style={{ background: '#151524' }}>
        <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" onError={e => { e.currentTarget.style.visibility = 'hidden' }} />
      </div>
      <p className="flex-1 min-w-0 text-[13.5px] font-semibold truncate" style={{ color: '#f3f2fa' }}>{game.name}</p>
      <ChevronRight size={16} className="rtl-flip" style={{ color: '#8b8aa3' }} />
    </div>
  )
}

// ── BentoCard ──
export const BentoCard = memo(function BentoCard({ title, icon, color, games, layout, onGameClick, onSeeAll }: {
  title: string; icon: any; color: string; games: Game[]; layout: 'large' | 'medium' | 'compact' | 'list';
  onGameClick: (g: Game) => void; onSeeAll?: () => void; colors?: ColorScheme
}) {
  const t = useT()
  if (games.length === 0) return null
  const grid = layout === 'medium' ? 'grid-cols-3' : 'grid-cols-4'
  return (
    <section className="v2-panel p-[18px] flex flex-col gap-3.5 v2-rise">
      <SectionHeader icon={icon} color={color} title={title} sub={t('app.count.games', { n: games.length })} onSeeAll={onSeeAll} />
      {layout === 'list' ? (
        <div className="flex flex-col">
          {games.slice(0, 8).map(game => <BentoListCard key={game.appid} game={game} onClick={() => onGameClick(game)} />)}
        </div>
      ) : (
        <div className={`grid ${grid} gap-3`}>
          {games.map((game, i) => (
            <BentoGameCard key={game.appid} game={game} size={layout === 'compact' ? 'small' : layout === 'medium' ? 'medium' : 'large'} onClick={() => onGameClick(game)} delay={Math.min(i * 0.03, 0.3)} />
          ))}
        </div>
      )}
    </section>
  )
})
