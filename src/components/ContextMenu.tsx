import { memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Download as DownloadIcon, Play, Heart, Share2, Copy,
  Check, X, Trash2,
} from 'lucide-react'
import type { ColorScheme, Game } from './shared'
import { useUIStore, useUserStore, useSettingsStore, useInstalledGames } from '../store'
import GameCover from './GameCover'

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
    { icon: Trash2, label: 'Remove Game', action: () => onRemoveGame?.(game), color: COLORS.red, accent: true },
    null,
    { icon: Heart, label: favorites.has(appid) ? 'Remove from Favorites' : 'Add to Favorites', action: () => contextMenuToggleFavorite(game), color: COLORS.pink },
    { icon: Play, label: 'Open Steam Page', action: () => contextMenuOpenSteam(game), color: COLORS.blue },
    null,
    { icon: Share2, label: 'Share Card', action: () => contextMenuShareCard(game), color: COLORS.cyan },
    { icon: Copy, label: 'Copy App ID', action: () => contextMenuCopyAppId(game), color: COLORS.textSecondary },
  ] : [
    { icon: DownloadIcon, label: 'Install', action: () => contextMenuInstall(game), color: COLORS.green, accent: true },
    null,
    { icon: Play, label: 'Open Steam Page', action: () => contextMenuOpenSteam(game), color: COLORS.blue },
    { icon: Heart, label: favorites.has(appid) ? 'Remove Favorite' : 'Add Favorite', action: () => contextMenuToggleFavorite(game), color: COLORS.pink },
    null,
    { icon: DownloadIcon, label: 'Add to Queue', action: () => addToDownloadQueue(game), color: COLORS.blue },
    { icon: Share2, label: 'Share Card', action: () => contextMenuShareCard(game), color: COLORS.cyan },
    { icon: Copy, label: 'Copy App ID', action: () => contextMenuCopyAppId(game), color: COLORS.textSecondary },
    null,
    { icon: null as any, label: 'Include DLCs', action: () => setIncludeDLC(!includeDLC), color: includeDLC ? COLORS.amber : COLORS.textMuted, toggle: true },
  ]

  const renderItem = (item: any, i: number) => {
    if (item === null) {
      return <div key={`sep-${i}`} className="mx-3.5 my-1 h-px" style={{ background: `linear-gradient(90deg, ${COLORS.border} 0%, ${COLORS.borderLight} 50%, ${COLORS.border} 100%)` }} />
    }
    const isAccent = item.accent
    if (item.toggle) {
      return (
        <motion.button
          key={i}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.03 * i, duration: 0.12 }}
          onClick={item.action}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left"
          style={{ borderRadius: 0 }}
        >
          <motion.div
            className="flex-1 flex items-center gap-3 px-3 py-1.5 rounded-xl"
            style={{
              background: includeDLC
                ? `linear-gradient(135deg, ${COLORS.amber}20, ${COLORS.amber}08)`
                : `${COLORS.textMuted}08`,
              border: `1px solid ${includeDLC ? COLORS.amber + '50' : 'transparent'}`,
            }}
            animate={{
              borderColor: includeDLC ? COLORS.amber + '50' : 'transparent',
            }}
          >
            <motion.div
              className="w-5 h-5 rounded-md flex items-center justify-center"
              style={{
                background: includeDLC ? COLORS.amber : `${COLORS.textMuted}25`,
              }}
              animate={{
                rotate: includeDLC ? [0, -15, 0] : 0,
                scale: includeDLC ? [1, 1.15, 1] : 1,
              }}
              transition={{ duration: 0.08, ease: [0.4, 0, 0.2, 1] }}
            >
              {includeDLC ? (
                <Check size={11} className="text-white" />
              ) : (
                <X size={11} style={{ color: COLORS.textMuted }} />
              )}
            </motion.div>
            <span className="flex-1 text-xs font-semibold" style={{ color: includeDLC ? COLORS.amber : COLORS.textMuted }}>
              Include DLCs
            </span>
            {includeDLC && (
              <motion.span
                className="text-xs font-bold px-1.5 py-0.5 rounded"
                style={{ background: `${COLORS.amber}25`, color: COLORS.amber }}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                ON
              </motion.span>
            )}
          </motion.div>
        </motion.button>
      )
    }
    return (
      <motion.button
        key={i}
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.03 * i, duration: 0.12 }}
        onClick={item.action}
        whileHover={{
          background: isAccent ? `${COLORS.green}15` : `${item.color}12`,
          x: 3,
          scale: 0.98,
        }}
        whileTap={{ scale: 0.95 }}
        className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left relative group"
        style={{ borderRadius: 0 }}
      >
        <motion.div
          className="absolute inset-y-1 left-1.5 w-0.5 rounded-full"
          style={{ background: item.color }}
          initial={{ opacity: 0, scaleY: 0 }}
          whileHover={{ opacity: 1, scaleY: 1 }}
          transition={{ duration: 0.08, ease: [0.4, 0, 0.2, 1] }}
        />
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 relative" style={{ background: `${item.color}12` }}>
          <item.icon size={14} style={{ color: isAccent ? COLORS.green : item.color }} />
        </div>
        <span className="text-xs font-medium relative z-10" style={{ color: isAccent ? COLORS.green : COLORS.text }}>{item.label}</span>
        {isAccent && (
          <motion.div
            className="absolute right-2.5 px-1.5 py-0.5 rounded text-xs font-bold"
            style={{ background: `${COLORS.green}25`, color: COLORS.green }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 }}
          >
            GO
          </motion.div>
        )}

      </motion.button>
    )
  }

  return (
    <AnimatePresence>
      {contextMenu && (
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: -6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: -6 }}
          transition={{ type: 'spring', stiffness: 350, damping: 24 }}
          className="context-menu fixed z-[200] rounded-2xl overflow-visible py-1.5"
          style={{
            left: Math.max(8, Math.min(contextMenu.x, window.innerWidth - 230)),
            top: Math.max(8, Math.min(contextMenu.y, window.innerHeight - 480)),
            background: `linear-gradient(180deg, ${COLORS.bgCard} 0%, ${COLORS.bgDark} 100%)`,
            border: `1px solid ${COLORS.borderLight}`,
            backdropFilter: 'blur(24px)',
            boxShadow: `0 20px 60px rgba(0,0,0,0.6), 0 0 40px ${COLORS.violet}10`,
            width: 210
          }}
        >
          {/* Header gradient accent */}
          <div className="absolute top-0 left-0 right-0 h-16 pointer-events-none" style={{ background: `linear-gradient(180deg, ${COLORS.violet}08 0%, transparent 100%)` }} />

          {/* Game info header with cover art accent */}
          <div className="relative px-3.5 pt-3 pb-2.5 border-b" style={{ borderColor: COLORS.border }}>
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg overflow-hidden shrink-0">
                <GameCover appid={contextMenu.game.appid} name={contextMenu.game.name} localHeader={contextMenu.game.header_image} className="w-full h-full" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold truncate" style={{ color: COLORS.text }}>{contextMenu.game.name}</p>
                <p className="text-xs font-mono" style={{ color: COLORS.textDim }}>#{contextMenu.game.appid}</p>
              </div>
            </div>
          </div>

          {/* Menu items with staggered entrance */}
          {menuItems.map((item, i) => renderItem(item, i))}
        </motion.div>
      )}
    </AnimatePresence>
  )
})
