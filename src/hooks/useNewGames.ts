import { useEffect, useMemo } from 'react'
import { useGameStore } from '../store'
import { useUIStore } from '../store/uiStore'
import type { Game } from '../types'
import { pickNewGames, ryuuAddedAt } from '../utils/newGames'

export { ryuuAddedAt }

// "New games" = catalogue games Ryuu added after the newest one this user had at their
// last launch. The baseline is read once per launch, so games the background sync adds
// while the app is open show up in the list too, and advances as the catalogue grows.
const KEY = 'ahg.newGamesSeen'

function readBaseline(): number | null {
  try {
    const v = localStorage.getItem(KEY)
    return v ? Number(v) : null
  } catch { return null }
}

// First launch has no baseline: show nothing rather than the whole catalogue as "new".
const sessionBaseline = readBaseline() ?? Number.POSITIVE_INFINITY

/** Games added since the user's last launch, newest first. */
export function useNewGames(): Game[] {
  const games = useGameStore(s => s.games) as Game[]
  return useMemo(() => pickNewGames(games, sessionBaseline), [games])
}

let autoOpened = false

/** Mount once (App): advances the stored baseline and opens the list once per launch. */
export function useNewGamesTracker() {
  const games = useGameStore(s => s.games) as Game[]
  const newGames = useNewGames()
  const blocked = useUIStore(s => !s.isActivated || s.activationOpen || s.changelogOpen || s.updateModalOpen)

  useEffect(() => {
    let newest = 0
    for (const g of games) { const t = ryuuAddedAt(g); if (t !== null && t > newest) newest = t }
    const stored = readBaseline() ?? 0
    if (newest > stored) { try { localStorage.setItem(KEY, String(newest)) } catch { /* private mode */ } }
  }, [games])

  useEffect(() => {
    if (autoOpened || blocked || newGames.length === 0) return
    const id = setTimeout(() => { autoOpened = true; useUIStore.getState().setNewGamesOpen(true) }, 1500)
    return () => clearTimeout(id)
  }, [blocked, newGames.length])
}
