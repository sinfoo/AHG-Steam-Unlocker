# INSTRUCTIONS — Diagnose & Fix UI Regression (Unstyled Build + Broken Images)
# For: OpenCode
# Context: AHG Unlocker, v0.90.0 BEAST
# Linked tasks: TODO.md U1, U2 | SESSION.md "CURRENT SESSION (2026-06-21) — Visual CSS Investigation"
# Do not skip steps. Run diagnostics BEFORE making any code changes. Report findings before applying fixes.

---

## Summary of the problem

Production build (and possibly dev build) is showing two separate, unrelated regressions:

1. **Tailwind utility styling is not applying.** Layout structure (sidebar, grid, flex rows) renders fine, but every visual treatment that depends on Tailwind utility classes — backgrounds, blur/glass panels, gradients, rounded corners, shadows, borders — is gone. Text falls back to default system font. This affects every page (Home, Library, Fixes, Catalogue).
2. **Some game cover images render as solid white boxes (broken-image placeholder) or solid black boxes with a fallback letter/icon instead of artwork.** This is most visible on the Catalogue page. This is unrelated to the styling issue — it's an image pipeline failure.

These must be diagnosed and fixed **separately**. Do not assume one fix resolves both.

---

## Step 0 — Reproduce and confirm scope

1. Run the app in dev mode (`npm run dev` or equivalent) and check if the styling issue reproduces there too, or if it's production-only.
   - If dev mode looks correct and only the packaged Electron build is broken → the bug is in the build/packaging pipeline (Vite config, chunk splitting, `file://` loading), not in component code.
   - If dev mode is ALSO broken → the bug is upstream in the actual CSS/Tailwind source or component changes, and is more likely related to the Phase 3.3.3 BrowsePage decomposition (Round 7) or recent Tailwind/Lightning CSS config changes.
2. Note the result before continuing. This single check eliminates half of the hypotheses below.

---

## Step 1 — Diagnose the CSS issue (production EXE)

Open DevTools in the packaged build. If not already wired up, temporarily add to `electron/main.cjs` right after `mainWindow` is created:

```js
mainWindow.webContents.openDevTools({ mode: 'detach' });
```

Remove this line again once diagnosis is complete — do not ship it.

### 1a. Network tab — is the CSS file actually loading?

