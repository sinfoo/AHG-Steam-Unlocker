import type { Game } from '../types'
import { COLORS } from '../constants/colors'
import { getFormatQueryParam } from './formatDetect'

// ── Constants ──
export const FIX_FILTERS = [
  { id: 'All', label: 'All', color: COLORS.textSecondary },
  { id: 'Online', label: 'Online', color: COLORS.green },
  { id: 'Tested', label: 'Tested', color: COLORS.blue },
  { id: 'Bypass', label: 'Bypass', color: COLORS.amber },
  { id: 'sinfo', label: 'sinfo', color: COLORS.red },
  { id: 'Hypervisor', label: 'Hypervisor', color: COLORS.cyan },
  { id: 'Unstable', label: 'Unstable', color: COLORS.red },
  { id: 'Extra Steps', label: 'Extra Steps', color: COLORS.purple },
  { id: 'Specific Version', label: 'Specific Version', color: COLORS.amber },
]

export const GENRE_TAGS = ['Action', 'Adventure', 'RPG', 'Strategy', 'Simulation', 'Sports', 'Racing', 'FPS', 'Puzzle', 'Horror', 'Open World', 'Sandbox', 'Indie', 'Casual', 'Arcade']

// ── Helpers ──
export function getSteamImage(appid: string) {
  // Primary: Steam Akamai CDN (fastest globally)
  // Appends format query param for AVIF/WebP when supported
  return `https://shared.akamai.steamstatic.com/steam/apps/${appid}/header.jpg${getFormatQueryParam()}`
}

export function getGenreTag(game: Game): string | null {
  // 1. Use pre-computed genre data (populated during loading by detectGenre)
  if (game.genres && game.genres.length > 0) return game.genres[0]!
  // 2. Fall back to Steam tags
  if (game.tags && game.tags.length > 0) return game.tags[0]!
  // 3. No genre data available
  return null
}

// Genre → spotlight hue mapping (for game card glow) — private
const GENRE_HUES: Record<string, number> = {
  'Action': 0, 'FPS': 350, 'Horror': 340, 'Racing': 5,
  'Adventure': 30, 'Sandbox': 45,
  'RPG': 270, 'Indie': 260,
  'Strategy': 220, 'Casual': 210,
  'Simulation': 120, 'Arcade': 290,
  'Sports': 190, 'Fighting': 0,
  'Puzzle': 180, 'Open World': 260,
  'Platformer': 240, 'Survival': 15,
}
export function getGenreHue(game: Game): number {
  // 1. Use pre-computed genre data
  const genre = game.genres?.[0] ?? game.tags?.[0]
  if (genre && GENRE_HUES[genre] !== undefined) return GENRE_HUES[genre]
  // 2. Derive a stable color from appid for unique per-game identity
  const appidNum = parseInt(game.appid) || 0
  return (appidNum * 37) % 360
}

export function formatBytes(bytes: number) {
  if (!bytes || bytes === 0) return ''
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

/**
 * Check if a game was added within the last N days.
 * Uses the game's `added_date` field if available.
 * @param game  The game to check
 * @param days  Number of days to consider "new" (default 14)
 */
export function isRecentlyAdded(game: Game, days = 14): boolean {
  if (!game.added_date) return false
  const added = new Date(game.added_date).getTime()
  if (isNaN(added)) return false
  const now = Date.now()
  const ms = days * 24 * 60 * 60 * 1000
  return (now - added) < ms
}
