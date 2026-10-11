import { t } from '../i18n'
import { useCallback } from 'react'
import { bridge } from '../bridge'
import { useInstallStore, useGameStore } from '../store'
import { useToastNotifications } from './useToastNotifications'
import { getFormatQueryParam } from '../utils/formatDetect'

export function useDLCFetching() {
  const { addLog } = useToastNotifications()

  const fetchDLCs = useCallback(async (appid: string, gameName: string, sourceRepo?: string) => {
    addLog(t('ui.log.fetchingDlc'), 'info')
    let installedCount = 0

    try {
      const result = await bridge.fetchDLCs(appid, gameName)

      if (result && result.dlcs && result.dlcs.length > 0) {
        const dlcNames = result.dlcNames || {}
        const dlcDetails = result.dlcDetails || {}
        addLog(t('ui.log.dlcFound'), 'success')

        const registerResult = await bridge.registerDlcs(appid, result.dlcs, result.dlcDetails, sourceRepo)
        if (registerResult?.success) {
          installedCount = registerResult.count || result.dlcs.length
          addLog(t('ui.log.dlcRegistered'), 'success')
        } else {
          addLog(t('ui.log.dlcRetry'), 'warn')
          for (const dlcId of result.dlcs) {
            try {
              const installResult = await bridge.installGame(String(dlcId))
              if (installResult?.success) {
                installedCount++
              }
            } catch {}
          }
        }

        const dlcsToShow: Array<{ appid: string; name: string; header_image?: string }> = []
        for (const id of result.dlcs) {
          const detail = dlcDetails[id]
          const dlcName = detail?.name || dlcNames[id] || `DLC ${id}`
          const dlcImage = detail?.header_image || `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/header.jpg${getFormatQueryParam()}`
          dlcsToShow.push({ appid: id, name: dlcName, header_image: dlcImage })
        }

        useGameStore.getState().setKnownDlcIds(
          (prev: string[]) => [...prev, ...result.dlcs]
        )
        useInstallStore.getState().setInstalledDlcs(
          (prev: Array<{ appid: string; name: string; header_image?: string }>) => [...prev, ...dlcsToShow]
        )

        addLog(t('ui.log.dlcDone'), installedCount > 0 ? 'success' : 'info')
      } else {
        addLog(t('ui.log.noDlc'), 'info')
      }

      useInstallStore.getState().setLastAddedDLCCount(installedCount)

      if (installedCount > 0) {
        window.electronAPI?.getInstalledGames?.().then((result: any) => {
          const installed = result?.games || []
          if (installed.length > 0) {
            // MERGE — never overwrite: the disk list can momentarily lag the game we just
            // added (its lua was only just written), and a blind overwrite would revert the
            // card from "Installed" back to "Add to Steam" until an app restart.
            useGameStore.getState().setInstalledGames((prev: any[]) => {
              const have = new Set(prev.map(g => String(g.appid)))
              const merged = [...prev]
              for (const g of installed) if (!have.has(String(g.appid))) merged.push(g)
              return merged
            })
          }
        })
      }

      return installedCount
    } catch (e) {
      addLog(t('ui.log.dlcErr', { err: String(e) }), 'error')
      return 0
    }
  }, [addLog])

  return { fetchDLCs }
}
