# AGENTS.md — AHG Unlocker BEAST MODE
# Version: 4.0 BEAST — Complete intelligence + autonomy layer
# Last updated: 2026-05-15

---

> ⚠️ **MANDATORY READ ORDER — Execute in this exact order every session:**
>
> 1. `AGENTS.md` (this file) — Project-specific rules, autonomy charter, overrides
> 2. `docs/planning/SESSION.md` — Last session context, active tasks, error registry
> 3. `docs/planning/TODO.md` — All work items with priority, skill routing, MCP routing
> 4. `docs/GLOBAL-SUPERPOWERS.md` (trimmed) — Global workflow + project overrides
> 5. `docs/SISYPHUS-MANUAL.md` — Operating procedures, delegation patterns
>
> **CONDITIONAL — read only when relevant:**
> - `docs/DECISIONS.md` — Before any architecture change
> - `docs/planning/SKILLS-INSTALLED.md` — Before installing a skill
> - `docs/DEVELOPMENT_MEMORY_BEAST.md` — Before complex tasks or project-level changes
>
> **PROJECT RULE ALWAYS WINS**: If this file conflicts with global files → this file wins.
> **NON-NEGOTIABLE**: Read boot sequence files before touching any code. Skipping = operating blind.

---

## 🧠 SISYPHUS AUTONOMY CHARTER

Sisyphus operates with maximum autonomy on this project. This means:

### What Sisyphus does WITHOUT asking:
- Installs missing pip packages (SESSION.md pip auto-install protocol)
- Recovers failed MCPs (SESSION.md MCP auto-recovery protocol)
- Auto-installs missing skills from approved sources (SESSION.md skill auto-install protocol)
- Fetches documentation from the web when library questions arise
- Runs security scans after any IPC or credential change
- Updates SESSION.md, TODO.md, DECISIONS.md after every task
- Runs `/ahg-sync-check` after every `electron/main.cjs` change
- Runs `verification-before-completion` before marking any task done
- Fires background graphify update after every code task

### What Sisyphus ALWAYS asks before doing:
- Any git operation (rule: all git is manual — see §GIT RULE)
- Deleting or overwriting `games.json` or `fixes.json`
- Starting Phase 3 App.tsx decomposition
- Enabling a disabled MCP (GitHub, Discord, TaskMaster, Repomix)
- Any action that modifies `opencode.json`
- Overriding a decision in DECISIONS.md

### What Sisyphus does when blocked:
1. Log the block in SESSION.md BLOCKING ISSUES
2. Update the task in TODO.md to ⚫ BLOCKED status with exact unblock condition
3. Report to user: "BLOCKED: [reason] | NEEDS: [what resolves it]"
4. Move to the next unblocked task — never sit idle

---

## 📋 FILE REGISTRY — All Beast Files

| File | Location | Purpose | Read when |
|------|----------|---------|-----------|
| `AGENTS.md` | root | Project rules, autonomy charter, overrides | Boot Step 3 |
| `docs/planning/SESSION.md` | root | Active session, error registry, work log, compaction | Boot Step 4 |
| `docs/planning/TODO.md` | root | All tasks, priorities, skill+MCP routing | Boot Step 5 |
| `docs/DECISIONS.md` | docs/ | Permanent architectural decisions | Before architecture changes |
| `docs/SESSION-ARCHIVE.md` | docs/ | Compressed past sessions | When researching history |
| `docs/planning/SKILLS-INSTALLED.md` | root | Skill audit log | Before installing any skill |
| `docs/DEVELOPMENT_MEMORY_BEAST.md` | docs/ | Full MCP stack, intelligence matrix, project rules | Boot Step 8 reference |
| `docs/DESIGN.md` | docs/ | Design tokens — source of truth | Before any UI work |
| `docs/PRODUCT.md` | docs/ | Product context, brand tone, anti-references | Before any product decision |
| `docs/SISYPHUS-MANUAL.md` | docs/ | Agent operating procedures | Boot Step 1 |
| `docs/GLOBAL-SUPERPOWERS.md` | docs/ | Skill registry, agent registry, playbooks | Boot Step 2 |
| `graphify-out/GRAPH_REPORT.md` | graphify-out/ | Architecture knowledge graph | Before any complex task |

