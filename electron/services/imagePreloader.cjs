// ── Game Cover Image Preloader ────────────────────────────────────────
// Background batch-download + WebP conversion + disk cache seeding.
//
// Runs after the renderer loads the game database.  Downloads cover
// images from Steam CDN in the main process, converts to WebP via
// sharp, and stores in the disk cache (DiskCacheManager).
//
// Scope: warms ONLY the priority appids passed in (e.g. the user's installed games).
// It deliberately does NOT bulk-preload the full ~176k catalogue — that floods the
// CDN and starves on-screen cover fetches. Visible covers load on demand via
// GameCover (+ useDirectionalCoverPrefetch), which cache to disk. See MAX_QUEUE.
//
// Progress is emitted as IPC events to the renderer so the UI can show
// a preloader status indicator.
//
// ── API ──────────────────────────────────────────────────────────────
//   start(priorityAppids)   — begin preloading, priority batch first
//   pause()                 — suspend processing (current fetch finishes)
//   resume()                — continue from where paused
//   cancel()                — abort all, clear queue
//   status()                — { running, paused, processed, total, failed }
// ---------------------------------------------------------------------

const https = require('https');
const http = require('http');

const nativeImage = require('../../native');

// ---- configurable constants ----

const CONCURRENCY = 4;             // simultaneous CDN fetches
// Hard cap on total queued downloads — a backstop so the preloader can NEVER flood
// the CDN with the full ~176k catalogue (which rate-limits Steam and starves the
// renderer's on-screen cover fetches). The preloader only warms the priority set;
// visible covers load on demand via GameCover + directional prefetch.
const MAX_QUEUE = 3000;
const RETRY_COUNT = 2;             // per-URL retries before giving up
const FETCH_TIMEOUT_MS = 15_000;   // per-fetch timeout
const PROGRESS_INTERVAL_MS = 500;  // throttle progress events

const CDN_HOSTS = [
  'shared.akamai.steamstatic.com',
  'cdn.cloudflare.steamstatic.com',
  'cdn.akamai.steamstatic.com',
];

const FILE_TYPES = ['header.jpg', 'portrait.jpg', 'library_600x900.jpg'];

// ---- helpers ----------------------------------------------------------

