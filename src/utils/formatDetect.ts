/**
 * Browser image format detection — detects AVIF / WebP / JPEG support.
 *
 * Detection is lazy: it runs only on the first call and caches the result
 * for the rest of the session. No DOM manipulation beyond a single canvas
 * element created in memory.
 *
 * Steam CDN (Akamai) respects ?fmt=avif and ?fmt=webp query parameters
 * on image URLs, returning next-gen formats when the client supports them.
 */

export type ImageFormat = 'avif' | 'webp' | 'jpeg'

let cachedFormat: ImageFormat | null = null

/**
 * Detect the best image format the current browser supports.
 * Order: AVIF > WebP > JPEG (fallback).
 * Result is cached for the session — subsequent calls are O(1).
 */
export function detectBestFormat(): ImageFormat {
  if (cachedFormat) return cachedFormat

  // Test AVIF support via canvas toDataURL
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    const dataUrl = canvas.toDataURL('image/avif')
    if (dataUrl.startsWith('data:image/avif')) {
      cachedFormat = 'avif'
      return 'avif'
    }
  } catch {
    // AVIF not supported — fall through
  }

  // Test WebP support via canvas toDataURL
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    const dataUrl = canvas.toDataURL('image/webp')
    if (dataUrl.startsWith('data:image/webp')) {
      cachedFormat = 'webp'
      return 'webp'
    }
  } catch {
    // WebP not supported — fall through
  }

  cachedFormat = 'jpeg'
  return 'jpeg'
}

/**
 * Return the Steam CDN format query parameter for the detected format.
 * Returns empty string for JPEG (the default, no param needed).
 */
export function getFormatQueryParam(): string {
  const fmt = detectBestFormat()
  if (fmt === 'avif') return '?fmt=avif'
  if (fmt === 'webp') return '?fmt=webp'
  return ''
}
