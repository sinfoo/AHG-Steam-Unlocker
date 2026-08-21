# GameCard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify 5 redundant card components into a shared architecture with `CardShell` base + new `hero` variant + `InstallSpeedBadge`.

**Architecture:** Extract a `CardShell` wrapper (~80 lines) that handles hover lift, genre-glow, border animation, context menu, and entry animation — shared by all card variants. Create a standalone `InstallSpeedBadge` component. Refactor GameCard, PortraitCard, LibraryCard/LibraryListCard, and FixGridCard/FixListCard to use CardShell. Add a `hero` variant (full-bleed cover with overlay). Wire missing context menu to FixGridCard.

**Tech Stack:** React 18 + TypeScript + Tailwind CSS + CSS custom properties

**Status:** All 4 existing cards use inline `useState(isHovered)` with the same `0.08s cubic-bezier(0.4, 0, 0.2, 1)` transition. GameCover is the shared image component — ListCard/LibraryCard/PortraitCard duplicate its logic inline. These will be converted to GameCover.

---

### Task 1: Create CardShell component

**Files:**
- Create: `src/components/cards/CardShell.tsx`
- Modify: `src/components/cards/index.ts`

**Purpose:** Shared wrapper that standardizes hover lift, genre-reactive border/glow, entry animation, context menu wiring, and z-index management. Every card variant wraps its content in this.

```tsx
// CardShell.tsx
import { useState, type ReactNode } from 'react'
import { COLORS } from '../../constants/colors'

// Transition constant — DESIGN.md: 80ms cubic-bezier(0.4, 0, 0.2, 1)
const T = '0.08s cubic-bezier(0.4, 0, 0.2, 1)'

export interface CardShellProps {
  children: ReactNode
  genreHue: number
  variant: 'grid' | 'list' | 'hero'
  index?: number
  onContextMenu?: (e: React.MouseEvent) => void
  onClick?: () => void
  className?: string
  /** Extra styles merged into the shell's style object */
  style?: React.CSSProperties
  /** Aspect ratio override (defaults: grid=16/9, list=auto, hero=21/9) */
  aspectRatio?: string
}

function getAspectRatio(variant: CardShellProps['variant'], override?: string): string | undefined {
  if (override) return override
  switch (variant) {
    case 'grid': return '16/9'
    case 'hero': return '21/9'
    case 'list': return undefined
  }
}

export function CardShell({
  children, genreHue, variant, index = 0,
  onContextMenu, onClick, className = '', style, aspectRatio,
}: CardShellProps) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div
      className={`page-enter group cursor-pointer overflow-hidden ${className}`}
      style={{
        '--ghue': genreHue,
        animationDelay: Math.min(index * 30, 80) + 'ms',
        aspectRatio: getAspectRatio(variant, aspectRatio),
        background: variant === 'list'
          ? (isHovered
              ? `linear-gradient(135deg, hsla(${genreHue}, 50%, 25%, 0.12), rgba(18,18,31,0.30))`
              : 'rgba(18,18,31,0.30)')
          : `linear-gradient(160deg, rgba(18,18,31,0.40) 0%, rgba(12,12,24,0.55) 100%)`,
        backdropFilter: 'blur(20px) saturate(1.3)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.3)',
        borderRadius: '1rem',
        zIndex: isHovered ? 20 : 1,
        border: isHovered
          ? `1px solid hsla(${genreHue}, 55%, 55%, 0.35)`
          : '1px solid rgba(255,255,255,0.06)',
        boxShadow: isHovered
          ? `0 16px 48px hsla(${genreHue}, 50%, 15%, 0.50), 0 0 80px hsla(${genreHue}, 60%, 35%, 0.08), 0 0 0 1px hsla(${genreHue}, 60%, 50%, 0.10)`
          : '0 2px 4px rgba(0,0,0,0.20), 0 8px 24px rgba(0,0,0,0.12)',
        transform: variant === 'list'
          ? (isHovered ? 'translateX(4px)' : 'translateX(0)')
          : (isHovered ? 'translateY(-4px) scale(1.015)' : 'translateY(0) scale(1)'),
        willChange: 'transform',
        transition: `transform ${T}, box-shadow ${T}, border ${T}, background ${T}`,
        ...style,
      } as React.CSSProperties}
      onClick={onClick}
      onContextMenu={onContextMenu ? (e) => { e.preventDefault(); onContextMenu(e) } : undefined}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Ambient genre glow */}
      <div
        className={`card-ambient-glow ${isHovered ? 'active' : ''}`}
        style={{ '--ghue': genreHue } as React.CSSProperties}
      />

      {children}

      {/* Animated hover border glow */}
      <div
        className={`card-border-glow ${isHovered ? 'active' : ''}`}
        style={{ '--ghue': genreHue } as React.CSSProperties}
      />
    </div>
  )
}
```

