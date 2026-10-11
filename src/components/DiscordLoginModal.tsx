import { memo, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { bridge } from '../bridge'
import { COLORS } from '../constants/colors'

interface SecretsDiag {
  loaded: boolean
  hasDiscordClientSecret: boolean
  discordClientSecretLen: number
  keysFound: string
  numKeys: number
  keyInfo: Record<string, { exists: boolean; type: string; len: number }>
  environment: {
    __dirname: string
    cwd: string
    resourcesPath: string
    isPackaged: boolean
    userData: string
  }
}

interface DiscordUser {
  id: string
  username: string
  discriminator?: string
  avatar?: string
  globalName?: string
}

export const DiscordLoginModal = memo(function DiscordLoginModal({ 
  isOpen, 
  onClose,
  onConnected,
  onLogout,
  gameSharingEnabled: initialShareGames,
  onGameSharingChange,
  startupMode,
  onLater,
  onDontShowAgain
}: { 
  isOpen: boolean
  onClose: () => void
  onConnected: (user: any) => void
  onLogout: () => void
  gameSharingEnabled: boolean
  onGameSharingChange: (enabled: boolean) => void
  startupMode?: boolean
  onLater?: () => void
  onDontShowAgain?: () => void
}) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'connected' | 'error'>('idle')
  const [user, setUser] = useState<DiscordUser | null>(null)
  const [isInGuild, setIsInGuild] = useState(false)
  const [shareGames, setShareGames] = useState(initialShareGames)
  const [errorMessage, setErrorMessage] = useState('')
  const [showShareSuccess, setShowShareSuccess] = useState(false)
  const [loadingElapsed, setLoadingElapsed] = useState(0)
  const [showDiagnostics, setShowDiagnostics] = useState(false)
  const [diagnostics, setDiagnostics] = useState<SecretsDiag | null>(null)

  useEffect(() => {
    if (isOpen) {
      checkAuth()
    }
  }, [isOpen])

  // Track loading duration to show helpful hints
  useEffect(() => {
    if (status === 'loading') {
      setLoadingElapsed(0)
      const interval = setInterval(() => {
        setLoadingElapsed(prev => prev + 1)
      }, 1000)
      return () => clearInterval(interval)
    } else {
      setLoadingElapsed(0)
    }
  }, [status])

  useEffect(() => {
    bridge.getGameSharing().then(r => setShareGames(r.enabled)).catch(() => {})
  }, [])

  useEffect(() => {
    setShareGames(initialShareGames)
  }, [initialShareGames])

  async function checkAuth() {
    try {
      const result = await bridge.checkDiscordAuth()
      if (result.authenticated && result.user) {
        setUser(result.user)
        setIsInGuild(result.isInGuild || false)
        setStatus('connected')
      } else {
        setStatus('idle')
      }
    } catch {
      setStatus('idle')
    }
  }

  async function handleLogin() {
    setStatus('loading')
    setErrorMessage('')
    setShowDiagnostics(false)
    setDiagnostics(null)
    try {
      const result = await bridge.discordLogin()
      if (result.success) {
        setUser(result.user)
        setIsInGuild(result.isInGuild || false)
        setStatus('connected')
        onConnected(result.user)
      } else {
        setStatus('error')
        setErrorMessage(result.message || 'Authentication failed')
        // Capture diagnostics from the response or fetch separately
        if ((result as any).diagnostics) {
          setDiagnostics((result as any).diagnostics)
        } else {
          bridge.getSecretsDiag().then(d => setDiagnostics(d)).catch(() => {})
        }
      }
    } catch (e: any) {
      setStatus('error')
      setErrorMessage(e.message || 'Connection failed')
      bridge.getSecretsDiag().then(d => setDiagnostics(d)).catch(() => {})
    }
  }

  async function handleLogout() {
    await bridge.discordLogout()
    setUser(null)
    setStatus('idle')
    setShareGames(false)
    onGameSharingChange(false)
    onLogout()
    onClose()
  }

  async function handleToggleSharing(enabled: boolean) {
    setShareGames(enabled)
    onGameSharingChange(enabled)
    await bridge.setGameSharing(enabled)
    if (enabled) {
      setShowShareSuccess(true)
      setTimeout(() => setShowShareSuccess(false), 3000)
    }
  }

  function getAvatarUrl() {
    if (!user?.avatar) return null
    const ext = user.avatar.startsWith('a_') ? 'gif' : 'png'
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=128`
  }

  if (!isOpen) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(3, 3, 8, 0.85)', backdropFilter: 'blur(12px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, y: 30, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.92, y: 30, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md overflow-hidden rounded-3xl"
        style={{
          background: 'linear-gradient(180deg, rgba(15, 15, 30, 0.95) 0%, rgba(5, 5, 15, 0.98) 100%)',
          border: '1px solid rgba(139, 92, 246, 0.2)',
          boxShadow: `0 0 80px ${COLORS.violetDim}, 0 0 0 1px ${COLORS.violetDim}`,
        }}
      >
        {/* Animated gradient header bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5" style={{
          background: `linear-gradient(90deg, ${COLORS.violet}, ${COLORS.violet}cc, ${COLORS.violet}, ${COLORS.violetLight}, ${COLORS.violet})`,
          backgroundSize: '200% 100%',
          animation: 'shimmer 3s ease-in-out infinite',
        }} />

        {/* Ambient glow */}
        <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full pointer-events-none" style={{
          background: 'radial-gradient(circle, rgba(139, 92, 246, 0.12) 0%, transparent 70%)',
        }} />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 rounded-full pointer-events-none" style={{
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.08) 0%, transparent 70%)',
        }} />

        <div className="relative z-10 p-8">
          {/* Close button */}
          <button onClick={onClose} className="absolute top-5 right-5 w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:bg-white/10" style={{ color: COLORS.textMuted }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>

          <AnimatePresence mode="wait">
            {status === 'idle' && (
              <motion.div key="idle" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="text-center">
                {/* Discord Icon */}
                <div className="mx-auto w-20 h-20 rounded-2xl flex items-center justify-center mb-6" style={{
                  background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(99, 102, 241, 0.2))',
                  boxShadow: '0 0 40px rgba(139, 92, 246, 0.2)',
                }}>
                  <svg width="40" height="40" viewBox="0 0 127.14 96.36" fill={COLORS.violet}>
                    <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/>
                  </svg>
                </div>

                <h2 className="text-3xl font-bold mb-2" style={{ color: COLORS.violetLight }}>
                  Unlock Premium Access
                </h2>
                <p className="text-sm mb-6" style={{ color: COLORS.textSecondary }}>
                  Connect with Discord to unlock premium manifest sources,<br />
                  share your game collection, and get early access features.
                </p>

                <div className="space-y-3 mb-8">
                  {[
                    { icon: '\u{1F513}', text: 'Unlock Morrenus & premium manifest sources' },
                    { icon: '\u{1F4CA}', text: 'Share your installed games with the community' },
                    { icon: '\u26A1', text: 'Faster downloads with authenticated mirrors' },
                    { icon: '\u{1F3AE}', text: 'Join the AHG Discord community' },
                  ].map((item, i) => (
                    <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.05 }}
                      className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <span className="text-lg">{item.icon}</span>
                      <span className="text-sm" style={{ color: COLORS.textDim }}>{item.text}</span>
                    </motion.div>
                  ))}
                </div>

                <button
                  onClick={handleLogin}
                  className="w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-3 relative overflow-hidden hv-tap"
                  style={{
                    background: 'linear-gradient(135deg, #5865F2, #4752C4)', // Discord brand color - intentional
                    color: COLORS.white,
                    boxShadow: '0 4px 24px rgba(88, 101, 242, 0.4)',
                  }}
                >
                  <svg width="22" height="22" viewBox="0 0 127.14 96.36" fill="white">
                    <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/>
                  </svg>
                  Connect with Discord
                </button>

                {startupMode && (
                  <div className="flex gap-3 mt-3">
                    <button
                      onClick={onLater}
                      className="flex-1 py-3 rounded-xl font-medium text-sm hv-tap"
                      style={{ background: 'rgba(100, 116, 139, 0.15)', color: COLORS.textSecondary, border: '1px solid rgba(100, 116, 139, 0.2)' }}
                    >
                      Remind me later
                    </button>
                    <button
                      onClick={onDontShowAgain}
                      className="flex-1 py-3 rounded-xl font-medium text-sm hv-tap"
                      style={{ background: 'rgba(100, 116, 139, 0.08)', color: COLORS.textMuted, border: '1px solid rgba(100, 116, 139, 0.1)' }}
                    >
                      Don't show again
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            {status === 'loading' && (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-12">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-6" style={{
                    border: '2px solid rgba(139, 92, 246, 0.2)',
                    borderTopColor: COLORS.violet,
                  }}>
                  <svg width="32" height="32" viewBox="0 0 127.14 96.36" fill={COLORS.violet}>
                    <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/>
                  </svg>
                </motion.div>
                <h3 className="text-xl font-bold mb-2" style={{ color: COLORS.text }}>Connecting...</h3>
                <p className="text-sm mb-2" style={{ color: COLORS.textSecondary }}>Waiting for Discord authorization in your browser.</p>
                {loadingElapsed > 30 && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="text-xs px-4 py-2 rounded-xl inline-block mx-auto"
                    style={{ background: COLORS.amberDim, color: COLORS.amber, border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                    Still waiting? Make sure the Discord authorization page opened in your browser.
                    If the page is blocked, check for pop-up blockers.
                  </motion.p>
                )}
              </motion.div>
            )}

            {status === 'connected' && user && (
              <motion.div key="connected" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="text-center">
                {/* Success check */}
                <div className="mx-auto w-20 h-20 rounded-2xl flex items-center justify-center mb-6" style={{
                  background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(34, 197, 94, 0.1))',
                  boxShadow: `0 0 40px ${COLORS.greenDim}`,
                }}>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={COLORS.green} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                </div>

                {/* User avatar */}
                <div className="relative mx-auto w-16 h-16 rounded-full overflow-hidden mb-4" style={{
                  border: `2px solid ${COLORS.violetGlow}`,
                  boxShadow: '0 0 30px rgba(139, 92, 246, 0.2)',
                }}>
                  {getAvatarUrl() ? (
                    <img src={getAvatarUrl()!} alt={user.username} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center" style={{ background: '#5865F2' }}> {/* Discord brand color - intentional */}
                      <span className="text-white font-bold text-lg">{user.username[0]!.toUpperCase()}</span>
                    </div>
                  )}
                  <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full border-2 border-[${COLORS.bgDeep}]" style={{ background: COLORS.green }} />
                </div>

                <h2 className="text-2xl font-bold mb-1" style={{ color: COLORS.text }}>
                  Welcome, {user.globalName || user.username}
                </h2>
                <p className="text-sm mb-1" style={{ color: COLORS.textSecondary }}>
                  {user.username}{user.discriminator && user.discriminator !== '0' ? '#' + user.discriminator : ''}
                </p>
                {isInGuild ? (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium mb-6" style={{ background: COLORS.greenDim, color: COLORS.green, border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    Connected to AHG Discord
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium mb-6" style={{ background: COLORS.amberDim, color: COLORS.amber, border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Join AHG Discord for full features
                  </div>
                )}

                {/* Game sharing toggle */}
                <div className="p-5 rounded-2xl mb-6 text-left" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${COLORS.whiteGlassBorder}` }}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-semibold" style={{ color: COLORS.text }}>Share Game Additions</p>
                      <p className="text-xs mt-0.5" style={{ color: COLORS.textSecondary }}>Post to AHG Discord when you add a game</p>
                    </div>
                    <button
                      onClick={() => handleToggleSharing(!shareGames)}
                      className="relative w-12 h-7 rounded-full transition-all"
                      style={{
                        background: shareGames ? `linear-gradient(135deg, ${COLORS.violet}, ${COLORS.violet}cc)` : 'rgba(255,255,255,0.1)',
                        boxShadow: shareGames ? '0 0 12px rgba(139, 92, 246, 0.3)' : 'none',
                      }}
                    >
                      <motion.div
                        animate={{ x: shareGames ? 20 : 2 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        className="absolute top-1 w-5 h-5 rounded-full bg-white"
                        style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}
                      />
                    </button>
                  </div>
                  <AnimatePresence>
                    {showShareSuccess && (
                      <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                        className="text-xs mt-2" style={{ color: COLORS.green }}>
                        Game sharing enabled! Your additions will appear in the AHG Discord.
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                {/* Disconnect */}
                <button
                  onClick={handleLogout}
                  className="w-full py-3 rounded-xl text-sm font-medium transition-all hv-tap"
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    color: COLORS.red,
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                  }}
                >
                  Disconnect Discord
                </button>
              </motion.div>
            )}

            {status === 'error' && (
              <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-4">
                <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: COLORS.redDim }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={COLORS.red} strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                </div>
                <h3 className="text-lg font-bold mb-2" style={{ color: COLORS.red }}>Connection Failed</h3>
                <p className="text-sm mb-4 px-2" style={{ color: COLORS.textSecondary }}>{errorMessage || 'Unable to connect to Discord.'}</p>

                {/* Diagnostics toggle */}
                {diagnostics && (
                  <>
                    <button
                      onClick={() => setShowDiagnostics(!showDiagnostics)}
                      className="text-xs mb-3 px-4 py-2 rounded-lg inline-flex items-center gap-1.5 hv-tap"
                      style={{ background: 'rgba(100, 116, 139, 0.15)', color: COLORS.textSecondary, border: '1px solid rgba(100, 116, 139, 0.2)' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20V10M18 20V4M6 20v-4"/></svg>
                      {showDiagnostics ? 'Hide Diagnostics' : 'Show Diagnostics'}
                    </button>

                    {showDiagnostics && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                        className="text-left mb-4 p-4 rounded-xl text-xs font-mono overflow-auto max-h-48"
                        style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${COLORS.whiteGlassBorder}`, color: COLORS.textDim }}>
                        <div className="mb-2"><span style={{ color: COLORS.textMuted }}>Secrets loaded:</span> {diagnostics.loaded ? '✅' : '❌'}</div>
                        {diagnostics.environment && (
                          <>
                            <div className="mt-2 pt-2" style={{ borderTop: `1px solid ${COLORS.whiteGlassBorder}` }}>
                              <div className="mb-1" style={{ color: COLORS.textMuted }}>Environment:</div>
                              <div><span style={{ color: COLORS.textMuted }}>isPackaged:</span> {String(diagnostics.environment.isPackaged)}</div>
                              <div><span style={{ color: COLORS.textMuted }}>userData:</span> {diagnostics.environment.userData}</div>
                            </div>
                          </>
                        )}
                      </motion.div>
                    )}
                  </>
                )}

                {/* Action buttons */}
                <div className="flex gap-3 justify-center mb-2">
                  <button
                    onClick={() => setStatus('idle')}
                    className="px-6 py-3 rounded-xl font-medium text-sm hv-tap"
                    style={{ background: COLORS.violetDim, color: COLORS.violet, border: '1px solid rgba(139, 92, 246, 0.3)' }}>
                    Try Again
                  </button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>

      <style>{`
        @keyframes shimmer {
          0%, 100% { background-position: 0% 0%; }
          50% { background-position: 200% 0%; }
        }
        .hv-tap {
          transition: transform 80ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 80ms cubic-bezier(0.4, 0, 0.2, 1);
        }
        .hv-tap:hover {
          transform: scale(1.02);
        }
        .hv-tap:active {
          transform: scale(0.98);
        }
      `}</style>
    </motion.div>
  )
})
