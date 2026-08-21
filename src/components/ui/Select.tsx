import { forwardRef, memo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { COLORS } from '../../constants/colors'

export interface SelectProps {
  label?: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  error?: string
  placeholder?: string
  disabled?: boolean
}

const transitionCSS = 'all 80ms cubic-bezier(0.4, 0, 0.2, 1)'

export const Select = memo(forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, value, onChange, options, error, placeholder, disabled, ...rest }, ref) => {
    const [focused, setFocused] = useState(false)

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {label && (
          <label
            style={{
              fontSize: '13px',
              fontWeight: 500,
              color: COLORS.textSecondary,
              userSelect: 'none',
            }}
          >
            {label}
          </label>
        )}
        <div style={{ position: 'relative' }}>
          <select
            ref={ref}
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            onFocus={(e) => {
              setFocused(true)
              ;(rest as any).onFocus?.(e)
            }}
            onBlur={(e) => {
              setFocused(false)
              ;(rest as any).onBlur?.(e)
            }}
            style={{
              width: '100%',
              height: '40px',
              padding: '0 40px 0 16px',
              fontSize: '14px',
              fontWeight: 400,
              color: value ? COLORS.text : COLORS.textMuted,
              background: COLORS.bgMid,
              border: `1px solid ${error ? COLORS.red : focused ? COLORS.violet : COLORS.border}`,
              borderRadius: '0.75rem',
              outline: 'none',
              transition: transitionCSS,
              boxShadow: focused
                ? `0 0 0 2px ${COLORS.violetDim}, 0 0 0 1px ${COLORS.violet}`
                : error
                  ? `0 0 0 1px ${COLORS.red}`
                  : 'none',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.5 : 1,
              appearance: 'none',
              MozAppearance: 'none',
              WebkitAppearance: 'none',
            }}
            {...(rest as any)}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={16}
            style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: COLORS.textMuted,
              pointerEvents: 'none',
              transition: transitionCSS,
              rotate: focused ? '180deg' : '0deg',
            }}
          />
        </div>
        {error && (
          <span
            style={{
              fontSize: '12px',
              color: COLORS.red,
              fontWeight: 500,
              marginTop: '2px',
            }}
          >
            {error}
          </span>
        )}
      </div>
    )
  }
))
Select.displayName = 'Select'
