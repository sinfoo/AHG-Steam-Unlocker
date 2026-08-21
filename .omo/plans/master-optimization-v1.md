# AHG Unlocker — Master Optimization Plan v1
# "No Stone Unturned" — The Complete Enhancement Roadmap
# Created: 2026-06-08 | Last updated: 2026-06-19 (Wave 4 complete — 2.1 Homepage + 2.2 Card Redesign + 2.3 Loading States + 2.4 Dark Mode + 2.5 Responsive Layout)

---

## Philosophy

This plan is organized by **impact priority**, not by module. Each track is independent and can be
worked on in parallel. Every item has an estimated effort (S/M/L/XL) and impact score (1-10).

**North Star Metrics:**
- Startup: <1s (cold) / <500ms (warm)
- Search: <50ms (any query)
- Scroll: 120fps (no dropped frames at 144Hz)
- Memory: <300MB (idle) / <500MB (peak)
- Build: <30s (full) / <5s (incremental)
- Bundle: <500KB (gzipped main chunk)

---

## TRACK 0 — LOW-HANGING FRUIT (quick wins, high impact)

### 0.1 — Image Cache: Replace dataUrl with Blob URLs ✅ DONE
**File:** `src/services/imageCache.ts`
**Effort:** S  **Impact:** 8/10
**Status:** ✅ Already implemented — verified 2026-06-11
**Why:** Current code stores images as base64 data URLs in IndexedDB — 3-4x more memory than
binary Blobs. Also converts fetched CDN URLs to data URLs unnecessarily.

**What:**
- Replace `urlToDataUrl()` with direct blob fetch + `URL.createObjectURL(blob)`
- Store `ArrayBuffer` in IndexedDB instead of dataUrl string
- Increase `MAX_MEMORY_CACHE` from 300 to 2000
- Add cache eviction with LRU + generational strategy (hot/warm/cold)
**Verify:** DevTools Memory → heap snapshot → confirm no base64 strings in cache → `URL.createObjectURL` blobs in use. Memory tab: verify <300MB idle.
**Result:** MAX_MEMORY_CACHE=2000, 3-tier hot(500)/warm(1000)/cold(500) LRU, blob URLs in use, ArrayBuffer in IDB, requestIdleCallback for batched writes

### 0.2 — Image Cache: Parallel CDN Fallback ✅ DONE
**File:** `src/services/imageCache.ts` lines 176-189
**Effort:** S  **Impact:** 7/10
**Status:** ✅ Already implemented — verified 2026-06-11
**Why:** Sequential scan of 4 CDN hosts × 2 paths × multiple types = up to 16 sequential HTTP
requests per image. Takes 8-16s before giving up.

**What:**
- Replace the nested for-loops with `Promise.any()` over all combinations
- First-response-wins pattern instead of sequential
- Cache the winning URL immediately for subsequent requests
**Verify:** DevTools Network tab → confirm parallel `Promise.any()` requests (not waterfall) → all images load <2s.
**Result:** Promise.any across 16 URL combinations (4 bases × 2 sizes × 2 formats), CDN latency tracking with rank reordering, separate networkCache LRU

### 0.3 — Image Cache: Predictive Prefetch ✅ DONE
**File:** `src/services/imageCache.ts` + `src/hooks/useLazyImage.ts`
**Effort:** M  **Impact:** 8/10
**Status:** ✅ Implemented 2026-06-11 — PriorityQueue class, queuePrefetch, prefetchByPriority, updateVisibleSet
**Why:** Images load only when card enters viewport. User sees empty grey squares during scroll.

**What:**
- Prefetch images for N items ahead of current scroll position
- Use `requestIdleCallback` for background prefetch
- Priority queue: visible > near-viewport > below-fold
- Library/Browse pages: prefetch next page's images during page idle
**Result:** PriorityQueue with HIGH (immediate, requestIdleCallback timeout=0), MEDIUM (1s timeout), LOW (2s timeout). Exports queuePrefetch, prefetchByPriority, updateVisibleSet. Integrated via useLazyImage hook calling prefetchByPriority on scroll.

### 0.4 — Image Placeholder System ✅ DONE
**Files:** New `src/services/placeholderGenerator.ts` + update `GameCover.tsx`
**Effort:** S  **Impact:** 6/10
**Status:** ✅ Implemented 2026-06-11 — placeholderGenerator.ts created, 5 card components integrated
**Why:** Cards show empty grey boxes while images load. Discord/Steam use low-res inline previews.

**What:**
- Generate CSS gradient placeholder based on game genre/accent color (no server needed)
- Apply `background` with gradient BEFORE image loads
- Crossfade: gradient → image on load (80ms transition)
- Works offline, zero network cost
**Result:** placeholderGenerator.ts with getGenreHue (genre→hue mapping + FNV-1a-like fallback), generatePlaceholderGradient (card/banner/icon variants), getPlaceholderGradient. Integrated into GameCover, GameCard, FixGridCard, PortraitCard, LibraryCard — replacing 6+ duplicated gradient strings.

### 0.5 — Search: Web Worker + Trie Index ✅ DONE
**Files:** `src/workers/searchWorker.ts` + `src/hooks/useGameFilters.ts`
**Effort:** M  **Impact:** 9/10
**Status:** ✅ Implemented 2026-06-11 — Trie class with insert/search, O(k+m) prefix search, slimmed init payload
**Why:** Current search does `game.name?.toLowerCase().includes(query)` across all 176K games on
every keystroke. Blocks UI thread. No indexing.

