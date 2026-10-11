import { useT } from '../i18n'
import { memo, useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Zap, FolderOpen, Shield, Layers } from 'lucide-react'
import type { Game } from '../types'
import type { ColorScheme } from './shared'
import { loadGameImage } from '../services/imageCache'
import { useReducedMotion } from '../store'

interface GameActionModalProps {
  game: Game | null
  isOpen: boolean
  onClose: () => void
  onInstallGame: (game?: any) => void
  onInstallFromZip: (game?: any) => void
  onOpenDLCManager?: (game: Game) => void
  colors: ColorScheme
}

const E = 'cubic-bezier(.16,1,.3,1)'
const MONO = "'Geist Mono Variable','Geist Mono',monospace"
const ghostStyle: React.CSSProperties = { height: 44, borderRadius: 13, border: '1px solid rgba(255,255,255,.14)', background: 'rgba(255,255,255,.06)', color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'inherit' }

export const GameActionModal = memo(function GameActionModal({ game, isOpen, onClose, onInstallGame, onInstallFromZip, onOpenDLCManager }: GameActionModalProps) {
  const rm = useReducedMotion()
  const t = useT()
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

  const dlcCount = game?.dlc_count ?? Object.keys(game?.dlc || {}).length
  const hasDLC = dlcCount > 0
  const year = (game as any)?.release_date ? (game as any).release_date.split('-')[0] : null
  const initial = game?.name ? game.name[0]!.toUpperCase() : '?'

  const handleInstall = () => {
    onInstallGame(game)
  }

  const handleInstallZip = () => {
    onInstallFromZip(game)
  }

  const rise = (d: number) => (rm ? undefined : `v2-riseIn .35s ${d}ms ${E} both`)
  const info: [string, string, boolean][] = game ? [
    [t('ui.gam.type'), (game.type || '').toLowerCase() === 'dlc' ? 'DLC' : t('ui.common.game'), false],
    [t('ui.gam.appId'), game.appid, true],
    [t('ui.gam.released'), year || '—', true],
    [t('ui.gam.added'), game.added_date ? new Date(game.added_date).toLocaleDateString() : '—', true],
    ['DLC', hasDLC ? String(dlcCount) : '—', true],
    [t('ui.gam.genre'), genreTag || '—', false],
  ] : []

  return (
    <AnimatePresence>
      {isOpen && game && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: rm ? 0 : 0.25, ease: 'easeOut' }}
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: 'rgba(4,4,10,0.6)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
          onClick={onClose}
        >
          <motion.div
            initial={rm ? false : { opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={rm ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: rm ? 0 : 0.3, ease: [0.16, 1, 0.3, 1] }}
            role="dialog" aria-modal="true" aria-label={game.name}
            style={{
              position: 'relative', width: 'min(900px,100%)', maxHeight: '100%', overflow: 'auto',
              background: '#0f0f1b', border: '1px solid rgba(255,255,255,.09)', borderRadius: 26,
              boxShadow: '0 60px 120px -30px rgba(0,0,0,1)', fontFamily: 'Geist, sans-serif', color: '#f3f2fa',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Hero ── */}
            <div style={{ position: 'relative', height: 280, overflow: 'hidden', background: '#0a0a14' }}>
              {!imageError && game.header_image ? (
                <img
                  src={cachedUrl || game.header_image}
                  alt={game.name}
                  onLoad={() => setImageLoaded(true)}
                  onError={() => setImageError(true)}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: imageLoaded ? 1 : 0, transition: 'opacity .3s ease', animation: rm ? undefined : 'v2-hkenBurns 20s ease-in-out infinite alternate' }}
                />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg, hsl(${genreHue}, 50%, 12%) 0%, hsl(${(genreHue + 40) % 360}, 40%, 18%) 50%, hsl(${genreHue}, 30%, 8%) 100%)` }}>
                  <span style={{ color: `hsl(${genreHue}, 70%, 70%)`, fontSize: 64, fontWeight: 700 }}>{initial}</span>
                </div>
              )}
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(0deg, #0f0f1b 0%, rgba(15,15,27,.3) 55%, rgba(15,15,27,.1) 100%)' }} />
              <button
                onClick={onClose}
                aria-label={t('ui.common.close')}
                style={{ position: 'absolute', top: 16, insetInlineEnd: 16, width: 38, height: 38, borderRadius: 12, border: '1px solid rgba(255,255,255,.18)', background: 'rgba(10,10,20,.5)', backdropFilter: 'blur(10px)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform .3s cubic-bezier(.34,1.56,.64,1)' }}
                onMouseEnter={(e) => { if (!rm) e.currentTarget.style.transform = 'rotate(90deg)' }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'none' }}
              >
                <X size={17} />
              </button>
              <div style={{ position: 'absolute', left: 30, right: 30, bottom: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', animation: rise(60) }}>
                  {genreTag && <span style={{ fontSize: 11.5, fontWeight: 600, padding: '4px 10px', borderRadius: 8, background: 'rgba(255,255,255,.1)', backdropFilter: 'blur(8px)', color: '#e4e3f0' }}>{genreTag}</span>}
                  {game.drm && <span style={{ fontSize: 11.5, fontWeight: 600, padding: '4px 10px', borderRadius: 8, background: 'rgba(239,68,68,.14)', border: '1px solid rgba(239,68,68,.3)', color: '#fca5a5', display: 'inline-flex', alignItems: 'center', gap: 5 }}><Shield size={11} />DRM</span>}
                </div>
                <h2 style={{ margin: 0, fontSize: 40, fontWeight: 700, letterSpacing: '-.035em', lineHeight: 1, animation: rise(80) }}>{game.name}</h2>
              </div>
            </div>

            {/* ── Body ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)', gap: 24, padding: '10px 30px 30px' }}>
              <div style={{ animation: rise(110) }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, borderRadius: 16, overflow: 'hidden', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.06)' }}>
                  {info.map(([k, v, mono]) => (
                    <div key={k} style={{ padding: '14px 16px', background: '#0f0f1b', minWidth: 0 }}>
                      <div style={{ fontSize: 11.5, color: '#8b8aa3' }}>{k}</div>
                      <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4, fontFamily: mono ? MONO : undefined, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ padding: 18, borderRadius: 20, background: 'rgba(255,255,255,.035)', border: '1px solid rgba(255,255,255,.07)', display: 'flex', flexDirection: 'column', gap: 12, animation: rise(140) }}>
                {/* Add to Steam */}
                <button
                  onClick={handleInstall}
                  className="v2-btn-acc"
                  style={{ height: 50, borderRadius: 14, fontSize: 15, fontWeight: 650, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, position: 'relative', overflow: 'hidden', boxShadow: '0 16px 40px -14px var(--acc,#a77dff)', fontFamily: 'inherit' }}
                >
                  <Zap size={17} />
                  {t('ui.gam.addToSteam')}
                  {!rm && <span style={{ position: 'absolute', top: 0, bottom: 0, width: '30%', background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.35),transparent)', animation: 'v2-sheen 3s 1s ease-in-out infinite' }} />}
                </button>

                {/* Install Zip */}
                <button onClick={handleInstallZip} className="v2-ctl" style={ghostStyle}>
                  <FolderOpen size={16} />
                  {t('ui.gam.installZip')}
                </button>

                {/* Manage DLCs — the manager fetches DLCs itself (Steam API + catalogue),
                    so offer it for any game rather than only when the catalog row already
                    has a dlc map (which is empty for many games that do have DLC). */}
                {onOpenDLCManager && (
                  <button
                    onClick={() => onOpenDLCManager(game)}
                    className="v2-ctl"
                    style={{ ...ghostStyle, height: 40, borderRadius: 12, fontSize: 13, background: 'transparent', color: 'var(--acc,#a77dff)', border: '1px solid color-mix(in oklch, var(--acc,#a77dff) 32%, transparent)' }}
                  >
                    <Layers size={15} />
                    {t('ui.gam.manageDlcs', { n: dlcCount })}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
})
