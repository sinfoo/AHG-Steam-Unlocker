import { memo, useMemo, useState, useCallback } from 'react'
import { Search, Loader2, ChevronLeft, ChevronRight, Plus, Heart, Shield, Crown, Flame } from 'lucide-react'
import type { Game } from '../types'
import { COLORS } from '../constants/colors'
import { GlowCard } from './ui'
import GameCover from './GameCover'

export const POPULAR_RANK = new Map([
  ['730', 1], ['3041230', 2], ['3321460', 3], ['230410', 4], ['578080', 5],
  ['2868840', 6], ['570', 7], ['3564740', 8], ['2767030', 9], ['1973530', 10],
  ['2050650', 11], ['3764200', 12], ['2507950', 13], ['381210', 14], ['306130', 15],
  ['3240220', 16], ['236390', 17], ['359550', 18], ['1808500', 19], ['252490', 20],
  ['440', 21], ['2399830', 22], ['553850', 23], ['1151340', 24], ['3472040', 25],
  ['271590', 26], ['1086940', 27], ['1245620', 28], ['1091500', 29], ['814380', 30],
  ['552520', 31], ['1593500', 32], ['1551360', 33], ['2322010', 34], ['1174180', 35],
])

interface GameCardProps {
  game: Game
  index: number
  onClick: () => void
  onAdd: () => void
  onToggleFavorite: () => void
  isFavorite: boolean
}

// Genre → hue mapping for genre-colored accents
const GENRE_HUE: Record<string, number> = {
  'Action': 0, 'FPS': 350, 'Horror': 340, 'Racing': 5,
  'Adventure': 30, 'Sandbox': 45, 'RPG': 270, 'Indie': 260,
  'Strategy': 220, 'Casual': 210, 'Simulation': 120, 'Arcade': 290,
  'Sports': 190, 'Fighting': 0, 'Puzzle': 180, 'Open World': 260,
  'Platformer': 240, 'Survival': 15,
}
function getHue(genre: string): number {
  return GENRE_HUE[genre] ?? 260
}

