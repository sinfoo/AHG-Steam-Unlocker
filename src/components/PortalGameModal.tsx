import { useT } from '../i18n'
import { motion, AnimatePresence } from 'framer-motion'
import { memo, useState, useEffect } from 'react'
import { X, ExternalLink, CheckCircle2 } from 'lucide-react'
import type { ColorScheme, Game } from './shared'
import { getSteamImage } from './shared'
import { useUserStore, useInstallStore, useReducedMotion } from '../store'
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
  const rm = useReducedMotion()
  const t = useT()
  const E = 'cubic-bezier(.16,1,.3,1)'
  const rise = (d: number) => (rm ? undefined : `v2-riseIn .35s ${d}ms ${E} both`)

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
          transition={{ duration: rm ? 0 : 0.25 }}
          className="fixed inset-0 z-[150] overflow-y-auto"
          style={{ background: 'rgba(4,4,10,0.6)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
          onClick={() => setPortalModalOpen(false)}
        >
          <motion.div
            initial={rm ? false : { scale: 0.96, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={rm ? undefined : { scale: 0.96, y: 12 }}
            transition={{ duration: rm ? 0 : 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="min-h-screen py-8 px-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="max-w-5xl mx-auto overflow-hidden" role="dialog" aria-modal="true" aria-label={portalGame.name} style={{ background: '#0f0f1b', border: '1px solid rgba(255,255,255,.09)', borderRadius: 26, boxShadow: '0 60px 120px -30px rgba(0,0,0,1)', fontFamily: 'Geist, sans-serif' }}>
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
                <div className="hero-fallback absolute inset-0 hidden items-center justify-center" style={{ background: 'linear-gradient(135deg, color-mix(in oklch, var(--acc,#a77dff) 20%, #0f0f1b), #0f0f1b)' }}>
                  <span className="text-7xl font-bold" style={{ color: 'var(--acc,#a77dff)' }}>{portalGame.name?.[0]?.toUpperCase() || '?'}</span>
                </div>
                <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(0deg, #0f0f1b 0%, rgba(15,15,27,.3) 55%, rgba(15,15,27,.1) 100%)' }} />
                <button 
                  onClick={() => setPortalModalOpen(false)}
                  aria-label={t('ui.common.close')}
                  className="absolute top-4 end-4 flex items-center justify-center cursor-pointer"
                  style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(10,10,20,.5)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,.18)', color: '#fff' }}
                >
                  <X size={17} />
                </button>
                <div className="absolute bottom-0 start-0 end-0 p-6 md:p-8">
                  <h2 className="text-3xl md:text-4xl text-white mb-3" style={{ fontWeight: 700, letterSpacing: '-.035em', lineHeight: 1, animation: rise(80) }}>{portalGame.name}</h2>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="px-2.5 py-1 rounded-lg text-xs" style={{ background: 'rgba(255,255,255,.1)', backdropFilter: 'blur(8px)', color: '#e4e3f0', fontFamily: "'Geist Mono Variable','Geist Mono',monospace", fontWeight: 600 }}>{t('ui.portal.app', { id: portalGame.appid })}</span>
                    {portalDetails && (
                      <>
                        {portalDetails.release_date?.date && (
                          <span className="text-white/70 text-sm">{portalDetails.release_date.date}</span>
                        )}
                        {portalDetails.developers && (
                          <span className="text-white/70 text-sm">{t('ui.portal.by', { dev: portalDetails.developers.join(', ') })}</span>
                        )}
                      </>
                    )}
                    {ownedGameIds.has(portalGame.appid) && (
                      <span className="px-2.5 py-1 rounded-lg text-xs font-semibold" style={{ background: 'rgba(34,197,94,.14)', border: '1px solid rgba(34,197,94,.3)', color: '#86efac' }}>{t('ui.portal.owned')}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6 md:p-8 space-y-6" style={{ animation: rise(110) }}>
                {/* Action Buttons */}
                <div className="flex gap-3">
                  <motion.button
                    onClick={() => contextMenuInstall(portalGame)}
                    className="v2-btn-acc flex-1"
                    style={{ height: 50, borderRadius: 14, fontSize: 15, fontWeight: 650, boxShadow: '0 16px 40px -14px var(--acc,#a77dff)', fontFamily: 'inherit' }}
                  >
                    {installingGame === portalGame.appid ? t('ui.common.installing') : t('ui.portal.installNow')}
                  </motion.button>
                  <motion.button
                    onClick={() => contextMenuOpenSteam(portalGame)}
                    className="v2-ctl px-6 flex items-center justify-center"
                    aria-label={t('ui.portal.openSteam')}
                    style={{ height: 50, borderRadius: 14, background: 'rgba(255,255,255,.06)', color: '#fff', border: '1px solid rgba(255,255,255,.14)', cursor: 'pointer' }}
                  >
                    <ExternalLink size={20} />
                  </motion.button>
                </div>

                {/* Screenshot Carousel */}
                {portalScreenshots.length > 0 && (
                  <div>
                    <h3 className="mb-3" style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.18em', textTransform: 'uppercase', color: '#8b8aa3', fontFamily: "'Geist Mono Variable','Geist Mono',monospace" }}>{t('ui.portal.screenshots')}</h3>
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                      {portalScreenshots.map((ss: string, i: number) => (
                        <motion.div 
                          key={i}
                          className="flex-shrink-0 w-[280px] h-[160px] overflow-hidden"
                          style={{ border: '1px solid rgba(255,255,255,.07)', borderRadius: 14 }}
                        >
                          <img src={ss} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Description */}
                {portalDetails?.short_description && (
                  <div className="p-4" style={{ background: 'rgba(255,255,255,.035)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 20 }}>
                    <p className="text-sm leading-relaxed prose" style={{ color: COLORS.textSecondary }}>{portalDetails.short_description}</p>
                  </div>
                )}

                {/* Why This Fix Works Badge */}
                <div className="p-4" style={{ background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.3)', borderRadius: 20 }}>
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 size={18} style={{ color: COLORS.green }} />
                    <h4 className="text-sm font-bold" style={{ color: COLORS.green }}>{t('ui.portal.whyWorks')}</h4>
                  </div>
                  <p className="text-xs" style={{ color: COLORS.textSecondary }}>
                    {t('ui.portal.whyBody')}
                  </p>
                </div>

                {/* Related Games */}
                {portalRelated.length > 0 && (
                  <div>
                    <h3 className="mb-3" style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.18em', textTransform: 'uppercase', color: '#8b8aa3', fontFamily: "'Geist Mono Variable','Geist Mono',monospace" }}>{t('ui.portal.similar')}</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {portalRelated.slice(0, 8).map((game: any) => (
                        <motion.button
                          key={game.appid}
                          onClick={() => openPortalModal(game)}
                          className="v2-lift overflow-hidden text-start cursor-pointer"
                          style={{ background: 'rgba(255,255,255,.035)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 14 }}
                        >
                          <div className="h-[80px] overflow-hidden" style={{ background: 'color-mix(in oklch, var(--acc,#a77dff) 15%, transparent)' }}>
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
