import { memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Download as DownloadIcon, Play, Heart, Share2, Copy,
  Check, X, Trash2,
} from 'lucide-react'
import type { ColorScheme, Game } from './shared'
import { useUIStore, useUserStore, useSettingsStore, useInstalledGames } from '../store'
import GameCover from './GameCover'
import { useT } from '../i18n'

interface ContextMenuProps {
  colors: ColorScheme
  contextMenuInstall: (game: Game) => void
  contextMenuOpenSteam: (game: Game) => void
  contextMenuToggleFavorite: (game: Game) => void
  addToDownloadQueue: (game: Game) => void
  contextMenuShareCard: (game: Game) => void
  contextMenuCopyAppId: (game: Game) => void
  onRemoveGame?: (game: Game) => void
}

export const ContextMenu = memo(function ContextMenu({
  colors: COLORS,
  contextMenuInstall,
  contextMenuOpenSteam,
  contextMenuToggleFavorite,
  addToDownloadQueue,
  contextMenuShareCard,
  contextMenuCopyAppId,
  onRemoveGame,
}: ContextMenuProps) {
  const t = useT()
  const contextMenu = useUIStore(s => s.contextMenu)
  const favorites = useUserStore(s => s.favorites)
  const includeDLC = useSettingsStore(s => s.includeDLC)
  const setIncludeDLC = useSettingsStore(s => s.setIncludeDLC)
  const installedGames = useInstalledGames()

  if (!contextMenu) return null

  const isLibraryGame = installedGames.some(g => g.appid === contextMenu.game.appid)
  const game = contextMenu.game
  const appid = game.appid

  // Different menu items for library games
  const menuItems: (any | null)[] = isLibraryGame ? [
    { icon: Trash2, label: t('app.ctx.removeGame'), action: () => onRemoveGame?.(game), color: COLORS.red, accent: true },
    null,
    { icon: Heart, label: favorites.has(appid) ? t('app.ctx.removeFromFav') : t('app.ctx.addToFav'), action: () => contextMenuToggleFavorite(game), color: COLORS.pink },
    { icon: Play, label: t('app.ctx.openSteam'), action: () => contextMenuOpenSteam(game), color: COLORS.blue },
    null,
    { icon: Share2, label: t('app.ctx.shareCard'), action: () => contextMenuShareCard(game), color: COLORS.cyan },
    { icon: Copy, label: t('app.ctx.copyAppId'), action: () => contextMenuCopyAppId(game), color: COLORS.textSecondary },
  ] : [
    { icon: DownloadIcon, label: t('app.ctx.install'), action: () => contextMenuInstall(game), color: COLORS.green, accent: true },
    null,
    { icon: Play, label: t('app.ctx.openSteam'), action: () => contextMenuOpenSteam(game), color: COLORS.blue },
    { icon: Heart, label: favorites.has(appid) ? t('app.ctx.removeFavorite') : t('app.ctx.addFavorite'), action: () => contextMenuToggleFavorite(game), color: COLORS.pink },
    null,
    { icon: DownloadIcon, label: t('app.ctx.addToQueue'), action: () => addToDownloadQueue(game), color: COLORS.blue },
    { icon: Share2, label: t('app.ctx.shareCard'), action: () => contextMenuShareCard(game), color: COLORS.cyan },
    { icon: Copy, label: t('app.ctx.copyAppId'), action: () => contextMenuCopyAppId(game), color: COLORS.textSecondary },
    null,
    { icon: null as any, label: t('app.ctx.includeDlc'), action: () => setIncludeDLC(!includeDLC), color: includeDLC ? COLORS.amber : COLORS.textMuted, toggle: true },
  ]

  const renderItem = (item: any, i: number) => {
    if (item === null) {
      return <div key={`sep-${i}`} style={{ height: 1, background: 'rgba(255,255,255,.07)', margin: '5px 6px' }} />
    }
    const isAccent = item.accent
    const delay = `${0.02 * i}s`
    if (item.toggle) {
      return (
        <button
          key={i}
          onClick={item.action}
          role="switch"
          aria-checked={includeDLC}
          className="w-full flex items-center gap-[11px] px-2.5 text-start hover:bg-white/[.07] active:scale-[.98]"
          style={{ height: 36, borderRadius: 9, fontSize: 13, color: includeDLC ? COLORS.amber : '#a6a5bb', transition: 'background .08s cubic-bezier(.4,0,.2,1), transform .08s', animation: 'v2-riseIn .18s cubic-bezier(.16,1,.3,1) both', animationDelay: delay }}
        >
          <span className="flex items-center justify-center" style={{ width: 15, height: 15, borderRadius: 4, background: includeDLC ? COLORS.amber : 'rgba(255,255,255,.1)' }}>
            {includeDLC ? <Check size={10} style={{ color: '#0b0614' }} strokeWidth={3} /> : <X size={10} style={{ color: '#77768e' }} />}
          </span>
          <span className="flex-1">{t('app.ctx.includeDlc')}</span>
          <span style={{ fontFamily: "'Geist Mono Variable','Geist Mono',monospace", fontSize: 10.5, color: includeDLC ? COLORS.amber : '#6f6e86' }}>{includeDLC ? t('app.ctx.on') : t('app.ctx.off')}</span>
        </button>
      )
    }
    const color = isAccent ? COLORS.green : item.color
    return (
      <button
        key={i}
        onClick={item.action}
        className="w-full flex items-center gap-[11px] px-2.5 text-start hover:bg-white/[.07] active:scale-[.98]"
        style={{ height: 36, borderRadius: 9, fontSize: 13, color: isAccent ? COLORS.green : '#e4e3f0', transition: 'background .08s cubic-bezier(.4,0,.2,1), transform .08s', animation: 'v2-riseIn .18s cubic-bezier(.16,1,.3,1) both', animationDelay: delay }}
      >
        <item.icon size={15} style={{ color, opacity: 0.9 }} />
        <span className="flex-1">{item.label}</span>
        {isAccent && <span style={{ fontFamily: "'Geist Mono Variable','Geist Mono',monospace", fontSize: 10.5, color: '#6f6e86' }}>{t('app.ctx.go')}</span>}
      </button>
    )
  }

  return (
    <AnimatePresence>
      {contextMenu && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="context-menu fixed z-[200]"
          style={{
            left: Math.max(8, Math.min(contextMenu.x, window.innerWidth - 244)),
            top: Math.max(8, Math.min(contextMenu.y, window.innerHeight - 440)),
            width: 236,
            padding: 6,
            borderRadius: 14,
            background: 'rgba(20,20,34,.97)',
            backdropFilter: 'blur(22px)',
            border: '1px solid rgba(255,255,255,.1)',
            boxShadow: '0 24px 60px -12px rgba(0,0,0,.9)',
            transformOrigin: 'top left',
          }}
        >
          <div className="flex items-center gap-2.5 min-w-0" style={{ padding: '6px 10px 8px' }}>
            <div className="w-7 h-7 rounded-lg overflow-hidden shrink-0">
              <GameCover appid={contextMenu.game.appid} name={contextMenu.game.name} localHeader={contextMenu.game.header_image} className="w-full h-full" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate" style={{ fontSize: 12, fontWeight: 600, color: '#c9c8da' }}>{contextMenu.game.name}</p>
              <p style={{ fontFamily: "'Geist Mono Variable','Geist Mono',monospace", fontSize: 10.5, color: '#6f6e86' }}>#{contextMenu.game.appid}</p>
            </div>
          </div>

          {/* Menu items with staggered entrance */}
          {menuItems.map((item, i) => renderItem(item, i))}
        </motion.div>
      )}
    </AnimatePresence>
  )
})