function GameCardInner({ game, index, onClick, onAdd, onToggleFavorite, isFavorite }: GameCardProps) {
  const [installing, setInstalling] = useState(false)
  const isFirstBatch = index < 12
  
  const popularity = POPULAR_RANK.get(String(game.appid)) || null
  
  const genreTag = game.tags && game.tags.length > 0
    ? game.tags[0]
    : null

  const genre = game.genres?.[0] ?? game.tags?.[0] ?? null
  const genreHue = useMemo(() => {
    return genre ? getHue(genre) : 260
  }, [genre])

  const isDlc = (game.type || '').toLowerCase() === 'dlc'
  const isHot = popularity !== null && popularity <= 10
  
  return (
    <>
      <style>{`
        @keyframes cardEnter {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes pulse-opacity {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
      `}</style>
      <div
        onClick={onClick}
        className="cursor-pointer group transition-transform duration-80 ease-[cubic-bezier(0.4,0,0.2,1)] group-hover:scale-[1.03] group-hover:-translate-y-[6px] active:scale-[0.97]"
        style={{ transformStyle: 'preserve-3d', animation: `cardEnter 0.25s ease-out ${Math.min(index * 0.003, 0.1)}s both` }}
      >
      <GlowCard 
        glowColor="purple" 
        customSize 
        genreHue={genreHue}
        className="overflow-hidden rounded-2xl h-full w-full p-0 gap-0 block shadow-none"
        style={{ background: `linear-gradient(180deg, ${COLORS.bgCard} 0%, ${COLORS.bgMid} 100%)`, contentVisibility: 'auto', contain: 'layout style paint' }}
      >
      {/* ── Cover Image ── */}
      <div className="relative aspect-[4/5] overflow-hidden" style={{ background: COLORS.bgDark }}>
        <GameCover
          appid={game.appid}
          name={game.name}
          localHeader={game.header_image}
          className="w-full h-full transition-all duration-500 ease-out group-hover:scale-[1.12] group-hover:-rotate-[1deg]"
          preferredImageTypes={['portrait.jpg']}
          eager={isFirstBatch}
        />
        
        {/* Cinematic gradient overlay for text readability */}
        <div 
          className="absolute inset-x-0 bottom-0 h-2/4 pointer-events-none transition-all duration-200 ease-out group-hover:opacity-[0.98]"
          style={{ 
            background: 'linear-gradient(to top, rgba(18, 18, 31, 0.97) 25%, rgba(18, 18, 31, 0.5) 50%, rgba(18, 18, 31, 0.15) 75%, transparent 100%)',
            opacity: 0.75,
          }}
        />
        
        {/* Inner border/shadow frame on hover */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-2xl"
          style={{ 
            boxShadow: 'inset 0 0 0 1px rgba(139, 92, 246, 0.25), inset 0 0 40px rgba(139, 92, 246, 0.04)',
          }}
        />
        
        {/* ── Badges (top-left) ── */}
        <div className="absolute top-3 left-3 flex gap-1.5 z-10">
          {/* HOT indicator for top 10 */}
          {isHot && (
            <span 
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5"
              style={{
                background: 'rgba(239, 68, 68, 0.2)',
                color: '#fca5a5', // intentional dynamic color
                border: '1px solid rgba(239, 68, 68, 0.3)',
                animation: 'pulse-opacity 2s ease-in-out infinite',
              }}
            >
              <Flame size={8} /> HOT
            </span>
          )}
          {popularity && (
            <span 
              className="text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 tracking-tight"
              style={{ 
                background: popularity <= 3 
                  ? popularity === 1 
                    ? `linear-gradient(135deg, ${COLORS.amber}, ${COLORS.amber}cc)` // intentional dynamic color
                    : popularity === 2
                      ? `linear-gradient(135deg, ${COLORS.text}, ${COLORS.textMuted})` // intentional dynamic color
                      : `linear-gradient(135deg, ${COLORS.amber}, ${COLORS.amber}88)` // intentional dynamic color
                  : 'rgba(245, 158, 11, 0.85)',
                color  : popularity <= 3 ? COLORS.amber : COLORS.white,
                boxShadow: popularity === 1 
                  ? '0 2px 12px rgba(251, 191, 36, 0.6), 0 0 20px rgba(251, 191, 36, 0.2)' 
                  : popularity <= 3
                    ? '0 2px 12px rgba(212, 160, 86, 0.4)'
                    : '0 2px 8px rgba(245, 158, 11, 0.3)',
              }}
            >
              {popularity <= 3 && <Crown size={9} strokeWidth={2.5} />}
              #{popularity}
            </span>
          )}
          {game.drm && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1" style={{ 
              background: COLORS.redDim, 
                color: '#fca5a5', // intentional dynamic color
              
              border: '1px solid rgba(239, 68, 68, 0.3)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
            }}>
              <Shield size={8} /> DRM
            </span>
          )}
        </div>
        
        {/* ── Favorite button (top-right) ── */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFavorite() }}
          className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center z-20 opacity-0 group-hover:opacity-100 transition-all duration-150 hover:scale-[1.15] active:scale-[0.85] active:brightness-[0.85]"
          style={{ 
            background: isFavorite 
              ? 'rgba(0,0,0,0.55)' 
              : 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            boxShadow: isFavorite 
              ? `0 0 20px hsla(${genreHue}, 60%, 50%, 0.3), 0 0 40px hsla(${genreHue}, 60%, 50%, 0.1)` 
              : '0 2px 8px rgba(0,0,0,0.3)',
          }}
        >
          <Heart size={13} className={isFavorite ? 'text-white fill-white' : 'text-gray-300'} />
        </button>
        
        {/* ── Add to Steam floating button (hover reveal) ── */}
        <div
          className="absolute inset-x-0 bottom-0 flex items-center justify-center z-30 pb-4 opacity-0 translate-y-3 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-150 ease-out"
        >
          <button
            className="px-5 py-2.5 rounded-full font-bold text-white flex items-center gap-2 text-xs tracking-wide transition-all duration-80 ease-[cubic-bezier(0.4,0,0.2,1)] hover:scale-[1.05] hover:shadow-[0_6px_28px_rgba(139,92,246,0.6)] active:scale-[0.95] disabled:scale-100 disabled:shadow-none"
            style={{ 
              background: installing ? `linear-gradient(135deg, ${COLORS.textDim}, ${COLORS.border})` : `linear-gradient(135deg, ${COLORS.violet}, ${COLORS.violet}cc)`, // intentional dynamic color
              boxShadow: installing ? 'none' : `0 4px 20px ${COLORS.violetGlow}`,
            }}
            onClick={async (e) => { 
              e.stopPropagation()
              if (installing) return
              setInstalling(true)
              try {
                await onAdd()
              } finally {
                setInstalling(false)
              }
            }}
            disabled={installing}
          >
            {installing ? (
              <><Loader2 size={14} className="animate-spin" /> Installing...</>
            ) : (
              <><Plus size={14} strokeWidth={3} /> Add to Steam</>
            )}
          </button>
        </div>
      </div>
      
      {/* ── Info Footer ── */}
      <div 
        className="p-3.5 space-y-1.5 relative transition-all duration-80 ease-[cubic-bezier(0.4,0,0.2,1)] group-hover:-translate-y-0.5"
      >
        {/* Violet accent border line that scales in on hover */}
        <div 
          className="absolute top-0 left-0 right-0 h-[1px] scale-x-0 group-hover:scale-x-100 transition-transform duration-200 ease-out origin-left rounded-full pointer-events-none"
          style={{ background: `linear-gradient(90deg, ${COLORS.violet}, ${COLORS.violetLight}, transparent)` }}
        />
        
        <h3 className="text-sm font-semibold truncate leading-tight transition-colors duration-80 ease-[cubic-bezier(0.4,0,0.2,1)] group-hover:text-[${COLORS.violetLight}]" style={{ 
            color: COLORS.text,
          textShadow: '0 0 0 transparent',
        }}>
          {game.name}
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium" style={{ color: COLORS.textMuted }}>#{game.appid}</span>
          {!isDlc ? (
            <>
              {genreTag && (
                <>
<span className="text-[10px]" style={{ color: COLORS.borderLight }}>|</span>
                  <span 
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded" 
                    style={{ 
                      background: `hsla(${genreHue}, 60%, 50%, 0.15)`,
                      color: `hsl(${genreHue}, 60%, 70%)`,
                      border: `1px solid hsla(${genreHue}, 60%, 50%, 0.2)`,
                    }}
                  >
                    {genreTag}
                  </span>
                </>
              )}
            </>
          ) : (
            <>
              <span className="text-[10px]" style={{ color: COLORS.borderLight }}>|</span>
              <div className="flex items-center gap-1">
                <span 
                  className="w-[6px] h-[6px] rounded-full"
                  style={{ background: COLORS.green, boxShadow: `0 0 6px ${COLORS.green}99`, animation: 'pulse-opacity 2s ease-in-out infinite' }}
                />
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: `${COLORS.green}1f`, color: COLORS.green }}>
                  DLC
                </span>
              </div>
            </>
          )}
        </div>
      </div>
      </GlowCard>
    </div>
    </>
  )
}

