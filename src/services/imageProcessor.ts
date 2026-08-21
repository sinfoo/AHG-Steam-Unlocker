/**
 * Browser-native WebP conversion and LQIP (Low Quality Image Placeholder) generation.
 *
 * Full-size WebP uses OffscreenCanvas.convertToBlob('image/webp') — GPU-accelerated in Chromium 130+.
 * LQIP tries native C++ addon via IPC (5-7x faster), falls back to OffscreenCanvas.
 */

import { bridge } from '../bridge'

export interface ConversionResult {
  webpBlob: Blob
  lqipDataUrl: string
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary)
}

/**
 * Generate LQIP via native C++ addon (5-7x faster than OffscreenCanvas).
 * Tries IPC first, returns null if addon not loaded or IPC unavailable.
 */
async function nativeLQIP(
  blob: Blob,
  lqipWidth: number
): Promise<string | null> {
  try {
    // Pass a Uint8Array view, not the raw ArrayBuffer: typed arrays survive the
    // contextBridge clone intact, whereas a bare ArrayBuffer could arrive in the
    // main process as a plain object and break Buffer.from().
    const buffer = new Uint8Array(await blob.arrayBuffer())
    const result = await bridge.nativeGenerateLQIP(buffer, lqipWidth)
    if (result && result.lqip) {
      return result.lqip
    }
  } catch {
    // IPC not available (browser dev, testing, etc.)
  }
  return null
}

/**
 * Convert an image Blob (any format) to WebP using the browser's native encoder.
 * Also generates a tiny LQIP WebP as a base64 data URL for blur-placeholder rendering.
 *
 * LQIP uses native C++ addon via IPC when available (5-7x faster),
 * falls back to OffscreenCanvas.
 */
export async function convertToWebP(
  blob: Blob,
  quality = 0.82,
  lqipWidth = 20
): Promise<ConversionResult> {
  let bitmap: ImageBitmap | null = null
  try {
    bitmap = await createImageBitmap(blob)

    // Full-size WebP via GPU
    const fullCanvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const fullCtx = fullCanvas.getContext('2d')!
    fullCtx.drawImage(bitmap, 0, 0)
    const webpBlob = await fullCanvas.convertToBlob({ type: 'image/webp', quality })

    // LQIP — try native C++ addon first (5-7x faster), fall back to OffscreenCanvas
    let lqipDataUrl = await nativeLQIP(blob, lqipWidth)
    if (!lqipDataUrl) {
      const lqipHeight = Math.max(1, Math.round((bitmap.height / bitmap.width) * lqipWidth))
      const lqipCanvas = new OffscreenCanvas(lqipWidth, lqipHeight)
      const lqipCtx = lqipCanvas.getContext('2d')!
      lqipCtx.drawImage(bitmap, 0, 0, lqipWidth, lqipHeight)
      const lqipBlob = await lqipCanvas.convertToBlob({ type: 'image/webp', quality: 0.2 })
      const lqipBuffer = await lqipBlob.arrayBuffer()
      lqipDataUrl = `data:image/webp;base64,${arrayBufferToBase64(lqipBuffer)}`
    }

    return { webpBlob, lqipDataUrl }
  } finally {
    if (bitmap) bitmap.close()
  }
}

/**
 * Same as convertToWebP but returns only the WebP blob (skips LQIP generation for speed).
 */
export async function convertToWebPOnly(blob: Blob, quality = 0.82): Promise<Blob> {
  let bitmap: ImageBitmap | null = null
  try {
    bitmap = await createImageBitmap(blob)
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(bitmap, 0, 0)
    const webpBlob = await canvas.convertToBlob({ type: 'image/webp', quality })
    return webpBlob
  } finally {
    if (bitmap) bitmap.close()
  }
}