---

## 🚫 GIT RULE — ABSOLUTE

**DO NOT under any circumstances:**
- `git init`, `git add`, `git commit`, `git push`
- Create tags, releases, or any GitHub CLI operations
- Use the Git MCP server for WRITE operations

**git-local MCP (@cyanheads/git-mcp-server) has 28 tools. Read-only discipline is MANDATORY.**

**PERMITTED (read-only):**
- `git_status`, `git_diff`, `git_log`, `git_blame`, `git_show`, `git_branch` (list only)

**FORBIDDEN (write ops — never invoke):**
- `git_commit`, `git_push`, `git_pull`, `git_merge`, `git_rebase`, `git_reset`,
  `git_checkout`, `git_branch` (create/delete), `git_stash`, `git_tag`, `git_init`,
  `git_clone`, `git_add`, `git_fetch`, `git_clean`, `git_cherry_pick`

User handles ALL write git operations manually.
Violation of this rule is the most serious process breach possible.

---

## 🔌 MCP PRE-EXECUTION CHECK — MANDATORY

Before ANY command, bash operation, file search, or multi-step task:

1. Run `opencode mcp ls` — enumerate all connected MCPs
2. Match task type to routing table below
3. Required MCP offline → run SESSION.md auto-recovery → if still offline → STOP and report
4. Required MCP online → invoke it explicitly

### Master MCP Routing Table

| Task Type | Primary MCP | Fallback | Notes |
|-----------|-------------|----------|-------|
| Architecture query, call graph, dependency map | `graphify` + `GRAPH_REPORT.md` | `repomix` | Always graphify first, never grep cold |
| Security scan, secret detection, IPC audit | `semgrep` | `security-review-farmage` skill | After every IPC or credential change |
| Surgical file edit, long-running build | `desktop-commander` | `filesystem` MCP | Never use raw bash for multi-file edits |
| Electron IPC, BrowserWindow, packaging | `desktop-commander` + `electron-automation` skill | — | Read electron/main.cjs first |
| Git diff, sync check, branch state | `git-local` | — | Read-only always |
| File format conversion, HTML/PDF → markdown | `markitdown` | `fetch` MCP | |
| Current library docs, Electron/React/Vite/Zustand | `context7` (add "use context7") | `fetch` MCP | |
| GitHub code patterns, real-world examples | `grep_app` | `fetch` MCP | |
| Web research, Steam API, external docs | `websearch` or `fetch` | — | |
| Full cross-repo analysis | `repomix` (enable first) | — | High token cost |
| Mirror repo debugging, manifest fetch | `github` MCP (enable first) | `fetch` MCP | 20k token overhead |
| Persistent memory, recall facts | `memory` MCP | `docs/DEVELOPMENT_MEMORY_BEAST.md` | Use both always |
| Step-by-step complex reasoning | `sequential-thinking` | — | Fires automatically |
| UI automation, screenshot, E2E | `puppeteer` | — | |
| Time, timestamps, scheduling | `time` MCP | — | |
| Design prototyping, component generation | `open-design` (od mcp) | `frontend-design` skill | Prototype before implement |
| Discord bot verification, guild management | `discord-mcp` (enable first) | — | Requires DISCORD_BOT_TOKEN |
| Cross-session task tracking | `taskmaster` (enable first) | TODO.md | Requires ANTHROPIC_API_KEY |
| SQLite inspection | `sqlite` MCP | — | |

---

### Agent Dispatch Throttle (ANTI-CRASH)

Maximum 2 parallel subagents at any time. Never dispatch more than 2 simultaneous bash operations. Complete and verify each subagent before dispatching the next pair.

---

## 🎨 DESIGN RULES — NON-NEGOTIABLE

Every UI task must comply with all of these. No exceptions.

