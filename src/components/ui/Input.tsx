import { forwardRef, memo, useState } from 'react'
import { COLORS } from '../../constants/colors'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  leftIcon?: React.ReactNode
}

const transitionCSS = 'all 150ms cubic-bezier(.16,1,.3,1)'

export const Input = memo(forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, leftIcon, disabled, style, ...rest }, ref) => {
    const [focused, setFocused] = useState(false)

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {label && (
          <label
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: COLORS.textDim,
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
                insetInlineStart: '12px',
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
              height: '44px',
              paddingBlock: 0, paddingInline: leftIcon ? '40px 16px' : '16px',
              fontSize: '14px',
              fontWeight: 400,
              color: COLORS.text,
              background: 'rgba(0,0,0,0.25)',
              border: `1px solid ${error ? COLORS.red : focused ? 'var(--acc,#a77dff)' : 'rgba(255,255,255,0.09)'}`,
              borderRadius: '12px',
              outline: 'none',
              transition: transitionCSS,
              boxShadow: focused
                ? '0 0 0 4px color-mix(in oklch, var(--acc,#a77dff) 18%, transparent)'
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
