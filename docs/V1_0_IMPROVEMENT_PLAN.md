# AHG Unlocker v1.0 Final — Improvement Plan

> Generated from deep analysis of 50+ files, 4 exploration agents, and full project mapping.
> **Current**: v0.90.0 | **Target**: v1.0 Final

---

## Priority Categories

| Priority | Category | Effort | Impact |
|----------|----------|--------|--------|
| 🔴 P0 | Performance & Startup | High | Massive |
| 🔴 P0 | Error Handling & Reliability | Medium | High |
| 🔴 P0 | Security & IPC Safety | Medium | Critical |
| 🟠 P1 | UX/UI Polishing | Medium | High |
| 🟠 P1 | Code Architecture & Maintainability | High | High |
| 🟡 P2 | New Features (Final Batch) | Varies | High |
| 🟢 P3 | Build & Tooling | Low | Medium |
| 🟢 P3 | Developer Experience | Low | Medium |

---

## P0 — Performance & Startup

### 1.1 App Startup Time — Sub-Second Target
**Current**: Loading screen appears for ~2 seconds. App.tsx initializes 6 Zustand stores sequentially with heavy game data parsing.

- **Lazy-load Zustand stores** — Initialize gameStore on-demand after UI renders. Currently all 6 stores hydrate at boot.
- **Async games.json parsing** — Move the 45MB games.json parse to a Web Worker or offload to main process via IPC. Currently blocks render.
- **Virtualize initial game list** — TanStack Virtual is installed but the initial render still constructs full DOM for visible items before virtualizing. Pre-construct only the viewport.
- **Preload critical data** — Use `window.ipcRenderer.invoke('get-vital-stats')` in preload to fetch counts/categories before React mounts.

### 1.2 Memory Leak Hunting
- **IPC listener accumulation** — preload.cjs has listener leak guards (`removeAllListeners`), but some long-lived renderer listeners on `ipcRenderer.on()` may never be cleaned up on component unmount.
- **Image cache bloat** — 9 CDN image sources with no LRU eviction. Images accumulate in memory indefinitely.
- **Zustand selector re-renders** — Batched hook wrappers exist but some components subscribe to large slices. Audit with React DevTools profiler.
- **setInterval/setTimeout leaks** — App.tsx uses polling for download progress. No cleanup path if component unmounts before completion.

### 1.3 Search Performance
**Current**: Game search filters 176,794 entries synchronously.

- **Debounced search input** — Input triggers filter on every keystroke. Add 150ms debounce.
- **Pre-computed search index** — Build a trie or inverted index at startup (or after first search) rather than linear `filter()` every time.
- **Limit visible results** — Virtual scroll is great but search result list still builds 176K DOM nodes before virtualization. Paginate to 500 then virtualize.

### 1.4 Bundle Size
**Current**: 5 vendor chunks in rollup config. No tree-shaking audit.

- **Analyze bundle** — Add `rollup-plugin-visualizer` to see what's bloating output.
- **Lazy load routes** — App.tsx is a monolithic SPA. Split into dynamic imports for: Games Browser, Collections, Settings, Achievements.
- **Remove dead code** — 8 unused UI component classes detected. Remove or tree-shake.
- **Image optimization** — Shift from 9 CDN sources to a single optimized source with WebP/AVIF support.

---

## P0 — Error Handling & Reliability

### 2.1 Unified Error System
**Current**: Errors surface via ad-hoc `toast.error()`, console logs, and silent failures.

- **Create `errors.ts`** — Centralized error registry with error codes, messages, severity levels.
- **Error Boundary upgrades** — Add fallback UI per route (not just "Something went wrong"). Retry buttons, crash recovery.
- **Global error channel** — New IPC channel `'app:error'` for main-process errors to surface as UI toasts.
- **Error reporting** — Optional opt-in: dump recent errors + app state to a log file for debugging.

### 2.2 Race Condition Fixes
- **Install queue serialization** — Two simultaneous installs can collide on file writes. Serialize via a queue.
- **Games.json concurrent writes** — Multiple IPC handlers can write to games.json simultaneously. Add a write lock/mutex.
- **Download state desync** — If app closes during a download, re-opening shows no active downloads but partial files exist. Add state recovery.

