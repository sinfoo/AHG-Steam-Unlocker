/**
 * useAppState — Batched Zustand store hook for App.tsx
 *
 * PROBLEM: App.tsx had ~80+ individual `useStore(s => s.xxx)` selectors.
 * Each creates a separate subscription. Any store update causes ALL to
 * re-evaluate, triggering cascading re-renders through the entire tree.
 *
 * SOLUTION: One subscription per store, returning a stable (referentially
 * equal when values haven't changed) object via useShallow.
 * Callback-only state is accessed via getState() to avoid subscriptions.
 */
import { useCallback, useMemo } from 'react'
import { useShallow } from 'zustand/shallow'
import {
  useGameStore,
  useUIStore,
  useSettingsStore,
  useInstallStore,
  useModalStore,
  useDownloadStore,
  useFixGamesStore,
  useScanStore,
  useUserStore,
} from '../store'
// ── Render-critical state shapes (what JSX actually depends on) ──

export interface AppGameRenderState {
  loading: boolean
  progress: number
  games: any[]
  page: number
  searchQuery: string
  sortBy: string
  viewMode: string
  selectedGame: any | null
  selectedGames: Set<string>
  gamePanelOpen: boolean
  fixes: any[]
  fixSearchQuery: string
  fixFilter: string[]
  fixPage: number
  installedGames: any[]
  librarySearchQuery: string
  browseSearchQuery: string
  filteredGames: any[]
  gamesWithCover: any[]
  popularGamesWithCover: any[]
  homeSections: any
  recentGamesList: any[]
  aiRecommendations: any[]
  similarGames: any[]
  fixableAppids: any[]
  comingSoonAppids: any[]
  filteredLibraryGames: any[]
  filteredFixes: any[]
  paginatedFixes: any[]
  navItems: any[]
  realInstalledGamesCount: number
}

export interface AppUIRenderState {
  currentPage: 'home' | 'browse' | 'library' | 'favourites' | 'recent' | 'updates' | 'fixes' | 'settings'
  pageHistory: string[]
  forwardHistory: string[]
  toasts: any[]
  contextMenu: any
  batchSelectMode: boolean
  batchSelected: Set<string>
  windowWidth: number
  updateModalOpen: boolean
  changelogOpen: boolean
  changelogVersion: string
  activationOpen: boolean
  isActivated: boolean
  thankYouOpen: boolean
  showExportModal: boolean
  showImportModal: boolean
  importResult: any
}

export interface AppSettingsRenderState {
  compactMode: boolean
  includeDLC: boolean
  quickInstall: boolean
  accentColor: string
  soundEnabled: boolean
  batchMode: boolean
  quickToolsOpen: boolean
  pureBlack: boolean
  reducedMotion: boolean
  hideSearchBars: boolean
  showOnlyOwned: boolean
}

export interface AppInstallRenderState {
  installModalOpen: boolean
  installStatus: 'installing' | 'dlc' | 'done' | 'error'
  installProgress: number
  installGameInfo: any
  installingGame: string | null
  installQueue: any[]
  showInstallQueue: boolean
  fixGamesModalOpen: boolean
  fixGamesStatus: string
  fixGamesOutput: string
  scanGamesModalOpen: boolean
  scanGamesProgress: number
  scanGamesStatus: string
  scanGamesResult: any
  scanGamesMinimized: boolean
  recentlyAddedGames: any[]
  downloadModalOpen: boolean
  downloadProgress: number
  downloadStatus: string
  downloadName: string
  downloadMessage: string
  downloadDetails: any
  extractModalOpen: boolean
  extractFileName: string
  extractFilePath: string
  downloadQueue: any[]
  showDownloadQueue: boolean
  downloadQueuePaused: boolean
  previewFix: any
  cardLoading: Set<string>
  dlcCount: number
  installedDlcs: any[]
  installFailedAppid: string | null
  fixGamesScriptModalOpen: boolean
  fixGamesScriptStatus: string
  fixGamesScriptOutput: string
  fixGamesScriptProgress: number
  fixGamesContactOpen: boolean
}

