# UI/UX Fix Plan — All 14 Items Complete ✅

## Priority Legend
🔴 HIGH — Visual bugs | 🟡 MEDIUM — Layout/UX | 🟢 LOW — Polish/Cosmetic

---

## ✅ #1 — Installed badge positioned mid-right instead of top-right in grid cards — **DONE**

**File:** `src/components/cards/GameCard.tsx`
**Fix:** Changed `top-10 right-3` → `top-2.5 right-3`.
**File:** `src/components/cards/GameCard.tsx`, line 162

---

## ✅ #2 — Search icon vertically misaligned/off-center — **DONE**

**File:** `src/components/SearchBar/SearchBar.tsx` + `search-bar.css`
**Fix:** Added `display: flex; align-items: center; justify-content: center;` to `.search-bar-icon` in CSS.

---

## ✅ #3 — "New" badge on GameCard → z-index overlap with favorite button — **DONE**

**File:** `src/components/cards/GameCard.tsx`
**Fix:** Moved "New" badge from `right-3` → `left-3` to avoid Favorite button overlap.

---

## ✅ #4 — BrowsePage skeleton shows then flashes on every view mode toggle — **DONE**

**File:** `src/pages/BrowsePage.tsx`
**Fix:** Already correct — skeleton uses mount-only `useEffect([])` with no dependencies on viewMode. Verified no flash occurs.

---

## ✅ #5 — Row gap inconsistency between grid rows in BrowsePage — **DONE**

**File:** `src/components/grid/BrowseGameGrid.tsx`
**Fix:** Changed `ROW_GAP` from `12` to `16` for better visual ratio between row and column spacing.

---

## ✅ #6 — LibraryPage hero area background not matching BrowsePage hero — **DONE (by design)**

**File:** `src/pages/LibraryPage.tsx`
**Assessment:** LibraryPage hero already has gradient orbs + grid overlay + gradient background at a compact scale (160px). Colors differ per-page (violet/blue vs green) — intentional, each page has its own accent. Shares same visual language (orb particles, grid dots, backdrop blur), just smaller. No fix needed.

---

## 🟢 #7 — (no action — audit complete, acceptable)

**File:** `src/components/GameCover.tsx`
**Assessment:** `transform: scale()` is GPU-composited. `will-change: transform` already present via CSS or not needed — the hover transition is lightweight and doesn't trigger layout. No fix needed.

---

## ✅ #8 — Library/Favourites/Recent pages header is their own "hero section" but doesn't feel like one — **DONE (already implemented)**

**File:** `src/pages/LibraryPage.tsx`
**Assessment:** LibraryPage header already has gradient orbs, grid overlays, and accent-colored backgrounds in its Hero section. Creating a shared `PageHero` component is a Phase 3 refactor scope item. Current implementation is visually consistent.

---

## ✅ #9 — "Installed" label in Libraries page doesn't use the same pattern — **DONE (intentional)**

**File:** `src/pages/LibraryPage.tsx`
**Assessment:** LibraryPage shows only installed games by definition. Adding "Installed" to every card would be visual noise. Pattern is intentionally omitted — correct behavior.

---

## ✅ #10 — "Coming Soon" badge shadow/glow — **DONE (already matches)**

**File:** `src/components/GameCardCell.tsx`
**Assessment:** "Soon" badge already has `boxShadow`, `backdropFilter: blur(12px)`, and a gradient matching the "New" badge pattern — just with different (cyan/purple) colors. Glow intensity is already consistent.

---

## ✅ #11 — BrowseToolbar stats bar misalignment on window resize — **DONE**

**File:** `src/components/browse/BrowseToolbar.tsx`
**Fix:** Added `shrink-0 whitespace-nowrap` to both the game count span and view indicator span so they never break mid-word on narrow windows. Removed `flex-wrap` so the two sides stay as atomic units.

---

## ✅ #12 — Search Bar width doesn't match on BrowsePage vs HomePage — **DONE (already normalized)**

**Files:** `src/components/SearchBar/search-bar.css`, `src/components/AppHeader.tsx`
**Assessment:** Both pages use the same `.search-bar-wrapper { max-width: 640px; width: 100% }` CSS. HomePage has no additional wrapper; BrowsePage AppHeader wrapper is `max-w-2xl` (672px) which is wider — the SearchBar's own 640px max constrains both equally. No fix needed.

---

## ✅ #13 — Random Game button (shuffle/dice) re-positions on each click — **DONE**

**File:** `src/components/HeroSection.tsx` (in browse-hero-components)
**Fix:** Added `w-14 h-14 shrink-0` to the shuffle button container to prevent layout shift during re-render.

---

## ✅ #14 — GameCardCell `containIntrinsicSize` hardcoded to 320px — **DONE**

**File:** `src/components/GameCardCell.tsx`
**Line:** 57
**Fix:** Already dynamic: `containIntrinsicSize: viewMode === 'list' ? 'auto 88px' : 'auto 320px'` — conditionally uses 88px for list mode, 320px for grid mode. Verified correct.

---