### 2.3 Network Resilience
- **Retry with backoff** — Downloads and API calls should retry 3× with exponential backoff before failing.
- **Offline detection** — Listen to `navigator.onLine` and `'app:connectivity'` IPC. Show offline banner. Disable network-dependent features gracefully.
- **Timeout enforcement** — All IPC invocations should have configurable timeouts (30s default).

### 2.4 File System Safety
- **Atomic writes** — Use temp file + rename pattern for games.json, fixes.json to prevent corruption on crash.
- **Disk space check** — Before any install/download, check available disk space. Warn if < 5GB free.
- **Path traversal defense** — Sanitize all user-provided paths in install directory selection.

---

## P0 — Security & IPC Safety

### 3.1 IPC Hardening
**Current**: 120+ IPC handlers with varying validation.

- **Input validation schema** — Add Zod or Joi validation to every `ipcMain.handle()`. Currently most handlers trust renderer input.
- **Handler audit** — Review all 120+ handlers for exposure surface. Mark sensitive handlers (file write, install, config modify) and add confirmation gates.
- **Rate limiting** — Bulk operations (batch search, multi-install) can overwhelm main process. Add per-channel rate limiting.
- **contextBridge minimization** — Review all 80+ exposed API methods. Remove unused ones. Group related methods into namespaced objects.

### 3.2 Secret Management
- **.env support** — Tokens in config/secrets.json should be loadable from `.env` for development.
- **Token exposure audit** — Scan for tokens/logs/credentials leaking in error messages or console output.
- **Machine ID security** — License/machine ID logic should use a hash, not raw system identifiers.

### 3.3 Manifest Repo Safety
- **Repo validation** — Mirror repo URLs/contents should have integrity checks (hash verification) before processing.
- **Content scanning** — Scan fetched `.lua` manifest content for suspicious patterns before writing to disk.

---

## P1 — UX/UI Polishing

### 4.1 Loading & Empty States
| Area | Gap | Fix |
|------|-----|-----|
| Games List | Blank white during initial load | Skeleton cards (8 animated placeholders) |
| Collections View | Empty screen with "No collections" text | Illustrated empty state + "Create First Collection" CTA |
| Achievements | Empty while fetching | Skeleton rows per achievement category |
| Search | No results → dead end | "No games found" illustration + suggestions |
| Downloads | No active downloads → empty space | Show recent downloads list or "Start browsing games" |

### 4.2 Microinteractions & Feedback
- **Hover states** — Buttons without hover feedback (audit and add `hover:scale-[1.02]` with 80ms transition).
- **Click ripple** — Add subtle click ripple on primary action buttons.
- **Progress animations** — Install progress bars: add granular step labels ("Downloading...", "Verifying...", "Installing...") with micro-animation.
- **Toast placement** — Move toasts from bottom-center to bottom-right to avoid overlapping content.

### 4.3 Keyboard & Accessibility
- **Modal focus trap** — Some modals don't trap Tab focus. Users can tab behind modal and interact with background.
- **Escape to close** — All modals/popovers should close on Escape. Audit gaps.
- **Aria labels** — Icon buttons, tool triggers, and custom controls lack `aria-label`. Add systematically.
- **Screen reader support** — Add `role="status"` to live regions (download progress, toast). `aria-live="polite"` on game list updates.

### 4.4 Responsive & Window Management
- **Minimum window size** — Enforce 900×600 minimum. Currently resizable to unusable sizes.
- **Window state persistence** — Save window position/size in settings. Restore on relaunch.
- **Zoom support** — Ctrl+MouseWheel zoom should scale content (not just text). Add zoom state to settings store.

### 4.5 Visual Consistency
- **Design token audit** — Scan for hardcoded colors violating DESIGN.md. Replace with `var(--color-*)` tokens.
- **Font loading** — LCP (Largest Contentful Paint) may be delayed by custom font loading. Add `font-display: swap` and preload.
- **Dark mode flashes** — On fresh load, white background may flash before React paints. Set background-color in `<body>` via preload script.

---

## P1 — Code Architecture & Maintainability

### 5.1 App.tsx Decomposition (Phase 3)
**Current**: 1,958 lines, single file, mixes routing + state + rendering.

