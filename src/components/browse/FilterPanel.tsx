import { memo } from 'react'
import { Check } from 'lucide-react'
import { useT } from '../../i18n'
import { useGenreLabel } from '../../utils/genreLabel'

const MONO = "'Geist Mono Variable','Geist Mono',monospace"
const LBL: React.CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: '.14em', color: '#77768e' }

export type ToggleKey = 'fix' | 'coop' | 'lib' | 'notLib' | 'fav'
export interface BrowseFilters { genres: string[]; fix: boolean; coop: boolean; lib: boolean; notLib: boolean; fav: boolean }
export const EMPTY_FILTERS: BrowseFilters = { genres: [], fix: false, coop: false, lib: false, notLib: false, fav: false }
export const TOGGLES: ReadonlyArray<readonly [ToggleKey, 'app.browse.hasFix' | 'app.browse.coop' | 'app.browse.inLib' | 'app.browse.notInLib' | 'app.browse.favOnly']> = [
  ['fix', 'app.browse.hasFix'], ['coop', 'app.browse.coop'], ['lib', 'app.browse.inLib'], ['notLib', 'app.browse.notInLib'], ['fav', 'app.browse.favOnly'],
]

/** Left filter panel (design: 236px sticky aside — genre checklist + SHOW toggles). */
const FilterPanel = memo(function FilterPanel({ genres, filters, onGenre, onToggle }: {
  genres: { id: string; n: number }[]; filters: BrowseFilters
  onGenre: (id: string) => void; onToggle: (k: ToggleKey) => void
}) {
  const t = useT()
  const gl = useGenreLabel()
  return (
    <aside aria-label={t('app.browse.filterPanel')} style={{ width: 236, flex: 'none', position: 'sticky', top: 0, borderRadius: 22, background: 'color-mix(in oklch, var(--s2,#151524) 80%, transparent)', border: '1px solid rgba(255,255,255,.07)', padding: 16, display: 'flex', flexDirection: 'column', gap: 18, animation: 'v2-actLeft .3s cubic-bezier(.16,1,.3,1) both' }}>
      {genres.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ ...LBL, marginBottom: 4 }}>{t('app.browse.genre')}</span>
          {genres.map(g => {
            const on = filters.genres.includes(g.id)
            return (
              <button key={g.id} onClick={() => onGenre(g.id)} role="checkbox" aria-checked={on} className="v2-pop-item"
                style={{ height: 34, border: 'none', borderRadius: 9, background: 'transparent', color: on ? '#fff' : '#c9c8da', display: 'flex', alignItems: 'center', gap: 10, padding: '0 6px', cursor: 'pointer', fontSize: 13, transition: 'background .12s' }}>
                <span style={{ width: 18, height: 18, borderRadius: 6, border: `1.5px solid ${on ? 'var(--acc,#a77dff)' : 'rgba(255,255,255,.25)'}`, background: on ? 'var(--acc,#a77dff)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s', flex: 'none' }}>
                  {on && <Check size={12} color="#0b0614" style={{ animation: 'v2-checkPop .25s both' }} />}
                </span>
                <span style={{ flex: 1, textAlign: 'start', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{gl(g.id)}</span>
                <span style={{ fontFamily: MONO, fontSize: 11, color: '#77768e' }}>{g.n.toLocaleString()}</span>
              </button>
            )
          })}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ ...LBL, marginBottom: 4 }}>{t('app.browse.show')}</span>
        {TOGGLES.map(([k, label]) => {
          const on = filters[k]
          return (
            <button key={k} onClick={() => onToggle(k)} role="switch" aria-checked={on} className="v2-pop-item"
              style={{ height: 36, border: 'none', borderRadius: 9, background: 'transparent', color: '#e4e3f0', display: 'flex', alignItems: 'center', gap: 10, padding: '0 6px', cursor: 'pointer', fontSize: 13 }}>
              <span style={{ flex: 1, textAlign: 'start' }}>{t(label)}</span>
              <span style={{ position: 'relative', width: 34, height: 20, borderRadius: 10, background: on ? 'var(--acc,#a77dff)' : 'rgba(255,255,255,.14)', transition: 'background .2s', flex: 'none' }}>
                <span style={{ position: 'absolute', top: 2, insetInlineStart: 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transform: `translateX(${on ? 14 : 0}px)`, transition: 'transform .3s cubic-bezier(.34,1.56,.64,1)' }} />
              </span>
            </button>
          )
        })}
      </div>
    </aside>
  )
})
export default FilterPanel
