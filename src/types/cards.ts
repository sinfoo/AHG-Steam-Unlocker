import type { Game, Fix } from './index'
import type { ColorScheme } from './colors'

// ── Card View Modes ──

export type CardVariant = 'grid' | 'list'

// ── Base card props shared across game card types ──

export interface CardBaseProps {
  game: Game
  index: number
  colors: ColorScheme
  onContextMenu?: (e: React.MouseEvent, game: Game) => void
}

// ── Props for cards with favorite/click interaction ──

export interface CardInteractiveProps extends CardBaseProps {
  isFavorite: boolean
  onClick: () => void
  onFavorite: () => void
}

// ── GameCard-specific props ──
// viewMode, batch mode, install/remove operations

export interface GameCardProps extends CardInteractiveProps {
  viewMode: CardVariant
  batchMode?: boolean
  isSelected?: boolean
  onSelect?: () => void
  onInstallGame?: (game?: Game) => void
  onInstallFromZip?: (game?: Game) => void
  isInLibrary?: boolean
  onRemoveFromLibrary?: (game: Game) => void
}

// ── PortraitCard-specific props ──

export interface PortraitCardProps extends CardInteractiveProps {
  onDelete?: () => void
}

// ── LibraryCard-specific props ──

export interface LibraryCardProps extends CardBaseProps {
  onDelete: (appid: string) => void
}

// ── FixGridCard-specific props ──

export interface FixGridCardProps {
  fix: Fix
  index: number
  colors: ColorScheme
  onApply: (url?: string) => void
}
