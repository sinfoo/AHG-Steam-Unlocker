import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Game } from '../types'
import { loadGameImage } from '../services/imageCache'
import { getHeroUrl } from '../services/steamGridDb'

import { AnimatePresence, motion } from 'framer-motion'
import { Star, Shield, CheckCircle2, Play, LayoutGrid, Sparkles, ChevronLeft, ChevronRight, Gamepad2 } from 'lucide-react'

interface HeroSectionProps {
  featuredGame: Game | null
  accentColor: string
  COLORS: Record<string, string>
  onGameClick: (game: Game) => void
  navigateTo: (page: string) => void
  playSound: (type: 'error' | 'success' | 'click' | 'hover') => void
  games: Game[]
  setFeaturedGame: (game: any) => void
  quickAccessOffset: number
  setQuickAccessOffset: (v: number) => void
  totalAAA: number
  quickGameImgs: Record<string, string | null>
  isLoaded: boolean
}

export default function HeroSection({
  featuredGame, accentColor, COLORS, onGameClick, navigateTo, playSound,
  games, setFeaturedGame, quickAccessOffset, setQuickAccessOffset,
  totalAAA, quickGameImgs, isLoaded,
}: HeroSectionProps) {
  // ── Mouse spotlight position ──
  const [spotlight, setSpotlight] = useState({ x: 50, y: 50 })

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setSpotlight({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    })
  }, [])

  // ── Auto-rotation ──
  const [isRotating, setIsRotating] = useState(true)
  const rotateTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const featuredPool = useMemo(
    () => games.filter(g => g.header_image).slice(0, 30),
    [games],
  )

  const currentRotateIndex = featuredGame
    ? featuredPool.findIndex(g => g.appid === featuredGame.appid)
    : -1

  const goToNext = useCallback(() => {
    if (featuredPool.length <= 1) return
    const nextIdx = (currentRotateIndex + 1 + featuredPool.length) % featuredPool.length
    setFeaturedGame(featuredPool[nextIdx] as any)
    // No sound on auto-rotation — only on manual yellow shuffle button
  }, [featuredPool, currentRotateIndex, setFeaturedGame])

  const goToIndex = useCallback((idx: number) => {
    if (idx < 0 || idx >= featuredPool.length) return
    setIsRotating(false)
    setFeaturedGame(featuredPool[idx] as any)
    // No sound on dot navigation — only on manual yellow shuffle button
    setTimeout(() => setIsRotating(true), 8000)
  }, [featuredPool, setFeaturedGame])

  useEffect(() => {
    if (!isRotating || featuredPool.length <= 1) {
      if (rotateTimerRef.current) clearInterval(rotateTimerRef.current)
      return
    }
    rotateTimerRef.current = setInterval(goToNext, 6500)
    return () => { if (rotateTimerRef.current) clearInterval(rotateTimerRef.current) }
  }, [isRotating, featuredPool.length, goToNext])

  const pauseRotation = useCallback(() => setIsRotating(false), [])
  const resumeRotation = useCallback(() => setIsRotating(true), [])

  // ── Content crossfade state ──
  const [prevContentGame, setPrevContentGame] = useState<Game | null>(null)
  const prevGameRef = useRef<Game | null>(null)

  // When featuredGame changes, stash the OLD game (before ref is updated)
  useEffect(() => {
    if (prevGameRef.current && featuredGame &&
        prevGameRef.current.appid !== featuredGame.appid) {
      setPrevContentGame(prevGameRef.current)
    }
    prevGameRef.current = featuredGame
  }, [featuredGame])

  // Clear prev content after fade animation completes
  useEffect(() => {
    if (!prevContentGame) return
    const timer = setTimeout(() => setPrevContentGame(null), 350)
    return () => clearTimeout(timer)
  }, [prevContentGame])

  // ── Image loading (with SGDB hero fallback) ──
  const [featuredImgUrl, setFeaturedImgUrl] = useState<string | null>(null)
  const [prevBgUrl, setPrevBgUrl] = useState<string | null>(null)
  const [prevBgFading, setPrevBgFading] = useState(false)
  const prevAppIdRef = useRef<string | null>(null)

  // When prevBgUrl appears, render at opacity 1, then trigger CSS transition to 0
  useEffect(() => {
    if (prevBgUrl) {
      setPrevBgFading(false)
      const timer = setTimeout(() => setPrevBgFading(true), 50)
      return () => clearTimeout(timer)
    }
  }, [prevBgUrl])

  // Track the live bg url in a ref so the loader can crossfade against it without
  // re-subscribing the effect on every image change.
  const featuredImgUrlRef = useRef<string | null>(null)
  useEffect(() => { featuredImgUrlRef.current = featuredImgUrl }, [featuredImgUrl])

  useEffect(() => {
    let mounted = true
    let clearTimer: ReturnType<typeof setTimeout> | undefined
    if (!featuredGame?.appid || featuredGame.appid === prevAppIdRef.current) return
    prevAppIdRef.current = featuredGame.appid

    // Resolve the highest-quality hero art available (wide library_hero → SGDB hero →
    // header), then PRELOAD the bitmap before swapping layers. The old image stays on
    // screen until the new one is decoded, so the rotation is a true gap-free crossfade
    // (previously the bg was nulled mid-load, flashing the gradient between slides).
    const resolve = async (): Promise<string | null> => {
      const cdn = await loadGameImage(
        featuredGame.appid, featuredGame.header_image || undefined, featuredGame.name || undefined,
        ['library_hero.jpg', 'library_600x900.jpg', 'header.jpg'],
      ).catch(() => null)
      if (cdn) return cdn
      const sgdb = await getHeroUrl(featuredGame.appid).catch(() => null)
      if (sgdb) return sgdb
      return featuredGame.header_image || null
    }

    resolve().then(url => {
      if (!mounted || !url) return
      const swap = () => {
        if (!mounted) return
        const old = featuredImgUrlRef.current
        if (old && old !== url) {
          setPrevBgUrl(old) // the prevBgUrl effect cross-fades it out
          clearTimer = setTimeout(() => { if (mounted) setPrevBgUrl(null) }, 750)
        }
        setFeaturedImgUrl(url) // new layer fades in via .active
      }
      const img = new Image()
      img.onload = swap
      img.onerror = swap
      img.src = url
    })

    return () => { mounted = false; if (clearTimer) clearTimeout(clearTimer) }
  }, [featuredGame?.appid, featuredGame?.header_image, featuredGame?.name])

  // ── Quick access image error tracking ──
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set())
  const markFailed = useCallback((appid: string) => {
    setFailedImages(prev => new Set(prev).add(appid))
  }, [])

  // ── Skeleton ──
  if (!isLoaded) {
    return (
      <div className="relative w-full h-[70vh] min-h-[520px] rounded-2xl overflow-hidden bg-mid">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 to-transparent" />
        <div className="absolute inset-0 premium-shimmer" />
        <div className="absolute bottom-0 left-0 p-8 lg:p-12 space-y-4 w-full max-w-xl">
          <div className="h-7 w-28 rounded-full bg-card shimmer-pulse" />
          <div className="h-14 w-full rounded-xl bg-card shimmer-pulse" />
          <div className="h-5 w-3/4 rounded-lg bg-card shimmer-pulse" />
          <div className="flex gap-4 pt-2">
            <div className="h-14 w-36 rounded-2xl bg-card shimmer-pulse" />
            <div className="h-14 w-36 rounded-2xl bg-card shimmer-pulse" />
          </div>
        </div>
      </div>
    )
  }

  // ── Empty state ──
  if (!featuredGame) {
    return (
      <div className="relative w-full h-[60vh] min-h-[400px] rounded-2xl overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${COLORS.bgDeep} 0%, ${COLORS.bgMid} 100%)` }}
      >
        {/* Animated gradient orb for depth */}
        <div
          className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{
            background: `radial-gradient(circle, ${COLORS.violet}20 0%, transparent 70%)`,
            filter: 'blur(80px)',
            animation: 'premiumOrbFloat1 8s ease-in-out infinite',
          }}
        />
        <div
          className="absolute -bottom-40 left-[20%] w-[400px] h-[400px] rounded-full pointer-events-none"
          style={{
            background: `radial-gradient(circle, ${COLORS.blue}15 0%, transparent 70%)`,
            filter: 'blur(80px)',
            animation: 'premiumOrbFloat2 10s ease-in-out infinite',
          }}
        />
        <div className="hero-grid-bg" />
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="text-center hero-entrance-container">
            <div className="flex justify-center mb-6">
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${COLORS.violet}30 0%, ${COLORS.violet}10 100%)`,
                  border: `1px solid ${COLORS.violet}25`,
                }}
              >
                <Gamepad2 size={40} style={{ color: COLORS.violet }} />
              </div>
            </div>
            <h2 className="text-5xl lg:text-6xl font-bold mb-4 premium-title-gradient">
              Welcome to AHG
            </h2>
            <p className="text-lg max-w-md mx-auto" style={{ color: COLORS.textSecondary }}>
              Your ultimate Steam game unlocker with 176K+ games at your fingertips
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── Quick access games ──
  const displayedGames = totalAAA > 0
    ? [...Array(4)].map((_, i) => {
        const idx = (quickAccessOffset + i) % totalAAA
        return { game: games.filter(g => g.header_image)[idx]!, index: idx }
      }).filter(x => x.game)
    : []

  const accentVal = COLORS[accentColor as keyof typeof COLORS] || COLORS.violet
  const canRotate = featuredPool.length > 1

  return (
    <div
      className="premium-hero-wrapper relative w-full h-[56vh] min-h-[420px] rounded-2xl overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseEnter={pauseRotation}
      onMouseLeave={() => {
        setSpotlight({ x: 50, y: 50 })
        resumeRotation()
      }}
    >
      {/* ── Animated gradient border glow ── */}
      <div className="premium-border-glow" />

      {/* ── CSS-only crossfading background (two-layer: prev fades out, current fades in) ── */}
      <div className="hero-bg-wrapper">
        {/* Previous background — rendered at opacity 1, then fades out */}
        {prevBgUrl && (
          <div
            className={`hero-bg-image ${prevBgFading ? 'exit' : 'active'}`}
            style={{ backgroundImage: `url(${prevBgUrl})`, backgroundSize: 'cover', backgroundPosition: 'center 30%' }}
          >
            <div className="absolute inset-0 premium-hero-overlay" />
            <div className="absolute inset-0 premium-hero-vignette" />
          </div>
        )}
        {/* Current background — fading in */}
        <div
          className={`hero-bg-image ${featuredImgUrl ? 'active' : ''}`}
          style={
            featuredImgUrl
              ? { backgroundImage: `url(${featuredImgUrl})`, backgroundSize: 'cover', backgroundPosition: 'center 30%' }
              : { background: `linear-gradient(135deg, ${accentVal}40 0%, ${COLORS.bgDeep} 100%)` }
          }
        >
          {featuredImgUrl && (
            <>
              <div className="absolute inset-0 premium-hero-overlay" />
              <div className="absolute inset-0 premium-hero-vignette" />
            </>
          )}
        </div>
      </div>

      {/* ── Floating gradient orbs ── */}
      <div
        className="premium-orb premium-orb-1"
        style={{ background: `radial-gradient(circle, ${accentVal}28 0%, transparent 70%)` }}
      />
      <div
        className="premium-orb premium-orb-2"
        style={{ background: `radial-gradient(circle, ${COLORS.blue}20 0%, transparent 70%)` }}
      />

      {/* ── Grid overlay ── */}
      <div className="hero-grid-bg" />

      {/* ── Floating particle dots ── */}
      <div className="hero-dots-grid" />

      {/* ── Primary mouse-tracked spotlight (accent) ── */}
      <div
        className="absolute inset-0 transition-[background] duration-80 pointer-events-none z-10"
        style={{
          background: `radial-gradient(700px circle at ${spotlight.x}% ${spotlight.y}%, ${accentVal}12 0%, transparent 70%)`,
        }}
      />

      {/* ── Secondary spotlight layer (blue tone, for depth) ── */}
      <div
        className="absolute inset-0 transition-[background] duration-80 pointer-events-none z-10"
        style={{
          background: `radial-gradient(500px circle at ${100 - spotlight.x}% ${100 - spotlight.y}%, ${COLORS.blue}06 0%, transparent 60%)`,
        }}
      />

      {/* ── Content backdrop panel - seamless gradient integration ── */}
      <div className="absolute left-0 top-0 bottom-0 w-[68%] max-w-3xl z-20">
        {/* Primary gradient: deep→transparent with slightly angled feel */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              linear-gradient(100deg,
                ${COLORS.bgDeep}B3 0%,
                ${COLORS.bgDeep}A0 15%,
                ${COLORS.bgDeep}80 30%,
                ${COLORS.bgDeep}50 45%,
                ${COLORS.bgDeep}30 55%,
                transparent 72%
              ),
              radial-gradient(ellipse 120% 80% at 0% 50%, ${accentVal}0A 0%, transparent 60%),
              radial-gradient(ellipse 100% 60% at 20% 80%, ${COLORS.violet}08 0%, transparent 50%)
            `,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            maskImage: 'linear-gradient(to right, black 60%, transparent 80%)',
            WebkitMaskImage: 'linear-gradient(to right, black 60%, transparent 80%)',
          }}
        />
        {/* Gradient edge line - subtle accent glow */}
        <div className="absolute right-0 top-0 bottom-0 w-[2px]" style={{
          background: `linear-gradient(180deg, transparent 0%, ${accentVal}30 20%, ${accentVal}50 50%, ${accentVal}30 80%, transparent 100%)`,
          opacity: 0.6,
        }} />
      </div>

      {/* ── Content ── */}
      <div className="relative z-30 h-full flex">
        {/* ─── Left: Featured Game Info (crossfade) ─── */}
        <div className="flex-1 flex flex-col justify-end p-8 lg:p-12 relative">
          {/* Previous content — fades out */}
          {prevContentGame && prevContentGame.appid !== featuredGame.appid && (
            <motion.div
              key={prevContentGame.appid + '-prev'}
              className="absolute inset-0 p-8 lg:p-12 flex flex-col justify-end"
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              {/* Badge row */}
              <div className="flex items-center gap-3 mb-4">
                <span
                  className="premium-featured-badge px-4 py-1.5 rounded-full text-sm font-bold flex items-center gap-2"
                  style={{
                    background: `linear-gradient(135deg, ${accentVal} 0%, ${accentVal}cc 100%)`,
                    color: COLORS.text,
                    boxShadow: `0 4px 24px ${accentVal}50`,
                  }}
                >
                  <Star size={14} className="fill-white" />
                  Featured
                </span>
                {prevContentGame.drm && (
                  <span className="px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5"
                    style={{ background: `${COLORS.amber}25`, color: COLORS.amber, border: `1px solid ${COLORS.amber}30` }}
                  >
                    <Shield size={12} />
                    DRM
                  </span>
                )}
                <span className="px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5"
                  style={{ background: `${COLORS.green}20`, color: COLORS.green, border: `1px solid ${COLORS.green}25` }}
                >
                  <CheckCircle2 size={12} />
                  Free
                </span>
                {prevContentGame.genres && prevContentGame.genres[0] && (
                  <span className="px-3 py-1.5 rounded-full text-xs font-medium hidden sm:inline-flex items-center gap-1.5"
                    style={{ background: `${COLORS.violet}15`, color: COLORS.textMuted, border: `1px solid ${COLORS.violet}20` }}
                  >
                    {prevContentGame.genres[0]}
                  </span>
                )}
              </div>
              <h2 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold mb-3 max-w-3xl leading-tight premium-title-gradient line-clamp-2 break-words">
                {prevContentGame.name}
              </h2>
              <p className="text-base max-w-xl mb-5 line-clamp-2 leading-relaxed premium-hero-description"
                style={{ color: COLORS.textSecondary }}>
                {prevContentGame.short_description || 'Your ultimate Steam game unlocker with 170,000+ games.'}
              </p>
              {prevContentGame.genres && prevContentGame.genres.length > 0 && (
                <div className="flex items-center gap-2 mb-6 flex-wrap">
                  {prevContentGame.genres.slice(0, 3).map((genre: string) => (
                    <span key={genre}
                      className="px-3 py-1 rounded-full text-xs font-medium transition-all duration-80"
                      style={{
                        background: `${accentVal}15`, color: COLORS.textMuted,
                        border: `1px solid ${accentVal}20`,
                      }}>
                      {genre}
                    </span>
                  ))}
                  {prevContentGame.tags && prevContentGame.tags.length > 0 && (
                    <span className="text-xs" style={{ color: COLORS.textDim }}>
                      +{prevContentGame.tags.length} tags
                    </span>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* Current content — fades in */}
          <motion.div
            key={featuredGame.appid + '-content'}
            className="flex flex-col justify-end"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
          >
          {/* Badge row */}
          <div className="flex items-center gap-3 mb-4">
            <span
              className="premium-featured-badge px-4 py-1.5 rounded-full text-sm font-bold flex items-center gap-2"
              style={{
                background: `linear-gradient(135deg, ${accentVal} 0%, ${accentVal}cc 100%)`,
                color: COLORS.text,
                boxShadow: `0 4px 24px ${accentVal}50`,
              }}
            >
              <Star size={14} className="fill-white" />
              Featured
            </span>
            {featuredGame.drm && (
              <span className="px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5"
                style={{ background: `${COLORS.amber}25`, color: COLORS.amber, border: `1px solid ${COLORS.amber}30` }}
              >
                <Shield size={12} />
                DRM
              </span>
            )}
            <span className="px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5"
              style={{ background: `${COLORS.green}20`, color: COLORS.green, border: `1px solid ${COLORS.green}25` }}
            >
              <CheckCircle2 size={12} />
              Free
            </span>
            {featuredGame.genres && featuredGame.genres[0] && (
              <span className="px-3 py-1.5 rounded-full text-xs font-medium hidden sm:inline-flex items-center gap-1.5"
                style={{ background: `${COLORS.violet}15`, color: COLORS.textMuted, border: `1px solid ${COLORS.violet}20` }}
              >
                {featuredGame.genres[0]}
              </span>
            )}
          </div>

          {/* Title — gradient text */}
          <h2
            className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold mb-3 max-w-3xl leading-tight premium-title-gradient line-clamp-2 break-words"
          >
            {featuredGame.name}
          </h2>

          {/* Description — premium paragraph */}
          <p
            className="text-base max-w-xl mb-5 line-clamp-2 leading-relaxed premium-hero-description"
            style={{ color: COLORS.textSecondary }}
          >
            {featuredGame.short_description || 'Your ultimate Steam game unlocker with 170,000+ games.'}
          </p>

          {/* Metadata chips */}
          {featuredGame.genres && featuredGame.genres.length > 0 && (
            <div className="flex items-center gap-2 mb-6 flex-wrap">
              {featuredGame.genres.slice(0, 3).map((genre: string) => (
                <span
                  key={genre}
                  className="px-3 py-1 rounded-full text-xs font-medium transition-all duration-80"
                  style={{
                    background: `${accentVal}15`,
                    color: COLORS.textMuted,
                    border: `1px solid ${accentVal}20`,
                    transition: 'background 0.08s cubic-bezier(0.4,0,0.2,1), border-color 0.08s cubic-bezier(0.4,0,0.2,1)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = `${accentVal}25`
                    e.currentTarget.style.borderColor = `${accentVal}40`
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = `${accentVal}15`
                    e.currentTarget.style.borderColor = `${accentVal}20`
                  }}
                >
                  {genre}
                </span>
              ))}
              {featuredGame.tags && featuredGame.tags.length > 0 && (
                <span className="text-xs" style={{ color: COLORS.textDim }}>
                  +{featuredGame.tags.length} tags
                </span>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => onGameClick(featuredGame)}
              className="premium-cta-primary px-10 py-4 rounded-2xl font-bold flex items-center gap-3 text-lg relative overflow-hidden hv-tap"
              style={{
                background: `linear-gradient(135deg, ${accentVal} 0%, ${accentVal}cc 100%)`,
                color: COLORS.text,
                boxShadow: `0 4px 32px ${accentVal}50`,
              }}
            >
              <div className="premium-cta-glow" style={{ background: accentVal }} />
              <Play size={20} className="relative z-10" />
              <span className="relative z-10">Play Now</span>
            </button>

            <button
              onClick={() => navigateTo('browse')}
              className="premium-cta-secondary px-8 py-4 rounded-2xl font-bold flex items-center gap-2.5 text-lg relative overflow-hidden hv-tap"
              style={{
                background: `${COLORS.bgCard}cc`,
                backdropFilter: 'blur(12px)',
                border: `1px solid ${COLORS.violet}30`,
                color: COLORS.text,
              }}
            >
              <LayoutGrid size={20} className="relative z-10" />
              <span className="relative z-10">Browse All</span>
            </button>

            <div className="w-14 h-14 shrink-0">
              <button
                onClick={() => {
                  const r = games[Math.floor(Math.random() * games.length)]
                  setFeaturedGame(r as any)
                  playSound('success')
                }}
                className="premium-cta-shuffle w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, #fbbf24 0%, ${COLORS.amber} 100%)`,
                  boxShadow: '0 4px 20px rgba(251, 191, 36, 0.4)',
                }}
              >
                <Sparkles size={20} className="text-white" />
              </button>
            </div>
          </div>

          {/* ── Rotation dots ── */}
          {canRotate && (
            <div className="flex items-center gap-2 mt-6">
              {featuredPool.slice(0, 8).map((g, i) => (
                <button
                  key={g.appid}
                  onClick={() => goToIndex(i)}
                  className="premium-dot group relative"
                  aria-label={`Show ${g.name}`}
                >
                  <div
                    className={`rounded-full transition-all duration-300 ${
                      i === currentRotateIndex
                        ? 'w-6 h-2'
                        : 'w-2 h-2 hover:w-3 hover:h-2'
                    }`}
                    style={{
                      background: i === currentRotateIndex
                        ? accentVal
                        : `${COLORS.textMuted}40`,
                    }}
                  />
                </button>
              ))}
            </div>
          )}
        </motion.div>
        </div>

        {/* ─── Right: Quick Access (CSS-only staggered entrance) ─── */}
        <div
          className="hidden lg:flex flex-col justify-center pr-8 w-[340px] z-30 hero-qa-entrance"
        >
          <div className="premium-qa-glass rounded-2xl p-4"
            style={{
              background: `${COLORS.bgDeep}80`,
              backdropFilter: 'blur(16px)',
              border: `1px solid ${COLORS.border}`,
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold flex items-center gap-2" style={{ color: COLORS.text }}>
                <Sparkles size={14} style={{ color: accentVal }} />
                Quick Access
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    setQuickAccessOffset((quickAccessOffset - 1 + totalAAA) % Math.max(totalAAA, 1))
                  }}
                  className="w-7 h-7 rounded-lg flex items-center justify-center hv-tap"
                  style={{
                    background: COLORS.bgHover,
                    color: COLORS.textMuted,
                    transition: 'color 0.08s cubic-bezier(0.4,0,0.2,1), background 0.08s cubic-bezier(0.4,0,0.2,1)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = `${accentVal}25`
                    e.currentTarget.style.color = accentVal!
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = COLORS.bgHover!
                    e.currentTarget.style.color = COLORS.textMuted!
                  }}
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  onClick={() => {
                    setQuickAccessOffset((quickAccessOffset + 1) % Math.max(totalAAA, 1))
                  }}
                  className="w-7 h-7 rounded-lg flex items-center justify-center hv-tap"
                  style={{
                    background: COLORS.bgHover,
                    color: COLORS.textMuted,
                    transition: 'color 0.08s cubic-bezier(0.4,0,0.2,1), background 0.08s cubic-bezier(0.4,0,0.2,1)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = `${accentVal}25`
                    e.currentTarget.style.color = accentVal!
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = COLORS.bgHover!
                    e.currentTarget.style.color = COLORS.textMuted!
                  }}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5 hero-qa-grid">
              {displayedGames.map(({ game }, i) => (
                <button
                  key={game.appid + '-' + i}
                  onClick={() => onGameClick(game)}
                  className="group relative aspect-[16/9] rounded-xl overflow-hidden hv-tap"
                  style={{
                    border: `1px solid ${COLORS.border}`,
                    transition: 'border-color 0.08s cubic-bezier(0.4,0,0.2,1), box-shadow 0.08s cubic-bezier(0.4,0,0.2,1), transform 0.08s cubic-bezier(0.4,0,0.2,1)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = accentVal!
                    e.currentTarget.style.boxShadow = `0 0 24px ${accentVal}35, 0 4px 12px rgba(0,0,0,0.3)`
                    e.currentTarget.style.transform = 'translateY(-2px)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = COLORS.border!
                    e.currentTarget.style.boxShadow = 'none'
                    e.currentTarget.style.transform = 'translateY(0)'
                  }}
                >
                  {(!failedImages.has(game.appid) && (quickGameImgs[game.appid] || game.header_image)) ? (
                    <>
                      <img
                        src={quickGameImgs[game.appid] || game.header_image}
                        alt={game.name}
                        className="w-full h-full object-cover transition-transform duration-150 group-hover:scale-110"
                        loading="lazy"
                        decoding="async"
                        fetchPriority="high"
                        onError={() => markFailed(game.appid)}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-end p-2">
                        <span className="text-[10px] font-semibold text-white leading-tight line-clamp-2 text-left">
                          {game.name}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center" style={{ background: COLORS.bgCard }}>
                      <span className="text-[10px] text-center px-1 line-clamp-2" style={{ color: COLORS.textMuted }}>
                        {game.name}
                      </span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
