import { memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, CheckCircle2 } from 'lucide-react'
import type { ColorScheme } from './shared'
import { useUIStore, useGameStore, useUserStore } from '../store'

interface ExportModalProps {
  colors: ColorScheme
}

export const ExportModal = memo(function ExportModal({ colors: COLORS }: ExportModalProps) {
  const showExportModal = useUIStore(s => s.showExportModal)
  const setShowExportModal = useUIStore(s => s.setShowExportModal)
  const installedGames = useGameStore(s => s.installedGames)
  const favorites = useUserStore(s => s.favorites)
  return (
    <AnimatePresence>
      {showExportModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
          onClick={() => setShowExportModal(false)}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="w-full max-w-sm mx-4 rounded-2xl overflow-hidden"
            style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 text-center">
              <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: `${COLORS.green}20` }}>
                <Upload size={32} style={{ color: COLORS.green }} />
              </div>
              <h3 className="text-xl font-bold mb-2" style={{ color: COLORS.text }}>Export Library</h3>
              <p className="text-sm mb-6" style={{ color: COLORS.textMuted }}>
                Export your installed games and favorites to a JSON file.
              </p>
              <div className="space-y-2 mb-6 text-left">
                <div className="flex items-center gap-2 p-2 rounded-lg" style={{ background: COLORS.bgMid }}>
                  <CheckCircle2 size={16} style={{ color: COLORS.green }} />
                  <span className="text-sm" style={{ color: COLORS.text }}>{installedGames.length} installed games</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg" style={{ background: COLORS.bgMid }}>
                  <CheckCircle2 size={16} style={{ color: COLORS.green }} />
                  <span className="text-sm" style={{ color: COLORS.text }}>{favorites.size} favorites</span>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowExportModal(false)}
                  className="flex-1 py-3 rounded-xl font-bold text-sm"
                  style={{ background: COLORS.bgMid, color: COLORS.text, border: `1px solid ${COLORS.border}` }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => setShowExportModal(false)}
                  className="flex-1 py-3 rounded-xl font-bold text-white text-sm"
                  style={{ background: `linear-gradient(135deg, ${COLORS.green}, ${COLORS.blue})` }}
                >
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
})
