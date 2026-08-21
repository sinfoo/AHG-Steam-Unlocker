// ── Disk Cache Manager for game cover images ──
// Sharded directory structure (1000 subdirs), LRU eviction with JSON manifest,
// TTL expiry, and custom protocol support for direct file serving.
// Replaces the renderer-side IndexedDB + in-memory 3-tier LRU.
//
// Flow:
//   1. Renderer calls IPC → main process
//   2. DiskCacheManager checks manifest (fast JSON lookup)
//   3. If hit: returns image-cache:// URL for direct protocol serving
//   4. If miss: downloads from CDN, caches to disk, returns URL
//   5. Custom protocol handler serves cached files directly to renderer

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pathToFileURL } = require('url');
const { app, protocol, net } = require('electron');

const DEFAULT_MAX_SIZE = 500 * 1024 * 1024;     // 500 MB
const DEFAULT_SHARD_COUNT = 1000;
const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const DEFAULT_LRU_INTERVAL_MS = 5 * 60 * 1000;   // 5 min
const MANIFEST_SAVE_DEBOUNCE_MS = 2000;           // 2s debounce on manifest writes
const PROTOCOL_NAME = 'image-cache';

class DiskCacheManager {
  /**
   * @param {object} options
   * @param {string} [options.cacheDir]       - Root cache directory (default: userData/image-cache)
   * @param {number} [options.maxSize]        - Max cache size in bytes (default: 500MB)
   * @param {number} [options.shardCount]     - Number of shard subdirectories (default: 1000)
   * @param {number} [options.ttlMs]          - Entry TTL in ms (default: 30 days)
   * @param {number} [options.lruIntervalMs]  - Periodic LRU check interval (default: 5 min)
   */
  constructor(options = {}) {
    this.cacheDir = options.cacheDir || path.join(app.getPath('userData'), 'image-cache');
    this.maxSize = options.maxSize || DEFAULT_MAX_SIZE;
    this.shardCount = options.shardCount || DEFAULT_SHARD_COUNT;
    this.ttlMs = options.ttlMs || DEFAULT_TTL_MS;
    this.lruIntervalMs = options.lruIntervalMs || DEFAULT_LRU_INTERVAL_MS;
    this.manifestPath = path.join(this.cacheDir, 'manifest.json');

    /** @type {Map<string, ManifestEntry>} key=cacheKey → entry */
    this.manifest = new Map();
    this.currentSize = 0;
    this.initialized = false;
    this._lruTimer = null;
    this._saveTimeout = null;
    this._dirty = false;
    this._protocolRegistered = false;
  }

  // ── Manifest Entry Schema (stored in manifest.json) ──
  // {
  //   "cacheKey": {
  //     "shard": "0123",           // shard directory name
  //     "mimeType": "image/webp",
  //     "fileSize": 45231,
  //     "lastAccessed": 1718000000000,  // epoch ms
  //     "cachedAt": 1718000000000,
  //     "lqip": "data:image/..."        // optional LQIP base64
  //   }
  // }

  // ── Initialization ────────────────────────────────────────────────────

  /**
   * Initialize the cache: ensure directories exist, load manifest, start LRU timer.
   * Safe to call multiple times — subsequent calls are no-ops.
   */
  async init() {
    if (this.initialized) return;
    // Memoise so the protocol handler can await readiness without racing or
    // kicking off a second initialisation.
    if (this._initPromise) return this._initPromise;
    this._initPromise = this._doInit();
    return this._initPromise;
  }

  async _doInit() {
    try {
      await this._ensureDirectories();
      await this.loadManifest();
      await this._seedIfEmpty();
      this._startLruTimer();
      this.initialized = true;
      console.log(`[DiskCache] Initialized: ${this.cacheDir} | ${this.manifest.size} entries | ${this._formatSize(this.currentSize)}`);
    } catch (err) {
      console.error('[DiskCache] Init failed:', err);
      throw err;
    }
  }

