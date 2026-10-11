import { create } from 'zustand'
import { Game, Achievement } from '../types'

type SetStateAction<T> = T | ((prev: T) => T)

type LogEntry = { time: string; message: string; type: 'info' | 'success' | 'error' | 'warn' }
type FixHealth = { appid: string; status: 'working' | 'outdated' | 'broken'; lastChecked: number; reports: number }

export type ActivityKind = 'viewed' | 'added' | 'fix' | 'launched' | 'favourited' | 'installed'
export interface ActivityEntry { appid: string; act: ActivityKind; ts: number }

const ACT_KEY = 'ahg.activity'
const ACT_CAP = 200
const loadActivity = (): ActivityEntry[] => {
  try { const a = JSON.parse(localStorage.getItem(ACT_KEY) || '[]'); return Array.isArray(a) ? a.slice(0, ACT_CAP) : [] } catch { return [] }
}

export interface UserState {
  // Activity log (newest first) — feeds the Recent page timeline
  activity: ActivityEntry[]
  logActivity: (appid: string | number, act: ActivityKind) => void

  // Favorites & Recent
  favorites: Set<string>
  recentGames: string[]
  
  // Pinned games
  pinnedGames: Set<string>
  
  // Owned games
  ownedGameIds: Set<string>
  
  // Stats
  userStats: { totalInstalls: number; fixesApplied: number; gamesViewed: number; firstLaunch: number }
  userXP: number
  logs: LogEntry[]
  
  // Achievements
  achievements: Achievement[]
  showAchievements: boolean
  
  // Fix health
  fixHealth: Map<string, FixHealth>
  
  // Search history
  searchHistory: string[]
  showSearchSuggestions: boolean
  
  // Portal / detail modal
  portalModalOpen: boolean
  portalGame: Game | null
  portalScreenshots: string[]
  portalDetails: any
  portalRelated: Game[]
  
  // Featured game (quick access carousel)
  featuredGame: Game | null
  quickAccessOffset: number
  
  // Setters
  setFavorites: (value: SetStateAction<Set<string>>) => void
  setRecentGames: (value: SetStateAction<string[]>) => void
  setPinnedGames: (value: SetStateAction<Set<string>>) => void
  setOwnedGameIds: (value: SetStateAction<Set<string>>) => void
  setUserStats: (value: SetStateAction<{ totalInstalls: number; fixesApplied: number; gamesViewed: number; firstLaunch: number }>) => void
  setUserXP: (value: SetStateAction<number>) => void
  setLogs: (value: SetStateAction<LogEntry[]>) => void
  setAchievements: (value: SetStateAction<Achievement[]>) => void
  setShowAchievements: (value: SetStateAction<boolean>) => void
  setFixHealth: (value: SetStateAction<Map<string, FixHealth>>) => void
  setSearchHistory: (value: SetStateAction<string[]>) => void
  setShowSearchSuggestions: (value: SetStateAction<boolean>) => void
  setPortalModalOpen: (value: SetStateAction<boolean>) => void
  setPortalGame: (value: SetStateAction<Game | null>) => void
  setPortalScreenshots: (value: SetStateAction<string[]>) => void
  setPortalDetails: (value: SetStateAction<any>) => void
  setPortalRelated: (value: SetStateAction<Game[]>) => void
  setFeaturedGame: (value: SetStateAction<Game | null>) => void
  setQuickAccessOffset: (value: SetStateAction<number>) => void
  addToRecent: (appid: string) => void
  toggleFavorite: (appid: string) => void
}