const GameCard = memo(GameCardInner)

// Wrapper component that creates stable callbacks via useCallback to preserve GameCard memo
const GameGridCell = memo(function GameGridCell({ game, index, isFavorite, onSelectGame, onAddGame, onToggleFavorite }: {
  game: Game; index: number; isFavorite: boolean;
  onSelectGame: (game: Game) => void;
  onAddGame: (game: Game) => void;
  onToggleFavorite: (appid: string) => void;
}) {
  const handleClick = useCallback(() => onSelectGame(game), [onSelectGame, game])
  const handleAdd = useCallback(() => onAddGame(game), [onAddGame, game])
  const handleToggleFavorite = useCallback(() => onToggleFavorite(game.appid), [onToggleFavorite, game.appid])
  
  return (
    <GameCard
      game={game}
      index={index}
      onClick={handleClick}
      onAdd={handleAdd}
      onToggleFavorite={handleToggleFavorite}
      isFavorite={isFavorite}
    />
  )
})

interface GameGridProps {
  title: string
  games: Game[]
  loading: boolean
  favorites: Set<string>
  recentAppIds: string[]
  sortBy: string
  page: number
  gamesPerPage: number
  popularOnly?: boolean
  onPageChange: (page: number) => void
  onSelectGame: (game: Game) => void
  onToggleFavorite: (appid: string) => void
  onAddGame: (game: Game) => void
}

