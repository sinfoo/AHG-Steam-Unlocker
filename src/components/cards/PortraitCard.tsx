import { useState, useEffect, useMemo, useCallback, memo } from 'react'
import { Heart, HardDrive, Trash2 } from 'lucide-react'
import { loadGameImage, getLqipData, invalidateCacheKey, IMAGE_TYPES } from '../../services/imageCache'
import { generatePlaceholderGradient } from '../../services/placeholderGenerator'
import { COLORS } from '../../constants/colors'
import { getGenreHue, getGenreTag, formatBytes } from '../../utils/gameHelpers'
import type { Game } from '../../types'
import type { ColorScheme } from '../../types/colors'
import { useT } from '../../i18n'
import { useGenreLabel } from '../../utils/genreLabel'

// ── PortraitCard (portrait orientation, genre-themed, for Recent/Favorites grid) ──
export const PortraitCard = memo(function PortraitCard({ game, index, isFavorite, isInstalled, onClick, onFavorite, onDelete, onContextMenu, colors }: {
  game: Game; index: number; isFavorite: boolean; isInstalled?: boolean; onClick: () => void; onFavorite: () => void; onDelete?: () => void; onContextMenu?: (e: React.MouseEvent, game: Game) => void; colors: ColorScheme
}) {
  const t = useT()
  const gl = useGenreLabel()
  const [isHovered, setIsHovered] = useState(false)
  const [imgSrc, setImgSrc] = useState<string | null>(null)
  const [lqip, setLqip] = useState<string | null>(null)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [showPlaceholder, setShowPlaceholder] = useState(true)
  const genreHue = useMemo(() => getGenreHue(game), [game])
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

  const genreTag = (() => { const g = getGenreTag(game); return g ? gl(g) : g })()

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu?.(e, game); }}
      onClick={onClick}
      className="v2-card"
      style={{ zIndex: isHovered ? 20 : 1, animation: `v2-riseIn .4s var(--ease-out) ${Math.min(index * 0.03, 0.4)}s both` }}
    >
      {/* Portrait image area — 2:3 aspect */}
      <div className="v2-card-cover">
        {/* Portrait image or placeholder */}
        {showPlaceholder ? (
          <div
            className="w-full h-full flex flex-col items-center justify-center"
            style={{ background: generatePlaceholderGradient(genreHue, 'card') }}
          >
            <div className="absolute inset-0" style={{ background: generatePlaceholderGradient(genreHue, 'icon') }} />
            <span style={{ color: `hsl(${genreHue}, 45%, 78%)`, fontSize: '2rem', fontWeight: 600, opacity: 0.8, position: 'relative' }}>
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
              className="w-full h-full object-cover"
              style={{
                opacity: imageLoaded ? 1 : lqip ? 0 : 1,
                transition: 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            />
          </>
        )}

        {/* Static readability gradient */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(180deg,rgba(0,0,0,.35) 0%,transparent 22%,transparent 70%,rgba(0,0,0,.4) 100%)' }} />

        {/* Badges (top-left) + persistent favourite marker (top-right) */}
        <div className="absolute top-2 inset-x-2 z-10 flex items-center gap-1.5 pointer-events-none">
          {isInstalled && (
            <span className="flex items-center gap-[5px] text-[10.5px] font-semibold px-[7px] py-[3px] rounded-[7px]"
              style={{ color: '#d7ffe4', background: 'rgba(8,20,12,.75)', border: '1px solid rgba(34,197,94,.35)' }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: COLORS.green, boxShadow: `0 0 8px ${COLORS.green}` }} />{t('app.card.installed')}
            </span>
          )}
          <span className="flex-1" />
          {isFavorite && !isHovered && (
            <span className="w-[26px] h-[26px] rounded-lg flex items-center justify-center text-white"
              style={{ background: 'rgba(239,68,68,.9)', boxShadow: '0 4px 14px rgba(239,68,68,.5)' }}>
              <Heart size={13} className="fill-white" />
            </span>
          )}
        </div>

        {/* Hover overlay — chips + (optional) remove */}
        <div className="v2-card-ov" style={{ pointerEvents: 'none' }}>
          <div className="flex gap-1.5 flex-wrap">
            {genreTag && <span className="text-[10.5px] px-[7px] py-[3px] rounded-md" style={{ color: '#d9d7ea', background: 'rgba(255,255,255,.1)' }}>{genreTag}</span>}
            {(game.type || '').toLowerCase() === 'dlc' && (
              <span className="text-[10.5px] px-[7px] py-[3px] rounded-md" style={{ background: `${COLORS.green}33`, color: COLORS.green }}>DLC</span>
            )}
            {game.size ? (
              <span className="mono flex items-center gap-1 text-[10.5px] px-[7px] py-[3px] rounded-md" style={{ color: '#d9d7ea', background: 'rgba(255,255,255,.1)' }}>
                <HardDrive size={9} />{formatBytes(game.size)}
              </span>
            ) : null}
          </div>
        </div>

        {/* Action buttons — hover-revealed */}
        <button
          aria-label={isFavorite ? t('app.card.removeFavNamed', { name: game.name ?? '' }) : t('app.card.addFavNamed', { name: game.name ?? '' })}
          aria-pressed={isFavorite}
          title={isFavorite ? t('app.card.removeFav') : t('app.card.addFav')}
          className="v2-card-fav z-20"
          style={{
            background: isFavorite ? 'rgba(239,68,68,.9)' : undefined,
            opacity: isHovered ? 1 : 0,
            transition: 'opacity .3s ease, background .15s, transform .15s',
          }}
          onClick={(e) => { e.stopPropagation(); onFavorite(); }}
        >
          <Heart size={14} className={isFavorite ? 'fill-white' : ''} />
        </button>
        {onDelete && (
          <button
            aria-label={t('app.card.removeNamed', { name: game.name ?? '' })}
            title={t('app.card.removeFromLib')}
            className="v2-card-fav z-20"
            style={{ top: 44, opacity: isHovered ? 1 : 0, transition: 'opacity .3s ease, background .15s, transform .15s' }}
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* Title + meta below the cover */}
      <div className="flex flex-col gap-[3px] px-0.5 min-w-0">
        <div className="text-[13.5px] font-semibold whitespace-nowrap overflow-hidden text-ellipsis" style={{ color: COLORS.text }}>
          {showName ? game.name : t('app.card.appId', { id: game.appid })}
        </div>
        <div className="mono text-[11px] whitespace-nowrap overflow-hidden text-ellipsis" style={{ color: COLORS.textDim }}>
          {[genreTag, game.size ? formatBytes(game.size) : null].filter(Boolean).join(' · ') || ' '}
        </div>
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
