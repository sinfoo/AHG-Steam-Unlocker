import { create } from 'zustand'
import { Game } from '../types'

type SetStateAction<T> = T | ((prev: T) => T)

type ToastType = 'success' | 'error' | 'favorites' | 'info' | 'achievement'

export interface UIState {
  // Navigation
  currentPage: 'home' | 'browse' | 'library' | 'favourites' | 'recent' | 'updates' | 'fixes' | 'settings'
  pageHistory: string[]
  forwardHistory: string[]
  settingsOpen: boolean
  commandPaletteOpen: boolean
  navTransition: boolean
  
  // Modals
  updateModalOpen: boolean
  changelogOpen: boolean
  changelogVersion: string
  activationOpen: boolean
  isActivated: boolean
  thankYouOpen: boolean
  showExportModal: boolean
  showImportModal: boolean
  importResult: any
  
  // Toasts
  toasts: Array<{ id: number; message: string; type: ToastType }>
  /** In-memory history of the last 8 toasts (header notification bell) */
  notifHistory: Array<{ id: number; message: string; type: ToastType; time: number }>
  notifUnread: number
  pushNotif: (n: { id: number; message: string; type: ToastType }) => void
  markNotifsRead: () => void

  // Context menu
  contextMenu: { x: number; y: number; game: Game } | null
  contextMenuGame: Game | null
  
  // Window
  windowWidth: number
  
  // Sidebar
  sidebarOpen: boolean
  
  // Batch selection
  batchSelectMode: boolean
  batchSelected: Set<string>
  
  // Setters
  setCurrentPage: (value: SetStateAction<'home' | 'browse' | 'library' | 'favourites' | 'recent' | 'updates' | 'fixes' | 'settings'>) => void
  setPageHistory: (value: SetStateAction<string[]>) => void
  setForwardHistory: (value: SetStateAction<string[]>) => void
  setSettingsOpen: (value: SetStateAction<boolean>) => void
  setCommandPaletteOpen: (value: SetStateAction<boolean>) => void
  toggleCommandPalette: () => void
  setNavTransition: (value: SetStateAction<boolean>) => void
  setUpdateModalOpen: (value: SetStateAction<boolean>) => void
  setChangelogOpen: (value: SetStateAction<boolean>) => void
  setChangelogVersion: (value: SetStateAction<string>) => void
  setActivationOpen: (value: SetStateAction<boolean>) => void
  setIsActivated: (value: SetStateAction<boolean>) => void
  setThankYouOpen: (value: SetStateAction<boolean>) => void
  setShowExportModal: (value: SetStateAction<boolean>) => void
  setShowImportModal: (value: SetStateAction<boolean>) => void
  setImportResult: (value: SetStateAction<any>) => void
  setToasts: (value: SetStateAction<Array<{ id: number; message: string; type: ToastType }>>) => void
  setContextMenu: (value: SetStateAction<{ x: number; y: number; game: Game } | null>) => void
  setContextMenuGame: (value: SetStateAction<Game | null>) => void
  setWindowWidth: (value: SetStateAction<number>) => void
  setSidebarOpen: (value: SetStateAction<boolean>) => void
  setBatchSelectMode: (value: SetStateAction<boolean>) => void
  setBatchSelected: (value: SetStateAction<Set<string>>) => void
}

