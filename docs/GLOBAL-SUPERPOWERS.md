# GLOBAL-SUPERPOWERS.md — Universal Workflow for OpenCode CLI (TRIMMED)

> **Platform**: OpenCode CLI
> **Last Updated**: 2026-06-18 (TRIMMED — full version archived. This file now contains only project overrides + enforcement.)
> **Full reference**: Sections 1-5 (Bootstrap, Skill Registry, Agent Registry, Playbooks, Reference Repos) are removed to save ~30KB tokens. Invoke them on-demand via the `skill` tool when a specific playbook or registry lookup is needed.

---

## TABLE OF CONTENTS

1. [PROJECT OVERRIDES — AHG Unlocker](#1-project-overrides--ahg-unlocker)
2. [ENFORCEMENT SUMMARY](#2-enforcement-summary)

---

## 1. PROJECT OVERRIDES — AHG Unlocker

### 1.1 Project Identification

```yaml
Project: AHG Unlocker
Language: TypeScript, Python, C#
Framework: React 19 + Vite + Tailwind (frontend), Electron (desktop), Python FastAPI (backend bridge), .NET 9 (C# core)
Package Manager: npm (frontend), pip (Python), dotnet (C#)
Repository: https://github.com/sinfoo/AHG-Steam-Unlocker
```

### 1.2 Additional Tools Required

| Tool | Check Command | Install Command | Purpose |
|------|---------------|-----------------|---------|
| Python 3.12+ | `python --version` | python.org | Backend scripts, bridge server, Discord bot |
| Node.js 20+ | `node --version` | nodejs.org | Frontend dev server, Vite build |
| .NET 9 SDK | `dotnet --version` | dotnet.microsoft.com | C# Steam operations core |
| PowerShell | `pwsh --version` | Built-in on Windows | Dev/build automation scripts |

### 1.3 Project-Specific Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Full build (tsc + vite + copy electron) |
| `npm run lint` | ESLint check |
| `npm test` | Run Vitest tests |
| `npm run dev:build` | Fast dev portable EXE |
| `cd bridge && python launch.py` | Start Python bridge server |
| `dotnet build core/AHGUnlocker.Core.csproj` | Build C# core |

**Dev build (2-step, avoids winCodeSign issue):**
```bash
npm run build
electron-builder --config.directories.output=dev-release --dir
electron-builder --win portable --prepackaged dev-release\win-unpacked --config.directories.output=dev-release
```

### 1.4 Build Output Locations
- `dist/` — Vite/web build
- `dist-electron/` — Electron main process + packaged builds
- `dist-electron/win-unpacked/` — Unpacked Windows build
- `dev-release/` — Dev builds (portable EXE)

### 1.5 Critical Sync Rule
`electron/main.cjs` MUST be manually copied to `dist-electron/main.cjs` after edits.

### 1.6 Agent Routing for This Project

| Work Type | Route To | Skills |
|-----------|----------|--------|
| **React/UI changes** | `visual-engineering` | `frontend-design`, `impeccable` |
| **Electron main process** | `deep` | `systematic-debugging` |
| **Electron preload** | `deep` | `systematic-debugging` |
| **Python backend/bridge** | `deep` | — |
| **Build/config changes** | `quick` | — |
| **Bug fix** | `systematic-debugging` skill → `oracle` → `deep` | — |
| **New feature** | `brainstorming` → `writing-plans` → `deep` | — |
| **Code review** | `requesting-code-review` | — |
| **Git operations** | `git-master` + `quick` | — |
| **Architecture research** | `oracle` | — |

### 1.7 Known Issues
- `dist-electron/main.cjs` must stay manually synced from `electron/main.cjs`
- App.tsx is ~3478 lines (monolithic)
- DLC filtering from library page not working
- Hover effects on library cards not visible
- 90% of DLCs lack names/covers

---

## 2. ENFORCEMENT SUMMARY

### What You MUST Do
1. **Graphify first** — before ANY planning or complex dev work
2. **Check skill tool** — before writing code, check if a matching skill exists
3. **Verify before claiming done** — fresh evidence only
4. **Decompose → delegate → verify** — You write prompts, not code

### What You MUST NOT Do
1. Don't skip graphify
2. Don't self-verify without fresh evidence
3. Don't use "should/probably/seems to"
4. Don't broaden scope

---

**End of TRIMMED GLOBAL-SUPERPOWERS.md**
