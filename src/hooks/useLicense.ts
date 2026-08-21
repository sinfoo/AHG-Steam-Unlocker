import { useEffect } from 'react'
import { useUIStore } from '../store'
import { useToastNotifications } from './useToastNotifications'

export function useLicense() {
  const { showToast } = useToastNotifications()

  useEffect(() => {
    const checkLicense = window.electronAPI?.checkLicense
    if (!checkLicense) {
      // No Electron API (browser dev mode) — bypass license
      useUIStore.getState().setIsActivated(true)
      return
    }
    const runCheck = (attempt: number) => {
      checkLicense().then((result: { activated: boolean; machineId?: string; integrityFailed?: boolean; machineMismatch?: boolean }) => {
        console.log('[APP-TRACE] checkLicense result:', JSON.stringify(result))
        if (result.integrityFailed) {
          showToast('Code modified - Re-activation required', 'error')
          useUIStore.getState().setActivationOpen(true)
        } else if (result.machineMismatch) {
          showToast('License invalid on this device - Re-activate', 'error')
          useUIStore.getState().setActivationOpen(true)
        } else if (!result.activated) {
          showToast('Activation required', 'info')
          useUIStore.getState().setActivationOpen(true)
        }
        useUIStore.getState().setIsActivated(result.activated)
      }).catch(() => {
        // Main registers license handlers deferred (after the window shows) — a
        // rejection here is usually "handler not registered yet", not "no license".
        // Retry before treating the user as unactivated.
        if (attempt < 3) {
          setTimeout(() => runCheck(attempt + 1), 1500)
          return
        }
        useUIStore.getState().setIsActivated(false)
        useUIStore.getState().setActivationOpen(true)
      })
    }
    runCheck(0)

    // Listen for runtime license state changes (e.g. license file deleted while app is running).
    // onLicenseStateChanged is typed as returning void, but at runtime it may return an
    // unlisten fn — capture defensively and only call it if it really is a function.
    let unlisten: unknown
    try {
      unlisten = window.electronAPI?.onLicenseStateChanged?.((data: { activated: boolean }) => {
        console.log('[APP-TRACE] License state changed (runtime):', JSON.stringify(data))
        if (data.activated) {
          useUIStore.getState().setIsActivated(true)
        } else {
          useUIStore.getState().setIsActivated(false)
          useUIStore.getState().setActivationOpen(true)
        }
      })
    } catch {}

    // Remove the runtime listener on unmount so listeners don't accumulate across remounts.
    return () => {
      if (typeof unlisten === 'function') {
        try { (unlisten as () => void)() } catch { /* no-op */ }
      }
    }
  }, [showToast])
}
