# AHG Unlocker Full Overhaul — 18+ Issues Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 18+ reported bugs and issues across the AHG Unlocker Electron/React app — critical main process bugs, App.tsx decomposition, UI/UX fixes, performance optimization, and online-fix.me enhancements.

**Architecture:** Electron main process fixes (main.cjs) are independent of renderer/React fixes. App.tsx decomposition follows established hook extraction patterns. UI/UX changes are visual-engineering domain. Each wave is dispatched in parallel via separate sub-agents with no file conflicts.

**Tech Stack:** Electron 33, React 18, TypeScript, Vite, Tailwind CSS, Zustand, framer-motion, lucide-react, @tanstack/react-virtual

---

## WAVE 0 — Foundation & Planning

### Wave 0: Write Plan + Update TODO.md
- [ ] Write this plan file
- [ ] Update TODO.md with all waves/tasks
- [ ] Mark Wave 0 complete

---

## WAVE 1 — Critical Main Process Fixes (PARALLEL — 4 agents, no file conflicts)

All 4 agents modify `electron/main.cjs` but in DIFFERENT sections with zero overlap.

### Task 1A: Fix Frameless Window Maximize (Taskbar Overlap)

**Files:** `electron/main.cjs:420-490`, `electron/preload.cjs` (if needed)

**Problem:** `frame: false` window calls native `mainWindow.maximize()` which fills full screen behind the taskbar on Windows.

**Fix:** Replace `mainWindow.maximize()` in the `window-maximize` IPC handler with custom bounds set to `screen.getPrimaryDisplay().workArea`. Track maximized state manually.

- [ ] Read `electron/main.cjs:420-490` for current window creation + maximize handler
- [ ] In `window-maximize` handler: change from `mainWindow.maximize()` to:
  - Set `mainWindow.setBounds(workArea)` where workArea = screen.getPrimaryDisplay().workArea
  - Track custom `_isCustomMaximized` boolean
  - On second click: restore saved position/size or `mainWindow.unmaximize()`
- [ ] Keep the `setAlwaysOnTop` workaround for z-order
- [ ] Run `/ahg-sync-check` after change
- [ ] Verify: window fills screen above taskbar, not behind it

### Task 1B: Fix check-free-games Stub + F2P Filtering

**Files:** `electron/main.cjs:4337-4339`, `data/free_to_play_ids.json`, optionally `src/hooks/useGameFilters.ts`

**Problem:** `check-free-games` IPC handler returns empty array `[]` — dynamic F2P detection never works. Static `free_to_play_ids.json` has 1698 entries, many incorrect (sequential low appids that are classic Valve games, not F2P).

**Fix:** Implement real Steam Store API query in `check-free-games` handler. Audit/trim incorrect entries from `free_to_play_ids.json`.

