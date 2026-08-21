import { memo, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { COLORS } from '../../constants/colors'

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  showCloseButton?: boolean
}

const sizeWidths: Record<NonNullable<ModalProps['size']>, string> = {
  sm: '384px',
  md: '512px',
  lg: '672px',
  xl: '896px',
  full: '100%',
}

export const Modal = memo(function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
}: ModalProps) {
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose]
  )

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [isOpen, handleEscape])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9998,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            background: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
          }}
          onClick={onClose}
        >
          <motion.div
            key="modal-content"
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? 'modal-title' : undefined}
            aria-label={title ? undefined : 'Dialog'}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            style={{
              width: '100%',
              maxWidth: sizeWidths[size],
              maxHeight: 'calc(100vh - 48px)',
              background: COLORS.bgCard,
              border: `1px solid ${COLORS.border}`,
              borderRadius: '1rem',
              boxShadow: `0 24px 80px rgba(0,0,0,0.5)`,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            {(title || showCloseButton) && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px 20px',
                  borderBottom: title ? `1px solid ${COLORS.border}` : 'none',
                  flexShrink: 0,
                }}
              >
                {title && (
                  <h2
                    id="modal-title"
                    style={{
                      fontSize: '18px',
                      fontWeight: 700,
                      color: COLORS.text,
                      margin: 0,
                      lineHeight: 1.3,
                    }}
                  >
                    {title}
                  </h2>
                )}
                {showCloseButton && (
                  <button
                    onClick={onClose}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '32px',
                      height: '32px',
                      borderRadius: '0.5rem',
                      border: 'none',
                      background: 'transparent',
                      color: COLORS.textMuted,
                      cursor: 'pointer',
                      transition: 'all 80ms cubic-bezier(0.4, 0, 0.2, 1)',
                      marginLeft: 'auto',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = COLORS.bgHover
                      e.currentTarget.style.color = COLORS.text
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.color = COLORS.textMuted
                    }}
                    aria-label="Close modal"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
            )}

            {/* Body */}
            <div
              style={{
                padding: '20px',
                overflowY: 'auto',
                flex: 1,
              }}
            >
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
})
