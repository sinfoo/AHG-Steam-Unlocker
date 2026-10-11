import { Zap } from 'lucide-react'
import { useT } from '../../i18n'

interface InstallSpeedBadgeProps {
  sizeBytes: number | string | undefined | null
  className?: string
  size?: 'sm' | 'md'
}

function estimateInstallTime(bytes: number, t: ReturnType<typeof useT>): string {
  // Rough estimate: ~50MB/s for decompression + write
  const seconds = bytes / (50 * 1024 * 1024)
  if (seconds < 60) return t('app.time.lt1min')
  if (seconds < 120) return t('app.time.min', { n: 1 })
  const mins = Math.ceil(seconds / 60)
  if (mins >= 60) return t('app.time.hm', { h: Math.floor(mins / 60), m: mins % 60 })
  return t('app.time.min', { n: mins })
}

export function InstallSpeedBadge({ sizeBytes, className = '', size = 'sm' }: InstallSpeedBadgeProps) {
  const t = useT()
  if (sizeBytes === undefined || sizeBytes === null) return null
  const bytes = typeof sizeBytes === 'string' ? parseInt(sizeBytes) : sizeBytes
  if (!bytes || bytes <= 0) return null

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-lg font-bold pointer-events-none select-none ${
        size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1'
      } ${className}`}
      style={{
        background: 'rgba(250,204,21,0.12)',
        color: '#facc15',
        border: '1px solid rgba(250,204,21,0.20)',
        WebkitBackdropFilter: 'blur(4px)',
      }}
    >
      <Zap size={size === 'sm' ? 9 : 11} />
      <span>{estimateInstallTime(bytes, t)}</span>
    </div>
  )
}
