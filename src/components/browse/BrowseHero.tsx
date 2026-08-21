import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { motion, AnimatePresence, type MotionValue } from 'framer-motion'
import { Gamepad2, Sparkles, LayoutGrid } from 'lucide-react'
import { Game } from '../../types'
import { getGenreTag, type ColorScheme } from '../shared'
import CarouselSlide from './CarouselSlide'

const HERO_GREEN_HUE = 140

interface BrowseHeroProps {
  heroRef: RefObject<HTMLDivElement | null>
  isHeroVisible: boolean
  heroParallaxY: MotionValue<number>
  onHeroMouseMove: (e: React.MouseEvent) => void
  handleRandomGame: () => void
  handleGameClick: (g: Game) => void
  colors: ColorScheme
  carouselGames: Game[]
  carouselIdx: number
  setCarouselIdx: React.Dispatch<React.SetStateAction<number>>
  gamesWithCover: Game[]
}

export default function BrowseHero({
  heroRef, isHeroVisible, heroParallaxY, onHeroMouseMove,
  handleRandomGame, handleGameClick, colors,
  carouselGames, carouselIdx, setCarouselIdx, gamesWithCover,
}: BrowseHeroProps) {
  const [heroHovered, setHeroHovered] = useState(false)

  // ── Auto-rotate carousel ──
  useEffect(() => {
    if (carouselGames.length <= 1 || heroHovered) return
    const interval = setInterval(() => {
      setCarouselIdx(prev => (prev + 1) % carouselGames.length)
    }, 4500)
    return () => clearInterval(interval)
  }, [carouselGames.length, heroHovered, setCarouselIdx])

  const handleHeroLeave = useCallback(() => {
    setHeroHovered(false)
    if (heroRef.current) heroRef.current.style.transform = ''
  }, [heroRef])

  return (
    <div
      ref={heroRef}
      onMouseMove={onHeroMouseMove}
      onMouseEnter={() => setHeroHovered(true)}
      onMouseLeave={handleHeroLeave}
      className="will-change-transform mb-6 overflow-hidden rounded-3xl h-[300px] lg:h-[340px] shrink-0"
      style={{
        boxShadow: `0 0 120px hsla(${HERO_GREEN_HUE}, 70%, 40%, 0.15), 0 0 0 1px rgba(255,255,255,0.04)`,
        perspective: 1200,
        transition: 'transform 0.08s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* ── Background Canvas (freezes when hero is offscreen — saves GPU) ── */}
      {isHeroVisible ? (
        <motion.div className="absolute inset-0" style={{ y: heroParallaxY, background: `linear-gradient(160deg, hsla(${HERO_GREEN_HUE}, 70%, 10%, 0.98), ${colors.bgDeep} 40%, hsla(${HERO_GREEN_HUE + 40}, 60%, 6%, 0.95) 100%)` }}>
          {/* Rotating ambient orbs */} 
          <div className="absolute -top-40 -right-20 w-[600px] h-[600px] rounded-full blur-[80px] animate-[heroOrbRotate_45s_linear_infinite]" style={{ background: `hsla(${HERO_GREEN_HUE}, 80%, 50%, 0.07)` }} />
          <div className="absolute -bottom-40 -left-20 w-[500px] h-[500px] rounded-full blur-[70px] animate-[heroOrbRotate_55s_linear_infinite]" style={{ animationDirection: 'reverse', background: `hsla(${HERO_GREEN_HUE + 60}, 70%, 45%, 0.06)` }} />
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full blur-[60px] animate-[heroOrbRotate_40s_linear_infinite]" style={{ background: `hsla(${HERO_GREEN_HUE + 30}, 80%, 50%, 0.04)` }} />
          {/* Floating particles */}
          {Array.from({ length: 16 }).map((_, i) => (
            <div
              key={`browse-particle-${i}`}
              className="absolute rounded-full pointer-events-none animate-[heroParticleFloat_8s_ease-in-out_infinite]"
              style={{
                width: 1.5 + (i % 3) * 1, height: 1.5 + (i % 3) * 1,
                background: `hsla(${HERO_GREEN_HUE + i * 10}, 70%, ${60 + (i % 3) * 18}%, 0.3)`,
                left: `${(i * 6.25) % 100}%`, top: `${((i * 13 + 7) % 100)}%`,
                animationDuration: `${6 + (i % 4) * 2}s`, animationDelay: `${(i % 8) * 0.3}s`,
              }}
            />
          ))}
          {/* Grid dot pattern */}
          <div
            className="absolute inset-0 animate-[gridDotPulse_5s_ease-in-out_infinite]"
            style={{
              backgroundImage: `radial-gradient(circle, hsla(${HERO_GREEN_HUE}, 70%, 70%, 0.3) 0.5px, transparent 0.5px)`,
              backgroundSize: '24px 24px',
              maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 100%)',
              WebkitMaskImage: 'linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 100%)',
            }}
          />
          {/* Pulsing glow ring */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] rounded-full pointer-events-none animate-[glowRingPulse_4s_ease-in-out_infinite,glowRingRotate_30s_linear_infinite]"
            style={{ border: '1px solid hsla(145, 70%, 50%, 0.12)', boxShadow: '0 0 60px hsla(145, 70%, 50%, 0.06), inset 0 0 60px hsla(145, 70%, 50%, 0.03)' }}
          />
        </motion.div>
      ) : (
        <div className="absolute inset-0" style={{ background: `linear-gradient(160deg, hsla(${HERO_GREEN_HUE}, 70%, 10%, 0.98), ${colors.bgDeep} 40%, hsla(${HERO_GREEN_HUE + 40}, 60%, 6%, 0.95) 100%)` }} />
      )}

      {/* Bottom vignette */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(180deg, transparent 0%, rgba(3,3,8,0.6) 100%)' }} />

      {/* Light sweep animation */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 2 }}>
        <div
          className="absolute inset-0 animate-[lightSweep_8s_ease-in-out_2s_infinite]"
          style={{ background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.04) 50%, transparent 70%)' }}
        />
      </div>

      {/* ── Content ── */}
      <div className="relative z-10 px-7 py-6 lg:px-9 lg:py-7 flex flex-col gap-4 h-full">
        {/* Top Row: Badge + Counter | CTA Buttons */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 animate-[fadeSlideIn_0.2s_ease-out_0.05s_both]">
            <span
              className="text-[10px] font-semibold tracking-[0.18em] uppercase px-3 py-1 rounded-full flex items-center gap-1.5"
              style={{
                background: `hsla(${HERO_GREEN_HUE}, 70%, 50%, 0.15)`,
                color: `hsla(${HERO_GREEN_HUE}, 70%, 65%, 1)`,
                border: `1px solid hsla(${HERO_GREEN_HUE}, 70%, 50%, 0.25)`,
              }}
            >
              <Gamepad2 size={10} />
              Browse
            </span>
            <span className="w-1.5 h-1.5 rounded-full shrink-0 animate-[pulseDot_2s_ease-in-out_infinite]" style={{ background: colors.green, boxShadow: '0 0 12px hsla(145, 70%, 50%, 0.5)' }} />
            <span className="text-[11px] font-medium" style={{ color: colors.textMuted }}>
              {gamesWithCover.length.toLocaleString()} titles
            </span>
          </div>

          {/* CTA Buttons */}
          <div className="hidden sm:flex items-center gap-2 animate-[fadeSlideInRight_0.25s_ease-out_0.15s_both]">
            <button
              onClick={handleRandomGame}
              className="relative px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer flex items-center gap-1.5 overflow-hidden group hv-e"
              style={{
                background: `linear-gradient(135deg, hsla(${HERO_GREEN_HUE}, 70%, 40%, 0.25), hsla(${HERO_GREEN_HUE + 30}, 60%, 30%, 0.15))`,
                color: `hsla(${HERO_GREEN_HUE}, 70%, 75%, 1)`,
                border: `1px solid hsla(${HERO_GREEN_HUE}, 70%, 50%, 0.3)`,
                '--hv-s': 1.04,
                '--tap-s': 0.96,
                '--tap-f': 'none',
                transition: 'transform 0.15s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
              } as React.CSSProperties}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 4px 30px hsla(${HERO_GREEN_HUE}, 70%, 40%, 0.5), 0 0 60px hsla(${HERO_GREEN_HUE}, 70%, 50%, 0.15)`; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = ''; }}
            >
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: `linear-gradient(135deg, hsla(${HERO_GREEN_HUE}, 70%, 50%, 0.2), transparent)` }}
              />
              <Sparkles size={12} className="relative z-10" />
              <span className="relative z-10">Random Game</span>
            </button>
            <button
              className="relative px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer flex items-center gap-1.5 overflow-hidden group hv-e"
              style={{
                background: `hsla(${HERO_GREEN_HUE}, 70%, 50%, 0.06)`,
                color: `hsl(${HERO_GREEN_HUE}, 70%, 78%)`,
                border: `1px solid hsla(${HERO_GREEN_HUE}, 70%, 50%, 0.2)`,
                '--hv-s': 1.04,
                '--tap-s': 0.96,
                '--tap-f': 'brightness(0.85)',
                transition: 'transform 0.15s cubic-bezier(0.4, 0, 0.2, 1), filter 0.08s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
              } as React.CSSProperties}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 4px 20px hsla(${HERO_GREEN_HUE}, 70%, 40%, 0.3)`; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = ''; }}
            >
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: `hsla(${HERO_GREEN_HUE}, 70%, 50%, 0.08)` }}
              />
              <LayoutGrid size={12} className="relative z-10" />
              <span className="relative z-10">Browse All</span>
            </button>
          </div>
        </div>

        {/* Middle Section: Title + Game Showcase Carousel */}
        <div className="flex items-stretch gap-6 flex-1 min-h-0">
          {/* Left: Title Block */}
          <div className="flex flex-col justify-center min-w-0 shrink-0">
            <h1
              className="text-3xl lg:text-4xl xl:text-5xl font-bold tracking-tight leading-tight animate-[fadeSlideUp_0.25s_ease-out_0.1s_both]"
              style={{
                color: `hsl(${HERO_GREEN_HUE}, 70%, 72%)`,
                textShadow: `0 0 40px hsla(${HERO_GREEN_HUE}, 70%, 50%, 0.3)`,
              }}
            >
              Game Catalogue
            </h1>
            <p
              className="text-xs mt-1 leading-relaxed animate-[fadeIn_0.2s_ease-out_0.15s_both]"
              style={{ color: colors.textDim }}
            >
              Discover, browse, and launch your collection
            </p>
          </div>

          {/* Right: Game Showcase Carousel */}
          <div
            className="flex-1 min-w-0 relative rounded-2xl overflow-hidden"
            style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.05)' }}
          >
            {carouselGames.length > 0 ? (
              <AnimatePresence>
                <CarouselSlide
                  key={carouselGames[carouselIdx % carouselGames.length]?.appid ?? 'fallback'}
                  game={carouselGames[carouselIdx % carouselGames.length]}
                  bannerHue={HERO_GREEN_HUE}
                  colors={colors}
                  getGenreTag={getGenreTag}
                  handleGameClick={handleGameClick}
                  carouselGames={carouselGames}
                  carouselIdx={carouselIdx}
                  setCarouselIdx={setCarouselIdx}
                />
              </AnimatePresence>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-xs" style={{ color: colors.textDim }}>Loading games...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
