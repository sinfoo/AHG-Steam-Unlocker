/**
 * fallback.js — Sharp-based fallback for native_image addon.
 *
 * Used when the compiled native addon is unavailable or fails to load.
 * Provides the same API surface using the `sharp` npm package in-process.
 */
'use strict';

const sharp = require('sharp');

// ── Data URL helpers ────────────────────────────────────────────────────

function arrayBufferToBase64(buf) {
  return buf.toString('base64');
}

// ── Exports (mirrors native module API) ────────────────────────────────

/**
 * Decode WebP image to RGBA pixels.
 * @param {Buffer} buffer - Raw encoded bytes
 * @returns {{ data: Buffer, width: number, height: number }}
 */
async function decodeWebP(buffer) {
  const img = sharp(buffer);
  const meta = await img.metadata();
  const data = await img.ensureAlpha().raw().toBuffer();
  return { data, width: meta.width, height: meta.height };
}

/**
 * Decode JPEG image to RGBA pixels.
 * @param {Buffer} buffer
 * @returns {Promise<{data: Buffer, width: number, height: number}>}
 */
async function decodeJPEG(buffer) {
  const img = sharp(buffer);
  const meta = await img.metadata();
  const data = await img.ensureAlpha().raw().toBuffer();
  return { data, width: meta.width, height: meta.height };
}

/**
 * Encode RGBA pixels to a WebP file.
 * @param {Buffer} data   - RGBA pixel data
 * @param {number} width
 * @param {number} height
 * @param {number} [quality=82]
 * @returns {Promise<Buffer>} WebP-encoded file buffer
 */
async function encodeWebP(data, width, height, quality = 82) {
  return sharp(data, { raw: { width, height, channels: 4 } })
    .webp({ quality })
    .toBuffer();
}

/**
 * Generate a WebP LQIP data URL from RGBA pixels.
 * @param {Buffer} data   - RGBA pixel data
 * @param {number} width
 * @param {number} height
 * @param {number} [maxSize=20]
 * @returns {Promise<string>} data:image/webp;base64,...
 */
async function generateLQIP(data, width, height, maxSize = 20) {
  const webpBuf = await sharp(data, { raw: { width, height, channels: 4 } })
    .resize(maxSize, maxSize, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 20 })
    .toBuffer();
  return `data:image/webp;base64,${arrayBufferToBase64(webpBuf)}`;
}

/**
 * Batch decode multiple images using a concurrency-limited queue.
 * @param {Array<{data: Buffer, type?: string}>} images
 * @param {number} [concurrency=4]
 * @returns {Promise<Array<{data: Buffer|null, width: number, height: number, index: number}>>}
 */
async function batchDecode(images, concurrency = 4) {
  const results = new Array(images.length);

  // Simple concurrency limiter
  async function worker(queue) {
    while (queue.length > 0) {
      const idx = queue.shift();
      const { data } = images[idx];
      try {
        const img = sharp(data);
        const meta = await img.metadata();
        const rgba = await img.ensureAlpha().raw().toBuffer();
        results[idx] = { data: rgba, width: meta.width, height: meta.height, index: idx };
      } catch {
        results[idx] = { data: null, width: 0, height: 0, index: idx };
      }
    }
  }

  const indices = images.map((_, i) => i);
  const workers = [];
  const actualConcurrency = Math.min(concurrency, images.length, 16);
  for (let i = 0; i < actualConcurrency; i++) {
    workers.push(worker(indices));
  }
  await Promise.all(workers);

  return results;
}

/**
 * Check GPU support — sharp does not expose D3D11, so returns false.
 * @returns {boolean}
 */
function isGPUSupported() {
  return false;
}

module.exports = {
  decodeWebP,
  decodeJPEG,
  encodeWebP,
  generateLQIP,
  batchDecode,
  isGPUSupported,
};
