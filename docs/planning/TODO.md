# TODO.md — AHG Unlocker Task Queue
# Version: 1.0.0
# Status: ✅ Done | 🔄 In Progress | ⏳ Pending | ⚫ Blocked

---

## ✅ ALL TASKS COMPLETE — NO OPEN ITEMS

There are no pending, in-progress, or blocked tasks. Everything below shipped and was
verified (tsc + vite build + packaged smoke test).

---

## Completed (2026-06-25)

### Core / functional
- ✅ Install pipeline: extract the real SteamTools lua from the Ryuu zip (was a no-op stub);
  per-file manifest-write guards; don't write appinfo.json on a 0-manifest "success".
- ✅ `image-cache://` protocol fixed (protocol.handle + fixed authority) — covers/hero render.
- ✅ Tailwind v4 regressions fixed (unlayered reset → @layer base; font comment `*/`).
- ✅ "Fix Games Not Showing" → working luatools installer (steam.run is dead/404).
- ✅ Update-available detection (installed games vs Ryuu `updated_date` → amber Update badge).
- ✅ New Ryuu games surface in Browse silently; new/updated fixes (incl. online-fix.me) detected.
- ✅ Batch install wired (was a stub).
- ✅ Activation gate fixed — the `execPath.includes('dev-release')` dev-bypass matched the
  packaged build (which ships in dev-release\win-unpacked); removed so missing license gates.
- ✅ Added-game card flips to "Installed" immediately (optimistic add + merge-not-overwrite).

### UI / UX
- ✅ Home hero: fit/quality fix (removed background-attachment:fixed) + true preload crossfade.
- ✅ Instant splash (window created before the 54 MB DB load) + reimagined loading screen
  (live boot-log stream + rotating tips on top of particles/grid/orbs).
- ✅ Exe icon embedded into the packaged build via rcedit (wired into /ahgrebuild).
- ✅ Premium game-card buttons (shine sweep) + Update badge.
- ✅ All four page heroes (Library/Favourites/Recent/Fixes) → content-driven cover backdrops.
- ✅ AHG Script modal: premium indeterminate progress bar.
- ✅ Activation success modal reimagined (celebration burst + gradient title).
- ✅ Browse search image rendering (auto priority + tightened load stagger).
- ✅ Reimagined sidebar nav button hover/click (glow accent bar + sheen sweep + tactile press).
- ✅ Removed "Continue Playing" section from Home.

### Infra / housekeeping
- ✅ CSS-layer + comment guard (`scripts/check-css-layers.cjs`) wired into build.
- ✅ Packaged-build smoke test (`scripts/smoke-packaged.cjs`) wired into /ahgrebuild.
- ✅ Workspace cleanup: removed ~305 MB of archives/backups/screenshots + dead `.js` stubs.
