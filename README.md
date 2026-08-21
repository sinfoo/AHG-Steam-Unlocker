# AHG Unlocker

**Professional Steam Game Manager** — Browse, install, and manage a library of 176K+ games with a premium dark UI.

Built with Electron + React + TypeScript + Vite + Tailwind CSS.

---

## Features

- **Game Browser** — Search, filter, and browse 176,785 games across 97 manifest repos
- **One-Click Install** — Inject Steam manifests to add games to your library
- **Fixes System** — Apply community fixes from 497+ fix entries
- **Favorites & Collections** — Organize your game library
- **Dark Premium UI** — Full dark theme, glassmorphism, animated loading screen
- **Keyboard Navigation** — Arrow keys for featured carousel, Ctrl+F for search
- **Performance** — Web Worker search (prefix trie), image cache with LRU, TanStack Virtual scrolling
- **Cross-Platform** — Windows (primary), Linux (Electron)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop Shell | Electron 33 |
| UI Framework | React 19 + TypeScript |
| Build Tool | Vite 6 |
| Styling | Tailwind CSS 4 + CSS custom properties |
| State Management | Zustand (12 stores, shallow selectors) |
| Animation | Framer Motion + CSS transitions (80ms cubic-bezier) |
| Virtual Scrolling | @tanstack/react-virtual |
| Search Engine | Web Worker + prefix Trie |
| Image Cache | In-memory LRU (hot/warm/cold) + Native Electron disk cache with `image-cache://` custom protocol |
| Code Quality | eslint + prettier + TypeScript strict-ready |
| CI | Playwright config for E2E tests |

---

## Project Structure

```
AHG Unlocker/
├── src/
│   ├── components/         # React components
│   │   ├── cards/          # GameCard, LibraryCard, PortraitCard, FixGridCard, EmptyState
│   │   ├── home/           # BentoCard, FeaturedCarousel, GameSection, GenreRow, etc.
│   │   ├── ui/             # Modal, Button, Input, Select, Badge, Toggle, Tooltip
│   │   ├── SearchBar/      # Search input with dropdown
│   │   └── ...             # 40+ modal/panel components
│   ├── pages/              # HomePage, BrowsePage, LibraryPage, FixesPage, etc.
│   ├── store/              # Zustand stores (gameStore, uiStore, settingsStore, etc.)
│   ├── hooks/              # useGameFilters, useLazyImage, useAppState, etc.
│   ├── services/           # imageCache, placeholderGenerator, etc.
│   ├── workers/            # searchWorker (prefix trie)
│   ├── styles/             # home-animations.css, loading animations
│   └── types/              # TypeScript type definitions
├── electron/
│   ├── main.cjs            # Electron main process (3.5K lines)
│   ├── preload.cjs         # Context bridge for IPC
│   └── handlers/           # IPC handler modules
├── scripts/                # Build scripts, PowerShell helpers, Python tools
├── docs/                   # Product docs, design tokens, architecture memory
└── .omo/                   # Planning files, optimization roadmap
```

---

## Getting Started

```bash
# Install dependencies
npm install

# Development
npm run dev

# Type check
npm run typecheck

# Build
npm run build

# Build dev portable EXE
npx electron-builder --config.directories.output=dev-release --dir
npx electron-builder --win portable --prepackaged dev-release\win-unpacked --config.directories.output=dev-release

# Lint
npm run lint
```

---

## Performance Budget

| Metric | Target |
|--------|--------|
| Initial load | <2s |
| Search response | <100ms |
| Scroll | 60fps (144Hz compatible) |
| Memory (idle) | <300MB |
| Memory (peak) | <500MB |
| Animation | 80ms interactive transitions |
| Build time | <30s full, <5s incremental |
| Bundle (main chunk) | <500KB gzipped |

---

## Architecture Highlights

- **IPC Bridge**: Type-safe Electron ↔ React communication via `preload.cjs` + `bridge.ts`
- **Lazy Loading**: All 7 pages + 24 modals are `React.lazy()` with individual Suspense boundaries
- **Design Tokens**: Single source of truth in `docs/DESIGN.md` — colors, spacing, typography, motion
- **Image Pipeline**: Parallel CDN fallback (Promise.any over 16 URL combinations), LRU cache (hot/warm/cold), native Electron disk cache via `image-cache://` custom protocol, placeholder gradients
- **Search**: Prefix trie in Web Worker handles 176K+ game names, results in <50ms
- **Memory MCP**: Persistent cross-session memory via Obsidian vault

---

## Key Files

| File | Purpose |
|------|---------|
| `AGENTS.md` | Sisyphus autonomy charter, project rules |
| `SESSION.md` | Active session state, work log, error registry |
| `TODO.md` | Full task queue with priorities and history |
| `docs/DESIGN.md` | Design tokens — source of truth for all UI |
| `docs/PRODUCT.md` | Product context, brand tone, strategic principles |
| `docs/DECISIONS.md` | Permanent architectural decisions |
| `master-optimization-v1.md` | 6-track optimization roadmap |

---

## License

Proprietary. Developed by sinfo.
