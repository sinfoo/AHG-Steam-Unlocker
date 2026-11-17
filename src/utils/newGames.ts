import type { Game } from '../types'

/** Ryuu's own timestamp (microseconds, "+00:00"). Rows the DB back-filled with toISOString()
 *  end in "Z" and carry the insert time, not Ryuu's, so they never count as new. */
export function ryuuAddedAt(g: Pick<Game, 'added_date'>): number | null {
  const d = g.added_date
  if (!d || d.endsWith('Z')) return null
  const t = Date.parse(d)
  return Number.isFinite(t) ? t : null
}

export function pickNewGames(games: Game[], baseline: number): Game[] {
  const out: Array<{ g: Game; t: number }> = []
  for (const g of games) {
    if (g.nsfw || (g.type && g.type !== 'game')) continue
    const t = ryuuAddedAt(g)
    if (t !== null && t > baseline) out.push({ g, t })
  }
  return out.sort((a, b) => b.t - a.t).map(x => x.g)
}
