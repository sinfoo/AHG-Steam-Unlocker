/// <reference lib="webworker" />

// ══════════════════════════════════════════════════════════════
// Trie-based prefix search worker for AHG Unlocker
//
// Protocol:
//   Main → Worker:  { type: 'init',  queryId, payload: { games: IndexedGame[] } }
//   Main → Worker:  { type: 'search', queryId, payload: SearchPayload }
//   Worker → Main:  { type: 'result', queryId, indices: number[] }
//
// The Trie is built once on the 'init' message. All subsequent
// 'search' messages use O(k + m) prefix lookup instead of O(n) scan.
// Results are returned as indices into the original games array.
// ══════════════════════════════════════════════════════════════

// ── Trie Node ──

interface TrieNode {
  children: Map<string, TrieNode>
  /** Game indices that have this exact prefix */
  results: number[]
}

function createTrieNode(): TrieNode {
  return { children: new Map(), results: [] }
}

// ── Indexed Game Data (fields needed for search + sort) ──

interface IndexedGame {
  appid: string
  name: string
  developer?: string
  publisher?: string
  storeId?: string
}

// ── Message Types ──

interface InitPayload {
  games: IndexedGame[]
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
  indices: number[]
}

// ── Module-level state ──
// Holds the game data that the Trie indices reference.
// Rebuilt entirely on every 'init' message.
let games: IndexedGame[] = []
let trie: TrieNode | null = null

// ── Trie helpers ──

/** Insert every prefix of `word` and associate it with `gameIndex`. */
function insert(word: string, gameIndex: number): void {
  let node = trie!
  for (let i = 0; i < word.length; i++) {
    const char = word[i]!
    let child = node.children.get(char)
    if (!child) {
      child = createTrieNode()
      node.children.set(char, child)
    }
    node = child
    node.results.push(gameIndex)
  }
}

/** Return all game indices whose stored text has a word starting with `prefix`. */
function searchPrefix(prefix: string): number[] {
  if (!trie) return []
  let node = trie
  for (let i = 0; i < prefix.length; i++) {
    const char = prefix[i]!
    const child = node.children.get(char)
    if (!child) return []
    node = child
  }
  return node.results
}

/**
 * Lowercase `text`, split into words, and insert every prefix of each word
 * into the Trie, associated with `gameIndex`.
 */
function indexText(text: string, gameIndex: number): void {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean)
  for (const word of words) {
    for (let i = 3; i <= word.length; i++) {
      insert(word.substring(0, i), gameIndex)
    }
  }
}

/** Build the Trie from the full game list. */
function buildIndex(gameList: IndexedGame[]): void {
  trie = createTrieNode()
  games = gameList

  for (let i = 0; i < games.length; i++) {
    const g = games[i]!
    indexText(g.name, i)
    if (g.developer) indexText(g.developer, i)
    if (g.publisher) indexText(g.publisher, i)
    if (g.storeId) {
      // StoreId indexed as character prefixes for partial appid matching
      const storeId = g.storeId.toLowerCase()
      for (let j = 1; j <= storeId.length; j++) {
        insert(storeId.substring(0, j), i)
      }
    }
  }
}

// ── Search logic ──

/**
 * Core search: use the Trie for prefix matching, then intersect with
 * the pre-filtered index set.
 *
 * For numeric queries (appid exact match) we fall back to a linear scan
 * of the pre-filtered set — this preserves the current exact-match behaviour
 * and avoids false positives from partial numeric prefix matches.
 */
function searchGames(query: string, preFilteredIndices: number[]): number[] {
  if (!query || !query.trim()) {
    return preFilteredIndices
  }

  const q = query.toLowerCase().trim()

  // Numeric query → exact appid match (unchanged behaviour)
  if (/^\d+$/.test(q)) {
    const results: number[] = []
    for (const idx of preFilteredIndices) {
      if (games[idx]?.appid === q) {
        results.push(idx)
      }
    }
    return results
  }

  // Text query → Trie prefix lookup per word, then intersect
  const words = q.split(/\s+/).filter(Boolean)

  // Collect the index set for each word
  const wordSets: Set<number>[] = words.map(word => new Set(searchPrefix(word)))

  // Intersect all word sets (AND semantics — all words must match)
  const intersection = wordSets.reduce<Set<number> | null>((acc, set) => {
    if (acc === null) return set
    const result = new Set<number>()
    for (const x of acc) {
      if (set.has(x)) result.add(x)
    }
    return result
  }, null)

  if (!intersection) return []

  // Intersect with the pre-filtered index set
  if (preFilteredIndices.length === 0) return []
  const pfSet = new Set(preFilteredIndices)
  const result: number[] = []
  for (const idx of intersection) {
    if (pfSet.has(idx)) result.push(idx)
  }
  return result
}

// ── Sorting ──

function sortGameIndices(
  indices: number[],
  sortBy: string,
  popularGamesOrder: Record<string, number>,
  maxPopIdx: number,
): number[] {
  const sorted = [...indices]

  if (sortBy === 'popularity') {
    sorted.sort((a, b) => {
      const ga = games[a]!
      const gb = games[b]!
      const aIdx = popularGamesOrder[ga?.appid] ?? maxPopIdx
      const bIdx = popularGamesOrder[gb?.appid] ?? maxPopIdx
      if (aIdx !== bIdx) return aIdx - bIdx
      return (ga?.name || '').localeCompare(gb?.name || '')
    })
  } else if (sortBy === 'name_asc') {
    sorted.sort((a, b) => {
      const ga = games[a]!
      const gb = games[b]!
      return (ga?.name || '').localeCompare(gb?.name || '')
    })
  } else {
    // name_desc
    sorted.sort((a, b) => {
      const ga = games[a]!
      const gb = games[b]!
      return (gb?.name || '').localeCompare(ga?.name || '')
    })
  }

  return sorted
}

// ══════════════════════════════════════════════════════════════
// Message handler
// ══════════════════════════════════════════════════════════════

self.onmessage = (e: MessageEvent<WorkerInMessage>) => {
  const msg = e.data

  if (msg.type === 'init') {
    buildIndex(msg.payload.games)
    const response: ResultMessage = {
      type: 'result',
      queryId: msg.queryId,
      indices: [],
    }
    self.postMessage(response)
    return
  }

  if (msg.type === 'search') {
    const { query, sortBy, popularGamesOrder, maxPopIdx, preFilteredIndices } = msg.payload

    let resultIndices = searchGames(query, preFilteredIndices)
    resultIndices = sortGameIndices(resultIndices, sortBy, popularGamesOrder, maxPopIdx)

    const response: ResultMessage = {
      type: 'result',
      queryId: msg.queryId,
      indices: resultIndices,
    }

    self.postMessage(response)
  }
}
