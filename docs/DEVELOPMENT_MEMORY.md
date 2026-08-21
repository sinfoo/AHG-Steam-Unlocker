# Development Memory - AHG Unlocker
_Last updated: 2026-05-14 (SISYPHUS_LEVEL2_UPGRADE — 8 new MCP servers, 22 global skills, 5 slash commands)_

## MANDATORY: Read `SKILL.md` Before Any Task

**Before executing any code, making changes, or starting any task, you MUST read `docs/SKILL.md` at the project root (`C:\Users\USER\Downloads\filesOPENCODE\docs\SKILL.md`).** This file contains the central skill registry that maps all available local skills from `.claude/skills/` and external awesome-skill collections. It determines which skill to load via the `Skill` tool, how to discover external skills, and the correct module paths for each.

Failures caused by skipping this step should be treated as process violations.

## MANDATORY: Read `todo.md` Before Each Session

**`dist-electron/todo.md` is the single source of truth for pending/completed tasks.** Before starting ANY work, read `dist-electron/todo.md` to understand what is remaining. Update `todo.md` as tasks progress (completed → in_progress → pending). This ensures no task is forgotten across sessions.

## MANDATORY: Knowledge Graph Awareness

**Before answering any architecture question, you MUST read `graphify-out/GRAPH_REPORT.md` if it exists.** This report contains the project's knowledge graph — god nodes, community clusters, and cross-module relationships. Using it before raw Glob/Grep searches saves significant context and reveals connections you'd miss by searching files linearly.

A PreToolUse hook (installed via `opencode-claude-hooks` plugin in `~/.config/opencode/opencode.json`) fires before every Glob and Grep call. If a knowledge graph exists at `graphify-out/GRAPH_REPORT.md`, you will see:

> `graphify: Knowledge graph exists. Read GRAPH_REPORT.md for god nodes and community structure before searching raw files.`

When you see this, stop your current search and read the graph report first.

## Build Output

**Final build must be verified in `dist-electron/win-unpacked/`.** The packaged Windows build lives at `dist-electron/win-unpacked/AHG Unlocker.exe`. Always verify the build there before declaring work complete.

## Architecture Overview

```
filesOPENCODE/                # Project root
├── src/                      # React/TypeScript UI source
│   ├── App.tsx               # ~8310 line monolithic component (all state + UI)
│   ├── bridge.ts             # IPC bridge layer (337 lines)
│   ├── main.tsx              # React entry point
│   ├── index.css             # Global styles
│   ├── components/           # 16 UI components
│   │   ├── GameGrid.tsx
│   │   ├── GameInstallModal.tsx
│   │   ├── GameDetailModal.tsx
│   │   ├── GameDetailPage.tsx
│   │   ├── Sidebar.tsx
│   │   ├── ActivationModal.tsx
│   │   ├── DiscordLoginModal.tsx
│   │   ├── CommandPalette.tsx
│   │   ├── ChangelogModal.tsx
│   │   ├── FixExtractModal.tsx
│   │   ├── LoadingScreen.tsx
│   │   ├── LogTerminal.tsx
│   │   ├── NoInternetModal.tsx
│   │   ├── ThankYouModal.tsx
│   │   ├── ToastContainer.tsx
│   │   └── UpdateModal.tsx
│   ├── services/
│   │   ├── imageCache.ts     # IndexedDB + in-memory image cache
│   │   ├── api.ts            # REST API client (local Python backend)
│   │   └── steamApi.ts       # Steam API helpers
│   ├── store/index.ts        # Zustand stores (Game, UI, Settings)
│   ├── hooks/useGames.ts     # Game loading hook
│   ├── types/index.ts        # TypeScript interfaces
│   └── workers/gameLoader.worker.ts
│
├── electron/                 # Electron main process source
│   ├── main.cjs              # Main process (3459 lines) — ALL IPC handlers
│   └── preload.cjs           # Context bridge (391 lines)
│
├── scripts/                  # Reorganized utility scripts (2026-05-14)
│   ├── python/               # Python scripts (105 files)
│   │   ├── _path_utils.py    # Shared path resolution (data_path helper)
│   │   ├── scraping/         # 20 scripts — scrape games & fixes from online sources
│   │   ├── analysis/         # 15 scripts — DRM detection, fuzzy matching, analysis
│   │   ├── checking/         # 23 scripts — validation, verification, health checks
│   │   ├── fetching/         # 9 scripts — Steam API fetchers, data importers
│   │   ├── fixing/           # 15 scripts — URL fixing, badge assignment, merges
│   │   └── utils/            # 23 scripts — tests, bot, tools, main_test2 backend
│   ├── powershell/           # 29 PowerShell scripts — scrapers, launchers, checkers
│   └── javascript/           # 14 JS utilities — code migration, debugging, merge tools
│
├── docs/                     # Documentation
│   ├── ARCHITECTURE.md, DESIGN.md, README.md, etc.
│   ├── SISYPHUS-MANUAL.md, GLOBAL-SUPERPOWERS.md, SKILL.md
│   ├── CHANGELOG_*.txt, changelog.txt
│   └── debug1.html, page1.html
│
├── data/                     # Data files (secondary)
│   ├── matched_online_fix.json, media_stats.json
│   ├── scraped_{games,online_fix}.json
│   └── *.txt (additions, added_games, etc.)
│
├── assets/                   # Images & branding
│   ├── ahg_icon.png, AHG_logo.png
│   ├── splash_bg.png, "ahg reimagined logo.png"
│   └── ahg_icon.ico          # (also kept at root for electron-builder)
│
├── config/                   # Build & packaging configuration
│   ├── AHG_Steam_Unlocker.spec
│   ├── AHG_Steam_Unlocker_TEST_2.spec
│   └── opencode-cli.exe
│
├── dist-electron/            # Built output (used at runtime)
│   ├── main.cjs              # Built main process — MUST be manually synced from source
│   ├── preload.cjs           # Built preload
│   ├── DEVELOPMENT_MEMORY.md # This file
│   ├── fixes.json            # Game fixes database (~497 entries)
│   ├── games.json            # Game catalogue (~174K entries)
│   ├── ryuu/                 # Ryuu manifest data
│   └── win-unpacked/         # Packaged Windows build
│
├── dist/                     # Vite build output (React bundle)
├── backend/                  # Python backend (Flask API)
├── bridge/                   # Python bridge layer (PyWebView)
├── core/                     # C# backend (AHGUnlocker.Core)
├── depotdownloader/          # DepotDownloader binaries
├── ui/                       # Legacy standalone React UI (old project)
│
├── package.json              # Build configuration
├── vite.config.ts            # Vite bundler config
├── index.html                # Vite entry template
├── games.json                # Main game catalogue (~174K entries)
├── fixes.json                # Main fixes database (~497 entries)
└── ahg_icon.ico              # App icon (referenced by electron-builder)
```