**Export from index.ts:**
```ts
export { CardShell } from './CardShell'
export type { CardShellProps } from './CardShell'
```

- [ ] **Step 1: Create `src/components/cards/CardShell.tsx`** with the code above
- [ ] **Step 2: Export `CardShell` from `src/components/cards/index.ts`**
- [ ] **Step 3: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors

---

### Task 2: Create InstallSpeedBadge component

**Files:**
- Create: `src/components/cards/InstallSpeedBadge.tsx`

**Purpose:** Shows estimated install time based on file size. Compact pill badge for grid/hero cards.

```tsx
// InstallSpeedBadge.tsx
import { Zap } from 'lucide-react'
import { formatBytes } from '../../utils/gameHelpers'

interface InstallSpeedBadgeProps {
  sizeBytes: number | string | undefined | null
  className?: string
  size?: 'sm' | 'md'
}

function estimateInstallTime(bytes: number): string {
  // Rough estimate: ~50MB/s for decompression + write
  const seconds = bytes / (50 * 1024 * 1024)
  if (seconds < 60) return '<1 min'
  if (seconds < 120) return '~1 min'
  return `~${Math.ceil(seconds / 60)} min`
}

export function InstallSpeedBadge({ sizeBytes, className = '', size = 'sm' }: InstallSpeedBadgeProps) {
  if (sizeBytes === undefined || sizeBytes === null) return null
  const bytes = typeof sizeBytes === 'string' ? parseInt(sizeBytes) : sizeBytes
  if (!bytes || bytes <= 0) return null

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-lg font-bold pointer-events-none select-none ${
        size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1'
      } ${className}`}
      style={{
        background: 'rgba(250,204,21,0.12)',
        color: '#facc15',
        border: '1px solid rgba(250,204,21,0.20)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}
    >
      <Zap size={size === 'sm' ? 9 : 11} />
      <span>{estimateInstallTime(bytes)}</span>
    </div>
  )
}
```

- [ ] **Step 1: Create `src/components/cards/InstallSpeedBadge.tsx`** with the code above
- [ ] **Step 2: Export `InstallSpeedBadge` from `src/components/cards/index.ts`**
- [ ] **Step 3: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: No errors

---

### Task 3: Refactor GameCard to use CardShell + GameCover (list mode)

**Files:**
- Modify: `src/components/cards/GameCard.tsx`
- Keep: `GameCover.tsx` (already used for grid mode)
- Keep: All callbacks/action buttons unchanged

**What changes:**
- Outer wrapper div replaced with `<CardShell variant={viewMode === 'grid' ? 'grid' : 'list'}>`
- Grid mode body stays as-is (already clean)
- List mode thumbnail: replace manual `loadGameImage` + LQIP handling with `<GameCover>`
- Remove `useState(isHovered)` — CardShell provides it
- Keep all existing action buttons, badges, favorite button, batch mode

**Detail: Convert list mode to GameCover**
The list mode currently handles image loading manually (lines 36-53, 340-365). Replace with:

```tsx
{/* ── Thumbnail ── */}
<div
  className={`${compactMode ? 'w-[56px] h-[32px]' : 'w-[72px] h-[40px]'} rounded-lg overflow-hidden shrink-0 relative`}
  style={{
    background: `linear-gradient(135deg, hsla(${genreHue}, 60%, 15%, 0.30), rgba(10,10,15,0.40))`,
    transform: isHovered ? 'scale(1.1)' : 'scale(1)',
    transition: `transform ${T}`,
  }}
