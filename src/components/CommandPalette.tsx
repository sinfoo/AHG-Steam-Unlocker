import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { CornerDownLeft, Search } from 'lucide-react'
import type { Game } from '../types'
import { useT } from '../i18n'

interface PaletteItem {
  key: string
  group: string
  label: string
  sub?: string
  img?: string
  Icon?: React.ComponentType<{ size?: number; style?: React.CSSProperties }>
  color?: string
  run: () => void
}

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  games: Game[]
  navItems: Array<{ id: string; label: string; icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; color: string }>
  quickTools: Array<{ name: string; desc: string; icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; color: string; action: () => void }>
  navigateTo: (page: string) => void
  onOpenGame: (game: Game) => void
}

const MONO = "'Geist Mono Variable','Geist Mono',monospace"
const kbd: React.CSSProperties = { font: `500 10.5px ${MONO}`, padding: '2px 6px', borderRadius: 5, background: 'rgba(255,255,255,.07)' }

const CommandPalette = memo(function CommandPalette({ open, onClose, games, navItems, quickTools, navigateTo, onOpenGame }: CommandPaletteProps) {
  const t = useT()
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) { setQ(''); setIdx(0); requestAnimationFrame(() => inputRef.current?.focus()) }
  }, [open])

  const items = useMemo<PaletteItem[]>(() => {
    if (!open) return []
    const needle = q.trim().toLowerCase()
    const go = (fn: () => void) => () => { onClose(); fn() }
    const pages: PaletteItem[] = navItems
      .filter(n => !needle || n.label.toLowerCase().includes(needle))
      .map(n => ({ key: `p-${n.id}`, group: t('app.palette.pages'), label: n.label, sub: t('app.palette.goToPage'), Icon: n.icon, color: n.color, run: go(() => navigateTo(n.id)) }))
    const actions: PaletteItem[] = quickTools
      .filter(a => !needle || a.name.toLowerCase().includes(needle))
      .map(a => ({ key: `a-${a.name}`, group: t('app.palette.actions'), label: a.name, sub: a.desc, Icon: a.icon, color: a.color, run: go(a.action) }))
    const found: PaletteItem[] = []
    if (needle.length >= 2) {
      for (const g of games) {
        if ((g.name || '').toLowerCase().includes(needle)) {
          found.push({ key: `g-${g.appid}`, group: t('app.palette.games'), label: g.name || g.appid, sub: t('app.palette.app', { id: g.appid }), img: g.header_image || `https://cdn.cloudflare.steamstatic.com/steam/apps/${g.appid}/header.jpg`, run: go(() => onOpenGame(g)) })
          if (found.length >= 6) break
        }
      }
    }
    return [...found, ...pages, ...actions]
  }, [open, q, games, navItems, quickTools, navigateTo, onOpenGame, onClose, t])

  if (!open) return null

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(i + 1, items.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); items[idx]?.run() }
    else if (e.key === 'Escape') { e.preventDefault(); onClose() }
  }

  let lastGroup = ''
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 90, display: 'flex', justifyContent: 'center', paddingTop: '12vh' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(4,4,10,.6)', backdropFilter: 'blur(10px)', animation: 'v2-fadeIn .25s both' }} />
      <div
        role="dialog" aria-label={t('app.palette.aria')}
        style={{ position: 'relative', width: 'min(640px,92vw)', height: 'fit-content', borderRadius: 20, background: 'rgba(18,18,31,.97)', backdropFilter: 'blur(30px)', border: '1px solid rgba(255,255,255,.1)', boxShadow: '0 50px 100px -20px rgba(0,0,0,1), 0 0 0 1px color-mix(in oklch, var(--acc,#a77dff) 20%, transparent)', overflow: 'hidden', animation: 'v2-popIn .2s var(--ease-out) both' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 60, padding: '0 18px', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
          <Search size={19} style={{ color: 'var(--acc,#a77dff)' }} />
          <input
            ref={inputRef} value={q} onChange={e => { setQ(e.target.value); setIdx(0) }} onKeyDown={onKey}
            placeholder={t('app.palette.placeholder')}
            style={{ flex: 1, height: '100%', border: 'none', background: 'transparent', color: '#fff', fontSize: 16.5, outline: 'none' }}
          />
          <kbd className="v2-kbd">ESC</kbd>
        </div>
        <div style={{ maxHeight: 420, overflow: 'auto', padding: 8 }}>
          {items.map((it, i) => {
            const head = it.group !== lastGroup
            lastGroup = it.group
            const active = i === idx
            return (
              <div key={it.key}>
                {head && <div style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 600, letterSpacing: '.14em', color: '#77768e', padding: '10px 10px 6px' }}>{it.group}</div>}
                <button
                  onClick={it.run} onMouseEnter={() => setIdx(i)}
                  style={{ width: '100%', height: 46, border: 'none', borderRadius: 11, background: active ? 'color-mix(in oklch, var(--acc,#a77dff) 16%, transparent)' : 'transparent', color: '#fff', display: 'flex', alignItems: 'center', gap: 12, padding: '0 10px', cursor: 'pointer', textAlign: 'start', transition: 'background .12s' }}
                >
                  {it.img && <img src={it.img} alt="" loading="lazy" style={{ width: 56, height: 26, borderRadius: 5, objectFit: 'cover' }} />}
                  {it.Icon && <span style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: it.color }}><it.Icon size={15} /></span>}
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.label}</span>
                  <span style={{ fontSize: 12, color: '#8b8aa3', maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.sub}</span>
                  {active && <CornerDownLeft size={14} className="rtl-flip" style={{ color: 'var(--acc,#a77dff)' }} />}
                </button>
              </div>
            )
          })}
          {items.length === 0 && <div style={{ padding: 36, textAlign: 'center', color: '#8b8aa3', fontSize: 13.5 }}>{t('app.palette.noMatch', { q })}</div>}
        </div>
        <div style={{ display: 'flex', gap: 18, padding: '10px 18px', borderTop: '1px solid rgba(255,255,255,.07)', fontSize: 11.5, color: '#77768e' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><kbd style={kbd}>↑↓</kbd>{t('app.palette.navigate')}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><kbd style={kbd}>↵</kbd>{t('app.palette.open')}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><kbd style={kbd}>Ctrl K</kbd>{t('app.palette.toggle')}</span>
        </div>
      </div>
    </div>
  )
})

export default CommandPalette