- [ ] Implement `check-free-games` handler:
  ```cjs
  ipcMain.handle('check-free-games', async (event, appids) => {
    const freeIds = [];
    const batchSize = 50;
    for (let i = 0; i < appids.length; i += batchSize) {
      const batch = appids.slice(i, i + batchSize);
      try {
        const url = `https://store.steampowered.com/api/appdetails?appids=${batch.join(',')}`;
        const data = await fetch(url).then(r => r.json());
        for (const [id, info] of Object.entries(data)) {
          if (info?.data?.is_free === true) freeIds.push(id);
        }
      } catch (e) { /* skip failed batch */ }
    }
    return freeIds;
  });
  ```
- [ ] Add `isF2PGame` in useGameFilters to check both static set AND dynamicFreeIds
- [ ] Audit `free_to_play_ids.json`: remove entries with appid < 1000 (classic Valve games like Half-Life, CS 1.6, etc. are NOT F2P)
- [ ] Verify: F2P games correctly filtered after reload

### Task 1C: Fix Health Check — Concurrency + Caching

**Files:** `electron/main.cjs:4031-4072`, optionally `src/pages/SettingsPage.tsx`

**Problem:** `check-mirror-health` iterates all ~80 repos SEQUENTIALLY with 5s timeout = 400s worst case. No caching/locking. GitHub API rate-limited (60 req/hr unauthenticated).

**Fix:** Add concurrency, caching, and in-flight check prevention.

- [ ] Add `_healthCheckInProgress` boolean guard at module level
- [ ] Add cache: store results with timestamp, return cached if < 60s old
- [ ] Add concurrency (Promise.allSettled with max 5 at a time):
  ```cjs
  async function checkRepoBatch(repos, timeout) {
    const results = await Promise.allSettled(
      repos.map(repo => checkSingleRepo(repo, timeout))
    );
    return results.map((r, i) => r.status === 'fulfilled' ? r.value : {
      name: repos[i], status: 'unreachable', latency: timeout
    });
  }
  ```
- [ ] Check only PRIORITY repos + speed-sampled subset (not all 80)
- [ ] Verify: health check returns < 30s with meaningful results

### Task 1D: Fix Duplicate Discord OAuth Code + Port Resilience

**Files:** `electron/main.cjs:3151-3219`

**Problem:** `startOAuthCallbackServer` function body appears TWICE (L3151-3204 and L3205-3219). The duplicate is dead code but confusing. Port 18765 may be blocked or in use.

**Fix:** Remove duplicate code block. Add port fallback.

- [ ] Remove lines 3205-3219 (duplicate `startOAuthCallbackServer`)
- [ ] Add port fallback: if EADDRINUSE, try port+1 up to 5 times
- [ ] Verify: single clean function, port fallback works

---

## WAVE 2 — Core Functionality Fixes (PARALLEL — 3 agents, no file conflicts)

### Task 2A: Fix Cancel Download During Install

**Files:** `electron/main.cjs:169, 1593-1668, 1368-1419` (and related install flow)

**Problem:** `downloadControllers` Map only tracks controllers from `download-fix` handler. The main install flow (`add-to-steam`, `install-game-from-zip`, `install-game-with-logs`) does NOT register AbortControllers. Cancel button does nothing during game installation.

**Fix:** Integrate AbortController into the install flow chain: `add-to-steam` → `installSteamGame` → `tryRepoForGame`/`tryLuaToolsApis`.

- [ ] In `add-to-steam` handler: create AbortController, register in `downloadControllers`
- [ ] Pass `controller.signal` through `installSteamGame` → `tryRepoForGame` and `tryLuaToolsApis`
- [ ] In `httpGetWithProgress` (already supports signal): just pass through
- [ ] In `tryRepoForGame`: check `signal.aborted` between each repo attempt
- [ ] Clean up controller on success/failure (delete from Map)
- [ ] In `cancel-download`: already works — iterates and aborts all

### Task 2B: Fix install-game-with-logs to Use Full Pipeline

**Files:** `electron/main.cjs:723-759`

**Problem:** `install-game-with-logs` handler bypasses the full `installSteamGame` pipeline — uses old direct mirror download logic instead of LuaTools APIs → priority mirrors → fallbacks.

**Fix:** Replace the handler body with a call to `installSteamGame()` plus log streaming.

- [ ] Rewrite handler to call `installSteamGame(appid, depotCache, luaPath, sendLog)`
- [ ] Keep the `sendLog` callback for log streaming to renderer
- [ ] Add error handling same as `add-to-steam`

### Task 2C: Fix BottomActionsCard + Verify Favorites/Category

**Files:** `src/pages/HomePage.tsx:740`, `src/components/shared.tsx:1113-1163`

**Problem:** `BottomActionsCard` at line 740 has `onLibrary={() => navigateTo}` — passes function reference without calling it. Need to verify favorites button and browse-by-category work.

**Fix:** Change to `() => navigateTo('library')`. Verify `navigateTo('favourites')` works. Verify CategoriesShowcase genre filter propagates.

- [ ] Fix line 740: change `onLibrary={() => navigateTo}` → `onLibrary={() => navigateTo('library')}`
- [ ] Trace `navigateTo('favourites')` path: should set page=2 (FavouritesPage) + reset search/page state
- [ ] Trace CategoriesShowcase: calls `onCategoryClick(genre)` → HomePage sets `setGenreFilter(genre)` + `setCurrentPage('browse')` — verify BrowsePage reads genreFilter

---

## WAVE 3 — App.tsx Decomposition (SEQUENTIAL — hooks have ordering dependencies)

### Task 3A: Extract useKeyboardShortcuts Hook

**Files:** 
- Create: `src/hooks/useKeyboardShortcuts.ts`
- Modify: `src/App.tsx` — remove L436-499 (keyboard shortcuts + mouse nav + navigateTo + context menu close)

**Extract:** Mouse button navigation (L436-463), command palette Ctrl+P/K shortcuts (L465-478), context menu auto-close (L773-786), navigateTo (L484-499)

**Hook pattern** (follow existing hooks like useAchievements):
```typescript
import { useEffect, useCallback } from 'react'
import { useUIStore, useGameStore } from '../store'

