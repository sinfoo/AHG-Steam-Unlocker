import { useState, useEffect, useMemo, memo } from 'react'
import {
  Settings, Palette, Zap, HardDrive, Info, Gamepad2,
  LayoutGrid, List,
  RotateCw, RefreshCw, FolderOpen, Trash2, Search, Eye, Check, MessageCircle, ScrollText,
} from 'lucide-react'
import { useSettingsStore } from '../store/settingsStore'
import { useGameStore } from '../store'
import { useUIStore } from '../store/uiStore'
import { PageBanner } from '../components/PageParts'
import { useShallow } from 'zustand/react/shallow'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, X, AlertTriangle } from 'lucide-react'
import { useT, useLangStore, LANGUAGES, type TKey } from '../i18n'

const EASE = 'cubic-bezier(.16,1,.3,1)'
const MONO = "'Geist Mono Variable','Geist Mono',monospace"
const ACC = 'var(--acc,#a77dff)'
const mix = (n: number) => `color-mix(in oklch, ${ACC} ${n}%, transparent)`

// accent keys are COLORS keys (settingsStore.accentColor)
const ACCENTS: [string, TKey][] = [['violet', 'ui.settings.accent.violet'], ['blue', 'ui.settings.accent.blue'], ['green', 'ui.settings.accent.green'], ['pink', 'ui.settings.accent.pink'], ['amber', 'ui.settings.accent.amber']]

const TABS: { id: string; label: TKey; icon: any }[] = [
  { id: 'general', label: 'ui.settings.tab.general', icon: Settings },
  { id: 'appearance', label: 'ui.settings.tab.appearance', icon: Palette },
  { id: 'performance', label: 'ui.settings.tab.performance', icon: Zap },
  { id: 'steam', label: 'ui.settings.tab.tools', icon: HardDrive },
  { id: 'about', label: 'ui.settings.tab.about', icon: Info },
]

