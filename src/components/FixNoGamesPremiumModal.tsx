import { memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, CheckCircle2, AlertTriangle, MessageCircle } from 'lucide-react'
import type { ColorScheme } from './shared'
import { useModalStore, useFixGamesStore } from '../store'

interface FixNoGamesPremiumModalProps {
  colors: ColorScheme
}

export const FixNoGamesPremiumModal = memo(function FixNoGamesPremiumModal({ colors: COLORS }: FixNoGamesPremiumModalProps) {
  const fixGamesScriptModalOpen = useModalStore(s => s.fixGamesScriptModalOpen)
  const setFixGamesScriptModalOpen = useModalStore(s => s.setFixGamesScriptModalOpen)
  const fixGamesScriptStatus = useFixGamesStore(s => s.fixGamesScriptStatus)
  const setFixGamesScriptStatus = useFixGamesStore(s => s.setFixGamesScriptStatus)
  const fixGamesScriptProgress = useFixGamesStore(s => s.fixGamesScriptProgress)
  const setFixGamesScriptProgress = useFixGamesStore(s => s.setFixGamesScriptProgress)
  const fixGamesScriptOutput = useFixGamesStore(s => s.fixGamesScriptOutput)
  const setFixGamesScriptOutput = useFixGamesStore(s => s.setFixGamesScriptOutput)
  const fixGamesContactOpen = useFixGamesStore(s => s.fixGamesContactOpen)
  const setFixGamesContactOpen = useFixGamesStore(s => s.setFixGamesContactOpen)

  return (
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
                    onClick={() => setFixGamesContactOpen(prev => !prev)}
                    className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
                    style={{ background: `${COLORS.blue}26`, color: COLORS.blue, border: `1px solid ${COLORS.blue}4d` }}
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
                        <strong style={{ color: COLORS.blue }}>AHG Script Discord server</strong> and share the error details above.
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
  )
})