1. Read `docs/DESIGN.md` fully before writing any component
2. Use Open Design (`od mcp`) to generate HTML prototype before React implementation (Rule 8)
3. Use at least ONE of: `frontend-design`, `impeccable`, `design-motion-principles`, `web-artifacts-builder`
4. Include `use the open-design tools` in all frontend prompts
5. Zero hardcoded colors — all from DESIGN.md token system
6. No white surfaces, no glassmorphism default, no RGB rainbow, no enterprise blue
7. All interactive transitions: 80ms cubic-bezier(0.4, 0, 0.2, 1)
8. Framer Motion required for modal/toast enter/exit animations
9. Virtual scrolling (TanStack Virtual) for any list >100 items

---

## 🔒 PROJECT-SPECIFIC RULES

### Rule 1 — Design Integrity
Never deviate from `docs/DESIGN.md` without user confirmation.

### Rule 2 — IPC Safety
Every new `ipcMain.handle()` in `main.cjs` MUST have:
- Corresponding `contextBridge.exposeInMainWorld` in `preload.cjs`
- TypeScript wrapper in `src/bridge.ts`
Run `/ahg-ipc-audit` after any IPC work.

### Rule 3 — Manifest Repo Safety
Code touching 97 manifest repos must:
- Never log tokens or credentials
- Never expose repo contents to renderer
- Validate all `.lua` contents before writing to disk
Run `semgrep` scan after any manifest fetch logic change.

### Rule 4 — Games Data Safety
`games.json` (176,785 entries) and `fixes.json` (497 entries):
- Never overwrite — always merge
- Use `scripts/python/fixing/` scripts for merges
- Never partial-write

### Rule 5 — Build Must Pass
No task is "done" unless `npm run build` produces 0 NEW errors.
Pre-approved warnings: uiStore.ts duplicate key, Vite chunk size.
Any NEW warning = blocker.

### Rule 6 — Memory Is Mandatory
Every session with meaningful code changes writes to:
- Memory MCP (`memory.create_entities` / `memory.add_observations`)
- `docs/DEVELOPMENT_MEMORY_BEAST.md` changelog section
- SESSION.md WORK LOG

### Rule 7 — Skill Autonomy
Use any skill freely without asking permission.
Task maps to skill → invoke it. No hesitation.

### Rule 8 — Open Design First
Before implementing any new screen from scratch:
1. Use Open Design to generate HTML prototype
2. Show prototype to user
3. Get direction confirmation
4. Then implement in React

### Rule 9 — Performance Budget
- Initial load: <2 seconds
- Search response: <100ms
- Scroll: 60fps (TanStack Virtual for >100 items)
- Memory: <500MB
- Animation: ≤80ms for interactive transitions
- Images: must use `imageCache.ts` service

### Rule 10 — Context7 for Library Questions
Any question involving Electron, React, Vite, Framer Motion, Zustand, TanStack →
add "use context7" to get live version-accurate docs.

---

## 🛠️ MANDATORY SKILLS BEFORE ANY CODE

Load these skills (via `skill` tool) BEFORE writing or modifying any code:

| Order | Skill | When |
|-------|-------|------|
| 1 | `subagent-driven-development` | Always — dispatch parallel work |
| 2 | `dispatching-parallel-agents` | Always — identify parallel streams |
| 3 | `systematic-debugging` | Before touching any bug |
| 4 | `verification-before-completion` | Before claiming any task done |
| 5 | `requesting-code-review` | Before completing major features |
| 6 | `receiving-code-review` | Before implementing review feedback |

---

## 📐 SKILL ROUTING TABLE — Task → Skill

| Task Category | Skill(s) to invoke |
|--------------|-------------------|
| Electron IPC, preload, contextBridge | `electron-automation`, `electron` (clawhub) |
| Mirror repos, manifest install, DLC | `install-flow` (project skill) |
| App.tsx state, Zustand stores | `state-map` (project skill) |
| Security scan, secret detection | `security-review-farmage`, `semgrep` MCP |
| UI components, dark design | `frontend-design`, `impeccable`, `design-motion-principles` |
| Animation, motion design | `gsap-performance`, `gsap-react`, `design-motion-principles` |
| Any bug investigation | `systematic-debugging-ok`, `systematic-debugging` |
| Architecture planning | `brainstorming`, `writing-plans`, `subagent-driven-development` |
| Multi-file refactoring | `subagent-driven-development`, `dispatching-parallel-agents` |
| Test writing | `test-driven-development`, `tdd-ok` |
| Code review | `requesting-code-review`, `receiving-code-review` |
| Task completion | `verification-before-completion` |

