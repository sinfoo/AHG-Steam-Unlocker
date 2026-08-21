import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { motion } from 'framer-motion'
import { bridge } from './bridge'
import { Sidebar } from './components/Sidebar'
import TitleBar from './components/TitleBar'
import { AnimatedBackground } from './components/AnimatedBackground'

// GameDetailPanel removed — install buttons moved into GameCard

// ── Utility: hex color → comma-separated RGB ──
function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return '255,255,255'
  return `${parseInt(result[1]!, 16)}, ${parseInt(result[2]!, 16)}, ${parseInt(result[3]!, 16)}`
}

// ── Inline game processing (fallback for worker timeout/error) ──
function processGamesInline(games: any[], freeIds: string[]): any[] {
  const dynamicFreeSet = new Set(freeIds)
  const filtered = games.filter(
    (g: any) => !isF2PGame(g, dynamicFreeSet) && (g.type || '').toLowerCase() !== 'dlc',
  )
  const deduped = new Map<string, any>()
  for (const g of filtered) {
    const key = String(g.appid)
    const existing = deduped.get(key)
    if (!existing || (g.header_image || '').length > (existing.header_image || '').length) {
      deduped.set(key, { ...g, appid: key })
    }
  }
  return [...deduped.values()]
}

import { ErrorBoundary } from './components/ErrorBoundary'
import { useAppHandlers } from './hooks/useAppHandlers'



import { Download, RefreshCw, FolderPlus, RotateCw, Upload, FolderOpen } from 'lucide-react'
// Pages loaded via PageRouter (./components/PageRouter)

import { DARK_COLORS } from './constants/colors'

// ── Zustand Stores ──
import { useUIStore, useGameStore, useInstallStore } from './store'
import { useAppGameState, useAppUIState, useAppSettingsState, useAppUserState, useAppDiscordState } from './hooks/useAppState'

// ── Extracted Domain Hooks ──
import { useSound } from './hooks/useSound'
import { useToastNotifications } from './hooks/useToastNotifications'
import { useGameFilters as useGameFiltersHook, isF2PGame } from './hooks/useGameFilters'
import { useAchievements } from './hooks/useAchievements'
import { useAppSetters } from './hooks/useAppSetters'
import { useDLCFetching } from './hooks/useDLCFetching'
import { useContentSync } from './hooks/useContentSync'
import { useFixApplication } from './hooks/useFixApplication'
import { useInstallGame } from './hooks/useInstallGame'
import { useScanGames } from './hooks/useScanGames'
import { useLicense } from './hooks/useLicense'
import { useDiscordAuth } from './hooks/useDiscordAuth'
import { achievementRefs } from './hooks/achievementRefs'
import ModalRenderer from './components/ModalRenderer'
import PageRouter from './components/PageRouter'
import type { ModalRendererProps } from './components/ModalRenderer'

import AppHeader from './components/AppHeader'
import type { Game } from './types'
import { getHeroUrl, prefetchImages } from './services/steamGridDb'

// GameCover moved to ./components/GameCover

// SkeletonCard + SkeletonLoader moved to ./components/Skeletons

// AnimatedBackground moved to ./components/AnimatedBackground

