import { memo, useCallback, useState } from 'react'
import { Wrench, Users, ShieldCheck, Zap, Star, Cpu, TriangleAlert, ListChecks, Tag, CircleCheck, type LucideIcon } from 'lucide-react'
import type { Fix } from '../../types'
import GameCover from '../GameCover'
import { useDownloadStore } from '../../store'
import { useT } from '../../i18n'
import { useFixTagLabel } from '../../utils/genreLabel'
import { useFixState } from './fixState'

const MONO = "'Geist Mono Variable','Geist Mono',monospace"
const TYPES = ['header.jpg'] as const

// Fix "type" pill: derived from the fix's first real badge (design: FIXTYPE colour + icon).
const BADGE_TYPE: Record<string, [string, LucideIcon]> = {
  Online: ['#60a5fa', Users], Tested: ['#4ade80', ShieldCheck], Bypass: ['#fbbf24', Zap], sinfo: ['#f472b6', Star],
  Hypervisor: ['#22d3ee', Cpu], Unstable: ['#f87171', TriangleAlert], 'Extra Steps': ['#c4b0ff', ListChecks], 'Specific Version': ['#fbbf24', Tag],
}
const DEFAULT_TYPE: [string, LucideIcon] = ['#c4b0ff', Wrench]

function Pct() {
  const p = useDownloadStore(s => s.downloadProgress)
  return (
    <div style={{ height: 4, borderRadius: 3, background: 'rgba(255,255,255,.07)', overflow: 'hidden', marginTop: 3 }}>
      <div style={{ height: '100%', width: `${p}%`, background: 'var(--acc,#a77dff)', transition: 'width .5s linear', boxShadow: '0 0 10px var(--acc,#a77dff)' }} />
    </div>
  )
}
function PctLabel() {
  const p = useDownloadStore(s => s.downloadProgress)
  return <span style={{ fontFamily: MONO, fontSize: 12, color: '#fff', width: 72, textAlign: 'center' }}>{Math.floor(p)}%</span>
}

export const FixRowCard = memo(function FixRowCard({ fix, onApply, onOpen }: {
  fix: Fix; onApply: (fix: Fix, url?: string) => Promise<void>; onOpen: (fix: Fix) => void
}) {
  const t = useT()
  const ft = useFixTagLabel()
  const [ver, setVer] = useState(0)
  const done = useFixState(s => !!s.applied[fix.appid])
  const applying = useFixState(s => s.applying === fix.appid)
  const busy = useFixState(s => s.applying !== null)
  const versions = fix.versions && fix.versions.length > 1 ? fix.versions : null
  const v0 = fix.versions?.[versions ? ver : 0]
  const [first, ...rest] = fix.badges ?? []
  const [color, Icon] = (first && BADGE_TYPE[first]) || DEFAULT_TYPE
  const stripSrc = (x: string) => x.replace(/\s*[·|-]?\s*ryuu(\.lol)?\s*/gi, ' ').replace(/\s+·\s*$/, '').trim()
  const meta = [v0?.size, v0?.name && stripSrc(v0.name)].filter(Boolean).join(' · ')
    || [t(fix.fix_count === 1 ? 'app.fix.count.one' : 'app.fix.count.other', { n: fix.fix_count || 1 })]
  const note = rest.length ? rest.map(b => ft(b)).filter(x => !/ryuu/i.test(x)).join(' · ') || `#${fix.appid}` : `#${fix.appid}`

  const apply = useCallback(async () => {
    if (busy) return
    const url = (versions ? versions[ver]?.url : undefined) || fix.download_url || fix.download_urls?.[0]
    useFixState.getState().begin(fix.appid)
    try { await onApply(fix, versions ? versions[ver]?.url : undefined) } catch { /* surfaced by handler toast */ }
    useFixState.getState().finish(fix.appid, !!url && useDownloadStore.getState().downloadStatus === 'done')
  }, [busy, versions, ver, fix, onApply])

  return (
    <div style={{ display: 'flex', gap: 14, padding: 12, borderRadius: 18, background: 'color-mix(in oklch, var(--s2,#151524) 82%, transparent)', border: `1px solid ${done ? 'color-mix(in oklch, #4ade80 35%, transparent)' : 'rgba(255,255,255,.07)'}`, transition: 'border-color .3s' }}>
      <div onClick={() => onOpen(fix)} style={{ width: 150, height: 70, borderRadius: 11, overflow: 'hidden', flex: 'none', cursor: 'pointer', background: '#10101c' }}>
        <GameCover appid={fix.appid} name={fix.name} className="w-full h-full" preferredImageTypes={TYPES} eager />
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ fontSize: 14.5, fontWeight: 650, color: '#f3f2fa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fix.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 5, height: 22, padding: '0 8px', borderRadius: 7, background: `color-mix(in oklch, ${color} 15%, transparent)`, border: `1px solid color-mix(in oklch, ${color} 30%, transparent)`, color, fontSize: 11.5, fontWeight: 600, lineHeight: 1, whiteSpace: 'nowrap' }}>
            <Icon size={12} />{first ? ft(first) : t('app.fix.fix')}
          </span>
          {versions ? (
            <select value={ver} onChange={e => setVer(Number(e.target.value))} aria-label={t('app.fix.version')}
              style={{ minWidth: 0, maxWidth: 140, fontFamily: MONO, fontSize: 11, color: '#8b8aa3', background: 'transparent', border: 'none', outline: 'none', cursor: 'pointer' }}>
              {versions.map((v, i) => <option key={i} value={i} style={{ background: '#151524' }}>{v.name || `v${i + 1}`}{v.size ? ` (${v.size})` : ''}</option>)}
            </select>
          ) : (
            <span style={{ fontFamily: MONO, fontSize: 11, color: '#8b8aa3', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{meta}</span>
          )}
        </div>
        <div style={{ fontSize: 12.5, color: '#8b8aa3', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{note}</div>
        {applying && <Pct />}
      </div>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {applying ? <PctLabel /> : done ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#86efac', padding: '0 10px', animation: 'v2-checkPop .25s cubic-bezier(.16,1,.3,1) both' }}>
            <CircleCheck size={17} />{t('app.fix.applied')}
          </span>
        ) : (
          <button onClick={apply} disabled={busy} className="v2-pill"
            style={{ height: 36, padding: '0 16px', borderRadius: 11, border: 'none', background: 'var(--acc,#a77dff)', color: '#0b0614', fontSize: 13, fontWeight: 650, cursor: busy ? 'default' : 'pointer', opacity: busy ? .5 : 1, transition: 'filter .15s, transform .15s' }}>
            {t('app.fix.applyBtn')}
          </button>
        )}
      </div>
    </div>
  )
})
