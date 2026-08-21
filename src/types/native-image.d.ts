// Type declarations for the native C++ addon `ahg-native-image`
// Provides high-performance image decode/encode operations via N-API.
// When the native addon is unavailable, use electron/services/imageProcessor.js instead.

declare module 'ahg-native-image' {
  /** Result of decoding a single image. */
  export interface DecodedImage {
    /** Pixel width of the decoded image. */
    width: number
    /** Pixel height of the decoded image. */
    height: number
    /** Raw RGBA pixel data (4 bytes per pixel). */
    data: Uint8Array
  }

  /** Input descriptor for batch image decoding. */
  export interface BatchInput {
    /** Raw encoded image bytes. */
    data: Buffer
    /** Source image format. */
    type: 'webp' | 'jpeg'
  }

  /** Result entry from a batch decode operation. */
  export interface BatchOutput {
    /** Original index in the input array (preserves ordering). */
    index: number
    /** Decoded RGBA pixel data, or null if this entry failed. */
    data: Uint8Array | null
    /** Pixel width of the decoded image (0 if failed). */
    width: number
    /** Pixel height of the decoded image (0 if failed). */
    height: number
  }

  /**
   * Decode a WebP image from raw bytes into RGBA pixel data.
   * Uses native libwebp via N-API for maximum performance.
   */
  export function decodeWebP(buffer: Buffer): DecodedImage

  /**
   * Decode a JPEG image from raw bytes into RGBA pixel data.
   * Uses native libjpeg-turbo via N-API for maximum performance.
   */
  export function decodeJPEG(buffer: Buffer): DecodedImage

  /**
   * Encode RGBA pixel data into a WebP image buffer.
   * @param rgbaData - Raw RGBA pixel buffer (4 bytes per pixel).
   * @param width - Image width in pixels.
   * @param height - Image height in pixels.
   * @param quality - WebP quality 0–100 (default: 80).
   * @returns A Buffer containing the encoded WebP data.
   */
  export function encodeWebP(
    rgbaData: Buffer,
    width: number,
    height: number,
    quality?: number,
  ): Buffer

  /**
   * Generate a low-quality image placeholder (LQIP) as a data URL.
   * Resizes the image to a small thumbnail and encodes as low-quality WebP.
   * @param rgbaData - Raw RGBA pixel buffer (4 bytes per pixel).
   * @param width - Image width in pixels.
   * @param height - Image height in pixels.
   * @param maxSize - Maximum dimension in pixels for the thumbnail (default: 32).
   * @returns A base64-encoded WebP data URL (`data:image/webp;base64,...`).
   */
  export function generateLQIP(
    rgbaData: Buffer,
    width: number,
    height: number,
    maxSize?: number,
  ): string

  /**
   * Decode multiple images in parallel with configurable concurrency.
   * Uses a thread pool for parallel native decoding.
   * @param images - Array of batch input descriptors.
   * @param concurrency - Maximum parallel decodes (default: 4).
   * @returns Array of batch outputs in the same order as the input.
   */
  export function batchDecode(
    images: BatchInput[],
    concurrency?: number,
  ): BatchOutput[]

  /**
   * Check whether the native addon can use GPU-accelerated decoding.
   * Returns false if GPU support is unavailable (CPU-only fallback).
   */
  export function isGPUSupported(): boolean
}
