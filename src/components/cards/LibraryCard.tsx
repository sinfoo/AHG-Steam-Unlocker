import { useEffect, useState, memo, useMemo, useCallback } from 'react'
import { Trash2, HardDrive } from 'lucide-react'
import { loadGameImage, getLqipData } from '../../services/imageCache'
import { generatePlaceholderGradient } from '../../services/placeholderGenerator'
import { COLORS } from '../../constants/colors'
import { getGenreHue, getGenreTag, formatBytes } from '../../utils/gameHelpers'
import type { Game } from '../../types'
import type { ColorScheme } from '../../types/colors'
import { useT } from '../../i18n'
import { useGenreLabel } from '../../utils/genreLabel'

// ── Singleton CSS keyframe injection (avoids duplicates across card instances) ──
let _lcAnimInjected = false
function injectLcAnimations() {
  if (_lcAnimInjected) return
  _lcAnimInjected = true
  const s = document.createElement('style')
  s.textContent = `/* LibraryCard CSS animations (replacing framer-motion) */
@keyframes lc-fade-slide-x {
  from { opacity: 0; transform: translateX(-15px); }
  to { opacity: 1; transform: translateX(0); }
}
@keyframes lc-shine-sweep {
  0% { left: -100%; }
  100% { left: 200%; }
}
@keyframes lc-glow-pulse {
  0%, 100% {
    opacity: 0.4;
    box-shadow: inset 0 0 0 1px hsla(var(--gh-hue), 65%, 55%, 0.3), 0 0 20px hsla(var(--gh-hue), 60%, 50%, 0.08);
  }
  25% {
    opacity: 1;
    box-shadow: inset 0 0 0 1.5px hsla(var(--gh-hue), 75%, 65%, 0.5), 0 0 40px hsla(var(--gh-hue), 60%, 50%, 0.18), 0 0 80px hsla(var(--gh-hue), 60%, 40%, 0.08);
  }
  50% {
    opacity: 0.6;
    box-shadow: inset 0 0 0 1px hsla(var(--gh-hue), 65%, 55%, 0.35), 0 0 25px hsla(var(--gh-hue), 60%, 50%, 0.1);
  }
  75% {
    opacity: 1;
    box-shadow: inset 0 0 0 1.5px hsla(var(--gh-hue), 70%, 60%, 0.45), 0 0 35px hsla(var(--gh-hue), 60%, 50%, 0.15), 0 0 70px hsla(var(--gh-hue), 60%, 40%, 0.06);
  }
}`
  document.head.appendChild(s)
}

