# App.tsx Refactoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the 7,313-line App.tsx monolith into focused, testable files — extract inline components, modals, types, and handlers into their own files following existing project patterns.

**Architecture:** The React frontend uses Zustand for state, framer-motion for animations, and bridge.ts for Electron IPC. Pages already live in `src/pages/`, components in `src/components/`. We need to extract everything currently defined inline inside App() and move it to the right place. No behavioral changes — pure extraction.

**Tech Stack:** React 18, TypeScript, Zustand, framer-motion, Vite, Electron 33, lucide-react

**Key constraint:** App.tsx is the brain of the app. Every extraction must preserve exact behavior. No refactoring beyond file splitting — fix broken imports (`useAppStore`) but do not redesign logic.

**Analysis completed (Phase 1):**
- Full project inventory: ~180+ source files, ~30K+ lines
- App.tsx dependency map: 34 imports, 6 stores, 26 bridge calls, 12 electronAPI calls
- 5 inline components: GameCover, SkeletonCard/Loader, AnimatedBackground, GameCard, GameSection, SettingsPage
- 7 pages with complete handler/store matrix
- 18 component files mapped with props, store hooks, external calls
- Key issues: `useAppStore` imported but undefined in 2 components, `shared.tsx` is 1,460-line dump, types duplicated inline

---

## File Structure (Post-Refactoring)

```
src/
├── App.tsx                          # Reduced: imports, orchestration, page switching
├── components/
│   ├── GameCover.tsx                 # Extracted from inline (line 150)
│   ├── Skeletons.tsx                 # SkeletonCard + SkeletonLoader (line 292)
│   ├── AnimatedBackground.tsx        # Extracted from inline (line 346)
│   ├── GameCard.tsx                  # Extracted from inline (line 5675)
│   ├── GameSection.tsx               # Extracted from inline (line 5629)
│   ├── SettingsPage.tsx              # Extracted from inline (line 6670)
│   ├── DownloadQueue.tsx             # Extracted modal section
│   ├── CollectionManager.tsx         # Extracted modal section
│   ├── AchievementsPanel.tsx         # Extracted modal section
│   ├── PortalModal.tsx               # Extracted modal section
│   ├── ContextMenu.tsx               # Extracted from inline
│   ├── GameUpdatesBanner.tsx         # Extracted from inline
│   ├── SearchSuggestions.tsx         # Extracted from inline
│   └── LogTerminalPanel.tsx          # Extracted from inline
├── types/
│   ├── index.ts                      # APPEND: Game, Fix, Collection, LogEntry types from App.tsx
│   └── pages.ts                      # No changes needed
├── hooks/
│   └── useAppState.ts                # Custom hook consolidating store selectors
└── shared/
    ├── cards.tsx                     # GameCard, FixGridCard, FixListCard, LibraryCard etc.
    ├── bento.tsx                     # BentoCard, BentoGameCard, BentoListCard
    ├── sections.tsx                  # GameSection, GenreRow, FeaturedCarousel, CategoriesShowcase
    └── layout.tsx                    # AnimatedBackground, EmptyState, StatCard, Skeleton*
```

---

