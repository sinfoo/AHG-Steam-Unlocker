import { create } from 'zustand'
import { bridge } from '../bridge'

type SetStateAction<T> = T | ((prev: T) => T)

// Game and Fix types matching App.tsx's local definitions
type AppGame = { appid: string; name?: string; header_image?: string; tags?: string[]; drm?: boolean; size?: number; isDlc?: boolean; type?: string }
type AppFix = { appid: string; name: string; type?: string; download_url?: string; download_urls?: string[]; badges?: string[]; game_url?: string; source?: string; versions?: { url: string; name?: string; size?: string; badges?: string[] }[] }

export interface GameState {
  // Loading
  loading: boolean
  progress: number
  loadingProgress: number

  // Paginated game data (no full 176K dataset in memory)
  games: AppGame[]
  totalGames: number
  currentPageNum: number
  pageSize: number
  dynamicFreeIds: Set<string>

  // Search & filters
  searchQuery: string
  searchResults: AppGame[]
  sortBy: 'popularity' | 'name_asc' | 'name_desc'

  // View
  viewMode: 'grid' | 'list'

  // Selection
  selectedGame: AppGame | null
  selectedGames: Set<string>
  gamePanelOpen: boolean

  // Fixes
  fixes: AppFix[]
  fixSearchQuery: string
  fixFilter: string[]
  fixPage: number

  // Custom Fixes
  customFixHighlights: any[]
  setCustomFixHighlights: (highlights: any[]) => void

  // Installed / Library
  installedGames: AppGame[]
  /** appids of installed games whose catalog updated_date is newer than what was installed */
  gamesWithUpdates: Set<string>
  librarySearchQuery: string
  browseSearchQuery: string

  // Derived data (set by useGameFilters hook)
  filteredGames: AppGame[]
  gamesWithCover: AppGame[]

  // Known DLC appids
  knownDlcIds: string[]

  // Actions
  appendGames: (games: AppGame[]) => void

  // Pagination actions
  loadPage: (page: number) => Promise<void>
  search: (query: string) => Promise<void>
  setFilter: (platform: string | null) => Promise<void>

  // Setters (legacy)
  setLoading: (value: SetStateAction<boolean>) => void
  setProgress: (value: SetStateAction<number>) => void
  setLoadingProgress: (value: SetStateAction<number>) => void
  setGames: (value: SetStateAction<AppGame[]>) => void
  setDynamicFreeIds: (value: SetStateAction<Set<string>>) => void
  setSearchQuery: (value: SetStateAction<string>) => void
  setSearchResults: (value: SetStateAction<AppGame[]>) => void
  setSortBy: (value: SetStateAction<'popularity' | 'name_asc' | 'name_desc'>) => void
  setViewMode: (value: SetStateAction<'grid' | 'list'>) => void
  setSelectedGame: (value: SetStateAction<AppGame | null>) => void
  setSelectedGames: (value: SetStateAction<Set<string>>) => void
  setGamePanelOpen: (value: SetStateAction<boolean>) => void
  setKnownDlcIds: (value: SetStateAction<string[]>) => void
  setFixes: (value: SetStateAction<AppFix[]>) => void
  setFixSearchQuery: (value: SetStateAction<string>) => void
  setFixFilter: (value: SetStateAction<string[]>) => void
  setFixPage: (value: SetStateAction<number>) => void
  setInstalledGames: (value: SetStateAction<AppGame[]>) => void
  setGamesWithUpdates: (value: SetStateAction<Set<string>>) => void
  setLibrarySearchQuery: (value: SetStateAction<string>) => void
  setBrowseSearchQuery: (value: SetStateAction<string>) => void
  setCurrentPageNum: (value: SetStateAction<number>) => void
  getFixForGame: (gameId: string) => AppFix | undefined
  selectGame: (game: AppGame) => void
  setFilteredGames: (games: AppGame[]) => void
  setGamesWithCover: (games: AppGame[]) => void
}