// ── LibraryCard (portrait 2:3 orientation, genre-themed, for Library/My Games grid) ──
export const LibraryCard = memo(function LibraryCard({
  game, index, onDelete, onContextMenu, colors
}: {
  game: Game; index: number; onDelete: (appid: string) => void; onContextMenu?: (e: React.MouseEvent, game: Game) => void; colors: ColorScheme
}) {
  const t = useT()
  const gl = useGenreLabel()
  const [isHovered, setIsHovered] = useState(false)
  const [btnHovered, setBtnHovered] = useState(false)
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [lqip, setLqip] = useState<string | null>(null)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [coverError, setCoverError] = useState(true)
  const [mounted, setMounted] = useState(false)
  const genreHue = useMemo(() => getGenreHue(game), [game])
  const showName = game.name && game.name.trim() && !/^App\s+\d+$/i.test(game.name.trim())
  const gameInitial = useMemo(() => game.name?.[0]?.toUpperCase() || '?', [game.name])
  const gradHues = useMemo(() => {
    const appidStr = String(game.appid)
    const seed = appidStr.charCodeAt(0) + (appidStr.charCodeAt(appidStr.length - 1) || 0)
    const h1 = (seed * 37 + genreHue) % 360
    const h2 = (h1 + 40) % 360
    return { h1, h2 }
  }, [game.appid, genreHue])

  // Inject singleton styles once
  useEffect(() => { injectLcAnimations() }, [])

  // Mounted flag: handoff from CSS entry animation → inline hover transitions
  useEffect(() => {
    const delay = Math.min(index * 20, 300) + 120
    const timer = setTimeout(() => setMounted(true), delay)
    return () => clearTimeout(timer)
  }, [index])

  // Load portrait via imageCache (multi-CDN + IndexedDB, 108+ URL fallback)
  useEffect(() => {
    let mounted = true
    setCoverError(true)
    setCoverUrl(null)
    setLqip(null)
    setImageLoaded(false)
    loadGameImage(game.appid, undefined, game.name, ['portrait.jpg', 'library_600x900.jpg', 'header.jpg']).then(url => {
      if (mounted) {
        if (url) {
          setCoverUrl(url)
          setCoverError(false)
          const lqipUrl = getLqipData(game.appid, ['portrait.jpg', 'library_600x900.jpg', 'header.jpg'])
          if (lqipUrl) setLqip(lqipUrl)
        }
      }
    })
    return () => { mounted = false }
  }, [game.appid, game.name])

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true)
  }, [])

  const handleImageError = useCallback(() => {
    setCoverError(true)
    setCoverUrl(null)
  }, [])

  const genreTag = (() => { const g = getGenreTag(game); return g ? gl(g) : g })()

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu?.(e, game); }}
      className="v2-card"
      style={{
        zIndex: isHovered ? 20 : 1,
        animation: mounted ? 'none' : `v2-riseIn .4s var(--ease-out) ${Math.min(index * 0.03, 0.4)}s both`,
      }}
    >
      {/* Portrait image area — 2:3 aspect */}
      <div className="v2-card-cover">
        {coverError ? (
          <div className="w-full h-full flex flex-col items-center justify-center" style={{ background: generatePlaceholderGradient(genreHue, 'card') }}>
            <div className="absolute inset-0" style={{ background: generatePlaceholderGradient(genreHue, 'icon') }} />
            <span style={{ color: `hsl(${genreHue}, 45%, 78%)`, fontSize: '2rem', fontWeight: 600, opacity: 0.8, position: 'relative' }}>
              {gameInitial}
            </span>
          </div>
        ) : coverUrl ? (
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
              src={coverUrl}
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
        ) : (
          /* Loading spinner while imageCache resolves */
          <div className="w-full h-full flex flex-col items-center justify-center" style={{ background: generatePlaceholderGradient(genreHue, 'card') }}>
            <div
              className="w-7 h-7 rounded-full"
              style={{ border: '2px solid transparent', borderTopColor: 'var(--acc)', animation: 'gc-spin 0.8s linear infinite' }}
            />
          </div>
        )}

        {/* Static readability gradient */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(180deg,rgba(0,0,0,.35) 0%,transparent 22%,transparent 70%,rgba(0,0,0,.4) 100%)' }} />

        {/* Installed marker (everything in the library is installed) */}
        <div className="absolute top-2 start-2 z-10 pointer-events-none">
          <span className="flex items-center gap-[5px] text-[10.5px] font-semibold px-[7px] py-[3px] rounded-[7px]"
            style={{ color: '#d7ffe4', background: 'rgba(8,20,12,.75)', border: '1px solid rgba(34,197,94,.35)' }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: COLORS.green, boxShadow: `0 0 8px ${COLORS.green}` }} />{t('app.card.installed')}
          </span>
        </div>

        {/* Hover overlay — chips */}
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

        {/* Delete button — hover-revealed */}
        <button
          aria-label={t('app.card.removeNamed', { name: game.name ?? '' })}
          title={t('app.card.removeFromLib')}
          className="v2-card-fav z-20"
          style={{ opacity: isHovered ? 1 : 0, transition: 'opacity .3s ease, background .15s, transform .15s' }}
          onClick={(e) => { e.stopPropagation(); onDelete(game.appid); }}
        >
          <Trash2 size={14} />
        </button>
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
    && prev.colors === next.colors
    && prev.onDelete === next.onDelete
    && prev.onContextMenu === next.onContextMenu
})