- **Split into modules**: `GameBrowser.tsx`, `CollectionsView.tsx`, `AchievementsView.tsx`, `SettingsPanel.tsx`, `DownloadManager.tsx`
- **Create route config**: Simple route table mapping path → component (no react-router needed — use state-based routing)
- **Extract custom hooks**: `useGameFilter()`, `useInstallQueue()`, `useDownloadProgress()`
- **Move modal definitions** to separate `modals/` directory — each modal gets its own file

### 5.2 Store Architecture
**Current**: 6 Zustand stores with mixed patterns.

- **Normalize gameStore** — Flatten deeply nested game objects. Use a map `Record<appid, Game>` for O(1) lookups.
- **Separate UI state from data** — uiStore mixes modal state + search filters + view preferences. Split: `uiStore` (modals, toasts) and `filterStore` (search, sort, filters).
- **Add Zustand persist middleware** — Persist settingsStore, uiStore (view prefs) to localStorage automatically.
- **Selector factory pattern** — Standardize batched selectors: all stores should follow the `useGameState(s => s.games)` pattern.

### 5.3 Main Process Cleanup
**Current**: main.cjs = 6,207 lines, 238KB, 120+ IPC handlers.

- **Split into modules**: `ipc-handlers/` directory with files per domain — `install.js`, `library.js`, `config.js`, `fixes.js`, `mirrors.js`
- **Error handling middleware** — Wrap all `ipcMain.handle()` in a centralized error handler that logs + sends structured errors.
- **Config extraction** — Hardcoded strings (mirror URLs, API endpoints, timeouts) into a `config.js` module.

### 5.4 Error Documentation
- **Create `ERRORS.md`** — Documented error codes, common failure modes, and debugging steps.
- **Add structured logging** — Replace ad-hoc `console.log` with a logging utility (levels: debug, info, warn, error). Optionally pipe to file.

### 5.5 Python Scripts Organization
**Current**: 100+ Python scripts in `scripts/python/`.

- **Categorize**: `scraping/`, `fixing/`, `verification/`, `utility/` subdirectories.
- **Standardize I/O** — Unify script interfaces (CLI args, JSON stdin/stdout, logging).
- **Add requirements.txt** — Pin all Python dependencies with versions.

---

## P2 — New Features (Final Batch)

### 6.1 User Accounts & Sync (Optional)
- **Steam login integration** — Link Steam account to sync owned games, achievements, playtime.
- **Cloud sync** — Sync collections, settings, favorites across devices via a lightweight backend (or Steam Cloud).

### 6.2 Advanced Library Management
- **Smart collections** — Auto-collections: "Recently Added", "Most Played", "Unlocked Last Week".
- **Bulk operations** — Multi-select games: batch unlock, batch add to collection, batch export.
- **Library statistics** — "Your Library" dashboard: total games, unlocked %, storage used, achievement progress.
- **Duplicate detection** — Flag games present in multiple collections.

### 6.3 Download & Install UX
- **Download scheduler** — Schedule downloads for off-peak hours. Queue management with priority.
- **Pause/Resume downloads** — Partial download support (resume interrupted downloads).
- **Background install** — Continue downloading when app is minimized. Notification on completion.
- **Install location picker** — Choose custom install directory per game (currently all go to default).

### 6.4 Visual & Interface
- **Game detail panel** — Slide-out panel (not modal) showing: description, screenshots, reviews, DLC list, achievement progress.
- **Quick preview** — Hover over game → tooltip with rating, size, unlock status.
- **View modes** — Grid (current), List (compact table with metadata), Card (expanded with description).
- **Theme system** — Multiple dark themes: "Midnight" (current), "Amber" (warm), "Matrix" (green accent). Theme selector in settings.
- **Full-screen mode** — Hide chrome, show only game grid. Kiosk mode for big screens.

### 6.5 Export / Import
- **Export collection as shareable file** — JSON or CSV with game names and appIDs.
- **Import from Steam** — Read Steam library and match to unlockable games.
- **Backup/restore** — Full app state export (settings, collections, achievements). One-click restore.

### 6.6 Notification System
- **Desktop notifications** — `Notification API` for: download complete, achievement unlocked, new fix available.
- **Activity feed** — In-app chronological log: unlocks, downloads, collection changes.

