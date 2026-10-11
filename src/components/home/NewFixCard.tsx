import { memo, useState } from 'react'
import { ArrowRight, CircleCheck, Wrench } from 'lucide-react'
import type { Fix, Game } from '../../types'
import { getSteamImage } from '../../utils/gameHelpers'
import { useT } from '../../i18n'

const AMBER = '#f59e0b'

/** Home right column — "NEW FIX" spotlight (design: amber tag, header art, apply + all fixes). */
export const NewFixCard = memo(function NewFixCard({ fix, game, onApply, onAllFixes, onOpen }: {
  fix: Fix; game: Game; onApply: (fix: Fix, url?: string) => Promise<void>; onAllFixes: () => void; onOpen: (g: Game) => void
}) {
  const t = useT()
  const [state, setState] = useState<'idle' | 'applying' | 'done'>('idle')
  const url = fix.download_url || fix.download_urls?.[0]
  const note = fix.badges?.slice(0, 2).join(' · ') || (fix.fix_count > 1 ? t('app.fix.nAvailable', { n: fix.fix_count }) : t('app.fix.communityFix'))
  const apply = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setState('applying')
    try { await onApply(fix, url); setState('done') } catch { setState('idle') }
  }
  return (
    <div
      onClick={() => onOpen(game)}
      className="v2-lift relative overflow-hidden cursor-pointer flex-1"
      style={{ borderRadius: 22, border: '1px solid rgba(255,255,255,.08)', background: '#10101c', minHeight: 200, animation: 'v2-riseIn .45s .06s both' }}
    >
      <img src={game.header_image || getSteamImage(game.appid)} alt="" loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover" onError={e => { e.currentTarget.style.visibility = 'hidden' }} />
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(0deg, rgba(8,8,16,.97) 15%, rgba(8,8,16,.35) 75%)' }} />
      <span className="mono absolute" style={{ top: 14, insetInlineStart: 14, fontSize: 10.5, fontWeight: 600, letterSpacing: '.12em', padding: '4px 8px', borderRadius: 7, background: 'rgba(245,158,11,.92)', color: '#1f1300' }}>{t('app.fix.newFix')}</span>
      <div className="absolute flex flex-col gap-2" style={{ insetInline: 16, bottom: 14 }}>
        <div className="truncate" style={{ fontSize: 17, fontWeight: 650, lineHeight: 1.15 }}>{game.name || fix.name}</div>
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex items-center gap-[5px] flex-none whitespace-nowrap" style={{ height: 22, padding: '0 8px', borderRadius: 7, background: `color-mix(in oklch, ${AMBER} 20%, transparent)`, border: `1px solid color-mix(in oklch, ${AMBER} 35%, transparent)`, color: AMBER, fontSize: 11.5, fontWeight: 600, lineHeight: 1 }}>
            <Wrench size={12} />{fix.type || t('app.fix.fix')}
          </span>
          <span className="truncate" style={{ fontSize: 12.5, color: '#c9c8da' }}>{note}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {state === 'done' ? (
            <span className="flex items-center gap-1.5" style={{ fontSize: 12.5, fontWeight: 600, color: '#86efac' }}><CircleCheck size={15} />{t('app.fix.applied')}</span>
          ) : (
            <button onClick={apply} disabled={state === 'applying' || !url} className="border-0 cursor-pointer hover:brightness-110" style={{ height: 34, padding: '0 14px', borderRadius: 10, background: AMBER, color: '#1f1300', fontSize: 12.5, fontWeight: 650, opacity: state === 'applying' ? .6 : 1 }}>
              {state === 'applying' ? t('app.fix.applying') : t('app.fix.apply')}
            </button>
          )}
          <span className="flex-1" />
          <button onClick={e => { e.stopPropagation(); onAllFixes() }} className="v2-btn-glass flex items-center gap-1" style={{ height: 34, padding: '0 10px', borderRadius: 10, fontSize: 12 }}>
            {t('app.fix.allFixes')}<ArrowRight size={13} className="rtl-flip" />
          </button>
        </div>
      </div>
    </div>
  )
})
