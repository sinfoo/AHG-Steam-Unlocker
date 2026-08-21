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
            background: 'rgba(0,0,0,0.85)', 
            backdropFilter: 'blur(20px)',
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
            className="relative mx-4 w-[580px] max-w-[95vw] max-h-[80vh] rounded-3xl overflow-hidden flex flex-col"
            style={{ 
              background: `linear-gradient(180deg, ${COLORS.bgCard} 0%, ${COLORS.bgDeep} 100%)`,
              border: `1px solid ${COLORS.border}`,
              boxShadow: `0 25px 80px ${COLORS.violet}30, 0 0 100px rgba(0,0,0,0.5)`
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
                Welcome to v{newVersion}!
              </motion.h2>
              
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-sm mt-1 relative"
                style={{ color: COLORS.textMuted }}
              >
                Here's what's new in this update
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
                      <span className="text-sm font-medium" style={{ color: COLORS.textSecondary }}>View Full Changelog</span>
                      <ChevronRight size={16} style={{ color: COLORS.textMuted }} />
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
                    <ChevronRight size={16} style={{ color: COLORS.textMuted }} className="rotate-180" />
                    <span className="text-sm font-medium" style={{ color: COLORS.textMuted }}>Back to latest</span>
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
                            Latest
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
                whileHover={{ scale: 1.02, boxShadow: `0 4px 20px ${COLORS.violet}40` }}
                whileTap={{ scale: 0.98 }}
                onClick={onClose}
                className="w-full py-3.5 px-5 rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                style={{ 
                  background: `linear-gradient(135deg, ${COLORS.violet} 0%, ${COLORS.violetLight} 100%)`,
                  boxShadow: `0 4px 15px ${COLORS.violet}30`
                }}
              >
                <span className="font-semibold text-white">Get Started</span>
                <ChevronRight size={18} style={{ color: COLORS.white }} />
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
})