### Task 1: Extract types from App.tsx into src/types/index.ts

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/App.tsx:129-137`

**Context:** App.tsx defines 8 local types (Game, LogEntry, FixVersion, Fix, Collection, QueuedGame, Achievement, ContextMenuState, FixHealth). src/types/index.ts already exports Game, Fix, LogEntry, etc. with overlapping but not identical fields. We need to merge the App.tsx definitions into types/index.ts (the superset) and import them back.

- [ ] **Step 1: Read both type files to compare fields**

```bash
# Read types/index.ts and the App.tsx type block
```

- [ ] **Step 2: Merge App.tsx local types into src/types/index.ts**

Add all missing fields from App.tsx's local types into the existing types in `src/types/index.ts`. For types that don't exist there (QueuedGame, Achievement, ContextMenuState, FixHealth, FixVersion), append them.

- [ ] **Step 3: Delete inline types from App.tsx and add imports**

Remove lines 129-137 from App.tsx. Add at the imports section:
```typescript
import type { Game, Fix, Collection, LogEntry, QueuedGame, Achievement, ContextMenuState, FixHealth } from './types'
```

- [ ] **Step 4: Fix `shared.tsx` to use types/index.ts instead of its local type defs**

`shared.tsx` also defines local `Game`, `LogEntry`, `FixVersion`, `Fix`, `Collection`, `ColorScheme` types. Update it to import from `./types` instead.

---

### Task 2: Extract GameCover component

**Files:**
- Create: `src/components/GameCover.tsx`
- Modify: `src/App.tsx`

**Context:** GameCover is a `memo` component defined at line 150 in App.tsx. It uses `loadGameImage` from `./services/imageCache`, `motion` from framer-motion, `COLORS` for inline styles, and the `Game` type. It renders a lazy-loaded game header image with fallback.

- [ ] **Step 1: Create `src/components/GameCover.tsx`**

```typescript
import { memo, useRef, useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { loadGameImage } from '../services/imageCache'
import type { Game } from '../types'

interface GameCoverProps {
  appid: string
  name?: string
  localHeader?: string
  className?: string
  style?: React.CSSProperties
  eager?: boolean
}

const GameCover = memo(function GameCover({
  appid, name, localHeader, className = '', style, eager = false
}: GameCoverProps) {
  const imgRef = useRef<HTMLImageElement>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const [imgSrc, setImgSrc] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    loadGameImage(appid, localHeader || undefined, name || undefined).then((url) => {
      if (!cancelled) {
        if (url) setImgSrc(url)
        else setError(true)
      }
    })
    return () => { cancelled = true }
  }, [appid, localHeader, name])

  // ... rest of component with hover scale, lazy loading via IntersectionObserver,
  // gradient fallback with first letter of name, motion animations
  return (/* exact copy of App.tsx lines 150-290 */)
})

export default GameCover
```

- [ ] **Step 2: Replace inline GameCover with import in App.tsx**

Remove lines 150-290 from App.tsx. Add import:
```typescript
import GameCover from './components/GameCover'
```

---

### Task 3: Extract SkeletonCard and SkeletonLoader

**Files:**
- Create: `src/components/Skeletons.tsx`
- Modify: `src/App.tsx`

**Context:** SkeletonCard (line 292) and SkeletonLoader (line 336) are simple skeleton loading components using motion.div with pulse animation and COLORS for styling.

- [ ] **Step 1: Create `src/components/Skeletons.tsx`**

```typescript
import { memo } from 'react'
import { motion } from 'framer-motion'

interface SkeletonCardProps {
  colors: Record<string, string>
  delay?: number
}

const SkeletonCard = memo(function SkeletonCard({ colors, delay = 0 }: SkeletonCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay }}
      style={{
        background: colors.bgCard,
        borderRadius: '12px',
        padding: '12px',
        height: '280px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        border: `1px solid ${colors.border}`,
      }}
    >
      <div
        style={{
          width: '100%',
          height: '160px',
          borderRadius: '8px',
          background: `linear-gradient(90deg, ${colors.bgMid} 25%, ${colors.bgHover} 50%, ${colors.bgMid} 75%)`,
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.5s infinite',
        }}
      />
      <div style={{ height: '14px', width: '70%', borderRadius: '4px', background: colors.bgMid }} />
      <div style={{ height: '12px', width: '50%', borderRadius: '4px', background: colors.bgMid }} />
    </motion.div>
  )
})

interface SkeletonLoaderProps {
  colors: Record<string, string>
  count?: number
}

const SkeletonLoader = memo(function SkeletonLoader({ colors, count = 6 }: SkeletonLoaderProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} colors={colors} delay={i * 0.05} />
      ))}
    </div>
  )
})

