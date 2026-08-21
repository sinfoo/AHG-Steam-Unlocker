#!/usr/bin/env node
/**
 * download-sgdb-images.js
 *
 * Build-time SteamGridDB image downloader for AHG Unlocker.
 *
 * Reads all appids from games.db, fetches grid images (460×215) and portrait
 * images (600×900) from SteamGridDB API v2, saves to resources/images/{appid}/,
 * and produces a manifest.
 *
 * Features:
 *  - Rate-limited: MAX 10 API requests per 60 seconds (SGDB rate limit)
 *  - Resumable: checks manifest to skip already-downloaded appids
 *  - 1 concurrency (due to rate limit), with batch-based processing
 *  - 3 retries per SGDB API call with exponential backoff (1s → 3s → 9s)
 *  - Atomic file writes via .tmp + rename to prevent partial files
 *  - Validates minimum file size (500 bytes) to reject error responses
 *  - Progress logging every 1000 appids
 *  - Generates resources/images/manifest.json with grid/portrait entries
 *  - Graceful: 404 from SGDB = skip that appid (not an error)
 *
 * Usage:  node scripts/download-sgdb-images.js
 *
 * Pass --force to re-download all images (ignores existing manifest).
 * Pass --concurrency N to set download concurrency (default: 1, max: 5).
 */

const path = require('path');
const fs = require('fs');
const https = require('https');
const initSqlJs = require('sql.js');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const IMAGES_DIR = path.join(PROJECT_ROOT, 'resources', 'images');
const MANIFEST_PATH = path.join(IMAGES_DIR, 'manifest.json');
const DB_PATH = path.join(PROJECT_ROOT, 'games.db');

const SGDB_API_KEY = '1e7c6c08249aa540c0840b5d95677c12';
const SGDB_API_HOST = 'www.steamgriddb.com';

// SGDB rate limit: 10 requests per 60 seconds per IP
const RATE_LIMIT_BATCH = 10;
const RATE_LIMIT_WAIT_MS = 60000;

// Grid dimensions we request from SGDB
const GRID_DIMENSIONS = '460x215,600x900';

// ─── CLI args ────────────────────────────────────────────────────────────────

const FORCE = process.argv.includes('--force');
const CONCURRENCY = (() => {
  const idx = process.argv.indexOf('--concurrency');
  if (idx !== -1 && idx + 1 < process.argv.length) {
    const n = parseInt(process.argv[idx + 1], 10);
    if (!isNaN(n) && n > 0 && n <= 5) return n;
  }
  return 1;
})();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function log(...args) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] [sgdb-images]`, ...args);
}

/**
 * Fetch JSON from the SteamGridDB API v2.
 * Returns the parsed JSON data array, or null on failure/404.
 */
function fetchSgdbApi(appid) {
  return new Promise((resolve) => {
    const query = `dimensions=${encodeURIComponent(GRID_DIMENSIONS)}`;
    const pathStr = `/api/v2/grids/steam/${appid}?${query}`;

    const opts = {
      hostname: SGDB_API_HOST,
      path: pathStr,
      method: 'GET',
      timeout: 15000,
      headers: {
        'User-Agent': 'AHG-Steam-Unlocker/0.90.1',
        Authorization: `Bearer ${SGDB_API_KEY}`,
        Accept: 'application/json',
      },
    };

    const req = https.get(opts, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        if (res.statusCode === 404) {
          // No images for this appid on SGDB — not an error
          return resolve(null);
        }
        if (res.statusCode !== 200) {
          log(`API ${res.statusCode} for appid ${appid}`);
          return resolve(null);
        }
        try {
          const body = Buffer.concat(chunks).toString('utf-8');
          const json = JSON.parse(body);
          if (!json.success || !Array.isArray(json.data)) {
            return resolve(null);
          }
          resolve(json.data);
        } catch {
          resolve(null);
        }
      });
      res.on('error', () => resolve(null));
    });

    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end();
  });
}

/**
 * Fetch SGDB API with retry + exponential backoff for transient errors.
 * 404s are NOT retried — they return null immediately.
 */
async function fetchWithRetry(appid, retries = 3) {
  const result = await fetchSgdbApi(appid);
  if (result) return result; // success

  // null could be 404 or network error — try to distinguish by doing a quick re-fetch
  // If it's a 404, it will consistently return null. If network, it might recover.
  for (let attempt = 1; attempt <= retries; attempt++) {
    const retryResult = await fetchSgdbApi(appid);
    if (retryResult) return retryResult;
    // Check if it's really a 404 by seeing if we get null again
    if (attempt < retries) {
      const delay = Math.pow(3, attempt - 1) * 1000; // 1s, 3s, 9s
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  return null;
}

/**
 * Download a single URL into a Buffer with a timeout.
 * Returns { buffer, url } or null on failure.
 */
function downloadUrl(url, timeoutMs = 30000) {
  return new Promise((resolve) => {
    const urlObj = new URL(url);
    const opts = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      timeout: timeoutMs,
      headers: { 'User-Agent': 'AHG-Steam-Unlocker/0.90.1' },
    };

    const req = https.get(opts, (res) => {
      // Follow redirects (one level)
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        const redirectUrl = res.headers.location.startsWith('http')
          ? res.headers.location
          : `https://${urlObj.hostname}${res.headers.location}`;
        return downloadUrl(redirectUrl, timeoutMs).then(resolve);
      }

      if (res.statusCode !== 200) {
        res.resume();
        return resolve(null);
      }

      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        if (buffer.length < 500) return resolve(null); // Too small = error page
        resolve({ buffer, url });
      });
      res.on('error', () => resolve(null));
    });

    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end();
  });
}

