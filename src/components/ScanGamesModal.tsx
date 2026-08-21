import { memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, CheckCircle2, AlertCircle, ChevronUp, ChevronDown, X } from 'lucide-react'
import type { ColorScheme } from './shared'
import { useModalStore, useScanStore } from '../store'
import GameCover from './GameCover'

interface ScanGamesModalProps {
  colors: ColorScheme
  startScanGames: () => void
  reloadGamesList: () => void
}

export const ScanGamesModal = memo(function ScanGamesModal({ colors: COLORS, startScanGames, reloadGamesList }: ScanGamesModalProps) {
  const scanGamesModalOpen = useModalStore(s => s.scanGamesModalOpen)
  const setScanGamesModalOpen = useModalStore(s => s.setScanGamesModalOpen)
  const scanGamesProgress = useScanStore(s => s.scanGamesProgress)
  const scanGamesStatus = useScanStore(s => s.scanGamesStatus)
  const scanGamesResult = useScanStore(s => s.scanGamesResult)
  const scanGamesMinimized = useScanStore(s => s.scanGamesMinimized)
  const setScanGamesMinimized = useScanStore(s => s.setScanGamesMinimized)
  
  return (
    <AnimatePresence>
      {scanGamesModalOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, x: 50, y: 50 }}
          animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, x: 50, y: 50 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-6 right-6 z-[100] rounded-2xl overflow-hidden"
          style={{ 
            width: scanGamesMinimized ? 'auto' : '340px',
            background: COLORS.bgCard, 
            border: `1px solid ${COLORS.border}`, 
            boxShadow: `0 16px 48px rgba(0,0,0,0.5)` 
          }}
        >
          {/* Header bar */}
          <div 
            className="flex items-center justify-between px-4 py-3 cursor-pointer"
            style={{ background: `${COLORS.blue}15`, borderBottom: scanGamesMinimized ? 'none' : `1px solid ${COLORS.border}` }}
            onClick={() => {
              if (scanGamesStatus === 'scanning') setScanGamesMinimized(!scanGamesMinimized)
            }}
          >
            <div className="flex items-center gap-2">
              {scanGamesStatus === 'scanning' ? (
                <Loader2 size={16} style={{ color: COLORS.blue }} className="animate-spin" />
              ) : scanGamesStatus === 'done' ? (
                <CheckCircle2 size={16} style={{ color: COLORS.green }} />
              ) : (
                <AlertCircle size={16} style={{ color: COLORS.red }} />
              )}
              <span className="text-sm font-bold" style={{ color: COLORS.text }}>Scan Progress</span>
            </div>
            <div className="flex items-center gap-1">
              {scanGamesStatus === 'scanning' && (
                <button
                  onClick={(e) => { e.stopPropagation(); setScanGamesMinimized(!scanGamesMinimized); }}
                  className="w-6 h-6 rounded flex items-center justify-center"
                  style={{ background: scanGamesMinimized ? COLORS.blue : `${COLORS.textMuted}20`, color: scanGamesMinimized ? COLORS.white : COLORS.textMuted }}
                >
                  {scanGamesMinimized ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
              )}
              <button
                onClick={() => setScanGamesModalOpen(false)}
                className="w-6 h-6 rounded flex items-center justify-center"
                style={{ background: `${COLORS.textMuted}20`, color: COLORS.textMuted }}
              >
                <X size={12} />
              </button>
            </div>
          </div>

          {/* Body */}
          {!scanGamesMinimized && (
            <div className="p-4">
              {scanGamesStatus === 'scanning' && (
                <div className="space-y-3">
                  <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: COLORS.bgMid }}>
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: `linear-gradient(90deg, ${COLORS.blue}, ${COLORS.violet})` }}
                      animate={{ width: `${scanGamesProgress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-xs" style={{ color: COLORS.textMuted }}>{scanGamesProgress}% complete</p>
                    <p className="text-xs font-medium" style={{ color: COLORS.text }}>Scanning...</p>
                  </div>
                </div>
              )}

              {scanGamesStatus === 'done' && (
                <div className="space-y-3">
                  {scanGamesResult.found > 0 ? (
                    <>
                      <div className="p-3 rounded-xl" style={{ background: `${COLORS.green}15`, border: `1px solid ${COLORS.green}30` }}>
                        <p className="text-sm font-bold" style={{ color: COLORS.green }}>{scanGamesResult.found} new games found!</p>
                      </div>
                      <div className="max-h-40 overflow-y-auto rounded-lg space-y-1" style={{ border: `1px solid ${COLORS.border}` }}>
                        {scanGamesResult.added.map((game: any, i: number) => (
                          <div key={game.appid} className="flex items-center gap-3 px-3 py-2" style={{ 
                            background: i % 2 === 0 ? COLORS.bgCard : COLORS.bgMid,
                            borderBottom: `1px solid ${COLORS.border}`
                          }}>
                            <div className="w-10 h-6 rounded overflow-hidden flex-shrink-0" style={{ background: `linear-gradient(135deg, ${COLORS.violet}30, ${COLORS.blue}30)` }}>
                              <GameCover appid={game.appid} name={game.name} localHeader={game.header_image} className="w-full h-full" />
                            </div>
                            <span className="text-xs font-medium truncate flex-1" style={{ color: COLORS.text }}>{game.name}</span>
                            <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: `${COLORS.green}20`, color: COLORS.green }}>NEW</span>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => { reloadGamesList(); setScanGamesModalOpen(false); }}
                        className="w-full py-2 rounded-lg font-bold text-white text-sm"
                        style={{ background: COLORS.green, boxShadow: `0 4px 12px ${COLORS.green}40` }}
                      >
                        Refresh Catalogue
                      </button>
                    </>
                  ) : (
                    <div className="text-center py-6">
                      <CheckCircle2 size={28} style={{ color: COLORS.green }} className="mx-auto mb-2" />
                      <p className="text-sm font-bold" style={{ color: COLORS.text }}>No new games found</p>
                      <p className="text-xs mt-1" style={{ color: COLORS.textMuted }}>Catalogue is up to date</p>
                      <button
                        onClick={() => setScanGamesModalOpen(false)}
                        className="mt-3 w-full py-2 rounded-lg font-bold text-sm"
                        style={{ background: COLORS.bgMid, color: COLORS.text, border: `1px solid ${COLORS.border}` }}
                      >
                        Close
                      </button>
                    </div>
                  )}
                </div>
              )}

              {scanGamesStatus === 'error' && (
                <div className="space-y-3">
                  <p className="text-sm font-medium" style={{ color: COLORS.red }}>Scan failed</p>
                  <button
                    onClick={startScanGames}
                    className="w-full py-2 rounded-lg font-bold text-white text-sm"
                    style={{ background: COLORS.amber }}
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Minimized bar */}
          {scanGamesMinimized && (
            <div className="px-4 py-2 flex items-center gap-2" style={{ background: `${COLORS.blue}10` }}>
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: COLORS.blue }} />
              <span className="text-xs font-medium" style={{ color: COLORS.blue }}>{scanGamesProgress}% scanning...</span>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
})