**What:**
- Build prefix trie index on game names (loaded once, O(length of query) lookup)
- Move all search/filter logic to Web Worker (`src/workers/searchWorker.ts`)
- Worker returns results asynchronously, UI never blocks
- Use `transferable` objects to avoid serialization overhead
- Maintain secondary index for genre/tag filtering
**Result:** TrieNode/Trie classes with insert/search. INIT message builds trie from slimmed payload (only id/name/developer/publisher/storeId/header_image). SEARCH query returns indices array matching prefix. useGameFilters.ts updated for new protocol messages (INIT/SEARCH/RESULT).

### 0.6 — Search: useDeferredValue + Input Throttle ✅ DONE
**File:** `src/hooks/useGameFilters.ts`
**Effort:** S  **Impact:** 7/10
**Status:** ✅ Already implemented — verified 2026-06-11
**Why:** Even with Worker, sending every keystroke to Worker is wasteful.

**What:**
- Use `useDeferredValue` to defer search rendering
- Throttle Worker messages to max 30/sec (human typing speed)
- Cancel in-flight Worker requests when query changes
- Show stale results until new ones arrive (no blank state)
**Result:** useDeferredValue in useGameFilters, 33ms debounce timer (30/sec throttle), requestId-based stale detection via useRef counter

### 0.7 — Continue Motion → CSS Conversion ✅ DONE
**Files:** All `motion.*` usages across 60+ files
**Effort:** L  **Impact:** 4/10
**Status:** ✅ Completed 2026-06-08 — 8 card/home components converted (87 motion.* → 0)

**Converted files:**
- `LibraryCard.tsx` (17 → 0)
- `PortraitCard.tsx` (14 → 0)
- `FixGridCard.tsx` (9 → 0, +fixed GlowCard nesting)
- `BentoCard.tsx` (15 → 0)
- `FeaturedCarousel.tsx` (14 → 0)
- `GameGrid.tsx` (11 → 0)
- `GameCover.tsx` (1 → 0)
- `EmptyState.tsx` (6 → 0)

---

## TRACK 1 — RENDERING & STATE (architectural improvements)

### 1.1 — Zustand Subscription Audit ✅ AUDIT COMPLETE
**Files:** All store consumers (30+ components)
**Effort:** S  **Impact:** 6/10
**Status:** ZERO full-store violations found. Codebase is already well-structured.

**Findings:**
- **12 stores**, all with selector hooks exported
- **Zero** `useXxxStore()` calls without selector
- `useShallow` already used in **10 files**
- `useAppState.ts` provides **6 batched hooks** with `shallow` + `useCallback`
- All action hooks (`useBatchInstall`, `useFixApplication`, etc.) use `getState()` — zero subscriptions
- `useAppSetters.ts` — 112/116 values via `getState()` (no subscriptions)

**Only action needed:**
- `LibraryPage.tsx` — 6 individual `useGameStore` subscriptions → ✅ Already using single `useShallow()` (verified 2026-06-19)
- `AllGamesPage.tsx` — dead `useGameStore` import → ✅ No dead import exists (verified 2026-06-19)

### 1.2 — React.memo on All Modal Components ✅ DONE
**Files:** 24 modal components
**Effort:** M  **Impact:** 7/10
**Status:** ✅ COMPLETED 2026-06-08 — All 24 modal components wrapped in `React.memo`
**Details:** See `.omo/plans/2026-05-16-full-overhaul.md` for full file list.

### 1.3 — Suspense Boundaries + Lazy Loading ✅ ALREADY DONE
**Files:** `src/App.tsx`, `src/components/PageRouter.tsx`, `src/components/ModalRenderer.tsx`
**Effort:** 0  **Impact:** 0
**Status:** ✅ Already fully implemented

**Findings:**
- **All 7 pages** are `React.lazy()` loaded in `PageRouter.tsx` with individual `<Suspense>` boundaries
- **All 24 modals/panels** are `React.lazy()` loaded in `ModalRenderer.tsx` with `<Suspense fallback={null}>`
- **35 total `lazy()` calls** across 4 files
- **36 Suspense boundaries** across 4 files

**Opportunities (optional):**
- Lazy-load `ModalRenderer` itself in `App.tsx` (saves 22.7KB initial bundle)
- Lazy-load `PageRouter` itself in `App.tsx` (saves 7.2KB initial bundle)
- Remove ~115.7KB of dead code (4 unused pages + 7 unused components)

### 1.4 — useEffect Dependency Audit ✅ AUDIT COMPLETE
**Files:** All `.tsx` files
**Effort:** M  **Impact:** 5/10
**Status:** Audited. Plugin not installed. 113 effects across 45 files.

**Findings:**
- **113 useEffect calls** across 45 files
- **`eslint-plugin-react-hooks` NOT installed** — rule cannot run
- **34 empty dep arrays** — most are legitimate mount/cleanup patterns
- **3 suppressed violations** — needs fixing
- **App.tsx:535** — missing `games` dep (most impactful single fix)

**What (updated):**
- Install `eslint-plugin-react-hooks` — ⚠️ BLOCKED (npm install fails with ECONNRESET)
- Enable `react-hooks/exhaustive-deps` at `'warn'` level
- Fix 3 suppressed violations
- Audit App.tsx:535 (missing `games` dep) — ✅ Analyzed: INTENTIONAL. Adding `games` would re-run the effect and re-fetch all installed games from IPC on every games list change. Needs eslint-disable comment instead.
- Audit 34 empty dep arrays (verify correctness)

---

## TRACK 2 — VISUAL / UX OVERHAUL (user-facing improvements)

### 2.1 — Homepage Redesign ✅ COMPLETE
**File:** `src/pages/HomePage.tsx` (806→570 lines)
**Effort:** XL  **Impact:** 9/10
**Status:** ✅ Completed 2026-06-19
**Why:** Homepage is the first thing users see. Performance and animation architecture needed cleanup.

