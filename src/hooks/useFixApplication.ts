import { t } from '../i18n'
import { useCallback } from 'react'
import { bridge } from '../bridge'
import { useInstallStore, useDownloadStore, useModalStore, useGameStore, useUserStore } from '../store'
import { useToastNotifications } from './useToastNotifications'
import { achievementRefs } from './achievementRefs'
import type { Fix, Game } from '../types'

export function useFixApplication() {
  const { addLog, showToast } = useToastNotifications()

  const handleDeleteGame = useCallback(async (appid: string) => {
    try {
      const result = await bridge.removeInstalledGame(appid)
      if (result?.success) {
        useGameStore.getState().setInstalledGames((prev: Game[]) => {
          const next = prev.filter(g => g.appid !== appid)
          window.electronAPI?.saveInstalled?.(next.map(g => g.appid))
          return next
        })
        showToast(t('ui.toast.appRemoved', { id: appid }), 'success')
      } else {
        showToast(t('ui.toast.removeFail', { err: result?.message || t('ui.err.unknown') }), 'error')
      }
    } catch (e: any) {
      showToast(t('ui.toast.removeFail', { err: e?.message || t('ui.err.unknown') }), 'error')
    }
  }, [showToast])

  const handleApplyFix = useCallback(async (fix: Fix, selectedUrl?: string) => {
    const downloadUrl = selectedUrl || fix.download_url || (fix.download_urls && fix.download_urls[0])
    let gameUrl = fix.game_url || ''
    if (!gameUrl && downloadUrl) {
      const nameMatch = downloadUrl.match(/(?:uploads|hosters)\.online-fix\.me[^/]+\/uploads\/([^/]+)\//)
      if (nameMatch) {
        gameUrl = `https://online-fix.me/games/page/1/${encodeURIComponent(nameMatch[1]!)}.html`
      }
    }

    if (!downloadUrl) {
      if (gameUrl) {
        showToast(t('ui.toast.opening', { name: fix.name }), 'info')
        addLog(`Opening game page...`, 'info')
        try {
          await (window as any).electronAPI?.openExternal?.(gameUrl)
          showToast(t('ui.toast.opened'), 'success')
          addLog('✓ Opened in browser', 'success')
        } catch (e) {
          showToast(t('ui.fx.err', { err: String(e) }), 'error')
          addLog('✗ Error: ' + e, 'error')
        }
      } else {
        showToast(t('ui.toast.noDl'), 'error')
        addLog('✗ No URL', 'error')
      }
      return
    }

    useDownloadStore.getState().setDownloadProgress(0)
    useDownloadStore.getState().setDownloadStatus('downloading')
    useDownloadStore.getState().setDownloadMessage(t('ui.dlm.preparing'))
    useDownloadStore.getState().setDownloadDetails(null)
    addLog(`Downloading: ${fix.name}...`, 'info')
    showToast(t('ui.toast.downloading', { name: fix.name }), 'info')

    const controller = new AbortController()
    useInstallStore.getState().setActiveDownloadAbort(controller)

    try {
      const source = fix.source || ''
      let result: any

      if (source === 'online-fix.me' || downloadUrl.includes('online-fix.me')) {
        result = await bridge.downloadFix(downloadUrl, fix.name, gameUrl)
      } else {
        result = await bridge.downloadFix(downloadUrl, fix.name)
      }

      useDownloadStore.getState().setDownloadProgress(100)

      if (result?.success) {
        useDownloadStore.getState().setDownloadStatus('done')
        useDownloadStore.getState().setDownloadMessage(t('ui.dlm.fixDone'))
        addLog('✓ Saved to ' + (result?.message || 'downloads'), 'success')
        showToast(t('ui.toast.fixDownloaded'), 'success')
        useUserStore.getState().logActivity(fix.appid, 'fix')
        achievementRefs.trackFixApplied()
        setTimeout(() => {
          useModalStore.getState().setExtractFileName(fix.name)
          useModalStore.getState().setExtractFilePath(result.message)
          useModalStore.getState().setExtractModalOpen(true)
        }, 400)
      } else {
        if (result?.message === 'Download cancelled') {
          useDownloadStore.getState().setDownloadStatus('error')
          useDownloadStore.getState().setDownloadMessage(t('ui.dlm.cancelled'))
          addLog('Download cancelled', 'info')
        } else {
          useDownloadStore.getState().setDownloadStatus('error')
          useDownloadStore.getState().setDownloadMessage(result?.message || t('ui.upd.dlFailed'))
          addLog('✗ ' + (result?.message || 'Failed'), 'error')
          if (!gameUrl) {
            addLog('✗ No game URL available', 'error')
          }
        }
      }
    } catch (e) {
      useDownloadStore.getState().setDownloadStatus('error')
      useDownloadStore.getState().setDownloadMessage(t('ui.fx.err', { err: String(e) }))
      showToast(t('ui.fx.err', { err: String(e) }), 'error')
      addLog('✗ Error: ' + e, 'error')
    } finally {
      useInstallStore.getState().setActiveDownloadAbort(null)
    }
  }, [addLog, showToast])

  return { handleApplyFix, handleDeleteGame }
}
