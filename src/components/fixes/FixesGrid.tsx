import { memo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, SlidersHorizontal, Wrench } from 'lucide-react'
import { Fix } from '../../types'
import type { ColorScheme } from '../shared'
import { FixGridCard, FixListCard } from '../../components/shared'
import { FixesSkeleton } from '../Skeletons'
import { COLORS } from '../../constants/colors'
import '../../styles/fixes-animations.css'
import '../../styles/card-animations.css'
import type { Virtualizer } from '@tanstack/react-virtual'

// ── Module-level constants ──

export const COL_GAP = 16
export const ROW_GAP = 16

// ── Memo wrappers for stable onApply callbacks ──

const MemoizedFixGridCard = memo(function MemoizedFixGridCard({ fix, index, colors, handleApplyFix }: {
  fix: Fix; index: number; colors: ColorScheme; handleApplyFix: (fix: Fix, url?: string) => void
}) {
  const onApply = useCallback((url?: string) => handleApplyFix(fix, url), [fix, handleApplyFix])
  return <FixGridCard fix={fix} index={index} onApply={onApply} colors={colors} />
})

const MemoizedFixListCard = memo(function MemoizedFixListCard({ fix, index, colors, handleApplyFix }: {
  fix: Fix; index: number; colors: ColorScheme; handleApplyFix: (fix: Fix, url?: string) => void
}) {
  const onApply = useCallback((url?: string) => handleApplyFix(fix, url), [fix, handleApplyFix])
  return <FixListCard fix={fix} index={index} onApply={onApply} colors={colors} />
})

// ── Props ──

interface FixesGridProps {
  showSkeleton: boolean
  colors: ColorScheme
  virtualizer: Virtualizer<HTMLDivElement, Element>
  filteredFixes: Fix[]
  effectiveColumns: number
  viewMode: 'grid' | 'list'
  focusedIndex: number | null
  handleApplyFix: (fix: Fix, url?: string) => void
  setFixSearchQuery: (q: string) => void
  setFixFilter: (filters: string[]) => void
  fixFilter: string[]
  fixSearchQuery: string
}

// ── Component ──

export default function FixesGrid({
  showSkeleton, colors,
  virtualizer, filteredFixes, effectiveColumns,
  viewMode, focusedIndex, handleApplyFix,
  setFixSearchQuery, setFixFilter, fixFilter, fixSearchQuery,
}: FixesGridProps) {
  return (
    <div className="relative flex-1 min-h-0">
      {/* Real content - always mounted, opacity driven */}
      <div style={{ opacity: showSkeleton ? 0 : 1, transition: 'opacity 0.3s ease' }}>
        {filteredFixes.length === 0 ? (
          /* Premium Empty State */
          <div className="flex flex-col items-center justify-center py-20 px-4 animate-fixes-empty-in">
            <div
              className="w-28 h-28 rounded-3xl flex items-center justify-center mb-6 relative overflow-hidden animate-fixes-empty-float"
              style={{
                background: `linear-gradient(135deg, ${COLORS.violet}25, ${COLORS.blue}15)`,
                border: `2px solid ${COLORS.border}`,
                boxShadow: `0 0 60px ${COLORS.violet}20`,
              }}
            >
              <div
                className="absolute inset-0 animate-fixes-empty-grad-rotate"
                style={{ background: `linear-gradient(135deg, transparent, ${COLORS.violetDim}, transparent)` }}
              />
              <div className="animate-fixes-empty-wobble">
                <Wrench size={48} style={{ color: COLORS.violet }} />
              </div>
            </div>
            <h3 className="text-xl font-bold mb-2" style={{ color: COLORS.text }}>
              {fixSearchQuery ? 'No Results Found' : fixFilter.includes('All') ? 'No Fixes Available' : 'No Matches'}
            </h3>
            <p className="text-sm text-center max-w-md mb-8" style={{ color: COLORS.textMuted }}>
              {fixSearchQuery
                ? `No fixes match "${fixSearchQuery}"`
                : fixFilter.includes('All')
                  ? 'No fixes are currently available. Check back later for updates.'
                  : 'No fixes match the selected filter. Try a different category.'}
            </p>
            <div className="flex gap-3">
              {fixSearchQuery && (
                <button
                  onClick={() => setFixSearchQuery('')}
                  className="hv-tap-border px-6 py-3 rounded-2xl text-sm font-bold flex items-center gap-2"
                  style={{ background: `linear-gradient(135deg, ${COLORS.violet}20, ${COLORS.blue}15)`, border: `1px solid ${COLORS.violet}40`, color: COLORS.violet, '--hv-border': `${COLORS.violet}60` } as any}
                >
                  <Search size={14} />
                  Clear Search
                </button>
              )}
              {!fixFilter.includes('All') && (
                <button
                  onClick={() => setFixFilter(['All'])}
                  className="hv-tap-border px-6 py-3 rounded-2xl text-sm font-bold flex items-center gap-2"
                  style={{ background: `${COLORS.amber}15`, border: `1px solid ${COLORS.amber}40`, color: COLORS.amber, '--hv-border': `${COLORS.amber}60` } as any}
                >
                  <SlidersHorizontal size={14} />
                  Clear Filters
                </button>
              )}
            </div>
          </div>
        ) : (
          <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative', width: '100%' }}>
            {virtualizer.getVirtualItems().map(virtualRow => {
              const startIdx = virtualRow.index * effectiveColumns
              const rowItems = filteredFixes.slice(startIdx, startIdx + effectiveColumns)
              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    // Height is measured from real content (measureElement) so the row
                    // box hugs the cards — no fixed over-estimate leaving dead space
                    // between rows. ROW_GAP is baked in as paddingBottom so the measured
                    // height includes the gap and rows never overlap.
                    paddingBottom: `${ROW_GAP}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                    contain: 'layout style',
                    display: effectiveColumns > 1 ? 'grid' : 'flex',
                    gridTemplateColumns: effectiveColumns > 1 ? `repeat(${effectiveColumns}, 1fr)` : undefined,
                    flexDirection: effectiveColumns > 1 ? undefined : 'column',
                    gap: effectiveColumns > 1 ? COL_GAP + 'px' : '0.5rem',
                    alignItems: effectiveColumns > 1 ? 'start' : undefined,
                  }}
                >
                  {rowItems.map((fix, i) => {
                    const fixIdx = startIdx + i
                    const isFocused = fixIdx === focusedIndex
                    const focusStyle: React.CSSProperties = {
                      outline: isFocused ? `2px solid ${COLORS.violet}` : 'none',
                      outlineOffset: '2px',
                      borderRadius: '12px',
                      transform: isFocused ? 'scale(1.02)' : 'scale(1)',
                      transition: 'all 80ms cubic-bezier(0.4, 0, 0.2, 1)',
                    }
                    if (viewMode === 'list') {
                      return (
                        <div key={fix.appid} style={focusStyle}>
                          <MemoizedFixListCard
                            fix={fix}
                            index={fixIdx}
                            colors={colors}
                            handleApplyFix={handleApplyFix}
                          />
                        </div>
                      )
                    }
                    return (
                      <div key={fix.appid} style={focusStyle}>
                        <MemoizedFixGridCard
                          fix={fix}
                          index={fixIdx}
                          colors={colors}
                          handleApplyFix={handleApplyFix}
                        />
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Skeleton overlay */}
      <AnimatePresence>
        {showSkeleton && (
          <motion.div
            key="skeleton"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 z-10"
          >
            <FixesSkeleton colors={colors} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
