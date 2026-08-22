import { memo, Suspense, lazy } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DARK_COLORS } from '../constants/colors'
import { RefreshCw, AlertTriangle, CheckCircle2, MessageCircle } from 'lucide-react'

// ── Internal store reads — prevents App.tsx from subscribing to modal state ──
import { useAppInstallState, useAppUIState, useAppSettingsState, useAppUserState, useAppGameState, useAppDiscordState } from '../hooks/useAppState'
import type { AppInstallRenderState, AppUIRenderState, AppSettingsRenderState, AppUserRenderState, AppGameRenderState } from '../hooks/useAppState'
import { useAppSetters } from '../hooks/useAppSetters'

// ── Lazy imports (same pattern as App.tsx) ──
const UpdateModal = lazy(() => import('./UpdateModal').then(m => ({ default: m.UpdateModal })))
const ChangelogModal = lazy(() => import('./ChangelogModal').then(m => ({ default: m.ChangelogModal })))
const ActivationModal = lazy(() => import('./ActivationModal').then(m => ({ default: m.ActivationModal })))
const ThankYouModal = lazy(() => import('./ThankYouModal').then(m => ({ default: m.ThankYouModal })))
const GameInstallModal = lazy(() => import('./GameInstallModal').then(m => ({ default: m.GameInstallModal })))
const FixExtractModal = lazy(() => import('./FixExtractModal').then(m => ({ default: m.FixExtractModal })))
const NoInternetModal = lazy(() => import('./NoInternetModal').then(m => ({ default: m.NoInternetModal })))
const DiscordLoginModal = lazy(() => import('./DiscordLoginModal').then(m => ({ default: m.DiscordLoginModal })))
const DiscordSuccessModal = lazy(() => import('./DiscordSuccessModal').then(m => ({ default: m.DiscordSuccessModal })))
const ToastContainer = lazy(() => import('./ToastContainer').then(m => ({ default: m.ToastContainer })))
const DownloadProgressModal = lazy(() => import('./DownloadProgressModal').then(m => ({ default: m.DownloadProgressModal })))
const AchievementsModal = lazy(() => import('./AchievementsModal').then(m => ({ default: m.AchievementsModal })))
const FixGamesModal = lazy(() => import('./FixGamesModal').then(m => ({ default: m.FixGamesModal })))
const ScanGamesModal = lazy(() => import('./ScanGamesModal').then(m => ({ default: m.ScanGamesModal })))
const ContextMenu = lazy(() => import('./ContextMenu').then(m => ({ default: m.ContextMenu })))
const PortalGameModal = lazy(() => import('./PortalGameModal').then(m => ({ default: m.PortalGameModal })))
const DownloadQueuePanel = lazy(() => import('./DownloadQueuePanel').then(m => ({ default: m.DownloadQueuePanel })))
const GameActionModal = lazy(() => import('./GameActionModal').then(m => ({ default: m.GameActionModal })))
const DLCManager = lazy(() => import('./DLCManager').then(m => ({ default: m.DLCManager })))

// ── Props: only local state + action callbacks.
// Store-based state (install, discord, UI) is read internally via useApp*State hooks.
// This prevents App.tsx from re-rendering on every install progress / modal toggle.
export interface ModalRendererProps {
  COLORS: typeof DARK_COLORS

  // Local state (not in Zustand stores)
  startupDiscordModal: boolean
  discordSuccessOpen: boolean
  gameActionModalOpen: boolean
  gameActionModalGame: any
  dlcManagerOpen: boolean
  dlcManagerGame: any

  // Local data
  achievements: any[]
  setAchievements: (v: any) => void

  // Local state setters
  setStartupDiscordModal: (v: boolean) => void
  setDiscordSuccessOpen: (v: boolean) => void
  setGameActionModalOpen: (v: boolean) => void
  setDlcManagerOpen: (v: boolean) => void
  setDlcManagerGame: (v: any) => void

