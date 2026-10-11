import { useMemo, memo, useState, type CSSProperties } from 'react'
import { History, Eye, Heart, Layers, CirclePlus, CircleCheck, Wrench, Play, Search, type LucideIcon } from 'lucide-react'
import { Game } from '../types'
import { useGameStore, useUserStore, useReducedMotion } from '../store'
import { useShallow } from 'zustand/react/shallow'
import { useSetCurrentPage } from '../store/uiStore'
import type { ActivityEntry, ActivityKind } from '../store/userStore'
import { type ColorScheme } from '../components/shared'
import GameCover from '../components/GameCover'
import { IMAGE_TYPES } from '../services/imageCache'
import { getGenreHue, getGenreTag } from '../utils/gameHelpers'
import { PageBanner, PageEmpty, MONO, ACC, panelStyle, rise } from '../components/PageParts'
import { useT, useLangStore, type TKey } from '../i18n'
import { useGenreLabel } from '../utils/genreLabel'

const BLUE = '#60a5fa'

export interface RecentPageProps {
  handlers: {
    handleGameClick: (game: Game) => void
    toggleFavorite: (appid: string) => void
    handleContextMenu: (e: React.MouseEvent, game: Game) => void
    handleInstallGame: (game?: any) => void
    handleInstallFromZip: (game?: any) => void
    handleDeleteGame: (appid: string) => void
  }
  colors: ColorScheme
}

type Kind = 'view' | 'add' | 'fix' | 'play' | 'fav'
// filter chips / breakdown rows (design: RT)
const KINDS: [Kind, TKey, LucideIcon, string][] = [
  ['view', 'app.recent.viewed', Eye, '#60a5fa'],
  ['add', 'app.recent.f.added', CirclePlus, ACC],
  ['fix', 'app.recent.f.fixes', Wrench, '#fbbf24'],
  ['play', 'app.recent.f.launched', Play, '#4ade80'],
  ['fav', 'app.nav.favourites', Heart, '#f87171'],
]
// per-action row icon + colour + label (design: recents[])
const ACT: Record<ActivityKind, { kind: Kind; I: LucideIcon; c: string; label: TKey }> = {
  viewed: { kind: 'view', I: Eye, c: '#3b82f6', label: 'app.recent.act.viewed' },
  added: { kind: 'add', I: CirclePlus, c: ACC, label: 'app.recent.act.added' },
  fix: { kind: 'fix', I: Wrench, c: '#f59e0b', label: 'app.recent.act.fix' },
  launched: { kind: 'play', I: Play, c: '#22c55e', label: 'app.recent.act.launched' },
  favourited: { kind: 'fav', I: Heart, c: '#ef4444', label: 'app.recent.act.favourited' },
  installed: { kind: 'add', I: CircleCheck, c: '#22c55e', label: 'app.recent.act.installed' },
}
const GROUPS: [string, TKey][] = [['today', 'app.recent.grp.today'], ['yesterday', 'app.recent.grp.yesterday'], ['earlier', 'app.recent.grp.earlier']]
const PER_GROUP = 25
const DAY = 86_400_000

const chipStyle = (on: boolean): CSSProperties => ({
  height: 30, padding: '0 12px', borderRadius: 9, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, transition: 'all .18s', fontFamily: 'inherit',
  border: `1px solid ${on ? 'color-mix(in oklch, var(--acc,#a77dff) 45%, transparent)' : 'rgba(255,255,255,.07)'}`,
  background: on ? 'color-mix(in oklch, var(--acc,#a77dff) 16%, transparent)' : 'transparent', color: on ? '#fff' : '#a6a5bb',
})

