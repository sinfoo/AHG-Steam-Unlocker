import { memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, AlertCircle, Heart, Info, Trophy, X } from 'lucide-react'
import type { ColorScheme } from './shared'
import { useUIStore } from '../store'
import { useT } from '../i18n'

interface ToastContainerProps {
  colors: ColorScheme
}

export const ToastContainer = memo(function ToastContainer({ colors: COLORS }: ToastContainerProps) {
  const t = useT()
  const toasts = useUIStore(s => s.toasts)
  const setToasts = useUIStore(s => s.setToasts)

  const meta = (type: string) => {
    switch (type) {
      case 'achievement': return { c: COLORS.amber, title: t('ui.toast.achievement'), Icon: Trophy }
      case 'success': return { c: COLORS.green, title: t('ui.toast.success'), Icon: CheckCircle2 }
      case 'error': return { c: COLORS.red, title: t('ui.toast.error'), Icon: AlertCircle }
      case 'favorites': return { c: COLORS.red, title: t('ui.toast.favorites'), Icon: Heart }
      default: return { c: 'var(--acc, #a77dff)', title: t('ui.toast.info'), Icon: Info }
    }
  }

  return (
    <div
      className="fixed bottom-6 end-6 z-[120] flex-col-reverse gap-2.5 hidden md:flex pointer-events-none"
      aria-live="polite"
      aria-atomic="false"
    >
      <AnimatePresence>
        {toasts.map((toast) => {
          const { c, title, Icon } = meta(toast.type)
          return (
            <motion.div
              key={toast.id}
              role={toast.type === 'error' ? 'alert' : 'status'}
              initial={false}
              exit={{ x: 60, opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
              className="pointer-events-auto relative flex items-start gap-3 overflow-hidden cursor-pointer"
              style={{
                width: 340, maxWidth: 'calc(100vw - 48px)',
                padding: '14px 14px 16px',
                borderRadius: 16,
                background: 'rgba(22,22,37,.96)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,.09)',
                boxShadow: '0 24px 50px -16px rgba(0,0,0,.9)',
                animation: 'v2-slideInR .6s cubic-bezier(.16,1,.3,1) both',
              }}
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
            >
              <span
                className="flex items-center justify-center shrink-0"
                style={{ width: 32, height: 32, borderRadius: 10, background: `color-mix(in oklch, ${c} 16%, transparent)`, color: c }}
              >
                <Icon size={16} fill={toast.type === 'favorites' ? 'currentColor' : 'none'} />
              </span>
              <div className="flex-1 min-w-0">
                <div style={{ fontSize: 13.5, fontWeight: 600, color: '#f3f2fa' }}>{title}</div>
                <div style={{ fontSize: 12.5, color: '#a6a5bb', marginTop: 2, lineHeight: 1.4 }}>{toast.message}</div>
              </div>
              <X size={14} style={{ color: '#77768e', marginTop: 2 }} aria-hidden />
              <span
                className="absolute start-0 end-0 bottom-0"
                style={{ height: 2, background: c, transformOrigin: 'left', animation: 'v2-shrink 4s linear both' }}
              />
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
})
