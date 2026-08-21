import { memo, Suspense, lazy } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DARK_COLORS } from '../constants/colors'
import type { PageHandlers } from '../types/pages'
import type { Game } from '../types'

// ── Lazy-loaded pages (same pattern as App.tsx) ──
const HomePage = lazy(() => import('../pages/HomePage'))
const BrowsePage = lazy(() => import('../pages/BrowsePage'))
const FavouritesPage = lazy(() => import('../pages/FavouritesPage'))
const RecentPage = lazy(() => import('../pages/RecentPage'))
const LibraryPage = lazy(() => import('../pages/LibraryPage'))
const FixesPage = lazy(() => import('../pages/FixesPage').then(m => ({ default: m.FixesPage })))
const SettingsPage = lazy(() => import('../pages/SettingsPage'))

// ── Shared fallback — premium skeleton grid ──
function PageFallback(_props: { colors: typeof DARK_COLORS }) {
  const skeletons = Array.from({ length: 6 })
  return (
    <div className="flex-1 py-8 px-5 lg:pl-8">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {skeletons.map((_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <div
              className="skeleton-premium w-full aspect-[2/3] rounded-xl overflow-hidden"
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <div className="w-full h-full skeleton-violet" />
            </div>
            <div className="h-3 w-3/4 rounded-md skeleton-violet" />
            <div className="h-2 w-1/2 rounded-md skeleton-violet" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Page animations — smoother with subtle scale ──
const pageTransition = {
  type: "spring" as const,
  duration: 0.35,
  bounce: 0,
}

function pageMotion(key: string, exitY: number = -8) {
  return {
    key,
    initial: { opacity: 0, y: 16, scale: 0.98, filter: "blur(4px)" },
    animate: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" },
    exit: { opacity: 0, y: exitY, scale: 0.98, filter: "blur(4px)", pointerEvents: "none" as const },
    transition: pageTransition,
  }
}

// ── Props ──
export interface PageRouterProps {
  currentPage: string
  COLORS: typeof DARK_COLORS
  handlers: PageHandlers

  // HomePage
  homeSections: Record<string, Game[]>
  gamesWithCover: Game[]
  popularGamesWithCover: Game[]
  recentGamesList: Game[]
  aiRecommendations: Game[]

  // BrowsePage
  filteredGames: Game[]

  // SettingsPage
  pureBlack: boolean
  setPureBlack: (v: boolean) => void
  reducedMotion: boolean
  setReducedMotion: (v: boolean) => void
  accentColor: string
  setAccentColor: (v: string) => void
  soundEnabled: boolean
  setSoundEnabled: (v: boolean) => void
  batchMode: boolean
  setBatchMode: (v: boolean) => void
  viewMode: string
  setViewMode: (v: string) => void
  compactMode: boolean
  setCompactMode: (v: boolean) => void
  games: Game[]
  installedGames: any[]
  favorites: Set<string>
  recentGames: string[]
  showToast: (msg: string, type?: 'success' | 'error' | 'favorites' | 'info') => void
  playSound: (sound: 'success' | 'error' | 'click' | 'hover' | 'achievement') => void
  bridge: any
  selectedGame: any
}

const PageRouter = memo(function PageRouter({
  currentPage,
  COLORS,
  handlers,
  homeSections,
  gamesWithCover,
  popularGamesWithCover,
  recentGamesList,
  aiRecommendations,
  filteredGames,
  pureBlack,
  setPureBlack,
  reducedMotion,
  setReducedMotion,
  accentColor,
  setAccentColor,
  soundEnabled,
  setSoundEnabled,
  batchMode,
  setBatchMode,
  viewMode,
  setViewMode,
  compactMode,
  setCompactMode,
  games,
  installedGames,
  favorites,
  recentGames,
  showToast,
  playSound,
  bridge,
  selectedGame,
}: PageRouterProps) {
  const fb = <PageFallback colors={COLORS} />

  return (
    <AnimatePresence mode="popLayout">
      {currentPage === 'home' && (
        <motion.div {...pageMotion('home')} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Suspense fallback={fb}>
            <HomePage
              handlers={handlers}
              colors={COLORS}
              homeSections={homeSections}
              recentGamesList={recentGamesList}
              aiRecommendations={aiRecommendations}
            />
          </Suspense>
        </motion.div>
      )}
      {currentPage === 'browse' && (
        <motion.div {...pageMotion('browse')} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Suspense fallback={fb}>
            <BrowsePage
              handlers={handlers}
              colors={COLORS}
              gamesWithCover={gamesWithCover}
              filteredGames={filteredGames}
              popularGamesWithCover={popularGamesWithCover}
            />
          </Suspense>
        </motion.div>
      )}
      {currentPage === 'favourites' && (
        <motion.div {...pageMotion('favourites')} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Suspense fallback={fb}>
            <FavouritesPage handlers={handlers} colors={COLORS} />
          </Suspense>
        </motion.div>
      )}
      {currentPage === 'recent' && (
        <motion.div {...pageMotion('recent')} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Suspense fallback={fb}>
            <RecentPage handlers={handlers} colors={COLORS} />
          </Suspense>
        </motion.div>
      )}
      {currentPage === 'library' && (
        <motion.div {...pageMotion('library')} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Suspense fallback={fb}>
            <LibraryPage handlers={handlers} colors={COLORS} />
          </Suspense>
        </motion.div>
      )}
      {currentPage === 'fixes' && (
        <motion.div {...pageMotion('fixes')} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Suspense fallback={fb}>
            <FixesPage handlers={handlers} colors={COLORS} />
          </Suspense>
        </motion.div>
      )}
      {currentPage === 'settings' && (
        <motion.div {...pageMotion('settings', -12)} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Suspense fallback={fb}>
            <SettingsPage
              colors={COLORS}
              pureBlack={pureBlack}
              setPureBlack={setPureBlack}
              reducedMotion={reducedMotion}
              setReducedMotion={setReducedMotion}
              accentColor={accentColor}
              setAccentColor={setAccentColor}
              soundEnabled={soundEnabled}
              setSoundEnabled={setSoundEnabled}
              batchMode={batchMode}
              setBatchMode={setBatchMode}
              viewMode={viewMode}
              setViewMode={setViewMode}
              compactMode={compactMode}
              setCompactMode={setCompactMode}
              games={games}
              installedGames={installedGames}
              favorites={favorites}
              recentGames={recentGames}
              showToast={showToast}
              playSound={playSound}
              bridge={bridge}
              selectedGame={selectedGame}
            />
          </Suspense>
        </motion.div>
      )}
    </AnimatePresence>
  )
})

export default PageRouter
