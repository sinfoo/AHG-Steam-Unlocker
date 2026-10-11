import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUpDown, Check, ChevronDown, GalleryHorizontalEnd, LayoutGrid, List, Search, SlidersHorizontal, X } from 'lucide-react'
import { useGameStore, useSettingsStore } from '../../store'
import { useT, useLangStore, type TKey } from '../../i18n'

const MONO = "'Geist Mono Variable','Geist Mono',monospace"
export type SortKey = 'popular' | 'newest' | 'az' | 'za' | 'smallest'
export type BrowseView = 'grid' | 'wide' | 'list'
const SORT_OPTIONS: ReadonlyArray<{ value: SortKey; label: TKey }> = [
  { value: 'popular', label: 'app.browse.sort.popular' },
  { value: 'newest', label: 'app.browse.sort.newest' },
  { value: 'az', label: 'app.browse.sort.az' },
  { value: 'za', label: 'app.browse.sort.za' },
  { value: 'smallest', label: 'app.browse.sort.smallest' },
]

interface BrowseToolbarProps {
  q: string; setQ: (v: string) => void
  filtersOpen: boolean; toggleFilters: () => void
  filterCount: number
  pills: { key: string; label: string; remove: () => void }[]
  clearAll: () => void
  sort: SortKey; setSort: (s: SortKey) => void
  view: BrowseView; setView: (v: BrowseView) => void
}

const ctl: React.CSSProperties = {
  height: 36, borderRadius: 11, border: '1px solid rgba(255,255,255,.09)',
  background: 'var(--s2,#151524)', color: '#e4e3f0', fontSize: 13, cursor: 'pointer',
}