export interface AppUserRenderState {
  favorites: Set<string>
  recentGames: string[]
  featuredGame: any
  quickAccessOffset: number
  portalModalOpen: boolean
  portalGame: any
  portalScreenshots: any[]
  portalDetails: any
  portalRelated: any[]
  userStats: any
  pinnedGames: Set<string>
  showAchievements: boolean
  ownedGameIds: Set<string>
  fixHealth: any
  searchHistory: any[]
  showSearchSuggestions: boolean
}

// ── Batched hooks with shallow comparison ──

export function useAppGameState(): AppGameRenderState {
  return useGameStore(
    useShallow(
      useCallback(
      (s: any) => ({
        loading: s.loading,
        progress: s.progress,
        games: s.games,
        page: s.page,
        searchQuery: s.searchQuery,
        sortBy: s.sortBy,
        viewMode: s.viewMode,
        selectedGame: s.selectedGame,
        selectedGames: s.selectedGames,
        gamePanelOpen: s.gamePanelOpen,
        fixes: s.fixes,
        fixSearchQuery: s.fixSearchQuery,
        fixFilter: s.fixFilter,
        fixPage: s.fixPage,
        installedGames: s.installedGames,
        librarySearchQuery: s.librarySearchQuery,
        browseSearchQuery: s.browseSearchQuery,
        filteredGames: s.filteredGames,
        gamesWithCover: s.gamesWithCover,
        popularGamesWithCover: s.popularGamesWithCover,
        homeSections: s.homeSections,
        recentGamesList: s.recentGamesList,
        aiRecommendations: s.aiRecommendations,
        similarGames: s.similarGames,
        fixableAppids: s.fixableAppids,
        comingSoonAppids: s.comingSoonAppids,
        filteredLibraryGames: s.filteredLibraryGames,
        filteredFixes: s.filteredFixes,
        paginatedFixes: s.paginatedFixes,
        navItems: s.navItems,
        realInstalledGamesCount: s.realInstalledGamesCount,
      }),
      []
    )
    )
  )
}

export function useAppUIState(): AppUIRenderState {
  return useUIStore(
    useShallow(
      useCallback(
      (s: any) => ({
        currentPage: s.currentPage,
        pageHistory: s.pageHistory,
        forwardHistory: s.forwardHistory,
        toasts: s.toasts,
        contextMenu: s.contextMenu,
        batchSelectMode: s.batchSelectMode,
        batchSelected: s.batchSelected,
        windowWidth: s.windowWidth,
        updateModalOpen: s.updateModalOpen,
        changelogOpen: s.changelogOpen,
        changelogVersion: s.changelogVersion,
        activationOpen: s.activationOpen,
        isActivated: s.isActivated,
        thankYouOpen: s.thankYouOpen,
        showExportModal: s.showExportModal,
        showImportModal: s.showImportModal,
        importResult: s.importResult,
      }),
      []
    )
    )
  )
}

export function useAppSettingsState(): AppSettingsRenderState {
  return useSettingsStore(
    useShallow(
      useCallback(
      (s: any) => ({
        compactMode: s.compactMode,
        includeDLC: s.includeDLC,
        quickInstall: s.quickInstall,
        accentColor: s.accentColor,
        soundEnabled: s.soundEnabled,
        batchMode: s.batchMode,
        quickToolsOpen: s.quickToolsOpen,
        pureBlack: s.pureBlack,
        reducedMotion: s.reducedMotion,
        hideSearchBars: s.hideSearchBars,
        showOnlyOwned: s.showOnlyOwned,
      }),
      []
    )
    )
  )
}