>
  <GameCover
    appid={game.appid}
    name={game.name}
    localHeader={game.header_image}
    className="w-full h-full"
    genreHue={genreHue}
    preferredImageTypes={['header.jpg']}
  />
</div>
```

- [ ] **Step 1: Refactor GameCard.tsx** — Replace outer wrapper div with `<CardShell>`, pass variant based on viewMode, remove local `isHovered` state and duplicate hover styles
- [ ] **Step 2: Convert list mode thumbnail** to use `<GameCover>` instead of manual `loadGameImage`
- [ ] **Step 3: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: No errors

---

### Task 4: Create HeroCard variant

**Files:**
- Create: `src/components/cards/HeroCard.tsx`

**Purpose:** Full-bleed cover background with genre-tinted overlay, large title, prominent action buttons. Used for featured/highlighted games on homepage or spotlight sections.

```tsx
import { memo, useMemo, useState, useCallback } from 'react'
import { Download as DownloadIcon, FolderOpen, Heart, Play } from 'lucide-react'
import GameCover from '../GameCover'
import { CardShell } from './CardShell'
import { InstallSpeedBadge } from './InstallSpeedBadge'
import { getGenreHue, formatBytes, isRecentlyAdded } from '../../utils/gameHelpers'
import { COLORS } from '../../constants/colors'
import type { Game } from '../../types'
import type { ColorScheme } from '../../types/colors'

const T = '0.08s cubic-bezier(0.4, 0, 0.2, 1)'

interface HeroCardProps {
  game: Game
  index?: number
  colors: ColorScheme
  isFavorite?: boolean
  isInLibrary?: boolean
  onInstallGame?: (game?: any) => void
  onInstallFromZip?: (game?: any) => void
  onFavorite?: () => void
  onContextMenu?: (e: React.MouseEvent, game: Game) => void
  onRemoveFromLibrary?: (game: Game) => void
}

