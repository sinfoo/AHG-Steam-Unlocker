import { memo, useMemo, useCallback } from 'react'

import { Check, Heart, Download as DownloadIcon, FolderOpen } from 'lucide-react'
import { COLORS } from '../../constants/colors'
import type { Game } from '../../types'
import type { ColorScheme } from '../../types/colors'
import GameCover from '../GameCover'
import { useGameStore } from '../../store'
import { CardShell } from './CardShell'
import { InstallSpeedBadge } from './InstallSpeedBadge'
import { getGenreHue, isRecentlyAdded, formatBytes } from '../../utils/gameHelpers'
import { useT } from '../../i18n'

// Transition constant — DESIGN.md: 80ms cubic-bezier(0.4, 0, 0.2, 1)
const T = '0.08s cubic-bezier(0.4, 0, 0.2, 1)'

// Module-level constants for preferredImageTypes — ensures stable references across renders
// preventing GameCover's useEffect from re-running on every hover/scroll re-render.
//
// header.jpg ONLY — and this is deliberate on two counts:
//  1. Dimensions: header.jpg is the wide ~460×215 ("400×215") landscape capsule that
//     fits the 16:9 cover box. No library_600x900 portrait fallback to squish.
//  2. Instant rendering: the disk cache key is `appid_<types.join(",")>`, and the
//     shipped warm cache (imagePreloader) writes each image under a SINGLE-type key
//     (`appid_header.jpg`). Requesting exactly ['header.jpg'] hits that warm entry —
//     and the always-instant home page uses the same key. Any extra fallback type
//     changes the key, misses the warm cache, and forces a network re-fetch.
const PREFERRED_TYPES_GRID = ['header.jpg'] as const
const PREFERRED_TYPES_LIST = ['header.jpg'] as const

// Stable style objects for GameCover — avoids breaking React.memo via inline object creation
const COVER_STYLE_DEFAULT = { transform: 'scale(1)', transition: `transform ${T}` }
const COVER_STYLE_HOVERED = { transform: 'scale(1.08)', transition: `transform ${T}` }

