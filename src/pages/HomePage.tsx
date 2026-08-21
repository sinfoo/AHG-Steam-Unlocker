import { useEffect, useState, memo, useCallback, useMemo } from 'react'

import '../styles/home-animations.css'
import { PageProps } from '../types/pages'
import { Game } from '../types'

// Zustand stores
import { useGameStore, useSettingsStore, useUserStore, useModalStore } from '../store'
import { useShallow } from 'zustand/react/shallow'

// Shared components
import {
  StatCard,
  BentoCard,
  QuickActionsCard,
  CategoriesShowcase,
  GameSection,
  GenreRow,
  PosterRail,
  SpotlightFeature,
  FeatureMosaic,
  AIRecommendationsCard,
  BottomActionsCard,
} from '../components/shared'
import { SearchBar } from '../components/SearchBar'
import { LazySection } from '../components/LazySection'
import { loadGameImage } from '../services/imageCache'

// New hero + skeleton components
import HeroSection from '../components/HeroSection'
import HomePageSkeleton from '../components/HomePageSkeleton'

// Lucide icons used directly in this component
import {
  Crown, Trophy, Calendar, Flame, Award, Users, Star, Clock,
  Sword, Shield, FolderHeart, Gem, Target, Heart, Sparkles,
  History, Gamepad2, Settings, Wrench,
} from 'lucide-react'

// ── Seeded randomization helpers (stable per session/mount) ──────────────
function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function seededShuffle<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const t = a[i]!; a[i] = a[j]!; a[j] = t
  }
  return a
}
function dedupe(games: Game[]): Game[] {
  const seen = new Set<string>(); const out: Game[] = []
  for (const g of games) { if (g && !seen.has(g.appid)) { seen.add(g.appid); out.push(g) } }
  return out
}

// ── Computed values are passed as props from useGameFilters ──

