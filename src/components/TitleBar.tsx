import { memo, useEffect, useState } from 'react'
import { COLORS } from '../constants/colors'

interface TitleBarColors {
  bgDeep: string
  bgDark: string
  border: string
  textMuted: string
  text: string
  textSecondary: string
  red: string
  amber: string
  green: string
  violet: string
}

interface TitleBarProps {
  colors: TitleBarColors
  currentPage?: string
}

const PAGE_NAMES: Record<string, string> = {
  home: 'Home',
  browse: 'Browse',
  library: 'Library',
  favourites: 'Favourites',
  recent: 'Recent',
  fixes: 'Fixes',
  settings: 'Settings',
}

const TitleBar = memo(function TitleBar({ colors, currentPage }: TitleBarProps) {
  const [isMaximized, setIsMaximized] = useState(false)
  const pageName = PAGE_NAMES[currentPage || ''] || ''

  useEffect(() => {
    ;(window as any).electronAPI?.isMaximized?.().then(setIsMaximized)
    ;(window as any).electronAPI?.onMaximizeChange?.(setIsMaximized)
  }, [])

  const iconStyle = {
    width: 46,
    height: '100%',
    border: 'none',
    background: 'transparent',
    color: colors.textMuted,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.12s ease',
    WebkitAppRegion: 'no-drag',
    position: 'relative',
  } as React.CSSProperties

  return (
    <div
      onDoubleClick={() => (window as any).electronAPI?.maximizeWindow?.()}
      style={{
        width: '100%',
        height: 34,
        flexShrink: 0,
        position: 'relative',
        zIndex: 50,
        background: `linear-gradient(180deg, ${colors.bgDark} 0%, ${colors.bgDeep} 100%)`,
        borderBottom: `1px solid ${colors.border}`,
        display: 'flex',
        alignItems: 'center',
        userSelect: 'none',
        WebkitAppRegion: 'drag',
      } as React.CSSProperties}
    >
      {/* App icon + label — drag handle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 12, WebkitAppRegion: 'drag' } as React.CSSProperties}>
        <svg width="16" height="16" viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="6" fill={colors.violet} />
          <path d="M8 22V10l12 6-12 6z" fill={COLORS.white} opacity="0.95" />
          <path d="M18 22V10l6 6-6 6z" fill={COLORS.white} opacity="0.6" />
        </svg>
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: '1.8px',
            color: colors.textMuted,
            opacity: 0.5,
          }}
        >
          AHG UNLOCKER
        </span>

        {pageName && (
          <>
            <span style={{ color: colors.border, fontSize: 14, opacity: 0.4, margin: '0 2px' }}>|</span>
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                letterSpacing: '0.5px',
                color: colors.violet,
                opacity: 0.7,
              }}
            >
              {pageName.toUpperCase()}
            </span>
          </>
        )}
      </div>

      {/* Spacer — draggable so entire title bar moves the window */}
      <div style={{ flex: 1, height: '100%' }} />

      {/* Window controls */}
      <div style={{ display: 'flex', height: '100%', alignItems: 'stretch', WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        {/* Minimize */}
        <button
          style={iconStyle}
          onClick={() => (window as any).electronAPI?.minimizeWindow?.()}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          title="Minimize"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <rect x="1" y="5.5" width="10" height="1" rx="0.5" fill="currentColor" />
          </svg>
        </button>

        {/* Maximize / Restore */}
        <button
          style={iconStyle}
          onClick={() => (window as any).electronAPI?.maximizeWindow?.()}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          title={isMaximized ? 'Restore' : 'Maximize'}
        >
          {isMaximized ? (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="2.5" y="0.5" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1" fill="none" />
              <rect x="1" y="3" width="8" height="8" rx="1" fill={colors.bgDeep} stroke="currentColor" strokeWidth="1" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="1" y="1" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" fill="none" />
            </svg>
          )}
        </button>

        {/* Close */}
        <button
          style={{ ...iconStyle, width: 46 }}
          onClick={() => (window as any).electronAPI?.closeWindow?.()}
          onMouseEnter={e => {
            e.currentTarget.style.background = colors.red
            e.currentTarget.style.color = COLORS.white
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = colors.textMuted
          }}
          title="Close"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  )
})

export default TitleBar
