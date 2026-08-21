/**
 * imageDiskCache.test.cjs — Comprehensive test suite for electron/services/imageDiskCache.cjs
 *
 * Uses Node.js built-in test framework (node:test + node:assert).
 * Mocks the `electron` module (app, protocol) via Module._resolveFilename interception
 * since these tests run outside Electron.
 *
 * Run with: node --test electron/services/__tests__/imageDiskCache.test.cjs
 */

'use strict';

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');
const fs = require('fs');
const path = require('path');
const os = require('os');

const TMP_BASE = path.join(os.tmpdir(), 'imgcache-test-');

// ── Mock Helpers (no node:test mock.fn — removed in Node 26) ─────────────

function createSpy() {
  function spy(...args) {
    spy.calls.push(args);
  }
  spy.calls = [];
  return spy;
}

function monkeyPatch(obj, method, impl) {
  const orig = obj[method];
  obj[method] = impl;
  return function restore() { obj[method] = orig; };
}

// ── Electron Mock Setup ──────────────────────────────────────────────────

const ELECTRON_MOCK_ID = path.resolve(__dirname, '.electron-mock.cjs');

let restoreElectronMock;
let protocolSpy;

function setupElectronMock(userDataPath) {
  protocolSpy = createSpy();

  require.cache[ELECTRON_MOCK_ID] = {
    id: ELECTRON_MOCK_ID,
    filename: ELECTRON_MOCK_ID,
    loaded: true,
    exports: {
      app: { getPath: () => userDataPath },
      protocol: { registerFileProtocol: protocolSpy },
    },
    paths: [],
    children: [],
  };

  const origResolve = Module._resolveFilename;
  Module._resolveFilename = function (request, parent, isMain) {
    if (request === 'electron') return ELECTRON_MOCK_ID;
    return origResolve.call(this, request, parent, isMain);
  };

  return function restore() {
    delete require.cache[ELECTRON_MOCK_ID];
    Module._resolveFilename = origResolve;
  };
}

// ── Suite ────────────────────────────────────────────────────────────────

