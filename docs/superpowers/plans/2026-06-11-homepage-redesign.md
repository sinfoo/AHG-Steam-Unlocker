# Homepage Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use agent to execute this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract HeroSection, redesign with mouse-tracked spotlight + backdrop-blur, polish content sections with consistent glass containers and CSS entrance animations.

**Architecture:** Extract ~200 lines of hero JSX from HomePage.tsx into a dedicated HeroSection component. Redesign the hero with cleaner DOM (backdrop-blur replaces 5 gradient divs), mouse-tracked spotlight overlay, and polished quick-access panel. Apply uniform glass containers to content sections below with CSS-only entrance animations.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, CSS @keyframes (no new framer-motion for sections), Zustand for the spotlight position state (local component state).

---

### Task 1: Create HeroSection component

**Files:**
- Create: `src/components/HeroSection.tsx`

- [ ] **Step 1: Create HeroSection.tsx with props interface, loading/empty states, and mouse-tracked spotlight**

```tsx
import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Game } from '../types'
import { loadGameImage } from '../services/imageCache'
import { Star, Shield, CheckCircle2, Play, LayoutGrid, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react'

interface HeroSectionProps {
  featuredGame: Game | null
  accentColor: string
  COLORS: Record<string, string>
  onGameClick: (game: Game) => void
  navigateTo: (page: string) => void
  playSound: (type: string) => void
  games: Game[]
  setFeaturedGame: (game: any) => void
  quickAccessOffset: number
  setQuickAccessOffset: (v: number) => void
  totalAAA: number
  quickGameImgs: Record<string, string | null>
  isLoaded: boolean
}

export default function HeroSection({
  featuredGame, accentColor, COLORS, onGameClick, navigateTo, playSound,
  games, setFeaturedGame, quickAccessOffset, setQuickAccessOffset,
  totalAAA, quickGameImgs, isLoaded,
}: HeroSectionProps) {
  // ── Mouse spotlight position ──
  const [spotlight, setSpotlight] = useState({ x: 50, y: 50 })

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setSpotlight({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    })
  }, [])

  // ── Image loading ──
  const [featuredImgUrl, setFeaturedImgUrl] = useState<string | null>(null)
  useEffect(() => {
    let mounted = true
    if (featuredGame?.appid) {
      loadGameImage(featuredGame.appid, featuredGame.header_image || undefined, featuredGame.name || undefined)
        .then(url => { if (mounted) setFeaturedImgUrl(url) })
        .catch(() => {})
    }
    return () => { mounted = false }
  }, [featuredGame?.appid, featuredGame?.header_image, featuredGame?.name])

  // ── Not loaded yet: skeleton ──
  if (!isLoaded) {
    return (
      <div className="relative w-full h-[70vh] min-h-[500px] rounded-2xl overflow-hidden bg-[#0c0c18] animate-pulse">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 to-transparent" />
        <div className="absolute bottom-0 left-0 p-8 lg:p-12 space-y-4 w-full">
          <div className="h-8 w-24 rounded-full bg-[#1a1a24]" />
          <div className="h-12 w-3/4 rounded-lg bg-[#1a1a24]" />
          <div className="h-6 w-1/2 rounded-lg bg-[#1a1a24]" />
          <div className="flex gap-4">
            <div className="h-14 w-36 rounded-2xl bg-[#1a1a24]" />
            <div className="h-14 w-36 rounded-2xl bg-[#1a1a24]" />
          </div>
        </div>
      </div>
    )
  }

  // ── Empty / no featured game ──
  if (!featuredGame) {
    return (
      <div className="relative w-full h-[60vh] min-h-[400px] rounded-2xl overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${COLORS.bgDeep} 0%, ${COLORS.bgMid} 100%)` }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-5xl lg:text-6xl font-bold mb-4" style={{ color: COLORS.text }}>
              Welcome to AHG
            </h2>
            <p className="text-lg" style={{ color: COLORS.textSecondary }}>
              Your ultimate Steam game unlocker
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── Compute quick access games ──
  const displayedGames = totalAAA > 0
    ? [...Array(4)].map((_, i) => {
        const idx = (quickAccessOffset + i) % totalAAA
        return { game: games.filter(g => g.header_image)[idx]!, index: idx }
      }).filter(x => x.game)
    : []

  return (
    <div
      className="hero-parallax-container relative w-full h-[70vh] min-h-[520px] rounded-2xl overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseEnter={() => {}}
      onMouseLeave={() => setSpotlight({ x: 50, y: 50 })}
    >
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-opacity duration-500"
        style={{ backgroundImage: featuredImgUrl ? `url(${featuredImgUrl})` : undefined }}
      >
        {!featuredImgUrl && (
          <div className="absolute inset-0" style={{
            background: `linear-gradient(135deg, ${COLORS.violet}30 0%, ${COLORS.bgDeep} 100%)`,
          }} />
        )}
      </div>

      {/* Animated grid overlay */}
      <div className="hero-grid-bg absolute inset-0" />

      {/* Mouse-tracked spotlight — radial gradient follows cursor */}
      <div
        className="absolute inset-0 transition-[background] duration-80 pointer-events-none"
        style={{
          background: `radial-gradient(600px circle at ${spotlight.x}% ${spotlight.y}%, rgba(139,92,246,0.08) 0%, transparent 70%)`,
        }}
      />

      {/* Single backdrop-blur panel replaces 5 gradient divs */}
      <div className="absolute left-0 top-0 bottom-0 w-[55%] max-w-2xl">
        <div className="absolute inset-0 backdrop-blur-sm" style={{ backgroundColor: `${COLORS.bgDeep}60` }} />
        <div className="absolute inset-0 bg-gradient-to-r from-black/40 to-transparent pointer-events-none" />
      </div>

      {/* Content */}
      <div className="relative z-10 h-full flex">
        {/* Left: featured game info */}
        <div className="flex-1 flex flex-col justify-end p-8 lg:p-12">
          {/* Tags */}
          <div className="flex items-center gap-3 mb-4">
            <span
              className="px-4 py-1.5 rounded-full text-sm font-bold flex items-center gap-2"
              style={{
                background: `linear-gradient(135deg, ${COLORS[accentColor as keyof typeof COLORS]} 0%, ${COLORS[accentColor as keyof typeof COLORS]}99 100%)`,
                color: COLORS.white,
                boxShadow: `0 4px 20px ${COLORS[accentColor as keyof typeof COLORS]}50`,
              }}
            >
              <Star size={14} className="fill-white" />
              Featured
            </span>
            {featuredGame?.drm && (
              <span className="px-3 py-1.5 rounded-full text-xs font-bold"
                style={{ background: `${COLORS.amber}30`, color: COLORS.amber }}
              >
                <Shield size={12} className="inline mr-1" />
                DRM
              </span>
            )}
            <span className="px-3 py-1.5 rounded-full text-xs font-bold"
              style={{ background: `${COLORS.green}20`, color: COLORS.green }}
            >
              <CheckCircle2 size={12} className="inline mr-1" />
              Free to Play
            </span>
          </div>

          {/* Title */}
          <h2
            className="text-5xl lg:text-6xl font-bold mb-3 max-w-3xl leading-tight"
            style={{ color: COLORS.text, textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}
          >
            {featuredGame.name}
          </h2>

          {/* Description */}
          <p className="text-base max-w-xl mb-8 line-clamp-2" style={{ color: COLORS.textSecondary }}>
            {featuredGame.short_description || 'Your ultimate Steam game unlocker with 170,000+ games.'}
          </p>

          {/* Actions */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => onGameClick(featuredGame)}
              className="cta-primary px-10 py-4 rounded-2xl font-bold flex items-center gap-3 text-lg relative overflow-hidden hv-tap"
              style={{
                '--play-shadow': `0 0 50px ${COLORS[accentColor as keyof typeof COLORS]}80`,
                background: `linear-gradient(135deg, ${COLORS[accentColor as keyof typeof COLORS]} 0%, ${COLORS[accentColor as keyof typeof COLORS]}cc 100%)`,
                color: COLORS.white,
              } as React.CSSProperties}
            >
              <div className="absolute inset-0 rounded-2xl animate-[pulseGlow_2s_ease-in-out_infinite]"
                style={{ boxShadow: `0 0 30px ${COLORS[accentColor as keyof typeof COLORS]}60, 0 0 60px ${COLORS[accentColor as keyof typeof COLORS]}30` }}
              />
              <Play size={20} />
              Play Now
            </button>

            <button
              onClick={() => navigateTo('browse')}
              className="cta-secondary px-8 py-4 rounded-2xl font-bold flex items-center gap-2.5 text-lg relative overflow-hidden hv-tap"
              style={{
                background: `${COLORS.bgCard}cc`,
                backdropFilter: 'blur(12px)',
                border: `1px solid ${COLORS.violet}30`,
                color: COLORS.text,
              }}
            >
              <div className="absolute inset-0 rounded-2xl" style={{
                background: `linear-gradient(135deg, ${COLORS.violet}08 0%, transparent 50%)`,
              }} />
              <LayoutGrid size={20} />
              <span className="relative z-10">Browse All</span>
            </button>

            <button
              onClick={() => {
                const r = games[Math.floor(Math.random() * games.length)]
                setFeaturedGame(r as any)
                playSound('success')
              }}
              className="cta-shuffle w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, #fbbf24 0%, ${COLORS.amber} 100%)`,
                boxShadow: '0 4px 20px rgba(251, 191, 36, 0.4)',
              }}
            >
              <Sparkles size={20} className="text-white" />
            </button>
          </div>
        </div>

        {/* Right: Quick Access panel */}
        <div className="hidden lg:flex flex-col justify-center pr-8 w-[340px]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold" style={{ color: COLORS.text }}>Quick Access</span>
            <div className="flex gap-1">
              <button
                onClick={() => {
                  setQuickAccessOffset((quickAccessOffset - 1 + totalAAA) % Math.max(totalAAA, 1))
                  playSound('click')
                }}
                className="w-8 h-8 rounded-lg flex items-center justify-center hv-tap"
                style={{ background: COLORS.bgHover, color: COLORS.textMuted }}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => {
                  setQuickAccessOffset((quickAccessOffset + 1) % Math.max(totalAAA, 1))
                  playSound('click')
                }}
                className="w-8 h-8 rounded-lg flex items-center justify-center hv-tap"
                style={{ background: COLORS.bgHover, color: COLORS.textMuted }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {displayedGames.map(({ game }, i) => (
              <button
                key={game.appid + '-' + i}
                onClick={() => onGameClick(game)}
                className="group relative aspect-[3/4] rounded-xl overflow-hidden hv-tap"
                style={{
                  border: `1px solid ${COLORS.border}`,
                  transition: 'border-color 0.08s cubic-bezier(0.4,0,0.2,1)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = COLORS.violet
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = COLORS.border
                }}
              >
                {quickGameImgs[game.appid] ? (
                  <img
                    src={quickGameImgs[game.appid]!}
                    alt={game.name}
                    className="w-full h-full object-cover transition-transform duration-80 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center" style={{ background: COLORS.bgCard }}>
                    <span className="text-xs text-center px-1 line-clamp-2" style={{ color: COLORS.textMuted }}>
                      {game.name}
                    </span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify the component compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors (may have unrelated pre-existing errors only)

### Task 2: Create HomePageSkeleton component

**Files:**
- Create: `src/components/HomePageSkeleton.tsx`

- [ ] **Step 1: Create skeleton component**

```tsx
import React from 'react'
import { motion } from 'framer-motion'

export default function HomePageSkeleton() {
  return (
    <motion.div
      key="home-skeleton"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      {/* Hero skeleton */}
      <div className="relative w-full h-[70vh] min-h-[500px] rounded-2xl overflow-hidden bg-[#0c0c18] animate-pulse mb-8">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent" />
        <div className="absolute bottom-0 left-0 p-8 lg:p-12 space-y-4 w-full">
          <div className="h-8 w-24 rounded-full bg-[#1a1a24]" />
          <div className="h-12 w-3/4 rounded-lg bg-[#1a1a24]" />
          <div className="h-6 w-1/2 rounded-lg bg-[#1a1a24]" />
          <div className="flex gap-4">
            <div className="h-14 w-36 rounded-2xl bg-[#1a1a24]" />
            <div className="h-14 w-36 rounded-2xl bg-[#1a1a24]" />
          </div>
        </div>
      </div>

      {/* Section skeleton (x3) */}
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-[#0c0c18]/80 rounded-2xl p-4 mb-6 animate-pulse">
          <div className="flex items-center justify-between mb-4">
            <div className="h-5 w-36 rounded bg-[#1a1a24]" />
            <div className="h-4 w-16 rounded bg-[#1a1a24]" />
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, j) => (
              <div key={j} className="aspect-[3/4] rounded-xl bg-[#1a1a24]" />
            ))}
          </div>
        </div>
      ))}
    </motion.div>
  )
}
```

- [ ] **Step 2: Verify no new tsc errors**

Run: `npx tsc --noEmit`
Expected: 0 new errors

### Task 3: Modify HomePage.tsx — wire HeroSection + simplify sections

**Files:**
- Modify: `src/pages/HomePage.tsx`

- [ ] **Step 1: Add imports at top of HomePage.tsx**

Add after existing imports:
```tsx
import HeroSection from '../components/HeroSection'
import HomePageSkeleton from '../components/HomePageSkeleton'
```

Replace the old SkeletonBentoGrid import with:
```tsx
// import { SkeletonBentoGrid } from '../components/Skeletons'  // REMOVED — replaced by HomePageSkeleton
```

- [ ] **Step 2: Replace hero JSX + skeleton JSX with new components**

In HomePage.tsx, find the `if (showSkeleton)` block and replace:
```tsx
// OLD:
if (showSkeleton) {
  // ... long skeleton JSX
}
```
```tsx
// NEW:
if (showSkeleton) {
  return <HomePageSkeleton />
}
```

Find the entire hero section (from `{/* Hero - Cinematic Showcase */}` down to the closing `</div>` before the first content section) and replace with:
```tsx
{/* Hero Section (extracted) */}
<HeroSection
  featuredGame={featuredGame}
  accentColor={accentColor}
  COLORS={COLORS}
  onGameClick={onGameClick}
  navigateTo={navigateTo}
  playSound={playSound}
  games={games}
  setFeaturedGame={setFeaturedGame}
  quickAccessOffset={quickAccessOffset}
  setQuickAccessOffset={setQuickAccessOffset}
  totalAAA={homeSections.aaaGames.length}
  quickGameImgs={quickGameImgs}
  isLoaded={!showSkeleton}
/>
```

- [ ] **Step 3: Wrap content sections in consistent glass container pattern**

Find each section map (popularGames, aaaGames, allF2PGames, etc.) and wrap in:
```tsx
<div className="bg-[#0c0c18]/80 rounded-2xl border-t border-violet-500/10 p-4 mb-6"
  style={{ viewTransitionName: 'section-' + i }}
>
  <div className="flex items-center justify-between mb-3">
    <h3 className="text-[#f8fafc] font-semibold flex items-center gap-2">
      <icon size={18} /> Section Title
    </h3>
    <button
      onClick={() => navigateTo('browse')}
      className="text-[#94a3b8] text-sm hover:text-[#f8fafc] transition-colors duration-80"
    >
      See All →
    </button>
  </div>
  <div className="content-row">
    {games.map(...)}
  </div>
</div>
```

Apply this pattern to each section:
- **Trending Now** — uses `🔥` icon, `homeSections.popularGames` slice 0-10, horizontal scroll row
- **AAA Games** — uses `💎` icon, `homeSections.aaaGames`, horizontal scroll
- **Free to Play** — uses `🎮` icon, `homeSections.allF2PGames`, horizontal scroll
- **New Releases** — uses `🆕` icon (or `Calendar` lucide icon), `homeSections.newReleases`, horizontal scroll
- **Categories** — uses `📂` icon (or `FolderHeart` lucide icon), keep existing CategoriesShowcase behavior
- **AI Recommendations** — uses `Sparkles` lucide icon, keep existing AIRecommendationsCard area

Each existing sub-component (GameSection, CategoriesShowcase, AIRecommendationsCard, GenreRow) stays as-is. The only change is wrapping each in the glass container div with header row. The existing child component renders inside the content area.

- [ ] **Step 4: Remove now-unused imports from HomePage.tsx**

Remove:
- `Crown, Trophy, Calendar, Flame, Award, Users, Star, Clock, Sword, Shield, TrendingUp, Gem, Target, FolderHeart, Heart, History, Gamepad2, Settings` — any lucide icons only used by the removed hero section
- `loadGameImage` — now lives in HeroSection
- Hero-related `useState` and `useEffect` hooks that moved to HeroSection

- [ ] **Step 5: Verify tsc passes**

Run: `npx tsc --noEmit`
Expected: 0 errors

### Task 4: Add CSS entrance animations

**Files:**
- Modify: `src/styles/home-animations.css`

- [ ] **Step 1: Add section entrance @keyframes**

Append to `home-animations.css`:
```css
/* Section entrance — fades up on scroll */
@keyframes fadeUp {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.section-entrance {
  animation: fadeUp 0.4s ease-out both;
}

.section-entrance:nth-child(1) { animation-delay: 0.05s; }
.section-entrance:nth-child(2) { animation-delay: 0.1s; }
.section-entrance:nth-child(3) { animation-delay: 0.15s; }
.section-entrance:nth-child(4) { animation-delay: 0.2s; }
.section-entrance:nth-child(5) { animation-delay: 0.25s; }
.section-entrance:nth-child(6) { animation-delay: 0.3s; }
```

- [ ] **Step 2: Apply `section-entrance` class to each section container**

In HomePage.tsx, add `section-entrance` class to each section wrapper div.

### Task 5: Remove unused imports + inline styles

**Files:**
- Modify: `src/pages/HomePage.tsx`

- [ ] **Step 1: Clean up unused imports from the old hero**

Remove any remaining lucide icon imports that are no longer referenced. Keep only: `Play, LayoutGrid, Sparkles, RefreshCw, Plus, CheckCircle2, Wrench, HardDrive, Calendar, Flame, Award, Gem, Heart, History, Gamepad2` — actually, let the compiler guide: after Task 3, run `npx tsc --noEmit` and remove any "unused import" warnings.

- [ ] **Step 2: Add `content-visibility: auto` to section containers**

In the section wrapper className, add:
```
content-visibility: auto
```

This tells the browser to skip painting below-fold sections until they're near the viewport.

### Task 6: Final verification

- [ ] **Step 1: Full TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2: Full build**

Run: `npm run build`
Expected: 0 new errors, built successfully

- [ ] **Step 3: Quick visual verification checklist**
- Hero renders with featured game
- Mouse spotlight tracks movement
- Quick Access panel shows 4 games, arrows cycle through
- Skeleton shows during loading
- Empty state shows "Welcome to AHG" when no featured game
- Each content section has glass container + icon header + See All link
- Sections fade up on scroll entrance
- No layout shift during image loading
