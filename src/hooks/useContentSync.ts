import { useEffect } from 'react'
import { useGameStore } from '../store'
import { bridge } from '../bridge'
import { useToastNotifications } from './useToastNotifications'

/**
 * Wires the (previously unused) remote-sync stream into the UI:
 *   • new Ryuu games are merged into the in-memory catalog so their cards appear in
 *     Browse silently, without a restart;
 *   • games whose catalog `updated_date` is newer than the version recorded at install
 *     time are flagged in `gamesWithUpdates` so cards can show an "Update" badge;
 *   • new / repaired fixes (Ryuu + online-fix.me, which share the fixes feed) raise a
 *     quiet info toast.
 */
export function useContentSync() {
  const { showToast } = useToastNotifications()

  // ── Live remote-sync events (fire ~3s after startup) ──
  useEffect(() => {
    const api = (window as any).electronAPI
    if (!api?.onRemoteSyncUpdated) return
    const unlisten = api.onRemoteSyncUpdated((data: any) => {
      const newGames = Array.isArray(data?.newGames) ? data.newGames : []
      const updatedGames = Array.isArray(data?.updatedGames) ? data.updatedGames : []
      const newFixes = Array.isArray(data?.newFixes) ? data.newFixes : []
      const updatedFixes = Array.isArray(data?.updatedFixes) ? data.updatedFixes : []

      // Merge brand-new games into the catalog (dedupe by appid) so they show in Browse now.
      if (newGames.length > 0) {
        const prev = useGameStore.getState().games
        const have = new Set(prev.map((g: any) => String(g.appid)))
        // Same shape as the boot catalogue: no DLC entries, dlc map -> dlc_count.
        const fresh = newGames
          .filter((g: any) => g?.appid && !have.has(String(g.appid)) && g.type !== 'dlc')
          .map(({ dlc, ...g }: any) => ({ ...g, appid: String(g.appid), isDlc: false, dlc_count: dlc ? Object.keys(dlc).length : 0 }))
        if (fresh.length > 0) useGameStore.getState().setGames([...prev, ...fresh])
      }

      // Flag installed games that just received a content update.
      if (updatedGames.length > 0) {
        const installedIds = new Set(useGameStore.getState().installedGames.map((g: any) => String(g.appid)))
        const stale = updatedGames.map((g: any) => String(g.appid)).filter((id: string) => installedIds.has(id))
        if (stale.length > 0) {
          useGameStore.getState().setGamesWithUpdates(prev => new Set([...prev, ...stale]))
        }
      }

      // Fixes were already persisted to fixes.db by main — reload them into the store.
      if (newFixes.length || updatedFixes.length) {
        bridge.getInitData().then((d: any) => {
          if (!Array.isArray(d?.fixes)) return
          const have = new Set(d.fixes.map((f: any) => f.appid))
          const custom = Array.isArray(d.customFixes) ? d.customFixes.filter((f: any) => !have.has(f.appid)) : []
          useGameStore.getState().setFixes([...d.fixes, ...custom])
        }).catch(() => {})
      }

      const bits: string[] = []
      if (newGames.length) bits.push(`${newGames.length} new game${newGames.length > 1 ? 's' : ''}`)
      const fixGames = new Set([...newFixes, ...updatedFixes].map((f: any) => String(f.appid)))
      if (fixGames.size) bits.push(`${fixGames.size} fix update${fixGames.size > 1 ? 's' : ''}`)
      if (bits.length) showToast(`Catalogue synced — ${bits.join(', ')}`, 'info')
    })
    // Remove the listener on unmount so duplicate catalogue merges/toasts can't
    // accumulate if this hook ever re-runs or remounts.
    return () => { if (typeof unlisten === 'function') { try { (unlisten as () => void)() } catch { /* no-op */ } } }
  }, [showToast])

  // ── Recompute "installed game has an update" whenever catalog or library changes ──
  const gamesLen = useGameStore(s => s.games.length)
  const installedLen = useGameStore(s => s.installedGames.length)
  useEffect(() => {
    if (gamesLen === 0 || installedLen === 0) return
    let cancelled = false
    bridge.getInstallVersions().then(versions => {
      if (cancelled || !versions) return
      const games = useGameStore.getState().games
      const installed = useGameStore.getState().installedGames
      const catalogById = new Map(games.map((g: any) => [String(g.appid), g]))
      const stale = new Set<string>()
      for (const ig of installed) {
        const id = String(ig.appid)
        const rec = versions[id]
        const cat: any = catalogById.get(id)
        // ISO-8601 strings compare lexicographically → correct chronological order.
        if (rec?.updatedDate && cat?.updated_date && cat.updated_date > rec.updatedDate) stale.add(id)
      }
      if (stale.size > 0) {
        useGameStore.getState().setGamesWithUpdates(prev => new Set([...prev, ...stale]))
      }
    }).catch(() => {})
    return () => { cancelled = true }
  }, [gamesLen, installedLen])
}
