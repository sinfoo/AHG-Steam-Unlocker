import { memo, useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Zap, FolderOpen, Shield, Calendar, Tag, Layers, Gamepad2 } from 'lucide-react'
import type { Game } from '../types'
import type { ColorScheme } from './shared'
import { loadGameImage } from '../services/imageCache'
import { COLORS } from '../constants/colors'

interface GameActionModalProps {
  game: Game | null
  isOpen: boolean
  onClose: () => void
  onInstallGame: (game?: any) => void
  onInstallFromZip: (game?: any) => void
  onOpenDLCManager?: (game: Game) => void
  colors: ColorScheme
}

export const GameActionModal = memo(function GameActionModal({ game, isOpen, onClose, onInstallGame, onInstallFromZip, onOpenDLCManager, colors }: GameActionModalProps) {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [cachedUrl, setCachedUrl] = useState<string | null>(null)

  useEffect(() => {
    if (game?.appid) {
      setCachedUrl(null)
      setImageLoaded(false)
      setImageError(false)
      loadGameImage(game.appid, game.header_image || undefined, game.name || undefined).then(url => {
        if (url) setCachedUrl(url)
      })
    }
  }, [game?.appid, game?.header_image, game?.name])

  const genreHue = useMemo(() => {
    if (!game) return 260
    const appidNum = parseInt(game.appid) || 0
    return (appidNum * 37) % 360
  }, [game])

  const genreTag = useMemo(() => {
    if (!game) return null
    if (game.genres && game.genres.length > 0) return game.genres[0]
    if (game.tags && game.tags.length > 0) return game.tags[0]
    return null
  }, [game])

  const hasDLC = game?.dlc && Object.keys(game.dlc).length > 0
  const year = (game as any)?.release_date ? (game as any).release_date.split('-')[0] : null
  const initial = game?.name ? game.name[0]!.toUpperCase() : '?'

  const handleInstall = () => {
    onInstallGame(game)
  }

  const handleInstallZip = () => {
    onInstallFromZip(game)
  }

  return (
    <AnimatePresence>
      {isOpen && game && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', duration: 0.4, bounce: 0 }}
            className="w-full overflow-hidden"
            style={{
              maxWidth: 480,
              background: colors.bgCard,
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '1rem',
              boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Cover Section ── */}
            <div className="relative overflow-hidden" style={{ height: 190, background: COLORS.bgDark }}>
              {/* Image */}
              {!imageError && game.header_image ? (
                <motion.img
                  src={cachedUrl || game.header_image}
                  alt={game.name}
                  initial={{ scale: 1.02 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  onLoad={() => setImageLoaded(true)}
                  onError={() => setImageError(true)}
                  className="w-full h-full object-cover"
                  style={{
                    opacity: imageLoaded ? 1 : 0,
                    transition: 'opacity 0.3s ease',
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center" style={{
                  background: `linear-gradient(135deg, hsl(${genreHue}, 50%, 12%) 0%, hsl(${(genreHue + 40) % 360}, 40%, 18%) 50%, hsl(${genreHue}, 30%, 8%) 100%)`
                }}>
                  <span style={{
                    color: `hsl(${genreHue}, 70%, 70%)`,
                    fontSize: 48,
                    fontWeight: 'bold',
                    textShadow: `0 2px 12px hsla(${genreHue}, 70%, 50%, 0.5)`,
                  }}>
                    {initial}
                  </span>
                </div>
              )}

              {/* Cinematic gradient overlay */}
              <div className="absolute inset-0 pointer-events-none" style={{
                background: 'linear-gradient(to top, rgba(10,10,15,0.95) 10%, rgba(10,10,15,0.3) 40%, transparent 60%)',
              }} />

              {/* Ambient genre glow at bottom */}
              <div className="absolute inset-0 pointer-events-none" style={{
                background: `radial-gradient(ellipse at 50% 100%, hsla(${genreHue}, 60%, 50%, 0.15) 0%, transparent 60%)`,
              }} />

              {/* Close button (top-right) */}
              <motion.button
                onClick={onClose}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer z-10"
                style={{ background: 'rgba(0,0,0,0.5)' }}
              >
                <X size={16} style={{ color: colors.white }} />
              </motion.button>

              {/* App ID badge (top-left) */}
              <div className="absolute top-3 left-3 z-10">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{
                  background: `${colors.violet}30`,
                  color: colors.violetLight || colors.violetLight,
                  border: `1px solid ${colors.violet}50`,
                  backdropFilter: 'blur(6px)',
                  WebkitBackdropFilter: 'blur(6px)',
                }}>
                  #{game.appid}
                </span>
              </div>

              {/* DRM badge */}
              {game.drm && (
                <div className="absolute top-3 left-16 z-10">
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1" style={{
                    background: 'rgba(239, 68, 68, 0.12)',
                    color: '#fca5a5', // intentional dynamic color
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    backdropFilter: 'blur(6px)',
                    WebkitBackdropFilter: 'blur(6px)',
                  }}>
                    <Shield size={10} /> DRM
                  </span>
                </div>
              )}
            </div>

            {/* ── Content Section ── */}
            <div className="p-5 space-y-4">
              {/* Game name */}
              <h2 className="text-xl font-bold leading-tight" style={{ color: colors.text }}>
                {game.name}
              </h2>

              {/* Genre pill + metadata row */}
              <div className="flex items-center gap-3 flex-wrap">
                {genreTag && (
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{
                    background: `hsla(${genreHue}, 60%, 40%, 0.2)`,
                    color: `hsl(${genreHue}, 65%, 70%)`,
                    border: `1px solid hsla(${genreHue}, 60%, 50%, 0.3)`,
                    boxShadow: `0 0 12px hsla(${genreHue}, 60%, 40%, 0.15)`,
                  }}>
                    {genreTag}
                  </span>
                )}

                <span className="flex items-center gap-1.5 text-xs" style={{ color: colors.textMuted }}>
                  <Gamepad2 size={12} />
                  {(game.type || '').toLowerCase() === 'dlc' ? 'DLC' : 'Game'}
                </span>

                {year && (
                  <span className="flex items-center gap-1.5 text-xs" style={{ color: colors.textMuted }}>
                    <Calendar size={12} />
                    {year}
                  </span>
                )}

                {game.added_date && (
                  <span className="flex items-center gap-1.5 text-xs" style={{ color: colors.textMuted }}>
                    <Tag size={12} />
                    {new Date(game.added_date).toLocaleDateString()}
                  </span>
                )}

                {hasDLC && (
                  <span className="flex items-center gap-1.5 text-xs" style={{ color: colors.cyan }}>
                    <Layers size={12} />
                    {Object.keys(game.dlc || {}).length} DLC
                  </span>
                )}
              </div>

              {/* ── Action Buttons ── */}
              <div className="space-y-2.5 pt-1">
                {/* Add to Steam */}
                <motion.button
                  onClick={handleInstall}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  className="w-full py-3 rounded-xl flex items-center justify-center gap-2 font-bold text-sm cursor-pointer"
                  style={{
                    background: `linear-gradient(135deg, ${colors.green}, ${colors.green}cc)`,
                    color: colors.white,
                    boxShadow: `0 4px 16px rgba(34,197,94,0.35), inset 0 1px 0 ${colors.whiteGlass}`,
                  }}
                >
                  <Zap size={16} />
                  Add to Steam
                </motion.button>

                {/* Install Zip */}
                <motion.button
                  onClick={handleInstallZip}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  className="w-full py-3 rounded-xl flex items-center justify-center gap-2 font-bold text-sm cursor-pointer"
                  style={{
                    background: `linear-gradient(135deg, ${COLORS.violet}, ${COLORS.violet}cc)`,
                    color: colors.white,
                    boxShadow: `0 4px 16px rgba(99,102,241,0.35), inset 0 1px 0 ${colors.whiteGlass}`,
                  }}
                >
                  <FolderOpen size={16} />
                  Install Zip
                </motion.button>

                {/* Manage DLCs — shown when game has DLC data */}
                {hasDLC && onOpenDLCManager && (
                  <motion.button
                    onClick={() => onOpenDLCManager(game)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    className="w-full py-2.5 rounded-xl flex items-center justify-center gap-2 font-bold text-sm cursor-pointer"
                    style={{
                      background: `${colors.violet}15`,
                      color: colors.violetLight || colors.violet,
                      border: `1px solid ${colors.violet}30`,
                    }}
                  >
                    <Layers size={15} />
                    Manage DLCs ({Object.keys(game.dlc || {}).length})
                  </motion.button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
})
