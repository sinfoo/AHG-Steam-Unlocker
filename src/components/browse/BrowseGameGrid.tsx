import { AnimatePresence, motion } from 'framer-motion'
import { Gamepad2 } from 'lucide-react'
import { Virtualizer } from '@tanstack/react-virtual'
import { Game } from '../../types'
import { GameCardCell } from '../shared'
import { BrowseSkeleton } from '../Skeletons'
import type { ColorScheme } from '../shared'

const GRID_GAP = 12
const GRID_CARD_HEIGHT = 320
const LIST_CARD_HEIGHT = 88
const ROW_GAP = 12
const CELL_WIDTH = 280

interface BrowseGameGridProps {
  ownedFilteredGames: Game[]
  viewMode: 'grid' | 'list'
  effectiveColumns: number
  rowVirtualizer: Virtualizer<HTMLDivElement, Element>
  colors: ColorScheme
  showSkeleton: boolean
  handleGameClick: (g: Game) => void
  toggleFavorite: (appid: string) => void
  handleContextMenu: (e: React.MouseEvent, g: Game) => void
  handleInstallGame: (g: Game) => void
  handleInstallFromZip: (g: Game) => void
  handleRemoveFromLibrary: (g: Game) => void
  favorites: Set<string>
  batchMode: boolean
  selectedGames: Set<string>
  setSelectedGames: (s: Set<string> | ((prev: Set<string>) => Set<string>)) => void
  installedAppids: Set<string>
  compactMode: boolean
  comingSoonAppids: Set<string>
}

export default function BrowseGameGrid({
  ownedFilteredGames, viewMode, effectiveColumns, rowVirtualizer,
  colors, showSkeleton, handleGameClick, toggleFavorite,
  handleContextMenu, handleInstallGame, handleInstallFromZip,
  handleRemoveFromLibrary, favorites,
  batchMode, selectedGames, setSelectedGames, installedAppids,
  compactMode, comingSoonAppids,
}: BrowseGameGridProps) {
  return (
    <>
      {/* Real content - always mounted, opacity driven */}
      <div
        className={`transition-opacity duration-200 ${showSkeleton ? 'opacity-0' : 'opacity-100'}`}
        style={{ transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)' }}
      >
        {ownedFilteredGames.length === 0 ? (
          /* ── Empty State ── */
          <div className="flex flex-col items-center justify-center h-full gap-4" style={{ color: colors.textDim }}>
            <div
              className="w-24 h-24 rounded-3xl flex items-center justify-center animate-[bgGradientShift_4s_ease-in-out_infinite]"
              style={{ background: `linear-gradient(135deg, ${colors.violet}15, ${colors.cyan}10, ${colors.violet}15)`, backgroundSize: '200% 200%', border: `1px solid ${colors.violet}20` }}
            >
              <Gamepad2 size={40} style={{ color: colors.violet, opacity: 0.4 }} />
            </div>
            <div className="text-center">
              <p className="text-xl font-bold" style={{ color: colors.textMuted }}>No games found</p>
              <p className="text-sm mt-1" style={{ color: colors.textDim }}>Try adjusting your filters or search query</p>
            </div>
          </div>
        ) : (
          <div style={{ width: '100%', position: 'relative', minHeight: `${rowVirtualizer.getTotalSize()}px` }}>
            {rowVirtualizer.getVirtualItems().map(virtualRow => {
              const startIdx = virtualRow.index * effectiveColumns
              const rowGames = ownedFilteredGames.slice(startIdx, startIdx + effectiveColumns)
              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    // Height is intentionally NOT fixed here: the row measures its own
                    // real content height via measureElement so the gap stays uniform
                    // regardless of how tall each card renders (1- vs 2-line titles).
                    // The row gap is baked into the measured box via paddingBottom so
                    // getBoundingClientRect().height includes it and rows never overlap.
                    paddingBottom: `${compactMode ? 8 : ROW_GAP}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                    contain: 'layout style',
                  }}
                >
                  <div
                    style={{
                      display: effectiveColumns > 1 ? 'grid' : 'flex',
                      gridTemplateColumns: effectiveColumns > 1 ? `repeat(${effectiveColumns}, 1fr)` : undefined,
                      flexDirection: effectiveColumns > 1 ? undefined : 'column',
                      alignItems: 'stretch',
                      columnGap: `${compactMode ? 8 : GRID_GAP}px`,
                    }}
                  >
                    {rowGames.map((game, i) => {
                      if (!game) return null
                      return (
                        <div key={game.appid} style={{ minWidth: 0 }}>
                          <GameCardCell
                            game={game}
                            index={startIdx + i}
                            comingSoon={comingSoonAppids.has(game.appid)}
                            viewMode={viewMode}
                            isFavorite={favorites.has(game.appid)}
                            colors={colors}
                            batchMode={batchMode}
                            isSelected={selectedGames.has(game.appid)}
                            onGameClick={handleGameClick}
                            onFavoriteToggle={toggleFavorite}
                            onContextMenu={handleContextMenu}
                            setSelectedGames={setSelectedGames}
                            onInstallGame={handleInstallGame}
                            onInstallFromZip={handleInstallFromZip}
                            isInLibrary={installedAppids.has(game.appid)}
                            onRemoveFromLibrary={handleRemoveFromLibrary}
                            compactMode={compactMode}
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Skeleton - inline block element, not absolutely positioned, flows after hero */}
      <AnimatePresence>
        {showSkeleton && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="pt-8"
          >
            <BrowseSkeleton colors={colors} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export { GRID_GAP, GRID_CARD_HEIGHT, LIST_CARD_HEIGHT, ROW_GAP, CELL_WIDTH }
