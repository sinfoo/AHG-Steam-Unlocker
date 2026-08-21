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
              className="absolute top-3 left-3 z-30 w-7 h-7 rounded-full flex items-center justify-center cursor-pointer"
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
              {/* ══════ Grid Mode ══════ */}

              {/* ── "New" badge for recently-added games ── */}
              {isRecentlyAdded(game) && (
                <div className="absolute top-3 left-3 z-20 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider"
                  style={{
                    background: 'linear-gradient(135deg, rgba(16,185,129,0.85), rgba(5,150,105,0.7))',
                    color: 'white',
                    boxShadow: '0 2px 8px rgba(16,185,129,0.35)',
                  }}
                >
                  New
                </div>
              )}

              {/* ── Install speed badge (below "New", above "Installed") ── */}
              {game.size && !isInLibrary && (
                <div className="absolute top-[36px] right-3 z-20">
                  <InstallSpeedBadge sizeBytes={game.size} />
                </div>
              )}

              {/* ── Cover Section (16:9) ── */}
              <div
                className="relative overflow-hidden card-sheen"
                style={{ aspectRatio: '16/9' }}
              >
                {/* Genre-tinted placeholder background */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: `linear-gradient(135deg, hsla(${genreHue}, 60%, 15%, 0.50), ${COLORS.bgDeep})`,
                  }}
                />

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

                {/* Cinematic gradient overlay */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: 'linear-gradient(to top, rgba(10,10,15,0.95) 10%, rgba(10,10,15,0.30) 40%, transparent 60%)',
                  }}
                />

                {/* Genre vignette on hover — CSS only via class */}
                <div className={`card-genre-vignette ${isHovered ? 'active' : ''}`}
                  style={{ '--ghue': genreHue } as React.CSSProperties}
                />

                {/* ── AppID badge (top-left) ── */}
                <div
                  className="absolute top-2.5 left-2.5 z-20 px-1.5 py-0.5 rounded-md text-[9px] font-mono font-semibold opacity-0 group-hover:opacity-100"
                  style={{
                    background: 'rgba(0,0,0,0.6)',
                    color: COLORS.textMuted,
                    border: '1px solid rgba(255,255,255,0.08)',
                    backdropFilter: 'blur(4px)',
                    WebkitBackdropFilter: 'blur(4px)',
                    transition: `opacity ${T}`,
                  }}
                >
                  #{game.appid}
                </div>

                {/* ── Favorite button (top-right) ── */}
                <button
                  className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full flex items-center justify-center z-20 cursor-pointer opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-[0.9] active:brightness-[0.8]"
                  onClick={(e) => { e.stopPropagation(); onFavorite() }}
                  style={{
                    background: isFavorite ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.45)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    boxShadow: isFavorite
                      ? `0 0 20px hsla(${genreHue}, 60%, 50%, 0.30), 0 0 40px hsla(${genreHue}, 60%, 50%, 0.10)`
                      : '0 2px 8px rgba(0,0,0,0.3)',
                    transition: `opacity ${T}, transform ${T}, box-shadow ${T}`,
                  }}
                >
                  <div key={isFavorite ? 'beat' : 'idle'} className={isFavorite ? 'animate-heart-beat' : ''}>
                    <Heart size={13} className={isFavorite ? 'text-white fill-white' : 'text-gray-300'} />
                  </div>
                </button>

                {/* ── Install / Update badge (top-right, below "New" badge) ── */}
                {isInLibrary && (
                  <div
                    className="absolute top-2.5 right-2.5 z-20 px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1.5 pointer-events-none select-none"
                    style={{
                      background: hasUpdate ? 'rgba(245,158,11,0.18)' : 'rgba(34,197,94,0.18)',
                      backdropFilter: 'blur(6px)',
                      WebkitBackdropFilter: 'blur(6px)',
                      color: hasUpdate ? COLORS.amber : COLORS.green,
                      border: hasUpdate ? '1px solid rgba(245,158,11,0.30)' : '1px solid rgba(34,197,94,0.25)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                    }}
                  >
                    {hasUpdate ? <DownloadIcon size={10} /> : <Check size={10} />}
                    <span>{hasUpdate ? 'Update' : 'Installed'}</span>
                  </div>
                )}
              </div>

              {/* ── Info Panel ── */}
              <div className={`${compactMode ? 'p-3 space-y-2' : 'p-3.5 space-y-2.5'}`}>
                {/* Title with genre-reactive color */}
                <h3
                  className="font-bold text-sm leading-tight line-clamp-2"
                  style={{
                    // Reserve 2 lines so 1-line and 2-line titles occupy equal height,
                    // keeping every grid card the same height → uniform row gaps.
                    minHeight: '2.5em', // ~2 lines at text-sm/leading-tight
                    color: isHovered ? `hsl(${genreHue}, 60%, 78%)` : COLORS.white,
                    textShadow: isHovered
                      ? `0 0 30px hsla(${genreHue}, 60%, 50%, 0.30)`
                      : '0 1px 2px rgba(0,0,0,0.5)',
                    transition: `color ${T}, text-shadow ${T}`,
                  }}
                >
                  {game.name}
                </h3>

                {/* Metadata row */}
                <div className="flex items-center gap-2 text-[11px]" style={{ color: COLORS.textMuted }}>
                  {game.size ? (
                    <span className="text-[10px] opacity-80">{formatBytes(game.size)}</span>
                  ) : null}
                  {(game as any).release_date && (
                    <>
                      <span className="opacity-40">•</span>
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
                      <div className="gamecard-btn-added flex-1 text-[12px] font-bold py-2.5 px-3.5 rounded-xl flex items-center justify-center gap-2 leading-none">
                        <Check size={13} />
                        <span>You've already added this game</span>
                      </div>
                      {onRemoveFromLibrary && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onRemoveFromLibrary(game) }}
                          className="gamecard-btn-remove flex-1 text-[12px] font-bold py-2.5 px-3.5 rounded-xl flex items-center justify-center gap-2 leading-none cursor-pointer pointer-events-auto"
                        >
                          Remove from library
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); onInstallGame?.(game) }}
                        className="gamecard-btn-steam flex-1 text-[12px] font-bold py-2.5 px-3.5 rounded-xl flex items-center justify-center gap-2 leading-none cursor-pointer pointer-events-auto"
                      >
                        <DownloadIcon size={13} />
                        <span>Add to Steam</span>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onInstallFromZip?.(game) }}
                        className="gamecard-btn-zip flex-1 text-[12px] font-bold py-2.5 px-3.5 rounded-xl flex items-center justify-center gap-2 leading-none cursor-pointer pointer-events-auto"
                      >
                        <FolderOpen size={13} />
                        <span>Install Zip</span>
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
                className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full pointer-events-none"
                style={{
                  opacity: isHovered ? 1 : 0,
                  background: `linear-gradient(180deg, hsla(${genreHue}, 65%, 55%, 0.80), hsla(${genreHue}, 60%, 40%, 0.20))`,
                  boxShadow: isHovered ? `0 0 10px hsla(${genreHue}, 60%, 50%, 0.50)` : 'none',
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
                        background: 'linear-gradient(135deg, rgba(16,185,129,0.85), rgba(5,150,105,0.7))',
                        color: 'white',
                      }}
                    >
                      New
                    </span>
                  )}
                  <h3
                    className="font-bold truncate"
                    style={{
                      color: isHovered ? `hsl(${genreHue}, 60%, 72%)` : COLORS.white,
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
                    className={isFavorite ? 'text-white fill-white' : ''}
                    style={{
                      color: isFavorite ? `hsl(${genreHue}, 60%, 70%)` : colors.textMuted,
                      filter: isFavorite
                        ? `drop-shadow(0 0 6px hsla(${genreHue}, 60%, 50%, 0.50))`
                        : 'none',
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
