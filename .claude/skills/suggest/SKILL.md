---
name: suggest
description: >-
  Load and synthesize ALL project context into a clear, actionable plan with high-impact feature suggestions.
  This is the onboarding and big-picture skill for AHG Steam Unlocker.
  MUST TRIGGER when user says: /load, /suggest, "project plan", "project overview", "architecture overview",
  "understand the project", "onboard me", "project summary", "what are we building", "landing page",
  "load the project", "project context", "get me up to speed", "show me the big picture", "full context",
  "tell me about this project", "project status", "where are we at", "what should I work on",
  "suggest features", "what's next", or any request to understand full project scope and structure.
  Do NOT trigger for single-file questions, code searches, git history, or basic debugging.
  Works best when graphify has been run first (reads graphify-out/), but falls back to markdown-only.
  Always produces both a written report and an in-context summary.
---

# /suggest — Project Context Synthesizer & Feature Suggestion Engine

A skill for the **AHG Steam Unlocker** project that:
1. **Loads everything** — graphify knowledge graph, all boot files, key source files
2. **Synthesizes** — architecture, components, relationships, todos, goals, open questions
3. **Analyzes** — understands the core purpose of AHG Unlocker (Steam game/DLC unlocker via manifest injection)
4. **Suggests** — high-impact features aligned with the app's purpose
5. **Reports** — writes a structured report AND gives an in-context summary

## Why This Skill Exists

When you're dropped into this codebase cold, or when you need to reorient after a break, or when you want fresh eyes on what to build next — this skill gives you the full picture. It prevents operating blind.

