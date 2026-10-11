import { memo, useCallback, type ReactNode } from 'react'
import { Download, FolderOpen, SearchX } from 'lucide-react'
import type { Virtualizer } from '@tanstack/react-virtual'
import type { Game } from '../../types'
import { PosterCard } from '../cards/PosterCard'
import GameCover from '../GameCover'
import { getGenreHue, getGenreTag, formatBytes } from '../../utils/gameHelpers'
import { useGenreLabel } from '../../utils/genreLabel'
import { useT } from '../../i18n'
import type { BrowseView } from './BrowseToolbar'

const MONO = "'Geist Mono Variable','Geist Mono',monospace"
const HEADER_TYPES = ['header.jpg'] as const

// Layout constants (design: --cardw 172px / 142 compact, gap 22px 16px; wide min 300 gap 16; list rows gap 8)
export const GAP_X = 16
export const GRID_GAP_Y = 22
export const GRID_META_H = 44 // 13.5px title + 3 gap + 11px mono meta + 10 gap under the 2:3 cover
export const WIDE_MIN = 300
export const LIST_ROW_H = 74
export const LIST_GAP = 8

export interface CardHandlers {
  open: (g: Game) => void
  fav: (appid: string) => void
  ctx: (e: React.MouseEvent, g: Game) => void
  install: (g: Game) => void
  select: (appid: string) => void
}
export interface CardFlags { batchMode: boolean; selected: Set<string>; favorites: Set<string>; installed: Set<string>; comingSoon: Set<string> }

function useCta(game: Game, installed: boolean, h: CardHandlers) {
  const t = useT()
  const run = useCallback(() => (installed ? h.open(game) : h.install(game)), [installed, h, game])
  return {
    label: installed ? t('app.browse.open') : t('app.hero.addToSteam'),
    icon: installed ? <FolderOpen size={14} className="flex-none" /> : <Download size={14} className="flex-none" />,
    onClick: run,
  }
}

const PosterCell = memo(function PosterCell({ game, h, installed, fav, selected, batchMode, soon, delay, focused }: {
  game: Game; h: CardHandlers; installed: boolean; fav: boolean; selected: boolean; batchMode: boolean; soon: boolean; delay: number; focused?: boolean
}) {
  const cta = useCta(game, installed, h)
  return (
    <PosterCard
      game={game} isInstalled={installed} isFavorite={fav} selected={batchMode ? selected : undefined} comingSoon={soon} focused={focused} delay={delay} cta={cta}
      onClick={() => (batchMode ? h.select(game.appid) : h.open(game))}
      onFavorite={() => h.fav(game.appid)}
      onContextMenu={(e) => h.ctx(e, game)}
    />
  )
})

const WideCell = memo(function WideCell({ game, h, installed, selected, batchMode, delay }: {
  game: Game; h: CardHandlers; installed: boolean; selected: boolean; batchMode: boolean; delay: number
}) {
  const gl = useGenreLabel()
  const cta = useCta(game, installed, h)
  const raw = getGenreTag(game)
  const meta = [raw ? gl(raw) : null, game.size ? formatBytes(game.size) : null].filter(Boolean).join(' · ')
  return (
    <div
      className="v2-wide" role="button" tabIndex={0} aria-label={game.name}
      onClick={() => (batchMode ? h.select(game.appid) : h.open(game))} onContextMenu={(e) => h.ctx(e, game)}
      onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); h.open(game) } }}
      style={{ position: 'relative', aspectRatio: '16/9', borderRadius: 18, overflow: 'hidden', cursor: 'pointer', background: '#10101c', border: `1px solid ${selected && batchMode ? 'var(--acc,#a77dff)' : 'rgba(255,255,255,.07)'}`, animation: `v2-riseIn .35s both ${delay}s` }}
    >
      <GameCover appid={game.appid} name={game.name} localHeader={game.header_image || undefined} preferredImageTypes={HEADER_TYPES} genreHue={getGenreHue(game)} webglDisabled className="w-full h-full absolute inset-0" />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg, rgba(6,6,12,.95) 0%, rgba(6,6,12,.1) 60%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', insetInline: 14, bottom: 12, display: 'flex', alignItems: 'flex-end', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 650, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#f3f2fa' }}>{game.name}</div>
          <div style={{ fontFamily: MONO, fontSize: 11, color: '#c9c8da', marginTop: 4, minHeight: 14 }}>{meta}</div>
        </div>
        <button onClick={(e) => { e.stopPropagation(); cta.onClick() }} title={cta.label} aria-label={`${cta.label}: ${game.name}`} className="v2-wide-cta"
          style={{ width: 38, height: 38, flex: 'none', borderRadius: 12, border: 'none', background: 'var(--acc,#a77dff)', color: '#0b0614', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {installed ? <FolderOpen size={16} /> : <Download size={16} />}
        </button>
      </div>
    </div>
  )
})

