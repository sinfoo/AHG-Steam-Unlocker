import { memo, useDeferredValue } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Zap, Clock, ChevronRight } from 'lucide-react'
import type { ColorScheme, Game } from './shared'
import { useUIStore, useGameStore, useUserStore } from '../store'
import GameCover from './GameCover'

interface QuickTool {
  name: string
  desc: string
  icon: React.ComponentType<{ size?: number }>
  color: string
  action: () => void
}

interface CommandPaletteProps {
  colors: ColorScheme
  handleGameClick: (game: Game) => void
  quickTools: QuickTool[]
}

export const CommandPalette = memo(function CommandPalette({ colors: COLORS, handleGameClick, quickTools }: CommandPaletteProps) {
  const commandPaletteOpen = useUIStore(s => s.commandPaletteOpen)
  const setCommandPaletteOpen = useUIStore(s => s.setCommandPaletteOpen)
  const searchResults = useGameStore(s => s.searchResults)
  const searchQuery = useGameStore(s => s.searchQuery)
  const setSearchQuery = useGameStore(s => s.setSearchQuery)
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const searchHistory = useUserStore(s => s.searchHistory)

  return (
    <AnimatePresence>
      {commandPaletteOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center"
          onClick={() => setCommandPaletteOpen(false)}
        >
          <div className="fixed inset-0 bg-black/70 backdrop-blur-md" />
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: -30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: -30 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="relative mx-4"
            style={{ width: '100%', maxWidth: '42rem', zIndex: 101 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="mx-4 rounded-2xl overflow-hidden flex flex-col" style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, boxShadow: `0 25px 80px ${COLORS.violet}30, 0 0 60px rgba(0,0,0,0.5)`, maxHeight: '85vh' }}>
              {/* Search Input - Enhanced */}
              <div className="p-5 shrink-0" style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: COLORS.violet + '20' }}>
                    <Search size={22} style={{ color: COLORS.violet }} />
                  </div>
                  <input 
                    type="text"
                    placeholder="Search games by name or ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 bg-transparent text-white placeholder-gray-500 outline-none text-lg font-medium"
                    autoFocus
                  />
                  <motion.button
                    onClick={() => { setSearchQuery(''); setCommandPaletteOpen(false); }}
                    className="px-4 py-2 rounded-xl text-sm font-bold"
                    style={{ background: COLORS.red + '20', color: COLORS.red }}
                  >
                    ESC
                  </motion.button>
                </div>
              </div>

              {/* Search Results - Scrollable */}
              <div className="flex-1 overflow-y-auto p-3" style={{ maxHeight: '400px' }}>
                <p className="text-xs px-3 py-2 font-bold flex items-center gap-2 sticky top-0" style={{ color: COLORS.textMuted, background: COLORS.bgCard }}>
                  <Zap size={12} style={{ color: COLORS.amber }} />
                  SEARCH RESULTS ({searchResults.length})
                </p>
                {searchResults.length > 0 ? (
                  <div className="space-y-1.5 pt-1">
                    {searchResults.map((game: Game, i: number) => (
                      <motion.button
                        key={game.appid}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(i * 0.02, 0.1) }}
                        className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-left"
                        onClick={() => { handleGameClick(game); setCommandPaletteOpen(false); }}
                      >
                        <div className="w-20 h-12 rounded-lg overflow-hidden shrink-0" style={{ background: `linear-gradient(135deg, ${COLORS.violet}30, ${COLORS.blue}30)` }}>
                          <GameCover appid={game.appid} name={game.name} localHeader={game.header_image} className="w-full h-full" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-semibold truncate text-sm">{game.name}</p>
                          <p className="text-xs font-bold" style={{ color: COLORS.violet }}>#{game.appid}</p>
                        </div>
                        <ChevronRight size={18} style={{ color: COLORS.textMuted }} />
                      </motion.button>
                    ))}
                  </div>
                ) : deferredSearchQuery.length >= 1 ? (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-20"
                  >
                    <p className="text-sm" style={{ color: COLORS.textMuted }}>No games found for "{deferredSearchQuery}"</p>
                  </motion.div>
                ) : (
                  <>
                    {searchHistory.length > 0 && (
                      <>
                        <p className="text-xs px-3 py-2 font-bold mt-2 flex items-center gap-2" style={{ color: COLORS.textMuted }}>
                          <Clock size={12} style={{ color: COLORS.violet }} />
                          RECENT SEARCHES
                        </p>
                        <div className="space-y-0.5">
                          {searchHistory.slice(0, 5).map((term: string, i: number) => (
                            <motion.button
                              key={term}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.02 }}
                              className="w-full flex items-center gap-4 px-4 py-2.5 rounded-xl text-left"
                              onClick={() => { setSearchQuery(term); }}
                            >
                              <Clock size={16} style={{ color: COLORS.textMuted }} />
                              <span className="text-sm" style={{ color: COLORS.text }}>{term}</span>
                            </motion.button>
                          ))}
                        </div>
                      </>
                    )}
                    <p className="text-xs px-3 py-2 font-bold mt-2 flex items-center gap-2" style={{ color: COLORS.textMuted }}>
                      <Zap size={12} style={{ color: COLORS.green }} />
                      QUICK ACTIONS
                    </p>
                    <div className="space-y-1.5">
                      {quickTools.map((tool, i) => (
                        <motion.button
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.02 }}
                          className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-left"
                          onClick={() => { tool.action(); setCommandPaletteOpen(false); }}
                        >
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: tool.color + '20', color: tool.color }}>
                            <tool.icon size={20} />
                          </div>
                          <div>
                            <p className="text-white font-semibold">{tool.name}</p>
                            <p className="text-xs" style={{ color: COLORS.textMuted }}>{tool.desc}</p>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
})
