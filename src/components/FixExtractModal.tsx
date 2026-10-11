import { useT, t as tNow } from '../i18n'
import { memo, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Package, Loader2, FolderOpen, FileArchive, CheckCircle2, AlertCircle, X } from 'lucide-react'
import { COLORS } from '../constants/colors'

const blueGlow = 'rgba(59, 130, 246, 0.4)'

interface FixExtractModalProps {
  isOpen: boolean
  fileName: string
  filePath: string
  onClose: () => void
  onDismiss: () => void
}

export const FixExtractModal = memo(function FixExtractModal({ isOpen, fileName, filePath, onClose, onDismiss }: FixExtractModalProps) {
  const t = useT()
  const [extractStatus, setExtractStatus] = useState<'idle' | 'extracting' | 'done' | 'error'>('idle')
  const [extractMessage, setExtractMessage] = useState('')
  const [extractedDir, setExtractedDir] = useState('')
  const abortControllerRef = useRef<AbortController | null>(null)

  const handleExtract = async () => {
    const controller = new AbortController()
    abortControllerRef.current = controller
    setExtractStatus('extracting')
    setExtractMessage(tNow('ui.fx.extractingFiles'))
    try {
      const result = await Promise.race([
        (window as any).electronAPI?.extractFix?.(filePath),
        new Promise<never>((_, reject) => {
          if (controller.signal.aborted) return reject(new DOMException('Aborted', 'AbortError'))
          controller.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
        })
      ])
      if (result?.success) {
        setExtractStatus('done')
        setExtractMessage(result.message || tNow('ui.fx.msgDone'))
        setExtractedDir(result.extractedDir || '')
      } else {
        setExtractStatus('error')
        setExtractMessage(result?.message || tNow('ui.fx.msgFail'))
        if (result?.extractedDir) setExtractedDir(result.extractedDir)
      }
    } catch (e: any) {
      if (e.name === 'AbortError') {
        setExtractStatus('idle')
        setExtractMessage('')
        return
      }
      setExtractStatus('error')
      setExtractMessage(tNow('ui.fx.err', { err: e.message }))
    }
  }

  const handleOpenFolder = async () => {
    const target = extractedDir || filePath
    try {
      await (window as any).electronAPI?.openFileLocation?.(target)
    } catch {}
  }

  const handleOpenDownloadFolder = async () => {
    try {
      await (window as any).electronAPI?.openFileLocation?.(filePath)
    } catch {}
  }

  const isActive = extractStatus === 'extracting'

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[310] flex items-center justify-center p-4"
          style={{ background: 'rgba(4,4,10,0.6)', backdropFilter: 'blur(10px)' }}
          onClick={(e) => { if (e.target === e.currentTarget && !isActive) onDismiss() }}
        >
          <motion.div
            initial={{ scale: 0.92, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.92, y: 30, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            className="w-full max-w-md rounded-[24px] overflow-hidden"
            style={{
              background: '#0f0f1b',
              border: `1px solid ${extractStatus === 'done' ? COLORS.green + '40' : extractStatus === 'error' ? COLORS.red + '40' : COLORS.blue + '40'}`,
              boxShadow: '0 60px 120px -30px rgba(0,0,0,1)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header bar */}
            <div
              className="h-1.5"
              style={{
                background: extractStatus === 'done'
                  ? `linear-gradient(90deg, ${COLORS.green}, ${COLORS.amber}, ${COLORS.green})`
                  : extractStatus === 'error'
                    ? `linear-gradient(90deg, ${COLORS.red}, ${COLORS.amber}, ${COLORS.red})`
                    : `linear-gradient(90deg, ${COLORS.blue}, ${COLORS.violet}, ${COLORS.blue})`,
                backgroundSize: '200% 100%',
                animation: 'shimmer 2s linear infinite'
              }}
            />

            <div className="p-6 max-h-[80vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-center gap-4 mb-5">
                <motion.div
                  animate={isActive ? { rotate: 360 } : {}}
                  transition={isActive ? { duration: 2, repeat: Infinity, ease: 'linear' } : {}}
                  className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                  style={{
                    background: extractStatus === 'done'
                      ? `linear-gradient(135deg, ${COLORS.green}30, ${COLORS.green}15)`
                      : extractStatus === 'error'
                        ? `linear-gradient(135deg, ${COLORS.red}30, ${COLORS.red}15)`
                        : `linear-gradient(135deg, ${COLORS.blue}30, ${COLORS.blue}15)`,
                    border: `1px solid ${
                      extractStatus === 'done' ? COLORS.green + '40'
                      : extractStatus === 'error' ? COLORS.red + '40'
                      : COLORS.blue + '40'
                    }`
                  }}
                >
                  {extractStatus === 'done' ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                    >
                      <CheckCircle2 size={28} style={{ color: COLORS.green }} />
                    </motion.div>
                  ) : extractStatus === 'error' ? (
                    <AlertCircle size={28} style={{ color: COLORS.red }} />
                  ) : extractStatus === 'extracting' ? (
                    <div className="relative">
                      <Loader2 size={26} style={{ color: COLORS.blue }} className="animate-spin" />
                      <motion.div
                        className="absolute inset-0 rounded-full"
                        style={{ border: `2px solid ${COLORS.blue}30` }}
                        animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      />
                    </div>
                  ) : (
                    <FileArchive size={26} style={{ color: COLORS.blue }} />
                  )}
                </motion.div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-white truncate">
                    {extractStatus === 'done' ? t('ui.fx.done')
                      : extractStatus === 'error' ? t('ui.fx.fail')
                      : extractStatus === 'extracting' ? t('ui.fx.ing')
                      : t('ui.fx.title')}
                  </h3>
                  <p className="text-sm truncate" style={{ color: COLORS.textSecondary }}>{fileName}</p>
                </div>
                {!isActive && (
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={onClose}
                    aria-label={t('ui.common.close')}
                    className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ background: COLORS.bgHover }}
                  >
                    <X size={16} style={{ color: COLORS.textMuted }} />
                  </motion.button>
                )}
              </div>

              {/* Status Message */}
              {(extractStatus === 'done' || extractStatus === 'error') && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-5 p-4 rounded-2xl"
                  style={{
                    background: extractStatus === 'done' ? `${COLORS.green}15` : `${COLORS.red}15`,
                    border: `1px solid ${extractStatus === 'done' ? COLORS.green + '30' : COLORS.red + '30'}`
                  }}
                >
                  <div className="flex items-center gap-3">
                    {extractStatus === 'done' ? (
                      <CheckCircle2 size={20} style={{ color: COLORS.green }} />
                    ) : (
                      <AlertCircle size={20} style={{ color: COLORS.red }} />
                    )}
                    <p className="text-sm font-medium" style={{
                      color: extractStatus === 'done' ? COLORS.green : COLORS.red
                    }}>
                      {extractMessage}
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Action Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="space-y-2.5"
              >
                {extractStatus === 'idle' && (
                  <>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleExtract}
                      className="w-full py-4 rounded-2xl font-bold  text-base flex items-center justify-center gap-3 relative overflow-hidden cursor-pointer"
                      style={{
                        background: 'var(--acc,#a77dff)',
                        boxShadow: '0 16px 40px -14px var(--acc,#a77dff)'
                      }}
                    >
                      <motion.div
                        className="absolute inset-0"
                        style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)' }}
                        animate={{ x: ['-100%', '100%'] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      />
                      <Package size={18} />
                      {t('ui.fx.extractBtn')}
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleOpenDownloadFolder}
                      className="w-full py-3.5 rounded-2xl font-medium text-sm flex items-center justify-center gap-2 cursor-pointer"
                      style={{
                        background: COLORS.bgHover,
                        border: `1px solid ${COLORS.border}`,
                        color: COLORS.textSecondary
                      }}
                    >
                      <FolderOpen size={16} />
                      {t('ui.fx.openDl')}
                    </motion.button>
                  </>
                )}

                {extractStatus === 'extracting' && (
                  <div className="space-y-2.5">
                    <div
                      className="w-full py-4 rounded-2xl font-medium text-sm flex items-center justify-center gap-3"
                      style={{
                        background: `${COLORS.blue}15`,
                        border: `1px solid ${COLORS.blue}30`,
                        color: COLORS.blue
                      }}
                    >
                      <Loader2 size={16} className="animate-spin" />
                      {t('ui.fx.extractingFiles')}
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        abortControllerRef.current?.abort()
                        abortControllerRef.current = null
                      }}
                      className="w-full py-2.5 rounded-2xl font-medium text-xs cursor-pointer"
                      style={{
                        background: 'transparent',
                        border: `1px solid ${COLORS.border}`,
                        color: COLORS.textDim
                      }}
                    >
                      {t('ui.common.cancel')}
                    </motion.button>
                  </div>
                )}

                {extractStatus === 'done' && (
                  <>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleOpenFolder}
                      className="w-full py-4 rounded-2xl font-bold  text-base flex items-center justify-center gap-3 relative overflow-hidden cursor-pointer"
                      style={{
                        background: 'var(--acc,#a77dff)',
                        boxShadow: '0 16px 40px -14px var(--acc,#a77dff)'
                      }}
                    >
                      <motion.div
                        className="absolute inset-0"
                        style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)' }}
                        animate={{ x: ['-100%', '100%'] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      />
                      <FolderOpen size={18} />
                      {t('ui.fx.openExtracted')}
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={onDismiss}
                      className="w-full py-3.5 rounded-2xl font-medium text-sm cursor-pointer"
                      style={{
                        background: COLORS.bgHover,
                        border: `1px solid ${COLORS.border}`,
                        color: COLORS.textSecondary
                      }}
                    >
                      {t('ui.common.close')}
                    </motion.button>
                  </>
                )}

                {extractStatus === 'error' && (
                  <>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleExtract}
                      className="w-full py-4 rounded-2xl font-bold  text-base flex items-center justify-center gap-3 cursor-pointer"
                      style={{
                        background: 'var(--acc,#a77dff)',
                        boxShadow: '0 16px 40px -14px var(--acc,#a77dff)'
                      }}
                    >
                      <Package size={18} />
                      {t('ui.fx.tryAgain')}
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleOpenDownloadFolder}
                      className="w-full py-3.5 rounded-2xl font-medium text-sm flex items-center justify-center gap-2 cursor-pointer"
                      style={{
                        background: COLORS.bgHover,
                        border: `1px solid ${COLORS.border}`,
                        color: COLORS.textSecondary
                      }}
                    >
                      <FolderOpen size={16} />
                      {t('ui.fx.openDlManual')}
                    </motion.button>
                  </>
                )}
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
})
