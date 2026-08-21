# AHG Unlocker — Design Tokens

> Generated from `src/App.tsx`, `src/index.css`, `src/components/Sidebar.tsx`, `src/components/GameGrid.tsx`

## Register

product — design SERVES the tool. Dark gaming utility with gamer aesthetic.

## Color

### Primary Palette
| Token | Value | Usage |
|-------|-------|-------|
| `violet` | `#8b5cf6` | Primary accent, active states, primary buttons, links |
| `violetLight` | `#a78bfa` | Hover text, secondary accent |
| `violetGlow` | `rgba(139,92,246,X)` | Box-shadow glow on interactive elements |
| `violetDim` | `rgba(139,92,246,0.1-0.15)` | Subtle background tint for active items |

### Background Scale
| Token | Value | Usage |
|-------|-------|-------|
| `--bg-deep` | `#0d0d1a` | Main app background, sidebar |
| `--bg-dark` | `#12122a` | Page background, body |
| `--bg-mid` | `#0c0c18` | Secondary surfaces |
| `--bg-card` | `#1a1a24` | Card backgrounds, panel surfaces |
| `--bg-card-glass` | `rgba(20,20,36,0.7)` | Glassmorphism card overlay |
| `--bg-hover` | `#222240` | Hover state on cards/buttons |
| `--bg-active` | `#2e2e50` | Active/pressed state |

### Semantic Colors
| Token | Value | Usage |
|-------|-------|-------|
| `green` | `#22c55e` | Success, installed, online status |
| `blue` | `#3b82f6` | Info, download, hyperlinks |
| `red` | `#ef4444` | Error, favorites heart, destructive |
| `amber` | `#f59e0b` | Warning, DRM badge |
| `cyan` | `#06b6d4` | Alternative accent, hypervisor badge |
| `pink` | `#ec4899` | Alternative accent |
| `purple` | `#a855f7` | Alternative accent |

### Text
| Token | Value | Usage |
|-------|-------|-------|
| `text` | `#f8fafc` | Primary body text, headings |
| `textSecondary` | `#e2e8f0` | Secondary text |
| `textMuted` | `#94a3b8` | Muted labels, nav inactive |
| `textDim` | `#64748b` | Low-emphasis metadata |

### Borders
| Token | Value | Usage |
|-------|-------|-------|
| `border` | `#3a3a66` | Card borders, dividers |
| `borderLight` | `#505090` | High-contrast borders |
| `--border-glass` | `rgba(255,255,255,0.06-0.12)` | Glass surface borders |

### Interactive States
- Default: transparent bg, border-light
- Hover: bg-hover/active + border transition (80ms)
- Active: scale(0.97), bg-active
- Disabled: opacity-50, cursor-not-allowed
- Focus-visible: 2px solid `#8b5cf6` outline + offset

### Color Strategy
**Restrained** floor — tinted neutrals (`#0c0c18` → `#f8fafc`), one accent (violet) at ~10%. 
Some surfaces earn **Committed** — the AnimatedBackground component pulses genre-matched accent colors.

### Pure Black Mode
- `bgDeep` → `#000000`, `bgDark` → `#000000`, `bgMid` → `#0a0a0a`
- Toggleable via Settings (pureBlack state)

## Typography

### Font Stack
```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
```

### Scale (fixed rem)
| Step | Size | Line Height | Weight | Usage |
|------|------|-------------|--------|-------|
| xs | 0.75rem | 1rem | 500-700 | Badges, metadata, timestamps |
| sm | 0.875rem | 1.25rem | 500-700 | Labels, subtitles, game names |
| base | 1rem | 1.5rem | 400-600 | Body text, descriptions |
| lg | 1.125rem | 1.75rem | 600-700 | Modal titles, section headers |
| xl | 1.25rem | 1.75rem | 700 | Card titles, stat numbers |
| 2xl | 1.5rem | 2rem | 700 | Page headings |
| 3xl | 1.875rem | 2.25rem | 700 | App logo, hero text |

### Logo
- "AHG": 3xl, bold, tracking-tighter, white
- Subtitle: xs, tracking-widest, uppercase, violet-400/80

## Spacing (rem)
`0.25` → `0.5` → `0.75` → `1` → `1.5` → `2` → `2.5` → `3` → `3.5` → `4` → `5` → `6` → `7`
Tailwind-like scale. Consistent across all components.

### Component Gaps
- Card grid: `gap-4` (1rem)
- Nav items: `space-y-1.5`
- Form rows: `space-y-3` to `space-y-4`
- Section separators: `border-bottom` at container edges

## Border Radius
| Token | Value | Usage |
|-------|-------|-------|
| `rounded` | 0.25rem | Minimal |
| `rounded-md` | 0.375rem | Badges, small tags |
| `rounded-lg` | 0.5rem | Inline elements |
| `rounded-xl` | 0.75rem | Buttons, cards, inputs (most common) |
| `rounded-2xl` | 1rem | Modals, featured cards, panels |
| `rounded-3xl` | 1.5rem | Large modals, download modal |
| `rounded-full` | 9999px | Avatars, toggle switches |

