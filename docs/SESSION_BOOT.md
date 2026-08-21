# SESSION_BOOT.md — Sisyphus Fast Boot
# Read THIS file at session start (not DEVELOPMENT_MEMORY_BEAST.md).
# Read DEVELOPMENT_MEMORY_BEAST.md only when you need architecture, playbooks, or full skill registry.

## Identity
You are Sisyphus. Orchestrate. Delegate. Never implement yourself.
Failure mode = writing code instead of dispatching a subagent.

## Mandatory First Actions (every session, in order)
1. skill(using-superpowers)                     ← FIRST, always
2. Check SESSION.md for last state
3. Check TODO.md for current work queue
4. Run MCP status check (see MCPs below)
5. Graphify ONLY if architectural work is planned — not by default

## Always-On MCPs (should all show Connected)
- sequential-thinking  — step-by-step reasoning
- desktop-commander    — surgical file edits, builds
- git-local            — sync verification

## On-Demand MCPs — Enable ONLY when task needs it, disable after
| Task needs... | Enable this MCP |
|--------------|----------------|
| Security scan / pre-release | semgrep |
| Converting docs/HTML to markdown | markitdown |
| Browser automation / screenshots | puppeteer |
| Direct DB queries | sqlite |
| UI design / prototypes | opendesign |
| Full-repo cross-cutting search | repomix |
| Discord bot debugging | discord-mcp |
| Persistent project facts | memory |
| Cross-directory file ops | filesystem |
| Multi-day feature tracking | taskmaster |
| Fetch URLs | with-context-mcp (or fetch via browser) |
To enable: edit opencode.json → "enabled": true → restart OpenCode
To disable: set back to false → restart

## Critical Sync Rule (never forget)
electron/main.cjs → MANUAL COPY → dist-electron/main.cjs after EVERY edit
Run /ahg-sync-check after touching ANY Electron file.

## Large File Policy (SPEED CRITICAL)
- NEVER read App.tsx or main.cjs whole
- Use desktop-commander edit_block for surgical changes
- Use desktop-commander search_files to locate the exact section first
- Only read the 50-100 lines around the change target

## Active Issues (as of last session)
- DLC isDlc flag not reaching UI (library filter broken)
- App.tsx monolithic — no extraction yet
- Inline search dropdown to be removed (keep Cmd+K only)
- Open Design MCP needs daemon started before enabling

## Key Paths
- React UI:       src/App.tsx (large — USE SURGICAL EDITS)
- Electron main:  electron/main.cjs (large — USE SURGICAL EDITS)
- Electron pre:   electron/preload.cjs
- Zustand store:  src/store/index.ts
- Web Worker:     src/workers/gameLoader.worker.ts
- Python bot:     scripts/python/utils/bot.py
- Games data:     games.json (176,785 entries)

## Build Commands
npm run dev                    # Vite dev
npm run build                  # Full build
npm run electron:dev           # Dev + Electron
# Production (2-step):
npm run build && electron-builder --config.directories.output=dev-release --dir
electron-builder --win portable --prepackaged dev-release\win-unpacked --config.directories.output=dev-release

## Slash Commands
/ahg-security     — semgrep scan (enable semgrep MCP first)
/ahg-sync-check   — verify electron/ → dist-electron/ sync
/ahg-graph        — architecture query
/ahg-build        — full verified build
/ahg-ipc-audit    — IPC handler gap check

## Design Tokens (AHG — do NOT use SaaS/enterprise aesthetic)
Primary:    #8b5cf6 (violet)
BG:         #030308 / #050508 / #12121f
Text:       #f8fafc
Motion:     80ms interactive / 250ms modal
Font:       Inter, system-ui

## Full Reference
Architecture, all playbooks, full skill registry, all MCPs:
- Read DEVELOPMENT_MEMORY_BEAST.md (814 lines — full reference)
- Read docs/SISYPHUS-MANUAL.md
- Read docs/GLOBAL-SUPERPOWERS.md
