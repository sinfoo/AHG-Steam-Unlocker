---
name: ahg-dev-loop
description: >-
  Mandatory development loop enforcer for AHG Unlocker Electron/React project.
  Auto-detects phase from conversation: BEFORE (planning, feature design, bug
  triage) reads graphify plus DECISIONS and DESIGN docs, loads task-matched
  skills with graceful fallback, outputs max 5 steps under 2 min each, writes
  to TODO.md. DURING (implementation, editing, coding) runs Playwright perf
  budget checks verifying load time under 2 s, search under 100 ms, scroll
  60 fps, memory under 500 MB, executes sync check and IPC audit, writes
  progress to SESSION.md. AFTER (finish, save, complete, done) runs tsc
  plus lsp diagnostics, reruns sync check, invokes /suggest skill for
  post-task synthesis, updates TODO.md and SESSION.md, writes facts to
  Memory MCP. All phases directly edit TODO.md and SESSION.md.
---

# Skill: ahg-dev-loop

AHG Unlocker mandatory development loop enforcer. Covers all three phases of development work.

---

## Phase Detection

Read the conversation context to determine which phase is active:

| Phase | Trigger Patterns | When It Fires |
|-------|-----------------|---------------|
| **BEFORE** | "implement", "add feature", "design", "build", "create", "fix bug", "refactor", "change", "modify" + task description | User describes work to do |
| **DURING** | "editing", "writing code", "changed", "updated", just modified files, implementing described steps | User is actively coding |
| **AFTER** | "done", "finished", "complete", "save", "check", "verify", "finalize" | User indicates completion |

If ambiguous, ask the user: "Which ahg-dev-loop phase? BEFORE / DURING / AFTER"

---

## BEFORE Phase — Planning

Run BEFORE any implementation begins.

### Step 1: Read Knowledge Graph
```tool
Read graphify-out/GRAPH_REPORT.md for architecture context
```

### Step 2: Read Decision Records
```tool
Read docs/DECISIONS.md for permanent architectural decisions
Read docs/DESIGN.md for design tokens and UI rules
```

### Step 3: Load Task-Matched Skills

Detect task type from user request and attempt to load relevant skills. Graceful fallback if skill missing.

| Task Type | Skills to Load | Fallback |
|-----------|---------------|----------|
| Electron IPC, preload, contextBridge | `electron-automation`, `electron` | Inline: read electron/main.cjs + preload.cjs + bridge.ts pattern |
| Mirror repos, manifest install, DLC | `install-flow` | Inline: reference AGENTS.md manifest rules |
| App.tsx state, Zustand stores | `state-map` | Inline: grep useStore/store patterns |
| Security scan, secret detection | `security-review-farmage` | Inline: check for hardcoded tokens, IPC credential exposure |
| UI components, dark design | `frontend-design`, `impeccable`, `design-motion-principles` | Inline: read docs/DESIGN.md for tokens |
| Bug investigation | `systematic-debugging-ok`, `systematic-debugging` | Inline: isolate → reproduce → bisect → fix workflow |
| Architecture planning | `brainstorming`, `writing-plans` | Inline: list options with tradeoffs |
| Multi-file refactoring | `subagent-driven-development`, `dispatching-parallel-agents` | Inline: decompose into independent parallel units |
| Test writing | `test-driven-development` | Inline: red-green-refactor |
| Code review | `requesting-code-review`, `receiving-code-review` | Inline: check requirements, patterns, security |
| Completion / verification | `verification-before-completion` | Inline: run checks before claiming done |

For each matched skill:
1. Use `skill(name="<skill-name>")` to load it
2. If skill tool returns empty or error → use the inline fallback instructions from the table above

### Step 4: Create Plan
- Output maximum **5 steps**
- Each step must be estimated **under 2 minutes**
- Write the steps to TODO.md using `todowrite` tool
- Mark the first step `in_progress`

Example output format:
```
## BEFORE Phase — Plan

Detected task type: [Electron IPC / UI / Security / Refactor / Bug / Test]

Steps:
1. [step 1] — ~1.5 min
2. [step 2] — ~1 min
...
```

