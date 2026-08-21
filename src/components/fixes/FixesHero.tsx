import { useEffect, useRef, useCallback, useState, type RefObject } from 'react'
import { motion, type MotionValue } from 'framer-motion'
import { Wrench, Layout, List } from 'lucide-react'
import { Game } from '../../types'
import type { ColorScheme } from '../shared'
import '../../styles/fixes-animations.css'

const FIXES_HERO_HUE = 260

interface FixesHeroProps {
  heroRef: RefObject<HTMLDivElement | null>
  isHeroVisible: boolean
  heroBgY: MotionValue<number>
  heroContentY: MotionValue<number>
  colors: ColorScheme
  heroGame: Game | null
  heroImgUrl: string | null
  viewMode: 'grid' | 'list'
  setViewMode: React.Dispatch<React.SetStateAction<'grid' | 'list'>>
  fixesCount: number
  filteredFixesCount: number
  fixSourceFilter: string
}

export default function FixesHero({
  heroRef, isHeroVisible, heroBgY, heroContentY, colors,
  heroGame, heroImgUrl, viewMode, setViewMode,
  fixesCount, filteredFixesCount, fixSourceFilter,
}: FixesHeroProps) {
  // Parallax mouse tracking (direct DOM, no React re-render)
  const onHeroMouseMove = useCallback((e: React.MouseEvent) => {
    const el = heroRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5
    el.style.transform = `perspective(1000px) rotateX(${y * -4}deg) rotateY(${x * 4}deg)`
  }, [heroRef])

  const handleHeroMouseLeave = useCallback(() => {
    if (heroRef.current) heroRef.current.style.transform = ''
  }, [heroRef])

  return (
    <div
      ref={heroRef}
      onMouseMove={onHeroMouseMove}
      onMouseLeave={handleHeroMouseLeave}
      className="relative mb-8 overflow-hidden rounded-3xl min-h-[300px] lg:min-h-[340px] shrink-0"
      style={{
        perspective: 1000,
        transition: 'transform 0.08s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: `0 0 120px hsla(${FIXES_HERO_HUE}, 60%, 50%, 0.15), 0 0 0 1px rgba(255,255,255,0.04)`,
      }}
    >
      {/* Hero Full-bleed Background Image — Parallax */}
      {heroGame && (
        <motion.div className="absolute inset-0 overflow-hidden" style={{ y: isHeroVisible ? heroBgY : 0 }}>
          <div className="w-full h-full animate-fixes-zoom">
            <img
              src={heroImgUrl ?? undefined}
              alt=""
              className="w-full h-full object-cover"
              decoding="async"
              fetchPriority="low"
            />
          </div>
          <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, hsla(${FIXES_HERO_HUE}, 70%, 40%, 0.3) 0%, ${colors.bgDeep}cc 60%, rgba(3,3,8,0.9) 100%)` }} />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(0deg, rgba(3,3,8,0.5) 0%, transparent 50%)' }} />
        </motion.div>
      )}

      {/* Background Canvas — Genre-Reactive */}
      <div className="absolute inset-0" style={{ background: `linear-gradient(160deg, hsla(${FIXES_HERO_HUE}, 60%, 45%, 0.2) 0%, ${colors.bgDeep} 40%, hsla(${(FIXES_HERO_HUE + 60) % 360}, 50%, 35%, 0.1) 100%)` }}>
        {/* Rotating ambient orbs */}
        <div className="absolute -top-40 -right-20 w-[600px] h-[600px] rounded-full blur-[150px] animate-fixes-orb-1"
          style={{ background: `hsla(${FIXES_HERO_HUE}, 60%, 50%, 0.08)` }}
        />
        <div className="absolute -bottom-40 -left-20 w-[500px] h-[500px] rounded-full blur-[130px] animate-fixes-orb-2"
          style={{ background: `hsla(${(FIXES_HERO_HUE + 60) % 360}, 50%, 45%, 0.07)` }}
        />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full blur-[120px] animate-fixes-orb-3"
          style={{ background: `hsla(${FIXES_HERO_HUE}, 50%, 50%, 0.05)` }}
        />
        {/* Floating particles — orbital / spiral */}
        {Array.from({ length: 6 }).map((_, i) => {
          const size = 1.5 + (i % 3) * 1.5
          const colorIdx = i % 3
          const bg = colorIdx === 0
            ? `hsla(${FIXES_HERO_HUE}, 70%, 60%, 0.8)`
            : colorIdx === 1
              ? `hsla(${(FIXES_HERO_HUE + 60) % 360}, 60%, 55%, 0.8)`
              : colors.violet
          const opacity = 0.15 + (i % 3) * 0.12
          if (i < 3) {
            return (
              <div
                key={`fix-particle-${i}`}
                className={`absolute rounded-full pointer-events-none ${i === 0 ? 'animate-fixes-particle-o-0' : i === 1 ? 'animate-fixes-particle-o-1' : 'animate-fixes-particle-o-2'}`}
                style={{ width: size, height: size, background: bg, left: '50%', top: '50%', opacity }}
              />
            )
          } else {
            return (
              <div
                key={`fix-particle-${i}`}
                className={`absolute rounded-full pointer-events-none ${i === 3 ? 'animate-fixes-particle-s-3' : i === 4 ? 'animate-fixes-particle-s-4' : 'animate-fixes-particle-s-5'}`}
                style={{ width: size, height: size, background: bg, left: `${((i - 3) * 10 + 20) % 100}%`, top: `${(((i - 3) * 13 + 5) % 100)}%`, opacity }}
              />
            )
          }
        })}
        {/* Floating orbit ring */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border animate-fixes-orbit-ring"
          style={{
            width: 220, height: 220,
            borderColor: `hsla(${FIXES_HERO_HUE}, 50%, 50%, 0.06)`,
          }}
        >
          <div
            className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full animate-fixes-glow-dot-1"
            style={{ background: `hsla(${FIXES_HERO_HUE}, 60%, 55%, 0.5)`, boxShadow: `0 0 10px hsla(${FIXES_HERO_HUE}, 60%, 55%, 0.3)` }}
          />
          <div
            className="absolute left-1/2 -bottom-1 -translate-x-1/2 w-1.5 h-1.5 rounded-full animate-fixes-glow-dot-2"
            style={{ background: `hsla(${(FIXES_HERO_HUE + 120) % 360}, 55%, 50%, 0.4)`, boxShadow: `0 0 8px hsla(${(FIXES_HERO_HUE + 120) % 360}, 55%, 50%, 0.2)` }}
          />
        </div>

        {/* Grid dot pattern */}
        <div
          className="absolute inset-0 animate-fixes-grid-pulse"
          style={{
            backgroundImage: `radial-gradient(circle, hsla(${FIXES_HERO_HUE}, 50%, 50%, 0.3) 0.5px, transparent 0.5px)`,
            backgroundSize: '24px 24px',
            maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 100%)',
            WebkitMaskImage: 'linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 100%)',
          }}
        />
      </div>

      {/* Animated border glow */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 1, borderRadius: 'inherit' }}>
        <div className="absolute inset-0 rounded-3xl animate-fixes-border-glow" />
      </div>

      {/* Bottom vignette */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(180deg, transparent 0%, rgba(3,3,8,0.6) 100%)' }} />

      {/* Light sweep animation */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 2 }}>
        <div
          className="absolute inset-0 animate-fixes-light-sweep"
          style={{ background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.04) 50%, transparent 70%)' }}
        />
      </div>

      {/* Content — Parallax */}
      <motion.div
        className="relative z-10 px-7 py-6 lg:px-9 lg:py-7 flex flex-col gap-3 h-full"
        style={{ y: isHeroVisible ? heroContentY : 0 }}
      >
        {/* Top Row: Badge + Counter | View Toggle */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 animate-fixes-badge-in">
            <span
              className="text-[10px] font-semibold tracking-[0.18em] uppercase px-3 py-1 rounded-full flex items-center gap-1.5"
              style={{
                background: `hsla(${FIXES_HERO_HUE}, 60%, 50%, 0.15)`,
                color: `hsla(${FIXES_HERO_HUE}, 70%, 60%, 1)`,
                border: `1px solid hsla(${FIXES_HERO_HUE}, 60%, 50%, 0.3)`,
              }}
            >
              <Wrench size={10} />
              Fixes
            </span>
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0 animate-fixes-live-dot"
              style={{ background: `hsla(${FIXES_HERO_HUE}, 70%, 55%, 1)`, boxShadow: `0 0 8px hsla(${FIXES_HERO_HUE}, 70%, 55%, 0.6)` }}
            />
            <span className="text-[11px] font-medium" style={{ color: colors.textMuted }}>
              {fixesCount.toLocaleString()} fixes
            </span>
          </div>

          {/* View Toggle */}
          <div className="animate-fixes-toggle-in">
            <button
              onClick={() => setViewMode(v => v === 'grid' ? 'list' : 'grid')}
              className="hv-tap h-9 px-4 rounded-xl flex items-center gap-2 text-xs font-semibold"
              style={{ background: `${colors.bgCard}cc`, border: `1px solid ${colors.border}`, backdropFilter: 'blur(8px)' }}
            >
              {viewMode === 'grid' ? <Layout size={14} style={{ color: `hsla(${FIXES_HERO_HUE}, 70%, 55%, 1)` }} /> : <List size={14} style={{ color: colors.textSecondary }} />}
              <span style={{ color: viewMode === 'grid' ? `hsla(${FIXES_HERO_HUE}, 70%, 55%, 1)` : colors.textSecondary }}>
                {viewMode === 'grid' ? 'Grid' : 'List'}
              </span>
            </button>
          </div>
        </div>

        {/* Title Block */}
        <div className="flex flex-col justify-center flex-1">
          <h1
            className="text-3xl lg:text-4xl xl:text-5xl font-bold tracking-tight leading-tight animate-fixes-title-in"
            style={{
              background: `linear-gradient(135deg, ${colors.text} 20%, var(--accent) 55%, hsla(${(FIXES_HERO_HUE + 40) % 360}, 60%, 50%, 1) 100%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Steam Fixes
          </h1>
          <p className="text-xs mt-1 leading-relaxed animate-fixes-subtitle-in" style={{ color: colors.textDim }}>
            {fixSourceFilter === 'ryuu' ? (
              <><span className="font-semibold" style={{ color: colors.green }}>{filteredFixesCount}</span> Steam fixes — auto-installable via AHG</>
            ) : fixSourceFilter === 'online' ? (
              <><span className="font-semibold" style={{ color: colors.blue }}>{filteredFixesCount}</span> online fixes — may require manual steps</>
            ) : (
              <><span className="font-semibold" style={{ color: colors.blue }}>{filteredFixesCount}</span> of {fixesCount} fixes available</>
            )}
          </p>
        </div>
      </motion.div>
    </div>
  )
}