## State Management
- **Zustand** stores exist (`src/store/index.ts`) but are sparsely used
- **90%+ of state lives in `App.tsx`** as raw `useState` hooks (~100+ state variables)
- No proper state splitting — everything from game data to modal flags to achievements is in one component
- Key state groups: games/filters, install flow, modals (15+), user progress (achievements/stats/XP), Discord auth, settings (accent/sound/pureBlack), download queue, collections, batch select

## Features (All Current)

### Manifest Installation (SteamTools)
- **65+ GitHub mirror repos** for downloading game manifests (`electron/main.cjs:184-265`)
- Tiered install: GitHub mirrors (parallel, concurrency=15) → ryuu.lol → DepotBox.org → DepotDownloader.exe (Steam CDN) → Authenticated sources (Morrenus, ManifestHub, Ryuu Free, TwentyTwo Cloud, Sushi Tools)
- `repoNegativeCache` per-appid — skips repos known to lack a given game
- `repoSpeedCache` — dynamically sorts repos by measured response time
- DLC registration via `register-dlcs` IPC: creates `.lua` files with `addappid()` entries, `_appinfo.json`, and individual DLC `.manifest` files
- Steam restart helper (taskkill + relaunch)
- Local ZIP install via file dialog

### Install Flow (`tryRepoForGame` — electron/main.cjs:1455)
- **Strategy 1 (fast path)**: Branch ZIP download from GitHub — single HTTP GET to `https://github.com/{repo}/archive/refs/heads/{appid}.zip`, extract `.manifest` and `.lua` files
- **Strategy 2 (fallback)**: `depotkeys.json` download — tries 4 URL branches (main/master as raw/branch) with 8s timeout each, then downloads individual manifests per depot
- Fallback chain after all mirrors exhausted: ryuu.lol → DepotBox → DepotDownloader → authed sources
- `add-to-steam` IPC handler: 90s timeout, calls `installSteamGame` which batches mirrors in groups of 15 (REPO_CONCURRENCY)

### DLC System
- `fetch-dlcs` handler (`main.cjs:2174-2365`): 3-tier approach (Steam API → SteamDB/GitHub/CDN parallel → HTML scraping)
- `dlcInfoCache` — persistent metadata cache for DLC names/covers (`dlc_info_cache.json`)
- `fetchDlcInfos` — batch Steam API calls (50/batch) with per-request 10s timeouts, SteamDB API fallback, CDN last-resort
- 60s timeout on DLC info fetch (rendered modal shows populated names)
- DLCs filtered from main catalogue (`type === 'dlc'`)
- Installed DLCs auto-refresh library after install

