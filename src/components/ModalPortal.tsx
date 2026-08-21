import { memo, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { COLORS } from '../constants/colors'

interface ModalPortalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  icon?: ReactNode
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
  actions?: ReactNode
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
} as const

export const ModalPortal = memo(function ModalPortal({
  isOpen,
  onClose,
  title,
  icon,
  children,
  size = 'md',
  actions,
}: ModalPortalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.08, ease: [0.4, 0, 0.2, 1] }}
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className={`w-full mx-4 rounded-2xl overflow-hidden ${sizeClasses[size]}`}
            style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}` }}
            onClick={(e) => e.stopPropagation()}
          >
            {title && (
              <div className="p-5 pb-0 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {icon && (
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: `${COLORS.violet}20` }}
                    >
                      {icon}
                    </div>
                  )}
                  <h3 className="text-lg font-bold" style={{ color: COLORS.text }}>
                    {title}
                  </h3>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: COLORS.bgMid }}
                >
                  <X size={14} style={{ color: COLORS.textMuted }} />
                </button>
              </div>
            )}
            <div className="p-5">{children}</div>
            {actions && (
              <div className="px-5 pb-5 flex justify-end gap-3">{actions}</div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
})
