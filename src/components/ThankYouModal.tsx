import { memo, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, PartyPopper } from 'lucide-react'
import { COLORS } from '../constants/colors'

interface ThankYouModalProps {
  isOpen: boolean
  onClose: () => void
}

function Gamepad2(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h15v6H6zM6 9.75V6.75A.75.75 0 0 1 6.75 6h10.5a.75.75 0 0 1 .75.75V9.75a.75.75 0 0 1-.75.75H6.75A.75.75 0 0 1 6 9.75zM9 9h2v2H9V9zM9 13h2v2H9v-2z" />
    </svg>
  )
}
function Zap(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
    </svg>
  )
}
function Shield(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
    </svg>
  )
}

const STATS = [
  { icon: Gamepad2, label: '176K+', sub: 'Games', color: COLORS.violet },
  { icon: Zap, label: '4K+', sub: 'Fixes', color: COLORS.green },
  { icon: Shield, label: 'Secure', sub: 'Private', color: COLORS.blue },
]

const PARTICLES = Array.from({ length: 14 }, (_, i) => ({
  left: (i * 37) % 100,
  top: (i * 53 + 11) % 100,
  size: 1.5 + (i % 3),
  delay: (i % 7) * 0.4,
  dur: 4 + (i % 4),
  violet: i % 2 === 0,
}))

export const ThankYouModal = memo(function ThankYouModal({ isOpen, onClose }: ThankYouModalProps) {
  const [show, setShow] = useState(false)

  useEffect(() => { if (isOpen) setShow(true) }, [isOpen])

  const handleClose = () => {
    setShow(false)
    setTimeout(() => onClose(), 280)
  }

  if (!show && !isOpen) return null

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[120] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.86)', backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)' }}
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.86, opacity: 0, y: 36 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.86, opacity: 0, y: 36 }}
            transition={{ type: 'spring', damping: 22, stiffness: 320 }}
            className="w-full max-w-[400px] max-h-[92vh] overflow-y-auto relative rounded-3xl"
            style={{
              background: `linear-gradient(160deg, ${COLORS.bgCard} 0%, ${COLORS.bgDeep} 100%)`,
              border: `1px solid ${COLORS.violet}33`,
              boxShadow: `0 30px 90px rgba(0,0,0,0.6), 0 0 70px ${COLORS.violet}18`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* animated gradient border glow */}
            <motion.div
              className="absolute -inset-px rounded-3xl pointer-events-none"
              style={{ background: `linear-gradient(135deg, ${COLORS.violet}55, transparent 40%, transparent 60%, ${COLORS.green}44)` }}
              animate={{ opacity: [0.5, 0.9, 0.5] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            />
            {/* top accent glow */}
            <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-64 h-32 rounded-full pointer-events-none"
              style={{ background: `radial-gradient(ellipse, ${COLORS.violet}40 0%, transparent 70%)`, filter: 'blur(20px)' }} />
            {/* floating particles */}
            <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
              {PARTICLES.map((p, i) => (
                <motion.span key={i} className="absolute rounded-full"
                  style={{ left: `${p.left}%`, top: `${p.top}%`, width: p.size, height: p.size,
                    background: p.violet ? COLORS.violet : COLORS.green, boxShadow: `0 0 ${p.size * 3}px ${p.violet ? COLORS.violet : COLORS.green}` }}
                  animate={{ y: [0, -14, 0], opacity: [0.2, 0.7, 0.2] }}
                  transition={{ duration: p.dur, delay: p.delay, repeat: Infinity, ease: 'easeInOut' }} />
              ))}
            </div>

            <div className="relative z-10 px-7 py-8 flex flex-col items-center text-center">
              {/* Success badge with burst */}
              <div className="relative w-[72px] h-[72px] flex items-center justify-center mb-4">
                {[0, 0.3, 0.6].map((d, i) => (
                  <motion.span key={i} className="absolute rounded-full" style={{ border: `2px solid ${COLORS.green}` }}
                    initial={{ width: 60, height: 60, opacity: 0.5 }} animate={{ width: 130, height: 130, opacity: 0 }}
                    transition={{ duration: 1.5, delay: d, repeat: Infinity, ease: 'easeOut' }} />
                ))}
                {Array.from({ length: 9 }).map((_, i) => {
                  const a = (i / 9) * Math.PI * 2
                  return (
                    <motion.span key={'s' + i} className="absolute w-1.5 h-1.5 rounded-full"
                      style={{ background: i % 2 ? COLORS.green : COLORS.violet, boxShadow: `0 0 8px ${i % 2 ? COLORS.green : COLORS.violet}` }}
                      initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
                      animate={{ x: Math.cos(a) * 52, y: Math.sin(a) * 52, opacity: [0, 1, 0], scale: [0, 1, 0.3] }}
                      transition={{ duration: 0.9, delay: 0.15 + (i % 4) * 0.04, ease: 'easeOut' }} />
                  )
                })}
                <motion.div initial={{ scale: 0, rotate: -160 }} animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 12 }}
                  className="relative w-[72px] h-[72px] rounded-full flex items-center justify-center"
                  style={{ background: `linear-gradient(135deg, ${COLORS.green}45, ${COLORS.green}12)`, boxShadow: `0 0 50px ${COLORS.green}55, inset 0 1px 0 rgba(255,255,255,0.2)` }}>
                  <Check size={38} strokeWidth={3} style={{ color: COLORS.green }} />
                </motion.div>
              </div>

              {/* Title */}
              <h2 className="text-[26px] leading-none font-extrabold tracking-tight"
                style={{ background: `linear-gradient(135deg, ${COLORS.violetLight || COLORS.violet}, ${COLORS.pink || COLORS.violet})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
                Purchase Complete
              </h2>
              <p className="mt-1.5 text-sm font-semibold" style={{ color: COLORS.green }}>Welcome to AHG Steam Unlocker</p>
              <p className="mt-2 text-[13px] leading-relaxed max-w-[300px]" style={{ color: COLORS.textMuted }}>
                Thanks for the support — it's what keeps AHG growing. 💜
              </p>

              {/* Compact stat chips */}
              <div className="grid grid-cols-3 gap-2.5 w-full mt-5">
                {STATS.map((s) => (
                  <div key={s.sub} className="rounded-2xl py-3 px-2 flex flex-col items-center gap-1.5"
                    style={{ background: `${s.color}14`, border: `1px solid ${s.color}2a` }}>
                    <s.icon style={{ color: s.color, width: 22, height: 22 }} />
                    <div className="text-sm font-extrabold leading-none" style={{ color: s.color }}>{s.label}</div>
                    <div className="text-[10px] font-medium" style={{ color: COLORS.textDim }}>{s.sub}</div>
                  </div>
                ))}
              </div>

              <p className="mt-4 text-[10px] tracking-[0.18em] uppercase font-semibold" style={{ color: COLORS.textDim }}>
                Made with <span style={{ color: COLORS.red }}>♥</span> by Safwen
              </p>

              {/* CTA */}
              <motion.button
                onClick={handleClose}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                className="w-full mt-5 h-12 rounded-2xl font-bold text-[15px] text-white flex items-center justify-center gap-2 relative overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${COLORS.violet}, ${COLORS.blue})`, boxShadow: `0 10px 30px ${COLORS.violet}50` }}
              >
                <PartyPopper size={18} />
                <span>Let's Go!</span>
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
})
