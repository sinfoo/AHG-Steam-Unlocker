import { memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { COLORS } from '../constants/colors'

interface DiscordUser {
  id: string
  username: string
  discriminator?: string
  avatar?: string
  globalName?: string
}

export const DiscordSuccessModal = memo(function DiscordSuccessModal({
  isOpen,
  onClose,
  user,
}: {
  isOpen: boolean
  onClose: () => void
  user: DiscordUser | null
}) {
  if (!isOpen || !user) return null

  function getAvatarUrl() {
    if (!user?.avatar) return null
    const ext = user.avatar.startsWith('a_') ? 'gif' : 'png'
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=128`
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background: 'rgba(3, 3, 8, 0.85)', backdropFilter: 'blur(16px)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.88, y: 40, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.88, y: 40, opacity: 0 }}
            transition={{ type: 'spring', damping: 22, stiffness: 280, delay: 0.05 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm overflow-hidden rounded-3xl"
            style={{
              background: 'linear-gradient(180deg, rgba(15, 15, 30, 0.97) 0%, rgba(5, 5, 15, 0.99) 100%)',
              border: '1px solid rgba(34, 197, 94, 0.2)',
              boxShadow: `0 0 100px rgba(34, 197, 94, 0.12), 0 0 0 1px rgba(34, 197, 94, 0.08)`,
            }}
          >
            {/* Animated success gradient bar */}
            <div className="absolute top-0 left-0 right-0 h-1.5" style={{
              background: `linear-gradient(90deg, ${COLORS.green}, ${COLORS.green}cc, ${COLORS.green}, ${COLORS.green}99, ${COLORS.green})`,
              backgroundSize: '200% 100%',
              animation: 'shimmerSuccess 3s ease-in-out infinite',
            }} />

            {/* Ambient green glow */}
            <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full pointer-events-none" style={{
              background: 'radial-gradient(circle, rgba(34, 197, 94, 0.1) 0%, transparent 70%)',
            }} />
            <div className="absolute -bottom-20 -left-20 w-60 h-60 rounded-full pointer-events-none" style={{
              background: 'radial-gradient(circle, rgba(74, 222, 128, 0.07) 0%, transparent 70%)',
            }} />

            <div className="relative z-10 p-10 text-center">
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-5 right-5 w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:bg-white/10"
                style={{ color: COLORS.textMuted }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>

              {/* Big success check */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', damping: 15, stiffness: 250, delay: 0.15 }}
                className="mx-auto w-24 h-24 rounded-full flex items-center justify-center mb-6"
                style={{
                  background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(34, 197, 94, 0.08))',
                  boxShadow: '0 0 60px rgba(34, 197, 94, 0.2), inset 0 0 30px rgba(34, 197, 94, 0.05)',
                }}
              >
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke={COLORS.green} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <motion.path
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.6, delay: 0.4, ease: 'easeInOut' }}
                    d="M20 6L9 17l-5-5"
                  />
                </svg>
              </motion.div>

              {/* Premium "Connected" text */}
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="text-3xl font-extrabold mb-1"
                style={{ color: COLORS.green }}
              >
                Connected!
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 }}
                className="text-base mb-8"
                style={{ color: COLORS.textSecondary }}
              >
                Your Discord account has been linked successfully.
              </motion.p>

              {/* User avatar + name */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 }}
                className="flex items-center gap-4 p-4 rounded-2xl mb-8"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <div className="relative shrink-0 w-14 h-14 rounded-full overflow-hidden" style={{
                  border: `2px solid ${COLORS.green}`,
                  boxShadow: '0 0 20px rgba(34, 197, 94, 0.2)',
                }}>
                  {getAvatarUrl() ? (
                    <img src={getAvatarUrl()!} alt={user.username} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center" style={{ background: '#5865F2' }}> {/* Discord brand color - intentional */}
                      <span className="text-white font-bold text-xl">{user.username[0]!.toUpperCase()}</span>
                    </div>
                  )}
                  <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full border-2 border-[${COLORS.bgDeep}]" style={{ background: COLORS.green }} />
                </div>
                <div className="text-left min-w-0">
                  <p className="font-bold text-base truncate" style={{ color: COLORS.text }}>
                    {user.globalName || user.username}
                  </p>
                  <p className="text-xs truncate" style={{ color: COLORS.textMuted }}>
                    @{user.username}{user.discriminator && user.discriminator !== '0' ? '#' + user.discriminator : ''}
                  </p>
                </div>
                <div className="ml-auto shrink-0">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium" style={{
                    background: 'rgba(34, 197, 94, 0.12)',
                    color: COLORS.green,
                    border: '1px solid rgba(34, 197, 94, 0.25)',
                  }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: COLORS.green }} />
                    Linked
                  </div>
                </div>
              </motion.div>

              {/* Continue button */}
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.65 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onClose}
                className="w-full py-4 rounded-2xl font-bold text-base transition-all"
                style={{
                  background: `linear-gradient(135deg, ${COLORS.greenDim}, rgba(34, 197, 94, 0.08))`,
                  color: COLORS.green,
                  border: '1px solid rgba(34, 197, 94, 0.25)',
                  boxShadow: '0 0 30px rgba(34, 197, 94, 0.08)',
                }}
              >
                Continue
              </motion.button>
            </div>
          </motion.div>

          <style>{`
            @keyframes shimmerSuccess {
              0%, 100% { background-position: 0% 0%; }
              50% { background-position: 200% 0%; }
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  )
})