export function useKeyboardShortcuts() {
  const { currentPage, pageHistory, forwardHistory, setPageHistory,
          setForwardHistory, navTransition, setNavTransition,
          commandPaletteOpen, contextMenu, setCurrentPage } = useUIStore()
  const { setPage, setSearchQuery } = useGameStore()

  // Mouse back/forward navigation
  useEffect(() => { ... }, [pageHistory, forwardHistory, ...])

  // Command palette keyboard shortcut
  useEffect(() => { ... }, [commandPaletteOpen])

  // Context menu auto-close
  useEffect(() => { ... }, [contextMenu])

  const navigateTo = useCallback((page: string) => { ... }, [...])

  return { navigateTo }
}
```

- [ ] Create `src/hooks/useKeyboardShortcuts.ts` with extracted code
- [ ] In App.tsx: replace extracted blocks with `const { navigateTo } = useKeyboardShortcuts()`
- [ ] Run `npx tsc --noEmit` — confirm 0 new errors

### Task 3B: Extract useDownloadQueue Hook

**Files:**
- Create: `src/hooks/useDownloadQueue.ts`
- Modify: `src/App.tsx` — remove L1412-1449 + L352

- [ ] Create `src/hooks/useDownloadQueue.ts` with addToDownloadQueue, removeFromDownloadQueue, processDownloadQueue, downloadQueueRunningRef
- [ ] Wire into App.tsx
- [ ] Run `npx tsc --noEmit`

### Task 3C: Extract Game Interaction Hooks (3 sub-hooks)

**Files:**
- Create: `src/hooks/useGameInteraction.ts`
- Create: `src/hooks/useInstallOperations.ts`
- Create: `src/hooks/useFixOperations.ts`
- Modify: `src/App.tsx` — remove L678-703, 705-765, 788-830 (interaction); L869-1083, 1085-1203 (install); L1205-1581 (fix)

**Note:** These are large extractions. Each sub-hook should be a separate task.

- [ ] Extract useGameInteraction (toggleFavorite, handleGameClick, openPortalModal, context menu actions) — ~95 lines
- [ ] Extract useInstallOperations (handleInstallGame, handleInstallFromZip, fetchDLCs, handleDeleteGame, handleBatchInstall) — ~330 lines
- [ ] Extract useFixOperations (handleApplyFix, startScanGames, reloadGamesList, runFixGames, runUpdateCheck, export/import, runFixGamesScript) — ~240 lines
- [ ] Wire all into App.tsx handlers object
- [ ] Run `npx tsc --noEmit`

### Task 3D: Extract useDiscordIntegration Hook

**Files:**
- Create: `src/hooks/useDiscordIntegration.ts`
- Modify: `src/App.tsx` — consolidate scattered Discord refs

- [ ] Extract Discord auth check, share-to-Discord calls, connect/disconnect
- [ ] Wire into App.tsx
- [ ] Run `npx tsc --noEmit`

---

## WAVE 4 — UI/UX & Performance (PARALLEL — 3 agents, file conflicts: none)

### Task 4A: Game Card Spacing, Hover Effects, Custom Cursor

**Files:** `src/index.css`, `src/components/GameGrid.tsx`, `src/components/shared.tsx`

- [ ] Adjust `--grid-min-column-width` and `gap` in `.responsive-grid` (index.css:384-388)
- [ ] Add enhanced hover effects: scale, glow border, smoother transitions
- [ ] Add custom cursor: CSS cursor-image URL or framer-motion cursor follower
  ```css
  /* Option: custom cursor image */
  body { cursor: url('data:image/svg+xml,...'), auto; }
  ```
  Or React component: track mouse with `useMotionValue` + `useSpring`, render `motion.div` as cursor

### Task 4B: React.lazy Code-Splitting + Sidebar Component

**Files:** `src/App.tsx`, `src/components/Sidebar.tsx`

- [ ] Replace ALL static page imports with React.lazy:
  ```typescript
  const HomePage = React.lazy(() => import('./pages/HomePage'))
  const BrowsePage = React.lazy(() => import('./pages/BrowsePage'))
  const SettingsPage = React.lazy(() => import('./pages/SettingsPage'))
  // ... all other page components
  ```
- [ ] Add `<Suspense fallback={<SkeletonLoader />}>` wrapper around page rendering
- [ ] Replace inlined sidebar JSX (App.tsx:1620-2040) with `import Sidebar from './components/Sidebar'` and use the standalone component

### Task 4C: @tanstack/react-virtual for GameGrid

**Files:** `package.json`, `src/components/GameGrid.tsx`

- [ ] Add `@tanstack/react-virtual` to package.json dependencies (`npm install @tanstack/react-virtual@^3.0.0`)
- [ ] Replace pagination in GameGrid with virtual scrolling:
  ```typescript
  import { useVirtualizer } from '@tanstack/react-virtual'
  // Calculate columns based on container width
  // Use useVirtualizer for rows, render grid per virtual row
  ```
- [ ] Remove old pagination state/controls

---

## WAVE 5 — Online-Fix.me Enhancement (PARALLEL — 2 agents)

### Task 5A: Fix Download URL Construction

**Files:** `scripts/python/fixing/update_download_urls.py`

**Problem:** Download URLs constructed formulaically as `{name}_Fix_Repair_Steam_Generic.rar` — may not match actual server filenames.

**Fix:** Add validation step — check if URL returns 200 before saving to fixes.json. Add fallback URL patterns.

- [ ] Add HTTP HEAD check before saving URL to fixes.json
- [ ] Add alternative URL patterns: `_Fix_Repair.rar`, `_Steam_Generic.rar`, no suffix variants
- [ ] Log dead URLs separately

### Task 5B: Improve Scraper Name Matching

**Files:** `scripts/python/scraping/scraper_online_fix.py`

**Problem:** Many games fail to match to games.json due to name differences (special characters, "po seti" suffixes, regional naming).

**Fix:** Improve name cleaning and matching algorithm.

- [ ] Add more aggressive name normalization (remove parentheticals, special chars)
- [ ] Add fuzzy matching fallback (difflib ratio > 0.85)
- [ ] Add Steam API name lookup for unmatched games using appid from matched keywords

---

## WAVE 6 — Verification & Build

- [ ] Run `npx tsc --noEmit` — all files must have 0 NEW errors
- [ ] Run `npm run build` — must pass (pre-existing framer-motion errors OK if unchanged)
- [ ] Run `/ahg-sync-check` if main.cjs was changed
- [ ] Verify all 18 fixes in a quick checklist:
  1. ✅ Window maximize respects taskbar
  2. ✅ Cancel button works during install
  3. ✅ F2P games filtered
  4. ✅ Health check returns results
  5. ✅ Library button in HomePage works
  6. ✅ Discord auth flow clean (no duplicate code)
  7. ✅ Install-game-with-logs uses full pipeline
  8. ✅ Keyboard shortcuts extracted
  9. ✅ Download queue extracted
  10. ✅ Game handlers extracted
  11. ✅ Discord integration extracted
  12. ✅ Custom cursor added
  13. ✅ Game cards look better
  14. ✅ Code-splitting active
  15. ✅ Sidebar using component
  16. ✅ GameGrid virtualized
  17. ✅ Online-fix.me URLs validated
  18. ✅ App.tsx reduced further

---
