import { memo, useState, useEffect, useMemo } from 'react'
import { ChevronRight } from 'lucide-react'
import { loadGameImage } from '../../services/imageCache'
import { COLORS } from '../../constants/colors'
import type { ColorScheme } from '../../types/colors'
import type { Game } from '../../types'
import { getSteamImage, getGenreHue } from '../../utils/gameHelpers'

// ── BentoGameCard ──
const BentoGameCard = function BentoGameCard({ game, size, onClick, colors }: { 
  game: Game; size: 'large' | 'medium' | 'small';
  onClick: () => void; colors: ColorScheme 
}) {
  const heights = { large: 'h-[160px]', medium: 'h-[140px]', small: 'h-[100px]' }
  const [isHovered, setIsHovered] = useState(false)
  const [imgUrl, setImgUrl] = useState<string | null>(null)
  useEffect(() => {
    let mounted = true
    loadGameImage(game.appid, game.header_image || undefined, game.name || undefined, ['header.jpg']).then(url => {
      if (mounted) setImgUrl(url)
    }).catch(() => {})
    return () => { mounted = false }
  }, [game.appid, game.header_image, game.name])
  const genreHue = useMemo(() => getGenreHue(game), [game])
  
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative ${heights[size]} rounded-2xl overflow-hidden cursor-pointer group active:scale-[0.97]`}
      style={{
        background: `linear-gradient(180deg, ${colors.bgCardGlass} 0%, rgba(12,12,24,0.6) 100%)`,
        ...(isHovered ? { backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' } : {}),
        border: `1px solid ${
          isHovered
            ? `hsla(${genreHue}, 50%, 45%, 0.35)`
            : COLORS.whiteGlassBorder
        }`,
        boxShadow: isHovered
          ? `0 24px 64px hsla(${genreHue}, 50%, 20%, 0.4), 0 0 120px hsla(${genreHue}, 60%, 40%, 0.12), inset 0 0 0 1px hsla(${genreHue}, 60%, 50%, 0.15)`
          : `0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)`,
        transform: isHovered ? 'translateY(-4px) scale(1.02)' : 'translateY(0) scale(1)',
        transformStyle: 'preserve-3d',
        perspective: 800,
        transition: 'all 0.08s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* Game cover image - full bleed */}
      <img 
        src={imgUrl || game.header_image || getSteamImage(game.appid)} 
        alt={game.name}
        className="w-full h-full object-cover transition-transform duration-80 ease-[cubic-bezier(0.4,0,0.2,1)] group-hover:scale-125"
        loading="lazy" decoding="async"
        onError={e => { 
          e.currentTarget.style.display = 'none'; 
          const p = e.currentTarget.parentElement?.querySelector('.img-fallback') as HTMLElement; 
          if (p) p.style.display = 'flex'; 
        }}
      />
      
      {/* Fallback initials when image fails to load */}
      <div className="img-fallback absolute inset-0 hidden items-center justify-center" style={{ background: `linear-gradient(135deg, ${colors.violet}25, ${colors.blue}15)` }}>
        <span style={{ color: colors.violet, fontWeight: 'bold', fontSize: size === 'large' ? 36 : size === 'medium' ? 30 : 20, textShadow: `0 2px 10px ${colors.violet}60` }}>{game.name?.[0]?.toUpperCase() || '?'}</span>
      </div>
      
      {/* Genre-tinted glow overlay on hover — more dramatic */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 50% 40%, hsla(${genreHue}, 70%, 55%, 0.3) 0%, hsla(${genreHue}, 60%, 40%, 0.1) 50%, transparent 80%)`,
          opacity: isHovered ? 1 : 0,
          transition: 'opacity 0.08s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      />
      
      {/* Cinematic gradient overlay for text readability */}
      <div 
        className="absolute inset-x-0 bottom-0 h-2/4 pointer-events-none transition-all duration-80 ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{ 
          background: 'linear-gradient(to top, rgba(18, 18, 31, 0.95) 25%, rgba(18, 18, 31, 0.4) 50%, rgba(18, 18, 31, 0.1) 75%, transparent 100%)',
          opacity: isHovered ? 0.9 : 0.75,
        }}
      />
      
      {/* Inner glow ring on hover */}
      <div 
        className="absolute inset-0 rounded-2xl pointer-events-none transition-opacity duration-80 ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{ 
          opacity: isHovered ? 1 : 0,
          boxShadow: `inset 0 0 0 1px hsla(${genreHue}, 60%, 50%, 0.2), inset 0 0 40px hsla(${genreHue}, 60%, 40%, 0.04)`,
        }}
      />
      
      {/* Premium sheen/sweep light overlay on hover */}
      {isHovered && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div 
            className="absolute -inset-full top-0"
            style={{
              background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.04) 45%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.04) 55%, transparent 70%)',
              transform: 'skewX(-15deg)',
              animation: 'sheen-sweep 2.5s ease-in-out infinite',
            }}
          />
        </div>
      )}
      
      {/* Game name and info at bottom */}
      <div className="absolute bottom-0 left-0 right-0 p-3 z-10">
        <p 
          className="text-sm font-bold truncate"
          style={{ 
            color: isHovered ? `hsl(${genreHue}, 60%, 75%)` : COLORS.white,
            textShadow: '0 1px 8px rgba(0,0,0,0.5)',
            transition: 'color 0.08s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {game.name}
        </p>
      </div>
    </div>
  )
}

