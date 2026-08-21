import { create } from 'zustand'

type SetStateAction<T> = T | ((prev: T) => T)

export interface ModalState {
  fixGamesModalOpen: boolean
  fixGamesScriptModalOpen: boolean
  scanGamesModalOpen: boolean
  downloadModalOpen: boolean
  extractModalOpen: boolean
  extractFileName: string
  extractFilePath: string

  setFixGamesModalOpen: (value: SetStateAction<boolean>) => void
  setFixGamesScriptModalOpen: (value: SetStateAction<boolean>) => void
  setScanGamesModalOpen: (value: SetStateAction<boolean>) => void
  setDownloadModalOpen: (value: SetStateAction<boolean>) => void
  setExtractModalOpen: (value: SetStateAction<boolean>) => void
  setExtractFileName: (value: SetStateAction<string>) => void
  setExtractFilePath: (value: SetStateAction<string>) => void
}

export const useModalStore = create<ModalState>((set) => ({
  fixGamesModalOpen: false,
  fixGamesScriptModalOpen: false,
  scanGamesModalOpen: false,
  downloadModalOpen: false,
  extractModalOpen: false,
  extractFileName: '',
  extractFilePath: '',

  setFixGamesModalOpen: (v) => set((s) => ({ fixGamesModalOpen: typeof v === 'function' ? v(s.fixGamesModalOpen) : v })),
  setFixGamesScriptModalOpen: (v) => set((s) => ({ fixGamesScriptModalOpen: typeof v === 'function' ? v(s.fixGamesScriptModalOpen) : v })),
  setScanGamesModalOpen: (v) => set((s) => ({ scanGamesModalOpen: typeof v === 'function' ? v(s.scanGamesModalOpen) : v })),
  setDownloadModalOpen: (v) => set((s) => ({ downloadModalOpen: typeof v === 'function' ? v(s.downloadModalOpen) : v })),
  setExtractModalOpen: (v) => set((s) => ({ extractModalOpen: typeof v === 'function' ? v(s.extractModalOpen) : v })),
  setExtractFileName: (v) => set((s) => ({ extractFileName: typeof v === 'function' ? v(s.extractFileName) : v })),
  setExtractFilePath: (v) => set((s) => ({ extractFilePath: typeof v === 'function' ? v(s.extractFilePath) : v })),
}))

// Selector hooks
export const useFixGamesModalOpen = () => useModalStore((s) => s.fixGamesModalOpen)
export const useDownloadModalOpen = () => useModalStore((s) => s.downloadModalOpen)
export const useScanGamesModalOpen = () => useModalStore((s) => s.scanGamesModalOpen)
export const useExtractModalOpen = () => useModalStore((s) => s.extractModalOpen)
