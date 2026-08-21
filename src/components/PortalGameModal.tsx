import { motion, AnimatePresence } from 'framer-motion'
import { memo, useState, useEffect } from 'react'
import { X, ExternalLink, CheckCircle2 } from 'lucide-react'
import type { ColorScheme, Game } from './shared'
import { getSteamImage } from './shared'
import { useUserStore, useInstallStore } from '../store'
import { loadGameImage } from '../services/imageCache'

interface PortalGameModalProps {
  colors: ColorScheme
  contextMenuInstall: (game: Game) => void
  contextMenuOpenSteam: (game: Game) => void
  openPortalModal: (game: Game) => void
}

export const PortalGameModal = memo(function PortalGameModal({
  colors: COLORS,
  contextMenuInstall,
  contextMenuOpenSteam,
  openPortalModal,
}: PortalGameModalProps) {
  const portalModalOpen = useUserStore(s => s.portalModalOpen)
  const setPortalModalOpen = useUserStore(s => s.setPortalModalOpen)
  const portalGame = useUserStore(s => s.portalGame)
  const ownedGameIds = useUserStore(s => s.ownedGameIds)
  const portalDetails = useUserStore(s => s.portalDetails)
  const portalScreenshots = useUserStore(s => s.portalScreenshots)
  const portalRelated = useUserStore(s => s.portalRelated)
  const installingGame = useInstallStore(s => s.installingGame)

  // ── Image caching via loadGameImage ──
  const [heroImgUrl, setHeroImgUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!portalGame) return
    let mounted = true
    loadGameImage(portalGame.appid, portalGame.header_image || undefined, portalGame.name || undefined).then(url => {
      if (mounted) setHeroImgUrl(url)
    }).catch(() => {})
    return () => { mounted = false }
  }, [portalGame?.appid, portalGame?.header_image, portalGame?.name])

  const [relatedImgUrls, setRelatedImgUrls] = useState<Record<string, string | null>>({})
  useEffect(() => {
    const results: Record<string, string | null> = {}
    Promise.allSettled(
      portalRelated.map((g: any) =>
        loadGameImage(g.appid, g.header_image || undefined, g.name || undefined)
          .then(url => { results[g.appid] = url })
      )
    ).then(() => setRelatedImgUrls(results))
  }, [portalRelated])

  return (
    <AnimatePresence>
      {portalModalOpen && portalGame && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[150] overflow-y-auto"
          style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}
          onClick={() => setPortalModalOpen(false)}
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            className="min-h-screen py-8 px-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="max-w-5xl mx-auto rounded-3xl overflow-hidden" style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, boxShadow: `0 32px 96px rgba(0,0,0,0.6)` }}>
              {/* Hero Image */}
              <div className="relative h-[300px] md:h-[400px]">
                <img 
                  src={heroImgUrl || portalGame.header_image || getSteamImage(portalGame.appid)} 
                  alt={portalGame.name}
                  className="w-full h-full object-cover"
                  loading="lazy" decoding="async" fetchPriority="low"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const fb = e.currentTarget.parentElement?.querySelector('.hero-fallback') as HTMLElement;
                    if (fb) fb.style.display = 'flex';
                  }}
                />
                <div className="hero-fallback absolute inset-0 hidden items-center justify-center" style={{ background: `linear-gradient(135deg, ${COLORS.violet}30, ${COLORS.blue}20)` }}>
                  <span className="text-7xl font-bold" style={{ color: COLORS.violet, textShadow: `0 4px 20px ${COLORS.violetGlow}` }}>{portalGame.name?.[0]?.toUpperCase() || '?'}</span>
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                <button 
                  onClick={() => setPortalModalOpen(false)}
                  className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', border: `1px solid ${COLORS.border}` }}
                >
                  <X size={20} style={{ color: 'white' }} />
                </button>
                <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
                  <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">{portalGame.name}</h2>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="px-3 py-1 rounded-lg text-sm font-bold" style={{ background: COLORS.violet, color: 'white' }}>App {portalGame.appid}</span>
                    {portalDetails && (
                      <>
                        {portalDetails.release_date?.date && (
                          <span className="text-white/70 text-sm">{portalDetails.release_date.date}</span>
                        )}
                        {portalDetails.developers && (
                          <span className="text-white/70 text-sm">by {portalDetails.developers.join(', ')}</span>
                        )}
                      </>
                    )}
                    {ownedGameIds.has(portalGame.appid) && (
                      <span className="px-2 py-0.5 rounded text-xs font-bold" style={{ background: `${COLORS.green}30`, color: COLORS.green }}>✓ Owned</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6 md:p-8 space-y-6">
                {/* Action Buttons */}
                <div className="flex gap-3">
                  <motion.button
                    onClick={() => contextMenuInstall(portalGame)}
                    className="flex-1 py-4 rounded-2xl font-bold text-lg text-white"
                    style={{ background: `linear-gradient(135deg, ${COLORS.green}, ${COLORS.blue})`, boxShadow: `0 8px 32px ${COLORS.green}40` }}
                  >
                    {installingGame === portalGame.appid ? 'Installing...' : 'Install Now'}
                  </motion.button>
                  <motion.button
                    onClick={() => contextMenuOpenSteam(portalGame)}
                    className="px-6 py-4 rounded-2xl font-bold"
                    style={{ background: COLORS.bgMid, color: COLORS.text, border: `1px solid ${COLORS.border}` }}
                  >
                    <ExternalLink size={20} />
                  </motion.button>
                </div>

                {/* Screenshot Carousel */}
                {portalScreenshots.length > 0 && (
                  <div>
                    <h3 className="text-lg font-bold mb-3" style={{ color: COLORS.text }}>Screenshots</h3>
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                      {portalScreenshots.map((ss: string, i: number) => (
                        <motion.div 
                          key={i}
                          className="flex-shrink-0 w-[280px] h-[160px] rounded-xl overflow-hidden"
                          style={{ border: `1px solid ${COLORS.border}` }}
                        >
                          <img src={ss} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Description */}
                {portalDetails?.short_description && (
                  <div className="p-4 rounded-xl" style={{ background: COLORS.bgMid, border: `1px solid ${COLORS.border}` }}>
                    <p className="text-sm leading-relaxed prose" style={{ color: COLORS.textSecondary }}>{portalDetails.short_description}</p>
                  </div>
                )}

                {/* Why This Fix Works Badge */}
                <div className="p-4 rounded-xl" style={{ background: `${COLORS.green}10`, border: `1px solid ${COLORS.green}30` }}>
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 size={18} style={{ color: COLORS.green }} />
                    <h4 className="text-sm font-bold" style={{ color: COLORS.green }}>Why This Fix Works</h4>
                  </div>
                  <p className="text-xs" style={{ color: COLORS.textSecondary }}>
                    This manifest bypasses Steam's ownership check by providing valid depot cache files. 
                    When Steam restarts, it will detect the game as installed and playable.
                  </p>
                </div>

                {/* Related Games */}
                {portalRelated.length > 0 && (
                  <div>
                    <h3 className="text-lg font-bold mb-3" style={{ color: COLORS.text }}>Similar Games</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {portalRelated.slice(0, 8).map((game: any) => (
                        <motion.button
                          key={game.appid}
                          onClick={() => openPortalModal(game)}
                          className="rounded-xl overflow-hidden text-left"
                          style={{ background: COLORS.bgMid, border: `1px solid ${COLORS.border}` }}
                        >
                          <div className="h-[80px] overflow-hidden" style={{ background: COLORS.violetDim }}>
                            <img src={relatedImgUrls[game.appid] || game.header_image} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                          </div>
                          <div className="p-2">
                            <p className="text-xs font-semibold truncate" style={{ color: COLORS.text }}>{game.name}</p>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
})
