import { t } from '../i18n'
import { useRef, useCallback } from 'react'
import { bridge } from '../bridge'
import { useInstallStore, useGameStore, useSettingsStore, useUserStore } from '../store'
import { useToastNotifications } from './useToastNotifications'
import { achievementRefs } from './achievementRefs'
import { useDLCFetching } from './useDLCFetching'

export function useInstallGame() {
  const { addLog, showToast } = useToastNotifications()
  const { fetchDLCs } = useDLCFetching()

  const handleInstallGameRef = useRef<((gameOverride?: any) => Promise<void>) | null>(null)

  const handleInstallGame = useCallback(async (gameOverride?: any) => {
    const { selectedGame } = useGameStore.getState()
    const targetGame = gameOverride || selectedGame
    if (!targetGame) return
    useInstallStore.getState().setInstallFailedAppid(null)
    useInstallStore.getState().setInstallingGame(targetGame.appid)
    useInstallStore.getState().setInstallStatus('installing')
    useInstallStore.getState().setInstallProgress(0)
    useInstallStore.getState().setDlcCount(0)
    useInstallStore.getState().setInstalledDlcs([])
    useInstallStore.getState().setInstallGameInfo({ name: targetGame.name || '', appid: targetGame.appid, cover: targetGame.header_image || null })
    useInstallStore.getState().setInstallModalOpen(true)
    useUserStore.getState().setLogs([])
    addLog(t('ui.log.installing', { name: targetGame.name }), 'info')
    useInstallStore.getState().setInstallProgress(20)
    try {
      // Game flagged as updated in the catalog: ask Ryuu to regenerate its manifests
      // first (Update Game API) so the install pulls fresh files, not stale ones.
      const appidKey = String(targetGame.appid)
      if (useGameStore.getState().gamesWithUpdates.has(appidKey)) {
        addLog(t('ui.log.refreshing'), 'info')
        try { await bridge.ryuuUpdateGame(targetGame.appid) } catch { /* best-effort */ }
      }
      const result = await bridge.installGame(targetGame.appid)
      useInstallStore.getState().setInstallProgress(70)
      if (result.success) {
        if (!result.alreadyInstalled) useUserStore.getState().logActivity(targetGame.appid, 'added')
        if (result.alreadyInstalled) {
          addLog(t('ui.log.already', { name: targetGame.name }), 'info')
        } else {
          addLog('✓ ' + t('ui.log.added', { name: targetGame.name }), 'success')
        }
        // Optimistically mark installed — string-normalized appid + dedup so the card
        // flips to "Installed" immediately and matches the grid's string appids.
        const installedGames = useGameStore.getState().installedGames
        const appidStr = String(targetGame.appid)
        const newInstalled = installedGames.some(g => String(g.appid) === appidStr)
          ? installedGames
          : [...installedGames, { ...targetGame, appid: appidStr }]
        useGameStore.getState().setInstalledGames(newInstalled)
        window.electronAPI?.saveInstalled?.(newInstalled.map(g => String(g.appid)))
        // Remember the catalog version installed, so we can later flag this game as
        // having an update when Ryuu publishes a newer updated_date for it.
        bridge.recordInstallVersion(appidStr, (targetGame as any).updated_date ?? null)
        // Reinstall of an updated game succeeded — clear its Update badge.
        useGameStore.getState().setGamesWithUpdates(prev => {
          if (!prev.has(appidStr)) return prev
          const next = new Set(prev); next.delete(appidStr); return next
        })
        useUserStore.getState().setRecentGames((prev: string[]) => [targetGame.appid, ...prev.filter(id => id !== targetGame.appid)].slice(0, 20))

        // If DLC toggle is ON, also fetch DLCs
        const { includeDLC } = useSettingsStore.getState()
        if (includeDLC) {
          useInstallStore.getState().setInstallStatus('dlc')
          useInstallStore.getState().setInstallProgress(80)
          addLog(t('ui.gi.addingDlcDots'), 'info')
          const dlcCountResult = await fetchDLCs(targetGame.appid, targetGame.name)
          if (dlcCountResult > 0) {
            useInstallStore.getState().setDlcCount((prev: number) => prev + dlcCountResult)
            addLog(t('ui.log.dlcAdded', { n: dlcCountResult }), 'success')
            achievementRefs.trackDLCInstalled()
          } else {
            addLog(t('ui.dlc.none'), 'info')
          }
        }

        useInstallStore.getState().setInstallProgress(100)
        useInstallStore.getState().setInstallStatus('done')

        achievementRefs.trackGameInstalled()
      } else if ((result as any).requested) {
        // Game wasn't on any source, but Ryuu accepted an add request for it.
        useInstallStore.getState().setInstallStatus('error')
        addLog(`⏳ ${result.message}`, 'info')
        showToast(result.message, 'info')
      } else {
        if (result.message !== 'Cancelled') {
          useInstallStore.getState().setInstallStatus('error')
          addLog(`✗ ${targetGame.name}: ${result.message}`, 'error')
          if (result.message?.includes('not found')) {
            useInstallStore.getState().setInstallFailedAppid(targetGame.appid)
          }
        } else {
          useInstallStore.getState().setInstallModalOpen(false)
        }
      }
    } catch (e) {
      useInstallStore.getState().setInstallStatus('error')
      addLog('✗ ' + t('ui.fx.err', { err: String(e) }), 'error')
    } finally {
      useInstallStore.getState().setInstallingGame(null)
    }
  }, [addLog, showToast, fetchDLCs])

  handleInstallGameRef.current = handleInstallGame

  const handleInstallFromZip = useCallback(async (gameOverride?: any) => {
    const { selectedGame } = useGameStore.getState()
    const { installFailedAppid } = useInstallStore.getState()
    const targetGame = gameOverride || selectedGame
    if (!installFailedAppid && !targetGame) return
    const appid = installFailedAppid || targetGame?.appid
    const games = useGameStore.getState().games
    const game = games.find(g => g.appid === appid) || targetGame
    const gameName = game?.name || appid

    useInstallStore.getState().setInstallingGame(appid)
    useInstallStore.getState().setInstallStatus('installing')
    useInstallStore.getState().setInstallProgress(10)
    useInstallStore.getState().setInstallGameInfo({ name: gameName, appid: appid, cover: game?.header_image || null })
    useInstallStore.getState().setInstallModalOpen(true)
    useUserStore.getState().setLogs([])
    addLog(t('ui.log.addingGame'), 'info')

    try {
      const result = await bridge.installGameFromZip(appid)
      if (result.success) {
        useUserStore.getState().logActivity(appid, 'added')
        showToast(t('ui.toast.addedSteam'), 'success')
        addLog('✓ ' + t('ui.log.added', { name: gameName }), 'success')
        const installedGames = useGameStore.getState().installedGames
        const appidStr = String(appid)
        // Normalize to string appid + dedup on string — mixed number/string appids
        // otherwise defeat the dedup, double-listing the game or failing to flip its card.
        if (game && !installedGames.some(g => String(g.appid) === appidStr)) {
          const newInstalled = [...installedGames, { ...game, appid: appidStr }]
          useGameStore.getState().setInstalledGames(newInstalled)
          window.electronAPI?.saveInstalled?.(newInstalled.map(g => String(g.appid)))
        }
        useUserStore.getState().setRecentGames((prev: string[]) => [appid, ...prev.filter(id => id !== appid)].slice(0, 20))
        useInstallStore.getState().setInstallFailedAppid(null)
        useInstallStore.getState().setInstallProgress(100)
        useInstallStore.getState().setInstallStatus('done')
        achievementRefs.trackGameInstalled()
      } else {
        if (result.message !== 'Cancelled') {
          showToast(result.message || t('ui.toast.zipFail'), 'error')
          addLog(`✗ ${result.message}`, 'error')
          useInstallStore.getState().setInstallStatus('error')
        } else {
          useInstallStore.getState().setInstallModalOpen(false)
        }
      }
    } catch (e) {
      showToast(t('ui.fx.err', { err: String(e) }), 'error')
      addLog('✗ ' + t('ui.fx.err', { err: String(e) }), 'error')
      useInstallStore.getState().setInstallStatus('error')
    } finally {
      useInstallStore.getState().setInstallingGame(null)
    }
  }, [addLog, showToast])

  return { handleInstallGame, handleInstallFromZip, handleInstallGameRef }
}