export const HeroCard = memo(function HeroCard({
  game, index = 0, colors, isFavorite = false, isInLibrary = false,
  onInstallGame, onInstallFromZip, onFavorite, onContextMenu, onRemoveFromLibrary,
}: HeroCardProps) {
  const [btnHovered, setBtnHovered] = useState<'add' | 'zip' | null>(null)
  const genreHue = useMemo(() => getGenreHue(game), [game])

  const handleCtx = useCallback((e: React.MouseEvent) => {
    onContextMenu?.(e, game)
  }, [game, onContextMenu])

  return (
    <CardShell
      variant="hero"
      genreHue={genreHue}
      index={index}
      onContextMenu={handleCtx}
    >
      <div className="relative w-full" style={{ aspectRatio: '21/9' }}>
        {/* Full-bleed cover */}
        <GameCover
          appid={game.appid}
          name={game.name}
          localHeader={game.header_image}
          className="absolute inset-0 w-full h-full"
          genreHue={genreHue}
          eager
        />

        {/* Cinematic gradient overlay — dark at bottom, transparent at top */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(to right, rgba(10,10,15,0.92) 0%, rgba(10,10,15,0.50) 40%, rgba(10,10,15,0.20) 60%, rgba(10,10,15,0.40) 100%)',
          }}
        />
        {/* Bottom fade for text */}
        <div
          className="absolute inset-x-0 bottom-0 h-1/2 pointer-events-none"
          style={{
            background: 'linear-gradient(to top, rgba(10,10,15,0.85) 0%, transparent 100%)',
          }}
        />

        {/* Content overlay */}
        <div className="absolute inset-0 z-10 flex flex-col justify-end p-6 md:p-8">
          {/* Genre + "New" badges row */}
          <div className="flex items-center gap-2 mb-2">
            {isRecentlyAdded(game) && (
              <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider"
                style={{
                  background: 'linear-gradient(135deg, rgba(16,185,129,0.85), rgba(5,150,105,0.7))',
                  color: 'white',
                }}
              >
                New
              </span>
            )}
            {(game.type || '').toLowerCase() === 'dlc' && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-lg"
                style={{ background: `${COLORS.green}33`, color: COLORS.green, border: `1px solid ${COLORS.green}40` }}
              >
                DLC
              </span>
            )}
            {game.size && <InstallSpeedBadge sizeBytes={game.size} />}
          </div>

          {/* Game title */}
          <h2
            className="text-2xl md:text-3xl font-bold mb-1 leading-tight"
            style={{ color: COLORS.white, textShadow: '0 2px 12px rgba(0,0,0,0.5)' }}
          >
            {game.name}
          </h2>

          {/* Metadata */}
          <div className="flex items-center gap-3 text-sm mb-3" style={{ color: COLORS.textMuted }}>
            {game.size && <span>{formatBytes(game.size)}</span>}
            {(game as any).release_date && (
              <>
                <span className="opacity-40">•</span>
                <span>{(game as any).release_date.split('-')[0]}</span>
              </>
            )}
            {game.platforms && game.platforms.length > 0 && (
              <>
                <span className="opacity-40">•</span>
                <span>{game.platforms.map(p => p === 'windows' ? 'Win' : p === 'mac' ? 'Mac' : p === 'linux' ? 'Linux' : p).join(', ')}</span>
              </>
            )}
          </div>

          {/* Action buttons row */}
          <div className="flex items-center gap-3">
            {isInLibrary ? (
              <button
                onClick={(e) => { e.stopPropagation(); onRemoveFromLibrary?.(game) }}
                className="px-5 py-2.5 rounded-xl text-sm font-bold cursor-pointer"
                style={{
                  background: `${colors.red}22`,
                  color: colors.red,
                  border: `1px solid ${colors.red}40`,
                  transition: `background ${T}, transform ${T}`,
                }}
                onMouseEnter={() => setBtnHovered('add')}
                onMouseLeave={() => setBtnHovered(null)}
              >
                Remove from Library
              </button>
            ) : (
              <>
                <button
                  onMouseEnter={() => setBtnHovered('add')}
                  onMouseLeave={() => setBtnHovered(null)}
                  onClick={(e) => { e.stopPropagation(); onInstallGame?.(game) }}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 cursor-pointer"
                  style={{
                    background: btnHovered === 'add'
                      ? `linear-gradient(135deg, hsl(${genreHue}, 60%, 35%), hsl(${genreHue}, 50%, 25%))`
                      : `linear-gradient(135deg, hsl(${genreHue}, 55%, 30%), hsl(${genreHue}, 45%, 20%))`,
                    color: 'white',
                    boxShadow: btnHovered === 'add'
                      ? `0 8px 24px hsla(${genreHue}, 50%, 20%, 0.50)`
                      : '0 4px 12px rgba(0,0,0,0.30)',
                    transition: `background ${T}, box-shadow ${T}, transform ${T}`,
                    transform: btnHovered === 'add' ? 'translateY(-1px)' : 'translateY(0)',
                  }}
                >
                  <DownloadIcon size={16} />
                  <span>Add to Steam</span>
                </button>
                <button
                  onMouseEnter={() => setBtnHovered('zip')}
                  onMouseLeave={() => setBtnHovered(null)}
                  onClick={(e) => { e.stopPropagation(); onInstallFromZip?.(game) }}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 cursor-pointer"
                  style={{
                    background: btnHovered === 'zip' ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)',
                    color: COLORS.white,
                    border: '1px solid rgba(255,255,255,0.15)',
                    transition: `background ${T}, transform ${T}`,
                    transform: btnHovered === 'zip' ? 'translateY(-1px)' : 'translateY(0)',
                  }}
                >
                  <FolderOpen size={16} />
                  <span>Install Zip</span>
                </button>
              </>
            )}

            {onFavorite && (
              <button
                onClick={(e) => { e.stopPropagation(); onFavorite() }}
                className="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer"
                style={{
                  background: 'rgba(0,0,0,0.45)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  transition: `transform ${T}`,
                }}
              >
                <Heart size={16} className={isFavorite ? 'text-white fill-white' : 'text-white'} />
              </button>
            )}
          </div>
        </div>
      </div>
    </CardShell>
  )
}, (prev, next) => {
  return prev.game.appid === next.game.appid
    && prev.index === next.index
    && prev.isFavorite === next.isFavorite
    && prev.isInLibrary === next.isInLibrary
    && prev.colors === next.colors
})
```

- [ ] **Step 1: Create `src/components/cards/HeroCard.tsx`** with the code above
- [ ] **Step 2: Export `HeroCard` from `src/components/cards/index.ts`**
- [ ] **Step 3: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: No errors

---

### Task 5: Wire context menu to FixGridCard / FixListCard

**Files:**
- Modify: `src/components/cards/FixGridCard.tsx`

**What changes:** The `onContextMenu` prop is already accepted but FixGridCard doesn't visually indicate it's available (GameCard does via its own shell). Add subtle visual feedback: on hover, show a small chevron or dots indicator that right-click is available.

Find the existing FixGridCard and FixListCard render. In both, add a context-menu indicator icon (shown on hover):

In FixGridCard render, add near the bottom of the content overlay:
```tsx
{onContextMenu && (
  <div
    className="absolute bottom-2.5 right-2.5 z-20 opacity-0 group-hover:opacity-100 transition-opacity"
    style={{ transition: `opacity ${T}` }}
  >
    <span className="text-[9px] font-medium px-1.5 py-0.5 rounded"
      style={{
        background: 'rgba(255,255,255,0.08)',
        color: 'rgba(255,255,255,0.4)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      Right-click for options
    </span>
  </div>
)}
```

In FixListCard render, add next to the apply button:
```tsx
{onContextMenu && (
  <span className="text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100"
    style={{
      background: 'rgba(255,255,255,0.06)',
      color: 'rgba(255,255,255,0.3)',
      transition: `opacity ${T}`,
    }}
  >
    ⋮
  </span>
)}
```

- [ ] **Step 1: Find and read `src/components/cards/FixGridCard.tsx`** lines around the grid card content area and list card action area
- [ ] **Step 2: Add context-menu indicator** to FixGridCard (grid variant) — small text badge bottom-right
- [ ] **Step 3: Add context-menu indicator** to FixListCard (list variant) — inline dots next to action button
- [ ] **Step 4: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: No errors

---

### Task 6: Add InstallSpeedBadge to GameCard grid variant

**Files:**
- Modify: `src/components/cards/GameCard.tsx`

**What changes:** In the grid mode cover section, add `InstallSpeedBadge` next to or below the "New" / "Installed" badges, showing estimated install time based on `game.size`.

Add after the "Installed" badge block (around line 207):
```tsx
{/* ── Install speed badge ── */}
{game.size && !isInLibrary && (
  <div className="mt-1">
    <InstallSpeedBadge sizeBytes={game.size} />
  </div>
)}
```

Wait — actually the better placement is in the cover image area, next to the "New" badge. Let me put it at the top-right alongside other badges. Let me check the exact layout.

Looking at the grid mode cover section (lines 117-208), badges appear:
- Top-right: "New" badge (lines 105-115)
- Top-right below New: "Installed" badge (lines 191-207)
- Top-left: AppID badge (hover-revealed, lines 157-170)

Add InstallSpeedBadge below the "New" badge (between New and Installed):
```tsx
{/* ── Install speed badge ── */}
{game.size && (
  <div className="absolute top-[36px] right-3 z-20">
    <InstallSpeedBadge sizeBytes={game.size} />
  </div>
)}
```

- [ ] **Step 1: Add InstallSpeedBadge import to GameCard.tsx** and render it in grid mode cover section
- [ ] **Step 2: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: No errors

---

### Task 7: Build verification

**Files:**
- (none)

- [ ] **Step 1: Run full TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: 0 errors

- [ ] **Step 3: Verify all exports from index.ts**

Check that `CardShell`, `InstallSpeedBadge`, `HeroCard` are all exported from `src/components/cards/index.ts`.
