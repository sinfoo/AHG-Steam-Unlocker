# AHG Unlocker — About

> **Professional Steam Game Manager** — Browse, install, and manage a library of 176K+ games with a premium dark UI. v0.90.0

---

## What It Is

AHG Unlocker is a desktop application (Electron + React) that lets users install and manage unlocked Steam games via **manifest injection**. It bypasses Steam's native DRM by downloading game manifests from 97 community mirror repos, writing SteamTools-compatible `.lua` activation files, and managing the entire install lifecycle — from discovery to DLC registration — through a dark-themed React UI.

---

## Core Features

| Feature | Description |
|---------|-------------|
| **Game Browser** | Search, filter, and browse 176,785 games across 97 manifest repos. Web Worker prefix trie search returns results in <50ms. |
| **One-Click Install** | Inject Steam manifests to add games to your library. Supports multiple install methods (direct manifest, Ryuu, ZIP-based). |
| **Fixes System** | Apply 497+ community fixes (Goldberg, Steamless, Online-Fix, etc.) to make games work. Custom fixes synced from remote. |
| **Favorites & Collections** | Organize your game library with favorites, collections, pinned games, and user-defined tags. |
| **DLC Management** | Auto-detect and register DLCs for installed games. Batch DLC install support. |
| **Discord Integration** | OAuth login, guild membership verification, share games to Discord, rich presence. |
| **Auto-Updates** | Checks GitHub releases, downloads and installs updates in-app with progress. |
| **License System** | Activation/deactivation with machine fingerprinting. |
| **Offline Mode** | Cache manifests locally for offline installation. |
| **Context Menu** | Native Electron context menu with install, fix, share, open folder actions. |
| **Remote Sync** | Automatically sync new games and fixes from remote sources on startup. |
| **Quick Tools** | Fix no-internet, fix no-shows, clear cache, restart Steam, open Steam folder. |
| **Game Sharing** | Share installed games to Discord channels. |
| **Owned Game Detection** | Detect Steam-owned games to avoid conflicts. |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop Shell | Electron 33 |
| UI Framework | React 18 + TypeScript |
| Build Tool | Vite 7 |
| Styling | Tailwind CSS 4 + CSS custom properties |
| State Management | Zustand 5 (12 stores, shallow selectors) |
| Animation | Framer Motion 11 + CSS transitions (80ms cubic-bezier) |
| Virtual Scrolling | @tanstack/react-virtual |
| Search Engine | Web Worker + prefix Trie |
| Image Cache | In-memory LRU (hot/warm/cold) + IndexedDB |
| Database | SQLite via sql.js |
| Protocol Buffers | protobufjs (Steam manifest format) |
| CI | Playwright config for E2E tests |
| Code Quality | eslint + TypeScript strict-ready |

---

## Project Structure (Condensed)

