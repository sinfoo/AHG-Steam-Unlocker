# SISYPHUS_LEVEL2_UPGRADE.md
# AHG Unlocker — Sisyphus Level 2 Intelligence Upgrade
# Read this file in full. Then execute every section in order.
# Stop only if a section's prerequisite check explicitly fails.
# When all sections complete, output the final report and stop.

---

## GROUND RULES — READ FIRST

This file is written specifically for the AHG Unlocker project running
under the Sisyphus orchestration system with GLOBAL-SUPERPOWERS.md.

### What this file WILL NOT touch
- `SISYPHUS-MANUAL.md` — untouched, Sisyphus identity preserved
- `GLOBAL-SUPERPOWERS.md` — untouched, workflow playbooks preserved
- `AGENTS.md` — untouched, project overrides preserved
- Any existing MCP server already in `opencode.json` (Open Design, Exa, Context7, GitHub Code Search)
- Any existing skill in `.claude/skills/` or `.agents/skills/`
- `graphify-out/` and all graph data
- `DEVELOPMENT_MEMORY.md`, `SESSION.md`, `TODO.md`

### What this file WILL do
- Add new MCP servers under new unique keys (no key collision with existing ones)
- Install new global skills to `~/.config/opencode/skills/` (project skills untouched)
- Install new slash commands to `.opencode/commands/`
- Install skill packs that complement but don't override Superpowers

### Conflict check before anything else

Read the current `opencode.json` at `%USERPROFILE%\.config\opencode\opencode.json`.
Extract and list the current `mcp` keys.
Confirm NONE of the following new keys exist already:
`sequential-thinking`, `semgrep`, `taskmaster`, `desktop-commander`,
`git-local`, `markitdown`, `repomix`, `discord-mcp`

If any key already exists, skip that specific section only. Continue all others.

---

## SECTION 1 — MCP AI AGENTS (Core Intelligence Layer)

These are net-new MCP servers. All are disabled-by-default where
token-heavy, or always-on where token-light. None conflict with
Open Design, Exa, Context7, or GitHub Code Search.

### 1.1 Sequential Thinking MCP ★ ALWAYS-ON
**What it does**: Forces the model to reason through complex problems
step by step instead of one-shot answering. Calls the tool repeatedly,
branches when assumptions fail, backtracks and revises.
**Why for AHG**: Critical for the `tryRepoForGame` fallback chain logic,
any change touching both `main.cjs` + `bridge.ts` simultaneously,
and the future App.tsx split planning.
**Token cost**: Zero passive overhead — only fires when you ask for
step-by-step reasoning.
**Source**: github.com/modelcontextprotocol/servers (official Anthropic)

Add to `opencode.json` under `mcp`:
```json
"sequential-thinking": {
  "type": "local",
  "command": ["npx", "-y", "@modelcontextprotocol/server-sequential-thinking"],
  "enabled": true
}
```

### 1.2 Semgrep Security MCP ★ ALWAYS-ON (remote, no install needed)
**What it does**: Static security analysis across your entire codebase.
Scans TypeScript, JavaScript, Python with 5000+ rules. Catches
hardcoded secrets, injection vulnerabilities, unsafe IPC patterns.
**Why for AHG**: Your `electron/main.cjs` has hardcoded Discord tokens,
GitHub tokens, machine ID logic, and IPC handlers — exactly the
surface Semgrep catches. No SEMGREP_APP_TOKEN needed for basic scans.
**Token cost**: Zero passive — call it explicitly with "semgrep scan".
**Source**: github.com/semgrep/mcp (official Semgrep)

Add to `opencode.json` under `mcp`:
```json
"semgrep": {
  "type": "remote",
  "url": "https://mcp.semgrep.ai/mcp",
  "enabled": true
}
```

### 1.3 TaskMaster AI MCP ★ DISABLED BY DEFAULT (requires API key)
**What it does**: AI-powered task management system. Parses a PRD into
dependency-aware tasks, tracks status, suggests next task, expands
complex tasks into subtasks. 27k GitHub stars.
**Why for AHG**: Complements Sisyphus's orchestration role. Sisyphus
decomposes and delegates — TaskMaster persists that decomposition across
sessions and tracks which tasks are done. Prevents drift between sessions.
**Sisyphus compatibility**: TaskMaster manages WHAT to do.
Sisyphus manages HOW to do it. Zero role conflict.
**Token cost**: HIGH (36 tools = ~21k tokens). Use "lean" mode (below).
**Requires**: `ANTHROPIC_API_KEY` environment variable.
**Source**: github.com/eyaltoledano/claude-task-master (27k stars)

