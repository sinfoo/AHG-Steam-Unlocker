import { useT, t as tNow, type TKey } from '../i18n'
import { memo, useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Key, Loader2, MessageCircle, ExternalLink, ArrowLeft, ClipboardPaste, ArrowRight, Check, PlusCircle, Wrench, Puzzle, AlertCircle } from 'lucide-react'
import { COLORS } from '../constants/colors'

interface ActivationModalProps {
  isOpen: boolean
  onActivated: () => void
}

// ── Floating Emoji Component ──
function FloatingEmoji({ emoji, index }: { emoji: string; index: number }) {
  return (
    <motion.div
      className="absolute text-2xl pointer-events-none select-none"
      initial={{
        x: Math.random() * 300 - 150,
        y: Math.random() * 200 + 50,
        opacity: 0,
        scale: 0,
        rotate: 0,
      }}
      animate={{
        x: [Math.random() * 300 - 150, Math.random() * 400 - 200, Math.random() * 300 - 150],
        y: [Math.random() * 200 + 50, -Math.random() * 100 - 50, -Math.random() * 200 - 100],
        opacity: [0, 1, 1, 0],
        scale: [0, 1.2, 1, 0.8],
        rotate: [0, 180, 360, 540],
      }}
      transition={{
        duration: 4 + Math.random() * 3,
        repeat: Infinity,
        delay: index * 0.4 + Math.random() * 0.5,
        ease: 'easeInOut',
      }}
    >
      {emoji}
    </motion.div>
  )
}

const MONO = "'Geist Mono Variable','Geist Mono',ui-monospace,monospace"
const ACC = 'var(--acc, #a77dff)'
const KEY_LEN = 16
// Keys are A-Z/0-9 only; drop the dashes and spaces people paste from the formatted key.
const cleanKey = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '')

// Poster wall: bundled local posters (offline-safe) over gradient tiles
const WALL_COLS = Array.from({ length: 5 }, (_, c) => ({
  anim: `${c % 2 ? 'v2-colDown' : 'v2-colUp'} ${26 + c * 4}s ease-in-out infinite alternate`,
  tiles: Array.from({ length: 6 }, (_, r) => {
    const h = (c * 67 + r * 41 + 250) % 360
    return {
      bg: `url(./assets/posters/p${(c * 3 + r * 5) % 16}.webp) center/cover, linear-gradient(160deg, hsl(${h} 55% 34%), hsl(${(h + 50) % 360} 60% 14%))`,
      delay: `${(c * 0.08 + r * 0.06).toFixed(2)}s`,
    }
  }),
}))

const ROFL_EMOJIS = ['😂', '🤣', '😭', '💀', '🗿', '🤡', '😹', '🙏']
const STEPS: TKey[] = ['ui.act.step1', 'ui.act.step2', 'ui.act.step3']

const pillStyle: React.CSSProperties = {
  height: 34, padding: '0 12px', borderRadius: 10,
  background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.1)',
  backdropFilter: 'blur(10px)', fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 7,
}
const primaryBtn: React.CSSProperties = {
  position: 'relative', height: 54, border: 'none', borderRadius: 15, background: ACC, color: '#0b0614',
  fontSize: 15, fontWeight: 650, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
  overflow: 'hidden', boxShadow: `0 18px 40px -14px ${ACC}`, transition: 'transform .08s, filter .08s',
}

