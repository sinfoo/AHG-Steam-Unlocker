import { forwardRef, memo } from 'react'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { COLORS } from '../../constants/colors'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const variantStyles: Record<
  NonNullable<ButtonProps['variant']>,
  { bg: string; color: string; border: string; shadow: string }
> = {
  primary: {
    bg: 'var(--acc,#a77dff)',
    color: '#0b0614',
    border: 'none',
    shadow: '0 16px 40px -14px var(--acc,#a77dff)',
  },
  secondary: {
    bg: 'rgba(255,255,255,0.06)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.14)',
    shadow: 'none',
  },
  ghost: {
    bg: 'transparent',
    color: COLORS.textSecondary,
    border: 'none',
    shadow: 'none',
  },
  danger: {
    bg: 'rgba(239,68,68,0.08)',
    color: '#fca5a5',
    border: '1px solid rgba(239,68,68,0.35)',
    shadow: 'none',
  },
}

const sizeStyles: Record<
  NonNullable<ButtonProps['size']>,
  { height: string; padding: string; fontSize: string; gap: string }
> = {
  sm: { height: '32px', padding: '0 12px', fontSize: '12px', gap: '6px' },
  md: { height: '40px', padding: '0 20px', fontSize: '14px', gap: '8px' },
  lg: { height: '48px', padding: '0 28px', fontSize: '16px', gap: '10px' },
}

export const Button = memo(forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled,
      leftIcon,
      rightIcon,
      children,
      style,
      ...rest
    },
    ref
  ) => {
    const v = variantStyles[variant]
    const s = sizeStyles[size]
    // Ghost has no resting background — give it a subtle hover affordance so it reads as interactive.
    const hoverBg = variant === 'ghost' ? 'rgba(255,255,255,0.06)' : undefined

    return (
      <motion.button
        ref={ref as any}
        disabled={disabled || isLoading}
        whileHover={disabled || isLoading ? undefined : { scale: 1.02, ...(hoverBg ? { backgroundColor: hoverBg } : {}), filter: variant === 'primary' ? 'brightness(1.1)' : undefined }}
        whileTap={disabled || isLoading ? undefined : { scale: 0.97 }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: '1',
          height: s.height,
          padding: s.padding,
          fontSize: s.fontSize,
          fontWeight: 650,
          fontFamily: 'Geist, Inter, -apple-system, BlinkMacSystemFont, sans-serif',
          gap: s.gap,
          background: v.bg,
          color: v.color,
          border: v.border,
          borderRadius: size === 'sm' ? '10px' : '13px',
          boxShadow: v.shadow,
          cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          transition: 'all 150ms cubic-bezier(.16,1,.3,1)',
          whiteSpace: 'nowrap',
          ...style,
        }}
        {...(rest as any)}
      >
        {isLoading ? (
          <motion.span
            key="spinner"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.08, ease: [0.4, 0, 0.2, 1] }}
            style={{ display: 'flex', alignItems: 'center' }}
          >
            <Loader2
              size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16}
              style={{ animation: 'spin 1s linear infinite' }}
            />
          </motion.span>
        ) : leftIcon ? (
          <span style={{ display: 'flex', alignItems: 'center' }}>{leftIcon}</span>
        ) : null}
        {children}
        {!isLoading && rightIcon && (
          <span style={{ display: 'flex', alignItems: 'center' }}>{rightIcon}</span>
        )}
      </motion.button>
    )
  }
))

Button.displayName = 'Button'
