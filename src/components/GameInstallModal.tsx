import { useT } from '../i18n'
import { memo, useEffect, useRef, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, AlertCircle, Loader2, RotateCw, X, Layers } from 'lucide-react'
import { DARK_COLORS } from '../constants/colors'
import { loadGameImage } from '../services/imageCache'

interface InstallLog {
  id: number
  message: string
  type: 'info' | 'success' | 'error' | 'warn'
}

interface DlcEntry {
  appid: string
  name: string
  header_image?: string
}

interface GameInstallModalProps {
  isOpen: boolean
  gameName: string
  gameAppid: string
  gameCover?: string | null
  status: 'installing' | 'dlc' | 'done' | 'error'
  progress: number
  logs: InstallLog[]
  dlcCount?: number
  dlcs?: DlcEntry[]
  totalInstalled?: number
  onRestartSteam: () => void
  onClose: () => void
  onDismiss: () => void
  onCancel?: () => void
}

const COLORS = DARK_COLORS

export const GameInstallModal = memo(function GameInstallModal({
  isOpen, gameName, gameAppid, gameCover,
  status, progress, logs,
  dlcCount = 0, dlcs = [], totalInstalled = 0,
  onRestartSteam, onClose, onDismiss, onCancel
}: GameInstallModalProps) {
  const t = useT()
  const logsEndRef = useRef<HTMLDivElement>(null)
  const [copySuccess, setCopySuccess] = useState(false)

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const handleCopyLogs = () => {
    const text = logs.map(l => `[${l.type.toUpperCase()}] ${l.message}`).join('\n')
    navigator.clipboard.writeText(text)
    setCopySuccess(true)
    setTimeout(() => setCopySuccess(false), 2000)
  }

  const appidStr = String(gameAppid)
  const gradientSeed = appidStr.charCodeAt(0) + (appidStr.charCodeAt(appidStr.length - 1) || 0)
  const hue1 = (gradientSeed * 37) % 360
  const hue2 = (hue1 + 40) % 360

  const getGlowColor = () => {
    switch (status) {
      case 'installing': return COLORS.violet
      case 'dlc': return COLORS.amber
      case 'done': return COLORS.green
      case 'error': return COLORS.red
      default: return COLORS.violet
    }
  }

  const getGlow = () => getGlowColor() + '20'
  const getBorderColor = () => getGlowColor() + '40'
  const isActive = status === 'installing' || status === 'dlc'

  // ── Completion Celebration: brief confetti burst ──
  const [celebrationDone, setCelebrationDone] = useState(false)
  useEffect(() => {
    if (status === 'done') {
      setCelebrationDone(false)
      const timer = setTimeout(() => setCelebrationDone(true), 1800)
      return () => clearTimeout(timer)
    }
  }, [status])

  const particles = useMemo(() => {
    if (status !== 'done') return []
    return Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: (i % 5) * 25 - 10 + Math.random() * 20,
      y: -20 - Math.random() * 60,
      scale: 0.3 + Math.random() * 0.7,
      rotate: Math.random() * 360,
      color: [COLORS.green, COLORS.cyan, COLORS.violet, COLORS.amber, COLORS.pink][i % 5],
      delay: Math.random() * 0.3,
    }))
  }, [status])

  const [dlcImgUrls, setDlcImgUrls] = useState<Record<string, string | null>>({})
  useEffect(() => {
    const results: Record<string, string | null> = {}
    Promise.allSettled(
      dlcs.map(dlc =>
        loadGameImage(dlc.appid, dlc.header_image || undefined, dlc.name || undefined)
          .then(url => { results[dlc.appid] = url })
      )
    ).then(() => setDlcImgUrls(results))
  }, [dlcs])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[300] flex items-center justify-center p-4"
          style={{ background: 'rgba(4,4,10,0.6)', backdropFilter: 'blur(10px)' }}
          onClick={(e) => { if (e.target === e.currentTarget && !isActive) onDismiss() }}
        >
          <motion.div
            initial={{ scale: 0.92, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.92, y: 30, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            className="w-full max-w-md rounded-[24px] overflow-hidden"
            style={{
              background: '#0f0f1b',
              border: `1px solid ${getBorderColor()}`,
              boxShadow: '0 60px 120px -30px rgba(0,0,0,1)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Animated header bar */}
            <div
              className="h-1.5"
              style={{
                background: status === 'done'
                  ? `linear-gradient(90deg, ${COLORS.green}, ${COLORS.cyan}, ${COLORS.green})`
                  : status === 'error'
                    ? `linear-gradient(90deg, ${COLORS.red}, ${COLORS.amber}, ${COLORS.red})`
                    : status === 'dlc'
                      ? `linear-gradient(90deg, ${COLORS.amber}, ${COLORS.green}, ${COLORS.amber})`
                      : `linear-gradient(90deg, ${COLORS.violet}, ${COLORS.blue}, ${COLORS.violet})`,
                backgroundSize: '200% 100%',
                animation: 'shimmer 2s linear infinite'
              }}
            />

            <div className="p-6 max-h-[80vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-center gap-4 mb-5">
                <motion.div
                  animate={isActive ? { rotate: 360 } : {}}
                  transition={isActive ? { duration: 2, repeat: Infinity, ease: 'linear' } : {}}
                  className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                  style={{
                    background: status === 'done'
                      ? `linear-gradient(135deg, ${COLORS.green}30, ${COLORS.green}15)`
                      : status === 'error'
                        ? `linear-gradient(135deg, ${COLORS.red}30, ${COLORS.red}15)`
                        : status === 'dlc'
                          ? `linear-gradient(135deg, ${COLORS.amber}30, ${COLORS.amber}15)`
                          : `linear-gradient(135deg, ${COLORS.violet}30, ${COLORS.blue}15)`,
                    border: `1px solid ${getBorderColor()}`
                  }}
                >
                  {status === 'done' ? (
                    <motion.div className="relative">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                      >
                        <CheckCircle2 size={28} style={{ color: COLORS.green }} />
                      </motion.div>
                      {/* Celebration particles burst */}
                      {!celebrationDone && particles.map(p => (
                        <motion.div
                          key={p.id}
                          className="absolute top-1/2 left-1/2 w-1.5 h-1.5 rounded-full"
                          style={{ background: p.color }}
                          initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
                          animate={{
                            x: p.x,
                            y: p.y,
                            scale: [0, p.scale, 0],
                            opacity: [1, 0.8, 0],
                          }}
                          transition={{
                            duration: 0.8,
                            delay: p.delay,
                            ease: 'easeOut',
                          }}
                        />
                      ))}
                    </motion.div>
                  ) : status === 'error' ? (
                    <AlertCircle size={28} style={{ color: COLORS.red }} />
                  ) : status === 'dlc' ? (
                    <Layers size={26} style={{ color: COLORS.amber }} />
                  ) : (
                    <div className="relative">
                      <Loader2 size={26} style={{ color: COLORS.violet }} className="animate-spin" />
                      <motion.div
                        className="absolute inset-0 rounded-full"
                        style={{ border: `2px solid ${getGlowColor()}30` }}
                        animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      />
                    </div>
                  )}
                </motion.div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-white truncate">
                    {gameAppid === 'batch' ? t('ui.gi.batch')
                      : status === 'done' ? t('ui.gi.complete')
                      : status === 'error' ? t('ui.gi.failed')
                      : status === 'dlc' ? t('ui.gi.addingDlc')
                      : t('ui.gi.adding')}
                  </h3>
                  <p className="text-sm truncate" style={{ color: COLORS.textSecondary }}>
                    {gameName}
                  </p>
                  <p className="text-xs" style={{ color: COLORS.textDim }}>{t('ui.gi.appNum', { id: gameAppid })}</p>
                </div>
                {!isActive && (
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={onClose}
                    aria-label={t('ui.common.close')}
                    className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ background: COLORS.bgHover }}
                  >
                    <X size={16} style={{ color: COLORS.textMuted }} />
                  </motion.button>
                )}
              </div>

              {/* Game Cover Preview */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="rounded-2xl overflow-hidden mb-5 relative"
                style={{
                  background: `linear-gradient(135deg, hsl(${hue1}, 50%, 12%) 0%, hsl(${hue2}, 40%, 18%) 100%)`,
                  aspectRatio: '460/215',
                }}
              >
                {gameCover && (
                  <img
                    src={gameCover}
                    alt={gameName}
                    className="w-full h-full object-cover"
                    onError={(e) => { e.currentTarget.style.display = 'none' }}
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-3 start-3 flex items-center gap-2">
                  <div className="px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5" style={{
                    background: status === 'done' ? COLORS.green :
                      status === 'error' ? COLORS.red :
                      status === 'dlc' ? `${COLORS.amber}cc` :
                      `${COLORS.violet}cc`,
                    color: COLORS.white
                  }}>
                    {status === 'installing' ? (
                      <><Loader2 size={10} className="animate-spin" /> {t('ui.gi.addingDots')}</>
                    ) : status === 'dlc' ? (
                      <><Layers size={10} /> {t('ui.gi.addingDlcDots')}</>
                    ) : status === 'done' ? (
                      <><CheckCircle2 size={10} /> {t('ui.gi.added')}</>
                    ) : (
                      <><AlertCircle size={10} /> {t('ui.gi.failedShort')}</>
                    )}
                  </div>
                </div>
              </motion.div>

              {/* Progress Bar */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.15 }}
                className="mb-5"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium" style={{ color: COLORS.textMuted }}>
                    {status === 'installing' ? t('ui.gi.addingDots')
                      : status === 'dlc' ? t('ui.gi.processingDlc')
                      : status === 'done' ? t('ui.gi.completeShort')
                      : t('ui.gi.failedShort')}
                  </span>
                  <span className="text-xs font-bold" style={{
                    color: status === 'done' ? COLORS.green :
                      status === 'error' ? COLORS.red :
                      status === 'dlc' ? COLORS.amber :
                      COLORS.violet
                  }}>
                    {Math.round(progress)}%
                  </span>
                </div>
                <div className="h-2.5 rounded-full overflow-hidden relative" style={{ background: COLORS.bgHover }}>
                  <motion.div
                    className="h-full rounded-full relative"
                    style={{
                      background: status === 'done'
                        ? COLORS.green
                        : status === 'error'
                          ? COLORS.red
                          : status === 'dlc'
                            ? `linear-gradient(90deg, ${COLORS.amber}, ${COLORS.green})`
                            : `linear-gradient(90deg, ${COLORS.violet}, ${COLORS.blue})`
                    }}
                    initial={{ width: '0%' }}
                    animate={{ width: `${Math.round(progress)}%` }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                  >
                    {/* Shine sweep on active bars */}
                    {isActive && (
                      <motion.div
                        className="absolute inset-0"
                        style={{
                          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)',
                        }}
                        animate={{ x: ['-100%', '200%'] }}
                        transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                      />
                    )}
                  </motion.div>
                  {/* Particle dots along the bar length */}
                  {isActive && (
                    <div className="absolute inset-0 flex items-center px-1">
                      {Array.from({ length: 10 }, (_, i) => (
                        <motion.div
                          key={i}
                          className="w-1 h-1 rounded-full"
                          style={{ background: 'rgba(255,255,255,0.5)', marginInlineStart: `${9 * i}%` }}
                          animate={{ opacity: [0, 0.8, 0], scale: [0.5, 1.2, 0.5] }}
                          transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            delay: i * 0.15,
                            ease: 'easeInOut',
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Live Activity Log */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="rounded-2xl overflow-hidden mb-5"
                style={{
                  background: COLORS.bgDeep,
                  border: `1px solid ${COLORS.border}50`,
                }}
              >
                <div className="flex items-center justify-between px-4 py-2.5" style={{
                  borderBottom: `1px solid ${COLORS.border}30`,
                  background: `${COLORS.bgHover}80`
                }}>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{
                      background: status === 'done' ? COLORS.green :
                        status === 'error' ? COLORS.red :
                        status === 'dlc' ? COLORS.amber :
                        COLORS.violet
                    }} />
                    <span className="text-xs font-semibold" style={{ color: COLORS.textMuted }}>{t('ui.gi.activity')}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded font-bold" style={{ background: `${COLORS.violet}20`, color: COLORS.violet }}>
                      {logs.length}
                    </span>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleCopyLogs}
                    className="text-xs px-2 py-1 rounded-lg font-medium flex items-center gap-1"
                    style={{ background: `${COLORS.textDim}20`, color: copySuccess ? COLORS.green : COLORS.textDim }}
                  >
                    {copySuccess ? t('ui.common.copied') : t('ui.common.copy')}
                  </motion.button>
                </div>
                <div className="max-h-36 overflow-y-auto p-3 space-y-1.5">
                  {logs.length === 0 ? (
                    <div className="flex items-center justify-center py-6">
                      <div className="flex gap-1">
                        {[0, 0.15, 0.3].map((d, i) => (
                          <motion.div
                            key={i}
                            className="w-2 h-2 rounded-full"
                            style={{ background: COLORS.violet }}
                            animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                            transition={{ duration: 1, repeat: Infinity, delay: d }}
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    logs.map((log) => (
                      <motion.div
                        key={log.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-start gap-2 py-1"
                      >
                        <span className="text-xs font-mono shrink-0 mt-0.5" style={{ color: COLORS.textDim }}>
                          {String(log.id).slice(-4)}
                        </span>
                        <span className="text-xs" style={{
                          color: log.type === 'success' ? COLORS.green :
                            log.type === 'error' ? COLORS.red :
                            log.type === 'warn' ? COLORS.amber :
                            COLORS.textSecondary,
                          lineHeight: '1.4',
                          fontFamily: "'SF Mono', 'Fira Code', monospace",
                        }}>
                          {(() => {
                            const cleaned = log.message
                              .replace(/\(?https?:\/\/[^\s)]+\)?/g, '')
                              .replace(/\b(?:ryuu|source|mirror)\b/gi, '')
                              .replace(/\s{2,}/g, ' ')
                              .trim()
                            return cleaned || <span className="italic opacity-40">—</span>
                          })()}
                        </span>
                      </motion.div>
                    ))
                  )}
                  <div ref={logsEndRef} />
                </div>
              </motion.div>

              {/* Summary Section (shown only on done) */}
              {status === 'done' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="mb-5 p-4 rounded-2xl"
                  style={{ background: COLORS.bgDeep, border: `1px solid ${COLORS.border}50` }}
                >
                  <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                    <CheckCircle2 size={14} style={{ color: COLORS.green }} />
                    {t('ui.gi.summary')}
                  </h4>
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between p-2.5 rounded-xl" style={{ background: COLORS.bgHover }}>
                      <span className="text-xs" style={{ color: COLORS.textMuted }}>{t('ui.common.game')}</span>
                      <span className="text-xs font-bold text-white truncate ms-2">{gameName}</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-xl" style={{ background: COLORS.bgHover }}>
                      <span className="text-xs" style={{ color: COLORS.textMuted }}>{t('ui.gi.dlcsAdded')}</span>
                      <span className="text-xs font-bold" style={{ color: dlcCount > 0 ? COLORS.amber : COLORS.textMuted }}>{dlcCount > 0 ? t('ui.gi.nDlcs', { n: dlcCount }) : t('ui.gi.noneFound')}</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-xl" style={{ background: COLORS.bgHover }}>
                      <span className="text-xs" style={{ color: COLORS.textMuted }}>{t('ui.gi.libraryTotal')}</span>
                      <span className="text-xs font-bold" style={{ color: COLORS.violet }}>{t('ui.gi.nGames', { n: totalInstalled })}</span>
                    </div>
                  </div>

                  {/* DLC List with Covers */}
                  {dlcs.length > 0 && (
                    <div className="mt-4">
                      <h5 className="text-xs font-bold mb-2.5 flex items-center gap-1.5" style={{ color: COLORS.amber }}>
                        <Layers size={12} /> {t('ui.gi.installedDlcs', { n: dlcs.length })}
                      </h5>
                      <div className="space-y-2 max-h-40 overflow-y-auto pe-1">
                        {dlcs.map((dlc, i) => (
                          <motion.div
                            key={dlc.appid}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.3 + i * 0.04 }}
                            className="flex items-center gap-3 p-2 rounded-xl"
                            style={{ background: COLORS.bgHover }}
                          >
                            <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0" style={{ background: COLORS.bgDeep }}>
                              {dlc.header_image ? (
                                <img src={dlcImgUrls[dlc.appid] || dlc.header_image} alt={dlc.name} className="w-full h-full object-cover" loading="lazy" decoding="async"
                                  onError={(e) => { e.currentTarget.style.display = 'none' }} />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <span className="text-xs font-bold" style={{ color: COLORS.textDim }}>
                                    {dlc.name.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-white truncate">{dlc.name}</p>
                              <p className="text-xs" style={{ color: COLORS.textDim }}>#{dlc.appid}</p>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Action Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="space-y-2.5"
              >
                {status === 'done' ? (
                  <>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={onRestartSteam}
                      className="w-full py-4 rounded-2xl font-bold  text-base flex items-center justify-center gap-3 relative overflow-hidden cursor-pointer"
                      style={{
                        background: 'var(--acc,#a77dff)',
                        boxShadow: '0 16px 40px -14px var(--acc,#a77dff)'
                      }}
                    >
                      <motion.div
                        className="absolute inset-0"
                        style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)' }}
                        animate={{ x: ['-100%', '100%'] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      />
                      <RotateCw size={18} />
                      {t('ui.gi.restartSteam')}
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={onDismiss}
                      className="w-full py-3.5 rounded-2xl font-medium text-sm cursor-pointer"
                      style={{
                        background: COLORS.bgHover,
                        border: `1px solid ${COLORS.border}`,
                        color: COLORS.textSecondary
                      }}
                    >
                      {t('ui.gi.restartLater')}
                    </motion.button>
                  </>
                ) : status === 'error' ? (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onClose}
                    className="w-full py-4 rounded-2xl font-bold text-white text-base cursor-pointer"
                    style={{
                      background: `linear-gradient(135deg, ${COLORS.red}, ${COLORS.red}cc)`,
                      boxShadow: `0 8px 32px ${COLORS.red}40`
                    }}
                  >
                    {t('ui.common.close')}
                  </motion.button>
                ) : (
                  <div className="space-y-2">
                    <div
                      className="w-full py-4 rounded-2xl font-medium text-sm flex items-center justify-center gap-3"
                      style={{
                        background: status === 'dlc' ? `${COLORS.amber}15` : `${COLORS.violet}15`,
                        border: `1px solid ${status === 'dlc' ? COLORS.amber + '30' : COLORS.violet + '30'}`,
                        color: status === 'dlc' ? COLORS.amber : COLORS.violet
                      }}
                    >
                      <Loader2 size={16} className="animate-spin" />
                      {status === 'dlc' ? t('ui.gi.addingDlcDots') : t('ui.gi.addingDots')}
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => { onCancel?.(); onClose(); }}
                      className="w-full py-2.5 rounded-2xl font-medium text-xs cursor-pointer"
                      style={{
                        background: 'transparent',
                        border: `1px solid ${COLORS.border}`,
                        color: COLORS.textDim
                      }}
                    >
                      {t('ui.common.cancel')}
                    </motion.button>
                  </div>
                )}
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
})
