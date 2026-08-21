import { memo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Trophy, Zap, Check } from 'lucide-react'
import type { ColorScheme } from './shared'
import { Achievement } from '../types'
import { useUserStore, useInstalledGames } from '../store'

interface AchievementsModalProps {
  colors: ColorScheme
  achievements: Achievement[]
}

export const AchievementsModal = memo(function AchievementsModal({ colors: COLORS, achievements }: AchievementsModalProps) {
  const showAchievements = useUserStore(s => s.showAchievements)
  const setShowAchievements = useUserStore(s => s.setShowAchievements)
  const userXP = useUserStore(s => s.userXP)
  const userLevel = Math.floor(userXP / 100) + 1
  const xpForCurrentLevel = userXP % 100

  // ── Filter state ──
  const [activeFilter, setActiveFilter] = useState<'all' | 'unlocked' | 'locked'>('all')
  const [showMyGames, setShowMyGames] = useState(false)
  const installedGames = useInstalledGames()
  const installedGameIds = new Set(installedGames.map(g => g.appid))

  // Derived filtered list
  const filteredAchievements = achievements.filter(a => {
    // Unlocked/Locked filter
    if (activeFilter === 'unlocked' && !a.unlocked) return false
    if (activeFilter === 'locked' && a.unlocked) return false

    // Show My Games filter
    if (showMyGames) {
      const gameIds = (a as any).gameIds as string[] | undefined
      // If the achievement references specific games, check ownership
      if (gameIds && gameIds.length > 0) {
        return gameIds.some(id => installedGameIds.has(id))
      }
      // No gameIds = global achievement, always show
    }

    return true
  })

  return (
    <AnimatePresence>
      {showAchievements && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}
          onClick={() => setShowAchievements(false)}
        >
          <motion.div
            initial={{ scale: 0.9, y: 30 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 30 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="w-full max-w-4xl max-h-[85vh] rounded-3xl overflow-hidden flex flex-col"
            style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, boxShadow: `0 32px 100px rgba(0,0,0,0.6), 0 0 80px ${COLORS.amber}15` }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 pb-4 relative" style={{ borderBottom: `1px solid ${COLORS.border}` }}>
              {/* Animated rainbow bar */}
              <div className="absolute top-0 left-0 right-0 h-[2px]" style={{
                background: `linear-gradient(90deg, ${COLORS.amber}, ${COLORS.pink}, ${COLORS.violet}, ${COLORS.cyan}, ${COLORS.green}, ${COLORS.amber})`,
                backgroundSize: '200% 100%',
                animation: 'shimmer 3s linear infinite'
              }} />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${COLORS.amber}30 0%, ${COLORS.amber}10 100%)`, border: `1px solid ${COLORS.amber}40` }}>
                    <Trophy size={28} style={{ color: COLORS.amber }} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">Achievements</h2>
                    <p className="text-sm" style={{ color: COLORS.textMuted }}>Track your progress and unlock challenges</p>
                  </div>
                </div>
                <button
                  className="w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer hover:bg-white/10 transition-colors"
                  onClick={() => setShowAchievements(false)}
                >
                  <X size={20} style={{ color: COLORS.textMuted }} />
                </button>
              </div>

              {/* Level & Progress Overview */}
              <div className="mt-5 space-y-4">
                {/* Level Badge */}
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ 
                      background: `linear-gradient(135deg, ${COLORS.amber}40, ${COLORS.amber}20)`,
                      border: `2px solid ${COLORS.amber}60`,
                      boxShadow: `0 0 32px ${COLORS.amber}30`
                    }}>
                      <span className="text-2xl font-bold text-white">{userLevel}</span>
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: COLORS.bgCard, border: `2px solid ${COLORS.amber}` }}>
                      <Zap size={12} style={{ color: COLORS.amber }} />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold text-white">Level {userLevel}</span>
                      <span className="text-xs font-bold" style={{ color: COLORS.amber }}>
                        {xpForCurrentLevel}/100 XP
                      </span>
                    </div>
                    <div className="h-3 rounded-full overflow-hidden" style={{ background: COLORS.bgDeep }}>
                      <motion.div 
                        className="h-full rounded-full"
                        style={{ 
                          background: `linear-gradient(90deg, ${COLORS.amber}, ${COLORS.violet})`,
                        }}
                        animate={{ width: `${xpForCurrentLevel}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                    <p className="text-xs mt-1" style={{ color: COLORS.textMuted }}>Total XP: {userXP}</p>
                  </div>
                </div>

                {/* Achievements Progress */}
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-white">Achievements</span>
                      <span className="text-sm font-bold" style={{ color: COLORS.amber }}>
                        {achievements.filter(a => a.unlocked).length} / {achievements.length}
                      </span>
                    </div>
                    <div className="h-3 rounded-full overflow-hidden" style={{ background: COLORS.bgDeep }}>
                      <div 
                        className="progress-bar-animated h-full rounded-full transition-all duration-150"
                        style={{ 
                          width: `${(achievements.filter(a => a.unlocked).length / achievements.length) * 100}%`,
                          background: `linear-gradient(90deg, ${COLORS.green}, ${COLORS.amber})`
                        }}
                      />
                    </div>
                  </div>
                  <div className="px-4 py-2 rounded-xl text-center" style={{ background: COLORS.amber + '15', border: `1px solid ${COLORS.amber}30` }}>
                    <div className="text-lg font-bold" style={{ color: COLORS.amber }}>
                      {Math.round((achievements.filter(a => a.unlocked).length / achievements.length) * 100)}%
                    </div>
                    <div className="text-xs font-bold uppercase tracking-wider" style={{ color: COLORS.amber + '90' }}>Complete</div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Filter Bar ── */}
            <div className="px-6 pt-4 pb-2 flex items-center justify-between gap-4 flex-wrap">
              {/* Filter Buttons */}
              <div className="flex items-center gap-2">
                {(['all', 'unlocked', 'locked'] as const).map((filter) => {
                  const isActive = activeFilter === filter
                  const label = filter === 'all' ? 'All' : filter === 'unlocked' ? 'Unlocked' : 'Locked'
                  return (
                    <button
                      key={filter}
                      onClick={() => setActiveFilter(filter)}
                      className="px-4 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer transition-all duration-150"
                      style={{
                        background: isActive
                          ? `linear-gradient(135deg, ${COLORS.amber}30, ${COLORS.amber}15)`
                          : 'transparent',
                        color: isActive ? COLORS.amber : COLORS.textMuted,
                        border: `1px solid ${isActive ? `${COLORS.amber}50` : COLORS.border}`,
                        boxShadow: isActive ? `0 0 20px ${COLORS.amber}20` : 'none',
                      }}
                    >
                      {label}
                      {filter === 'all' && (
                        <span className="ml-1.5 text-xs opacity-60">({achievements.length})</span>
                      )}
                      {filter === 'unlocked' && (
                        <span className="ml-1.5 text-xs opacity-60">({achievements.filter(a => a.unlocked).length})</span>
                      )}
                      {filter === 'locked' && (
                        <span className="ml-1.5 text-xs opacity-60">({achievements.filter(a => !a.unlocked).length})</span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Show My Games Toggle */}
              <label
                className="flex items-center gap-2 cursor-pointer select-none group"
                onClick={() => setShowMyGames(!showMyGames)}
              >
                <div
                  className="relative w-10 h-5 rounded-full transition-all duration-200"
                  style={{
                    background: showMyGames
                      ? `linear-gradient(135deg, ${COLORS.amber}, ${COLORS.violet})`
                      : COLORS.bgDeep,
                    border: `1px solid ${showMyGames ? `${COLORS.amber}60` : COLORS.border}`,
                  }}
                >
                  <motion.div
                    className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-lg"
                    animate={{ left: showMyGames ? '22px' : '2px' }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: showMyGames ? COLORS.amber : COLORS.textMuted }}>
                  Show My Games
                </span>
              </label>
            </div>

            {/* Achievement Grid */}
            <div className="flex-1 overflow-y-auto p-6 pt-2">
              {/* Group by category */}
              {Object.entries(
                filteredAchievements.reduce((acc, a) => {
                  const cat = a.category || 'Other'
                  if (!acc[cat]) acc[cat] = []
                  acc[cat].push(a)
                  return acc
                }, {} as Record<string, typeof achievements>)
              ).map(([category, items]) => (
                <div key={category} className="mb-6">
                  <h3 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: COLORS.textMuted }}>{category}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {items.map((achievement) => {
                      const progress = Math.min(achievement.progress, achievement.maxProgress)
                      const pct = achievement.maxProgress > 0 ? (progress / achievement.maxProgress) * 100 : 0
                      return (
                        <div
                          key={achievement.id}
                          className="achievement-card rounded-2xl p-4 relative overflow-hidden"
                          style={{
                            background: achievement.unlocked 
                              ? `linear-gradient(135deg, ${COLORS.amber}20 0%, ${COLORS.amber}08 100%)` 
                              : `${COLORS.bgDeep}`,
                            border: `1px solid ${achievement.unlocked ? `${COLORS.amber}60` : COLORS.border}`,
                            boxShadow: achievement.unlocked 
                              ? `0 8px 32px ${COLORS.amber}25, 0 0 0 1px ${COLORS.amber}20` 
                              : 'none'
                          }}
                        >
                          {achievement.unlocked && (
                            <div className="absolute top-0 right-0 w-10 h-10 flex items-center justify-center">
                              <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: COLORS.green, boxShadow: `0 0 16px ${COLORS.green}60` }}>
                                <Check size={16} className="text-white" strokeWidth={3} />
                              </div>
                            </div>
                          )}
                          <div className="flex items-start gap-3">
                            <div className="text-3xl flex-shrink-0" style={{ filter: achievement.unlocked ? 'none' : 'grayscale(1) opacity(0.4)' }}>
                              {achievement.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-bold text-white text-sm truncate">{achievement.name}</h4>
                              </div>
                              <p className="text-xs mb-3" style={{ color: achievement.unlocked ? COLORS.textSecondary : COLORS.textDim }}>{achievement.desc}</p>
                              {/* Progress Bar */}
                              <div className="h-2 rounded-full overflow-hidden" style={{ background: COLORS.bgCard }}>
                                <div
                                  className="h-full rounded-full transition-all duration-100"
                                  style={{ 
                                    width: `${pct}%`,
                                    background: achievement.unlocked 
                                      ? `linear-gradient(90deg, ${COLORS.green}, ${COLORS.amber})` 
                                      : COLORS.amber + '60'
                                  }}
                                />
                              </div>
                              <div className="flex items-center justify-between mt-1.5">
                                <span className="text-xs font-bold" style={{ color: COLORS.textDim }}>
                                  {achievement.maxProgress === 1 ? (achievement.unlocked ? 'Unlocked' : 'Locked') : `${progress} / ${achievement.maxProgress}`}
                                </span>
                                {achievement.unlocked && (
                                  <span className="text-xs font-bold" style={{ color: COLORS.amber }}>+10 XP</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
})
