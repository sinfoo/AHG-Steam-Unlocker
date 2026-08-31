import { useState, useEffect, useRef, memo } from 'react'
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion'
import {
  Settings, Palette, Zap, HardDrive, Info, Gamepad2,
  FolderHeart, Heart, Clock, LayoutGrid, List,
  RotateCw, RefreshCw, FolderOpen, Folder, Trash,
  Search, Eye,
} from 'lucide-react'
import { COLORS } from '../constants/colors'
import { useSettingsStore } from '../store/settingsStore'
import { useGameStore } from '../store'
import { useShallow } from 'zustand/react/shallow'

// ── Settings Page ──
const SettingsPage = memo(function SettingsPage({ colors, accentColor, soundEnabled, setSoundEnabled, viewMode, setViewMode, compactMode, setCompactMode, games, installedGames, favorites, recentGames, showToast, bridge }: any) {
  const [activeTab, setActiveTab] = useState('general')
  const [notifications, setNotifications] = useState(true)
  const [autoUpdates, setAutoUpdates] = useState(true)

  const [appVersion, setAppVersion] = useState('0.90')
  const [cacheSize, setCacheSize] = useState('0 MB')
  const [customSteamPath, setCustomSteamPath] = useState('')
  const [customDepotCachePath, setCustomDepotCachePath] = useState('')
  const [customStPluginPath, setCustomStPluginPath] = useState('')
  // ── Store-bound settings ──
  const { hideSearchBars, showOnlyOwned } = useSettingsStore(
    useShallow(s => ({ hideSearchBars: s.hideSearchBars, showOnlyOwned: s.showOnlyOwned }))
  )
  const setHideSearchBars = useSettingsStore(s => s.setHideSearchBars)
  const setShowOnlyOwned = useSettingsStore(s => s.setShowOnlyOwned)
  
  const tabs = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'performance', label: 'Performance', icon: Zap },
    { id: 'steam', label: 'AHG Tools', icon: HardDrive },
    { id: 'about', label: 'About', icon: Info },
  ]
  
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

  // ── Hero visibility guard ──
  const heroRef = useRef<HTMLDivElement>(null)
  const [isHeroVisible, setIsHeroVisible] = useState(true)
  useEffect(() => {
    const el = heroRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => setIsHeroVisible(entry!.isIntersecting),
      { rootMargin: '100px 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Scroll parallax for hero
  const { scrollY } = useScroll()
  const heroContentY = useTransform(scrollY, [0, 300], [0, 15])

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-6xl mx-auto">
      {/* Premium Hero Section */}
      <div
        ref={heroRef}
        className="relative min-h-[160px] lg:min-h-[180px] overflow-hidden rounded-2xl mb-8"
        style={{
          background: `linear-gradient(135deg, ${colors.bgDark} 0%, ${colors.bgCard} 50%, ${colors.bgDark} 100%)`,
          border: `1px solid ${colors[accentColor as keyof typeof colors]}20`,
          boxShadow: `0 8px 32px ${colors[accentColor as keyof typeof colors]}10`,
        }}
      >
        {/* Grid dot pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.3) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* Ambient glow orbs */}
        <motion.div
          className="absolute -right-12 -top-12 w-[180px] h-[180px] rounded-full blur-[70px] pointer-events-none"
          style={{ background: `radial-gradient(circle, ${colors[accentColor as keyof typeof colors]}25 0%, transparent 70%)` }}
          animate={isHeroVisible ? { x: [0, 15, 0], y: [0, -12, 0], scale: [1, 1.06, 1] } : {}}
          transition={isHeroVisible ? { duration: 8, repeat: Infinity, ease: 'easeInOut' } : {}}
        />
        <motion.div
          className="absolute -left-8 bottom-0 w-[140px] h-[140px] rounded-full blur-[50px] pointer-events-none"
          style={{ background: `radial-gradient(circle, ${colors.blue}20 0%, transparent 70%)` }}
          animate={isHeroVisible ? { x: [0, -12, 0], y: [0, 16, 0], scale: [1, 1.08, 1] } : {}}
          transition={isHeroVisible ? { duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 1 } : {}}
        />

        {/* Floating particles */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 rounded-full"
              style={{
                background: colors[accentColor as keyof typeof colors],
                left: `${15 + i * 24}%`,
                top: `${25 + (i % 2) * 45}%`,
                opacity: 0.1 + i * 0.04,
              }}
              animate={isHeroVisible ? {
                y: [0, -(12 + i * 6), 0],
                x: [0, (i % 2 === 0 ? 6 : -6), 0],
                scale: [1, 1.3, 1],
                opacity: [0.08 + i * 0.02, 0.2 + i * 0.04, 0.08 + i * 0.02],
              } : {}}
              transition={isHeroVisible ? {
                duration: 4 + i * 1.2,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: i * 0.7,
              } : {}}
            />
          ))}
        </div>

        {/* Content */}
        <motion.div
          className="relative z-10 flex flex-col items-center justify-center h-full min-h-[160px] lg:min-h-[180px] px-6 text-center"
          style={{ y: isHeroVisible ? heroContentY : 0 }}
        >
          <h1
            className="text-3xl lg:text-4xl font-bold mb-2 tracking-tight"
            style={{
              background: `linear-gradient(135deg, ${colors[accentColor as keyof typeof colors]} 0%, ${colors.pink} 50%, ${colors.text} 100%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            AHG Unlocker
          </h1>
          <div className="flex items-center gap-2 mb-2">
            <span
              className="px-3 py-0.5 rounded-full text-xs font-bold"
              style={{
                background: `${colors[accentColor as keyof typeof colors]}18`,
                color: colors[accentColor as keyof typeof colors],
                border: `1px solid ${colors[accentColor as keyof typeof colors]}25`,
              }}
            >
              v1.2.3
            </span>
          </div>
          <p className="text-sm font-medium" style={{ color: colors.textMuted }}>
            Game & DLC Unlock Manager
          </p>
          <p className="text-xs mt-1.5 opacity-60" style={{ color: colors.textMuted }}>
            Settings &mdash; Customize your AHG Unlocker experience
          </p>
        </motion.div>
      </div>
      
      <div className="flex gap-6">
        {/* Sidebar Tabs */}
        <div className="w-64 flex-shrink-0">
          <div className="sticky top-6 space-y-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="w-full p-4 rounded-2xl flex items-center gap-3 text-left"
                style={{
                  background: activeTab === tab.id ? `${colors[accentColor as keyof typeof colors]}20` : colors.bgCard,
                  border: `1px solid ${activeTab === tab.id ? colors[accentColor as keyof typeof colors] + '50' : colors.border}`,
                  color: activeTab === tab.id ? colors[accentColor as keyof typeof colors] : colors.textSecondary,
                }}
              >
                <tab.icon size={20} />
                <span className="font-medium">{tab.label}</span>
                {activeTab === tab.id && (
                  <motion.div layoutId="activeTab" className="ml-auto w-2 h-2 rounded-full" style={{ background: colors[accentColor as keyof typeof colors] }} />
                )}
              </button>
            ))}
          </div>
        </div>
        
        {/* Content Area */}
        <div className="flex-1 space-y-6">
          {/* Stats Overview */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Total Games', value: games.length.toLocaleString(), icon: Gamepad2, color: colors.violet },
              { label: 'Installed', value: installedGames.length, icon: FolderHeart, color: colors.green },
              { label: 'Favorites', value: favorites.size, icon: Heart, color: colors.pink },
              { label: 'Recent', value: recentGames.length, icon: Clock, color: colors.blue },
            ].map((stat, i) => (
              <motion.div 
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="p-5 rounded-2xl"
                style={{ background: colors.bgCard, border: `1px solid ${colors.border}` }}
              >
                <stat.icon size={24} style={{ color: stat.color }} className="mb-3" />
                <p className="text-3xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
                <p className="text-sm" style={{ color: colors.textMuted }}>{stat.label}</p>
              </motion.div>
            ))}
          </div>
          
          {/* Tab Content with smooth transitions */}
          <AnimatePresence mode="wait">
            {activeTab === 'general' && (
              <motion.div key="general" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.12 }}>
                <SettingsSection title="General" icon={Settings} color={colors.violet}>
                  {/* Audio */}
                  <CategoryLabel title="Audio" color={colors[accentColor as keyof typeof colors]} />
                  <ToggleSetting label="Sound Effects" desc="Play sounds on interactions" value={soundEnabled} onChange={setSoundEnabled} colors={colors} accentColor={colors[accentColor as keyof typeof colors]} />
                  
                  {/* Notifications */}
                  <CategoryLabel title="Notifications" color={colors[accentColor as keyof typeof colors]} />
                  <ToggleSetting label="Notifications" desc="Show system notifications" value={notifications} onChange={setNotifications} colors={colors} accentColor={colors[accentColor as keyof typeof colors]} />
                  <ToggleSetting label="Auto Updates" desc="Check for updates automatically" value={autoUpdates} onChange={setAutoUpdates} colors={colors} accentColor={colors[accentColor as keyof typeof colors]} />
                  
                  {/* Filters */}
                  <CategoryLabel title="Filters" color={colors[accentColor as keyof typeof colors]} />
                  <ToggleSetting label="Hide Search Bars" desc="Hide search inputs on Browse, Achievements and Settings pages" value={hideSearchBars} onChange={setHideSearchBars} colors={colors} accentColor={colors[accentColor as keyof typeof colors]} />
                  <ToggleSetting label="Show Only Owned Games" desc="Only display games in your Steam library" value={showOnlyOwned} onChange={setShowOnlyOwned} colors={colors} accentColor={colors[accentColor as keyof typeof colors]} />
                </SettingsSection>
              </motion.div>
            )}
            {activeTab === 'appearance' && (
              <motion.div key="appearance" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.12 }} className="space-y-6">

                <SettingsSection title="Layout" icon={LayoutGrid} color={colors.green}>
                  <div className="py-4">
                    <p className="text-sm font-medium mb-3" style={{ color: colors.text }}>View Mode</p>
                    <div className="flex gap-3">
                      {['grid', 'list'].map((mode) => (
                        <button
                          key={mode}
                          onClick={() => setViewMode(mode as any)}
                          className="px-6 py-3 rounded-xl font-medium capitalize cursor-pointer hv-scale-03 tap-scale-97"
                          style={{
                            background: viewMode === mode ? colors[accentColor as keyof typeof colors] + '25' : colors.bgCard,
                            border: `1px solid ${viewMode === mode ? colors[accentColor as keyof typeof colors] : colors.border}`,
                            color: viewMode === mode ? colors[accentColor as keyof typeof colors] : colors.textSecondary,
                          }}
                        >
                          {mode === 'grid' ? <LayoutGrid size={18} className="inline mr-2" /> : <List size={18} className="inline mr-2" />}
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <ToggleSetting label="Compact Mode" desc="Show more games in less space" value={compactMode} onChange={setCompactMode} colors={colors} accentColor={colors[accentColor as keyof typeof colors]} />
                </SettingsSection>
              </motion.div>
            )}
            {activeTab === 'performance' && (
              <motion.div key="performance" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.12 }}>
                <SettingsSection title="Performance" icon={Zap} color={colors.amber}>
                  <div className="py-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium" style={{ color: colors.text }}>Cache Size</p>
                      <span className="text-sm" style={{ color: colors.textMuted }}>{cacheSize}</span>
                    </div>
                    <button
                      onClick={() => {
                        bridge.clearCache?.().then((r: any) => {
                          if (r?.success) {
                            showToast('Cache cleared!', 'success')
                            setCacheSize('0 MB')
                          }
                        })
                      }}
                      className="w-full p-4 rounded-xl text-left cursor-pointer hv-scale-01 tap-scale-98 tap-dim"
                      style={{ background: colors.bgCard, border: `1px solid ${colors.border}` }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium" style={{ color: colors.text }}>Clear Cache</p>
                          <p className="text-xs" style={{ color: colors.textMuted }}>Remove temporary files</p>
                        </div>
                        <Trash size={20} style={{ color: colors.red }} />
                      </div>
                    </button>
                  </div>
                </SettingsSection>
              </motion.div>
            )}
            {activeTab === 'steam' && (
              <motion.div key="steam" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.12 }} className="space-y-6">
                <SettingsSection title="Steam Management" icon={HardDrive} color={colors.cyan}>
                  <ActionButton label="Restart Steam" desc="Close and relaunch Steam" icon={RotateCw} color={colors.blue} onClick={() => window.electronAPI?.restartSteam?.()} colors={colors} />
                  <ActionButton label="Refresh Games" desc="Reload games list" icon={RefreshCw} color={colors.green} onClick={async () => {
                    showToast('Refreshing games…', 'info')
                    try {
                      const g = await bridge.loadGames?.(true)
                      if (Array.isArray(g) && g.length > 0) {
                        useGameStore.getState().setGames(g)
                        showToast(`Games refreshed — ${g.length.toLocaleString()} titles`, 'success')
                      } else {
                        showToast('No games returned from refresh', 'error')
                      }
                    } catch (e: any) {
                      showToast('Refresh failed: ' + (e?.message || e), 'error')
                    }
                  }} colors={colors} />
                  <ActionButton label="Open Steam Folder" desc="Open in File Explorer" icon={FolderOpen} color={colors.violet} onClick={() => window.electronAPI?.openSteamFolder?.()} colors={colors} />
                </SettingsSection>

                <SettingsSection title="Custom Steam Paths" icon={Folder} color={colors.amber}>
                  <div className="space-y-3">
                    {[
                      { label: 'Steam Installation', value: customSteamPath, fallback: 'Default (auto-detected)', key: 'steamPath', browseKey: 'steam' },
                      { label: 'Depot Cache', value: customDepotCachePath, fallback: 'Default (Steam depotcache)', key: 'depotCachePath', browseKey: 'manifests' },
                      { label: 'STPlug-in (Lua)', value: customStPluginPath, fallback: 'Default (Steam config/stplug-in)', key: 'stPluginPath', browseKey: 'lua' },
                    ].map((item) => (
                      <div key={item.key} className="flex items-center justify-between p-4 rounded-xl group" style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)' }}>
                        <div className="flex-1 min-w-0 mr-4">
                          <p className="font-medium" style={{ color: colors.text }}>{item.label}</p>
                          <p className="text-xs truncate" style={{ color: colors.textMuted }}>{item.value || item.fallback}</p>
                        </div>
                        <button
                          onClick={async () => {
                            const p = await window.electronAPI?.browsePath?.(item.browseKey)
                            if (p) {
                              if (item.key === 'steamPath') setCustomSteamPath(p)
                              else if (item.key === 'depotCachePath') setCustomDepotCachePath(p)
                              else if (item.key === 'stPluginPath') setCustomStPluginPath(p)
                              const cfg = await window.electronAPI?.getCustomSteamConfig?.() || {}
                              await window.electronAPI?.saveCustomSteamConfig?.({ ...cfg, [item.key]: p })
                              showToast(`${item.label} path updated`, 'success')
                            }
                          }}
                          className="px-4 py-2 rounded-xl text-xs font-bold shrink-0 cursor-pointer hv-scale-08 tap-scale-93 tap-dim"
                          style={{ background: `${colors.amber}20`, color: colors.amber, border: `1px solid ${colors.amber}30`, transition: 'all 0.2s ease' }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.boxShadow = `0 4px 20px ${colors.amber}35`
                            e.currentTarget.style.backgroundColor = `${colors.amber}30`
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.boxShadow = 'none'
                            e.currentTarget.style.backgroundColor = `${colors.amber}20`
                          }}
                        >
                          Browse
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={async () => {
                        setCustomSteamPath('')
                        setCustomDepotCachePath('')
                        setCustomStPluginPath('')
                        await window.electronAPI?.saveCustomSteamConfig?.({})
                        showToast('Custom paths reset to defaults', 'info')
                      }}
                      className="w-full py-2.5 rounded-xl text-xs font-bold cursor-pointer hv-scale-02 tap-scale-97 tap-dim"
                      style={{ background: `${colors.red}15`, color: colors.red, border: `1px solid ${colors.red}30`, transition: 'all 0.2s ease' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.boxShadow = `0 4px 20px ${colors.red}30`
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = 'none'
                      }}
                    >
                      Reset to Defaults
                    </button>
                  </div>
                </SettingsSection>

                <SettingsSection title="Quick Tools" icon={Zap} color={colors.amber}>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: 'Fix No Games', desc: 'Refresh game library', icon: Gamepad2, color: colors.blue, action: () => { bridge.fixNoGames?.().then((r: any) => showToast(r?.success ? 'Fixed!' : r?.message, r?.success ? 'success' : 'error')); }},
                      { label: 'AHG Script', desc: 'Run AHG maintenance script', icon: Eye, color: colors.green, action: () => { bridge.fixGamesNotShowing?.().then((r: any) => showToast(r?.success ? 'Done!' : r?.message, r?.success ? 'success' : 'error')); }},
                      { label: 'Clear Cache', desc: 'Clean temp files', icon: Trash, color: colors.red, action: () => bridge.clearCache?.().then((r: any) => showToast(r?.success ? 'Cleared!' : r?.message, r?.success ? 'success' : 'error'))},
                      { label: 'Scan New Manifests', desc: 'Check for new game manifests', icon: Search, color: colors.cyan, action: () => { bridge.scanNewManifests?.().then((r: any) => showToast(r?.success ? 'Scan complete!' : r?.message, r?.success ? 'success' : 'error')); }},
                      { label: 'Check for Updates', desc: 'Check AHG Unlocker updates', icon: RefreshCw, color: colors.pink, action: () => { bridge.checkForUpdates?.().then((r: any) => {
                        if (!r?.success) { showToast(r?.message || 'Could not check for updates', 'error'); return; }
                        // r.success only means the check itself worked — branch on hasUpdate.
                        showToast(r.hasUpdate ? `Update available: v${r.latestVersion}` : "You're on the latest version", r.hasUpdate ? 'info' : 'success');
                      }); }},
                    ].map((tool) => (
                      <button
                        key={tool.label}
                        onClick={tool.action}
                        className="p-5 rounded-2xl text-left cursor-pointer group hv-scale-05-lift tap-scale tap-dim"
                        style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.boxShadow = `0 12px 40px ${tool.color}35, 0 0 60px ${tool.color}15`
                          e.currentTarget.style.background = `linear-gradient(135deg, ${tool.color}12 0%, ${colors.bgCard} 100%)`
                          e.currentTarget.style.borderColor = tool.color + '40'
                          const icon = e.currentTarget.querySelector('.hv-rot-scale') as HTMLElement
                          if (icon) icon.style.background = `${tool.color}30`
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.boxShadow = 'none'
                          e.currentTarget.style.background = colors.bgCard
                          e.currentTarget.style.borderColor = colors.border
                          const icon = e.currentTarget.querySelector('.hv-rot-scale') as HTMLElement
                          if (icon) icon.style.background = `${tool.color}18`
                        }}
                      >
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 hv-rot-scale" style={{ background: `${tool.color}18` }}>
                          <tool.icon size={24} style={{ color: tool.color }} />
                        </div>
                        <p className="font-bold" style={{ color: colors.text }}>{tool.label}</p>
                        <p className="text-xs mt-1" style={{ color: colors.textMuted }}>{tool.desc}</p>
                      </button>
                    ))}
                  </div>
                </SettingsSection>

              </motion.div>
            )}
            {activeTab === 'about' && (
              <motion.div key="about" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.12 }} className="space-y-6">
                {/* Founder Section First */}
                <SettingsSection title="About The Founder" icon={Heart} color={colors.pink}>
                  <div className="space-y-4">
                      {/* Hero card */}
                      <div className="relative overflow-hidden rounded-2xl" style={{ 
                        background: 'linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(236,72,153,0.06) 50%, rgba(245,158,11,0.08) 100%)', 
                        border: '1px solid rgba(139,92,246,0.15)',
                        boxShadow: '0 12px 40px rgba(0,0,0,0.2)'
                      }}>
                        {/* Animated gradient border effect */}
                        <div className="absolute top-0 left-0 right-0 h-[2px]" style={{
                          background: `linear-gradient(90deg, ${COLORS.violet}, ${COLORS.pink}, ${COLORS.amber}, ${COLORS.violet})`,
                          backgroundSize: '200% 100%',
                          animation: 'shimmer 3s linear infinite'
                        }} />
                        
                        <div className="p-6">
                          <div className="flex items-center gap-5">
                            {/* Avatar */}
                            <div className="relative flex-shrink-0">
                              <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ 
                                background: `linear-gradient(135deg, ${COLORS.violet} 0%, ${COLORS.pink} 50%, ${COLORS.amber} 100%)`,
                                backgroundSize: '200% 200%',
                                boxShadow: `0 8px 32px ${COLORS.violetGlow}, 0 0 48px rgba(236,72,153,0.2)`,
                                animation: 'shimmer 4s ease-in-out infinite'
                              }}>
                                <span className="text-3xl font-bold text-white drop-shadow-lg">S</span>
                              </div>
                              {/* Online indicator */}
                              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: colors.bgCard, border: '2px solid rgba(139,92,246,0.3)' }}>
                                <div className="w-3 h-3 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]" />
                              </div>
                            </div>
                            
                            {/* Info */}
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="text-xl font-bold" style={{ color: colors.text }}>Safwen</h4>
                                <span className="px-2 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider" style={{ background: `${colors.violet}20`, color: colors.violet, border: `1px solid ${colors.violet}30` }}>Developer</span>
                              </div>
                              <p className="text-sm" style={{ color: colors.textSecondary }}>
                                 20 years old • Passionate developer
                              </p>
                              <p className="text-xs mt-1" style={{ color: colors.textMuted }}>
                                Creating solutions for the gaming community
                              </p>
                            </div>
                          </div>
                          
                          {/* Stats bar */}
                          <div className="mt-5 pt-4 flex items-center gap-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                            <div className="flex-1 text-center p-3 rounded-xl" style={{ background: 'rgba(139,92,246,0.08)' }}>
                              <p className="text-lg font-bold" style={{ color: colors.violet }}>170K+</p>
                              <p className="text-xs uppercase tracking-wider font-bold" style={{ color: colors.textMuted }}>Games</p>
                            </div>
                            <div className="flex-1 text-center p-3 rounded-xl" style={{ background: 'rgba(236,72,153,0.08)' }}>
                              <p className="text-lg font-bold" style={{ color: colors.pink }}>v1.2.3</p>
                              <p className="text-xs uppercase tracking-wider font-bold" style={{ color: colors.textMuted }}>Version</p>
                            </div>
                            <div className="flex-1 text-center p-3 rounded-xl" style={{ background: 'rgba(245,158,11,0.08)' }}>
                              <p className="text-lg font-bold" style={{ color: colors.amber }}>2026</p>
                              <p className="text-xs uppercase tracking-wider font-bold" style={{ color: colors.textMuted }}>Founded</p>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Social links */}
                      <div className="grid grid-cols-1 gap-3">
                        <a
                          href="https://discord.gg/ahg"
                          target="_blank"
                          className="flex flex-col items-center gap-3 p-4 rounded-2xl cursor-pointer relative group"
                          style={{ 
                            background: 'linear-gradient(180deg, rgba(88,101,242,0.12) 0%, rgba(71,82,196,0.06) 100%)',
                            border: '1px solid rgba(88,101,242,0.2)',
                            boxShadow: '0 8px 32px rgba(88,101,242,0.1), inset 0 1px 0 rgba(255,255,255,0.03)',
                          }}
                        >
                          <div className="absolute inset-0 bg-gradient-to-t from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                          <div className="w-12 h-12 rounded-xl flex items-center justify-center relative z-10" style={{ 
                            background: '#5865F2', // Discord brand color - intentional
                            boxShadow: '0 6px 20px rgba(88,101,242,0.4)'
                          }}>
                            <svg width="24" height="24" viewBox="0 0 1024 1024">
                              <circle cx="512" cy="512" r="512" fill="#5865F2"/> {/* Discord brand color - intentional */}
                              <path d="M689.43 349a422.21 422.21 0 0 0-104.22-32.32 1.58 1.58 0 0 0-1.68.79 294.11 294.11 0 0 0-13 26.66 389.78 389.78 0 0 0-117.05 0 269.75 269.75 0 0 0-13.18-26.66 1.64 1.64 0 0 0-1.68-.79A421 421 0 0 0 334.44 349a1.49 1.49 0 0 0-.69.59c-66.37 99.17-84.55 195.9-75.63 291.41a1.76 1.76 0 0 0 .67 1.2 424.58 424.58 0 0 0 127.85 64.63 1.66 1.66 0 0 0 1.8-.59 303.45 303.45 0 0 0 26.15-42.54 1.62 1.62 0 0 0-.89-2.25 279.6 279.6 0 0 1-39.94-19 1.64 1.64 0 0 1-.16-2.72c2.68-2 5.37-4.1 7.93-6.22a1.58 1.58 0 0 1 1.65-.22c83.79 38.26 174.51 38.26 257.31 0a1.58 1.58 0 0 1 1.68.2c2.56 2.11 5.25 4.23 8 6.24a1.64 1.64 0 0 1-.14 2.72 262.37 262.37 0 0 1-40 19 1.63 1.63 0 0 0-.87 2.28 340.72 340.72 0 0 0 26.13 42.52 1.62 1.62 0 0 0 1.8.61 423.17 423.17 0 0 0 128-64.63 1.64 1.64 0 0 0 .67-1.18c10.68-110.44-17.88-206.38-75.7-291.42a1.3 1.3 0 0 0-.63-.63zM427.09 582.85c-25.23 0-46-23.16-46-51.6s20.38-51.6 46-51.6c25.83 0 46.42 23.36 46 51.6.02 28.44-20.37 51.6-46 51.6zm170.13 0c-25.23 0-46-23.16-46-51.6s20.38-51.6 46-51.6c25.83 0 46.42 23.36 46 51.6.01 28.44-20.17 51.6-46 51.6z" fill="#fff"/>
                            </svg>
                          </div>
                          <span className="text-xs font-medium" style={{ color: '#5865F2' }}>Discord</span> {/* Discord brand color - intentional */}
                        </a>
                      </div>
                       
                      {/* Thank you card */}
                      <div className="relative overflow-hidden p-5 rounded-2xl" style={{ 
                        background: 'linear-gradient(135deg, rgba(34,197,94,0.08) 0%, rgba(16,185,129,0.05) 100%)', 
                        border: '1px solid rgba(34,197,94,0.2)',
                        boxShadow: '0 8px 32px rgba(34,197,94,0.08)'
                      }}>
                        <div className="absolute top-0 left-0 w-1 h-full" style={{ background: `linear-gradient(180deg, ${COLORS.green}, ${COLORS.green}cc)` }} />
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${colors.green}20` }}>
                            <span className="text-xl">🎮</span>
                          </div>
                          <div>
                            <p className="font-bold" style={{ color: colors.green }}>Thank you for your support!</p>
                            <p className="text-xs" style={{ color: colors.textMuted }}>Enjoy AHG Steam Unlocker with 170,000+ games</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </SettingsSection>

                <SettingsSection title="About AHG Unlocker" icon={Info} color={colors.violet}>
                    <div className="text-center py-8">
                      <div className="w-24 h-24 mx-auto mb-4 rounded-3xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${colors.violet}30 0%, ${colors.violet}15 100%)` }}>
                        <Gamepad2 size={48} style={{ color: colors.violet }} />
                      </div>
                      <h3 className="text-2xl font-bold mb-2" style={{ color: colors.text }}>AHG Unlocker</h3>
                      <p className="text-lg mb-4" style={{ color: colors.textMuted }}>Version {appVersion}</p>
                      <p className="text-sm max-w-md mx-auto" style={{ color: colors.textSecondary }}>
                        Your ultimate Steam game unlocker with 170,000+ games and growing. 
                        Unlock any game with one click.
                      </p>
                    </div>
                  </SettingsSection>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
})

