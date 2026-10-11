import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useVirtualizer, type Virtualizer } from '@tanstack/react-virtual'
import { LayoutGrid, List, type LucideIcon } from 'lucide-react'
import GameCover from './GameCover'
import { IMAGE_TYPES } from '../services/imageCache'
import { getGenreHue } from '../utils/gameHelpers'
import type { Game } from '../types'
import { useT } from '../i18n'

// Shared v2 building blocks for the Library / Favourites / Recent pages.

export const MONO = "'Geist Mono Variable','Geist Mono',monospace"
export const ACC = 'var(--acc,#a77dff)'
const PANEL_BG = 'color-mix(in oklch, var(--s2,#151524) 85%, transparent)'
export const panelStyle: React.CSSProperties = {
  borderRadius: 20, border: '1px solid rgba(255,255,255,.07)', background: PANEL_BG,
}

/** Rise-in animation string that collapses to nothing when reduced motion is on. */
export const rise = (reduced: boolean, dur = '.35s', delay = '0s') =>
  reduced ? undefined : `v2-riseIn ${dur} cubic-bezier(.16,1,.3,1) ${delay} both`

// ── Header card (design: skewed cover collage + glow + icon tile + stat tiles) ──
export function PageBanner({ icon: Icon, color, eyebrow, title, sub, games, stats, reduced, imageTypes = IMAGE_TYPES.PORTRAIT }: {
  imageTypes?: readonly string[]
  icon: LucideIcon; color: string; eyebrow: string; title: string; sub: string
  games: Game[]; stats: { v: string; label: string; color?: string }[]; reduced: boolean
}) {
  const covers = games.slice(0, 4)
  return (
    <header
      className="shrink-0"
      style={{
        position: 'relative', overflow: 'hidden', borderRadius: 24, border: '1px solid rgba(255,255,255,.07)',
        background: 'color-mix(in oklch, var(--s2,#151524) 88%, transparent)',
        padding: 'clamp(22px,3vw,32px)', minHeight: 176, display: 'flex', alignItems: 'flex-end', gap: 24, flexWrap: 'wrap',
        animation: rise(reduced),
      }}
    >
      {covers.length > 0 && (
        <div aria-hidden style={{ position: 'absolute', top: 0, insetInlineEnd: 0, bottom: 0, width: '62%', display: 'flex', gap: 10, padding: 14, transform: 'skewX(-8deg) translateX(40px)', opacity: .55, pointerEvents: 'none' }}>
          {covers.map((g, i) => (
            <div key={g.appid} style={{ flex: 1, borderRadius: 14, overflow: 'hidden', animation: rise(reduced, '.5s', `${0.06 + i * 0.05}s`) }}>
              <div style={{ width: '100%', height: '100%', transform: 'skewX(8deg) scale(1.25)' }}>
                <GameCover appid={g.appid} name={g.name} localHeader={g.header_image || undefined}
                  preferredImageTypes={imageTypes as string[]} genreHue={getGenreHue(g)} webglDisabled className="w-full h-full" />
              </div>
            </div>
          ))}
        </div>
      )}
      <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, var(--s2,#151524) 34%, color-mix(in oklch, var(--s2,#151524) 70%, transparent) 62%, color-mix(in oklch, var(--s2,#151524) 30%, transparent) 100%)', pointerEvents: 'none' }} />
      <div aria-hidden style={{ position: 'absolute', insetInlineStart: -80, top: -120, width: 360, height: 360, borderRadius: '50%', background: `radial-gradient(circle, color-mix(in oklch, ${color} 22%, transparent), transparent 70%)`, pointerEvents: 'none' }} />
      <div style={{ position: 'relative', flex: '1 1 320px', minWidth: 0, display: 'flex', alignItems: 'center', gap: 18 }}>
        <span style={{ width: 58, height: 58, flex: 'none', borderRadius: 17, display: 'flex', alignItems: 'center', justifyContent: 'center', color, background: `color-mix(in oklch, ${color} 18%, transparent)`, border: `1px solid color-mix(in oklch, ${color} 40%, transparent)`, boxShadow: `0 14px 34px -14px ${color}` }}>
          <Icon size={26} />
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, letterSpacing: '.18em', color }}>{eyebrow}</div>
          <h1 style={{ margin: '6px 0 0', fontSize: 'clamp(32px,3.4vw,44px)', fontWeight: 750, letterSpacing: '-.04em', lineHeight: 1, color: '#f3f2fa' }}>{title}</h1>
          <div style={{ fontSize: 14, color: '#c9c8da', marginTop: 8 }}>{sub}</div>
        </div>
      </div>
      <div style={{ position: 'relative', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {stats.map((s, i) => (
          <div key={s.label} style={{ minWidth: 104, padding: '12px 16px', borderRadius: 15, background: 'rgba(8,8,16,.55)', backdropFilter: 'blur(14px)', border: '1px solid rgba(255,255,255,.09)', animation: rise(reduced, '.4s', `${0.08 + i * 0.04}s`) }}>
            <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 600, letterSpacing: '-.03em', color: s.color ?? '#fff' }}>{s.v}</div>
            <div style={{ fontSize: 12, color: '#a6a5bb', marginTop: 2, whiteSpace: 'nowrap' }}>{s.label}</div>
          </div>
        ))}
      </div>
    </header>
  )
}

