import { create } from 'zustand'
import { Game } from '../types'

type SetStateAction<T> = T | ((prev: T) => T)

export interface ScanState {
  scanGamesProgress: number
  scanGamesStatus: 'idle' | 'scanning' | 'done' | 'error'
  scanGamesResult: { found: number; added: Game[] }
  scanGamesMinimized: boolean

  setScanGamesProgress: (value: SetStateAction<number>) => void
  setScanGamesStatus: (value: SetStateAction<'idle' | 'scanning' | 'done' | 'error'>) => void
  setScanGamesResult: (value: SetStateAction<{ found: number; added: Game[] }>) => void
  setScanGamesMinimized: (value: SetStateAction<boolean>) => void
}

export const useScanStore = create<ScanState>((set) => ({
  scanGamesProgress: 0,
  scanGamesStatus: 'idle',
  scanGamesResult: { found: 0, added: [] },
  scanGamesMinimized: false,

  setScanGamesProgress: (v) => set((s) => ({ scanGamesProgress: typeof v === 'function' ? v(s.scanGamesProgress) : v })),
  setScanGamesStatus: (v) => set((s) => ({ scanGamesStatus: typeof v === 'function' ? v(s.scanGamesStatus) : v })),
  setScanGamesResult: (v) => set((s) => ({ scanGamesResult: typeof v === 'function' ? v(s.scanGamesResult) : v })),
  setScanGamesMinimized: (v) => set((s) => ({ scanGamesMinimized: typeof v === 'function' ? v(s.scanGamesMinimized) : v })),
}))
