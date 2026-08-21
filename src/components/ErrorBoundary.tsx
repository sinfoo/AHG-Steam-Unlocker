import { Component, type ReactNode, type ErrorInfo } from 'react'
import { COLORS } from '../constants/colors'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="flex flex-col items-center justify-center h-full gap-3 px-6 py-12">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl" style={{ background: COLORS.redDim, color: COLORS.red }}>
            !
          </div>
          <p className="text-sm font-bold" style={{ color: COLORS.red }}>Something went wrong</p>
          <p className="text-xs max-w-md text-center" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {this.state.error?.message || 'Unknown error'}
          </p>
        </div>
      )
    }
    return this.props.children
  }
}
