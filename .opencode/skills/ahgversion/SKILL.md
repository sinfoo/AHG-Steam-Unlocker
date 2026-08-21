---
name: ahgversion
description: >-
  Bump ALL version strings across the AHG Unlocker project (Electron + React + TypeScript + Vite + Python bot).
  Triggered by `/ahgversion` command with a version number. Updates package.json, package-lock.json, electron/main.cjs,
  main.cjs, index.html, all React source files (App.tsx, AnimatedLoadingScreen.tsx, ModalRenderer.tsx, SettingsPage.tsx,
  uiStore.ts), the fetch-game-covers.js script, the ui/package.json, and the Python legacy GUI (main_test2.py APP_VER).
  Also updates the license system version in main.cjs and the Discord bot version string.
  Excludes node_modules/, build artifacts (dist/, dist-electron/, dev-release/), and analysis data (graphify-out/).
  Runs npm run build after updating to verify nothing broke.
  USE THIS SKILL whenever the user asks about version bumps, version changes, updating version strings,
  releasing a new version, or says "/ahgversion" - do not treat it as niche, it is the standard way to update all version references.
---

# /ahgversion — Bump All Version Strings in AHG Unlocker

## Overview

This skill performs a comprehensive version string update across the **entire AHG Unlocker codebase**.
When the user invokes `/ahgversion 0.91.0` (or any semver), you must:

1. **Discover the current version** from `package.json`
2. **Parse old and new versions** into semver components (major.minor.patch)
3. **Build a format map** for all version string variants that exist in the codebase
4. **Replace each variant** in every source file — carefully, with context matching to avoid false positives
5. **Run `npm run build`** to verify the build still passes
6. **Report results** — what changed, what was skipped, build status

## Version Format Variants

The AHG Unlocker codebase uses the current version (e.g., `0.90.0`) in these formats:

| Format | Example (old) | Example (new) | Where it appears |
|--------|--------------|--------------|------------------|
| `X.Y.Z` (bare semver) | `0.90.0` → `0.91.0` | package.json, App.tsx, ModalRenderer.tsx |
| `X.Y` (short, no patch) | `0.90` → `0.91` | index.html, SettingsPage.tsx, uiStore.ts |
| `vX.Y.Z` (v-prefixed) | `v0.90.0` → `v0.91.0` | AnimatedLoadingScreen.tsx |
| `vX.Y` (v-prefixed short) | `v0.90` → `v0.91` | index.html (splash screen) |
| `AHGUnlocker/X.Y.Z` (User-Agent) | `AHGUnlocker/0.90.0` → `AHGUnlocker/0.91.0` | electron/main.cjs, scripts/node/fetch-game-covers.js |
| `AHGUnlocker/X.Y.Z (cover-fetch)` | `AHGUnlocker/0.90.0 (cover-fetch)` → `AHGUnlocker/0.91.0 (cover-fetch)` | fetch-game-covers.js |
| `AHGUnlocker/X.Y.Z` ... (any UA suffix) | same pattern | any User-Agent header |
| License version | `0.5.7` → `<new-version>` | electron/main.cjs, main.cjs |
| Python APP_VER | `0.5` → `<new-version>` | scripts/python/utils/main_test2.py |

## Files to Update (Source Only — Build Artifacts Excluded)

### MUST UPDATE:

