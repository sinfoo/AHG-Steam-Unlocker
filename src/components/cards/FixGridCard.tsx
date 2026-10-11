import { useState, useMemo, useCallback, memo } from 'react'
import { Loader2, Zap } from 'lucide-react'
import { COLORS } from '../../constants/colors'
import type { Fix } from '../../types'
import type { ColorScheme } from '../../types/colors'
import GameCover from '../GameCover'
import { CardShell } from './CardShell'
import { useT } from '../../i18n'
import { useFixTagLabel } from '../../utils/genreLabel'

// ── Badge → colour key map ──
const BADGE_COLORS: Record<string, string> = {
  'Online': 'green',
  'Tested': 'blue',
  'Bypass': 'amber',
  'sinfo': 'red',
  'Hypervisor': 'cyan',
  'Unstable': 'red',
  'Extra Steps': 'purple',
  'Specific Version': 'amber',
}

// Transition constant — DESIGN.md: 80ms cubic-bezier(0.4, 0, 0.2, 1)
const T = '0.08s cubic-bezier(0.4, 0, 0.2, 1)'

// Match the Browse GameCard exactly: header.jpg ONLY.
//  • Dimensions: the wide ~460×215 ("400×215") landscape capsule fits the 16:9 box —
//    no library_600x900 portrait fallback to squish.
//  • Instant rendering: the disk cache key is `appid_<types.join(",")>`, and the shipped
//    warm cache (imagePreloader) stores each image under a single-type key
//    (`appid_header.jpg`). Requesting exactly ['header.jpg'] hits the warm cache (same
//    key the always-instant home page uses); any extra fallback type changes the key,
//    misses the warm cache, and forces a slow network re-fetch.
// Stable module-level refs so GameCover's effect doesn't re-run on hover/scroll.
const PREFERRED_TYPES_GRID = ['header.jpg'] as const
const PREFERRED_TYPES_LIST = ['header.jpg'] as const

// Stable cover transform styles (hover zoom) — avoids breaking memo via inline objects.
const COVER_STYLE_DEFAULT = { transform: 'scale(1)', transition: `transform ${T}` }
const COVER_STYLE_HOVERED = { transform: 'scale(1.08)', transition: `transform ${T}` }

