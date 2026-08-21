# Development Memory — AHG Unlocker
_Last updated: 2026-06-18 (TRIMMED — full version archived. This file now contains only architecture, rules, facts, and status. ~30KB removed.)_

---

## MANDATORY BOOT SEQUENCE

```
STEP 1 → Read docs/SISYPHUS-MANUAL.md     — Operating procedures, delegation patterns
STEP 2 → Read AGENTS.md                    — Project-specific overrides
STEP 3 → Read SESSION.md                   — Last session context, open issues
STEP 4 → Read TODO.md                      — Prioritized work items
STEP 5 → Run compaction analysis + set
```

**Conditional (read only when relevant):**
- `docs/DECISIONS.md` — Before architecture changes
- `docs/GLOBAL-SUPERPOWERS.md` (trimmed) — For routing decisions

---

## ARCHITECTURE OVERVIEW

```
filesOPENCODE/
├── src/                      # React/TypeScript UI source
│   ├── App.tsx               # ~3478 lines (15 modals extracted)
│   ├── bridge.ts             # IPC bridge layer (337 lines)
│   ├── main.tsx              # React entry point
│   ├── index.css             # Global styles (529 lines)
│   ├── components/           # 34 UI components
│   ├── services/             # imageCache.ts, api.ts, steamApi.ts
│   ├── store/index.ts        # Zustand stores
│   ├── hooks/useGames.ts     # Game loading hook
│   ├── types/index.ts        # TypeScript interfaces
│   └── workers/gameLoader.worker.ts
│
├── electron/                 # Electron main process
│   ├── main.cjs              # 3459 lines ← MUST sync to dist-electron
│   └── preload.cjs           # Context bridge (391 lines)
│
├── scripts/                  # 105 Python + 29 PowerShell + 14 JS scripts
├── docs/                     # 18 documentation files
├── games.json                # 176,785 Steam game entries
├── fixes.json                # 497 fix entries
├── dist-electron/win-unpacked/# Packaged Windows build
├── backend/                  # Python FastAPI backend
├── bridge/                   # Python PyWebView bridge
├── core/                     # C# Steam operations
└── depotdownloader/          # DepotDownloader binaries
```

### Critical Sync Rule
`electron/main.cjs` ↔ `dist-electron/main.cjs` must always be byte-identical.

---

## KEY TECHNICAL FACTS

```
Entity: project
  - name: AHG Unlocker
  - type: Electron + React desktop app
  - purpose: Install unlocked Steam games via manifest injection
  - stack: React 19, TypeScript, Vite, Zustand, Framer Motion, TanStack Virtual, Electron
  - backend: Python FastAPI (localhost:8765), C# .NET 8 (Steam ops)
  - accent-color: #8b5cf6 (violet), bg-primary: #030308, font: Inter
  - games-count: 176785, fixes-count: 497
  - bundle-size: ~689KB JS, build-time: ~11.8s (1574 modules)

Entity: file:electron/main.cjs
  - lines: 3459, repos-count: 97 manifest repos
  - criticality: HIGHEST

Entity: file:src/App.tsx
  - lines: 3478, status: partially refactored

Entity: constraint:design
  - no-saas-white, no-glassmorphism-default, no-rgb-rainbow, no-enterprise-blue

Entity: performance-targets
  - initial-load: <2s, search-response: <100ms, scroll: 60fps, memory: <500MB

Entity: mcp-stack
  - always-on: sequential-thinking, memory, filesystem, fetch, time, git, semgrep, desktop-commander, markitdom, websearch, playwright
```

---

## PROJECT-SPECIFIC RULES

**Rule 1 — Design Integrity:** Never deviate from DESIGN.md without user confirmation.

**Rule 2 — IPC Safety:** Every `ipcMain.handle()` needs `contextBridge` in preload + TS wrapper in bridge.ts. Run `/ahg-ipc-audit` after IPC work.

**Rule 3 — Manifest Repo Safety:** Never log tokens. Never expose repo contents to renderer. Validate `.lua` before writing.

**Rule 4 — Games Data Safety:** Never overwrite games.json or fixes.json — always merge.

**Rule 5 — Build Must Pass:** No task is "done" unless `npm run build` produces 0 NEW errors.

**Rule 6 — Memory Is Mandatory:** Write to Memory MCP + DEVELOPMENT_MEMORY.md + SESSION.md every session.

**Rule 7 — Skill Autonomy:** Use any skill freely. No permission needed.

**Rule 8 — Open Design First:** Prototype with Open Design before implementing new screens from scratch.

**Rule 9 — Performance Budget:** TanStack Virtual for >100 items, imageCache.ts for images, 80ms transitions.

**Rule 10 — Context7:** Add "use context7" for all Electron/React/Vite/Framer Motion/Zustand/TanStack queries.

---

## CURRENT STATUS (as of 2026-06-18)

### Completed
- ✅ Phase 2 refactoring: App.tsx 4800 → 3478 lines, 15 modals extracted
- ✅ 6 MCP servers active in opencode.json
- ✅ games.json: 176,785 entries
- ✅ Bot.py: all commands guild-scoped, persistent Views
- ✅ P0 LuaTools Multi-Source Import System (2026-05-15)
- ✅ 100K token absorption investigation — root cause found (4-track fix approved: reduce compaction reserves, trim GLOBAL-SUPERPOWERS.md, trim DEVELOPMENT_MEMORY_BEAST.md, remove 34 duplicate skills, reduce AGENTS.md boot files)

### In Progress / Known Issues
- ⚠️ GLOBAL-SUPERPOWERS.md TRIMMED — full version archived
- ⚠️ DEVELOPMENT_MEMORY_BEAST.md TRIMMED — full version archived
- ⚠️ 34 duplicate skills removed from `grillme/.claude/skills/`
- ⚠️ App.tsx at ~3478 lines (Phase 3 refactoring pending)
- ⚠️ uiStore.ts duplicate key warning (pre-existing, non-blocking)
- ⚠️ Chunk size warning in Vite (pre-existing, non-blocking)

---

## Session — 2026-06-18 — 100K Token Absorption Investigation

- **Root cause analysis**: 3 potential sources identified (excessive compaction reserves, bloated doc files, duplicate skill registry)
- **Findings**:
  1. opencode.json `preserve_recent_tokens: 32000` + `reserved: 32000` = 64K tokens minimum per turn
  2. GLOBAL-SUPERPOWERS.md: 833 lines / ~38.6KB — large chunk loaded at boot
  3. DEVELOPMENT_MEMORY_BEAST.md: 829 lines / ~39.1KB — large chunk loaded at boot
  4. 34 duplicate skills from `grillme/.claude/skills/` bloating skill registry scan
  5. AGENTS.md listed 8 mandatory boot files
- **Fixes applied**: compaction reserves 32K→8K, both docs trimmed to ~80% reduction, grillme skills deleted, boot sequence reduced to 5 mandatory files
- **Next steps**: Compression settings will follow system-level compaction (auto: true, prune: true, tail_turns: 3)
