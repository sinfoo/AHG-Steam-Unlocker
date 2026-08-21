// Sharp-based fallback image processor for AHG Unlocker.
// Provides the same operations as the native C++ addon (ahg-native-image)
// without requiring native compilation.  Uses sharp v0.35.x (libvips >=8.18.3).
//
// Usage:
//   const img = require('./imageProcessor');
//   const { data, width, height } = await img.decodeWebP('path/to/image.webp');
//
// @ts-check

'use strict';

/** @type {import('sharp') | null} */
let sharp = null;

try {
  sharp = require('sharp');
} catch (_) {
  // sharp is not available — engine will be reported as null in getFallbackInfo()
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Load an image from disk and return the raw RGBA pixel buffer plus dimensions.
 *
 * @param {string} inputPath - Absolute or relative path to an image file.
 * @param {{ expandAlpha?: boolean } | undefined} opts
 * @returns {Promise<{ data: Buffer, width: number, height: number }>}
 */
async function _loadRGBA(inputPath, opts = {}) {
  if (!sharp) {
    throw new Error('sharp is not available — cannot process images');
  }

  let pipeline = sharp(inputPath);

  // Ensure the output has an alpha channel so callers always get RGBA.
  const metadata = await pipeline.metadata();
  const hasAlpha = metadata.channels != null && (metadata.channels === 2 || metadata.channels === 4);

  if (!hasAlpha || opts.expandAlpha) {
    pipeline = pipeline.ensureAlpha();
  }

  const { data, info } = await pipeline
    .raw()
    .toBuffer({ resolveWithObject: true });

  return {
    data,
    width: info.width,
    height: info.height,
  };
}

// ---------------------------------------------------------------------------
// Exported API — mirrors the native addon surface
// ---------------------------------------------------------------------------

/**
 * Decode a WebP image file and return raw RGBA pixel data.
 *
 * @param {string} inputPath - Path to the .webp file.
 * @returns {Promise<{ data: Buffer, width: number, height: number }>}
 */
async function decodeWebP(inputPath) {
  return _loadRGBA(inputPath);
}

/**
 * Decode a JPEG image file and return raw RGBA pixel data.
 *
 * @param {string} inputPath - Path to the .jpg / .jpeg file.
 * @returns {Promise<{ data: Buffer, width: number, height: number }>}
 */
async function decodeJPEG(inputPath) {
  return _loadRGBA(inputPath);
}

/**
 * Encode an image file to WebP and write the result to disk.
 *
 * @param {string} inputPath  - Path to the source image file.
 * @param {string} outputPath - Path where the .webp file will be written.
 * @param {number} [quality]  - WebP quality 1–100 (default: libvips default ≈ 80).
 * @returns {Promise<{ success: boolean, sizeBytes: number }>}
 */
async function encodeToWebP(inputPath, outputPath, quality) {
  if (!sharp) {
    throw new Error('sharp is not available — cannot encode images');
  }

  /** @type {import('sharp').WebpOptions} */
  const webpOpts = {};
  if (quality != null) {
    webpOpts.quality = quality;
  }

  await sharp(inputPath)
    .webp(webpOpts)
    .toFile(outputPath);

  const fs = require('fs');
  const stat = fs.statSync(outputPath);

  return { success: true, sizeBytes: stat.size };
}

/**
 * Generate a low-quality image placeholder (LQIP) as a base64 data URL.
 *
 * The image is resized to 20px on the longest edge, encoded as WebP at quality 20,
 * and returned as a `data:image/webp;base64,…` string suitable for inline use in
 * an `<img src="…">` or CSS background-image.
 *
 * @param {string} inputPath - Path to the source image file.
 * @param {{ maxSize?: number, quality?: number }} [opts]
 * @param {number}  [opts.maxSize=20]  - Longest edge in pixels for the thumbnail.
 * @param {number}  [opts.quality=20]  - WebP quality for the placeholder.
 * @returns {Promise<{ lqipDataUrl: string }>}
 */
async function generateLQIP(inputPath, opts = {}) {
  if (!sharp) {
    throw new Error('sharp is not available — cannot generate LQIP');
  }

  const maxSize = opts.maxSize ?? 20;
  const quality = opts.quality ?? 20;

  const { data, info } = await sharp(inputPath)
    .resize({
      width: maxSize,
      height: maxSize,
      fit: 'inside',       // preserve aspect ratio, fit within maxSize
      withoutEnlargement: true,
    })
    .webp({ quality })
    .toBuffer({ resolveWithObject: true });

  const base64 = data.toString('base64');

  return {
    lqipDataUrl: `data:image/webp;base64,${base64}`,
  };
}

/**
 * Decode multiple image files in parallel (concurrency ~4).
 *
 * Results are returned in the same order as the input array.  Individual
 * failures yield `{ data: null }` for that entry rather than rejecting the
 * entire batch.
 *
 * @param {string[]} filePaths - Array of image file paths.
 * @param {'webp' | 'jpeg'} [_format] - Expected format hint (currently unused).
 * @returns {Promise<Array<{ filePath: string, width: number, height: number, data: Buffer | null }>>}
 */
async function batchDecode(filePaths, _format) {
  if (!sharp) {
    throw new Error('sharp is not available — cannot batch decode');
  }

  const CONCURRENCY = 4;
  const results = new Array(filePaths.length);

  let nextIndex = 0;

  /**
   * Worker that pulls the next file from the queue until all are processed.
   */
  async function worker() {
    while (nextIndex < filePaths.length) {
      const idx = nextIndex++;
      const filePath = filePaths[idx];

      try {
        const { data, width, height } = await _loadRGBA(filePath);
        results[idx] = { filePath, width, height, data };
      } catch (_err) {
        results[idx] = { filePath, width: 0, height: 0, data: null };
      }
    }
  }

  // Spin up CONCURRENCY workers and wait for all to finish.
  const workers = [];
  for (let i = 0; i < CONCURRENCY; i++) {
    workers.push(worker());
  }
  await Promise.all(workers);

  return results;
}

/**
 * Check whether a given image format is supported by this processor.
 *
 * @param {'webp' | 'jpeg' | 'png' | 'tiff' | 'avif'} format - Image format identifier.
 * @returns {boolean}
 */
function isImageFormatSupported(format) {
  if (!sharp) return false;

  // sharp/libvips supports a broad set of formats.
  const supported = new Set([
    'jpeg', 'jpg', 'png', 'webp', 'tiff', 'tif',
    'avif', 'heif', 'gif', 'svg',
  ]);

  return supported.has(format.toLowerCase());
}

/**
 * Return metadata about the current image-processing engine.
 *
 * @returns {{ engine: string | null, version: string, features: string[] }}
 */
function getFallbackInfo() {
  if (!sharp) {
    return { engine: null, version: '', features: [] };
  }

  const path = require('path');
  const fs = require('fs');
  const pkgPath = path.resolve(require.resolve('sharp'), '..', '..', 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const versions = sharp.versions || {};

  return {
    engine: 'sharp',
    version: pkg.version,
    features: [
      `libvips ${versions.vips || 'unknown'}`,
      'raw RGB/RGBA decode',
      'WebP encode',
      'LQIP generation',
      'concurrent batch decode',
    ],
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  decodeWebP,
  decodeJPEG,
  encodeToWebP,
  generateLQIP,
  batchDecode,
  isImageFormatSupported,
  getFallbackInfo,
};
