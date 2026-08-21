import { memo, useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Key, XCircle, Loader2, MessageCircle, ExternalLink, Shield, CheckCircle2, ArrowLeft } from 'lucide-react'
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

const ROFL_EMOJIS = ['😂', '🤣', '😭', '💀', '🗿', '🤡', '😹', '🙏']

export const ActivationModal = memo(function ActivationModal({ isOpen, onActivated }: ActivationModalProps) {
  const [licenseKey, setLicenseKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [showSupport, setShowSupport] = useState(false)
  const [showMeme, setShowMeme] = useState(false)
  const [showSkipHint, setShowSkipHint] = useState(false)
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
        setErrorMessage(result?.message || 'Invalid License Key')
      }
    } catch {
      setStatus('error')
      setErrorMessage('Network error. Please try again.')
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

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0, 0, 0, 0.9)', backdropFilter: 'blur(30px)' }}
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.85, opacity: 0, y: 30 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="w-full max-w-md mx-4 relative"
          >
            {/* Card */}
            <div 
              className="rounded-3xl p-8 relative overflow-hidden"
              style={{ 
background: showMeme
                    ? `linear-gradient(180deg, ${COLORS.bgCard} 0%, ${COLORS.bgDeep} 100%)` // intentional dynamic color
                  : status === 'success' 
                    ? `linear-gradient(180deg, ${COLORS.bgCard} 0%, ${COLORS.green}12 100%)`
                    : `linear-gradient(180deg, ${COLORS.bgCard} 0%, ${COLORS.violet}08 100%)`,
                border: `1px solid ${showMeme ? 'rgba(239,68,68,0.3)' : status === 'success' ? COLORS.green + '50' : COLORS.border}`,
                boxShadow: showMeme
                  ? `0 0 80px ${COLORS.redDim}, 0 20px 60px rgba(0,0,0,0.5)`
                  : status === 'success'
                    ? `0 0 80px ${COLORS.green}30, 0 20px 60px rgba(0,0,0,0.5)`
                    : `0 20px 60px rgba(0, 0, 0, 0.5), 0 0 60px ${COLORS.violet}15`
              }}
            >
              {/* ── Meme Mode ── */}
              {showMeme ? (
                <>
                  {/* Floating ROFL emojis */}
                  {ROFL_EMOJIS.map((emoji, i) => (
                    <FloatingEmoji key={i} emoji={emoji} index={i} />
                  ))}

                  {/* GIF */}
                  <div className="flex justify-center mb-4 relative z-10">
                    <motion.div
                      initial={{ scale: 0, rotate: -20 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.2 }}
                      className="w-52 h-64 rounded-2xl overflow-hidden"
                      style={{
                        boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 80px rgba(239,68,68,0.2)',
                        border: '2px solid rgba(239,68,68,0.2)'
                      }}
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

                  {/* "Seriously?" gradient text */}
                  <motion.h2
                    initial={{ opacity: 0, y: 20, scale: 0.8 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: 0.4, type: 'spring', stiffness: 150 }}
                    className="text-3xl font-black text-center mb-2 relative z-10"
                    style={{
                      background: `linear-gradient(135deg, ${COLORS.red}, ${COLORS.amber}, ${COLORS.pink}, ${COLORS.red})`, // intentional dynamic color
                      backgroundSize: '200% 200%',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      animation: 'gradient-shift 2s ease infinite',
                    }}
                  >
                    Seriously?
                  </motion.h2>

                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="text-center text-sm mb-6 relative z-10"
                    style={{ color: COLORS.textMuted }}
                  >
                    You thought you could just skip the license? 😂
                  </motion.p>

                  <motion.p
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.8, type: 'spring' }}
                    className="text-center text-2xl mb-6 relative z-10"
                  >
                    💀🤡🗿
                  </motion.p>

                  {/* Back to Activation Button */}
                  <motion.button
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1 }}
                    whileHover={{ 
                      scale: 1.05,
                      boxShadow: '0 0 40px rgba(245,158,11,0.5), 0 0 80px rgba(245,158,11,0.2)'
                    }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleBackToActivation}
                    className="w-full h-14 rounded-2xl font-bold text-white flex items-center justify-center gap-3 relative z-10"
                    style={{
                      background: `linear-gradient(135deg, ${COLORS.amber}, ${COLORS.amber}cc)`, // intentional gradient variation
                      boxShadow: '0 4px 25px rgba(245,158,11,0.4)',
                    }}
                  >
                    <ArrowLeft size={18} />
                    <span className="text-lg">Back to Activation</span>
                  </motion.button>

                  {/* Subtle text */}
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.2 }}
                    className="text-center text-xs mt-4 relative z-10"
                    style={{ color: 'rgba(255,255,255,0.2)' }}
                  >
                    (nice try though 😏)
                  </motion.p>
                </>
              ) : (
                <>
                  {/* ── Close Button with Skip Hint ── */}
                  {status !== 'success' && (
                    <div className="absolute top-4 right-4 z-20">
                      {/* Floating hint circle */}
                      {showSkipHint && (
                        <motion.div
                          className="absolute top-10 right-0 pointer-events-none z-20"
                          initial={{ opacity: 0, y: -8, scale: 0.7 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ type: 'spring', stiffness: 220, damping: 13 }}
                        >
                          <motion.div
                            animate={{ y: [0, 3, 0] }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                            className="relative px-3 py-1.5 rounded-full text-[11px] font-extrabold whitespace-nowrap"
                            style={{
                              background: `linear-gradient(135deg, ${COLORS.amber}, ${COLORS.red})`,
                              color: '#fff',
                              boxShadow: `0 8px 22px ${COLORS.amber}55, inset 0 1px 0 rgba(255,255,255,0.25)`,
                            }}
                          >
                            want to skip? 😏
                            {/* glow pulse */}
                            <motion.span
                              className="absolute inset-0 rounded-full"
                              style={{ boxShadow: `0 0 0 2px ${COLORS.amber}` }}
                              animate={{ opacity: [0.5, 0, 0.5], scale: [1, 1.25, 1] }}
                              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                            />
                            {/* tail pointing UP toward the X (kept inside the modal) */}
                            <span
                              className="absolute -top-1 right-3 w-2.5 h-2.5 rotate-45"
                              style={{ background: COLORS.amber }}
                            />
                          </motion.div>
                        </motion.div>
                      )}
                      <button
                        onClick={handleCloseClick}
                        className="p-2 rounded-xl transition-all hover:bg-white/10 relative"
                        style={{ color: COLORS.textMuted }}
                        title="Close (or try to...)"
                      >
                        <X size={20} />
                      </button>
                    </div>
                  )}

                  {/* Status Icon */}
                  <div className="flex justify-center mb-6">
                    {status === 'success' ? (
                      <div className="relative w-24 h-24 flex items-center justify-center">
                        {/* Expanding celebration rings */}
                        {[0, 0.25, 0.5].map((delay, i) => (
                          <motion.span
                            key={i}
                            className="absolute rounded-full"
                            style={{ border: `2px solid ${COLORS.green}` }}
                            initial={{ width: 72, height: 72, opacity: 0.55 }}
                            animate={{ width: 150, height: 150, opacity: 0 }}
                            transition={{ duration: 1.4, delay, repeat: Infinity, ease: 'easeOut' }}
                          />
                        ))}
                        {/* Sparkle particles bursting outward */}
                        {Array.from({ length: 10 }).map((_, i) => {
                          const ang = (i / 10) * Math.PI * 2
                          return (
                            <motion.span
                              key={'spark' + i}
                              className="absolute w-1.5 h-1.5 rounded-full"
                              style={{ background: i % 2 ? COLORS.green : COLORS.violet, boxShadow: `0 0 8px ${i % 2 ? COLORS.green : COLORS.violet}` }}
                              initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
                              animate={{ x: Math.cos(ang) * 60, y: Math.sin(ang) * 60, opacity: [0, 1, 0], scale: [0, 1, 0.4] }}
                              transition={{ duration: 0.9, delay: 0.15 + (i % 5) * 0.03, ease: 'easeOut' }}
                            />
                          )
                        })}
                        <motion.div
                          initial={{ scale: 0, rotate: -180 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ type: 'spring', stiffness: 200, damping: 12 }}
                          className="relative w-24 h-24 rounded-full flex items-center justify-center"
                          style={{
                            background: `linear-gradient(135deg, ${COLORS.green}40 0%, ${COLORS.green}15 100%)`,
                            boxShadow: `0 0 60px ${COLORS.green}55, inset 0 1px 0 rgba(255,255,255,0.2)`
                          }}
                        >
                          <CheckCircle2 size={48} style={{ color: COLORS.green }} />
                        </motion.div>
                      </div>
                    ) : (
                      <div 
                        className="w-20 h-20 rounded-full flex items-center justify-center"
                        style={{ 
                          background: `linear-gradient(135deg, ${COLORS.violet}30 0%, ${COLORS.violet}10 100%)`,
                          boxShadow: `0 0 50px ${COLORS.violet}40`
                        }}
                      >
                        <Shield size={36} style={{ color: COLORS.violet }} />
                      </div>
                    )}
                  </div>

                  {/* Title */}
                  <h2
                    className="text-2xl font-extrabold text-center mb-2 tracking-tight"
                    style={status === 'success'
                      ? { background: `linear-gradient(135deg, ${COLORS.green}, ${COLORS.violetLight || COLORS.violet})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }
                      : { color: COLORS.text }}
                  >
                    {status === 'success' ? "You're all set!" : 'License Activation'}
                  </h2>

                  {/* Subtitle */}
                  <p
                    className="text-center text-sm mb-6"
                    style={{ color: COLORS.textMuted }}
                  >
                    {status === 'success'
                      ? 'License activated — welcome to AHG Steam Unlocker.'
                      : 'Enter your license key to unlock all features'}
                  </p>

                  {status !== 'success' && !showSupport && (
                    <>
                      {/* Input with Paste Button */}
                      <div className="relative mb-4">
                        <div 
                          className="absolute inset-0 rounded-2xl transition-all"
                          style={{ 
                            background: `linear-gradient(135deg, ${COLORS.violet}12 0%, ${COLORS.bgDeep} 100%)`,
                            border: status === 'error' 
                              ? `1px solid ${COLORS.red}50` 
                              : `1px solid ${licenseKey ? COLORS.violet + '40' : COLORS.border}`
                          }}
                        />
                        <Key 
                          className="absolute left-4 top-1/2 -translate-y-1/2 z-10" 
                          size={18} 
                          style={{ color: licenseKey ? COLORS.violet : COLORS.textMuted }} 
                        />
                        <input
                          type="text"
                          placeholder="Enter license key"
                          value={licenseKey}
                          onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                          onKeyDown={handleKeyPress}
                          className="w-full h-14 pl-12 pr-16 rounded-2xl text-base font-mono text-white placeholder-gray-500 focus:outline-none transition-all relative z-10"
                          style={{ background: 'transparent' }}
                          autoFocus
                        />
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={async () => {
                            try {
                              const text = await navigator.clipboard.readText()
                              setLicenseKey(text.trim().toUpperCase())
                            } catch {}
                          }}
                          title="Paste from clipboard"
                          className="absolute right-3 top-1/2 -translate-y-1/2 z-10 p-2 rounded-xl"
                          style={{ background: COLORS.violet + '20' }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.violet} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                          </svg>
                        </motion.button>
                      </div>

                      {/* Error Message */}
                      {status === 'error' && errorMessage && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mb-4 px-4 py-3 rounded-xl flex items-center gap-3"
                          style={{ background: COLORS.redDim }}
                        >
                          <XCircle size={18} className="text-red-500" />
                          <span className="text-sm text-red-400">{errorMessage}</span>
                        </motion.div>
                      )}

                      {/* Activate Button */}
                      <motion.button
                        whileHover={{ scale: loading ? 1 : 1.02 }}
                        whileTap={{ scale: loading ? 1 : 0.98 }}
                        onClick={handleActivate}
                        disabled={!licenseKey.trim() || loading}
                        className="w-full h-14 rounded-2xl font-bold text-white flex items-center justify-center gap-3 mb-4"
                        style={{ 
                          background: licenseKey.trim() && !loading 
                            ? `linear-gradient(135deg, ${COLORS.violet} 0%, ${COLORS.cyan} 100%)`
                            : COLORS.violet + '50',
                          boxShadow: licenseKey.trim() && !loading 
                            ? `0 4px 25px ${COLORS.violet}50` 
                            : 'none',
                          cursor: licenseKey.trim() && !loading ? 'pointer' : 'not-allowed'
                        }}
                      >
                        {loading ? (
                          <>
                            <Loader2 size={20} className="animate-spin" />
                            <span>Activating...</span>
                          </>
                        ) : (
                          <>
                            <Shield size={18} />
                            <span className="text-lg">Activate License</span>
                          </>
                        )}
                      </motion.button>

                      {/* Contact Support */}
                      <motion.button
                        whileHover={{ scale: 1.02, backgroundColor: 'rgba(255,255,255,0.05)' }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setShowSupport(true)}
                        className="w-full h-12 rounded-xl font-medium flex items-center justify-center gap-2"
                        style={{ 
                          background: 'transparent',
                          color: COLORS.textMuted
                        }}
                      >
                        <MessageCircle size={16} />
                        Contact Support
                      </motion.button>
                    </>
                  )}

                  {showSupport && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-center py-4"
                    >
                      <MessageCircle 
                        size={48} 
                        className="mx-auto mb-4"
                        style={{ color: '#5865F2' }} // Discord brand color - intentional
                      />
                      <h3 
                        className="text-xl font-bold mb-2"
                        style={{ color: COLORS.text }}
                      >
                        Need Help?
                      </h3>
                      <p 
                        className="text-sm mb-6"
                        style={{ color: COLORS.textMuted }}
                      >
                        Join our Discord community for support
                      </p>
                      <motion.button
                        whileHover={{ scale: 1.02, boxShadow: '0 4px 30px #5865F250' }} // Discord brand color - intentional
                        whileTap={{ scale: 0.98 }}
                        onClick={openDiscord}
                        className="w-full h-12 rounded-xl font-bold text-white flex items-center justify-center gap-2"
                        style={{ 
                          background: '#5865F2', // Discord brand color - intentional
                          boxShadow: '0 4px 20px #5865F240'
                        }}
                      >
                        <MessageCircle size={18} />
                        Join Discord
                        <ExternalLink size={14} />
                      </motion.button>
                      
                      <button
                        onClick={() => setShowSupport(false)}
                        className="w-full mt-4 py-2 text-sm font-medium"
                        style={{ color: COLORS.textMuted }}
                      >
                        Back
                      </button>
                    </motion.div>
                  )}

                  {/* Success Animation */}
                  {status === 'success' && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="text-center mt-4"
                    >
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.5, type: 'spring' }}
                        className="flex justify-center gap-2 mb-3"
                      >
                        {[0, 1, 2].map((i) => (
                          <motion.div
                            key={i}
                            animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
                            transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                            className="w-2 h-2 rounded-full"
                            style={{ background: COLORS.violet }}
                          />
                        ))}
                      </motion.div>
                      <p className="text-green-400 font-medium">
                        Redirecting to the app...
                      </p>
                    </motion.div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
})