The AHG Unlocker is a large polyglot project (Electron + React + TypeScript + Python + C#) with 176K+ game entries, 97 mirror repos, dozens of components, and many layers. Without a systematic overview, it's easy to make changes that contradict existing architecture or miss high-impact opportunities.

---

## Workflow

Follow these steps in order. Do NOT skip steps.

### Step 1: Load Project Context (MANDATORY)

In parallel, read ALL of the following:

**Graphify knowledge graph:**
- `graphify-out/GRAPH_REPORT.md` — community hubs, god nodes, surprising connections
- `graphify-out/graph.json` — full knowledge graph data (nodes, edges, communities)

**Boot/Memory files:**
- `AGENTS.md` — project rules, autonomy charter, overrides
- `SESSION.md` — active session, error registry, work log
- `TODO.md` — prioritized work items, active queue, backlog
- `docs/DECISIONS.md` — permanent architectural decisions
- `docs/DESIGN.md` — design tokens (colors, typography, spacing, motion)
- `docs/DEVELOPMENT_MEMORY_BEAST.md` — full intelligence stack
- `docs/SISYPHUS-MANUAL.md` — operating procedures
- `docs/GLOBAL-SUPERPOWERS.md` — global workflows
- `docs/PRODUCT.md` — product context, brand tone (if exists)
- `docs/DESIGN.md` — design system reference
- `SKILLS-INSTALLED.md` — skill audit log (if exists)

**Source structure (at minimum):**
- `src/` or `ui/src/` — key component tree (list directories, sample core files)
- `electron/main.cjs` — main process entry
- `electron/preload.cjs` — preload/bridge
- `package.json` — dependencies and scripts

### Step 2: Load Brainstorming Skill

Invoke the `brainstorming` skill to prepare for creative feature ideation. This is a sub-step that primes the agent for Socratic exploration before making suggestions.

### Step 3: Synthesize Architecture Understanding

Process all gathered context to understand:

1. **Project identity**: What is AHG Unlocker? Steam game/DLC unlocker via manifest injection. 176K games, 97 mirror repos.
2. **Tech stack**: Electron + React + TypeScript + Vite + Tailwind CSS + Zustand + Framer Motion + TanStack Virtual
3. **Architecture layers**:
   - Electron main process (`electron/main.cjs`) — IPC handlers, game operations, mirror repos
   - Preload bridge (`electron/preload.cjs`) — contextBridge API
   - React frontend (`ui/src/`) — pages, components, stores
   - Python middleware (`bridge/`) — JSON-RPC bridge
   - C# core (`core/`) — Steam operations, manifest scanning
4. **State management**: Zustand stores (game, user, UI, install, settings, discord)
5. **Component relationships**: Identify god components vs modular ones
6. **Current TODOs**: What's in the active queue, what's blocked
7. **Known issues**: Build warnings, IPC gaps, performance concerns
8. **Design language**: Dark gaming utility with violet accent, 80ms transitions, no glassmorphism default

### Step 4: Ask Clarifying Questions

Before making suggestions, identify what you DON'T know. Ask the user targeted questions about:
- What aspect they care about most (performance? new features? UI polish? stability?)
- Any constraints or preferences
- What they've already tried or rejected
- Short-term vs long-term goals

This is critical — don't skip this. The brainstorming skill's Socratic approach helps here.

### Step 5: Generate High-Impact Feature Suggestions

Based on your full understanding, suggest features that:

1. **Align with the app's core purpose** — everything should serve the goal of making game/DLC unlocking seamless
2. **Match the design language** — dark gaming utility, violet accents, 80ms transitions
3. **Are feasible in the existing architecture** — prefer changes that work within the current stack
4. **Address known pain points** — TODOs, bugs, performance gaps
5. **Have a clear "why"** — explain why each suggestion matters

For each suggestion, include:
- **What**: One-sentence description
- **Why**: The problem it solves or opportunity it captures
- **Impact**: High/Medium/Low
- **Effort**: Small/Medium/Large (relative to the codebase)
- **How**: Brief implementation approach
- **Prerequisites**: What must be done first

### Step 6: Write Report to File

Create a structured overview file at `.suggestions/latest.md` (create the directory if needed).

The report must include:

```markdown
# Project Overview — [date]

## Executive Summary
[2-3 sentences on what AHG Unlocker is and current state]

## Architecture

### Layers
[Electron / React / Python / C# — key files, responsibilities]

### Key Components
[Major components, stores, their relationships]

### Data Flow
[How data moves through the system]

## Current State

### Active Queue
[From TODO.md — top priorities]

### Known Issues
[Build warnings, gaps, blockers]

### Open Questions
[What's unclear or undecided]

## High-Impact Feature Suggestions

### 1. [Feature Name]
- **What**: ...
- **Why**: ...
- **Impact**: High/Medium/Low
- **Effort**: Small/Medium/Large
- **How**: ...
- **Prerequisites**: ...

### 2. [Feature Name]
...
```

### Step 7: Deliver In-Context Summary

In your response to the user, provide a concise summary:
- Project identity (one-liner)
- Architecture (2-3 sentences)
- Current state (what's active, what's blocked)
- Top 3 feature suggestions (name + one-liner why)
- Any open questions you have

Keep the response focused and actionable. Don't dump raw file contents — synthesize.

---

## Important Constraints

### DO:
- Read graphify-out/ first (it's the fastest way to understand architecture)
- Read boot files in the documented order
- Ask questions before suggesting if intent is unclear
- Suggest features that align with AHG Unlocker's purpose
- Write to `.suggestions/latest.md`
- Use brainstorming skill for creative exploration

### DO NOT:
- Read every single source file (you'll run out of context)
- Suggest features that conflict with established design tokens (DESIGN.md)
- Suggest changes that require rewriting core architecture without asking first
- Suggest features outside the app's domain (no blockchain, no NFTs, no unrelated pivots)
- Overwrite existing `.suggestions/latest.md` without noting the previous version
- Dump raw file contents into your response — always synthesize
- Trigger on single-file questions, code searches, or git history

### Edge Cases:
- **No graphify-out/ exists**: Skip graphify, use markdown-only analysis. Note the gap.
- **No .suggestions/ directory**: Create it. First run creates the directory.
- **Only one boot file exists**: Work with what's available. Note what's missing.
- **User gives conflicting signals**: Ask. Don't guess.
- **Project is in early/no-code stage**: Focus on setup, foundations, architecture decisions.
