import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { BadgeCheck, ChevronDown, ChevronsUpDown, Download, PanelLeftClose, PanelLeftOpen, Settings as SettingsIcon, X, Zap } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { DARK_COLORS } from '../constants/colors'
import { useUIStore } from '../store/uiStore'
import { useGameStore, useUserStore } from '../store'
import { steamPortrait, coverFallback } from '../utils/gameHelpers'
import type { Game } from '../types'
import { OfflineIndicator } from './OfflineIndicator'
import { useT } from '../i18n'

interface NavItem {
  id: string
  label: string
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>
  color: string
  count: number
}

interface QuickTool {
  name: string
  desc: string
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>
  color: string
  action: () => void
}

interface SidebarProps {
  navItems: NavItem[]
  quickTools: QuickTool[]
  colors: typeof DARK_COLORS
  navigateTo: (page: string) => void
  onOpenGame: (game: Game) => void
  sidebarCollapsed: boolean
  isOverlay?: boolean
  onCloseOverlay?: () => void
  quickToolsOpen: boolean
  setQuickToolsOpen: (value: boolean | ((prev: boolean) => boolean)) => void
  setUpdateModalOpen: (value: boolean | ((prev: boolean) => boolean)) => void
}

const ACC = 'var(--acc, #a77dff)'
const MONO = "'Geist Mono Variable','Geist Mono',monospace"

const sectionLabel = (open: boolean, text: string) =>
  open ? (
    <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 600, letterSpacing: '.16em', color: '#6f6e86', padding: '14px 10px 6px', flex: 'none' }}>{text}</div>
  ) : (
    <div style={{ height: 1, background: 'rgba(255,255,255,.07)', margin: '10px 8px', flex: 'none' }} />
  )

/* Sub-component isolates the currentPage subscription */
function NavList({ items, navigateTo, open }: { items: NavItem[]; navigateTo: (p: string) => void; open: boolean }) {
  const currentPage = useUIStore(s => s.currentPage)
  return (
    <>
      {items.map(n => {
        const active = currentPage === n.id
        return (
          <button
            key={n.id}
            onClick={() => navigateTo(n.id)}
            title={n.label}
            className="v2-nav"
            style={{
              position: 'relative', height: 42, width: '100%', flex: 'none', border: 'none', borderRadius: 12,
              background: active ? `color-mix(in oklch, ${ACC} 14%, transparent)` : 'transparent',
              color: active ? '#fff' : '#a6a5bb', display: 'flex', alignItems: 'center', gap: 12,
              padding: open ? '0 12px' : 0, justifyContent: open ? 'flex-start' : 'center', cursor: 'pointer',
            }}
          >
            {active && <span style={{ position: 'absolute', insetInlineStart: -12, top: 10, bottom: 10, width: 3, borderStartEndRadius: 3, borderEndEndRadius: 3, background: ACC, boxShadow: `0 0 12px ${ACC}`, animation: 'v2-barIn .3s cubic-bezier(.34,1.56,.64,1) both' }} />}
            <n.icon size={18} style={{ color: active ? ACC : '#8b8aa3', flex: 'none' }} />
            {open && (
              <>
                <span style={{ flex: 1, textAlign: 'start', fontSize: 13.5, fontWeight: active ? 650 : 500, whiteSpace: 'nowrap' }}>{n.label}</span>
                {n.count > 0 && (
                  <span style={{ fontFamily: MONO, fontSize: 11, padding: '2px 7px', borderRadius: 6, background: active ? `color-mix(in oklch, ${ACC} 24%, transparent)` : 'rgba(255,255,255,.06)', color: active ? '#fff' : '#a6a5bb' }}>
                    {n.count > 999 ? `${(n.count / 1000).toFixed(1)}k` : n.count}
                  </span>
                )}
              </>
            )}
          </button>
        )
      })}
    </>
  )
}

