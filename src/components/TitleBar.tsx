import { memo, useEffect, useState } from 'react'
import { COLORS } from '../constants/colors'
import { useT, useLangStore, type TKey } from '../i18n'

interface TitleBarColors {
  bgDeep: string
  bgDark: string
  border: string
  textMuted: string
  textDim: string
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

const PAGE_NAMES: Record<string, TKey> = {
  home: 'app.nav.home',
  browse: 'app.nav.browse',
  library: 'app.nav.library',
  favourites: 'app.nav.favourites',
  recent: 'app.nav.recent',
  fixes: 'app.nav.fixes',
  settings: 'app.nav.settings',
}

const TitleBar = memo(function TitleBar({ colors, currentPage }: TitleBarProps) {
  const [isMaximized, setIsMaximized] = useState(false)
  const t = useT()
  const lang = useLangStore(s => s.lang)
  const pageKey = PAGE_NAMES[currentPage || '']
  const pageName = pageKey ? t(pageKey) : ''

  useEffect(() => {
    ;(window as any).electronAPI?.isMaximized?.().then(setIsMaximized)
    ;(window as any).electronAPI?.onMaximizeChange?.(setIsMaximized)
  }, [])

  const iconStyle = {
    width: 46,
    height: '100%',
    border: 'none',
    background: 'transparent',
    color: colors.textDim,
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
        height: 36,
        flexShrink: 0,
        position: 'relative',
        zIndex: 50,
        background: 'var(--s1, #0f0f1b)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        userSelect: 'none',
        direction: 'ltr', // keep window controls on the right in RTL
        WebkitAppRegion: 'drag',
      } as React.CSSProperties}
    >
      {/* App icon + label — drag handle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginLeft: 14, WebkitAppRegion: 'drag' } as React.CSSProperties}>
        <img src="./assets/ahg-logo.png" alt="" style={{ width: 18, height: 18, objectFit: 'contain' }} />
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: '0.18em',
            color: colors.textDim,
          }}
        >
          AHG UNLOCKER
        </span>

        {pageName && (
          <>
            <span style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.12)' }} />
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                letterSpacing: '0.1em',
                color: 'var(--acc, #a77dff)',
              }}
            >
              {pageName.toLocaleUpperCase(lang)}
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
          title={t('app.title.minimize')}
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
          title={isMaximized ? t('app.title.restore') : t('app.title.maximize')}
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
          title={t('app.title.close')}
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
