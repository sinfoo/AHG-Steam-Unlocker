# SKILLS-INSTALLED.md — AHG Unlocker Skill Audit Log
# Version: 1.0 BEAST
# READ BY: Sisyphus before installing any new skill (check for duplicates)
# WRITTEN BY: Sisyphus whenever a skill is installed or updated

---

> ⚡ **SISYPHUS INSTRUCTION**: Before installing any skill, check this file.
> If the skill is already listed, use the existing installation path.
> After any auto-install, append to this log immediately.
> Skills marked BROKEN need repair before use — do NOT invoke them.

---

## SKILL STATUS KEY
```
✅ ACTIVE    — Installed and verified working
⚠️ UNVERIFIED — Installed but not yet tested
🔴 BROKEN    — Install failed or skill throws errors
🗑️ REMOVED   — Uninstalled (keep log entry for reference)
```

---

## GLOBAL SKILLS (`~/.config/opencode/skills/`)

| Skill Name | Status | Source | Installed | Last Used | Notes |
|-----------|--------|--------|-----------|-----------|-------|
| `security-review-farmage` | ✅ ACTIVE | github.com/farmage/opencode-skills | 2026-05-14 | 2026-05-14 | Security audit for IPC + credentials |
| `dependency-auditor-farmage` | ✅ ACTIVE | github.com/farmage/opencode-skills | 2026-05-14 | — | npm + pip audit |
| `api-design-farmage` | ✅ ACTIVE | github.com/farmage/opencode-skills | 2026-05-14 | — | New IPC handler design |
| `electron-automation` | ✅ ACTIVE | github.com/mxyhi/ok-skills | 2026-05-14 | 2026-05-14 | Electron IPC, BrowserWindow |
| `browser-trace` | ✅ ACTIVE | github.com/mxyhi/ok-skills | 2026-05-14 | — | CDP trace, UI performance |
| `systematic-debugging-ok` | ✅ ACTIVE | github.com/mxyhi/ok-skills | 2026-05-14 | — | Root cause analysis |
| `tdd-ok` | ✅ ACTIVE | github.com/mxyhi/ok-skills | 2026-05-14 | — | TDD cycle |
| `gsap-performance` | ✅ ACTIVE | github.com/mxyhi/ok-skills | 2026-05-14 | — | Animation performance |
| `gsap-react` | ✅ ACTIVE | github.com/mxyhi/ok-skills | 2026-05-14 | — | Framer Motion patterns |
| `debugging-farmage` | ✅ ACTIVE | github.com/farmage/opencode-skills | 2026-05-14 | — | Deep debugging |
| `dotnet-core` | ✅ ACTIVE | github.com/farmage/opencode-skills | 2026-05-14 | — | C# Steam operations |
| `fastapi-farmage` | ✅ ACTIVE | github.com/farmage/opencode-skills | 2026-05-14 | — | Python API work |

---

## PROJECT SKILLS (`.claude/skills/`)

| Skill Name | Status | Source | Installed | Notes |
|-----------|--------|--------|-----------|-------|
| `impeccable` | ✅ ACTIVE | obra/superpowers | Prior | 9-phase UI polish pipeline |
| `brainstorming` | ✅ ACTIVE | obra/superpowers | Prior | Socratic design before coding |
| `writing-plans` | ✅ ACTIVE | obra/superpowers | Prior | Bite-sized implementation plans |
| `subagent-driven-development` | ✅ ACTIVE | obra/superpowers | Prior | Parallel subagent dispatch |
| `executing-plans` | ✅ ACTIVE | obra/superpowers | Prior | Batch execution with checkpoints |
| `dispatching-parallel-agents` | ✅ ACTIVE | obra/superpowers | Prior | Parallel stream splitting |
| `test-driven-development` | ✅ ACTIVE | obra/superpowers | Prior | TDD cycle |
| `using-git-worktrees` | ✅ ACTIVE | obra/superpowers | Prior | Isolated workspace |
| `requesting-code-review` | ✅ ACTIVE | obra/superpowers | Prior | Review dispatch |
| `receiving-code-review` | ✅ ACTIVE | obra/superpowers | Prior | Implement review feedback |
| `verification-before-completion` | ✅ ACTIVE | obra/superpowers | Prior | Pre-done verification |
| `systematic-debugging` | ✅ ACTIVE | obra/superpowers | Prior | 4-phase root cause |
| `finishing-a-development-branch` | ✅ ACTIVE | obra/superpowers | Prior | Verify → merge |
| `using-superpowers` | ✅ ACTIVE | obra/superpowers | Prior | Bootstrap — invoke first |
| `writing-skills` | ✅ ACTIVE | obra/superpowers | Prior | TDD for documentation |
| `frontend-design` | ✅ ACTIVE | anthropic official | Prior | Anti-AI-slop design |
| `design-motion-principles` | ✅ ACTIVE | .claude/skills/ | Prior | Motion audit (Emil Kowalski) |
| `graphify` | ✅ ACTIVE | graphifyy pip | Prior | Knowledge graph |
| `web-artifacts-builder` | ✅ ACTIVE | anthropic official | Prior | React+Tailwind components |
| `webapp-testing` | ✅ ACTIVE | anthropic official | Prior | Playwright testing |
| `brand-guidelines` | ✅ ACTIVE | anthropic official | Prior | Brand color + typography |
| `mcp-builder` | ✅ ACTIVE | anthropic official | Prior | MCP server builder |
| `skill-creator` | ✅ ACTIVE | anthropic official | Prior | Skill creation wizard |

