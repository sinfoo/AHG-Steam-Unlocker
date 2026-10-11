import { t as tNow, type TKey } from '../i18n'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useUserStore } from '../store/userStore'
import { useGameStore } from '../store/gameStore'
import type { Achievement } from '../types'

const trk = (k: string, fb: string) => { const r = tNow(k as TKey); return r === k ? fb : r }
/** Display strings only; ids stay English. */
export const achName = (a: { id: string; name: string }) => trk(`ui.ach.${a.id}.n`, a.name)
export const achDesc = (a: { id: string; desc: string }) => trk(`ui.ach.${a.id}.d`, a.desc)
export const achCategory = (c: string) => trk('ui.ach.cat.' + c.toLowerCase().replace(/\s+/g, ''), c)

/**
 * AHG Unlocker achievement system.
 * 29 core-aligned achievements tracked via:
 *   - Passive effects (time, navigation, search, session)
 *   - Active tracker callbacks (from App.tsx action hooks)
 *   - Automatic unlock detection => XP + toast + IPC persist
 */
export function useAchievements(
  showToast: (message: string, type: string) => void,
  playSound: (type: 'achievement') => void,
  currentPage: string,
  searchQuery: string,
  loading: boolean
) {
  // -- 29 Unlocker-themed achievement definitions --
  const [achievements, setAchievements] = useState<Achievement[]>([
    // -- The Awakening (Getting Started) --
    { id: 'first_install', name: 'First Injection', desc: 'Unlock your first game via manifest injection', icon: '🎯', unlocked: false, progress: 0, maxProgress: 1, category: 'The Awakening', xp: 10 },
    { id: 'first_dlc', name: 'DLC Initiate', desc: 'Install DLC for the first time', icon: '🧩', unlocked: false, progress: 0, maxProgress: 1, category: 'The Awakening', xp: 15 },
    { id: 'first_fix', name: 'Hotfix', desc: 'Apply your first fix', icon: '🔧', unlocked: false, progress: 0, maxProgress: 1, category: 'The Awakening', xp: 15 },

    // -- Unlocker (Game install milestones) --
    { id: 'install_10', name: 'Apprentice Unlocker', desc: 'Unlock 10 games', icon: '🎮', unlocked: false, progress: 0, maxProgress: 10, category: 'Unlocker', xp: 25 },
    { id: 'install_25', name: 'Seasoned Unlocker', desc: 'Unlock 25 games', icon: '🕹️', unlocked: false, progress: 0, maxProgress: 25, category: 'Unlocker', xp: 40 },
    { id: 'install_50', name: 'Expert Unlocker', desc: 'Unlock 50 games', icon: '⚡', unlocked: false, progress: 0, maxProgress: 50, category: 'Unlocker', xp: 60 },
    { id: 'install_100', name: 'Grandmaster Unlocker', desc: 'Unlock 100 games', icon: '👑', unlocked: false, progress: 0, maxProgress: 100, category: 'Unlocker', xp: 100 },

    // -- DLC --
    { id: 'dlc_10', name: 'DLC Collector', desc: 'Install 10 DLCs', icon: '📦', unlocked: false, progress: 0, maxProgress: 10, category: 'DLC', xp: 25 },
    { id: 'dlc_50', name: 'DLC Hoarder', desc: 'Install 50 DLCs', icon: '🗃️', unlocked: false, progress: 0, maxProgress: 50, category: 'DLC', xp: 50 },

    // -- Fixer --
    { id: 'fix_10', name: 'Patch Apprentice', desc: 'Apply 10 fixes', icon: '🛠️', unlocked: false, progress: 0, maxProgress: 10, category: 'Fixer', xp: 25 },
    { id: 'fix_50', name: 'Fix Architect', desc: 'Apply 50 fixes', icon: '⚒️', unlocked: false, progress: 0, maxProgress: 50, category: 'Fixer', xp: 50 },
    { id: 'fix_100', name: 'The Legendary Fixer', desc: 'Apply 100 fixes', icon: '🔩', unlocked: false, progress: 0, maxProgress: 100, category: 'Fixer', xp: 80 },

    // -- Library --
    { id: 'lib_15', name: 'Growing Library', desc: 'Have 15 games installed', icon: '📚', unlocked: false, progress: 0, maxProgress: 15, category: 'Library', xp: 30 },
    { id: 'lib_50', name: 'Full Library', desc: 'Have 50 games installed', icon: '📖', unlocked: false, progress: 0, maxProgress: 50, category: 'Library', xp: 60 },
    { id: 'lib_100', name: 'Library of Alexandria', desc: 'Have 100 games installed', icon: '📕', unlocked: false, progress: 0, maxProgress: 100, category: 'Library', xp: 100 },

    // -- Community (Collections + Favorites) --
    { id: 'col_1', name: 'Curator', desc: 'Create your first collection', icon: '📁', unlocked: false, progress: 0, maxProgress: 1, category: 'Community', xp: 20 },
    { id: 'col_5', name: 'Collection Master', desc: 'Create 5 collections', icon: '📂', unlocked: false, progress: 0, maxProgress: 5, category: 'Community', xp: 40 },
    { id: 'fav_10', name: 'Fan Favorite', desc: 'Save 10 favorites', icon: '❤️', unlocked: false, progress: 0, maxProgress: 10, category: 'Community', xp: 20 },
    { id: 'fav_50', name: 'Superfan', desc: 'Save 50 favorites', icon: '💖', unlocked: false, progress: 0, maxProgress: 50, category: 'Community', xp: 40 },

    // -- Exploration --
    { id: 'scan_1', name: 'Scanner', desc: 'Run your first game scan', icon: '🔍', unlocked: false, progress: 0, maxProgress: 1, category: 'Exploration', xp: 15 },
    { id: 'browse_50', name: 'Explorer', desc: 'Browse 50 game cards', icon: '🔭', unlocked: false, progress: 0, maxProgress: 50, category: 'Exploration', xp: 20 },
    { id: 'browse_200', name: 'Completionist', desc: 'Browse 200 game cards', icon: '🏆', unlocked: false, progress: 0, maxProgress: 200, category: 'Exploration', xp: 40 },

    // -- Power User (Core app workflows) --
    { id: 'batch_install', name: 'Batch Commander', desc: 'Complete a batch install', icon: '📋', unlocked: false, progress: 0, maxProgress: 1, category: 'Power User', xp: 25 },
    { id: 'quick_tool', name: 'Quick Thinker', desc: 'Use Quick Tools', icon: '⚡', unlocked: false, progress: 0, maxProgress: 1, category: 'Power User', xp: 15 },
    { id: 'fix_games_script', name: 'Troubleshooter', desc: 'Run the Fix Games script', icon: '🩺', unlocked: false, progress: 0, maxProgress: 1, category: 'Power User', xp: 20 },

    // -- Special --
    { id: 'night_owl', name: 'Night Owl', desc: 'Use the app after midnight', icon: '🌙', unlocked: false, progress: 0, maxProgress: 1, category: 'Special', xp: 15 },
    { id: 'weekend_warrior', name: 'Weekend Warrior', desc: 'Use the app on a weekend', icon: '🎉', unlocked: false, progress: 0, maxProgress: 1, category: 'Special', xp: 15 },
    { id: 'power_user', name: 'Dedicated', desc: 'Use the app for 30+ minutes in one session', icon: '💪', unlocked: false, progress: 0, maxProgress: 1800, category: 'Special', xp: 40 },
    { id: 'marathoner', name: 'True Believer', desc: 'Use the app for 2+ hours in one session', icon: '🔥', unlocked: false, progress: 0, maxProgress: 7200, category: 'Special', xp: 60 },
  ])

  // -- Store state --
  const { userXP, userStats, favorites } = useUserStore(
    useShallow(s => ({ userXP: s.userXP, userStats: s.userStats, favorites: s.favorites }))
  )
  const setUserXP = useUserStore(s => s.setUserXP)
  const setUserStats = useUserStore(s => s.setUserStats)

  // -- Refs --
  const pagesVisitedRef = useRef<Set<string>>(new Set())
  const searchTermsRef = useRef<Set<string>>(new Set())
  const sessionStartRef = useRef(Date.now())
  const achievementToastQueueRef = useRef<Achievement[]>([])
  const achievementToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevAchievementsRef = useRef<Achievement[]>(achievements)
  const initialSyncDoneRef = useRef(false)
  const achievementsRestoredRef = useRef(false)

  // -- Leveling system --
  const userLevel = Math.floor(userXP / 100) + 1
  const xpForCurrentLevel = userXP % 100
  const xpForNextLevel = 100

  // ==============================================
  //  AUTO-UNLOCK DETECTION => XP + TOAST + SAVE
  // ==============================================
  useEffect(() => {
    const prev = prevAchievementsRef.current
    const justUnlocked = achievements.filter(
      a => a.unlocked && !prev.find(p => p.id === a.id)?.unlocked
    )
    prevAchievementsRef.current = achievements
    if (justUnlocked.length === 0) return

    // Add XP
    const totalXP = justUnlocked.reduce((sum, a) => sum + (a.xp || 0), 0)
    if (totalXP > 0) setUserXP(prevXP => prevXP + totalXP)

    // Play achievement sound
    playSound('achievement')

    // Queue toast(s) with 500ms debounce
    justUnlocked.sort((a, b) => (a.unlockedAt || 0) - (b.unlockedAt || 0))
    for (const ach of justUnlocked) {
      achievementToastQueueRef.current.push(ach)
    }
    if (achievementToastTimerRef.current) clearTimeout(achievementToastTimerRef.current)
    achievementToastTimerRef.current = setTimeout(() => {
      const queue = achievementToastQueueRef.current
      achievementToastQueueRef.current = []
      if (queue.length === 1) {
        const ach = queue[0]!
        showToast(tNow('ui.ach.toast.one', { name: achName(ach), xp: ach.xp || 0 }), 'achievement')
      } else if (queue.length <= 3) {
        const total = queue.reduce((sum, ach) => sum + (ach.xp || 0), 0)
        showToast(tNow('ui.ach.toast.few', { n: queue.length, xp: total, names: queue.map(a => achName(a)).join(', ') }), 'achievement')
      } else {
        const total = queue.reduce((sum, ach) => sum + (ach.xp || 0), 0)
        showToast(tNow('ui.ach.toast.many', { n: queue.length, xp: total }), 'achievement')
      }
    }, 500)

    // Persist to IPC
    window.electronAPI?.saveAchievements?.(
      achievements.map(a => ({ id: a.id, unlocked: a.unlocked, unlockedAt: a.unlockedAt }))
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- showToast omitted intentionally: adding it would re-register the effect on every toast render. window.electronAPI is stable. Effect should fire ONLY when achievements change to persist them.
  }, [achievements])

  // -- Restore persisted achievements on boot --
  // saveAchievements writes {id, unlocked, unlockedAt} to disk, but nothing read it back,
  // so every unlock reset on the next launch. Load + merge the saved unlocked state here.
  useEffect(() => {
    if (achievementsRestoredRef.current) return
    achievementsRestoredRef.current = true
    window.electronAPI?.getAchievements?.().then((saved: any) => {
      if (!Array.isArray(saved) || saved.length === 0) return
      const byId = new Map<string, any>(saved.map((s: any) => [s.id, s]))
      setAchievements(prev => {
        const merged = prev.map(a => {
          const s = byId.get(a.id)
          return s?.unlocked
            ? { ...a, unlocked: true, unlockedAt: s.unlockedAt || a.unlockedAt || Date.now(), progress: a.maxProgress }
            : a
        })
        // Seed the "previous" snapshot so restored unlocks don't re-fire toasts on boot.
        prevAchievementsRef.current = merged
        return merged
      })
    }).catch(() => {})
  }, [])

  // ==============================================
  //  PASSIVE TRACKING EFFECTS
  // ==============================================

  // -- Time-based: first boot, night owl, weekend warrior --
  useEffect(() => {
    const hour = new Date().getHours()
    const day = new Date().getDay()
    setAchievements(prev => prev.map(a => {
      if (a.id === 'night_owl' && !a.unlocked && hour >= 0 && hour < 5)
        return { ...a, progress: 1, unlocked: true, unlockedAt: Date.now() }
      if (a.id === 'weekend_warrior' && !a.unlocked && (day === 0 || day === 6))
        return { ...a, progress: 1, unlocked: true, unlockedAt: Date.now() }
      return a
    }))
  }, [])

  // -- Page visits --
  useEffect(() => {
    pagesVisitedRef.current.add(currentPage)
  }, [currentPage])

  // -- Search terms --
  useEffect(() => {
    if (searchQuery.trim().length > 2) {
      searchTermsRef.current.add(searchQuery.trim().toLowerCase())
    }
  }, [searchQuery])

  // -- Session time: power_user (Dedicated), marathoner (True Believer) (every 60s) --
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - sessionStartRef.current) / 1000)
      setAchievements(prev => {
        let changed = false
        const next = prev.map(a => {
          if (a.id === 'power_user' && !a.unlocked) {
            const newU = elapsed >= a.maxProgress
            if (newU !== a.unlocked) changed = true
            return { ...a, progress: elapsed, unlocked: newU, unlockedAt: newU ? Date.now() : a.unlockedAt }
          }
          if (a.id === 'marathoner' && !a.unlocked) {
            const newU = elapsed >= a.maxProgress
            if (newU !== a.unlocked) changed = true
            return { ...a, progress: elapsed, unlocked: newU, unlockedAt: newU ? Date.now() : a.unlockedAt }
          }
          return a
        })
        return changed ? next : prev
      })
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  // ==============================================
  //  INITIAL STATE SYNC (from stores + IPC)
  // ==============================================

  // -- Load persisted user stats --
  useEffect(() => {
    if (!loading) {
      window.electronAPI?.getUserStats?.().then((stats: any) => {
        if (stats) setUserStats(stats)
      })
    }
  }, [loading, setUserStats])

  // -- On mount: sync achievements with current aggregate state --
  useEffect(() => {
    if (loading || initialSyncDoneRef.current) return
    initialSyncDoneRef.current = true

    const installedCount = useGameStore.getState().installedGames?.length || 0
    const favCount = favorites.size
    const totalInstalls = userStats.totalInstalls || 0
    const fixesApplied = userStats.fixesApplied || 0

    setAchievements(prev => {
      let changed = false
      const next = prev.map(a => {
        let progress = a.progress

        // Install count milestones
        if (['install_10', 'install_25', 'install_50', 'install_100'].includes(a.id)) {
          progress = Math.max(progress, Math.min(totalInstalls, a.maxProgress))
        }
        // Library milestones
        if (['lib_15', 'lib_50', 'lib_100'].includes(a.id)) {
          progress = Math.max(progress, Math.min(installedCount, a.maxProgress))
        }
        // Favorites milestones
        if (['fav_10', 'fav_50'].includes(a.id)) {
          progress = Math.max(progress, Math.min(favCount, a.maxProgress))
        }
        // Fix milestones
        if (['fix_10', 'fix_50', 'fix_100'].includes(a.id)) {
          progress = Math.max(progress, Math.min(fixesApplied, a.maxProgress))
        }

        const unlocked = progress >= a.maxProgress
        if (unlocked !== a.unlocked || progress !== a.progress) changed = true
        return { ...a, progress, unlocked, unlockedAt: unlocked && !a.unlocked ? Date.now() : a.unlockedAt }
      })
      return changed ? next : prev
    })
  }, [loading, favorites.size, userStats.totalInstalls, userStats.fixesApplied])

  // -- Persist user stats periodically --
  useEffect(() => {
    if (userStats.totalInstalls > 0) {
      window.electronAPI?.saveUserStats?.(userStats)
    }
  }, [userStats])

  // ==============================================
  //  ACTIVE TRACKER CALLBACKS
  // ==============================================

  const trackGameInstalled = useCallback(() => {
    setAchievements(prev => prev.map(a => {
      if (['first_install', 'install_10', 'install_25', 'install_50', 'install_100',
           'lib_15', 'lib_50', 'lib_100'].includes(a.id) && !a.unlocked) {
        const progress = Math.min(a.progress + 1, a.maxProgress)
        return { ...a, progress, unlocked: progress >= a.maxProgress, unlockedAt: progress >= a.maxProgress ? Date.now() : a.unlockedAt }
      }
      return a
    }))
  }, [])

  const trackGameClicked = useCallback(() => {
    setAchievements(prev => prev.map(a => {
      if (['browse_50', 'browse_200'].includes(a.id) && !a.unlocked) {
        const progress = Math.min(a.progress + 1, a.maxProgress)
        return { ...a, progress, unlocked: progress >= a.maxProgress, unlockedAt: progress >= a.maxProgress ? Date.now() : a.unlockedAt }
      }
      return a
    }))
  }, [])

  const trackFixApplied = useCallback(() => {
    setAchievements(prev => prev.map(a => {
      if (['first_fix', 'fix_10', 'fix_50', 'fix_100'].includes(a.id) && !a.unlocked) {
        const progress = Math.min(a.progress + 1, a.maxProgress)
        return { ...a, progress, unlocked: progress >= a.maxProgress, unlockedAt: progress >= a.maxProgress ? Date.now() : a.unlockedAt }
      }
      return a
    }))
  }, [])

  const trackDLCInstalled = useCallback(() => {
    setAchievements(prev => prev.map(a => {
      if (['first_dlc', 'dlc_10', 'dlc_50'].includes(a.id) && !a.unlocked) {
        const progress = Math.min(a.progress + 1, a.maxProgress)
        return { ...a, progress, unlocked: progress >= a.maxProgress, unlockedAt: progress >= a.maxProgress ? Date.now() : a.unlockedAt }
      }
      return a
    }))
  }, [])

  const trackFavoriteAdded = useCallback((count: number) => {
    setAchievements(prev => prev.map(a => {
      if (['fav_10', 'fav_50'].includes(a.id) && !a.unlocked) {
        const progress = Math.min(count, a.maxProgress)
        return { ...a, progress, unlocked: progress >= a.maxProgress, unlockedAt: progress >= a.maxProgress ? Date.now() : a.unlockedAt }
      }
      return a
    }))
  }, [])

  const trackScanCompleted = useCallback(() => {
    setAchievements(prev => prev.map(a => {
      if (['scan_1'].includes(a.id) && !a.unlocked) {
        const progress = Math.min(a.progress + 1, a.maxProgress)
        return { ...a, progress, unlocked: progress >= a.maxProgress, unlockedAt: progress >= a.maxProgress ? Date.now() : a.unlockedAt }
      }
      return a
    }))
  }, [])

  const trackCollectionCreated = useCallback((count: number) => {
    setAchievements(prev => prev.map(a => {
      if (['col_1', 'col_5'].includes(a.id) && !a.unlocked) {
        const progress = Math.min(count, a.maxProgress)
        return { ...a, progress, unlocked: progress >= a.maxProgress, unlockedAt: progress >= a.maxProgress ? Date.now() : a.unlockedAt }
      }
      return a
    }))
  }, [])

  // -- New trackers for Power User category --

  const trackBatchInstall = useCallback(() => {
    setAchievements(prev => prev.map(a => {
      if (a.id === 'batch_install' && !a.unlocked) {
        return { ...a, progress: 1, unlocked: true, unlockedAt: Date.now() }
      }
      return a
    }))
  }, [])

  const trackQuickToolUsed = useCallback(() => {
    setAchievements(prev => prev.map(a => {
      if (a.id === 'quick_tool' && !a.unlocked) {
        return { ...a, progress: 1, unlocked: true, unlockedAt: Date.now() }
      }
      return a
    }))
  }, [])

  const trackFixGamesScript = useCallback(() => {
    setAchievements(prev => prev.map(a => {
      if (a.id === 'fix_games_script' && !a.unlocked) {
        return { ...a, progress: 1, unlocked: true, unlockedAt: Date.now() }
      }
      return a
    }))
  }, [])

  // ==============================================
  //  RETURN
  // ==============================================
  return {
    achievements,
    setAchievements,
    userLevel,
    xpForCurrentLevel,
    xpForNextLevel,
    userXP,
    trackGameInstalled,
    trackGameClicked,
    trackFixApplied,
    trackDLCInstalled,
    trackFavoriteAdded,
    trackScanCompleted,
    trackCollectionCreated,
    trackBatchInstall,
    trackQuickToolUsed,
    trackFixGamesScript,
  }
}

export default useAchievements