/** Up to 5 favourited games (design: PINNED). Own subscriptions so favourite toggles don't re-render the whole sidebar. */
function PinnedList({ open, onOpenGame }: { open: boolean; onOpenGame: (g: Game) => void }) {
  const favorites = useUserStore(s => s.favorites)
  const { games, installedGames } = useGameStore(useShallow(s => ({ games: s.games, installedGames: s.installedGames })))
  const pinned = useMemo(() => {
    if (!favorites.size) return []
    const out: Game[] = []
    // ponytail: linear scan with early exit at 5 hits; memoized on favourites/games identity
    for (const g of games as Game[]) { if (favorites.has(g.appid)) { out.push(g); if (out.length === 5) break } }
    return out
  }, [favorites, games])
  const installedIds = useMemo(() => new Set(installedGames.map((g: any) => g.appid)), [installedGames])
  return (
    <>
      {pinned.map((g, i) => (
        <button
          key={g.appid} onClick={() => onOpenGame(g)} title={g.name} className="v2-nav"
          style={{ height: 46, width: '100%', flex: 'none', border: 'none', borderRadius: 12, background: 'transparent', color: '#c9c8da', display: 'flex', alignItems: 'center', gap: 11, padding: open ? '0 12px' : 0, justifyContent: open ? 'flex-start' : 'center', cursor: 'pointer', animation: 'v2-riseIn .3s both', animationDelay: `${i * 40}ms` }}
        >
          <img src={steamPortrait(g.appid)} onError={e => coverFallback(e, g.appid)} alt="" loading="lazy" decoding="async" style={{ width: 26, height: 36, borderRadius: 6, objectFit: 'cover', flex: 'none', boxShadow: '0 4px 10px rgba(0,0,0,.5)', background: '#151524' }} />
          {open && (
            <>
              <span style={{ flex: 1, minWidth: 0, textAlign: 'start', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.name}</span>
              {installedIds.has(g.appid) && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', flex: 'none' }} />}
            </>
          )}
        </button>
      ))}
    </>
  )
}

function ProfileCard({ open, onUpdates, onSettings }: { open: boolean; onUpdates: () => void; onSettings: () => void }) {
  const t = useT()
  const [menu, setMenu] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!menu) return
    const off = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setMenu(false) }
    document.addEventListener('mousedown', off)
    return () => document.removeEventListener('mousedown', off)
  }, [menu])
  const activated = useUIStore(s => s.isActivated)
  const name = 'AHG Unlocker'
  const status = activated ? t('app.side.licenseActive') : t('app.side.notActivated')
  const items = [
    { label: t('app.side.checkUpdates'), icon: <Download size={16} />, run: onUpdates },
    { label: t('app.nav.settings'), icon: <SettingsIcon size={16} />, run: onSettings },
  ]
  return (
    <div ref={ref} style={{ position: 'relative', marginTop: 6 }}>
      <button
        onClick={() => setMenu(v => !v)} title={name} aria-haspopup="menu" aria-expanded={menu} className="v2-nav"
        style={{ height: 54, width: '100%', borderRadius: 14, border: `1px solid ${menu ? `color-mix(in oklch, ${ACC} 40%, transparent)` : 'rgba(255,255,255,.07)'}`, background: menu ? 'rgba(255,255,255,.06)' : 'rgba(255,255,255,.03)', display: 'flex', alignItems: 'center', gap: 10, padding: open ? '0 10px' : 0, justifyContent: open ? 'flex-start' : 'center', cursor: 'pointer', color: '#fff' }}
      >
        <span style={{ position: 'relative', width: 34, height: 34, flex: 'none', borderRadius: 11, background: `linear-gradient(135deg, ${ACC}, #3b82f6)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: '#0b0614' }}>
          A
          {activated && <span style={{ position: 'absolute', insetInlineEnd: -2, bottom: -2, width: 10, height: 10, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 0 2px var(--s1,#0f0f1b)' }} />}
        </span>
        {open && (
          <>
            <div style={{ flex: 1, minWidth: 0, textAlign: 'start' }}>
              <div style={{ fontSize: 13, fontWeight: 650, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
              <div style={{ fontFamily: MONO, fontSize: 10.5, color: activated ? '#4ade80' : '#8b8aa3', marginTop: 2 }}>{status}</div>
            </div>
            <ChevronsUpDown size={14} style={{ color: '#8b8aa3', flex: 'none' }} />
          </>
        )}
      </button>
      {menu && (
        <div role="menu" className="v2-glass" style={{ position: 'absolute', bottom: 62, insetInlineStart: 0, width: 272, borderRadius: 18, transformOrigin: 'bottom left', animation: 'v2-scaleIn .22s var(--ease-out) both', padding: 8, zIndex: 50 }}>
          <div style={{ margin: '4px 4px 8px', padding: '10px 12px', borderRadius: 12, background: `color-mix(in oklch, ${ACC} 12%, transparent)`, border: `1px solid color-mix(in oklch, ${ACC} 28%, transparent)`, display: 'flex', alignItems: 'center', gap: 10 }}>
            <BadgeCheck size={17} style={{ color: ACC }} />
            <div style={{ flex: 1, fontSize: 12.5 }}>
              <div style={{ fontWeight: 600 }}>{status}</div>
              <div style={{ color: '#a6a5bb', fontFamily: MONO, fontSize: 11, marginTop: 1 }}>{name}</div>
            </div>
          </div>
          {items.map((it, i) => (
            <div key={it.label}>
              {i === 1 && <div style={{ height: 1, background: 'rgba(255,255,255,.07)', margin: '6px 8px' }} />}
              <button role="menuitem" onClick={() => { setMenu(false); it.run() }} className="v2-nav" style={{ width: '100%', height: 40, border: 'none', background: 'transparent', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12, padding: '0 10px', color: '#c9c8da', fontSize: 13.5, cursor: 'pointer' }}>
                <span style={{ opacity: .85, display: 'flex' }}>{it.icon}</span><span style={{ flex: 1, textAlign: 'start' }}>{it.label}</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const footBtn = (open: boolean): React.CSSProperties => ({
  height: 40, width: '100%', border: 'none', borderRadius: 12, background: 'transparent', color: '#8b8aa3',
  display: 'flex', alignItems: 'center', gap: 12, padding: open ? '0 12px' : 0,
  justifyContent: open ? 'flex-start' : 'center', cursor: 'pointer',
})

const Sidebar = memo(function Sidebar({
  navItems, quickTools, navigateTo, onOpenGame, sidebarCollapsed, isOverlay, onCloseOverlay,
  quickToolsOpen, setQuickToolsOpen, setUpdateModalOpen,
}: SidebarProps) {
  const t = useT()
  const [manual, setManual] = useState(() => {
    try { return localStorage.getItem('ahg.sideCollapsed') === '1' } catch { return false }
  })
  const open = !(sidebarCollapsed || manual)
  const toggle = () => setManual(v => {
    try { localStorage.setItem('ahg.sideCollapsed', v ? '0' : '1') } catch { /* ignore */ }
    return !v
  })
  const byId = (ids: string[]) => ids.map(id => navItems.find(n => n.id === id)).filter((n): n is NavItem => !!n)
  const discover = byId(['home', 'browse', 'fixes'])
  const mine = byId(['library', 'favourites', 'recent'])
  const settings = navItems.find(n => n.id === 'settings')

  return (
    <nav
      className={isOverlay ? 'fixed top-0 z-50 h-screen' : 'relative z-40'}
      style={{
        width: open ? 264 : 72, flex: 'none', display: 'flex', flexDirection: 'column', padding: '14px 12px 12px',
        background: 'linear-gradient(180deg, var(--s1,#0f0f1b), color-mix(in oklch, var(--s1,#0f0f1b) 80%, #000))',
        borderInlineEnd: '1px solid rgba(255,255,255,.06)', insetInlineStart: isOverlay ? 0 : undefined, transition: 'width .32s var(--ease-out)',
        animation: 'v2-shellRail .4s var(--ease-out) both', boxShadow: isOverlay ? '8px 0 60px rgba(0,0,0,.6)' : undefined,
      }}
    >
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, height: 44, padding: '0 4px', flex: 'none', justifyContent: open ? 'flex-start' : 'center' }}>
        <button onClick={() => navigateTo('home')} title={t('app.nav.home')} className="hv-scale-08" style={{ flex: 'none', width: 38, height: 38, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}>
          <img src="./assets/ahg-logo.png" alt="AHG" style={{ width: 38, height: 38, objectFit: 'contain', display: 'block' }} />
        </button>
        {open && (
          <div style={{ flex: 1, minWidth: 0, animation: 'v2-fadeIn .25s both' }}>
            <div style={{ fontSize: 17, fontWeight: 750, letterSpacing: '-.02em', lineHeight: 1 }}>AHG</div>
            <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '.26em', color: ACC, marginTop: 4 }}>UNLOCKER</div>
          </div>
        )}
        {isOverlay && onCloseOverlay && (
          <button onClick={onCloseOverlay} aria-label={t('app.side.closeMenu')} style={{ border: 'none', background: 'transparent', color: '#8b8aa3', cursor: 'pointer' }}><X size={16} /></button>
        )}
      </div>

      {/* Nav */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'none', display: 'flex', flexDirection: 'column', gap: 2, margin: '8px -12px 0', padding: '0 12px' }}>
        {sectionLabel(open, t('app.side.discover'))}
        <NavList items={discover} navigateTo={navigateTo} open={open} />
        {sectionLabel(open, t('app.side.yourGames'))}
        <NavList items={mine} navigateTo={navigateTo} open={open} />

        {open ? (
          <div style={{ display: 'flex', alignItems: 'center', padding: '16px 10px 6px', flex: 'none' }}>
            <span style={{ flex: 1, fontFamily: MONO, fontSize: 10, fontWeight: 600, letterSpacing: '.16em', color: '#6f6e86' }}>{t('app.side.pinned')}</span>
            <button onClick={() => navigateTo('favourites')} className="v2-nav" style={{ border: 'none', background: 'transparent', color: '#77768e', fontSize: 11, cursor: 'pointer', padding: '0 4px', borderRadius: 6 }}>{t('app.side.seeAll')}</button>
          </div>
        ) : (
          <div style={{ height: 1, background: 'rgba(255,255,255,.07)', margin: '10px 8px', flex: 'none' }} />
        )}
        <PinnedList open={open} onOpenGame={onOpenGame} />

        {sectionLabel(open, t('app.side.tools'))}
        <button
          onClick={() => { if (!open) toggle(); setQuickToolsOpen(o => !o) }}
          title={t('app.side.ahgTools')} className="v2-nav"
          style={{ ...footBtn(open), height: 42, color: '#a6a5bb', flex: 'none', background: quickToolsOpen && open ? 'rgba(255,255,255,.04)' : 'transparent' }}
        >
          <Zap size={18} style={{ color: '#8b8aa3', flex: 'none' }} />
          {open && (<><span style={{ flex: 1, textAlign: 'start', fontSize: 13.5, fontWeight: 500 }}>{t('app.side.ahgTools')}</span><ChevronDown size={14} style={{ transition: 'transform .2s', transform: quickToolsOpen ? 'rotate(180deg)' : 'none' }} /></>)}
        </button>
        {open && quickToolsOpen && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, paddingInlineStart: 12, borderInlineStart: '1px solid rgba(255,255,255,.07)', marginInlineStart: 20, animation: 'v2-fadeIn .2s both' }}>
            {quickTools.slice(0, 8).map((q, i) => (
              <button key={q.name} title={q.desc} onClick={() => { q.action(); setQuickToolsOpen(false) }} className="v2-nav"
                style={{ height: 36, border: 'none', borderRadius: 9, background: 'transparent', color: '#a6a5bb', display: 'flex', alignItems: 'center', gap: 10, padding: '0 10px', cursor: 'pointer', fontSize: 13, animation: 'v2-riseIn .3s both', animationDelay: `${i * 30}ms` }}>
                <q.icon size={15} style={{ color: q.color, flex: 'none' }} />
                <span style={{ flex: 1, textAlign: 'start', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{q.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 10, marginTop: 6, borderTop: '1px solid rgba(255,255,255,.06)' }}>
        <OfflineIndicator collapsed={!open} />
        {settings && <NavList items={[settings]} navigateTo={navigateTo} open={open} />}
        {!isOverlay && (
          <button onClick={toggle} title={open ? t('app.side.collapse') : t('app.side.expand')} className="v2-nav" style={footBtn(open)}>
            {open ? <PanelLeftClose size={17} className="rtl-flip" /> : <PanelLeftOpen size={17} className="rtl-flip" />}{open && <span style={{ flex: 1, textAlign: 'start', fontSize: 13 }}>{t('app.side.collapse')}</span>}
          </button>
        )}
        <ProfileCard
          open={open}
          onUpdates={() => setUpdateModalOpen(true)}
          onSettings={() => navigateTo('settings')}
        />
      </div>
    </nav>
  )
})

Sidebar.displayName = 'Sidebar'
export { Sidebar }
