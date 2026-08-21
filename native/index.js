/**
 * index.js — Auto-detect and load native_image addon with sharp fallback.
 *
 * Usage:
 *   const nativeImage = require('./native');
 *   const result = nativeImage.decodeWebP(buffer);
 *
 * The native addon (build/Release/native_image.node) is loaded if available.
 * Otherwise falls back to the sharp-based implementation in fallback.js.
 */
'use strict';

const path = require('path');

let nativeAddon = null;
let fallback = null;

// Try loading the compiled native addon
const nativePaths = [
  path.join(__dirname, 'build', 'Release', 'native_image'),
  path.join(__dirname, 'build', 'Debug', 'native_image'),
];

for (const p of nativePaths) {
  try {
    nativeAddon = require(p);
    break;
  } catch {
    // Try next path
  }
}

if (nativeAddon) {
  // Native addon loaded — wrap sync calls in promises for interface consistency
  const wrap = (fn) => (...args) => {
    try {
      const result = fn(...args);
      return Promise.resolve(result);
    } catch (err) {
      return Promise.reject(err);
    }
  };

  module.exports = {
    decodeWebP:     wrap(nativeAddon.decodeWebP),
    decodeJPEG:     wrap(nativeAddon.decodeJPEG),
    encodeWebP:     wrap(nativeAddon.encodeWebP),
    generateLQIP:   wrap(nativeAddon.generateLQIP),
    batchDecode:    (images, concurrency) => Promise.resolve(nativeAddon.batchDecode(images, concurrency)),
    isGPUSupported: () => nativeAddon.isGPUSupported(),
  };
} else {
  // Fallback to sharp
  fallback = require('./fallback');
  module.exports = {
    decodeWebP:     fallback.decodeWebP,
    decodeJPEG:     fallback.decodeJPEG,
    encodeWebP:     fallback.encodeWebP,
    generateLQIP:   fallback.generateLQIP,
    batchDecode:    fallback.batchDecode,
    isGPUSupported: fallback.isGPUSupported,
  };
}
