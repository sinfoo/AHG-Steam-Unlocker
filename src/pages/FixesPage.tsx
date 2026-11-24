import { useEffect, useCallback, useMemo, memo, useState, useRef, useDeferredValue } from 'react'
import { motion } from 'framer-motion'
import { useGameStore } from '../store'
import { useShallow } from 'zustand/react/shallow'
import { Fix, Game } from '../types'
import { fuzzySearch } from '../hooks/useFuzzySearch'
import { buildEntry, rankByName } from '../utils/gameMatch'
import { PageProps } from '../types/pages'
import popularIdsData from '../../data/popular_ids.json'
import freeToPlayIdsData from '../../data/free_to_play_ids.json'
import { useReducedMotion } from '../store'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useImagePrefetch } from '../hooks/useImagePrefetch'
import { useDirectionalCoverPrefetch } from '../hooks/useDirectionalCoverPrefetch'
import { useVirtualKeyboardNav } from '../hooks/useVirtualKeyboardNav'
import { FixesHero, FixesToolbar, FixesGrid, COL_GAP, ROW_GAP } from '../components/fixes'
import { useFixState } from '../components/fixes/fixState'

// ── Module-level constants ──

const POPULAR_IDS: string[] = popularIdsData
const FREE_TO_PLAY_IDS: Set<string> = new Set(freeToPlayIdsData)
// Whole words only: a bare includes('demo') hid "Demon Slayer" (and 'trial' hid "Industrial" games).
const F2P_NAME = /\b(free to play|free-to-play|f2p|demo|trial|play free|free game|open beta|free access)\b/i

function isF2PGame(g: any, dynamicFreeIds: Set<string>): boolean {
  if (FREE_TO_PLAY_IDS.has(g.appid) || dynamicFreeIds.has(g.appid)) return true
  return F2P_NAME.test(g.name || '')
}

// ── Component ──

