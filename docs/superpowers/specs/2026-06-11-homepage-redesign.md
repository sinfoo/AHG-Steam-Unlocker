# Homepage Redesign — Track 2.1

> AHG Unlocker — Dark gaming utility with violet accent
> Design approved 2026-06-11

## Goal

Visually overhaul the HomePage into a premium gaming dashboard. Make it "pop" — modern, immersive, cohesive — while respecting the existing DESIGN.md tokens and dark utility brand.

## Scope

Three phases delivered in one session:

### Phase A — Hero Section (extracted + redesigned)

New `src/components/HeroSection.tsx` (~200 lines).

**Layout:**
- Full-bleed featured game image as backdrop
- Mouse-tracked spotlight overlay (radial gradient following cursor)
- Single `backdrop-blur` panel for text readability (replaces 5 stacked gradient divs)
- Quick Access panel on desktop: 4 cover cards, arrow navigation, hover scale + genre-tinted glow
- CTA row: Play Now (primary), Browse All (glass), Shuffle (amber sparkle icon)
- Floating stat badges on hover: rating, players count, genre

**States:**
- Loading: skeleton shimmer with violet gradient
- Empty (no featured): "Welcome to AHG" with animated ambient orbs
- Image loaded: fade-in, no layout shift

### Phase B — Content Sections (layout polish)

Modifications within existing HomePage.tsx.

**Section container pattern (uniform):**
```html
<div class="bg-[#0c0c18]/80 rounded-2xl border-t border-violet-500/10 p-4">
  <div class="flex items-center justify-between mb-3">
    <h3 class="text-[#f8fafc] font-semibold flex items-center gap-2">
      <icon /> Section Title
    </h3>
    <button class="text-[#94a3b8] text-sm hover:text-[#f8fafc]">See All →</button>
  </div>
  <div class="...content-row...">
    <!-- game cards, category badges, etc -->
  </div>
</div>
```

**Row variants:**
- *Trending/Popular* — single horizontal scroll (overflow-x-auto, fade edges)
- *Categories* — 2×4 grid with genre-matched gradient badges
- *AI Recommendations* — 2-row mini grid with wider cards + description

**All entrance animations**: CSS `@keyframes` (fadeUp) — no framer-motion for section reveals.

**Empty state**: Muted "Nothing here yet" placeholders per section.

### Phase C — Performance

- Extract hero → reduces HomePage from 803→~500 lines (cleaner re-render boundary)
- Section entrance: CSS animations instead of ~30 framer-motion divs
- Replace inline `style={{ color: COLORS.x }}` with Tailwind utilities where possible
- `content-visibility: auto` on below-fold sections

## Files Changed

| File | Lines | Action |
|------|-------|--------|
| `src/pages/HomePage.tsx` | 803→~500 | Remove hero JSX, simplify sections, use new components |
| `src/components/HeroSection.tsx` | ~200 | **New** — redesigned hero with mouse spotlight |
| `src/components/HomePageSkeleton.tsx` | ~50 | **New** — standalone skeleton (extracted from inline) |
| `src/styles/home-animations.css` | +several @keyframes | Section entrance animations |

## Non-Changes (out of scope)

- No new Zustand stores or store modifications
- No new npm dependencies
- No changes to shared components (GameCard, BentoCard, BottomActionsCard)
- No modifications to other pages
- No new IPC handlers

## Design Token Compliance

- All colors from `docs/DESIGN.md` primary palette, background scale, text, border tokens
- Interactive transitions: 80ms `cubic-bezier(0.4, 0, 0.2, 1)`
- Zero hardcoded hex colors — all via DESIGN.md tokens
- Zero white surfaces
- Font stack: Inter per DESIGN.md

## Verification

- `npx tsc --noEmit` → 0 errors
- `npm run build` → 0 new errors
- Visual check: hero renders, spotlight tracks, sections appear, empty states display
