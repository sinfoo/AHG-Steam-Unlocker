import { create } from 'zustand'

type SetStateAction<T> = T | ((prev: T) => T)

export interface InstallProgressState {
  // Install modal
  installModalOpen: boolean
  installStatus: 'installing' | 'dlc' | 'done' | 'error'
  installProgress: number
  installGameInfo: { name: string; appid: string; cover?: string | null } | null

  // Active install
  installingGame: string | null
  installingDLC: string | null
  lastAddedDLCCount: number
  installFailedAppid: string | null
  dlcCount: number
  installedDlcs: Array<{ appid: string; name: string; header_image?: string }>

  // Renderer-side AbortController for download cancellation
  activeDownloadAbort: AbortController | null
  setActiveDownloadAbort: (controller: AbortController | null) => void
  cancelActiveDownload: () => void

  // Setters
  setInstallModalOpen: (value: SetStateAction<boolean>) => void
  setInstallStatus: (value: SetStateAction<'installing' | 'dlc' | 'done' | 'error'>) => void
  setInstallProgress: (value: SetStateAction<number>) => void
  setInstallGameInfo: (value: SetStateAction<{ name: string; appid: string; cover?: string | null } | null>) => void
  setInstallingGame: (value: SetStateAction<string | null>) => void
  setInstallingDLC: (value: SetStateAction<string | null>) => void
  setLastAddedDLCCount: (value: SetStateAction<number>) => void
  setInstallFailedAppid: (value: SetStateAction<string | null>) => void
  setDlcCount: (value: SetStateAction<number>) => void
  setInstalledDlcs: (value: SetStateAction<Array<{ appid: string; name: string; header_image?: string }>>) => void
}

export const useInstallProgressStore = create<InstallProgressState>((set, get) => ({
  // Install modal
  installModalOpen: false,
  installStatus: 'installing',
  installProgress: 0,
  installGameInfo: null,

  // Active install
  installingGame: null,
  installingDLC: null,
  lastAddedDLCCount: 0,
  installFailedAppid: null,
  dlcCount: 0,
  installedDlcs: [],

  // Renderer-side abort controller
  activeDownloadAbort: null,

  // Setters
  setInstallModalOpen: (v) => set((s) => ({ installModalOpen: typeof v === 'function' ? v(s.installModalOpen) : v })),
  setInstallStatus: (v) => set((s) => ({ installStatus: typeof v === 'function' ? v(s.installStatus) : v })),
  setInstallProgress: (v) => set((s) => ({ installProgress: typeof v === 'function' ? v(s.installProgress) : v })),
  setInstallGameInfo: (v) => set((s) => ({ installGameInfo: typeof v === 'function' ? v(s.installGameInfo) : v })),
  setInstallingGame: (v) => set((s) => ({ installingGame: typeof v === 'function' ? v(s.installingGame) : v })),
  setInstallingDLC: (v) => set((s) => ({ installingDLC: typeof v === 'function' ? v(s.installingDLC) : v })),
  setLastAddedDLCCount: (v) => set((s) => ({ lastAddedDLCCount: typeof v === 'function' ? v(s.lastAddedDLCCount) : v })),
  setInstallFailedAppid: (v) => set((s) => ({ installFailedAppid: typeof v === 'function' ? v(s.installFailedAppid) : v })),
  setDlcCount: (v) => set((s) => ({ dlcCount: typeof v === 'function' ? v(s.dlcCount) : v })),
  setInstalledDlcs: (v) => set((s) => ({ installedDlcs: typeof v === 'function' ? v(s.installedDlcs) : v })),
  setActiveDownloadAbort: (controller) => set({ activeDownloadAbort: controller }),
  cancelActiveDownload: () => {
    const { activeDownloadAbort } = get()
    activeDownloadAbort?.abort()
    set({ activeDownloadAbort: null })
    window.electronAPI?.cancelDownload?.()
  },
}))

// Selector hooks
export const useInstallModalOpen = () => useInstallProgressStore((s) => s.installModalOpen)
export const useInstallStatus = () => useInstallProgressStore((s) => s.installStatus)
export const useInstallProgress = () => useInstallProgressStore((s) => s.installProgress)
export const useInstallGameInfo = () => useInstallProgressStore((s) => s.installGameInfo)
export const useInstallingGame = () => useInstallProgressStore((s) => s.installingGame)