// ── FixGridCard ── (mirrors Browse GameCard grid mode) ──
export const FixGridCard = memo(function FixGridCard({ fix, index, onApply, colors, onContextMenu }: { fix: Fix; index: number; onApply: (url?: string) => void; colors: ColorScheme; onContextMenu?: (e: React.MouseEvent, fix: Fix) => void }) {
  const t = useT()
  const ft = useFixTagLabel()
  const [selectedVer, setSelectedVer] = useState(0)
  const [isApplying, setIsApplying] = useState(false)

  const hasVersions = useMemo(() => fix.versions && fix.versions.length > 1, [fix.versions])
  const appidNum = useMemo(() => parseInt(fix.appid) || 0, [fix.appid])
  const genreHue = useMemo(() => (appidNum * 37) % 360, [appidNum])
  const sourceLabel = fix.source && ['ryuu', 'online', 'sinfo'].includes(fix.source.toLowerCase()) ? fix.source : null

  const handleApply = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (isApplying) return
    setIsApplying(true)
    onApply(hasVersions ? fix.versions![selectedVer]!.url : undefined)
    setTimeout(() => setIsApplying(false), 3000)
  }, [onApply, hasVersions, fix.versions, selectedVer, isApplying])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    onContextMenu?.(e, fix)
  }, [fix, onContextMenu])

  return (
    <CardShell
      variant="grid"
      genreHue={genreHue}
      index={index}
      onClick={() => onApply(hasVersions ? fix.versions![selectedVer]!.url : undefined)}
      onContextMenu={onContextMenu ? handleContextMenu : undefined}
    >
      {(isHovered) => (
        <>
          {/* ── Cover Section (16:9) ── */}
          <div className="relative overflow-hidden" style={{ aspectRatio: '16/9', background: 'var(--s2, #151524)' }}>
            {/* Image with IndexedDB caching via GameCover */}
            <GameCover
              appid={fix.appid}
              name={fix.name}
              className="w-full h-full relative z-[1]"
              genreHue={genreHue}
              preferredImageTypes={PREFERRED_TYPES_GRID}
              eager
              style={isHovered ? COVER_STYLE_HOVERED : COVER_STYLE_DEFAULT}
            />

            {/* Cinematic gradient overlay */}
            <div
              className="absolute inset-0 pointer-events-none z-[2]"
              style={{ background: 'linear-gradient(180deg,rgba(0,0,0,.35) 0%,transparent 28%,transparent 62%,rgba(6,6,12,.55) 100%)' }}
            />

            {/* ── AppID badge (top-left, hover-revealed) ── */}
            <div
              className="absolute bottom-2 end-2 z-20 mono px-1.5 py-0.5 rounded-md text-[10px] font-semibold opacity-0 group-hover:opacity-100"
              style={{
                background: 'rgba(8,8,16,.72)',
                color: COLORS.textMuted,
                border: '1px solid rgba(255,255,255,0.12)',
                transition: 'opacity .3s ease',
              }}
            >
              #{fix.appid}
            </div>

            {/* ── Source badge (top-right) ── */}
            {sourceLabel && (
              <div
                className="absolute top-2 start-2 z-20 mono px-[7px] py-[3px] rounded-[7px] text-[10.5px] font-semibold uppercase"
                style={{
                  letterSpacing: '.1em',
                  background: sourceLabel.toLowerCase() === 'sinfo' ? 'rgba(245,158,11,.92)' : 'rgba(8,8,16,.75)',
                  color: sourceLabel.toLowerCase() === 'sinfo' ? '#1f1300' : COLORS.textSecondary,
                  border: '1px solid rgba(255,255,255,0.10)',
                }}
              >
                {sourceLabel}
              </div>
            )}
          </div>

          {/* ── Info Panel ── */}
          <div className="p-3.5 space-y-2.5">
            {/* Title — reserve 2 lines so every card is the same height */}
            <h3
              className="text-[13.5px] font-semibold leading-tight line-clamp-2"
              style={{ minHeight: '2.5em', color: COLORS.text }}
            >
              {fix.name}
            </h3>

            {/* Badges + fix count */}
            <div className="flex items-center gap-1.5 flex-wrap min-h-[24px]">
              {fix.badges && fix.badges.length > 0 ? (
                fix.badges.map((badge, bi) => {
                  const badgeColor = (colors as any)[BADGE_COLORS[badge]!] ?? colors.pink
                  return (
                    <span key={bi} className="fixcard-badge" style={{ background: badgeColor + '1f', color: badgeColor, border: `1px solid ${badgeColor}33` }}>
                      {ft(badge)}
                    </span>
                  )
                })
              ) : (
                <span className="text-[11px]" style={{ color: colors.textDim }}>{t('app.fix.noLabels')}</span>
              )}
              {fix.fix_count > 0 && (
                <span className="ms-auto text-[10px] font-semibold px-2 py-0.5 rounded-md" style={{ background: `${colors.green}15`, color: colors.green }}>
                  {t(fix.fix_count === 1 ? 'app.fix.count.one' : 'app.fix.count.other', { n: fix.fix_count })}
                </span>
              )}
            </div>

            {/* ── Version selector ── */}
            {hasVersions && (
              <select
                value={selectedVer}
                onChange={(e) => setSelectedVer(Number(e.target.value))}
                className="fixcard-select w-full"
                style={{ background: colors.bgDeep, border: `1px solid ${colors.border}`, color: colors.text }}
                onClick={(e) => e.stopPropagation()}
              >
                {fix.versions!.map((v, i) => (
                  <option key={i} value={i}>
                    {v.name || `v${i + 1}`}{v.size ? ` (${v.size})` : ''}
                  </option>
                ))}
              </select>
            )}

            {/* ── Apply Fix button (styled like GameCard's Add to Steam) ── */}
            <div className="flex flex-col gap-1.5 pt-0.5">
              <button
                onClick={handleApply}
                disabled={isApplying}
                className="gamecard-btn-steam flex-1 text-[12.5px] py-2 px-3 flex items-center justify-center gap-2 leading-none cursor-pointer pointer-events-auto disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ background: COLORS.amber, color: '#1f1300' }}
              >
                {isApplying ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
                <span>{isApplying ? t('app.fix.applyingDots') : t('app.fix.applyFix')}</span>
              </button>
            </div>
          </div>
        </>
      )}
    </CardShell>
  )
}, (prev, next) => {
  return prev.fix.appid === next.fix.appid
    && prev.index === next.index
    && prev.colors === next.colors
    && prev.onApply === next.onApply
})

