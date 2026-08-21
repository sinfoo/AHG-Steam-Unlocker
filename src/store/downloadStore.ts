import { create } from 'zustand'
import { Game } from '../types'

type SetStateAction<T> = T | ((prev: T) => T)

type QueuedGame = { game: Game; status: 'pending' | 'installing' | 'downloading' | 'done' | 'error'; progress: number; error?: string }

export interface DownloadState {
  downloadProgress: number
  downloadStatus: 'downloading' | 'done' | 'error'
  downloadName: string
  downloadMessage: string
  downloadDetails: { totalSize: number; downloaded: number; speed: number } | null
  downloadQueue: QueuedGame[]
  showDownloadQueue: boolean
  downloadQueuePaused: boolean

  setDownloadProgress: (value: SetStateAction<number>) => void
  setDownloadStatus: (value: SetStateAction<'downloading' | 'done' | 'error'>) => void
  setDownloadName: (value: SetStateAction<string>) => void
  setDownloadMessage: (value: SetStateAction<string>) => void
  setDownloadDetails: (value: SetStateAction<{ totalSize: number; downloaded: number; speed: number } | null>) => void
  setDownloadQueue: (value: SetStateAction<QueuedGame[]>) => void
  setShowDownloadQueue: (value: SetStateAction<boolean>) => void
  setDownloadQueuePaused: (value: SetStateAction<boolean>) => void
}

export const useDownloadStore = create<DownloadState>((set) => ({
  downloadProgress: 0,
  downloadStatus: 'downloading',
  downloadName: '',
  downloadMessage: '',
  downloadDetails: null,
  downloadQueue: [],
  showDownloadQueue: false,
  downloadQueuePaused: false,

  setDownloadProgress: (v) => set((s) => ({ downloadProgress: typeof v === 'function' ? v(s.downloadProgress) : v })),
  setDownloadStatus: (v) => set((s) => ({ downloadStatus: typeof v === 'function' ? v(s.downloadStatus) : v })),
  setDownloadName: (v) => set((s) => ({ downloadName: typeof v === 'function' ? v(s.downloadName) : v })),
  setDownloadMessage: (v) => set((s) => ({ downloadMessage: typeof v === 'function' ? v(s.downloadMessage) : v })),
  setDownloadDetails: (v) => set((s) => ({ downloadDetails: typeof v === 'function' ? v(s.downloadDetails) : v })),
  setDownloadQueue: (v) => set((s) => ({ downloadQueue: typeof v === 'function' ? v(s.downloadQueue) : v })),
  setShowDownloadQueue: (v) => set((s) => ({ showDownloadQueue: typeof v === 'function' ? v(s.showDownloadQueue) : v })),
  setDownloadQueuePaused: (v) => set((s) => ({ downloadQueuePaused: typeof v === 'function' ? v(s.downloadQueuePaused) : v })),
}))

// Selector hooks
export const useDownloadQueue = () => useDownloadStore((s) => s.downloadQueue)
