import { memo, useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Gamepad2 } from 'lucide-react'
import { COLORS } from '../constants/colors'
import { loadGameImage } from '../services/imageCache'
import type { Game } from '../types'

interface NewGamesModalProps {
  isOpen: boolean
  games: Game[]
  onClose: () => void
}

export const NewGamesModal = memo(function NewGamesModal({ isOpen, games, onClose }: NewGamesModalProps) {
  const [coverUrls, setCoverUrls] = useState<Record<string, string | null>>({})

  useEffect(() => {
    if (!isOpen || games.length === 0) return
    const appids = games.map(g => g.appid)
    let cancelled = false
    Promise.all(
      appids.map(appid =>
        loadGameImage(appid).then(url => {
          if (!cancelled) setCoverUrls(prev => ({ ...prev, [appid]: url }))
        })
      )
    )
    return () => { cancelled = true }
  }, [isOpen, games])

  const gameHues = useMemo(() => {
    const hues: Record<string, number> = {}
    games.forEach(g => {
      const num = parseInt(g.appid) || 0
      hues[g.appid] = (num * 37) % 360
    })
    return hues
  }, [games])

  return (
    <AnimatePresence>
      {isOpen && games.length > 0 && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="relative w-full max-w-lg mx-4 rounded-3xl overflow-hidden"
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: 'spring', stiffness: 80, damping: 18, mass: 0.8 }}
            style={{
              background: `linear-gradient(160deg, ${COLORS.bgDark} 0%, ${COLORS.bgDeep} 100%)`,
              border: `1px solid ${COLORS.border}`,
              boxShadow: `0 0 80px rgba(139,92,246,0.12), 0 20px 60px rgba(0,0,0,0.6)`,
            }}
          >
            {/* Header glow */}
            <div
              className="absolute top-0 left-0 right-0 h-32 pointer-events-none"
              style={{
                background: `radial-gradient(ellipse at 50% -20%, ${COLORS.blueDim} 0%, transparent 70%)`,
              }}
            />

            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-10 p-1.5 rounded-xl transition-all duration-200 hover:scale-110"
              style={{ background: `${COLORS.bgMid}cc`, color: COLORS.textMuted, backdropFilter: 'blur(8px)' }}
            >
              <X size={16} />
            </button>

            <div className="p-6 pb-5">
              {/* Icon + Title */}
              <div className="flex items-center gap-3 mb-1">
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center"
                  style={{ background: `${COLORS.blue}20` }}
                >
                  <Gamepad2 size={20} color={COLORS.blue} />
                </div>
                <div>
                  <h2 className="text-xl font-bold" style={{ color: COLORS.white }}>
                    New Game{games.length > 1 ? 's' : ''} Available
                  </h2>
                  <p className="text-sm" style={{ color: COLORS.textMuted }}>
                    {games.length} new game{games.length > 1 ? 's' : ''} added to the library
                  </p>
                </div>
              </div>
            </div>

            {/* Game cards */}
            <div className={`px-6 pb-4 ${games.length > 2 ? 'max-h-[340px] overflow-y-auto' : ''}`}
              style={{ scrollbarWidth: 'thin', scrollbarColor: `${COLORS.border} transparent` }}>
              <div className={`grid ${games.length === 1 ? 'grid-cols-1' : 'grid-cols-2'} gap-3`}>
                {games.map(game => {
                  const hue = gameHues[game.appid] || 260
                  const cachedCover = coverUrls[game.appid]

                  return (
                    <motion.div
                      key={game.appid}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: 0.05 }}
                      className="rounded-2xl overflow-hidden"
                      style={{
                        background: COLORS.bgCard,
                        border: `1px solid ${COLORS.border}`,
                      }}
                    >
                      {/* Cover image */}
                      <div
                        className="relative overflow-hidden"
                        style={{
                          aspectRatio: '16/9',
                          background: `linear-gradient(135deg, hsl(${hue},50%,12%) 0%, hsl(${(hue + 40) % 360},40%,18%) 100%)`,
                        }}
                      >
                        {cachedCover ? (
                          <img
                            src={cachedCover}
                            alt={game.name || game.appid}
                            className="w-full h-full object-cover"
                            decoding="async"
                            fetchPriority="low"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span
                              className="text-3xl font-bold"
                              style={{ color: `hsl(${hue},70%,70%)`, textShadow: `0 2px 12px hsla(${hue},70%,50%,0.5)` }}
                            >
                              {game.name?.[0]?.toUpperCase() || '?'}
                            </span>
                          </div>
                        )}

                        {/* Gradient overlay */}
                        <div
                          className="absolute inset-0 pointer-events-none"
                          style={{
                            background: 'linear-gradient(to top, rgba(10,10,15,0.85) 0%, transparent 50%)',
                          }}
                        />

                        {/* App ID */}
                        <span
                          className="absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold"
                          style={{
                            background: `${COLORS.blue}20`,
                            color: COLORS.blue,
                            border: '1px solid rgba(59,130,246,0.25)',
                            backdropFilter: 'blur(6px)',
                          }}
                        >
                          #{game.appid}
                        </span>
                      </div>

                      {/* Info */}
                      <div className="p-3">
                        <p className="font-semibold text-xs truncate" style={{ color: COLORS.text }}>
                          {game.name || game.appid}
                        </p>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </div>

            {/* Actions — single dismiss button */}
            <div className="px-6 pb-6 flex items-center gap-3">
              <button
                onClick={onClose}
                className="w-full py-2.5 rounded-xl text-sm font-bold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: `linear-gradient(135deg, ${COLORS.violet}, ${COLORS.purple})`, // intentional gradient variation
                  color: COLORS.white,
                  boxShadow: `0 4px 16px ${COLORS.violet}40`,
                }}
              >
                Great!
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
})