  /**
   * Create cache root and all shard subdirectories (000 to shardCount-1).
   */
  async _ensureDirectories() {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
    // Create shard directories in batches to avoid EMFILE on win32
    const existing = new Set(fs.readdirSync(this.cacheDir));
    let created = 0;
    for (let i = 0; i < this.shardCount; i++) {
      const shardName = String(i).padStart(4, '0');
      if (!existing.has(shardName)) {
        fs.mkdirSync(path.join(this.cacheDir, shardName), { recursive: true });
        created++;
      }
    }
    if (created > 0) {
      console.log(`[DiskCache] Created ${created} shard directories`);
    }
  }

  /**
   * One-time seed import: when the runtime cache is empty, import the shipped
   * read-only cover-seed (resources/cover-seed → process.resourcesPath/cover-seed)
   * so popular covers render instantly on a cold cache (first launch / post-update).
   * No-op in dev (no shipped seed) and on any subsequent launch (manifest non-empty).
   */
  async _seedIfEmpty() {
    if (this.manifest.size > 0) return; // already populated — never re-seed
    let seedDir = null;
    try {
      const base = process.resourcesPath || path.resolve(__dirname, '..', '..');
      const candidate = path.join(base, 'cover-seed');
      if (fs.existsSync(path.join(candidate, 'manifest.json'))) seedDir = candidate;
    } catch { /* ignore */ }
    if (!seedDir) return;
    try {
      const seed = JSON.parse(fs.readFileSync(path.join(seedDir, 'manifest.json'), 'utf-8'));
      const entries = seed.entries || {};
      const now = Date.now();
      let imported = 0, size = 0;
      for (const [key, entry] of Object.entries(entries)) {
        const src = path.join(seedDir, entry.shard, key + '.webp');
        const destDir = path.join(this.cacheDir, entry.shard);
        try {
          await fs.promises.mkdir(destDir, { recursive: true });
          await fs.promises.copyFile(src, path.join(destDir, key + '.webp'));
          // Stamp fresh cachedAt so the 30-day TTL starts now, not at build time.
          this.manifest.set(key, { ...entry, lastAccessed: now, cachedAt: now });
          imported++; size += entry.fileSize || 0;
        } catch { /* skip missing/failed file */ }
      }
      this.currentSize += size;
      this._dirty = true;
      await this.saveManifest();
      console.log(`[DiskCache] Seeded ${imported} popular covers from cover-seed (${this._formatSize(size)})`);
    } catch (err) {
      console.warn('[DiskCache] Seed import failed:', err.message);
    }
  }

  // ── Manifest Persistence ──────────────────────────────────────────────

  /**
   * Load manifest from disk. Called once at init.
   */
  async loadManifest() {
    try {
      if (!fs.existsSync(this.manifestPath)) {
        this.manifest = new Map();
        this.currentSize = 0;
        return;
      }
      const raw = fs.readFileSync(this.manifestPath, 'utf-8');
      const data = JSON.parse(raw);
      this.manifest = new Map(Object.entries(data.entries || {}));
      this.currentSize = data.totalSize || 0;
      console.log(`[DiskCache] Manifest loaded: ${this.manifest.size} entries, ${this._formatSize(this.currentSize)}`);
    } catch (err) {
      console.error('[DiskCache] Failed to load manifest, starting fresh:', err.message);
      this.manifest = new Map();
      this.currentSize = 0;
    }
  }

  /**
   * Save manifest to disk (debounced). Only writes if dirty.
   */
  async saveManifest() {
    if (!this._dirty) return;
    this._dirty = false;
    try {
      const entries = Object.fromEntries(this.manifest);
      const data = JSON.stringify({ entries, totalSize: this.currentSize, updatedAt: Date.now() });
      // Atomic write: write to temp file, then rename
      const tmpPath = this.manifestPath + '.tmp';
      // Async, non-blocking — runs on the debounce timer, off the request hot path.
      await fs.promises.writeFile(tmpPath, data, 'utf-8');
      await fs.promises.rename(tmpPath, this.manifestPath);
    } catch (err) {
      console.error('[DiskCache] Failed to save manifest:', err.message);
    }
  }

  /**
   * Schedule a debounced manifest save.
   */
  _scheduleSave() {
    this._dirty = true;
    if (this._saveTimeout) return;
    this._saveTimeout = setTimeout(() => {
      this._saveTimeout = null;
      this.saveManifest();
    }, MANIFEST_SAVE_DEBOUNCE_MS);
  }