```
AHG Unlocker/
├── electron/
│   ├── main.cjs            # Electron main process (~3,459 lines) — IPC handlers, Steam integration, manifest download, license, Discord OAuth
│   ├── preload.cjs          # Context bridge (contextBridge.exposeInMainWorld)
│   └── handlers/            # Modular IPC handler modules
├── src/
│   ├── App.tsx              # Main React app (~1,076 lines) — store subscriptions, hook orchestration
│   ├── bridge.ts            # Type-safe IPC wrapper (~1,264 lines) — LRU page cache, timing
│   ├── types/               # TypeScript type definitions
│   ├── components/          # 40+ React components
│   │   ├── cards/           # GameCard, LibraryCard, PortraitCard, FixGridCard, EmptyState
│   │   ├── home/            # BentoCard, FeaturedCarousel, GameSection, GenreRow, etc.
│   │   └── ui/              # Modal, Button, Input, Select, Badge, Toggle, Tooltip
│   ├── pages/               # 7 pages: Home, Browse, Library, Fixes, Settings, Favourites, Recent
│   ├── store/               # 12 Zustand stores (gameStore, uiStore, settingsStore, installStore, etc.)
│   ├── hooks/               # 20+ custom hooks (useGameFilters, useLazyImage, useAppState, etc.)
│   ├── services/            # API services, imageCache, placeholderGenerator, steamGridDb
│   ├── workers/             # searchWorker (prefix trie), gameLoader.worker
│   ├── styles/              # home-animations.css, loading animations
│   └── constants/           # colors.js, colors.ts
├── scripts/                 # PowerShell helpers, build scripts, Python tools for fixes/games data
├── docs/
│   ├── DESIGN.md            # Design tokens — source of truth for all UI
│   ├── PRODUCT.md           # Product context, brand tone, strategic principles
│   ├── DECISIONS.md         # 12 permanent architectural decisions
│   ├── SISYPHUS-MANUAL.md   # Agent operating procedures
│   ├── GLOBAL-SUPERPOWERS.md # Skill registry, agent registry, playbooks
│   └── DEVELOPMENT_MEMORY_BEAST.md  # Full intelligence stack reference
├── resources/               # games.json (176,785 entries), fixes.json (497+ entries)
├── AGENTS.md                # Sisyphus autonomy charter, project rules, MCP routing
├── SESSION.md               # Active session state, work log, error registry
├── TODO.md                  # Full task queue with priorities
└── SKILLS-INSTALLED.md      # Skill audit log
```

---

## Core Architecture Decisions

1. **SQLite over in-memory JSON**: Games data moved from JSON (+30MB in memory) to SQLite with paginated queries — critical for 176K entries
2. **IPC Bridge pattern**: Type-safe Electron ↔ React communication via `preload.cjs` + `bridge.ts` with LRU page cache and IPC timing
3. **Lazy loading**: All 7 pages + 24 modals are `React.lazy()` with individual Suspense boundaries
4. **Domain-driven stores**: Monolithic store → 12 domain stores (game, UI, settings, install, progress, queue, modal, download, fix, scan, updates, user, discord)
5. **Design token system**: `docs/DESIGN.md` is the single source of truth — no hardcoded colors, spacing, or motion values
6. **One-component-at-a-time refactoring**: App.tsx was ~3,478 lines, being methodically decomposed one component at a time
7. **No git automation**: All git operations are manual by the user

---

## Performance Targets

| Metric | Target | Implementation |
|--------|--------|----------------|
| Initial load | <2s | Lazy loading, SQLite pagination, splash screen with progress |
| Search response | <100ms | Web Worker prefix trie |
| Scroll | 60fps (144Hz) | TanStack Virtual for >100 items |
| Memory (idle) | <300MB | LRU page cache, no full dataset in memory |
| Memory (peak) | <500MB | Chunked loads, proper cleanup |
| Animation | 80ms transitions | CSS cubic-bezier(0.4, 0, 0.2, 1) |
| Build time | <30s full | Vite 7 + manualChunks splitting |
| Bundle (main) | <500KB gzipped | Code splitting into vendor-* chunks |

---

## Key Architectural Patterns

### Image Pipeline
```
User request → LRU hot cache → LRU warm cache → LRU cold cache → IndexedDB → Parallel CDN fallback (Promise.any over 16 URL combos) → Placeholder gradient
```

### Search Engine
```
Prefix Trie (built at init) → Web Worker → postMessage results → React state → Virtual list render
<50ms for 176K entries
```

### Install Flow
```
User clicks "Add to Steam" → bridge.installGame(appid) → IPC → main.cjs handler → Download manifests from mirror repos → Write .lua activation files → Register with Steam → Return success
```

---

## Design Philosophy

**Dark, confident, energetic** — Inspired by Discord and modern game launchers. Violet accent (#8b5cf6) as the signature color.

- Dark is not a default — it's a requirement (gaming PCs in dim rooms)
- Performance matters as much as appearance
- Every animation serves understanding, not decoration
- One-click install is the north star
- No SaaS/enterprise design, no generic AI aesthetic, no skeuomorphic "gamer" clichés

---

## License

Proprietary. Developed by sinfo.
