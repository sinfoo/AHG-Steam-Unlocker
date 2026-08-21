import { memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, AlertCircle, Heart, Info, Trophy, X } from 'lucide-react'
import type { ColorScheme } from './shared'
import { useUIStore } from '../store'

interface ToastContainerProps {
  colors: ColorScheme
}

export const ToastContainer = memo(function ToastContainer({ colors: COLORS }: ToastContainerProps) {
  const toasts = useUIStore(s => s.toasts)
  const setToasts = useUIStore(s => s.setToasts)

  return (
    <div className="fixed bottom-6 right-6 z-50 flex-col gap-3 max-w-md hidden md:flex" aria-live="polite" aria-atomic="false">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            role={toast.type === 'error' ? 'alert' : 'status'}
            initial={{ x: 80, opacity: 0, scale: 0.85, y: 10 }} 
            animate={{ x: 0, opacity: 1, scale: 1, y: 0 }} 
            exit={{ x: 80, opacity: 0, scale: 0.85, y: -10 }} 
            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
            className="px-6 py-4 rounded-2xl flex items-center gap-3 cursor-pointer relative overflow-hidden"
            style={{ 
              background: toast.type === 'achievement' ? COLORS.amber + '25' : toast.type === 'success' ? COLORS.greenDim : toast.type === 'error' ? COLORS.redDim : toast.type === 'favorites' ? COLORS.redDim : COLORS.violetDim, 
              border: `1px solid ${toast.type === 'achievement' ? COLORS.amber : toast.type === 'success' ? COLORS.green : toast.type === 'error' ? COLORS.red : toast.type === 'favorites' ? COLORS.red : COLORS.violet}`,
              boxShadow: toast.type === 'achievement' ? `0 10px 40px ${COLORS.amber}40, 0 0 60px ${COLORS.amber}20` : `0 10px 40px ${toast.type === 'success' ? COLORS.greenDim : toast.type === 'error' ? COLORS.redDim : COLORS.violetDim}`
            }}
            onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
          >
            {/* Animated background */}
            <motion.div 
              className="absolute inset-0 opacity-20"
              style={{ 
                background: `linear-gradient(90deg, transparent, ${toast.type === 'achievement' ? COLORS.amber : toast.type === 'success' ? COLORS.green : toast.type === 'error' ? COLORS.red : COLORS.violet}, transparent)`
              }}
              animate={{ x: ['-100%', '100%'] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            {/* Achievement sparkle overlay */}
            {toast.type === 'achievement' && (
              <motion.div 
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: `radial-gradient(circle at 50% 50%, ${COLORS.amber}20 0%, transparent 70%)`,
                }}
                animate={{ scale: [1, 1.05, 1], opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            )}
            {/* Auto-dismiss progress bar */}
            <motion.div
              className="absolute bottom-0 left-0 h-0.5 rounded-full"
              style={{
                background: toast.type === 'achievement' ? COLORS.amber : toast.type === 'success' ? COLORS.green : toast.type === 'error' ? COLORS.red : COLORS.violet,
              }}
              initial={{ width: '100%', opacity: 0.6 }}
              animate={{ width: '0%', opacity: 0 }}
              transition={{ duration: 4, ease: 'linear' }}
            />
            {toast.type === 'achievement' && <Trophy size={22} style={{ color: COLORS.amber }} />}
            {toast.type === 'success' && <CheckCircle2 size={22} style={{ color: COLORS.green }} />}
            {toast.type === 'error' && <AlertCircle size={22} style={{ color: COLORS.red }} />}
            {toast.type === 'favorites' && <Heart size={22} style={{ color: COLORS.red }} fill="currentColor" />}
            {toast.type === 'info' && <Info size={22} style={{ color: COLORS.violet }} />}
            <p className="font-semibold text-white flex-1">{toast.message}</p>
            <X size={16} style={{ color: 'rgba(255,255,255,0.5)' }} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
})
