import { memo, useState } from 'react'
import { AlertTriangle, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react'
import { COLORS } from '../../constants/colors'

interface ErrorStateProps {
  title?: string
  message?: string
  error?: Error | string | null
  onRetry?: () => void
  retryLabel?: string
  color?: string
}

/**
 * Error state component with inline SVG illustration, retry button,
 * and expandable error details.
 */
export const ErrorState = memo(function ErrorState({
  title = 'Something went wrong',
  message = 'An unexpected error occurred. Please try again.',
  error = null,
  onRetry,
  retryLabel = 'Try Again',
  color = COLORS.red,
}: ErrorStateProps) {
  const [showDetails, setShowDetails] = useState(false)

  const errorStr = error
    ? typeof error === 'string'
      ? error
      : error.message || String(error)
    : null

  return (
    <div className="text-center py-24 px-6">
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-4px); }
          40% { transform: translateX(4px); }
          60% { transform: translateX(-3px); }
          80% { transform: translateX(3px); }
        }
        @keyframes slowPulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        .error-state-shake {
          animation: shake 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        .error-state-pulse {
          animation: slowPulse 3s ease-in-out infinite;
        }
        .error-retry-btn:hover {
          transform: scale(1.04);
        }
        .error-retry-btn:active {
          transform: scale(0.96);
        }
      `}</style>

      {/* ── Warning icon container ── */}
      <div
        className="error-state-shake relative w-24 h-24 mx-auto mb-6 rounded-3xl flex items-center justify-center"
        style={{
          background: `linear-gradient(135deg, ${color}25 0%, ${color}10 100%)`,
          border: `1px solid ${color}30`,
          boxShadow: `0 0 40px ${color}15, 0 0 80px ${color}08`,
        }}
      >
        <div
          className="absolute inset-0 rounded-3xl error-state-pulse"
          style={{
            background: `radial-gradient(circle at 50% 50%, ${color}20 0%, transparent 70%)`,
          }}
        />
        <AlertTriangle size={44} style={{ color, position: 'relative', zIndex: 1 }} />
      </div>

      {/* ── Title ── */}
      <h3 className="text-2xl font-extrabold text-white mb-2 tracking-tight">{title}</h3>

      {/* ── Message ── */}
      <p className="text-base mb-7 max-w-md mx-auto" style={{ color: COLORS.textMuted }}>
        {message}
      </p>

      {/* ── Retry button ── */}
      {onRetry && (
        <button
          onClick={onRetry}
          className="error-retry-btn px-7 py-3 rounded-xl text-sm font-bold inline-flex items-center gap-2 cursor-pointer"
          style={{
            background: `linear-gradient(135deg, ${color}25 0%, ${color}12 100%)`,
            color,
            border: `1px solid ${color}45`,
            boxShadow: `0 4px 16px ${color}20`,
            transition: 'all 80ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <RefreshCw size={16} />
          {retryLabel}
        </button>
      )}

      {/* ── Expandable error details ── */}
      {errorStr && (
        <div className="mt-6 max-w-lg mx-auto">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer"
            style={{ color: COLORS.textMuted }}
          >
            {showDetails ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            Error details
          </button>
          {showDetails && (
            <pre
              className="mt-2 p-3 rounded-xl text-xs text-left overflow-auto max-h-32"
              style={{
                background: COLORS.bgDark,
                color: COLORS.red,
                border: `1px solid ${COLORS.red}25`,
                fontFamily: 'ui-monospace, SFMono-Regular, monospace',
              }}
            >
              {errorStr}
            </pre>
          )}
        </div>
      )}
    </div>
  )
})
