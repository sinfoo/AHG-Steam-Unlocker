import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Search, X, Layers, Download, Minimize2, Maximize2, Trophy, Menu, Columns, Bell, CircleCheck, CircleAlert, Heart, Info } from 'lucide-react'
import { useUIStore } from '../store/uiStore'
import { DARK_COLORS } from '../constants/colors'
import { useSettingsStore } from '../store/settingsStore'
import { useT, type TKey } from '../i18n'

type ColorTokens = typeof DARK_COLORS

interface AppHeaderProps {
  windowWidth: number
  sidebarOverlayOpen: boolean
  setSidebarOverlayOpen: (v: boolean | ((prev: boolean) => boolean)) => void
  currentPage: string
  hideSearchBars: boolean
  searchQuery: string
  setSearchQuery: (q: string) => void
  searchInputRef: React.RefObject<HTMLInputElement | null>
  colors: ColorTokens
  batchMode: boolean
  setBatchMode: (v: boolean) => void
  selectedGames: Set<string>
  handleBatchInstall: () => void
  isFullscreen: boolean
  setShowAchievements: (v: boolean) => void
  userLevel: number
  achievements: Array<{ unlocked: boolean }>
  onOpenPalette: () => void
}

const MONO = "'Geist Mono Variable','Geist Mono',monospace"
const ACC = 'var(--acc, #a77dff)'

const PAGE_META: Record<string, [TKey, TKey | '']> = {
  home: ['app.nav.home', ''],
  browse: ['app.nav.browse', 'app.page.browse.sub'],
  library: ['app.nav.library', 'app.page.library.sub'],
  favourites: ['app.nav.favourites', 'app.page.favourites.sub'],
  recent: ['app.nav.recent', 'app.page.recent.sub'],
  fixes: ['app.nav.fixes', 'app.page.fixes.sub'],
  settings: ['app.nav.settings', 'app.page.settings.sub'],
}

const greetingKey = (): TKey => {
  const h = new Date().getHours()
  return h < 12 ? 'app.greet.morning' : h < 18 ? 'app.greet.afternoon' : 'app.greet.evening'
}

const NOTIF_ICON = { success: [CircleCheck, '#22c55e'], error: [CircleAlert, '#ef4444'], favorites: [Heart, '#ec4899'], info: [Info, '#60a5fa'], achievement: [Trophy, '#f59e0b'] } as const

function timeAgo(t: number, tr: ReturnType<typeof useT>) {
  const m = Math.floor((Date.now() - t) / 60000)
  return m < 1 ? tr('app.time.now') : m < 60 ? tr('app.time.m', { n: m }) : tr('app.time.h', { n: Math.floor(m / 60) })
}