export function useAppInstallState(): AppInstallRenderState {
  const installState = useInstallStore(
    useShallow(
      useCallback(
      (s: any) => ({
        installModalOpen: s.installModalOpen,
        installStatus: s.installStatus,
        installProgress: s.installProgress,
        installGameInfo: s.installGameInfo,
        installingGame: s.installingGame,
        installQueue: s.installQueue,
        showInstallQueue: s.showInstallQueue,
        recentlyAddedGames: s.recentlyAddedGames,
        cardLoading: s.cardLoading,
        dlcCount: s.dlcCount,
        installedDlcs: s.installedDlcs,
        installFailedAppid: s.installFailedAppid,
      }),
      []
    )
    )
  )
  const modalState = useModalStore(
    useShallow(
      useCallback(
      (s: any) => ({
        fixGamesModalOpen: s.fixGamesModalOpen,
        scanGamesModalOpen: s.scanGamesModalOpen,
        downloadModalOpen: s.downloadModalOpen,
        extractModalOpen: s.extractModalOpen,
        extractFileName: s.extractFileName,
        extractFilePath: s.extractFilePath,
        fixGamesScriptModalOpen: s.fixGamesScriptModalOpen,
      }),
      []
    )
    )
  )
  const downloadState = useDownloadStore(
    useShallow(
      useCallback(
      (s: any) => ({
        downloadProgress: s.downloadProgress,
        downloadStatus: s.downloadStatus,
        downloadName: s.downloadName,
        downloadMessage: s.downloadMessage,
        downloadDetails: s.downloadDetails,
        downloadQueue: s.downloadQueue,
        showDownloadQueue: s.showDownloadQueue,
        downloadQueuePaused: s.downloadQueuePaused,
      }),
      []
    )
    )
  )
  const fixGamesState = useFixGamesStore(
    useShallow(
      useCallback(
      (s: any) => ({
        fixGamesStatus: s.fixGamesStatus,
        fixGamesOutput: s.fixGamesOutput,
        fixGamesScriptStatus: s.fixGamesScriptStatus,
        fixGamesScriptOutput: s.fixGamesScriptOutput,
        fixGamesScriptProgress: s.fixGamesScriptProgress,
        fixGamesContactOpen: s.fixGamesContactOpen,
        previewFix: s.previewFix,
      }),
      []
    )
    )
  )
  const scanState = useScanStore(
    useShallow(
      useCallback(
      (s: any) => ({
        scanGamesProgress: s.scanGamesProgress,
        scanGamesStatus: s.scanGamesStatus,
        scanGamesResult: s.scanGamesResult,
        scanGamesMinimized: s.scanGamesMinimized,
      }),
      []
    )
    )
  )
  return useMemo(
    () => ({ ...installState, ...modalState, ...downloadState, ...fixGamesState, ...scanState }),
    [installState, modalState, downloadState, fixGamesState, scanState]
  )
}

export function useAppUserState(): AppUserRenderState {
  return useUserStore(
    useShallow(
      useCallback(
      (s: any) => ({
        favorites: s.favorites,
        recentGames: s.recentGames,
        featuredGame: s.featuredGame,
        quickAccessOffset: s.quickAccessOffset,
        portalModalOpen: s.portalModalOpen,
        portalGame: s.portalGame,
        portalScreenshots: s.portalScreenshots,
        portalDetails: s.portalDetails,
        portalRelated: s.portalRelated,
        userStats: s.userStats,
        pinnedGames: s.pinnedGames,
        showAchievements: s.showAchievements,
        ownedGameIds: s.ownedGameIds,
        fixHealth: s.fixHealth,
        searchHistory: s.searchHistory,
        showSearchSuggestions: s.showSearchSuggestions,
      }),
      []
    )
    )
  )
}

// ── Combined app state for convenience ──

export interface AppRenderState extends AppGameRenderState, AppUIRenderState, AppSettingsRenderState, AppInstallRenderState, AppUserRenderState {}

export function useAppState(): AppRenderState {
  const gameState = useAppGameState()
  const uiState = useAppUIState()
  const settingsState = useAppSettingsState()
  const installState = useAppInstallState()
  const userState = useAppUserState()

  return useMemo(
    () => ({
      ...gameState,
      ...uiState,
      ...settingsState,
      ...installState,
      ...userState,
    }),
    [gameState, uiState, settingsState, installState, userState]
  )
}
