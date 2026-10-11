import { t } from '../i18n'
import { useCallback } from 'react'
import { bridge } from '../bridge'
import { useScanStore, useGameStore, useInstallQueueStore } from '../store'
import { useToastNotifications } from './useToastNotifications'
import { achievementRefs } from './achievementRefs'
import { isF2PGame } from './useGameFilters'
import type { Game } from '../types'
import { getFormatQueryParam } from '../utils/formatDetect'

export function useScanGames() {
  const { addLog, showToast } = useToastNotifications()

  const startScanGames = useCallback(async () => {
    addLog('Scanning for new games...', 'info')
    useScanStore.getState().setScanGamesStatus('scanning')
    useScanStore.getState().setScanGamesProgress(10)
    try {
      const result = await window.electronAPI?.scanForNewGames?.()
      if (result?.success) {
        useScanStore.getState().setScanGamesProgress(100)
        const addedGames = (result.added || []).map((g: any) => ({
          appid: g.appid,
          name: g.name || `Game ${g.appid}`,
          header_image: g.header_image || `https://cdn.akamai.steamstatic.com/steam/apps/${g.appid}/header.jpg${getFormatQueryParam()}`,
          tags: g.tags || []
        }))
        useScanStore.getState().setScanGamesResult({ found: result.found || 0, added: addedGames })
        useScanStore.getState().setScanGamesStatus('done')
        achievementRefs.trackScanCompleted()
        addLog('✓ Scan complete', 'success')
        if ((result.found || 0) > 0) {
          showToast(t('ui.toast.foundNew', { n: result.found ?? 0 }), 'success')
          useInstallQueueStore.getState().setRecentlyAddedGames((prev: Game[]) => {
            const merged = [...addedGames, ...prev]
            return merged.slice(0, 100)
          })
        }
      } else {
        useScanStore.getState().setScanGamesStatus('error')
        addLog('✗ Scan failed', 'error')
      }
    } catch (e) {
      useScanStore.getState().setScanGamesStatus('error')
      addLog('✗ ' + e, 'error')
    }
  }, [addLog, showToast])

  const reloadGamesList = useCallback(async () => {
    addLog('Reloading games catalogue...', 'info')
    try {
      const data = await bridge.loadGames()
      let currentDynamicFreeIds = useGameStore.getState().dynamicFreeIds
      if (!currentDynamicFreeIds || currentDynamicFreeIds.size === 0) {
        addLog('Checking free-to-play games...', 'info')
        const allAppids = (data || []).slice(0, 2000).map((g: any) => String(g.appid))
        try {
          const refreshedIds = await bridge.checkFreeGames?.(allAppids).catch(() => []) || []
          if (refreshedIds && refreshedIds.length > 0) {
            const newSet = new Set(refreshedIds)
            useGameStore.getState().setDynamicFreeIds(newSet)
            currentDynamicFreeIds = newSet
            addLog('Free-to-play check done', 'info')
          }
        } catch { /* Re-fetch failed */ }
      }
      const filteredData = (data || []).filter(g => !isF2PGame(g, currentDynamicFreeIds) && (g.type || '').toLowerCase() !== 'dlc')
      const deduped = new Map()
      for (const g of filteredData) {
        const key = String(g.appid)
        const existing = deduped.get(key)
        if (!existing || (g.header_image || '').length > (existing.header_image || '').length) {
          deduped.set(key, { ...g, appid: key })
        }
      }
      const normalizedData = [...deduped.values()]
      if (normalizedData && normalizedData.length > 0) {
        useGameStore.getState().setGames(normalizedData)
        addLog('✓ Games catalogue reloaded', 'success')
        showToast(t('ui.toast.catUpdated', { n: filteredData.length }), 'success')
      }
    } catch (e) {
      addLog('✗ Reload failed: ' + e, 'error')
    }
  }, [addLog, showToast])

  return { startScanGames, reloadGamesList }
}
