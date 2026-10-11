import { useT } from '../i18n'
import { memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import type { ColorScheme } from './shared'
import { useModalStore, useFixGamesStore } from '../store'

interface FixGamesModalProps {
  colors: ColorScheme
  runFixGames: () => void
}

export const FixGamesModal = memo(function FixGamesModal({ colors: COLORS, runFixGames }: FixGamesModalProps) {
  const t = useT()
  const fixGamesModalOpen = useModalStore(s => s.fixGamesModalOpen)
  const setFixGamesModalOpen = useModalStore(s => s.setFixGamesModalOpen)
  const fixGamesStatus = useFixGamesStore(s => s.fixGamesStatus)
  const fixGamesOutput = useFixGamesStore(s => s.fixGamesOutput)
  const fixGamesScriptProgress = useFixGamesStore(s => s.fixGamesScriptProgress)

  return (
    <AnimatePresence>
      {fixGamesModalOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: 'rgba(4,4,10,0.6)', backdropFilter: 'blur(10px)' }}
          onClick={() => fixGamesStatus !== 'running' && setFixGamesModalOpen(false)}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="w-full max-w-lg mx-4 rounded-[22px] overflow-hidden"
            style={{ background: '#0f0f1b', border: '1px solid rgba(255,255,255,0.09)', boxShadow: '0 60px 120px -30px rgba(0,0,0,1)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `${COLORS.green}20` }}>
                  <RefreshCw size={24} style={{ color: COLORS.green }} />
                </div>
                <div>
                  <h3 className="text-xl font-bold" style={{ color: COLORS.text }}>{t('ui.fixg.title')}</h3>
                  <p className="text-sm" style={{ color: COLORS.textMuted }}>{t('ui.fixg.subtitle')}</p>
                </div>
              </div>

              {fixGamesStatus === 'idle' && (
                <div className="space-y-4">
                  <p className="text-sm" style={{ color: COLORS.textSecondary }}>
                    {t('ui.fixg.hint')}
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setFixGamesModalOpen(false)}
                      className="flex-1 py-3 rounded-xl font-medium"
                      style={{ background: COLORS.bgMid, color: COLORS.textSecondary, border: `1px solid ${COLORS.border}` }}
                    >
                      {t('ui.common.cancel')}
                    </button>
                    <button
                      onClick={runFixGames}
                      className="flex-1 py-3 rounded-xl font-bold "
                      style={{ background: 'var(--acc,#a77dff)', boxShadow: '0 16px 40px -14px var(--acc,#a77dff)' }}
                    >
                      {t('ui.fixg.run')}
                    </button>
                  </div>
                </div>
              )}

              {fixGamesStatus === 'running' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Loader2 size={22} style={{ color: COLORS.amber }} className="animate-spin shrink-0" />
                      <div className="min-w-0">
                        <span className="block text-sm font-semibold truncate" style={{ color: COLORS.text }}>{t('ui.fixg.running')}</span>
                        <span className="block text-xs truncate" style={{ color: COLORS.textMuted }}>{t('ui.fixg.runningDesc')}</span>
                      </div>
                    </div>
                    {fixGamesScriptProgress > 0 && (
                      <span className="text-sm font-bold tabular-nums shrink-0" style={{ color: COLORS.green }}>
                        {Math.round(fixGamesScriptProgress)}%
                      </span>
                    )}
                  </div>

                  {/* Premium progress bar — determinate when the script reports %, else a
                      sliding indeterminate segment so the user always sees live activity. */}
                  <div
                    className="relative w-full h-2.5 rounded-full overflow-hidden"
                    style={{ background: COLORS.bgMid, boxShadow: `inset 0 1px 2px rgba(0,0,0,0.4)` }}
                  >
                    {fixGamesScriptProgress > 0 ? (
                      <motion.div
                        className="absolute inset-y-0 start-0 rounded-full"
                        style={{
                          background: `linear-gradient(90deg, ${COLORS.green}, ${COLORS.blue})`,
                          boxShadow: `0 0 12px ${COLORS.green}80`,
                        }}
                        animate={{ width: `${Math.min(fixGamesScriptProgress, 100)}%` }}
                        transition={{ duration: 0.4, ease: 'easeOut' }}
                      />
                    ) : (
                      <motion.div
                        className="absolute inset-y-0 rounded-full"
                        style={{
                          width: '42%',
                          background: `linear-gradient(90deg, transparent, ${COLORS.green}, ${COLORS.blue}, transparent)`,
                          boxShadow: `0 0 12px ${COLORS.green}60`,
                        }}
                        animate={{ left: ['-42%', '100%'] }}
                        transition={{ duration: 1.15, repeat: Infinity, ease: 'easeInOut' }}
                      />
                    )}
                  </div>

                  {fixGamesOutput && (
                    <div className="p-3 rounded-xl text-xs max-h-32 overflow-y-auto whitespace-pre-line font-mono leading-relaxed" style={{ background: `${COLORS.green}10`, color: COLORS.textSecondary, border: `1px solid ${COLORS.green}20` }}>
                      {fixGamesOutput}
                    </div>
                  )}
                </div>
              )}

              {fixGamesStatus === 'done' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 size={24} style={{ color: COLORS.green }} />
                    <span className="text-sm font-medium" style={{ color: COLORS.green }}>{t('ui.fixg.done')}</span>
                  </div>
                  {fixGamesOutput && (
                    <div className="p-3 rounded-xl text-xs max-h-32 overflow-y-auto whitespace-pre-line" style={{ background: `${COLORS.green}10`, color: COLORS.textSecondary, border: `1px solid ${COLORS.green}20` }}>
                      {fixGamesOutput}
                    </div>
                  )}
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        window.electronAPI?.restartSteam?.()
                        setFixGamesModalOpen(false)
                      }}
                      className="flex-1 py-3 rounded-xl font-medium"
                      style={{ background: COLORS.bgMid, color: COLORS.textSecondary, border: `1px solid ${COLORS.border}` }}
                    >
                      {t('ui.gi.restartSteam')}
                    </button>
                    <button
                      onClick={() => setFixGamesModalOpen(false)}
                      className="flex-1 py-3 rounded-xl font-bold text-white"
                      style={{ background: COLORS.green }}
                    >
                      {t('ui.common.done')}
                    </button>
                  </div>
                </div>
              )}

              {fixGamesStatus === 'error' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <AlertCircle size={24} style={{ color: COLORS.red }} />
                    <span className="text-sm font-medium" style={{ color: COLORS.red }}>{t('ui.fixg.failed')}</span>
                  </div>
                  {fixGamesOutput && (
                    <div className="p-3 rounded-xl text-xs max-h-32 overflow-y-auto whitespace-pre-line" style={{ background: COLORS.redDim, color: COLORS.red, border: `1px solid ${COLORS.red}30` }}>
                      {fixGamesOutput}
                    </div>
                  )}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setFixGamesModalOpen(false)}
                      className="flex-1 py-3 rounded-xl font-medium"
                      style={{ background: COLORS.bgMid, color: COLORS.textSecondary, border: `1px solid ${COLORS.border}` }}
                    >
                      {t('ui.common.close')}
                    </button>
                    <button
                      onClick={runFixGames}
                      className="flex-1 py-3 rounded-xl font-bold text-white"
                      style={{ background: COLORS.amber }}
                    >
                      {t('ui.common.retry')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
})
