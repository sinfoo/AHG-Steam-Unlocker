import { motion, AnimatePresence } from 'framer-motion'
import { Search, SlidersHorizontal, Wrench } from 'lucide-react'
import { Fix } from '../../types'
import type { ColorScheme } from '../shared'
import { FixRowCard } from './FixRowCard'
import { FixesSkeleton } from '../Skeletons'
import '../../styles/fixes-animations.css'
import '../../styles/card-animations.css'
import type { Virtualizer } from '@tanstack/react-virtual'
import { useT } from '../../i18n'

// ── Module-level constants ──

export const COL_GAP = 14
export const ROW_GAP = 14

// ── Props ──

interface FixesGridProps {
  showSkeleton: boolean
  colors: ColorScheme
  virtualizer: Virtualizer<HTMLDivElement, Element>
  filteredFixes: Fix[]
  effectiveColumns: number
  focusedIndex: number | null
  handleApplyFix: (fix: Fix, url?: string) => Promise<void>
  onOpenFix: (fix: Fix) => void
  setFixSearchQuery: (q: string) => void
  setFixFilter: (filters: string[]) => void
  fixFilter: string[]
  fixSearchQuery: string
}

// ── Component ──

export default function FixesGrid({
  showSkeleton, colors,
  virtualizer, filteredFixes, effectiveColumns,
  focusedIndex, handleApplyFix, onOpenFix,
  setFixSearchQuery, setFixFilter, fixFilter, fixSearchQuery,
}: FixesGridProps) {
  const t = useT()
  return (
    <div className="relative flex-1 min-h-0">
      {/* Real content - always mounted, opacity driven */}
      <div style={{ opacity: showSkeleton ? 0 : 1, transition: 'opacity 0.3s ease' }}>
        {filteredFixes.length === 0 ? (
          /* Empty state */
          <div style={{ padding: '70px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center', animation: 'v2-riseIn .35s both' }}>
            <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(255,255,255,.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b8aa3' }}>
              <Wrench size={28} />
            </div>
            <div style={{ fontSize: 17, fontWeight: 600, color: '#f3f2fa' }}>
              {fixSearchQuery ? t('app.fixes.noResults') : fixFilter.includes('All') ? t('app.fixes.noFixes') : t('app.fixes.noMatches')}
            </div>
            <div style={{ fontSize: 13.5, color: '#8b8aa3', maxWidth: 420 }}>
              {fixSearchQuery
                ? t('app.fixes.noMatchQuery', { q: fixSearchQuery })
                : fixFilter.includes('All')
                  ? t('app.fixes.noneAvailable')
                  : t('app.fixes.noMatchFilter')}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
              {fixSearchQuery && (
                <button
                  onClick={() => setFixSearchQuery('')}
                  className="v2-ctl"
                  style={{ height: 38, padding: '0 16px', borderRadius: 11, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.05)', color: '#fff', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <Search size={14} />
                  {t('app.fixes.clearSearch')}
                </button>
              )}
              {!fixFilter.includes('All') && (
                <button
                  onClick={() => setFixFilter(['All'])}
                  className="v2-ctl"
                  style={{ height: 38, padding: '0 16px', borderRadius: 11, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.05)', color: '#fff', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <SlidersHorizontal size={14} />
                  {t('app.fixes.clearFilters')}
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
                    insetInlineStart: 0,
                    width: '100%',
                    // Height is measured from real content (measureElement) so the row
                    // box hugs the cards — no fixed over-estimate leaving dead space
                    // between rows. ROW_GAP is baked in as paddingBottom so the measured
                    // height includes the gap and rows never overlap.
                    paddingBottom: `${ROW_GAP}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                    contain: 'layout style',
                    display: 'grid',
                    gridTemplateColumns: `repeat(${effectiveColumns}, minmax(0, 1fr))`,
                    gap: COL_GAP + 'px',
                    alignItems: 'start',
                  }}
                >
                  {rowItems.map((fix, i) => {
                    const fixIdx = startIdx + i
                    const isFocused = fixIdx === focusedIndex
                    const focusStyle: React.CSSProperties = {
                      outline: isFocused ? '2px solid var(--acc,#a77dff)' : 'none',
                      outlineOffset: '2px',
                      borderRadius: 18,
                      animation: 'v2-riseIn .35s cubic-bezier(.16,1,.3,1) backwards',
                      animationDelay: `${Math.min(i, 8) * 30}ms`,
                    }
                    return (
                      <div key={fix.appid} className="v2-fixwrap" style={focusStyle}>
                        <FixRowCard fix={fix} onApply={handleApplyFix} onOpen={onOpenFix} />
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