// ── Settings Page ──
const SettingsPage = memo(function SettingsPage({ colors, accentColor, setAccentColor, pureBlack, setPureBlack, reducedMotion, setReducedMotion, soundEnabled, setSoundEnabled, viewMode, setViewMode, compactMode, setCompactMode, games, installedGames, favorites, recentGames, showToast, bridge }: any) {
  const t = useT()
  const lang = useLangStore(s => s.lang)
  const setLang = useLangStore(s => s.setLang)
  const [activeTab, setActiveTab] = useState('general')

  const [appVersion, setAppVersion] = useState(__APP_VERSION__)
  const [cacheSize, setCacheSize] = useState('0 MB')
  const [customSteamPath, setCustomSteamPath] = useState('')
  const [customDepotCachePath, setCustomDepotCachePath] = useState('')
  const [customStPluginPath, setCustomStPluginPath] = useState('')
  // ── Store-bound settings ──
  const { hideSearchBars, showOnlyOwned } = useSettingsStore(
    useShallow(s => ({ hideSearchBars: s.hideSearchBars, showOnlyOwned: s.showOnlyOwned }))
  )
  const { notifications, autoUpdates } = useSettingsStore(useShallow(s => ({ notifications: s.notifications, autoUpdates: s.autoUpdates })))
  const setNotifications = useSettingsStore(s => s.setNotifications)
  const setAutoUpdates = useSettingsStore(s => s.setAutoUpdates)
  const setHideSearchBars = useSettingsStore(s => s.setHideSearchBars)
  const setShowOnlyOwned = useSettingsStore(s => s.setShowOnlyOwned)

  const rm = !!reducedMotion
  const rise = (delay = 0) => (rm ? undefined : `v2-riseIn .35s ${delay}ms ${EASE} both`)

  const [mode, setMode] = useState<UnlockModeStatus | null>(null)
  const [sw, setSw] = useState<ModeSwitch | null>(null)
  const refreshMode = () => { bridge.getUnlockMode?.().then((m: UnlockModeStatus | null) => m && setMode(m)) }
  useEffect(() => { if (activeTab === 'steam') refreshMode() }, [activeTab])
  const applyMode = async (m: string, reinstall = false) => {
    if (sw?.state === 'running') return
    setSw({ target: m, steps: [], state: 'running' })
    const off = bridge.onUnlockModeProgress((step: string) => setSw(p => p && ({ ...p, steps: [...p.steps, step] })))
    const r = await bridge.setUnlockMode(m, reinstall)
    off()
    setSw(p => p && ({ ...p, state: r.success ? 'done' : 'error', error: r.message }))
    refreshMode()
  }

  useEffect(() => {
    window.electronAPI?.getCustomSteamConfig?.().then((cfg: any) => {
      if (cfg) {
        if (cfg.steamPath) setCustomSteamPath(cfg.steamPath)
        if (cfg.depotCachePath) setCustomDepotCachePath(cfg.depotCachePath)
        if (cfg.stPluginPath) setCustomStPluginPath(cfg.stPluginPath)
      }
    })
    bridge?.getAppVersion?.().then(setAppVersion).catch(() => {})
  }, [])

  const tabIdx = Math.max(0, TABS.findIndex(x => x.id === activeTab))
  const tab = TABS[tabIdx]!

  const bannerGames = useMemo(() => (games as any[]).filter(g => g.header_image).slice(0, 4), [games])

  const pathItems = [
    { label: t('ui.settings.path.steam'), desc: t('ui.settings.path.steamDesc'), value: customSteamPath, fallback: t('ui.settings.path.steamDef'), key: 'steamPath', browseKey: 'steam' },
    { label: t('ui.settings.path.depot'), desc: t('ui.settings.path.depotDesc'), value: customDepotCachePath, fallback: t('ui.settings.path.depotDef'), key: 'depotCachePath', browseKey: 'manifests' },
    { label: t('ui.settings.path.plugin'), desc: t('ui.settings.path.pluginDesc'), value: customStPluginPath, fallback: t('ui.settings.path.pluginDef'), key: 'stPluginPath', browseKey: 'lua' },
  ]

  const quickTools = [
    { label: t('ui.settings.tool.fixNoGames'), desc: t('ui.settings.tool.fixNoGamesDesc'), icon: Gamepad2, btn: t('ui.settings.btn.run'), action: () => { bridge.fixNoGames?.().then((r: any) => showToast(r?.success ? t('ui.settings.toast.fixed') : r?.message, r?.success ? 'success' : 'error')); } },
    { label: t('ui.settings.tool.script'), desc: t('ui.settings.tool.scriptDesc'), icon: Eye, btn: t('ui.settings.btn.run'), action: () => { bridge.fixGamesNotShowing?.().then((r: any) => showToast(r?.success ? t('ui.settings.toast.done') : r?.message, r?.success ? 'success' : 'error')); } },
    { label: t('ui.settings.btn.clearCache'), desc: t('ui.settings.tool.clearDesc'), icon: Trash2, btn: t('ui.settings.btn.clear'), danger: true, action: () => bridge.clearCache?.().then((r: any) => showToast(r?.success ? t('ui.settings.toast.cleared') : r?.message, r?.success ? 'success' : 'error')) },
    { label: t('ui.settings.tool.scan'), desc: t('ui.settings.tool.scanDesc'), icon: Search, btn: t('ui.settings.btn.scan'), action: () => { bridge.scanNewManifests?.().then((r: any) => showToast(r?.success ? t('ui.settings.toast.scanDone') : r?.message, r?.success ? 'success' : 'error')); } },
    { label: t('ui.settings.tool.update'), desc: t('ui.settings.tool.updateDesc'), icon: RefreshCw, btn: t('ui.settings.btn.check'), action: () => { bridge.checkForUpdates?.().then((r: any) => {
      if (!r?.success) { showToast(r?.message || t('ui.settings.toast.updateFail'), 'error'); return; }
      // r.success only means the check itself worked — branch on hasUpdate.
      showToast(r.hasUpdate ? t('ui.settings.toast.updateAvail', { v: r.latestVersion }) : t('ui.settings.toast.upToDate'), r.hasUpdate ? 'info' : 'success');
    }); } },
  ]

  const browse = async (item: typeof pathItems[number]) => {
    const p = await window.electronAPI?.browsePath?.(item.browseKey)
    if (p) {
      if (item.key === 'steamPath') setCustomSteamPath(p)
      else if (item.key === 'depotCachePath') setCustomDepotCachePath(p)
      else if (item.key === 'stPluginPath') setCustomStPluginPath(p)
      const cfg = await window.electronAPI?.getCustomSteamConfig?.() || {}
      await window.electronAPI?.saveCustomSteamConfig?.({ ...cfg, [item.key]: p })
      showToast(t('ui.settings.toast.pathUpdated', { name: item.label }), 'success')
    }
  }

  return (
    <div style={{ padding: 24, width: '100%', maxWidth: 1680, margin: '0 auto', fontFamily: 'Geist, sans-serif', color: '#f3f2fa' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <PageBanner icon={Settings} color="#c9c8da" eyebrow={t('ui.settings.eyebrow')} title={t('ui.settings.title')} sub={t('ui.settings.subtitle')}
          games={bannerGames} stats={[{ v: `v${appVersion}`, label: t('app.set.version') }]} reduced={rm} />

        <div style={{ display: 'grid', gridTemplateColumns: '220px minmax(0,1fr)', gap: 28, alignItems: 'start' }}>
          {/* Tabs */}
          <div role="tablist" style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 4, animation: rise(20) }}>
            <span style={{ position: 'absolute', insetInlineStart: 0, insetInlineEnd: 0, top: 0, height: 42, borderRadius: 12, background: mix(14), border: `1px solid ${mix(32)}`, transform: `translateY(${tabIdx * 46}px)`, transition: rm ? 'none' : 'transform .45s cubic-bezier(.34,1.4,.5,1)' }} />
            {TABS.map(tb => (
              <button key={tb.id} role="tab" aria-selected={activeTab === tb.id} onClick={() => setActiveTab(tb.id)} className="v2-ctl"
                style={{ position: 'relative', height: 42, border: 'none', background: 'transparent', borderRadius: 12, color: activeTab === tb.id ? '#fff' : '#a6a5bb', fontSize: 13.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 12, padding: '0 14px', cursor: 'pointer', textAlign: 'start', fontFamily: 'inherit' }}>
                <tb.icon size={16} />{t(tb.label)}
              </button>
            ))}
          </div>

          {/* Panel */}
          <div key={tab.id} style={{ borderRadius: 22, background: 'color-mix(in oklch, var(--s2,#151524) 85%, transparent)', border: '1px solid rgba(255,255,255,.07)', padding: '8px 24px', animation: rise(40) }}>
            {activeTab === 'general' && (
              <>
                <Row rm={rm} i={0} label={t('ui.settings.notif')} desc={t('ui.settings.notifDesc')}><Switch value={notifications} onChange={setNotifications} rm={rm} /></Row>
                <Row rm={rm} i={1} label={t('ui.settings.autoUpdate')} desc={t('ui.settings.autoUpdateDesc')}><Switch value={autoUpdates} onChange={setAutoUpdates} rm={rm} /></Row>
                <Row rm={rm} i={2} label={t('ui.settings.sound')} desc={t('ui.settings.soundDesc')}><Switch value={soundEnabled} onChange={setSoundEnabled} rm={rm} /></Row>
                <Row rm={rm} i={3} label={t('ui.settings.hideSearch')} desc={t('ui.settings.hideSearchDesc')}><Switch value={hideSearchBars} onChange={setHideSearchBars} rm={rm} /></Row>
                <Row rm={rm} i={4} label={t('ui.settings.onlyOwned')} desc={t('ui.settings.onlyOwnedDesc')}><Switch value={showOnlyOwned} onChange={setShowOnlyOwned} rm={rm} /></Row>
                <Row rm={rm} i={5} stack label={t('settings.language')} desc={t('settings.languageDesc')}>
                  <div role="radiogroup" aria-label={t('settings.language')} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 8, width: '100%' }}>
                    {LANGUAGES.map(l => {
                      const on = lang === l.code
                      return (
                        <button key={l.code} role="radio" aria-checked={on} lang={l.code} dir={l.dir} onClick={() => setLang(l.code)} className="v2-seg-btn"
                          style={{ height: 38, padding: '0 14px', borderRadius: 11, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 13, fontWeight: 600, fontFamily: 'inherit', background: on ? mix(18) : 'rgba(0,0,0,.25)', color: on ? '#fff' : '#a6a5bb', boxShadow: on ? `inset 0 0 0 1px ${mix(46)}` : 'inset 0 0 0 1px rgba(255,255,255,.08)' }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.label}</span>
                          {on && <Check size={14} color={ACC} />}
                        </button>
                      )
                    })}
                  </div>
                </Row>
              </>
            )}

            {activeTab === 'appearance' && (
              <>
                <Row rm={rm} i={0} label={t('ui.settings.accent')} desc={t('ui.settings.accentDesc')}>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {ACCENTS.map(([key, nameKey]) => {
                      const name = t(nameKey)
                      const hex = colors?.[key] as string
                      const active = accentColor === key
                      return (
                        <button key={key} title={name} aria-label={name} aria-pressed={active} onClick={() => setAccentColor?.(key)}
                          style={{ width: 32, height: 32, borderRadius: '50%', border: `2px solid ${active ? '#fff' : 'transparent'}`, background: hex, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, transition: 'transform .2s cubic-bezier(.34,1.56,.64,1)', boxShadow: '0 0 0 3px var(--s2,#151524) inset' }}
                          onMouseEnter={e => { if (!rm) e.currentTarget.style.transform = 'scale(1.12)' }}
                          onMouseLeave={e => { e.currentTarget.style.transform = 'none' }}>
                          {active && <Check size={14} color="#0b0614" style={{ animation: rm ? undefined : 'v2-checkPop .18s both' }} />}
                        </button>
                      )
                    })}
                  </div>
                </Row>
                <Row rm={rm} i={1} label={t('ui.settings.pureBlack')} desc={t('ui.settings.pureBlackDesc')}><Switch value={!!pureBlack} onChange={setPureBlack} rm={rm} /></Row>
                <Row rm={rm} i={2} label={t('ui.settings.compact')} desc={t('ui.settings.compactDesc')}><Switch value={compactMode} onChange={setCompactMode} rm={rm} /></Row>
                <Row rm={rm} i={3} label={t('ui.settings.view')} desc={t('ui.settings.viewDesc')}>
                  <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 12, background: 'rgba(0,0,0,.25)', border: '1px solid rgba(255,255,255,.08)' }}>
                    {(['grid', 'list'] as const).map(mode => {
                      const on = viewMode === mode
                      return (
                        <button key={mode} onClick={() => setViewMode(mode as any)} className="v2-seg-btn"
                          style={{ height: 32, padding: '0 14px', borderRadius: 9, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 600, textTransform: 'capitalize', fontFamily: 'inherit', background: on ? mix(18) : 'transparent', color: on ? '#fff' : '#a6a5bb', boxShadow: on ? `inset 0 0 0 1px ${mix(36)}` : 'none' }}>
                          {mode === 'grid' ? <LayoutGrid size={14} /> : <List size={14} />}{t(mode === 'grid' ? 'ui.settings.view.grid' : 'ui.settings.view.list')}
                        </button>
                      )
                    })}
                  </div>
                </Row>
              </>
            )}

            {activeTab === 'performance' && (
              <>
                <Row rm={rm} i={0} label={t('ui.settings.reduced')} desc={t('ui.settings.reducedDesc')}><Switch value={!!reducedMotion} onChange={setReducedMotion} rm={rm} /></Row>
                <Row rm={rm} i={1} label={t('ui.settings.imgCache')} desc={t('ui.settings.imgCacheDesc', { size: cacheSize })}>
                  <ActBtn danger icon={Trash2} label={t('ui.settings.btn.clearCache')} onClick={() => {
                    bridge.clearCache?.().then((r: any) => {
                      if (r?.success) {
                        showToast(t('ui.settings.toast.cacheCleared'), 'success')
                        setCacheSize('0 MB')
                      }
                    })
                  }} />
                </Row>
              </>
            )}

            {activeTab === 'steam' && (
              <>
                {(['steamtools', 'bst', 'custom'] as const).map((id, i) => {
                  const active = mode?.mode === id
                  const bst = id === 'bst'
                  const desc = bst
                    ? (!mode ? '' : !mode.installed ? t('ui.mode.notInstalled') : mode.updateAvailable ? t('ui.mode.update') : t('ui.mode.upToDate'))
                    : t(`ui.mode.${id}Desc` as TKey)
                  return (
                    <Row key={id} rm={rm} i={i} label={`${t(`ui.mode.${id}` as TKey)}${active ? ' • ' + t('ui.mode.active') : ''}`} desc={desc}>
                      {active && bst
                        ? <ActBtn icon={RefreshCw} label={mode?.updateAvailable ? t('ui.mode.updateBtn') : t('ui.mode.reinstall')} onClick={() => applyMode(id, true)} />
                        : !active && <ActBtn icon={Zap} label={t('ui.mode.switch')} onClick={() => applyMode(id)} />}
                    </Row>
                  )
                })}
                {pathItems.map((item, i) => (
                  <Row key={item.key} rm={rm} i={i} label={item.label} desc={item.desc}>
                    <div style={{ display: 'flex', gap: 8, width: 'min(420px,52%)', minWidth: 0 }}>
                      <input readOnly value={item.value || item.fallback} title={item.value || item.fallback}
                        style={{ flex: 1, minWidth: 0, height: 38, borderRadius: 10, border: '1px solid rgba(255,255,255,.09)', background: 'rgba(0,0,0,.25)', color: '#c9c8da', font: `12px ${MONO}`, padding: '0 12px', outline: 'none' }} />
                      <ActBtn icon={FolderOpen} label={t('ui.settings.btn.browse')} small onClick={() => browse(item)} />
                    </div>
                  </Row>
                ))}
                <Row rm={rm} i={3} label={t('ui.settings.restartSteam')} desc={t('ui.settings.restartSteamDesc')}><ActBtn icon={RotateCw} label={t('ui.settings.btn.restart')} onClick={() => window.electronAPI?.restartSteam?.()} /></Row>
                <Row rm={rm} i={4} label={t('ui.settings.refresh')} desc={t('ui.settings.refreshDesc')}><ActBtn icon={RefreshCw} label={t('ui.settings.btn.refresh')} onClick={async () => {
                  showToast(t('ui.settings.toast.refreshing'), 'info')
                  try {
                    const g = await bridge.loadGames?.(true)
                    if (Array.isArray(g) && g.length > 0) {
                      useGameStore.getState().setGames(g)
                      showToast(t('ui.settings.toast.refreshed', { n: g.length.toLocaleString() }), 'success')
                    } else {
                      showToast(t('ui.settings.toast.refreshEmpty'), 'error')
                    }
                  } catch (e: any) {
                    showToast(t('ui.settings.toast.refreshFail', { err: e?.message || e }), 'error')
                  }
                }} /></Row>
                <Row rm={rm} i={5} label={t('ui.settings.openSteam')} desc={t('ui.settings.openSteamDesc')}><ActBtn icon={FolderOpen} label={t('ui.settings.btn.open')} onClick={() => window.electronAPI?.openSteamFolder?.()} /></Row>
                <Row rm={rm} i={6} label={t('ui.settings.resetPaths')} desc={t('ui.settings.resetPathsDesc')}>
                  <ActBtn danger icon={RotateCw} label={t('ui.settings.btn.reset')} onClick={async () => {
                    setCustomSteamPath('')
                    setCustomDepotCachePath('')
                    setCustomStPluginPath('')
                    await window.electronAPI?.saveCustomSteamConfig?.({})
                    showToast(t('ui.settings.toast.pathsReset'), 'info')
                  }} />
                </Row>
                {quickTools.map((tool, i) => (
                  <Row key={tool.label} rm={rm} i={7 + i} label={tool.label} desc={tool.desc}>
                    <ActBtn danger={tool.danger} icon={tool.icon} label={tool.btn} onClick={tool.action} />
                  </Row>
                ))}
              </>
            )}

            {activeTab === 'about' && (
              <>
                <Row rm={rm} i={0} label={t('ui.settings.tool.update')} desc={t('app.set.updatesDesc', { v: appVersion })}>
                  <ActBtn icon={RefreshCw} label={t('ui.settings.tool.update')} onClick={quickTools[4]!.action} />
                </Row>
                <Row rm={rm} i={1} label={t('app.set.changelog')} desc={t('app.set.changelogDesc')}>
                  <ActBtn icon={ScrollText} label={t('ui.settings.btn.open')} onClick={() => useUIStore.getState().setChangelogOpen(true)} />
                </Row>
                <Row rm={rm} i={2} label={t('ui.settings.about.community')} desc={t('ui.settings.about.communityDesc')}>
                  <a href="https://discord.gg/ahg" target="_blank" rel="noreferrer" className="v2-ctl"
                    style={{ height: 38, padding: '0 16px', borderRadius: 11, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.05)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', flex: 'none' }}>
                    <MessageCircle size={14} />{t('ui.settings.about.join')}
                  </a>
                </Row>
                <div style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '22px 0 18px' }}>
                  <img src="./assets/ahg-logo.png" alt="" style={{ width: 72, height: 72, objectFit: 'contain', animation: rm ? undefined : 'v2-floatY 5s ease-in-out infinite', filter: `drop-shadow(0 10px 24px ${mix(55)})` }} />
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.02em' }}>AHG Unlocker</div>
                    <div style={{ fontFamily: MONO, fontSize: 12, color: '#a6a5bb', marginTop: 4 }}>{t('ui.settings.about.version', { v: appVersion })}</div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      <ModeSwitchModal sw={sw} onClose={() => setSw(null)} />
    </div>
  )
})

