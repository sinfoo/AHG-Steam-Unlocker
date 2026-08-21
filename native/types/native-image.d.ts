/* ──────────────────────────────────────────────────────────────────────────
 *   native-image.d.ts — TypeScript type declarations for native_image addon
 *
 *   Import:
 *     import nativeImage from '../native';
 *     // or: const nativeImage = require('../native/build/Release/native_image');
 * ──────────────────────────────────────────────────────────────────────── */

export interface DecodeResult {
  /** RGBA pixel data (width × height × 4 bytes) */
  data: Buffer;
  width: number;
  height: number;
}

export interface BatchInput {
  /** Raw encoded image bytes (WebP or JPEG) */
  data: Buffer;
  /** Image type hint: 'webp' | 'jpeg' | 'jpg'. Falls back to auto-detect. */
  type?: 'webp' | 'jpeg';
}

export interface BatchOutput {
  data: Buffer | null;
  width: number;
  height: number;
  /** Original index in the input array for result reassembly */
  index: number;
}

export interface NativeImageModule {
  /**
   * Decode a WebP image to RGBA pixels.
   * @param buffer - Raw WebP file contents
   * @returns Decoded RGBA buffer + dimensions
   * @throws If decoding fails
   */
  decodeWebP(buffer: Buffer): DecodeResult;

  /**
   * Decode a JPEG image to RGBA pixels.
   * @param buffer - Raw JPEG file contents
   * @returns Decoded RGBA buffer + dimensions
   * @throws If decoding fails
   */
  decodeJPEG(buffer: Buffer): DecodeResult;

  /**
   * Encode RGBA pixel data to WebP format.
   * @param data   - RGBA pixel buffer (width × height × 4)
   * @param width  - Image width in pixels
   * @param height - Image height in pixels
   * @param quality - WebP quality 0–100 (default: 82)
   * @returns Encoded WebP file buffer
   * @throws If encoding fails or buffer size is wrong
   */
  encodeWebP(data: Buffer, width: number, height: number, quality?: number): Buffer;

  /**
   * Generate a low-quality WebP thumbnail as a base64 data URL.
   * Useful for blur-up image placeholders (LQIP).
   * @param data   - RGBA pixel buffer (width × height × 4)
   * @param width  - Original image width
   * @param height - Original image height
   * @param maxSize - Max dimension in pixels for the thumbnail (default: 20)
   * @returns Data URL string for inline use: 'data:image/webp;base64,...'
   * @throws If generation fails
   */
  generateLQIP(data: Buffer, width: number, height: number, maxSize?: number): string;

  /**
   * Batch-decode multiple WebP/JPEG images in parallel using a thread pool.
   * Results are returned in the original input order.
   * @param images - Array of { data, type? } objects
   * @param concurrency - Max parallel threads (default: CPU core count)
   * @returns Array of decoded results in original order
   */
  batchDecode(images: BatchInput[], concurrency?: number): BatchOutput[];

  /**
   * Check if D3D11 GPU acceleration is available on this system.
   * @returns true if GPU decoding tier is supported
   */
  isGPUSupported(): boolean;
}

/** Default module instance */
declare const _default: NativeImageModule;
export default _default;
