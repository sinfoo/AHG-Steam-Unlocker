import { Game, Fix } from './index'

export interface PageHandlers {
  navigateTo: (page: string) => void
  showToast: (message: string, type: 'success' | 'error' | 'favorites' | 'info') => void
  handleGameClick: (game: Game) => void
  handleContextMenu: (e: React.MouseEvent, game: Game) => void
  toggleFavorite: (appid: string) => void
  handleInstallGame: () => Promise<void>
  handleInstallFromZip: (game?: any) => void
  handleDeleteGame: (appid: string) => Promise<void>
  handleApplyFix: (fix: Fix, url?: string) => Promise<void>
  playSound: (type: 'success' | 'error' | 'click' | 'hover') => void
}

export interface PageProps {
  handlers: PageHandlers
  colors: typeof import('../constants/colors').COLORS
}
