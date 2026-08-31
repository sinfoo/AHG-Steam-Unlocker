import { memo, useMemo, useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { COLORS } from '../constants/colors'

/* ──────────────────────────────────────────────────────────
   TYPES
   ────────────────────────────────────────────────────────── */

interface StatBadge {
  icon: string
  value: string
}

interface AnimatedLoadingScreenProps {
  progress: number
  isLoading: boolean
  statusMessage?: string
  appName?: string
  appSubtitle?: string
  statBadges?: StatBadge[]
  versionString?: string
}
/* ──────────────────────────────────────────────────────────
   INJECTED KEYFRAMES
   ────────────────────────────────────────────────────────── */

const keyframeStyles = `
@keyframes grid-pan {
  0%   { transform: translate3d(0, 0, 0); }
  100% { transform: translate3d(48px, 48px, 0); }
}
@keyframes grid-pan-slow {
  0%   { transform: translate3d(0, 0, 0); }
  100% { transform: translate3d(-96px, 96px, 0); }
}
@keyframes shimmer-slide {
  0%   { transform: translateX(-100%); }
  40%  { transform: translateX(200%); }
  100% { transform: translateX(400%); }
}
@keyframes pulse-dot {
  0%   { box-shadow: 0 0 0 0 rgba(139,92,246,0.6); }
  50%  { box-shadow: 0 0 0 8px rgba(139,92,246,0); }
  100% { box-shadow: 0 0 0 0 rgba(139,92,246,0); }
}
@keyframes dot-cycle {
  0%, 20% { opacity: 0.2; }
  50%     { opacity: 0.9; }
  80%, 100% { opacity: 0.2; }
}
@keyframes border-pulse {
  0%, 100% { border-color: rgba(139,92,246,0.15); }
  50%      { border-color: rgba(139,92,246,0.35); }
}
@keyframes card-glow {
  0%, 100% { box-shadow: 0 0 30px -10px rgba(139,92,246,0.25); }
  50%      { box-shadow: 0 0 60px -5px rgba(139,92,246,0.45); }
}
`
/* ──────────────────────────────────────────────────────────
   SCANLINE OVERLAY + VIGNETTE
   ────────────────────────────────────────────────────────── */

function Scanlines() {
  return (
    <div
      style={{
        position: 'absolute', inset: 0,
        backgroundImage:
          'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,0,0,0.05) 1px, rgba(0,0,0,0.05) 2px)',
        backgroundSize: '100% 2px',
        pointerEvents: 'none', zIndex: 20, opacity: 0.4,
      }}
    />
  )
}

function Vignette() {
  return (
    <div
      style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.65) 100%)',
        pointerEvents: 'none', zIndex: 15,
      }}
    />
  )
}
/* ──────────────────────────────────────────────────────────
   DUAL-LAYER PERSPECTIVE GRID (parallax)
   ────────────────────────────────────────────────────────── */

function PerspectiveGrid() {
  // Flat dual-layer grid that PANS diagonally across the screen (translate),
  // rather than sitting as a tilted perspective plane. Two layers drift at
  // different speeds/directions for depth. Each layer is oversized (inset
  // beyond the edges) so the translation never exposes a bare edge, and a
  // radial mask keeps it strongest at center and fading out toward the rim.
  return (
    <div
      style={{
        position: 'absolute', inset: 0, overflow: 'hidden',
        maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 75%)',
        WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 75%)',
        willChange: 'transform', zIndex: 1,
      }}
    >
      {/* Main grid — closer, faster, drifts down-right */}
      <div
        style={{
          position: 'absolute', inset: '-160px',
          backgroundImage: [
            'repeating-linear-gradient(0deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 0.5px, transparent 0.5px, transparent 48px)',
            'repeating-linear-gradient(90deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 0.5px, transparent 0.5px, transparent 48px)',
          ].join(','),
          backgroundSize: '100% 48px, 48px 100%',
          animation: 'grid-pan 7s linear infinite',
          willChange: 'transform',
        }}
      />
      {/* Secondary grid — deeper, slower, drifts down-left for parallax */}
      <div
        style={{
          position: 'absolute', inset: '-160px',
          backgroundImage: [
            'repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 0.5px, transparent 0.5px, transparent 96px)',
            'repeating-linear-gradient(90deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 0.5px, transparent 0.5px, transparent 96px)',
          ].join(','),
          backgroundSize: '100% 96px, 96px 100%',
          animation: 'grid-pan-slow 13s linear infinite',
          willChange: 'transform',
        }}
      />
    </div>
  )
}
/* ──────────────────────────────────────────────────────────
   MESH GRADIENT GLOW BLOBS (6 blobs, varied sizes)
   ────────────────────────────────────────────────────────── */

