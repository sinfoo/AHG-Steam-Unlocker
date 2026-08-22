/// <reference lib="webworker" />

// ══════════════════════════════════════════════════════════════
// Ranked hybrid search worker for AHG Unlocker
//
// Protocol:
//   Main → Worker:  { type: 'init',  queryId, payload: { games: IndexedGame[], epoch: number } }
//   Main → Worker:  { type: 'search', queryId, payload: SearchPayload }
//   Worker → Main:  { type: 'result', queryId, epoch, indices: number[] }
//
// Matching tiers (highest score wins):
//   100  exact normalized name match
//    90  name starts with query
//    75  every query word is a prefix of a name word
//    65  full query is a substring of the name
//    55  every query word appears as a substring of the name
//    30  developer / publisher match
//   ≤25  fuzzy (word-level Levenshtein) — only when few exact results,
//        APPENDED after real matches, never replacing them
//
// Sorting: score desc → popularity order → name asc.
// Explicit name_asc / name_desc sorts are honored after filtering.
// ══════════════════════════════════════════════════════════════

// ── Indexed Game Data (fields needed for search + sort) ──

interface IndexedGame {
  appid: string
  name: string
  developer?: string
  publisher?: string
  storeId?: string
}

/** Precomputed per-game search haystack, built once on init. */
interface SearchEntry {
  /** Normalized name (lowercase, no diacritics, punctuation → space) */
  norm: string
  /** Normalized name with spaces removed — catches "counterstrike" style queries */
  squashed: string
  /** Normalized word tokens of the name */
  words: string[]
  /** Normalized developer + publisher */
  devPub: string
}

// ── Message Types ──

interface InitPayload {
  games: IndexedGame[]
  epoch?: number
}

interface InitMessage {
  type: 'init'
  queryId: number
  payload: InitPayload
}

interface SearchPayload {
  query: string
  sortBy: string
  popularGamesOrder: Record<string, number>
  maxPopIdx: number
  preFilteredIndices: number[]
}

interface SearchMessage {
  type: 'search'
  queryId: number
  payload: SearchPayload
}

type WorkerInMessage = InitMessage | SearchMessage

interface ResultMessage {
  type: 'result'
  queryId: number
  epoch: number
  indices: number[]
}

// ── Module-level state ──

let games: IndexedGame[] = []
let entries: SearchEntry[] = []
let epoch = 0

// ── Normalization ──

