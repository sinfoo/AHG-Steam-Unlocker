# SESSION-ARCHIVE.md — AHG Unlocker Session Archive
# Version: 1.0 BEAST
# READ BY: Sisyphus when researching past work
# WRITTEN BY: Sisyphus during SESSION.md compaction
# NEVER DELETE — only append

---

> ⚡ **SISYPHUS INSTRUCTION**: This file stores compressed past sessions after
> SESSION.md compaction. Read it when the user asks "what did we do before?" or
> when a current task requires historical context.

---

## ARCHIVE 1 — 2026-05-19 Audit + Sessions 1–18 (SESSION.md compaction)

### 2026-05-19 — AHG ULTIMATE AUDIT
```
Completed: Phase 0–7 (intelligence load, env setup, static audit, behavior, report, cleanup, memory)
Top findings:
  P0 — Hardcoded colors: hundreds of violations across EVERY component
  P1 — Dead code: GameGrid.tsx (246 lines, unused, invalid mode="pop")
  P1 — IPC type safety gap: 70+ handlers vs 2 contextBridge exposures
Build: FAILING (58 TS errors)
Orphaned node processes killed: 25
```

### Session 1 — 2026-05-15 — BEAST INITIALIZATION
```
Created: SESSION.md, TODO.md, ERRORS.md, AGENTS_BEAST.md, DEVELOPMENT_MEMORY_BEAST.md v3.0
Installed: Level 2 MCP stack (sequential-thinking, semgrep, desktop-commander, markitdown)
Fixed: git-local, markitdown, semgrep MCP config errors
Status: PASSING
```

### Session 2 — 2026-05-16 — INTELLIGENCE STACK REORGANIZATION
```
Reorganized: 3 files moved root → docs/
Fixed: AGENTS.md paths
Rebuilt: opencode.jsonc — 15 MCP servers
Pre-cached: 6/9 npx MCP packages
Created: .opencode/commands/ahg-design-check.md
```

### Session 3a — 2026-05-16 — OH-MY-OPENAGENT + SKILL-CREATOR
```
Installed: oh-my-openagent v4.1.2
Created: project opencode.json with plugins
Wired: skill-creator globally + project
```

### Session 3b — 2026-05-16 — IPC SECURITY HARDENING
```
All ipcMain.handle() wrapped with validateOrigin() guard
preload.cjs API surface minimized with channel allowlist
bridge.ts types validated against preload.cjs
Build: FAILING (pre-existing errors only)
```

### Session 3c — 2026-05-16 — ahg-dev-loop SKILL CREATION
```
Created: ahg-dev-loop skill (BEFORE/DURING/AFTER phase detection)
Installed: project, global, command levels
Validated: 3 eval pairs — with-skill 10/10 vs baseline 0/15
Status: SKILL.md valid, SKILLS-INSTALLED.md updated
```

### Session 5 — 2026-05-17 — LOADING FREEZE FIX + REBUILD
```
Fixed: Genre pre-computation chunks 176K games into 5K batches with event loop yields
Fixed: Steam API F2P check capped at 2K appids + 30s timeout (was 176K → 17,600 requests)
Rebuilt: dev-release/win-unpacked/AHG Unlocker.exe (189MB)
Build: Vite passes, tsc ~29 pre-existing errors
```

### Session 7 — 2026-05-18 — WAVE 5 CRITICAL FIXES COMPLETE
```
F1: Loading screen - eliminated "Syncing fix repository/Calibrating" phase texts
F2: Custom cursor - fixed outer ring snapping, added 500px distance guard
F3: Genre tags - Elden Ring no longer shows as "Sports" (removed appid%15 fallback)
F4: GameCard spotlight + redesign — CSS pointer-tracking vars instead of React per-frame re-renders
F5: Performance - batched state updates (GameClick: 3→2 waves, navigateTo: 7→2 waves)
Build: Vite passes — 0 new TS errors
```

### Session 8 — 2026-05-18 — BEASTOPTIMIZE: games.json CACHE + SPLASH + NAVIGATION
```
Full beastoptimize project scan: identified 2-min startup
games.json cache: read-cached-games/write-cached-games IPC handlers
In-memory _gamesCache: filter-games-by-platform no longer re-reads 45MB from disk
HTML splash: removed 500ms animateProgress delay
Vite: sourcemap:false, cssCodeSplit:false, chunkSizeWarningLimit:1500
Navigation: sidebar + page content useMemo'd — stops re-render cascades
Dead code: deleted Sidebar.tsx (226 lines)
TanStack Virtual: LibraryPage grid+list virtualized, CollectionsPage detail extracted
Wave 1: Sidebar deferred value removed, AnimatePresence popLayout, GameGrid React.memo
Wave 2: AbortControllers on install handlers, F2P timeout 30→60s, maximize display-specific
Wave 3: 8 memo'd card components custom comparators, fixes.json merged (497 deduped)
Build: vite 15.07s, 0 new errors
```

### Session 9 — 2026-05-19 — BROWSE CRASH FIX + DEAD CODE + GENRE CACHE
```
Fixed Browse crash on nav, Collections crash, Favorites routing
Guarded homeSections behind currentPage — skips 176K-game pass on non-home
Removed dead code: POPULAR_GAMES (5KB), GENRE_KEYWORDS, detectGenre from BrowsePage
Fixed genre cache population
5 files changed, LSP 0 errors, vite build 5.21s
```

