// ── Facade: re-exports from domain install stores ──
// Existing imports from './installStore' still compile.

export {
  useInstallProgressStore,
  useInstallModalOpen,
  useInstallStatus,
  useInstallProgress,
  useInstallGameInfo,
  useInstallingGame,
} from './installProgressStore'
export type { InstallProgressState } from './installProgressStore'

// Backward-compat: useInstallStore is the primary install progress store
// Consumers calling useInstallStore.getState() will get install progress + abort methods
export { useInstallProgressStore as useInstallStore } from './installProgressStore'

export {
  useInstallQueueStore,
  useInstallQueue,
  useShowInstallQueue,
  useRecentlyAddedGames,
} from './installQueueStore'
export type { InstallQueueState } from './installQueueStore'

// Backward-compat: combined type
import type { InstallProgressState } from './installProgressStore'
import type { InstallQueueState } from './installQueueStore'
export type InstallState = InstallProgressState & InstallQueueState

// Domain stores (also re-exported through installStore facade)
export {
  useModalStore,
  useFixGamesModalOpen,
  useDownloadModalOpen,
  useScanGamesModalOpen,
  useExtractModalOpen,
} from './modalStore'
export type { ModalState } from './modalStore'

export {
  useDownloadStore,
  useDownloadQueue,
} from './downloadStore'
export type { DownloadState } from './downloadStore'

export {
  useFixGamesStore,
} from './fixGamesStore'
export type { FixGamesState } from './fixGamesStore'

export {
  useScanStore,
} from './scanStore'
export type { ScanState } from './scanStore'


