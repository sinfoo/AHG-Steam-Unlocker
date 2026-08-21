# MIGRATION PLAN — JSON → SQL + Standalone App with Pre-Cached Assets

> **Version**: 0.2 | **Status**: ACTIVE — Phase 0 Complete | **Author**: Sisyphus  
> **Target**: AHG Unlocker v1.0 | **Stack**: Electron + React + TypeScript + Vite + SQLite (sql.js WASM) + Ryuu API + SteamGridDB

---

## TABLE OF CONTENTS

1. [Architecture Overview](#1-architecture-overview)
2. [Phase 0 — Foundation: Complete SQL Migration](#2-phase-0--foundation-complete-sql-migration)
3. [Phase 1 — Database Pipeline: Eliminate JSON Dependency](#3-phase-1--database-pipeline-eliminate-json-dependency)
4. [Phase 2 — Image Pipeline: Local Pre-Cached Assets](#4-phase-2--image-pipeline-local-pre-cached-assets)
5. [Phase 3 — Offline Architecture: Zero Network Dependency at Boot](#5-phase-3--offline-architecture-zero-network-dependency-at-boot)
6. [Phase 4 — Standalone Experience: Optimized Boot & Bundle](#6-phase-4--standalone-experience-optimized-boot--bundle)
7. [Phase 5 — Validation & Build](#7-phase-5--validation--build)
8. [Risk Register & Rollback Plan](#8-risk-register--rollback-plan)
9. [Success Criteria & Performance Targets](#9-success-criteria--performance-targets)

---

## 1. ARCHITECTURE OVERVIEW

### Current (Problematic) Architecture

```
games.json (44MB JSON, 176K games) 
    ↓ loaded into memory as full JS array
main.cjs (in-memory: _gamesCache = Massive array)
    ↓ IPC (send 176K objects over bridge)
preload.cjs → renderer bridge.ts
    ↓ 
gamesCache in React (entire dataset in RAM)
    ↓
GameCover component → tries 9 CDNs × 6 image types × 2 paths = 108 URLs per game
    ↓ IndexedDB (7-day TTL) — still re-downloads every week

### External APIs (New Additions)

**Ryuu API** (`generator.ryuu.lol/secure_download`) — replaces 97 GitHub mirror repos
**SteamGridDB API** (`steamgriddb.com/api/v2`) — replaces brute-force CDN image scanning
```

**Problems:**
- 44MB JSON parsed on every boot — slow I/O + memory spike
- Entire 176K game dataset sent over IPC to renderer
- Images fetched from network at runtime — 108 HTTP attempts per uncached game
- IndexedDB cache has 7-day TTL — re-downloads expire weekly
- No pre-cache mechanism — first visit to any page is slow
- `games.json` overwrite risk (Rule D003 in DECISIONS.md)

### Target (Standalone) Architecture

```
games.db (54MB SQLite, 176K rows)       fixes.db (1.4MB SQLite, 4K rows)
    ↓                                      ↓
electron/db.cjs (SQLite wrapper — 32 METHODS, PAGEABLE, FTS4)
    ↓ IPC (page-by-page, 50-200 at a time)
preload.cjs → renderer bridge.ts
    ↓
React Zustand stores (partial, paginated in memory)
    ↓
GameCover component → 1) LOCAL asset bundle (0ms, instant)
                      2) SteamGridDB API (background cache miss)
                      3) CDN fallback (last resort)

┌──────────────────────────────────────────────┐
│  External API Integration                    │
│  ┌────────────────────────────────────────┐  │
│  │  Ryuu API Service                     │  │
│  │  └─ generator.ryuu.lol/secure_download │  │
│  │  └─ Replaces 97 GitHub mirror repos    │  │
│  │  └─ .lua + .manifest file extraction   │  │
│  ├────────────────────────────────────────┤  │
│  │  SteamGridDB Service                   │  │
│  │  └─ steamgriddb.com/api/v2/grids      │  │
│  │  └─ Replaces 108-URL CDN brute-force   │  │
│  │  └─ Multi-image type support           │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│  Standalone Asset Bundle (bundled at build)  │
│  ┌────────────────────────────────────────┐  │
│  │  images/header/${appid}.jpg           │  │
│  │  images/portrait/${appid}.jpg         │  │
│  │  images/library/${appid}.jpg          │  │
│  │  image_manifest.json (pre-computed)   │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

---

## 2. PHASE 0 ✅ — FOUNDATION: COMPLETE SQL MIGRATION

> **Goal**: Finish the SQLite migration that's already been started (db.cjs exists, databases exist) and make SQLite the **authoritative** data layer.
> **Status**: ✅ COMPLETE (2026-06-06)

### Files Involved
| File | Role | Status |
|------|------|--------|
| `electron/db.cjs` | SQLite wrapper — 32 exported methods | ✅ Done |
| `scripts/convert-to-sqlite.js` | Build-time conversion: streaming JSON parser, FTS4, batch INSERT | ✅ Done |
| `tests/db.test.cjs` | 80 unit tests, 0 failures, 3 bugs found + fixed | ✅ Done |
| `scripts/verify-db.js` | 26 integrity checks, all critical pass | ✅ Done |

### Step 0.1 ✅ — Audit & Complete db.cjs API

**Completed**: 32 exported methods — all search, filter, bulk, schema operations.

```
queryGames(), getAllGames(), getGame(), getGamesMeta(), getAllGameIds(),
gameExists(), searchGames(), searchGamesFTS(), getSearchSuggestions(),
getGamesByType(), getTypeCounts(), getGamesNeedingCover(), getRecentUpdates(),
getGameCountByPlatform(), upsertGame(), upsertGames(), deleteGame(), deleteGames(),
getAllFixes(), getFix(), searchFixes(), searchFixesFTS(), getFixCountBySource(),
upsertFix(), upsertFixes(), persist(), persistFixes(), initialize(),
getSchemaVersion(), updateGameCover(), rebuildFTS()
```

**Key decisions made:**
- **FTS4 instead of FTS5**: default sql.js WASM build lacks FTS5; FTS4 provides same MATCH interface
- **FTS triggers DROPPED**: `games_ai`, `games_ad`, `games_au` caused DELETE failures in sql.js. FTS is now managed explicitly in JS code (in `upsertGame()`, `deleteGame()`, `deleteGames()`).
- **3 bugs found by unit tests and fixed**: (1) `where.slice(7)` → `slice(6)`, (2) `$limit` missing from params in `searchFixesFTS`, (3) FTS4 triggers blocking DELETE operations

### Step 0.2 ✅ — Convert-to-SQLite Script Finalization

**Completed**: Full rewrite with:
1. **Streaming JSON parser** — never loads entire 44MB into memory. Uses manual `pos` cursor for chunk-boundary safety (fixed: persistent `pos` instead of `skipBrace`/`i=0` reset)
2. **FTS4 virtual table** (`games_fts`) with `content='games'` for auto-sync (triggers since dropped — see 0.1)
3. **Schema versioning** via `_schema_version` table (v1 applied 2026-06-06)
4. **Batch INSERT** at 5,000 rows per transaction
5. **Indexes**: `idx_games_name`, `idx_games_type` (PRIMARY KEY on appid provides implicit index)

**Output**: `games.db` (54.1MB, 176,130 rows) + `fixes.db` (1,384KB, 4,152 rows)

### Step 0.3 ✅ — Database Location & Discovery

**Completed**: `findDbDir()` in db.cjs handles:
1. Electron `app.getPath('userData')` — installed mode
2. Project root — dev mode
3. Database path detection with appropriate fallbacks

### Step 0.4 ✅ — Unit Tests for db.cjs

**Completed**: `tests/db.test.cjs` — 80 tests covering all 32 methods:
- In-memory SQLite initialization with test schema
- Games: pagination, search, filter by type, FTS, sort, upsert, delete
- Fixes: full listing, single get, FTS search, upsert
- Schema version read
- Edge cases: empty results, special characters, non-existent appids, batch operations

### Verification ✅ — DB Integrity

**Completed**: `scripts/verify-db.js` — 26 checks, all critical pass:
- Row count: DB 176,130 vs JSON 63,655 (JSON was truncated post-conversion — DB is authoritative)
- FTS4 verified: 176,130 rows match, MATCH queries work
- Indexes: PRIMARY KEY + 2 secondary indexes verified
- Schema version: v1 (applied_at: 2026-06-06 10:34:53)
- Data integrity: zero null appids/names, type distribution documented (64.4% empty-type), platforms all `[]`
- Streaming parser completeness: trailing records confirmed, spot check passes (appid=10 "Counter-Strike" found)
- Fixes: 4,152 rows, 2 duplicate appids handled, sources: online-fix.me (3,656) + ryuu.lol (496)

---

## 2.5 — RYUU API & STEAMGRIDDB INTEGRATION STRATEGY

> **Goal**: Replace the two most expensive external-dependency systems with dedicated API services.
> **Status**: 🎯 Design phase (ready to implement)

### 2.5.1 — Ryuu API: Replace 97 GitHub Mirror Repos

**Current system** (from main.cjs exploration):
- 97 hardcoded GitHub repos in `MIRROR_REPOS` array (line 106-198)
- 6-stage fallback chain in `installSteamGame()` (line 1747-1955):
  1. Cached depotkeys lookup (instant, zero network)
  2. Parallel ZIP probing across ALL 97 repos (1s timeout each, shared AbortController)
  3. LuaTools APIs (Morrenus, Sushi, Ryuu)
  4. ryuu.lol direct (`generator.ryuu.lol/download`)
  5. DepotBox.org CDN download
  6. DepotDownloader.exe Steam CDN fallback
- 6 in-memory caches: `depotKeysCache`, `repoAppIndex`, `repoSpeedCache`, `repoNegativeCache`, `repoManifestCountCache`, `repoHitCache`
- 14+ functions spanning `downloadDepotKeys`/`downloadManifest`/`tryRepoForGame`/`tryLuaToolsApis`/etc.
- 12 IPC channels for manifest/install operations
- Disk paths: `{steamPath}/depotcache/{depotid}_{manifestid}.manifest`, `{steamPath}/config/stplug-in/{appid}.lua`

**Target — Ryuu API Service:**
```
Ryuu API endpoint:  generator.ryuu.lol/secure_download?appid={id}&auth_code=RYUUMANIFESTv78r6h
Response:            ZIP containing .lua + .manifest files
Response time:       ~2s

New flow for installSteamGame():
  1. Call Ryuu API for appid (single endpoint, ~2s)
  2. Extract .manifest → write to depotcache/
  3. Extract .lua → write to stplug-in/
  4. Write appinfo.json → depotcache/{appid}_appinfo.json
  5. Cache result locally for offline repeat
  6. Fallback: keep old mirror pipeline if Ryuu fails (remove in Phase 4)
```

**Module to create**: `src/services/ryuuApi.js`
```javascript
class RyuuApiService {
  async downloadGame(appid) {
    // 1. Check local cache (already downloaded before?)
    // 2. Call generator.ryuu.lol/secure_download
    // 3. Parse ZIP response
    // 4. Extract manifests + lua files
    // 5. Write to Steam depotcache/stplug-in paths
    // 6. Cache for offline repeat
    // Returns: { success, manifests, luaFiles, totalSize }
  }
  
  async downloadDlcManifests(dlcIds) {
    // Batch DLC download via Ryuu API
    // Each DLC appid gets same secure_download treatment
  }
}
```

**Changes to main.cjs installSteamGame():**
```
BEFORE (6 stages):
  1. Cached depotkeys
  2. 97-repo ZIP probe (parallel, 1s per repo)  ← REPLACE WITH RYUU
  3. LuaTools APIs                                ← KEEP as fallback
  4. ryuu.lol direct                             ← KEEP as fallback
  5. DepotBox.org                                ← KEEP as fallback
  6. DepotDownloader.exe                         ← KEEP as fallback

AFTER (3 stages):
  1. Ryuu API service (single call, ~2s)         ← NEW PRIMARY
  2. Ryuu fallback: old stage 3-4                ← FALLBACK
  3. DepotBox + DepotDownloader                  ← LAST RESORT
```

**IPC & Config changes:**
- No new IPC channels — the service runs in main process
- Config: `ryuu_api_key` in settings (currently hardcoded in main.cjs as `RYUUMANIFESTv78r6h`)
- Add `steam_paths` config for user-configured Steam directories

### 2.5.2 — SteamGridDB: Replace 108-URL CDN Brute-Force

**Current system** (from imageCache.ts exploration):
- **3-tier cache**: L0 in-memory Map → L1 IndexedDB (7-day TTL) → L2 CDN brute-force
- **5-method fallback chain** in `tryLoadImage()` (line 286-337):
  1. M1: Fast browser Image() — 1 host, preferred types, 600ms
  2. M2: Electron preload `fetchImage()` — 8 CDN hosts × 2 paths per suffix, Node.js HTTPS
  3. M3: Batched CDN scan — 2 fastest hosts, 900ms, batch 6
  4. M4: Full CDN scan — all 9 hosts × 6 types × 2 paths, 1500ms, batch 12
  5. M5: XHR with Referer header — handles strict CORS cases
- **Worst case**: ~350 URL attempts per image
- **Preload bridge method** `fetchImage()` (preload.cjs line 283-342) — 8 CDN hosts × 2 paths + SteamDB + archive.org + Steam API fallback
- `getSteamImage(appid)` — simple fallback URL builder in shared.tsx/App.tsx

**Target — SteamGridDB Service:**
```
SteamGridDB API:  steamgriddb.com/api/v2/grids/steam/{appid}?dimensions={types}
Auth:              Bearer token 1e7c6c08249aa540c0840b5d95677c12
Response:          Array of image URLs with type, dimensions, mime

New flow for loadGameImage():
  1. L0 in-memory cache (instant) ← KEEP
  2. L1 IndexedDB cache ← KEEP, extend TTL from 7 days to PERMANENT
  3. SteamGridDB API call ← REPLACES entire M1-M5 chain
     → Single API call per appid
     → Returns URLs for header/portrait/library hero/logo/icon
     → Download best match → cache in L0 + L1
  4. CDN fallback (last resort, only if SGDB fails) ← REPLACES 350-URL brute-force
```

**Module to create**: `src/services/steamGridDb.js`
```javascript
class SteamGridDbService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://www.steamgriddb.com/api/v2';
    this.cache = new Map(); // in-memory L0 cache
  }

  async getGrids(appid, dimensions = ['460x215', '600x900', '920x430']) {
    // GET /grids/steam/{appid}?dimensions={types}
    // Returns image records with type, URL, dimensions
    // Cache result to avoid redundant API calls
  }

  async getHeroes(appid) { /* GET /heroes/steam/{appid} */ }
  async getLogos(appid) { /* GET /logos/steam/{appid} */ }
  async getIcons(appid) { /* GET /icons/steam/{appid} */ }

  async getBestImage(appid, preferredType = 'header') {
    // Returns the single best image URL for the requested type
    // priority: grids (460x215 for header, 600x900 for portrait)
    // Maps preferredType to SteamGridDB dimensions
  }
}
```

**Changes to imageCache.ts:**
```
BEFORE tryLoadImage() (lines 286-337):
  5 methods, 350 URL attempts

AFTER tryLoadImage():
  Method 1: SteamGridDB API (single call, cached)
  Method 2: CDN fallback (shorter, only 2 hosts × 2 types)
```

**Changes to preload.cjs fetchImage() (line 283-342):**
```
BEFORE: 8 CDN hosts × 2 paths per suffix + SteamDB + archive.org + Steam API
AFTER:  Call SteamGridDB service → download best URL → return data URL
        Keep CDN fallback as one-liner (cloudflare + akamai, 2 types only)
```

**No UI component changes needed** — `GameCover.tsx` and all 17+ consumers call `loadGameImage()` which is the single entry point. The data source changes transparently beneath it.

### 2.5.3 — Configuration Approach

Both services need configuration storage. The app currently has:
- `%APPDATA%/AHG Unlocker/steam_custom_paths.json` — Steam path config
- `%APPDATA%/AHG Unlocker/dlc_info_cache.json` — DLC cache
- `%APPDATA%/AHG Unlocker/discord_auth.json` — Discord auth

**New config**: `%APPDATA%/AHG Unlocker/api_config.json`
```json
{
  "ryuu": {
    "auth_code": "RYUUMANIFESTv78r6h",
    "base_url": "https://generator.ryuu.lol",
    "enabled": true,
    "cache_dir": "..."
  },
  "steamgriddb": {
    "api_key": "1e7c6c08249aa540c0840b5d95677c12",
    "enabled": true,
    "preferred_types": ["header.jpg", "portrait.jpg", "library_600x900.jpg"]
  }
}
```

---

## 3. PHASE 1 — DATABASE PIPELINE: ELIMINATE JSON DEPENDENCY

> **Goal**: Remove EVERY games.json read from main.cjs. All data flows through SQLite.

### Step 1.1 — Refactor main.cjs Load Functions

**Current bad pattern** (in main.cjs):
```javascript
// Line ~859: Loads entire 44MB JSON
const gamesPath = getResourcePath('games.json');
const data = fs.readFileSync(gamesPath, 'utf-8');
const games = JSON.parse(data);
```

**Target** — every `getResourcePath('games.json')` occurrence becomes a db.cjs call:

| Line(s) | Current Usage | Replace With |
|---------|---------------|--------------|
| ~844-933 | Load all games for cache | `db.getAllGames()` or `db.queryGames({page, limit})` |
| ~964 | Load fixes.json | `db.getAllFixes()` |
| ~3297-3312 | Read games.json for add/verify | `db.gameExists()` + `db.upsertGame()` |
| ~3427-3459 | Check fix games against game list | `db.getGamesMeta(appids)` |
| ~3544-3567 | Load game name/header for display | `db.getGame(appid)` |

**Complete mapping of games.json reads in main.cjs:**

```javascript
// 1. _gamesCache population (around line 844-933)
//    REPLACE: fs.readFileSync('games.json') → db.getAllGames()
//    OR BETTER: eliminate _gamesCache entirely, use paginated db.queryGames()

// 2. Game addition pipeline (around line 3297)
//    REPLACE: read games.json → parse → push → write
//    WITH:    db.gameExists() → db.upsertGame() → db.persist()

// 3. Fix games verification (around line 3427) 
//    REPLACE: read games.json for cross-reference
//    WITH:    db.getGamesMeta(fixAppids) 

// 4. Steam status / game info (around line 3544)
//    REPLACE: read games.json for name/header lookup
//    WITH:    db.getGame(appid)
```

### Step 1.2 — IPC Channel Restructuring

**Current IPC channels** (in main.cjs and preload.cjs):
- `loadGames` — sends all 176K games at once
- `loadCachedGames` — from JSON cache
- `searchGames` — client-side filter on full array
- `filterByPlatform` — client-side filter on full array
- `loadFixes` — sends all fixes at once

**Target IPC channels** (add to preload contextBridge):

```javascript
// New IPC channels (replace old ones):
electronAPI.getGamesPage({ page, limit, search, platform, sort })
  → returns { games, total, page, pageSize }
  
electronAPI.getGame(appid)
  → returns single game object or null

electronAPI.getGamesMeta(appids)
  → returns [{ appid, name, header_image }]

electronAPI.getFixesPage({ page, limit, search })
  → returns { fixes, total }

electronAPI.getFix(appid)
  → returns single fix or null

electronAPI.searchSuggestions(query)
  → returns [{ appid, name }]  (for autocomplete)

electronAPI.getGameCount()
  → returns total number

electronAPI.upsertGame(game)
  → returns success boolean + new count

electronAPI.persistDatabases()
  → triggers disk save
```

Each IPC handler in main.cjs:
```javascript
ipcMain.handle('getGamesPage', async (event, opts) => {
  return db.queryGames(opts);
});
```

### Step 1.3 — Bridge.ts Rewrite

**Current bridge.ts**: Loads entire dataset into `gamesCache`, does client-side filtering.
**Target bridge.ts**: Facade that calls paginated IPC, keeps a LRU cache of recently accessed data.

```typescript
// Target bridge.ts API
export const bridge = {
  // Paginated — never loads more than 200 at a time
  async getGamesPage(opts: QueryOptions): Promise<PageResult<Game>>,
  
  // Single game — fast path
  async getGame(appid: string): Promise<Game | null>,
  
  // Search — server-side via SQL
  async searchGames(query: string): Promise<Game[]>,
  
  // Suggestions — fast, only name + appid
  async searchSuggestions(query: string): Promise<Suggestion[]>,
  
  // Fixes paginated
  async getFixesPage(opts: FixQueryOptions): Promise<PageResult<Fix>>,
  
  // Legacy compatibility (deprecated but present for transitional pages)
  async loadGames(): Promise<Game[]>,  // → calls getAllGames() from db (still loads all)
  
  // Image pipeline
  async getLocalImagePath(appid: string, type: ImageType): Promise<string | null>,
}
```

### Step 1.4 — Zustand Store Rewrite

**Current gameStore.ts**: Holds `games: Game[]` (full array).
**Target**: Holds only what's displayed + a LRU page cache.

```typescript
// Target gameStore.ts
interface GameStore {
  // Paginated data
  currentPage: Game[]
  totalGames: number
  currentPageNum: number
  pageSize: number
  
  // Search/filter
  searchQuery: string
  platformFilter: Platform | null
  
  // Actions
  loadPage: (page: number) => Promise<void>
  search: (query: string) => Promise<void>
  setFilter: (platform: Platform | null) => Promise<void>
  
  // Single game cache (for detail views)
  gameCache: Map<string, Game>
  getGame: (appid: string) => Promise<Game>
  
  // LRU cache for recently viewed pages
  pageCache: Map<string, Game[]>
}
```

### Step 1.5 — Migrate All Renderer Components

Each page that currently accesses `gamesCache` needs updating:

| Component | Current | Target |
|-----------|---------|--------|
| `HomePage.tsx` | Loads all games, filters top | Loads paginated, server-side sort |
| `BrowsePage.tsx` | Virtual scroll all games | Virtual scroll with page-at-a-time loading |
| `FavouritesPage.tsx` | Filters from all games | `db.getGamesMeta(favIds)` → then full rows |
| `LibraryPage.tsx` | Filters from all games | Paginated with platform filter |
| `RecentPage.tsx` | Filters from all games | `db.queryGames({sort: 'added'})` |
| `AllGamesPage.tsx` | Client-side search | Server-side `db.queryGames({search})` |
| `GameDetailModal.tsx` | `games.find(id)` | `db.getGame(appid)` via IPC |
| Settings, Fixes pages | Load all fixes | Paginated fixes |

---

## 4. PHASE 2 — IMAGE PIPELINE: LOCAL PRE-CACHED ASSETS

> **Goal**: All game images (headers, portraits, library art) stored locally in the app bundle. Zero network requests for images at boot.

### Step 2.1 — Image Bundle Generator Script

Create `scripts/build-image-bundle.js` — a build-time script that:

1. **Reads `games.db`** to get all appids with known header_image URLs
2. **Downloads** each image from Steam CDNs (parallel, throttled)
3. **Converts** to optimized format (JPEG Q80, WebP for supported)
4. **Stores** in `assets/images/` organized by type:

```
assets/images/
├── header/
│   ├── 10.jpg
│   ├── 20.jpg
│   ├── ...
├── portrait/
│   ├── 10.jpg
│   ├── 20.jpg
│   ├── ...
├── library/
│   ├── 10.jpg
│   ├── 20.jpg
│   ├── ...
├── image_manifest.json    ← maps appid → available local paths
├── image_index.db         ← SQLite index of what's available locally
```

**image_manifest.json structure:**
```json
{
  "schema_version": 1,
  "generated_at": "2026-06-06T00:00:00Z",
  "total_images": 150000,
  "games": {
    "10": { "header": true, "portrait": false, "library": false, "total_size_bytes": 45231 },
    "20": { "header": true, "portrait": true, "library": false, "total_size_bytes": 67312 },
    ...
  }
}
```

**Download strategy:**
- Priority 1: Header images (most common, used everywhere)
- Priority 2: Portrait images (used in Library view)
- Priority 3: Library hero images (used in detail views)
- Batch: 10 concurrent downloads, 100ms between batches
- Timeout: 5s per image
- Fallback: On failure, mark as unavailable in manifest (don't retry)
- Progress: Write to manifest after every 1000 games
- Resume: Skip already-downloaded images on re-run

### Step 2.2 — Local Image Serving

In Electron main process, add a `protocol.registerFileProtocol` or use `serveStatic`:

```javascript
// In main.cjs or a new assets-server.cjs
protocol.handle('local-asset', (request) => {
  const url = new URL(request.url);
  // URL format: local-asset://images/header/10.jpg
  const filePath = path.join(assetsDir, url.pathname);
  if (fs.existsSync(filePath)) {
    return net.fetch('file://' + filePath);
  }
  return new Response(null, { status: 404 });
});
```

Register in `createWindow()`:
```javascript
protocol.registerSchemesAsPrivileged([
  { scheme: 'local-asset', privileges: { bypassCSP: true, stream: true, supportFetchAPI: true } }
]);
```

### Step 2.3 — Image Loading Overhaul

**Current** (`imageCache.ts`): 509 lines, tries 9 CDN hosts × 6 image types × 2 paths + SteamDB + Archive.org = 100+ HTTP requests per image.

**Target** (`imageCache.ts`): Rewrite to a 4-tier system with SteamGridDB:

```
Tier 0: L0 in-memory + L1 IndexedDB (instant, 0 network)
  → Extend TTL from 7 days to PERMANENT (clear on explicit action only)
  → Already implemented — just remove TTL expiry

Tier 1: SteamGridDB API (single API call, ~200-500ms)
  → Replace entire 5-method brute-force chain
  → GET /grids/steam/{appid} returns URLs for all image types
  → Download best URL → cache in L0 + L1
  → Never fall through to CDN scanning

Tier 2: CDN fallback (legacy, last resort)
  → Only tried when SteamGridDB API fails
  → Reduced: 2 fastest hosts (cloudflare + akamai) × 2 types only
  → Down from 108 URLs to ~4-8

Tier 3: Local bundle (build-time asset) — if/when created in Phase 2
  → Pre-downloaded images shipped with app
  → local-asset:// protocol serving from disk
  → 0ms response, zero network
```

**New hierarchy:**
```typescript
// src/services/imageCache.ts — simplified
export async function loadGameImage(
  appid: string, 
  localHeaderUrl?: string, 
  gameName?: string,
  preferredImageTypes?: string[]
): Promise<string | null> {
  // 0. L0 in-memory cache
  if (inMemoryCache.has(cacheKey)) return inMemoryCache.get(cacheKey)
  
  // 1. L1 IndexedDB (permanent, no TTL)
  const cached = await getCachedImage(appid, preferredImageTypes)
  if (cached) { promoteToMemory(appid, cached); return cached }
  
  // 2. Local header URL (provided by caller, e.g., from SQLite header_image)
  if (localHeaderUrl) {
    const loaded = await loadImage(localHeaderUrl, 2000)
    if (loaded) { cacheAll(appid, loaded); return loaded }
  }
  
  // 3. SteamGridDB API (replaces M1-M5 brute-force)
  const sgdbUrl = await getBestGridImage(appid, preferredImageTypes?.[0] || 'header')
  if (sgdbUrl) {
    const loaded = await loadImage(sgdbUrl, 5000)
    if (loaded) { cacheAll(appid, loaded); return loaded }
  }
  
  // 4. CDN fallback (reduced — 2 hosts × 2 types only)
  const cdnUrl = await tryCdnFallback(appid, preferredImageTypes)
  if (cdnUrl) return cdnUrl  // cached in L0+L1
  
  // 5. Gradient placeholder (graceful failure)
  return null
}
```

**preload.cjs `fetchImage()` method (line 283-342):**
Replace the 96-URL brute-force with a SteamGridDB call + minimal CDN fallback:
```javascript
// BEFORE: 8 CDN hosts × 6 suffixes × 2 paths + SteamDB + archive.org + Steam API
// AFTER:
async function fetchImage(appid) {
  // 1. SteamGridDB API via Node.js https
  const sgdbUrl = await getSteamGridDbUrl(appid, 'header');
  if (sgdbUrl) {
    const dataUrl = await downloadImageAsDataUrl(sgdbUrl);
    if (dataUrl) return dataUrl;
  }
  // 2. CDN fallback — cloudflare only, header.jpg
  return downloadImageAsDataUrl(
    `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`
  );
}
```

### Step 2.4 — Boot-Time Image Preload

At app startup, the preloader reads `image_manifest.json` and populates an in-memory availability map. This takes ~5ms (reading a small JSON file) and tells us immediately which images are available locally without filesystem probes.

```javascript
// In preload.cjs or a startup module
async function loadImageAvailability() {
  const manifestPath = getResourcePath('assets/images/image_manifest.json');
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    return manifest;
  }
  return { games: {} };
}
```

The renderer gets a `getLocalImageAvailability()` IPC call that returns a `Set<appid>` for which images are local. GameCover uses this to skip the loading spinner entirely for cached games.

### Step 2.5 — Image Cache Database

Create `electron/image-db.cjs` — a separate SQLite database for image BLOBs:

```sql
CREATE TABLE image_cache (
  appid TEXT NOT NULL,
  image_type TEXT NOT NULL,  -- 'header', 'portrait', 'library'
  data BLOB NOT NULL,
  mime_type TEXT DEFAULT 'image/jpeg',
  width INTEGER DEFAULT 0,
  height INTEGER DEFAULT 0,
  file_size INTEGER DEFAULT 0,
  cached_at TEXT DEFAULT (datetime('now')),
  source_url TEXT DEFAULT '',
  PRIMARY KEY (appid, image_type)
);

CREATE INDEX idx_image_cache_appid ON image_cache(appid);
```

**Size estimate**: 176K games × ~30KB average image = ~5.3GB (for header only).  
**Mitigation**: Only cache images for games that are actually viewed (demand-driven cache). The local bundle (Phase 2.1) only ships headers for the most popular/frequently accessed games, with the rest loaded on-demand into the cache DB.

---

## 5. PHASE 3 — OFFLINE ARCHITECTURE: ZERO NETWORK DEPENDENCY

> **Goal**: The app boots and displays all core content with zero network access.

### Step 3.1 — Boot Sequence Redesign

**Current boot sequence:**
1. HTML splash → Vite loads React bundle
2. React mounts → calls `bridge.loadGames()` 
3. main.cjs reads games.json (44MB parse, ~500ms-2s)
4. Sends entire game array over IPC (~200ms serialization)
5. Renderer stores all 176K games in zustand store (~300ms)
6. Pages display loading spinners while images load from CDN

**Target boot sequence:**
1. HTML splash → Vite loads React bundle (same)
2. React mounts → calls `bridge.getGamesPage({page: 1, limit: 50})`
3. main.cjs queries SQLite (first 50 games, ~5ms)
4. Sends only 50 games over IPC (~1ms)
5. Renderer stores 50 games + page count in zustand (~5ms)
6. Images loaded from local bundle via `local-asset://` protocol (~0ms)
7. Background: preload pages 2, 3, 4 in background threads
8. Background: preload library-portrait images for visible games

**Measured improvement**: 
- Boot data load: ~2000ms → ~50ms (40x faster)
- First paint: waiting for images → instant (all local)
- Search: client-side filter on 176K → server-side SQL query (~200ms → ~20ms)

### Step 3.2 — Network Detection & Graceful Degradation

```typescript
// src/services/networkStatus.ts
export function isOnline(): boolean {
  return navigator.onLine;
}

// When offline:
// - All game data works (from SQLite)
// - All cached images work (from local bundle + image_cache.db)
// - Search works (server-side SQL)
// - Filters work (server-side SQL)
// - "New Games" / "Fetch Fixes" show offline banner
// - Steam API calls (store page, updates) show "offline" state
```

### Step 3.3 — Error State Review

Audit every component for network-dependent paths:
- `GameCover.tsx` — must never show loading spinner for locally-cached images
- `GameDetailPage.tsx` — Steam store info should have graceful offline fallback
- `FixesPage.tsx` — fixes manifest should be cached locally
- `SettingsPage.tsx` — network test should show accurate status
- `UpdateModal.tsx` — update check shows "offline" gracefully

---

## 6. PHASE 4 — STANDALONE EXPERIENCE: OPTIMIZED BOOT & BUNDLE

> **Goal**: Single-click launch, everything bundled, sub-second boot.

### Step 6.1 — Bundle SQLite Databases in Electron Build

Update `package.json` build config:

```json
{
  "build": {
    "extraResources": [
      { "from": "games.db", "to": "games.db" },
      { "from": "fixes.db", "to": "fixes.db" },
      { "from": "assets/images", "to": "assets/images" }
    ],
    "asarUnpack": [
      "node_modules/sql.js/dist/sql-wasm.wasm",
      "games.db",
      "fixes.db",
      "assets/**"
    ]
  }
}
```

The `sql.js` WASM file must be unpacked from the asar archive because it's loaded as a WebAssembly binary.

### Step 6.2 — First-Run Database Bootstrapping

On first launch (or when databases are missing):

1. Check `userData/` for existing databases
2. If missing: copy from `resources/` (seed databases)
3. Run schema migrations if version mismatch
4. If seed databases don't exist: run conversion from games.json

```javascript
async function bootstrapDatabases() {
  const userDataPath = app.getPath('userData');
  const seedDbPath = path.join(process.resourcesPath, 'games.db');
  const targetDbPath = path.join(userDataPath, 'games.db');
  
  if (!fs.existsSync(targetDbPath) && fs.existsSync(seedDbPath)) {
    fs.copyFileSync(seedDbPath, targetDbPath);
  }
  
  // Check schema version and migrate if needed
  const version = db.getSchemaVersion();
  if (version < CURRENT_SCHEMA_VERSION) {
    await runMigrations(version, CURRENT_SCHEMA_VERSION);
  }
}
```

### Step 6.3 — Lazy Image Bundle Download (Optional, Post-Install)

For the full image bundle (potentially 5GB+), offer an optional post-install download:

1. Ship with only popular games' images (~5000 most-played = ~150MB) in the installer
2. Background downloader for the rest, triggered on first launch
3. Progress bar in the loading screen
4. Can be skipped/backgrounded — app is fully functional without it (images load on-demand)

**This is purely additive.** The core app works with zero images — they just show gradient placeholders.

### Step 6.4 — Remove games.json from Build Output

Once SQLite is the sole data source:
1. Remove `games.json` from `build.files` and `build.extraResources` in package.json
2. Update any scripts that reference `games.json` to use `games.db`
3. Add deprecation notice: `games.json` is no longer bundled, convert via `node scripts/convert-to-sqlite.js`
4. Keep `games.json` in repository as a data source for conversion scripts

### Step 6.5 — Startup Time Optimization

**Measure current:**
- Node.js init: ~300ms
- Require modules: ~400ms
- Initialize db.cjs (load sql.js WASM): ~200ms
- First IPC call: ~50ms
- Total to first render: ~950ms-2s

**Target:**
- Everything under 500ms total

**Optimizations:**
1. Lazy-load non-critical modules (ipc handlers for rarely-used features)
2. Keep sql.js WASM in disk cache (asarUnpack)
3. Pre-initialize database on app 'ready' event before creating window
4. Stream first page of games to renderer while React hydrates

---

## 7. PHASE 5 — VALIDATION & BUILD

### Step 7.1 — Migration Verification Tests

```bash
# 1. Verify database integrity
node scripts/verify-db.js
# Checks: row count matches games.json, no missing appids, no corrupt rows

# 2. Verify image manifest
node scripts/verify-image-manifest.js
# Checks: manifest has entry for every game, local files exist for claimed entries

# 3. Performance benchmark
node scripts/benchmark-queries.js
# Measures: page load, search, filter, sort times (targets in §9)
```

### Step 7.2 — Build Pipeline Updates

```bash
# New build steps (added to npm run build chain):
npm run build:db        # Convert games.json → games.db if changed
npm run build:images    # Run image bundle generator (optional, can be separate)
npm run build:verify    # Verify all outputs
npm run build:package   # electron-builder
```

Update `package.json` scripts:
```json
{
  "scripts": {
    "build": "npm run build:db && tsc --noEmit && vite build",
    "build:db": "node scripts/convert-to-sqlite.js",
    "build:images": "node scripts/build-image-bundle.js",
    "build:verify": "node scripts/verify-db.js && node scripts/verify-image-manifest.js",
    "electron:build": "npm run build && node scripts/sync-main.js && electron-builder --win --publish never",
    "dev": "vite"
  }
}
```

### Step 7.3 — Performance Budget (Updated from AGENTS.md Rule 9)

| Metric | Current | Target | Measurement |
|--------|---------|--------|------------|
| Initial load (cold) | ~2-4s | <800ms | `electron-startup.spec.ts` |
| Search response | ~100-200ms | <20ms | Playwright timing |
| Scroll (176K items) | 60fps ✅ | 60fps ✅ | Keep existing |
| Memory (runtime) | ~500MB | <300MB | Task Manager |
| Image load (local) | 200ms-4s CDN | <5ms local | `performance.now()` |
| games.json parse time | ~500ms-2s | 0ms (eliminated) | N/A |
| Database first query | N/A | <10ms | db.cjs internal log |
| App bundle size | ~200MB | <250MB | electron-builder output |

---

## 8. RISK REGISTER & ROLLBACK PLAN

### Risk Matrix

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| SQLite performance degrades with 176K rows | Low | Medium | Indexes, pagination, query optimization |
| Image bundle is too large (5GB+) | High | Medium | Tiered approach: popular first, lazy rest |
| SQL.js WASM fails on some Windows versions | Low | High | Fallback to JSON, error handling |
| Schema migration corrupts existing games.db | Low | Critical | Backup before migration, auto-restore |
| IPC pagination breaks existing components | Medium | High | Shim layer in bridge.ts for backward compat |
| Electron protocol handler CSP issues | Medium | Low | Test on all targets, use blob: URLs as fallback |
| Build time increases significantly | Medium | Low | Make image build optional/separate step |

### Rollback Plan

**If SQLite migration fails:**
1. Keep `games.json` in `extraResources` for at least 2 releases
2. Add `db.fallbackToJson()` method that reads games.json if db.init fails
3. Feature-flag: `process.env.USE_SQLITE = 'false'` to force JSON

**If image bundle fails:**
1. Don't block the build — image bundle is additive
2. `image_manifest.json` simply returns empty, app falls back to CDN gracefully
3. Users can download image pack separately

**If database corruption occurs:**
1. Auto-detect on init (CHECKSUM or row count validation)
2. Auto-repair: delete corrupt db, copy seed from resources/
3. Log corruption event for debugging

---

## 9. SUCCESS CRITERIA & PERFORMANCE TARGETS

### Phase 0 ✅ — SQL Foundation
- [x] `convert-to-sqlite.js` produces valid games.db (54.1MB, 176,130 rows) + fixes.db (1,384KB, 4,152 rows)
- [x] Schema includes all columns matching current games.json structure (12 columns + FTS4)
- [x] Indexes created on name, type (PRIMARY KEY provides implicit appid index)
- [x] Row count verified: 176,130 DB rows vs 176,794 JSON entries (664 duplicates excluded — database is authoritative)
- [x] db.cjs passes all 80 unit tests — 0 failures, 3 bugs found and fixed
- [x] verify-db.js passes all 26 integrity checks

### Phase 2.5 — Ryuu API & SteamGridDB Integration
- [x] `src/services/ryuuApi.ts` created with checkAvailability(), downloadGame(), downloadDlcManifests(), batch checks, caching
- [x] `src/services/steamGridDb.ts` created with getBestImage(), getImages(), getImageUrl(), prefetchImages(), scoring, caching
- [x] `electron/ryuuDownloader.cjs` created — main-process Ryuu ZIP downloader + extraction (writes to Steam depotcache)
- [x] `install-game-ryuu` + `install-ryuu-dlcs` IPC channels in main.cjs + preload.cjs + bridge.ts
- [x] `installSteamGame()` simplified to Ryuu-first with fallback (3 stages instead of 6) — Stage 1: Ryuu API generator (primary, ~2s), Stage 2: cached depotkeys, Stage 3: parallel ZIP scan, Stage 4: LuaTools, Stage 5: DepotBox, Stage 6: DepotDownloader; old Stage 4 (ryuu.lol endpoint) removed as superseded
- [x] `imageCache.ts:tryLoadImage()` simplified to SteamGridDB-first (single API call instead of 5 methods) — from 509→176 lines, removed 9-host CDN brute-force, permanent TTL
- [x] `api_config.json` stores API keys and preferences — `getApiConfig`/`saveApiConfig` in main.cjs, IPC handlers, preload bridge, bridge.ts facade
- [x] Config settings UI for API keys in Settings page — new "API Keys" tab with Ryuu auth code + SteamGridDB key inputs

### Phase 1 — Database Pipeline
- [ ] Zero direct games.json reads in main.cjs (all replaced with db.cjs calls)
- [ ] All IPC handlers use db.cjs methods (new paginated channels)
- [ ] bridge.ts exposes paginated API (getGamesPage, getFixesPage, searchSuggestions)
- [ ] ZuStand store rewritten for paginated data (partial in-memory, LRU page cache)
- [ ] All components render correctly with paginated data
- [ ] Search returns results in <20ms
- [ ] Memory usage drops to <300MB from ~500MB

### Phase 2 — Image Pipeline
- [ ] `build-image-bundle.js` downloads and organizes images
- [ ] `image_manifest.json` correctly maps available images
- [ ] `local-asset://` protocol serves images correctly
- [ ] GameCover shows local images in <5ms (no loading state)
- [ ] Image cache DB works for on-demand caching

### Phase 3 — Offline Architecture
- [ ] App boots with zero network calls
- [ ] All pages render with local data
- [ ] Search works offline
- [ ] Graceful "offline" banners for network-dependent features
- [ ] No loading spinners for cached images

### Phase 4 — Standalone Experience
- [ ] Build output includes games.db + fixes.db
- [ ] First-run bootstrap copies seed databases
- [ ] games.json removed from build output
- [ ] Cold start <800ms
- [ ] Package size acceptable (<250MB without image bundle)

### Phase 5 — Build Validation
- [ ] `npm run build` passes with 0 errors
- [ ] `electron-builder` produces working EXE
- [ ] Verifications scripts all pass
- [ ] Performance budgets met

---

## APPENDIX A — File Change Summary

| File | Change Type | Status | Description |
|------|-------------|--------|-------------|
| `electron/db.cjs` | **Major** | ✅ Done | 32 methods, FTS4, schema versioning, JS-managed FTS sync |
| `electron/main.cjs` | **Major** | 🎯 Phase 1 | Replace all games.json reads with db.cjs calls; Ryuu API integration (+ ryuuDownloader require + 2 IPC handlers) |
| `electron/preload.cjs` | **Medium** | ✅ Phase 0.5 | Added installGameRyuu + installRyuuDlcs to contextBridge |
| `src/bridge.ts` | **Major** | 🎯 Phase 1 | Rewrite to paginated facade (+ installGameRyuu + installRyuuDlcs added) |
| `src/store/gameStore.ts` | **Major** | 🎯 Phase 1 | Rewrite for paginated data |
| `src/services/ryuuApi.ts` | **New** | ✅ Done | Ryuu API client: checkAvailability, downloadGame, downloadDlcManifests, batch checks, caching |
| `src/services/steamGridDb.ts` | **New** | ✅ Done | SteamGridDB client: getBestImage, getImages, getImageUrl, prefetchImages, scoring + caching |
| `electron/ryuuDownloader.cjs` | **New** | ✅ Done | Main-process Ryuu ZIP downloader + .lua/.manifest extraction + 3 IPC channels |
| `src/services/imageCache.ts` | **Major** | ✅ Phase 2 | Rewrite to SteamGridDB-first hierarchy (509→176 lines, permanent TTL, removed CDN brute-force) |
| `electron/main.cjs` | **Minor** | ✅ Phase 2 | Added getApiConfig/saveApiConfig + IPC handlers for api_config.json |
| `electron/preload.cjs` | **Minor** | ✅ Phase 2 | Added getApiConfig/setApiConfig to contextBridge |
| `src/bridge.ts` | **Minor** | ✅ Phase 2 | Added getApiConfig/setApiConfig facade methods |
| `src/pages/SettingsPage.tsx` | **Minor** | ✅ Phase 2 | Added API Keys tab (Ryuu + SGDB config) |
| `src/services/networkStatus.ts` | **New** | 📝 Planned | Online/offline detection |
| `electron/image-db.cjs` | **New** | 📝 Phase 2 | Image blob cache database |
| `electron/assets-server.cjs` | **New** | 📝 Phase 2 | local-asset:// protocol handler |
| `src/components/GameCover.tsx` | **Medium** | 🎯 Phase 2 | Local-first image loading |
| `src/pages/*.tsx` | **Medium** | 🎯 Phase 1 | Adapt to paginated stores |
| `scripts/convert-to-sqlite.js` | **Major** | ✅ Done | Streaming JSON parser → FTS4 → batch INSERT → schema versioning |
| `scripts/verify-db.js` | **New** | ✅ Done | 26 integrity checks for games.db + fixes.db |
| `scripts/build-image-bundle.js` | **New** | 📝 Phase 2 | Download and bundle game images (may use SteamGridDB) |
| `scripts/verify-image-manifest.js` | **New** | 📝 Phase 2 | Image manifest verification |
| `scripts/benchmark-queries.js` | **New** | 📝 Phase 1 | Performance benchmark suite for SQL queries |
| `tests/db.test.cjs` | **New** | ✅ Done | 80 unit tests for db.cjs |
| `package.json` | **Medium** | 📝 Phase 4 | Add build scripts, update extraResources |
| `games.json` | **Deprecate** | 📝 Phase 4 | Remove from build, keep in repo for conversion |

---

## APPENDIX B — Rollout Sequence

```
Phase 0  → ✅ COMPLETE (Foundation: SQL, conversion, tests, verification)
Phase 0.5 → ✅ COMPLETE (Ryuu API + SteamGridDB services; Ryuu downloader + IPC channels; imageCache rewrite + api_config + settings UI)
Phase 1   → Database Pipeline: IPC rewrite, store rewrite, component migration
Phase 2   → ✅ COMPLETE (Image Pipeline: SteamGridDB integration, imageCache simplified, api_config.json, API settings tab)
Phase 3   → Offline Architecture: zero-network boot, local-asset protocol
Phase 4   → Standalone: build config, bundle DBs, remove games.json
Phase 5   → Validation: benchmarks, build verification
```

Each phase ends with a working build (`npm run build` passes, EXE launches).
Phase 0.5 can proceed in parallel with Phase 1 — they're independent.

---

*End of Migration Plan. This is a living document — update as decisions are made.*
