import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Clock, Loader2, RefreshCw, Search, Send, X } from 'lucide-react'
import { useUIStore } from '../store/uiStore'
import { useGameStore } from '../store'
import { bridge, type RyuuLookupResult, type RyuuRequestRecord } from '../bridge'
import { useT } from '../i18n'
import type { Game } from '../types'
import { buildEntry, rankByName } from '../utils/gameMatch'
import popularGames from '../../data/popular_games.json'

const ACC = 'var(--acc, #a77dff)'
const MONO = "'Geist Mono Variable','Geist Mono',monospace"
const GREEN = '#4ade80'
const AMBER = '#fbbf24'
// appid → popularity rank, same list the main search ranks with.
const POPULARITY: Record<string, number> = {}
;[...new Set(popularGames as string[])].forEach((id, i) => { POPULARITY[id] = i })

const STEAM_LINK = /^\d+$|store\.steampowered\.com\/app\/\d+|steamdb\.info\/app\/\d+|steamcommunity\.com\/app\/\d+/i

type RowState = { busy?: 'game' | 'update'; ok?: boolean; message?: string }

const fmtDate = (iso?: string) => {
  const t = iso ? Date.parse(iso) : NaN
  return Number.isFinite(t) ? new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : ''
}

const chip = (color: string, label: string) => (
  <span style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 600, letterSpacing: '.04em', padding: '3px 8px', borderRadius: 6, color, background: `color-mix(in oklch, ${color} 14%, transparent)`, whiteSpace: 'nowrap' }}>{label}</span>
)

const btn = (primary: boolean): React.CSSProperties => ({
  height: 34, padding: '0 14px', borderRadius: 10, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
  border: primary ? 'none' : '1px solid rgba(255,255,255,.12)', background: primary ? ACC : 'rgba(255,255,255,.05)', color: primary ? '#0b0614' : '#fff',
  transition: 'transform 80ms cubic-bezier(0.4, 0, 0.2, 1), background 80ms cubic-bezier(0.4, 0, 0.2, 1)',
})

