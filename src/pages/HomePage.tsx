import { useEffect, useState, memo, useCallback, useMemo } from 'react'

import '../styles/home-animations.css'
import { PageProps } from '../types/pages'
import { Game, Fix } from '../types'

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
import { getSteamImage } from '../utils/gameHelpers'
import { SectionHeader } from '../components/home/SectionHeader'
import { NewFixCard } from '../components/home/NewFixCard'
import { useT, type TKey } from '../i18n'
import { useGenreLabel } from '../utils/genreLabel'

// New hero + skeleton components
import HeroSection from '../components/HeroSection'
import HomePageSkeleton from '../components/HomePageSkeleton'

// Lucide icons used directly in this component
import {
  Crown, Trophy, Calendar, Flame, Award, Users, Star, ArrowRight, Play, SlidersHorizontal,
  Sword, Shield, Library, Gem, Target, Heart, Sparkles,
  Compass, Wrench,
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
  const t = useT()
  const gl = useGenreLabel()
  const { navigateTo, handleGameClick, playSound, toggleFavorite, handleApplyFix, handleInstallGame } = handlers

  // ── Skeleton visible for at least 200ms to prevent flash ──
  const [showSkeleton, setShowSkeleton] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setShowSkeleton(false), 200)
    return () => clearTimeout(t)
  }, [])

  // Store selectors
  const { games, installedGames, fixes } = useGameStore(
    useShallow(s => ({ games: s.games, installedGames: s.installedGames, fixes: s.fixes }))
  )
  const setFixGamesModalOpen = useModalStore(s => s.setFixGamesModalOpen)
  const accentColor = useSettingsStore(s => s.accentColor)

  // Derived data
  const { featuredGame, favorites, userStats, setFeaturedGame } = useUserStore(
    useShallow(s => ({
      featuredGame: s.featuredGame,
      favorites: s.favorites,
      userStats: s.userStats,
      setFeaturedGame: s.setFeaturedGame,
    }))
  )
  const trendingGames = useMemo(() => homeSections.popularGames!.slice(0, 10), [homeSections.popularGames])

  // Alias colors to COLORS so the extracted JSX works as-is
  const COLORS = colors

  // Shared components use a different Game type; cast at the boundary
  const onGameClick = useCallback((game: any) => handleGameClick(game as any), [handleGameClick])

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
      { id: 'rpg', section: 'RPG', title: 'app.rail.rpg' as TKey, icon: Shield, color: COLORS.blue, games: railMix(homeSections.rpgGames || []) },
      { id: 'indie', section: 'Indie', title: 'app.rail.indie' as TKey, icon: Gem, color: COLORS.violet, games: railMix(homeSections.indieGames || []) },
      { id: 'mp', section: 'Multiplayer', title: 'app.rail.multiplayer' as TKey, icon: Users, color: COLORS.green, games: railMix(homeSections.multiplayerGames || []) },
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

  // First fix whose game is in the loaded catalogue (fixes ~500, games 65k+: one Map + one pass, memoized)
  const newFix = useMemo(() => {
    if (!fixes.length || !games.length) return null
    const byId = new Map<string, number>()
    fixes.forEach((f, i) => { if (!byId.has(f.appid) && (f.download_url || f.download_urls?.length)) byId.set(f.appid, i) })
    let best: { i: number; game: Game } | null = null
    for (const g of games as Game[]) {
      const i = byId.get(g.appid)
      if (i !== undefined && (!best || i < best.i)) { best = { i, game: g }; if (i === 0) break }
    }
    return best ? { fix: fixes[best.i] as unknown as Fix, game: best.game } : null
  }, [fixes, games])

  const installedIds = useMemo(() => new Set(installedGames.map(g => g.appid)), [installedGames])
  const isFavorite = useCallback((id: string) => favorites.has(id), [favorites])
  const isInstalled = useCallback((id: string) => installedIds.has(id), [installedIds])
  const onInstall = useCallback((g: Game) => { useGameStore.getState().setSelectedGame(g as any); void (handleInstallGame as (g?: Game) => Promise<void>)(g) }, [handleInstallGame])
  const catalogue = games.length >= 1000 ? `${Math.floor(games.length / 1000)}K+` : String(games.length)

  // Remember a few covers for the next boot's splash wall (read in index.html)
  useEffect(() => {
    const ids = homeSections.aaaGames?.slice(0, 12).map(g => g.appid)
    if (ids?.length) { try { localStorage.setItem('ahg.splashCovers', JSON.stringify(ids)) } catch { /* ignore */ } }
  }, [homeSections.aaaGames])

  const section = 'flex flex-col'
  const filters = ['All', 'AAA', 'Action', 'RPG', 'Strategy', 'Multiplayer', 'Indie', 'Casual']

  return (
    <div className="relative" style={{ padding: '24px 24px 56px', width: '100%', maxWidth: 1680, margin: '0 auto' }}>
      {/* Content with opacity transition — always mounted, skeleton overlays */}
      <div
        className={`transition-opacity duration-200 ${showSkeleton ? 'opacity-0' : 'opacity-100'}`}
        style={{ transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)' }}
      >
        {/* Section filter style — hides sections that don't match active filter */}
        {activeFilter !== 'All' && (
          <style>{`
            [data-section]:not([data-section="${activeFilter}"]):not([data-section="All"]) {
              display: none !important;
            }
          `}</style>
        )}

        <div className={`${section} gap-[34px]`}>
          {/* ── Hero + side column (quick access, stats) ── */}
          <HeroSection
            featuredGame={featuredGame}
            accentColor={accentColor}
            COLORS={COLORS}
            onGameClick={onGameClick}
            navigateTo={navigateTo}
            playSound={playSound}
            games={homeSections.aaaGames!}
            setFeaturedGame={setFeaturedGame}
            isLoaded={true}
            isFavorite={isFavorite}
            isInstalled={isInstalled}
            onToggleFavorite={toggleFavorite}
            onInstall={onInstall}
            sideExtra={
              <>
                {newFix && (
                  <NewFixCard fix={newFix.fix} game={newFix.game} onApply={handleApplyFix} onAllFixes={() => navigateTo('fixes')} onOpen={onGameClick} />
                )}
                <div className="v2-panel p-2.5 grid grid-cols-2 gap-2" style={{ animation: 'v2-riseIn .45s .12s both' }}>
                  <StatCard icon={Library} value={installedGames.length} label={t('app.home.inLibrary')} color={COLORS.violet} onClick={() => navigateTo('library')} />
                  <StatCard icon={Heart} value={favorites.size} label={t('app.nav.favourites')} color={COLORS.pink} onClick={() => navigateTo('favourites')} />
                  <StatCard icon={Wrench} value={userStats.fixesApplied} label={t('app.home.fixesApplied')} color={COLORS.amber} onClick={() => navigateTo('fixes')} />
                  <StatCard icon={Compass} value={catalogue} label={t('app.home.catalogue')} color={COLORS.green} onClick={() => navigateTo('browse')} />
                </div>
              </>
            }
          />

          {/* ── Explore by genre ── */}
          <div data-section="All">
            <CategoriesShowcase onCategoryClick={() => navigateTo('browse')} colors={COLORS} games={games} />
          </div>

          {/* ── Jump back in (recent) ── */}
          {recentGamesList.length > 0 && (
            <section className="flex flex-col gap-4 v2-rise" data-section="All">
              <div className="flex items-baseline gap-3">
                <h2 className="m-0 text-[20px] font-semibold" style={{ letterSpacing: '-.02em', color: COLORS.text }}>{t('app.home.jumpBack')}</h2>
                <span className="text-[13px]" style={{ color: COLORS.textDim }}>{t('app.home.yourHistory')}</span>
                <span className="flex-1" />
                <button onClick={() => navigateTo('recent')} className="border-0 bg-transparent cursor-pointer flex items-center gap-1 text-[13px] hover:text-white" style={{ color: COLORS.textMuted, transition: 'color .15s' }}>
                  {t('app.home.viewHistory')} <ArrowRight size={14} className="rtl-flip" />
                </button>
              </div>
              <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))' }}>
                {recentGamesList.slice(0, 4).map((g, i) => (
                  <div key={g.appid} onClick={() => onGameClick(g)}
                    className="v2-lift relative overflow-hidden cursor-pointer rounded-[18px]"
                    style={{ aspectRatio: '460/215', background: '#10101c', border: '1px solid rgba(255,255,255,.07)', animation: `v2-riseIn .4s ${i * 0.06}s var(--ease-out) both` }}>
                    <img src={g.header_image || getSteamImage(g.appid)} alt="" loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover" onError={e => { e.currentTarget.style.visibility = 'hidden' }} />
                    <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(0deg, rgba(6,6,12,.92) 0%, rgba(6,6,12,.2) 60%)' }} />
                    <div className="absolute start-4 end-4 bottom-3.5 flex items-end gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-[15px] font-semibold truncate" style={{ color: COLORS.text }}>{g.name}</div>
                        <div className="mono text-[11px] mt-[3px]" style={{ color: COLORS.textMuted }}>{t('app.home.recentlyViewed')}</div>
                      </div>
                      <button aria-label={t('app.home.openNamed', { name: g.name ?? '' })} onClick={e => { e.stopPropagation(); onGameClick(g) }}
                        className="w-[42px] h-[42px] flex-none rounded-full border-0 cursor-pointer flex items-center justify-center hover:scale-110"
                        style={{ background: 'var(--acc)', color: '#0b0614', boxShadow: '0 8px 24px -6px var(--acc)', transition: 'transform .2s cubic-bezier(.34,1.56,.64,1)' }}>
                        <Play size={17} className="fill-current ms-0.5 rtl-flip" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Trending Now — ranked poster rail (Top 10 look) ── */}
          <div data-section="All">
            <PosterRail title={t('app.home.trending')} subtitle={t('app.home.trendingSub')} icon={Flame} color="#f97316" games={trendingGames} ranked onGameClick={onGameClick} onSeeAll={() => navigateTo('browse')} colors={COLORS} />
          </div>

          {/* ── Discover — search + genre filter chips ── */}
          <section className="v2-panel p-5 flex flex-col gap-4 v2-rise" data-section="All">
            <SectionHeader icon={SlidersHorizontal} color="var(--acc)" title={t('app.home.discover')} sub={activeFilter === 'All' ? t('app.home.everything') : gl(activeFilter)} />
            <div className="flex">
              <SearchBar onSearch={handleSearch} accentColor={accentColor} colors={COLORS} />
            </div>
            <div className="flex flex-col gap-[7px]">
              <span className="mono text-[10px]" style={{ letterSpacing: '.14em', color: '#77768e' }}>{t('app.home.genre')}</span>
              <div className="flex gap-0.5 p-[3px] rounded-[11px] overflow-x-auto scrollbar-none self-start max-w-full" style={{ background: 'rgba(0,0,0,.28)', border: '1px solid rgba(255,255,255,.06)' }}>
                {filters.map(filter => {
                  const on = activeFilter === filter
                  return (
                    <button
                      key={filter}
                      onClick={() => setActiveFilter(filter)}
                      className="h-7 px-[11px] border-0 rounded-lg text-[12.5px] font-semibold whitespace-nowrap shrink-0 cursor-pointer hover:text-white"
                      style={{
                        background: on ? 'var(--acc)' : 'transparent',
                        color: on ? '#0b0614' : COLORS.textMuted,
                        boxShadow: on ? '0 4px 14px -4px var(--acc)' : 'none',
                        transition: 'all .18s',
                      }}
                    >
                      {gl(filter)}
                    </button>
                  )
                })}
              </div>
            </div>
          </section>

          {/* ── Spotlight Feature — wide cinematic opener ── */}
          <LazySection rootMargin="200px" minHeight={320}>
            <div data-section="All">
              <SpotlightFeature game={picks.spotlight} label={t('app.home.spotlight')} onGameClick={onGameClick} colors={COLORS} />
            </div>
          </LazySection>

          {/* ── AAA Showcase ── */}
          <LazySection rootMargin="200px" minHeight={300}>
            {homeSections.aaaGames!.length > 0 && (
              <div data-section="AAA">
                <BentoCard title={t('app.home.aaa')} icon={Crown} color={COLORS.amber} games={homeSections.aaaGames!.slice(0, 12)} layout="large" onGameClick={onGameClick} onSeeAll={() => navigateTo('browse')} colors={COLORS} />
              </div>
            )}
          </LazySection>

          {/* ── Must Play — poster rail (ranked) ── */}
          <LazySection rootMargin="150px" minHeight={340}>
            <div data-section="All">
              <PosterRail title={t('app.home.mustPlay')} subtitle={t('app.home.mustPlaySub')} icon={Star} color={COLORS.amber} games={picks.mustPlay} ranked onGameClick={onGameClick} onSeeAll={() => navigateTo('browse')} colors={COLORS} />
            </div>
          </LazySection>

          {/* ── Asymmetric mosaic ── */}
          <LazySection rootMargin="150px" minHeight={320}>
            <div data-section="All">
              <FeatureMosaic games={picks.mosaic} onGameClick={onGameClick} colors={COLORS} />
            </div>
          </LazySection>

          {/* ── Everything below ── */}
          <LazySection rootMargin="100px" minHeight={420}>
            <div className={`${section} gap-[34px]`}>
              {/* Top Sellers (large) + side column */}
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-12 lg:col-span-8" data-section="All">
                  <BentoCard title={t('app.home.topSellers')} icon={Trophy} color={COLORS.amber} games={homeSections.popularGames!.slice(0, 12)} layout="large" onGameClick={onGameClick} onSeeAll={() => navigateTo('browse')} colors={COLORS} />
                </div>
                <div className="col-span-12 lg:col-span-4 flex flex-col gap-4" data-section="All">
                  <QuickActionsCard colors={COLORS} installedCount={installedGames.length} favoritesCount={favorites.size} onDownloadFix={() => setFixGamesModalOpen(true)} onRefreshGames={() => {}} onMyLibrary={() => navigateTo('library')} onFavorites={() => navigateTo('favourites')} />
                  <BentoCard title={t('app.home.comingSoon')} icon={Calendar} color={COLORS.cyan} games={homeSections.popularGames!.slice(12, 20)} layout="compact" onGameClick={onGameClick} colors={COLORS} />
                </div>
              </div>

              {/* Action & Shooter — poster rail (ranked) */}
              <div data-section="Action">
                <PosterRail title={t('app.home.actionShooter')} subtitle={t('app.home.actionShooterSub')} icon={Sword} color={COLORS.red} games={picks.action} ranked onGameClick={onGameClick} onSeeAll={() => navigateTo('browse')} colors={COLORS} />
              </div>

              {/* Most Played (landscape rail) */}
              <div data-section="All">
                <GameSection title={t('app.home.mostPlayed')} icon={Flame} color={COLORS.amber} games={homeSections.popularGames!.slice(0, 20)} onGameClick={onGameClick} onSeeAll={() => navigateTo('browse')} colors={COLORS} />
              </div>

              {/* Two-column bentos */}
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-12 lg:col-span-6" data-section="All">
                  <BentoCard title={t('app.home.staffPicks')} icon={Award} color={COLORS.violet} games={homeSections.popularGames!.slice(20, 24)} layout="medium" onGameClick={onGameClick} onSeeAll={() => navigateTo('browse')} colors={COLORS} />
                </div>
                <div className="col-span-12 lg:col-span-6" data-section="Multiplayer">
                  <BentoCard title={t('app.home.multiplayerHits')} icon={Users} color={COLORS.green} games={homeSections.multiplayerGames!.slice(0, 6)} layout="medium" onGameClick={onGameClick} onSeeAll={() => navigateTo('browse')} colors={COLORS} />
                </div>
              </div>

              {/* Randomized genre rails (order shuffled per session) */}
              {picks.genreRails.map(rail => (
                <div key={rail.id} data-section={rail.section}>
                  <GenreRow title={t(rail.title)} icon={rail.icon} color={rail.color} games={rail.games} onGameClick={onGameClick} colors={COLORS} />
                </div>
              ))}

              {/* Second spotlight — rhythm break */}
              {picks.spotlight2 && (
                <div data-section="All">
                  <SpotlightFeature game={picks.spotlight2} label={t('app.home.editorsChoice')} onGameClick={onGameClick} colors={COLORS} />
                </div>
              )}

              {/* AI Recommendations */}
              {aiRecommendations.length > 0 && (
                <section className="v2-panel p-5 flex flex-col gap-4 v2-rise" data-section="All">
                  <SectionHeader icon={Sparkles} color="#f472b6" title={t('app.home.aiPicks')} sub={t('app.home.aiPicksSub')} />
                  <AIRecommendationsCard games={aiRecommendations} onGameClick={onGameClick} colors={COLORS} />
                </section>
              )}

              {/* Best of the Best — poster rail (ranked) */}
              <div data-section="All">
                <PosterRail title={t('app.home.bestOf')} subtitle={t('app.home.bestOfSub')} icon={Trophy} color={COLORS.violet} games={picks.bestOf} ranked onGameClick={onGameClick} onSeeAll={() => navigateTo('browse')} colors={COLORS} />
              </div>

              {/* Two-column bentos 2 */}
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-12 lg:col-span-6" data-section="Strategy">
                  <BentoCard title={t('app.home.strategyMasters')} icon={Target} color={COLORS.cyan} games={homeSections.popularGames!.slice(24, 28)} layout="medium" onGameClick={onGameClick} onSeeAll={() => navigateTo('browse')} colors={COLORS} />
                </div>
                <div className="col-span-12 lg:col-span-6" data-section="Indie">
                  <BentoCard title={t('app.rail.indie')} icon={Gem} color={COLORS.amber} games={homeSections.indieGames!.slice(0, 4).length >= 4 ? homeSections.indieGames!.slice(0, 4) : homeSections.popularGames!.slice(28, 32)} layout="medium" onGameClick={onGameClick} onSeeAll={() => navigateTo('browse')} colors={COLORS} />
                </div>
              </div>

              {/* Bottom Actions */}
              <div data-section="All">
                <BottomActionsCard onBrowse={() => navigateTo('browse')} onLibrary={() => navigateTo('library')} onFavorites={() => navigateTo('favourites')} onSettings={() => navigateTo('settings')} colors={COLORS} />
              </div>
            </div>
          </LazySection>
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