1. **`package.json`** → `"version": "X.Y.Z"`
2. **`package-lock.json`** → `"version": "X.Y.Z"` (two occurrences)
3. **`electron/main.cjs`** → User-Agent header + license system `version = 'X.Y.Z'`
4. **`main.cjs`** (root copy, sync'd to dist-electron) → same as electron/main.cjs
5. **`index.html`** → splash screen version text `vX.Y • Developed by sinfo`
6. **`src/App.tsx`** → `currentVersion = 'X.Y.Z'`
7. **`src/components/ModalRenderer.tsx`** → `currentVersion = "X.Y.Z"`
8. **`src/components/AnimatedLoadingScreen.tsx`** → `versionString = 'vX.Y.Z • Developed by sinfo'`
9. **`src/pages/SettingsPage.tsx`** → three separate version strings (inline text + stats cards + about section)
10. **`src/store/uiStore.ts`** → `changelogVersion: 'X.Y'`
11. **`scripts/node/fetch-game-covers.js`** → User-Agent header
12. **`ui/package.json`** → `"version": "X.Y.Z"`
13. **`scripts/python/utils/main_test2.py`** → `APP_VER = "X.Y.Z"`

### MUST NOT UPDATE (auto-generated or external):

- `node_modules/` — dependencies, never touch
- `dist/`, `dist-electron/`, `dev-release/` — build outputs, rebuilt on next build
- `graphify-out/` — knowledge graph cache, irrelevant
- Audit reports (*AUDIT*.md, BEASTOPTIMIZE-REPORT.md, COMPACT.md, SESSION.md) — user-created content, not source code
- `docs/` changelogs — user-created release notes
- `.git/` — git internals

## Replacement Strategy

### Step 1 — Resolve current version and new version

```
Current: read from package.json (field: "version")
New:     parse from the user's input (e.g., ahgversion 0.91.0 → [0, 91, 0])
```

### Step 2 — Build replacement mapping

For each format variant, construct the exact old→new replacement:

```javascript
// Example going from 0.90.0 → 0.91.0
const oldShort = `${oldMajor}.${oldMinor}`;       // "0.90"
const newShort = `${newMajor}.${newMinor}`;         // "0.91"
const oldFull  = `${oldMajor}.${oldMinor}.${oldPatch}`; // "0.90.0"
const newFull  = `${newMajor}.${newMinor}.${newPatch}`; // "0.91.0"
```

Then map each source file location to its specific replacement. Each replacement is a **targeted edit** — don't do a blanket find-and-replace across the whole file. Read each file, identify the exact lines, and edit surgically.

### Step 3 — Edit files surgically

For each file, follow the read→edit pattern:
1. Read the file
2. Find the exact line(s) containing the version string
3. Verify the surrounding context is what you expect (avoid false matches)
4. Use `edit` or `desktop-commander_edit_block` to make the replacement

**CRITICAL RULES for replacements:**
- Never replace inside a string that doesn't match your expected context. For example, `changelogVersion: '0.90'` must not match `changelogVersion: '0.909'` or `changelogVersion: '0.9'`.
- For the license version (`0.5.7` in main.cjs), the context is `const version = '0.5.7'`. Replace the whole value with the new full version.
- For `APP_VER = "0.5"` in main_test2.py, the context is `APP_VER    = "0.5"`. Replace the value with the new full version.
- For `package-lock.json`, there are exactly TWO occurrences of the version string at the top of the file — the package version (line ~3) and the lockfileVersion metadata (line ~9). Replace both.

### Step 4 — Verify

Run `npm run build` and check exit code. If it fails, report the error to the user.

## Workflow

```
User: "/ahgversion 1.0.0"

You:
1. Read package.json → current is "0.90.0"
2. Parse current (0, 90, 0) and new (1, 0, 0)
3. Build version formats:
   - Full: 0.90.0 → 1.0.0
   - Short: 0.90 → 1.0
   - V-prefixed: v0.90.0 → v1.0.0, v0.90 → v1.0
   - UA: AHGUnlocker/0.90.0 → AHGUnlocker/1.0.0
4. Edit all 13+ files surgically (parallelize independent edits)
5. Run npm run build
6. Report: "Version bumped 0.90.0 → 1.0.0 across 13 files. Build passed (0 errors)."
```

## Why This Approach Works

- **Surgical editing** avoids false positives that blanket sed would cause
- **Context matching** ensures you only change the right strings
- **Build verification** catches any accidental breakage
- **Excluding build artifacts** is critical — dist files get regenerated, and stale version strings there cause confusion
- **Updated license version** keeps the license system tracking the app version
- **Format variants** account for all the different ways version is displayed (loading screen, about page, User-Agent, settings, changelog, Discord bot)
