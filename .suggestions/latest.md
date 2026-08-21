# Project Overview — 2026-06-25

> Previous report preserved as `.suggestions/previous-*.md` (was dated 2026-06-18).

## Executive Summary
AHG Unlocker is a desktop (Electron + React + TypeScript) tool that installs/manages unlocked
Steam games via manifest injection — it pulls game manifests from ~97 community mirror repos,
writes SteamTools `.lua` activation files, and manages the full install→DLC lifecycle behind a
dark, violet-accented "gamer utility" UI over a 176K-game catalogue. The codebase is mature and
heavily refactored (App.tsx decomposed, BrowsePage/FixesPage split, Zustand stores, virtualized
grids, native C++ LQIP addon, sharded disk image cache). **This session exposed that "done"
status in the docs was being granted on `tsc + vite build` success alone — three real
regressions were live in the packaged build** (broken `image-cache://` protocol, a Tailwind v4
unlayered reset killing every padding/margin utility, and a font regression). That gap between
"builds clean" and "works when packaged" is the single most important theme below.

## Architecture

### Layers
- **Electron main** (`electron/main.cjs` ~3600 lines + `electron/handlers/*.cjs`, `electron/services/*.cjs`) — 98 IPC handlers, manifest/mirror-repo fetching, install orchestration, Ryuu remote sync, disk image cache, `image-cache://` protocol.
- **Preload bridge** (`electron/preload.cjs`) — contextBridge API surface consumed by `src/bridge.ts`.
- **React renderer** (`src/`) — `App.tsx` shell → `PageRouter` → pages (Home/Browse/Library/Favourites/Recent/Fixes/Settings); `ModalRenderer` for all modals.
- **Python middleware** (`bridge/`) + **C# core** (`core/`) — Steam ops, manifest scanning; `native/` is a C++ addon for fast image decode/LQIP.

### Key Components & State
- God node: `App` (98 graph edges). Domain logic extracted into hooks (`useAppHandlers`, `useGameFilters`, `useInstallGame`, `useFixApplication`, `useScanGames`, `useDLCFetching`, `useAchievements`, `useDiscordAuth`, `useLicense`).
- Zustand stores: `gameStore`, `userStore`, `uiStore`, `installStore`/`installQueueStore`/`installProgressStore`, `settingsStore`, `discordStore`, `scanStore`, `fixGamesStore`, `modalStore`.
- Image pipeline: `services/imageCache.ts` (memory LRU hot/warm/cold → disk cache via IPC → CDN/SGDB race) ↔ `electron/services/imageDiskCache.cjs` (sharded disk + `image-cache://` protocol).

### Data Flow
SQLite (`games.db`, 54 MB) → `bridge.loadGames()` → web-worker filter/dedup → `gameStore`. Covers: component → `loadGameImage()` → memory → disk (`image-cache://`) → CDN/SGDB. Install: card → `useInstallGame` → IPC → main fetches manifest from mirror repo → writes `.lua` → DLC registration.

## Current State

### Just fixed this session (2026-06-25)
- `image-cache://` protocol served nothing in the packaged build — deprecated `registerFileProtocol` + a `standard`-scheme URL whose key collapsed into the host. Switched to `protocol.handle()` + `net.fetch(file://)` and a fixed `image-cache://img/<key>` authority. (Hero art + Quick Access covers were blank.)
- Tailwind v4: an **unlayered** `*{margin:0;padding:0}` reset overrode every `@layer utilities` `p-*`/`m-*` → app-wide cramped layout. Moved into `@layer base`.
- Font regression (`Orbitron` everywhere) from a `*/` inside a CSS comment dropping the `body{font-family}` rule. Fixed.

### Open / known
- **No packaged-build runtime verification** — bugs above all passed `tsc`+`vite build`.
- `handleBatchInstall` (`App.tsx:228`) is a **stub** (only `trackBatchInstall()`) — batch mode UI exists but does nothing.
- Open UI polish: U5 (Browse row gap), U6/U8/U9 (Library hero parity + installed badge), U11 (toolbar align on resize), U12 (search width parity), U14 (dynamic `containIntrinsicSize`).
- Security follow-ups: `webSecurity:false` still open; hardcoded renderer secrets (SteamGridDB key, Ryuu code) should move to main; H7 semgrep blocked (CLI not on PATH).
- `vendor-motion` chunk 121 KB — LazyMotion not adopted.

### Open Questions
- Is there appetite to flip `webSecurity:true` (needs packaged-build testing of Steam CDN `<img>` usage)?
- Should "update available" detection use manifest build-IDs from the Ryuu sync that already runs?

## High-Impact Feature Suggestions

