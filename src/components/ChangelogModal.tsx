import { useT } from '../i18n'
import { memo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, Sparkles, Zap, Clock, Wrench } from 'lucide-react'
import { COLORS } from '../constants/colors'

type ChangelogItem = {
  type: 'feature' | 'fix' | 'improvement' | 'note'
  title: string
  description: string
}

type Changelog = {
  version: string
  date: string
  items: ChangelogItem[]
}

const CHANGELOGS: Changelog[] = [
  {
    version: '1.2.8',
    date: '2026-10-19',
    items: [
      { type: 'fix', title: 'Activation always reachable', description: 'License keys are checked directly against the key registry, so activation no longer fails with "Could not reach the license server".' },
      { type: 'fix', title: 'Paste keys with dashes', description: 'Pasting ABCD-ABCD-ABCD-ABCD now works the same as ABCDABCDABCDABCD.' },
      { type: 'fix', title: 'New keys work right away', description: 'A key created a moment ago is no longer reported as invalid.' },
      { type: 'improvement', title: 'Smoother updates', description: 'Updates now install through AHG Setup with no installer wizard.' },
    ],
  },
  {
    version: '1.2.7',
    date: '2026-10-16',
    items: [
      { type: 'fix', title: 'Smooth first launch', description: 'After a fresh install the loading screen now waits for the game catalogue instead of showing an empty app and restarting the splash.' },
      { type: 'fix', title: 'Resizable installer', description: 'The setup window scales with your display and can be resized.' },
      { type: 'improvement', title: 'Cleaner code', description: 'Removed unused code from the app.' },
    ],
  },
  {
    version: '1.2.6',
    date: '2026-10-16',
    items: [
      { type: 'fix', title: 'Updates install reliably', description: 'Fixed updates that downloaded but never installed, or installed without replacing the old files.' },
      { type: 'fix', title: 'One window only', description: 'Opening AHG Unlocker twice now brings the existing window to the front instead of starting a second copy.' },
      { type: 'fix', title: 'No more flickering progress', description: 'Only one update download can run at a time.' },
    ],
  },
  {
    version: '1.2.5',
    date: '2026-10-16',
    items: [
      { type: 'fix', title: 'Update progress', description: 'The update download bar no longer sticks at 0%, and you can cancel a download.' },
      { type: 'fix', title: 'Update install', description: 'Fixed "could not install ... app.asar" when installing an update from the zip package.' },
      { type: 'improvement', title: 'Faster and lighter', description: 'Faster startup, fewer UI freezes, smaller disk footprint (logs, caches and leftover update files are now cleaned up).' },
    ],
  },
  {
    version: '1.2.4',
    date: '2026-10-16',
    items: [
      { type: 'feature', title: 'AHG Plus mode', description: 'New unlock mode in Settings > AHG Tools. Switching closes and restarts Steam for you and shows live progress.' },
      { type: 'feature', title: 'New installer', description: 'AHG Unlocker now installs with a proper Windows installer: pick the folder and shortcuts, uninstall from Settings > Apps.' },
      { type: 'improvement', title: 'Seamless updates', description: 'Updates download, verify and install themselves, then restart the app automatically.' },
      { type: 'improvement', title: 'Smaller download', description: 'The app package is about half the size it was.' },
      { type: 'fix', title: 'More reliable downloads', description: 'GitHub downloads fall back to a CDN mirror when GitHub is unreachable, and manifests from a custom depotcache are migrated.' },
    ],
  },
  {
    version: '0.5',
    date: '2024-04-23',
    items: [
      { type: 'feature', title: 'Update Checker', description: 'Built-in update checker that checks GitHub for new releases automatically' },
      { type: 'feature', title: 'Download Manager', description: 'Download new versions directly from the app without opening a browser' },
      { type: 'feature', title: 'Changelog Viewer', description: 'View what\'s new when updating to a new version for the first time' },
      { type: 'improvement', title: 'Premium Loading Screen', description: 'Enhanced loading screen with animated orbs, particles, and modern effects' },
      { type: 'improvement', title: '18 Manifest Mirrors', description: 'Increased mirror repositories for better game compatibility' },
    ],
  },
  {
    version: '0.4',
    date: '2024-04-15',
    items: [
      { type: 'feature', title: 'New UI Design', description: 'Completely redesigned premium interface' },
      { type: 'fix', title: 'Improved Validation', description: 'Better appid validation for both string and number formats' },
    ],
  },
]

interface ChangelogModalProps {
  isOpen: boolean
  onClose: () => void
  newVersion: string
}

const typeColors: Record<string, { bg: string; icon: any; color: string }> = {
  feature: { bg: COLORS.violet, icon: Zap, color: COLORS.violet },
  fix: { bg: COLORS.green, icon: Wrench, color: COLORS.green },
  improvement: { bg: COLORS.blue, icon: Sparkles, color: COLORS.blue },
  note: { bg: COLORS.amber, icon: Clock, color: COLORS.amber },
}