/** Bell + popover listing the last 8 toasts (in-memory history in uiStore). */
function NotificationBell() {
  const t = useT()
  const history = useUIStore(s => s.notifHistory)
  const unread = useUIStore(s => s.notifUnread)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const off = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', off)
    return () => document.removeEventListener('mousedown', off)
  }, [open])
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)} title={t('app.header.notifications')} aria-label={t('app.header.notifications')} aria-expanded={open}
        className="v2-nav" style={{ ...iconBtn(open), position: 'relative' }}
      >
        <Bell size={18} />
        {unread > 0 && (
          <span style={{ position: 'absolute', top: 8, insetInlineEnd: 9, width: 8, height: 8, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 0 2px var(--s1,#0f0f1b)' }}>
            <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#ef4444', animation: 'v2-ping 1.6s ease-out 3' }} />
          </span>
        )}
      </button>
      {open && (
        <div className="v2-glass" style={{ position: 'absolute', top: 52, insetInlineEnd: -9, width: 'min(380px,calc(100vw - 48px))', borderRadius: 18, transformOrigin: 'top right', animation: 'v2-scaleIn .18s var(--ease-out) both', overflow: 'hidden', zIndex: 60 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px 12px' }}>
            <div style={{ fontSize: 15, fontWeight: 650 }}>{t('app.header.notifications')}</div>
            <button onClick={() => useUIStore.getState().markNotifsRead()} style={{ border: 'none', background: 'transparent', color: ACC, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>{t('app.header.markAllRead')}</button>
          </div>
          <div style={{ maxHeight: 380, overflow: 'auto', padding: '0 8px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {history.map((n, i) => {
              const [Icon, color] = NOTIF_ICON[n.type] ?? NOTIF_ICON.info
              return (
                <div key={n.id} style={{ display: 'flex', gap: 12, padding: '12px 10px', borderRadius: 12, animation: 'v2-riseIn .23s var(--ease-out) both', animationDelay: `${i * 30}ms` }}>
                  <div style={{ width: 36, height: 36, flex: 'none', borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `color-mix(in oklch, ${color} 16%, transparent)`, color }}><Icon size={17} /></div>
                  <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: '#d8d7e6', lineHeight: 1.4, alignSelf: 'center' }}>{n.message}</div>
                  <span style={{ fontFamily: MONO, fontSize: 10.5, color: '#77768e', alignSelf: 'center' }}>{timeAgo(n.time, t)}</span>
                </div>
              )
            })}
            {history.length === 0 && <div style={{ padding: 30, textAlign: 'center', color: '#8b8aa3', fontSize: 13 }}>{t('app.header.allCaughtUp')}</div>}
          </div>
        </div>
      )}
    </div>
  )
}

const iconBtn = (on: boolean): React.CSSProperties => ({
  width: 40, height: 40, borderRadius: 12, border: 'none', cursor: 'pointer', flex: 'none',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: on ? `color-mix(in oklch, ${ACC} 16%, transparent)` : 'transparent',
  color: on ? ACC : '#c9c8da',
})

export default function AppHeader({
  windowWidth, sidebarOverlayOpen, setSidebarOverlayOpen, currentPage, hideSearchBars,
  searchQuery, setSearchQuery, searchInputRef, batchMode, setBatchMode, selectedGames,
  handleBatchInstall, isFullscreen, setShowAchievements, userLevel, achievements, onOpenPalette,
}: AppHeaderProps) {
  const t = useT()
  const compactMode = useSettingsStore(s => s.compactMode)
  const setCompactMode = useSettingsStore(s => s.setCompactMode)
  const [titleKey, subKey] = PAGE_META[currentPage] ?? ['', '']
  const title = titleKey ? t(titleKey) : ''
  const sub = subKey ? t(subKey) : ''
  const hasSearch = ['browse', 'favourites', 'recent'].includes(currentPage) && !hideSearchBars
  const unlocked = achievements.filter(a => a.unlocked).length

  return (
    <header
      className="shrink-0 z-30"
      style={{
        margin: '14px 24px 0', height: 58, display: 'flex', alignItems: 'center', gap: 14, paddingInlineStart: 20, paddingInlineEnd: 9,
        borderRadius: 18, background: 'color-mix(in oklch, var(--s1,#0f0f1b) 74%, transparent)',
        border: '1px solid rgba(255,255,255,.08)',
        boxShadow: '0 20px 50px -20px rgba(0,0,0,.8), inset 0 1px 0 rgba(255,255,255,.05)',
        animation: 'v2-shellBar .45s .08s var(--ease-out) both',
      }}
    >
      {windowWidth < 1100 && (
        <button
          onClick={() => setSidebarOverlayOpen(v => !v)}
          aria-label={sidebarOverlayOpen ? t('app.header.closeNav') : t('app.header.openNav')}
          aria-expanded={sidebarOverlayOpen}
          style={iconBtn(sidebarOverlayOpen)}
        >
          <Menu size={18} />
        </button>
      )}

      <div key={currentPage} style={{ minWidth: 150, animation: 'v2-riseIn .25s var(--ease-out) both' }}>
        <div style={{ fontSize: 16, fontWeight: 650, letterSpacing: '-.01em', lineHeight: 1.1 }}>{title}</div>
        <div style={{ fontFamily: MONO, fontSize: 11, color: '#8b8aa3', marginTop: 3 }}>{currentPage === 'home' ? t(greetingKey()) : sub}</div>
      </div>

      {/* Center — page search when the page filters, otherwise opens the palette */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', minWidth: 0 }}>
        {hasSearch ? (
          <div style={{ position: 'relative', width: 'min(460px,100%)', height: 40 }}>
            <Search size={16} style={{ position: 'absolute', insetInlineStart: 14, top: 12, color: searchQuery ? ACC : '#8b8aa3' }} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder={t('app.header.searchPlaceholder')}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%', height: 40, borderRadius: 12, paddingInlineStart: 40, paddingInlineEnd: 38, fontSize: 13.5, color: '#fff', outline: 'none',
                background: 'rgba(0,0,0,.25)', border: `1px solid ${searchQuery ? `color-mix(in oklch, ${ACC} 50%, transparent)` : 'rgba(255,255,255,.08)'}`,
                transition: 'border-color .2s',
              }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} aria-label={t('app.header.clearSearch')} style={{ position: 'absolute', insetInlineEnd: 10, top: 10, border: 'none', background: 'transparent', color: '#8b8aa3', cursor: 'pointer', display: 'flex' }}>
                <X size={16} />
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={onOpenPalette}
            className="v2-nav"
            style={{ width: 'min(460px,100%)', height: 40, borderRadius: 12, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(0,0,0,.25)', color: '#8b8aa3', display: 'flex', alignItems: 'center', gap: 10, paddingInlineStart: 14, paddingInlineEnd: 8, cursor: 'pointer', fontSize: 13.5 }}
          >
            <Search size={16} />
            <span style={{ flex: 1, textAlign: 'start', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t('app.header.searchPalette')}</span>
            <span style={{ display: 'flex', gap: 3 }}><kbd className="v2-kbd">Ctrl</kbd><kbd className="v2-kbd">K</kbd></span>
          </button>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <AnimatePresence>
          {currentPage === 'browse' && (
            <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => setBatchMode(!batchMode)} aria-label={t('app.header.batchToggle')} aria-pressed={batchMode}
                style={{ ...iconBtn(batchMode), width: 'auto', padding: '0 14px', gap: 8, fontSize: 13, fontWeight: 600 }}
              >
                <Layers size={16} /> {t('app.header.batch')}
              </button>
              {batchMode && selectedGames.size > 0 && (
                <button onClick={handleBatchInstall} style={{ height: 40, padding: '0 14px', borderRadius: 12, border: 'none', background: ACC, color: '#0b0614', fontWeight: 650, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <Download size={16} /> {t('app.header.installN', { n: selectedGames.size })}
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {['browse', 'library', 'favourites'].includes(currentPage) && (
          <button
            onClick={() => setCompactMode((prev: boolean) => !prev)}
            aria-label={compactMode ? t('app.header.toNormal') : t('app.header.toCompact')} aria-pressed={compactMode}
            title={compactMode ? t('app.header.normalCards') : t('app.header.compactCards')} className="v2-nav" style={iconBtn(compactMode)}
          >
            <Columns size={18} />
          </button>
        )}

        <NotificationBell />

        <button
          onClick={() => window.electronAPI?.toggleFullscreen?.()}
          aria-label={isFullscreen ? t('app.header.exitFs') : t('app.header.enterFs')} aria-pressed={isFullscreen}
          title={isFullscreen ? t('app.header.exitFs') : t('app.header.fullscreen')} className="v2-nav" style={iconBtn(isFullscreen)}
        >
          {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>

        <button
          onClick={() => setShowAchievements(true)}
          aria-label={t('app.header.achAria', { level: userLevel, done: unlocked, total: achievements.length })}
          className="v2-nav"
          style={{ height: 40, padding: '0 12px', borderRadius: 12, border: 'none', background: 'color-mix(in oklch, #f59e0b 14%, transparent)', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 650 }}
        >
          <Trophy size={17} />
          <span style={{ fontFamily: MONO, fontSize: 12 }}>{unlocked}/{achievements.length}</span>
          <span style={{ fontFamily: MONO, fontSize: 10.5, padding: '1px 6px', borderRadius: 6, background: 'rgba(245,158,11,.2)' }}>L{userLevel}</span>
        </button>
      </div>
    </header>
  )
}