export const useGameStore = create<GameState>((set, get) => ({
  // Loading
  loading: true,
  progress: 0,
  loadingProgress: 0,

  // Paginated game data (no full 176K dataset)
  games: [],
  totalGames: 0,
  currentPageNum: 1,
  pageSize: 50,
  dynamicFreeIds: new Set(),

  // Search & filters
  searchQuery: '',
  searchResults: [],
  sortBy: 'popularity',
  viewMode: 'grid',

  // Selection
  selectedGame: null,
  selectedGames: new Set(),
  gamePanelOpen: false,

  // Fixes
  fixes: [],
  fixSearchQuery: '',
  fixFilter: ['All'],
  fixPage: 0,
  knownDlcIds: [],

  // Custom Fixes
  customFixHighlights: [],

  // Installed / Library
  installedGames: [],
  gamesWithUpdates: new Set(),
  librarySearchQuery: '',
  browseSearchQuery: '',

  // Derived data
  filteredGames: [],
  gamesWithCover: [],

  // ── Actions ──

  appendGames: (newGames) => set((state) => ({
    games: [...state.games, ...newGames]
  })),

  /** Load a page of games from SQLite via bridge */
  loadPage: async (page: number) => {
    const state = get()
    try {
      const result = await bridge.queryGames({
        page,
        limit: state.pageSize,
        search: state.searchQuery || undefined,
        sort: state.sortBy === 'name_asc' ? 'name_asc' : state.sortBy === 'name_desc' ? 'name_desc' : undefined,
      })
      set({
        games: result.games as AppGame[],
        totalGames: result.total,
        currentPageNum: result.page,
        loading: false,
      })
    } catch (e) {
      console.error('[STORE] loadPage error:', e)
      set({ loading: false })
    }
  },

  /** Search games via SQLite FTS */
  search: async (query: string) => {
    set({ searchQuery: query, loading: true })
    const state = get()
    if (!query.trim()) {
      // Reset to first page
      await state.loadPage(1)
      return
    }
    try {
      const result = await bridge.queryGames({ search: query, limit: 50 })
      set({
        games: result.games as AppGame[],
        totalGames: result.total,
        currentPageNum: 1,
        searchResults: result.games as AppGame[],
        loading: false,
      })
    } catch (e) {
      console.error('[STORE] search error:', e)
      set({ loading: false })
    }
  },

  /** Filter by platform */
  setFilter: async (platform: string | null) => {
    set({ loading: true })
    try {
      if (!platform) {
        await get().loadPage(1)
        return
      }
      const result = await bridge.queryGames({ platform, limit: 5000 })
      set({
        games: result.games as AppGame[],
        totalGames: result.total,
        currentPageNum: 1,
        loading: false,
      })
    } catch (e) {
      console.error('[STORE] setFilter error:', e)
      set({ loading: false })
    }
  },

  // ── Legacy Setters ──

  setLoading: (loading) => set((state) => ({
    loading: typeof loading === 'function' ? loading(state.loading) : loading
  })),
  setProgress: (progress) => set((state) => ({
    progress: typeof progress === 'function' ? progress(state.progress) : progress
  })),
  setLoadingProgress: (loadingProgress) => set((state) => ({
    loadingProgress: typeof loadingProgress === 'function' ? loadingProgress(state.loadingProgress) : loadingProgress
  })),
  setGames: (games) => set((state) => ({
    games: typeof games === 'function' ? games(state.games) : games
  })),
  setDynamicFreeIds: (dynamicFreeIds) => set((state) => ({
    dynamicFreeIds: typeof dynamicFreeIds === 'function' ? dynamicFreeIds(state.dynamicFreeIds) : dynamicFreeIds
  })),
  setSearchQuery: (searchQuery) => set((state) => ({
    searchQuery: typeof searchQuery === 'function' ? searchQuery(state.searchQuery) : searchQuery
  })),
  setSearchResults: (searchResults) => set((state) => ({
    searchResults: typeof searchResults === 'function' ? searchResults(state.searchResults) : searchResults
  })),
  setSortBy: (sortBy) => set((state) => ({
    sortBy: typeof sortBy === 'function' ? sortBy(state.sortBy) : sortBy
  })),
  setViewMode: (viewMode) => set((state) => ({
    viewMode: typeof viewMode === 'function' ? viewMode(state.viewMode) : viewMode
  })),
  setSelectedGame: (selectedGame) => set((state) => ({
    selectedGame: typeof selectedGame === 'function' ? selectedGame(state.selectedGame) : selectedGame
  })),
  setSelectedGames: (selectedGames) => set((state) => ({
    selectedGames: typeof selectedGames === 'function' ? selectedGames(state.selectedGames) : selectedGames
  })),
  setGamePanelOpen: (gamePanelOpen) => set((state) => ({
    gamePanelOpen: typeof gamePanelOpen === 'function' ? gamePanelOpen(state.gamePanelOpen) : gamePanelOpen
  })),
  setFixes: (fixes) => set((state) => ({
    fixes: typeof fixes === 'function' ? fixes(state.fixes) : fixes
  })),
  setFixSearchQuery: (fixSearchQuery) => set((state) => ({
    fixSearchQuery: typeof fixSearchQuery === 'function' ? fixSearchQuery(state.fixSearchQuery) : fixSearchQuery
  })),
  setFixFilter: (fixFilter) => set((state) => ({
    fixFilter: typeof fixFilter === 'function' ? fixFilter(state.fixFilter) : fixFilter
  })),
  setFixPage: (fixPage) => set((state) => ({
    fixPage: typeof fixPage === 'function' ? fixPage(state.fixPage) : fixPage
  })),
  setInstalledGames: (installedGames) => set((state) => ({
    installedGames: typeof installedGames === 'function' ? installedGames(state.installedGames) : installedGames
  })),
  setGamesWithUpdates: (gamesWithUpdates) => set((state) => ({
    gamesWithUpdates: typeof gamesWithUpdates === 'function' ? gamesWithUpdates(state.gamesWithUpdates) : gamesWithUpdates
  })),
  setLibrarySearchQuery: (librarySearchQuery) => set((state) => ({
    librarySearchQuery: typeof librarySearchQuery === 'function' ? librarySearchQuery(state.librarySearchQuery) : librarySearchQuery
  })),
  setBrowseSearchQuery: (browseSearchQuery) => set((state) => ({
    browseSearchQuery: typeof browseSearchQuery === 'function' ? browseSearchQuery(state.browseSearchQuery) : browseSearchQuery
  })),
  setKnownDlcIds: (knownDlcIds) => set((state) => ({
    knownDlcIds: typeof knownDlcIds === 'function' ? knownDlcIds(state.knownDlcIds) : knownDlcIds
  })),
  setCurrentPageNum: (currentPageNum) => set((state) => ({
    currentPageNum: typeof currentPageNum === 'function' ? currentPageNum(state.currentPageNum) : currentPageNum
  })),
  getFixForGame: (gameId) => get().fixes.find((f: AppFix) => f.appid === gameId),
  setCustomFixHighlights: (highlights) => set({ customFixHighlights: highlights }),
  selectGame: (game) => set({ selectedGame: game, gamePanelOpen: true }),
  setFilteredGames: (filteredGames) => set({ filteredGames }),
  setGamesWithCover: (gamesWithCover) => set({ gamesWithCover }),
}))

// Selector hooks
export const useLoading = () => useGameStore((s) => s.loading)
export const useSetLoading = () => useGameStore((s) => s.setLoading)
export const useProgress = () => useGameStore((s) => s.progress)
export const useGames = () => useGameStore((s) => s.games)
export const useSetGames = () => useGameStore((s) => s.setGames)
export const useSearchQuery = () => useGameStore((s) => s.searchQuery)
export const useSortBy = () => useGameStore((s) => s.sortBy)
export const useViewMode = () => useGameStore((s) => s.viewMode)
export const useSelectedGame = () => useGameStore((s) => s.selectedGame)
export const useFixes = () => useGameStore((s) => s.fixes)
export const useInstalledGames = () => useGameStore((s) => s.installedGames)
export const useGetFixForGame = () => useGameStore((s) => s.getFixForGame)
export const useSelectGame = () => useGameStore((s) => s.selectGame)
export const useBrowseSearchQuery = () => useGameStore((s) => s.browseSearchQuery)
