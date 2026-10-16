import { create } from 'zustand'
import { Fix } from '../types'

type SetStateAction<T> = T | ((prev: T) => T)

export interface FixGamesState {
  fixGamesStatus: 'idle' | 'running' | 'done' | 'error'
  fixGamesOutput: string
  fixGamesScriptStatus: 'idle' | 'running' | 'done' | 'error'
  fixGamesScriptOutput: string
  fixGamesScriptProgress: number
  fixGamesContactOpen: boolean
  previewFix: Fix | null

  setFixGamesStatus: (value: SetStateAction<'idle' | 'running' | 'done' | 'error'>) => void
  setFixGamesOutput: (value: SetStateAction<string>) => void
  setFixGamesScriptStatus: (value: SetStateAction<'idle' | 'running' | 'done' | 'error'>) => void
  setFixGamesScriptOutput: (value: SetStateAction<string>) => void
  setFixGamesScriptProgress: (value: SetStateAction<number>) => void
  setFixGamesContactOpen: (value: SetStateAction<boolean>) => void
  setPreviewFix: (value: SetStateAction<Fix | null>) => void
}

export const useFixGamesStore = create<FixGamesState>((set) => ({
  fixGamesStatus: 'idle',
  fixGamesOutput: '',
  fixGamesScriptStatus: 'idle',
  fixGamesScriptOutput: '',
  fixGamesScriptProgress: 0,
  fixGamesContactOpen: false,
  previewFix: null,

  setFixGamesStatus: (v) => set((s) => ({ fixGamesStatus: typeof v === 'function' ? v(s.fixGamesStatus) : v })),
  // keep only the tail: a noisy fix script used to grow this string without bound
  setFixGamesOutput: (v) => set((s) => ({ fixGamesOutput: (typeof v === 'function' ? v(s.fixGamesOutput) : v).slice(-20000) })),
  setFixGamesScriptStatus: (v) => set((s) => ({ fixGamesScriptStatus: typeof v === 'function' ? v(s.fixGamesScriptStatus) : v })),
  setFixGamesScriptOutput: (v) => set((s) => ({ fixGamesScriptOutput: typeof v === 'function' ? v(s.fixGamesScriptOutput) : v })),
  setFixGamesScriptProgress: (v) => set((s) => ({ fixGamesScriptProgress: typeof v === 'function' ? v(s.fixGamesScriptProgress) : v })),
  setFixGamesContactOpen: (v) => set((s) => ({ fixGamesContactOpen: typeof v === 'function' ? v(s.fixGamesContactOpen) : v })),
  setPreviewFix: (v) => set((s) => ({ previewFix: typeof v === 'function' ? v(s.previewFix) : v })),
}))
