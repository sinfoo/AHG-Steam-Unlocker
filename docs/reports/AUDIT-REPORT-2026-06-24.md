# AHG Unlocker — Audit, Fixes & Roadmap

**Date:** 2026‑06‑24  ·  **Stack:** Electron + React 18 + TypeScript 6 + Vite 7 + Tailwind CSS v4 + Zustand 5
**Verification on your machine:** `tsc --noEmit` → **0 errors** · `vite build` → **OK (2080 modules, 5.2s)** · live headless render → **clean** (app mounts, fully styled, no crashes).

---

## 1. Executive summary

I scanned the whole renderer (`src/`, 168 files) and audited the Electron main/services layer, fixed the Browse row‑gap, removed a real styling‑pipeline bug, fixed several memory leaks and a duplicate‑key bug, cleaned ~270 MB of clutter out of the repo, and verified everything still type‑checks, builds, and runs. Three specialized review passes surfaced ~45 issues; the high‑confidence, low‑risk ones are **fixed and verified**, and the rest (mostly Electron‑runtime changes that must be tested in a packaged build) are listed below with exact patches.

**Headline finding:** the production `index.html` was loading the **Tailwind Play CDN** (`cdn.tailwindcss.com`) *in addition to* the correct compiled Tailwind v4 CSS. That CDN is online‑only, the wrong major version, "not for production," and it printed a console warning on every launch — the likely cause of the documented "styling disappears in the packaged/offline build" regression. **Removed.** I then proved via a live render that the app is fully styled **without** it.

---

## 2. What I fixed (applied & verified)