/** Ask Ryuu to add a game (or refresh one), like the generator site: search, see if it's here, request. */
export const RequestGameModal = memo(function RequestGameModal({ onOpenGame }: { onOpenGame: (g: Game) => void }) {
  const t = useT()
  const { open, query: initialQuery } = useUIStore(s => s.requestGame)
  const close = useUIStore(s => s.closeRequestGame)
  const games = useGameStore(s => s.games) as Game[]
  const catalogue = useMemo(() => new Map(games.map(g => [String(g.appid), g])), [games])
  // Same matching as the main search (Spider-Man, GTA-style acronyms, word prefixes), built once per catalogue.
  const entries = useMemo(() => (open ? games.map(buildEntry) : []), [games, open])

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<RyuuLookupResult[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const [rows, setRows] = useState<Record<string, RowState>>({})
  const [mine, setMine] = useState<RyuuRequestRecord[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const seq = useRef(0)

  const loadMine = useCallback(() => { bridge.ryuuMyRequests().then(r => setMine(r.requests || [])).catch(() => {}) }, [])

  useEffect(() => {
    if (!open) return
    setQuery(initialQuery); setRows({}); setError('')
    loadMine()
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [open, initialQuery, loadMine])

  // Debounced Steam lookup; a newer keystroke discards older answers.
  useEffect(() => {
    const q = query.trim()
    if (!open || (q.length < 3 && !STEAM_LINK.test(q))) { setResults([]); setSearching(false); setError(''); return }
    const id = ++seq.current
    setResults([]); setError('')
    setSearching(true)
    const timer = setTimeout(() => {
      bridge.ryuuLookup(q).then(r => {
        if (id !== seq.current) return
        setResults(r.results || []); setError(r.success ? '' : (r.message || ''))
      }).catch(e => { if (id === seq.current) { setResults([]); setError(String(e?.message || e)) } })
        .finally(() => { if (id === seq.current) setSearching(false) })
    }, 600)
    return () => clearTimeout(timer)
  }, [query, open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  const request = async (appid: string, name: string, kind: 'game' | 'update') => {
    setRows(r => ({ ...r, [appid]: { busy: kind } }))
    try {
      const res = await bridge.ryuuRequest(appid, name, kind)
      setRows(r => ({ ...r, [appid]: { ok: res.success, message: res.message } }))
      if (res.success) loadMine()
    } catch (e: any) {
      // The rate limiter rejects with "Too many requests. Please wait."
      setRows(r => ({ ...r, [appid]: { ok: false, message: /too many/i.test(String(e?.message)) ? String(e.message).replace(/^.*Error: /, '') : t('app.req.failed') } }))
    }
  }

  const openGame = (g: Game) => { close(); onOpenGame(g) }

  const q = query.trim()
  const rowsShown = useMemo(() => {
    const local: RyuuLookupResult[] = STEAM_LINK.test(q) ? [] : rankByName(games, entries, q, 6, POPULARITY)
      .map(g => ({ appid: String(g.appid), name: g.name || '', image: g.header_image || `https://cdn.akamai.steamstatic.com/steam/apps/${g.appid}/header.jpg` }))
    const seen = new Set(local.map(r => r.appid))
    return [...local, ...results.filter(r => !seen.has(r.appid))]
  }, [q, games, entries, results])
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50"
          style={{ background: 'rgba(4,4,10,0.6)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '9vh' }}
          onClick={close}
        >
          <motion.div
            role="dialog" aria-modal="true" aria-label={t('app.req.title')}
            initial={{ scale: 0.96, opacity: 0, y: 16 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0, y: 16 }}
            transition={{ type: 'spring', damping: 24, stiffness: 320 }}
            onClick={e => e.stopPropagation()}
            style={{ width: 640, maxWidth: '94vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column', borderRadius: 22, overflow: 'hidden', background: '#0f0f1b', border: '1px solid rgba(255,255,255,0.09)', boxShadow: '0 60px 120px -30px rgba(0,0,0,1)' }}
          >
            {/* Header */}
            <div style={{ padding: '20px 22px 16px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 38, height: 38, borderRadius: 12, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `color-mix(in oklch, ${ACC} 16%, transparent)`, color: ACC }}><Send size={18} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 17, fontWeight: 700, color: '#f3f2fa' }}>{t('app.req.title')}</div>
                  <div style={{ fontSize: 12.5, color: '#8b8aa3', marginTop: 2 }}>{t('app.req.sub')}</div>
                </div>
                <button onClick={close} aria-label="Close" className="v2-nav" style={{ width: 32, height: 32, border: 'none', borderRadius: 9, background: 'transparent', color: '#8b8aa3', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={17} /></button>
              </div>
              <div style={{ position: 'relative', marginTop: 16 }}>
                <Search size={16} style={{ position: 'absolute', insetInlineStart: 14, top: 13, color: '#6f6e86' }} />
                <input
                  ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} placeholder={t('app.req.placeholder')} spellCheck={false}
                  style={{ width: '100%', height: 42, borderRadius: 12, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)', color: '#fff', fontSize: 14, paddingInlineStart: 40, paddingInlineEnd: 40, outline: 'none' }}
                  onFocus={e => { e.currentTarget.style.borderColor = `color-mix(in oklch, ${ACC} 55%, transparent)` }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.1)' }}
                />
                {searching && <Loader2 size={16} className="animate-spin" style={{ position: 'absolute', insetInlineEnd: 14, top: 13, color: '#8b8aa3' }} />}
              </div>
            </div>

            {/* Results */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px 16px' }}>
              {!q && <div style={{ fontSize: 12.5, color: '#77768e', padding: '6px 8px 10px' }}>{t('app.req.hint')}</div>}
              {q && !searching && rowsShown.length === 0 && !error && (
                <div style={{ fontSize: 13, color: '#8b8aa3', padding: '14px 8px' }}>{t('app.req.noResults', { q })}</div>
              )}
              {rowsShown.map((r, i) => {
                const g = catalogue.get(r.appid)
                const row = rows[r.appid] || {}
                const name = r.name || g?.name || t('app.req.unknownName', { id: r.appid })
                return (
                  <div key={r.appid} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: 10, borderRadius: 14, animation: 'v2-riseIn .25s both', animationDelay: `${i * 30}ms` }} className="v2-nav">
                    <img src={r.image} alt="" loading="lazy" onError={e => { e.currentTarget.style.visibility = 'hidden' }}
                      style={{ width: 128, height: 60, borderRadius: 9, objectFit: 'cover', flex: 'none', background: '#151524' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div title={name} style={{ fontSize: 14, fontWeight: 600, color: '#f3f2fa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5, minWidth: 0 }}>
                        {g ? chip(GREEN, t('app.req.available')) : chip(AMBER, t('app.req.missing'))}
                        <span style={{ fontFamily: MONO, fontSize: 11, color: '#77768e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {t('app.req.appid', { id: r.appid })}
                          {g?.updated_date && <> · {t('app.req.updated', { d: fmtDate(g.updated_date) })}</>}
                        </span>
                      </div>
                      {row.message && (
                        <div style={{ fontSize: 12, marginTop: 5, color: row.ok ? GREEN : '#f87171', display: 'flex', alignItems: 'center', gap: 5 }}>
                          {row.ok && <Check size={13} />}{row.message}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flex: 'none' }}>
                      {g ? (
                        <>
                          <button style={btn(false)} disabled={!!row.busy} onClick={() => request(r.appid, name, 'update')}>
                            {row.busy === 'update' ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}{t('app.req.requestUpdate')}
                          </button>
                          <button style={btn(true)} onClick={() => openGame(g)}>{t('app.req.open')}</button>
                        </>
                      ) : (
                        <button style={btn(true)} disabled={!!row.busy || row.ok} onClick={() => request(r.appid, name, 'game')}>
                          {row.busy === 'game' ? <Loader2 size={13} className="animate-spin" /> : row.ok ? <Check size={13} /> : <Send size={13} />}{t('app.req.request')}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}

              {q && error && !searching && (
                <div style={{ fontSize: 12.5, color: '#8b8aa3', padding: '10px 8px' }}>{t('app.req.steamBusy')}</div>
              )}

              {/* Your requests */}
              {!q && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 600, letterSpacing: '.16em', color: '#6f6e86', padding: '8px 8px 8px' }}>{t('app.req.mine')}</div>
                  {mine.length === 0 && <div style={{ fontSize: 12.5, color: '#77768e', padding: '2px 8px' }}>{t('app.req.mineEmpty')}</div>}
                  {mine.map(r => {
                    const g = catalogue.get(r.appid)
                    // The catalogue is the ground truth for game requests: if it's here, it was added.
                    const done = r.status === 'fulfilled' || (r.kind === 'game' && !!g)
                    return (
                      <div key={`${r.kind}:${r.appid}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px', borderRadius: 12 }}>
                        <img src={`https://cdn.akamai.steamstatic.com/steam/apps/${r.appid}/capsule_sm_120.jpg`} alt="" loading="lazy" onError={e => { e.currentTarget.style.visibility = 'hidden' }}
                          style={{ width: 72, height: 27, borderRadius: 6, objectFit: 'cover', flex: 'none', background: '#151524' }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, color: '#e4e3f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name || g?.name || t('app.req.unknownName', { id: r.appid })}</div>
                          <div style={{ fontFamily: MONO, fontSize: 10.5, color: '#6f6e86', marginTop: 2 }}>
                            {r.kind === 'update' ? t('app.req.kindUpdate') : t('app.req.kindGame')} · {fmtDate(r.requestedAt)}
                          </div>
                        </div>
                        {done
                          ? chip(GREEN, t('app.req.fulfilled'))
                          : r.status === 'unknown' ? chip('#8b8aa3', t('app.req.statusUnknown')) : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Clock size={12} style={{ color: AMBER }} />{chip(AMBER, t('app.req.pending'))}</span>}
                        {g && <button style={{ ...btn(false), height: 28, padding: '0 10px' }} onClick={() => openGame(g)}>{t('app.req.open')}</button>}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
})