// ── GameCard ──
export const GameCard = memo(function GameCard({
  game, index, viewMode, isFavorite, onClick, onFavorite, onContextMenu,
  colors, batchMode, isSelected, onSelect, onInstallGame, onInstallFromZip,
  isInLibrary, onRemoveFromLibrary, compactMode,
}: {
  game: Game; index: number; viewMode: string; isFavorite: boolean
  onClick: () => void; onFavorite: () => void
  onContextMenu?: (e: React.MouseEvent, game: Game) => void
  colors: ColorScheme; batchMode?: boolean; isSelected?: boolean
  onSelect?: () => void; onInstallGame?: (game?: any) => void
  onInstallFromZip?: (game?: any) => void
  isInLibrary?: boolean; onRemoveFromLibrary?: (game: Game) => void
  compactMode?: boolean
}) {
  const t = useT()
  const genreHue = useMemo(() => getGenreHue(game), [game])
  // Subscribes only to this game's update flag — re-renders just this card when it flips.
  const hasUpdate = useGameStore(s => !!isInLibrary && s.gamesWithUpdates.has(String(game.appid)))

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    onContextMenu?.(e, game)
  }, [game, onContextMenu])

  return (
    <CardShell
      variant={viewMode === 'grid' ? 'grid' : 'list'}
      genreHue={genreHue}
      index={index}
      className={batchMode ? 'relative' : ''}
      onClick={batchMode ? onSelect : onClick}
      onContextMenu={handleContextMenu}
    >
      {(isHovered) => (
        <>
          {/* ── Batch mode selector ── */}
          {batchMode && (
            <div
              className="absolute top-3 start-3 z-30 w-7 h-7 rounded-full flex items-center justify-center cursor-pointer"
              style={{
                background: isSelected ? colors.green : 'rgba(0,0,0,0.6)',
                boxShadow: isSelected ? `0 0 20px ${colors.green}80` : 'none',
              }}
              onClick={(e) => { e.stopPropagation(); onSelect?.() }}
            >
              {isSelected && <Check size={16} className="text-white" />}
            </div>
          )}

          {viewMode === 'grid' ? (
            <>
              {/* ══════ Grid Mode (v2) ══════ */}

              {/* ── Cover Section (16:9 — header art keeps the warm image cache hot) ── */}
              <div className="relative overflow-hidden" style={{ aspectRatio: '16/9', background: 'var(--s2, #151524)' }}>
                {/* Image with IndexedDB caching via GameCover */}
                <GameCover
                  appid={game.appid}
                  name={game.name}
                  localHeader={game.header_image}
                  className="w-full h-full relative z-[1]"
                  genreHue={genreHue}
                  preferredImageTypes={PREFERRED_TYPES_GRID}
                  eager
                  style={isHovered ? COVER_STYLE_HOVERED : COVER_STYLE_DEFAULT}
                />

                {/* Top/bottom readability gradient */}
                <div
                  className="absolute inset-0 pointer-events-none z-[2]"
                  style={{ background: 'linear-gradient(180deg,rgba(0,0,0,.35) 0%,transparent 28%,transparent 62%,rgba(6,6,12,.55) 100%)' }}
                />

                {/* ── Badges (top-left) ── */}
                <div className="absolute top-2 start-2 end-12 z-20 flex items-center gap-1.5 pointer-events-none select-none">
                  {isInLibrary ? (
                    <span
                      className="flex items-center gap-[5px] text-[10.5px] font-semibold px-[7px] py-[3px] rounded-[7px]"
                      style={hasUpdate
                        ? { color: '#fde68a', background: 'rgba(30,20,4,.78)', border: '1px solid rgba(245,158,11,.4)', }
                        : { color: '#d7ffe4', background: 'rgba(8,20,12,.75)', border: '1px solid rgba(34,197,94,.35)', }}
                    >
                      {hasUpdate
                        ? <DownloadIcon size={10} />
                        : <span className="w-1.5 h-1.5 rounded-full" style={{ background: COLORS.green, boxShadow: `0 0 8px ${COLORS.green}` }} />}
                      {hasUpdate ? t('app.card.update') : t('app.card.installed')}
                    </span>
                  ) : isRecentlyAdded(game) ? (
                    <span
                      className="mono text-[10.5px] font-semibold px-[7px] py-[3px] rounded-[7px] uppercase"
                      style={{ letterSpacing: '.1em', color: '#fff', background: 'rgba(8,8,16,.75)', border: '1px solid color-mix(in oklch, var(--acc) 50%, transparent)', }}
                    >
                      {t('app.card.new')}
                    </span>
                  ) : null}
                </div>

                {/* ── Install speed badge ── */}
                {game.size && !isInLibrary && (
                  <div className="absolute bottom-2 start-2 z-20 pointer-events-none">
                    <InstallSpeedBadge sizeBytes={game.size} />
                  </div>
                )}

                {/* ── AppID chip (bottom-right, hover) ── */}
                <div
                  className="absolute bottom-2 end-2 z-20 mono px-1.5 py-0.5 rounded-md text-[10px] font-semibold opacity-0 group-hover:opacity-100 pointer-events-none"
                  style={{
                    background: 'rgba(8,8,16,.72)',
                    color: COLORS.textMuted,
                    border: '1px solid rgba(255,255,255,0.12)',
                    transition: 'opacity .3s ease',
                  }}
                >
                  #{game.appid}
                </div>

                {/* ── Favorite button (top-right) — persistent red when favourited ── */}
                <button
                  className="absolute top-2 end-2 w-[30px] h-[30px] rounded-[10px] flex items-center justify-center z-20 cursor-pointer active:scale-90"
                  aria-label={isFavorite ? t('app.card.removeFav') : t('app.card.addFav')}
                  aria-pressed={isFavorite}
                  onClick={(e) => { e.stopPropagation(); onFavorite() }}
                  style={{
                    background: isFavorite ? 'rgba(239,68,68,.9)' : 'rgba(255,255,255,.08)',
                    border: isFavorite ? '1px solid transparent' : '1px solid rgba(255,255,255,.16)',
                    boxShadow: isFavorite ? '0 4px 14px rgba(239,68,68,.5)' : 'none',
                    opacity: isFavorite || isHovered ? 1 : 0,
                    transition: 'opacity .3s ease, background .15s, transform .15s',
                  }}
                >
                  <div key={isFavorite ? 'beat' : 'idle'} className={isFavorite ? 'animate-heart-beat' : ''}>
                    <Heart size={14} className={isFavorite ? 'text-white fill-white' : 'text-white'} />
                  </div>
                </button>
              </div>

              {/* ── Info Panel ── */}
              <div className={`${compactMode ? 'p-3 space-y-2' : 'p-3.5 space-y-2.5'}`}>
                <div className="min-w-0">
                  <h3
                    className="text-[13.5px] font-semibold leading-tight line-clamp-2"
                    style={{
                      // Reserve 2 lines so every grid card is the same height → uniform row gaps.
                      minHeight: '2.5em',
                      color: COLORS.text,
                    }}
                  >
                    {game.name}
                  </h3>
                </div>

                {/* Metadata row */}
                <div className="mono flex items-center gap-2 text-[11px]" style={{ color: COLORS.textDim }}>
                  {game.size ? <span>{formatBytes(game.size)}</span> : null}
                  {(game as any).release_date && (
                    <>
                      {game.size ? <span className="opacity-40">·</span> : null}
                      <span>{(game as any).release_date.split('-')[0]}</span>
                    </>
                  )}
                  {(game.type || '').toLowerCase() === 'dlc' && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold"
                      style={{
                        background: `${COLORS.green}1f`,
                        color: COLORS.green,
                        border: `1px solid ${COLORS.green}33`,
                      }}
                    >
                      DLC
                    </span>
                  )}
                </div>

                {/* ── Install / Already Added buttons ── */}
                <div className="flex flex-col gap-1.5 pt-0.5">
                  {isInLibrary ? (
                    <>
                      <div className="gamecard-btn-added flex-1 text-[12.5px] py-2 px-3 flex items-center justify-center gap-2 leading-none">
                        <Check size={13} />
                        <span>{t('app.card.inLibrary')}</span>
                      </div>
                      {onRemoveFromLibrary && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onRemoveFromLibrary(game) }}
                          className="gamecard-btn-remove flex-1 text-[12.5px] py-2 px-3 flex items-center justify-center gap-2 leading-none cursor-pointer pointer-events-auto"
                        >
                          {t('app.card.removeFromLib')}
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); onInstallGame?.(game) }}
                        className="gamecard-btn-steam flex-1 text-[12.5px] py-2 px-3 flex items-center justify-center gap-2 leading-none cursor-pointer pointer-events-auto"
                      >
                        <DownloadIcon size={14} />
                        <span>{t('app.hero.addToSteam')}</span>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onInstallFromZip?.(game) }}
                        className="gamecard-btn-zip flex-1 text-[12.5px] py-2 px-3 flex items-center justify-center gap-2 leading-none cursor-pointer pointer-events-auto"
                      >
                        <FolderOpen size={14} />
                        <span>{t('app.card.installZip')}</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </>
          ) : (
            /* ══════ List Mode ══════ */
            <div className={`flex items-center w-full ${compactMode ? 'gap-3 p-3' : 'gap-4 p-4'}`}>
              {/* ── Left accent glow bar ── */}
              <div
                className="absolute start-0 top-2 bottom-2 w-[3px] rounded-full pointer-events-none"
                style={{
                  opacity: isHovered ? 1 : 0,
                  background: 'linear-gradient(180deg, var(--acc), transparent)',
                  boxShadow: isHovered ? '0 0 10px color-mix(in oklch, var(--acc) 50%, transparent)' : 'none',
                  transition: `opacity ${T}`,
                }}
              />

              {/* ── Content row ── */}
              <div className="relative z-10 flex items-center gap-4 w-full">
                {/* ── Thumbnail (via GameCover) ── */}
                <div
                  className={`${compactMode ? 'w-[56px] h-[32px]' : 'w-[72px] h-[40px]'} rounded-lg overflow-hidden shrink-0 relative`}
                  style={{
                    transform: isHovered ? 'scale(1.1)' : 'scale(1)',
                    transition: `transform ${T}`,
                  }}
                >
                  <GameCover
                    appid={game.appid}
                    name={game.name}
                    localHeader={game.header_image}
                    className="w-full h-full"
                    genreHue={genreHue}
                    preferredImageTypes={PREFERRED_TYPES_LIST}
                    eager
                  />
                </div>

                {/* ── Game title ── */}
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  {isRecentlyAdded(game) && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider shrink-0"
                      style={{
                        background: 'rgba(8,8,16,.75)',
                        color: 'white',
                        border: '1px solid color-mix(in oklch, var(--acc) 50%, transparent)',
                      }}
                    >
                      {t('app.card.new')}
                    </span>
                  )}
                  <h3
                    className="font-bold truncate"
                    style={{
                      color: COLORS.text,
                      transition: `color ${T}`,
                    }}
                  >
                    {game.name}
                  </h3>
                  {game.size && (
                    <div className="text-[10px] mt-0.5" style={{ color: COLORS.textMuted }}>
                      {formatBytes(game.size)}
                    </div>
                  )}
                </div>

                {/* ── Favorite button ── */}
                <button
                  className="p-2 rounded-full cursor-pointer shrink-0 opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-[0.85] active:brightness-[0.8]"
                  onClick={(e) => { e.stopPropagation(); onFavorite() }}
                  style={{ transition: `opacity ${T}, transform ${T}` }}
                >
                  <Heart
                    size={20}
                    className={isFavorite ? 'fill-current' : ''}
                    style={{
                      color: isFavorite ? COLORS.red : colors.textMuted,
                      filter: 'none',
                    }}
                  />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </CardShell>
  )
}, (prev, next) => {
  return prev.game.appid === next.game.appid
    && prev.index === next.index
    && prev.viewMode === next.viewMode
    && prev.isFavorite === next.isFavorite
    && prev.batchMode === next.batchMode
    && prev.isSelected === next.isSelected
    && prev.colors === next.colors
    && prev.isInLibrary === next.isInLibrary
    && prev.onRemoveFromLibrary === next.onRemoveFromLibrary
    && prev.compactMode === next.compactMode
})