// ── LibraryListCard (list view variant, genre-themed) ──
export const LibraryListCard = memo(function LibraryListCard({
  game, index, onDelete, onContextMenu, colors, compactMode
}: {
  game: Game; index: number; onDelete: (appid: string) => void; onContextMenu?: (e: React.MouseEvent, game: Game) => void; colors: ColorScheme; compactMode?: boolean
}) {
  const t = useT()
  const gl = useGenreLabel()
  const [isHovered, setIsHovered] = useState(false)
  const [btnHovered, setBtnHovered] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [coverError, setCoverError] = useState(true)
  const genreTag = (() => { const g = getGenreTag(game); return g ? gl(g) : g })()
  const genreHue = useMemo(() => getGenreHue(game), [game])

  // Inject singleton styles once
  useEffect(() => { injectLcAnimations() }, [])

  // Mounted flag: handoff from CSS entry animation → inline hover transitions
  useEffect(() => {
    const delay = Math.min(index * 20, 300) + 120
    const timer = setTimeout(() => setMounted(true), delay)
    return () => clearTimeout(timer)
  }, [index])

  // Load image via imageCache (WebP-converted, multi-CDN, IndexedDB-backed)
  useEffect(() => {
    let mounted = true
    setCoverError(true)
    setCoverUrl(null)
    loadGameImage(game.appid, undefined, game.name).then(url => {
      if (mounted) {
        if (url) {
          setCoverUrl(url)
          setCoverError(false)
        }
      }
    })
    return () => { mounted = false }
  }, [game.appid, game.name])

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu?.(e, game); }}
      className={`flex items-center ${compactMode ? 'gap-3 p-2' : 'gap-4 p-3'} rounded-xl cursor-pointer`}
      style={{
        /* Entry animation handoff */
        animation: mounted ? 'none' : 'lc-fade-slide-x 0.12s both',
        animationDelay: Math.min(index * 20, 300) + 'ms',
        /* Hover slide (only active after entry animation completes) */
        transform: mounted ? (isHovered ? 'translateX(4px)' : 'translateX(0)') : undefined,
        transition: mounted
          ? 'all 0.08s cubic-bezier(0.4, 0, 0.2, 1)'
          : undefined,
        /* Always-active styles */
        background: isHovered ? 'rgba(255,255,255,0.04)' : 'var(--s1, #0f0f1b)',
        border: `1px solid ${isHovered ? 'color-mix(in oklch, var(--acc) 50%, transparent)' : 'rgba(255,255,255,0.07)'}`,
        boxShadow: isHovered ? '0 20px 36px -22px color-mix(in oklch, var(--acc) 60%, transparent)' : 'none',
      }}
    >
      {/* Thumbnail with genre-accented styling */}
      <div className={`${compactMode ? 'w-[72px] h-[42px]' : 'w-24 h-14'} rounded-lg overflow-hidden shrink-0 relative`}
        style={{
          border: isHovered ? `1px solid hsla(${genreHue}, 50%, 45%, 0.3)` : '1px solid transparent',
          boxShadow: isHovered ? `0 0 20px hsla(${genreHue}, 50%, 40%, 0.12)` : 'none',
          transition: 'all 0.08s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {coverError ? (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{
              background: generatePlaceholderGradient(genreHue, 'card'),
              transform: isHovered ? 'scale(1.15)' : 'scale(1)',
              transition: 'transform 0.08s cubic-bezier(0.4,0,0.2,1)',
            }}
          >
            <span style={{
              color: `hsl(${genreHue}, 70%, 70%)`,
              fontSize: '0.9rem',
              fontWeight: 'bold',
              textShadow: `0 1px 6px hsla(${genreHue}, 70%, 50%, 0.5)`
            }}>
              {game.name?.[0]?.toUpperCase() || '?'}
            </span>
          </div>
        ) : coverUrl ? (
          <div
            className="w-full h-full"
            style={{ transform: isHovered ? 'scale(1.15)' : 'scale(1)', transition: 'transform 0.08s cubic-bezier(0.4,0,0.2,1)' }}
          >
            <img
              src={coverUrl}
              alt={game.name || ''}
              className="w-full h-full object-cover"
              onError={() => setCoverError(true)}
            />
          </div>
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{
              background: generatePlaceholderGradient(genreHue, 'card'),
              transform: isHovered ? 'scale(1.15)' : 'scale(1)',
              transition: 'transform 0.08s cubic-bezier(0.4,0,0.2,1)',
            }}
          >
            <div
              className="w-4 h-4 rounded-full"
              style={{ border: '2px solid transparent', borderTopColor: `hsl(${genreHue}, 70%, 70%)`, animation: 'gc-spin 0.8s linear infinite' }}
            />
          </div>
        )}
        {/* Genre-tinted hover overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `linear-gradient(135deg, hsla(${genreHue}, 60%, 40%, 0.2) 0%, transparent 60%)`,
            opacity: isHovered ? 1 : 0,
            transition: 'opacity 0.08s ease',
          }}
        />
      </div>
      {/* Info — appid + genre tag inline */}
      <div className="flex-1 min-w-0">
        <p
          style={{
            color: colors.text,
          }}
          className="font-semibold truncate text-sm"
        >
          {game.name}
        </p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-[10px] font-mono" style={{ color: colors.textDim }}>#{game.appid}</span>
          {genreTag && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded leading-none" style={{
              background: `hsla(${genreHue}, 50%, 35%, 0.15)`,
              color: `hsl(${genreHue}, 50%, 65%)`,
              border: `1px solid hsla(${genreHue}, 50%, 45%, 0.25)`,
            }}>
              {genreTag}
            </span>
          )}
          {game.size ? (
            <span className="text-[10px]" style={{ color: colors.textDim }}>{formatBytes(game.size)}</span>
          ) : null}
        </div>
      </div>
      {/* Premium delete button — appears on hover, minimal */}
      <button
        onMouseEnter={() => setBtnHovered(true)}
        onMouseLeave={() => setBtnHovered(false)}
        onMouseDown={(e) => {
          e.currentTarget.style.transform = isHovered ? 'scale(0.85)' : 'scale(0.8)';
          e.currentTarget.style.filter = 'brightness(0.85)';
        }}
        onMouseUp={(e) => {
          e.currentTarget.style.transform = isHovered
            ? (btnHovered ? 'scale(1.1)' : 'scale(1)')
            : 'scale(0.8)';
          e.currentTarget.style.filter = '';
        }}
        onClick={(e) => { e.stopPropagation(); onDelete(game.appid); }}
        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
        style={{
          background: btnHovered ? `${colors.red}cc` : 'rgba(0,0,0,0.5)',
          WebkitBackdropFilter: 'blur(4px)',
          opacity: isHovered ? 1 : 0,
          transform: isHovered
            ? (btnHovered ? 'scale(1.1)' : 'scale(1)')
            : 'scale(0.8)',
          transition: 'all 0.08s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <Trash2 size={14} className="text-white" />
      </button>
    </div>
  )
}, (prev, next) => {
  return prev.game.appid === next.game.appid
    && prev.index === next.index
    && prev.colors === next.colors
    && prev.onDelete === next.onDelete
    && prev.onContextMenu === next.onContextMenu
    && prev.compactMode === next.compactMode
})
