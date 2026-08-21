# DECISIONS.md — AHG Unlocker Permanent Decision Log
# Version: 1.0 BEAST
# READ BY: Sisyphus before any architectural change
# WRITTEN BY: Sisyphus whenever a meaningful decision is made
# NEVER DELETE entries — only append

---

> ⚡ **SISYPHUS INSTRUCTION**: This file stores decisions that must survive
> session compaction. Before making any architectural decision, check here first.
> A decision already made here is FINAL unless the user explicitly overrides it.
> Append new decisions at the bottom using the template provided.

---

## DECISION LOG

### D001 — App.tsx refactoring approach
```
Date: 2026-05-15
Decision: Extract components ONE at a time. Build-verify after each extraction.
Never extract multiple components in one pass.
Reason: Phase 2 refactor was reverted once due to aggressive multi-component extraction.
Constraint: Phase 3 requires explicit user confirmation before starting.
Status: PERMANENT
```

### D002 — main.cjs sync requirement
```
Date: 2026-05-15
Decision: electron/main.cjs must always be manually synced to dist-electron/main.cjs
after every change. The build command alone does not guarantee sync.
Verification: Run /ahg-sync-check after every main process change.
Status: PERMANENT
```

### D003 — games.json data integrity
```
Date: 2026-05-15
Decision: Never overwrite games.json with partial data. Always merge.
Use scripts/python/fixing/ scripts for merges.
Reason: 176,785 entries — a bad overwrite loses all data.
Status: PERMANENT
```

### D004 — Design token authority
```
Date: 2026-05-15
Decision: docs/DESIGN.md is the single source of truth for all design tokens.
No hardcoded colors, spacing, or motion values anywhere in source.
Override requires explicit user confirmation first.
Status: PERMANENT
```

### D005 — Git operations are manual
```
Date: 2026-05-15
Decision: Sisyphus never performs git operations.
All commits, pushes, tags, and releases are handled manually by user.
git-local MCP is read-only (diff, log, blame, status only).
Status: PERMANENT
```

### D006 — IPC handler registration order
```
Date: 2026-05-15
Decision: All IPC handlers must be registered before createWindow() is called.
No setImmediate delay. Handlers registered after window creation are unreliable.
Status: PERMANENT
```

### D007 — Version is always dynamic
```
Date: 2026-05-15
Decision: Version strings are NEVER hardcoded in source.
Always read from package.json via app.getVersion() at runtime.
Build output dir follows package.json version automatically.
Status: PERMANENT
```

### D008 — Manifest repo token safety
```
Date: 2026-05-15
Decision: Code touching manifest repos (97 repos in main.cjs) must:
  1. Never log tokens or credentials
  2. Never expose repo contents to the renderer process
  3. Validate all .lua file contents before writing to disk
Semgrep scan required after any change to manifest fetch logic.
Status: PERMANENT
```

### D009 — Performance budget is non-negotiable
```
Date: 2026-05-15
Decision: 
  - Initial load: under 2 seconds
  - Search response: under 100ms
  - Scroll: 60fps with 176K items (TanStack Virtual required for >100 items)
  - Memory: under 500MB
  - Animations: 80ms or less for interactive transitions
Any new component that violates these targets is a blocker.
Status: PERMANENT
```

### D010 — Build must be clean before task is "done"
```
Date: 2026-05-15
Decision: No task marked done unless npm run build produces 0 NEW errors.
Pre-existing warnings are approved:
  - uiStore.ts duplicate key warning
  - Vite chunk size warning
Any NEW warning = blocker. Fix before completing task.
Status: PERMANENT
```

### D011 — MCP degraded toolset behavior
```
Date: 2026-05-15
Decision: If a required Tier 1 MCP is offline/erroring, Sisyphus:
  1. Runs auto-recovery protocol (SESSION.md)
  2. If recovery fails: reports to user and does NOT proceed with degraded toolset
  Never silently continue with a broken MCP.
Status: PERMANENT
```

### D012 — Memory MCP + DEVELOPMENT_MEMORY.md are parallel
```
Date: 2026-05-15
Decision: Both stores must be kept in sync.
Every session with meaningful code changes must write to both.
Memory MCP for programmatic recall. DEVELOPMENT_MEMORY_BEAST.md for human reading.
Status: PERMANENT
```

---

## DECISION TEMPLATE

_When Sisyphus makes a new architectural decision, append using this format:_

```markdown
### D[NNN] — [Decision title]
\`\`\`
Date: [date from time MCP]
Decision: [what was decided — be specific]
Reason: [why this decision was made]
Constraint: [any conditions or prerequisites]
Status: PERMANENT | PROVISIONAL (review at [date])
\`\`\`
```
