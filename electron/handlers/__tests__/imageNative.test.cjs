/**
 * imageNative.test.cjs — Comprehensive test suite for electron/handlers/imageNative.cjs
 *
 * Uses Node.js built-in test framework (node:test + node:assert).
 * Mocks the electron module (ipcMain) and the native C++ addon (../../native)
 * via Module._resolveFilename interception to run outside the Electron process.
 *
 * Run with: node --test electron/handlers/__tests__/imageNative.test.cjs
 */

'use strict';

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');
const path = require('path');

const MODULE_PATH = path.resolve(__dirname, '../imageNative.cjs');
const ELEC_MOCK_ID = path.resolve(__dirname, '.image-native-elec-mock.cjs');
const NATIVE_MOCK_ID = path.resolve(__dirname, '.image-native-addon-mock.cjs');

let restoreMocks;
let ipcMainHandleSpy;

// ── Mock Helpers ─────────────────────────────────────────────────────────

function createSpy() {
  function spy(...args) { spy.calls.push(args); }
  spy.calls = [];
  return spy;
}

function makeMagicBuffer(pattern) {
  const b = Buffer.alloc(20);
  if (pattern === 'webp') { b[0] = 0x52; b[1] = 0x49; b[2] = 0x46; b[3] = 0x46; b[8] = 0x57; b[9] = 0x45; b[10] = 0x42; b[11] = 0x50; }
  else if (pattern === 'jpeg') { b[0] = 0xFF; b[1] = 0xD8; b[2] = 0xFF; }
  else if (pattern === 'png') { b[0] = 0x89; b[1] = 0x50; b[2] = 0x4E; b[3] = 0x47; }
  return b;
}

// ── Native addon mock factories ──────────────────────────────────────────

const MOCK_ADDON_BUFFER_RESULT = {
  decodeWebP() { return { data: Buffer.alloc(100), width: 10, height: 10 }; },
  decodeJPEG() { return { data: Buffer.alloc(100), width: 12, height: 8 }; },
  generateLQIP() { return Buffer.from('mock-lqip-bytes'); },
  isGPUSupported() { return false; },
};

const MOCK_ADDON_STRING_RESULT = {
  ...MOCK_ADDON_BUFFER_RESULT,
  generateLQIP() { return 'data:image/webp;base64,cHJlLWVuY29kZWQtbHFpcA=='; },
};

const MOCK_ADDON_GPU_SUPPORTED = {
  ...MOCK_ADDON_BUFFER_RESULT,
  isGPUSupported() { return true; },
};

// ── Setup / Teardown ─────────────────────────────────────────────────────

/**
 * @param {object|null} addonMock  — native addon exports, or null to simulate addon-not-loaded
 */
function setupMocks(addonMock) {
  ipcMainHandleSpy = createSpy();

  require.cache[ELEC_MOCK_ID] = {
    id: ELEC_MOCK_ID, filename: ELEC_MOCK_ID, loaded: true,
    exports: { ipcMain: { handle: ipcMainHandleSpy } },
    paths: [], children: [],
  };

  if (addonMock) {
    require.cache[NATIVE_MOCK_ID] = {
      id: NATIVE_MOCK_ID, filename: NATIVE_MOCK_ID, loaded: true,
      exports: addonMock,
      paths: [], children: [],
    };
  }

  const origResolve = Module._resolveFilename;
  Module._resolveFilename = function (request, parent, isMain) {
    if (request === 'electron') return ELEC_MOCK_ID;
    if (request === '../../native') return NATIVE_MOCK_ID;
    return origResolve.call(this, request, parent, isMain);
  };

  return function restore() {
    delete require.cache[ELEC_MOCK_ID];
    delete require.cache[NATIVE_MOCK_ID];
    delete require.cache[MODULE_PATH];
    Module._resolveFilename = origResolve;
    restoreMocks = undefined;
  };
}

function findHandler(channel) {
  const call = ipcMainHandleSpy.calls.find(c => c[0] === channel);
  return call ? call[1] : null;
}

// ═════════════════════════════════════════════════════════════════════════
// SUITE 1: Native addon loaded (buffer LQIP result)
// ═════════════════════════════════════════════════════════════════════════

