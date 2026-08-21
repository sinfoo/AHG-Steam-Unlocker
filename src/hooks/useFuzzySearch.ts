import { useMemo } from 'react'

/**
 * Levenshtein distance between two strings.
 * Returns edit distance (insertions, deletions, substitutions).
 * Uses O(min(a,b)) space via single-row DP.
 */
export function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  // Optimize: iterate over the shorter string's space
  if (m < n) return levenshtein(b, a)
  const dp = new Uint32Array(n + 1)
  for (let j = 0; j <= n; j++) dp[j] = j
  for (let i = 1; i <= m; i++) {
    let prev = dp[0]!
    dp[0] = i
    for (let j = 1; j <= n; j++) {
      const temp = dp[j]!
      dp[j]! = a[i - 1] === b[j - 1]
        ? prev
        : 1 + Math.min(dp[j]!, dp[j - 1]!, prev)
      prev = temp
    }
  }
  return dp[n]!
}

/**
 * Normalized similarity score 0–1 between two strings.
 * 1 = exact match, 0 = completely different.
 */
export function similarity(a: string, b: string): number {
  if (a.length === 0 && b.length === 0) return 1
  if (a.length === 0 || b.length === 0) return 0
  const dist = levenshtein(a, b)
  const maxLen = Math.max(a.length, b.length)
  return 1 - dist / maxLen
}

/**
 * Fuzzy search utility: returns items whose name has a similarity
 * score above the threshold, sorted by best match first.
 *
 * @param items - array of objects with a `name` string property
 * @param query - user search query
 * @param threshold - minimum similarity 0–1 (default: 0.35)
 * @returns items sorted by similarity descending, filtered by threshold
 */
export function fuzzySearch<T extends { name?: string }>(
  items: T[],
  query: string,
  threshold = 0.35
): T[] {
  const trimmed = query.trim()
  if (!trimmed) return []
  const q = trimmed.toLowerCase()

  const scored: { item: T; score: number }[] = []
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!
    const name = (item.name || '').toLowerCase()
    if (!name) continue
    const sim = similarity(name, q)
    if (sim >= threshold) {
      scored.push({ item, score: sim })
    }
  }

  scored.sort((a, b) => b.score - a.score)
  return scored.map(s => s.item)
}

/**
 * React hook: wraps a search with fuzzy fallback.
 * When `searchFn()` returns fewer than `minExactResults` items,
 * automatically runs fuzzy match on the full `allItems` set.
 *
 * @param searchFn - the exact search function (called each render via useMemo)
 * @param allItems - full item list for fuzzy fallback
 * @param query - current search query
 * @param minExactResults - minimum exact results before fuzzy kicks in (default: 3)
 * @returns search results with an additional `fuzzyMatched: boolean` flag
 */
export function useFuzzySearch<T extends { name?: string }>(
  searchFn: () => T[],
  allItems: T[],
  query: string,
  minExactResults = 3
): { results: T[]; fuzzyMatched: boolean } {
  return useMemo(() => {
    const exactResults = searchFn()
    if (exactResults.length >= minExactResults || query.trim().length <= 2) {
      return { results: exactResults, fuzzyMatched: false }
    }
    const fuzzyResults = fuzzySearch(allItems, query)
    if (fuzzyResults.length > 0) {
      return { results: fuzzyResults, fuzzyMatched: true }
    }
    return { results: exactResults, fuzzyMatched: false }
  }, [searchFn, allItems, query, minExactResults])
}
