import { memo } from 'react'
import { LayoutGrid, FolderHeart, Heart, Settings } from 'lucide-react'
import type { ColorScheme } from '../../types/colors'

export const BottomActionsCard = memo(function BottomActionsCard({ onBrowse, onLibrary, onFavorites, onSettings, colors }: {
  onBrowse: () => void; onLibrary: () => void; onFavorites: () => void; onSettings: () => void; colors: ColorScheme
}) {
  const actions = [
    { icon: LayoutGrid, label: 'Browse All', desc: '170,000+ games', color: colors.violet, action: onBrowse },
    { icon: FolderHeart, label: 'My Library', desc: 'Installed games', color: colors.green, action: onLibrary },
    { icon: Heart, label: 'Favorites', desc: 'Your picks', color: colors.pink, action: onFavorites },
    { icon: Settings, label: 'Settings', desc: 'Customize', color: colors.amber, action: onSettings },
  ]
  
  return (
    <div 
      className="rounded-3xl p-6 entrance-fade-up"
      style={{ background: colors.bgCard, border: `1px solid ${colors.border}` }}
    >
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-xl font-bold" style={{ color: colors.text }}>Explore</h3>
        <p className="text-sm" style={{ color: colors.textMuted }}>Navigate the app</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {actions.map((action, i) => (
          <button
            key={action.label}
            onClick={action.action}
            className="p-5 rounded-2xl text-left hover-lift entrance-fade-up"
            style={{ 
              animationDelay: `${i * 0.1}s`,
              background: `${action.color}15`,
              border: `1px solid ${action.color}30`,
              boxShadow: `0 4px 20px ${action.color}10`
            }}
          >
            <action.icon size={32} style={{ color: action.color }} className="mb-3" />
            <p className="text-lg font-bold" style={{ color: colors.text }}>{action.label}</p>
            <p className="text-sm" style={{ color: colors.textMuted }}>{action.desc}</p>
          </button>
        ))}
      </div>
    </div>
  )
})