### Image Loading
- **23+ CDN sources** in `preload.cjs:192-231` (preload's `fetchImage`) and `imageCache.ts:90-117`
- Tiered: Electron preload HTTPS loader (no CORS) → parallel `<img>` batches → XHR with Referer header
- IndexedDB cache (7-day TTL) + in-memory LRU cache
- `GameCover` component with IntersectionObserver lazy loading, gradient fallbacks with deterministic hue generation
- Hash URL dedup: mixed string/int appids resolved by keeping entry with longest `header_image`

### App.tsx UI (~8310 lines)
- **Pages**: home, browse, library, collections, favourites, recent, fixes, settings
- Navigation with history stack + forward stack, mouse button 3/4 support
- **Search**: deferred query, results dropdown, search history (SHOWS BY DEFAULT if history exists — known issue)
- **Filters**: genre (AND logic), sort (popularity/name), fix badges (AND), view mode (grid/list), compact mode
- **Featured game**: auto-rotates every 6s (silent — no sound)
- **Game cards**: spring animations, staggered delays (`i * 0.005`), hover scale+shadow, Add overlay, favorite heart
- **Pagination**: 200 games/page
- **Hero sections**: 5 pages (Library, Collections, Recent, Favourites, Fixes) — gradient orbs, glassmorphism, large typography
- **Sound**: Web Audio API oscillator — success (220+330Hz), error (110+165Hz), click (440+660Hz), hover (880+1200Hz). Sound disabled on auto-rotation.
- **Themes**: dark only, with pure-black option (bgDeep→#000). System theme detection removed. High contrast toggle removed.
- **Accent colors**: violet, blue, green, amber, pink
- **+10 genre categories** with keyword-based detection

### Achievements & Progression
- **30+ achievements** across categories: Getting Started, Browsing, Navigation, Search, Favorites, Social, Installs, Library, Collections, Special
- **XP + leveling system**: `userLevel = Math.floor(userXP / 100) + 1`
- Automatic tracking: page visits, search terms, genre filters, session time, first boot, night owl, early bird, weekend warrior, power user (30min), veteran (7 days), centurion (100 days), marathoner (2hr)
- Achievement toast queue
- Persisted via IPC (`save-achievements`, `get-achievements`)
- User stats: totalInstalls, fixesApplied, gamesViewed, firstLaunch

### Discord Integration
- **OAuth2 login** with local callback server (port 18765)
- Guild membership verification against the fixed guild ID `1251277120999784559` ("AHG Script").
  Previously resolved an invite code at runtime, which broke silently when that invite expired.
- Token refresh, auto-reauth on expired tokens
- **Game sharing**: posts embeds to Discord channel (`1502571428757635092`) with game name, appid, cover image
- Settings persistence (`discord_settings.json`)
- **Authenticated manifest sources**: auto-fetches API keys via Discord token (Morrenus key endpoint, etc.)

### License System
- GitHub Gist-backed (`02dd98bd9581f70b6e88d333e59332dc`, owned by the `ahg-team` account —
  the `githubToken` in secrets must be issued by that account with `gist` scope or all writes 404)
- Machine ID via CIM (`Win32_ComputerSystemProduct.UUID`), falling back to `wmic` then a random id.
  `wmic` alone was broken on Windows 11 24H2+, where it no longer exists.
- Code integrity verification (simple hash of main.cjs) — computed and stored, but never checked
- Per-machine activation (Gist stores machineId per key)
- File: `ahg_license.json` in userData

### Download System
- **Cancel button**: `AbortController` + `httpGetWithProgress` with signal
- Progress events: `totalSize`, `downloaded`, `speed`, `percent`
- Download queue manager (state: pending/downloading/done/error, pause/resume)
- online-fix.me support (Referer header, save dialog)
- ryuu.lol direct download
- GitHub release update download + auto-extract + `.exe.new` swap on restart

### Quick Tools (Settings > AHG Tools tab)
- **Settings tab renamed** from "Steam Control" to "AHG Tools" — contains Steam Management (Restart, Refresh, Open Folder) and Quick Tools grid (8 tools)

### Modals (15+)
- Activation, ThankYou, Discord Login, Changelog, Command Palette, Game Install, Game Detail, Fix Extract, No Internet Fix, Scan Games, Download, Portal (screenshots/related), Collection Manager, Fix Games Script, Internet Fix Script, Download Queue, Export/Import

### Export/Import
- JSON backup: installed games (lua appids), favorites, collections, stats
- Import restores to userData JSON files

### Collections
- User-created named groups with icon + color
- **Full page with hero section** (navigated from sidebar nav item)
- Collection cards show name, icon, game count, edit/delete buttons
- Active collection filters `filteredGames` to show only its games
- Persisted via IPC (`save-collections`, `get-collections`)

### Batch Select
- `batchSelectMode` toggle
- Multi-select games for batch operations

### Auto-Update
- GitHub releases check (`ahg-team/AHG-Steam-Unlocker`)
- ZIP download + extract + file copy
- `.exe.new` rename on next startup
- Version tracking (changelog shown on new version)

### Offline / Edge Cases
- Offline manifest caching
- DNS error handling (ENOTFOUND → user-friendly messages)
- No-internet modal (red-themed rewrite)
- Reduced motion preference

## Key File Details

### `src/App.tsx`
- ~8310 lines, single component
- ~100+ useState hooks
- 30+ useMemo computations for filtered/sorted game lists
- 20+ useEffect hooks for initialization, achievements, navigation, auto-rotation
- Colour system: `DARK_COLORS` only (LIGHT_COLORS removed)
- Hardcoded ID lists: POPULAR_GAMES, VERY_POPULAR_IDS, ACTION_IDS, RPG_IDS, etc.
- FREE_TO_PLAY_IDS: ~1000+ hardcoded appids + dynamic Steam API check

### `electron/main.cjs` (source) vs `dist-electron/main.cjs` (built)
- Source: ~4300 lines, built: copied from source (must be manually synced)
- critical: dist-electron/main.cjs must be kept in sync with electron/main.cjs
- Build pipeline: `Copy-Item electron/main.cjs dist-electron/main.cjs` then `electron-builder`

### `src/bridge.ts`
- 337 lines, wraps all `window.electronAPI` calls
- caches games/fixes in memory
- Methods: loadGames, searchGames, loadFixes, installGame, installGameFromZip, getSteamStatus, checkLicense, fixNoInternet, fixNoGames, clearCache, restartSteam, openSteamFolder, getInstalledGames, removeInstalledGame, downloadFix, copyManifest, checkForUpdates, downloadUpdate, installUpdate, registerDlcs, fetchDLCs, getDownloadPath, getLastSeenVersion, setLastSeenVersion, checkFreeGames, discordLogin, discordLogout, checkDiscordAuth, setGameSharing, getGameSharing, shareGameToDiscord, fixNoInternetStream, fixNoGamesStream, onFixProgress, exportLibrary, importLibrary, saveSearchHistory, getSearchHistory, checkGameUpdates

### `electron/preload.cjs`
- 369 lines, `contextBridge.exposeInMainWorld('electronAPI', {...})`
- 80+ exposed methods
- `fetchImage`: tries 23+ URL patterns in sequence, returns base64 data URL
- Additional: auto-fixes, game tags, offline cache, mirror health, window state, scheduled scans, manifest verification, secure downloads, install stats, activity heatmap, UI settings, context menu, Discord, export/import, search history, game updates

### `src/services/imageCache.ts`
- 266 lines
- IndexedDB store (`ahg-image-cache`, store `covers`, 7-day TTL)
- In-memory Map fallback
- `buildUrls`: 23+ CDN URL patterns (capsule_616x353 → header → library)
- `loadImage`: `<img>` element with timeout
- `loadViaXhr`: XMLHttpRequest with Referer header

## Source vs Built Divergence (Critical)
`dist-electron/main.cjs` is NOT a build artifact — it must be manually copied from `electron/main.cjs`. If changes are made to `electron/main.cjs`, they must be synced to `dist-electron/main.cjs` (or the project must be rebuilt).

## Build & Deploy
- Build output: `dist-electron/win-unpacked/AHG Unlocker.exe`
- Resources: `games.json`, `fixes.json`, backend Python, DepotDownloader
- Window: 1400x900, min 1024x700, centered, dark bg `#030308`
- Electron flags: GPU rasterization, 4GB heap, WebGL, zero-copy

## Security Notes
- Discord client secret and bot token are hardcoded in `electron/main.cjs`
- GitHub personal access token hardcoded for license gist access
- Code integrity check uses simple hash (not cryptographic)
- License key stored locally in plain JSON
- These are embedded in a client-side app (Electron) — treat as public constants

## Known Issues & In Progress (2026-05-10)

### CRITICAL: Manifest installation loops in "Adding to Steam..." modal
- Every game install attempt gets stuck in the "Adding to Steam..." phase and eventually times out
- The `tryRepoForGame` function's Strategy 1 (branch ZIP) should be fast (single HTTP request) but may hang on certain repos
- Strategy 2 (depotkeys fallback) has 4 sequential URL tries × 8s timeout = up to 32s per repo
- The 90s outer timeout on `add-to-steam` handler may fire before Strategy 1 completes on slow connections
- Suspect: `httpGet` function may not have proper timeout handling, causing indefinite hangs

**Needs investigation**: Compare with working backups:
- `backups/2026-05-07_1200_all_fixes/main.cjs` — May 7 backup that supposedly had working manifest downloads
- `backup_pre_discord_20260509_083428/electron/main.cjs` — Pre-Discord version (119KB, simpler install flow)
- `backup_v0.9_download_modal_20260503_1330/electron/main.cjs` — v0.9 download modal backup

Key areas to check:
1. `httpGet` / `httpGetWithProgress` — do they have proper timeouts?
2. `installSteamGame` — does the Promise.all with REPO_CONCURRENCY=15 handle rejections correctly?
3. `add-to-steam` IPC handler — does the 90s timeout actually abort the install?
4. `repoNegativeCache` — could expired failures be blocking all repos?

### Search bar shows fixed expansion that can't be removed
- The inline search dropdown (below header search input) shows by default when search history exists
- Condition: `(searchQuery.length >= 2 || (searchHistory.length > 0 && !searchQuery))`
- When `searchQuery` is empty and `searchHistory` has entries, the dropdown is always visible
- Users cannot dismiss it — clicking away closes but it reappears on next interaction

**Desired behavior**: Remove the inline search dropdown entirely. Search results should ONLY appear in the ⌘K command palette modal. Clicking the search bar should open the modal (it already calls `setCommandPaletteOpen(true)` on focus).

**Fix needed in src/App.tsx**:
- Remove the `<AnimatePresence>` block containing the dropdown (lines ~3314-3395)
- The input can stay but should only trigger the modal

### Collections persistence (FIXED — May 10 session)
- Was: collections wiped on restart because auto-save `useEffect` saved initial empty `[]` before async load completed
- Fix: removed the auto-save effect; each mutation (`saveCollection`, `deleteCollection`, `addGameToCollection`, `removeGameFromCollection`) already calls `saveCollections` directly via `window.electronAPI?.saveCollections?.(next)`
- IPC handlers `save-collections` / `get-collections` in `main.cjs` properly persist to `<userData>/collections.json`

## Backups Reference (DELETED — cleaned up 2026-05-14)

> All disk backups were removed during the 2026-05-14 cleanup (4.38 GB reclaimed). Code history is in git. If you need to restore from a backup, check `ahg_unlocker_backup_20260512.zip` if still present, or re-clone from remote.

| Backup | Date | Contents | Notes |
|--------|------|----------|-------|
| ~~`backup_pre_discord_20260509_083428`~~ | May 9 | ~~Full project (electron/, dist-electron/, bridge.ts)~~ | DELETED |
| ~~`backup_post_discord_20260509`~~ | May 9 | ~~Full project~~ | DELETED |
| ~~`backups/2026-05-07_1200_all_fixes`~~ | May 7 | ~~App.tsx, bridge.ts, main.cjs, preload.cjs~~ | DELETED |
| ~~`backups/2026-05-04_1419_all_changes`~~ | May 4 | ~~App.tsx, bridge.ts, main.cjs, preload.cjs, ui/~~ | DELETED |
| ~~`backup_v0.9_download_modal_20260503_1330`~~ | May 3 | ~~Full project~~ | DELETED |
| ~~`backup_v1.0_20260510`~~ | May 10 | ~~Full project (electron/, src/, dist-electron/)~~ | DELETED |
| ~~`backup-v0.80.0/`~~ | May 12 | ~~App.tsx, main.cjs, games.json, fixes.json, win-unpacked/~~ | DELETED |
| ~~`backup-v0.80.0-full/`~~ | May 12 | ~~App.tsx, win-unpacked/, ui/, depotdownloader/~~ | DELETED |

## Session Changelog — 2026-05-10 (v1.0)

### Fixed
- **Right-click context menu**: Global `contextmenu` listener skips close when target is inside `.game-card-hover`; added `.context-menu` class to prevent internal clicks from closing
- **Context menu premium redesign**: Glass-gradient background, game header with cover thumbnail, vertical accent bar on hover, icon containers with colored backgrounds, gradient separator dividers, staggered entrance animation, "GO" badge on Install
- **Context menu Install → direct install**: Changed from opening portal modal to calling `handleInstallGame` via `installFnRef` ref to avoid stale closure
- **DLC toggle in context menu**: Spring-animated toggle switch with check/X icons, amber glow when ON, "ON" badge
- **Install stale closure**: Added `installFnRef` that always holds latest `handleInstallGame`; `contextMenuInstall` calls `installFnRef.current?.()` in setTimeout (avoids TDZ crash from referencing `handleInstallGame` in deps)
- **Collection creation bug**: Changed `onClick={openCollectionEditor}` to `onClick={() => openCollectionEditor()}` to prevent MouseEvent being passed as `collection` argument, plus type guard `'id' in collection`
- **Collection mutation stale closures**: All 4 mutation functions rewritten from `collectionsRef.current` pattern to React functional updater form (`setCollections(prev => ...)`)
- **Collections page freeze**: Replaced inline `activeCollection` expand with dedicated detail page (filtered game list independent of `filteredGames` useMemo); back button returns to list
- **Quick tools "Fix Games Not Showing"**: Was calling non-existent `window.electronAPI?.fixGamesNotShowing?.()` (no IPC handler) — now correctly calls `fixNoGamesStream?.()` which invokes `fix-no-games-stream` handler
- **Quick tools "Fix No Internet"**: Was calling misspelled `setInternetModalOpen(true)` (state setter didn't exist) — fixed, then later removed entirely per user request
- **`iex` not recognized**: Both `fix-no-internet-stream` and `fix-no-games-stream` had `shell: true` in `spawn()`, causing `cmd.exe` to intercept the `|` pipe before PowerShell. Removed `shell: true` and added `-NoProfile`
- **Colourless button**: `COLORS.orange` was used in gradient but not defined in `DARK_COLORS` — added `orange: '#ea580c'`
- **Fix success detection**: `fix-no-games-stream` reported failure because Steam restart causes non-zero exit code — changed to always return `success: true` on process close, only real spawn failures are caught by `error` event
- **Collections persistence**: Removed auto-save `useEffect` that saved initial empty `[]` before async load completed, wiping saved collections on restart

### Removed
- **"Fix No Internet"**: Completely removed — state variables, function, modal, IPC handlers (`fix-no-internet` and `fix-no-internet-stream`), preload mapping, quick tool entry, quick action bar button, settings button
- **Collections from quick tools**: Already available in sidebar nav
- **Bottom quick action bar**: Entire `showQuickActionsBar` section removed (was redundant with sidebar and quick tools)

### Changed
- **Quick tools colorized**: 7 tools with 7 distinct colors — green, cyan, amber, violet, blue, pink, red
- **AHG Tools header**: Redesigned to match sidebar nav button styling (`py-3.5 px-4 rounded-2xl`, `w-11 h-11` icon container, gradient bg/border/shadow, `layoutId="toolsGlow"`, proper vertical margin)
- **Premium collection cards**: Cover preview strip (4 game headers), gradient fade overlay, game count badge, first-3-names preview text, hover gradient overlay, glass edit/delete buttons on hover

### Built
- Final output: `dist-electron\win-unpacked\AHG Unlocker.exe`

## Session Changelog — 2026-05-12 (v0.71.0 — hover overhaul, DLC cleanup, todo system)

### Added
- **`dist-electron/todo.md`**: Central task tracker — must be read before each session and updated as tasks progress
- **Premium CSS animations** in `src/index.css`:
  - `glow-pulse` — breathing violet glow cycle
  - `glow-violet` — subtle glow oscillation
  - `border-glow` — animated border pulse
  - `shimmer-sweep` — light sweep across elements
  - `float` — subtle vertical floating
  - `border-rotate` — gradient border rotation
  - `icon-spin` — rotation animation
  - `breathe` — scale/opacity pulse
- **Todo system note** in this file under MANDATORY section
- **Win-unpacked build note** as the verification target

### Changed
- **Settings button** (sidebar nav): Color changed from `textMuted` to `violet`, gets 360° icon rotation on hover, stronger scale (1.05), extra violet glow aura on mouse enter
- **All sidebar nav items**: Enhanced hover with better glow, stronger shadow effects
- **GameCard (browse page)**: 
  - Triple-layer glow shadow on hover (`0 16px 64px ${violet}30, 0 0 80px ${violet}15, 0 0 0 1px ${violet}40`)
  - Violet border transition on hover
  - Cover image smooth zoom to 1.12x
  - Violet gradient sweep overlay on cover
  - Heart button gets glow on card hover
  - Name color shifts to violetLight
- **GameGrid.tsx GameCard**: Same premium treatment — triple glow, image zoom, violet overlay, glow-pulse "Add to Steam" button
- **LibraryCard**: Violet border + triple-layer glow + violet gradient overlay on hover
- **LibraryListCard**: Enhanced box shadow + violet overlay + better delete animation
- **Header view toggle**: Added hover glow (violet border/shadow on hover)
- **Discord login button**: Added violet hover glow + border effect when not connected
- **Check Updates button**: Added violet hover glow + border effect
- **Library DLC filter**: Added `g.name` guard to `filteredLibraryGames` to exclude entries with missing names
- **`src/App.tsx` line count**: ~8646 lines (was ~8562) — minor increase from enhancements

### Built
- `vite build` — compiles successfully (1523 modules, 9.71s)

## Session Changelog — 2026-05-12 (v0.80.0 — Version bump, reverted refactoring, loading screen fix)

### Added
- **v0.80.0 version**: Updated all version references from 0.70.2/0.70 to 0.80.0/0.80 across App.tsx, LoadingScreen.tsx, index.html, and package.json
- **`changelog.txt`**: Created for v0.80 documenting all features since v0.70.2
- **Backups**: `dist-electron/backup-v0.80.0/` (App.tsx, main.cjs, games.json, fixes.json, win-unpacked) and `dist-electron/backup-v0.80.0-full/` (App.tsx, win-unpacked, ui/, depotdownloader/)

### Fixed
- **index.html animated loading screen**: Static HTML/CSS loading screen (`dist/index.html:391`) had hardcoded `v0.70.2 • Developed by sinfo` — showed before React mounted. Changed to `v0.80 • Developed by sinfo`
- **LoadingScreen.tsx version**: Changed to `v0.80 • Developed by sinfo`
- **package.json version**: Was `0.70.2` — `app.getVersion()` returned wrong value for update comparison. Changed to `0.80.0`
- **Discord bot (bot.py)**: `get_gist()` and `update_gist()` made async via `asyncio.to_thread()`, added error handling with `is_done()` guards

### Reverted
- **Component extraction reverted**: Restored original monolithic App.tsx (8,429 lines) from backup zip
- **Deleted extracted files**: Removed all 19 extracted components, `src/constants/`, `src/styles/`

### Built
- Final output: `dist-electron\win-unpacked\AHG Unlocker.exe` (v0.80.0)
- Build command: `npm run electron:build`

## Session Changelog — 2026-05-13 (Discord bot: DNS, role assignment, vote dedup)

### Fixed
- **DNS resilience (`bot_run.bat`)**: Bot crashed with `getaddrinfo failed` on transient DNS failures. Added DNS pre-check for `discord.com`, auto `ipconfig /flushdns` on failure, and 3x auto-retry loop with 5s delay.
- **Role assignment on `/activate`**: Switched from `guild.get_member()` (cache) to `guild.fetch_member()` (API call) so members are found even when the member cache isn't synced. Added proper error handling for `discord.Forbidden` (missing perms) and `discord.HTTPException`. Now reports success/failure of role assignment in the embed response.
- **Duplicate votes in `/wherefrom`**: `media_stats.json` now tracks voters via a `voters` dict (user_id → platform key). If a user clicks the same button again, they get "Already voted" and the count is unchanged. New users increment the counter; users changing their platform update their choice without incrementing.

### Added
- **`/notifyrole` command** (renamed from `/notifycustomers`): Slash command that takes a role and message, DMs all non-bot members with that role. Shows sent/failed counts. Requires staff perms. Added to `/help` listing.
- **`bot_run.bat` visual overhaul**: Several iterations — Unicode box-drawing → `#` banner → emoji attempt → final pure-ASCII design with ANSI green/cyan coloring. Uses `[OK]`/`[!!]` indicators with green/yellow/red colors, no Unicode characters, compatible with any Windows codepage.

### Fixed
- **Command listing in `on_ready`**: Changed `tree.get_commands()` (returns only global commands) to `tree.get_commands(guild=GUILD_OBJ)` so all 20 guild-scoped slash commands are printed after sync.
- **`chcp 65001` breaks batch parsing**: Codepage switch caused cmd.exe to mangle variable expansion. Final design uses pure ASCII (no Unicode/emojis) with ANSI color codes — works in any terminal without codepage changes.

### Added
- **`/activateuniversal` command**: New staff-only command that writes to a second Gist (`bf6d0b73e5fcffe76eba2399ed6ba550`). Refactored `get_gist()` and `update_gist()` to accept optional `gist_id` param. On success: mentions the user, assigns universal converter role (`1503872186430259372`), shows download channel (`1504144492314497024`) and feedback channel. No setup guide channel. Listed in `/help`.
- **`/notifycustomers` → `/notifyrole` rename**: Command and `/help` entry updated.

## Cleanup Desired
- Split `App.tsx` into smaller components
- Move state to Zustand stores
- Move hardcoded ID lists to JSON data files
- Audit hardcoded secrets

## Project Reorganization — 2026-05-14

### Organized Directory Structure
Root directory cleaned from **210+ loose files → 25 entries**:

| New Path | Contents | File Count |
|----------|----------|-----------|
| `scripts/python/scraping/` | Scraper scripts (scrape_*, scraper_*) | 20 |
| `scripts/python/analysis/` | Analysis scripts (drm_detector, match_*, fuzzy_*) | 15 |
| `scripts/python/checking/` | Validation scripts (check_*, verify_*) | 23 |
| `scripts/python/fetching/` | Steam API fetchers (fetch_*, generate_*) | 9 |
| `scripts/python/fixing/` | Fix/data update scripts (fix_*, add_*, merge_*) | 15 |
| `scripts/python/utils/` | Tests, bot, backend utils (main_test2, bot.py, test_*) | 23 |
| `scripts/python/` | Shared path utility (`_path_utils.py`) | 1 |
| `scripts/powershell/` | All PowerShell scripts | 29 |
| `scripts/javascript/` | JS migration/debug utilities | 14 |
| `docs/` | Documentation (.md, .txt, .html) | 18 |
| `data/` | Secondary data files (JSON, txt) | 10 |
| `assets/` | Images & branding (png only) | 4 |
| `config/` | Build config (.spec, opencode-cli.exe) | 3 |

### Path Updates Applied
- **75 path references updated** across Python scripts — bare `open('games.json')` calls now use `data_path()` from the shared `_path_utils.py` module
- **Scripts using hardcoded absolute paths** converted to `data_path()` calls
- **Bridge import fixed**: `bridge/main_bridge.py` now imports from `scripts.python.utils.main_test2` with project root in `sys.path`
- **`_path_utils.py`** provides `data_path(filename)` that resolves from project root regardless of subdirectory depth

### Cleaned Up Stale Files
- **Deleted**: `main.cjs`, `preload.cjs`, `index.css`, `imageCache.ts` (root-level stale copies — active versions live in `electron/` and `src/`)
- **Deleted**: `set` (empty file), `Sinfo Bibeni.lnk` (desktop shortcut)

### Preserved at Root
- `package.json`, `vite.config.ts`, `index.html` — build config
- `games.json`, `fixes.json` — main data files (referenced by electron-builder)
- `ahg_icon.ico` — app icon (referenced by electron-builder)
- `electron/`, `src/`, `dist/`, `dist-electron/` — app source & build output
- `backend/`, `bridge/`, `core/`, `depotdownloader/`, `ui/` — existing sub-projects

## Relevant Files
- `C:\Users\USER\Downloads\filesOPENCODE\src\App.tsx` — Main UI, ~8310 lines
- `C:\Users\USER\Downloads\filesOPENCODE\electron\main.cjs` — Main process source (~3459 lines)
- `C:\Users\USER\Downloads\filesOPENCODE\dist-electron\main.cjs` — Built main process (must be manually synced)
- `C:\Users\USER\Downloads\filesOPENCODE\electron\preload.cjs` — Context bridge source (391 lines)
- `C:\Users\USER\Downloads\filesOPENCODE\src\bridge.ts` — IPC bridge (337 lines)
- `C:\Users\USER\Downloads\filesOPENCODE\src\services\imageCache.ts` — Image cache (266 lines)
- `C:\Users\USER\Downloads\filesOPENCODE\scripts\python\utils\bot.py` — Discord license bot
- `C:\Users\USER\Downloads\filesOPENCODE\scripts\bot_run.bat` — Bot launcher with DNS check, auto-retry
- `C:\Users\USER\Downloads\filesOPENCODE\scripts\python\utils\main_test2.py` — Backend main entry
- `C:\Users\USER\Downloads\filesOPENCODE\scripts\python\_path_utils.py` — Shared path resolution helper

## Session Changelog — 2026-05-14 (SISYPHUS_LEVEL2_UPGRADE — MCP agents, skills, commands)

### Added
- **8 MCP servers** registered in `%USERPROFILE%\.config\opencode\opencode.json`:
  - `sequential-thinking` — step-by-step reasoning (always-on, already existed)
  - `semgrep` — security scanning of TS/JS/Python (always-on, remote)
  - `desktop-commander` — surgical file edits, long-running builds (always-on)
  - `git-local` — offline git operations, diff/blame/sync (always-on)
  - `markitdown` — convert PDFs/HTML/DOCX to markdown (always-on)
  - `taskmaster` — cross-session task tracking (disabled, requires ANTHROPIC_API_KEY)
  - `repomix` — full-repo context packaging (disabled, enable per-session)
  - `discord-mcp` — Discord bot verification (disabled, requires DISCORD_BOT_TOKEN)
- **22 global skills** installed to `%USERPROFILE%\.config\opencode\skills/`:
  - farmage pack: `security-review`, `code-review`, `testing-farmage`, `debugging-farmage`, `documentation-farmage`, `api-design`, `dotnet-core`, `fastapi`
  - ok-skills pack: `electron-automation`, `agent-browser`, `browser-trace`, `systematic-debugging-ok`
  - GSAP pack: `gsap-core`, `gsap-performance`, `gsap-react`, `gsap-frameworks`, `gsap-plugins`, `gsap-scrolltrigger`, `gsap-timeline`, `gsap-utils`
  - `skill-creator` — eval-driven skill development (installed as plugin)
- **5 slash commands** in `.opencode/commands/`:
  - `/ahg-security` — run Semgrep security scan
  - `/ahg-sync-check` — verify main.cjs sync state
  - `/ahg-graph` — query knowledge graph
  - `/ahg-build` — full verified build sequence
  - `/ahg-ipc-audit` — find IPC handler gaps
- **Global AGENTS.md** created at `%USERPROFILE%\.config\opencode\AGENTS.md` — MCP routing table, command reference, skill index

### Changed
- **SISYPHUS-MANUAL.md**: Section 3.4 added — Level 2 MCP server table with 8 servers, tool names, purpose, and default enabled state
- **opencode.json**: Merged all 8 MCP entries under `mcp` key, added `opencode-skill-creator` to plugins. Existing `sequential-thinking` preserved.

## Session Changelog — 2026-05-15 (Title Bar Drag Fix & Rebuild)

### Fixed
- **TitleBar drag-to-move not working** — The spacer div between the logo and window controls had `WebkitAppRegion: 'no-drag'`, creating a large dead zone (~60% of title bar width) where clicks wouldn't initiate window drag. Only the "AHG UNLOCKER" text was draggable.
  - Removed `WebkitAppRegion: 'no-drag'` from the spacer so it inherits `drag` from the parent container.
  - Window control buttons (minimize/maximize/close) retain `no-drag` for correct click behavior.
  - File: `src/components/TitleBar.tsx`

### Built
- `vite build` passed (pre-existing warnings only: uiStore.ts duplicate key, chunk size)
- `dist-electron/win-unpacked/` rebuilt via electron-builder --dir
- main.cjs ↔ dist-electron/main.cjs sync verified hash-identical

### Relevant Files
- `C:\Users\USER\Downloads\filesOPENCODE\src\components\TitleBar.tsx`

## Session Changelog — 2026-05-15 (Ctrl+P shortcut, LuaTools API, ImportLuaModal removal)

### Added
- **Ctrl+P / Cmd+K keyboard shortcut for command palette** (`src/App.tsx`): Global `useEffect` keydown handler intercepts `Ctrl+P` (Linux/Windows) or `Cmd+K` (macOS) to toggle the command palette via `uiStore.toggleCommandPalette()`. Prevents default browser behavior. Platform-aware (checks `navigator.platform`).
- **LuaTools fast API layer** (`electron/main.cjs`): New `tryLuaToolsApis()` function tries 4 mirror/live API sources **before** the 78 GitHub release fallback:
  1. `luban7.com`
  2. `lua71.lua-tools.com`
  3. `lua53.lua-tools.com`
  4. `lua51.lua-tools.com`
  Each returns version info + stable download URL. Wired into `installSteamGame()` as first attempt. Uses existing `httpGet` + hash-verify pattern.

### Removed
- **ImportLuaModal component**: Deleted `src/components/ImportLuaModal.tsx` and `src/components/ImportLuaModal.module.css`. Cleaned up all imports and references in `src/App.tsx`, `src/components/index.ts`, `src/types/index.ts`. ZIP import now handled directly in `handleInstallFromZip()` within App.tsx, unified with the main install pipeline.

### Verification
- LSP diagnostics: 0 errors in `src/`, 0 errors in `electron/`
- All pre-existing errors in page components untouched

### Relevant Files
- `C:\Users\USER\Downloads\filesOPENCODE\src\App.tsx` — Keyboard shortcut handler
- `C:\Users\USER\Downloads\filesOPENCODE\electron\main.cjs` — LuaTools API layer