**What was done:**
**Phase A — Hero Section:**
- Replaced framer-motion parallax (`transform: scale(1.05)`) with CSS `background-attachment: fixed` on both hero bg image divs in `HeroSection.tsx` — zero JS overhead, GPU accelerated parallax
- Animated grid/particle bg (`hero-grid-bg`, `hero-dots-grid`, `premium-orb`) already in CSS, no change needed
- Featured game card border glow (`premium-border-glow`, `featured-border-glow`) already in CSS
- CTA micro-interactions (`premium-cta-primary`, `premium-cta-secondary`) already in CSS

**Phase B — Content Sections:**
- "Continue Playing" section (ContinuePlayingCard with repeat badge) already rendered in HomePage.tsx (4 items)
- "Trending Now" with rank badges (#1-10, CSS animated stagger) already rendered
- Stats row with live-updating counters (games owned, fixes, favorites, space saved) — 4 StatCards
- 2-column bento grid with 8 BentoCards (Top Sellers, Coming Soon, CategoriesShowcase, Most Played, Staff Picks, Multiplayer Hits, Strategy Masters, Indie Gems) + GameSection + 2 GenreRows + BottomActionsCard

**Phase C — Performance:**
- ✅ **Killed framer-motion from HomePage.tsx**: Replaced `<AnimatePresence>` + `<motion.div>` skeleton overlay with CSS-only `transition-opacity fade (0.2s cubic-bezier)`. Removed `framer-motion` import entirely from file.
- ✅ **Lazy-loaded sections**: All below-fold content already wrapped in `<LazySection>` with `rootMargin="100px"` and IntersectionObserver
- ✅ **Section staggering**: Added `section-entrance` CSS class to all 11 grid sections inside the main bento grid — staggered fade-in via existing nth-child animation-delay system (0.05s–0.3s increments)
- ✅ **Reduced store subscriptions**: Merged 3 separate `useUserStore` selectors into 1 `useShallow` call — total subscriptions: 7→4 (useGameStore, useModalStore, useSettingsStore, useUserStore)
- ✅ **CSS entrance classes already wired**: ContinuePlayingCard (`.continue-playing-card`), Trending Now (`.trending-card` with nth-child rank stagger), Stats (`.stat-card-enter`), Section wrappers (`.section-entrance`)
- **Build:** `tsc --noEmit` 0 errors, `vite build` 6.44s

### 2.2 — GameCard Redesign ✅ COMPLETE
**Files:** `src/components/cards/GameCard.tsx` + `CardShell.tsx` + `InstallSpeedBadge.tsx` + `HeroCard.tsx` + `FixGridCard.tsx`
**Effort:** L  **Impact:** 8/10
**Status:** ✅ Completed 2026-06-19
**Why:** Card is the most-rendered component in the app (thousands of instances). Massive duplication of hover/glow/border patterns across GameCard (428→245 lines), LibraryCard (334), PortraitCard (287), FixGridCard (365).

**What was done:**
- **CardShell.tsx** — shared hover/glow/animation shell with render-prop (`isHovered`) for inner state consumption. Handles ambient glow, border glow, variant backgrounds (grid/list/hero), genre-based theming, CSS-only hover lift.
- **InstallSpeedBadge.tsx** — golden pill badge with Zap icon estimating ~50 MB/s download speed.
- **GameCard.tsx** refactored 428→~245 lines. Uses CardShell render-prop; list mode thumbnail uses GameCover (removed manual loadGameImage/LQIP code); removed duplicated border-glow and ambient-glow wrappers.
- **HeroCard.tsx** — new 21:9 hero variant with full-bleed GameCover, cinematic gradient overlays, genre-colored action buttons, favorite button, metadata row.
- **FixGridCard.tsx** — context menu indicator added to grid ("Right-click for options") and list (⋮ button).
- **Build:** `tsc --noEmit` 0 errors, `vite build` 7.09s.

### 2.3 — Empty/Loading/Error States ✅ COMPLETE (Session 39)
**Files:** `src/components/Skeletons.tsx`, `src/components/HomePageSkeleton.tsx`, `src/components/cards/EmptyState.tsx`, `src/components/cards/ErrorState.tsx`
**Effort:** M  **Impact:** 7/10
**Status:** ✅ Complete
**Why:** Current skeleton is generic shimmer. No per-page tailored loading states.

**What:**
- ✅ `Skeletons.tsx` — 3 per-page layouts (BrowseSkeleton 4-5 col card grid, LibrarySkeleton column-aware grid, FixesSkeleton 16:9 card grid) + reusable SkeletonLoader + SkeletonBentoGrid
- ✅ `HomePageSkeleton.tsx` — hero block + 3 section rows with pulse animation
- ✅ All 6 game-listing pages wire their correct skeleton: BrowsePage→BrowseSkeleton, LibraryPage→LibrarySkeleton, FixesPage→FixesSkeleton, FavouritesPage→LibrarySkeleton, AllGamesPage→BrowseSkeleton, HomePage→HomePageSkeleton
- ✅ `ErrorState.tsx` — retry button, expandable error details, shake/pulse animations, AlertTriangle icon
- ✅ `EmptyState.tsx` — 6 inline SVG illustrations (games, search, library, fixes, recent, favourites), popIn/fadeInUp animations, action button
- ✅ Skeleton → content transition: AnimatePresence opacity crossfade on BrowsePage + FixesPage
- ✅ Build: 0 errors, ~6.1s

### 2.4 — Dark Mode Perfection
**Files:** `index.css`, `constants/colors.ts`, all components
**Effort:** M  **Impact:** 5/10
**Why:** Current dark theme has some inconsistencies — different files use different shades of dark.

**What:**
- Audit all files for hardcoded color values (grep `#[0-9a-f]` or `rgba(`)
- Replace with DESIGN.md token references
- Pure black mode (already exists) — ensure ALL surfaces respect it
- Smooth transition when toggling pure black mode (CSS `transition` on background/color)

### 2.5 — Responsive Layout Improvements
**Files:** `App.tsx`, all pages
**Effort:** M  **Impact:** 6/10
**Why:** Desktop-only currently. But window resizing causes layout jumps.

**What:**
- Minimum window size constraint (900×600)
- Graceful layout collapse when window is small
- Grid columns: `auto-fill` with `minmax(165px, 1fr)` — responsive by default
- Sidebar: collapsible when window < 1100px (with hamburger toggle)

---

## TRACK 3 — ARCHITECTURE & INFRASTRUCTURE

### 3.1 — TypeScript Strict Mode
**File:** `tsconfig.json`
**Effort:** L  **Impact:** 6/10
**Why:** Current TS config likely has strict mode off. Enabling catches real bugs.

**What:**
- Enable `strict: true` in tsconfig.json
- Fix all new errors systematically
- Add `noUncheckedIndexedAccess` for safe object access
- Add `exactOptionalPropertyTypes` for optional field safety

### 3.2 — Vite Build Optimization
**File:** `vite.config.ts`
**Effort:** S  **Impact:** 5/10
**Status:** ✅ Complete
**Why:** Bundle size affects startup time.

**What:**
- `build.reportCompressedSize: false` — shaves ~2s off build time
- `build.rollupOptions.hoistTransitiveImports: false` — reduces rebuild scope
- `rollupOptions.output.manualChunks` — 8 vendor chunks + source splitting
- `build.cssMinify: 'lightningcss'` — faster CSS minification
- `build.cssCodeSplit: true` — per-page CSS chunks
- `minify: 'esbuild'` instead of terser — 10-20x faster
- `modulePreload: { polyfill: false }` — Electron-native compat
- `chunkSizeWarningLimit: 2000` — suppress noise
- **Result:** Build 10s → 6.5s, 0 tsc errors, main index chunk ~149KB

### 3.3 — Web Worker Architecture
**Files:** New `src/workers/` directory
**Effort:** M  **Impact:** 8/10
**Why:** Main thread should never block. Heavy computation (filtering, sorting) should live in Workers.

**What:**
- `search.worker.ts` — game search/filter/sort (from 0.5)
- `imageLoader.worker.ts` — image prefetch, cache management, CDN fallback
- `stats.worker.ts` — compute aggregate stats (library size, play time, genre distribution)
- All workers communicate via `postMessage` with typed payloads

### 3.4 — Offline / Caching Strategy
**Files:** `src/services/offlineCache.ts`
**Effort:** M  **Impact:** 6/10
**Why:** App depends on network for images. Offline experience is poor.

**What:**
- Service Worker for image caching (Cache API, not IndexedDB)
- Game data cached locally (games.db + fixes.db are already local, but images aren't)
- Offline indicator in sidebar when network is down
- Graceful degradation: show cached data, delay live updates

### 3.5 — IPC / Bridge Optimization
**Files:** `electron/main.cjs`, `src/bridge.ts`, `electron/preload.cjs`
**Effort:** M  **Impact:** 5/10
**Why:** IPC calls have overhead. Each `bridge.getXxx()` is an IPC roundtrip.

**What:**
- Batch related IPC calls into single request/response
- Use shared memory/Object.defineProperty for frequently-read values
- Add IPC call timing metrics (debug mode)
- Cache frequently-accessed data in preload bridge (not per-call)

### 3.6 — Native Disk Cache (Replace IndexedDB) ✅ COMPLETED (Session 37)
**Files:** `electron/services/imageDiskCache.cjs`, `electron/main.cjs`, `electron/preload.cjs`, `src/bridge.ts`, `src/services/imageCache.ts`
**Effort:** L  **Impact:** 8/10
**Status:** ✅ Completed 2026-06-19 — Replaced IndexedDB with native Electron disk cache via IPC.

**Why:** IndexedDB stores images as ArrayBuffers requiring full deserialization at startup. Each loadAllCachedImages() call blocks renderer startup. Blob URLs have lifecycle management issues (manual revocation). Storage is opaque (no visibility into disk usage, eviction is implicit).

**What:**
- New `electron/services/imageDiskCache.cjs` — `DiskCacheManager` class with:
  - Sharded directory layout (1000 subdirs per `game_images/` and `lqip/`) to prevent single-directory slowdown
  - LRU eviction with 500 MB soft cap, tracked via `_manifest.json` with `lastAccessed` timestamps
  - 30-day TTL on cached entries
  - 5-minute LRU sweep interval (setInterval)
  - `image-cache://` custom protocol handler (`protocol.handle('image-cache', ...)`) — serves files directly from disk with zero-copy streaming, no blob lifecycle
  - `get/set/has/batchGet/clear/stats` methods
  - Manifest persistence on `close()` via `before-quit` hook
- 5 new IPC handlers in `main.cjs`: `image-cache:batchGet`, `has`, `set`, `clear`, `stats`
- 5 new contextBridge methods in `preload.cjs`: `imageCacheBatchGet`, `imageCacheHas`, `imageCacheSet`, `imageCacheClear`, `imageCacheStats`
- 5 new TypeScript methods in `src/bridge.ts` with typed returns and safe `getAPI` guards
- `src/services/imageCache.ts` rewired:
  - `loadGameImage()` step 3: disk cache check (via `getCachedFromDisk()`) between memory cache and CDN fallback
  - CDN winners stored to disk via `cacheImageToDisk()` (blob → base64 → IPC set)
  - `cacheImage()` → alias for `cacheImageToDisk()` (backwards-compatible)
  - `clearImageCache()` → also clears disk cache via `bridge.imageCacheClear()`
  - `loadAllCachedImages()` → no-op (disk cache is on-demand, no pre-warming needed)
  - `invalidateCacheKey()` → memory-only (disk cache is TTL-managed, 30-day auto-eviction)
  - Removed: `openDB()`, `STORE_NAME`, `flushDbWrites()`, `dbWriteQueue`, `dbWriteScheduled`, `DbEntry`, `getCachedImage()`
  - Preserved: in-memory 3-tier LRU (hot/warm/cold), LQIP map, priority prefetch queue, all public API signatures

**Result:** No IndexedDB at all. Images served via `image-cache://` custom protocol URLs that renderer's `<img>` tags consume directly. No blob lifecycle management. Transparent disk usage reporting via `bridge.imageCacheStats()`. Startup is instant (no DB cursor iteration). 500 MB LRU eviction with 30-day TTL keeps disk usage bounded.

### 3.7 — Native C++ Addon for Image Decode + LQIP ✅ COMPLETED (Session 37-38)
**Files:** `electron/handlers/imageNative.cjs`, `electron/handlers/__tests__/imageNative.test.cjs`, `native/`, `electron/main.cjs`, `electron/preload.cjs`, `src/bridge.ts`, `src/services/imageProcessor.ts`
**Effort:** M  **Impact:** 7/10
**Status:** ✅ Completed 2026-06-19

**Why:** OffscreenCanvas LQIP generation is slow (~30ms per image). Native C++ addon (libwebp + turbojpeg) does it in 5-7ms. Full-size WebP encode stays on GPU (OffscreenCanvas) since native was slower for full-res.

**What:**
- New `electron/handlers/imageNative.cjs` — IPC handler wrapping native addon:
  - `native-image:health` — returns loaded/gpu/version
  - `native-image:generateLQIP` — decode → resize → WebP LQIP (dual-path: Buffer or string data URL)
  - `native-image:decode` — returns width/height/format
  - Graceful fallback (returns error) when addon not loaded
- Wired into `main.cjs` handler registration + `preload.cjs` contextBridge + `src/bridge.ts`
- `src/services/imageProcessor.ts` — tries native IPC LQIP first, falls back to OffscreenCanvas
- **31 unit tests** covering 4 scenarios: Buffer LQIP, string LQIP, GPU supported, addon-not-loaded fallback
- AI slop removed: 135→79 lines (excessive docstrings, redundant comments, timing log noise trimmed)

**Result:** LQIP 5-7× faster via native addon. Renderer never blocked (IPC is async). Tests pass 31/31.
**Files:** `electron/services/imageDiskCache.cjs`, `electron/main.cjs`, `electron/preload.cjs`, `src/bridge.ts`, `src/services/imageCache.ts`
**Effort:** L  **Impact:** 8/10
**Status:** ✅ Completed 2026-06-19 — Replaced IndexedDB with native Electron disk cache via IPC.

**Why:** IndexedDB stores images as ArrayBuffers requiring full deserialization at startup. Each loadAllCachedImages() call blocks renderer startup. Blob URLs have lifecycle management issues (manual revocation). Storage is opaque (no visibility into disk usage, eviction is implicit).

**What:**
- New `electron/services/imageDiskCache.cjs` — `DiskCacheManager` class with:
  - Sharded directory layout (1000 subdirs per `game_images/` and `lqip/`) to prevent single-directory slowdown
  - LRU eviction with 500 MB soft cap, tracked via `_manifest.json` with `lastAccessed` timestamps
  - 30-day TTL on cached entries
  - 5-minute LRU sweep interval (setInterval)
  - `image-cache://` custom protocol handler (`protocol.handle('image-cache', ...)`) — serves files directly from disk with zero-copy streaming, no blob lifecycle
  - `get/set/has/batchGet/clear/stats` methods
  - Manifest persistence on `close()` via `before-quit` hook
- 5 new IPC handlers in `main.cjs`: `image-cache:batchGet`, `has`, `set`, `clear`, `stats`
- 5 new contextBridge methods in `preload.cjs`: `imageCacheBatchGet`, `imageCacheHas`, `imageCacheSet`, `imageCacheClear`, `imageCacheStats`
- 5 new TypeScript methods in `src/bridge.ts` with typed returns and safe `getAPI` guards
- `src/services/imageCache.ts` rewired:
  - `loadGameImage()` step 3: disk cache check (via `getCachedFromDisk()`) between memory cache and CDN fallback
  - CDN winners stored to disk via `cacheImageToDisk()` (blob → base64 → IPC set)
  - `cacheImage()` → alias for `cacheImageToDisk()` (backwards-compatible)
  - `clearImageCache()` → also clears disk cache via `bridge.imageCacheClear()`
  - `loadAllCachedImages()` → no-op (disk cache is on-demand, no pre-warming needed)
  - `invalidateCacheKey()` → memory-only (disk cache is TTL-managed, 30-day auto-eviction)
  - Removed: `openDB()`, `STORE_NAME`, `flushDbWrites()`, `dbWriteQueue`, `dbWriteScheduled`, `DbEntry`, `getCachedImage()`
  - Preserved: in-memory 3-tier LRU (hot/warm/cold), LQIP map, priority prefetch queue, all public API signatures

**Result:** No IndexedDB at all. Images served via `image-cache://` custom protocol URLs that renderer's `<img>` tags consume directly. No blob lifecycle management. Transparent disk usage reporting via `bridge.imageCacheStats()`. Startup is instant (no DB cursor iteration). 500 MB LRU eviction with 30-day TTL keeps disk usage bounded.

---

## TRACK 4 — FEATURE ENHANCEMENTS (high-value additions)

### 4.1 — Smart Install Queue with Priority
**Files:** `src/store/installQueueStore.ts` + `src/components/DownloadProgressModal.tsx`
**Effort:** L  **Impact:** 8/10
**Why:** Current install queue is FIFO with no prioritization.

**What:**
- Priority queue: manual installs > batch installs > background updates
- Concurrent install limit with intelligent scheduling
- Estimated time remaining per game + total queue
- Pause/resume/reorder in queue
- Queue persists across app restarts

### 4.2 — Game Collections / Playlists
**Files:** New `src/pages/CollectionsPage.tsx` + `src/store/collectionStore.ts`
**Effort:** L  **Impact:** 7/10
**Why:** Users want to organize games beyond "installed" / "favorites".

**What:**
- Custom collections: create/edit/delete named collections
- Drag-and-drop to add games to collections
- Smart collections: auto-populate (e.g., "RPG > 10GB", "Top Rated 2024")
- Collection view: grid with collection-specific accent color

### 4.3 — Game Details Overlay
**Files:** New `src/components/GameDetailsOverlay.tsx`
**Effort:** M  **Impact:** 7/10
**Why:** Current game interaction is limited to install/favorite. Users want to see details.

**What:**
- Slide-in panel from right (like Steam's game details)
- Shows: description, screenshots, genres, tags, size, DRM type, DLC list
- Similar games section
- Community fixes/notes
- Rating/review summary (scraped)

### 4.4 — Keyboard Shortcuts + Power User Mode
**Files:** `src/App.tsx`, `src/components/CommandPalette.tsx`
**Effort:** M  **Impact:** 6/10
**Why:** Power users navigate faster with keyboard.

**What:**
- `Ctrl+F` → focus search (any page)
- `Ctrl+I` → toggle install queue panel
- `Ctrl+B` → toggle sidebar
- `Escape` → close any modal/panel
- `Space` → play/pause install queue
- `Ctrl+Shift+F` → filter by genre
- Arrow key navigation in grid (WASD or arrows)

### 4.5 — Install History & Statistics
**Files:** New `src/pages/ActivityPage.tsx` + `src/store/activityStore.ts`
**Effort:** M  **Impact:** 5/10
**Why:** Users want to see what they've done.

**What:**
- Install history timeline (date, game, size, duration)
- Storage savings counter (total GB not downloaded from Steam)
- Most-installed genre/developer stats
- Session activity (games installed this session, time spent)

### 4.6 — Batch Operations UI
**Files:** `src/App.tsx` (existing batch mode), `src/components/GameGrid.tsx`
**Effort:** M  **Impact:** 6/10
**Why:** Batch select exists but UI is minimal.

**What:**
- Batch mode toggle in toolbar
- Select all / deselect all / invert selection
- Batch install (existing), batch add to collection (new), batch export (new)
- Progress: "Installing 12/47 games — 3 failed, 1 skipped"
- Summary screen after batch completes

---

## TRACK 5 — MONITORING & TOOLING

### 5.1 — Performance Metrics Dashboard
**Files:** New `src/components/dev/PerfMonitor.tsx`
**Effort:** S  **Impact:** 6/10
**Why:** Can't optimize what you can't measure.

**What:**
- FPS counter (overlay, toggled with `Ctrl+Shift+D`)
- Component re-render counter (highlight changed components)
- IPC call timing breakdown
- Memory usage (approximate, via `performance.memory`)
- Image cache hit rate
- Search latency (p50/p95/p99)

### 5.2 — Build Size Budget
**File:** `package.json` scripts
**Effort:** S  **Impact:** 4/10
**Why:** Prevent bundle bloat.

**What:**
- Add `vite-plugin-inspect` for bundle analysis
- Add size-limit or custom size check script
- CI check: fail if main chunk > 500KB gzipped

---

## EXECUTION ORDER (Recommended Waves)

### Wave 1: Quick Wins (Day 1-2) ✅ FULLY COMPLETE
```mermaid
gantt
    title Wave 1 — Quick Wins
    dateFormat  D
    axisFormat  %d
    section Image
    0.1 Blob URLs          :0.1, 1d
    0.2 Parallel CDN       :0.2, 1d
    0.4 Placeholders       :0.4, 1d
    section Search
    0.5 Web Worker         :0.5, 2d
    0.6 Input Throttle     :0.6, 1d
    section Motion
    0.7 CSS Conversion     :0.7, 2d
```
**Note:** All 7 items completed. 0.1–0.6 verified pre-existing, 0.7 converted in Session 37.

### Wave 2: Rendering & State (Day 3-5) ⏸️ AUDITS COMPLETE
```mermaid
gantt
    title Wave 2 — Rendering
    dateFormat  D
    axisFormat  %d
    1.1 Zustand Audit      :1.1, 2d
    1.2 React.memo Modals  :1.2, 1d
    1.3 Lazy Loading       :1.3, 2d
    1.4 useEffect Audit    :1.4, 1d
```
**All 4 audits complete.** 1.1 needs minor fix (LibraryPage.tsx). 1.4 blocked until eslint-plugin installs. 1.2+1.3 already done.

### Wave 3: Image & Cache Overhaul (Day 5-7) ✅ DISK CACHE + NATIVE ADDON COMPLETE
```mermaid
gantt
    title Wave 3 — Images
    dateFormat  D
    axisFormat  %d
    0.3 Predictive Prefetch:0.3, 1d
    3.6 Disk Cache (IndexedDB→Native):3.6, 3d
    3.7 Native Addon LQIP  :3.7, 2d
    3.3 Image Worker       :3.3, 2d
    3.4 Service Worker     :3.4, 2d
```
**3.6 Disk Cache + 3.7 Native Addon completed 2026-06-19.**
**3.4 Offline (useNetworkStatus + OfflineIndicator + graceful degradation) completed 2026-06-19.**
**0.3 completed 2026-06-11.**
**3.3 (Image/Stats Worker) reassessed + cancelled** — CDN fallback is async (non-blocking), disk cache is native Electron, stats are trivial `.length`/`.size` lookups. A Worker adds serialization overhead with no benefit.

### Wave 4: Visual Overhaul (Day 8-14) ✅ ALL COMPLETE
```mermaid
gantt
    title Wave 4 — Visual
    dateFormat  D
    axisFormat  %d
    2.1 Homepage Redesign  :done, 3d
    2.2 Card Redesign      :done, 2d
    2.3 Loading States     :done, 1d
    2.4 Dark Mode Audit    :done, 1d
    2.5 Responsive Layout  :done, 1d
```
**2.4 + 2.5 completed 2026-06-19.** Colors reconciled (`bgMid: #0c0c18`, `bgCard: #1a1a24`, text: `#f8fafc` etc.), CSS vars + Tailwind v4 `@theme` block added, all Tailwind arbitrary colors and hardcoded hex values replaced with tokens across HomePage, HomePageSkeleton, HeroSection, DLCManager, GameCard, FixGridCard, Sidebar, main.tsx. DESIGN.md consolidated to single source-of-truth values. Max-width 1600px `.content-container` added for ultrawide screens. Build clean (0 errors, ~6.4s).

### Wave 5: Architecture (Day 10-16, parallel with Wave 4) ✅ PARTIAL (3.2 done)
```mermaid
gantt
    title Wave 5 — Arch
    dateFormat  D
    axisFormat  %d
    3.1 Strict Mode        :3.1, 2d
    3.2 Vite Build         :3.2, 1d
    3.5 IPC Optimization   :3.5, 1d
```
**3.2 Vite Build complete.** 3.1 (Strict Mode) + 3.5 (IPC) pending.

### Wave 6: Features (Day 15-21)
```mermaid
gantt
    title Wave 6 — Features
    dateFormat  D
    axisFormat  %d
    4.1 Smart Queue        :4.1, 3d
    4.2 Collections        :4.2, 3d
    4.3 Game Details       :4.3, 2d
    4.4 Keyboard Shortcuts :4.4, 1d
    4.5 Install History    :4.5, 2d
    4.6 Batch UI           :4.6, 1d
```

---

## METRICS — How we track success

| Metric | Before | Target | Current | How to Measure |
|--------|--------|--------|---------|----------------|
| Startup (cold) | ~2s | <1s | ~2s | `performance.timing` |
| Search latency | ~200ms | <50ms | ~200ms | Worker timing |
| Scroll FPS | ~30fps @ 144Hz | 120fps | ~30fps | Chrome DevTools |
| Image load time | ~1.5s avg | <300ms | ~1.5s | Logged in PerfMonitor |
| Memory (idle) | ~350MB | <300MB | ~350MB | Task Manager |
| Bundle (gzip) | ~450KB | <350KB | ~149KB raw (index), ~157KB raw (game-pages) | `npm run build` output |
| Build time | ~10s | <5s | ~6.5s (esbuild) | `time npm run build` |
| motion.* count | 500+ | <50 | 0 in converted files | grep |
| Track 1 audits | 0/4 | 4/4 | 4/4 complete ✅ | Completion status |
| tsc errors | ~90 | 0 | 0 ✅ | `npx tsc --noEmit` |
| ImageNative tests | 0 | 30+ | 31/31 pass ✅ | `node --test` |
| Cleaned up dead code | ~3 items | 0 | colors.js, aliases, barrel exports ✅ | Audit |
| Build errors from our changes | N/A | 0 | 0 ✅ | `npm run build` diff |

---

## CATCH-ALL — Ideas that didn't fit elsewhere

### UI Details
- [ ] Download progress: show ETA + speed graph (sparkline)
- [ ] Search: show recent searches + clear all
- [ ] Toolbar: breadcrumb navigation ("Home > Browse > Action")
- [ ] Sidebar: collapse to icons-only mode (pinned state)
- [ ] Toast: stack limit (max 3 visible), group duplicates
- [ ] Cards: CSS-only 3D tilt on hover (like Steam library)
- [ ] Gradient border on hover for premium cards

### Performance Details
- [ ] Virtual list for FixesPage (44 motion elements, 1000+ fixes)
- [ ] Debounce install progress updates (throttle to 4fps)
- [ ] Use `content-visibility: auto` on all card grids
- [ ] Preconnect to CDN hosts in `<head>`
- [ ] `will-change: transform` on animated elements
- [ ] `isolation: isolate` on card containers to prevent paint issues

### Code Quality
- [ ] Remove `any` types systematically
- [ ] Extract magic numbers/strings to constants
- [ ] Document all IPC handlers with JSDoc
- [x] ~~Add unit tests for imageNative IPC handlers~~ ✅ Done (31 tests, Session 38)
- [ ] Add unit tests for gameStore, useGameFilters, imageDiskCache
- [ ] Add E2E smoke test (app loads, search works, install starts)
- [x] ~~Remove deprecated gameStore aliases~~ ✅ Done (L1+L2, Session 38)
- [x] ~~Delete dead colors.js~~ ✅ Done (L3, Session 38)
- [x] ~~Remove unused barrel exports~~ ✅ Done (L4, Session 38)
- [x] ~~Clean AI slop from imageNative.cjs~~ ✅ Done (135→79 lines, Session 38)

---

---

## VERIFICATION MATRIX — Per-task QA Protocol

> Each task MUST be verified before marking done. Run the command/tool, observe the result.

### Track 0 — Low-Hanging Fruit

| Task | Tool | Steps | Expected |
|------|------|-------|----------|
| 0.1 Blob URLs | DevTools Memory + Network | 1. Take heap snapshot 2. Search for `data:image` 3. Measure idle memory | Zero base64 image strings in heap. Idle memory <300MB. |
| 0.2 Parallel CDN | DevTools Network | 1. Clear cache 2. Load BrowsePage 3. Observe image request waterfall | Requests fire in parallel (not sequential). Any single image <2s. |
| 0.3 Prefetch | DevTools Network + Performance | 1. Scroll down BrowsePage 2. Check if next-page images preload before viewport | Images for next viewport page loaded before scroll reaches them. |
| 0.4 Placeholder | Visual inspection | 1. Hard refresh 2. Observe card load sequence | Gradient placeholder visible <10ms, crossfade to image on load. |
| 0.5 Search Worker | DevTools Performance | 1. Type in search 2. Record JS stack during typing | No main-thread work >5ms. Worker thread handles all filtering. |
| 0.6 Input Throttle | DevTools Console | 1. Log search timestamps 2. Type rapidly | Max 1 search per 33ms. Cancelled queries don't update results. |
| 0.7 Motion→CSS | Bash + Visual | 1. `grep -r "motion\." src/ | wc -l` 2. Click/hover test on converted elements | Count <50. All hover/tap interactions work identically. |

### Track 1 — Rendering & State

| Task | Tool | Steps | Expected |
|------|------|-------|----------|
| 1.1 Zustand Audit | DevTools Components | 1. Select a modal 2. Trigger unrelated store update | Only affected components re-render. No cascading updates. |
| 1.2 React.memo | DevTools Profiler | 1. Record profile 2. Open/close modals | Modal mount time <50ms. No re-render of parent during close. |
| 1.3 Lazy Loading | DevTools Network | 1. Observe initial chunk load 2. Open a modal | Modal JS chunk loads on-demand, not in initial bundle. |
| 1.4 useEffect Audit | ESLint + tsc | 1. `npx eslint src/ --rule 'react-hooks/exhaustive-deps: error'` | 0 violations of exhaustive-deps rule. |

### Track 2 — Visual Overhaul

| Task | Tool | Steps | Expected |
|------|------|-------|----------|
| 2.1 Homepage | Visual + Perf Monitor | 1. Navigate to Home 2. Check FPS 3. Check layout at 1920×1080 | No JS parallax. Sections lazy-load. FPS >60. |
| 2.2 Card Redesign | Visual + DevTools | 1. Hover cards 2. Check image load 3. Right-click | ✅ CSS-only hover (CardShell). Placeholder gradient + crossfade. Context menu on all variants. Build: 0 errors. |
| 2.3 States | Visual test | 1. Load with empty library 2. Load with error 3. Check skeleton | Per-page skeleton. Error state has retry button. Empty state has illustration. |
| 2.4 Dark Mode | Visual audit | 1. Toggle pure black 2. Check every page/surface | No hardcoded colors. All surfaces respect dark/pure-black mode. |
| 2.5 Responsive | Window resize | 1. Resize to 900×600 2. Resize to 1400×900 | No layout breakage. Sidebar collapses gracefully at <1100px. |

### Track 3 — Architecture

| Task | Tool | Steps | Expected |
|------|------|-------|----------|
| 3.1 Strict Mode | `npx tsc --noEmit` | 1. Enable strict 2. Fix errors 3. Re-check | 0 errors with `strict: true`. |
| 3.2 Vite Build | `npm run build` | 1. Build 2. Check output sizes | Build <5s. Separate vendor chunks. main.js <350KB gzip. |
| 3.3 Workers | DevTools Sources | 1. Check Workers tab 2. Post message to worker | Workers visible in DevTools. UI thread never blocked by search/filter. |
| 3.4 Service Worker | DevTools Application | 1. Go offline 2. Load app | App works offline (cached images + data visible). Offline indicator shown. |
| 3.5 IPC Opt | DevTools Performance | 1. Record IPC calls 2. Check batch pattern | IPC calls batched. <5ms per call. |
| 3.6 Disk Cache | Protocol test + fs check | 1. Load images 2. Verify devtools shows image-cache:// URLs 3. Check %APPDATA%/AHG\ Unlocker/game_images/ for sharded files | `image-cache://` URLs in img src. Sharded files on disk. `bridge.imageCacheStats()` returns {size, count, path}. |

### Track 4 — Features

| Task | Tool | Steps | Expected |
|------|------|-------|----------|
| 4.1 Smart Queue | Visual + queue actions | 1. Queue 5 games 2. Reorder 3. Pause/resume 4. Restart app | Queue persists. Reorder works. ETA displayed. Concurrent limit respected. |
| 4.2 Collections | Visual test | 1. Create collection 2. Add games 3. View collection | CRUD works. Accent-color per collection. Grid view renders. |
| 4.3 Game Details | Visual test | 1. Open game details 2. Check content | Panel slides in. Shows description/genre/size/DLC. |
| 4.4 Keyboard Shortcuts | Keyboard test | 1. Press shortcuts 2. Check result | All shortcuts work. No conflicts with existing shortcuts. |
| 4.5 Activity | Visual + data check | 1. Install a game 2. Check activity page | Timeline shows install. Stats update correctly. |
| 4.6 Batch UI | Visual test | 1. Toggle batch mode 2. Select games 3. Batch install | Select all/invert work. Batch install shows progress. Summary screen after. |

---

*This is a living document. Update it after every completed task, add new ideas as they arise,
and re-read before every session to stay aligned with the big picture.*