// ── BentoListCard ──
const BentoListCard = function BentoListCard({ game, onClick, colors }: { game: Game; onClick: () => void; colors: ColorScheme }) {
  const [isHovered, setIsHovered] = useState(false)
  const [imgUrl, setImgUrl] = useState<string | null>(null)
  useEffect(() => {
    let mounted = true
    loadGameImage(game.appid, game.header_image || undefined, game.name || undefined, ['header.jpg']).then(url => {
      if (mounted) setImgUrl(url)
    }).catch(() => {})
    return () => { mounted = false }
  }, [game.appid, game.header_image, game.name])
  const genreHue = useMemo(() => getGenreHue(game), [game])
  
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="flex items-center gap-3 p-3 rounded-xl cursor-pointer relative overflow-hidden active:scale-[0.98]"
      style={{ 
        background: isHovered 
          ? `linear-gradient(135deg, ${colors.bgCardGlass} 0%, rgba(30,30,60,0.4) 100%)`
          : colors.bgCardGlass,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: `1px solid ${
          isHovered 
            ? `hsla(${genreHue}, 50%, 45%, 0.3)`
            : COLORS.whiteGlassBorder
        }`,
        boxShadow: isHovered 
          ? `0 12px 40px hsla(${genreHue}, 50%, 20%, 0.3), 0 0 60px hsla(${genreHue}, 60%, 40%, 0.08), inset 0 0 0 1px hsla(${genreHue}, 60%, 50%, 0.12)`
          : '0 2px 8px rgba(0,0,0,0.2)',
        transform: isHovered ? 'translateX(8px)' : 'translateX(0)',
        transition: 'all 0.08s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* Left accent glow bar on hover */}
      <div 
        className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full transition-opacity duration-80 ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{ 
          opacity: isHovered ? 1 : 0,
          background: `linear-gradient(180deg, hsla(${genreHue}, 60%, 50%, 0.6), transparent)`,
          boxShadow: isHovered ? `0 0 8px hsla(${genreHue}, 60%, 50%, 0.4)` : 'none',
        }}
      />
      
      <div className="w-14 h-8 rounded-lg overflow-hidden relative shrink-0" style={{ background: `linear-gradient(135deg, ${colors.violet}20, ${colors.blue}15)` }}>
        <img 
          src={imgUrl || game.header_image || getSteamImage(game.appid)} 
          alt=""
          className="w-full h-full object-cover transition-transform duration-80 ease-[cubic-bezier(0.4,0,0.2,1)]"
          style={{ transform: isHovered ? 'scale(1.1)' : 'scale(1)' }}
          loading="lazy"
          decoding="async"
          onError={e => { e.currentTarget.style.display = 'none'; const p = e.currentTarget.parentElement?.querySelector('.img-fallback') as HTMLElement; if (p) p.style.display = 'flex'; }}
        />
        <div className="img-fallback absolute inset-0 hidden items-center justify-center">
          <span className="text-xs font-bold" style={{ color: colors.violet }}>{game.name?.[0]?.toUpperCase() || '?'}</span>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p 
          className="text-sm font-semibold truncate"
          style={{
            color: isHovered ? `hsl(${genreHue}, 60%, 70%)` : colors.text,
            transition: 'color 0.08s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {game.name}
        </p>
      </div>
      <div
        style={{
          transform: isHovered ? 'translateX(3px)' : 'translateX(0)',
          transition: 'transform 0.08s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <ChevronRight size={16} style={{ color: isHovered ? `hsl(${genreHue}, 60%, 70%)` : colors.textMuted }} />
      </div>
    </div>
  )
}

// ── BentoCard ──
export const BentoCard = memo(function BentoCard({ title, icon: Icon, color, games, layout, onGameClick, onSeeAll, colors }: { 
  title: string; icon: any; color: string; games: Game[]; layout: 'large' | 'medium' | 'compact' | 'list';
  onGameClick: (g: Game) => void; onSeeAll?: () => void; colors: ColorScheme 
}) {
  if (games.length === 0) return null
  
  return (
    <div 
      className="page-enter rounded-3xl overflow-hidden"
      style={{ 
        background: `linear-gradient(135deg, ${color}08 0%, ${colors.bgCard} 100%)`,
        border: `1px solid ${color}20`
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: color + '25' }}>
            <Icon size={20} style={{ color }} />
          </div>
          <div>
            <h3 className="text-lg font-bold" style={{ color: colors.text }}>{title}</h3>
            <p className="text-xs" style={{ color: colors.textMuted }}>{games.length} games</p>
          </div>
        </div>
        {onSeeAll && (
          <button
            onClick={onSeeAll}
            className="px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 hover:scale-105 active:scale-95"
            style={{ background: color + '20', color, border: `1px solid ${color}40`, transition: 'transform 0.08s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.08s cubic-bezier(0.4, 0, 0.2, 1)' }}
          >
            See All <ChevronRight size={16} />
          </button>
        )}
      </div>
      
      {layout === 'large' && (
        <div className="px-5 pb-5">
          <div className="grid grid-cols-4 gap-3">
            {games.map((game, _i) => (
              <BentoGameCard key={game.appid} game={game} size="large" onClick={() => onGameClick(game)} colors={colors} />
            ))}
          </div>
        </div>
      )}
      
      {layout === 'medium' && (
        <div className="px-5 pb-5">
          <div className="grid grid-cols-3 gap-3">
            {games.map((game, _i) => (
              <BentoGameCard key={game.appid} game={game} size="medium" onClick={() => onGameClick(game)} colors={colors} />
            ))}
          </div>
        </div>
      )}
      
      {layout === 'compact' && (
        <div className="px-5 pb-5">
          <div className="grid grid-cols-4 gap-3">
            {games.map((game, _i) => (
              <BentoGameCard key={game.appid} game={game} size="small" onClick={() => onGameClick(game)} colors={colors} />
            ))}
          </div>
        </div>
      )}
      
      {layout === 'list' && (
        <div className="px-5 pb-5 space-y-2">
          {games.slice(0, 8).map((game, _i) => (
            <BentoListCard key={game.appid} game={game} onClick={() => onGameClick(game)} colors={colors} />
          ))}
        </div>
      )}
    </div>
  )
})