// Settings Section Component
function SettingsSection({ title, icon: Icon, color, children }: { title: string; icon: any; color: string; children: React.ReactNode }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${color}0a 0%, ${COLORS.bgCard} 100%)`, border: `1px solid ${color}25`, boxShadow: `0 0 40px ${color}08` }}
    >
      <div className="flex items-center gap-3 p-5" style={{ borderBottom: `2px solid ${color}20` }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}30`, boxShadow: `0 0 20px ${color}20` }}>
          <Icon size={20} style={{ color }} />
        </div>
        <h3 className="text-xl font-bold" style={{ color: COLORS.text }}>{title}</h3>
      </div>
      <div className="p-5 space-y-4">
        {children}
      </div>
    </motion.div>
  )
}

// Toggle Setting Component
function ToggleSetting({ label, desc, value, onChange, colors, accentColor }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void; colors: any; accentColor?: string }) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: `linear-gradient(135deg, ${colors.bgCard} 0%, ${colors.bgDark} 100%)`, border: `1px solid ${colors.border}` }}>
      <div>
        <p className="font-bold" style={{ color: colors.text }}>{label}</p>
        <p className="text-sm" style={{ color: colors.textMuted }}>{desc}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className="w-14 h-7 rounded-full p-1 cursor-pointer hv-scale tap-scale-90 tap-dim"
        style={{ background: value ? (accentColor || colors.violet) : colors.bgHover, boxShadow: value ? `0 0 16px ${(accentColor || colors.violet)}50` : 'none' }}
      >
        <div 
          className="w-5 h-5 bg-white rounded-full shadow-lg"
          style={{ 
            transform: value ? 'translateX(28px)' : 'translateX(0)',
            transition: 'transform 80ms cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        />
      </button>
    </div>
  )
}

