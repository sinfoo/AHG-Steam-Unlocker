import { Wrench } from 'lucide-react'
import type { Game } from '../../types'
import { PageBanner } from '../PageParts'
import { useT } from '../../i18n'

const HDR = ['header.jpg'] as const

export default function FixesHero({ covers, total, applied, reduced }: { covers: Game[]; total: number; applied: number; reduced: boolean }) {
  const t = useT()
  return (
    <PageBanner
      icon={Wrench} color="#fbbf24" eyebrow={t('app.fixes.hdrEyebrow')} title={t('app.nav.fixes')} sub={t('app.fixes.hdrSub')}
      games={covers} reduced={reduced} imageTypes={HDR}
      stats={[
        { v: total.toLocaleString(), label: t('app.fixes.available') },
        { v: applied.toLocaleString(), label: t('app.fix.applied'), color: '#86efac' },
      ]}
    />
  )
}