  // Action callbacks (complex cross-store logic, must stay in App.tsx)
  handleInstallGame: (gameOverride?: any) => Promise<void>
  handleInstallFromZip: (gameOverride?: any) => Promise<void>
  handleGoToBrowse: () => void
  handleGoToFixes: () => void
  runFixGames: () => Promise<void>
  startScanGames: () => Promise<void>
  reloadGamesList: () => Promise<void>
  contextMenuInstall: (game: any) => Promise<void>
  contextMenuOpenSteam: (game: any) => void
  contextMenuToggleFavorite: (game: any) => void
  addToDownloadQueue: (game: any) => void
  contextMenuShareCard: (game: any) => void
  contextMenuCopyAppId: (game: any) => void
  contextMenuRemoveGame: (game: any) => Promise<void>
  openPortalModal: (game: any) => Promise<void>
  processDownloadQueue: () => Promise<void>
  removeFromDownloadQueue: (appid: string) => void
  cancelDownload: () => void
  restartSteam: () => void

  // Utils
  showToast: (msg: string, type: string) => void
  bridge: any
}

const ModalRenderer = memo(function ModalRenderer({ modalProps }: { modalProps: ModalRendererProps }) {
  // ── Read store-based state internally (not from App.tsx) ──
  const install: AppInstallRenderState = useAppInstallState()
  const ui: AppUIRenderState = useAppUIState()
  const settings: AppSettingsRenderState = useAppSettingsState()
  const user: AppUserRenderState = useAppUserState()
  const game: AppGameRenderState = useAppGameState()
  const discordStore = useAppDiscordState()
  const setters = useAppSetters()

  const {
    // Install modal
    installModalOpen, installStatus, installProgress, installGameInfo,
    extractModalOpen, extractFileName, extractFilePath,
    fixGamesScriptModalOpen, fixGamesScriptStatus, fixGamesScriptProgress, fixGamesScriptOutput, fixGamesContactOpen,
    dlcCount, installedDlcs,
  } = install
  const {
    updateModalOpen, changelogOpen, changelogVersion, activationOpen, thankYouOpen,
  } = ui
  const {
    gameSharingEnabled,
  } = settings
  const {
    logs,
  } = user
  const {
    installedGames,
  } = game
  const {
    discordModalOpen, discordUser,
  } = discordStore
  const {
    setInstallModalOpen, setDiscordModalOpen,
    setDiscordConnected, setDiscordUser, setGameSharingEnabled,
    setUpdateModalOpen, setChangelogOpen,
    setIsActivated, setActivationOpen, setThankYouOpen,
    setExtractModalOpen,
    setFixGamesScriptModalOpen, setFixGamesScriptStatus,
    setFixGamesScriptOutput, setFixGamesScriptProgress, setFixGamesContactOpen,
  } = setters

  // ── Props destructuring (local state + callbacks only) ──
  const {
    COLORS,
    // Local state
    startupDiscordModal, discordSuccessOpen,
    gameActionModalOpen, gameActionModalGame,
    dlcManagerOpen, dlcManagerGame,
    // Local data
    achievements,
    // Local setters
    setStartupDiscordModal, setDiscordSuccessOpen,
    setGameActionModalOpen, setDlcManagerOpen, setDlcManagerGame,
    // Callbacks
    handleInstallGame, handleInstallFromZip,
    runFixGames, startScanGames, reloadGamesList,
    contextMenuInstall, contextMenuOpenSteam, contextMenuToggleFavorite,
    addToDownloadQueue, contextMenuShareCard, contextMenuCopyAppId,
    contextMenuRemoveGame, openPortalModal,
    processDownloadQueue, removeFromDownloadQueue,
    cancelDownload, restartSteam,
    showToast, bridge,
  } = modalProps

  const currentVersion = "1.2.1"

  return (
    <>
      <Suspense fallback={null}>{/* No Internet Modal */}
      <NoInternetModal />
      </Suspense>

      <Suspense fallback={null}>{/* Game Install Modal - Modern Steam Adding Modal */}
      <GameInstallModal
        isOpen={installModalOpen}
        gameName={installGameInfo?.name || ''}
        gameAppid={installGameInfo?.appid || ''}
        gameCover={installGameInfo?.cover || null}
        status={installStatus}
        progress={installProgress}
        logs={logs.map((l, i) => ({ id: i + 1, message: l.message, type: l.type }))}
        dlcCount={dlcCount}
        dlcs={installedDlcs}
        totalInstalled={installedGames.length}
        onRestartSteam={() => { setInstallModalOpen(false); restartSteam(); showToast('Restarting Steam...', 'info'); }}
        onClose={() => setInstallModalOpen(false)}
        onDismiss={() => setInstallModalOpen(false)}
        onCancel={() => { cancelDownload() }}
      />
      </Suspense>

      <Suspense fallback={null}>{/* Discord Login Modal */}
      <DiscordLoginModal
        isOpen={discordModalOpen}
        startupMode={startupDiscordModal}
        onClose={() => { setDiscordModalOpen(false); setStartupDiscordModal(false) }}
        onConnected={async (user: any) => {
          setDiscordConnected(true)
          setDiscordUser(user)
          setGameSharingEnabled(true)
          try { await bridge.setGameSharing(true) } catch { /* ignore */ }
          setDiscordModalOpen(false)
          setStartupDiscordModal(false)
          setDiscordSuccessOpen(true)
        }}
        onLogout={() => {
          setDiscordConnected(false)
          setDiscordUser(null)
          setGameSharingEnabled(false)
        }}
        gameSharingEnabled={gameSharingEnabled}
        onGameSharingChange={setGameSharingEnabled}
        onLater={() => { setDiscordModalOpen(false); setStartupDiscordModal(false) }}
        onDontShowAgain={async () => {
          setDiscordModalOpen(false)
          setStartupDiscordModal(false)
          try { await bridge.setDiscordStartupPref({ showOnStartup: false }) } catch { /* ignore */ }
        }}
      />
      </Suspense>

      <Suspense fallback={null}>{/* Discord Success Modal */}
      <DiscordSuccessModal
        isOpen={discordSuccessOpen}
        onClose={() => setDiscordSuccessOpen(false)}
        user={discordUser}
      />
      </Suspense>

      <Suspense fallback={null}><ToastContainer colors={COLORS} />
      </Suspense>

      <Suspense fallback={null}><UpdateModal 
        isOpen={updateModalOpen} 
        onClose={() => setUpdateModalOpen(false)}
        currentVersion={currentVersion}
      />
      </Suspense>
      
      <Suspense fallback={null}><ChangelogModal
        isOpen={changelogOpen}
        onClose={() => setChangelogOpen(false)}
        newVersion={changelogVersion}
      />
      </Suspense>

      <Suspense fallback={null}><ActivationModal
        isOpen={activationOpen}
        onActivated={() => {
          setIsActivated(true)
          setActivationOpen(false)
          setThankYouOpen(true)
        }}
      />
      </Suspense>

      <Suspense fallback={null}><ThankYouModal
        isOpen={thankYouOpen}
        onClose={() => setThankYouOpen(false)}
      />
      </Suspense>

      <Suspense fallback={null}><GameActionModal
        game={gameActionModalGame}
        isOpen={gameActionModalOpen}
        onClose={() => setGameActionModalOpen(false)}
        onInstallGame={handleInstallGame}
        onInstallFromZip={handleInstallFromZip}
        onOpenDLCManager={(game: any) => {
          setGameActionModalOpen(false)
          setDlcManagerGame(game)
          setDlcManagerOpen(true)
        }}
        colors={COLORS}
      />
      </Suspense>

      <Suspense fallback={null}><DLCManager
        game={dlcManagerGame}
        isOpen={dlcManagerOpen}
        onClose={() => setDlcManagerOpen(false)}
        colors={COLORS}
        bridge={bridge}
        showToast={showToast}
      />
      </Suspense>

      <Suspense fallback={null}><DownloadProgressModal colors={COLORS} />
      </Suspense>

       <Suspense fallback={null}>{/* Fix Extract Modal */}
       <FixExtractModal
         isOpen={extractModalOpen}
         fileName={extractFileName}
         filePath={extractFilePath}
         onClose={() => setExtractModalOpen(false)}
         onDismiss={() => setExtractModalOpen(false)}
       />
       </Suspense>

       <Suspense fallback={null}><AchievementsModal colors={COLORS} achievements={achievements} />
       </Suspense>

      <Suspense fallback={null}><FixGamesModal colors={COLORS} runFixGames={runFixGames} />
      </Suspense>

      <Suspense fallback={null}><ScanGamesModal colors={COLORS} startScanGames={startScanGames} reloadGamesList={reloadGamesList} />
      </Suspense>

      <Suspense fallback={null}><ContextMenu
        colors={COLORS}
        contextMenuInstall={contextMenuInstall}
        contextMenuOpenSteam={contextMenuOpenSteam}
        contextMenuToggleFavorite={contextMenuToggleFavorite}
        addToDownloadQueue={addToDownloadQueue}
        contextMenuShareCard={contextMenuShareCard}
        contextMenuCopyAppId={contextMenuCopyAppId}
        onRemoveGame={contextMenuRemoveGame}
      />
      </Suspense>

      <Suspense fallback={null}><PortalGameModal
        colors={COLORS}
        contextMenuInstall={contextMenuInstall}
        contextMenuOpenSteam={contextMenuOpenSteam}
        openPortalModal={openPortalModal}
      />
      </Suspense>

      <Suspense fallback={null}>{/* ── Feature: Download Queue Panel ── */}
      <DownloadQueuePanel
        colors={COLORS}
        downloadQueueRunning={false}
        processDownloadQueue={processDownloadQueue}
        removeFromDownloadQueue={removeFromDownloadQueue}
        cancelDownload={() => cancelDownload()}
      />
      </Suspense>

      {/* ── FEATURE: Fix No Games Premium Modal ── */}
      <AnimatePresence>
        {fixGamesScriptModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
            onClick={() => setFixGamesScriptModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-lg mx-4 rounded-2xl overflow-hidden"
              style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}` }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `${COLORS.amber}20` }}>
                    <RefreshCw size={24} style={{ color: COLORS.amber }} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold" style={{ color: COLORS.text }}>Fix No Games Showing</h3>
                    <p className="text-sm" style={{ color: COLORS.textMuted }}>Run automated games fix script</p>
                  </div>
                </div>

                {fixGamesScriptStatus === 'idle' && (
                  <div className="space-y-3 mb-4">
                    <div className="p-3 rounded-xl" style={{ background: `${COLORS.amber}10`, border: `1px solid ${COLORS.amber}30` }}>
                      <p className="text-sm" style={{ color: COLORS.textSecondary }}>
                        This will re-download manifest files and restart Steam to fix games not showing in your library.
                      </p>
                    </div>
                    <button
                      onClick={() => setFixGamesScriptModalOpen(false)}
                      className="w-full py-3 rounded-xl font-bold text-white"
                      style={{ background: `linear-gradient(135deg, ${COLORS.amber}, ${COLORS.orange})` }}
                    >
                      Close
                    </button>
                  </div>
                )}

                {fixGamesScriptStatus === 'running' && (
                  <div className="space-y-3 mb-4">
                    <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: `${COLORS.amber}20` }}>
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: `linear-gradient(90deg, ${COLORS.amber}, ${COLORS.orange})` }}
                        animate={{ width: fixGamesScriptProgress > 0 ? `${fixGamesScriptProgress}%` : ['0%', '100%'] }}
                        transition={fixGamesScriptProgress > 0 ? { duration: 0.3 } : { duration: 30, ease: 'linear' }}
                      />
                    </div>
                    <div className="flex items-center justify-center gap-3">
                      <RefreshCw size={20} style={{ color: COLORS.amber }} className="animate-spin" />
                      <p className="text-sm font-medium" style={{ color: COLORS.text }}>Running fix script...</p>
                    </div>
                    {fixGamesScriptOutput && (
                      <pre className="text-xs whitespace-pre-wrap p-3 rounded-xl" style={{ background: `${COLORS.amber}08`, color: COLORS.textMuted, maxHeight: 140, overflow: 'auto' }}>{fixGamesScriptOutput}</pre>
                    )}
                    <motion.button
                      onClick={async () => {
                        await cancelDownload()
                        setFixGamesScriptStatus('idle')
                        setFixGamesScriptOutput('')
                        setFixGamesScriptProgress(0)
                      }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2"
                      style={{ background: `${COLORS.red}15`, color: COLORS.red, border: `1px solid ${COLORS.red}30` }}
                    >
                      <AlertTriangle size={16} />
                      Cancel Fix
                    </motion.button>
                  </div>
                )}

                {fixGamesScriptStatus === 'done' && (
                  <div className="space-y-3 mb-4">
                    <div className="p-3 rounded-xl" style={{ background: `${COLORS.green}15`, border: `1px solid ${COLORS.green}30` }}>
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 size={18} style={{ color: COLORS.green }} />
                        <p className="text-sm font-bold" style={{ color: COLORS.green }}>Fix succeeded</p>
                      </div>
                      <pre className="text-xs whitespace-pre-wrap" style={{ color: COLORS.textMuted, maxHeight: 200, overflow: 'auto' }}>{fixGamesScriptOutput}</pre>
                    </div>
                    <button onClick={() => { setFixGamesScriptModalOpen(false); setFixGamesScriptStatus('idle'); }} className="w-full py-3 rounded-xl font-bold text-white" style={{ background: COLORS.green }}>Close</button>
                  </div>
                )}

                {fixGamesScriptStatus === 'error' && (
                  <div className="space-y-3 mb-4">
                    <div className="p-3 rounded-xl" style={{ background: `${COLORS.red}15`, border: `1px solid ${COLORS.red}30` }}>
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle size={18} style={{ color: COLORS.red }} />
                        <p className="text-sm font-bold" style={{ color: COLORS.red }}>Fix failed</p>
                      </div>
                      <pre className="text-xs whitespace-pre-wrap" style={{ color: COLORS.textMuted }}>{fixGamesScriptOutput}</pre>
                    </div>
                    <button
                      onClick={() => setFixGamesContactOpen((prev: boolean) => !prev)}
                      className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
                      style={{ background: `${DARK_COLORS.blue}26`, color: DARK_COLORS.blue, border: `1px solid ${DARK_COLORS.blue}4d` }}
                    >
                      <MessageCircle size={16} />
                      Contact Support
                    </button>
                    {fixGamesContactOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        className="p-3 rounded-xl"
                        style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}
                      >
                        <p className="text-sm" style={{ color: COLORS.textSecondary }}>
                          Please open a ticket in the{' '}
                          <strong style={{ color: DARK_COLORS.blue }}>AHG Script Discord server</strong> and share the error details above.
                        </p>
                      </motion.div>
                    )}
                    <div className="flex gap-3">
                      <button onClick={() => setFixGamesScriptModalOpen(false)} className="flex-1 py-3 rounded-xl font-bold text-sm" style={{ background: COLORS.bgMid, color: COLORS.text }}>Close</button>
                      <button onClick={() => { setFixGamesScriptStatus('idle'); setFixGamesScriptProgress(0); setFixGamesScriptOutput(''); setFixGamesContactOpen(false); }} className="flex-1 py-3 rounded-xl font-bold text-white text-sm" style={{ background: COLORS.amber }}>Retry</button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
})

export default ModalRenderer
