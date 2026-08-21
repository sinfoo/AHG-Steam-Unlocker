/**
 * imagePreloader.test.cjs — Tests for Phase 1.3 Preloader
 * (MASTERPLAN checklist items 1.3.11–1.3.13)
 *
 * Covers:
 *   1.3.11 — Preload 1000 games, verify all appear in disk cache
 *   1.3.12 — Pause during download, verify resume continues
 *   1.3.13 — App close during preload, verify next launch resumes correctly
 *
 * NOTE on preloader semantics:
 *   - `processed` counts ALL items through the worker loop (every fileType×appid).
 *   - `skipped` / `failed` are sub-counters inside `processed` (not subtracted).
 *   - Each game produces 3 queue items (FILE_TYPES = [header.jpg, portrait.jpg, library_600x900.jpg]).
 *   - Cache key is appid, so cache store size = unique games, NOT items.
 *
 * Uses Node.js built-in test framework (node:test + node:assert).
 * Mocks: electron, native image addon, CDN HTTP requests, DiskCacheManager.
 */

'use strict';

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');
const EventEmitter = require('events');

// ── Constants ─────────────────────────────────────────────────────────

const FILE_TYPES_COUNT = 3; // header.jpg, portrait.jpg, library_600x900.jpg

// ── Mock Helpers ──────────────────────────────────────────────────────

function monkeyPatch(obj, method, impl) {
  const orig = obj[method];
  obj[method] = impl;
  return function restore() { obj[method] = orig; };
}

// ── Mocks ─────────────────────────────────────────────────────────────

// 1) Electron mock
const ELECTRON_MOCK_ID = require('path').resolve(__dirname, '.electron-mock-preloader.cjs');

let restoreElectronMock;

function setupElectronMock() {
  delete require.cache[ELECTRON_MOCK_ID];

  require.cache[ELECTRON_MOCK_ID] = {
    id: ELECTRON_MOCK_ID,
    filename: ELECTRON_MOCK_ID,
    loaded: true,
    exports: { BrowserWindow: { getAllWindows: () => [] } },
    paths: [],
    children: [],
  };

  const origResolve = Module._resolveFilename;
  Module._resolveFilename = function (request, parent, isMain) {
    if (request === 'electron') return ELECTRON_MOCK_ID;
    return origResolve.call(this, request, parent, isMain);
  };

  return () => {
    delete require.cache[ELECTRON_MOCK_ID];
    Module._resolveFilename = origResolve;
  };
}

// 2) Native image addon mock
function setupNativeMock() {
  const nativeMock = {
    decodeWebP: async (buf) => ({ data: buf, width: 10, height: 10 }),
    decodeJPEG: async (buf) => ({ data: buf, width: 10, height: 10 }),
    encodeWebP: async (data, w, h, q) => Buffer.from('FAKE_WEBP'),
    generateLQIP: async (data, w, h, size) => 'data:image/webp;base64,FAKE_LQIP',
  };

  const nativePath = require('path').resolve(__dirname, '..', '..', '..', 'native');
  delete require.cache[nativePath];

  const origResolve = Module._resolveFilename;
  Module._resolveFilename = function (request, parent, isMain) {
    if (request === '../../native' || request === 'ahg-native-image') return nativePath;
    return origResolve.call(this, request, parent, isMain);
  };

  require.cache[nativePath] = {
    id: nativePath,
    filename: nativePath,
    loaded: true,
    exports: nativeMock,
    paths: [],
    children: [],
  };
}

// 3) In-memory DiskCache mock
function createMockCache() {
  const store = new Map();
  return {
    _store: store,
    async has(appid) { return store.has(String(appid)); },
    async get(appid) {
      const entry = store.get(String(appid));
      return entry ? { buffer: entry.buffer, mimeType: entry.mimeType } : null;
    },
    async set(appid, preferredTypes, buffer, mimeType, lqip) {
      store.set(String(appid), { buffer, mimeType, lqip });
    },
    async clear() { store.clear(); },
    stats() { return { entries: store.size, sizeBytes: 0 }; },
  };
}

// 4) Mock CDN — uses EventEmitter + setImmediate for realistic async stream behavior.
//    Returns buffer ≥500 bytes so the preloader's size check passes.