function App() {
  const searchInputRef = useRef<HTMLInputElement>(null)

  // ── Batched Store Hooks (single subscriptions per store) ──
  const {
    loading, progress, games, searchQuery, viewMode,
    selectedGame, selectedGames,
    installedGames,
  } = useAppGameState()
  const {
    currentPage, pageHistory, forwardHistory,
    windowWidth,
    isActivated,
    startupDiscordModal,
  } = useAppUIState()
  const {
    compactMode, accentColor, soundEnabled,
    batchMode, quickToolsOpen, pureBlack, reducedMotion,
    hideSearchBars,
  } = useAppSettingsState()
  const {
    favorites, recentGames, featuredGame,
  } = useAppUserState()
  const {
    discordConnected,
  } = useAppDiscordState()

  const {
    setLoading, setProgress, setGames, setDynamicFreeIds,
    setCurrentPageNum, setSearchQuery,
    setViewMode,
    setFixes,
    setInstalledGames, setKnownDlcIds,
    setCurrentPage, setPageHistory, setForwardHistory,
    setUpdateModalOpen,
    setContextMenu,
    setShowExportModal, setShowImportModal, setImportResult: _setImportResult,
    setCompactMode, setAccentColor,
    setSoundEnabled, setBatchMode, setQuickToolsOpen, setPureBlack,
    setReducedMotion,
    setDownloadProgress, setDownloadDetails,
    setShowDownloadQueue,
    setScanGamesModalOpen, setScanGamesProgress, setScanGamesStatus, setScanGamesResult,
    setFixGamesModalOpen, setFixGamesStatus,
    setFixGamesOutput, setFixGamesScriptProgress, setFixGamesContactOpen,
    setFavorites, setRecentGames, setFeaturedGame,
    setPinnedGames, setShowAchievements,
    setOwnedGameIds, setSearchHistory: _setSearchHistory,
    setDiscordModalOpen, setRecentlyAddedGames,
    setStartupDiscordModal,
  } = useAppSetters()
  const [showMainApp, setShowMainApp] = useState(false)
  const [splashDone, setSplashDone] = useState(false)
  const [gameActionModalOpen, setGameActionModalOpen] = useState(false)
  // startupDiscordModal moved to uiStore (useAppUIState / useAppSetters)
  const [gameActionModalGame, setGameActionModalGame] = useState<Game | null>(null)
  const [dlcManagerOpen, setDlcManagerOpen] = useState(false)
  const [dlcManagerGame, setDlcManagerGame] = useState<Game | null>(null)
  const [discordSuccessOpen, setDiscordSuccessOpen] = useState(false)
  // Lazy chunks will load on demand via React.lazy — no eager preload

  useEffect(() => {
    if (splashDone && isActivated) {
      console.log('[APP-TRACE] showMainApp set to true (splashDone=' + splashDone + ', isActivated=' + isActivated + ')')
      setShowMainApp(true)
    }
  }, [splashDone, isActivated])

  useEffect(() => {
    if (!loading && showMainApp) {
      console.log('[APP-TRACE] dispatching hide-splash')
      const t = setTimeout(() => {
        window.dispatchEvent(new CustomEvent('hide-splash'))
        console.log('[APP-TRACE] hide-splash dispatched')
      }, 80)
      return () => clearTimeout(t)
    }
  }, [loading, showMainApp])

  // ── Reveal the activation modal ──
  // When the license check completes and activation is required, `showMainApp` stays false
  // (it gates on isActivated), so the opaque HTML splash would otherwise sit on top of the
  // ActivationModal forever ("stuck at the loading screen"). Peel the splash away here so the
  // modal is visible. activationOpen is only set true AFTER checkLicense resolves, so this
  // never fires while activated.
  const activationOpen = useUIStore(s => s.activationOpen)
  useEffect(() => {
    if (!(splashDone && activationOpen)) return
    // Let the loading screen play briefly (the real catalogue load drives the bar/phases/
    // tips), THEN reveal the activation modal — while the catalogue keeps loading in the
    // background, so Browse is ready the instant the license activates.
    const hideTimer = setTimeout(() => window.dispatchEvent(new CustomEvent('hide-splash')), 1900)
    return () => clearTimeout(hideTimer)
  }, [splashDone, activationOpen])

  // Bridge real loading progress from React to the HTML splash bar
  useEffect(() => {
    if (splashDone) {
      window.dispatchEvent(new CustomEvent('progress-update', { detail: { percent: Math.round(progress) } }))
    }
  }, [progress, splashDone])

  // Auto-check for updates on startup — silently checks GitHub, opens modal if update found
  useEffect(() => {
    let cancelled = false
    const check = async () => {
      try {
        const api = (window as any).electronAPI
        if (!api?.checkForUpdates) return
        const data = await api.checkForUpdates()
        if (!cancelled && data?.hasUpdate) {
          useUIStore.getState().setUpdateModalOpen(true)
        }
      } catch {
        // Silently fail — don't annoy the user on startup
      }
    }
    // Delay the check slightly so the main UI can render first
    const t = setTimeout(check, 3000)
    return () => { cancelled = true; clearTimeout(t) }
  }, [])
  // ── Fullscreen state ──
  const [isFullscreen, setIsFullscreen] = useState(false)
  useEffect(() => {
    window.electronAPI?.isFullscreen?.().then(setIsFullscreen)
    window.electronAPI?.onFullscreenChange?.(setIsFullscreen)
  }, [])

  // ── Sidebar overlay toggle for narrow windows ──
  const [sidebarOverlayOpen, setSidebarOverlayOpen] = useState(false)
  useEffect(() => {
    if (windowWidth >= 1100) setSidebarOverlayOpen(false)
  }, [windowWidth])

  // ── Extracted Hook Calls ──
  const { playSound } = useSound()
  const { showToast, addLog } = useToastNotifications()
  const gameFilters = useGameFiltersHook()
  const {
    homeSections, recentGamesList, aiRecommendations,
    filteredGames, popularGamesWithCover,
    navItems,
    gamesWithCover,
  } = gameFilters
  const achievementsData = useAchievements((msg: string, type: string) => showToast(msg, type as 'success' | 'error' | 'info'), playSound, currentPage, searchQuery, loading)
  const { achievements, setAchievements, userLevel, trackGameClicked, trackFavoriteAdded, trackQuickToolUsed, trackFixGamesScript: _trackFixGamesScript, trackGameInstalled, trackDLCInstalled, trackFixApplied, trackScanCompleted, trackCollectionCreated, trackDiscordConnected, trackBatchInstall } = achievementsData

  // Wire achievement tracker refs for hooks that don't receive callbacks via DI
  useEffect(() => {
    achievementRefs.trackGameInstalled = trackGameInstalled
    achievementRefs.trackDLCInstalled = trackDLCInstalled
    achievementRefs.trackFixApplied = trackFixApplied
    achievementRefs.trackScanCompleted = trackScanCompleted
    achievementRefs.trackCollectionCreated = trackCollectionCreated
    achievementRefs.trackDiscordConnected = trackDiscordConnected
  }, [trackGameInstalled, trackDLCInstalled, trackFixApplied, trackScanCompleted, trackCollectionCreated, trackDiscordConnected])

  const downloadQueueRunningRef = useRef(false)
  // Guards post-load IPC listener registration so onScanProgress/onDownloadProgress/onInstallLog
  // are wired exactly once (the load effect can re-run; onInstallLog does not de-dupe in preload).
  const postLoadHandlersRef = useRef(false)
  // ── Domain Hook Calls (replacing inlined implementations) ──
  useDLCFetching()
  useContentSync()
  useLicense()
  useDiscordAuth()
  const { handleApplyFix, handleDeleteGame } = useFixApplication()
  const { handleInstallGame, handleInstallFromZip, handleInstallGameRef } = useInstallGame()
  const { startScanGames, reloadGamesList } = useScanGames()

  const handleBatchInstall = useCallback(async () => {
    const ids = Array.from(selectedGames)
    if (ids.length === 0) {
      showToast('No games selected', 'info')
      return
    }
    trackBatchInstall()
    const gameById = new Map(gamesWithCover.map((g: Game) => [String(g.appid), g]))
    showToast(`Installing ${ids.length} game${ids.length > 1 ? 's' : ''}…`, 'info')
    let ok = 0, fail = 0
    // Sequential install — reuses the single-install flow (modal, DLCs, Discord share,
    // state updates) per game so batch behaves exactly like clicking install N times,
    // without hammering the mirror/Ryuu backends concurrently.
    for (const id of ids) {
      const game = gameById.get(String(id))
      if (!game) { fail++; continue }
      try {
        await handleInstallGame(game)
        if (useInstallStore.getState().installStatus === 'error') fail++
        else ok++
      } catch { fail++ }
    }
    useGameStore.getState().setSelectedGames(new Set())
    setBatchMode(false)
    playSound(fail === 0 ? 'success' : 'error')
    showToast(`Batch install finished — ${ok} added${fail ? `, ${fail} failed` : ''}`, fail === 0 ? 'success' : 'error')
  }, [selectedGames, gamesWithCover, handleInstallGame, showToast, trackBatchInstall, setBatchMode, playSound])

  const COLORS = useMemo((): typeof DARK_COLORS => {
    const base = DARK_COLORS
    if (pureBlack) {
      return { ...base, bgDeep: '#000000', bgDark: '#000000', bgMid: '#0a0a0a' } as unknown as typeof DARK_COLORS
    }
    return base
  }, [pureBlack])
  const accent = useMemo(() => COLORS[accentColor as keyof typeof COLORS], [accentColor, COLORS])

  // ── Inject accent color as CSS custom properties for global use ──
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--accent', accent)
    root.style.setProperty('--accent-rgb', hexToRgb(accent))
  }, [accent])

  // gamesWithCover, popularGamesWithCover, homeSections, recentGamesList, aiRecommendations,
  // similarGames, fixableAppids, comingSoonAppids, filteredLibraryGames moved to useGameFilters hook

  // ── Window resize tracking for responsive layout ──
  useEffect(() => {
    let frameId: number
    const handleResize = () => {
      cancelAnimationFrame(frameId)
      frameId = requestAnimationFrame(() => useUIStore.getState().setWindowWidth(window.innerWidth))
    }
    window.addEventListener('resize', handleResize, { passive: true })
    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(frameId)
    }
  }, [])

  const sidebarCollapsed = windowWidth < 1100 ? !sidebarOverlayOpen : false

  useEffect(() => { if (popularGamesWithCover.length > 0 && !featuredGame) setFeaturedGame(popularGamesWithCover[Math.floor(Math.random() * popularGamesWithCover.length)]) }, [popularGamesWithCover.length])

  useEffect(() => { if (currentPage === 'home' && popularGamesWithCover.length > 0 && !featuredGame) setFeaturedGame(popularGamesWithCover[Math.floor(Math.random() * popularGamesWithCover.length)]) }, [currentPage, popularGamesWithCover.length])

  // ponytail: auto-rotation removed — HeroSection has its own sequential rotation

  // ── Preload hero images for carousel games once available (F2/F6) ──
  useEffect(() => {
    if (!loading && popularGamesWithCover.length > 0) {
      const carouselAppids = popularGamesWithCover.slice(0, 10).map(g => g.appid)
      carouselAppids.forEach(appid => getHeroUrl(appid).catch(() => {}))
    }
  }, [loading, popularGamesWithCover])

  // ── Prefetch SGDB image metadata for first visible games during idle time (I4) ──
  useEffect(() => {
    if (!loading && games.length > 0 && typeof requestIdleCallback === 'function') {
      const idleCb = requestIdleCallback(() => {
        const appids = games.slice(0, 100).map(g => g.appid)
        prefetchImages(appids).catch(() => {})
      }, { timeout: 3000 })
      return () => cancelIdleCallback(idleCb)
    }
  }, [loading, games])

  // Mouse button navigation: 3=back, 4=forward
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      // Don't intercept mouse nav if clicking sidebar nav buttons or close to them
      const target = e.target as HTMLElement
      if (target?.closest?.('.sidebar-nav-btn, .sidebar-logo, .sidebar-footer, .sidebar-icon-wrap, aside button, [class*="sidebar"]')) return
      if (e.button === 3) {
        e.preventDefault()
        if (pageHistory.length > 1) {
          const current = pageHistory[pageHistory.length - 1]
          setForwardHistory((prev: string[]) => [...prev, current])
          const newHistory = [...pageHistory]
          newHistory.pop()
          setPageHistory(newHistory)
          const prevPage = newHistory[newHistory.length - 1] as typeof currentPage
          setCurrentPage(prevPage)
        }
      } else if (e.button === 4) {
        e.preventDefault()
        if (forwardHistory.length > 0) {
          const newForward = [...forwardHistory]
          const nextPage = newForward.pop() as typeof currentPage
          setForwardHistory(newForward)
          setPageHistory((prev: string[]) => [...prev, nextPage])
          setCurrentPage(nextPage)
        }
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [pageHistory, forwardHistory])

  // ── Keyboard Shortcuts: Focus search ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'k')) {
        e.preventDefault()
        const searchInput = document.querySelector<HTMLInputElement>('input[placeholder*="Search"]')
        searchInput?.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // ── Action Handlers (extracted to useAppHandlers hook) ──
  const appHandlers = useAppHandlers({
    showToast, addLog, playSound,
    handleInstallGameRef, handleInstallFromZip,
    downloadQueueRunningRef,
    setGameActionModalOpen, setGameActionModalGame,
    setDiscordSuccessOpen, setContextMenu,
    games: gamesWithCover,
    trackGameClicked, trackFavoriteAdded, trackQuickToolUsed,
  })
  const {
    navigateTo, handleGoToBrowse, handleGoToFixes,
    toggleFavorite, handleGameClick, openPortalModal,
    handleContextMenu,
    contextMenuInstall, contextMenuCopyAppId, contextMenuOpenSteam,
    contextMenuShareCard, contextMenuToggleFavorite, contextMenuRemoveGame,
    runFixGames,
    addToDownloadQueue, removeFromDownloadQueue, processDownloadQueue,
  } = appHandlers

  // Reduced motion preference
  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(motionQuery.matches)
    
    const handleMotionChange = (e: MediaQueryListEvent) => {
      setReducedMotion(e.matches)
    }
    motionQuery.addEventListener('change', handleMotionChange)
    
    return () => {
      motionQuery.removeEventListener('change', handleMotionChange)
    }
  }, [])

  // License check moved to useLicense hook

  // Achievement tracking effects moved to useAchievements hook

  // Wait for HTML splash screen animation to finish before starting games load
  // Prevents React LoadingScreen showing beneath/after the HTML splash
  // Uses BOTH an event listener AND a flag check because in production builds,
  // the deferred module script can cause rAF (and thus splash-complete) to fire
  // BEFORE React's useEffect registers the event listener (first-paint race).
  useEffect(() => {
    const handler = () => {
      performance.mark('splash-complete')
      console.log('[APP-TRACE] splash-complete event received')
      setSplashDone(true)
    }
    window.addEventListener('splash-complete', handler, { once: true })
    // Guard: splash-complete may have already fired if rAF beat React to paint.
    // The inline splash script sets window.__splashCompleted = true after dispatching.
    if ((window as any).__splashCompleted) {
      console.log('[APP-TRACE] splash-complete flag already set (race guard)')
      setSplashDone(true)
      performance.mark('splash-complete')
      window.removeEventListener('splash-complete', handler)
    }
    return () => window.removeEventListener('splash-complete', handler)
  }, [])

  useEffect(() => {
    if (!splashDone) return
    // NOTE: intentionally NOT gated on isActivated — the catalogue loads in the background
    // while the activation modal is up, so the moment the license activates, Browse is
    // already fully populated (no post-activation load wait).
    console.log('[APP-TRACE] Loading effect triggered: splashDone=true, starting load sequence')
    const timer = setTimeout(async () => {
        setProgress(10)
      await new Promise(r => setTimeout(r, 100))
      setProgress(25)
      try {
        // ── LOAD GAMES FROM SQLite ──
        console.log('[APP-TRACE] Calling bridge.loadGames()...')
        const loadStart = performance.now()
        const data = await bridge.loadGames()
        const loadMs = (performance.now() - loadStart).toFixed(0)
        console.log('[APP-TRACE] bridge.loadGames() returned in ' + loadMs + 'ms, count:', data?.length || 0)
        setProgress(55)
        
        // Fire the async F2P check early so it runs in parallel with genre pre-compute
        // Limit to first 2000 appids to avoid 17k+ HTTP requests hanging the main process
        const allAppids = (data || []).slice(0, 2000).map((g: any) => String(g.appid))
        const freeIdsPromise = bridge.checkFreeGames?.(allAppids).catch(() => []) || Promise.resolve([])
        // Safety timeout — the dynamic F2P list is a nice-to-have, not worth blocking boot
        // on. Steam's API frequently rate-limits (HTTP 429), which used to hang the splash at
        // 78% for the full 15s. Cap it tight; the static F2P list still applies, and the
        // dynamic set (when it arrives) only refines ~a handful of the first 2000 appids.
        const timeoutController = new AbortController()
        const timeoutFreeIds = new Promise<string[]>(resolve => {
          const id = setTimeout(() => { timeoutController.abort(); resolve([]) }, 3500)
          // Cleanup if freeIdsPromise wins the race
          freeIdsPromise.finally(() => clearTimeout(id))
        })
        const racedFreeIds = Promise.race([freeIdsPromise, timeoutFreeIds])

        const allGames = data || []

        // Await the F2P check before setting games — prevents flicker
        setProgress(78)
        if (import.meta.env.DEV) console.log('[APP] Waiting for F2P check (max 3.5s)...')
        const beforeCheck = Date.now()
        const freeIds = await racedFreeIds
        if (import.meta.env.DEV) console.log('[APP] F2P check done in', Date.now() - beforeCheck, 'ms, freeIds:', freeIds?.length || 0)
        // First attempt already had 15s timeout; skip retry (Steam rate-limits make it pointless)
        if (!freeIds || freeIds.length === 0) {
          addLog('F2P check timed out — proceeding without dynamic F2P list', 'info')
        }
        let dynamicFreeSet = new Set<string>()
        if (freeIds && freeIds.length > 0) {
          dynamicFreeSet = new Set(freeIds)
          setDynamicFreeIds(dynamicFreeSet)
          addLog('Free-to-play check done', 'info')
        }
        
        // Process games in a Web Worker — filter + dedup off the main thread
        // so the renderer stays responsive during this CPU-heavy startup step.
        const normalizedData = await new Promise<any[]>((resolve) => {
          const loaderWorker = new Worker(
            new URL('./workers/gameLoader.worker.ts', import.meta.url),
            { type: 'module' },
          )
          const timeoutId = setTimeout(() => {
            loaderWorker.terminate()
            // Fallback: process inline if worker times out
            resolve(processGamesInline(allGames, freeIds || []))
          }, 10000)

          loaderWorker.onmessage = (e: MessageEvent) => {
            if (e.data.type === 'processed') {
              clearTimeout(timeoutId)
              resolve(e.data.games)
              loaderWorker.terminate()
            }
            if (e.data.type === 'error') {
              clearTimeout(timeoutId)
              console.warn('[APP] GameLoader worker error, falling back to inline:', e.data.error)
              resolve(processGamesInline(allGames, freeIds || []))
              loaderWorker.terminate()
            }
          }
          loaderWorker.onerror = (err) => {
            clearTimeout(timeoutId)
            console.warn('[APP] GameLoader worker onerror, falling back to inline:', err)
            resolve(processGamesInline(allGames, freeIds || []))
            loaderWorker.terminate()
          }

          loaderWorker.postMessage({
            type: 'process',
            queryId: 1,
            games: allGames,
            freeIds: freeIds || [],
          })
        })

        // Set games ONCE with complete F2P filtering applied
        setGames(normalizedData || [])
        if (import.meta.env.DEV) console.log('[APP] Games set:', (normalizedData || []).length)
        
        await new Promise(r => setTimeout(r, 200))
        setProgress(85)
        await new Promise(r => setTimeout(r, 150))
        setProgress(100)
        setLoading(false)
        console.log('[APP-TRACE] setLoading(false) called')
        performance.mark('app-interactive')
        performance.measure('boot-duration', 'splash-complete', 'app-interactive')
        const bootMs = performance.getEntriesByName('boot-duration')[0]?.duration || 0
        // Always log boot timing + disk-cache warmth so cold (empty cache) vs warm boots
        // can be compared now that image-cache:// actually serves from disk. The main
        // process buffers renderer logs to disk, so this lands in the session log.
        void (async () => {
          let cacheNote = ''
          try {
            const stats = await (window as any).electronAPI?.imageCacheStats?.()
            const n = stats?.stats?.entryCount
            if (typeof n === 'number') cacheNote = ` | image cache ${n > 0 ? 'WARM' : 'COLD'} (${n} entries)`
          } catch { /* stats unavailable */ }
          console.log('[PERF] boot (splash→interactive): ' + bootMs.toFixed(0) + 'ms' + cacheNote)
        })()
        if (import.meta.env.DEV) console.log('[APP] Loading complete, splash should hide')
        addLog('Games catalogue loaded', 'success')
        
        setupPostLoadHandlers()
      } catch (e) {
        console.error('Failed to load games:', e)
        addLog('Failed to load games', 'error')
        setLoading(false)
      }
    }, 100)
    return () => clearTimeout(timer)
    
    // Helper to set up listeners and check auth after load
    async function setupPostLoadHandlers() {
      // Register progress/log IPC listeners exactly once — the load effect can re-run
      // and onInstallLog does not de-dupe in preload, so unguarded it would multiply.
      if (!postLoadHandlersRef.current) {
        postLoadHandlersRef.current = true
        // Listen for scan progress events
        window.electronAPI?.onScanProgress?.((data: any) => {
          setScanGamesProgress(data.progress || 0)
        })

        // Listen for download progress events from main process
        window.electronAPI?.onDownloadProgress?.((data: any) => {
          setDownloadProgress(Math.round(data.percent))
          setDownloadDetails({ totalSize: data.totalSize, downloaded: data.downloaded, speed: data.speed })
        })

        // Listen for streaming install logs from main process
        window.electronAPI?.onInstallLog?.((data: { appid: string; message: string }) => {
          addLog(data.message, 'info')
          if (import.meta.env.DEV) console.log('[install] App ' + data.appid + ': ' + data.message)
        })
      }

      // Check for first launch or new version
      try {
        const lastSeen = await bridge.getLastSeenVersion()
        const currentVersion = '1.0.0'
        if (!lastSeen || lastSeen.version !== currentVersion) {
          // Changelog auto-open disabled — was appearing as "second splash screen"
          await bridge.setLastSeenVersion(currentVersion)
        }
      } catch (e) {
        if (import.meta.env.DEV) console.log('Changelog check error:', e)
      }

      // Discord auth check moved to useDiscordAuth hook

      // ── Start background image preloader ──
      // Priority: user's installed games fetched inline, then preloader processes
      // all remaining from _gamesCache automatically.
      bridge.getInstalledGames().then(result => {
        const installedIds = (result?.games || []).map((g: any) => String(g.appid))
        // Deduplicate and pass as priority for the preloader
        const priorityIds = [...new Set(installedIds)]
        bridge.preloaderStart(priorityIds, { batchSize: 50 }).catch(err => {
          if (import.meta.env.DEV) console.warn('[APP] Preloader start failed:', err)
        })
      }).catch(() => {
        // Start without priority list — preloader will use _gamesCache directly
        bridge.preloaderStart([]).catch(() => {})
      })
    }
    // isActivated intentionally omitted — load once on splashDone, don't re-run on activate.
  }, [addLog, splashDone])

   // Reset page when search changes
   useEffect(() => { setCurrentPageNum(0) }, [searchQuery])

  // Load installed games, favorites, recents — fires on splashDone (parallel with games catalog load)
  // DLC cross-referencing moved to separate effect that watches games.length + installedGames.length
  useEffect(() => {
    if (!isActivated) return
    if (!splashDone) return
    let retryTimer: ReturnType<typeof setTimeout> | undefined

    bridge.getInitData().then(data => {
      if (data.favorites) setFavorites(new Set(data.favorites))
      if (data.recent) setRecentGames(data.recent)
      if (data.fixes) {
        let mergedFixes = [...data.fixes]
        if (data.customFixes) {
          const existingAppids = new Set(data.fixes.map((f: any) => f.appid))
          const newFixes = data.customFixes.filter((f: any) => !existingAppids.has(f.appid))
          if (newFixes.length > 0) {
            mergedFixes = [...mergedFixes, ...newFixes]
            if (import.meta.env.DEV) console.log('[APP] Merged', newFixes.length, 'custom fixes into fixes array')
          }
        }
        setFixes(mergedFixes)
      }
      if (data.recentlyAdded) setRecentlyAddedGames(data.recentlyAdded)
      window.electronAPI?.clearRecentlyAdded?.()
    })

    window.electronAPI?.getInstalledGames?.().then((result: any) => {
      const installed = result?.games || []
      if (installed.length > 0) {
        setInstalledGames(installed)
      } else if (installed.length === 0) {
        retryTimer = setTimeout(() => {
          window.electronAPI?.getInstalledGames?.().then((retryResult: any) => {
            const retryInstalled = retryResult?.games || []
            if (retryInstalled.length > 0) {
              setInstalledGames(retryInstalled)
            }
          })
        }, 3000)
      }
    })
    return () => { if (retryTimer) clearTimeout(retryTimer) }
  }, [splashDone, isActivated])

  useEffect(() => {
    if (installedGames.length === 0 || games.length === 0) return
    const masterIds = new Set((games || []).map((g: any) => g.appid))
    const dlcFromInstalled = installedGames
      .filter((g: any) => {
        if (g.isDlc) return true
        if (!masterIds.has(g.appid)) {
          const name = (g.name || '').trim()
          if (name && !/^App\s+\d+$/i.test(name) && name !== g.appid) return true
        }
        return false
      })
      .map((g: any) => g.appid)
    if (dlcFromInstalled.length > 0) {
      setKnownDlcIds(dlcFromInstalled as string[])
    }
  }, [installedGames.length, games.length])

  // handleGameClick, openPortalModal, handleContextMenu — extracted to useAppHandlers

  useEffect(() => {
    const closeContextMenu = (e: MouseEvent) => {
      if ((e.target as HTMLElement)?.closest('.context-menu')) return
      setContextMenu(null)
    }
    const onContextMenu = (e: MouseEvent) => {
      if ((e.target as HTMLElement)?.closest('.game-card-hover')) return
      closeContextMenu(e)
    }
    window.addEventListener('click', closeContextMenu)
    window.addEventListener('contextmenu', onContextMenu)
    return () => {
      window.removeEventListener('click', closeContextMenu)
      window.removeEventListener('contextmenu', onContextMenu)
    }
  }, [])

  useEffect(() => {
    if (!splashDone) return
    window.electronAPI?.getPinnedGames?.().then((pinned: string[]) => {
      if (pinned) setPinnedGames(new Set(pinned))
    })
    window.electronAPI?.getOwnedGames?.().then((owned: string[]) => {
      if (owned && owned.length > 0) {
        setOwnedGameIds(new Set(owned))
      } else {
        window.electronAPI?.detectOwnedGames?.().then((detected: number[]) => {
          if (detected && detected.length > 0) {
            const ids = detected.map(String)
            setOwnedGameIds(new Set(ids))
            window.electronAPI?.saveOwnedGames?.(ids)
          }
        })
      }
    })
    window.electronAPI?.onOwnedGamesUpdated?.((newGames: string[]) => {
        if (newGames && newGames.length > 0) {
          setOwnedGameIds((prev: Set<string>) => {
            const updated = new Set(prev)
            for (const id of newGames) updated.add(id)
            return updated
          })
          window.electronAPI?.getOwnedGames?.().then((owned: string[]) => {
            const merged = new Set([...owned, ...newGames])
            window.electronAPI?.saveOwnedGames?.(Array.from(merged))
          })
        }
      })
  }, [splashDone])

  // userStats save effect moved to useAchievements hook

  // filteredGames, realInstalledGamesCount, navItems, fixPage, setFixPage,
  // popularOrder, filteredFixes, paginatedFixes, toggleFixFilter moved to useGameFilters hook



  // handleInstallGame, handleInstallFromZip moved to useInstallGame hook

  // DLC fetching from multiple sources
  // fetchDLCs moved to useDLCFetching hook
  // handleDeleteGame moved to useFixApplication hook



  // handleApplyFix moved to useFixApplication hook

  // startScanGames, reloadGamesList, runUpdateCheck moved to useScanGames hook

  const quickTools = useMemo(() => [
    { name: 'AHG Script', desc: 'Run AHG maintenance script & restart Steam',     icon: RefreshCw, color: COLORS.green, action: () => {
      setFixGamesModalOpen(true)
      setFixGamesStatus('idle')
      setFixGamesOutput('')
      setFixGamesScriptProgress(0)
      setFixGamesContactOpen(false)
    }},
    { name: 'Scan for New Games', desc: 'Check repos for new manifests', icon: FolderPlus, color: COLORS.cyan, action: () => {
      setScanGamesModalOpen(true)
      setScanGamesStatus('scanning')
      setScanGamesProgress(10)
      setScanGamesResult({ found: 0, added: [] })
      startScanGames()
      trackQuickToolUsed()
    }},
    { name: 'Restart Steam', desc: 'Close and relaunch Steam', icon: RotateCw, color: COLORS.amber, action: async () => {
      addLog('Restarting Steam...', 'info')
      try {
        await window.electronAPI?.restartSteam?.()
        addLog('✓ Steam restarted', 'success')
        showToast('Steam restarted!', 'success')
      } catch (e) { addLog('✗ ' + e, 'error') }
      trackQuickToolUsed()
    }},
    { name: 'Download Queue', desc: 'Manage download queue', icon: Download, color: COLORS.violet, action: () => setShowDownloadQueue(true) },
    { name: 'Export Library', desc: 'Export games to file', icon: Download, color: COLORS.pink, action: () => setShowExportModal(true) },
    { name: 'Import Library', desc: 'Import games from file', icon: Upload, color: COLORS.red, action: () => setShowImportModal(true) },
    { name: 'Install from ZIP', desc: 'Select a local ZIP file with manifests and Lua', icon: FolderOpen, color: COLORS.violet, action: () => { handleInstallFromZip(); trackQuickToolUsed(); } },
  ], [
    COLORS,
    startScanGames,
    addLog,
    showToast,
    handleInstallFromZip,
    setFixGamesModalOpen, setFixGamesStatus, setFixGamesOutput, setFixGamesScriptProgress, setFixGamesContactOpen,
    setScanGamesModalOpen, setScanGamesStatus, setScanGamesProgress, setScanGamesResult,
    setShowDownloadQueue,
    setShowExportModal,
    setShowImportModal,
    trackQuickToolUsed,
  ])

  // runFixGames, addToDownloadQueue, removeFromDownloadQueue, processDownloadQueue — extracted to useAppHandlers

  // ── Handlers object for page components ──
  const handlers = useMemo(() => ({
    navigateTo,
    showToast,
    handleGameClick,
    handleContextMenu,
    toggleFavorite,
    handleInstallGame,
    handleInstallFromZip,
    handleDeleteGame,
    handleApplyFix,
    playSound,
  }), [navigateTo, showToast, handleGameClick, handleContextMenu, toggleFavorite, handleInstallGame, handleInstallFromZip, handleDeleteGame, handleApplyFix, playSound])

  // ── Fix progress listener ──
  useEffect(() => {
    const cleanup = window.electronAPI?.onFixProgress?.((data: any) => {
      if (data.type === 'games') {
        if (data.done) {
          if (data.success) setFixGamesStatus('done')
          else setFixGamesStatus('error')
          setFixGamesOutput(data.output || '')
        } else {
          setFixGamesOutput((prev: string) => prev + (data.output || ''))
          setFixGamesScriptProgress((prev: number) => Math.min(prev + 5, 90))
        }
      }
    })
    return () => { cleanup?.() }
  }, [])

  // ── Global keyboard shortcuts (after store hooks are declared) ──
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        if (['browse', 'favourites', 'recent'].includes(currentPage)) {
          searchInputRef.current?.focus()
        }
      }
      if (e.key === 'Escape' && searchQuery) {
        setSearchQuery('')
        searchInputRef.current?.blur()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentPage, searchQuery])

  // ── ModalRenderer props: only local state + action callbacks.
  // Store-based state is now read internally by ModalRenderer itself
  // (install progress, modal visibility, discord state, etc.)
  // This prevents App.tsx from re-rendering every time install progress or modal
  // toggles — ModalRenderer subscribes independently.
  const modalProps = useMemo<ModalRendererProps>(() => ({
    COLORS,
    bridge,
    startupDiscordModal, discordSuccessOpen,
    gameActionModalOpen, gameActionModalGame,
    dlcManagerOpen, dlcManagerGame,
    achievements, setAchievements,
    setStartupDiscordModal: setStartupDiscordModal as (v: boolean) => void,
    setDiscordSuccessOpen: setDiscordSuccessOpen as (v: boolean) => void,
    setGameActionModalOpen: setGameActionModalOpen as (v: boolean) => void,
    setDlcManagerOpen: setDlcManagerOpen as (v: boolean) => void,
    setDlcManagerGame: setDlcManagerGame as (v: any) => void,
    handleInstallGame, handleInstallFromZip,
    handleGoToBrowse, handleGoToFixes,
    runFixGames, startScanGames, reloadGamesList,
    contextMenuInstall, contextMenuOpenSteam, contextMenuToggleFavorite,
    addToDownloadQueue, contextMenuShareCard, contextMenuCopyAppId,
    contextMenuRemoveGame, openPortalModal,
    processDownloadQueue, removeFromDownloadQueue,
    cancelDownload: () => window.electronAPI?.cancelDownload?.(),
    restartSteam: () => window.electronAPI?.restartSteam?.(),

    showToast: showToast as (msg: string, type: string) => void,
  }), [
    // Only props — store-based values no longer in deps (read internally)
    bridge, COLORS,
    startupDiscordModal, discordSuccessOpen,
    gameActionModalOpen, gameActionModalGame,
    dlcManagerOpen, dlcManagerGame,
    achievements, setAchievements,
    setStartupDiscordModal, setDiscordSuccessOpen,
    setGameActionModalOpen, setDlcManagerOpen, setDlcManagerGame,
    handleInstallGame, handleInstallFromZip,
    handleGoToBrowse, handleGoToFixes,
    runFixGames, startScanGames, reloadGamesList,
    contextMenuInstall, contextMenuOpenSteam, contextMenuToggleFavorite,
    addToDownloadQueue, contextMenuShareCard, contextMenuCopyAppId,
    contextMenuRemoveGame, openPortalModal,
    processDownloadQueue, removeFromDownloadQueue,
    showToast,
  ])

  return (
      <div className="h-screen w-screen flex flex-col overflow-hidden" style={{ background: COLORS.bgDeep }}>
      <TitleBar colors={COLORS} currentPage={currentPage} />
      <div className="flex flex-1 overflow-hidden relative">
      {/* AnimatedBackground renders always — visible immediately behind main content */}
      <AnimatedBackground currentPage={currentPage} />
      {/* Main content fades in once games are loaded — smooth, zero GPU overhead */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: (showMainApp || activationOpen) ? 1 : 0 }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        style={{
          flex: 1, display: 'flex', overflow: 'hidden',
          pointerEvents: ((showMainApp || activationOpen) ? 'auto' : 'none') as React.CSSProperties['pointerEvents'],
        }}>
      


{/* Sidebar - extracted to memo'd component */}
      <Sidebar
        navItems={navItems}
        quickTools={quickTools}
        colors={COLORS}
        navigateTo={navigateTo}
        sidebarCollapsed={sidebarCollapsed}
        isOverlay={windowWidth < 1100 && sidebarOverlayOpen}
        onCloseOverlay={() => setSidebarOverlayOpen(false)}
        discordConnected={discordConnected}
        quickToolsOpen={quickToolsOpen}
        setQuickToolsOpen={setQuickToolsOpen}
        setDiscordModalOpen={setDiscordModalOpen}
        setDiscordSuccessOpen={setDiscordSuccessOpen}
        setUpdateModalOpen={setUpdateModalOpen}
      />

{/* Backdrop for sidebar overlay */}
{windowWidth < 1100 && sidebarOverlayOpen && (
  <div
    className="fixed inset-0 z-30"
    style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
    onClick={() => setSidebarOverlayOpen(false)}
  />
)}

{/* Main Content */}
        <div className="flex-1 flex flex-col relative z-10 overflow-hidden">
          <AppHeader
            windowWidth={windowWidth}
            sidebarOverlayOpen={sidebarOverlayOpen}
            setSidebarOverlayOpen={setSidebarOverlayOpen}
            currentPage={currentPage}
            hideSearchBars={hideSearchBars}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchInputRef={searchInputRef}
            colors={COLORS}
            batchMode={batchMode}
            setBatchMode={setBatchMode}
            selectedGames={selectedGames}
            handleBatchInstall={handleBatchInstall}
            isFullscreen={isFullscreen}
            setShowAchievements={setShowAchievements}
            userLevel={userLevel}
            achievements={achievements}
          />

        {/* Page Content */}
        <motion.main 
          className="flex-1 overflow-auto"
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15 }}
        >
           <ErrorBoundary>
           <PageRouter
             currentPage={currentPage}
             COLORS={COLORS}
             handlers={handlers}
             homeSections={homeSections}
             gamesWithCover={gamesWithCover}
             popularGamesWithCover={popularGamesWithCover}
             recentGamesList={recentGamesList}
             aiRecommendations={aiRecommendations}
             filteredGames={filteredGames}
             pureBlack={pureBlack}
             setPureBlack={setPureBlack}
             reducedMotion={reducedMotion}
             setReducedMotion={setReducedMotion}
             accentColor={accentColor}
             setAccentColor={setAccentColor}
             soundEnabled={soundEnabled}
             setSoundEnabled={setSoundEnabled}
             batchMode={batchMode}
             setBatchMode={setBatchMode}
             viewMode={viewMode}
             setViewMode={setViewMode}
             compactMode={compactMode}
             setCompactMode={setCompactMode}
             games={games}
             installedGames={installedGames}
             favorites={favorites}
             recentGames={recentGames}
             showToast={showToast}
             playSound={playSound}
             bridge={bridge}
             selectedGame={selectedGame}
           />
         </ErrorBoundary>
        </motion.main>

      </div>

      <ModalRenderer modalProps={modalProps} />


      </motion.div>
      </div>
      </div>
  )
}


export default App
