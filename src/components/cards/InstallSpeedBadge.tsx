import { Zap } from 'lucide-react'

interface InstallSpeedBadgeProps {
  sizeBytes: number | string | undefined | null
  className?: string
  size?: 'sm' | 'md'
}

function estimateInstallTime(bytes: number): string {
  // Rough estimate: ~50MB/s for decompression + write
  const seconds = bytes / (50 * 1024 * 1024)
  if (seconds < 60) return '<1 min'
  if (seconds < 120) return '~1 min'
  const mins = Math.ceil(seconds / 60)
  if (mins >= 60) return `~${Math.floor(mins / 60)}h ${mins % 60}m`
  return `~${mins} min`
}

export function InstallSpeedBadge({ sizeBytes, className = '', size = 'sm' }: InstallSpeedBadgeProps) {
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
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}
    >
      <Zap size={size === 'sm' ? 9 : 11} />
      <span>{estimateInstallTime(bytes)}</span>
    </div>
  )
}
