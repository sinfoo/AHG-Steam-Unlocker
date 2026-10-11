// ============================================================
// achievementRefs.ts — Module-level refs for tracker callbacks
//
// Set by App.tsx (via useEffect), consumed by domain hooks
// (useInstallGame, useFixApplication, useScanGames)
// that don't receive callbacks via dependency injection.
//
// Pattern: module-level singleton (same as Zustand stores).
// ============================================================

type VoidFn = () => void
type CountFn = (count: number) => void

export const achievementRefs: {
  trackGameInstalled: VoidFn
  trackDLCInstalled: VoidFn
  trackFixApplied: VoidFn
  trackScanCompleted: VoidFn
  trackCollectionCreated: CountFn
  trackBatchInstall: VoidFn
} = {
  trackGameInstalled: () => {},
  trackDLCInstalled: () => {},
  trackFixApplied: () => {},
  trackScanCompleted: () => {},
  trackCollectionCreated: (_count: number) => {},
  trackBatchInstall: () => {},
}