type ModeSwitch = { target: string; steps: string[]; state: 'running' | 'done' | 'error'; error?: string }

// Live status of an unlock-mode switch; steps arrive from main via 'unlock-mode-progress'.
function ModeSwitchModal({ sw, onClose }: { sw: ModeSwitch | null; onClose: () => void }) {
  const t = useT()
  const name = sw ? t(`ui.mode.${sw.target}` as TKey) : ''
  const running = sw?.state === 'running'
  return (
    <AnimatePresence>
      {sw && (
        <motion.div key="ms" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
          onClick={() => !running && onClose()}
          style={{ position: 'fixed', inset: 0, zIndex: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(4,4,10,.62)', backdropFilter: 'blur(10px)' }}>
          <motion.div role="dialog" aria-modal="true" aria-live="polite" onClick={e => e.stopPropagation()}
            initial={{ scale: 0.94, opacity: 0, y: 16 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.94, opacity: 0, y: 16 }}
            transition={{ type: 'spring', damping: 24, stiffness: 340 }}
            style={{ width: 'min(400px,100%)', borderRadius: 20, background: '#0f0f1b', border: '1px solid rgba(255,255,255,.08)', boxShadow: `0 30px 80px rgba(0,0,0,.55), 0 0 0 1px ${mix(18)}`, padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: sw.steps.length ? 18 : 0 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center', flex: 'none',
                background: sw.state === 'error' ? 'rgba(239,68,68,.14)' : mix(16), color: sw.state === 'error' ? '#fca5a5' : ACC }}>
                {running ? <Loader2 size={18} className="animate-spin" /> : sw.state === 'done' ? <Check size={18} /> : <AlertTriangle size={18} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15.5, fontWeight: 700 }}>
                  {running ? t('ui.mode.switching', { m: name }) : sw.state === 'done' ? t('ui.mode.doneTitle', { m: name }) : t('ui.mode.failTitle')}
                </div>
                {sw.state === 'error' && <div style={{ fontSize: 12.5, color: '#fca5a5', marginTop: 3 }}>{sw.error}</div>}
              </div>
              {!running && <button aria-label={t('ui.mode.close')} onClick={onClose} className="v2-ctl"
                style={{ width: 32, height: 32, borderRadius: 9, border: 'none', background: 'rgba(255,255,255,.06)', color: '#c9c8da', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><X size={15} /></button>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {sw.steps.map((step, i) => {
                const last = i === sw.steps.length - 1
                const current = running && last
                const failed = sw.state === 'error' && last
                return (
                  <motion.div key={step + i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.08, ease: [0.4, 0, 0.2, 1] }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: current ? '#fff' : '#a6a5bb' }}>
                    <span style={{ width: 18, display: 'grid', placeItems: 'center', color: failed ? '#fca5a5' : current ? ACC : '#4ade80' }}>
                      {current ? <Loader2 size={14} className="animate-spin" /> : failed ? <X size={14} /> : <Check size={14} />}
                    </span>
                    {t(`ui.mode.step.${step}` as TKey)}
                  </motion.div>
                )
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Row({ label, desc, children, i, rm, stack }: { label: string; desc: string; children: React.ReactNode; i: number; rm: boolean; stack?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: stack ? 'column' : 'row', alignItems: stack ? 'stretch' : 'center', gap: stack ? 14 : 20, padding: '18px 0', borderBottom: '1px solid rgba(255,255,255,.06)', animation: rm ? undefined : `v2-riseIn .25s ${i * 20}ms ${EASE} both` }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 12.5, color: '#8b8aa3', marginTop: 3, lineHeight: 1.45 }}>{desc}</div>
      </div>
      {children}
    </div>
  )
}

function Switch({ value, onChange, rm }: { value: boolean; onChange: (v: boolean) => void; rm: boolean }) {
  return (
    <button role="switch" aria-checked={value} onClick={() => onChange(!value)}
      style={{ position: 'relative', width: 44, height: 26, flex: 'none', borderRadius: 13, border: 'none', cursor: 'pointer', background: value ? ACC : 'rgba(255,255,255,.14)', transition: rm ? 'none' : 'background .25s', padding: 0 }}>
      <span style={{ position: 'absolute', top: 3, insetInlineStart: 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,.4)', transform: `translateX(${value ? (document.documentElement.dir === 'rtl' ? -18 : 18) : 0}px)`, transition: rm ? 'none' : 'transform .35s cubic-bezier(.34,1.56,.64,1)' }} />
    </button>
  )
}

function ActBtn({ label, icon: Icon, onClick, danger, small }: { label: string; icon: any; onClick: () => void; danger?: boolean; small?: boolean }) {
  return (
    <button onClick={onClick} className="v2-ctl"
      style={{ height: 38, padding: small ? '0 12px' : '0 16px', borderRadius: small ? 10 : 11, border: `1px solid ${danger ? 'rgba(239,68,68,.35)' : 'rgba(255,255,255,.12)'}`, background: danger ? 'rgba(239,68,68,.1)' : 'rgba(255,255,255,.05)', color: danger ? '#fca5a5' : '#fff', fontSize: small ? 12.5 : 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: small ? 6 : 8, flex: 'none', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
      <Icon size={14} />{label}
    </button>
  )
}

export default SettingsPage