/** Lowercase, strip diacritics, turn punctuation/symbols into spaces, collapse. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function buildEntry(g: IndexedGame): SearchEntry {
  const norm = normalize(g.name || '')
  return {
    norm,
    squashed: norm.replace(/\s+/g, ''),
    words: norm.split(' ').filter(Boolean),
    devPub: normalize(`${g.developer || ''} ${g.publisher || ''}`),
  }
}

// ── Scoring ──

const SCORE_EXACT = 100
const SCORE_STARTS_WITH = 90
const SCORE_ACRONYM = 85
const SCORE_WORD_EXACT = 80
const SCORE_WORD_PREFIX = 75
const APPID_PREFIX_MAX = 10

function scoreEntry(e: SearchEntry, q: string, qSquashed: string, qWords: string[]): number {
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

  return 0
}

// ── Search ──

interface ScoredIndex {
  idx: number
  score: number
}

function searchGames(
  query: string,
  preFilteredIndices: number[],
  popularGamesOrder: Record<string, number>,
  maxPopIdx: number,
): ScoredIndex[] {
  if (!query || !query.trim()) {
    return preFilteredIndices.map(idx => ({ idx, score: 0 }))
  }

  // Popularity bonus: up to +10, smaller than every tier gap (15–25), so it
  // can only reorder WITHIN a tier — but a hugely popular game in a lower tier
  // (Counter-Strike via word-exact 80) catches up to obscure games in the tier
  // above ("Strike Cars" via starts-with 90) and wins the tiebreak.
  const popBonus = (idx: number): number => {
    const popIdx = popularGamesOrder[games[idx]?.appid ?? '']
    if (popIdx === undefined || maxPopIdx <= 0) return 0
    return 10 * (1 - popIdx / maxPopIdx)
  }

  const qRaw = query.trim()

  // Numeric query → exact appid first, then a few appid prefix matches
  if (/^\d+$/.test(qRaw)) {
    const exact: ScoredIndex[] = []
    const prefix: ScoredIndex[] = []
    for (const idx of preFilteredIndices) {
      const appid = games[idx]?.appid
      if (appid === qRaw) exact.push({ idx, score: SCORE_EXACT })
      else if (appid?.startsWith(qRaw) && prefix.length < APPID_PREFIX_MAX) {
        prefix.push({ idx, score: SCORE_STARTS_WITH })
      }
    }
    return exact.concat(prefix)
  }

  const q = normalize(qRaw)
  if (!q) return []
  const qSquashed = q.replace(/\s+/g, '')
  const qWords = q.split(' ').filter(Boolean)

  const scored: ScoredIndex[] = []
  for (const idx of preFilteredIndices) {
    const e = entries[idx]
    if (!e) continue
    const s = scoreEntry(e, q, qSquashed, qWords)
    if (s > 0) scored.push({ idx, score: s + popBonus(idx) })
  }

  // No fuzzy fallback: it was the main source of irrelevant results
  // ("elden"→"elder", one lucky word pulling in unrelated games). Strict
  // prefix/word-prefix matching only — an empty result is better than a wrong one.
  return scored
}

// ── Sorting ──

/**
 * Orders scored results for display.
 * - 'popularity': match score is the primary rank; popularity order breaks
 *   ties within the same relevance tier (empty query → pure popularity sort).
 * - 'name_asc' / 'name_desc': explicit alphabetical, applied within each
 *   relevance tier so exact matches still surface first.
 */
function sortGameIndices(
  scored: ScoredIndex[],
  sortBy: string,
  popularGamesOrder: Record<string, number>,
  maxPopIdx: number,
): number[] {
  const sorted = [...scored]

  if (sortBy === 'name_asc') {
    sorted.sort((a, b) =>
      b.score - a.score ||
      (games[a.idx]?.name || '').localeCompare(games[b.idx]?.name || ''))
  } else if (sortBy === 'name_desc') {
    sorted.sort((a, b) =>
      b.score - a.score ||
      (games[b.idx]?.name || '').localeCompare(games[a.idx]?.name || ''))
  } else {
    sorted.sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score
      const ga = games[a.idx]
      const gb = games[b.idx]
      const aIdx = popularGamesOrder[ga?.appid ?? ''] ?? maxPopIdx
      const bIdx = popularGamesOrder[gb?.appid ?? ''] ?? maxPopIdx
      if (aIdx !== bIdx) return aIdx - bIdx
      return (ga?.name || '').localeCompare(gb?.name || '')
    })
  }

  return sorted.map(s => s.idx)
}

// ══════════════════════════════════════════════════════════════
// Message handler
// ══════════════════════════════════════════════════════════════

self.onmessage = (e: MessageEvent<WorkerInMessage>) => {
  const msg = e.data

  if (msg.type === 'init') {
    games = msg.payload.games
    epoch = msg.payload.epoch ?? 0
    entries = new Array(games.length)
    for (let i = 0; i < games.length; i++) {
      entries[i] = buildEntry(games[i]!)
    }
    const response: ResultMessage = {
      type: 'result',
      queryId: msg.queryId,
      epoch,
      indices: [],
    }
    self.postMessage(response)
    return
  }

  if (msg.type === 'search') {
    const { query, sortBy, popularGamesOrder, maxPopIdx, preFilteredIndices } = msg.payload

    const scored = searchGames(query, preFilteredIndices, popularGamesOrder, maxPopIdx)
    const resultIndices = sortGameIndices(scored, sortBy, popularGamesOrder, maxPopIdx)

    const response: ResultMessage = {
      type: 'result',
      queryId: msg.queryId,
      epoch,
      indices: resultIndices,
    }
    self.postMessage(response)
  }
}
