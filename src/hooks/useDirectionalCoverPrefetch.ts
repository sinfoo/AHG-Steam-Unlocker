import { useEffect, useRef, useState } from 'react'
import type { Virtualizer } from '@tanstack/react-virtual'
import { prefetchCover } from '../services/imageCache'

export interface DirectionalPrefetchResult {
  prefetchedCount: number
  direction: 'forward' | 'backward' | null
}

/**
 * Predictive cover image prefetch hook.
 *
 * Monitors the virtualizer's scroll direction and prefetches cover images
 * (via browser-level `new Image()`) for items ahead in the scroll direction.
 * Complements `useImagePrefetch` (which handles appid-level generational
 * cache warming) by ensuring the raw image bytes are in the browser's HTTP
 * cache before the cover component mounts.
 *
 * @param virtualizer   TanStack Virtual Virtualizer instance (row-based)
 * @param rows          Flat array of items. Virtualizer row indices are
 *                      used as direct indices (approximate column mapping).
 * @param prefetchCount Number of items ahead to prefetch (default 20)
 */
export function useDirectionalCoverPrefetch(
  virtualizer: Virtualizer<HTMLDivElement, Element>,
  rows: ReadonlyArray<{ appid?: string; name?: string; header_image?: string }>,
  prefetchCount = 20,
): DirectionalPrefetchResult {
  const lastEndRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [result, setResult] = useState<DirectionalPrefetchResult>({
    prefetchedCount: 0,
    direction: null,
  })

  useEffect(() => {
    const items = virtualizer.getVirtualItems()
    if (items.length === 0) return

    const first = items[0]!.index
    const last = items[items.length - 1]!.index

    // Detect scroll direction by comparing last visible row
    let direction: 'forward' | 'backward' | null = null
    if (last > lastEndRef.current) {
      direction = 'forward'
    } else if (last < lastEndRef.current) {
      direction = 'backward'
    }
    lastEndRef.current = last

    if (!direction) return

    // Calculate the range of flat array indices to prefetch
    let prefetchStart: number
    let prefetchEnd: number

    if (direction === 'forward') {
      prefetchStart = last + 1
      prefetchEnd = Math.min(rows.length - 1, last + prefetchCount)
    } else {
      prefetchStart = Math.max(0, first - prefetchCount)
      prefetchEnd = first - 1
    }

    if (prefetchStart >= rows.length || prefetchEnd < 0 || prefetchStart > prefetchEnd) return

    // Debounce: batch rapid scroll events within 150ms
    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(() => {
      let count = 0
      for (let i = prefetchStart; i <= prefetchEnd; i++) {
        const item = rows[i]
        if (item?.header_image) {
          prefetchCover(item.header_image)
          count++
        }
      }
      setResult({ prefetchedCount: count, direction })
    }, 150)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [virtualizer, rows, prefetchCount])

  return result
}