const ListCell = memo(function ListCell({ game, h, installed, selected, batchMode, delay }: {
  game: Game; h: CardHandlers; installed: boolean; selected: boolean; batchMode: boolean; delay: number
}) {
  const gl = useGenreLabel()
  const cta = useCta(game, installed, h)
  const raw = getGenreTag(game)
  const dev = (game as { developer?: string }).developer
  return (
    <div
      className="v2-brow" role="button" tabIndex={0} aria-label={game.name}
      onClick={() => (batchMode ? h.select(game.appid) : h.open(game))} onContextMenu={(e) => h.ctx(e, game)}
      onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); h.open(game) } }}
      style={{ height: LIST_ROW_H, boxSizing: 'border-box', display: 'grid', gridTemplateColumns: '120px minmax(0,1fr) 110px 76px 140px', alignItems: 'center', gap: 16, padding: '8px 10px 8px 8px', borderRadius: 14, background: 'color-mix(in oklch, var(--s2,#151524) 80%, transparent)', border: `1px solid ${selected && batchMode ? 'var(--acc,#a77dff)' : 'rgba(255,255,255,.05)'}`, cursor: 'pointer', animation: `v2-riseIn .3s both ${delay}s` }}
    >
      <div style={{ width: 120, height: 56, borderRadius: 9, overflow: 'hidden', position: 'relative' }}>
        <GameCover appid={game.appid} name={game.name} localHeader={game.header_image || undefined} preferredImageTypes={HEADER_TYPES} genreHue={getGenreHue(game)} webglDisabled className="w-full h-full" />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#f3f2fa' }}>{game.name}</div>
        <div style={{ fontSize: 12.5, color: '#8b8aa3', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{dev || `#${game.appid}`}</div>
      </div>
      <span style={{ fontSize: 12.5, color: '#c9c8da', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{raw ? gl(raw) : ''}</span>
      <span style={{ fontFamily: MONO, fontSize: 12, color: '#a6a5bb', whiteSpace: 'nowrap' }}>{game.size ? formatBytes(game.size) : ''}</span>
      <button onClick={(e) => { e.stopPropagation(); cta.onClick() }} className="v2-brow-cta"
        style={{ height: 36, borderRadius: 10, border: '1px solid color-mix(in oklch, var(--acc,#a77dff) 45%, transparent)', background: 'color-mix(in oklch, var(--acc,#a77dff) 14%, transparent)', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'background .15s' }}>
        {installed ? <FolderOpen size={14} /> : <Download size={14} />}{cta.label}
      </button>
    </div>
  )
})

export function BrowseEmpty({ onClear }: { onClear: () => void }) {
  const t = useT()
  return (
    <div style={{ padding: '70px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center', animation: 'v2-riseIn .35s both' }}>
      <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(255,255,255,.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b8aa3' }}>
        <SearchX size={28} />
      </div>
      <div style={{ fontSize: 17, fontWeight: 600, color: '#f3f2fa' }}>{t('app.grid.noGames')}</div>
      <div style={{ fontSize: 13.5, color: '#8b8aa3' }}>{t('app.browse.noMatchHint')}</div>
      <button onClick={onClear} className="v2-ctl" style={{ marginTop: 6, height: 38, padding: '0 16px', borderRadius: 11, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.05)', color: '#fff', fontSize: 13, cursor: 'pointer' }}>{t('app.browse.clearFilters')}</button>
    </div>
  )
}

interface BrowseGameGridProps {
  items: Game[]; view: BrowseView; columns: number; scrollMargin: number
  virtualizer: Virtualizer<HTMLDivElement, Element>
  h: CardHandlers; flags: CardFlags; focusedIndex?: number
}

/** Virtualised rows for the three Browse layouts (grid posters / wide 16:9 / list). */
export default function BrowseGameGrid({ items, view, columns, scrollMargin, virtualizer, h, flags, focusedIndex }: BrowseGameGridProps) {
  const rows: ReactNode[] = virtualizer.getVirtualItems().map(vr => {
    const start = vr.index * columns
    return (
      <div key={vr.key} style={{
        position: 'absolute', top: 0, insetInlineStart: 0, width: '100%', height: `${vr.size}px`,
        transform: `translateY(${vr.start - scrollMargin}px)`, contain: 'layout style',
        display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, columnGap: GAP_X, alignItems: 'start',
      }}>
        {items.slice(start, start + columns).map((game, i) => {
          const idx = start + i
          const common = { game, h, installed: flags.installed.has(game.appid), selected: flags.selected.has(game.appid), batchMode: flags.batchMode, delay: Math.min(i * 0.03, 0.3) }
          return view === 'grid'
            ? <PosterCell key={game.appid} {...common} fav={flags.favorites.has(game.appid)} soon={flags.comingSoon.has(game.appid)} focused={idx === focusedIndex} />
            : view === 'wide'
              ? <WideCell key={game.appid} {...common} />
              : <ListCell key={game.appid} {...common} />
        })}
      </div>
    )
  })
  return <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative', width: '100%' }}>{rows}</div>
}
