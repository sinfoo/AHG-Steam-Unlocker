import type { RefObject } from 'react'
import { Search, Sparkles, Wrench, Layers } from 'lucide-react'
import type { ColorScheme } from '../shared'
import { FIX_FILTERS } from '../../utils/gameHelpers'
import { useT, type TKey } from '../../i18n'
import { useFixTagLabel } from '../../utils/genreLabel'

const MONO = "'Geist Mono Variable','Geist Mono',monospace"

interface FixesToolbarProps {
  colors: ColorScheme
  fixSearchQuery: string
  setFixSearchQuery: (q: string) => void
  fixesFuzzyActiveRef: RefObject<boolean | null>
  fixSourceFilter: 'all' | 'ryuu' | 'online'
  setFixSourceFilter: (v: 'all' | 'ryuu' | 'online') => void
  fixFilter: string[]
  toggleFixFilter: (id: string) => void
}

const SOURCES = [
  { id: 'ryuu', label: 'app.fixes.srcSteam', Icon: Sparkles },
  { id: 'online', label: 'app.fixes.srcOnline', Icon: Wrench },
  { id: 'all', label: 'app.fixtag.all', Icon: Layers },
] as const satisfies ReadonlyArray<{ id: string; label: TKey; Icon: unknown }>

export default function FixesToolbar({
  fixSearchQuery, setFixSearchQuery, fixesFuzzyActiveRef,
  fixSourceFilter, setFixSourceFilter, fixFilter, toggleFixFilter,
}: FixesToolbarProps) {
  const t = useT()
  const ft = useFixTagLabel()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, animation: 'v2-riseIn .35s .04s both' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: 'min(300px,100%)' }}>
          <Search size={15} style={{ position: 'absolute', insetInlineStart: 13, top: '50%', transform: 'translateY(-50%)', color: '#8b8aa3' }} />
          <input
            type="text"
            aria-label={t('app.fixes.search')}
            placeholder={t('app.fixes.searchPlaceholder')}
            value={fixSearchQuery}
            onChange={(e) => setFixSearchQuery(e.target.value)}
            className="v2-field"
            style={{ width: '100%', height: 36, borderRadius: 11, border: '1px solid rgba(255,255,255,.09)', background: 'var(--s2,#151524)', color: '#fff', fontSize: 13, paddingInlineStart: 36, paddingInlineEnd: 12, outline: 'none', transition: 'border-color .2s, box-shadow .2s' }}
          />
          {fixesFuzzyActiveRef.current && (
            <span style={{ position: 'absolute', insetInlineEnd: 10, top: '50%', transform: 'translateY(-50%)', fontFamily: MONO, fontSize: 10, fontWeight: 600, letterSpacing: '.1em', padding: '2px 6px', borderRadius: 6, color: 'var(--acc,#a77dff)', background: 'color-mix(in oklch, var(--acc,#a77dff) 15%, transparent)' }}>
              {t('app.fixes.fuzzy')}
            </span>
          )}
        </div>

        <span style={{ flex: 1 }} />

        {/* Source segmented control */}
        <div role="group" aria-label={t('app.fixes.source')} style={{ display: 'flex', gap: 2, padding: 3, borderRadius: 11, background: 'rgba(0,0,0,.28)', border: '1px solid rgba(255,255,255,.06)' }}>
          {SOURCES.map(({ id, label, Icon }) => {
            const on = fixSourceFilter === id
            return (
              <button
                key={id}
                onClick={() => setFixSourceFilter(id)}
                aria-pressed={on}
                className="v2-seg-btn"
                style={{
                  height: 28, padding: '0 12px', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: on ? 'rgba(255,255,255,.1)' : 'transparent',
                  color: on ? '#fff' : '#8b8aa3',
                  boxShadow: on ? '0 2px 8px -2px rgba(0,0,0,.5)' : 'none',
                }}
              >
                <Icon size={13} />
                {t(label)}
              </button>
            )
          })}
        </div>
      </div>

      {/* Badge filter chips */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {(FIX_FILTERS as { id: string; label: string; color: string }[]).map(filter => {
          const on = fixFilter.includes(filter.id)
          return (
            <button
              key={filter.id}
              onClick={() => toggleFixFilter(filter.id)}
              aria-pressed={on}
              className="v2-ctl"
              style={{
                height: 32, padding: '0 12px', borderRadius: 10, fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 7, color: on ? '#fff' : '#a6a5bb',
                border: `1px solid ${on ? `color-mix(in oklch, ${filter.color} 45%, transparent)` : 'rgba(255,255,255,.09)'}`,
                background: on ? `color-mix(in oklch, ${filter.color} 14%, transparent)` : 'var(--s2,#151524)',
                animation: on ? 'v2-scaleIn .2s both' : undefined,
              }}
            >
              {filter.id !== 'All' && (
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: filter.color, boxShadow: on ? `0 0 8px ${filter.color}` : 'none' }} />
              )}
              {ft(filter.label)}
            </button>
          )
        })}
        {!fixFilter.includes('All') && fixFilter.length > 0 && (
          <span style={{ minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9, background: 'var(--acc,#a77dff)', color: '#0b0614', fontFamily: MONO, fontSize: 10.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {fixFilter.length}
          </span>
        )}
      </div>
    </div>
  )
}