export const FixesPage = memo(function FixesPage({ handlers, colors }: PageProps) {
  // ── Store selectors ──
  const { fixes: rawFixes, fixSearchQuery, fixFilter, dynamicFreeIds, games } = useGameStore(
    useShallow(s => ({
      fixes: s.fixes, fixSearchQuery: s.fixSearchQuery, fixFilter: s.fixFilter,
      dynamicFreeIds: s.dynamicFreeIds, games: s.games
    }))
  )
  const fixes = rawFixes ?? []
  const deferredFixSearchQuery = useDeferredValue(fixSearchQuery)
  const setFixSearchQuery = useGameStore(s => s.setFixSearchQuery)
  const setFixFilter = useGameStore(s => s.setFixFilter)

  // ── Skeleton visible for at least 200ms to prevent flash ──
  const [showSkeleton, setShowSkeleton] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setShowSkeleton(false), 200)
    return () => clearTimeout(t)
  }, [])

  // ── Source filter: show only AHG-installable fixes by default ──
  const [fixSourceFilter, setFixSourceFilter] = useState<'all' | 'ryuu' | 'online'>('ryuu')

  const scrollRef = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const appliedCount = useFixState(st => Object.keys(st.applied).length)

  // ── Popular order index for sorting fixes ──
  const popularOrder = useMemo(() => {
    const order: Record<string, number> = {}
    POPULAR_IDS.forEach((id, i) => { order[id] = i })
    return order
  }, [])

  const fixesFuzzyActiveRef = useRef(false)

  // ── Filtered fixes ──
  const filteredFixes = useMemo((): Fix[] => {
    fixesFuzzyActiveRef.current = false
    const query = deferredFixSearchQuery ? deferredFixSearchQuery.toLowerCase().trim() : ''
    const allFixes: any[] = fixes || []
    let result: any[] = []

    // Only show fixes that have a download URL and are not free-to-play games
    const validFixes = allFixes.filter((f: any) => {
      const hasUrl = f.download_url && f.download_url.trim() !== ''
      const hasUrls = f.download_urls && f.download_urls.length > 0
      const isF2P = isF2PGame(f, dynamicFreeIds)
      return (hasUrl || hasUrls) && !isF2P
    })

    // Source filter
    const sourceFiltered = fixSourceFilter === 'all'
      ? validFixes
      : validFixes.filter((f: any) => {
          const src = (f.source || '').toLowerCase()
          if (fixSourceFilter === 'ryuu') return src === 'ryuu.lol' || src === '' || src === 'ahg-custom'
          if (fixSourceFilter === 'online') return src === 'online-fix.me'
          return true
        })

    if (query === '') {
      result = [...sourceFiltered].sort((a: any, b: any) => {
        const orderA = popularOrder[a.appid]
        const orderB = popularOrder[b.appid]

        if (orderA !== undefined && orderB === undefined) return -1
        if (orderB !== undefined && orderA === undefined) return 1

        if (orderA !== undefined && orderB !== undefined) {
          return orderA - orderB
        }

        return (a.name || '').localeCompare(b.name || '')
      })
    } else {
      if (/^\d+$/.test(query)) {
        result = sourceFiltered.filter((f: any) => String(f.appid || '') === query)
      } else {
        // Same matcher as the catalogue: word starts, "spiderman" -> "Spider-Man", "gta" -> Grand Theft Auto,
        // best match first, popular games ahead on ties. Typos fall back to fuzzy search.
        result = rankByName(sourceFiltered, sourceFiltered.map(buildEntry), query, Infinity, popularOrder, false)
      }
      // Typos ("phantm blade"): only when the matcher finds nothing, so fuzzy noise never trails real hits.
      if (result.length === 0 && query.length > 2 && !/^\d+$/.test(query)) {
        result = fuzzySearch(sourceFiltered, query, 0.35)
        fixesFuzzyActiveRef.current = result.length > 0
      }
    }

    // Badge filter (AND logic — must have ALL selected badges)
    if (fixFilter && !fixFilter.includes('All') && fixFilter.length > 0) {
      result = result.filter((f: any) => {
        if (!f.badges || f.badges.length === 0) return false
        return fixFilter.every((filter: string) => f.badges.includes(filter))
      })
    }

    return result as Fix[]
  }, [fixes, deferredFixSearchQuery, fixFilter, popularOrder, dynamicFreeIds, fixSourceFilter])

  // ── Header cover strip: first few fixes (real header images via GameCover) ──
  const covers = useMemo(() => filteredFixes.slice(0, 4).map(f => ({ appid: f.appid, name: f.name }) as Game), [filteredFixes])

  // Fix card image → open the game page when the catalogue knows the game.
  const onOpenFix = useCallback((fix: Fix) => {
    const g = games.find(x => x.appid === fix.appid)
    if (g) handlers.handleGameClick(g)
  }, [games, handlers])

  // ── Toggle fix filter ──
  const toggleFixFilter = useCallback((id: string) => {
    if (id === 'All') {
      setFixFilter(['All'])
    } else {
      setFixFilter(prev => {
        if (prev.includes(id)) {
          const next = prev.filter(f => f !== id)
          return next.length === 0 ? ['All'] : next
        } else {
          return prev.filter(f => f !== 'All').concat(id)
        }
      })
    }
  }, [setFixFilter])

  // ── Virtual scrolling ──
  const [containerWidth, setContainerWidth] = useState(0)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width)
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const MIN_COL_WIDTH = 410
  const cols = Math.max(1, Math.floor((containerWidth + COL_GAP) / (MIN_COL_WIDTH + COL_GAP)))
  const effectiveColumns = cols
  const estimateRowHeight = 96 + ROW_GAP // 70px cover + padding + border; real heights measured in FixesGrid
  const rowCount = Math.ceil(filteredFixes.length / effectiveColumns)

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: useCallback(() => scrollRef.current, []),
    estimateSize: () => estimateRowHeight,
    overscan: 2,
  })

  useImagePrefetch(virtualizer, useCallback((rowIndex: number) => {
    const startIdx = rowIndex * effectiveColumns
    return filteredFixes.slice(startIdx, startIdx + effectiveColumns)
  }, [filteredFixes, effectiveColumns]))

  useDirectionalCoverPrefetch(virtualizer, filteredFixes, 20)

  // ── Keyboard navigation ──
  const { focusedIndex, keyboardProps } = useVirtualKeyboardNav(
    virtualizer,
    filteredFixes,
    (fix) => handlers.handleApplyFix(fix),
    effectiveColumns,
  )

  // Scroll to top when filters change
  useEffect(() => {
    virtualizer.scrollToIndex(0)
  }, [fixSearchQuery, fixFilter, fixSourceFilter])

  // ── Render ──
  return (
    <motion.div
      key="fixes"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.15 }}
      ref={scrollRef}
      {...keyboardProps}
      className="flex flex-col h-full overflow-auto"
      style={{ padding: 24, gap: 22, maxWidth: 1680, margin: '0 auto', width: '100%' }}
    >
      <FixesHero covers={covers} total={fixes.length} applied={appliedCount} reduced={reduced} />

      <FixesToolbar
        colors={colors}
        fixSearchQuery={fixSearchQuery}
        setFixSearchQuery={setFixSearchQuery}
        fixesFuzzyActiveRef={fixesFuzzyActiveRef}
        fixSourceFilter={fixSourceFilter}
        setFixSourceFilter={setFixSourceFilter}
        fixFilter={fixFilter}
        toggleFixFilter={toggleFixFilter}
      />

      <FixesGrid
        showSkeleton={showSkeleton}
        colors={colors}
        virtualizer={virtualizer}
        filteredFixes={filteredFixes}
        effectiveColumns={effectiveColumns}
        focusedIndex={focusedIndex}
        handleApplyFix={handlers.handleApplyFix}
        onOpenFix={onOpenFix}
        setFixSearchQuery={setFixSearchQuery}
        setFixFilter={setFixFilter}
        fixFilter={fixFilter}
        fixSearchQuery={fixSearchQuery}
      />
    </motion.div>
  )
})
