import { memo } from 'react'
import { Download, RefreshCw, FolderHeart, Heart, Zap } from 'lucide-react'
import { SectionHeader } from './SectionHeader'
import type { ColorScheme } from '../../types/colors'
import { useT } from '../../i18n'

export const QuickActionsCard = memo(function QuickActionsCard({ colors, installedCount, favoritesCount, onDownloadFix, onRefreshGames, onMyLibrary, onFavorites }: { colors: ColorScheme; installedCount: number; favoritesCount: number; onDownloadFix?: () => void; onRefreshGames?: () => void; onMyLibrary?: () => void; onFavorites?: () => void }) {
  const t = useT()
  const actions = [
    { icon: Download, label: t('app.qa.downloadFix'), color: colors.green, desc: t('app.qa.downloadFixDesc') },
    { icon: RefreshCw, label: t('app.qa.refresh'), color: colors.blue, desc: t('app.qa.refreshDesc') },
    { icon: FolderHeart, label: t('app.home.myLibrary'), color: colors.violet, desc: t('app.count.games', { n: installedCount }) },
    { icon: Heart, label: t('app.nav.favourites'), color: colors.pink, desc: t('app.qa.saved', { n: favoritesCount }) },
  ]
  const handlers = [onDownloadFix, onRefreshGames, onMyLibrary, onFavorites]

  return (
    <section className="v2-panel p-[18px] flex flex-col gap-3.5 v2-rise">
      <SectionHeader icon={Zap} color="var(--acc)" title={t('app.qa.title')} sub={t('app.qa.sub')} />
      <div className="grid grid-cols-2 gap-2">
        {actions.map((action, i) => (
          <button
            key={action.label}
            onClick={() => handlers[i]?.()}
            className="text-start cursor-pointer border-0 text-white flex flex-col gap-[5px] p-3 rounded-[14px]"
            style={{ background: 'rgba(255,255,255,.035)', transition: 'background .15s, transform .2s var(--ease-out)', animation: `v2-riseIn .4s ${0.05 + i * 0.05}s both` }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.07)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,.035)'; e.currentTarget.style.transform = '' }}
          >
            <action.icon size={16} style={{ color: action.color }} />
            <span className="text-[13.5px] font-semibold" style={{ color: colors.text }}>{action.label}</span>
            <span className="text-[11.5px]" style={{ color: colors.textDim }}>{action.desc}</span>
          </button>
        ))}
      </div>
    </section>
  )
})