- Reload and check the Network tab for requests to `assets/index-*.css` and any per-page CSS chunks (`HomePage-*.css`, `BrowsePage-*.css`, `FixesPage-*.css`, etc., per AHG-UNLOCKER-COMPLETE-REFERENCE.md's documented `cssCodeSplit: true` behavior).
- For each page in the app (Home, Library, Catalogue/Browse, Fixes), confirm whether its corresponding CSS chunk is requested at all when navigating to that page.
- Record: which CSS files return 200, which are 404, and which are never requested.

**If any page's CSS chunk is never requested:** check `dist/index.html` for missing `<link rel="stylesheet">` tags, and check whether that page's component was moved into the `game-pages` or `modals` manual chunk added in Phase 4.1 (`vite.config.ts`). Vite does not always auto-inject `<link>` tags for CSS belonging to chunks that are only reached via dynamic import — if `BrowsePage`/`LibraryPage` were merged into a shared `game-pages` chunk, their associated CSS may have stopped being treated as "entry-adjacent" and stopped getting linked in `index.html`.

**If all CSS files return 200 and are linked correctly:** the file is loading but its *contents* are wrong or being ignored — go to 1b.

### 1b. Elements tab — are the Tailwind classes present in the DOM?

Inspect a clearly broken element (e.g. a card or panel that should have a glass/blur background).

- Check the `class` attribute in the DOM. Are Tailwind utility classes present (e.g. `bg-card`, `backdrop-blur-xl`, `rounded-xl`, `border-white/10`)?
  - **If classes are present in the DOM but produce no computed style** → the CSS file loaded but does not contain rules for those classes. This points to a Tailwind v4 **content/source-detection** failure — Tailwind v4 scans source files at build time to decide which utilities to generate, and if it didn't see the class literal in scanned source, it won't emit the CSS rule even though the component still renders the class name. Go to Step 2.
  - **If the classes themselves are missing or different from what the component source has** → this is a stale build artifact or a JSX regression from the Round 7 BrowsePage decomposition. Go to Step 3.

### 1c. Computed tab — sanity check Lightning CSS minification

On the same broken element, open the Computed tab and search for any of the custom properties defined in `src/index.css`'s `@theme` block (per the reference doc: deep/dark/mid/card/violet/accent palette tokens). Confirm these CSS variables actually resolve to color values on `:root` / `html`, not `unset` or empty.

- If theme tokens are unset at `:root`, Lightning CSS may be mangling the `@theme` directive output during minification. Go to Step 4.

---

## Step 2 — Fix Tailwind v4 content/source detection (if 1b confirmed this)

1. Open the Tailwind v4 config (likely `tailwind.config.ts`/`.js`, or check `src/index.css` for a `@source` directive if using v4's CSS-first config — v4 dropped the old `content: [...]` array in favor of automatic detection plus optional `@source` overrides).
2. List every file/folder that was touched during the Round 7 BrowsePage decomposition:
   - `src/components/browse/BrowseToolbar.tsx`
   - `src/components/browse/BrowseHero.tsx`
   - `src/components/browse/BrowseGameGrid.tsx`
   - `src/components/browse/index.ts`
3. Confirm Tailwind's automatic source detection actually covers `src/components/browse/`. If there is an explicit `@source` allowlist anywhere that predates this refactor, it may not include the new subfolder.
4. Check whether any class names in the three new components are **constructed dynamically** rather than written as literal strings, e.g.:
   ```tsx
   // BREAKS Tailwind v4 detection:
   className={`bg-${color}-500`}
   // OK:
   className={color === 'purple' ? 'bg-purple-500' : 'bg-blue-500'}
   ```
   Search all three new files for template-literal or concatenated `className` props. Tailwind v4's scanner needs the full class string literally present in source.
5. If found, refactor to literal class strings (full strings per branch, not interpolated fragments).
6. Rebuild and re-check the Elements/Computed tabs from Step 1b.

---

## Step 3 — Fix stale build / chunk-linking issue (if 1b pointed here instead)

1. Delete `dist/` and `dist-electron/` entirely (don't trust incremental build state).
2. Re-run the full build chain (`npm run build` + `sync-main` step + `electron-builder --dir`, per the `ahgrebuild` task referenced in TODO.md R17).
3. Re-check Step 1a (Network tab) and 1b (DOM classes) again on a fresh build.
4. If the problem persists after a clean rebuild, revert the Phase 4.1 `manualChunks` change for `game-pages` (`BrowsePage`, `LibraryPage` merged chunk) back to one chunk per page, rebuild, and check if styling returns. This isolates whether the Phase 4.1 chunk restructuring is the actual cause versus a coincidence in timing.

---

## Step 4 — Fix Lightning CSS / Tailwind v4 `@theme` interaction (if 1c confirmed this)

1. In `vite.config.ts`, temporarily change `cssMinify: 'lightningcss'` back to `cssMinify: 'esbuild'` (or `true` for default).
2. Rebuild and check if the `@theme` custom properties resolve correctly at `:root` now.
3. **If reverting fixes it**: this confirms a Lightning CSS + Tailwind v4 `@theme`/OKLCH interop bug. Do not just leave it on esbuild silently — log this as a known constraint, check Lightning CSS's changelog/issues for Tailwind v4 `@theme` support, and decide whether to pin a different Lightning CSS version or keep esbuild as the CSS minifier going forward.
4. **If reverting does NOT fix it**: the `@theme` block itself may have been altered or corrupted in `src/index.css` independent of the minifier. Diff `src/index.css` against the last known-good commit (before Round 7/Phase 4.1) to check for accidental edits to the `@theme` block.

---

## Step 5 — Diagnose the broken image issue (separate from CSS)

This affects Catalogue/Browse most visibly (white boxes with broken-image icon, black boxes with fallback letter).

1. In DevTools Network tab, filter by `Img` and reload the Catalogue page. For a card showing a white box:
   - Find its corresponding image request. Is it a 404, a CORS failure, a pending/stalled request, or does it return 200 but the `<img>` still shows broken?
2. For a card showing solid black with a fallback letter (e.g. "P"):
   - This is very likely the LQIP/placeholder element rendering correctly but never being swapped for the real decoded image. Check the relevant card component's image-loading logic (`GameCard.tsx`, `BentoCard.tsx`, or `BrowseGameGrid.tsx` depending on which view this is) for the swap-on-load logic — confirm the `onLoad`/`onError` handler that should replace the LQIP placeholder with the final image is actually firing.
3. Cross-reference with the known architectural note already in memory/history: **SGDB cache hydration must complete before the main UI mounts.** Check whether the Catalogue/Browse grid is rendering cards before `imageDiskCache` / `imagePreloader` / native LQIP pipeline (Phase 1.2/1.3) has resolved entries for the visible viewport. If the grid mounts and requests images before cache hydration completes, requests can race and silently fail or return undefined, producing the white/black box fallback.
4. Check the native addon fallback path (`native/index.js` → sharp fallback, referenced in SESSION.md Round 8/9 work). Confirm the native addon is actually being loaded successfully in this build and isn't silently failing to a `null`/undefined return that the renderer doesn't handle.

---

## What to report back (before applying any further fixes)

For each of Steps 0, 1a, 1b, 1c, and 5, report:
- What you observed (exact findings, not assumptions)
- Which specific file(s) and config values are implicated
- Whether the fix in the corresponding step (2, 3, or 4) actually resolved it after rebuild

Do not apply Step 2, 3, or 4 fixes speculatively without first completing Step 1's diagnosis — they address different root causes and applying the wrong one will waste a rebuild cycle.
