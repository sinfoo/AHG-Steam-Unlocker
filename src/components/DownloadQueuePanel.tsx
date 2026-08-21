import { memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download as DownloadIcon, X, Trash2 } from 'lucide-react'
import type { ColorScheme } from './shared'
import { useDownloadStore } from '../store'
import GameCover from './GameCover'

interface DownloadQueuePanelProps {
  colors: ColorScheme
  downloadQueueRunning: boolean
  processDownloadQueue: () => void
  removeFromDownloadQueue: (appid: string) => void
  cancelDownload: () => void
}

export const DownloadQueuePanel = memo(function DownloadQueuePanel({
  colors: COLORS,
  downloadQueueRunning,
  processDownloadQueue,
  removeFromDownloadQueue,
  cancelDownload,
}: DownloadQueuePanelProps) {
  const showDownloadQueue = useDownloadStore(s => s.showDownloadQueue)
  const setShowDownloadQueue = useDownloadStore(s => s.setShowDownloadQueue)
  const downloadQueue = useDownloadStore(s => s.downloadQueue)
  const setDownloadQueue = useDownloadStore(s => s.setDownloadQueue)
  const downloadQueuePaused = useDownloadStore(s => s.downloadQueuePaused)
  const setDownloadQueuePaused = useDownloadStore(s => s.setDownloadQueuePaused)

  return (
    <AnimatePresence>
      {showDownloadQueue && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
          onClick={() => setShowDownloadQueue(false)}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="w-full max-w-lg mx-4 rounded-2xl overflow-hidden"
            style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, boxShadow: `0 24px 80px rgba(0,0,0,0.5)` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `${COLORS.blue}20` }}>
                  <DownloadIcon size={24} style={{ color: COLORS.blue }} />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold" style={{ color: COLORS.text }}>Download Queue</h3>
                  <p className="text-sm" style={{ color: COLORS.textMuted }}>{downloadQueue.filter((i: any) => i.status === 'pending').length} pending</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDownloadQueuePaused((p: boolean) => !p)}
                    className="px-3 py-2 rounded-xl text-xs font-bold"
                    style={{ background: downloadQueuePaused ? `${COLORS.green}20` : `${COLORS.amber}20`, color: downloadQueuePaused ? COLORS.green : COLORS.amber }}
                  >
                    {downloadQueuePaused ? 'Resume' : 'Pause'}
                  </button>
                  <button
                    onClick={() => setShowDownloadQueue(false)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: `${COLORS.red}20` }}
                  >
                    <X size={16} style={{ color: COLORS.red }} />
                  </button>
                </div>
              </div>
              {downloadQueue.length === 0 ? (
                <div className="py-12 text-center">
                  <DownloadIcon size={48} style={{ color: COLORS.textMuted }} className="mx-auto mb-3 opacity-30" />
                  <p style={{ color: COLORS.textMuted }}>Queue is empty</p>
                  <p className="text-xs mt-1" style={{ color: COLORS.textDim }}>Right-click a game and select Install to add it</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {downloadQueue.map((item: any) => (
                    <div key={item.game.appid} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: COLORS.bgMid, border: `1px solid ${COLORS.border}` }}>
                      <div className="w-10 h-6 rounded overflow-hidden flex-shrink-0">
                        <GameCover appid={item.game.appid} name={item.game.name} localHeader={item.game.header_image} className="w-full h-full" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: COLORS.text }}>{item.game.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {item.status === 'pending' && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: `${COLORS.blue}20`, color: COLORS.blue }}>Pending</span>}
                          {item.status === 'downloading' && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: `${COLORS.amber}20`, color: COLORS.amber }}>Downloading...</span>}
                          {item.status === 'done' && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: `${COLORS.green}20`, color: COLORS.green }}>Done ✓</span>}
                          {item.status === 'error' && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: `${COLORS.red}20`, color: COLORS.red }} title={item.error}>Error</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {item.status === 'downloading' && (
                          <button
                            onClick={() => { cancelDownload(); removeFromDownloadQueue(item.game.appid); }}
                            className="px-2 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1"
                            style={{ background: `${COLORS.amber}20`, color: COLORS.amber }}
                            title="Cancel download"
                          >
                            Cancel
                          </button>
                        )}
                        <button
                          onClick={() => removeFromDownloadQueue(item.game.appid)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center"
                          style={{ background: `${COLORS.red}15` }}
                          title="Remove from queue"
                        >
                          <Trash2 size={12} style={{ color: COLORS.red }} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {downloadQueue.length > 0 && (
                <div className="mt-4 flex gap-3">
                  <button
                    onClick={processDownloadQueue}
                    disabled={downloadQueueRunning}
                    className="flex-1 py-3 rounded-xl font-bold text-white text-sm"
                    style={{ background: `linear-gradient(135deg, ${COLORS.green}, ${COLORS.blue})`, opacity: downloadQueueRunning ? 0.6 : 1 }}
                  >
                    {downloadQueueRunning ? 'Processing...' : `Install All (${downloadQueue.filter((i: any) => i.status === 'pending').length})`}
                  </button>
                  <button
                    onClick={() => { cancelDownload(); setDownloadQueue([]); setShowDownloadQueue(false); }}
                    className="px-4 py-3 rounded-xl font-bold text-sm"
                    style={{ background: COLORS.bgMid, color: COLORS.red, border: `1px solid ${COLORS.red}30` }}
                  >
                    Cancel All
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
})
