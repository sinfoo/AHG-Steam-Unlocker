import { memo, useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Game } from '../../types'
import { loadGameImage } from '../../services/imageCache'
import type { ColorScheme } from '../shared'

interface CarouselSlideProps {
  game: Game | undefined
  bannerHue: number
  colors: ColorScheme
  getGenreTag: (g: Game) => string | null
  handleGameClick: (g: Game) => void
  carouselGames: Game[]
  carouselIdx: number
  setCarouselIdx: (i: number) => void
}

const IMG_MIN_SIZE = 800 // skip hero backgrounds smaller than this (header.jpg is ~460×215)
const HERO_TRANSITION = { duration: 0.25, ease: 'easeInOut' }

const CarouselSlide = memo(function CarouselSlide({
  game, bannerHue, colors, getGenreTag, handleGameClick,
  carouselGames, carouselIdx, setCarouselIdx,
}: CarouselSlideProps) {
  const [imgLoaded, setImgLoaded] = useState(false)
  const [heroImgUrl, setHeroImgUrl] = useState<string | null>(null)
  const [isSmallImage, setIsSmallImage] = useState(false)
  const gameAppid = game?.appid
  const loadKeyRef = useRef(0)

  useEffect(() => {
    if (!game) return
    const key = ++loadKeyRef.current
    setIsSmallImage(false)
    setImgLoaded(false)
    loadGameImage(game.appid, game.header_image || undefined, game.name || undefined, ['library_hero.jpg', 'hero.jpg', 'library_600x900.jpg', 'portrait.jpg', 'header.jpg']).then(url => {
      if (key !== loadKeyRef.current) return
      setHeroImgUrl(url)
    }).catch(() => {})
    return () => { loadKeyRef.current++ } // invalidate any in-flight image load on unmount/re-run
  }, [game?.appid, game?.header_image, game?.name])

  const handleImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setImgLoaded(true)
    const img = e.currentTarget
    if (img.naturalWidth < IMG_MIN_SIZE) {
      setIsSmallImage(true)
    }
  }

  if (!game) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <p className="text-xs" style={{ color: colors.textDim }}>Discover games</p>
      </div>
    )
  }
  return (
    <motion.div
      key={game.appid}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={HERO_TRANSITION}
      className="absolute inset-0 flex flex-col sm:flex-row items-stretch overflow-hidden rounded-2xl"
    >
      {/* ── Hero Background Image (full bleed) with slow cinematic zoom ── */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="w-full h-full animate-[carouselZoom_12s_ease-in-out_infinite]">
          {!isSmallImage && (
            <img
              src={heroImgUrl ?? undefined}
              alt=""
              className={`w-full h-full object-cover transition-all duration-700 ${imgLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105'}`}
              decoding="async"
              fetchPriority="low"
              onLoad={handleImgLoad}
            />
          )}
        </div>
        {/* Dark gradient overlays for readability */}
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, hsla(${bannerHue}, 70%, 8%, 0.92) 0%, hsla(${bannerHue}, 60%, 12%, 0.7) 40%, rgba(3,3,8,0.4) 100%)` }} />
        {/* Deep bottom vignette for cinematic feel */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(0deg, rgba(3,3,8,0.6) 0%, rgba(3,3,8,0.1) 40%, transparent 55%)' }} />
      </div>

      {/* ── Content overlay ── */}
      <div className="relative z-10 flex flex-col sm:flex-row items-center gap-4 sm:gap-6 p-5 sm:p-7 w-full h-full">
        {/* ── Large game cover art ── */}
        <div
          className="w-[140px] sm:w-[180px] aspect-video rounded-xl overflow-hidden shrink-0 group relative shadow-2xl hv-l"
          style={{
            boxShadow: `0 12px 40px rgba(0,0,0,0.7), 0 0 60px hsla(${bannerHue}, 70%, 30%, 0.2)`,
            '--hv-s': 1.05,
            '--hv-y': '-4px',
          } as React.CSSProperties}
        >
          <img
            src={heroImgUrl ?? undefined}
            alt={game.name || ''}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            loading="lazy"
            decoding="async"
            fetchPriority="low"
          />
          {/* Shine overlay */}
          <div
            className="absolute inset-0 pointer-events-none animate-[shineShift_5s_ease-in-out_infinite]"
            style={{
              mixBlendMode: 'overlay',
              background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.15) 0%, transparent 60%)',
              backgroundSize: '200% 200%',
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="absolute inset-0 ring-1 ring-white/10 rounded-xl pointer-events-none" />
        </div>

        {/* ── Game info panel ── */}
        <div className="flex flex-col gap-2 min-w-0 flex-1 sm:py-2">
          <span
            className="text-[10px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-md w-fit"
            style={{
              background: `hsla(${bannerHue}, 70%, 45%, 0.25)`,
              color: `hsla(${bannerHue}, 70%, 70%, 1)`,
              border: `1px solid hsla(${bannerHue}, 70%, 45%, 0.3)`,
              boxShadow: `0 0 20px hsla(${bannerHue}, 70%, 40%, 0.15)`,
            }}
          >
            {getGenreTag(game) || 'Featured'}
          </span>
          <h3 className="text-lg sm:text-xl font-bold leading-tight line-clamp-2" style={{ color: colors.white, textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
            {game.name}
          </h3>
          <p className="text-xs sm:text-sm leading-relaxed line-clamp-2" style={{ color: 'rgba(255,255,255,0.65)' }}>
            {game.name} &mdash; Click to view details and install options
          </p>
          <div className="flex items-center gap-2.5 mt-auto pt-2">
            <button
              onClick={() => handleGameClick(game)}
              className="text-xs font-bold px-4 py-2 rounded-xl cursor-pointer hv-e"
              style={{
                background: `linear-gradient(135deg, hsla(${bannerHue}, 70%, 40%, 0.4), hsla(${bannerHue + 30}, 60%, 35%, 0.25))`,
                color: colors.white,
                border: `1px solid hsla(${bannerHue}, 70%, 50%, 0.35)`,
                textShadow: '0 1px 4px rgba(0,0,0,0.3)',
                '--hv-s': 1.05,
                '--tap-s': 0.95,
                '--tap-f': 'brightness(0.85)',
                transition: 'transform 0.15s cubic-bezier(0.4, 0, 0.2, 1), filter 0.08s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
              } as React.CSSProperties}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 4px 20px hsla(${bannerHue}, 70%, 40%, 0.4)`; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = ''; }}
            >
              Add to Steam
            </button>
            <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {carouselIdx + 1} / {carouselGames.length}
            </span>
          </div>
        </div>
      </div>

      {/* ── Carousel navigation dots ── */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5">
        {carouselGames.slice(0, Math.min(6, carouselGames.length)).map((_, i) => (
          <button
            key={i}
            onClick={() => setCarouselIdx(i)}
            className="rounded-full transition-all duration-200 cursor-pointer"
            style={{
              width: i === carouselIdx % carouselGames.length ? '24px' : '6px',
              height: '6px',
              background: i === carouselIdx % carouselGames.length
                ? `hsla(${bannerHue}, 70%, 65%, 0.9)`
                : 'rgba(255,255,255,0.2)',
              boxShadow: i === carouselIdx % carouselGames.length
                ? `0 0 12px hsla(${bannerHue}, 70%, 50%, 0.5)`
                : 'none',
            }}
          />
        ))}
      </div>
    </motion.div>
  )
})

export default CarouselSlide