Add to `opencode.json` under `mcp`:
```json
"taskmaster": {
  "type": "local",
  "command": ["npx", "-y", "task-master-ai"],
  "env": {
    "ANTHROPIC_API_KEY": "{env:ANTHROPIC_API_KEY}",
    "TASK_MASTER_TOOLS": "lean"
  },
  "enabled": false
}
```

To enable: set `ANTHROPIC_API_KEY` in environment, change `enabled` to `true`.
To use: "taskmaster, what's the next task?" or "taskmaster, create tasks from this PRD".

### 1.4 Desktop Commander MCP ★ ALWAYS-ON
**What it does**: Advanced terminal and file system control. Long-running
processes, diff-based file editing (surgical edits not full rewrites),
process management, pattern-based search/replace across files. 5.3k stars.
**Why for AHG**: Your build pipeline (`npm run electron:build`) is
long-running. This lets Sisyphus's subagents manage build processes,
watch logs, kill hung processes, and do surgical edits to large files
like `main.cjs` (4300 lines) without rewriting the whole file.
**Token cost**: Low passive overhead.
**Source**: github.com/wonderwhy-er/DesktopCommanderMCP

Run first:
```bash
npx @wonderwhy-er/desktop-commander@latest setup
```

Then add to `opencode.json` under `mcp`:
```json
"desktop-commander": {
  "type": "local",
  "command": ["npx", "-y", "@wonderwhy-er/desktop-commander@latest"],
  "enabled": true
}
```

### 1.5 Git Local MCP ★ ALWAYS-ON
**What it does**: Direct local Git operations without GitHub API —
commit history, diffs, blame, branch management, stash, log analysis.
All offline, zero tokens for tool definitions.
**Why for AHG**: Your project has multiple backup branches and a
critical manual sync requirement between `electron/main.cjs` and
`dist-electron/main.cjs`. Git MCP lets Sisyphus verify branch state,
check diffs before and after changes, and confirm the sync happened.
**Token cost**: Minimal — tools are simple and focused.
**Source**: github.com/modelcontextprotocol/servers (official)

Add to `opencode.json` under `mcp`:
```json
"git-local": {
  "type": "local",
  "command": ["uvx", "mcp-server-git", "--repository", "."],
  "enabled": true
}
```

If `uvx` is not available, alternative:
```json
"git-local": {
  "type": "local",
  "command": ["npx", "-y", "@modelcontextprotocol/server-git"],
  "enabled": true
}
```

### 1.6 MarkItDown MCP ★ ALWAYS-ON (Microsoft official)
**What it does**: Converts any file format to clean markdown — PDF, DOCX,
PPTX, XLSX, images, HTML, ZIP archives. Microsoft official, 38k stars.
**Why for AHG**: You can drop Steam API docs, SteamDB HTML pages, or
DepotBox response payloads into the session and have them converted to
clean markdown for Sisyphus to analyze. Also useful for your changelog,
README, and any documentation work.
**Token cost**: Zero passive — call it with a file path.
**Source**: github.com/microsoft/markitdown

Add to `opencode.json` under `mcp`:
```json
"markitdown": {
  "type": "local",
  "command": ["uvx", "markitdown-mcp"],
  "enabled": true
}
```

Alternative if uvx fails:
```bash
pip install markitdown-mcp --break-system-packages
```
Then:
```json
"markitdown": {
  "type": "local",
  "command": ["markitdown-mcp"],
  "enabled": true
}
```

