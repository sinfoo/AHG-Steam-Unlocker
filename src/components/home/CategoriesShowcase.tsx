import { memo } from 'react'
import { Sword, Compass, Shield, Target, Settings, Trophy, Zap, Skull, Gem, Gift, Rocket, Users, LayoutGrid } from 'lucide-react'
import type { ColorScheme } from '../../types/colors'

export const CategoriesShowcase = memo(function CategoriesShowcase({ onCategoryClick, colors }: { onCategoryClick: (genre: string) => void; colors: ColorScheme }) {
  const categories = [
    { name: 'Action', icon: Sword, color: colors.red, emoji: '⚔️' },
    { name: 'Adventure', icon: Compass, color: colors.green, emoji: '🗺️' },
    { name: 'RPG', icon: Shield, color: colors.blue, emoji: '🛡️' },
    { name: 'Strategy', icon: Target, color: colors.amber, emoji: '🎯' },
    { name: 'Simulation', icon: Settings, color: colors.cyan, emoji: '🔧' },
    { name: 'Sports', icon: Trophy, color: colors.green, emoji: '🏆' },
    { name: 'Racing', icon: Zap, color: colors.pink, emoji: '🏎️' },
    { name: 'Horror', icon: Skull, color: colors.red, emoji: '👻' },
    { name: 'Indie', icon: Gem, color: colors.violet, emoji: '💎' },
    { name: 'Free to Play', icon: Gift, color: colors.green, emoji: '🎁' },
    { name: 'Early Access', icon: Rocket, color: colors.amber, emoji: '🚀' },
    { name: 'Multiplayer', icon: Users, color: colors.blue, emoji: '👥' },
  ]
  
  return (
    <div 
      className="rounded-3xl p-6 entrance-fade-up"
      style={{ background: colors.bgCard, border: `1px solid ${colors.border}` }}
    >
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: colors.violet + '25' }}>
          <LayoutGrid size={20} style={{ color: colors.violet }} />
        </div>
        <div>
          <h3 className="text-lg font-bold" style={{ color: colors.text }}>Browse by Category</h3>
          <p className="text-xs" style={{ color: colors.textMuted }}>Find games by genre</p>
        </div>
      </div>
      <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-3">
        {categories.map((cat) => (
          <button
            key={cat.name}
            onClick={() => onCategoryClick(cat.name)}
            className="p-4 rounded-2xl text-center cursor-pointer hover:scale-105"
            style={{
              background: `${cat.color}15`,
              border: `1px solid ${cat.color}30`,
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            <div className="text-2xl mb-1">{cat.emoji}</div>
            <p className="text-xs font-medium" style={{ color: cat.color }}>{cat.name}</p>
          </button>
        ))}
      </div>
    </div>
  )
})
