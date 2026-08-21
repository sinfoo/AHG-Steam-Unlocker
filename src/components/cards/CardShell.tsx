import { useState, type ReactNode } from 'react'

// Transition constant — DESIGN.md: 80ms cubic-bezier(0.4, 0, 0.2, 1)
const T = '0.08s cubic-bezier(0.4, 0, 0.2, 1)'

export interface CardShellProps {
  /** Children can be a render function receiving isHovered, or a ReactNode */
  children: ReactNode | ((isHovered: boolean) => ReactNode)
  genreHue: number
  variant: 'grid' | 'list' | 'hero'
  index?: number
  onContextMenu?: (e: React.MouseEvent) => void
  onClick?: () => void
  className?: string
  /** Extra styles merged into the shell's style object */
  style?: React.CSSProperties
  /** Aspect ratio override (defaults: grid=16/9, hero=21/9, list=auto) */
  aspectRatio?: string
}

function getAspectRatio(variant: CardShellProps['variant'], override?: string): string | undefined {
  if (override) return override
  switch (variant) {
    case 'grid': return undefined // Cover has its own 16/9; shell should not constrain
    case 'hero': return '21/9'
    case 'list': return undefined
  }
}

export function CardShell({
  children, genreHue, variant, index = 0,
  onContextMenu, onClick, className = '', style, aspectRatio,
}: CardShellProps) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div
      className={`page-enter group cursor-pointer overflow-hidden ${className}`}
      style={{
        '--ghue': genreHue,
        animationDelay: Math.min(index * 30, 80) + 'ms',
        aspectRatio: getAspectRatio(variant, aspectRatio),
        background: variant === 'list'
          ? (isHovered
              ? `linear-gradient(135deg, hsla(${genreHue}, 50%, 25%, 0.12), rgba(18,18,31,0.30))`
              : 'rgba(18,18,31,0.30)')
          : `linear-gradient(160deg, rgba(18,18,31,0.40) 0%, rgba(12,12,24,0.55) 100%)`,
        backdropFilter: 'blur(20px) saturate(1.3)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.3)',
        borderRadius: '1rem',
        zIndex: isHovered ? 20 : 1,
        border: isHovered
          ? `1px solid hsla(${genreHue}, 55%, 55%, 0.35)`
          : '1px solid rgba(255,255,255,0.06)',
        boxShadow: isHovered
          ? `0 16px 48px hsla(${genreHue}, 50%, 15%, 0.50), 0 0 80px hsla(${genreHue}, 60%, 35%, 0.08), 0 0 0 1px hsla(${genreHue}, 60%, 50%, 0.10)`
          : '0 2px 4px rgba(0,0,0,0.20), 0 8px 24px rgba(0,0,0,0.12)',
        transform: variant === 'list'
          ? (isHovered ? 'translateX(4px)' : 'translateX(0)')
          : (isHovered ? 'translateY(-4px) scale(1.02)' : 'translateY(0) scale(1)'),
        willChange: 'transform',
        transition: `transform ${T}, box-shadow ${T}`,
        ...style,
      } as React.CSSProperties}
      onClick={onClick}
      onContextMenu={onContextMenu ? (e) => { e.preventDefault(); onContextMenu(e) } : undefined}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Ambient genre glow */}
      <div
        className={`card-ambient-glow ${isHovered ? 'active' : ''}`}
        style={{ '--ghue': genreHue } as React.CSSProperties}
      />

      {typeof children === 'function' ? children(isHovered) : children}

      {/* Animated hover border glow */}
      <div
        className={`card-border-glow ${isHovered ? 'active' : ''}`}
        style={{ '--ghue': genreHue } as React.CSSProperties}
      />
    </div>
  )
}
