// ── shared.tsx — barrel file ──
// Re-exports all public types, utilities, and components from their new split locations.
// 20+ consumer files import from ./shared — this barrel keeps them working.

// ── Re-export types ──
export type { Game, LogEntry, FixVersion, Fix } from '../types'
export type { ColorScheme } from '../types/colors'

// ── Re-export utilities ──
export {
  FIX_FILTERS,
  GENRE_TAGS,
  getSteamImage,
  getGenreTag,
  getGenreHue,
  formatBytes,
} from '../utils/gameHelpers'

// ── Re-export card components ──
export { default as GameCardCell } from './GameCardCell'
export { GameCard } from './cards/GameCard'
export { LibraryCard, LibraryListCard } from './cards/LibraryCard'
export { PortraitCard } from './cards/PortraitCard'
export { FixGridCard, FixListCard } from './cards/FixGridCard'
export { EmptyState, StatCard } from './cards/EmptyState'

// ── Re-export home components ──
export { GameSection } from './home/GameSection'
export { BentoCard } from './home/BentoCard'
export { QuickActionsCard } from './home/QuickActionsCard'
export { CategoriesShowcase } from './home/CategoriesShowcase'
export { FeaturedCarousel } from './home/FeaturedCarousel'
export { GenreRow } from './home/GenreRow'
export { PosterRail } from './home/PosterRail'
export { SpotlightFeature } from './home/SpotlightFeature'
export { FeatureMosaic } from './home/FeatureMosaic'
export { AIRecommendationsCard } from './home/AIRecommendationsCard'
export { BottomActionsCard } from './home/BottomActionsCard'