### Session 10 — 2026-05-19 — WAVE 6: ANIMATION + TANSTACK + STEAM-MCP
```
Premium card: 3D perspective, genre-tinted shadows, sheen sweep, glass footer
Fixed 5 animation violations (300ms→80ms, 500ms→80ms)
240 B3 transitions catalogued, 4 B1 lists flagged
index.css: 11 classes migrated to 80ms cubic-bezier(0.4,0,0.2,1)
TanStack: LibraryPage + CollectionsPage detail virtualized
steam-mcp (@praeses/steam-mcp v2.0.0) configured and enabled
Build: vite 11.86s, 0 errors
```

### Session 10b — 2026-05-19 — MCP STACK EXPANSION (6 NEW SERVERS)
```
Added: shadcn, animate-ui, magic-ui, firecrawl (with API key), sentry (disabled)
Fixed: @magicui/mcp → @magicuidesign/mcp
Pre-cached: shadcn v4.7.0, @magicuidesign/mcp v2.0.0, firecrawl-mcp
Total MCPs now: 24
```

### Session 11 — 2026-05-20 — CATALOGUE REDESIGN
```
Maximize root cause #2: ?? → || in main.cjs:509
CustomCursor simplified: 400+ lines → single 8px dot
GameDetailPanel deleted: 541 lines
Install handlers refactored with gameOverride param
GameCard: install Steam + Zip buttons
BrowsePage: masonry/waterfall layout
Build: vite 8.89s, 0 errors + electron-builder 189MB
```

### Session 12 — 2026-05-20 — ALL 62+ TS ERRORS FIXED — BUILD PASSING
```
62+ TypeScript errors eliminated across ~16 files (2 parallel agents)
vite-env.d.ts, bridge.ts, App.tsx, shared.tsx — major type fixes
All 10 component/hook files fixed
tsc: 0 errors (was 62+), vite build: 0 errors (7.64s)
```

### Session 13 — 2026-05-21 — HERO UPGRADES (LIBRARY + FAVOURITES + RECENT)
```
LibraryPage hero: violet accent, parallax, ambient orbs, showcase card
FavouritesPage hero: pink accent, same premium treatment
RecentPage hero: amber accent
Build: vite 10.29s, 0 errors + electron-builder 189MB
```

### Session 14 — 2026-05-22 — RIGHT-CLICK MENU + GAME_URL BACKFILL + 401 HANDLING
```
LibraryPage right-click context menu with library-mode detection
fixes.json: game_url constructed for 3655/3656 fixes (from 1819)
Cloudflare cookie acquisition: visible window, polls 2s×20s
Build: tsc 0 errors, vite 13.70s
```

### Session 14b — 2026-05-22 — FULL PERFORMANCE OPTIMIZATION + REBUILD
```
Created: src/hooks/useAppState.ts — 6 batched Zustand hooks (shallow equality)
App.tsx: ~80 selectors → 6 batched calls
GameGrid: CSS containment, removed AnimatePresence
GameCover: 300ms→80ms animation, simplified IntersectionObserver
vite.config.ts: cssCodeSplit, esbuild pure, no modulePreload
index.html: Steam CDN preconnect/dns-prefetch
Build: tsc 0 errors, vite build 0 errors
```

### Session 15 — 2026-05-23 — DEEP PERFORMANCE FIXES
```
Fix 1: useGameFilters — guarded filteredGames on non-game pages
Fix 2: App.tsx — 3 achievement.map some() guards
Fix 3: navigateTo — removed searchQuery: '' from setState
Fix 4: main.cjs — concurrent repo pool (REPO_CONCURRENCY=15) for installSteamGame
Build: tsc 0 errors, vite 8.64s
```

### Session 16 — 2026-05-23 — CATALOGUE + HOME PAGE INSTANT RENDER
```
BrowsePage: split filteredGames into 3 per-page effects
HomePage: removed 5 duplicate useMemo computations, now receives as props
HomePage bundle: 15.28kB → 13.62kB
Build speed: 8.64s → 4.95s (57% faster!)
Build: tsc 0 errors, vite 4.95s
```

### Session 17 — 2026-05-23 — REMOVE BTN + EXTRACTFIX IPC + SCROLLING LAG
```
GameCard: wired onRemoveFromLibrary through all pages
extractFix IPC handler (AdmZip/7-Zip) + open-file-location added
Scrolling lag — 3 animation freeze layers: spotlight-card IntersectionObserver,
AnimatedBackground scroll-debounce, hero offscreen unmounting
Created: useIsVisible.ts generic IntersectionObserver hook
Build: tsc 0 errors, vite 3.83s
```

### Session 18 — 2026-05-24 — PERFORMANCE FIXES (FIX 2–5) + MCP ENABLE ALL
```
Confirmed: no custom cursor mechanism exists
Fix 2: AnimatedBackground — skip render when not on home/browse
Fix 3: spotlight-card — skip rAF when no active cards
Fix 4: GameCover — CSS spinner instead of framer-motion
Fix 5: useGameFilters — module-level HOME_SECTION_SETS
Enabled all 24 MCPs (17 were disabled)
Build: tsc 0 errors, vite 7.49s, rebuild win-unpacked
```

---

_Sisyphus appends new entries here during SESSION.md compaction._
_Each entry must be complete enough that a future session can understand what happened_
_without reading the full original session log._