function GlowBlobs() {
  const blobs = useMemo(() => [
  { x: '10%', y: '5%',  size: 580, color: '#6B21A8', delay: 0 }, // intentional dynamic color
  { x: '65%', y: '12%', size: 480, color: '#7C3AED', delay: 1.5 }, // intentional dynamic color
  { x: '30%', y: '50%', size: 520, color: '#0EA5E9', delay: 3 }, // intentional dynamic color
  { x: '78%', y: '68%', size: 420, color: COLORS.purple, delay: 2.2 },
  { x: '18%', y: '78%', size: 380, color: COLORS.blue, delay: 4 },
  { x: '50%', y: '30%', size: 300, color: '#6B21A8', delay: 5 }, // intentional dynamic color
  ], [])

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', mixBlendMode: 'screen', zIndex: 2 }}>
      {blobs.map((b, i) => (
        <motion.div
          key={i}
          style={{
            position: 'absolute', left: b.x, top: b.y,
            width: b.size, height: b.size, borderRadius: '50%',
            background: `radial-gradient(circle at 30% 30%, ${b.color}, transparent 70%)`,
            opacity: 0.16, filter: 'blur(90px)', willChange: 'transform',
          }}
          animate={{
            scale: [1, 1.12, 0.95, 1.08, 1],
            x: [0, 25, -18, 12, 0],
            y: [0, -18, 12, -12, 0],
          }}
          transition={{
            duration: 12 + b.delay * 0.8, repeat: Infinity,
            ease: 'easeInOut', delay: b.delay,
          }}
        />
      ))}
    </div>
  )
}
/* ──────────────────────────────────────────────────────────
   FLOATING PARTICLES (dots + star shapes)
   ────────────────────────────────────────────────────────── */

  const PARTICLE_COLORS = [COLORS.white, '#67E8F9', '#C084FC', '#818CF8', COLORS.violetLight] // intentional dynamic gradation

interface Particle { id: number; x: number; y: number; size: number
  color: string; duration: number; delay: number; opacity: number
  xDrift: number; type: 'dot' | 'star' }