// ── Empty state ──
export function PageEmpty({ icon: Icon, tint, title, subtitle, action, reduced }: {
  icon: LucideIcon; tint: string; title: string; subtitle: string
  action?: { label: string; onClick: () => void }; reduced: boolean
}) {
  return (
    <div style={{ padding: '80px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center', animation: rise(reduced, '.3s') }}>
      <div style={{ width: 72, height: 72, borderRadius: 22, background: `color-mix(in oklch, ${tint} 14%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: tint, animation: reduced ? undefined : 'v2-floatY 4s ease-in-out infinite' }}>
        <Icon size={30} />
      </div>
      <div style={{ fontSize: 18, fontWeight: 600, color: '#f3f2fa' }}>{title}</div>
      <div style={{ fontSize: 13.5, color: '#8b8aa3' }}>{subtitle}</div>
      {action && (
        <button onClick={action.onClick} className="v2-btn-acc" style={{ marginTop: 6, height: 40, padding: '0 18px', borderRadius: 12, fontSize: 13.5, fontWeight: 650 }}>
          {action.label}
        </button>
      )}
    </div>
  )
}

// ── Grid / list segmented toggle ──
export function ViewToggle({ mode, onChange }: { mode: string; onChange: (m: 'grid' | 'list') => void }) {
  const t = useT()
  return (
    <div role="group" aria-label={t('app.view.mode')} style={{ display: 'flex', gap: 2, padding: 3, borderRadius: 12, background: 'var(--s2,#151524)', border: '1px solid rgba(255,255,255,.08)' }}>
      {([['grid', LayoutGrid, t('app.view.grid'), t('app.view.gridView')], ['list', List, t('app.view.list'), t('app.view.listView')]] as const).map(([id, Icon, label, aria]) => {
        const on = mode === id
        return (
          <button key={id} onClick={() => onChange(id)} aria-label={aria} aria-pressed={on} title={label} className="v2-seg-btn"
            style={{ width: 34, height: 32, border: 'none', borderRadius: 9, background: on ? 'rgba(255,255,255,.1)' : 'transparent', color: on ? '#fff' : '#a6a5bb', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={15} />
          </button>
        )
      })}
    </div>
  )
}

// ── Virtualised grid/list rows (shared by Library / Favourites / Recent grid) ──
const GAP_X = 18
const GAP_Y = 22
const CARD_META_H = 58 // title + meta lines under the 2:3 cover

export function useVirtualGrid(count: number, opts: { grid: boolean; cell?: number; listRow: number; overscan?: number }) {
  const { grid, cell = 172, listRow, overscan = 3 } = opts
  const scrollRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => { for (const e of entries) setWidth(e.contentRect.width) })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const columns = grid ? Math.max(1, Math.floor((width + GAP_X) / (cell + GAP_X))) : 1
  const cardW = columns > 1 ? (width - (columns - 1) * GAP_X) / columns : cell
  const rowHeight = grid ? Math.ceil(cardW * 1.5) + CARD_META_H + GAP_Y : listRow + 8
  const virtualizer = useVirtualizer({
    count: Math.ceil(count / columns),
    getScrollElement: useCallback(() => scrollRef.current, []),
    estimateSize: () => rowHeight,
    overscan,
  })
  return { scrollRef, columns, rowHeight, virtualizer }
}

export function VirtualRows<T>({ items, grid, columns, virtualizer, renderItem }: {
  items: T[]; grid: boolean; columns: number; virtualizer: Virtualizer<HTMLDivElement, Element>
  renderItem: (item: T, index: number) => ReactNode
}) {
  return (
    <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative', width: '100%' }}>
      {virtualizer.getVirtualItems().map(vr => {
        const start = vr.index * columns
        return (
          <div key={vr.key} style={{
            position: 'absolute', top: 0, insetInlineStart: 0, width: '100%', height: `${vr.size}px`,
            transform: `translateY(${vr.start}px)`, contain: 'layout style',
            display: columns > 1 || grid ? 'grid' : 'block',
            gridTemplateColumns: grid ? `repeat(${columns}, minmax(0, 1fr))` : undefined,
            gap: grid ? `0 ${GAP_X}px` : undefined, alignItems: grid ? 'start' : undefined,
          }}>
            {items.slice(start, start + columns).map((it, i) => renderItem(it, start + i))}
          </div>
        )
      })}
    </div>
  )
}