export const GameGrid = memo(function GameGrid({
  title,
  games,
  loading,
  favorites,
  recentAppIds,
  sortBy,
  page,
  gamesPerPage,
  popularOnly,
  onPageChange,
  onSelectGame,
  onToggleFavorite,
  onAddGame,
}: GameGridProps) {
  // Filter games based on title
  const filteredGames = useMemo(() => {
    let result = [...games]
    
    if (title === 'Favourites') {
      result = result.filter(g => favorites.has(g.appid))
    } else if (title === 'Recent') {
      result = result.filter(g => recentAppIds.includes(g.appid))
    }
    
    if (popularOnly) {
      result = result.filter(g => POPULAR_RANK.has(g.appid))
    }
    
    // Sort
    result.sort((a, b) => {
      const aPop = POPULAR_RANK.get(a.appid) || 99999
      const bPop = POPULAR_RANK.get(b.appid) || 99999
      
      if (sortBy === 'popularity') return aPop - bPop
      if (sortBy === 'name_asc') return (a.name ?? '').localeCompare(b.name ?? '')
      if (sortBy === 'name_desc') return (b.name ?? '').localeCompare(a.name ?? '')
      return 0
    })
    
    return result
  }, [games, title, favorites, recentAppIds, sortBy, popularOnly])
  
  const totalPages = Math.ceil(filteredGames.length / gamesPerPage)
  const paginatedGames = filteredGames.slice(page * gamesPerPage, (page + 1) * gamesPerPage)
  
  const handlePrevPage = useCallback(() => onPageChange(Math.max(0, page - 1)), [page, onPageChange])
  const handleNextPage = useCallback(() => onPageChange(Math.min(totalPages - 1, page + 1)), [page, totalPages, onPageChange])
  
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="animate-spin text-violet-500" size={48} />
      </div>
    )
  }
  
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Grid */}
      <div className="flex-1 overflow-auto p-5">
        {filteredGames.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full" style={{ color: COLORS.textDim }}>
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-5" style={{ background: COLORS.violet + '10', border: `1px solid ${COLORS.violet}20` }}>
              <Search size={32} style={{ color: COLORS.violet, opacity: 0.5 }} />
            </div>
            <p className="text-xl font-bold" style={{ color: COLORS.textMuted }}>No games found</p>
            <p className="text-sm mt-1" style={{ color: COLORS.textDim }}>Try a different filter or search term</p>
          </div>
        ) : (
          <div className="grid gap-5 responsive-grid">
            {paginatedGames.map((game, i) => (
              <GameGridCell
                key={game.appid}
                game={game}
                index={i}
                isFavorite={favorites.has(game.appid)}
                onSelectGame={onSelectGame}
                onAddGame={onAddGame}
                onToggleFavorite={onToggleFavorite}
              />
            ))}
          </div>
        )}
      </div>
      
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="p-4 flex items-center justify-center gap-2" style={{ borderTop: `1px solid ${COLORS.whiteGlassBorder}` }}>
          <button
            onClick={handlePrevPage}
            disabled={page === 0}
            className="p-2.5 rounded-xl disabled:opacity-50 hover:scale-105 active:scale-95 transition-transform duration-150"
            style={{ background: page === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.1)' }}
          >
            <ChevronLeft size={18} className="text-gray-400" />
          </button>
          
          {Array.from({ length: Math.min(7, totalPages) }, (_, i) => (
            <button
              key={i}
              onClick={() => onPageChange(i)}
              className="w-10 h-10 rounded-xl text-sm font-bold"
              style={{ background: page === i ? COLORS.violet : 'rgba(255,255,255,0.05)', color: page === i ? COLORS.white : COLORS.textMuted }}
            >
              {i + 1}
            </button>
          ))}
          
          <button
            onClick={handleNextPage}
            disabled={page >= totalPages - 1}
            className="p-2.5 rounded-xl disabled:opacity-50 hover:scale-105 active:scale-95 transition-transform duration-150"
            style={{ background: page >= totalPages - 1 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.1)' }}
          >
            <ChevronRight size={18} className="text-gray-400" />
          </button>
          
          <span className="text-xs ml-3" style={{ color: COLORS.textDim }}>Page {page + 1} of {totalPages}</span>
        </div>
      )}
    </div>
  )
})
