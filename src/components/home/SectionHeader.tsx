import type { RefObject } from 'react'
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react'
import { useT } from '../../i18n'

/** v2 section header: tinted icon tile, 20px title, dim subtitle, optional rail arrows / see-all. */
export function SectionHeader({ icon: Icon, color, title, sub, scrollRef, step = 560, onSeeAll }: {
  icon?: any; color: string; title: string; sub?: string
  scrollRef?: RefObject<HTMLDivElement | null>; step?: number; onSeeAll?: () => void
}) {
  const t = useT()
  return (
    <div className="flex items-center gap-3">
      {Icon && (
        <span className="w-8 h-8 rounded-[10px] flex items-center justify-center flex-none"
          style={{ background: `color-mix(in oklch, ${color} 16%, transparent)`, color }}>
          <Icon size={16} />
        </span>
      )}
      <h2 className="m-0 text-[20px] font-semibold whitespace-nowrap" style={{ letterSpacing: '-.02em', color: '#f3f2fa' }}>{title}</h2>
      {sub && <span className="text-[13px] whitespace-nowrap overflow-hidden text-ellipsis" style={{ color: '#8b8aa3' }}>{sub}</span>}
      <span className="flex-1" />
      {onSeeAll && (
        <button onClick={onSeeAll} className="flex items-center gap-1 text-[13px] cursor-pointer border-0 bg-transparent hover:text-white" style={{ color: '#a6a5bb', transition: 'color .15s' }}>
          {t('app.side.seeAll')} <ArrowRight size={14} className="rtl-flip" />
        </button>
      )}
      {scrollRef && (
        <>
          <button aria-label={t('app.scroll.left')} className="v2-circ" onClick={() => scrollRef.current?.scrollBy({ left: -step, behavior: 'smooth' })}><ChevronLeft size={16} /></button>
          <button aria-label={t('app.scroll.right')} className="v2-circ" onClick={() => scrollRef.current?.scrollBy({ left: step, behavior: 'smooth' })}><ChevronRight size={16} /></button>
        </>
      )}
    </div>
  )
}
