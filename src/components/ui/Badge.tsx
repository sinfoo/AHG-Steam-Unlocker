import { memo } from 'react'
import { COLORS } from '../../constants/colors'

export interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'violet'
  size?: 'sm' | 'md'
  children: React.ReactNode
}

const variantStyles: Record<
  NonNullable<BadgeProps['variant']>,
  { bg: string; color: string }
> = {
  default: { bg: 'rgba(255,255,255,0.1)', color: '#e4e3f0' },
  success: { bg: COLORS.greenDim, color: COLORS.green },
  warning: { bg: COLORS.amberDim, color: COLORS.amber },
  error: { bg: COLORS.redDim, color: COLORS.red },
  info: { bg: COLORS.blueDim, color: COLORS.blue },
  violet: { bg: 'color-mix(in oklch, var(--acc,#a77dff) 16%, transparent)', color: 'var(--acc,#a77dff)' },
}

const sizeStyles: Record<
  NonNullable<BadgeProps['size']>,
  { padding: string; fontSize: string; height: string }
> = {
  sm: { padding: '2px 8px', fontSize: '11px', height: '20px' },
  md: { padding: '4px 12px', fontSize: '12px', height: '24px' },
}

export const Badge = memo(function Badge({
  variant = 'default',
  size = 'md',
  children,
}: BadgeProps) {
  const v = variantStyles[variant]
  const s = sizeStyles[size]

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        height: s.height,
        padding: s.padding,
        fontSize: s.fontSize,
        fontWeight: 600,
        borderRadius: '8px',
        background: v.bg,
        color: v.color,
        whiteSpace: 'nowrap',
        userSelect: 'none',
        lineHeight: 1,
      }}
    >
      {children}
    </span>
  )
})
