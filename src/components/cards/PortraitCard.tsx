import { useState, useEffect, useMemo, useCallback, memo } from 'react'
import { Heart, HardDrive, Trash2, Check } from 'lucide-react'
import { loadGameImage, getLqipData, invalidateCacheKey, IMAGE_TYPES } from '../../services/imageCache'
import { generatePlaceholderGradient } from '../../services/placeholderGenerator'
import { getAverageColor } from '../../utils/getAverageColor'
import { COLORS } from '../../constants/colors'
import { getGenreHue, formatBytes } from '../../utils/gameHelpers'
import type { Game } from '../../types'
import type { ColorScheme } from '../../types/colors'

// ── PortraitCard (portrait orientation, genre-themed, for Recent/Favorites grid) ──
export const PortraitCard = memo(function PortraitCard({ game, index, isFavorite, isInstalled, onClick, onFavorite, onDelete, onContextMenu, colors }: {
  game: Game; index: number; isFavorite: boolean; isInstalled?: boolean; onClick: () => void; onFavorite: () => void; onDelete?: () => void; onContextMenu?: (e: React.MouseEvent, game: Game) => void; colors: ColorScheme
}) {
  const [isHovered, setIsHovered] = useState(false)
  const [imgSrc, setImgSrc] = useState<string | null>(null)
  const [lqip, setLqip] = useState<string | null>(null)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [showPlaceholder, setShowPlaceholder] = useState(true)
  const genreHue = useMemo(() => getGenreHue(game), [game])
  const [hoverColor, setHoverColor] = useState('rgb(100,100,100)')
  const hoverRgb = useMemo(() => {
    const m = hoverColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
    return m ? `${m[1]},${m[2]},${m[3]}` : '100,100,100'
  }, [hoverColor])
  const showName = game.name && game.name.trim() && !/^App\s+\d+$/i.test(game.name.trim())
  const gameInitial = useMemo(() => game.name?.[0]?.toUpperCase() || '?', [game.name])

  // Load portrait via the comprehensive imageCache system (108+ URL fallback chain + IndexedDB)
  useEffect(() => {
    let mounted = true
    setShowPlaceholder(true)
    setImgSrc(null)
    setLqip(null)
    setImageLoaded(false)
    loadGameImage(game.appid, game.header_image || undefined, game.name, IMAGE_TYPES.PORTRAIT).then(url => {
      if (mounted) {
        if (url) {
          setImgSrc(url)
          setShowPlaceholder(false)
          // Grab LQIP from memory map (available immediately after loadGameImage stores it)
          const lqipUrl = getLqipData(game.appid, IMAGE_TYPES.PORTRAIT)
          if (lqipUrl) setLqip(lqipUrl)
        } else {
          setShowPlaceholder(true)
        }
      }
    })
    return () => { mounted = false }
  }, [game.appid, game.name])

  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    // Orientation validation: if portrait was expected but image is landscape, retry
    // with portrait-oriented types only (header.jpg is always 460×215 landscape).
    if (img.naturalWidth > img.naturalHeight && img.naturalWidth > 100) {
      const key = `${game.appid}:${IMAGE_TYPES.PORTRAIT.join(',')}`
      invalidateCacheKey(key)
      setLqip(null) // clear stale LQIP immediately — don't show wrong-orientation blur
      loadGameImage(game.appid, undefined, game.name, IMAGE_TYPES.GRID).then(url => {
        if (url) {
          setImgSrc(url)
          // Grab fresh LQIP for the retried image
          const lqipUrl = getLqipData(game.appid, IMAGE_TYPES.GRID)
          if (lqipUrl) setLqip(lqipUrl)
        } else {
          setShowPlaceholder(true)
        }
      })
      return // don't show wrong-orientation image
    }
    setImageLoaded(true)
  }, [game.appid, game.name])

  const handleImageError = useCallback(() => {
    setShowPlaceholder(true)
    setImgSrc(null)
  }, [])

  return (
    <div
      onMouseEnter={() => {
        setIsHovered(true)
        if (imgSrc) getAverageColor(imgSrc).then(setHoverColor)
      }}
      onMouseLeave={() => setIsHovered(false)}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu?.(e, game); }}
      className="group relative rounded-xl overflow-hidden cursor-pointer flex flex-col"
      style={{
        zIndex: isHovered ? 20 : 1,
        background: colors.bgCard,
        transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
        border: `1px solid ${isHovered ? `rgba(${hoverRgb}, 0.4)` : 'rgba(255,255,255,0.06)'}`,
        boxShadow: isHovered
          ? `0 20px 60px rgba(${hoverRgb}, 0.25), 0 0 100px rgba(${hoverRgb}, 0.12), 0 0 0 1px rgba(${hoverRgb}, 0.35)`
          : `0 4px 12px rgba(0,0,0,0.3)`,
        transition: 'box-shadow 0.08s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.08s cubic-bezier(0.4, 0, 0.2, 1), transform 0.08s cubic-bezier(0.4, 0, 0.2, 1)',
        animation: `card-entry 0.12s ${Math.min(index * 0.02, 0.3)}s both`
      }}
      onClick={onClick}
    >
      {/* Portrait image area — 2:3 aspect */}
      <div className="relative overflow-hidden w-full" style={{ aspectRatio: '2/3' }}>
        {/* Genre-based ambient glow */}
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            background: `radial-gradient(ellipse at 50% 30%, hsla(${genreHue}, 70%, 50%, 0.15) 0%, transparent 70%)`,
            opacity: isHovered ? 1 : 0.4,
            transition: 'opacity 0.3s ease',
          }}
        />
        {/* Portrait image or genre-colored placeholder */}
        {showPlaceholder ? (
          <div
            className="w-full h-full flex flex-col items-center justify-center"
            style={{
              background: generatePlaceholderGradient(genreHue, 'card')
            }}
          >
            <div className="absolute inset-0" style={{
              background: generatePlaceholderGradient(genreHue, 'icon')
            }} />
            <span style={{
              color: `hsl(${genreHue}, 70%, 70%)`,
              fontSize: '2rem',
              fontWeight: 'bold',
              textShadow: `0 2px 12px hsla(${genreHue}, 70%, 50%, 0.5)`
            }}>
              {gameInitial}
            </span>
          </div>
        ) : (
          <>
            {/* LQIP blur placeholder — fades out when full image loads */}
            {lqip && (
              <img
                src={lqip}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 w-full h-full pointer-events-none select-none"
                style={{
                  objectFit: 'cover',
                  filter: 'blur(20px) scale(1.1)',
                  opacity: imageLoaded ? 0 : 1,
                  transition: 'opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                  transformOrigin: 'center center',
                }}
              />
            )}
            <img
              src={imgSrc ?? undefined}
              alt={game.name || ''}
              loading={index < 8 ? 'eager' : 'lazy'}
              onLoad={handleImageLoad}
              onError={handleImageError}
              className="w-full h-full object-cover transition-transform duration-500 ease-out"
              style={{
                transform: isHovered ? 'scale(1.06)' : 'scale(1)',
                opacity: imageLoaded ? 1 : lqip ? 0 : 1,
                transition: 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.5s ease-out',
              }}
            />
          </>
        )}
        {/* Installed badge — matches GameCard pattern */}
        {isInstalled && (
          <div
            className="absolute top-2.5 left-2.5 z-25 px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1.5 pointer-events-none select-none"
            style={{
              background: 'rgba(34,197,94,0.18)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              color: COLORS.green,
              border: '1px solid rgba(34,197,94,0.25)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
            }}
          >
            <Check size={10} />
            <span>Installed</span>
          </div>
        )}

        {/* Glass hover overlay */}
        <div
          className="absolute inset-0 z-10 pointer-events-none"
          style={{
            WebkitBackdropFilter: isHovered ? 'blur(3px) saturate(1.1)' : 'blur(0px)',
            transition: '-webkit-backdrop-filter 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1), background 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            opacity: isHovered ? 1 : 0,
            background: isHovered
              ? `linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.2) 30%, hsla(${genreHue}, 60%, 15%, 0.45) 55%, rgba(0,0,0,0.88) 100%)`
              : `linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.4) 40%, rgba(0,0,0,0.85) 100%)`,
          }}
        />
        {/* Shine sweep */}
        <div
          className="absolute inset-0 z-10 pointer-events-none overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        >
          <div
            className="absolute w-full h-full left-[-100%] group-hover:animate-shine-sweep"
            style={{
              background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.06) 45%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.06) 55%, transparent 70%)',
              transform: 'skewX(-15deg)',
            }}
          />
        </div>
        {/* Hover-revealed content — name, tags, size */}
        <div
          className="absolute inset-x-0 bottom-0 z-20 px-3 pb-4 pt-12 opacity-0 translate-y-3 group-hover:opacity-100 group-hover:translate-y-0"
          style={{
            transition: 'opacity 0.18s cubic-bezier(0.4,0,0.2,1), transform 0.18s cubic-bezier(0.4,0,0.2,1)'
          }}
        >
          {showName && (
            <>
              <div className="absolute inset-x-0 bottom-0 h-16 pointer-events-none" style={{
                background: `linear-gradient(0deg, hsla(${genreHue}, 40%, 5%, 0.85) 0%, transparent 100%)`,
              }} />
              <p
                className="relative text-sm font-bold leading-tight mb-1.5 drop-shadow-lg"
                style={{ color: `hsl(${genreHue}, 55%, 80%)` }}
              >
                {game.name}
              </p>
            </>
          )}
          {/* Platform/format tags */}
          <div className="relative flex items-center gap-1.5 flex-wrap">
            {game.platforms && game.platforms.length > 0 && game.platforms.map(p => (
              <span key={p} className="text-[9px] font-medium px-1.5 py-0.5 rounded leading-none backdrop-blur-sm"
                style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', border: `1px solid ${COLORS.whiteGlassBorder}` }}
              >
                {p === 'windows' ? 'Win' : p === 'mac' ? 'Mac' : p === 'linux' ? 'Linux' : p}
              </span>
            ))}
            {(game.type || '').toLowerCase() === 'dlc' && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded leading-none backdrop-blur-sm"
                style={{ background: `${COLORS.green}33`, color: COLORS.green, border: `1px solid ${COLORS.green}40` }}
              >
                DLC
              </span>
            )}
            {game.size ? (
              <span className="flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded leading-none backdrop-blur-sm"
                style={{ background: COLORS.whiteGlass, color: 'rgba(255,255,255,0.5)', border: `1px solid ${COLORS.whiteGlass}` }}
              >
                <HardDrive size={9} />
                {formatBytes(game.size)}
              </span>
            ) : null}
          </div>
        </div>

        {/* Action buttons — hover-only, premium minimal */}
        {onDelete && (
          <button
            aria-label={`Remove ${game.name} from library`}
            title="Remove from library"
            className="absolute top-2.5 right-2.5 z-20 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer opacity-0 scale-[0.8] group-hover:opacity-100 group-hover:scale-100 hover:scale-110 active:scale-[0.85]"
            style={{
              background: 'rgba(0,0,0,0.55)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              boxShadow: `0 4px 20px rgba(0,0,0,0.3)`,
              transition: 'opacity 0.08s cubic-bezier(0.4,0,0.2,1), transform 0.08s cubic-bezier(0.4,0,0.2,1)',
            }}
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
          >
            <Trash2 size={14} className="text-white" />
          </button>
        )}
        <button
          aria-label={isFavorite ? `Remove ${game.name} from favourites` : `Add ${game.name} to favourites`}
          aria-pressed={isFavorite}
          title={isFavorite ? 'Remove from favourites' : 'Add to favourites'}
          className="absolute top-[44px] right-2.5 z-20 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer opacity-0 scale-[0.8] group-hover:opacity-100 group-hover:scale-100 hover:scale-110 active:scale-[0.85]"
          style={{
            background: isFavorite ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            boxShadow: isFavorite ? `0 4px 20px hsla(${genreHue}, 60%, 50%, 0.3), 0 0 40px hsla(${genreHue}, 60%, 50%, 0.1)` : '0 2px 8px rgba(0,0,0,0.3)',
            transition: 'opacity 0.08s cubic-bezier(0.4,0,0.2,1), transform 0.08s cubic-bezier(0.4,0,0.2,1)',
          }}
          onClick={(e) => { e.stopPropagation(); onFavorite(); }}
        >
          <Heart size={14} className={isFavorite ? 'text-white fill-white' : 'text-white'} />
        </button>
        {/* Animated gradient border glow */}
        <div
          className="absolute inset-0 rounded-xl pointer-events-none z-30 opacity-0 group-hover:opacity-100 group-hover:animate-border-pulse"
          style={{
            boxShadow: isHovered 
              ? `inset 0 0 0 1.5px rgba(${hoverRgb}, 0.4), 0 0 30px rgba(${hoverRgb}, 0.12)`
              : 'inset 0 0 0 0px transparent',
            transition: 'box-shadow 0.08s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </div>
    </div>
  )
}, (prev, next) => {
  return prev.game.appid === next.game.appid
    && prev.index === next.index
    && prev.isFavorite === next.isFavorite
    && prev.colors === next.colors
    && prev.onDelete === next.onDelete
    && prev.onFavorite === next.onFavorite
    && prev.onClick === next.onClick
});