export const ChangelogModal = memo(function ChangelogModal({ isOpen, onClose, newVersion }: ChangelogModalProps) {
  const t = useT()
  const [showFullChangelog, setShowFullChangelog] = useState(false)
  
  const getChangelog = () => {
    return CHANGELOGS.find(c => c.version === newVersion) || CHANGELOGS[0]
  }
  
  const currentChangelog = getChangelog()

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex"
          style={{ 
            background: 'rgba(4,4,10,0.6)', 
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 30 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="relative mx-4 w-[580px] max-w-[95vw] max-h-[80vh] rounded-[24px] overflow-hidden flex flex-col"
            style={{ 
              background: '#0f0f1b',
              border: '1px solid rgba(255,255,255,0.09)',
              boxShadow: '0 60px 120px -30px rgba(0,0,0,1)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="relative px-6 py-6 text-center shrink-0" style={{ borderBottom: `1px solid ${COLORS.border}50` }}>
              {/* Glow Effect */}
              <motion.div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full"
                style={{ background: `radial-gradient(circle, ${COLORS.violet}30 0%, transparent 70%)`, filter: 'blur(30px)' }}
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.1 }}
                className="relative w-20 h-20 mx-auto rounded-3xl flex items-center justify-center mb-4"
                style={{ 
                  background: `linear-gradient(135deg, ${COLORS.violet} 0%, ${COLORS.blue} 100%)`,
                  boxShadow: `0 8px 40px ${COLORS.violet}50`
                }}
              >
                <Sparkles size={36} style={{ color: COLORS.white }} />
              </motion.div>
              
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-2xl font-bold text-white relative"
              >
                {t('ui.cl.welcome', { v: newVersion })}
              </motion.h2>
              
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-sm mt-1 relative"
                style={{ color: COLORS.textMuted }}
              >
                {t('ui.cl.whatsNew')}
              </motion.p>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {!showFullChangelog ? (
                <>
                  {currentChangelog!.items.map((item, index) => {
                    const typeStyle = (typeColors[item.type] || typeColors.note)!
                    return (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 + index * 0.1 }}
                        className="flex items-start gap-4 p-4 rounded-2xl"
                        style={{ 
                          background: `${typeStyle.bg}10`,
                          border: `1px solid ${typeStyle.bg}30`
                        }}
                      >
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${typeStyle.bg}25` }}>
                          <typeStyle.icon size={18} style={{ color: typeStyle.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-semibold">{item.title}</p>
                          <p className="text-sm mt-0.5" style={{ color: COLORS.textSecondary }}>{item.description}</p>
                        </div>
                      </motion.div>
                    )
                  })}
                  
                  {CHANGELOGS.length > 1 && (
                    <motion.button
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.5 }}
                      whileHover={{ scale: 1.02, backgroundColor: COLORS.violet + '15' }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setShowFullChangelog(true)}
                      className="w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2"
                      style={{ 
                        background: COLORS.bgHover,
                        border: `1px solid ${COLORS.border}`
                      }}
                    >
                      <span className="text-sm font-medium" style={{ color: COLORS.textSecondary }}>{t('ui.cl.viewFull')}</span>
                      <ChevronRight size={16} style={{ color: COLORS.textMuted }} className="rtl-flip" />
                    </motion.button>
                  )}
                </>
              ) : (
                <>
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    whileHover={{ scale: 1.02, x: -4 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowFullChangelog(false)}
                    className="flex items-center gap-2 py-2 px-3 rounded-xl cursor-pointer mb-2"
                    style={{ background: 'transparent' }}
                  >
                    <ChevronRight size={16} style={{ color: COLORS.textMuted }} className="rotate-180 rtl-flip" />
                    <span className="text-sm font-medium" style={{ color: COLORS.textMuted }}>{t('ui.cl.back')}</span>
                  </motion.button>
                  
                  {CHANGELOGS.map((changelog, ci) => (
                    <div key={ci} className="mb-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="font-bold text-white">v{changelog.version}</span>
                        <span className="text-xs px-2 py-0.5 rounded-lg" style={{ background: COLORS.violet + '20', color: COLORS.violet }}>
                          {changelog.date}
                        </span>
                        {ci === 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-lg" style={{ background: COLORS.green + '20', color: COLORS.green }}>
                            {t('ui.cl.latest')}
                          </span>
                        )}
                      </div>
                      <div className="space-y-2">
                        {changelog.items.map((item, index) => {
                          const typeStyle = (typeColors[item.type] || typeColors.note)!
                          return (
                            <motion.div
                              key={index}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: ci * 0.1 + index * 0.05 }}
                              className="flex items-start gap-3 p-3 rounded-xl"
                              style={{ background: COLORS.bgHover }}
                            >
                              <typeStyle.icon size={14} style={{ color: typeStyle.color }} className="mt-0.5" />
                              <div>
                                <p className="text-sm font-medium text-white">{item.title}</p>
                                <p className="text-xs" style={{ color: COLORS.textMuted }}>{item.description}</p>
                              </div>
                            </motion.div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="p-5 shrink-0" style={{ borderTop: `1px solid ${COLORS.border}50` }}>
              <motion.button
                whileHover={{ scale: 1.02, boxShadow: '0 16px 40px -14px var(--acc,#a77dff)' }}
                whileTap={{ scale: 0.98 }}
                onClick={onClose}
                className="w-full py-3.5 px-5 rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                style={{ 
                  background: 'var(--acc,#a77dff)',
                  boxShadow: `0 4px 15px ${COLORS.violet}30`
                }}
              >
                <span className="font-semibold ">{t('ui.cl.getStarted')}</span>
                <ChevronRight size={18} style={{ color: '#0b0614' }} className="rtl-flip" />
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
})