const RecentPage = memo(function RecentPage({ handlers }: RecentPageProps) {
  const t = useT()
  const gl = useGenreLabel()
  const lang = useLangStore(s => s.lang)
  const rtl = lang === 'ar'
  const { games, searchQuery } = useGameStore(
    useShallow(s => ({ games: s.games, searchQuery: s.searchQuery }))
  ) as { games: Game[]; searchQuery: string }
  const { recentGames, activity } = useUserStore(useShallow(s => ({ recentGames: s.recentGames, activity: s.activity })))
  const reduced = useReducedMotion()
  const setCurrentPage = useSetCurrentPage()
  const { handleGameClick, handleContextMenu } = handlers
  const [filter, setFilter] = useState<'all' | Kind>('all')

  const byId = useMemo(() => {
    const m = new Map<string, Game>()
    for (const g of games) if (g.header_image) m.set(g.appid, g)
    return m
  }, [games])

  // Real activity log, plus legacy recents that predate it (shown as undated "Viewed").
  const entries = useMemo<ActivityEntry[]>(() => {
    const seen = new Set(activity.map(a => a.appid))
    const legacy = recentGames.filter(id => !seen.has(id)).map(appid => ({ appid, act: 'viewed' as const, ts: 0 }))
    return [...activity, ...legacy].filter(e => byId.has(e.appid))
  }, [activity, recentGames, byId])

  const model = useMemo(() => {
    const now = new Date()
    const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const todayN = entries.filter(e => e.ts >= t0).length
    // last 7 days ending today
    const wk = Array.from({ length: 7 }, (_, i) => {
      const start = t0 - (6 - i) * DAY
      return { start, v: entries.filter(e => e.ts >= start && e.ts < start + DAY).length }
    })
    const weekStart = t0 - 6 * DAY
    const perGame = new Map<string, number>()
    for (const e of entries) if (e.ts >= weekStart) perGame.set(e.appid, (perGame.get(e.appid) || 0) + 1)
    let maId = '', maN = 0
    for (const [id, n] of perGame) if (n > maN) { maId = id; maN = n }
    const counts = Object.fromEntries(KINDS.map(([k]) => [k, 0])) as Record<Kind, number>
    for (const e of entries) counts[ACT[e.act].kind]++
    return { t0, todayN, wk, weekTotal: wk.reduce((a, b) => a + b.v, 0), maId, maN, counts }
  }, [entries])

  const groups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const rows = entries.filter(e => {
      const g = byId.get(e.appid)!
      return (filter === 'all' || ACT[e.act].kind === filter) && (!q || g.name?.toLowerCase().includes(q) || g.appid.includes(q))
    })
    const grp = (ts: number) => ts >= model.t0 ? 'today' : ts >= model.t0 - DAY ? 'yesterday' : 'earlier'
    return GROUPS.map(([id, label]) => ({ id, label, items: rows.filter(e => grp(e.ts) === id).slice(0, PER_GROUP) })).filter(g => g.items.length)
  }, [entries, byId, filter, searchQuery, model.t0])

  const timeLabel = (e: ActivityEntry) => {
    if (!e.ts) return ''
    const d = new Date(e.ts)
    return e.ts >= model.t0 - DAY ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString(lang, { month: 'short', day: 'numeric' })
  }
  const dayLetter = (ts: number) => new Date(ts).toLocaleDateString(lang, { weekday: 'narrow' })

  const bannerGames = useMemo(() => {
    const ids = Array.from(new Set(entries.map(e => e.appid))).slice(0, 4)
    return ids.map(id => byId.get(id)!)
  }, [entries, byId])

  const wkMax = Math.max(...model.wk.map(w => w.v), 1)
  const bdMax = Math.max(...Object.values(model.counts), 1)
  const mostActive = byId.get(model.maId) ?? (entries[0] && byId.get(entries[0].appid))
  const mostActiveN = model.maId ? model.maN : 0

  return (
    <div key="recent" className="h-full overflow-auto" style={{ scrollbarWidth: 'thin' }}>
      <div style={{ padding: 24, maxWidth: 1680, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <PageBanner
          icon={History} color={BLUE} eyebrow={t('app.recent.eyebrow')} title={t('app.nav.recent')}
          sub={t('app.recent.sub2')}
          games={bannerGames} reduced={reduced}
          stats={[
            { v: String(model.todayN), label: t('app.recent.today') },
            { v: String(entries.length), label: t('app.recent.allTime') },
          ]}
        />

        {entries.length === 0 ? (
          <PageEmpty reduced={reduced} icon={History} tint={BLUE} title={t('app.recent.emptyTitle')}
            subtitle={t('app.recent.emptySub')}
            action={{ label: t('app.common.browseGames'), onClick: () => setCurrentPage('browse') }} />
        ) : (
          <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ ...panelStyle, flex: '1 1 520px', minWidth: 0, padding: '10px 14px 14px', animation: rise(reduced, '.35s', '.04s') }}>
              <div style={{ display: 'flex', gap: 4, padding: '6px 4px 10px', flexWrap: 'wrap' }}>
                {([['all', 'app.common.all', Layers], ...KINDS.map(([k, l, I]) => [k, l, I])] as [string, TKey, LucideIcon][]).map(([id, label, Icon]) => (
                  <button key={id} onClick={() => setFilter(id as 'all' | Kind)} aria-pressed={filter === id} style={chipStyle(filter === id)}>
                    <Icon size={13} />{t(label)}
                  </button>
                ))}
              </div>

              {groups.map((g, k) => (
                <section key={g.id} style={{ display: 'flex', flexDirection: 'column', animation: rise(reduced, '.3s', `${k * 0.03}s`) }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 8px 8px' }}>
                    <span style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 600, letterSpacing: '.16em', color: '#a6a5bb' }}>{t(g.label)}</span>
                    <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.06)' }} />
                    <span style={{ fontFamily: MONO, fontSize: 10.5, color: '#6f6e86' }}>{g.items.length}</span>
                  </div>
                  {g.items.map((e, i) => {
                    const game = byId.get(e.appid)!
                    const a = ACT[e.act]
                    const rawTag = getGenreTag(game)
                    const tag = rawTag ? gl(rawTag) : rawTag
                    return (
                      <div key={`${e.appid}-${e.act}-${e.ts}-${i}`} className="v2-row" role="button" tabIndex={0}
                        aria-label={t('app.home.openNamed', { name: game.name ?? '' })}
                        onClick={() => handleGameClick(game)}
                        onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); handleGameClick(game) } }}
                        onContextMenu={(ev) => handleContextMenu(ev, game)}
                        style={{ display: 'grid', gridTemplateColumns: '52px 22px 40px minmax(0,1fr) auto', alignItems: 'center', gap: 14, padding: '9px 10px', borderRadius: 13, cursor: 'pointer' }}>
                        <span style={{ fontFamily: MONO, fontSize: 12, color: '#8b8aa3', textAlign: 'end' }}>{timeLabel(e)}</span>
                        <span style={{ position: 'relative', width: 22, height: 22, borderRadius: 7, background: `color-mix(in oklch, ${a.c} 18%, transparent)`, color: a.c, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <a.I size={12} />
                        </span>
                        <div style={{ width: 40, height: 56, borderRadius: 8, overflow: 'hidden', background: '#10101c' }}>
                          <GameCover appid={game.appid} name={game.name} localHeader={game.header_image || undefined}
                            preferredImageTypes={IMAGE_TYPES.PORTRAIT} genreHue={getGenreHue(game)} webglDisabled className="w-full h-full" />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 14.5, fontWeight: 600, color: '#f3f2fa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{game.name}</div>
                          <div style={{ fontSize: 12.5, color: '#a6a5bb', marginTop: 3 }}>{t(a.label)}</div>
                        </div>
                        {tag ? <span style={{ fontSize: 11.5, color: '#8b8aa3', padding: '3px 8px', borderRadius: 7, background: 'rgba(255,255,255,.04)' }}>{tag}</span> : <span />}
                      </div>
                    )
                  })}
                </section>
              ))}
              {groups.length === 0 && (
                <div style={{ padding: 40, textAlign: 'center', color: '#8b8aa3', fontSize: 13.5, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                  <Search size={20} />{t('app.recent.noType')}
                </div>
              )}
            </div>

            <aside style={{ flex: '1 1 300px', maxWidth: '100%', display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 0 }}>
              <div style={{ ...panelStyle, padding: 18, animation: rise(reduced, '.35s', '.06s') }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 650, color: '#f3f2fa' }}>{t('app.recent.week')}</span>
                  <span style={{ flex: 1 }} />
                  <span style={{ fontFamily: MONO, fontSize: 20, fontWeight: 600, color: '#f3f2fa' }}>{model.weekTotal}</span>
                  <span style={{ fontSize: 12, color: '#8b8aa3' }}>{t('app.recent.actions')}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))', gap: 8, alignItems: 'end', height: 120, marginTop: 16 }}>
                  {model.wk.map((w, i) => {
                    const today = i === 6
                    return (
                      <div key={w.start} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, height: '100%', justifyContent: 'flex-end' }}>
                        <div title={String(w.v)} style={{ width: '100%', maxWidth: 28, height: `${(w.v / wkMax) * 100}%`, minHeight: 4, borderRadius: 7, background: today ? ACC : 'rgba(255,255,255,.14)', boxShadow: today ? '0 0 16px color-mix(in oklch, var(--acc,#a77dff) 60%, transparent)' : 'none', transformOrigin: 'bottom', animation: reduced ? undefined : `v2-barIn .5s cubic-bezier(.34,1.4,.5,1) ${i * 0.04}s both` }} />
                        <span style={{ fontFamily: MONO, fontSize: 10.5, color: today ? '#fff' : '#77768e' }}>{dayLetter(w.start)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div style={{ ...panelStyle, padding: 18, display: 'flex', flexDirection: 'column', gap: 12, animation: rise(reduced, '.35s', '.08s') }}>
                <span style={{ fontSize: 15, fontWeight: 650, color: '#f3f2fa' }}>{t('app.recent.breakdown')}</span>
                {KINDS.map(([k, label, Icon, c]) => (
                  <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, color: '#f3f2fa' }}>
                      <Icon size={14} style={{ color: c }} /><span style={{ flex: 1 }}>{t(label)}</span>
                      <span style={{ fontFamily: MONO, fontSize: 12, color: '#c9c8da' }}>{model.counts[k]}</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,.06)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(model.counts[k] / bdMax) * 100}%`, borderRadius: 3, background: c, transformOrigin: rtl ? 'right' : 'left', animation: reduced ? undefined : 'v2-barFill .6s cubic-bezier(.16,1,.3,1) both' }} />
                    </div>
                  </div>
                ))}
              </div>

              {mostActive && (
                <div role="button" tabIndex={0} className="v2-fixwrap" onClick={() => handleGameClick(mostActive)}
                  aria-label={t('app.home.openNamed', { name: mostActive.name ?? '' })}
                  onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); handleGameClick(mostActive) } }}
                  style={{ position: 'relative', height: 200, borderRadius: 20, overflow: 'hidden', border: '1px solid rgba(255,255,255,.08)', cursor: 'pointer', background: '#10101c', animation: rise(reduced, '.35s', '.1s') }}>
                  <div style={{ position: 'absolute', inset: 0, animation: reduced ? undefined : 'v2-hkenBurns 18s ease-in-out infinite alternate' }}>
                    <GameCover appid={mostActive.appid} name={mostActive.name} localHeader={mostActive.header_image || undefined}
                      preferredImageTypes={IMAGE_TYPES.HEADER} genreHue={getGenreHue(mostActive)} webglDisabled className="w-full h-full" />
                  </div>
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg, rgba(6,6,12,.95) 10%, rgba(6,6,12,.2) 70%)' }} />
                  <div style={{ position: 'absolute', insetInline: 16, bottom: 14 }}>
                    <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.16em', color: ACC }}>{t('app.recent.mostActive')}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, marginTop: 6, color: '#f3f2fa' }}>{mostActive.name}</div>
                    <div style={{ fontSize: 12.5, color: '#c9c8da', marginTop: 3 }}>{t('app.recent.mostN', { n: mostActiveN })}</div>
                  </div>
                </div>
              )}
            </aside>
          </div>
        )}
      </div>
    </div>
  )
})

export default RecentPage
