import { memo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Sparkles, X } from 'lucide-react'
import { useUIStore } from '../store/uiStore'
import { useNewGames, ryuuAddedAt } from '../hooks/useNewGames'
import { steamPortrait, coverFallback } from '../utils/gameHelpers'
import { useT } from '../i18n'
import type { Game } from '../types'

const ACC = 'var(--acc, #a77dff)'
const MONO = "'Geist Mono Variable','Geist Mono',monospace"
const SHOWN = 60

/** Games Ryuu added since this user's last launch. Opens once per launch; the sidebar reopens it. */
export const NewGamesModal = memo(function NewGamesModal({ onOpenGame }: { onOpenGame: (g: Game) => void }) {
  const t = useT()
  const open = useUIStore(s => s.newGamesOpen)
  const setOpen = useUIStore(s => s.setNewGamesOpen)
  const games = useNewGames()
  const close = () => setOpen(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50"
          style={{ background: 'rgba(4,4,10,0.6)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={close}
        >
          <motion.div
            role="dialog" aria-modal="true" aria-label={t('app.new.title')}
            initial={{ scale: 0.96, opacity: 0, y: 16 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0, y: 16 }}
            transition={{ type: 'spring', damping: 24, stiffness: 320 }}
            onClick={e => e.stopPropagation()}
            style={{ width: 720, maxWidth: '94vw', maxHeight: '82vh', display: 'flex', flexDirection: 'column', borderRadius: 22, overflow: 'hidden', background: '#0f0f1b', border: '1px solid rgba(255,255,255,0.09)', boxShadow: '0 60px 120px -30px rgba(0,0,0,1)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 22px 16px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
              <span style={{ width: 38, height: 38, borderRadius: 12, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `color-mix(in oklch, ${ACC} 16%, transparent)`, color: ACC }}><Sparkles size={18} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: '#f3f2fa' }}>{t('app.new.title')}</div>
                <div style={{ fontSize: 12.5, color: '#8b8aa3', marginTop: 2 }}>{games.length === 1 ? t('app.new.subOne') : t('app.new.sub', { n: games.length })}</div>
              </div>
              <button onClick={close} aria-label="Close" className="v2-nav" style={{ width: 32, height: 32, border: 'none', borderRadius: 9, background: 'transparent', color: '#8b8aa3', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={17} /></button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(118px, 1fr))', gap: 14, alignContent: 'start' }}>
              {games.slice(0, SHOWN).map((g, i) => {
                const added = ryuuAddedAt(g)
                return (
                  <button key={g.appid} onClick={() => { close(); onOpenGame(g) }} title={g.name} className="hv-scale-08"
                    style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', textAlign: 'start', color: '#e4e3f0', animation: 'v2-riseIn .3s both', animationDelay: `${Math.min(i, 20) * 25}ms` }}>
                    <img src={steamPortrait(g.appid)} onError={e => coverFallback(e, g.appid)} alt="" loading="lazy" decoding="async"
                      style={{ width: '100%', aspectRatio: '2 / 3', borderRadius: 12, objectFit: 'cover', display: 'block', background: '#151524', boxShadow: '0 8px 20px rgba(0,0,0,.45)' }} />
                    <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.name}</div>
                    {added && <div style={{ fontFamily: MONO, fontSize: 10.5, color: '#6f6e86', marginTop: 2 }}>{t('app.new.addedOn', { d: new Date(added).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) })}</div>}
                  </button>
                )
              })}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 22px', borderTop: '1px solid rgba(255,255,255,.06)' }}>
              <span style={{ flex: 1, fontSize: 12.5, color: '#77768e' }}>{games.length > SHOWN ? t('app.new.more', { n: games.length - SHOWN }) : ''}</span>
              <button onClick={() => { close(); useUIStore.getState().openRequestGame() }} className="v2-ctl"
                style={{ height: 38, padding: '0 14px', borderRadius: 11, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.05)', color: '#fff', fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                <Send size={14} />{t('app.side.requestGame')}
              </button>
              <button onClick={close} style={{ height: 38, padding: '0 18px', borderRadius: 11, border: 'none', background: ACC, color: '#0b0614', fontSize: 13, fontWeight: 650, cursor: 'pointer' }}>{t('app.new.done')}</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
})