export { SkeletonCard, SkeletonLoader }
```

- [ ] **Step 2: Replace inline SkeletonCard/SkeletonLoader with imports in App.tsx**

Remove lines 292-345 from App.tsx. Add:
```typescript
import { SkeletonCard, SkeletonLoader } from './components/Skeletons'
```

---

### Task 4: Extract AnimatedBackground component

**Files:**
- Create: `src/components/AnimatedBackground.tsx`
- Modify: `src/App.tsx`

**Context:** AnimatedBackground (line 346) renders genre-colored floating orbs and dot-grid particles using framer-motion. Uses COLORS and the genreColors map.

- [ ] **Step 1: Create `src/components/AnimatedBackground.tsx`**

Copy the `genreColors` map and the AnimatedBackground component from App.tsx lines 346-485 exactly. Export as named export. Accept `colors` prop instead of closure-capturing COLORS.

- [ ] **Step 2: Replace inline AnimatedBackground with import in App.tsx**

Remove lines 346-485 from App.tsx. Add:
```typescript
import { AnimatedBackground } from './components/AnimatedBackground'
```

---

### Task 5: Extract GameCard component

**Files:**
- Create: `src/components/GameCard.tsx`
- Modify: `src/App.tsx`

**Context:** GameCard (line 5675) is a complex memo'ed component with grid/list view variants, favorite button with heart animation, DRM badges, context menu trigger, batch select. Uses motion, COLORS, Game type, Heart icon.

- [ ] **Step 1: Create `src/components/GameCard.tsx`**

Copy the full GameCard implementation from App.tsx lines 5675-6670 (or wherever it ends before SettingsPage begins). This is ~1000 lines — must be exact.

- [ ] **Step 2: Replace inline GameCard with import in App.tsx**

Remove the GameCard definition block from App.tsx. Add:
```typescript
import { GameCard } from './components/GameCard'
```

---

### Task 6: Extract GameSection component

**Files:**
- Create: `src/components/GameSection.tsx`
- Modify: `src/App.tsx`

**Context:** GameSection (line 5629) is a horizontal scrollable game row with left/right navigation buttons. Uses motion, COLORS, ChevronLeft/ChevronRight icons.

- [ ] **Step 1: Extract GameSection to its own file**

Copy the GameSection component from App.tsx lines 5629-5675 to `src/components/GameSection.tsx`. Export as named export.

- [ ] **Step 2: Replace inline GameSection with import**

Remove inline definition from App.tsx. Add:
```typescript
import { GameSection } from './components/GameSection'
```

---

### Task 7: Extract SettingsPage component

**Files:**
- Create: `src/pages/SettingsPage.tsx`
- Modify: `src/App.tsx`

**Context:** SettingsPage (line 6670) is an inline page component (~340 lines) with full settings UI: accent color picker, DLC toggle, sound, black mode, batch mode, game sharing, Quick Tools, Discord auth. Receives ALL store setters and bridge as props. This is the most complex extraction — it directly references ~30+ store setter functions from App.tsx scope.

- [ ] **Step 1: Create `src/pages/SettingsPage.tsx`**

The component receives many props including ALL the store setters. Define the props interface to match exactly what App.tsx passes:
```typescript
interface SettingsPageProps {
  colors: typeof import('../constants/colors').COLORS
  bridge: typeof import('../bridge').bridge
  accentColor: string
  setAccentColor: (c: string) => void
  soundEnabled: boolean
  setSoundEnabled: (v: boolean) => void
  // ... ALL the other store props and handlers
}
```

Since SettingsPage accesses ~30+ store setters directly from App.tsx closure, this is the hardest extraction. Two approaches:
- A) Pass everything as individual props (massive interface)
- B) (Preferred) Rewrite SettingsPage to use Zustand store hooks directly

For this plan, use approach B (store hooks) since we're already extracting and this avoids the massive prop-drill.

- [ ] **Step 2: Replace inline SettingsPage with import + render**

Remove inline definition from App.tsx. Add import and render:
```typescript
import SettingsPage from './pages/SettingsPage'
```

---

### Task 8: Fix undefined `useAppStore` import

**Files:**
- Modify: `src/store/index.ts` OR
- Modify: `src/components/GameDetailModal.tsx`
- Modify: `src/components/CommandPalette.tsx`

**Context:** Two components import `useAppStore` from `../store` but it's not exported from `src/store/index.ts`. The methods used are:
- GameDetailModal: `favorites, toggleFavorite, getFixForGame`
- CommandPalette: `setCurrentPage, toggleCommandPalette, setSearchQuery, selectGame, addToRecent`

These are mixed — some exist in individual stores (favorites → userStore, setCurrentPage → uiStore, setSearchQuery → gameStore), others don't exist in any store (toggleCommandPalette, selectGame, addToRecent, getFixForGame, toggleFavorite — these are defined as callbacks in App.tsx).

- [ ] **Step 1: Audit each method and decide source**

| Method | Source | Action |
|--------|--------|--------|
| `favorites` | `useUserStore` → `s.favorites` | Switch import |
| `toggleFavorite` | Defined in App.tsx handlers | Pass via props or add to userStore |
| `getFixForGame` | Defined in App.tsx | Pass via props or add to gameStore |
| `setCurrentPage` | `useUIStore` → `s.setCurrentPage` | Switch import |
| `toggleCommandPalette` | In uiStore but not as a setter | Add `toggleCommandPalette` action to uiStore |
| `setSearchQuery` | `useGameStore` → `s.setSearchQuery` | Switch import |
| `selectGame` | In uiStore as setSelectedGame | Add alias or use setSelectedGame directly |
| `addToRecent` | In userStore as setRecentGames | Add `addToRecent(appid)` action to userStore |

- [ ] **Step 2: Add missing store actions**

Add to `src/store/uiStore.ts`:
```typescript
toggleCommandPalette: () => set((state) => ({ commandPaletteOpen: !state.commandPaletteOpen })),
```

Add to `src/store/userStore.ts`:
```typescript
addToRecent: (appid: string) => set((state) => ({
  recentGames: [appid, ...state.recentGames.filter(id => id !== appid)].slice(0, 50),
})),
```

Add to `src/store/gameStore.ts`:
```typescript
getFixForGame: (gameId: string) => { return get().fixes.filter(f => f.appid === gameId) },
toggleFavorite: (appid: string) => set((state) => {
  const newFavorites = new Set(state.favorites)
  if (newFavorites.has(appid)) newFavorites.delete(appid)
  else newFavorites.add(appid)
  return { favorites: newFavorites }
}),
```

- [ ] **Step 3: Update GameDetailModal.tsx to use individual store hooks**

Replace `import { Game, useAppStore } from '../store'` with individual hooks:
```typescript
import { Game } from '../types'
import { useUserStore, useGameStore } from '../store'
```

Replace `const { favorites, toggleFavorite, getFixForGame } = useAppStore()` with:
```typescript
const favorites = useUserStore(s => s.favorites)
const toggleFavorite = useGameStore(s => s.toggleFavorite)
const getFixForGame = useGameStore(s => s.getFixForGame)
```

- [ ] **Step 4: Update CommandPalette.tsx similarly**

Replace imports and hook calls with individual store hooks.

---

### Task 9: Extract modals from App.tsx render tree

**Files:**
- Create: `src/components/DownloadQueue.tsx`
- Create: `src/components/CollectionManager.tsx`
- Create: `src/components/AchievementsPanel.tsx`
- Create: `src/components/PortalModal.tsx`
- Create: `src/components/ContextMenu.tsx`
- Create: `src/components/GameUpdatesBanner.tsx`
- Create: `src/components/SearchSuggestions.tsx`
- Modify: `src/App.tsx`

**Context:** The main render tree in App.tsx (lines 2571-5627) contains several modal/dialog/panel sections that use local state and store hooks. Each should be extracted to its own file, receiving the necessary handlers via props.

- [ ] **Step 1: Identify exact extraction boundaries**

Read App.tsx lines 2571-5627 and identify each modal section's start/end lines:
- CollectionEditor / CollectionPicker
- DownloadQueue / InstallQueue
- AchievementsPanel
- PortalModal (game detail portal)
- ContextMenu (right-click menu)
- GameUpdatesBanner
- SearchSuggestions
- ExportModal / ImportModal
- FixGamesScriptModal / FixGamesContactModal
- ScanGamesModal
- LogTerminal (already exists but inline copy?)

- [ ] **Step 2-9: Extract each section**

Each extraction follows the same pattern:
1. Create new file in `src/components/` with the component
2. Log what store selectors it needs and receive the rest as props
3. Replace inline JSX in App.tsx with `<Component prop1={...} prop2={...} />`

---

### Task 10: Consolidate duplicate types across codebase

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/components/shared.tsx`
- Modify: `src/types/pages.ts`