---

## AUTO-INSTALL LOG

_Sisyphus appends here whenever a skill is auto-installed during a session._

### Template:
```
[DATE] AUTO-INSTALLED: {skill-name}
  Source: {URL}
  Trigger: {what task required it}
  Install path: {where it was installed}
  Status: {success/failed}
  Notes: {any issues or adaptations}
```

### Entries:
```
[2026-06-13] INSTALLED: ralph-loop — global + project-level
  Source: https://lobehub.com/skills/belumume-claude-skills-ralph-loop (GitHub: belumume/claude-skills)
  Trigger: User request — install ralph loop skill locally and globally
  Global path: ~/.config/opencode/skills/ralph-loop/SKILL.md
  Project path: .claude/skills/ralph-loop/SKILL.md
  Status: success
  Notes: Autonomous Ralph Wiggum loop mode for iterative task completion with TODO.md-based
         completion detection and configurable iteration caps. Version 1.0.0. State file
         goes in .claude/ralph-loop.local.md. Activation via /ralph or ralph loop mention.

[2026-05-16] AUTO-INSTALLED: oh-my-openagent (OmO) v4.1.2
  Source: npm (oh-my-openagent package) — https://github.com/code-yeongyu/oh-my-openagent
  Trigger: User request to install Sisyphus orchestrator
  Install path: npm global + plugin in ~/.config/opencode/opencode.jsonc
  Config: ~/.config/opencode/oh-my-openagent.json
  Status: success
  Notes: Sisyphus configured with opencode/claude-opus-4-7 (max) fallback chain.
         9 sub-agents + 9 categories configured. Plugin auto-loads on next OpenCode restart.

[2026-05-16] INSTALLED: oh-my-openagent v4.1.2 — project-level + global
  Source: npm (bunx oh-my-openagent install)
  Trigger: User request — install sisyphus in root folder + global auto-load
  Global config: ~/.config/opencode/opencode.json (plugin: oh-my-openagent@latest)
  Global config: ~/.config/opencode/oh-my-openagent.json (full agent harness)
  Project config: opencode.json + .opencode/oh-my-openagent.json
  Status: success
  Notes: No model subscriptions detected — uses opencode/big-pickle fallback.
         Project-level opencode.json created with both plugins.
         .opencode/ directory created for project-level overrides.

[2026-05-16] INSTALLED: suggest — project-level + global
  Source: skill-creator workflow (this session)
  Trigger: User request — create a /suggest skill that synthesizes project context and suggests high-impact features
  Global: ~/.config/opencode/skills/suggest/
  Project: .claude/skills/suggest/
  Command: .opencode/commands/suggest.md
  Status: success
  Notes: Validated through 3-test-case eval with baseline comparison.
         With-skill runs scored 15/15 assertions vs 13/15 for baseline.
         Key differentiators: graphify integration, structured report format, brainstorming skill loading.

[2026-05-16] INSTALLED: ahg-dev-loop — project-level + global
  Source: skill-creator workflow (this session)
  Trigger: User request — create a mandatory development loop enforcer with BEFORE/DURING/AFTER phases
  Global: ~/.config/opencode/skills/ahg-dev-loop/
  Project: .claude/skills/ahg-dev-loop/
  Command: .opencode/commands/ahg-dev-loop.md
  Status: success
  Notes: Three-phase auto-detection (BEFORE=planning, DURING=coding, AFTER=completion).
         Trigger-based phase detection, Playwright perf checks, graceful skill fallback.
         Direct edits TODO.md/SESSION.md, invokes /suggest for post-task synthesis.
         Validated through 3 eval pairs: with-skill scored 10/10 (2/3 completed) vs 0/15 baseline.
         Key differentiators: structured phase enforcement, graphify integration, perf budget checks.

[2026-05-16] INSTALLED: skill-creator — project-level wiring
  Source: npm (opencode-skill-creator@0.2.11)
  Trigger: User request — install skillcreator in root folder
  Global config: ~/.config/opencode/opencode.json (plugin: opencode-skill-creator)
  Global skills dir: ~/.config/opencode/skills/skill-creator
  Project config: opencode.json (plugin: opencode-skill-creator)
  Status: success
  Notes: skill-creator already present globally. Wired into project-level opencode.json.
```

---

## SKILL DISCOVERY SOURCES

When Sisyphus needs a skill not in this list, search these in order:

1. https://github.com/VoltAgent/awesome-openclaw-skills (5200+ skills)
2. https://github.com/travisvn/awesome-claude-skills
3. https://github.com/anthropics/skills (official)
4. https://github.com/obra/superpowers
5. https://github.com/farmage/opencode-skills
6. https://github.com/mxyhi/ok-skills
7. clawhub.ai (search by task keyword)

Search → confirm skill matches task → fetch SKILL.md → install → log here → use.