// Category Label Component
function CategoryLabel({ title, color }: { title: string; color: string }) {
  return (
    <div className="flex items-center gap-3 pt-4">
      <span className="text-[11px] font-bold uppercase tracking-[0.15em]" style={{ color: `${color}cc` }}>{title}</span>
      <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${color}25 0%, transparent 100%)` }} />
    </div>
  )
}

// Action Button Component
function ActionButton({ label, desc, icon: Icon, color, onClick, colors }: { label: string; desc: string; icon: any; color: string; onClick: () => void; colors: any }) {
  return (
    <button
      onClick={onClick}
      className="w-full p-4 rounded-xl text-left flex items-center gap-4 cursor-pointer group hv-scale-03-lift tap-scale-97 tap-dim"
      style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)' }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = `0 12px 40px ${color}35, 0 0 60px ${color}15`
        e.currentTarget.style.background = `linear-gradient(135deg, ${color}18 0%, ${colors.bgCard} 100%)`
        e.currentTarget.style.borderColor = color + '50'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.background = colors.bgCard
        e.currentTarget.style.borderColor = colors.border
      }}
    >
      <div className="w-12 h-12 rounded-xl flex items-center justify-center hv-rot-scale" style={{ background: `${color}30`, boxShadow: `0 0 20px ${color}20` }}>
        <Icon size={24} style={{ color }} />
      </div>
      <div>
        <p className="font-bold" style={{ color: colors.text }}>{label}</p>
        <p className="text-sm" style={{ color: colors.textMuted }}>{desc}</p>
      </div>
    </button>
  )
}

export default SettingsPage
