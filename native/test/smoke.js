'use strict';

/**
 * smoke.js — Functional smoke test for the native_image addon.
 *
 * Tests:
 *   1. Module loads via index.js auto-detector
 *   2. All 6 exports are functions
 *   3. Encode → Decode WebP roundtrip (4×4 RGBA test pattern)
 *   4. GenerateLQIP returns a data URL
 *   5. BatchDecode processes multiple images
 *   6. IsGPUSupported returns a boolean
 *
 * Usage: node test/smoke.js
 */

const path = require('path');
const nativeImage = require('../index');

let passed = 0;
let failed = 0;

function assert(label, condition, detail) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label} — ${detail || 'condition was falsy'}`);
    failed++;
  }
}

function assertEqual(label, actual, expected) {
  if (actual === expected) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failed++;
  }
}

function assertBuffer(label, buf, expectedLen) {
  const ok = Buffer.isBuffer(buf) && buf.length === expectedLen;
  if (ok) {
    console.log(`  ✅ ${label} (${buf.length} bytes)`);
    passed++;
  } else {
    console.log(`  ❌ ${label} — ${Buffer.isBuffer(buf) ? `expected ${expectedLen} bytes, got ${buf.length}` : 'not a Buffer'}`);
    failed++;
  }
}

async function run() {
  console.log('\n📦 native_image addon — smoke test\n');
  console.log('─── 1. Module Load ───');

  assert('module loaded as object', typeof nativeImage === 'object' && nativeImage !== null);

  const exports = ['decodeWebP', 'decodeJPEG', 'encodeWebP', 'generateLQIP', 'batchDecode', 'isGPUSupported'];
  for (const name of exports) {
    assert(`export "${name}" is function`, typeof nativeImage[name] === 'function', `got ${typeof nativeImage[name]}`);
  }

  console.log('\n─── 2. GPU Support ───');

  try {
    const gpuSupported = nativeImage.isGPUSupported();
    assert('isGPUSupported() returns boolean', typeof gpuSupported === 'boolean', `got ${typeof gpuSupported}`);
  } catch (e) {
    assert('isGPUSupported() does not throw', false, e.message);
  }

  console.log('\n─── 3. Encode → Decode Roundtrip ───');

  // Create a 64×64 RGBA image — fully opaque red. Larger size avoids
  // WebP lossy block artifacts that dominate tiny (<16px) images.
  const W = 64, H = 64;
  const rgba = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    rgba[i * 4]     = 255;
    rgba[i * 4 + 1] = 0;
    rgba[i * 4 + 2] = 0;
    rgba[i * 4 + 3] = 255;
  }

  let encoded;
  try {
    encoded = await nativeImage.encodeWebP(rgba, W, H, 90);
    assert('encodeWebP() returns non-empty Buffer',
      Buffer.isBuffer(encoded) && encoded.length > 0,
      `got ${typeof encoded}${Buffer.isBuffer(encoded) ? ` length=${encoded.length}` : ''}`
    );
  } catch (e) {
    assert('encodeWebP() does not throw', false, e.message);
    encoded = null;
  }

  let decoded;
  if (encoded) {
    try {
      decoded = await nativeImage.decodeWebP(encoded);
      assert('decodeWebP() returns object with data/width/height',
        decoded && typeof decoded === 'object' && decoded.data && decoded.width && decoded.height,
        `got ${JSON.stringify({data: typeof decoded?.data, w: decoded?.width, h: decoded?.height})}`
      );
    } catch (e) {
      assert('decodeWebP() does not throw', false, e.message);
      decoded = null;
    }

    if (decoded) {
      assertEqual('decodeWebP() width matches', decoded.width, W);
      assertEqual('decodeWebP() height matches', decoded.height, H);
      assertBuffer('decodeWebP() data has correct size', decoded.data, W * H * 4);

      if (decoded.data.length >= 4) {
        const r = decoded.data[0], g = decoded.data[1], b = decoded.data[2], a = decoded.data[3];
        const alphaOk = a >= 240;
        const redDominant = r > g + 40 && r > b + 40;
        assert('pixel: top-left is approximately red (lossy OK)',
          alphaOk && redDominant,
          `rgba(${r},${g},${b},${a}) — alphaOk=${alphaOk}, redDominant=${redDominant}`
        );
      }
    }
  }

  console.log('\n─── 4. JPEG Decode (error path) ───');

  try {
    // Try decoding a tiny bogus JPEG — should reject, not crash
    await nativeImage.decodeJPEG(Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]));
    assert('decodeJPEG with minimal header rejects', false, 'should have rejected');
  } catch (e) {
    assert('decodeJPEG with minimal header rejects gracefully',
      e && typeof e.message === 'string',
      `got ${e?.message}`
    );
  }

  console.log('\n─── 5. GenerateLQIP ───');

  try {
    // Resize the test pattern to a data URL
    const lqip = await nativeImage.generateLQIP(rgba, W, H, 20);
    assert('generateLQIP() returns string starting with data:image',
      typeof lqip === 'string' && lqip.startsWith('data:image/webp;base64,'),
      `got typeof ${typeof lqip}${typeof lqip === 'string' ? ` first 40: ${lqip.substring(0, 40)}` : ''}`
    );
  } catch (e) {
    assert('generateLQIP() does not throw', false, e.message);
  }

  console.log('\n─── 6. BatchDecode ───');

  if (encoded) {
    try {
      const batchInputs = [
        { data: encoded, type: 'webp' },
        { data: encoded, type: 'webp' },
      ];
      const batchOut = await nativeImage.batchDecode(batchInputs, 2);

      assert('batchDecode() returns array', Array.isArray(batchOut), `got ${typeof batchOut}`);
      if (Array.isArray(batchOut)) {
        assertEqual('batchDecode() returns correct count', batchOut.length, 2);
        for (let i = 0; i < batchOut.length; i++) {
          assert(`batchDecode()[${i}] has data, width, height, index`,
            batchOut[i] && batchOut[i].data && batchOut[i].data.length > 0 &&
            batchOut[i].width === W && batchOut[i].height === H &&
            batchOut[i].index === i,
            `got ${JSON.stringify({w: batchOut[i]?.width, h: batchOut[i]?.height, idx: batchOut[i]?.index, dataLen: batchOut[i]?.data?.length})}`
          );
        }
      }
    } catch (e) {
      assert('batchDecode() does not throw', false, e.message);
    }
  }

  console.log('\n─── Summary ───');
  const total = passed + failed;
  console.log(`  ${passed}/${total} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