export default function BrowseToolbar({
  q, setQ, filtersOpen, toggleFilters, filterCount, pills, clearAll, sort, setSort, view, setView,
}: BrowseToolbarProps) {
  const t = useT()
  const rtl = useLangStore(s => s.lang) === 'ar'
  const batchMode = useSettingsStore(s => s.batchMode)
  const selectedGames = useGameStore(s => s.selectedGames)
  const setSelectedGames = useGameStore(s => s.setSelectedGames)

  const [sortOpen, setSortOpen] = useState(false)
  const sortRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!sortOpen) return
    const close = (e: MouseEvent) => { if (!sortRef.current?.contains(e.target as Node)) setSortOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setSortOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc) }
  }, [sortOpen])

  const sortLabel = t(SORT_OPTIONS.find(o => o.value === sort)!.label)
  const views = [['grid', t('app.view.gridView'), LayoutGrid], ['wide', t('app.browse.viewWide'), GalleryHorizontalEnd], ['list', t('app.view.listView'), List]] as const
  const viewIdx = views.findIndex(v => v[0] === view)

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', position: 'relative', zIndex: 20, animation: 'v2-riseIn .35s .04s both' }}>
        <div style={{ position: 'relative', width: 'min(300px,100%)' }}>
          <Search size={15} style={{ position: 'absolute', insetInlineStart: 13, top: '50%', transform: 'translateY(-50%)', color: '#8b8aa3', pointerEvents: 'none' }} />
          <input
            type="text" value={q} onChange={e => setQ(e.target.value)} placeholder={t('app.browse.filterPh')} aria-label={t('app.browse.filterPh')}
            className="v2-field"
            style={{ width: '100%', height: 36, borderRadius: 11, border: '1px solid rgba(255,255,255,.09)', background: 'var(--s2,#151524)', color: '#fff', fontSize: 13, paddingInlineStart: 36, paddingInlineEnd: 12, outline: 'none', transition: 'border-color .2s, box-shadow .2s' }}
          />
        </div>

        <button
          onClick={toggleFilters} aria-pressed={filtersOpen}
          style={{ height: 36, padding: '0 12px', borderRadius: 11, border: `1px solid ${filtersOpen ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.09)'}`, background: filtersOpen ? 'rgba(255,255,255,.08)' : 'var(--s2,#151524)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'all .2s' }}
        >
          <SlidersHorizontal size={15} />
          {t('app.browse.filters')}
          {filterCount > 0 && <span style={{ minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9, background: 'var(--acc,#a77dff)', color: '#0b0614', font: `700 10.5px ${MONO}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{filterCount}</span>}
        </button>

        {pills.map(p => (
          <button key={p.key} onClick={p.remove} aria-label={t('app.browse.removeFilter', { name: p.label })} className="v2-pill"
            style={{ height: 32, padding: '0 8px 0 12px', borderRadius: 10, border: '1px solid color-mix(in oklch, var(--acc,#a77dff) 40%, transparent)', color: '#fff', fontSize: 12.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, animation: 'v2-scaleIn .2s both' }}>
            {p.label}<X size={13} style={{ opacity: .7 }} />
          </button>
        ))}
        {filterCount > 0 && (
          <button onClick={clearAll} className="v2-clear" style={{ height: 32, padding: '0 8px', border: 'none', background: 'transparent', color: '#a6a5bb', fontSize: 12.5, cursor: 'pointer' }}>{t('app.browse.clearAll')}</button>
        )}

        <span style={{ flex: 1 }} />

        <div ref={sortRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setSortOpen(o => !o)}
            aria-haspopup="menu"
            aria-expanded={sortOpen}
            aria-label={t('app.browse.sortGames')}
            className="v2-ctl"
            style={{ ...ctl, paddingInlineStart: 14, paddingInlineEnd: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <ArrowUpDown size={14} style={{ color: '#8b8aa3' }} />
            {sortLabel}
            <ChevronDown size={14} style={{ color: '#8b8aa3', transition: 'transform .3s', transform: `rotate(${sortOpen ? 180 : 0}deg)` }} />
          </button>
          {sortOpen && (
            <div
              role="menu"
              style={{
                position: 'absolute', top: 44, insetInlineEnd: 0, width: 200, padding: 6, borderRadius: 14,
                background: 'rgba(20,20,34,.97)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,.09)',
                boxShadow: '0 24px 60px -16px rgba(0,0,0,.9)', transformOrigin: rtl ? 'top left' : 'top right',
                animation: 'v2-scaleIn .2s cubic-bezier(.16,1,.3,1) both',
              }}
            >
              {SORT_OPTIONS.map(o => (
                <button
                  key={o.value}
                  role="menuitemradio"
                  aria-checked={sort === o.value}
                  onClick={() => { setSort(o.value); setSortOpen(false) }}
                  className="v2-pop-item"
                  style={{ width: '100%', height: 36, border: 'none', borderRadius: 9, background: 'transparent', color: sort === o.value ? '#fff' : '#c9c8da', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 10px', cursor: 'pointer' }}
                >
                  {t(o.label)}
                  {sort === o.value && <Check size={14} style={{ color: 'var(--acc,#a77dff)' }} />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* View segmented control */}
        <div role="group" aria-label={t('app.view.mode')} style={{ position: 'relative', display: 'flex', height: 36, padding: 3, borderRadius: 11, background: 'var(--s2,#151524)', border: '1px solid rgba(255,255,255,.09)' }}>
          <span style={{ position: 'absolute', top: 3, insetInlineStart: 3, width: 36, height: 28, borderRadius: 8, background: 'rgba(255,255,255,.1)', transform: `translateX(${viewIdx * 36 * (rtl ? -1 : 1)}px)`, transition: 'transform .3s cubic-bezier(.34,1.45,.5,1)' }} />
          {views.map(([m, label, Icon]) => (
            <button
              key={m}
              onClick={() => setView(m)}
              title={label}
              aria-label={label}
              aria-pressed={view === m}
              style={{ position: 'relative', width: 36, border: 'none', background: 'transparent', color: view === m ? '#fff' : '#8b8aa3', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'color .15s' }}
            >
              <Icon size={15} />
            </button>
          ))}
        </div>
      </div>

      {/* Batch mode banner */}
      <AnimatePresence>
        {batchMode && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div
              style={{
                padding: '10px 14px', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                background: 'color-mix(in oklch, var(--acc,#a77dff) 10%, transparent)',
                border: '1px solid color-mix(in oklch, var(--acc,#a77dff) 35%, transparent)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 700, letterSpacing: '.14em', padding: '3px 9px', borderRadius: 7, background: 'var(--acc,#a77dff)', color: '#0b0614' }}>{t('app.browse.batchTag')}</span>
                <span style={{ fontSize: 12.5, color: '#c9c8da' }}>{t('app.browse.batchHint')}</span>
              </div>
              {selectedGames.size > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 600, color: '#fff' }}>{t('app.browse.nSelected', { n: selectedGames.size })}</span>
                  <button
                    onClick={() => setSelectedGames(new Set())}
                    className="v2-ctl"
                    style={{ ...ctl, height: 28, padding: '0 10px', borderRadius: 9, fontSize: 12, color: '#a6a5bb' }}
                  >
                    {t('app.browse.clear')}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