const HomePage = memo(function HomePage({ handlers, colors, homeSections, recentGamesList, aiRecommendations }: PageProps & {
  homeSections: Record<string, Game[]>
  recentGamesList: Game[]
  aiRecommendations: Game[]
}) {
  const { navigateTo, handleGameClick, playSound } = handlers

  // ── Skeleton visible for at least 200ms to prevent flash ──
  const [showSkeleton, setShowSkeleton] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setShowSkeleton(false), 200)
    return () => clearTimeout(t)
  }, [])

  // Store selectors
  const { games, installedGames } = useGameStore(
    useShallow(s => ({ games: s.games, installedGames: s.installedGames }))
  )
  const setFixGamesModalOpen = useModalStore(s => s.setFixGamesModalOpen)
  const accentColor = useSettingsStore(s => s.accentColor)

  // Derived data
  const { featuredGame, quickAccessOffset, favorites, recentGames, userStats, setFeaturedGame, setQuickAccessOffset } = useUserStore(
    useShallow(s => ({
      featuredGame: s.featuredGame,
      quickAccessOffset: s.quickAccessOffset,
      favorites: s.favorites,
      recentGames: s.recentGames,
      userStats: s.userStats,
      setFeaturedGame: s.setFeaturedGame,
      setQuickAccessOffset: s.setQuickAccessOffset,
    }))
  )
  const trendingGames = homeSections.popularGames!.slice(0, 10)

  // Alias colors to COLORS so the extracted JSX works as-is
  const COLORS = colors

  // Shared components use a different Game type; cast at the boundary
  const onGameClick = (game: any) => handleGameClick(game as any)

  // ── Filter & Search State ──
  const [activeFilter, setActiveFilter] = useState<string>('All')

  // ── Session seed — drives stable-but-randomized section content & order ──
  const [seed] = useState(() => ((Date.now() >>> 0) ^ 0x9e3779b9) >>> 0)

  const picks = useMemo(() => {
    const rng = mulberry32(seed)
    const pop = homeSections.popularGames || []
    const aaa = homeSections.aaaGames || []
    const popShuf = seededShuffle(pop, rng)
    const spotPool = seededShuffle([...aaa, ...pop].filter(g => g.short_description || g.header_image), rng)
    const railMix = (genre: Game[]) =>
      dedupe(seededShuffle([...(genre || []).slice(0, 14), ...pop.slice(0, 14)], rng)).slice(0, 18)

    const railDefs = [
      { id: 'rpg', section: 'RPG', title: 'RPG & Adventure', icon: Shield, color: COLORS.blue, games: railMix(homeSections.rpgGames || []) },
      { id: 'indie', section: 'Indie', title: 'Indie Gems', icon: Gem, color: COLORS.violet, games: railMix(homeSections.indieGames || []) },
      { id: 'mp', section: 'Multiplayer', title: 'Multiplayer Arena', icon: Users, color: COLORS.green, games: railMix(homeSections.multiplayerGames || []) },
    ]

    return {
      spotlight: spotPool[0] || popShuf[0],
      spotlight2: spotPool[1] || popShuf[1],
      mustPlay: dedupe(popShuf).slice(0, 18),
      mosaic: dedupe(seededShuffle(pop, rng)).slice(0, 5),
      action: railMix(homeSections.actionGames || []),
      bestOf: dedupe(seededShuffle(pop, rng)).slice(0, 18),
      genreRails: seededShuffle(railDefs, rng),
    }
  }, [seed, homeSections, COLORS])

  const handleSearch = useCallback((query: string) => {
    if (!query.trim()) return
    useGameStore.getState().setSearchQuery(query)
    navigateTo('browse')
    setTimeout(() => { useGameStore.getState().setSearchQuery(query) }, 0)
  }, [navigateTo])

  // Keyboard navigation — cycle through featured games
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      const all = homeSections.aaaGames!.filter(g => g.header_image)
      if (all.length === 0) return
      const idx = featuredGame ? all.findIndex(g => g.appid === featuredGame.appid) : -1
      const nextIdx = e.key === 'ArrowRight'
        ? (idx + 1) % all.length
        : ((idx - 1 + all.length) % all.length)
      if (all[nextIdx]) setFeaturedGame(all[nextIdx] as any)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [games, featuredGame, setFeaturedGame, playSound])

  const [quickGameImgs, setQuickGameImgs] = useState<Record<string, string | null>>({})
  useEffect(() => {
    const totalAAA = homeSections.aaaGames!.length
    const offset = quickAccessOffset % Math.max(totalAAA, 1)
    const games = totalAAA > 0
      ? [...homeSections.aaaGames!.slice(offset, offset + 4), ...homeSections.aaaGames!.slice(0, Math.max(0, offset + 4 - totalAAA))].slice(0, 4)
      : []
    const results: Record<string, string | null> = {}
    Promise.allSettled(
      games.map(g => loadGameImage(g.appid, g.header_image || undefined, g.name || undefined, ['header.jpg']).then(url => { results[g.appid] = url }))
    ).then(() => setQuickGameImgs(results))
  }, [homeSections.aaaGames, quickAccessOffset])

  // ── Section divider element ──
  const Divider = () => (
    <div className="col-span-12 py-1">
      <div className="w-full h-px" style={{ background: `linear-gradient(90deg, transparent, ${COLORS.border}40, ${COLORS.violet}30, ${COLORS.border}40, transparent)` }} />
    </div>
  )

  return (
      <div className="relative pb-16 px-0">
        {/* Content with opacity transition — always mounted, skeleton overlays */}
        <div
          className={`transition-opacity duration-200 ${showSkeleton ? 'opacity-0' : 'opacity-100'}`}
          style={{ transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)' }}
        >
        {/* Hero Section */}
        <HeroSection
          featuredGame={featuredGame}
          accentColor={accentColor}
          COLORS={COLORS}
          onGameClick={onGameClick}
          navigateTo={navigateTo}
          playSound={playSound}
          games={homeSections.aaaGames!}
          setFeaturedGame={setFeaturedGame}
          quickAccessOffset={quickAccessOffset}
          setQuickAccessOffset={setQuickAccessOffset}
          totalAAA={homeSections.aaaGames!.length}
          quickGameImgs={quickGameImgs}
          isLoaded={true}
        />

        {/* Main Content */}
        <div className="relative px-4 lg:px-8 py-8">
          <div>
            {/* Section filter style — hides sections that don't match active filter */}
            {activeFilter !== 'All' && (
              <style>{`
                [data-section]:not([data-section="${activeFilter}"]):not([data-section="All"]) {
                  display: none !important;
                }
              `}</style>
            )}

            {/* Search Bar */}
            <div className="flex justify-center mb-4">
              <SearchBar onSearch={handleSearch} accentColor={accentColor} colors={COLORS} />
            </div>

            {/* Filter Chips */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none" style={{ WebkitOverflowScrolling: 'touch' } as any}>
              {['All', 'AAA', 'Action', 'RPG', 'Strategy', 'Multiplayer', 'Indie', 'Casual'].map(filter => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className="filter-chip px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap shrink-0 transition-all duration-150 hover:brightness-125 active:scale-95"
                  style={{
                    background: activeFilter === filter ? accentColor + '20' : 'rgba(255,255,255,0.04)',
                    color: activeFilter === filter ? accentColor : COLORS.textMuted,
                    border: `1px solid ${activeFilter === filter ? accentColor + '40' : 'rgba(255,255,255,0.06)'}`,
                  }}
                >
                  {filter}
                </button>
              ))}
            </div>

            {/* Stats Bar */}
            <div className="flex items-center gap-6 mb-8 overflow-x-auto pb-2">
              <StatCard icon={FolderHeart} value={installedGames.length} label="Installed" color={COLORS.violet} onClick={() => navigateTo('library')} />
              <StatCard icon={Heart} value={favorites.size} label="Favorites" color={COLORS.pink} onClick={() => navigateTo('favourites')} />
              <StatCard icon={History} value={recentGames.length} label="Recent" color={COLORS.blue} onClick={() => navigateTo('recent')} />
              <StatCard icon={Wrench} value={userStats.fixesApplied} label="Fixes Applied" color={COLORS.amber} />
              <StatCard icon={Gamepad2} value={games.length} label="Total Games" color={COLORS.green} />
              <div className="h-8 w-px" style={{ background: COLORS.border }} />
              <button onClick={() => navigateTo('settings')} className="flex items-center gap-2 px-4 py-2 rounded-xl" style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}` }}>
                <Settings size={18} style={{ color: COLORS[accentColor as keyof typeof COLORS] }} />
                <span className="text-sm font-medium" style={{ color: COLORS.text }}>Settings</span>
              </button>
            </div>

            {/* ── Spotlight Feature — wide cinematic opener ── */}
            <LazySection rootMargin="200px" minHeight={320}>
              <div className="mb-8" data-section="All">
                <SpotlightFeature game={picks.spotlight} label="Spotlight" onGameClick={onGameClick} colors={COLORS} />
              </div>
            </LazySection>

            {/* ── AAA Showcase ── */}
            <LazySection rootMargin="200px" minHeight={300}>
              {homeSections.aaaGames!.length > 0 && (
                <div className="mb-8" data-section="AAA">
                  <BentoCard title="AAA Blockbusters" icon={Crown} color={COLORS.amber} games={homeSections.aaaGames!.slice(0, 12)} layout="large" onGameClick={onGameClick} onSeeAll={() => navigateTo('browse')} colors={COLORS} />
                </div>
              )}
            </LazySection>

            {/* ── Must Play — premium PORTRAIT poster rail (ranked) ── */}
            <LazySection rootMargin="150px" minHeight={340}>
              <div className="mb-8" data-section="All">
                <PosterRail title="Must Play" subtitle="Hand-picked essentials" icon={Star} color={COLORS.amber} games={picks.mustPlay} ranked onGameClick={onGameClick} onSeeAll={() => navigateTo('browse')} colors={COLORS} />
              </div>
            </LazySection>

            {/* ── Asymmetric mosaic — mixed dimensions ── */}
            <LazySection rootMargin="150px" minHeight={320}>
              <div className="mb-8" data-section="All">
                <FeatureMosaic games={picks.mosaic} onGameClick={onGameClick} colors={COLORS} />
              </div>
            </LazySection>

            {/* ── Top Sellers (large) + side column ── */}
            <LazySection rootMargin="100px" minHeight={420}>
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-12 lg:col-span-8 section-entrance" data-section="All">
                <BentoCard title="Top Sellers" icon={Trophy} color={COLORS.amber} games={homeSections.popularGames!.slice(0, 12)} layout="large" onGameClick={onGameClick} onSeeAll={() => navigateTo('browse')} colors={COLORS} />
              </div>
              <div className="col-span-12 lg:col-span-4 space-y-4 section-entrance" data-section="All">
                <QuickActionsCard colors={COLORS} installedCount={installedGames.length} favoritesCount={favorites.size} onDownloadFix={() => setFixGamesModalOpen(true)} onRefreshGames={() => {}} onMyLibrary={() => navigateTo('library')} onFavorites={() => navigateTo('favourites')} />
                <BentoCard title="Coming Soon" icon={Calendar} color={COLORS.cyan} games={homeSections.popularGames!.slice(12, 20)} layout="compact" onGameClick={onGameClick} colors={COLORS} />
              </div>

              {/* Categories */}
              <div className="col-span-12 section-entrance" data-section="All">
                <CategoriesShowcase onCategoryClick={() => navigateTo('browse')} colors={COLORS} />
              </div>

              <Divider />

              {/* ── Action & Shooter — premium PORTRAIT poster rail (fixed + ranked) ── */}
              <div className="col-span-12 section-entrance" data-section="Action">
                <PosterRail title="Action & Shooter" subtitle="Adrenaline, guns & glory" icon={Sword} color={COLORS.red} games={picks.action} ranked onGameClick={onGameClick} onSeeAll={() => navigateTo('browse')} colors={COLORS} />
              </div>

              {/* Most Played (landscape section) */}
              <div className="col-span-12 section-entrance" data-section="All">
                <GameSection title="Most Played" icon={Flame} color={COLORS.amber} games={homeSections.popularGames!.slice(0, 20)} onGameClick={onGameClick} onSeeAll={() => navigateTo('browse')} colors={COLORS} />
              </div>

              {/* Two-column bentos */}
              <div className="col-span-12 lg:col-span-6 section-entrance" data-section="All">
                <BentoCard title="Staff Picks" icon={Award} color={COLORS.violet} games={homeSections.popularGames!.slice(20, 24)} layout="medium" onGameClick={onGameClick} onSeeAll={() => navigateTo('browse')} colors={COLORS} />
              </div>
              <div className="col-span-12 lg:col-span-6 section-entrance" data-section="Multiplayer">
                <BentoCard title="Multiplayer Hits" icon={Users} color={COLORS.green} games={homeSections.multiplayerGames!.slice(0, 6)} layout="medium" onGameClick={onGameClick} onSeeAll={() => navigateTo('browse')} colors={COLORS} />
              </div>

              {/* ── Randomized genre rails (order shuffled per session) ── */}
              {picks.genreRails.map(rail => (
                <div key={rail.id} className="col-span-12 section-entrance" data-section={rail.section}>
                  <GenreRow title={rail.title} icon={rail.icon} color={rail.color} games={rail.games} onGameClick={onGameClick} colors={COLORS} />
                </div>
              ))}

              {/* ── Second spotlight — rhythm break ── */}
              {picks.spotlight2 && (
                <div className="col-span-12 section-entrance" data-section="All">
                  <SpotlightFeature game={picks.spotlight2} label="Editor's Choice" onGameClick={onGameClick} colors={COLORS} />
                </div>
              )}

              {/* Recently Viewed */}
              {recentGamesList.length > 0 && (
                <div className="col-span-12 section-entrance" data-section="All">
                  <BentoCard title="Your History" icon={Clock} color={COLORS.blue} games={recentGamesList.slice(0, 8)} layout="list" onGameClick={onGameClick} onSeeAll={() => navigateTo('recent')} colors={COLORS} />
                </div>
              )}

              {/* Trending Now — compact tiles */}
              <div className="col-span-12 section-entrance" data-section="All">
                <div className="bg-mid/80 rounded-2xl border-t border-violet-500/10 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-text font-semibold flex items-center gap-2">
                      <Flame size={18} style={{ color: COLORS.red }} /> Trending Now
                    </h3>
                    <button onClick={() => navigateTo('browse')} className="text-text-muted text-sm hover:text-text transition-colors duration-80">See All →</button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                    {trendingGames.map((game, i) => (
                      <div key={game.appid} onClick={() => onGameClick(game)} className="trending-card group cursor-pointer relative" style={{ background: COLORS.bgCard, borderRadius: '12px', overflow: 'hidden' }}>
                        <div className={`rank-badge rank-badge-${i + 1}`}>#{i + 1}</div>
                        <div className="aspect-[3/2] overflow-hidden">
                          {game.header_image ? (
                            <img src={game.header_image} alt={game.name || ''} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-75" loading="lazy" decoding="async" fetchPriority="low" />
                          ) : (
                            <div className="w-full h-full" style={{ background: `linear-gradient(135deg, ${COLORS.violet}30, ${COLORS.blue}20)` }} />
                          )}
                        </div>
                        <div className="p-2"><p className="text-xs font-bold truncate" style={{ color: COLORS.text }}>{game.name}</p></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* AI Recommendations */}
              {aiRecommendations.length > 0 && (
                <div className="col-span-12 section-entrance" data-section="All">
                  <div className="bg-mid/80 rounded-2xl border-t border-violet-500/10 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-text font-semibold flex items-center gap-2"><Sparkles size={18} style={{ color: COLORS.violet }} /> AI Picks</h3>
                    </div>
                    <AIRecommendationsCard games={aiRecommendations} onGameClick={onGameClick} colors={COLORS} />
                  </div>
                </div>
              )}

              {/* ── Best of the Best — PORTRAIT poster rail (ranked) ── */}
              <div className="col-span-12 section-entrance" data-section="All">
                <PosterRail title="Best of the Best" subtitle="Top rated all-time" icon={Trophy} color={COLORS.violet} games={picks.bestOf} ranked onGameClick={onGameClick} onSeeAll={() => navigateTo('browse')} colors={COLORS} />
              </div>

              {/* Two-column bentos 2 */}
              <div className="col-span-12 lg:col-span-6 section-entrance" data-section="Strategy">
                <BentoCard title="Strategy Masters" icon={Target} color={COLORS.cyan} games={homeSections.popularGames!.slice(24, 28)} layout="medium" onGameClick={onGameClick} onSeeAll={() => navigateTo('browse')} colors={COLORS} />
              </div>
              <div className="col-span-12 lg:col-span-6 section-entrance" data-section="Indie">
                <BentoCard title="Indie Gems" icon={Gem} color={COLORS.amber} games={homeSections.indieGames!.slice(0, 4).length >= 4 ? homeSections.indieGames!.slice(0, 4) : homeSections.popularGames!.slice(28, 32)} layout="medium" onGameClick={onGameClick} onSeeAll={() => navigateTo('browse')} colors={COLORS} />
              </div>

              {/* Bottom Actions */}
              <div className="col-span-12 section-entrance" data-section="All">
                <BottomActionsCard onBrowse={() => navigateTo('browse')} onLibrary={() => navigateTo('library')} onFavorites={() => navigateTo('favourites')} onSettings={() => navigateTo('settings')} colors={COLORS} />
              </div>
            </div>
            </LazySection>
          </div>
        </div>
      </div>

      {/* ── Skeleton overlay ── */}
      <div
        className={`absolute inset-0 z-10 transition-opacity duration-200 ${showSkeleton ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        style={{ transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)' }}
      >
        <HomePageSkeleton />
      </div>
    </div>
  )
})

export default HomePage
