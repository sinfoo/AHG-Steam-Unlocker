import { memo } from 'react'
import { motion } from 'framer-motion'
import { COLORS } from '../../constants/colors'

export interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  label?: string
}

const springConfig = { stiffness: 250, damping: 20 }

export const Toggle = memo(function Toggle({ checked, onChange, disabled, label }: ToggleProps) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '10px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
      onClick={() => {
        if (!disabled) onChange(!checked)
      }}
      role="switch"
      aria-checked={checked}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onChange(!checked)
        }
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '56px',
          height: '32px',
          borderRadius: '9999px',
          background: checked ? COLORS.violet : 'rgba(255,255,255,0.15)',
          transition: 'background 80ms cubic-bezier(0.4, 0, 0.2, 1)',
          flexShrink: 0,
        }}
      >
        <motion.div
          layout
          transition={{ type: 'spring', ...springConfig }}
          style={{
            position: 'absolute',
            top: '4px',
            left: checked ? '30px' : '4px',
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            background: COLORS.white,
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          }}
        />
      </div>
      {label && (
        <span
          style={{
            fontSize: '14px',
            fontWeight: 500,
            color: COLORS.textSecondary,
            userSelect: 'none',
          }}
        >
          {label}
        </span>
      )}
    </div>
  )
})