---

## P3 — Build & Tooling

### 7.1 CI/CD Pipeline
- **GitHub Actions** — Basic CI: lint → typecheck → build → smoke test.
- **Release automation** — Auto-tag, build, and upload portable EXE on version bump.
- **Scheduled mirror validation** — Weekly workflow to check mirror repo health.

### 7.2 Code Quality Tools
- **ESLint + Prettier** — Add configs. Enforce consistent code style across 100+ ts files.
- **Husky + lint-staged** — Pre-commit hooks: lint + format staged files.
- **TypeScript strict mode** — Enable `strict: true` in tsconfig. Fix all strict errors.

### 7.3 Testing
- **Unit tests (Vitest)** — Start with store tests (pure logic, no DOM) — 6 Zustand stores.
- **IPC handler tests** — Mock Electron's `ipcMain`/`ipcRenderer`. Test each handler in isolation.
- **E2E (Playwright)** — Critical path: app loads → search game → view details → start install → see progress → collection CRUD.

### 7.4 Build Optimizations
- **Electron-builder installer** — Add NSIS installer target (currently portable only).
- **Auto-updater** — Integrate `electron-updater` with GitHub Releases for seamless updates.
- **Source maps** — Enable in production for better crash reports. Strip in final build.

---

## P3 — Developer Experience

### 8.1 Documentation
- **Root README.md** — Setup instructions, architecture overview, contribution guide. Currently only in docs/.
- **CONTRIBUTING.md** — How to add mirror repos, run tests, build locally.
- **API docs** — Document all 120+ IPC channels with input/output types (auto-generate from bridge.ts).

### 8.2 Environment & Setup
- **`.nvmrc`** — Pin Node.js version (currently v20+). Avoid "works on my machine".
- **`.env.example`** — Template for optional tokens/config.
- **`docker-compose.yml`** — Optional: run scraper tools in containers.
- **Dev scripts** — `npm run dev:reset` (clear cache + restart), `npm run lint:fix` (auto-fix).
- **Hot reload** — Currently vite dev but main.cjs changes need manual restart. Add `electron-reload` or nodemon for main process.

---

## Quick Wins (Do First)

These are < 30 min each, high impact:

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 1 | Debounce search input (150ms) | 5 min | 🏆 Search feels instant |
| 2 | Add minimum window size (900×600) | 5 min | No broken layouts |
| 3 | Escape-to-close on all modals | 10 min | Basic keyboard nav complete |
| 4 | Skeleton loading cards | 20 min | No more white flash |
| 5 | Add `font-display: swap` | 2 min | Faster text render |
| 6 | Toast placement → bottom-right | 5 min | Cleaner layout |
| 7 | Error Boundary retry buttons | 15 min | Recoverable crashes |
| 8 | Search result limit (500) + virtualize | 15 min | No 176K DOM nodes |
| 9 | setInterval cleanup on unmount | 10 min | Plug leak |
| 10 | Dark mode flash fix (body bg) | 2 min | No white flash on load |

---

## Estimated Total Effort

| Phase | Est. Time | Description |
|-------|-----------|-------------|
| Quick Wins (P0/P1) | 1-2 days | 10 high-impact micro-fixes |
| Performance & Startup | 2-3 days | Lazy loading, web worker, search index |
| Error Handling | 1-2 days | Centralized errors, race conditions, retry |
| Security & IPC | 2-3 days | Validation, audit, hardening |
| UX/UI Polish | 3-5 days | Loading states, keyboard nav, consistency |
| New Features | 5-10 days | Pick top 3-5 from P2 list |
| Code Architecture | 5-7 days | App.tsx split, store normalization, main.cjs split |
| Build & DX | 2-3 days | CI, ESLint, tests, README |
| **Total** | **3-5 weeks** | Full-time single developer |

---

## How to Proceed

1. **Pick priority bracket** — P0 first (performance + errors + security). These are user-facing quality issues.
2. **Do quick wins first** — 10 micro-fixes in first session. Immediate visible improvement.
3. **Then tackle architecture** — App.tsx decomposition and main.cjs modularization enable everything else.
4. **New features last** — Only after the foundation is solid.

**Which category should we start with?**
