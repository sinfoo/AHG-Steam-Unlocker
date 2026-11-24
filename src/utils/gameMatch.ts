// Game-name matching shared by the catalogue search worker and the request box:
// "spiderman" → Spider-Man, "gta" → Grand Theft Auto, "elden ri" → Elden Ring.

/** Fields a game needs to be matched by name. */
export interface MatchableGame { name?: string; developer?: string; publisher?: string }

/** Precomputed per-game search haystack, built once on init. */
export interface SearchEntry {
  /** Normalized name (lowercase, no diacritics, punctuation → space) */
  norm: string
  /** Normalized name with spaces removed — catches "counterstrike" style queries */
  squashed: string
  /** Normalized word tokens of the name */
  words: string[]
  /** Normalized developer + publisher */
  devPub: string
}

// ── Normalization ──

/** Lowercase, strip diacritics, turn punctuation/symbols into spaces, collapse. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

export function buildEntry(g: MatchableGame): SearchEntry {
  const norm = normalize(g.name || '')
  return {
    norm,
    squashed: norm.replace(/\s+/g, ''),
    words: norm.split(' ').filter(Boolean),
    devPub: normalize(`${g.developer || ''} ${g.publisher || ''}`),
  }
}

// ── Scoring ──

export const SCORE_EXACT = 100
export const SCORE_STARTS_WITH = 90
const SCORE_ACRONYM = 85
const SCORE_WORD_EXACT = 80
const SCORE_WORD_PREFIX = 75
const SCORE_WORD_SPAN = 70
export const APPID_PREFIX_MAX = 10

export function scoreEntry(e: SearchEntry, q: string, qSquashed: string, qWords: string[]): number {
  if (!q) return 0

  // Exact normalized match (squashed catches "spiderman" === "spider man")
  if (e.norm === q || e.squashed === qSquashed) return SCORE_EXACT

  // Name starts with the full query. Squashed comparison makes punctuation
  // irrelevant: "spiderman" → "Spider-Man…", "reddead" → "Red Dead…".
  if (e.norm.startsWith(q) || e.squashed.startsWith(qSquashed)) return SCORE_STARTS_WITH

  // Acronym match: "gta" → "grand theft auto", "cod" → "call of duty"
  if (qSquashed.length >= 2 && qSquashed.length <= 5 && e.words.length >= qSquashed.length) {
    const acronym = e.words.map(w => w[0]).join('')
    if (acronym.startsWith(qSquashed)) return SCORE_ACRONYM
  }

  // Single-word query that equals a whole name word ("strike" in "counter strike").
  if (qWords.length === 1 && e.words.includes(qWords[0]!)) return SCORE_WORD_EXACT

  // Every query word is a prefix of some name word ("elden ri" → "elden ring",
  // "witcher" → "the witcher"). This is the strict floor — a game must have a word
  // that STARTS WITH each typed word. Mid-word substring hits ("punk"→"cyberpunk"),
  // cross-field dev/publisher matches, and Levenshtein fuzz are deliberately gone:
  // they were the source of irrelevant results.
  const allWordsPrefix = qWords.every(qw => qw.length > 0 && e.words.some(nw => nw.startsWith(qw)))
  if (allWordsPrefix) return SCORE_WORD_PREFIX

  // Words typed without spaces, starting at a word boundary: "spiderman" → "Marvel's Spider-Man",
  // "reddead" → "The Red Dead…". Mid-word hits ("punk" in "cyberpunk") still don't count.
  if (qSquashed.length >= 4) {
    let offset = 0
    for (const w of e.words) {
      if (e.squashed.startsWith(qSquashed, offset)) return SCORE_WORD_SPAN
      offset += w.length
    }
  }

  return 0
}

/** Soundtracks, DLC, tools and the like: never what someone means by a game. (Copy in electron/handlers/requests.cjs.) */
export const NOT_A_GAME = /\b(soundtrack|ost|artbook|art book|wallpapers?|dlc|season pass|expansion pass|upgrade|bundle|pack|demo|playtest|dedicated server|sdk|toolkit|editor|beta|redmod|redkit)\b/i

/**
 * Best `limit` games for a name query, strongest match first ("" → none).
 * `popularity` (appid → rank, 0 = most popular) adds up to +10, the same bonus the
 * search worker uses: "cod" ranks Call of Duty (acronym 85 + bonus) over CODA (starts-with 90).
 */
export function rankByName<T extends MatchableGame & { appid?: string | number }>(
  games: T[], entries: SearchEntry[], query: string, limit: number, popularity: Record<string, number> = {}, dropJunk = true,
): T[] {
  const q = normalize(query)
  if (!q) return []
  const qSquashed = q.replace(/\s+/g, '')
  const qWords = q.split(' ').filter(Boolean)
  const maxPop = Object.keys(popularity).length
  const hits: Array<{ g: T; s: number; len: number }> = []
  for (let i = 0; i < games.length; i++) {
    const e = entries[i]
    let s = e ? scoreEntry(e, q, qSquashed, qWords) : 0
    if (s <= 0 || (dropJunk && NOT_A_GAME.test(games[i]!.name || ''))) continue
    const pop = popularity[String(games[i]!.appid)]
    if (pop !== undefined && maxPop > 0) s += 10 * (1 - pop / maxPop)
    hits.push({ g: games[i]!, s, len: e!.norm.length })
  }
  // Same score → shorter name first: "Elden Ring" before "Elden Ring Nightreign".
  return hits.sort((a, b) => b.s - a.s || a.len - b.len).slice(0, limit).map(h => h.g)
}
