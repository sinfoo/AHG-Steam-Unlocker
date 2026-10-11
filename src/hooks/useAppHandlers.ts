import { t } from '../i18n'
import { useCallback } from 'react'
import { useGameStore, useUIStore, useUserStore, useDownloadStore, useFixGamesStore } from '../store'
import type { Game, QueuedGame } from '../types'
import { bridge } from '../bridge'

// ── Dependencies injected from App.tsx (local state + refs that can't live in stores) ──
export interface HandlerDeps {
  showToast: (message: string, type?: 'success' | 'error' | 'favorites' | 'info') => void
  addLog: (message: string, type?: 'info' | 'success' | 'error' | 'warn') => void
  playSound: (type: 'success' | 'error' | 'click' | 'hover' | 'achievement') => void
  handleInstallGameRef: React.MutableRefObject<any>
  handleInstallFromZip: (game?: any) => void
  downloadQueueRunningRef: React.MutableRefObject<boolean>

  // Local state — modal visibility
  setGameActionModalOpen: (v: boolean) => void
  setGameActionModalGame: (v: Game | null) => void
  setContextMenu: (v: any) => void

  // Local state — modal data
  games: Game[]

  // Achievement tracking
  trackGameClicked: () => void
  trackFavoriteAdded: (count: number) => void
  trackQuickToolUsed: () => void
}

export interface AppHandlers {
  navigateTo: (page: string) => void
  handleGoToBrowse: () => void
  handleGoToFixes: () => void
  toggleFavorite: (appid: string) => void
  handleGameClick: (game: Game) => void
  openPortalModal: (game: Game) => Promise<void>
  handleContextMenu: (e: React.MouseEvent, game: Game) => void
  contextMenuInstall: (game: Game) => Promise<void>
  contextMenuCopyAppId: (game: Game) => void
  contextMenuOpenSteam: (game: Game) => void
  contextMenuShareCard: (game: Game) => void
  contextMenuToggleFavorite: (game: Game) => void
  contextMenuRemoveGame: (game: Game) => Promise<void>
  runFixGames: () => Promise<void>
  addToDownloadQueue: (game: Game) => void
  removeFromDownloadQueue: (appid: string) => void
  processDownloadQueue: () => Promise<void>
}

