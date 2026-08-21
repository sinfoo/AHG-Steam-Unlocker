import { create } from 'zustand'
import { Game } from '../types'

type SetStateAction<T> = T | ((prev: T) => T)

type QueuedGame = { game: Game; status: 'pending' | 'installing' | 'downloading' | 'done' | 'error'; progress: number; error?: string }

export interface InstallQueueState {
  // Install queue
  installQueue: QueuedGame[]
  showInstallQueue: boolean

  // Card loading states
  cardLoading: Set<string>

  // Recently added
  recentlyAddedGames: Game[]

  // Setters
  setInstallQueue: (value: SetStateAction<QueuedGame[]>) => void
  setShowInstallQueue: (value: SetStateAction<boolean>) => void
  setCardLoading: (value: SetStateAction<Set<string>>) => void
  setRecentlyAddedGames: (value: SetStateAction<Game[]>) => void
}

export const useInstallQueueStore = create<InstallQueueState>((set) => ({
  // Install queue
  installQueue: [],
  showInstallQueue: false,

  // Card loading
  cardLoading: new Set(),

  // Recently added
  recentlyAddedGames: [],

  // Setters
  setInstallQueue: (v) => set((s) => ({ installQueue: typeof v === 'function' ? v(s.installQueue) : v })),
  setShowInstallQueue: (v) => set((s) => ({ showInstallQueue: typeof v === 'function' ? v(s.showInstallQueue) : v })),
  setCardLoading: (v) => set((s) => ({ cardLoading: typeof v === 'function' ? v(s.cardLoading) : v })),
  setRecentlyAddedGames: (v) => set((s) => ({ recentlyAddedGames: typeof v === 'function' ? v(s.recentlyAddedGames) : v })),
}))

// Selector hooks
export const useInstallQueue = () => useInstallQueueStore((s) => s.installQueue)
export const useShowInstallQueue = () => useInstallQueueStore((s) => s.showInstallQueue)
export const useRecentlyAddedGames = () => useInstallQueueStore((s) => s.recentlyAddedGames)
