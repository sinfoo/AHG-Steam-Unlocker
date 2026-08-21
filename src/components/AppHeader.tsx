import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, Layers, Download, Minimize2, Maximize2, Trophy, Menu, Columns } from 'lucide-react'
import { DARK_COLORS } from '../constants/colors'
import { useSettingsStore } from '../store/settingsStore'

type ColorTokens = typeof DARK_COLORS

interface AppHeaderProps {
  windowWidth: number
  sidebarOverlayOpen: boolean
  setSidebarOverlayOpen: (v: boolean | ((prev: boolean) => boolean)) => void
  currentPage: string
  hideSearchBars: boolean
  searchQuery: string
  setSearchQuery: (q: string) => void
  searchInputRef: React.RefObject<HTMLInputElement | null>
  colors: ColorTokens
  batchMode: boolean
  setBatchMode: (v: boolean) => void
  selectedGames: Set<string>
  handleBatchInstall: () => void
  isFullscreen: boolean
  setShowAchievements: (v: boolean) => void
  userLevel: number
  achievements: Array<{ unlocked: boolean }>
}

export default function AppHeader({
  windowWidth,
  sidebarOverlayOpen,
  setSidebarOverlayOpen,
  currentPage,
  hideSearchBars,
  searchQuery,
  setSearchQuery,
  searchInputRef,
  colors: COLORS,
  batchMode,
  setBatchMode,
  selectedGames,
  handleBatchInstall,
  isFullscreen,
  setShowAchievements,
  userLevel,
  achievements,
}: AppHeaderProps) {
  const compactMode = useSettingsStore(s => s.compactMode)
  const setCompactMode = useSettingsStore(s => s.setCompactMode)
  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="h-20 px-6 flex items-center gap-6 shrink-0 z-20"
      style={{
        borderBottom: `1px solid ${COLORS.border}`,
        background: 'rgba(8, 8, 16, 0.98)',
        backdropFilter: 'blur(20px)'
      }}
    >
      {/* Hamburger Toggle — visible when sidebar is collapsed or window < 1100px */}
      {windowWidth < 1100 && (
        <button
          onClick={() => setSidebarOverlayOpen(v => !v)}
          aria-label={sidebarOverlayOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={sidebarOverlayOpen}
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 hover:brightness-125 tap-scale"
          style={{
            background: sidebarOverlayOpen ? `${COLORS.violet}25` : `${COLORS.bgCard}`,
            border: `1px solid ${sidebarOverlayOpen ? COLORS.violet + '50' : COLORS.border}`,
            color: sidebarOverlayOpen ? COLORS.violet : COLORS.textSecondary,
            transition: 'all 80ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <Menu size={18} />
        </button>
      )}

      {/* Search Bar - on browse, favourites, recent */}
      {(['browse', 'favourites', 'recent'].includes(currentPage)) && !hideSearchBars && (
        <div
          className="relative group flex-1 max-w-2xl"
        >
          <div
            className="absolute inset-0 rounded-2xl"
            style={{
              background: searchQuery ? `linear-gradient(135deg, ${COLORS.violet}25 0%, ${COLORS.bgCard} 100%)` : `linear-gradient(135deg, ${COLORS.violet}20 0%, ${COLORS.bgCard} 100%)`,
              border: `1px solid ${searchQuery ? COLORS.violet + '50' : COLORS.border}`,
              boxShadow: searchQuery ? `0 0 32px ${COLORS.violet}40` : 'none',
              transition: 'all 0.08s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = searchQuery
                ? `0 0 32px ${COLORS.violet}40, 0 0 48px ${COLORS.violet}30`
                : `0 0 24px ${COLORS.violet}30, 0 0 40px ${COLORS.violet}40`;
              e.currentTarget.style.borderColor = COLORS.violet + '60';
              e.currentTarget.style.background = `linear-gradient(135deg, ${COLORS.violet}30 0%, ${COLORS.bgCard} 100%)`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = searchQuery ? `0 0 32px ${COLORS.violet}40` : 'none';
              e.currentTarget.style.borderColor = searchQuery ? COLORS.violet + '50' : COLORS.border;
              e.currentTarget.style.background = searchQuery
                ? `linear-gradient(135deg, ${COLORS.violet}25 0%, ${COLORS.bgCard} 100%)`
                : `linear-gradient(135deg, ${COLORS.violet}20 0%, ${COLORS.bgCard} 100%)`;
            }}
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 z-10" size={18}
            style={{ color: searchQuery ? COLORS.violet : COLORS.textMuted }}
          />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search 170K+ games, DLCs, or press ⌘K..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-12 pl-12 pr-14 rounded-2xl text-sm text-white placeholder-gray-500 focus:outline-none transition-all relative z-10"
            style={{
              background: 'transparent',
            }}
          />
          {searchQuery && (
            <>
              <button
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-1 rounded-full hover:scale-110 transition-transform cursor-pointer tap-scale"
                style={{ color: COLORS.textMuted, animation: 'omo-fade-scale-in 0.15s ease-out' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = COLORS.violet }}
                onMouseLeave={(e) => { e.currentTarget.style.color = COLORS.textMuted }}
              >
                <X size={16} />
              </button>
            </>
          )}
        </div>
      )}

      {/* Batch Mode Controls */}
      <AnimatePresence>
        {(currentPage === 'browse') && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="flex items-center gap-2">
            <motion.button
              onClick={() => setBatchMode(!batchMode)}
              aria-label="Toggle batch install mode"
              aria-pressed={batchMode}
              className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 ${batchMode ? 'text-white' : ''}`}
              style={{
                background: batchMode ? COLORS.amber : COLORS.bgCard,
                border: `1px solid ${batchMode ? COLORS.amber : COLORS.border}`
              }}
            >
              <Layers size={16} /> Batch
            </motion.button>
            {batchMode && selectedGames.size > 0 && (
              <motion.button
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                onClick={handleBatchInstall}
                className="px-4 py-2 rounded-xl font-bold flex items-center gap-2"
                style={{ background: COLORS.green, color: 'white' }}
              >
                <Download size={16} /> Install ({selectedGames.size})
              </motion.button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Right side buttons - CompactMode + Fullscreen + Achievements */}
      <div className="flex items-center gap-2 ml-auto">
        {/* Compact Mode Toggle */}
        {(['browse', 'library', 'favourites'].includes(currentPage)) && (
          <button
            onClick={() => setCompactMode((prev: boolean) => !prev)}
            aria-label={compactMode ? 'Switch to normal card size' : 'Switch to compact card size'}
            aria-pressed={compactMode}
            className="h-12 w-12 rounded-2xl flex items-center justify-center cursor-pointer group hv-scale-08 tap-scale"
            style={{
              background: compactMode ? `linear-gradient(135deg, var(--accent) 0%, ${COLORS.violet}15 100%)` : `linear-gradient(135deg, ${COLORS.bgCard} 0%, ${COLORS.bgDeep} 100%)`,
              border: `1px solid ${compactMode ? 'var(--accent)' : COLORS.border}`,
              boxShadow: compactMode ? `0 4px 16px ${COLORS.violet}30` : 'none',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
            title={compactMode ? 'Normal Mode' : 'Compact Mode'}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = `0 8px 32px ${COLORS.violet}40, 0 0 48px ${COLORS.violet}20`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = compactMode ? `0 4px 16px ${COLORS.violet}30` : 'none';
            }}
          >
            <Columns size={20} style={{ color: compactMode ? 'var(--accent)' : COLORS.textSecondary }} />
          </button>
        )}
        {/* Fullscreen Toggle */}
        <button
          onClick={() => window.electronAPI?.toggleFullscreen?.()}
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          aria-pressed={isFullscreen}
          className="h-12 w-12 rounded-2xl flex items-center justify-center cursor-pointer group hv-scale-08 tap-scale"
          style={{
            background: isFullscreen ? `linear-gradient(135deg, var(--accent) 0%, ${COLORS.violet}15 100%)` : `linear-gradient(135deg, ${COLORS.bgCard} 0%, ${COLORS.bgDeep} 100%)`,
            border: `1px solid ${isFullscreen ? 'var(--accent)' : COLORS.border}`,
            boxShadow: isFullscreen ? `0 4px 16px ${COLORS.violet}30` : 'none',
            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = `0 8px 32px ${COLORS.violet}40, 0 0 48px ${COLORS.violet}20`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = isFullscreen ? `0 4px 16px ${COLORS.violet}30` : 'none';
          }}
        >
          {isFullscreen ? (
            <Minimize2 size={20} style={{ color: 'var(--accent)' }} />
          ) : (
            <Maximize2 size={20} style={{ color: COLORS.textSecondary }} />
          )}
        </button>

        {/* Level & Achievements Button */}
        <button
          className="h-12 px-4 rounded-2xl flex items-center gap-2 cursor-pointer achievement-card relative hv-scale-08 tap-scale"
          onClick={() => setShowAchievements(true)}
          aria-label={`Achievements — level ${userLevel}, ${achievements.filter(a => a.unlocked).length} of ${achievements.length} unlocked`}
          style={{
            background: `linear-gradient(135deg, ${COLORS.amber}25 0%, ${COLORS.amber}10 100%)`,
            border: `1px solid ${COLORS.amber}40`,
            boxShadow: `0 0 20px ${COLORS.amber}20`,
            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = `linear-gradient(135deg, ${COLORS.amber}35 0%, ${COLORS.amber}20 100%)`
            e.currentTarget.style.borderColor = COLORS.amber + '60'
            e.currentTarget.style.boxShadow = `0 8px 32px ${COLORS.amber}40, 0 0 48px ${COLORS.amber}20`
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = `linear-gradient(135deg, ${COLORS.amber}25 0%, ${COLORS.amber}10 100%)`
            e.currentTarget.style.borderColor = COLORS.amber + '40'
            e.currentTarget.style.boxShadow = `0 0 20px ${COLORS.amber}20`
          }}
        >
          {/* Level badge */}
          <div className="absolute -top-2 -left-2 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: COLORS.amber }}>
            {userLevel}
          </div>
          <span
            style={{ display: 'inline-block', transition: 'transform 80ms cubic-bezier(0.4, 0, 0.2, 1)' }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.2) rotate(15deg)' }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'none' }}
          >
            <Trophy size={20} style={{ color: COLORS.amber }} />
          </span>
          <span
            className="text-sm font-bold"
            style={{ color: COLORS.amber, transition: 'text-shadow 80ms cubic-bezier(0.4, 0, 0.2, 1)' }}
            onMouseEnter={(e) => { e.currentTarget.style.textShadow = `0 0 10px ${COLORS.amber}50` }}
            onMouseLeave={(e) => { e.currentTarget.style.textShadow = 'none' }}
          >
            {achievements.filter(a => a.unlocked).length}/{achievements.length}
          </span>
        </button>
      </div>
    </motion.header>
  )
}