**Context:** `shared.tsx` defines local copies of `Game`, `LogEntry`, `FixVersion`, `Fix`, `Collection`, `ColorScheme` types that duplicate `src/types/index.ts`. After Task 1 merges App.tsx types into types/index.ts, update shared.tsx to import from there.

- [ ] **Step 1: Remove local types from shared.tsx**

- [ ] **Step 2: Add imports from ../types**

- [ ] **Step 3: Verify Pages props interfaces still work**

---

### Task 11: Clean up imports in App.tsx and verify build

**Files:**
- Modify: `src/App.tsx`
- Run: `npx tsc --noEmit`

**Context:** After all extractions, App.tsx will have many unused imports (the 90+ lucide-react icons, unused imageCache functions, etc.). Clean them up and verify the build.

- [ ] **Step 1: Remove unused lucide-react icon imports**

After extraction, many icons will only be used in extracted files. Survey which icons are still used directly in App.tsx JSX and remove the rest from its import statement.

- [ ] **Step 2: Remove unused imageCache imports**

```typescript
// Remove preloadImages, clearImageCache if not used in App.tsx anymore
```

- [ ] **Step 3: Run TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Run Vite build**

```bash
npx vite build
```

Expected: Clean exit with no errors.

---

## Task Dependencies

```
Task 1 (types) ──────┬── Task 2-7 (component extraction) ──┬── Task 9 (modals)
                      │                                      │
                      └── Task 10 (shared.tsx types) ────────┤
                                                             │
Task 8 (useAppStore fix) ────────────────────────────────────┤
                                                             │
                                              Task 11 (clean + build)
```

Tasks 2-7 are independent of each other and can run in parallel. Task 9 depends on Tasks 2-7 completing so they know what's left in App.tsx. Task 8 is independent of all other tasks.

---

## Scope Boundaries

**IN SCOPE:**
- Extract inline types to src/types/index.ts
- Extract inline components (GameCover, GameCard, GameSection, SettingsPage, Skeletons, AnimatedBackground) to their own files
- Extract modal/panel sections from App.tsx render tree to separate component files
- Fix broken `useAppStore` import by migrating to individual store hooks or adding missing actions
- Clean up unused imports after extraction
- Verify build passes with `npx tsc --noEmit && npx vite build`

**NOT IN SCOPE:**
- Behavioral changes or redesign
- Refactoring page components (FavouritesPage/RecentPage consolidation)
- Splitting shared.tsx (that's a separate effort due to its size)
- Migrating handlers object to Zustand (would require significant design work)
- Adding tests (the app currently has none — adding a test framework is out of scope)
- Removing legacy ui/ directory