function FloatingParticles() {
  const particles = useMemo<Particle[]>(() =>
    Array.from({ length: 55 }, (_, i) => ({
      id: i, x: Math.random() * 100, y: Math.random() * 100,
      size: i < 10 ? 5 : [2, 3, 4][Math.floor(Math.random() * 3)]!,
      color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)]!,
      duration: 5 + Math.random() * 7, delay: Math.random() * 6,
      opacity: 0.15 + Math.random() * 0.55,
      xDrift: -25 + Math.random() * 50,
      type: i < 10 ? 'star' : 'dot',
    })), [])

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 5 }}>
      {particles.map((p) => (
        <motion.div
          key={p.id}
          style={{
            position: 'absolute', left: `${p.x}%`, top: `${p.y}%`,
            width: p.type === 'star' ? p.size * 3 : p.size,
            height: p.type === 'star' ? p.size * 3 : p.size,
            opacity: 0, willChange: 'transform',
            ...(p.type === 'star'
              ? { clipPath: 'polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)',
                  backgroundColor: p.color }
              : { borderRadius: '50%', backgroundColor: p.color }),
          }}
          animate={{
            // Particles MOVE across the screen (drift up + sideways) — no
            // spin-in-place. Stars and dots both simply travel and fade.
            opacity: [0, p.opacity, p.opacity, 0],
            y: [0, -140 - Math.random() * 60],
            x: [0, p.xDrift],
          }}
          transition={{
            duration: p.duration, repeat: Infinity, delay: p.delay,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  )
}
/* ──────────────────────────────────────────────────────────
   CENTER CARD — glassmorphism + gradient icon + glow
   ────────────────────────────────────────────────────────── */

function CenterCard() {
  return (
    <div style={{ position: 'relative', width: 120, height: 120, margin: '0 auto' }}>
      {/* Shadow card — rotated back */}
      <motion.div
        style={{
          position: 'absolute', inset: 0, borderRadius: 28,
          background: 'rgba(255,255,255,0.05)',
          border: `1px solid ${COLORS.whiteGlass}`,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
        animate={{ rotate: 9, opacity: 0.3, scale: 0.9 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      />
      {/* Shadow card — rotated forward */}
      <motion.div
        style={{
          position: 'absolute', inset: 0, borderRadius: 28,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.06)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
        animate={{ rotate: -7, opacity: 0.2, scale: 0.92 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.08 }}
      />
      {/* Main card */}
      <motion.div
        style={{
          position: 'absolute', inset: 0, borderRadius: 28,
          background: COLORS.whiteGlass,
          border: '1px solid rgba(139,92,246,0.2)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          boxShadow: [
            '0 8px 32px rgba(0,0,0,0.4)',
            '0 0 0 1px rgba(255,255,255,0.06) inset',
            '0 0 40px -8px rgba(139,92,246,0.3)',
            `0 0 100px -20px ${COLORS.blueDim}`,
          ].join(', '),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 2,
          animation: 'card-glow 4s ease-in-out infinite',
        }}
        initial={{ opacity: 0, scale: 0.82, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <svg width="52" height="52" viewBox="0 0 24 24" fill="none">
          <defs>
            <linearGradient id="icon-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#C084FC" /> {/* intentional dynamic color */}
            <stop offset="100%" stopColor="#818CF8" /> {/* intentional dynamic color */}
            </linearGradient>
          </defs>
          <circle cx="12" cy="12" r="10" stroke="url(#icon-grad)" strokeWidth="1.3" opacity="0.85"/>
          <text x="12" y="16" textAnchor="middle" fill="url(#icon-grad)" fontSize="14" fontWeight="700" fontFamily="'Inter',sans-serif">i</text>
        </svg>
      </motion.div>
    </div>
  )
}
/* ──────────────────────────────────────────────────────────
   APP TITLE — gradient text
   ────────────────────────────────────────────────────────── */

function AppTitle({ name, subtitle }: { name: string; subtitle: string }) {
  return (
    <motion.div
      style={{ textAlign: 'center' }}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.35 }}
    >
      <h1
        style={{
          margin: 0, fontSize: 60, fontWeight: 900,
          letterSpacing: '0.30em', lineHeight: 1.1,
          background: `linear-gradient(135deg, ${COLORS.text} 30%, #C084FC 65%, #818CF8 100%)`, // intentional dynamic color
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}
      >
        {name}
      </h1>
      <p
        style={{
          margin: '10px 0 0', fontSize: 12.5, fontWeight: 450,
          letterSpacing: '0.45em', color: 'rgba(255,255,255,0.4)',
          textTransform: 'uppercase',
        }}
      >
        {subtitle}
      </p>
    </motion.div>
  )
}
/* ──────────────────────────────────────────────────────────
   PROGRESS BAR — animated percentage + shimmer
   ────────────────────────────────────────────────────────── */

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0)
  const raf = useRef<number | null>(null)

  useEffect(() => {
    const start = display
    const diff = value - start
    if (Math.abs(diff) < 0.1) { setDisplay(value); return }
    const startTime = performance.now()
    const duration = 280
    const tick = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1)
      setDisplay(start + diff * (1 - Math.pow(1 - t, 3)))
      if (t < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
  }, [value])

  return <>{Math.round(display)}%</>
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div style={{ width: 400, maxWidth: '82vw' }}>
      {/* Label row */}
      <motion.div
        style={{
          display: 'flex', justifyContent: 'space-between', marginBottom: 10,
          fontSize: 12, color: 'rgba(255,255,255,0.3)', fontWeight: 500,
          letterSpacing: '0.03em',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <span>Loading</span>
        <span style={{ fontVariantNumeric: 'tabular-nums', color: 'rgba(255,255,255,0.5)' }}>
          <AnimatedNumber value={value} />
        </span>
      </motion.div>
      {/* Track */}
      <div
        style={{
          height: 6, borderRadius: 9999,
          background: 'rgba(255,255,255,0.06)',
          position: 'relative', overflow: 'hidden',
          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.3)',
        }}
      >
        {/* Fill */}
        <div
          style={{
            width: `${Math.min(100, Math.max(0, value))}%`,
            height: '100%', borderRadius: 9999,
            background: `linear-gradient(90deg, ${COLORS.violet}, #7C3AED 50%, ${COLORS.cyan})`, // intentional dynamic color
            transition: 'width 0.45s cubic-bezier(0.4, 0, 0.2, 1)',
            position: 'relative', overflow: 'hidden',
            boxShadow: '0 0 12px rgba(139,92,246,0.3)',
          }}
        >
          <div
            style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.45) 50%, transparent 100%)',
              width: '50%', animation: 'shimmer-slide 2s ease-in-out infinite',
            }}
          />
        </div>
      </div>
    </div>
  )
}
/* ──────────────────────────────────────────────────────────
   STATUS TEXT — pulsing dot + animated loading dots
   ────────────────────────────────────────────────────────── */

function LoadingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: 3, marginLeft: 2 }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 3, height: 3, borderRadius: '50%',
            backgroundColor: 'rgba(255,255,255,0.4)',
            display: 'inline-block',
            animation: `dot-cycle 1.4s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </span>
  )
}

function StatusText({ message }: { message: string }) {
  return (
    <motion.div
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 10, marginTop: 22,
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, delay: 0.55 }}
    >
      <span
        style={{
          width: 5, height: 5, borderRadius: '50%',
          backgroundColor: COLORS.violet,
          animation: 'pulse-dot 2s ease-in-out infinite',
        }}
      />
      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', fontWeight: 400, letterSpacing: '0.02em' }}>
        {message}
        <LoadingDots />
      </span>
    </motion.div>
  )
}
/* ──────────────────────────────────────────────────────────
   STAT BADGES — pill badges with hover lift
   ────────────────────────────────────────────────────────── */

function StatBadges({ badges }: { badges: StatBadge[] }) {
  return (
    <motion.div
      style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 36 }}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.75 }}
    >
      {badges.map((badge, i) => (
        <motion.div
          key={i}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '11px 22px', borderRadius: 9999,
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.04)',
            fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            cursor: 'default',
            transition: 'border-color 0.25s ease, background 0.25s ease',
          }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.85 + i * 0.12, ease: [0.16, 1, 0.3, 1] }}
          whileHover={{
            borderColor: 'rgba(139,92,246,0.35)',
            background: 'rgba(139,92,246,0.08)',
            scale: 1.04,
            transition: { duration: 0.2 },
          }}
        >
          <span style={{ fontSize: 14, lineHeight: 1 }}>{badge.icon}</span>
          <span style={{ fontSize: 13, fontWeight: 500, letterSpacing: '0.01em' }}>{badge.value}</span>
        </motion.div>
      ))}
    </motion.div>
  )
}
/* ──────────────────────────────────────────────────────────
   VERSION TEXT — bottom of screen
   ────────────────────────────────────────────────────────── */

function VersionText({ text }: { text: string }) {
  return (
    <motion.p
      style={{
        position: 'absolute', bottom: 30, left: 0, right: 0,
        textAlign: 'center', margin: 0,
        fontSize: 11, color: 'rgba(255,255,255,0.18)',
        fontWeight: 400, letterSpacing: '0.04em',
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, delay: 1.6 }}
    >
      {text}
    </motion.p>
  )
}
/* ──────────────────────────────────────────────────────────
   MAIN COMPONENT
   ────────────────────────────────────────────────────────── */

const DEFAULT_BADGES: StatBadge[] = [
  { icon: '\u26A1', value: '91%' },
  { icon: '\uD83D\uDDBC', value: '176K+' },
  { icon: '\u2726', value: 'Ready' },
]

const AnimatedLoadingScreen = memo(function AnimatedLoadingScreen({
  progress, isLoading,
  statusMessage = 'Loading...',
  appName = 'AHG',
  appSubtitle = 'STEAM UNLOCKER',
  statBadges = DEFAULT_BADGES,
  versionString = 'v1.2.3 \u2022 Developed by sinfo',
}: AnimatedLoadingScreenProps) {
  if (!isLoading) return null

  return (
    <>
      <style>{keyframeStyles}</style>
      <div
        style={{
          position: 'fixed', top: 0, left: 0,
          width: '100vw', height: '100vh',
          backgroundColor: COLORS.bgDark, zIndex: 9999,
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <PerspectiveGrid />
        <GlowBlobs />
        <FloatingParticles />
        <Vignette />
        <Scanlines />
        <div style={{ position: 'relative', zIndex: 30, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <CenterCard />
          <div style={{ height: 36 }} />
          <AppTitle name={appName} subtitle={appSubtitle} />
          <div style={{ height: 44 }} />
          <ProgressBar value={progress} />
          <StatusText message={statusMessage} />
          <StatBadges badges={statBadges} />
        </div>
        <VersionText text={versionString} />
      </div>
    </>
  )
})

export default AnimatedLoadingScreen
