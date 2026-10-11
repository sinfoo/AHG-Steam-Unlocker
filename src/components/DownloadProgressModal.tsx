import { useT } from '../i18n'
import { memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, CheckCircle2, AlertCircle, Download as DownloadIcon } from 'lucide-react'
import type { ColorScheme } from './shared'
import { useModalStore, useDownloadStore, useInstallStore } from '../store'

interface DownloadProgressModalProps {
  colors: ColorScheme
}

export const DownloadProgressModal = memo(function DownloadProgressModal({ colors: COLORS }: DownloadProgressModalProps) {
  const t = useT()
  const downloadModalOpen = useModalStore(s => s.downloadModalOpen)
  const setDownloadModalOpen = useModalStore(s => s.setDownloadModalOpen)
  const downloadProgress = useDownloadStore(s => s.downloadProgress)
  const downloadStatus = useDownloadStore(s => s.downloadStatus)
  const downloadName = useDownloadStore(s => s.downloadName)
  const downloadMessage = useDownloadStore(s => s.downloadMessage)
  const downloadDetails = useDownloadStore(s => s.downloadDetails)
  const cancelActiveDownload = useInstallStore(s => s.cancelActiveDownload)

  return (
    <AnimatePresence>
      {downloadModalOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[300] flex items-center justify-center p-4"
          style={{ background: 'rgba(4,4,10,0.6)', backdropFilter: 'blur(10px)' }}
          onClick={(e) => { if (downloadStatus !== 'downloading') { e.stopPropagation(); setDownloadModalOpen(false); } }}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="w-full max-w-md rounded-[24px] overflow-hidden"
            style={{ background: '#0f0f1b', border: '1px solid rgba(255,255,255,0.09)', boxShadow: '0 60px 120px -30px rgba(0,0,0,1)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 pb-4" style={{ borderBottom: `1px solid ${COLORS.border}40` }}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{
                  background: downloadStatus === 'done' ? `linear-gradient(135deg, ${COLORS.green}30, ${COLORS.green}15)` 
                    : downloadStatus === 'error' ? `linear-gradient(135deg, ${COLORS.red}30, ${COLORS.red}15)`
                    : `linear-gradient(135deg, ${COLORS.blue}30, ${COLORS.blue}15)`
                }}>
                  {downloadStatus === 'done' ? (
                    <CheckCircle2 size={24} style={{ color: COLORS.green }} />
                  ) : downloadStatus === 'error' ? (
                    <AlertCircle size={24} style={{ color: COLORS.red }} />
                  ) : (
                    <DownloadIcon size={24} style={{ color: COLORS.blue }} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold truncate" style={{ color: COLORS.text }}>
                    {downloadStatus === 'done' ? t('ui.dl.complete')
                      : downloadStatus === 'error' ? t('ui.dl.failed')
                      : t('ui.dl.downloading')}
                  </h3>
                  <p className="text-sm truncate" style={{ color: COLORS.textMuted }}>{downloadName}</p>
                </div>
                {downloadStatus !== 'downloading' && (
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setDownloadModalOpen(false)}
                    aria-label={t('ui.common.close')}
                    className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ background: COLORS.bgHover }}
                  >
                    <X size={16} style={{ color: COLORS.textMuted }} />
                  </motion.button>
                )}
              </div>
            </div>

            {/* Progress Section */}
            <div className="p-6 space-y-4">
              {/* Progress Bar */}
              <div className="relative">
                <div className="h-3 rounded-full overflow-hidden" style={{ background: COLORS.bgHover }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      background: downloadStatus === 'done' ? COLORS.green 
                        : downloadStatus === 'error' ? COLORS.red
                        : `linear-gradient(90deg, ${COLORS.blue}, ${COLORS.violet})`
                    }}
                    initial={{ width: '0%' }}
                    animate={{ width: `${downloadProgress}%` }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                  />
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-xs font-medium" style={{ color: COLORS.textMuted }}>{downloadMessage}</span>
                  <span className="text-xs font-bold" style={{ color: downloadStatus === 'done' ? COLORS.green 
                    : downloadStatus === 'error' ? COLORS.red : COLORS.blue }}>
                    {downloadProgress}%
                  </span>
                </div>
              </div>

              {/* Download Stats During Download */}
              {downloadStatus === 'downloading' && (
                <div className="space-y-3 py-2">
                  {/* File Size & Speed Row */}
                  {downloadDetails && downloadDetails.totalSize > 0 && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-2.5 rounded-xl" style={{ background: COLORS.bgHover, border: `1px solid ${COLORS.border}40` }}>
                        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: COLORS.textMuted }}>{t('ui.dl.fileSize')}</p>
                        <p className="text-sm font-bold" style={{ color: COLORS.text }}>{(downloadDetails.totalSize / (1024 * 1024)).toFixed(1)} MB</p>
                      </div>
                      <div className="p-2.5 rounded-xl" style={{ background: COLORS.bgHover, border: `1px solid ${COLORS.border}40` }}>
                        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: COLORS.textMuted }}>{t('ui.dl.speed')}</p>
                        <p className="text-sm font-bold" style={{ color: COLORS.cyan }}>
                          {downloadDetails.speed > 1048576 
                            ? `${(downloadDetails.speed / (1024 * 1024)).toFixed(1)} MB/s`
                            : downloadDetails.speed > 1024 
                              ? `${(downloadDetails.speed / 1024).toFixed(0)} KB/s`
                              : `${downloadDetails.speed.toFixed(0)} B/s`
                          }
                        </p>
                      </div>
                    </div>
                  )}
                  {/* Downloaded / Total */}
                  {downloadDetails && downloadDetails.totalSize > 0 && (
                    <div className="p-2.5 rounded-xl flex items-center justify-between" style={{ background: COLORS.bgHover, border: `1px solid ${COLORS.border}40` }}>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: COLORS.textMuted }}>{t('ui.dl.downloaded')}</p>
                        <p className="text-sm font-bold" style={{ color: COLORS.text }}>
                          {(downloadDetails.downloaded / (1024 * 1024)).toFixed(1)} MB
                        </p>
                      </div>
                      <div className="text-end">
                        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: COLORS.textMuted }}>{t('ui.dl.of')}</p>
                        <p className="text-sm font-bold" style={{ color: COLORS.violet }}>
                          {(downloadDetails.totalSize / (1024 * 1024)).toFixed(1)} MB
                        </p>
                      </div>
                    </div>
                  )}
                  {(!downloadDetails || downloadDetails.totalSize === 0) && (
                    <div className="flex items-center gap-2">
                      <motion.div
                        className="w-2 h-2 rounded-full"
                        style={{ background: COLORS.blue }}
                        animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 1, repeat: Infinity, delay: 0 }}
                      />
                      <motion.div
                        className="w-2 h-2 rounded-full"
                        style={{ background: COLORS.violet }}
                        animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                      />
                      <motion.div
                        className="w-2 h-2 rounded-full"
                        style={{ background: COLORS.cyan }}
                        animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                      />
                      <span className="text-sm ms-2" style={{ color: COLORS.textMuted }}>{t('ui.dl.fetching')}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Success/Error Details */}
              {(downloadStatus === 'done' || downloadStatus === 'error') && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-xl"
                  style={{ 
                    background: downloadStatus === 'done' ? COLORS.greenDim : COLORS.redDim,
                    border: `1px solid ${downloadStatus === 'done' ? COLORS.green + '30' : COLORS.red + '30'}`
                  }}
                >
                  <p className="text-sm font-medium" style={{ 
                    color: downloadStatus === 'done' ? COLORS.green : COLORS.red 
                  }}>
                    {downloadMessage}
                  </p>
                </motion.div>
              )}

              {/* Action Button */}
              <div className="pt-2">
                {downloadStatus === 'downloading' ? (
                  <div className="flex gap-2">
                    <button
                      className="flex-1 py-3 rounded-xl font-semibold text-sm cursor-wait"
                      style={{ 
                        background: `linear-gradient(135deg, ${COLORS.blue}40, ${COLORS.blue}20)`,
                        color: COLORS.blue,
                        border: `1px solid ${COLORS.blue}30`
                      }}
                      disabled
                    >
                      {t('ui.dl.inProgress')}
                    </button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => { cancelActiveDownload(); setDownloadModalOpen(false); }}
                      className="px-4 py-3 rounded-xl font-semibold text-sm cursor-pointer"
                      style={{ 
                        background: COLORS.bgHover,
                        color: COLORS.textSecondary,
                        border: `1px solid ${COLORS.border}`
                      }}
                    >
                      {t('ui.common.cancel')}
                    </motion.button>
                  </div>
                ) : (
                  <motion.button
                    onClick={() => setDownloadModalOpen(false)}
                    className="w-full py-3 rounded-xl font-semibold text-sm cursor-pointer"
                    style={{ 
                      background: downloadStatus === 'done' 
                        ? 'var(--acc,#a77dff)'
                        : `linear-gradient(135deg, ${COLORS.red}, ${COLORS.red}cc)`,
                      color: downloadStatus === 'done' ? '#0b0614' : 'white',
                      boxShadow: `0 4px 16px ${downloadStatus === 'done' ? COLORS.greenDim : COLORS.redDim}`
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {downloadStatus === 'done' ? t('ui.common.done') : t('ui.common.close')}
                  </motion.button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
})
