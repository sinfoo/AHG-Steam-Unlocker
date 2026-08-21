import { memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download as DownloadIcon } from 'lucide-react'
import type { ColorScheme } from './shared'
import { useUIStore } from '../store'

interface ImportModalProps {
  colors: ColorScheme
}

export const ImportModal = memo(function ImportModal({ colors: COLORS }: ImportModalProps) {
  const showImportModal = useUIStore(s => s.showImportModal)
  const setShowImportModal = useUIStore(s => s.setShowImportModal)
  const importResult = useUIStore(s => s.importResult)
  const setImportResult = useUIStore(s => s.setImportResult)

  return (
    <AnimatePresence>
      {showImportModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
          onClick={() => setShowImportModal(false)}
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
              <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: `${COLORS.violet}20` }}>
                <DownloadIcon size={32} style={{ color: COLORS.violet }} />
              </div>
              <h3 className="text-xl font-bold mb-2" style={{ color: COLORS.text }}>Import Library</h3>
              <p className="text-sm mb-6" style={{ color: COLORS.textMuted }}>
                Import games and favorites from a previously exported JSON file.
              </p>
              {importResult && (
                <div className="mb-4 p-3 rounded-xl text-left" style={{ background: `${COLORS.green}10`, border: `1px solid ${COLORS.green}20` }}>
                  <p className="text-sm font-bold" style={{ color: COLORS.green }}>Import Complete!</p>
                  {importResult.installed?.length > 0 && <p className="text-xs mt-1" style={{ color: COLORS.textMuted }}>{importResult.installed.length} games installed</p>}
                  {importResult.favorites?.length > 0 && <p className="text-xs" style={{ color: COLORS.textMuted }}>{importResult.favorites.length} favorites restored</p>}
                
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowImportModal(false); setImportResult(null); }}
                  className="flex-1 py-3 rounded-xl font-bold text-sm"
                  style={{ background: COLORS.bgMid, color: COLORS.text, border: `1px solid ${COLORS.border}` }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => { setShowImportModal(false); setImportResult(null); }}
                  className="flex-1 py-3 rounded-xl font-bold text-white text-sm"
                  style={{ background: `linear-gradient(135deg, ${COLORS.violet}, ${COLORS.blue})` }}
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
