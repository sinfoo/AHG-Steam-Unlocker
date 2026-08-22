import { useEffect, useRef } from 'react'
import type { Virtualizer } from '@tanstack/react-virtual'
import { preloadImages } from '../services/imageCache'

/**
 * Predictive image prefetch hook.
 *
 * Watches a virtualizer's visible range and prefetches (via `preloadImages`)
 * images for rows ahead of the current scroll direction. This ensures images
 * are cached in the generational LRU before the IntersectionObserver in
 * GameCover would trigger, making scroll feel instant.
 *
 * @param virtualizer       TanStack Virtualizer instance (row-based)
 * @param getRowGames       Callback: given a row index, returns the Game-like
 *                          objects in that row (or null/[] if out of bounds).
 * @param lookAheadRows     How many rows ahead of the visible range to
 *                          prefetch (default 15 — matches BrowsePage overscan).
 */
export function useImagePrefetch(
  virtualizer: Virtualizer<HTMLDivElement, Element>,
  getRowGames: (rowIndex: number) => ReadonlyArray<{ appid: string; name?: string; header_image?: string }>,
  lookAheadRows = 15,
): void {
  const lastEndRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    const items = virtualizer.getVirtualItems()
    if (items.length === 0) return

    const first = items[0]!.index
    const last = items[items.length - 1]!.index
    const direction = last > lastEndRef.current ? 'down' : last < lastEndRef.current ? 'up' : 'none'
    lastEndRef.current = last

    if (direction === 'none') return

    // Determine which rows to prefetch, depending on scroll direction
    let prefetchStart: number
    let prefetchEnd: number

    if (direction === 'down') {
      prefetchStart = last + 1
      prefetchEnd = last + lookAheadRows
    } else {
      // Scrolling up — prefetch rows before the first visible row
      prefetchStart = Math.max(0, first - lookAheadRows)
      prefetchEnd = first - 1
    }

    if (prefetchStart >= prefetchEnd) return

    // Debounce: batch prefetches that happen within 50ms (rapid scroll)
    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(() => {
      const appids: string[] = []
      const headers: Record<string, string> = {}
      const names: Record<string, string> = {}

      for (let row = prefetchStart; row <= prefetchEnd; row++) {
        const games = getRowGames(row)
        if (!games) continue
        for (const g of games) {
          appids.push(g.appid)
          if (g.header_image) headers[g.appid] = g.header_image
          if (g.name) names[g.appid] = g.name
        }
      }

      if (appids.length > 0) {
        preloadImages(appids, headers, names)
      }
    }, 50)

    // Cleanup: clear pending timer on unmount to prevent firing after
    // StrictMode double-mount or component teardown
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
    // virtualizer.scrollOffset is the scroll signal — without it the effect only ran
    // on list/column changes, never during scroll, so look-ahead prefetch was inert.
  }, [virtualizer, getRowGames, lookAheadRows, virtualizer.scrollOffset])
}