---

## DURING Phase — Implementation Integrity

Run these checks during or immediately after coding.

### Step 1: Load Phase Skills
Load skills based on what the code changes touch:
- IPC/Electron changes → `electron-automation` (graceful fallback)
- UI changes → `impeccable` or `frontend-design` (graceful fallback)
- Bug fix → `systematic-debugging` (graceful fallback)

### Step 2: Performance Budget Auto-Check
If the changes touch UI (components, pages, rendering), run Playwright-based checks:

```tool
Use /playwright skill to:
- Measure initial load time (target: <2s)
- Type in search bar and measure response (target: <100ms)
- Scroll a long list and check frame rate (target: 60fps)
- Check memory usage via Chrome DevTools protocol (target: <500MB)
- Take screenshots before and after for visual comparison
```

If Playwright is unavailable or the app isn't running, output the manual verification steps instead.

### Step 3: Sync Check
Execute the `/ahg-sync-check` command:
```tool
skill(name="ahg-sync-check")
```
Verify that `electron/main.cjs` ⇄ `dist-electron/main.cjs` are in sync.
If sync fails → **BLOCKER**: do not proceed until user resolves.

### Step 4: IPC Audit
Execute the `/ahg-ipc-audit` command:
```tool
skill(name="ahg-ipc-audit")
```
Check that every `ipcMain.handle()` has matching `contextBridge.exposeInMainWorld` and TypeScript wrapper in `src/bridge.ts`.
Report any gaps found.

### Step 5: Write Progress to SESSION.md
Append a brief work log entry to SESSION.md with:
- What was changed
- Any issues found (perf, sync, IPC gaps)
- Current status

Use file edit tools to append to SESSION.md.

---

## AFTER Phase — Completion

Run these when the user indicates the task is finished.

### Step 1: TypeScript Check
```bash
npx tsc --noEmit
```
Fix any NEW type errors introduced by this work. Do **not** fix pre-existing errors.

### Step 2: LSP Diagnostics
```tool
lsp_diagnostics on all changed files
```
Fix any NEW errors. Pre-existing lint warnings are acceptable.

### Step 3: Sync Check
Execute `/ahg-sync-check` again to confirm sync after all changes.

### Step 4: Invoke /suggest Skill
Load the suggest skill and run it for post-task synthesis:
```tool
skill(name="suggest")
```
This generates a comprehensive context summary and feature suggestions based on what was just built.

### Step 5: Update TODO.md
- Move completed tasks to `✅ DONE` status
- Mark any incomplete tasks with clear status
- Add any new follow-up tasks discovered during the work

### Step 6: Update SESSION.md Work Log
Append to SESSION.md:
- What was accomplished
- Key decisions made
- Build status (pass/fail)
- Any pending follow-up items

### Step 7: Write to Memory MCP
```tool
Use Memory MCP (memory.create_entities / memory.add_observations) to:
- Record key facts about what was built/modified
- Note architectural decisions made
- Capture any blockers or risks discovered
```

### Step 8: Final Verification
Confirm:
- [ ] Diagnostic errors: 0 new
- [ ] Build: passes
- [ ] TODO.md: updated
- [ ] SESSION.md: updated
- [ ] Memory MCP: updated
- [ ] /suggest: invoked
- [ ] /ahg-sync-check: passed

---

## Anti-Triggers

Do NOT auto-trigger for:
- Simple questions about the codebase
- Git history lookups
- Reading documentation
- General conversation not related to AHG Unlocker development tasks
- Debugging sessions already in progress (let DURING phase handle it)

User can always manually invoke with `/ahg-dev-loop` to re-run any phase.

---

## Output Format

Always wrap phase output in clear headers:

```
╔══════════════════════════════════════╗
║  🔄 AHG DEV LOOP — [BEFORE/DURING/AFTER] Phase  ║
╚══════════════════════════════════════╝

[phase-specific content]
```