// ── FixListCard ── (mirrors Browse GameCard list mode) ──
export const FixListCard = memo(function FixListCard({ fix, index, onApply, colors, onContextMenu }: { fix: Fix; index: number; onApply: (url?: string) => void; colors: ColorScheme; onContextMenu?: (e: React.MouseEvent, fix: Fix) => void }) {
  const t = useT()
  const ft = useFixTagLabel()
  const [selectedVer, setSelectedVer] = useState(0)
  const [isApplying, setIsApplying] = useState(false)
  const hasVersions = fix.versions && fix.versions.length > 1

  const appidNum = useMemo(() => parseInt(fix.appid) || 0, [fix.appid])
  const genreHue = useMemo(() => (appidNum * 37) % 360, [appidNum])

  const handleApplyList = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (isApplying) return
    setIsApplying(true)
    onApply(hasVersions ? fix.versions![selectedVer]!.url : undefined)
    setTimeout(() => setIsApplying(false), 3000)
  }, [onApply, hasVersions, fix.versions, selectedVer, isApplying])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    onContextMenu?.(e, fix)
  }, [fix, onContextMenu])

  return (
    <CardShell
      variant="list"
      genreHue={genreHue}
      index={index}
      onContextMenu={onContextMenu ? handleContextMenu : undefined}
    >
      {(isHovered) => (
        <div className="flex items-center w-full gap-4 p-4">
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

          <div className="relative z-10 flex items-center gap-4 w-full">
            {/* ── Thumbnail ── */}
            <div
              className="w-[72px] h-[40px] rounded-lg overflow-hidden shrink-0 relative"
              style={{ transform: isHovered ? 'scale(1.1)' : 'scale(1)', transition: `transform ${T}` }}
            >
              <GameCover
                appid={fix.appid}
                name={fix.name}
                className="w-full h-full"
                genreHue={genreHue}
                preferredImageTypes={PREFERRED_TYPES_LIST}
                eager
              />
            </div>

            {/* ── Title + badges ── */}
            <div className="flex-1 min-w-0">
              <h3
                className="font-bold truncate"
                style={{ color: COLORS.text }}
              >
                {fix.name}
              </h3>
              <div className="flex gap-1 mt-1 flex-wrap">
                {fix.badges && fix.badges.length > 0 ? (
                  fix.badges.slice(0, 4).map((badge, bi) => {
                    const badgeColor = (colors as any)[BADGE_COLORS[badge]!] ?? colors.pink
                    return (
                      <span key={bi} className="fixcard-badge" style={{ background: badgeColor + '1f', color: badgeColor, border: `1px solid ${badgeColor}33` }}>
                        {ft(badge)}
                      </span>
                    )
                  })
                ) : (
                  <span className="text-xs" style={{ color: colors.textDim }}>{t('app.fix.noLabels')}</span>
                )}
              </div>
            </div>

            {/* ── Version + Apply ── */}
            <div className="flex items-center gap-2 shrink-0">
              {hasVersions && (
                <select
                  value={selectedVer}
                  onChange={(e) => setSelectedVer(Number(e.target.value))}
                  className="fixcard-select"
                  style={{ background: colors.bgDeep, border: `1px solid ${colors.border}`, color: colors.text }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {fix.versions!.map((v, i) => (
                    <option key={i} value={i}>
                      {v.name || `v${i + 1}`}{v.size ? ` (${v.size})` : ''}
                    </option>
                  ))}
                </select>
              )}
              <button
                onClick={handleApplyList}
                disabled={isApplying}
                className="gamecard-btn-steam text-[12.5px] py-2 px-5 flex items-center gap-2 leading-none cursor-pointer pointer-events-auto disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ background: COLORS.amber, color: '#1f1300' }}
              >
                {isApplying ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
                <span>{isApplying ? t('app.fix.applyingDots') : t('app.fix.applyFix')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </CardShell>
  )
}, (prev, next) => {
  return prev.fix.appid === next.fix.appid
    && prev.index === next.index
    && prev.colors === next.colors
    && prev.onApply === next.onApply
})
