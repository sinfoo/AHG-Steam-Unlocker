import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Game } from '../types'
import { loadGameImage } from '../services/imageCache'
import { getHeroUrl } from '../services/steamGridDb'

import { Plus, Check, Heart, Shuffle, Gamepad2 } from 'lucide-react'
import { useT, useLangStore } from '../i18n'

interface HeroSectionProps {
  featuredGame: Game | null
  accentColor: string
  COLORS: Record<string, string>
  onGameClick: (game: Game) => void
  navigateTo: (page: string) => void
  playSound: (type: 'error' | 'success' | 'click' | 'hover') => void
  games: Game[]
  setFeaturedGame: (game: any) => void
  isLoaded: boolean
  isFavorite: (appid: string) => boolean
  isInstalled: (appid: string) => boolean
  onToggleFavorite: (appid: string) => void
  onInstall: (game: Game) => void
  /** Right column content (new-fix spotlight, stats). */
  sideExtra?: React.ReactNode
}

export default function HeroSection({
  featuredGame, COLORS, onGameClick, navigateTo, playSound,
  games, setFeaturedGame, isLoaded, sideExtra, isFavorite, isInstalled, onToggleFavorite, onInstall,
}: HeroSectionProps) {
  const t = useT()
  const rtl = useLangStore(s => s.lang) === 'ar'
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
          clearTimer = setTimeout(() => { if (mounted) setPrevBgUrl(null) }, 1300)
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

  // ── Skeleton ──
  if (!isLoaded) {
    return (
      <div className="relative w-full overflow-hidden" style={{ height: 'clamp(380px,50vh,485px)', borderRadius: 26, background: '#10101c', border: '1px solid rgba(255,255,255,.08)' }}>
        <div className="absolute inset-0 premium-shimmer" />
      </div>
    )
  }

  // ── Empty state ──
  if (!featuredGame) {
    return (
      <div className="relative w-full overflow-hidden flex items-center justify-center v2-rise"
        style={{ height: 'clamp(320px,44vh,440px)', borderRadius: 26, background: `linear-gradient(135deg, ${COLORS.bgDark} 0%, ${COLORS.bgMid} 100%)`, border: '1px solid rgba(255,255,255,.08)' }}>
        <div className="text-center">
          <div className="flex justify-center mb-5">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'color-mix(in oklch, var(--acc) 16%, transparent)', border: '1px solid color-mix(in oklch, var(--acc) 30%, transparent)' }}>
              <Gamepad2 size={32} style={{ color: 'var(--acc)' }} />
            </div>
          </div>
          <h2 className="m-0 mb-3 font-bold" style={{ fontSize: 'clamp(34px,4.4vw,56px)', letterSpacing: '-.035em', color: COLORS.text }}>{t('app.hero.welcome')}</h2>
          <p className="text-base max-w-md mx-auto m-0" style={{ color: COLORS.textSecondary }}>
            {t('app.hero.tagline')}
          </p>
        </div>
      </div>
    )
  }

  const canRotate = featuredPool.length > 1
  const fg = featuredGame as Game & { developer?: string; release_date?: string }
  const genreLine = fg.genres?.slice(0, 2).join(' · ') || ''
  const metaLine = [fg.developer, fg.release_date?.match(/\d{4}/)?.[0]].filter(Boolean).join(' · ')
  const fav = isFavorite(featuredGame.appid)
  const installed = isInstalled(featuredGame.appid)
  const pills = featuredPool.slice(0, 8)

  return (
    <div className="flex flex-wrap gap-4">
      {/* ═══════ Hero ═══════ */}
      <section
        className="relative overflow-hidden v2-rise"
        style={{
          flex: '3 1 560px', minWidth: 0, height: 'clamp(380px,50vh,485px)', borderRadius: 26,
          border: '1px solid rgba(255,255,255,.08)', boxShadow: '0 50px 90px -50px rgba(0,0,0,1)', background: '#10101c',
        }}
        onMouseEnter={pauseRotation}
        onMouseLeave={resumeRotation}
      >
        {/* Previous art fades out, current art fades in (1.2s) — both Ken Burns */}
        {prevBgUrl && (
          <div className="absolute inset-0" style={{ opacity: prevBgFading ? 0 : 1, transition: 'opacity 1.2s ease' }}>
            <img src={prevBgUrl} alt="" className="w-full h-full object-cover v2-ken" />
          </div>
        )}
        {featuredImgUrl ? (
          <div key={featuredImgUrl} className="absolute inset-0" style={{ animation: 'v2-fadeIn 1.2s ease both' }}>
            <img src={featuredImgUrl} alt="" className="w-full h-full object-cover v2-ken" />
          </div>
        ) : (
          <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, color-mix(in oklch, var(--acc) 25%, transparent) 0%, #0a0a14 100%)' }} />
        )}
        <div className="absolute inset-0 pointer-events-none rtl-flip" style={{ background: 'linear-gradient(90deg, rgba(7,7,14,.82) 0%, rgba(7,7,14,.4) 34%, rgba(7,7,14,0) 62%), linear-gradient(0deg, rgba(7,7,14,.72) 0%, rgba(7,7,14,0) 38%)' }} />

        {/* Info (re-keyed per game so the stagger replays) */}
        <div key={featuredGame.appid + '-content'} className="absolute flex flex-col gap-4"
          style={{ insetInlineStart: 'clamp(24px,4vw,52px)', bottom: 'clamp(24px,4vw,48px)', maxWidth: 'min(580px,60%)' }}>
          <div className="flex items-center gap-2.5" style={{ animation: 'v2-riseIn .35s .02s var(--ease-out) both' }}>
            <span className="mono text-[11px] font-semibold" style={{ letterSpacing: '.14em', color: 'var(--acc)' }}>{t('app.hero.featured')}</span>
            <span className="w-5 h-px" style={{ background: 'rgba(255,255,255,.3)' }} />
            {genreLine && <span className="text-[12.5px] truncate" style={{ color: COLORS.textSecondary }}>{genreLine}</span>}
          </div>
          <h1 className="m-0 font-bold line-clamp-2 break-words" style={{ fontSize: 'clamp(34px,4.4vw,60px)', letterSpacing: '-.035em', lineHeight: .98, textWrap: 'balance', color: COLORS.text, animation: 'v2-riseIn .4s .05s var(--ease-out) both' }}>
            {featuredGame.name}
          </h1>
          {metaLine && <div className="mono text-[12px]" style={{ color: COLORS.textSecondary, animation: 'v2-riseIn .4s .08s var(--ease-out) both' }}>{metaLine}</div>}
          {featuredGame.short_description && (
            <p className="m-0 text-sm line-clamp-2 leading-relaxed max-w-xl" style={{ color: COLORS.textSecondary, animation: 'v2-riseIn .4s .08s var(--ease-out) both' }}>
              {featuredGame.short_description}
            </p>
          )}
          <div className="flex gap-2.5 mt-1.5" style={{ animation: 'v2-riseIn .4s .11s var(--ease-out) both' }}>
            <button onClick={() => (installed ? onGameClick(featuredGame) : onInstall(featuredGame))}
              className="v2-btn-acc h-12 px-6 rounded-[14px] text-[14.5px] font-semibold flex items-center gap-[9px]"
              style={{ boxShadow: '0 16px 40px -14px var(--acc)' }}>
              {installed ? <Check size={17} /> : <Plus size={17} />}{installed ? t('app.hero.inLibrary') : t('app.hero.addToSteam')}
            </button>
            <button onClick={() => onGameClick(featuredGame)}
              className="v2-btn-glass h-12 px-5 rounded-[14px] text-[14.5px] font-semibold flex items-center gap-2">
              {t('app.hero.details')}
            </button>
            <button
              title={t('app.hero.favourite')} aria-label={t('app.hero.toggleFav')} aria-pressed={fav}
              onClick={() => onToggleFavorite(featuredGame.appid)}
              className="v2-btn-glass w-12 h-12 rounded-[14px] flex items-center justify-center"
              style={fav ? { background: 'rgba(239,68,68,.32)', borderColor: 'rgba(239,68,68,.5)' } : undefined}>
              <Heart size={18} className={fav ? 'fill-current' : ''} style={{ color: fav ? '#ef4444' : undefined }} />
            </button>
            <button
              title={t('app.hero.surprise')}
              aria-label={t('app.hero.randomFeatured')}
              onClick={() => {
                const r = games[Math.floor(Math.random() * games.length)]
                setFeaturedGame(r as any)
                playSound('success')
              }}
              className="v2-btn-glass w-12 h-12 rounded-[14px] flex items-center justify-center">
              <Shuffle size={18} />
            </button>
          </div>
        </div>

        {/* Progress pills */}
        {canRotate && (
          <div className="absolute flex items-center gap-1.5 px-2.5 py-2"
            style={{ insetInlineEnd: 'clamp(18px,2.5vw,28px)', top: 'clamp(18px,2.5vw,26px)', animation: 'v2-riseIn .45s .2s var(--ease-out) both' }}>
            {pills.map((g, i) => {
              const active = i === currentRotateIndex
              return (
                <button key={g.appid} onClick={() => goToIndex(i)} title={g.name} aria-label={t('app.hero.show', { name: g.name ?? '' })}
                  className="relative p-0 border-0 overflow-hidden cursor-pointer"
                  style={{ width: active ? 40 : 12, height: 3, borderRadius: 2, background: 'rgba(255,255,255,.28)', transition: 'width .4s var(--ease-out), background .2s' }}>
                  {active && (
                    <span className="absolute inset-0" style={{ background: 'var(--acc)', transformOrigin: rtl ? 'right' : 'left', animation: 'v2-barFill 6.5s linear both', animationPlayState: isRotating ? 'running' : 'paused' }} />
                  )}
                </button>
              )
            })}
          </div>
        )}
      </section>

      {/* ═══════ Right column: new-fix spotlight + stats ═══════ */}
      <div className="flex flex-col gap-4 min-h-0 max-w-full" style={{ flex: '1 1 260px' }}>
        {sideExtra}
      </div>
    </div>
  )
}
