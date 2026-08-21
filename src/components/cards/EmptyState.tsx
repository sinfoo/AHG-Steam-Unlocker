import { memo, type ReactNode } from 'react'
import { COLORS } from '../../constants/colors'

// ── Built-in inline SVG illustrations (no external assets) ──

function GamesEmptySvg({ color }: { color: string }) {
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-24 h-24">
      <rect x="12" y="20" width="72" height="50" rx="8" stroke={color} strokeWidth="2" fill="none" opacity="0.3" />
      <rect x="18" y="28" width="24" height="16" rx="4" fill={color} opacity="0.15" />
      <circle cx="30" cy="36" r="3" fill={color} opacity="0.4" />
      <line x1="18" y1="50" x2="44" y2="50" stroke={color} strokeWidth="2" opacity="0.25" />
      <line x1="18" y1="56" x2="36" y2="56" stroke={color} strokeWidth="2" opacity="0.15" />
      <rect x="52" y="28" width="26" height="16" rx="4" fill={color} opacity="0.1" />
      <line x1="52" y1="50" x2="78" y2="50" stroke={color} strokeWidth="2" opacity="0.2" />
      <line x1="52" y1="56" x2="70" y2="56" stroke={color} strokeWidth="2" opacity="0.1" />
      <path d="M20 70v6a4 4 0 004 4h48a4 4 0 004-4v-6" stroke={color} strokeWidth="2" fill="none" opacity="0.2" />
    </svg>
  )
}

function SearchEmptySvg({ color }: { color: string }) {
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-24 h-24">
      <circle cx="40" cy="40" r="20" stroke={color} strokeWidth="2.5" fill="none" opacity="0.3" />
      <circle cx="40" cy="40" r="8" fill={color} opacity="0.1" />
      <line x1="54" y1="54" x2="70" y2="70" stroke={color} strokeWidth="3" strokeLinecap="round" opacity="0.4" />
      <path d="M20 72a28 28 0 0156 0" stroke={color} strokeWidth="2" fill="none" opacity="0.15" strokeLinecap="round" />
    </svg>
  )
}

function FixesEmptySvg({ color }: { color: string }) {
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-24 h-24">
      <circle cx="48" cy="48" r="28" stroke={color} strokeWidth="2" fill="none" opacity="0.15" />
      <path d="M36 42l-6-6a4 4 0 010-5.66l2.34-2.34a4 4 0 015.66 0l6 6" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.3" />
      <path d="M44 50l10-10a4 4 0 015.66 0l2.34 2.34a4 4 0 010 5.66L52 68" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.4" />
      <circle cx="38" cy="40" r="3" fill={color} opacity="0.5" />
      <circle cx="52" cy="54" r="3" fill={color} opacity="0.5" />
      <path d="M28 68l6-6M62 40l6-6" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.2" />
      <path d="M48 76v4a4 4 0 004 4h8a4 4 0 004-4v-4" stroke={color} strokeWidth="1.5" fill="none" opacity="0.2" />
    </svg>
  )
}

function RecentEmptySvg({ color }: { color: string }) {
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-24 h-24">
      <circle cx="48" cy="46" r="24" stroke={color} strokeWidth="2" fill="none" opacity="0.25" />
      <path d="M48 34v14l10 6" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.5" />
      <path d="M24 78a24 24 0 0148 0" stroke={color} strokeWidth="2" fill="none" opacity="0.15" strokeLinecap="round" />
      <path d="M68 18l4 4-4 4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.3" />
      <path d="M18 46h6M72 46h6" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.2" />
      <circle cx="48" cy="46" r="4" fill={color} opacity="0.3" />
    </svg>
  )
}

function FavouritesEmptySvg({ color }: { color: string }) {
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-24 h-24">
      <path d="M48 20l8.66 17.54 19.34 2.82-14 13.64 3.3 19.28L48 64.66 30.7 73.28l3.3-19.28-14-13.64 19.34-2.82z" stroke={color} strokeWidth="2" strokeLinejoin="round" fill="none" opacity="0.35" />
      <path d="M48 32v28M36 46h24" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.2" />
      <circle cx="48" cy="48" r="2" fill={color} opacity="0.5" />
      <path d="M22 24l4 4-4 4M74 24l4 4-4 4" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.25" />
      <path d="M48 12v6" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.2" />
      <circle cx="30" cy="32" r="1.5" fill={color} opacity="0.3" />
      <circle cx="66" cy="32" r="1.5" fill={color} opacity="0.3" />
    </svg>
  )
}