/** Minimal fetch() polyfill using Node http/https (no external deps). */
function fetchBuffer(url, timeoutMs = FETCH_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https');
    const mod = isHttps ? https : http;
    const req = mod.get(url, { timeout: timeoutMs }, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        res.resume(); // drain
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

/** Attempt to download a single appid+fileType from all CDN hosts in parallel (first wins). */
async function tryDownload(appid, fileType, retries = RETRY_COUNT) {
  const paths = [
    `/steam/apps/${appid}/${fileType}`,
    `/store_item_assets/steam/apps/${appid}/${fileType}`,
  ];

  for (let attempt = 0; attempt <= retries; attempt++) {
    const urls = [];
    for (const host of CDN_HOSTS) {
      for (const p of paths) {
        urls.push(`https://${host}${p}`);
      }
    }

    // Shuffle CDN order for better distribution
    for (let i = urls.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [urls[i], urls[j]] = [urls[j], urls[i]];
    }

    try {
      const result = await Promise.any(urls.map((u) => fetchBuffer(u)));
      if (result && result.length >= 500) return result;
    } catch {
      // all failed — retry
    }
  }
  return null;
}

// ---- Preloader class -------------------------------------------------

class ImagePreloader {
  constructor() {
    /** @type {'idle'|'running'|'paused'} */
    this.state = 'idle';
    this.processed = 0;
    this.failed = 0;
    this.skipped = 0; // already cached
    this.total = 0;
    this._queue = [];            // flattened [appid, fileType] pairs
    this._activeCount = 0;
    this._workersDone = 0;
    this._cancelled = false;
    this._progressTimer = null;
    this._lastProgress = 0;
    this._currentAppid = '';
    this._resolveDone = null;
    this._donePromise = null;
  }

  // ── Public API ─────────────────────────────────────────────────────

  /**
   * Start preloading.
   * @param {string[]}   [priorityAppids]  App IDs to process first (e.g. user library).
   * @param {object}     [options]
   * @param {string[]}   [options.fileTypes]         Image types to fetch (default: header, portrait, 600x900).
   * @param {number}     [options.batchSize]         Batch size sent per progress (default: 50).
   */
  start(priorityAppids = [], options = {}) {
    if (this.state === 'running') return;
    this.state = 'running';
    this._cancelled = false;
    this.processed = 0;
    this.failed = 0;
    this.skipped = 0;
    this._activeCount = 0;
    this._currentAppid = '';

    const fileTypes = options.fileTypes || FILE_TYPES;

    // Build queue: [appid, fileType][] tuples
    const seen = new Set();
    this._queue = [];

    // Tier 1: priority appids (multiple file types each)
    for (const appid of priorityAppids || []) {
      const a = String(appid);
      if (seen.has(a)) continue;
      seen.add(a);
      for (const ft of fileTypes) {
        this._queue.push([a, ft]);
      }
    }

    // NO Tier 2 "preload the whole catalogue" pass.
    //
    // CRITICAL: the catalogue is ~176k games. Queuing all of them × FILE_TYPES is
    // >500k CDN downloads at CONCURRENCY=4 in the main process — it saturates the
    // network and trips Steam-CDN rate-limiting (HTTP 429), which then STARVES the
    // renderer's own on-screen cover fetches and makes the grid render slowly.
    // (This previously read globalThis._gamesCache, which was never assigned, so it
    // was a silent no-op; "fixing" it to db.getAllGames() caused the slow-render
    // regression.) On-screen covers are fetched on demand by GameCover (eager +
    // IntersectionObserver) and warmed just-ahead by useDirectionalCoverPrefetch,
    // both of which cache to disk — so a bulk pre-warm of the full catalogue is
    // unnecessary AND harmful. The preloader only warms the priority set (Tier 1,
    // e.g. the user's installed games).

    // Safety cap: the queue must never explode regardless of caller input.
    if (this._queue.length > MAX_QUEUE) {
      console.warn(`[Preloader] Queue capped from ${this._queue.length} to ${MAX_QUEUE}`);
      this._queue.length = MAX_QUEUE;
    }

    this.total = this._queue.length;
    console.log(`[Preloader] Queue built: ${this.total} items (${priorityAppids?.length || 0} priority)`);

    if (this.total === 0) {
      this.state = 'idle';
      this._emitProgress();
      this._emitComplete();
      return { processed: 0, failed: 0, skipped: 0, cancelled: false };
    }

    // Start progress emitter
    this._startProgressTimer();

    // Start worker pool
    this._donePromise = new Promise((resolve) => { this._resolveDone = resolve; });
    for (let i = 0; i < CONCURRENCY; i++) {
      this._worker();
    }

    return this._donePromise;
  }

  pause() {
    if (this.state !== 'running') return;
    this.state = 'paused';
    console.log(`[Preloader] Paused at ${this.processed}/${this.total}`);
    this._emitEvent('preloader:paused', { processed: this.processed, total: this.total });
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'running';
    console.log(`[Preloader] Resumed`);
    this._emitEvent('preloader:resumed', { processed: this.processed, total: this.total });
    // Workers will naturally pick up when state flips to running
  }

  cancel() {
    this._cancelled = true;
    this._queue = [];
    this.state = 'idle';
    this._stopProgressTimer();
    console.log(`[Preloader] Cancelled after ${this.processed} processed`);
    this._emitEvent('preloader:cancelled', { processed: this.processed, total: this.total });
    if (this._resolveDone) {
      this._resolveDone({ processed: this.processed, failed: this.failed, skipped: this.skipped, cancelled: true });
    }
  }

  status() {
    return {
      running: this.state === 'running',
      paused: this.state === 'paused',
      idle: this.state === 'idle',
      processed: this.processed,
      failed: this.failed,
      skipped: this.skipped,
      total: this.total,
      remaining: this._queue.length,
      currentAppid: this._currentAppid,
    };
  }

  // ── Internal ───────────────────────────────────────────────────────

  async _worker() {
    while (!this._cancelled) {
      if (this.state === 'paused') {
        await sleep(200);
        continue;
      }

      const item = this._dequeue();
      if (!item) break; // queue empty

      const [appid, fileType] = item;
      this._currentAppid = appid;

      try {
        await this._processOne(appid, fileType);
      } catch (err) {
        console.error(`[Preloader] Error ${appid}/${fileType}:`, err.message);
        this.failed++;
      }

      this.processed++;
      this._maybeEmitProgress();
    }

    // Track completed workers — fire _finish when ALL workers have exited
    this._workersDone++;
    if (this._workersDone >= CONCURRENCY && !this._cancelled) {
      this.state = 'idle';
      this._stopProgressTimer();
      this._emitProgress();
      this._emitComplete();
      if (this._resolveDone) {
        this._resolveDone({ processed: this.processed, failed: this.failed, skipped: this.skipped, cancelled: false });
      }
    }
  }

  _dequeue() {
    if (this._queue.length === 0) return undefined;
    this._activeCount++;
    return this._queue.shift();
  }

  async _processOne(appid, fileType) {
    const cache = globalThis._imageDiskCache;
    if (!cache) return;

    // Use preferredImageTypes matching the renderer's convention
    const preferredTypes = [fileType];

    // Check if already cached
    const exists = await cache.has(appid, preferredTypes);
    if (exists) {
      this.skipped++;
      return;
    }

    // Download
    const rawBuffer = await tryDownload(appid, fileType);
    if (!rawBuffer) {
      this.failed++;
      return;
    }

    // Convert to WebP via native addon (or sharp fallback if addon not compiled)
    let webpBuffer;
    let lqipData;
    try {
      let decoded;
      // Try WebP decode first, fall back to JPEG
      try {
        decoded = await nativeImage.decodeWebP(rawBuffer);
      } catch (webpErr) {
        try {
          decoded = await nativeImage.decodeJPEG(rawBuffer);
        } catch (jpegErr) {
          throw new Error('Both WebP and JPEG decode failed');
        }
      }
      webpBuffer = await nativeImage.encodeWebP(decoded.data, decoded.width, decoded.height, 85);
      lqipData = await nativeImage.generateLQIP(decoded.data, decoded.width, decoded.height, 20);
    } catch (convErr) {
      console.warn('[Preloader] Native convert failed for ' + appid + '/' + fileType + ':', convErr.message);
      // Fallback: store raw as webp (browser will decode it)
      webpBuffer = rawBuffer;
    }

    // Store in disk cache
    await cache.set(appid, preferredTypes, webpBuffer, 'image/webp', lqipData || undefined);
  }

  _startProgressTimer() {
    this._stopProgressTimer();
    this._lastProgress = Date.now();
    this._progressTimer = setInterval(() => this._emitProgress(), PROGRESS_INTERVAL_MS);
    if (this._progressTimer && this._progressTimer.unref) {
      this._progressTimer.unref();
    }
  }

  _stopProgressTimer() {
    if (this._progressTimer) {
      clearInterval(this._progressTimer);
      this._progressTimer = null;
    }
  }

  _maybeEmitProgress() {
    const now = Date.now();
    if (now - this._lastProgress > PROGRESS_INTERVAL_MS) {
      this._emitProgress();
      this._lastProgress = now;
    }
  }

  _emitProgress() {
    const percent = this.total > 0 ? Math.round((this.processed / this.total) * 100) : 0;
    this._emitEvent('preloader:progress', {
      processed: this.processed,
      failed: this.failed,
      skipped: this.skipped,
      total: this.total,
      percent: Math.min(percent, 100),
      currentAppid: this._currentAppid,
      status: this.total > 0 ? `Caching ${this.processed}/${this.total}` : 'Initializing',
    });
  }

  _emitComplete() {
    this._emitEvent('preloader:complete', {
      processed: this.processed,
      failed: this.failed,
      skipped: this.skipped,
      total: this.total,
    });
    console.log(`[Preloader] Complete: ${this.processed} processed, ${this.failed} failed, ${this.skipped} cached`);
  }

  _emitEvent(channel, data) {
    try {
      const { BrowserWindow } = require('electron');
      const wins = BrowserWindow.getAllWindows();
      for (const win of wins) {
        if (!win.isDestroyed()) {
          win.webContents.send(channel, data);
        }
      }
    } catch {
      // ignore (electron may not be ready)
    }
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Singleton ─────────────────────────────────────────────────────────

const preloader = new ImagePreloader();

module.exports = { ImagePreloader, preloader };