export const ActivationModal = memo(function ActivationModal({ isOpen, onActivated }: ActivationModalProps) {
  const t = useT()
  const [licenseKey, setLicenseKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [showSupport, setShowSupport] = useState(false)
  const [showMeme, setShowMeme] = useState(false)
  const [showSkipHint, setShowSkipHint] = useState(false)
  const [focused, setFocused] = useState(false)
  const gifRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    if (isOpen) {
      setLicenseKey('')
      setStatus('idle')
      setErrorMessage('')
      setShowSupport(false)
      setShowMeme(false)
      setShowSkipHint(false)
    }
  }, [isOpen])

  // Show the skip hint floating around X after a delay
  useEffect(() => {
    if (isOpen && status !== 'success' && !showMeme) {
      const timer = setTimeout(() => setShowSkipHint(true), 3000)
      return () => clearTimeout(timer)
    }
  }, [isOpen, status, showMeme])

  const handleActivate = async () => {
    if (!licenseKey.trim() || loading) return

    setLoading(true)
    setStatus('idle')
    setErrorMessage('')

    try {
      const result = await window.electronAPI?.activateLicense?.(licenseKey.trim())

      if (result?.success) {
        setStatus('success')
        setTimeout(() => {
          onActivated()
        }, 2000)
      } else {
        setStatus('error')
        setErrorMessage(result?.message || tNow('ui.act.invalid'))
      }
    } catch {
      setStatus('error')
      setErrorMessage(tNow('ui.act.network'))
    }

    setLoading(false)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      handleActivate()
    }
  }

  const openDiscord = async () => {
    const link = await window.electronAPI?.getSupportLink?.()
    if (link) window.open(link, '_blank')
  }

  const handleCloseClick = () => {
    // If no license key entered → trigger the meme
    if (!licenseKey.trim() && status !== 'success') {
      setShowMeme(true)
      setShowSkipHint(false)
    }
  }

  const handleBackToActivation = () => {
    setShowMeme(false)
    // Show the skip hint again after going back
    setTimeout(() => setShowSkipHint(true), 2000)
  }

  const keyCells = Math.max(KEY_LEN, Math.ceil(licenseKey.length / 4) * 4)
  const keyGroups = Array.from({ length: keyCells / 4 }, (_, g) => Array.from({ length: 4 }, (_, k) => g * 4 + k))
  const keyPct = Math.min(100, (licenseKey.length / KEY_LEN) * 100)
  const maskedKey = `••••  ••••  ••••  ${licenseKey.slice(-4).padEnd(4, '•')}`
  const hasKey = !!licenseKey.trim()
  const isErr = status === 'error'
  const ring = isErr
    ? 'linear-gradient(135deg,#f87171,#7f1d1d)'
    : focused || hasKey
      ? `linear-gradient(135deg, ${ACC}, rgba(255,255,255,.12))`
      : 'rgba(255,255,255,.1)'

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 grid md:grid-cols-[minmax(0,1.15fr)_minmax(400px,1fr)] overflow-hidden"
          style={{ background: '#06060c', color: '#f3f2fa' }}
          role="dialog"
          aria-modal="true"
          aria-label={t('ui.act.aria')}
        >
          {/* ── Left: poster wall + hero ── */}
          <div className="relative overflow-hidden hidden md:block" style={{ animation: 'v2-actLeft .6s cubic-bezier(.16,1,.3,1) both' }}>
            <div className="absolute inset-0" style={{ perspective: 1200 }}>
              <div className="absolute flex" style={{ inset: '-25% -30% -25% -10%', gap: 14, transform: 'rotateY(-20deg) rotateZ(-6deg)', opacity: 0.75 }}>
                {WALL_COLS.map((col, ci) => (
                  <div key={ci} className="flex-1 flex flex-col" style={{ gap: 14, animation: col.anim }}>
                    {col.tiles.map((t, ti) => (
                      <div key={ti} style={{ width: '100%', aspectRatio: '2/3', borderRadius: 12, background: t.bg, animation: 'v2-coverIn .8s cubic-bezier(.16,1,.3,1) both', animationDelay: t.delay, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.06)' }} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, rgba(6,6,12,.25) 0%, rgba(6,6,12,.5) 60%, #0f0f1b 100%), linear-gradient(0deg, #06060c 0%, rgba(6,6,12,.35) 55%, rgba(6,6,12,.15) 100%)' }} />
            <div className="absolute flex flex-col" style={{ insetInlineStart: 'clamp(28px,5vw,64px)', bottom: 'clamp(28px,7vh,72px)', insetInlineEnd: '12%', gap: 18 }}>
              <div className="flex items-center gap-3" style={{ animation: 'v2-riseIn .4s .15s both' }}>
                <img src="./assets/ahg-logo.png" alt="" style={{ width: 40, height: 40, objectFit: 'contain' }} />
                <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.3em', color: '#c9c8da' }}>AHG UNLOCKER</span>
              </div>
              <h1 style={{ margin: 0, fontSize: 'clamp(38px,4.4vw,68px)', fontWeight: 750, letterSpacing: '-.045em', lineHeight: 0.95, animation: 'v2-riseIn .5s .22s both' }}>
                {t('ui.act.heroA')}<br /><span style={{ color: ACC }}>{t('ui.act.heroB')}</span>
              </h1>
              <div style={{ fontSize: 15, color: '#c9c8da', maxWidth: 440, lineHeight: 1.5, animation: 'v2-riseIn .5s .3s both' }}>
                {t('ui.act.heroSub')}
              </div>
              <div className="flex flex-wrap gap-2" style={{ animation: 'v2-riseIn .5s .38s both' }}>
                <span style={pillStyle}><PlusCircle size={14} style={{ color: ACC }} />{t('ui.act.pill1')}</span>
                <span style={pillStyle}><Wrench size={14} style={{ color: '#fbbf24' }} />{t('ui.act.pill2')}</span>
                <span style={pillStyle}><Puzzle size={14} style={{ color: '#4ade80' }} />{t('ui.act.pill3')}</span>
                <span style={{ ...pillStyle, fontFamily: MONO, fontSize: 12 }}>{t('ui.act.pill4')}</span>
              </div>
            </div>
          </div>

          {/* ── Right: form panel ── */}
          <div
            className="relative flex items-center justify-center overflow-y-auto"
            style={{ padding: 40, scrollbarWidth: 'none', background: `radial-gradient(ellipse at 70% 20%, color-mix(in oklch, ${ACC} 14%, transparent), transparent 60%), #0f0f1b`, borderInlineStart: '1px solid rgba(255,255,255,.06)' }}
          >
            {status === 'success' && (
              <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 38%, rgba(34,197,94,.16), transparent 55%)', animation: 'v2-fadeIn .6s both' }} />
            )}

            {/* Close button + skip hint */}
            {status !== 'success' && !showMeme && (
              <div className="absolute top-4 end-4 z-20">
                {showSkipHint && (
                  <div className="absolute top-10 end-0 pointer-events-none z-20" style={{ animation: 'v2-popIn .3s cubic-bezier(.16,1,.3,1) both' }}>
                    <div className="relative px-3 py-1.5 rounded-full whitespace-nowrap" style={{ fontSize: 11, fontWeight: 800, background: `linear-gradient(135deg, ${COLORS.amber}, ${COLORS.red})`, color: '#fff', boxShadow: `0 8px 22px ${COLORS.amber}55` }}>
                      {t('ui.act.skip')}
                      <span className="absolute -top-1 end-3 w-2.5 h-2.5 rotate-45" style={{ background: COLORS.amber }} />
                    </div>
                  </div>
                )}
                <button
                  onClick={handleCloseClick}
                  className="p-2 rounded-xl transition-colors hover:bg-white/10 relative"
                  style={{ color: '#8b8aa3' }}
                  title={t('ui.act.closeTitle')}
                  aria-label={t('ui.common.close')}
                >
                  <X size={20} />
                </button>
              </div>
            )}

            {showMeme ? (
              /* ── Meme mode ── */
              <div className="relative w-full" style={{ maxWidth: 400 }}>
                {ROFL_EMOJIS.map((emoji, i) => (
                  <FloatingEmoji key={i} emoji={emoji} index={i} />
                ))}
                <div className="flex justify-center mb-4 relative z-10">
                  <motion.div
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.2 }}
                    className="w-52 h-64 rounded-2xl overflow-hidden"
                    style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 80px rgba(239,68,68,0.2)', border: '2px solid rgba(239,68,68,0.2)' }}
                  >
                    <img
                      ref={gifRef}
                      src="./gif/rabi3.gif"
                      alt="Nice try!"
                      className="w-full h-full object-cover"
                      decoding="async"
                      fetchPriority="low"
                      onError={(e) => {
                        // Fallback: try absolute path
                        (e.target as HTMLImageElement).src = 'gif/rabi3.gif'
                      }}
                    />
                  </motion.div>
                </div>
                <motion.h2
                  initial={{ opacity: 0, y: 20, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: 0.4, type: 'spring', stiffness: 150 }}
                  className="text-center mb-2 relative z-10"
                  style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-.04em', background: `linear-gradient(135deg, ${COLORS.red}, ${COLORS.amber}, ${COLORS.pink}, ${COLORS.red})`, backgroundSize: '200% 200%', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', animation: 'gradient-shift 2s ease infinite' }}
                >
                  {t('ui.act.seriously')}
                </motion.h2>
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="text-center text-sm mb-4 relative z-10" style={{ color: '#a6a5bb' }}>
                  {t('ui.act.thought')}
                </motion.p>
                <motion.p initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.8, type: 'spring' }} className="text-center text-2xl mb-6 relative z-10">
                  💀🤡🗿
                </motion.p>
                <motion.button
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1 }}
                  onClick={handleBackToActivation}
                  className="w-full relative z-10 hover:brightness-110 active:scale-[.98]"
                  style={{ ...primaryBtn, background: COLORS.amber, boxShadow: `0 18px 40px -14px ${COLORS.amber}` }}
                >
                  <ArrowLeft size={17} className="rtl-flip" />
                  <span>{t('ui.act.backToAct')}</span>
                </motion.button>
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }} className="text-center text-xs mt-4 relative z-10" style={{ color: 'rgba(255,255,255,0.25)' }}>
                  {t('ui.act.nice')}
                </motion.p>
              </div>
            ) : status === 'success' ? (
              /* ── Success: license card ── */
              <div className="relative w-full flex flex-col" style={{ maxWidth: 440, gap: 30 }}>
                <div className="flex justify-center" style={{ perspective: 1200 }}>
                  <div
                    className="relative w-full overflow-hidden"
                    style={{ maxWidth: 400, aspectRatio: '1.586', borderRadius: 22, transformStyle: 'preserve-3d', background: `linear-gradient(135deg, color-mix(in oklch, ${ACC} 55%, #0b0614) 0%, #15122b 45%, #0c0a18 100%)`, border: '1px solid rgba(255,255,255,.16)', boxShadow: `0 40px 80px -30px color-mix(in oklch, ${ACC} 70%, transparent), inset 0 1px 0 rgba(255,255,255,.18)`, animation: 'v2-cardIn 1.1s cubic-bezier(.16,1,.3,1) both, v2-cardFloat 5s 1.1s ease-in-out infinite' }}
                  >
                    <img src="./assets/ahg-logo.png" alt="" className="absolute" style={{ insetInlineEnd: -60, bottom: -70, width: 280, height: 280, objectFit: 'contain', opacity: 0.18, filter: 'blur(1px)' }} />
                    <div className="absolute inset-0" style={{ background: 'repeating-linear-gradient(115deg, transparent 0 18px, rgba(255,255,255,.025) 18px 19px)' }} />
                    <div className="absolute top-0 bottom-0" style={{ width: '45%', background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.28),transparent)', animation: 'v2-sheen 1.4s .7s cubic-bezier(.6,0,.2,1) both' }} />
                    <div className="absolute inset-0 flex flex-col" style={{ padding: '22px 24px' }}>
                      <div className="flex items-center gap-2.5">
                        <img src="./assets/ahg-logo.png" alt="" style={{ width: 34, height: 34, objectFit: 'contain' }} />
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 750, lineHeight: 1 }}>AHG</div>
                          <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '.28em', color: '#d8c8ff', marginTop: 3 }}>UNLOCKER</div>
                        </div>
                        <span className="flex-1" />
                        <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 600, letterSpacing: '.18em', padding: '4px 9px', borderRadius: 7, background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.18)' }}>{t('ui.act.cardLicense')}</span>
                      </div>
                      <div style={{ width: 44, height: 32, borderRadius: 7, marginTop: 20, background: 'linear-gradient(135deg,#f5d77a,#b8913a)', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.25)' }} />
                      <div className="flex-1" />
                      <div dir="ltr" style={{ fontFamily: MONO, fontSize: 'clamp(14px,2.4vw,19px)', fontWeight: 500, letterSpacing: '.14em', textShadow: '0 2px 10px rgba(0,0,0,.5)' }}>{maskedKey}</div>
                      <div className="flex items-end" style={{ marginTop: 12 }}>
                        <div>
                          <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '.2em', color: '#b9b0d9' }}>{t('ui.act.cardStatus')}</div>
                          <div style={{ fontSize: 14, fontWeight: 650, marginTop: 3 }}>{t('ui.act.cardActive')}</div>
                        </div>
                        <span className="flex-1" />
                        <div className="text-end">
                          <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '.2em', color: '#b9b0d9' }}>{t('ui.act.cardActivated')}</div>
                          <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, marginTop: 3 }}>{new Date().toLocaleDateString()}</div>
                        </div>
                      </div>
                    </div>
                    <div className="absolute" style={{ insetInlineEnd: 26, top: 84, padding: '6px 12px', border: '2px solid #4ade80', borderRadius: 10, color: '#4ade80', fontFamily: MONO, fontSize: 13, fontWeight: 700, letterSpacing: '.2em', transform: 'rotate(-12deg)', background: 'rgba(4,33,15,.35)', animation: 'v2-stamp .45s 1s cubic-bezier(.34,1.56,.64,1) both' }}>{t('ui.act.cardVerified')}</div>
                  </div>
                </div>
                <div className="text-center flex flex-col gap-2">
                  <div style={{ fontSize: 'clamp(30px,3vw,40px)', fontWeight: 750, letterSpacing: '-.04em', lineHeight: 1, animation: 'v2-riseIn .4s .45s both' }}>{t('ui.act.in')}</div>
                  <div style={{ fontSize: 14, color: '#a6a5bb', animation: 'v2-riseIn .4s .52s both' }}>{t('ui.act.activated')}</div>
                </div>
                <div className="flex flex-col" style={{ padding: '8px 16px', borderRadius: 16, background: 'rgba(255,255,255,.035)', border: '1px solid rgba(255,255,255,.07)', animation: 'v2-riseIn .4s .6s both' }}>
                  {STEPS.map((label, i) => {
                    const tm = 1 + i * 0.6
                    return (
                      <div key={label} className="flex items-center gap-3" style={{ height: 36, animation: `v2-riseIn .3s ${tm - 0.35}s both` }}>
                        <span className="relative shrink-0" style={{ width: 22, height: 22 }}>
                          <span className="absolute" style={{ inset: 2, borderRadius: '50%', border: '2px solid rgba(255,255,255,.15)', borderTopColor: '#fff', animation: `v2-spin .7s linear infinite, v2-fadeOut .15s ${tm}s forwards` }} />
                          <span className="absolute inset-0 flex items-center justify-center" style={{ borderRadius: '50%', background: '#22c55e', animation: `v2-checkPop .35s ${tm}s cubic-bezier(.34,1.56,.64,1) both` }}>
                            <Check size={13} style={{ color: '#04210f' }} strokeWidth={3} />
                          </span>
                        </span>
                        <span className="flex-1" style={{ fontSize: 14, color: '#e4e3f0' }}>{t(label)}</span>
                        <span style={{ fontFamily: MONO, fontSize: 11, color: '#4ade80', animation: `v2-fadeIn .2s ${tm}s both` }}>OK</span>
                      </div>
                    )
                  })}
                </div>
                <p className="text-center" style={{ fontSize: 12.5, color: '#4ade80', animation: 'v2-fadeIn .4s 1.4s both' }}>{t('ui.act.redirect')}</p>
              </div>
            ) : (
              /* ── Key entry ── */
              <div className="w-full flex flex-col" style={{ maxWidth: 480, gap: 24 }}>
                <div style={{ animation: 'v2-riseIn .4s .12s both' }}>
                  <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.22em', color: ACC }}>{t('ui.act.eyebrow')}</div>
                  <h2 style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-.03em', marginTop: 10 }}>{t('ui.act.enterKey')}</h2>
                  <div style={{ fontSize: 14, color: '#a6a5bb', marginTop: 6 }}>{t('ui.act.findKey')}</div>
                </div>

                {!showSupport ? (
                  <>
                    <div className="flex flex-col" style={{ gap: 12, animation: 'v2-riseIn .4s .18s both' }}>
                      <div style={{ animation: isErr ? 'v2-shake .4s' : undefined }}>
                        <label
                          className="relative block cursor-text"
                          style={{ height: 76, borderRadius: 18, padding: 1, background: ring, transition: 'background .25s, box-shadow .25s', boxShadow: focused ? `0 0 28px -6px color-mix(in oklch, ${ACC} 55%, transparent)` : 'none' }}
                        >
                          <input
                            type="text"
                            value={licenseKey}
                            onChange={(e) => setLicenseKey(cleanKey(e.target.value))}
                            onKeyDown={handleKeyPress}
                            onFocus={() => setFocused(true)}
                            onBlur={() => setFocused(false)}
                            spellCheck={false}
                            autoComplete="off"
                            aria-label={t('ui.act.keyAria')}
                            autoFocus
                            className="absolute inset-0 w-full h-full cursor-text"
                            style={{ opacity: 0, zIndex: 2, fontSize: 16 }}
                          />
                          <div className="relative h-full overflow-hidden flex items-center" style={{ borderRadius: 17, background: 'linear-gradient(180deg,#14142a,#0c0c18)', gap: 12, padding: '0 12px 0 14px' }}>
                            <span className="flex items-center justify-center shrink-0" style={{ width: 42, height: 42, borderRadius: 12, background: isErr ? 'rgba(248,113,113,.14)' : hasKey ? `color-mix(in oklch, ${ACC} 20%, transparent)` : 'rgba(255,255,255,.06)', color: isErr ? '#f87171' : hasKey ? ACC : '#8b8aa3', transition: 'all .25s' }}>
                              <Key size={19} />
                            </span>
                            <div dir="ltr" className="flex-1 min-w-0 flex items-center" style={{ gap: 4, font: `600 clamp(14px,1.45vw,21px) ${MONO}` }}>
                              {keyGroups.map((cells, gi) => (
                                <span key={gi} className="contents">
                                  {gi > 0 && <span style={{ flex: 'none', color: '#44435a', fontWeight: 400 }}>–</span>}
                                  <span className="flex-1 min-w-0 flex">
                                    {cells.map((ci) => {
                                      const ch = licenseKey[ci]
                                      return (
                                        <span key={ci} className="relative flex-1 min-w-0 text-center" style={{ color: ch ? '#fff' : '#3a3950' }}>
                                          {ch ? <span style={{ display: 'inline-block', animation: 'v2-charPop .18s cubic-bezier(.16,1,.3,1) both' }}>{ch}</span> : '·'}
                                          {focused && ci === licenseKey.length && (
                                            <span className="absolute" style={{ left: '50%', bottom: -6, width: 14, marginLeft: -7, height: 2, borderRadius: 1, background: ACC, boxShadow: `0 0 8px ${ACC}`, animation: 'v2-blink 1s steps(1) infinite' }} />
                                          )}
                                        </span>
                                      )
                                    })}
                                  </span>
                                </span>
                              ))}
                            </div>
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  const text = await navigator.clipboard.readText()
                                  setLicenseKey(cleanKey(text))
                                } catch {}
                              }}
                              title={t('ui.act.paste')}
                              aria-label={t('ui.act.paste')}
                              className="relative flex items-center justify-center shrink-0 hover:bg-white/10 hover:text-white"
                              style={{ zIndex: 3, width: 36, height: 36, borderRadius: 10, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.05)', color: '#c9c8da', transition: 'all .08s' }}
                            >
                              <ClipboardPaste size={15} />
                            </button>
                            <span className="absolute start-0 bottom-0" style={{ height: 2, width: `${keyPct}%`, background: `linear-gradient(90deg, color-mix(in oklch, ${ACC} 40%, transparent), ${ACC})`, boxShadow: `0 0 12px ${ACC}`, transition: 'width .25s cubic-bezier(.16,1,.3,1)' }} />
                            {loading && (
                              <span className="absolute top-0 bottom-0 pointer-events-none" style={{ width: '35%', background: `linear-gradient(90deg,transparent,color-mix(in oklch, ${ACC} 30%, transparent),transparent)`, animation: 'v2-sheen 1s ease-in-out infinite' }} />
                            )}
                          </div>
                        </label>
                      </div>
                      <div className="flex items-center gap-2.5" style={{ minHeight: 18 }} aria-live="polite">
                        {isErr && errorMessage ? (
                          <span className="flex items-center gap-1.5" style={{ fontSize: 12.5, color: '#fca5a5', animation: 'v2-riseIn .25s both' }}>
                            <AlertCircle size={14} />{errorMessage}
                          </span>
                        ) : (
                          <span style={{ fontSize: 12.5, color: '#8b8aa3' }}>{t('ui.act.pasteOrType')}</span>
                        )}
                        <span className="flex-1" />
                        <span style={{ fontFamily: MONO, fontSize: 11.5, color: licenseKey.length >= KEY_LEN ? '#4ade80' : '#6f6e86' }}>{licenseKey.length}/{KEY_LEN}</span>
                      </div>
                    </div>

                    <button
                      onClick={handleActivate}
                      disabled={!hasKey || loading}
                      className="hover:brightness-110 active:scale-[.98] disabled:hover:brightness-100 disabled:active:scale-100"
                      style={{ ...primaryBtn, opacity: hasKey ? 1 : 0.45, cursor: hasKey && !loading ? 'pointer' : 'not-allowed', animation: 'v2-riseIn .4s .24s both' }}
                    >
                      {loading && <span className="absolute inset-0" style={{ background: 'rgba(255,255,255,.35)', transformOrigin: 'left', animation: 'v2-keyFill .8s cubic-bezier(.6,0,.2,1) both' }} />}
                      {loading ? <Loader2 size={18} className="relative animate-spin" /> : null}
                      <span className="relative">{loading ? t('ui.act.activating') : t('ui.act.activate')}</span>
                      {!loading && <ArrowRight size={17} className="relative rtl-flip" />}
                    </button>

                    <div className="flex items-center gap-3" style={{ color: '#6f6e86', fontSize: 12, animation: 'v2-fadeIn .4s .3s both' }}>
                      <span className="flex-1" style={{ height: 1, background: 'rgba(255,255,255,.08)' }} />{t('ui.act.or')}<span className="flex-1" style={{ height: 1, background: 'rgba(255,255,255,.08)' }} />
                    </div>
                    <button
                      onClick={() => setShowSupport(true)}
                      className="flex items-center justify-center gap-2.5 text-white hover:bg-[rgba(88,101,242,.28)]"
                      style={{ height: 50, borderRadius: 15, border: '1px solid rgba(88,101,242,.45)', background: 'rgba(88,101,242,.14)', fontSize: 14, fontWeight: 600, transition: 'background .1s', animation: 'v2-riseIn .4s .3s both' }}
                    >
                      <MessageCircle size={18} />
                      {t('ui.act.contact')}
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col" style={{ gap: 16, animation: 'v2-riseIn .3s both' }}>
                    <div className="text-center py-2">
                      <MessageCircle size={44} className="mx-auto mb-3" style={{ color: '#5865F2' }} />
                      <h3 style={{ fontSize: 20, fontWeight: 700 }}>{t('ui.act.needHelp')}</h3>
                      <p style={{ fontSize: 14, color: '#a6a5bb', marginTop: 4 }}>{t('ui.act.joinSupport')}</p>
                    </div>
                    <button
                      onClick={openDiscord}
                      className="flex items-center justify-center gap-2 text-white hover:brightness-110 active:scale-[.98]"
                      style={{ height: 50, borderRadius: 15, background: '#5865F2', fontSize: 14, fontWeight: 600, boxShadow: '0 18px 40px -14px #5865F2', transition: 'transform .08s, filter .08s' }}
                    >
                      <MessageCircle size={18} />
                      {t('ui.settings.about.join')}
                      <ExternalLink size={14} />
                    </button>
                    <button onClick={() => setShowSupport(false)} className="py-2 hover:text-white" style={{ fontSize: 13, color: '#8b8aa3', transition: 'color .1s' }}>
                      {t('ui.common.back')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
})
