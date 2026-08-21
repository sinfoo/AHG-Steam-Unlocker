/**
 * AHG Unlocker — Shared Color Tokens
 *
 * Single source of truth for all color values across the app.
 * Every component imports from here instead of defining its own COLORS.
 *
 * Canonical names follow App.tsx DARK_COLORS conventions.
 * Semantic aliases (success, warning, error, info) map to canonical values.
 */

export const DARK_COLORS = {
  // Background scale
  bgDeep: '#0d0d1a',
  bgDark: '#12122a',
  bgMid: '#18183a',
  bgCard: '#1e1e40',
  bgCardGlass: 'rgba(26, 26, 48, 0.7)',
  bgHover: '#222240',
  bgActive: '#2e2e50',

  // Primary accent
  violet: '#a77dff',
  violetLight: '#b794ff',
  // Glow/dim derive from canonical violet #a77dff (rgb 167,125,255) to avoid hue drift.
  violetGlow: 'rgba(167, 125, 255, 0.5)',
  violetDim: 'rgba(167, 125, 255, 0.15)',

  // Semantic colors
  red: '#ef4444',
  redDim: 'rgba(239, 68, 68, 0.15)',
  blue: '#3b82f6',
  blueDim: 'rgba(59, 130, 246, 0.15)',
  green: '#22c55e',
  greenDim: 'rgba(34, 197, 94, 0.15)',
  amber: '#f59e0b',
  amberDim: 'rgba(245, 158, 11, 0.15)',
  orange: '#ea580c',
  pink: '#ec4899',
  cyan: '#06b6d4',
  purple: '#a855f7',

  // Text
  text: '#ffffff',
  textSecondary: '#e2e8f0',
  textMuted: '#b0bed0',
  textDim: '#8892a6',

  // Borders
  border: '#3a3a66',
  borderLight: '#505090',

  // Misc
  white: '#ffffff',
  whiteGlass: 'rgba(255, 255, 255, 0.08)',
  whiteGlassBorder: 'rgba(255, 255, 255, 0.12)',

  // Semantic aliases (same values as canonical names above)
  success: '#22c55e',
  successDim: 'rgba(34, 197, 94, 0.15)',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
} as const

export const COLORS = DARK_COLORS
