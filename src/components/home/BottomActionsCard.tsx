import { memo } from 'react'
import { LayoutGrid, FolderHeart, Heart, Settings } from 'lucide-react'
import { SectionHeader } from './SectionHeader'
import type { ColorScheme } from '../../types/colors'
import { useT } from '../../i18n'

export const BottomActionsCard = memo(function BottomActionsCard({ onBrowse, onLibrary, onFavorites, onSettings, colors }: {
  onBrowse: () => void; onLibrary: () => void; onFavorites: () => void; onSettings: () => void; colors: ColorScheme
}) {
  const t = useT()
  const actions = [
    { icon: LayoutGrid, label: t('app.home.browseAll'), desc: t('app.home.browseAllDesc'), color: colors.violet, action: onBrowse },
    { icon: FolderHeart, label: t('app.home.myLibrary'), desc: t('app.home.installedGames'), color: colors.green, action: onLibrary },
    { icon: Heart, label: t('app.nav.favourites'), desc: t('app.home.yourPicks'), color: colors.pink, action: onFavorites },
    { icon: Settings, label: t('app.nav.settings'), desc: t('app.home.customize'), color: colors.amber, action: onSettings },
  ]

  return (
    <section className="v2-panel p-5 flex flex-col gap-4 v2-rise">
      <SectionHeader icon={LayoutGrid} color="var(--acc)" title={t('app.home.explore')} sub={t('app.home.exploreSub')} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {actions.map((action, i) => (
          <button
            key={action.label}
            onClick={action.action}
            className="v2-lift text-start cursor-pointer border-0 text-white p-4 rounded-2xl flex flex-col gap-1.5"
            style={{ background: `linear-gradient(135deg, color-mix(in oklch, ${action.color} 16%, #0d0d18) 0%, #0d0d18 80%)`, border: `1px solid color-mix(in oklch, ${action.color} 28%, transparent)`, animation: `v2-riseIn .4s ${i * 0.06}s both` }}
          >
            <action.icon size={20} style={{ color: action.color }} />
            <span className="text-[15px] font-semibold" style={{ color: colors.text }}>{action.label}</span>
            <span className="mono text-[11px]" style={{ color: colors.textDim }}>{action.desc}</span>
          </button>
        ))}
      </div>
    </section>
  )
})