export const useUserStore = create<UserState>((set) => ({
  activity: loadActivity(),
  logActivity: (appid, act) => {
    try {
      set((state) => {
        const id = String(appid)
        const now = Date.now()
        const last = state.activity[0]
        if (last && last.appid === id && last.act === act && now - last.ts < 60_000) return state
        const activity = [{ appid: id, act, ts: now }, ...state.activity].slice(0, ACT_CAP)
        try { localStorage.setItem(ACT_KEY, JSON.stringify(activity)) } catch { /* storage unavailable */ }
        return { activity }
      })
    } catch { /* never break the caller */ }
  },
  // Favorites & Recent
  favorites: new Set(),
  recentGames: [],
  
  // Pinned games
  pinnedGames: new Set(),
  
  // Owned games
  ownedGameIds: new Set(),
  
  // Stats
  userStats: { totalInstalls: 0, fixesApplied: 0, gamesViewed: 0, firstLaunch: Date.now() },
  userXP: 0,
  logs: [],
  
  // Achievements
  achievements: [],
  showAchievements: false,
  
  // Fix health
  fixHealth: new Map(),
  
  // Search history
  searchHistory: [],
  showSearchSuggestions: false,
  
  // Portal / detail modal
  portalModalOpen: false,
  portalGame: null,
  portalScreenshots: [],
  portalDetails: null,
  portalRelated: [],
  
  // Featured game
  featuredGame: null,
  quickAccessOffset: 0,
  
  // Setters
  setFavorites: (v) => set((s) => ({ favorites: typeof v === 'function' ? v(s.favorites) : v })),
  setRecentGames: (v) => set((s) => ({ recentGames: typeof v === 'function' ? v(s.recentGames) : v })),
  setPinnedGames: (v) => set((s) => ({ pinnedGames: typeof v === 'function' ? v(s.pinnedGames) : v })),
  setOwnedGameIds: (v) => set((s) => ({ ownedGameIds: typeof v === 'function' ? v(s.ownedGameIds) : v })),
  setUserStats: (v) => set((s) => ({ userStats: typeof v === 'function' ? v(s.userStats) : v })),
  setUserXP: (v) => set((s) => ({ userXP: typeof v === 'function' ? v(s.userXP) : v })),
  setLogs: (v) => set((s) => ({ logs: typeof v === 'function' ? v(s.logs) : v })),
  setAchievements: (v) => set((s) => ({ achievements: typeof v === 'function' ? v(s.achievements) : v })),
  setShowAchievements: (v) => set((s) => ({ showAchievements: typeof v === 'function' ? v(s.showAchievements) : v })),
  setFixHealth: (v) => set((s) => ({ fixHealth: typeof v === 'function' ? v(s.fixHealth) : v })),
  setSearchHistory: (v) => set((s) => ({ searchHistory: typeof v === 'function' ? v(s.searchHistory) : v })),
  setShowSearchSuggestions: (v) => set((s) => ({ showSearchSuggestions: typeof v === 'function' ? v(s.showSearchSuggestions) : v })),
  setPortalModalOpen: (v) => set((s) => ({ portalModalOpen: typeof v === 'function' ? v(s.portalModalOpen) : v })),
  setPortalGame: (v) => set((s) => ({ portalGame: typeof v === 'function' ? v(s.portalGame) : v })),
  setPortalScreenshots: (v) => set((s) => ({ portalScreenshots: typeof v === 'function' ? v(s.portalScreenshots) : v })),
  setPortalDetails: (v) => set((s) => ({ portalDetails: typeof v === 'function' ? v(s.portalDetails) : v })),
  setPortalRelated: (v) => set((s) => ({ portalRelated: typeof v === 'function' ? v(s.portalRelated) : v })),
  setFeaturedGame: (v) => set((s) => ({ featuredGame: typeof v === 'function' ? v(s.featuredGame) : v })),
  setQuickAccessOffset: (v) => set((s) => ({ quickAccessOffset: typeof v === 'function' ? v(s.quickAccessOffset) : v })),
  addToRecent: (appid) => set((state) => ({
    recentGames: [appid, ...state.recentGames.filter(id => id !== appid)].slice(0, 50),
  })),
  toggleFavorite: (appid) => set((state) => {
    const newFavorites = new Set(state.favorites)
    if (newFavorites.has(appid)) newFavorites.delete(appid)
    else newFavorites.add(appid)
    return { favorites: newFavorites }
  }),
}))

// Selector hooks
export const useFavorites = () => useUserStore((s) => s.favorites)
export const useSetFavorites = () => useUserStore((s) => s.setFavorites)
export const useRecentGames = () => useUserStore((s) => s.recentGames)
export const useUserStats = () => useUserStore((s) => s.userStats)
export const useAchievements = () => useUserStore((s) => s.achievements)
export const useSetAchievements = () => useUserStore((s) => s.setAchievements)
export const useUserXP = () => useUserStore((s) => s.userXP)
export const useLogs = () => useUserStore((s) => s.logs)
export const useSearchHistory = () => useUserStore((s) => s.searchHistory)
export const useAddToRecent = () => useUserStore((s) => s.addToRecent)
export const useToggleFavorite = () => useUserStore((s) => s.toggleFavorite)
