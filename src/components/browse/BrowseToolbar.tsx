import { AnimatePresence, motion } from 'framer-motion'
import { Crown, LayoutGrid, List } from 'lucide-react'
import { COLORS } from '../../constants/colors'
import { useGameStore, useSettingsStore } from '../../store'
import type { ColorScheme } from '../shared'

const SORT_OPTIONS = [
  { value: 'popularity', label: 'Popular', icon: '\u{1F525}' },
  { value: 'name_asc', label: 'A-Z', icon: '\u2B06' },
  { value: 'name_desc', label: 'Z-A', icon: '\u2B07' },
] as const

interface BrowseToolbarProps {
  colors: ColorScheme
  gameCount: number
  totalCount: number
  searchQuery: string
  popularOnly: boolean
  setPopularOnly: React.Dispatch<React.SetStateAction<boolean>>
}

export default function BrowseToolbar({
  colors, gameCount, totalCount, searchQuery,
  popularOnly, setPopularOnly,
}: BrowseToolbarProps) {
  const viewMode = useGameStore(s => s.viewMode)
  const setViewMode = useGameStore(s => s.setViewMode)
  const sortBy = useGameStore(s => s.sortBy)
  const setSortBy = useGameStore(s => s.setSortBy)
  const batchMode = useSettingsStore(s => s.batchMode)
  const selectedGames = useGameStore(s => s.selectedGames)
  const setSelectedGames = useGameStore(s => s.setSelectedGames)

  return (
    <>
      {/* ── Filter Controls + View Toggle ── */}
      <div className="flex items-center gap-3 mb-3 px-1">
        {/* ── View Toggle ── */}
        <div
          className="flex items-center gap-0.5 shrink-0 rounded-lg p-0.5"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <button
            onClick={() => setViewMode('grid')}
            className="p-1.5 rounded-md cursor-pointer hv-e"
            style={{
              background: viewMode === 'grid' ? `${colors.violet}25` : 'transparent',
              color: viewMode === 'grid' ? colors.violetLight : colors.textDim,
              '--hv-s': 1.08,
              '--tap-s': 0.92,
              '--tap-f': 'brightness(0.85)',
            } as React.CSSProperties}
            title="Grid view"
          >
            <LayoutGrid size={14} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className="p-1.5 rounded-md cursor-pointer hv-e"
            style={{
              background: viewMode === 'list' ? `${colors.violet}25` : 'transparent',
              color: viewMode === 'list' ? colors.violetLight : colors.textDim,
              '--hv-s': 1.08,
              '--tap-s': 0.92,
              '--tap-f': 'brightness(0.85)',
            } as React.CSSProperties}
            title="List view"
          >
            <List size={14} />
          </button>
        </div>

        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as 'popularity' | 'name_asc' | 'name_desc')}
          className="text-xs px-2.5 py-1.5 rounded-lg cursor-pointer shrink-0 outline-none"
          style={{
            background: 'rgba(255,255,255,0.04)',
            color: colors.text,
            border: `1px solid ${colors.whiteGlass}`,
          }}
        >
          {SORT_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value} style={{ background: COLORS.bgMid }}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* ── Popular Only Toggle ── */}
        <button
          onClick={() => setPopularOnly(prev => !prev)}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg shrink-0 cursor-pointer hv-e"
          style={{
            background: popularOnly ? `${colors.violet}25` : 'rgba(255,255,255,0.04)',
            color: popularOnly ? colors.violetLight : colors.textMuted,
            border: popularOnly
              ? `1px solid ${colors.violet}40`
              : `1px solid ${colors.whiteGlass}`,
            '--hv-s': 1.05,
            '--tap-s': 0.95,
            '--tap-f': 'brightness(0.85)',
          } as React.CSSProperties}
        >
          <Crown size={12} strokeWidth={2.5} />
          <span>Popular Only</span>
        </button>
      </div>

      {/* ── Stats Bar — nowrap prevents individual text wrapping ── */}
      <div className="flex items-center justify-between gap-2 flex-wrap mb-2 px-1">
        <span className="text-xs shrink-0 whitespace-nowrap" style={{ color: colors.textDim }}>
          {searchQuery
            ? `${gameCount.toLocaleString()} of ${totalCount.toLocaleString()} games matched`
            : `${gameCount.toLocaleString()} games`}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-medium whitespace-nowrap" style={{ color: colors.textMuted }}>
            {viewMode === 'grid' ? 'Grid' : 'List'} view
          </span>
        </div>
      </div>

      {/* ── Batch Mode Banner ── */}
      <AnimatePresence>
        {batchMode && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden mb-3"
          >
            <motion.div
              initial={{ y: -8 }}
              animate={{ y: 0 }}
              className="px-4 py-2.5 rounded-xl flex items-center justify-between"
              style={{
                background: 'linear-gradient(135deg, rgba(255, 185, 0, 0.12), rgba(255, 185, 0, 0.04))',
                border: '1px solid rgba(255, 185, 0, 0.2)',
                backdropFilter: 'blur(8px)',
              }}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{
                  background: 'rgba(255, 185, 0, 0.2)',
                  color: '#fbbf24',
                }}>
                  BATCH
                </span>
                <span className="text-xs text-white/70">
                  Click games to select, then press <strong>Install</strong>
                </span>
              </div>
              {selectedGames.size > 0 && (
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-white/90">
                    {selectedGames.size} selected
                  </span>
                  <button
                    onClick={() => setSelectedGames(new Set())}
                    className="text-[10px] px-2 py-1 rounded-lg text-white/50 hover:text-white/80 cursor-pointer hv-e"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      '--hv-s': 1.05,
                      '--tap-s': 0.95,
                      '--tap-f': 'brightness(0.85)',
                    } as React.CSSProperties}
                  >
                    Clear
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