---

## 🔨 KEY BUILD COMMANDS

```bash
# Full build (always run before any packaging)
npm run build

# Dev portable EXE (2-step, avoids winCodeSign)
electron-builder --config.directories.output=dev-release --dir
electron-builder --win portable --prepackaged dev-release\win-unpacked --config.directories.output=dev-release

# Release build (auto-versioned from package.json)
scripts\build-release.bat

# TypeScript check only
npx tsc --noEmit

# Lint
npm run lint
```

### Build verification (run after every build):
```bash
# Check EXE exists and was modified today
dir dist-electron\win-unpacked\"AHG Unlocker.exe"
# Check main.cjs sync
/ahg-sync-check
```

---

## ⚡ SLASH COMMANDS AVAILABLE

| Command | Purpose |
|---------|---------|
| `/ahg-security` | Semgrep scan: main.cjs, preload.cjs, bridge.ts, bot.py |
| `/ahg-sync-check` | Verify electron/main.cjs ↔ dist-electron/main.cjs sync |
| `/ahg-graph` | Query knowledge graph (mandatory architecture gate) |
| `/ahg-build` | Full verified build sequence with step-by-step confirmation |
| `/ahg-ipc-audit` | Find IPC handler gaps across main.cjs/preload.cjs/bridge.ts |
| `/ahg-design-check` | Audit component against DESIGN.md tokens |
| `/graphify` | Build/rebuild knowledge graph |

---

## 📊 PROJECT QUICK REFERENCE

| Property | Value |
|----------|-------|
| Stack | Electron + React + TypeScript + Vite + Tailwind CSS |
| Purpose | Steam game/DLC unlocker via manifest injection |
| Games | 176,785 entries in games.json |
| Mirror repos | 97 manifest repos |
| Build output | dist-electron\win-unpacked\AHG Unlocker.exe |
| App.tsx | 3478 lines (Phase 2 done, Phase 3 needs user confirmation) |
| main.cjs | 3459 lines — HIGHEST criticality, always sync to dist-electron |
| Bot | bot.py — Discord bot, guild-scoped, persistent Views |
| Performance | Load <2s, search <100ms, scroll 60fps, memory <500MB |

---

## 🧹 WORKER CLEANUP — Prevent "Worker has been terminated"

"Worker has been terminated" = stale/orphaned Node.js processes (MCP npx wrappers, duplicate Vite) 
consuming process slots. The solution:

**Start each session with:**
```powershell
.\scripts\powershell\cleanup-workers.ps1
```

**When the error occurs mid-session:** Run the same script. It kills only orphans/duplicates,
never the active MCPs or OpenCode itself.

**Root cause:** 18+ Node processes (8 MCPs × 2 for npx + child, plus Vite) exhaust process/handle 
capacity. The cleanup script reduces this to the minimum viable set.

---

## 🏁 SESSION END PROTOCOL

Before the user closes OpenCode, Sisyphus MUST:

0. Run `.\scripts\powershell\cleanup-workers.ps1` to prevent worker buildup
1. Write PENDING HANDOFF block in SESSION.md
2. Write completed tasks to SESSION.md WORK LOG
3. Move completed tasks to ✅ DONE in TODO.md
4. Write key facts to Memory MCP
5. Update `docs/DEVELOPMENT_MEMORY_BEAST.md` changelog
6. Run `/ahg-sync-check` if main.cjs was touched
7. Confirm build passes if code was changed
8. If SESSION.md > 600 lines → run compaction protocol
9. Print: "✅ SESSION SAVED — ready to close"

**Never let the user close without completing these steps.**
If user says "bye" / "done" / "save session" → run this protocol immediately.

---

## END OF AGENTS.md

**Remember**: This file is the law. Global files inform. This file rules.
Sisyphus operating without reading this file is Sisyphus operating blind.
