/**
 * Placeholder gradient generator for game card placeholders.
 * Deterministic — same input always produces the same CSS gradient string.
 * No side effects, no random, pure functions only.
 */

// ── Genre → hue mapping (Steam genre/app-category IDs) ──
const GENRE_HUES: Record<string, number> = {
  'Action': 0,
  'FPS': 350,
  'Horror': 340,
  'Racing': 10,
  'Adventure': 120,
  'Sandbox': 45,
  'RPG': 280,
  'Indie': 260,
  'Strategy': 200,
  'Casual': 30,
  'Simulation': 40,
  'Arcade': 290,
  'Sports': 350,
  'Fighting': 0,
  'Puzzle': 180,
  'Open World': 260,
  'Platformer': 240,
  'Survival': 15,
}

/**
 * Deterministic string → hue hash using FNV-1a algorithm.
 * Produces a stable 0-360 hue value from any string.
 */
export function stringToHue(str: string): number {
  let hash = 2166136261
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash) % 360
}

/**
 * Map a genre name string to a deterministic hue value (0-360).
 * Known genres use the curated GENRE_HUES map; unknown genres
 * fall back to an FNV-1a hash of the genre name.
 */
export function getGenreHue(genreName: string): number {
  if (GENRE_HUES[genreName] !== undefined) return GENRE_HUES[genreName]
  return stringToHue(genreName)
}

/**
 * Generate a deterministic CSS gradient string from a hue value.
 *
 * @param genreHue  Hue angle 0-360 (from getGenreHue or stringToHue)
 * @param variant   'card' — diagonal 3-stop gradient for placeholder/loading backgrounds
 *                  'banner' — horizontal dark-to-medium gradient for wide headers
 *                  'icon' — radial accent gradient for small overlays / glows
 */
export function generatePlaceholderGradient(
  genreHue: number,
  variant: 'card' | 'banner' | 'icon',
): string {
  // Normalise to valid 0-360 range
  const base = ((genreHue % 360) + 360) % 360
  const mid = (base + 40) % 360
  const light = (base + 30) % 360

  switch (variant) {
    case 'card':
      return (
        `linear-gradient(135deg, ` +
        `hsl(${light}, 50%, 14%) 0%, ` +
        `hsl(${mid}, 40%, 18%) 50%, ` +
        `hsl(${base}, 30%, 8%) 100%)`
      )

    case 'banner':
      return (
        `linear-gradient(90deg, ` +
        `hsl(${base}, 40%, 10%) 0%, ` +
        `hsl(${mid}, 35%, 16%) 50%, ` +
        `hsl(${base}, 30%, 6%) 100%)`
      )

    case 'icon':
      return (
        `radial-gradient(circle at 30% 40%, ` +
        `hsla(${light}, 60%, 55%, 0.12) 0%, ` +
        `transparent 50%)`
      )
  }
}

/**
 * Convenience wrapper: get a placeholder gradient from a genre name string.
 * Combines getGenreHue + generatePlaceholderGradient.
 */
export function getPlaceholderGradient(
  genreName: string,
  variant: 'card' | 'banner' | 'icon',
): string {
  return generatePlaceholderGradient(getGenreHue(genreName), variant)
}
