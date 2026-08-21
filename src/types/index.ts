// ── Core Data Types ──

export type Platform = 'windows' | 'mac' | 'linux'

export interface Game {
  appid: string
  name?: string
  added_date?: string
  updated_date?: string
  type?: string
  tags?: string[]
  nsfw?: boolean
  drm?: boolean
  dlc?: Record<string, unknown>
  header_image?: string
  short_description?: string
  isDlc?: boolean
  size?: number
  genres?: string[]
  platforms?: Platform[]
}

export interface FixVersion {
  url: string
  name?: string
  size?: string
  badges?: string[]
}

export interface Fix {
  appid: string
  name: string
  type?: string
  badges: string[]
  fix_count: number
  download_url: string
  download_urls: string[]
  game_url?: string
  source?: string
  versions?: FixVersion[]
}

export interface QueuedGame {
  game: Game
  status: 'pending' | 'installing' | 'downloading' | 'done' | 'error'
  progress: number
  error?: string
}

export interface Achievement {
  id: string
  name: string
  desc: string
  icon: string
  unlocked: boolean
  progress: number
  maxProgress: number
  category: string
  xp: number
  unlockedAt?: number
}

export type ContextMenuState = { x: number; y: number; game: Game } | null

export interface FixHealth {
  appid: string
  status: 'working' | 'outdated' | 'broken'
  lastChecked: number
  reports: number
}

// ── App / Config Types ──

export interface AppConfig {
  theme: 'dark' | 'light'
  includeDLC: boolean
  autoStartSteam: boolean
  backupLua: boolean
  showNSFW: boolean
}

export interface SteamStatus {
  running: boolean
  version: string
  steamPath: string
}

export interface InstallResult {
  success: boolean
  message: string
  appid?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  page: number
  pageSize: number
  total: number
  hasMore: boolean
}

// ── UI Types ──

export interface LogEntry {
  id?: number
  time: string
  message: string
  type: 'info' | 'success' | 'error' | 'warn'
}

export interface Toast {
  id: number
  type: 'success' | 'error' | 'warning' | 'info' | 'loading'
  title: string
  description?: string
}