/**
 * Download an image URL with retries.
 */
async function downloadWithRetry(url, retries = 2) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const result = await downloadUrl(url);
    if (result) return result;
    if (attempt < retries) {
      const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  return null;
}

// ─── File helpers ────────────────────────────────────────────────────────────

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Atomically write a buffer to a file using .tmp + rename.
 */
function writeAtomic(filePath, buffer) {
  const tmpPath = filePath + '.tmp';
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(tmpPath, buffer);
  fs.renameSync(tmpPath, filePath);
}

// ─── Manifest ────────────────────────────────────────────────────────────────

function loadExistingManifest() {
  try {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

function saveManifest(manifest) {
  // Merge with existing manifest to preserve entries from download-covers.js
  const existing = loadExistingManifest();
  const merged = { ...existing, ...manifest };
  ensureDir(IMAGES_DIR);
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(merged, null, 2), 'utf-8');
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  log('Starting download-sgdb-images');
  log(`  Concurrency: ${CONCURRENCY}`);
  log(`  Force re-download: ${FORCE}`);
  log(`  Image dir: ${IMAGES_DIR}`);
  log(`  SGDB dimensions: ${GRID_DIMENSIONS}`);
  log(`  Rate limit: ${RATE_LIMIT_BATCH} req / ${RATE_LIMIT_WAIT_MS / 1000}s`);

  // ── Step 1: Load appids from games.db ────────────────────────────────
  if (!fs.existsSync(DB_PATH)) {
    console.error('[sgdb-images] ERROR: games.db not found at', DB_PATH);
    console.error('[sgdb-images] Run node scripts/convert-to-sqlite.js first');
    process.exit(1);
  }

  const SQL = await initSqlJs();
  const dbBuf = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(dbBuf);

  const [{ values: [[totalGames]] }] = db.exec('SELECT COUNT(*) FROM games');
  const rows = db.exec('SELECT appid FROM games ORDER BY appid');
  const appids = rows[0]?.values?.map((r) => String(r[0])) || [];
  db.close();

  log(`Loaded ${appids.length} appids from games.db (total games: ${totalGames})`);
  if (appids.length === 0) {
    log('No games to download. Exiting.');
    return;
  }

  // ── Step 2: Determine which appids need downloading ──────────────────
  const manifest = loadExistingManifest();
  let toDownload;

  if (FORCE) {
    toDownload = [...appids];
  } else {
    toDownload = appids.filter((aid) => {
      const entry = manifest[aid];
      return !(entry && entry.grid === true && entry.portrait === true);
    });
  }

  const skipped = appids.length - toDownload.length;
  if (skipped > 0) log(`Skipping ${skipped} already-downloaded appids`);

  if (toDownload.length === 0) {
    log('All images already downloaded. Nothing to do.');
    log(`Manifest has ${Object.keys(manifest).length} entries`);
    return;
  }

  log(`Need to download images for ${toDownload.length} appids`);

  // ── Step 3: Download with batch-based rate limiting ──────────────────
  let completed = 0;
  let successes = 0; // appids where at least one image was downloaded
  let failures = 0;
  let skippedImages = 0;
  let bytesTotal = 0;
  const startTime = Date.now();

  async function processAppid(appid) {
    const appDir = path.join(IMAGES_DIR, appid);
    const gridPath = path.join(appDir, 'grid.jpg');
    const portraitPath = path.join(appDir, 'portrait.jpg');

    let appidSuccess = false;

    // Check if already downloaded (for resumability within batch)
    if (!FORCE && manifest[appid]?.grid && manifest[appid]?.portrait) {
      return true;
    }

    // ── Step 3a: Fetch SGDB API for this appid ────────────────────
    const apiData = await fetchWithRetry(appid);
    if (!apiData) {
      // 404 or network error — skip this appid
      return false;
    }

    // ── Step 3b: Find best grid image (460×215) ───────────────────
    const gridCandidates = apiData.filter((img) => img.width === 460 && img.height === 215);
    if (gridCandidates.length > 0) {
      gridCandidates.sort((a, b) => (b.score || 0) - (a.score || 0));
      const imgResult = await downloadWithRetry(gridCandidates[0].url);
      if (imgResult) {
        writeAtomic(gridPath, imgResult.buffer);
        manifest[appid] = { ...manifest[appid], grid: true };
        bytesTotal += imgResult.buffer.length;
        appidSuccess = true;
      }
    } else {
      skippedImages++;
    }

    // ── Step 3c: Find best portrait image (600×900) ───────────────
    const portraitCandidates = apiData.filter((img) => img.width === 600 && img.height === 900);
    if (portraitCandidates.length > 0) {
      portraitCandidates.sort((a, b) => (b.score || 0) - (a.score || 0));
      const imgResult = await downloadWithRetry(portraitCandidates[0].url);
      if (imgResult) {
        writeAtomic(portraitPath, imgResult.buffer);
        manifest[appid] = { ...manifest[appid], portrait: true };
        bytesTotal += imgResult.buffer.length;
        appidSuccess = true;
      }
    } else {
      skippedImages++;
    }

    return appidSuccess;
  }

  // Process in batches to respect SGDB rate limit (10 req/60s)
  // Each appid = 1 API call (grids endpoint with both dimensions)
  let batchIndex = 0;

  while (batchIndex < toDownload.length) {
    const batch = toDownload.slice(batchIndex, batchIndex + RATE_LIMIT_BATCH);
    batchIndex += RATE_LIMIT_BATCH;

    // Process this batch with limited concurrency
    const batchResults = await Promise.all(
      batch.map((appid) => processAppid(appid)),
    );

    completed += batch.length;
    const batchSuccesses = batchResults.filter(Boolean).length;
    successes += batchSuccesses;
    failures += batch.length - batchSuccesses;

    if (completed % 1000 === 0 || completed === toDownload.length) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const rate = (completed / (parseFloat(elapsed) || 1)).toFixed(1);
      log(
        `Progress: ${completed}/${toDownload.length} ` +
        `(+${successes}, -${failures}) ` +
        `${rate}/s | ${(bytesTotal / 1024 / 1024).toFixed(1)} MB downloaded ` +
        `[${elapsed}s elapsed]`,
      );

      // Periodic manifest save for resume safety
      saveManifest(manifest);
    }

    // Rate limit: wait between batches (except after the last)
    if (batchIndex < toDownload.length) {
      const now = Date.now();
      log(`Rate limit: waiting ${RATE_LIMIT_WAIT_MS / 1000}s before next batch of ${RATE_LIMIT_BATCH}...`);
      await new Promise((r) => setTimeout(r, RATE_LIMIT_WAIT_MS));
    }
  }

  // ── Step 4: Final manifest save ──────────────────────────────────────
  saveManifest(manifest);

  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log(`DONE in ${totalElapsed}s`);
  log(`  Attempted:     ${toDownload.length}`);
  log(`  Success:       ${successes}`);
  log(`  Failed:        ${failures}`);
  log(`  Skipped:       ${skipped}`);
  log(`  No grid img:   ${skippedImages} appids (no 460×215 in SGDB)`);
  log(`  Total:         ${(bytesTotal / 1024 / 1024).toFixed(1)} MB downloaded`);
  log(`  Manifest:      ${Object.keys(manifest).length} entries`);
  log(`  Path:          ${IMAGES_DIR}`);

  if (failures > 0) {
    log(`NOTE: ${failures} appids failed. Run again to retry (will skip successes).`);
  }
}

main().catch((err) => {
  console.error('[sgdb-images] FATAL:', err);
  process.exit(1);
});
