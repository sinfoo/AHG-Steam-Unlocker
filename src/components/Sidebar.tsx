import { memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Gamepad2, Zap, ChevronDown, LayoutGrid, Download, X } from 'lucide-react'
import { DARK_COLORS } from '../constants/colors'
import { useUIStore } from '../store/uiStore'
import { OfflineIndicator } from './OfflineIndicator'

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
  sidebarCollapsed: boolean
  isOverlay?: boolean
  onCloseOverlay?: () => void
  discordConnected: boolean
  quickToolsOpen: boolean
  setQuickToolsOpen: (value: boolean | ((prev: boolean) => boolean)) => void
  setDiscordModalOpen: (value: boolean | ((prev: boolean) => boolean)) => void
  setDiscordSuccessOpen: (value: boolean | ((prev: boolean) => boolean)) => void
  setUpdateModalOpen: (value: boolean | ((prev: boolean) => boolean)) => void
}

/* ── Sub-component to isolate currentPage subscription ── */
function NavItemList({
  navItems,
  navigateTo,
  sidebarCollapsed,
  colors: COLORS,
}: {
  navItems: NavItem[]
  navigateTo: (page: string) => void
  sidebarCollapsed: boolean
  colors: typeof DARK_COLORS
}) {
  const currentPage = useUIStore(s => s.currentPage)

  return navItems.map((item) => (
    <button
      key={item.id}
      onClick={() => navigateTo(item.id)}
      title={sidebarCollapsed ? item.label : undefined}
      className={`w-full rounded-2xl flex items-center cursor-pointer relative group sidebar-nav-btn tap-dim ${currentPage === item.id ? 'sidebar-nav-btn-active' : ''} ${sidebarCollapsed ? 'py-3 justify-center' : 'py-3.5 px-3 gap-3'}`}
      style={{
        background: currentPage === item.id
          ? `radial-gradient(ellipse at 30% 50%, ${item.color}30 0%, ${item.color}12 60%, ${item.color}08 100%)`
          : `linear-gradient(135deg, ${COLORS.bgCard} 0%, ${COLORS.bgDeep} 100%)`,
        border: `1px solid ${currentPage === item.id ? item.color + '60' : 'transparent'}`,
        boxShadow: currentPage === item.id ? `0 4px 24px ${item.color}35, inset 0 1px 0 ${item.color}20` : undefined,
        '--sidebar-nav-hover-shadow': `0 4px 20px ${item.color}40, 0 0 40px ${item.color}15`,
        ...(currentPage !== item.id ? { '--sidebar-nav-hover-text-color': item.color } : {}),
      } as React.CSSProperties}
    >
      {currentPage === item.id && (
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{ background: `linear-gradient(90deg, ${item.color}15 0%, transparent 100%)` }}
        />
      )}
      <div className="relative sidebar-icon-wrap">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center relative overflow-hidden sidebar-nav-icon"
          style={{
            background: `linear-gradient(135deg, ${item.color}25 0%, ${item.color}10 100%)`,
            boxShadow: item.id === 'settings' ? `0 0 20px ${item.color}40` : `0 2px 12px ${item.color}30`,
          }}
        >
          <item.icon size={18} style={{ color: item.color, position: 'relative', zIndex: 1 }} />
        </div>
        {/* CSS tooltip for collapsed mode */}
        {sidebarCollapsed && (
          <span className="sidebar-tooltip">{item.label}</span>
        )}
      </div>
      <span
        style={{
          color: currentPage === item.id ? COLORS.text : COLORS.textSecondary,
          fontWeight: currentPage === item.id ? 600 : 500,
          transition: 'color 80ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        className={`flex-1 font-medium text-sm relative z-10 sidebar-nav-label sidebar-nav-text ${sidebarCollapsed ? 'hidden' : ''}`}
      >
        {item.label}
      </span>
      {item.count > 0 && !sidebarCollapsed && (
        <motion.span
          className="px-3 py-1 rounded-lg text-xs font-bold sidebar-badge-expanded sidebar-badge-btn relative"
          style={{
            background: item.color,
            color: 'white',
            boxShadow: `0 2px 8px ${item.color}50`,
          }}
          animate={{
            boxShadow: [
              `0 2px 8px ${item.color}50`,
              `0 2px 16px ${item.color}80`,
              `0 2px 8px ${item.color}50`,
            ],
          }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          {item.count > 999 ? `${(item.count / 1000).toFixed(1)}k` : item.count}
        </motion.span>
      )}
    </button>
  ))
}

const Sidebar = memo(function Sidebar({
  navItems,
  quickTools,
  colors: COLORS,
  navigateTo,
  sidebarCollapsed,
  isOverlay,
  onCloseOverlay,
  discordConnected,
  quickToolsOpen,
  setQuickToolsOpen,
  setDiscordModalOpen,
  setDiscordSuccessOpen,
  setUpdateModalOpen,
}: SidebarProps) {

  return (
    <motion.aside
      initial={{ x: isOverlay ? -288 : -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={`sidebar-container h-full flex flex-col ${isOverlay ? 'fixed left-0 top-0 z-50 h-screen' : 'relative z-20'} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}
      style={{ 
        width: sidebarCollapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)',
        background: `linear-gradient(180deg, ${COLORS.bgDark} 0%, ${COLORS.bgDeep} 100%)`, 
        borderRight: `1px solid ${COLORS.border}`,
        boxShadow: isOverlay ? '8px 0 60px rgba(0,0,0,0.6)' : '8px 0 40px rgba(0,0,0,0.4)',
        transition: 'width 150ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Logo Area */}
        <div className={`sidebar-logo relative ${sidebarCollapsed ? '' : 'p-4 pb-2'}`} style={{ borderBottom: `1px solid ${COLORS.border}50` }}>
        <div
          className={`flex items-center cursor-pointer group relative hv-scale-03 tap-scale-97 tap-dim ${sidebarCollapsed ? 'justify-center gap-0' : 'gap-3.5'}`}
          onClick={() => navigateTo('home')}
        >
          <div 
            className="w-10 h-10 rounded-xl flex items-center justify-center relative overflow-hidden shrink-0 hv-scale-08 transition-transform duration-75" 
            style={{ 
              background: `linear-gradient(135deg, ${COLORS.violet} 0%, ${COLORS.blue} 100%)`, 
              boxShadow: `0 8px 32px ${COLORS.violet}50`
            }}
          >
            <div
              className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-[600ms] ease-in-out"
              style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 60%)' }}
            />
            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent" />
            <Gamepad2 className="text-white" size={22} strokeWidth={1.5} />
          </div>
          <div className={`sidebar-logo-text space-y-0.5 ${sidebarCollapsed ? 'hidden' : ''}`}>
            <h1 
              className="text-white font-bold text-xl tracking-tight group-hover:text-violet-400 transition-colors duration-75"
            >
              AHG
            </h1>
            <p className="text-violet-400 text-sm font-medium">Steam Unlocker</p>
          </div>
        </div>
        {isOverlay && onCloseOverlay && (
          <button
            onClick={onCloseOverlay}
            className="absolute right-2 top-2 w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:brightness-125 tap-scale"
            style={{
              background: COLORS.bgCard,
              border: `1px solid ${COLORS.border}`,
              color: COLORS.textSecondary,
              transition: 'all 80ms cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            <X size={13} />
          </button>
        )}
      </div>
      
      {/* Quick Tools - Premium matching nav buttons */}
      {!sidebarCollapsed && (
      <div className="px-3 pt-3 pb-1">
        <button
          onClick={() => setQuickToolsOpen(o => !o)}
          className="w-full py-3 px-3.5 rounded-2xl flex items-center gap-3 cursor-pointer relative overflow-hidden group sidebar-nav-btn"
          style={{ 
            background: quickToolsOpen 
              ? `linear-gradient(135deg, ${COLORS.violet}25 0%, ${COLORS.violet}10 100%)` 
              : `linear-gradient(135deg, ${COLORS.bgCard} 0%, ${COLORS.bgDeep} 100%)`,
            border: `1px solid ${quickToolsOpen ? COLORS.violet + '50' : 'transparent'}`,
            boxShadow: quickToolsOpen ? `0 4px 20px ${COLORS.violet}25` : 'none',
          }}
        >
          {quickToolsOpen && (
            <div
              className="absolute inset-0 rounded-2xl pointer-events-none"
              style={{ background: `linear-gradient(90deg, ${COLORS.violet}15 0%, transparent 100%)` }}
            />
          )}
          {/* Icon */}
          <div 
            className="w-10 h-10 rounded-xl flex items-center justify-center relative overflow-hidden shrink-0 sidebar-nav-icon" 
            style={{ 
              background: `linear-gradient(135deg, ${COLORS.violet}25 0%, ${COLORS.violet}10 100%)`,
              boxShadow: `0 2px 12px ${COLORS.violet}30`
            }}
          >
            <motion.div
              className="absolute inset-0"
              style={{ background: `radial-gradient(circle, ${COLORS.violet}40 0%, transparent 70%)` }}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={quickToolsOpen ? { opacity: 1, scale: 1.2 } : { opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.08, ease: [0.4, 0, 0.2, 1] }}
            />
            <Zap size={18} style={{ color: COLORS.violet, position: 'relative', zIndex: 1 }} />
          </div>
          {/* Label */}
          <span 
            style={{ color: quickToolsOpen ? COLORS.text : COLORS.textSecondary }}
            className="flex-1 font-semibold text-sm relative z-10"
          >
            AHG Tools
          </span>
          {/* Chevron */}
          <div className="relative z-10">
            <ChevronDown size={15} style={{ color: quickToolsOpen ? COLORS.violet : COLORS.textMuted }} />
          </div>
        </button>
        <AnimatePresence initial={false}>
          {quickToolsOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-2 gap-2 pt-3 pb-1.5 px-0.5">
                {quickTools.slice(0, 8).map((tool, i) => (
                  <motion.button
                    key={tool.name}
                    initial={{ opacity: 0, y: 10, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: i * 0.04, type: 'spring', stiffness: 350, damping: 22 }}
                    onClick={() => { tool.action(); setQuickToolsOpen(false) }}
                    className="flex flex-col items-center gap-2 py-3 px-2 rounded-xl text-center relative overflow-hidden group hv-scale-05-lift tap-scale-92 tap-dim"
                    style={{ 
                      background: `linear-gradient(145deg, ${tool.color}14 0%, ${tool.color}06 100%)`, 
                      border: `1px solid ${tool.color}25`,
                      boxShadow: `0 2px 8px ${tool.color}15`,
                    }}
                    title={tool.desc}
                  >
                    <div
                      className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-75"
                      style={{ 
                        background: `radial-gradient(120% 100% at 50% 0%, ${tool.color}30 0%, transparent 70%)`,
                      }}
                    />
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center relative transition-transform duration-75 group-hover:scale-110 group-hover:rotate-6"
                      style={{ 
                        background: `linear-gradient(135deg, ${tool.color}35 0%, ${tool.color}12 100%)`,
                        boxShadow: `0 2px 10px ${tool.color}25`,
                      }}
                    >
                      <tool.icon size={14} style={{ color: tool.color, position: 'relative', zIndex: 1 }} />
                    </div>
                    <span className="text-xs font-semibold leading-tight relative z-10" style={{ color: COLORS.textSecondary }}>{tool.name}</span>
                    <div
                      className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full scale-x-0 group-hover:scale-x-100 opacity-0 group-hover:opacity-100 transition-all duration-75"
                      style={{ background: `linear-gradient(90deg, transparent, ${tool.color}70, transparent)` }}
                    />
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      )}
      <div className="px-3 pt-2" style={{ borderTop: `1px solid ${COLORS.border}` }} />
      {/* Navigation */}
      <nav className={`flex-1 overflow-y-auto ${sidebarCollapsed ? 'px-1 py-2 space-y-1' : 'px-3 py-2 space-y-1'}`}>
        {!sidebarCollapsed && (
        <div className="flex items-center gap-2 mb-2 mt-1 px-2">
          <LayoutGrid size={12} style={{ color: COLORS.blue }} />
          <span style={{ color: COLORS.textMuted }} className="text-[10px] font-bold uppercase tracking-[0.12em] sidebar-section-label">Navigation</span>
        </div>
        )}
        
          <NavItemList
          navItems={navItems}
          navigateTo={navigateTo}
          sidebarCollapsed={sidebarCollapsed}
          colors={COLORS}
        />
      </nav>
      
      {/* Gradient separator above footer */}
      <div className="relative">
        <div
          className="absolute top-0 left-3 right-3 h-[1px]"
          style={{
            background: `linear-gradient(90deg, transparent, ${COLORS.violet}40, ${COLORS.blue}30, ${COLORS.violet}40, transparent)`,
          }}
        />
      </div>
      {/* Offline indicator */}
      <OfflineIndicator collapsed={sidebarCollapsed} />
      {/* Bottom Actions */}
      <div className={`sidebar-footer ${sidebarCollapsed ? 'p-2 space-y-1.5' : 'p-3 space-y-1.5'}`}>
        {/* Discord Login Button */}
        <button 
          onClick={() => discordConnected ? setDiscordSuccessOpen(true) : setDiscordModalOpen(true)}
          title={sidebarCollapsed ? (discordConnected ? 'Discord Connected' : 'Discord Log In') : undefined}
          className={`w-full rounded-2xl flex items-center cursor-pointer group sidebar-footer-btn ${sidebarCollapsed ? 'py-3 justify-center' : 'py-3 px-3.5 gap-2.5 justify-center'}`}
          style={{ 
            background: discordConnected 
              ? `linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(99,102,241,0.05) 100%)`
              : `linear-gradient(135deg, ${COLORS.violet}22 0%, ${COLORS.bgCard} 100%)`,
            border: discordConnected 
              ? '1px solid rgba(139,92,246,0.4)' 
              : `1px solid ${COLORS.violet}40`,
            boxShadow: discordConnected 
              ? 'none'
              : `0 2px 12px ${COLORS.violet}10`,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 127.14 96.36" fill={discordConnected ? COLORS.violet : COLORS.textMuted}>
            <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/>
          </svg>
          {!sidebarCollapsed && (
          <span style={{ color: discordConnected ? COLORS.violetLight : COLORS.text, fontWeight: 600 }} className="text-sm sidebar-footer-text">
            {discordConnected ? 'Discord Connected' : 'Discord Log In'}
          </span>
          )}
          {discordConnected && <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />}
        </button>
        <button 
          onClick={() => setUpdateModalOpen(true)}
          title={sidebarCollapsed ? 'Check for Updates' : undefined}
          className={`w-full rounded-2xl flex items-center cursor-pointer group sidebar-footer-btn ${sidebarCollapsed ? 'py-3 justify-center' : 'py-3 px-3.5 gap-2.5 justify-center'}`}
          style={{ 
            background: `linear-gradient(135deg, ${COLORS.violet}22 0%, ${COLORS.bgCard} 100%)`,
            border: `1px solid ${COLORS.violet}40`,
            boxShadow: `0 2px 12px ${COLORS.violet}10`,
          }}
        >
          <Download size={16} style={{ color: COLORS.violet }} />
          {!sidebarCollapsed && (
          <span style={{ color: COLORS.text, fontWeight: 600 }} className="text-sm sidebar-footer-text">Check for Updates</span>
          )}
        </button>

      </div>
    </motion.aside>
  )
})

Sidebar.displayName = 'Sidebar'

export { Sidebar }