### 1.7 Repomix MCP ★ ON-DEMAND (disabled default)
**What it does**: Packages your entire codebase into a single
AI-optimized file. Compresses, removes noise, applies security filters.
Outputs a single context file that any AI can consume.
**Why for AHG**: Useful when you need to hand Sisyphus a full snapshot
of the project for cross-cutting analysis (e.g. "find all hardcoded IDs
across all files") without running graphify first.
**Token cost**: HIGH when used — it loads the whole repo. Disabled by default.
**Source**: github.com/yamadashy/repomix (20k stars)

Add to `opencode.json` under `mcp`:
```json
"repomix": {
  "type": "local",
  "command": ["npx", "-y", "repomix", "--mcp"],
  "enabled": false
}
```

Enable for full-repo analysis sessions only. Disable after.

### 1.8 Discord MCP ★ DISABLED BY DEFAULT (requires bot token)
**What it does**: Read/send messages, manage channels, check members,
post embeds — all from inside OpenCode.
**Why for AHG**: Your Discord bot (`bot.py`) is a core project component.
Sisyphus could directly verify that a slash command response posted
correctly, check that the `/activate` command assigned the right role,
or read the `#bot-logs` channel to debug bot failures — without you
switching to Discord manually.
**Requires**: Discord bot token with appropriate permissions.
**Source**: github.com/v-3/discordmcp

Add to `opencode.json` under `mcp`:
```json
"discord-mcp": {
  "type": "local",
  "command": ["npx", "-y", "discord-mcp"],
  "env": {
    "DISCORD_TOKEN": "{env:DISCORD_BOT_TOKEN}"
  },
  "enabled": false
}
```

To enable: set `DISCORD_BOT_TOKEN` environment variable, change `enabled` to `true`.

---

## SECTION 2 — SKILL PACKS (Global Installation)

Install all of these to `~/.config/opencode/skills/`.
Project-local `.claude/skills/` and `.agents/skills/` are NOT touched.
Sisyphus will auto-discover these global skills alongside existing ones.

### 2.1 farmage/opencode-skills — 66 specialized skills pack

This is the most comprehensive OpenCode skill collection available.
66 skills across frameworks, DevOps, architecture, and quality.
Key skills relevant to AHG Unlocker: Security Review, Code Review,
Debugging, Testing, Documentation, API Design, and .NET Core
(for the C# Steam operations core in `PROFESSIONAL_ARCH.md`).

```bash
cd %TEMP%
git clone https://github.com/farmage/opencode-skills.git farmage-skills
cd farmage-skills
```

Then copy only the skills NOT already in `.claude/skills/`:

```bash
# Security & Quality
xcopy /E /I skills\security-review %USERPROFILE%\.config\opencode\skills\security-review
xcopy /E /I skills\code-review %USERPROFILE%\.config\opencode\skills\code-review
xcopy /E /I skills\testing %USERPROFILE%\.config\opencode\skills\testing-farmage
xcopy /E /I skills\debugging %USERPROFILE%\.config\opencode\skills\debugging-farmage
xcopy /E /I skills\documentation %USERPROFILE%\.config\opencode\skills\documentation-farmage
xcopy /E /I skills\api-design %USERPROFILE%\.config\opencode\skills\api-design

# Frameworks (relevant to this project)
xcopy /E /I skills\dotnet-core %USERPROFILE%\.config\opencode\skills\dotnet-core
xcopy /E /I skills\fastapi %USERPROFILE%\.config\opencode\skills\fastapi
```

Note: Use `-farmage` suffix on any that might shadow existing project skills.

### 2.2 mxyhi/ok-skills — Electron + Browser Automation skills

This pack contains the `electron/` skill specifically — the only
dedicated Electron desktop app automation skill collection available.
Also includes `browser-trace` (CDP trace capture) and `agent-browser`
(Electron automation via Chrome DevTools Protocol) — both directly
relevant to testing AHG Unlocker's UI flows.

```bash
cd %TEMP%
git clone https://github.com/mxyhi/ok-skills.git ok-skills
cd ok-skills

# Electron skill (most important for this project)
xcopy /E /I electron %USERPROFILE%\.config\opencode\skills\electron-automation

# Browser automation for testing Electron UI
xcopy /E /I agent-browser %USERPROFILE%\.config\opencode\skills\agent-browser
xcopy /E /I browser-trace %USERPROFILE%\.config\opencode\skills\browser-trace
xcopy /E /I systematic-debugging %USERPROFILE%\.config\opencode\skills\systematic-debugging-ok
```

### 2.3 Anthropic Skill Creator (eval-driven skill development)

When Sisyphus creates new project skills, this gives it a systematic
workflow: write skill → auto-generate 20 test queries → measure trigger
accuracy → iterate until >80% trigger rate. Treats skill creation like
software engineering, not guesswork.

```bash
# Install as OpenCode plugin + global skill
npx opencode-skill-creator install --global
```

If the above fails, manual install:
```bash
cd %TEMP%
git clone https://github.com/antongulin/opencode-skill-creator.git
cd opencode-skill-creator
npm install
npm run build
```

Then add to `opencode.json` under `plugin`:
```json
"plugin": ["opencode-skill-creator"]
```

### 2.4 GSAP Animation Skills (for AHG Unlocker's premium animations)

Your project has 8+ custom CSS animations (`glow-pulse`, `shimmer-sweep`,
`float`, `border-rotate`, `breathe`, etc.) and Framer Motion spring
animations on game cards. The GSAP skill pack gives Sisyphus expert
knowledge for composing, timing, and debugging animation systems —
even if you stay on CSS/Framer and don't switch to GSAP.

```bash
cd %TEMP%
git clone https://github.com/mxyhi/ok-skills.git ok-skills-gsap

xcopy /E /I ok-skills-gsap\gsap-skills\core %USERPROFILE%\.config\opencode\skills\gsap-core
xcopy /E /I ok-skills-gsap\gsap-skills\performance %USERPROFILE%\.config\opencode\skills\gsap-performance
xcopy /E /I ok-skills-gsap\gsap-skills\react %USERPROFILE%\.config\opencode\skills\gsap-react
```

---

## SECTION 3 — SLASH COMMANDS FOR SISYPHUS

These are `.opencode/commands/` files that give Sisyphus reusable
one-shot workflows callable with `/command-name`.
Create the `.opencode/commands/` directory if it doesn't exist.

### 3.1 /ahg-security — Security scan on demand

Create `.opencode/commands/ahg-security.md`:

```markdown
---
description: Run Semgrep security scan on the AHG Unlocker codebase. Checks for hardcoded secrets, unsafe IPC patterns, injection vulnerabilities in main.cjs and bot.py.
---
Use the semgrep MCP to scan the following files for security vulnerabilities:
- electron/main.cjs (focus: hardcoded tokens, IPC injection, eval usage)
- bot.py (focus: hardcoded secrets, Discord token exposure, Gist token handling)
- src/bridge.ts (focus: unsafe IPC channel names, missing validation)
- electron/preload.cjs (focus: contextBridge exposure surface)

After scanning, produce a prioritized list of findings: CRITICAL, HIGH, MEDIUM, LOW.
For each CRITICAL or HIGH finding, propose the minimal fix inline.
Do NOT modify any file — report only.
```

### 3.2 /ahg-sync-check — Verify main.cjs sync state

Create `.opencode/commands/ahg-sync-check.md`:

```markdown
---
description: Check whether electron/main.cjs and dist-electron/main.cjs are in sync. Critical — they must be identical after any main process change.
---
Use git-local and desktop-commander to:
1. Get the MD5 or line count of electron/main.cjs
2. Get the MD5 or line count of dist-electron/main.cjs
3. If they differ: show a diff summary (first 20 differing lines)
4. If they are the same: confirm "main.cjs is in sync"
5. Also check if electron/preload.cjs and dist-electron/preload.cjs are in sync

Report the sync status for both files clearly.
```

### 3.3 /ahg-graph — Query graphify knowledge graph

Create `.opencode/commands/ahg-graph.md`:

```markdown
---
description: Query the AHG Unlocker knowledge graph. Use when you need to understand architecture, find connections between modules, or identify god nodes before starting complex work.
---
Before anything else, check if graphify-out/GRAPH_REPORT.md exists.
If it exists: read it and answer the user's architecture question using the graph.
If it doesn't exist: run /graphify . to build it first, then read GRAPH_REPORT.md.

Query format: graphify query "$ARGUMENTS"

After reading the graph, summarize:
- Which god nodes (high-centrality modules) are relevant to the query
- Which community cluster the answer lives in
- What the surprising or non-obvious connections are
```

### 3.4 /ahg-build — Full verified build sequence

Create `.opencode/commands/ahg-build.md`:

```markdown
---
description: Run the full AHG Unlocker build sequence with verification at each step. Use before any release or after major changes.
agent: build
---
Execute this exact sequence. Stop on first failure and report it.

Step 1: npm run lint
- If errors: list them, stop, ask user to fix before continuing

Step 2: npm run build
- Runs tsc + vite build
- Confirm "dist/" was updated

Step 3: Copy main.cjs sync
- Verify electron/main.cjs == dist-electron/main.cjs (line count check)
- If out of sync: copy electron/main.cjs to dist-electron/main.cjs

Step 4: npm run electron:build
- Full package build
- Confirm dist-electron/win-unpacked/AHG Unlocker.exe exists and was modified today

Step 5: Report build result
- List file sizes of: dist-electron/main.cjs, dist-electron/win-unpacked/AHG Unlocker.exe
- Confirm build SUCCESS or FAILURE with step where it failed
```

### 3.5 /ahg-ipc-audit — Find IPC handler gaps

Create `.opencode/commands/ahg-ipc-audit.md`:

```markdown
---
description: Audit IPC handlers. Find channels defined in main.cjs that are missing from preload.cjs or bridge.ts, and vice versa. Use before adding new IPC handlers.
---
Use desktop-commander and graphify to:

1. Extract all ipcMain.handle('...') channel names from electron/main.cjs
2. Extract all contextBridge.exposeInMainWorld entries from electron/preload.cjs
3. Extract all function signatures from src/bridge.ts
4. Cross-reference: find channels in main.cjs with no preload entry
5. Find preload entries with no bridge.ts wrapper
6. Find bridge.ts wrappers with no main.cjs handler

Output a three-column table:
| Channel | In main.cjs | In preload.cjs | In bridge.ts |
Show gaps as MISSING. This is the audit — do NOT fix anything, just report.
```

---

## SECTION 4 — OPENCODE.JSON FINAL MCP BLOCK

After adding all MCPs from Section 1, the final `mcp` block in
`%USERPROFILE%\.config\opencode\opencode.json` should look like this.
Read the current file first, then MERGE — do not overwrite other keys.

```jsonc
{
  "$schema": "https://opencode.ai/config.json",

  // ── Keep ALL your existing keys (theme, model, autoupdate, etc.) ──
  // ── Keep ALL your existing mcp entries (open-design, exa, context7, gh_grep) ──

  "mcp": {

    // ── YOUR EXISTING SERVERS (DO NOT TOUCH) ──
    // open-design: { ... }     ← untouched
    // exa: { ... }             ← untouched
    // context7: { ... }        ← untouched
    // gh_grep: { ... }         ← untouched

    // ── NEW: ALWAYS-ON (low/zero passive token cost) ──

    "sequential-thinking": {
      "type": "local",
      "command": ["npx", "-y", "@modelcontextprotocol/server-sequential-thinking"],
      "enabled": true
    },

    "semgrep": {
      "type": "remote",
      "url": "https://mcp.semgrep.ai/mcp",
      "enabled": true
    },

    "desktop-commander": {
      "type": "local",
      "command": ["npx", "-y", "@wonderwhy-er/desktop-commander@latest"],
      "enabled": true
    },

    "git-local": {
      "type": "local",
      "command": ["npx", "-y", "@modelcontextprotocol/server-git"],
      "enabled": true
    },

    "markitdown": {
      "type": "local",
      "command": ["uvx", "markitdown-mcp"],
      "enabled": true
    },

    // ── NEW: DISABLED BY DEFAULT (enable per-session when needed) ──

    "taskmaster": {
      "type": "local",
      "command": ["npx", "-y", "task-master-ai"],
      "env": {
        "ANTHROPIC_API_KEY": "{env:ANTHROPIC_API_KEY}",
        "TASK_MASTER_TOOLS": "lean"
      },
      "enabled": false
    },

    "repomix": {
      "type": "local",
      "command": ["npx", "-y", "repomix", "--mcp"],
      "enabled": false
    },

    "discord-mcp": {
      "type": "local",
      "command": ["npx", "-y", "discord-mcp"],
      "env": {
        "DISCORD_TOKEN": "{env:DISCORD_BOT_TOKEN}"
      },
      "enabled": false
    }

  }
}
```

After writing, verify JSON is valid:
```bash
node -e "JSON.parse(require('fs').readFileSync(process.env.USERPROFILE + '\\.config\\opencode\\opencode.json', 'utf8')); console.log('Valid JSON')"
```

---

## SECTION 5 — GLOBAL AGENTS.MD APPEND

Append the following block to `~/.config/opencode/AGENTS.md`
(the GLOBAL agents file, NOT the project AGENTS.md).
If the global file doesn't exist, create it.
This teaches Sisyphus when to use each new MCP.

```markdown
## Level 2 MCP Tool Routing — Added by SISYPHUS_LEVEL2_UPGRADE

### New MCP servers and when Sisyphus routes to them

| MCP | Trigger condition | Sisyphus delegation pattern |
|-----|------------------|-----------------------------|
| `sequential-thinking` | Any task with hidden dependencies, fallback chain logic, or that burned you before | Load before planning: "think through this step by step using sequential-thinking" |
| `semgrep` | Before any PR/release, when touching IPC handlers, Discord token code, or main.cjs secrets | Run `/ahg-security` command |
| `desktop-commander` | Long-running builds, surgical edits to large files (main.cjs, App.tsx), process management | Use in subagent prompts for build tasks |
| `git-local` | Diff checks, sync verification, blame, branch analysis — all offline | Use before and after any main.cjs change |
| `markitdown` | Converting SteamDB HTML, API response payloads, or any non-markdown file to readable format | "Use markitdown to convert X to markdown" |
| `taskmaster` | ENABLE when starting a multi-session feature. Parses goals into tracked tasks | Enable in opencode.json, then "taskmaster init" |
| `repomix` | ENABLE when doing cross-cutting analysis across entire codebase | Enable in opencode.json, "repomix pack entire repo" |
| `discord-mcp` | ENABLE when debugging bot.py issues — verify slash commands, check role assignments | Enable in opencode.json with DISCORD_BOT_TOKEN |

### New slash commands available

| Command | When to use |
|---------|-------------|
| `/ahg-security` | Before any release or after touching secrets/IPC code |
| `/ahg-sync-check` | After any change to electron/main.cjs |
| `/ahg-graph` | Before planning any architectural change |
| `/ahg-build` | Full verified build sequence |
| `/ahg-ipc-audit` | Before adding new IPC handlers |

### New global skills available (auto-discoverable)

| Skill | Triggers when |
|-------|---------------|
| `security-review` | Any mention of security, secrets, tokens, validation |
| `electron-automation` | Electron-specific work, IPC debugging, packaging |
| `agent-browser` | Browser-based testing of Electron UI flows |
| `browser-trace` | Performance profiling of app UI |
| `systematic-debugging-ok` | Bug investigation, unexpected behavior |
| `api-design` | New API endpoints, IPC handler design |
| `dotnet-core` | C# Steam operations core work |
| `gsap-core` | Animation work, CSS keyframes, Framer Motion |
| `gsap-performance` | Animation performance debugging |
```

---

## SECTION 6 — UPDATE SISYPHUS SKILL INVENTORY

Append the following to SISYPHUS-MANUAL.md under section 3.3
"MCP Servers Available" — DO NOT modify any existing content,
only append:

```markdown
### 3.4 Level 2 MCP Servers (Added by SISYPHUS_LEVEL2_UPGRADE.md)

| MCP Server | Tools | Purpose | Default |
|------------|-------|---------|---------|
| **Sequential Thinking** | `sequentialthinking` | Force step-by-step reasoning on complex tasks | ON |
| **Semgrep** | `security_check`, `semgrep_scan`, `get_abstract_syntax_tree` | Security scanning of TS/JS/Python | ON |
| **Desktop Commander** | `execute_command`, `edit_block`, `search_files`, `list_processes` | Surgical file edits, long-running processes | ON |
| **Git Local** | `git_log`, `git_diff`, `git_blame`, `git_status` | Offline git operations, sync verification | ON |
| **MarkItDown** | `convert_to_markdown` | Convert PDFs, HTML, DOCX to markdown | ON |
| **TaskMaster** | `get_tasks`, `next_task`, `set_task_status`, `expand_task` | Cross-session task tracking | OFF* |
| **Repomix** | `pack_codebase`, `pack_remote_repo` | Full-repo context packaging | OFF* |
| **Discord MCP** | `send_message`, `read_messages`, `get_members` | Bot verification, channel monitoring | OFF* |

*OFF = enabled: false in opencode.json. Enable per-session as documented.
```

---

## SECTION 7 — VERIFICATION

Run these checks. Report pass/fail for each.

### 7.1 MCP config is valid JSON
```bash
node -e "JSON.parse(require('fs').readFileSync(process.env.USERPROFILE + '\\.config\\opencode\\opencode.json', 'utf8')); console.log('opencode.json: PASS')"
```

### 7.2 Sequential thinking MCP available
```bash
npx -y @modelcontextprotocol/server-sequential-thinking --version 2>&1 | head -1
```
Expected: version string or no error.

### 7.3 Desktop commander setup ran
```bash
npx @wonderwhy-er/desktop-commander@latest --version 2>&1 | head -1
```

### 7.4 Semgrep remote MCP reachable
```bash
curl -s -o /dev/null -w "%{http_code}" https://mcp.semgrep.ai/mcp
```
Expected: 200 or 405 (both mean reachable).

### 7.5 New skills installed
Confirm these directories exist:
- `%USERPROFILE%\.config\opencode\skills\security-review\`
- `%USERPROFILE%\.config\opencode\skills\electron-automation\`
- `%USERPROFILE%\.config\opencode\skills\agent-browser\`
- `%USERPROFILE%\.config\opencode\skills\systematic-debugging-ok\`

### 7.6 New commands installed
Confirm these files exist:
- `.opencode\commands\ahg-security.md`
- `.opencode\commands\ahg-sync-check.md`
- `.opencode\commands\ahg-graph.md`
- `.opencode\commands\ahg-build.md`
- `.opencode\commands\ahg-ipc-audit.md`

### 7.7 Existing MCPs preserved
Confirm your existing MCP keys are still in opencode.json:
Open Design, Exa, Context7, and gh_grep must still be present.

---

## SECTION 8 — FINAL REPORT TO USER

When all sections complete, output exactly this format:

```
SISYPHUS LEVEL 2 UPGRADE — COMPLETE

MCP AGENTS ADDED:
✓ sequential-thinking  — step-by-step reasoning (always-on)
✓ semgrep              — security scanning (always-on, remote)
✓ desktop-commander    — surgical edits + process control (always-on)
✓ git-local            — offline git operations (always-on)
✓ markitdown           — file-to-markdown conversion (always-on)
○ taskmaster           — task tracking (disabled, needs ANTHROPIC_API_KEY)
○ repomix              — full-repo packaging (disabled, enable per-session)
○ discord-mcp          — Discord bot verification (disabled, needs DISCORD_BOT_TOKEN)

SKILLS INSTALLED (global):
✓ security-review, electron-automation, agent-browser,
  browser-trace, systematic-debugging-ok, api-design,
  dotnet-core, gsap-core, gsap-performance

COMMANDS INSTALLED:
✓ /ahg-security   /ahg-sync-check   /ahg-graph
✓ /ahg-build      /ahg-ipc-audit

PRESERVED (untouched):
✓ SISYPHUS-MANUAL.md   ✓ GLOBAL-SUPERPOWERS.md   ✓ AGENTS.md
✓ Open Design MCP      ✓ Exa MCP                 ✓ Context7 MCP
✓ GitHub Code Search   ✓ All existing skills      ✓ graphify

ITEMS REQUIRING YOUR ACTION:
→ TaskMaster: set ANTHROPIC_API_KEY env var, then enable in opencode.json
→ Discord MCP: set DISCORD_BOT_TOKEN env var, then enable in opencode.json
→ Repomix: enable in opencode.json when doing full-repo analysis sessions

→ RESTART OPENCODE NOW.
```

---

## QUICK REFERENCE — Enabling disabled MCPs later

### TaskMaster (cross-session task tracking)
Useful for long features spanning multiple days:
1. Set environment variable: `ANTHROPIC_API_KEY=your_key`
2. In opencode.json: `"enabled": true` under `taskmaster`
3. Restart OpenCode
4. Tell Sisyphus: "taskmaster, initialize this project and parse TODO.md"

### Discord MCP (bot debugging)
Useful when debugging bot.py slash command behavior:
1. Set environment variable: `DISCORD_BOT_TOKEN=your_bot_token`
2. In opencode.json: `"enabled": true` under `discord-mcp`
3. Restart OpenCode
4. Tell Sisyphus: "use discord-mcp to check the last 10 messages in #bot-logs"

### Repomix (full-repo analysis)
Useful for "find all X across the whole project" queries:
1. In opencode.json: `"enabled": true` under `repomix`
2. Restart OpenCode
3. Tell Sisyphus: "use repomix to pack the entire repo, then find all hardcoded appids"
4. Disable again after the session to avoid passive overhead
