import { useState, type ReactNode } from 'react'

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
        // v2: flat surface + hairline; hover lifts and tints border/shadow with the user accent
        background: variant === 'list' && isHovered ? 'rgba(255,255,255,0.04)' : 'var(--s1, #0f0f1b)',
        borderRadius: variant === 'list' ? '14px' : '16px',
        zIndex: isHovered ? 20 : 1,
        border: isHovered
          ? '1px solid color-mix(in oklch, var(--acc) 55%, transparent)'
          : '1px solid rgba(255,255,255,0.07)',
        boxShadow: isHovered
          ? '0 30px 50px -22px color-mix(in oklch, var(--acc) 60%, transparent)'
          : '0 12px 30px -18px rgba(0,0,0,0.9)',
        transform: variant === 'list'
          ? (isHovered ? 'translateX(4px)' : 'translateX(0)')
          : (isHovered ? 'translateY(-5px) scale(1.015)' : 'translateY(0) scale(1)'),
        willChange: 'transform',
        transition: 'transform .5s var(--ease-out), box-shadow .5s, border-color .3s, background .15s',
        ...style,
      } as React.CSSProperties}
      onClick={onClick}
      onContextMenu={onContextMenu ? (e) => { e.preventDefault(); onContextMenu(e) } : undefined}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >

      {typeof children === 'function' ? children(isHovered) : children}

    </div>
  )
}