describe('DiskCacheManager', () => {
  let DiskCacheManager;
  const tempDirs = [];

  before(() => {
    restoreElectronMock = setupElectronMock('C:\\dummy\\userdata');
    DiskCacheManager = require('../imageDiskCache.cjs').DiskCacheManager;
  });

  after(() => {
    restoreElectronMock();
    for (const dir of tempDirs) {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  });

  function makeTempDir() {
    const d = fs.mkdtempSync(TMP_BASE);
    tempDirs.push(d);
    return d;
  }

  // ── Constructor & Defaults ────────────────────────────────────────────

  describe('constructor', () => {
    test('uses provided cacheDir option', () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir });
      assert.equal(cache.cacheDir, dir);
    });

    test('sets default maxSize to 500MB', () => {
      const cache = new DiskCacheManager({ cacheDir: makeTempDir() });
      assert.equal(cache.maxSize, 500 * 1024 * 1024);
    });

    test('sets default shardCount to 1000', () => {
      const cache = new DiskCacheManager({ cacheDir: makeTempDir() });
      assert.equal(cache.shardCount, 1000);
    });

    test('sets default ttlMs to 30 days', () => {
      const cache = new DiskCacheManager({ cacheDir: makeTempDir() });
      assert.equal(cache.ttlMs, 30 * 24 * 60 * 60 * 1000);
    });

    test('sets default lruIntervalMs to 5 minutes', () => {
      const cache = new DiskCacheManager({ cacheDir: makeTempDir() });
      assert.equal(cache.lruIntervalMs, 5 * 60 * 1000);
    });

    test('initializes with no entries and zero size', () => {
      const cache = new DiskCacheManager({ cacheDir: makeTempDir() });
      assert.equal(cache.manifest.size, 0);
      assert.equal(cache.currentSize, 0);
      assert.equal(cache.initialized, false);
      assert.equal(cache._protocolRegistered, false);
      assert.equal(cache._dirty, false);
    });

    test('constructs manifestPath from cacheDir', () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir });
      assert.equal(cache.manifestPath, path.join(dir, 'manifest.json'));
    });

    test('uses constructor option values', () => {
      const cache = new DiskCacheManager({
        cacheDir: makeTempDir(),
        maxSize: 100,
        shardCount: 5,
        ttlMs: 60000,
        lruIntervalMs: 10000,
      });
      assert.equal(cache.maxSize, 100);
      assert.equal(cache.shardCount, 5);
      assert.equal(cache.ttlMs, 60000);
      assert.equal(cache.lruIntervalMs, 10000);
    });
  });

  // ── Key & Path Helpers ────────────────────────────────────────────────

  describe('key and path helpers', () => {
    test('_cacheKey returns string appid when no types', () => {
      const cache = new DiskCacheManager({ cacheDir: makeTempDir() });
      assert.equal(cache._cacheKey(12345), '12345');
    });

    test('_cacheKey joins appid and image types', () => {
      const cache = new DiskCacheManager({ cacheDir: makeTempDir() });
      assert.equal(cache._cacheKey(12345, ['webp', 'jpg']), '12345_webp,jpg');
    });

    test('_shardName computes shard from numeric appid', () => {
      const cache = new DiskCacheManager({ cacheDir: makeTempDir(), shardCount: 100 });
      assert.equal(cache._shardName(42), '0042');
    });

    test('_shardName handles string appid', () => {
      const cache = new DiskCacheManager({ cacheDir: makeTempDir(), shardCount: 100 });
      assert.equal(cache._shardName('42'), '0042');
    });

    test('_shardName pads to 4 digits', () => {
      const cache = new DiskCacheManager({ cacheDir: makeTempDir(), shardCount: 2000 });
      assert.equal(cache._shardName(5), '0005');
    });

    test('_shardName returns 0000 for NaN appid', () => {
      const cache = new DiskCacheManager({ cacheDir: makeTempDir(), shardCount: 100 });
      assert.equal(cache._shardName('abc'), '0000');
    });

    test('_filePath returns correct path for cacheKey', () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 100 });
      const result = cache._filePath('42');
      assert.ok(result.startsWith(dir));
      assert.ok(result.endsWith(path.join('0042', '42.webp')));
    });

    test('_filePath extracts appid from composite key', () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 100 });
      const result = cache._filePath('42_webp,jpg');
      assert.ok(result.endsWith(path.join('0042', '42_webp,jpg.webp')));
    });
  });

  // ── init ──────────────────────────────────────────────────────────────

  describe('init', () => {
    test('creates cache directory and shard subdirectories', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3 });
      await cache.init();
      assert.ok(fs.existsSync(dir));
      assert.ok(fs.existsSync(path.join(dir, '0000')));
      assert.ok(fs.existsSync(path.join(dir, '0001')));
      assert.ok(fs.existsSync(path.join(dir, '0002')));
      assert.equal(cache.initialized, true);
      await cache.close();
    });

    test('does not re-initialize if already initialized', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3 });
      await cache.init();
      const restore = monkeyPatch(cache, '_ensureDirectories', async () => {});
      await cache.init();
      // Verify second init is a no-op (still initialized, monkey patch not called)
      restore();
      assert.equal(cache.initialized, true);
      await cache.close();
    });

    test('starts LRU timer on init', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3 });
      assert.equal(cache._lruTimer, null);
      await cache.init();
      assert.notEqual(cache._lruTimer, null);
      await cache.close();
    });
  });

  // ── _ensureDirectories ────────────────────────────────────────────────

  describe('_ensureDirectories', () => {
    test('creates all shard subdirectories', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 5 });
      await cache._ensureDirectories();
      for (let i = 0; i < 5; i++) {
        const shardName = String(i).padStart(4, '0');
        assert.ok(fs.existsSync(path.join(dir, shardName)), `Shard ${shardName} not created`);
      }
    });

    test('does not fail when called multiple times', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3 });
      await cache._ensureDirectories();
      await cache._ensureDirectories();
      assert.ok(fs.existsSync(path.join(dir, '0000')));
    });

    test('handles missing root cache directory', async () => {
      const dir = path.join(makeTempDir(), 'nested', 'deep', 'cache');
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 2 });
      await cache._ensureDirectories();
      assert.ok(fs.existsSync(dir));
      assert.ok(fs.existsSync(path.join(dir, '0000')));
    });
  });

  // ── Manifest Persistence ──────────────────────────────────────────────

  describe('manifest persistence', () => {
    test('loads empty manifest when file does not exist', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3 });
      await cache.init();
      assert.equal(cache.manifest.size, 0);
      assert.equal(cache.currentSize, 0);
      await cache.close();
    });

    test('loads existing manifest on init', async () => {
      const dir = makeTempDir();
      fs.mkdirSync(dir, { recursive: true });
      fs.mkdirSync(path.join(dir, '0000'));
      const manifestData = {
        entries: {
          '42': { shard: '0000', mimeType: 'image/webp', fileSize: 1000, lastAccessed: Date.now(), cachedAt: Date.now() },
        },
        totalSize: 1000,
        updatedAt: Date.now(),
      };
      fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifestData), 'utf-8');
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3 });
      await cache.init();
      assert.equal(cache.manifest.size, 1);
      assert.ok(cache.manifest.has('42'));
      assert.equal(cache.currentSize, 1000);
      await cache.close();
    });

    test('loads multiple entries from manifest', async () => {
      const dir = makeTempDir();
      fs.mkdirSync(dir, { recursive: true });
      fs.mkdirSync(path.join(dir, '0000'));
      const manifestData = {
        entries: { '1': { shard: '0000', fileSize: 500 }, '2': { shard: '0000', fileSize: 1500 }, '3': { shard: '0000', fileSize: 2000 } },
        totalSize: 4000,
        updatedAt: Date.now(),
      };
      fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifestData), 'utf-8');
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3 });
      await cache.init();
      assert.equal(cache.manifest.size, 3);
      assert.equal(cache.currentSize, 4000);
      await cache.close();
    });

    test('handles corrupt manifest JSON gracefully', async () => {
      const dir = makeTempDir();
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'manifest.json'), 'not valid json{{{', 'utf-8');
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3 });
      await cache.init();
      assert.equal(cache.manifest.size, 0);
      assert.equal(cache.currentSize, 0);
      await cache.close();
    });

    test('handles empty manifest file gracefully', async () => {
      const dir = makeTempDir();
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'manifest.json'), '', 'utf-8');
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3 });
      await cache.init();
      assert.equal(cache.manifest.size, 0);
      assert.equal(cache.currentSize, 0);
      await cache.close();
    });

    test('handles manifest with missing entries field', async () => {
      const dir = makeTempDir();
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ totalSize: 5000 }), 'utf-8');
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3 });
      await cache.init();
      assert.equal(cache.manifest.size, 0);
      await cache.close();
    });

    test('saveManifest writes dirty data', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3 });
      await cache.init();
      cache._dirty = true;
      await cache.saveManifest();
      const manifestPath = path.join(dir, 'manifest.json');
      assert.ok(fs.existsSync(manifestPath));
      const data = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      assert.ok(data.entries);
      assert.equal(typeof data.totalSize, 'number');
      assert.equal(typeof data.updatedAt, 'number');
      await cache.close();
    });

    test('saveManifest uses atomic write (tmp + rename)', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3 });
      await cache.init();
      cache._dirty = true;
      assert.ok(!fs.existsSync(cache.manifestPath + '.tmp'));
      await cache.saveManifest();
      assert.ok(fs.existsSync(cache.manifestPath));
      assert.ok(!fs.existsSync(cache.manifestPath + '.tmp'));
      await cache.close();
    });

    test('saveManifest skips if not dirty', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3 });
      await cache.init();
      cache._dirty = false;
      const restore = monkeyPatch(fs, 'writeFileSync', () => { throw new Error('should not be called'); });
      await cache.saveManifest();
      restore();
      await cache.close();
    });

    test('_scheduleSave sets dirty flag and timeout', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3 });
      await cache.init();
      assert.equal(cache._dirty, false);
      assert.equal(cache._saveTimeout, null);
      cache._scheduleSave();
      assert.equal(cache._dirty, true);
      assert.notEqual(cache._saveTimeout, null);
      await cache.close();
    });

    test('_scheduleSave does not create multiple timeouts', () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir });
      cache._scheduleSave();
      const t1 = cache._saveTimeout;
      cache._scheduleSave();
      const t2 = cache._saveTimeout;
      assert.equal(t1, t2);
    });
  });

  // ── set ───────────────────────────────────────────────────────────────

  describe('set', () => {
    test('stores buffer to disk and updates manifest', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3 });
      await cache.init();
      const buf = Buffer.alloc(1000, 'A');
      await cache.set('42', null, buf, 'image/webp');
      const key = cache._cacheKey('42');
      assert.ok(cache.manifest.has(key));
      assert.equal(cache.manifest.get(key).fileSize, 1000);
      assert.equal(cache.manifest.get(key).mimeType, 'image/webp');
      assert.ok(cache.manifest.get(key).cachedAt > 0);
      assert.ok(cache.manifest.get(key).lastAccessed > 0);
      assert.ok(fs.existsSync(cache._filePath(key)));
      const onDisk = fs.readFileSync(cache._filePath(key));
      assert.deepEqual(onDisk, buf);
      await cache.close();
    });

    test('stores with preferredImageTypes', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3 });
      await cache.init();
      const buf = Buffer.alloc(1000, 'B');
      await cache.set('42', ['webp'], buf, 'image/webp');
      const key = cache._cacheKey('42', ['webp']);
      assert.ok(cache.manifest.has(key));
      assert.equal(key, '42_webp');
      await cache.close();
    });

    test('stores LQIP data when provided', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3 });
      await cache.init();
      const lqip = 'data:image/webp;base64,AAAA';
      await cache.set('42', null, Buffer.alloc(1000), 'image/webp', lqip);
      const key = cache._cacheKey('42');
      assert.equal(cache.manifest.get(key).lqip, lqip);
      await cache.close();
    });

    test('refuses empty buffer', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3 });
      await cache.init();
      await cache.set('42', null, Buffer.alloc(0), 'image/webp');
      assert.equal(cache.manifest.size, 0);
      await cache.close();
    });

    test('refuses non-Buffer argument', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3 });
      await cache.init();
      await cache.set('42', null, 'not-a-buffer', 'image/webp');
      assert.equal(cache.manifest.size, 0);
      await cache.close();
    });

    test('refuses buffer smaller than 500 bytes', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3 });
      await cache.init();
      await cache.set('42', null, Buffer.alloc(499), 'image/webp');
      assert.equal(cache.manifest.size, 0);
      await cache.close();
    });

    test('accepts buffer of exactly 500 bytes', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3 });
      await cache.init();
      await cache.set('42', null, Buffer.alloc(500), 'image/webp');
      assert.equal(cache.manifest.size, 1);
      await cache.close();
    });

    test('replaces existing entry', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3 });
      await cache.init();
      await cache.set('42', null, Buffer.alloc(1000, 'A'), 'image/webp');
      assert.equal(cache.currentSize, 1000);
      await cache.set('42', null, Buffer.alloc(2000, 'B'), 'image/webp');
      const key = cache._cacheKey('42');
      assert.equal(cache.manifest.get(key).fileSize, 2000);
      assert.equal(cache.currentSize, 2000);
      await cache.close();
    });

    test('replaces old file on disk when entry exists', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3 });
      await cache.init();
      await cache.set('42', null, Buffer.alloc(1000, 'A'), 'image/webp');
      const key = cache._cacheKey('42');
      const fp = cache._filePath(key);
      await cache.set('42', null, Buffer.alloc(1500, 'B'), 'image/webp');
      const onDisk = fs.readFileSync(fp);
      assert.equal(onDisk.length, 1500);
      assert.equal(onDisk[0], 'B'.charCodeAt(0));
      await cache.close();
    });

    test('increments currentSize when adding entries', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3 });
      await cache.init();
      await cache.set('1', null, Buffer.alloc(1000), 'image/webp');
      await cache.set('2', null, Buffer.alloc(2000), 'image/webp');
      assert.equal(cache.currentSize, 3000);
      await cache.close();
    });

    test('triggers LRU enforcement when over maxSize', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3, maxSize: 1200 });
      await cache.init();
      await cache.set('1', null, Buffer.alloc(1000), 'image/webp');
      await cache.set('2', null, Buffer.alloc(1000), 'image/webp');
      await new Promise(r => setImmediate(r));
      assert.ok(cache.currentSize <= cache.maxSize,
        `currentSize ${cache.currentSize} > maxSize ${cache.maxSize}`);
      await cache.close();
    });

    test('does not trigger LRU when under maxSize', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3, maxSize: 10000 });
      await cache.init();
      let enforceCalled = false;
      const restore = monkeyPatch(cache, 'enforceSizeLimit', async () => { enforceCalled = true; });
      await cache.set('42', null, Buffer.alloc(1000), 'image/webp');
      await new Promise(r => setImmediate(r));
      assert.equal(enforceCalled, false);
      restore();
      await cache.close();
    });

    test('marks dirty and schedules save', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3 });
      await cache.init();
      assert.equal(cache._dirty, false);
      await cache.set('42', null, Buffer.alloc(1000), 'image/webp');
      assert.equal(cache._dirty, true);
      assert.notEqual(cache._saveTimeout, null);
      await cache.close();
    });
  });

  // ── get ───────────────────────────────────────────────────────────────

  describe('get', () => {
    test('returns cached buffer and mimeType', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3 });
      await cache.init();
      const buf = Buffer.alloc(1000, 'X');
      await cache.set('42', null, buf, 'image/webp');
      const result = await cache.get('42');
      assert.notEqual(result, null);
      assert.deepEqual(result.buffer, buf);
      assert.equal(result.mimeType, 'image/webp');
      assert.equal(result.lqip, null);
      await cache.close();
    });

    test('returns null for missing key', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3 });
      await cache.init();
      const result = await cache.get('99999');
      assert.equal(result, null);
      await cache.close();
    });

    test('returns null for expired entry', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3, ttlMs: 100 });
      await cache.init();
      await cache.set('42', null, Buffer.alloc(1000), 'image/webp');
      const key = cache._cacheKey('42');
      cache.manifest.get(key).cachedAt = Date.now() - 200;
      const result = await cache.get('42');
      assert.equal(result, null);
      await cache.close();
    });

    test('removes expired entry from manifest', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3, ttlMs: 100 });
      await cache.init();
      await cache.set('42', null, Buffer.alloc(1000), 'image/webp');
      const key = cache._cacheKey('42');
      cache.manifest.get(key).cachedAt = Date.now() - 200;
      await cache.get('42');
      assert.equal(cache.manifest.has(key), false);
      await cache.close();
    });

    test('returns null when file is missing from disk', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3 });
      await cache.init();
      await cache.set('42', null, Buffer.alloc(1000), 'image/webp');
      const key = cache._cacheKey('42');
      fs.unlinkSync(cache._filePath(key));
      const result = await cache.get('42');
      assert.equal(result, null);
      await cache.close();
    });

    test('removes manifest entry when file is missing', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3 });
      await cache.init();
      await cache.set('42', null, Buffer.alloc(1000), 'image/webp');
      const key = cache._cacheKey('42');
      fs.unlinkSync(cache._filePath(key));
      await cache.get('42');
      assert.equal(cache.manifest.has(key), false);
      await cache.close();
    });

    test('updates lastAccessed on hit', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3 });
      await cache.init();
      await cache.set('42', null, Buffer.alloc(1000), 'image/webp');
      const key = cache._cacheKey('42');
      const before = Date.now();
      await cache.get('42');
      assert.ok(cache.manifest.get(key).lastAccessed >= before);
      await cache.close();
    });

    test('returns lqip when present', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3 });
      await cache.init();
      const lqip = 'data:image/webp;base64,AAAA';
      await cache.set('42', null, Buffer.alloc(1000), 'image/webp', lqip);
      const result = await cache.get('42');
      assert.equal(result.lqip, lqip);
      await cache.close();
    });

    test('throws if not initialized', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir });
      await assert.rejects(async () => cache.get('42'), { message: /Not initialized/ });
    });
  });

  // ── has ───────────────────────────────────────────────────────────────

  describe('has', () => {
    test('returns true for existing entry', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3 });
      await cache.init();
      await cache.set('42', null, Buffer.alloc(1000), 'image/webp');
      assert.equal(await cache.has('42'), true);
      await cache.close();
    });

    test('returns false for missing entry', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3 });
      await cache.init();
      assert.equal(await cache.has('999'), false);
      await cache.close();
    });

    test('returns false for expired entry', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3, ttlMs: 100 });
      await cache.init();
      await cache.set('42', null, Buffer.alloc(1000), 'image/webp');
      const key = cache._cacheKey('42');
      cache.manifest.get(key).cachedAt = Date.now() - 200;
      assert.equal(await cache.has('42'), false);
      await cache.close();
    });

    test('still reports true when the file vanished — manifest is the hot-path truth', async () => {
      // has() is called per item by the preloader, so it deliberately does NOT stat
      // the disk; a sync stat per cover stalls the main thread and all IPC.
      // A vanished file is caught on the miss path instead: the protocol handler
      // purges the entry (see "purges a stale manifest entry" below), so the next
      // request is a clean miss and re-downloads.
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3 });
      await cache.init();
      await cache.set('42', null, Buffer.alloc(1000), 'image/webp');
      const key = cache._cacheKey('42');
      fs.unlinkSync(cache._filePath(key));
      assert.equal(await cache.has('42'), true);
      await cache.close();
    });

    test('returns true for entry with preferredImageTypes', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3 });
      await cache.init();
      await cache.set('42', ['webp'], Buffer.alloc(1000), 'image/webp');
      assert.equal(await cache.has('42', ['webp']), true);
      await cache.close();
    });

    test('throws if not initialized', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir });
      await assert.rejects(async () => cache.has('42'), { message: /Not initialized/ });
    });
  });

  // ── batchGet ──────────────────────────────────────────────────────────

  describe('batchGet', () => {
    test('retrieves multiple entries', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3 });
      await cache.init();
      await cache.set('1', null, Buffer.alloc(1000, 'A'), 'image/webp');
      await cache.set('2', null, Buffer.alloc(1000, 'B'), 'image/webp');
      const results = await cache.batchGet([{ appid: '1' }, { appid: '2' }, { appid: '3' }]);
      assert.equal(results.size, 3);
      assert.notEqual(results.get(cache._cacheKey('1')), null);
      assert.notEqual(results.get(cache._cacheKey('2')), null);
      assert.equal(results.get(cache._cacheKey('3')), null);
      await cache.close();
    });

    test('returns empty map for empty request', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3 });
      await cache.init();
      const results = await cache.batchGet([]);
      assert.equal(results.size, 0);
      await cache.close();
    });
  });

  // ── clear ─────────────────────────────────────────────────────────────

  describe('clear', () => {
    test('removes all entries and resets size', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3 });
      await cache.init();
      await cache.set('1', null, Buffer.alloc(1000), 'image/webp');
      await cache.set('2', null, Buffer.alloc(2000), 'image/webp');
      assert.equal(cache.manifest.size, 2);
      await cache.clear();
      assert.equal(cache.manifest.size, 0);
      assert.equal(cache.currentSize, 0);
      await cache.close();
    });

    test('deletes files from disk', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3 });
      await cache.init();
      await cache.set('42', null, Buffer.alloc(1000), 'image/webp');
      const key = cache._cacheKey('42');
      const fp = cache._filePath(key);
      assert.ok(fs.existsSync(fp));
      await cache.clear();
      assert.ok(!fs.existsSync(fp));
      await cache.close();
    });

    test('saves empty manifest after clear', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3 });
      await cache.init();
      await cache.set('42', null, Buffer.alloc(1000), 'image/webp');
      await cache.clear();
      const manifest = JSON.parse(fs.readFileSync(cache.manifestPath, 'utf-8'));
      assert.deepEqual(manifest.entries, {});
      assert.equal(manifest.totalSize, 0);
      await cache.close();
    });

    test('is safe to call on empty cache', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3 });
      await cache.init();
      await cache.clear();
      assert.equal(cache.manifest.size, 0);
      assert.equal(cache.currentSize, 0);
      await cache.close();
    });
  });

  // ── evictStale ────────────────────────────────────────────────────────

  describe('evictStale', () => {
    test('removes expired entries', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3, ttlMs: 100 });
      await cache.init();
      await cache.set('1', null, Buffer.alloc(500), 'image/webp');
      await cache.set('2', null, Buffer.alloc(500), 'image/webp');
      const key1 = cache._cacheKey('1');
      cache.manifest.get(key1).cachedAt = Date.now() - 200;
      await cache.evictStale();
      assert.equal(cache.manifest.has(key1), false);
      assert.equal(cache.manifest.has(cache._cacheKey('2')), true);
      await cache.close();
    });

    test('does nothing when no entries are stale', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3 });
      await cache.init();
      await cache.set('42', null, Buffer.alloc(1000), 'image/webp');
      const before = cache.manifest.size;
      await cache.evictStale();
      assert.equal(cache.manifest.size, before);
      await cache.close();
    });

    test('updates currentSize after eviction', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3, ttlMs: 100 });
      await cache.init();
      await cache.set('1', null, Buffer.alloc(1000), 'image/webp');
      const key1 = cache._cacheKey('1');
      cache.manifest.get(key1).cachedAt = Date.now() - 200;
      const before = cache.currentSize;
      await cache.evictStale();
      assert.ok(cache.currentSize < before);
      await cache.close();
    });

    test('deletes stale files from disk', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3, ttlMs: 100 });
      await cache.init();
      await cache.set('42', null, Buffer.alloc(1000), 'image/webp');
      const key = cache._cacheKey('42');
      const fp = cache._filePath(key);
      cache.manifest.get(key).cachedAt = Date.now() - 200;
      assert.ok(fs.existsSync(fp));
      await cache.evictStale();
      assert.ok(!fs.existsSync(fp));
      await cache.close();
    });

    test('schedules save after eviction', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3, ttlMs: 100 });
      await cache.init();
      await cache.set('42', null, Buffer.alloc(1000), 'image/webp');
      const key = cache._cacheKey('42');
      cache.manifest.get(key).cachedAt = Date.now() - 200;
      cache._dirty = false;
      assert.equal(cache._dirty, false);
      await cache.evictStale();
      assert.equal(cache._dirty, true);
      await cache.close();
    });

    test('handles empty manifest gracefully', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3 });
      await cache.init();
      await cache.evictStale();
      assert.equal(cache.manifest.size, 0);
      await cache.close();
    });
  });

  // ── enforceSizeLimit ──────────────────────────────────────────────────

  describe('enforceSizeLimit', () => {
    test('evicts LRU entries when over limit', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3, maxSize: 600 });
      await cache.init();
      await cache.set('1', null, Buffer.alloc(500), 'image/webp');
      await cache.set('2', null, Buffer.alloc(500), 'image/webp');
      await cache.enforceSizeLimit();
      assert.ok(cache.currentSize <= cache.maxSize,
        `currentSize ${cache.currentSize} > maxSize ${cache.maxSize}`);
      await cache.close();
    });

    test('evicts oldest entries first (LRU order)', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3, maxSize: 1200 });
      await cache.init();
      await cache.set('1', null, Buffer.alloc(1000), 'image/webp');
      await cache.set('2', null, Buffer.alloc(1000), 'image/webp');
      await cache.get('2');
      await cache.enforceSizeLimit();
      assert.equal(cache.manifest.size, 1);
      assert.ok(cache.manifest.has(cache._cacheKey('2')));
      await cache.close();
    });

    test('does nothing when under limit', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3, maxSize: 10000 });
      await cache.init();
      await cache.set('42', null, Buffer.alloc(1000), 'image/webp');
      const before = cache.manifest.size;
      await cache.enforceSizeLimit();
      assert.equal(cache.manifest.size, before);
      await cache.close();
    });

    test('schedules save after eviction', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3, maxSize: 100 });
      await cache.init();
      await cache.set('42', null, Buffer.alloc(1000), 'image/webp');
      cache._dirty = false;
      await cache.enforceSizeLimit();
      assert.equal(cache._dirty, true);
      await cache.close();
    });

    test('deletes evicted files from disk', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3, maxSize: 400 });
      await cache.init();
      await cache.set('42', null, Buffer.alloc(1000), 'image/webp');
      const key = cache._cacheKey('42');
      const fp = cache._filePath(key);
      assert.ok(fs.existsSync(fp));
      await cache.enforceSizeLimit();
      assert.ok(!fs.existsSync(fp));
      await cache.close();
    });

    test('handles empty manifest gracefully', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3 });
      await cache.init();
      await cache.enforceSizeLimit();
      assert.equal(cache.manifest.size, 0);
      await cache.close();
    });
  });

  // ── getFilePathForKey ─────────────────────────────────────────────────

  describe('getFilePathForKey', () => {
    test('returns file path for valid key', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3 });
      await cache.init();
      await cache.set('42', null, Buffer.alloc(1000), 'image/webp');
      const key = cache._cacheKey('42');
      const fp = cache.getFilePathForKey(key);
      assert.notEqual(fp, null);
      assert.ok(typeof fp === 'string');
      assert.ok(fs.existsSync(fp));
      await cache.close();
    });

    test('returns null for missing key', () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir });
      assert.equal(cache.getFilePathForKey('nonexistent'), null);
    });

    test('returns null for expired key', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3, ttlMs: 100 });
      await cache.init();
      await cache.set('42', null, Buffer.alloc(1000), 'image/webp');
      const key = cache._cacheKey('42');
      cache.manifest.get(key).cachedAt = Date.now() - 200;
      assert.equal(cache.getFilePathForKey(key), null);
      await cache.close();
    });

    test('still returns a path when the file vanished — no stat on the protocol hot path', async () => {
      // Same tradeoff as has(): every image-cache:// request goes through here, so it
      // must not stat. The downstream net.fetch() 404s and the handler purges the entry.
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3 });
      await cache.init();
      await cache.set('42', null, Buffer.alloc(1000), 'image/webp');
      const key = cache._cacheKey('42');
      fs.unlinkSync(cache._filePath(key));
      assert.equal(cache.getFilePathForKey(key), cache._filePath(key));
      await cache.close();
    });

    test('purges a stale manifest entry so the next request re-downloads', async () => {
      // The self-heal that makes the two "no stat" tradeoffs above safe. Without it a
      // vanished file leaves has() saying "cached" forever and the cover renders as a
      // placeholder letter permanently.
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3 });
      await cache.init();
      await cache.set('42', null, Buffer.alloc(1000), 'image/webp');
      const key = cache._cacheKey('42');
      fs.unlinkSync(cache._filePath(key));

      assert.equal(await cache.has('42'), true, 'precondition: manifest still claims it');
      // What the protocol handler does when net.fetch reports the file is gone.
      cache._deleteEntry(key);
      assert.equal(await cache.has('42'), false, 'entry purged → next request is a clean miss');
      await cache.close();
    });
  });

  // ── getStats ──────────────────────────────────────────────────────────

  describe('getStats', () => {
    test('returns correct stats', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 5, maxSize: 2000, ttlMs: 5000 });
      await cache.init();
      await cache.set('42', null, Buffer.alloc(500), 'image/webp');
      const stats = cache.getStats();
      assert.equal(stats.entryCount, 1);
      assert.equal(stats.currentSize, 500);
      assert.equal(stats.maxSize, 2000);
      assert.equal(stats.shardCount, 5);
      assert.equal(stats.ttlMs, 5000);
      assert.equal(stats.initialized, true);
      assert.equal(stats.protocolRegistered, false);
      assert.equal(stats.cacheDir, dir);
      assert.equal(stats.usagePercent, '25.0%');
      assert.ok(stats.currentSizeFormatted.includes('500'));
      assert.ok(stats.maxSizeFormatted.includes('1.95'));
    });

    test('returns zero stats for empty cache', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3 });
      await cache.init();
      const stats = cache.getStats();
      assert.equal(stats.entryCount, 0);
      assert.equal(stats.currentSize, 0);
      assert.equal(stats.usagePercent, '0.0%');
      await cache.close();
    });
  });

  // ── registerProtocol ──────────────────────────────────────────────────

  describe('registerProtocol', () => {
    test('calls protocol.registerFileProtocol with correct name', () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir });
      cache.registerProtocol();
      assert.equal(protocolSpy.calls.length, 1);
      assert.equal(protocolSpy.calls[0][0], 'image-cache');
      assert.equal(typeof protocolSpy.calls[0][1], 'function');
    });

    test('does not register twice', () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir });
      cache.registerProtocol();
      const before = protocolSpy.calls.length;
      cache.registerProtocol();
      // Second call is a no-op due to _protocolRegistered flag
      assert.equal(protocolSpy.calls.length, before);
    });

    test('sets _protocolRegistered flag', () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir });
      assert.equal(cache._protocolRegistered, false);
      cache.registerProtocol();
      assert.equal(cache._protocolRegistered, true);
    });

    test('protocol handler takes a function as second arg', () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir });
      cache.registerProtocol();
      const handler = protocolSpy.calls[0][1];
      assert.equal(typeof handler, 'function');
    });
  });

  // ── close ─────────────────────────────────────────────────────────────

  describe('close', () => {
    test('stops LRU timer and clears save timeout', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3 });
      await cache.init();
      assert.notEqual(cache._lruTimer, null);
      await cache.close();
      assert.equal(cache._lruTimer, null);
      assert.equal(cache._saveTimeout, null);
    });

    test('saves dirty manifest on close', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3 });
      await cache.init();
      await cache.set('42', null, Buffer.alloc(1000), 'image/webp');
      assert.equal(cache._dirty, true);
      await cache.close();
      const manifestPath = path.join(dir, 'manifest.json');
      assert.ok(fs.existsSync(manifestPath));
      const data = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      assert.ok(data.entries['42']);
      await cache.close();
    });

    test('sets initialized to false', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3 });
      await cache.init();
      assert.equal(cache.initialized, true);
      await cache.close();
      assert.equal(cache.initialized, false);
    });

    test('is idempotent', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3 });
      await cache.init();
      await cache.close();
      await cache.close();
      assert.equal(cache.initialized, false);
    });

    test('does not fail when not initialized', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir });
      await cache.close();
      assert.equal(cache.initialized, false);
    });
  });

  // ── LRU Timer ────────────────────────────────────────────────────────

  describe('LRU timer', () => {
    test('starts timer on init and stops on close', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3, lruIntervalMs: 60000 });
      assert.equal(cache._lruTimer, null);
      await cache.init();
      assert.notEqual(cache._lruTimer, null);
      assert.ok(cache._lruTimer._repeat);
      await cache.close();
      assert.equal(cache._lruTimer, null);
    });
  });

  // ── _deleteEntry ──────────────────────────────────────────────────────

  describe('_deleteEntry', () => {
    test('removes entry and adjusts currentSize', () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir });
      const key = 'test-key';
      cache.manifest.set(key, { fileSize: 500 });
      cache.currentSize = 500;
      cache._deleteEntry(key);
      assert.equal(cache.manifest.has(key), false);
      assert.equal(cache.currentSize, 0);
    });

    test('does nothing for missing key', () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir });
      cache.currentSize = 500;
      cache._deleteEntry('nonexistent');
      assert.equal(cache.currentSize, 500);
    });
  });

  // ── _assertReady ──────────────────────────────────────────────────────

  describe('_assertReady', () => {
    test('throws before init', () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir });
      assert.throws(() => cache._assertReady(), { message: /Not initialized/ });
    });

    test('does not throw after init', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3 });
      await cache.init();
      cache._assertReady();
      await cache.close();
    });

    test('throws after close', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3 });
      await cache.init();
      await cache.close();
      assert.throws(() => cache._assertReady(), { message: /Not initialized/ });
    });
  });

  // ── _formatSize ──────────────────────────────────────────────────────

  describe('_formatSize', () => {
    test('formats bytes', () => {
      const cache = new DiskCacheManager({ cacheDir: makeTempDir() });
      assert.equal(cache._formatSize(500), '500 B');
    });

    test('formats kilobytes', () => {
      const cache = new DiskCacheManager({ cacheDir: makeTempDir() });
      assert.equal(cache._formatSize(2048), '2.00 KB');
    });

    test('formats megabytes', () => {
      const cache = new DiskCacheManager({ cacheDir: makeTempDir() });
      assert.equal(cache._formatSize(5 * 1048576), '5.00 MB');
    });

    test('formats gigabytes', () => {
      const cache = new DiskCacheManager({ cacheDir: makeTempDir() });
      assert.equal(cache._formatSize(2 * 1073741824), '2.00 GB');
    });

    test('handles zero', () => {
      const cache = new DiskCacheManager({ cacheDir: makeTempDir() });
      assert.equal(cache._formatSize(0), '0 B');
    });
  });

  // ── 1.2.11: E2E Protocol Serve ──────────────────────────────────────

  describe('1.2.11 — E2E: set → protocol handler serves it', () => {
    test('protocol handler returns file content for cached entry', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3 });
      await cache.init();
      const buf = Buffer.alloc(1000, 'X');
      await cache.set('42', null, buf, 'image/webp');
      // Simulate the protocol handler logic directly (same as registerProtocol callback)
      const key = cache._cacheKey('42');
      const fp = cache.getFilePathForKey(key);
      assert.notEqual(fp, null);
      const onDisk = fs.readFileSync(fp);
      assert.deepEqual(onDisk, buf);
      await cache.close();
    });

    test('protocol handler returns 404 for missing entry', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3 });
      await cache.init();
      const fp = cache.getFilePathForKey('nonexistent');
      assert.equal(fp, null);
      await cache.close();
    });

    test('protocol handler returns 404 for expired entry', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3, ttlMs: 100 });
      await cache.init();
      await cache.set('42', null, Buffer.alloc(1000), 'image/webp');
      const key = cache._cacheKey('42');
      cache.manifest.get(key).cachedAt = Date.now() - 200;
      const fp = cache.getFilePathForKey(key);
      assert.equal(fp, null);
      await cache.close();
    });
  });

  // ── 1.2.12: batchGet 50 appids ──────────────────────────────────────

  describe('1.2.12 — batchGet 50 appids', () => {
    test('retrieves all 50 entries in one call', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 100, maxSize: 500 * 1024 * 1024 });
      await cache.init();
      const appids = [];
      for (let i = 1; i <= 50; i++) {
        const appid = String(i * 1000);
        appids.push({ appid });
        await cache.set(appid, null, Buffer.alloc(5000, i), 'image/webp');
      }
      const results = await cache.batchGet(appids);
      assert.equal(results.size, 50);
      for (const { appid } of appids) {
        const key = cache._cacheKey(appid);
        assert.ok(results.has(key), `Missing key for appid ${appid}`);
        assert.notEqual(results.get(key), null);
      }
      await cache.close();
    });

    test('batchGet 50 returns nulls for missing entries mixed in', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 100, maxSize: 500 * 1024 * 1024 });
      await cache.init();
      const appids = [];
      for (let i = 1; i <= 50; i++) {
        const appid = String(i * 1000);
        appids.push({ appid });
        if (i % 2 === 0) {
          await cache.set(appid, null, Buffer.alloc(5000, i), 'image/webp');
        }
      }
      const results = await cache.batchGet(appids);
      assert.equal(results.size, 50);
      let hitCount = 0;
      let missCount = 0;
      for (const [, val] of results) {
        if (val !== null) hitCount++;
        else missCount++;
      }
      assert.equal(hitCount, 25);
      assert.equal(missCount, 25);
      await cache.close();
    });
  });

  // ── 1.2.13: Eviction when over limit ────────────────────────────────

  describe('1.2.13 — eviction fires when over limit', () => {
    test('enforceSizeLimit evicts LRU entries below maxSize', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3, maxSize: 2000 });
      await cache.init();
      await cache.set('1', null, Buffer.alloc(1000), 'image/webp');
      await cache.set('2', null, Buffer.alloc(1000), 'image/webp');
      await cache.set('3', null, Buffer.alloc(1000), 'image/webp');
      assert.ok(cache.currentSize > 2000);
      await cache.enforceSizeLimit();
      assert.ok(cache.currentSize <= 2000,
        `currentSize ${cache.currentSize} > maxSize ${cache.maxSize}`);
      // Oldest (first inserted) should be evicted
      const key1 = cache._cacheKey('1');
      assert.equal(cache.manifest.has(key1), false);
      await cache.close();
    });

    test('set triggers auto-eviction when over limit', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3, maxSize: 1500 });
      await cache.init();
      await cache.set('1', null, Buffer.alloc(1000), 'image/webp');
      await cache.set('2', null, Buffer.alloc(1000), 'image/webp');
      await new Promise(r => setImmediate(r));
      assert.ok(cache.currentSize <= cache.maxSize,
        `Auto-eviction failed: ${cache.currentSize} > ${cache.maxSize}`);
      await cache.close();
    });
  });

  // ── 1.2.14: Cache survives close/open cycle ──────────────────────────

  describe('1.2.14 — cache survives close/open cycle', () => {
    test('entries persist across close → new instance → init', async () => {
      const dir = makeTempDir();
      const cache1 = new DiskCacheManager({ cacheDir: dir, shardCount: 5 });
      await cache1.init();
      await cache1.set('42', null, Buffer.alloc(1000, 'X'), 'image/webp');
      await cache1.set('99', null, Buffer.alloc(2000, 'Y'), 'image/webp');
      assert.equal(cache1.manifest.size, 2);
      assert.equal(cache1.currentSize, 3000);
      await cache1.close();

      // New instance, same directory — should reload
      const cache2 = new DiskCacheManager({ cacheDir: dir, shardCount: 5 });
      await cache2.init();
      assert.equal(cache2.manifest.size, 2);
      assert.equal(cache2.currentSize, 3000);
      const result42 = await cache2.get('42');
      assert.notEqual(result42, null);
      assert.equal(result42.mimeType, 'image/webp');
      assert.equal(result42.buffer.length, 1000);
      const result99 = await cache2.get('99');
      assert.notEqual(result99, null);
      assert.equal(result99.buffer.length, 2000);
      await cache2.close();
    });

    test('clear, close, reopen — cache is empty', async () => {
      const dir = makeTempDir();
      const cache1 = new DiskCacheManager({ cacheDir: dir, shardCount: 3 });
      await cache1.init();
      await cache1.set('42', null, Buffer.alloc(1000), 'image/webp');
      await cache1.clear();
      await cache1.close();

      const cache2 = new DiskCacheManager({ cacheDir: dir, shardCount: 3 });
      await cache2.init();
      assert.equal(cache2.manifest.size, 0);
      assert.equal(cache2.currentSize, 0);
      await cache2.close();
    });
  });

  // ── _getEntry ─────────────────────────────────────────────────────────

  describe('_getEntry', () => {
    test('returns entry for valid key', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3 });
      await cache.init();
      await cache.set('42', null, Buffer.alloc(1000), 'image/webp');
      const result = cache._getEntry('42');
      assert.notEqual(result, null);
      assert.equal(result.key, cache._cacheKey('42'));
      assert.equal(result.entry.fileSize, 1000);
      await cache.close();
    });

    test('returns null for missing key', () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir });
      assert.equal(cache._getEntry('999'), null);
    });

    test('returns null for expired key', async () => {
      const dir = makeTempDir();
      const cache = new DiskCacheManager({ cacheDir: dir, shardCount: 3, ttlMs: 100 });
      await cache.init();
      await cache.set('42', null, Buffer.alloc(1000), 'image/webp');
      const key = cache._cacheKey('42');
      cache.manifest.get(key).cachedAt = Date.now() - 200;
      assert.equal(cache._getEntry('42'), null);
      await cache.close();
    });
  });
});