function makeFakeImageBuffer(appid) {
  const buf = Buffer.alloc(600);
  buf.write('FAKE_IMAGE_', 0);
  buf.write(String(appid || 'unknown'), 10);
  for (let i = 20; i < 600; i++) buf[i] = (i + (Number(appid) || 0)) & 0xFF;
  return buf;
}

function setupCdnMock({ failAppids = [], delayMs = 0 } = {}) {
  const restoreHttps = monkeyPatch(require('https'), 'get', (url, opts, cb) => {
    if (typeof opts === 'function') { cb = opts; opts = {}; }

    const appidMatch = url.match(/\/apps\/(\d+)\//);
    const appid = appidMatch ? appidMatch[1] : null;

    // Failure mode — emit 'error' on the returned request object (matches real HTTP error behavior)
    if (appid && failAppids.includes(appid)) {
      const errReq = new EventEmitter();
      errReq.destroy = () => {};
      setImmediate(() => errReq.emit('error', new Error(`Mock CDN failure for ${appid}`)));
      return errReq;
    }

    const fakeBuffer = makeFakeImageBuffer(appid);
    const res = new EventEmitter();
    res.statusCode = 200;
    res.headers = { 'content-type': 'image/jpeg' };
    res.resume = () => {};

    // http.get() callback signature is (res), not (err, res)
    if (cb) {
      if (delayMs > 0) {
        setTimeout(() => { cb(res); res.emit('data', fakeBuffer); res.emit('end'); }, delayMs);
      } else {
        setImmediate(() => { cb(res); res.emit('data', fakeBuffer); res.emit('end'); });
      }
    }

    return { on: () => {}, destroy: () => {} };
  });

  const restoreHttp = monkeyPatch(require('http'), 'get', () => {
    return { on: () => {}, destroy: () => {} };
  });

  return () => { restoreHttps(); restoreHttp(); };
}

// ── Test Helpers ──────────────────────────────────────────────────────

/** Generate N fake game entries. */
function makeGameList(n) {
  return Array.from({ length: n }, (_, i) => ({ appid: String(1000000 + i), name: `Game ${i}` }));
}

/** Generate N fake appids — the preloader processes its priority list (no Tier-2 catalogue pass). */
function makeIds(n) {
  return Array.from({ length: n }, (_, i) => String(1000000 + i));
}

// Mirror of MAX_QUEUE in imagePreloader.cjs — the flood backstop.
const MAX_QUEUE = 3000;

// ── Suite ─────────────────────────────────────────────────────────────

describe('ImagePreloader', () => {
  let ImagePreloader;
  let mockCache;
  let restoreNetwork;

  before(() => {
    restoreElectronMock = setupElectronMock();
    setupNativeMock();
    ImagePreloader = require('../imagePreloader.cjs').ImagePreloader;
  });

  after(() => {
    if (restoreElectronMock) restoreElectronMock();
  });

  function setup() {
    mockCache = createMockCache();
    globalThis._imageDiskCache = mockCache;
    restoreNetwork = setupCdnMock();
  }

  function teardown() {
    delete globalThis._imageDiskCache;
    if (restoreNetwork) restoreNetwork();
  }

  // ─────────────────────────────────────────────────────────────────────
  // 1.3.11 — Preload 1000 games, verify all appear in disk cache
  // ─────────────────────────────────────────────────────────────────────

  describe('1.3.11 — Preload games (priority list)', () => {
    test('preloads all 1000 games into disk cache', async () => {
      setup();
      const preloader = new ImagePreloader();

      const result = await preloader.start(makeIds(1000));

      assert.ok(result, 'preloader should return result');
      assert.equal(result.processed, 1000 * FILE_TYPES_COUNT, 'all items processed');
      assert.equal(result.failed, 0, 'zero failures');
      assert.equal(result.cancelled, false);
      assert.equal(mockCache._store.size, 1000, 'disk cache has 1000 game entries');

      teardown();
    });

    test('dedups duplicate priority appids', async () => {
      setup();
      const preloader = new ImagePreloader();

      // 100 unique ids, with 3 duplicated at the front — must collapse to 100 unique.
      const ids = ['1000005', '1000010', '1000015', ...makeIds(100)];
      const result = await preloader.start(ids);

      assert.equal(result.processed, 100 * FILE_TYPES_COUNT, 'all items processed');
      assert.equal(mockCache._store.size, 100, 'cache has 100 unique games');

      teardown();
    });

    test('skips already-cached games', async () => {
      setup();
      const preloader = new ImagePreloader();

      // Pre-populate 50 games in cache
      for (let i = 0; i < 50; i++) {
        await mockCache.set(String(1000000 + i), ['header.jpg'], Buffer.from('preloaded'), 'image/webp');
      }

      const result = await preloader.start(makeIds(200));

      // processed = total items (200 games × 3 file types)
      assert.equal(result.processed, 200 * FILE_TYPES_COUNT, 'all items processed');
      // skipped = cached games × file types (50 × 3)
      assert.equal(result.skipped, 50 * FILE_TYPES_COUNT, '50 cached games skipped');
      assert.equal(mockCache._store.size, 200, 'final cache size = 200');

      teardown();
    });

    test('handles partial failures gracefully', async () => {
      setup();
      const preloader = new ImagePreloader();
      restoreNetwork(); // remove default
      restoreNetwork = setupCdnMock({ failAppids: ['1000001', '1000005', '1000009'] });

      const result = await preloader.start(makeIds(20));

      // 3 failing appids × 3 file types each = 9 failed items
      assert.equal(result.failed, 9, '9 item downloads should fail');
      assert.equal(result.processed, 20 * FILE_TYPES_COUNT, 'all items processed');
      // 20 games - 3 failed = 17 cached
      assert.equal(mockCache._store.size, 17, '17 successful entries in cache');

      teardown();
    });

    test('caps the queue at MAX_QUEUE — never floods the CDN', async () => {
      setup();
      const preloader = new ImagePreloader();

      // 1200 games × 3 file types = 3600 queued items, above the 3000 cap.
      const result = await preloader.start(makeIds(1200));

      assert.equal(result.processed, MAX_QUEUE, `processed capped at MAX_QUEUE (${MAX_QUEUE})`);
      // 3000 items / 3 file types = 1000 whole games fit under the cap.
      assert.equal(mockCache._store.size, MAX_QUEUE / FILE_TYPES_COUNT, 'cache capped to whole-games-under-cap');

      teardown();
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // 1.3.12 — Pause during download, verify resume continues
  // ─────────────────────────────────────────────────────────────────────

  describe('1.3.12 — Pause and resume', () => {
    test('pause stops processing, resume continues', async () => {
      setup();
      const preloader = new ImagePreloader();
      restoreNetwork();
      restoreNetwork = setupCdnMock({ delayMs: 10 });

      const TOTAL = 100 * FILE_TYPES_COUNT;

      const donePromise = preloader.start(makeIds(100));

      // Wait for some progress, then pause
      await new Promise((r) => setTimeout(r, 150));
      preloader.pause();

      const s1 = preloader.status();
      assert.ok(s1.paused, 'preloader should be paused');
      assert.ok(s1.processed > 0 && s1.processed < TOTAL,
        `some progress made: ${s1.processed}/${TOTAL}`);

      const processedAtPause = s1.processed;

      // Verify no meaningful progress while paused (at most CONCURRENCY in-flight items may complete)
      await new Promise((r) => setTimeout(r, 300));
      const s2 = preloader.status();
      assert.ok(s2.processed >= processedAtPause && s2.processed <= processedAtPause + 4,
        `minimal progress while paused: ${s2.processed} vs ${processedAtPause}`);

      // Resume
      preloader.resume();
      assert.ok(preloader.status().running, 'running after resume');

      // Wait for completion
      const result = await donePromise;
      assert.equal(result.processed, TOTAL, 'all items processed after resume');
      assert.equal(mockCache._store.size, 100, 'cache has 100 games');
      assert.equal(result.cancelled, false);

      teardown();
    });

    test('pause/resume cycle works multiple times', async () => {
      setup();
      const preloader = new ImagePreloader();
      restoreNetwork();
      restoreNetwork = setupCdnMock({ delayMs: 8 });

      const TOTAL = 200 * FILE_TYPES_COUNT;
      const donePromise = preloader.start(makeIds(200));

      for (let i = 0; i < 3; i++) {
        await new Promise((r) => setTimeout(r, 100));
        const beforePause = preloader.status().processed;
        preloader.pause();
        await new Promise((r) => setTimeout(r, 150));

        const afterPause = preloader.status();
        assert.ok(afterPause.processed >= beforePause && afterPause.processed <= beforePause + 4,
          `minimal progress during pause cycle ${i}: ${afterPause.processed} vs ${beforePause}`);
        preloader.resume();
        await new Promise((r) => setTimeout(r, 50));
      }

      const result = await donePromise;
      assert.equal(result.processed, TOTAL, 'all items after multi-pause');
      assert.equal(result.cancelled, false);

      teardown();
    });

    test('cancel stops preloader mid-flight', async () => {
      setup();
      const preloader = new ImagePreloader();
      restoreNetwork();
      restoreNetwork = setupCdnMock({ delayMs: 15 });

      const TOTAL = 500 * FILE_TYPES_COUNT;
      const donePromise = preloader.start(makeIds(500));

      await new Promise((r) => setTimeout(r, 200));
      preloader.cancel();

      const result = await donePromise;
      assert.ok(result.cancelled, 'should report cancelled');
      assert.ok(result.processed < TOTAL, 'not all items processed');
      assert.ok(result.processed > 0, 'some items processed before cancel');

      // Verify idle after cancel
      await new Promise((r) => setTimeout(r, 300));
      assert.ok(preloader.status().idle, 'preloader idle after cancel');

      teardown();
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // 1.3.13 — App close / crash resilience
  // ─────────────────────────────────────────────────────────────────────

  describe('1.3.13 — App close / crash resilience', () => {
    test('after cancel, new preloader resumes from cache state', async () => {
      setup();
      const preloader = new ImagePreloader();
      restoreNetwork();
      restoreNetwork = setupCdnMock({ delayMs: 8 });

      // Phase 1: preload and cancel mid-flight (simulate app close)
      const ids = makeIds(300);
      const donePromise1 = preloader.start(ids);

      await new Promise((r) => setTimeout(r, 200));
      preloader.cancel();
      await donePromise1;

      const cachedAfterCancel = mockCache._store.size;
      assert.ok(cachedAfterCancel > 0, 'some games cached before close');
      assert.ok(cachedAfterCancel < 300, 'not all games cached before close');

      // Phase 2: new preloader, same cache (simulate relaunch)
      const preloader2 = new ImagePreloader();
      globalThis._imageDiskCache = mockCache;

      const result2 = await preloader2.start(ids);

      // All 300 games should be in cache after resume
      assert.equal(mockCache._store.size, 300, 'all 300 games now in cache');
      // Previously cached games were skipped (each has 3 file types)
      assert.equal(result2.skipped, cachedAfterCancel * FILE_TYPES_COUNT,
        `${cachedAfterCancel} previously cached games skipped`);
      // New downloads filled in any missing entries
      assert.equal(result2.processed, 300 * FILE_TYPES_COUNT,
        'all items processed in resume pass');

      teardown();
    });

    test('two consecutive preload runs produce same final cache state', async () => {
      setup();
      const preloader = new ImagePreloader();

      // First run
      await preloader.start(makeIds(100));
      const state1 = Array.from(mockCache._store.keys()).sort();

      // Second run (incremental)
      const preloader2 = new ImagePreloader();
      globalThis._imageDiskCache = mockCache;
      const result2 = await preloader2.start(makeIds(100));

      assert.equal(result2.skipped, 100 * FILE_TYPES_COUNT, 'all games skipped (already cached)');
      assert.equal(result2.processed, 100 * FILE_TYPES_COUNT, 'all items processed');
      assert.equal(result2.failed, 0, 'zero failures');

      const state2 = Array.from(mockCache._store.keys()).sort();
      assert.deepEqual(state2, state1, 'cache state identical after second run');

      teardown();
    });

    test('empty game list completes immediately', async () => {
      setup();
      const preloader = new ImagePreloader();

      const result = await preloader.start([]);
      assert.equal(result.processed, 0);
      assert.equal(result.skipped, 0);
      assert.equal(result.failed, 0);
      assert.ok(preloader.status().idle, 'preloader idle after empty run');

      teardown();
    });
  });
});