// ── Illustration map ──

export type EmptyIllustration = 'games' | 'search' | 'library' | 'fixes' | 'recent' | 'favourites'

const ILLUSTRATIONS: Record<EmptyIllustration, (color: string) => ReactNode> = {
  games: (c) => <GamesEmptySvg color={c} />,
  search: (c) => <SearchEmptySvg color={c} />,
  library: (c) => <GamesEmptySvg color={c} />,
  fixes: (c) => <FixesEmptySvg color={c} />,
  recent: (c) => <RecentEmptySvg color={c} />,
  favourites: (c) => <FavouritesEmptySvg color={c} />,
}

// ── EmptyState ──

export const EmptyState = memo(function EmptyState({
  icon: Icon, title, subtitle, color, action,
  illustration,
}: {
  icon?: any
  title: string
  subtitle: string
  color: string
  action?: { label: string; onClick: () => void }
  /** Use a built-in SVG illustration instead of a lucide icon */
  illustration?: EmptyIllustration
}) {
  return (
    <div className="text-center py-24">
      <style>{`
        @keyframes popIn {
          0% { transform: scale(0); }
          70% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }
        .empty-state-icon {
          animation: popIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        @keyframes fadeInUp {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .empty-state-text {
          animation: fadeInUp 0.4s ease-out both;
        }
        .empty-state-text:nth-child(2) { animation-delay: 0.1s; }
        .empty-state-text:nth-child(3) { animation-delay: 0.2s; }
        .empty-action-btn:hover {
          transform: scale(1.04);
        }
        .empty-action-btn:active {
          transform: scale(0.96);
        }
      `}</style>

      {/* ── Icon or SVG illustration ── */}
      <div
        className={`${illustration ? '' : 'empty-state-icon'} relative w-24 h-24 mx-auto mb-6 rounded-3xl flex items-center justify-center`}
        style={illustration ? {} : {
          background: `linear-gradient(135deg, ${color}25 0%, ${color}10 100%)`,
          border: `1px solid ${color}30`,
          boxShadow: `0 0 40px ${color}15, 0 0 80px ${color}08`,
        }}
      >
        {illustration ? (
          ILLUSTRATIONS[illustration](color)
        ) : (
          <>
            <div
              className="absolute inset-0 rounded-3xl opacity-50"
              style={{
                background: `radial-gradient(circle at 50% 50%, ${color}15 0%, transparent 70%)`,
              }}
            />
            {Icon && <Icon size={44} style={{ color, position: 'relative', zIndex: 1 }} />}
          </>
        )}
      </div>

      <h3 className="empty-state-text text-2xl font-extrabold text-white mb-2 tracking-tight">{title}</h3>
      <p className="empty-state-text text-base mb-7" style={{ color: COLORS.textMuted }}>{subtitle}</p>

      {action && (
        <button
          onClick={action.onClick}
          className="empty-action-btn px-7 py-3 rounded-xl text-sm font-bold inline-flex items-center gap-2 cursor-pointer"
          style={{
            background: `linear-gradient(135deg, ${color}25 0%, ${color}12 100%)`,
            color,
            border: `1px solid ${color}45`,
            boxShadow: `0 4px 16px ${color}20`,
            transition: 'all 80ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  )
})

// ── StatCard ──
export const StatCard = memo(function StatCard({ icon: Icon, value, label, color, onClick }: { icon: any; value: number; label: string; color: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className="flex-shrink-0 px-6 py-4 rounded-2xl cursor-pointer group"
      style={{
        background: `linear-gradient(135deg, ${color}15 0%, ${color}08 100%)`,
        border: `1px solid ${color}30`,
        boxShadow: `0 4px 20px ${color}10`
      }}
    >
      <Icon size={24} style={{ color }} className="mb-2" />
      <p className="text-3xl font-bold" style={{ color }}>{value}</p>
      <p className="text-sm font-medium" style={{ color: COLORS.textMuted }}>{label}</p>
    </div>
  )
})