describe('imageNative.cjs — native addon LOADED (Buffer LQIP result)', () => {
  before(() => {
    restoreMocks = setupMocks(MOCK_ADDON_BUFFER_RESULT);
    delete require.cache[MODULE_PATH];
    const mod = require(MODULE_PATH);
    mod.registerImageNativeHandlers();
  });

  after(() => {
    if (restoreMocks) restoreMocks();
  });

  // ── Registration ────────────────────────────────────────────────────

  describe('registerImageNativeHandlers', () => {
    test('registers exactly 3 IPC handlers', () => {
      assert.equal(ipcMainHandleSpy.calls.length, 3);
    });

    test('registers native-image:health handler', () => {
      assert.equal(ipcMainHandleSpy.calls[0][0], 'native-image:health');
      assert.equal(typeof ipcMainHandleSpy.calls[0][1], 'function');
    });

    test('registers native-image:generateLQIP handler', () => {
      assert.equal(ipcMainHandleSpy.calls[1][0], 'native-image:generateLQIP');
      assert.equal(typeof ipcMainHandleSpy.calls[1][1], 'function');
    });

    test('registers native-image:decode handler', () => {
      assert.equal(ipcMainHandleSpy.calls[2][0], 'native-image:decode');
      assert.equal(typeof ipcMainHandleSpy.calls[2][1], 'function');
    });
  });

  // ── Health ──────────────────────────────────────────────────────────

  describe('native-image:health', () => {
    test('returns loaded=true, gpu=false, and version string', async () => {
      const h = findHandler('native-image:health');
      const result = await h();
      assert.equal(result.loaded, true);
      assert.equal(result.gpu, false);
      assert.equal(typeof result.version, 'string');
      assert.ok(result.version.length > 0);
    });
  });

  // ── Generate LQIP ───────────────────────────────────────────────────

  describe('native-image:generateLQIP', () => {
    test('generates LQIP from valid WebP buffer', async () => {
      const h = findHandler('native-image:generateLQIP');
      const buf = makeMagicBuffer('webp');
      const result = await h(null, { buffer: buf.buffer });
      assert.equal(result.error, null);
      assert.ok(result.lqip.startsWith('data:image/webp;base64,'));
    });

    test('generates LQIP with custom lqipWidth', async () => {
      const h = findHandler('native-image:generateLQIP');
      const buf = makeMagicBuffer('webp');
      const result = await h(null, { buffer: buf.buffer, lqipWidth: 40 });
      assert.equal(result.error, null);
      assert.ok(result.lqip.startsWith('data:image/webp;base64,'));
    });

    test('generates LQIP from valid JPEG buffer', async () => {
      const h = findHandler('native-image:generateLQIP');
      const buf = makeMagicBuffer('jpeg');
      const result = await h(null, { buffer: buf.buffer });
      assert.equal(result.error, null);
      assert.ok(result.lqip.startsWith('data:image/webp;base64,'));
    });

    test('returns unsupported_format for PNG buffer', async () => {
      const h = findHandler('native-image:generateLQIP');
      const buf = makeMagicBuffer('png');
      const result = await h(null, { buffer: buf.buffer });
      assert.equal(result.error, 'unsupported_format');
      assert.equal(result.lqip, null);
    });

    test('returns unsupported_format for unknown format (plain text)', async () => {
      const h = findHandler('native-image:generateLQIP');
      const result = await h(null, { buffer: Buffer.from('hello world').buffer });
      assert.equal(result.error, 'unsupported_format');
      assert.equal(result.lqip, null);
    });

    test('returns bad_buffer for empty buffer', async () => {
      const h = findHandler('native-image:generateLQIP');
      const result = await h(null, { buffer: Buffer.alloc(0).buffer });
      assert.equal(result.error, 'bad_buffer');
      assert.equal(result.lqip, null);
    });

    // The handler must NEVER throw across IPC — bad input returns a null LQIP so
    // the renderer falls back to OffscreenCanvas silently (no console spam).
    test('returns bad_buffer (no throw) when buffer is null', async () => {
      const h = findHandler('native-image:generateLQIP');
      const result = await h(null, { buffer: null });
      assert.equal(result.error, 'bad_buffer');
      assert.equal(result.lqip, null);
    });

    test('returns bad_buffer (no throw) when buffer is undefined', async () => {
      const h = findHandler('native-image:generateLQIP');
      const result = await h(null, {});
      assert.equal(result.error, 'bad_buffer');
      assert.equal(result.lqip, null);
    });

    // ── Regression: contextBridge can deliver image bytes as a Uint8Array view
    // or as a plain object of numeric indices (not a real ArrayBuffer). All of
    // these must coerce to a Buffer and produce a valid LQIP. ──
    test('accepts a Uint8Array view', async () => {
      const h = findHandler('native-image:generateLQIP');
      const result = await h(null, { buffer: new Uint8Array(makeMagicBuffer('webp')) });
      assert.equal(result.error, null);
      assert.ok(result.lqip.startsWith('data:image/webp;base64,'));
    });

    test('accepts a plain object-of-numbers (contextBridge-cloned shape)', async () => {
      const h = findHandler('native-image:generateLQIP');
      const obj = { ...Uint8Array.from(makeMagicBuffer('webp')) }; // {0:.., 1:.., ...}
      const result = await h(null, { buffer: obj });
      assert.equal(result.error, null);
      assert.ok(result.lqip.startsWith('data:image/webp;base64,'));
    });
  });

  // ── Decode ──────────────────────────────────────────────────────────

  describe('native-image:decode', () => {
    test('returns width, height, format for WebP buffer', async () => {
      const h = findHandler('native-image:decode');
      const buf = makeMagicBuffer('webp');
      const result = await h(null, { buffer: buf.buffer });
      assert.equal(result.width, 10);
      assert.equal(result.height, 10);
      assert.equal(result.format, 'webp');
      assert.equal(result.error, null);
    });

    test('returns width, height, format for JPEG buffer', async () => {
      const h = findHandler('native-image:decode');
      const buf = makeMagicBuffer('jpeg');
      const result = await h(null, { buffer: buf.buffer });
      assert.equal(result.width, 12);
      assert.equal(result.height, 8);
      assert.equal(result.format, 'jpeg');
      assert.equal(result.error, null);
    });

    test('returns decode_failed for PNG buffer (unsupported format)', async () => {
      const h = findHandler('native-image:decode');
      const buf = makeMagicBuffer('png');
      const result = await h(null, { buffer: buf.buffer });
      assert.equal(result.width, 0);
      assert.equal(result.height, 0);
      assert.equal(result.format, 'png');
      assert.equal(result.error, 'decode_failed');
    });

    test('returns decode_failed for unknown format (plain text)', async () => {
      const h = findHandler('native-image:decode');
      const result = await h(null, { buffer: Buffer.from('plain text').buffer });
      assert.equal(result.width, 0);
      assert.equal(result.height, 0);
      assert.equal(result.format, 'unknown');
      assert.equal(result.error, 'decode_failed');
    });

    test('returns unknown format for very small buffer (< 4 bytes)', async () => {
      const h = findHandler('native-image:decode');
      const result = await h(null, { buffer: Buffer.from([0xFF]).buffer });
      assert.equal(result.format, 'unknown');
      assert.equal(result.error, 'decode_failed');
    });

    test('returns bad_buffer for zero-length buffer', async () => {
      const h = findHandler('native-image:decode');
      const result = await h(null, { buffer: Buffer.alloc(0).buffer });
      assert.equal(result.format, 'unknown');
      assert.equal(result.error, 'bad_buffer');
    });

    // Must never throw across IPC — bad input returns an error object.
    test('returns bad_buffer (no throw) when buffer is null', async () => {
      const h = findHandler('native-image:decode');
      const result = await h(null, { buffer: null });
      assert.equal(result.error, 'bad_buffer');
    });

    test('returns bad_buffer (no throw) when buffer is undefined', async () => {
      const h = findHandler('native-image:decode');
      const result = await h(null, {});
      assert.equal(result.error, 'bad_buffer');
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════
// SUITE 2: Native addon loaded (string LQIP result — data URL branch)
// ═════════════════════════════════════════════════════════════════════════

describe('imageNative.cjs — native addon LOADED (string LQIP data URL)', () => {
  before(() => {
    restoreMocks = setupMocks(MOCK_ADDON_STRING_RESULT);
    delete require.cache[MODULE_PATH];
    const mod = require(MODULE_PATH);
    mod.registerImageNativeHandlers();
  });

  after(() => {
    if (restoreMocks) restoreMocks();
  });

  describe('native-image:generateLQIP', () => {
    test('passes through data URL string directly', async () => {
      const h = findHandler('native-image:generateLQIP');
      const buf = makeMagicBuffer('webp');
      const result = await h(null, { buffer: buf.buffer });
      assert.equal(result.error, null);
      assert.equal(result.lqip, 'data:image/webp;base64,cHJlLWVuY29kZWQtbHFpcA==');
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════
// SUITE 3: Native addon loaded (GPU supported)
// ═════════════════════════════════════════════════════════════════════════

describe('imageNative.cjs — native addon LOADED (GPU supported)', () => {
  before(() => {
    restoreMocks = setupMocks(MOCK_ADDON_GPU_SUPPORTED);
    delete require.cache[MODULE_PATH];
    const mod = require(MODULE_PATH);
    mod.registerImageNativeHandlers();
  });

  after(() => {
    if (restoreMocks) restoreMocks();
  });

  describe('native-image:health', () => {
    test('returns gpu=true when addon reports GPU support', async () => {
      const h = findHandler('native-image:health');
      const result = await h();
      assert.equal(result.loaded, true);
      assert.equal(result.gpu, true);
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════
// SUITE 4: Native addon NOT loaded (fallback path)
// ═════════════════════════════════════════════════════════════════════════

describe('imageNative.cjs — native addon NOT loaded (fallback)', () => {
  before(() => {
    restoreMocks = setupMocks(null);
    delete require.cache[MODULE_PATH];
    const mod = require(MODULE_PATH);
    mod.registerImageNativeHandlers();
  });

  after(() => {
    if (restoreMocks) restoreMocks();
  });

  describe('registerImageNativeHandlers', () => {
    test('registers exactly 3 handlers even without addon', () => {
      assert.equal(ipcMainHandleSpy.calls.length, 3);
    });
  });

  describe('native-image:health', () => {
    test('returns loaded=false, gpu=false', async () => {
      const h = findHandler('native-image:health');
      const result = await h();
      assert.equal(result.loaded, false);
      assert.equal(result.gpu, false);
      assert.equal(typeof result.version, 'string');
    });
  });

  describe('native-image:generateLQIP', () => {
    test('returns native_addon_not_loaded error', async () => {
      const h = findHandler('native-image:generateLQIP');
      const buf = makeMagicBuffer('webp');
      const result = await h(null, { buffer: buf.buffer });
      assert.equal(result.error, 'native_addon_not_loaded');
      assert.equal(result.lqip, null);
    });

    test('returns error without crashing even with null buffer', async () => {
      const h = findHandler('native-image:generateLQIP');
      const result = await h(null, { buffer: null });
      assert.equal(result.error, 'native_addon_not_loaded');
      assert.equal(result.lqip, null);
    });

    test('returns error without crashing even with missing buffer', async () => {
      const h = findHandler('native-image:generateLQIP');
      const result = await h(null, {});
      assert.equal(result.error, 'native_addon_not_loaded');
      assert.equal(result.lqip, null);
    });
  });

  describe('native-image:decode', () => {
    test('returns native_addon_not_loaded error', async () => {
      const h = findHandler('native-image:decode');
      const buf = makeMagicBuffer('webp');
      const result = await h(null, { buffer: buf.buffer });
      assert.equal(result.error, 'native_addon_not_loaded');
      assert.equal(result.width, 0);
      assert.equal(result.height, 0);
      assert.equal(result.format, 'unknown');
    });

    test('returns error without crashing with null buffer', async () => {
      const h = findHandler('native-image:decode');
      const result = await h(null, { buffer: null });
      assert.equal(result.error, 'native_addon_not_loaded');
    });

    test('returns error without crashing with missing buffer', async () => {
      const h = findHandler('native-image:decode');
      const result = await h(null, {});
      assert.equal(result.error, 'native_addon_not_loaded');
    });
  });
});
