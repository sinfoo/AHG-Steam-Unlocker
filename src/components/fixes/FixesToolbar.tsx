import type { RefObject } from 'react'
import { Search, Sparkles, Wrench, SlidersHorizontal } from 'lucide-react'
import type { ColorScheme } from '../shared'
import { COLORS } from '../../constants/colors'
import { FIX_FILTERS } from '../../utils/gameHelpers'

interface FixesToolbarProps {
  colors: ColorScheme
  fixSearchQuery: string
  setFixSearchQuery: (q: string) => void
  fixesFuzzyActiveRef: RefObject<boolean | null>
  fixSourceFilter: 'all' | 'ryuu' | 'online'
  setFixSourceFilter: (v: 'all' | 'ryuu' | 'online') => void
  fixFilter: string[]
  toggleFixFilter: (id: string) => void
}

export default function FixesToolbar({
  colors, fixSearchQuery, setFixSearchQuery, fixesFuzzyActiveRef,
  fixSourceFilter, setFixSourceFilter, fixFilter, toggleFixFilter,
}: FixesToolbarProps) {
  return (
    <div className="flex flex-wrap gap-3 mb-5">
      {/* Search with focus glow */}
      <div className="flex-1 relative min-w-[200px] max-w-sm">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2" size={16} style={{ color: colors.textMuted }} />
        <input
          type="text"
          placeholder="Search fixes..."
          value={fixSearchQuery}
          onChange={(e) => setFixSearchQuery(e.target.value)}
          className="w-full h-10 pl-10 pr-4 rounded-xl text-sm outline-none transition-all"
          style={{
            background: `${colors.bgCard}cc`,
            backdropFilter: 'blur(8px)',
            border: `1px solid ${fixSearchQuery ? colors.violet + '50' : colors.border}`,
            color: colors.text,
            boxShadow: fixSearchQuery ? `0 0 18px ${colors.violet}20` : 'none',
          }}
        />
        {fixesFuzzyActiveRef.current && (
          <span
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded"
            style={{ background: `${colors.violet}20`, color: colors.violetLight }}
          >
            Fuzzy
          </span>
        )}
      </div>

      {/* Source Filter: Steam Fixes (ryuu.lol) vs Online Fixes */}
      <div className="flex gap-1.5 items-center">
        <button
          onClick={() => setFixSourceFilter('ryuu')}
          className="hv-scale-02 tap-scale-98 h-10 px-4 rounded-xl text-xs font-bold flex items-center gap-2"
          style={{
            background: fixSourceFilter === 'ryuu'
              ? `linear-gradient(135deg, ${colors.green}30 0%, ${colors.green}15 100%)`
              : `linear-gradient(135deg, ${colors.bgCard} 0%, ${colors.bgDeep} 100%)`,
            border: `1px solid ${fixSourceFilter === 'ryuu' ? colors.green + '60' : colors.border}`,
            color: fixSourceFilter === 'ryuu' ? colors.green : colors.textSecondary,
            boxShadow: fixSourceFilter === 'ryuu' ? `0 0 22px ${colors.green}30` : 'none',
          }}
        >
          <Sparkles size={13} />
          Steam Fixes
        </button>
        <button
          onClick={() => setFixSourceFilter('online')}
          className="hv-scale-02 tap-scale-98 h-10 px-4 rounded-xl text-xs font-bold flex items-center gap-2"
          style={{
            background: fixSourceFilter === 'online'
              ? `linear-gradient(135deg, ${colors.blue}30 0%, ${colors.blue}15 100%)`
              : `linear-gradient(135deg, ${colors.bgCard} 0%, ${colors.bgDeep} 100%)`,
            border: `1px solid ${fixSourceFilter === 'online' ? colors.blue + '60' : colors.border}`,
            color: fixSourceFilter === 'online' ? colors.blue : colors.textSecondary,
            boxShadow: fixSourceFilter === 'online' ? `0 0 22px ${colors.blue}30` : 'none',
          }}
        >
          <Wrench size={13} />
          Online Fixes
        </button>

        <button
          onClick={() => setFixSourceFilter('all')}
          className="hv-scale-02 tap-scale-98 h-10 px-4 rounded-xl text-xs font-bold"
          style={{
            background: fixSourceFilter === 'all'
              ? `linear-gradient(135deg, ${colors.violet}30 0%, ${colors.violet}15 100%)`
              : `linear-gradient(135deg, ${colors.bgCard} 0%, ${colors.bgDeep} 100%)`,
            border: `1px solid ${fixSourceFilter === 'all' ? colors.violet + '60' : colors.border}`,
            color: fixSourceFilter === 'all' ? colors.violet : colors.textSecondary,
            boxShadow: fixSourceFilter === 'all' ? `0 0 22px ${colors.violet}30` : 'none',
          }}
        >
          All
        </button>
      </div>

      {/* Badge Filter Pills */}
      <div className="flex gap-2 items-center flex-wrap">
        {(FIX_FILTERS as { id: string; label: string; color: string }[]).map(filter => (
          <button
            key={filter.id}
            onClick={() => toggleFixFilter(filter.id)}
            className="h-11 px-5 rounded-2xl text-sm font-bold flex items-center gap-2.5 cursor-pointer"
            style={{
              background: fixFilter.includes(filter.id)
                ? `linear-gradient(135deg, ${filter.color}30 0%, ${filter.color}15 100%)`
                : `linear-gradient(135deg, ${colors.bgCard} 0%, ${colors.bgDeep} 100%)`,
              border: `1px solid ${fixFilter.includes(filter.id) ? filter.color + '50' : colors.border}`,
              color: fixFilter.includes(filter.id) ? filter.color : colors.textSecondary,
              boxShadow: fixFilter.includes(filter.id) ? `0 0 20px ${filter.color}25` : 'none',
            }}
          >
            {filter.id !== 'All' && (
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{
                  background: filter.color,
                  boxShadow: `0 0 8px ${filter.color}60`,
                }}
              />
            )}
            {filter.label}
          </button>
        ))}
        {/* Active count badge */}
        {!fixFilter.includes('All') && fixFilter.length > 0 && (
          <span className="text-xs px-3 py-1.5 rounded-xl font-bold" style={{ background: `${colors.violet}25`, color: colors.violet }}>
            {fixFilter.length}
          </span>
        )}
      </div>
    </div>
  )
}