export function useAppHandlers(d: HandlerDeps): AppHandlers {
  // ── Navigation ──
  const navigateTo = useCallback((page: string) => {
    useUIStore.setState({
      pageHistory: [...useUIStore.getState().pageHistory.slice(-49), page as 'home' | 'browse' | 'library' | 'favourites' | 'recent' | 'fixes' | 'settings'],
      forwardHistory: [],
      currentPage: page as 'home' | 'browse' | 'library' | 'favourites' | 'recent' | 'fixes' | 'settings',
    })
    setTimeout(() => {
      useGameStore.setState({ currentPageNum: 0, searchQuery: '', fixSearchQuery: '' })
    }, 0)
    const mainEl = document.querySelector('main')
    if (mainEl) mainEl.scrollTo({ top: 0, behavior: 'instant' })
  }, [])

  const handleGoToBrowse = useCallback(() => {
    navigateTo('browse')
  }, [navigateTo])

  const handleGoToFixes = useCallback(() => {
    useGameStore.getState().setFixSearchQuery('')
    navigateTo('fixes')
  }, [navigateTo])

  // ── Favorites ──
  const toggleFavorite = useCallback((appid: string) => {
    const current = useUserStore.getState().favorites
    const next = new Set(current)
    if (next.has(appid)) {
      next.delete(appid)
      d.showToast(t('ui.toast.favRemoved'), 'favorites')
    } else {
      next.add(appid)
      useUserStore.getState().logActivity(appid, 'favourited')
      d.showToast(t('ui.toast.favAdded'), 'favorites')
      d.trackFavoriteAdded(next.size)
    }
    window.electronAPI?.saveFavorites?.(Array.from(next))
    useUserStore.setState({ favorites: next })
  }, [d.showToast, d.trackFavoriteAdded])

  // ── Game Click ──
  const handleGameClick = useCallback((game: Game) => {
    d.setGameActionModalGame(game)
    d.setGameActionModalOpen(true)
    requestAnimationFrame(() => {
      const recentPrev = useUserStore.getState().recentGames
      useUserStore.getState().logActivity(game.appid, 'viewed')
      const recentNext = [game.appid, ...recentPrev.filter((p: string) => p !== game.appid)].slice(0, 30)
      useUserStore.setState({ recentGames: recentNext })
      window.electronAPI?.saveRecent?.(recentNext)
      const prev = useUserStore.getState().userStats
      useUserStore.setState({ userStats: { ...prev, gamesViewed: prev.gamesViewed + 1 } })
      d.trackGameClicked()
    })
  }, [d.trackGameClicked])

  // ── Portal Modal ──
  const openPortalModal = useCallback(async (game: Game) => {
    useUserStore.getState().setPortalGame(game)
    useUserStore.getState().setPortalModalOpen(true)
    useUserStore.getState().setPortalScreenshots([])
    useUserStore.getState().setPortalDetails(null)
    useUserStore.getState().setPortalRelated([])
    try {
      const res = await fetch(`https://store.steampowered.com/api/appdetails?appids=${game.appid}&cc=us&l=en`)
      const data = await res.json()
      const appData = data[game.appid]?.data
      if (appData) {
        useUserStore.getState().setPortalDetails(appData)
        useUserStore.getState().setPortalScreenshots(appData.screenshots?.slice(0, 6).map((s: any) => s.path_full) || [])
      }
    } catch { /* silent */ }
    const related = d.games.filter(g => g.appid !== game.appid && !!g.header_image).slice(0, 8)
    useUserStore.getState().setPortalRelated(related)
  }, [d.games])

  // ── Context Menu ──
  const handleContextMenu = useCallback((e: React.MouseEvent, game: Game) => {
    e.preventDefault()
    d.setContextMenu({ x: e.clientX, y: e.clientY, game })
  }, [])

  const contextMenuInstall = useCallback(async (game: Game) => {
    d.setContextMenu(null)
    useGameStore.getState().setSelectedGame(game)
    setTimeout(() => { d.handleInstallGameRef.current?.(game) }, 50)
  }, [])

  const contextMenuCopyAppId = useCallback((game: Game) => {
    d.setContextMenu(null)
    navigator.clipboard.writeText(game.appid)
    d.showToast(t('ui.toast.appIdCopied'), 'success')
  }, [d.showToast])

  const contextMenuOpenSteam = useCallback((game: Game) => {
    d.setContextMenu(null)
    window.electronAPI?.openExternal?.(`https://store.steampowered.com/app/${game.appid}`)
  }, [])

  const contextMenuShareCard = useCallback((game: Game) => {
    d.setContextMenu(null)
    const text = `Check out ${game.name} on AHG Steam Unlocker! (App ID: ${game.appid})`
    navigator.clipboard.writeText(text)
    d.showToast(t('ui.toast.infoCopied'), 'success')
  }, [d.showToast])

  const contextMenuToggleFavorite = useCallback((game: Game) => {
    d.setContextMenu(null)
    toggleFavorite(game.appid)
  }, [toggleFavorite])

  const contextMenuRemoveGame = useCallback(async (game: Game) => {
    d.setContextMenu(null)
    try {
      const result = await bridge.removeInstalledGame(game.appid)
      if (result?.success) {
        const current = useGameStore.getState().installedGames
        const next = current.filter((g: any) => g.appid !== game.appid)
        window.electronAPI?.saveInstalled?.(next.map((g: any) => g.appid))
        useGameStore.getState().setInstalledGames(next)
        d.showToast(t('ui.toast.removedLib', { name: game.name ?? '' }), 'success')
      } else {
        d.showToast(t('ui.toast.removeFail', { err: result?.message || t('ui.err.unknown') }), 'error')
      }
    } catch (e: any) {
      d.showToast(t('ui.toast.removeFail', { err: e?.message || t('ui.err.unknown') }), 'error')
    }
  }, [d.showToast])

  // ── Fix Games ──
  const runFixGames = useCallback(async () => {
    d.addLog('Running fix for games not showing...', 'info')
    useFixGamesStore.getState().setFixGamesStatus('running')
    useFixGamesStore.getState().setFixGamesOutput('')

    // Fallback: if no progress-done event arrives in 2min, force 'done'
    const fallbackTimer = setTimeout(() => {
      if (useFixGamesStore.getState().fixGamesStatus === 'running') {
        useFixGamesStore.getState().setFixGamesStatus('done')
        d.addLog('AHG Script completed (timeout fallback)', 'warn')
      }
    }, 120_000)

    const cleanup = window.electronAPI?.onFixGamesProgress?.((data) => {
      if (data.output) {
        useFixGamesStore.getState().setFixGamesOutput((prev) => prev + data.output)
      }
      if (data.done) {
        clearTimeout(fallbackTimer)
        useFixGamesStore.getState().setFixGamesStatus(data.success ? 'done' : 'error')
        d.addLog(data.success ? '✓ AHG Script completed' : '✗ AHG Script failed', data.success ? 'success' : 'error')
      }
    })

    try {
      const result = await window.electronAPI?.fixGamesNotShowing?.()
      clearTimeout(fallbackTimer)
      if (result?.success) {
        useFixGamesStore.getState().setFixGamesStatus('done')
        d.addLog('✓ AHG Script completed', 'success')
      } else {
        useFixGamesStore.getState().setFixGamesOutput((prev) => prev + (result?.error || 'Unknown error'))
        useFixGamesStore.getState().setFixGamesStatus('error')
        d.addLog('✗ AHG Script failed', 'error')
      }
    } catch (e) {
      clearTimeout(fallbackTimer)
      if (!useFixGamesStore.getState().fixGamesOutput) {
        useFixGamesStore.getState().setFixGamesOutput(String(e))
      }
      useFixGamesStore.getState().setFixGamesStatus('error')
      d.addLog('✗ ' + e, 'error')
    } finally {
      clearTimeout(fallbackTimer)
      cleanup?.()
    }
  }, [d.addLog, d.showToast])

  // ── Download Queue ──
  const addToDownloadQueue = useCallback((game: Game) => {
    const current = useDownloadStore.getState().downloadQueue
    if (current.some((item: QueuedGame) => item.game.appid === game.appid)) return
    useDownloadStore.getState().setDownloadQueue([...current, { game, status: 'pending' as const, progress: 0 }])
    useDownloadStore.getState().setShowDownloadQueue(true)
    d.showToast(t('ui.toast.queued', { name: game.name ?? '' }), 'info')
  }, [d.showToast])

  const removeFromDownloadQueue = useCallback((appid: string) => {
    window.electronAPI?.cancelDownload?.()
    const current = useDownloadStore.getState().downloadQueue
    useDownloadStore.getState().setDownloadQueue(current.filter((item: QueuedGame) => item.game.appid !== appid))
  }, [])

  const processDownloadQueue = useCallback(async () => {
    if (d.downloadQueueRunningRef.current) return
    d.downloadQueueRunningRef.current = true
    const queue = useDownloadStore.getState().downloadQueue
    const paused = useDownloadStore.getState().downloadQueuePaused
    const pending = queue.filter((item: QueuedGame) => item.status === 'pending')
    for (const item of pending) {
      if (paused) break
      useDownloadStore.getState().setDownloadQueue((prev: QueuedGame[]) =>
        prev.map(i => i.game.appid === item.game.appid ? { ...i, status: 'downloading' as const } : i))
      try {
        const result = await window.electronAPI?.addToSteam?.(item.game.appid)
        if (result?.success) {
          useDownloadStore.getState().setDownloadQueue((prev: QueuedGame[]) =>
            prev.map(i => i.game.appid === item.game.appid ? { ...i, status: 'done' as const, progress: 100 } : i))
          d.showToast(t('ui.toast.installedName', { name: item.game.name ?? '' }), 'success')
        } else {
          throw new Error(result?.message || 'Install failed')
        }
      } catch (e) {
        useDownloadStore.getState().setDownloadQueue((prev: QueuedGame[]) =>
          prev.map(i => i.game.appid === item.game.appid ? { ...i, status: 'error' as const, error: String(e) } : i))
        d.showToast(t('ui.toast.installFailed', { name: item.game.name ?? '' }), 'error')
      }
    }
    d.downloadQueueRunningRef.current = false
  }, [d.showToast])

  return {
    navigateTo,
    handleGoToBrowse,
    handleGoToFixes,
    toggleFavorite,
    handleGameClick,
    openPortalModal,
    handleContextMenu,
    contextMenuInstall,
    contextMenuCopyAppId,
    contextMenuOpenSteam,
    contextMenuShareCard,
    contextMenuToggleFavorite,
    contextMenuRemoveGame,
    runFixGames,
    addToDownloadQueue,
    removeFromDownloadQueue,
    processDownloadQueue,
  }
}