## Shadows
| Level | Value |
|-------|-------|
| sm | `0 1px 2px rgba(0,0,0,0.3)` |
| md | `0 4px 16px rgba(0,0,0,0.3)` (game cards) |
| lg | `0 10px 15px -3px rgba(0,0,0,0.1)` |
| xl | `0 20px 25px -5px rgba(0,0,0,0.1)` |
| 2xl | `0 25px 50px -12px rgba(0,0,0,0.25)` |
| glow | `0 8px 32px rgba(139,92,246,0.4)` (brand accent) |
| card-hover | `0 16px 48px rgba(139,92,246,0.25)` + `0 0 80px rgba(139,92,246,0.12)` |

## Motion

### Transition Defaults
- Interactive transitions: **80ms** cubic-bezier(0.4, 0, 0.2, 1)
- Content reveals: 200-300ms ease-out
- Modals: 250ms ease-out, scale 0.9→1
- Page transitions: 300ms, instant scroll

### Keyframe Animations
| Name | Property | Duration | Purpose |
|------|----------|----------|---------|
| `pulse-glow` | box-shadow | 2s | Primary CTA pulse |
| `shimmer` | background-position | 1.5s | Skeleton loading |
| `glow-pulse` | box-shadow | 3s | Premium card glow |
| `glow-violet` | box-shadow | varies | Subtle violet glow |
| `border-glow` | border-color | 2s | Animated borders |
| `shimmer-sweep` | translateX pseudo | 3s | Shimmer line sweep |
| `float` | translateY | 4s | Floating element |
| `border-rotate` | background-position | 3s | Premium border gradient |
| `progress-glow` | background-position | 3s | Progress bar animation |
| `trophy-pulse` | scale + filter | 2s | Achievement animation |
| `breathe` | opacity + scale | 2s | Breathing indicator |
| `icon-spin` | rotate | 0.6s | Icon feedback |

### Framer Motion Patterns
- `AnimatePresence` with conditional rendering (modals, toasts)
- `motion.button` with `whileHover`/`whileTap` for scale feedback
- `layoutId` for shared layout animations (active nav indicator)
- Spring physics: stiffness 250-400, damping 15-25
- Card entrance: opacity 0→1, y 20→0, staggered delay (index * 0.005)
- Toast: spring slide-in from right (x: 100→0)

### Reduced Motion
- `prefers-reduced-motion: reduce` → all animations 0.01ms
- State toggle in Settings (`reducedMotion`)
- Respects system OS setting

## Component Patterns

### Sidebar (`Sidebar.tsx`)
- Width: 18rem (w-72)
- Background: `#030308` with radial gradient violet glow
- Logo: Icon + "AHG" + "Steam Unlocker" subtitle
- Nav items: button with icon + label + optional badge
- Active indicator: left bar + background dim + color accent
- Hover: scale + x-translate (6px)
- Footer: update check button + status indicator

### Game Card (`GameCard` in GameGrid.tsx)
- Aspect ratio 4:5 cover image
- Background: `rgba(18,18,28,0.8)` + border
- Hover: violet border glow, scale(1.03), y(-6)
- Zoom: cover image scale(1.1) on hover
- Overlay: dark gradient, "Add to Steam" button
- Badges: TOP N, DRM, popularity rank
- Favorite button: top-right, red when active
- Entrance: staggered fade-in with spring physics

### Game Grid (`GameGrid.tsx`)
- Responsive: `repeat(auto-fill, minmax(165px, 1fr))` with `grid-auto-rows: 1fr`
- Pagination: page buttons with active violet state
- Empty state: centered search icon + "No games found"

### Toasts
- Fixed bottom-right, z-50
- Spring slide-in (x: 100→0)
- Colored by type (green/red/violet)
- Animated shimmer sweep background
- Dismiss on click

### Modals
- Backdrop: rgba(0,0,0,0.8) + backdrop-filter blur(16px)
- Scale entrance: 0.9→1, y 20→0
- Glass header with icon + title
- Progress bar: gradient fill (blue→violet) or solid (green/red)
- Live stats during download (size, speed, progress)

### Toggle Switch
- Width 3.5rem, height 2rem, rounded-full
- Background: violet (on) / white 0.15 (off)
- Knob: white circle, 1.5rem, shadow
- Animate: x 0→24

### Skeleton/Shimmer
- Gradient sweep animation (1.5s)
- Used during initial load, image loading
- Framer motion opacity pulse + shimmer combine

### AnimatedBackground
- Fixed full-screen, pointer-events-none
- 4 floating radial gradient blobs, parallax-like drift
- Grid dot pattern overlay
- Genre-reactive color shifts

## Scrollbar
- Width: 6px
- Track: `#0f0f14`
- Thumb: `#252532`, rounded-3px
- Hover: `#353545`

## Responsive Behavior
- Grid: `cols-2 md:cols-3 lg:cols-4`
- Sidebar: fixed width
- Game detail panel: slides in from right
- Designed for desktop Electron window (no mobile)
