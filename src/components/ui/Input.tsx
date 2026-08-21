import { forwardRef, memo, useState } from 'react'
import { COLORS } from '../../constants/colors'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  leftIcon?: React.ReactNode
}

const transitionCSS = 'all 80ms cubic-bezier(0.4, 0, 0.2, 1)'

export const Input = memo(forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, leftIcon, disabled, style, ...rest }, ref) => {
    const [focused, setFocused] = useState(false)

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
          {leftIcon && (
            <span
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: COLORS.textMuted,
                display: 'flex',
                alignItems: 'center',
                pointerEvents: 'none',
              }}
            >
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            disabled={disabled}
            onFocus={(e) => {
              setFocused(true)
              rest.onFocus?.(e)
            }}
            onBlur={(e) => {
              setFocused(false)
              rest.onBlur?.(e)
            }}
            style={{
              width: '100%',
              height: '40px',
              padding: leftIcon ? '0 16px 0 40px' : '0 16px',
              fontSize: '14px',
              fontWeight: 400,
              color: COLORS.text,
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
              cursor: disabled ? 'not-allowed' : 'text',
              opacity: disabled ? 0.5 : 1,
              ...style,
            }}
            {...rest}
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
Input.displayName = 'Input'