  // ── Key & Path Helpers ────────────────────────────────────────────────

  /**
   * Compute the cache key from appid and optional preferredImageTypes.
   * Matches the key scheme used in renderer's imageCache.ts for consistency.
   */
  _cacheKey(appid, preferredImageTypes) {
    if (preferredImageTypes && preferredImageTypes.length > 0) {
      return `${appid}_${preferredImageTypes.join(',')}`;
    }
    return String(appid);
  }

  /**
   * Determine shard directory name for a given appid.
   * Uses numeric appid modulo shardCount, padded to 4 digits.
   */
  _shardName(appid) {
    const num = typeof appid === 'number' ? appid : parseInt(appid, 10);
    return String(isNaN(num) ? 0 : num % this.shardCount).padStart(4, '0');
  }

  /**
   * Full path to a cached file for a given cacheKey.
   */
  _filePath(cacheKey) {
    // Extract appid from cache key (everything before first underscore or the whole string)
    const parts = cacheKey.split('_');
    const appid = parts[0];
    const shard = this._shardName(appid);
    return path.join(this.cacheDir, shard, cacheKey + '.webp');
  }
  // ── Core CRUD Operations ──────────────────────────────────────────────

  /**
   * Retrieve a cached image.
   * @param {string} appid
   * @param {string[]} [preferredImageTypes]
   * @returns {Promise<{buffer: Buffer, mimeType: string, lqip: string|null}|null>}
   */
  async get(appid, preferredImageTypes) {
    this._assertReady();
    const key = this._cacheKey(appid, preferredImageTypes);
    const entry = this.manifest.get(key);
    if (!entry) return null;

    // Check TTL expiry
    if (Date.now() - entry.cachedAt > this.ttlMs) {
      this._deleteEntry(key);
      this._scheduleSave();
      return null;
    }

    // Check file exists on disk
    const filePath = this._filePath(key);
    try {
      if (!fs.existsSync(filePath)) {
        this._deleteEntry(key);
        this._scheduleSave();
        return null;
      }
      const buffer = fs.readFileSync(filePath);
      // Update lastAccessed in manifest (mark dirty)
      entry.lastAccessed = Date.now();
      this._dirty = true;
      this._scheduleSave();
      return { buffer, mimeType: entry.mimeType || 'image/webp', lqip: entry.lqip || null };
    } catch (err) {
      console.error(`[DiskCache] Read error for ${key}:`, err.message);
      return null;
    }
  }

  /**
   * Store an image in the disk cache.
   * @param {string} appid
   * @param {string[]} [preferredImageTypes]
   * @param {Buffer} buffer - Raw image bytes
   * @param {string} mimeType - MIME type (e.g. 'image/webp')
   * @param {string|null} [lqip] - Optional LQIP base64 data URL
   */
  async set(appid, preferredImageTypes, buffer, mimeType, lqip) {
    this._assertReady();
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      console.warn('[DiskCache] Attempted to cache empty buffer for', appid);
      return;
    }
    if (buffer.length < 500) {
      console.warn('[DiskCache] Image too small, refusing cache for', appid, buffer.length, 'bytes');
      return;
    }

    const key = this._cacheKey(appid, preferredImageTypes);
    const filePath = this._filePath(key);
    const now = Date.now();

    // If entry already exists, remove old file first
    const existing = this.manifest.get(key);
    if (existing) {
      // Fire-and-forget async unlink — never block the write on removing the old file.
      fs.promises.unlink(this._filePath(key)).catch(() => {});
      this.currentSize -= existing.fileSize;
    }

    // Write file to disk (async, non-blocking). mkdir is recursive + idempotent, so
    // we skip the existsSync stat; shard dirs already exist from init anyway.
    try {
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
      await fs.promises.writeFile(filePath, buffer);
    } catch (err) {
      console.error('[DiskCache] Failed to write file for', key, err.message);
      return;
    }

    // Update manifest
    const entry = {
      shard: this._shardName(appid),
      mimeType: mimeType || 'image/webp',
      fileSize: buffer.length,
      lastAccessed: now,
      cachedAt: now,
    };
    if (lqip) entry.lqip = lqip;
    this.manifest.set(key, entry);
    this.currentSize += buffer.length;
    this._scheduleSave();

