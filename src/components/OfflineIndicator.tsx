import { memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { WifiOff, X } from 'lucide-react'
import { DARK_COLORS } from '../constants/colors'
import { useNetworkStatus } from '../hooks/useNetworkStatus'

type OfflineIndicatorProps = {
  collapsed?: boolean
}

const OfflineIndicator = memo(function OfflineIndicator({ collapsed }: OfflineIndicatorProps) {
  const { isOnline, wasOffline, acknowledge } = useNetworkStatus()
  const show = !isOnline || wasOffline

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ height: 0, opacity: 0, marginBottom: 0 }}
          animate={{ height: 'auto', opacity: 1, marginBottom: 8 }}
          exit={{ height: 0, opacity: 0, marginBottom: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="overflow-hidden"
        >
          {collapsed ? (
            /* Collapsed sidebar: small dot indicator */
            <div className="flex justify-center py-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: DARK_COLORS.amber, boxShadow: `0 0 8px ${DARK_COLORS.amber}` }}
                title="Offline"
              />
            </div>
          ) : (
            /* Expanded sidebar: full warning pill */
            <div
              className="mx-3 rounded-xl flex items-center gap-2.5 px-3 py-2.5 relative overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${DARK_COLORS.amberDim} 0%, transparent 100%)`,
                border: `1px solid ${DARK_COLORS.amber}40`,
              }}
            >
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: `radial-gradient(120% 100% at 50% 0%, ${DARK_COLORS.amber}20 0%, transparent 70%)`,
                }}
              />
              <WifiOff size={14} style={{ color: DARK_COLORS.amber, position: 'relative', zIndex: 1 }} />
              <span
                className="text-xs font-semibold flex-1 relative z-1"
                style={{ color: DARK_COLORS.amber }}
              >
                {isOnline ? 'Back Online' : 'Offline'}
              </span>
              <button
                onClick={acknowledge}
                className="w-5 h-5 rounded-md flex items-center justify-center cursor-pointer hover:brightness-125 tap-scale"
                style={{
                  background: `${DARK_COLORS.amber}20`,
                  color: DARK_COLORS.textMuted,
                  transition: 'all 80ms cubic-bezier(0.4, 0, 0.2, 1)',
                }}
                title="Dismiss"
              >
                <X size={11} />
              </button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
})

OfflineIndicator.displayName = 'OfflineIndicator'

export { OfflineIndicator }
