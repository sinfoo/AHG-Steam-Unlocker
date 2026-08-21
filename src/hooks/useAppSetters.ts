import { useCallback, useRef } from 'react'
import {
  useGameStore,
  useUIStore,
  useSettingsStore,
  useInstallStore,
  useInstallQueueStore,
  useModalStore,
  useDownloadStore,
  useFixGamesStore,
  useScanStore,
  useUserStore,
  useDiscordStore,
} from '../store'

export function useAppSetters() {
  // ── Game Store Setters ──
  const setLoading = useCallback((...args: any[]) => useGameStore.getState().setLoading(args[0]), [])
  const setProgress = useCallback((...args: any[]) => useGameStore.getState().setProgress(args[0]), [])
  const setGames = useCallback((...args: any[]) => useGameStore.getState().setGames(args[0]), [])
  const dynamicFreeIds = useGameStore(s => s.dynamicFreeIds)
  const setDynamicFreeIds = useCallback((...args: any[]) => useGameStore.getState().setDynamicFreeIds(args[0]), [])
  const setCurrentPageNum = useCallback((...args: any[]) => useGameStore.getState().setCurrentPageNum(args[0]), [])
  const setSearchQuery = useCallback((...args: any[]) => useGameStore.getState().setSearchQuery(args[0]), [])
  const setSortBy = useCallback((...args: any[]) => useGameStore.getState().setSortBy(args[0]), [])
  const setViewMode = useCallback((...args: any[]) => useGameStore.getState().setViewMode(args[0]), [])
  const setSelectedGame = useCallback((...args: any[]) => useGameStore.getState().setSelectedGame(args[0]), [])
  const setSelectedGames = useCallback((...args: any[]) => useGameStore.getState().setSelectedGames(args[0]), [])
  const setGamePanelOpen = useCallback((...args: any[]) => useGameStore.getState().setGamePanelOpen(args[0]), [])
  const setFixes = useCallback((...args: any[]) => useGameStore.getState().setFixes(args[0]), [])
  const setFixSearchQuery = useCallback((...args: any[]) => useGameStore.getState().setFixSearchQuery(args[0]), [])
  const setFixFilter = useCallback((...args: any[]) => useGameStore.getState().setFixFilter(args[0]), [])
  const setCustomFixHighlights = useCallback((...args: any[]) => useGameStore.getState().setCustomFixHighlights(args[0]), [])
  const setInstalledGames = useCallback((...args: any[]) => useGameStore.getState().setInstalledGames(args[0]), [])
  const setLibrarySearchQuery = useCallback((...args: any[]) => useGameStore.getState().setLibrarySearchQuery(args[0]), [])
  const setKnownDlcIds = useCallback((...args: any[]) => useGameStore.getState().setKnownDlcIds(args[0]), [])

  // ── UI Store Setters ──
  const setCurrentPage = useCallback((...args: any[]) => useUIStore.getState().setCurrentPage(args[0]), [])
  const setPageHistory = useCallback((...args: any[]) => useUIStore.getState().setPageHistory(args[0]), [])
  const setForwardHistory = useCallback((...args: any[]) => useUIStore.getState().setForwardHistory(args[0]), [])
  const setToasts = useCallback((...args: any[]) => useUIStore.getState().setToasts(args[0]), [])
  const setUpdateModalOpen = useCallback((...args: any[]) => useUIStore.getState().setUpdateModalOpen(args[0]), [])
  const setChangelogOpen = useCallback((...args: any[]) => useUIStore.getState().setChangelogOpen(args[0]), [])
  const setChangelogVersion = useCallback((...args: any[]) => useUIStore.getState().setChangelogVersion(args[0]), [])
  const setActivationOpen = useCallback((...args: any[]) => useUIStore.getState().setActivationOpen(args[0]), [])
  const setIsActivated = useCallback((...args: any[]) => useUIStore.getState().setIsActivated(args[0]), [])
  const setThankYouOpen = useCallback((...args: any[]) => useUIStore.getState().setThankYouOpen(args[0]), [])
  const setContextMenu = useCallback((...args: any[]) => useUIStore.getState().setContextMenu(args[0]), [])
  const contextMenuGame = useUIStore(s => s.contextMenuGame)
  const setContextMenuGame = useCallback((...args: any[]) => useUIStore.getState().setContextMenuGame(args[0]), [])
  const setShowExportModal = useCallback((...args: any[]) => useUIStore.getState().setShowExportModal(args[0]), [])
  const setShowImportModal = useCallback((...args: any[]) => useUIStore.getState().setShowImportModal(args[0]), [])
  const setImportResult = useCallback((...args: any[]) => useUIStore.getState().setImportResult(args[0]), [])
  const setBatchSelectMode = useCallback((...args: any[]) => useUIStore.getState().setBatchSelectMode(args[0]), [])
  const setBatchSelected = useCallback((...args: any[]) => useUIStore.getState().setBatchSelected(args[0]), [])
  const setStartupDiscordModal = useCallback((...args: any[]) => useUIStore.getState().setStartupDiscordModal(args[0]), [])

  // ── Settings Store Setters ──
  const setCompactMode = useCallback((...args: any[]) => useSettingsStore.getState().setCompactMode(args[0]), [])
  const setIncludeDLC = useCallback((...args: any[]) => useSettingsStore.getState().setIncludeDLC(args[0]), [])
  const setQuickInstall = useCallback((...args: any[]) => useSettingsStore.getState().setQuickInstall(args[0]), [])
  const setAccentColor = useCallback((...args: any[]) => useSettingsStore.getState().setAccentColor(args[0]), [])
  const setSoundEnabled = useCallback((...args: any[]) => useSettingsStore.getState().setSoundEnabled(args[0]), [])
  const setBatchMode = useCallback((...args: any[]) => useSettingsStore.getState().setBatchMode(args[0]), [])
  const setQuickToolsOpen = useCallback((...args: any[]) => useSettingsStore.getState().setQuickToolsOpen(args[0]), [])
  const setPureBlack = useCallback((...args: any[]) => useSettingsStore.getState().setPureBlack(args[0]), [])
  const setGameSharingEnabled = useCallback((...args: any[]) => useSettingsStore.getState().setGameSharingEnabled(args[0]), [])
  const setReducedMotion = useCallback((...args: any[]) => useSettingsStore.getState().setReducedMotion(args[0]), [])

  // ── Install Store Setters (core install) ──
  const setInstallModalOpen = useCallback((...args: any[]) => useInstallStore.getState().setInstallModalOpen(args[0]), [])
  const setInstallStatus = useCallback((...args: any[]) => useInstallStore.getState().setInstallStatus(args[0]), [])
  const setInstallProgress = useCallback((...args: any[]) => useInstallStore.getState().setInstallProgress(args[0]), [])
  const setInstallGameInfo = useCallback((...args: any[]) => useInstallStore.getState().setInstallGameInfo(args[0]), [])
  const setInstallingGame = useCallback((...args: any[]) => useInstallStore.getState().setInstallingGame(args[0]), [])
  const installingDLC = useInstallStore(s => s.installingDLC)
  const setInstallingDLC = useCallback((...args: any[]) => useInstallStore.getState().setInstallingDLC(args[0]), [])
  const lastAddedDLCCount = useInstallStore(s => s.lastAddedDLCCount)
  const setLastAddedDLCCount = useCallback((...args: any[]) => useInstallStore.getState().setLastAddedDLCCount(args[0]), [])
  const setCardLoading = useCallback((...args: any[]) => useInstallQueueStore.getState().setCardLoading(args[0]), [])
  const setRecentlyAddedGames = useCallback((...args: any[]) => useInstallQueueStore.getState().setRecentlyAddedGames(args[0]), [])
  const setInstallQueue = useCallback((...args: any[]) => useInstallQueueStore.getState().setInstallQueue(args[0]), [])
  const setShowInstallQueue = useCallback((...args: any[]) => useInstallQueueStore.getState().setShowInstallQueue(args[0]), [])
  const setActiveDownloadAbort = useCallback((...args: any[]) => useInstallStore.getState().setActiveDownloadAbort(args[0]), [])

  // ── Modal Store Setters ──
  const setFixGamesModalOpen = useCallback((...args: any[]) => useModalStore.getState().setFixGamesModalOpen(args[0]), [])
  const setScanGamesModalOpen = useCallback((...args: any[]) => useModalStore.getState().setScanGamesModalOpen(args[0]), [])
  const setDownloadModalOpen = useCallback((...args: any[]) => useModalStore.getState().setDownloadModalOpen(args[0]), [])
  const setExtractModalOpen = useCallback((...args: any[]) => useModalStore.getState().setExtractModalOpen(args[0]), [])
  const setExtractFileName = useCallback((...args: any[]) => useModalStore.getState().setExtractFileName(args[0]), [])
  const setExtractFilePath = useCallback((...args: any[]) => useModalStore.getState().setExtractFilePath(args[0]), [])
  const setFixGamesScriptModalOpen = useCallback((...args: any[]) => useModalStore.getState().setFixGamesScriptModalOpen(args[0]), [])

  // ── Download Store Setters ──
  const setDownloadProgress = useCallback((...args: any[]) => useDownloadStore.getState().setDownloadProgress(args[0]), [])
  const setDownloadStatus = useCallback((...args: any[]) => useDownloadStore.getState().setDownloadStatus(args[0]), [])
  const setDownloadName = useCallback((...args: any[]) => useDownloadStore.getState().setDownloadName(args[0]), [])
  const setDownloadMessage = useCallback((...args: any[]) => useDownloadStore.getState().setDownloadMessage(args[0]), [])
  const setDownloadDetails = useCallback((...args: any[]) => useDownloadStore.getState().setDownloadDetails(args[0]), [])
  const setDownloadQueue = useCallback((...args: any[]) => useDownloadStore.getState().setDownloadQueue(args[0]), [])
  const setShowDownloadQueue = useCallback((...args: any[]) => useDownloadStore.getState().setShowDownloadQueue(args[0]), [])

  // ── Fix Games Store Setters ──
  const setFixGamesStatus = useCallback((...args: any[]) => useFixGamesStore.getState().setFixGamesStatus(args[0]), [])
  const setFixGamesOutput = useCallback((...args: any[]) => useFixGamesStore.getState().setFixGamesOutput(args[0]), [])
  const setFixGamesScriptStatus = useCallback((...args: any[]) => useFixGamesStore.getState().setFixGamesScriptStatus(args[0]), [])
  const setFixGamesScriptOutput = useCallback((...args: any[]) => useFixGamesStore.getState().setFixGamesScriptOutput(args[0]), [])
  const setFixGamesScriptProgress = useCallback((...args: any[]) => useFixGamesStore.getState().setFixGamesScriptProgress(args[0]), [])
  const setFixGamesContactOpen = useCallback((...args: any[]) => useFixGamesStore.getState().setFixGamesContactOpen(args[0]), [])
  const setPreviewFix = useCallback((...args: any[]) => useFixGamesStore.getState().setPreviewFix(args[0]), [])

  // ── Scan Store Setters ──
  const setScanGamesProgress = useCallback((...args: any[]) => useScanStore.getState().setScanGamesProgress(args[0]), [])
  const setScanGamesStatus = useCallback((...args: any[]) => useScanStore.getState().setScanGamesStatus(args[0]), [])
  const setScanGamesResult = useCallback((...args: any[]) => useScanStore.getState().setScanGamesResult(args[0]), [])
  const setScanGamesMinimized = useCallback((...args: any[]) => useScanStore.getState().setScanGamesMinimized(args[0]), [])

  // ── Install Store: Direct setter subscriptions (not useCallback-wrapped in original) ──
  const setInstallFailedAppid = useCallback((...args: any[]) => useInstallStore.getState().setInstallFailedAppid(args[0]), [])
  const setDlcCount = useCallback((...args: any[]) => useInstallStore.getState().setDlcCount(args[0]), [])
  const setInstalledDlcs = useCallback((...args: any[]) => useInstallStore.getState().setInstalledDlcs(args[0]), [])

  // ── User Store Setters ──
  const setFavorites = useCallback((...args: any[]) => useUserStore.getState().setFavorites(args[0]), [])
  const setRecentGames = useCallback((...args: any[]) => useUserStore.getState().setRecentGames(args[0]), [])
  const setLogs = useCallback((...args: any[]) => useUserStore.getState().setLogs(args[0]), [])
  const setFeaturedGame = useCallback((...args: any[]) => useUserStore.getState().setFeaturedGame(args[0]), [])
  const setQuickAccessOffset = useCallback((...args: any[]) => useUserStore.getState().setQuickAccessOffset(args[0]), [])
  const setPortalModalOpen = useCallback((...args: any[]) => useUserStore.getState().setPortalModalOpen(args[0]), [])
  const setPortalGame = useCallback((...args: any[]) => useUserStore.getState().setPortalGame(args[0]), [])
  const setPortalScreenshots = useCallback((...args: any[]) => useUserStore.getState().setPortalScreenshots(args[0]), [])
  const setPortalDetails = useCallback((...args: any[]) => useUserStore.getState().setPortalDetails(args[0]), [])
  const setPortalRelated = useCallback((...args: any[]) => useUserStore.getState().setPortalRelated(args[0]), [])
  const setUserStats = useCallback((...args: any[]) => useUserStore.getState().setUserStats(args[0]), [])
  const setPinnedGames = useCallback((...args: any[]) => useUserStore.getState().setPinnedGames(args[0]), [])
  const setShowAchievements = useCallback((...args: any[]) => useUserStore.getState().setShowAchievements(args[0]), [])
  const setOwnedGameIds = useCallback((...args: any[]) => useUserStore.getState().setOwnedGameIds(args[0]), [])
  const setFixHealth = useCallback((...args: any[]) => useUserStore.getState().setFixHealth(args[0]), [])
  const setSearchHistory = useCallback((...args: any[]) => useUserStore.getState().setSearchHistory(args[0]), [])
  const setShowSearchSuggestions = useCallback((...args: any[]) => useUserStore.getState().setShowSearchSuggestions(args[0]), [])

  // ── Discord Store Setters ──
  const setDiscordModalOpen = useCallback((...args: any[]) => useDiscordStore.getState().setDiscordModalOpen(args[0]), [])
  const setDiscordConnected = useCallback((...args: any[]) => useDiscordStore.getState().setDiscordConnected(args[0]), [])
  const setDiscordUser = useCallback((...args: any[]) => useDiscordStore.getState().setDiscordUser(args[0]), [])

  // ── Refs (migrated from App.tsx lines 1111-1115) ──
  const dlcCountRef = useRef(0)

  // ── Utility Functions ──
  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return ''
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  return {
    // ── Game Store ──
    setLoading,
    setProgress,
    setGames,
    dynamicFreeIds,
    setDynamicFreeIds,
    setCurrentPageNum,
    setSearchQuery,
    setSortBy,
    setViewMode,
    setSelectedGame,
    setSelectedGames,
    setGamePanelOpen,
    setFixes,
    setFixSearchQuery,
    setFixFilter,
    setCustomFixHighlights,
    setInstalledGames,
    setLibrarySearchQuery,
    setKnownDlcIds,

    // ── UI Store ──
    setCurrentPage,
    setPageHistory,
    setForwardHistory,
    setToasts,
    setUpdateModalOpen,
    setChangelogOpen,
    setChangelogVersion,
    setActivationOpen,
    setIsActivated,
    setThankYouOpen,
    setContextMenu,
    contextMenuGame,
    setContextMenuGame,
    setShowExportModal,
    setShowImportModal,
    setImportResult,
    setBatchSelectMode,
    setBatchSelected,
    setStartupDiscordModal,

    // ── Settings Store ──
    setCompactMode,
    setIncludeDLC,
    setQuickInstall,
    setAccentColor,
    setSoundEnabled,
    setBatchMode,
    setQuickToolsOpen,
    setPureBlack,
    setGameSharingEnabled,
    setReducedMotion,

    // ── Install Store (core) ──
    setInstallModalOpen,
    setInstallStatus,
    setInstallProgress,
    setInstallGameInfo,
    setInstallingGame,
    installingDLC,
    setInstallingDLC,
    lastAddedDLCCount,
    setLastAddedDLCCount,
    setCardLoading,
    setRecentlyAddedGames,
    setInstallQueue,
    setShowInstallQueue,
    setActiveDownloadAbort,
    setInstallFailedAppid,
    setDlcCount,
    setInstalledDlcs,

    // ── Modal Store ──
    setFixGamesModalOpen,
    setScanGamesModalOpen,
    setDownloadModalOpen,
    setExtractModalOpen,
    setExtractFileName,
    setExtractFilePath,
    setFixGamesScriptModalOpen,

    // ── Download Store ──
    setDownloadProgress,
    setDownloadStatus,
    setDownloadName,
    setDownloadMessage,
    setDownloadDetails,
    setDownloadQueue,
    setShowDownloadQueue,

    // ── Fix Games Store ──
    setFixGamesStatus,
    setFixGamesOutput,
    setFixGamesScriptStatus,
    setFixGamesScriptOutput,
    setFixGamesScriptProgress,
    setFixGamesContactOpen,
    setPreviewFix,

    // ── Scan Store ──
    setScanGamesProgress,
    setScanGamesStatus,
    setScanGamesResult,
    setScanGamesMinimized,

    // ── User Store ──
    setFavorites,
    setRecentGames,
    setLogs,
    setFeaturedGame,
    setQuickAccessOffset,
    setPortalModalOpen,
    setPortalGame,
    setPortalScreenshots,
    setPortalDetails,
    setPortalRelated,
    setUserStats,
    setPinnedGames,
    setShowAchievements,
    setOwnedGameIds,
    setFixHealth,
    setSearchHistory,
    setShowSearchSuggestions,

    // ── Discord Store ──
    setDiscordModalOpen,
    setDiscordConnected,
    setDiscordUser,

    // ── Refs ──
    dlcCountRef,

    // ── Utilities ──
    formatBytes,
  } as const
  // ── Total: 116 exported values ──
}