| # | Area | File(s) | Change |
|---|------|---------|--------|
| 1 | **Browse row‑gap** | `components/browse/BrowseGameGrid.tsx`, `pages/BrowsePage.tsx`, `components/cards/GameCard.tsx` | See §3. Uneven row gaps → now uniform. |
| 2 | **Styling / offline / console** | `index.html` | Removed the `cdn.tailwindcss.com` script. Styling now comes only from the compiled v4 CSS (verified working live). Kills a production console warning + an online dependency. |
| 3 | **Dead cleanup = real bug** | `components/browse/CarouselSlide.tsx:40` | Effect cleanup was `() => { key !== loadKeyRef.current }` — a no‑op expression (lint error). Now invalidates the in‑flight image load on unmount/re‑run. |
| 4 | **Duplicate React keys** | `hooks/useToastNotifications.ts` | Toast `id` was `Date.now()`; two toasts in the same millisecond got identical keys and dismissed each other. Now a monotonic counter. |
| 5 | **AudioContext leak** | `hooks/useSound.ts` | A `new AudioContext()` was created on every sound; browsers cap ~6, after which audio silently dies. Now one shared, reused context. |
| 6 | **Listener leak** | `hooks/useLicense.ts` | `onLicenseStateChanged` listener was never removed → accumulated on every remount. Now cleaned up on unmount (defensively, since it's typed `void`). |
| 7 | **Lint correctness** | `pages/LibraryPage.tsx` | `let preFilter` / `let result` → `const` (the 2 remaining lint errors). |

ESLint went from **3 errors → 0 errors**. (67 `react-hooks/exhaustive-deps` warnings remain — see §6/§7.)

---

## 3. The Browse row‑gap — root cause & fix

**Symptom:** vertical spacing between rows of game cards was inconsistent (some rows too far apart, some cramped).

**Root cause (two compounding issues):**
1. `BrowseGameGrid` rendered each virtualized row with a hard‑coded `height: ${virtualRow.size}px`. That **defeats** TanStack Virtual's `measureElement` — the row can never report its true height, so the gap was whatever was left over from a *fixed estimate* (`coverHeight + INFO_PANEL_HEIGHT(175) + ROW_GAP`). When a card's title was 1 line instead of 2, the estimate over‑shot and left a big gap; long titles got cramped.
2. The virtualizer never re‑measured when `rowHeight` changed (toggling grid/list or compact mode), so offsets went stale.

**Fix:**
- `BrowseGameGrid.tsx` — removed the fixed `height`; the row now measures its real content height. The gap is baked into the measured box via `paddingBottom` (so `getBoundingClientRect().height` includes it and rows can never overlap). Removed the dead inner `rowGap`; added `alignItems:'stretch'`.
- `BrowsePage.tsx` — added `useEffect(() => rowVirtualizer.measure(), [rowHeight, rowVirtualizer])` so a viewMode/compact/width change re‑measures immediately.
- `GameCard.tsx` — reserved a 2‑line title height (`minHeight: 2.5em`) so 1‑line and 2‑line cards are the same height → uniform grid.

The gap is now **exactly `ROW_GAP` (12px, or 8px compact) regardless of card content** — correct by construction. Verified: type‑checks, builds, and the Browse page renders with no runtime errors. (A pixel‑perfect screenshot of populated rows needs the real Electron app with the games DB — the browser preview has 0 games — but the mechanism is deterministic.)

---

## 4. Console errors — before / after (live capture)

I served the production build via `vite preview` and drove it with headless Chrome DevTools. After the fixes, the console is clean:

**Gone:** the `cdn.tailwindcss.com should not be used in production` warning; duplicate‑key risk from toasts.
**Remaining (minor):**
- `favicon.ico` 404 — **browser‑preview only**; Electron uses the window icon, so it's a non‑issue for the shipped app. (Optional: add `public/favicon.ico` to silence it in dev.)
- "A form field element should have an id or name attribute" — the search input. Trivial a11y nit; add `name="search"` / `id`.

> Note on method: I couldn't run the app inside the Cloud sandbox (its npm registry is network‑blocked and the mounted `node_modules` holds Windows‑only native binaries), so I ran the build, type‑check, and headless render **on your actual machine** via the local toolchain. That's why the results above are authoritative.

---

## 5. Repo organization (done)

Moved into a new `_ARCHIVE/` folder (nothing deleted — there's no git history to fall back on, so I relocated instead):
- `_ARCHIVE/src-backups/` — `src/App.tsx.backup_broken` (329 KB), `src/index.css.backup_broken`, `src/graphify-out/` (AST cache). **`src/` is now free of stray artifacts.**
- `_ARCHIVE/unrelated-installers/` — `Claude Setup.exe`, `Claude Setup (1).exe` (~210 MB, unrelated to this app).
- `_ARCHIVE/skill-zips/` — 3 downloaded skill `.zip`s (~58 MB).
- `_ARCHIVE/scratch/` — 31 items: numbered scratch files, `debug-*.png`, `screenshot.png`, `e2e-*.png`, `*.log`, `cdp_inspect.py`, `bundle-report.html`.

Hardened **`.gitignore`** (it previously did **not** ignore `node_modules/` or `dist/`): added `node_modules/`, `dist/`, `dist-electron/`, `dev-release/`, `*.tsbuildinfo`, the root Electron runtime binaries (`/*.dll`, `/*.pak`, `/*.bin`, `/AHG Unlocker.exe`, `/locales/`), `_ARCHIVE/`, and the scratch globs.

I intentionally **left all build/runtime files in place** (`dist/`, `resources/`, `games.db`, `fixes.db`, the `.exe`, dlls/paks) so nothing you run breaks — they're just git‑ignored now.

---

## 6. High‑impact items recommended next (with patches)

These are real, high‑value, but they touch the **Electron main/preload layer** and must be validated in a packaged build — so I've left them for a verified pass rather than editing blind. I can apply + test them live on request.

### 6.1 🔴 Image pipeline — white/black cover boxes (likely root cause)
`<img src="image-cache:///…">` uses a custom scheme that is registered with `protocol.registerFileProtocol` **but never declared privileged**. A non‑privileged custom scheme is treated as opaque, so `<img>` loads can be silently blocked → the reported white boxes / black‑box‑with‑letter fallback.
**Fix (electron/main.cjs, top level, before `app.whenReady`):**
```js
const { protocol } = require('electron')
protocol.registerSchemesAsPrivileged([{
  scheme: 'image-cache',
  privileges: { standard: true, secure: true, supportFetchAPI: true, bypassCSP: true }
}])
```
Then register the handler synchronously in `whenReady` (on Electron ≥33 prefer `protocol.handle`).

### 6.2 🔴 11 missing preload bindings → dead data paths
`src/bridge.ts` calls `api?.getLocalImage`, `getLocalImageManifest`, `gameExists`, `getApiConfig`, `setApiConfig`, `checkConnectivity`, `upsertGame`, `updateGameCover`, `upsertGames`, `getFix`, `getAllGameIds` — but `preload.cjs` never exposes them, so they silently return null. The **local‑image fast path and all DB mutations are dead** (every cover falls through to the slow multi‑CDN network race — also a perf hit).
**Fix:** add the matching `ipcRenderer.invoke` bindings to `preload.cjs` (the main‑process handlers already exist: `get-local-image`, `db:game-exists`, `get-api-config`, `check-connectivity`, `db:upsert-game`, …). Additive and fail‑safe.

### 6.3 🔴 Security — `webSecurity: false`
`BrowserWindow` is created with `webSecurity:false` while loading remote Steam/SGDB/GitHub content. **Fix:** set `webSecurity:true` and rely on the privileged `image-cache://` scheme (6.1) instead of disabling web security.

### 6.4 🔴 Security — unvalidated `shell.openExternal`
`open-external` (electron/handlers/persistence.cjs) passes a renderer‑supplied URL straight to `shell.openExternal`. A crafted `file:`/`smb:` URL can trigger OS handlers. **Fix:** allow only `https:` (and maybe `mailto:`) before opening.

### 6.5 🟠 `App.tsx` effect leaks
- **Retry‑timer leak (~L567‑606):** the init‑load effect returns its `clearTimeout` *from inside a `.then()`*, so the 3s retry timer is never cleared; on unmount/StrictMode it fires `setState` after unmount. Hoist the timer to effect scope and return cleanup from the effect body.
- **Duplicate IPC listeners (~L503‑559):** `setupPostLoadHandlers()` re‑registers `onScanProgress`/`onDownloadProgress`/`onInstallLog` every time the effect re‑runs and never removes them → progress events multiply. Move them to a mount‑once effect that returns an unsubscribe.

---

## 7. Other findings (prioritized backlog)

**🟠 Medium**
- `services/offlineCache.ts` — reads `result?.manifest`/`result?.entries` but handlers return the object/array directly → always empty. Also `cacheManifest(appid)` omits the 2nd `manifestData` arg, so offline cache stores nothing.
- `main.cjs:70‑77` — synchronous `fs.appendFileSync` on **every** renderer console message blocks the main thread; switch to async/buffered.
- `components/GameCover.tsx` — full‑image opacity stays `0` until `loaded`; on a cache 404 it collapses to the letter fallback. Fixing 6.1 addresses the root, but default the non‑WebGL path to `opacity:1` and retry the network URL before discarding.
- Stale‑closure / out‑of‑order races: `home/FeaturedCarousel.tsx` (sequential cover load, last‑write‑wins), `pages/HomePage.tsx` quick‑access images (no run token), `hooks/useAchievements.ts` (`setUserStats` without a mounted guard), `App.tsx:264‑266` featured‑game randomizer (stale `featuredGame`).
- `main.cjs:2779‑2798` — `preloader:*` handlers lack try/catch + null‑checks.

**🟡 Low**
- **Secrets in the renderer bundle:** a SteamGridDB API key (`services/steamGridDb.ts:49`) and a Ryuu auth code (`services/ryuuApi.ts:7`) are hardcoded and shipped. Move to main‑process config and proxy via IPC.
- Unbounded caches: `imageCache.ts` `lqipMap` and the SGDB module cache grow by entry count (TTL‑only). Add an LRU/size cap like the image‑blob cache already has.
- `components/ContextMenu.tsx` — list items keyed by array index across two different menu shapes; key by `item.label`.
- `main.cjs:506‑515` — `render-process-gone` unconditionally reloads after 2s → crash‑loop risk if the renderer crashes on load. Add a bounded retry counter.
- `bridge.ts` `pageCache` isn't true LRU (evicts insertion‑order, not least‑recently‑used).
- `useGames.ts` `loadMore` guards on the `loading` *state* (stale in closure) and hard‑codes `hasMore = games.length < 100`; use a ref + real total.

**🧹 Dead code (safe to delete after a quick `git log` check)**
- Orphan pages (0 importers): `pages/AllGamesPage.tsx`, `MyLibraryPage.tsx`, `ManageLibraryPage.tsx`, `AddGamesPage.tsx` — an older nav scheme superseded by Browse/Library/Settings.
- `components/GameGrid.tsx` — the component is rendered nowhere; **keep the file but extract the still‑used `POPULAR_RANK` const** into `constants/` and delete the dead component body.
- `components/index.ts` — unused barrel (pages import concrete paths).
- Root `main.cjs` / `preload.cjs` — duplicates of the live `electron/` versions (package.json `main` = `electron/main.cjs`).
- `src/workers/gameLoader.worker.js` — stray compiled artifact; the `.ts` sibling is live.

---

## 8. Performance enhancements

- **Wire up the local‑image fast path (6.2):** the biggest real win — covers currently always take the slow multi‑CDN network race because the local path is dead. This alone should cut perceived load and the white‑box window dramatically.
- **`BottomActionsCard` chunk is 90 KB** (larger than every page) — investigate what it pulls in (likely a heavy inline data/asset) and split or lazy‑load it.
- **`vendor-motion` (framer‑motion) is 121 KB** — adopt `LazyMotion` + the `m` component and load features on demand to shave a large slice off the initial vendor bundle.
- **Async the main‑thread logging (§7)** — sync disk writes on every console message hurt responsiveness under load.
- Add **LRU caps** to the unbounded renderer caches (§7) for long sessions over a 176K‑game library.

---

## 9. Feature / add‑on ideas

- **True offline mode:** once 6.1/6.2 and the `offlineCache` shape mismatches are fixed, the "cache manifests for offline install" feature actually works end‑to‑end — worth surfacing in the UI.
- **Settings → accent theming:** the design tokens already exist as CSS variables (`--color-violet`, etc.); exposing an accent picker is low effort and high delight.
- **Search‑input a11y + a global "/" focus shortcut** (the command palette infra already exists; extend it).
- **Crash‑recovery UI** instead of the silent reload loop (§7) — show "Renderer crashed, reloading… / Report" with a bounded retry.

---

## 10. What's next (recommended order)

1. **Apply & test the 4 🔴 Electron fixes** (privileged scheme, preload bindings, `webSecurity`, `openExternal`) in a packaged build — this resolves the cover‑image bug and two security gaps. *I can do this and verify it live.*
2. **Apply the `App.tsx` leak fixes** (6.5).
3. **Move the hardcoded secrets** out of the renderer (§7).
4. **Delete the dead code** (§7) after a git‑history check — removes 4 pages + a duplicate Electron entry pair.
5. **Performance pass** (§8): local‑image path, `BottomActionsCard`, `LazyMotion`, async logging.
6. **Clean up the 67 `exhaustive-deps` warnings** — most are noise, but a few (flagged in §6/§7) are real races; fix those, then silence the rest deliberately.

Want me to proceed with step 1 (the Electron image‑pipeline + security fixes) and verify them in a packaged build? I can also produce a pixel screenshot of the populated Browse grid by pointing the preview at your real games DB.
