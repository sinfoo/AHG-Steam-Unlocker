import { memo, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { WifiOff, AlertTriangle, RefreshCw, Globe } from 'lucide-react'
import { COLORS } from '../constants/colors'

const redGlow = 'rgba(239, 68, 68, 0.3)'

export const NoInternetModal = memo(function NoInternetModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const api = (window as any).electronAPI
        if (api?.checkConnectivity) {
          const online = await api.checkConnectivity()
          if (!online) setIsOpen(true)
        }
      } catch {
        setIsOpen(true)
      }
    }
    checkConnection()
  }, [])

  const handleRetry = async () => {
    setChecking(true)
    try {
      const api = (window as any).electronAPI
      if (api?.checkConnectivity) {
        const online = await api.checkConnectivity()
        if (online) setIsOpen(false)
      }
    } catch {
      // Still no connection
    } finally {
      setChecking(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[999] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(30px)' }}
        >
          <motion.div
            initial={{ scale: 0.85, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.85, y: 30, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="w-full max-w-md rounded-3xl overflow-hidden"
            style={{
              background: COLORS.bgCard,
              border: `1px solid ${COLORS.red}40`,
              boxShadow: `0 32px 100px rgba(0,0,0,0.6), 0 0 80px ${redGlow}`
            }}
          >
            <div className="h-1.5" style={{
              background: `linear-gradient(90deg, ${COLORS.red}, ${COLORS.amber}, ${COLORS.red})`,
              backgroundSize: '200% 100%',
              animation: 'shimmer 2s linear infinite'
            }} />
            <div className="p-8 text-center">
              <motion.div
                animate={{ y: [-4, 4, -4] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                className="w-24 h-24 mx-auto mb-6 rounded-3xl flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${COLORS.red}30, ${COLORS.red}10)`,
                  border: `2px solid ${COLORS.red}50`,
                  boxShadow: `0 0 50px ${COLORS.red}30`
                }}
              >
                <WifiOff size={44} style={{ color: COLORS.red }} />
              </motion.div>

              <h2 className="text-2xl font-bold text-white mb-2">No Internet Connection</h2>
              <p className="text-sm mb-8" style={{ color: COLORS.textMuted }}>
                AHG Steam Unlocker requires an active internet connection to fetch game data, fixes, and communicate with Steam services.
              </p>

              <div className="p-4 rounded-2xl mb-8 text-left" style={{ background: COLORS.bgHover, border: `1px solid ${COLORS.border}` }}>
                <div className="flex items-start gap-3">
                  <AlertTriangle size={18} style={{ color: COLORS.amber }} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: COLORS.text }}>Please check:</p>
                    <ul className="mt-2 space-y-1.5">
                      {['Your Wi-Fi or Ethernet connection', 'Firewall settings (allow AHG through)', 'Steam servers status (store.steampowered.com)'].map((item, i) => (
                        <li key={i} className="text-xs flex items-center gap-2" style={{ color: COLORS.textMuted }}>
                          <span className="w-1 h-1 rounded-full" style={{ background: COLORS.red }} />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleRetry}
                  disabled={checking}
                  className="w-full py-4 rounded-2xl font-bold text-white text-base flex items-center justify-center gap-3 cursor-pointer"
                  style={{
                    background: checking
                      ? `${COLORS.violet}80`
                      : `linear-gradient(135deg, ${COLORS.violet}, ${COLORS.purple})`, // intentional gradient variation
                    boxShadow: `0 8px 32px ${COLORS.violet}40`
                  }}
                >
                  {checking ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                      <RefreshCw size={18} />
                    </motion.div>
                  ) : (
                    <Globe size={18} />
                  )}
                  {checking ? 'Checking...' : 'Retry Connection'}
                </motion.button>

                <p className="text-xs" style={{ color: COLORS.textMuted }}>
                  The app will retry automatically every 30 seconds
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
})
