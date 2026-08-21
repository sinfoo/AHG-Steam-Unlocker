import { memo } from 'react'
import { Download, RefreshCw, FolderHeart, Heart, Zap } from 'lucide-react'
import type { ColorScheme } from '../../types/colors'

export const QuickActionsCard = memo(function QuickActionsCard({ colors, installedCount, favoritesCount, onDownloadFix, onRefreshGames, onMyLibrary, onFavorites }: { colors: ColorScheme; installedCount: number; favoritesCount: number; onDownloadFix?: () => void; onRefreshGames?: () => void; onMyLibrary?: () => void; onFavorites?: () => void }) {
  const actions = [
    { icon: Download, label: 'Download Fix', color: colors.green, desc: 'Get latest fixes' },
    { icon: RefreshCw, label: 'Refresh Games', color: colors.blue, desc: 'Update game list' },
    { icon: FolderHeart, label: 'My Library', color: colors.violet, desc: `${installedCount} games` },
    { icon: Heart, label: 'Favorites', color: colors.pink, desc: `${favoritesCount} saved` },
  ]
  
  return (
    <div 
      className="rounded-3xl p-5 entrance-fade-up"
      style={{ background: `linear-gradient(135deg, ${colors.violet}10 0%, ${colors.bgCard} 100%)`, border: `1px solid ${colors.violet}20` }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: colors.violet + '25' }}>
          <Zap size={20} style={{ color: colors.violet }} />
        </div>
        <div>
          <h3 className="text-lg font-bold" style={{ color: colors.text }}>Quick Actions</h3>
          <p className="text-xs" style={{ color: colors.textMuted }}>Common tasks</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {actions.map((action, i) => (
          <button
            key={action.label}
            onClick={() => { const handlers = [onDownloadFix, onRefreshGames, onMyLibrary, onFavorites]; handlers[i]?.() }}
            className="p-4 rounded-2xl text-left relative overflow-hidden group hover-lift entrance-fade-up"
            style={{
              animationDelay: `${0.1 + i * 0.05}s`,
              background: `linear-gradient(135deg, ${action.color}18 0%, ${action.color}08 100%)`,
              border: `1px solid ${action.color}30`,
              boxShadow: `0 2px 8px ${action.color}10`,
              transition: 'all 80ms cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            {/* Subtle radial glow on hover */}
            <div
              className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-80"
              style={{
                background: `radial-gradient(120% 100% at 50% 0%, ${action.color}25 0%, transparent 70%)`,
              }}
            />
            <div
              className="mb-2 relative z-10 hover-spin-icon transition-transform duration-80"
            >
              <action.icon size={24} style={{ color: action.color }} />
            </div>
            <p className="text-sm font-bold relative z-10" style={{ color: colors.text }}>{action.label}</p>
            <p className="text-xs relative z-10" style={{ color: colors.textMuted }}>{action.desc}</p>
          </button>
        ))}
      </div>
    </div>
  )
})