    // Enforce size limit (async, non-blocking)
    if (this.currentSize > this.maxSize) {
      setImmediate(() => this.enforceSizeLimit().catch(() => {}));
    }
  }

  /**
   * Check if an image exists in the cache (manifest + file on disk).
   * @param {string} appid
   * @param {string[]} [preferredImageTypes]
   * @returns {Promise<boolean>}
   */
  async has(appid, preferredImageTypes) {
    this._assertReady();
    const key = this._cacheKey(appid, preferredImageTypes);
    const entry = this.manifest.get(key);
    if (!entry) return false;
    // Check TTL
    if (Date.now() - entry.cachedAt > this.ttlMs) {
      this._deleteEntry(key);
      this._scheduleSave();
      return false;
    }
    // Manifest entry present + not expired = cached. No sync fs.existsSync (this is
    // called per item by the preloader). A rare fs desync self-corrects on next set().
    return true;
  }

  /**
   * Batch retrieval of multiple images in a single operation.
   * @param {Array<{appid: string, preferredImageTypes?: string[]}>} requests
   * @returns {Promise<Map<string, {buffer: Buffer, mimeType: string, lqip: string|null}|null>>}
   */
  async batchGet(requests) {
    this._assertReady();
    const results = new Map();
    let touched = false;
    for (const req of requests) {
      const key = this._cacheKey(req.appid, req.preferredImageTypes);
      // METADATA ONLY — do NOT read the file bytes. The caller (image-cache:batchGet)
      // just needs to know the entry is valid + its mimeType/lqip, then hands the
      // renderer an `image-cache://` URL; the protocol handler streams the actual
      // bytes on demand via net.fetch. Previously this called get() which did a
      // synchronous fs.readFileSync of the whole image and threw the buffer away —
      // a full blocking disk read per cover, for nothing.
      const found = this._getEntry(req.appid, req.preferredImageTypes);
      if (found) {
        found.entry.lastAccessed = Date.now();
        touched = true;
        results.set(key, { mimeType: found.entry.mimeType || 'image/webp', lqip: found.entry.lqip || null });
      } else {
        results.set(key, null);
      }
    }
    if (touched) { this._dirty = true; this._scheduleSave(); }
    return results;
  }

  /**
   * Get the cache manifest entry for a key (for protocol handler).
   * Returns null if missing or expired.
   */
  _getEntry(appid, preferredImageTypes) {
    const key = this._cacheKey(appid, preferredImageTypes);
    const entry = this.manifest.get(key);
    if (!entry) return null;
    if (Date.now() - entry.cachedAt > this.ttlMs) {
      this._deleteEntry(key);
      this._scheduleSave();
      return null;
    }
    return { key, entry };
  }

  /**
   * Get the full file path for a cacheKey if it exists in the manifest.
   * Used by the protocol handler.
   */
  getFilePathForKey(cacheKey) {
    const entry = this.manifest.get(cacheKey);
    if (!entry) return null;
    if (Date.now() - entry.cachedAt > this.ttlMs) {
      this._deleteEntry(cacheKey);
      this._scheduleSave();
      return null;
    }
    // No fs.existsSync here — the manifest is the source of truth and this runs on
    // the protocol HOT PATH (every image-cache:// request). A sync stat per cover
    // stalls the main thread (and all IPC). If the file is somehow missing, the
    // downstream net.fetch() simply 404s — cheap and self-correcting.
    return this._filePath(cacheKey);
  }

  // ── Cache Management ─────────────────────────────────────────────────

  /**
   * Clear all cached images and manifest.
   */
  async clear() {
    this._assertReady();
    const errors = [];
    // Delete all files in shard directories
    for (const [key, entry] of this.manifest) {
      try {
        const filePath = this._filePath(key);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (err) {
        errors.push({ key, error: err.message });
      }
    }
    this.manifest.clear();
    this.currentSize = 0;
    this._dirty = true;
    await this.saveManifest();
    if (errors.length > 0) {
      console.warn('[DiskCache] Clear completed with', errors.length, 'errors');
    } else {
      console.log('[DiskCache] Cache cleared');
    }
  }

  /**
   * Remove all entries that have exceeded the TTL.
   * Called periodically by the LRU timer.
   */
  async evictStale() {
    this._assertReady();
    const now = Date.now();
    let evicted = 0;
    let freedSize = 0;
    for (const [key, entry] of this.manifest) {
      if (now - entry.cachedAt > this.ttlMs) {
        try {
          const filePath = this._filePath(key);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (err) {
          console.warn('[DiskCache] Failed to delete stale file for', key, err.message);
        }
        this.manifest.delete(key);
        this.currentSize -= entry.fileSize;
        freedSize += entry.fileSize;
        evicted++;
      }
    }
    if (evicted > 0) {
      this._scheduleSave();
      console.log(`[DiskCache] Evicted ${evicted} stale entries, freed ${this._formatSize(freedSize)}`);
    }
  }

  /**
   * Enforce the max cache size by evicting least-recently-accessed entries.
   * Sorts manifest by lastAccessed ascending, deletes until under limit.
   */
  async enforceSizeLimit() {
    this._assertReady();
    if (this.currentSize <= this.maxSize) return;

    // Sort entries by lastAccessed ascending
    const sorted = Array.from(this.manifest.entries())
      .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

    let evicted = 0;
    let freedSize = 0;
    for (const [key, entry] of sorted) {
      if (this.currentSize <= this.maxSize) break;
      try {
        const filePath = this._filePath(key);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (err) {
        console.warn('[DiskCache] LRU delete error for', key, err.message);
      }
      this.manifest.delete(key);
      this.currentSize -= entry.fileSize;
      freedSize += entry.fileSize;
      evicted++;
    }

    if (evicted > 0) {
      this._scheduleSave();
      console.log(`[DiskCache] LRU evicted ${evicted} entries, freed ${this._formatSize(freedSize)} | Current: ${this._formatSize(this.currentSize)}`);
    }
  }

  // ── Internal Helpers ─────────────────────────────────────────────────

  _assertReady() {
    if (!this.initialized) {
      throw new Error('[DiskCache] Not initialized — call init() first');
    }
  }

  _deleteEntry(key) {
    const entry = this.manifest.get(key);
    if (entry) {
      this.currentSize -= entry.fileSize;
      this.manifest.delete(key);
    }
  }

  _startLruTimer() {
    if (this._lruTimer) return;
    this._lruTimer = setInterval(() => {
      this.evictStale().catch(err => console.error('[DiskCache] LRU timer error:', err.message));
      // Also check size limit opportunistically
      if (this.currentSize > this.maxSize) {
        this.enforceSizeLimit().catch(err => console.error('[DiskCache] Size enforcement error:', err.message));
      }
    }, this.lruIntervalMs);
    // Allow process to exit even if timer is active
    if (this._lruTimer && this._lruTimer.unref) {
      this._lruTimer.unref();
    }
  }

  _formatSize(bytes) {
    if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + ' GB';
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(2) + ' MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return bytes + ' B';
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────

  /**
   * Close the cache: save manifest, stop LRU timer.
   */
  async close() {
    if (this._lruTimer) {
      clearInterval(this._lruTimer);
      this._lruTimer = null;
    }
    if (this._saveTimeout) {
      clearTimeout(this._saveTimeout);
      this._saveTimeout = null;
    }
    // Flush pending save
    if (this._dirty) {
      await this.saveManifest();
    }
    this.initialized = false;
    console.log('[DiskCache] Closed');
  }

  /**
   * Register the image-cache:// custom protocol in the main process.
   * Must be called after app.whenReady().
   */
  registerProtocol() {
    if (this._protocolRegistered) return;
    if (!protocol) {
      console.warn('[DiskCache] protocol module not available');
      return;
    }

    // Resolve a request URL → { cacheKey, filePath }. The key is returned too so the
    // handler can purge a stale manifest entry when the file turns out to be missing.
    const resolveKeyAndPath = (requestUrl) => {
      // Canonical URL format: image-cache://img/<encodedCacheKey>
      // The fixed "img" authority keeps the key in the path — without it, a
      // `standard` scheme parses image-cache:///<key> by pulling the (slash-free)
      // key into the HOST, leaving an empty path → 404 (blank hero / Quick Access).
      const url = new URL(requestUrl);
      // Primary: key lives in the path.
      let cacheKey = decodeURIComponent(url.pathname.replace(/^\/+/, '').replace(/\/+$/, ''));
      // Legacy/fallback: older image-cache:///<key> URLs land the key in the host.
      if (!cacheKey && url.host && url.host !== 'img') {
        cacheKey = decodeURIComponent(url.host);
      }
      if (!cacheKey) return null;
      const filePath = this.getFilePathForKey(cacheKey);
      return filePath ? { cacheKey, filePath } : null;
    };

    // Legacy handler style still wants just the path.
    const resolvePath = (requestUrl) => {
      const r = resolveKeyAndPath(requestUrl);
      return r ? r.filePath : null;
    };

    // ── Modern API (Electron 25+): protocol.handle returns a streamed Response ──
    // The legacy protocol.registerFileProtocol is deprecated and does NOT serve
    // privileged `standard` schemes in Electron 33 — <img>/fetch silently fail
    // ("Failed to fetch"), which blanked the hero banner and Quick Access covers.
    if (typeof protocol.handle === 'function') {
      protocol.handle(PROTOCOL_NAME, async (request) => {
        try {
          // A request can land before init() has finished loading the manifest —
          // the window is created before the cache is ready. Wait rather than miss.
          if (!this.initialized) {
            try { await this.init(); } catch (e) {
              console.error('[DiskCache] init failed while serving request:', e.message);
              return new Response(null, { status: 503 });
            }
          }
          const resolved = resolveKeyAndPath(request.url);
          if (!resolved) return new Response(null, { status: 404 });
          const { cacheKey, filePath } = resolved;
          // net.fetch streams the file with the correct content-type by extension
          // and properly encodes paths containing spaces/commas (pathToFileURL).
          const res = await net.fetch(pathToFileURL(filePath).toString());
          if (!res.ok) {
            // The manifest claims this cover is cached but the file is gone (AV
            // quarantine, disk cleanup, partial copy). Purge the entry so the next
            // request is a clean miss and re-downloads — otherwise the stale entry
            // makes has() keep saying "cached" and the cover is a placeholder letter
            // forever. Only runs on the miss path, so the hot path stays stat-free.
            console.warn('[DiskCache] Cached file missing, purging entry:', cacheKey);
            this._deleteEntry(cacheKey);
            this._scheduleSave();
          }
          return res;
        } catch (err) {
          console.error('[DiskCache] Protocol handler error:', err.message);
          return new Response(null, { status: 500 });
        }
      });
      this._protocolRegistered = true;
      console.log('[DiskCache] Registered image-cache:// protocol (protocol.handle)');
      return;
    }

    // ── Legacy fallback (older Electron) ──
    protocol.registerFileProtocol(PROTOCOL_NAME, (request, callback) => {
      try {
        const filePath = resolvePath(request.url);
        if (filePath) callback({ path: filePath });
        else callback({ error: -6 }); // net::ERR_FILE_NOT_FOUND
      } catch (err) {
        console.error('[DiskCache] Protocol handler error:', err.message);
        callback({ error: -2 }); // net::FAILED
      }
    });

    this._protocolRegistered = true;
    console.log('[DiskCache] Registered image-cache:// protocol (registerFileProtocol)');
  }

  /**
   * Get cache stats for diagnostics.
   */
  getStats() {
    return {
      entryCount: this.manifest.size,
      currentSize: this.currentSize,
      currentSizeFormatted: this._formatSize(this.currentSize),
      maxSize: this.maxSize,
      maxSizeFormatted: this._formatSize(this.maxSize),
      usagePercent: this.maxSize > 0 ? ((this.currentSize / this.maxSize) * 100).toFixed(1) + '%' : '0%',
      cacheDir: this.cacheDir,
      shardCount: this.shardCount,
      ttlMs: this.ttlMs,
      initialized: this.initialized,
      protocolRegistered: this._protocolRegistered,
    };
  }
}

module.exports = { DiskCacheManager };