export const useUIStore = create<UIState>((set) => ({
  // Navigation
  currentPage: 'home',
  pageHistory: ['home'],
  forwardHistory: [],
  settingsOpen: false,
  commandPaletteOpen: false,
  navTransition: false,
  
  // Modals
  updateModalOpen: false,
  changelogOpen: false,
  changelogVersion: '1.0',
  activationOpen: false,
  isActivated: false,
  thankYouOpen: false,
  showExportModal: false,
  showImportModal: false,
  importResult: null,
  
  // Toasts
  toasts: [],
  notifHistory: [],
  notifUnread: 0,
  pushNotif: (n) => set((state) => ({
    notifHistory: [{ ...n, time: Date.now() }, ...state.notifHistory].slice(0, 8),
    notifUnread: Math.min(state.notifUnread + 1, 8),
  })),
  markNotifsRead: () => set({ notifUnread: 0 }),
  
  // Context menu
  contextMenu: null,
  contextMenuGame: null,
  
  // Window
  windowWidth: typeof window !== 'undefined' ? window.innerWidth : 1200,
  
  // Sidebar
  sidebarOpen: true,
  
  // Batch selection
  batchSelectMode: false,
  batchSelected: new Set(),
  
  // Setters
  setCurrentPage: (currentPage) => set((state) => ({
    currentPage: typeof currentPage === 'function' ? currentPage(state.currentPage) : currentPage
  })),
  setPageHistory: (pageHistory) => set((state) => ({
    pageHistory: typeof pageHistory === 'function' ? pageHistory(state.pageHistory) : pageHistory
  })),
  setForwardHistory: (forwardHistory) => set((state) => ({
    forwardHistory: typeof forwardHistory === 'function' ? forwardHistory(state.forwardHistory) : forwardHistory
  })),
  setSettingsOpen: (settingsOpen) => set((state) => ({
    settingsOpen: typeof settingsOpen === 'function' ? settingsOpen(state.settingsOpen) : settingsOpen
  })),
  setCommandPaletteOpen: (commandPaletteOpen) => set((state) => ({
    commandPaletteOpen: typeof commandPaletteOpen === 'function' ? commandPaletteOpen(state.commandPaletteOpen) : commandPaletteOpen
  })),
  toggleCommandPalette: () => set((state) => ({ commandPaletteOpen: !state.commandPaletteOpen })),
  setNavTransition: (navTransition) => set((state) => ({
    navTransition: typeof navTransition === 'function' ? navTransition(state.navTransition) : navTransition
  })),
  setUpdateModalOpen: (updateModalOpen) => set((state) => ({
    updateModalOpen: typeof updateModalOpen === 'function' ? updateModalOpen(state.updateModalOpen) : updateModalOpen
  })),
  setChangelogOpen: (changelogOpen) => set((state) => ({
    changelogOpen: typeof changelogOpen === 'function' ? changelogOpen(state.changelogOpen) : changelogOpen
  })),
  setChangelogVersion: (changelogVersion) => set((state) => ({
    changelogVersion: typeof changelogVersion === 'function' ? changelogVersion(state.changelogVersion) : changelogVersion
  })),
  setActivationOpen: (activationOpen) => set((state) => ({
    activationOpen: typeof activationOpen === 'function' ? activationOpen(state.activationOpen) : activationOpen
  })),
  setIsActivated: (isActivated) => set((state) => ({
    isActivated: typeof isActivated === 'function' ? isActivated(state.isActivated) : isActivated
  })),
  setThankYouOpen: (thankYouOpen) => set((state) => ({
    thankYouOpen: typeof thankYouOpen === 'function' ? thankYouOpen(state.thankYouOpen) : thankYouOpen
  })),
  setShowExportModal: (showExportModal) => set((state) => ({
    showExportModal: typeof showExportModal === 'function' ? showExportModal(state.showExportModal) : showExportModal
  })),
  setShowImportModal: (showImportModal) => set((state) => ({
    showImportModal: typeof showImportModal === 'function' ? showImportModal(state.showImportModal) : showImportModal
  })),
  setImportResult: (importResult) => set((state) => ({
    importResult: typeof importResult === 'function' ? importResult(state.importResult) : importResult
  })),
  setToasts: (toasts) => set((state) => ({
    toasts: typeof toasts === 'function' ? toasts(state.toasts) : toasts
  })),
  setContextMenu: (contextMenu) => set((state) => ({
    contextMenu: typeof contextMenu === 'function' ? contextMenu(state.contextMenu) : contextMenu
  })),
  setContextMenuGame: (contextMenuGame) => set((state) => ({
    contextMenuGame: typeof contextMenuGame === 'function' ? contextMenuGame(state.contextMenuGame) : contextMenuGame
  })),
  setWindowWidth: (windowWidth) => set((state) => ({
    windowWidth: typeof windowWidth === 'function' ? windowWidth(state.windowWidth) : windowWidth
  })),
  setSidebarOpen: (sidebarOpen) => set((state) => ({
    sidebarOpen: typeof sidebarOpen === 'function' ? sidebarOpen(state.sidebarOpen) : sidebarOpen
  })),
  setBatchSelectMode: (batchSelectMode) => set((state) => ({
    batchSelectMode: typeof batchSelectMode === 'function' ? batchSelectMode(state.batchSelectMode) : batchSelectMode
  })),
  setBatchSelected: (batchSelected) => set((state) => ({
    batchSelected: typeof batchSelected === 'function' ? batchSelected(state.batchSelected) : batchSelected
  })),
}))

// Selector hooks for performance
export const useCurrentPage = () => useUIStore((s) => s.currentPage)
export const useSetCurrentPage = () => useUIStore((s) => s.setCurrentPage)
export const usePageHistory = () => useUIStore((s) => s.pageHistory)
export const useCommandPaletteOpen = () => useUIStore((s) => s.commandPaletteOpen)
export const useSettingsOpen = () => useUIStore((s) => s.settingsOpen)
export const useToasts = () => useUIStore((s) => s.toasts)
export const useSetToasts = () => useUIStore((s) => s.setToasts)
export const useContextMenu = () => useUIStore((s) => s.contextMenu)
export const useUpdateModalOpen = () => useUIStore((s) => s.updateModalOpen)
export const useActivationOpen = () => useUIStore((s) => s.activationOpen)
export const useIsActivated = () => useUIStore((s) => s.isActivated)
export const useToggleCommandPalette = () => useUIStore((s) => s.toggleCommandPalette)