### 1. Packaged-build runtime smoke test (headline)
- **What**: A scripted Playwright-over-CDP check that launches `dev-release/win-unpacked` and asserts the things that `tsc`/`vite` can't see: `image-cache://` returns 200, `p-3` computes to 12px, body font is Inter/Segoe (not Orbitron), hero + covers load (no `naturalWidth===0`), and zero renderer console errors.
- **Why**: Every regression this session was invisible to the existing build gate and only surfaced by manually driving CDP. This converts a multi-step manual hunt into a 30-second automated gate.
- **Impact**: High · **Effort**: Medium
- **How**: Reuse the CDP probe scripts written this session; wrap as `scripts/smoke-packaged.cjs`; add as the final step of the `ahgrebuild` skill (fail loudly).
- **Prerequisites**: None (playwright-core already present).

### 2. CSS-layer + comment guard (quick win)
- **What**: A tiny lint script that fails if `src/index.css` contains an unlayered universal reset (`*{...margin/padding...}` outside `@layer`) or a `*/` inside a comment.
- **Why**: Directly prevents recurrence of the two CSS regressions from this session; both are mechanical to detect.
- **Impact**: Medium · **Effort**: Small
- **How**: ~30-line node script in `scripts/`, run as a `npm run build` pre-step.
- **Prerequisites**: None.

### 3. Finish batch install (quick win, visible)
- **What**: Wire `handleBatchInstall` to actually enqueue every `selectedGames` entry through the existing download/install queue, with progress + a summary toast.
- **Why**: Batch mode is already in the UI (toggle, multi-select, header button) but the handler is a no-op — a half-finished feature users can trigger that silently does nothing.
- **Impact**: High · **Effort**: Small–Medium
- **How**: Loop `selectedGames` → `addToDownloadQueue` → `processDownloadQueue`; reuse existing `installQueueStore`.
- **Prerequisites**: None.

### 4. "Update available" on installed games (strategic)
- **What**: Compare installed manifest build-IDs against the remote set already pulled by Ryuu sync; badge stale games in Library and offer one-click re-inject.
- **Why**: Core-mission aligned — unlocked games go stale when depots update; right now users have no signal. The remote data is already fetched on startup.
- **Impact**: High · **Effort**: Medium–Large
- **How**: Persist installed build-IDs at install time; diff against `remote-sync-manager` output; add a badge (reuse "New" badge pattern) + reuse `useInstallGame` for re-inject.
- **Prerequisites**: Confirm build-ID is available in both installed `.lua`/manifest and remote feed.

### 5. Collections / custom shelves (strategic)
- **What**: User-created named groups of games, surfaced as Home rows and a Library filter.
- **Why**: With 176K games + favourites/recent, users want personal organization; fits the launcher feel without fighting the design language.
- **Impact**: Medium · **Effort**: Medium
- **How**: New `collections` slice in `userStore` + persistence IPC (mirror favourites); render as `GameSection` rows; add to context menu ("Add to collection").
- **Prerequisites**: None (favourites is the template).

### 6. Close out the U-series UI polish (quick wins, batched)
- **What**: U5 row-gap, U6/U8/U9 Library hero + installed-badge parity with Browse, U11 toolbar alignment on resize, U12 search-width parity, U14 dynamic `containIntrinsicSize`.
- **Why**: These are the only open items in the otherwise-complete UI/UX queue; knocking them out gets the "single design language" goal (PRODUCT.md §5) to 100%.
- **Impact**: Medium · **Effort**: Small (each)
- **How**: One change per item; reuse Browse patterns for Library parity.
- **Prerequisites**: None.

### 7. Cold-vs-warm startup measurement now that disk cache works (perf)
- **What**: Instrument and report cold (empty cache) vs warm boot to interactive, now that `image-cache://` actually serves from disk.
- **Why**: The disk cache was effectively dead before this session's fix; the perf budget (load <2s, D009) should be re-validated against the now-functional fast path.
- **Impact**: Medium · **Effort**: Small
- **How**: Use the existing `performance.mark('splash-complete'→'app-interactive')` boot measure; log both states; if warm beats budget, consider LazyMotion for the 121 KB `vendor-motion` chunk as the next lever.
- **Prerequisites**: #1 (so measurement runs against the packaged build).

## Notes for the maintainer
- Per DECISIONS.md: design tokens live only in `docs/DESIGN.md` (D004); main.cjs must be synced to dist-electron (D002); all git is manual (D005). None of the above suggestions touch `games.json`/`fixes.json` (D003) or require architecture overrides.
- The doc state is slightly stale: TODO M1 says TanStack Virtual is "NOT used" — it is now used in Browse/Library/Favourites/Recent/Fixes grids. Worth correcting.
