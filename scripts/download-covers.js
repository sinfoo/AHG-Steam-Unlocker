#!/usr/bin/env node
/**
 * download-covers.js
 *
 * Build-time Steam CDN image downloader for AHG Unlocker.
 *
 * Reads all appids from games.db, downloads header.jpg from Steam CDN,
 * saves to resources/images/{appid}/header.jpg, and produces a manifest.
 *
 * Features:
 *  - Resumable: skips already-downloaded files (checks size > 500 bytes)
 *  - 5 concurrent downloads with 200ms stagger between batches
 *  - 3 retries per appid with exponential backoff (1s → 3s → 9s)
 *  - Atomic file writes via .tmp + rename to prevent partial files
 *  - Validates minimum file size (500 bytes) to reject CDN error pages
 *  - Progress logging every 1000 images
 *  - Generates resources/images/manifest.json on completion
 *
 * Usage:  node scripts/download-covers.js
 *
 * Pass --force to re-download all images (ignores existing files).
 * Pass --concurrency N to set download concurrency (default: 5).
 */

const path = require('path');
const fs = require('fs');
const https = require('https');
const initSqlJs = require('sql.js');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const IMAGES_DIR = path.join(PROJECT_ROOT, 'resources', 'images');
const MANIFEST_PATH = path.join(IMAGES_DIR, 'manifest.json');
const DB_PATH = path.join(PROJECT_ROOT, 'games.db');

const SUFFIX = 'header.jpg';

// Steam CDN hosts in priority order
const CDN_HOSTS = [
  'shared.akamai.steamstatic.com',
  'cdn.cloudflare.steamstatic.com',
  'cdn.akamai.steamstatic.com',
  'steamcdn-a.akamaihd.net',
  'i.steamstatic.com',
  'cdn.steamstatic.com',
  'steamstatic-a.akamaihd.net',
  'media.steampowered.com',
];

const CDN_PATHS = [
  '/store_item_assets/steam/apps',
  '/steam/apps',
];

// ─── CLI args ────────────────────────────────────────────────────────────────

const FORCE = process.argv.includes('--force');
const CONCURRENCY = (() => {
  const idx = process.argv.indexOf('--concurrency');
  if (idx !== -1 && idx + 1 < process.argv.length) {
    const n = parseInt(process.argv[idx + 1], 10);
    if (!isNaN(n) && n > 0 && n <= 20) return n;
  }
  return 5;
})();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function log(...args) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] [covers]`, ...args);
}

function getImageUrl(appid, host, cdnPath) {
  return `https://${host}${cdnPath}/${appid}/${SUFFIX}`;
}

/**
 * Download a single URL into a Buffer with a timeout.
 * Returns { buffer, url } or null on failure.
 */
function downloadUrl(url, timeoutMs = 15000) {
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
        // Handle relative redirects
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
 * Try to download header.jpg for an appid from all CDN hosts + paths.
 * Returns { buffer, url } or null.
 */
async function downloadImage(appid) {
  for (const host of CDN_HOSTS) {
    for (const cdnPath of CDN_PATHS) {
      const url = getImageUrl(appid, host, cdnPath);
      const result = await downloadUrl(url);
      if (result) return result;
    }
  }
  return null;
}

/**
 * Download an appid's image with retries.
 */
async function downloadWithRetry(appid, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const result = await downloadImage(appid);
    if (result) return result;
    if (attempt < retries) {
      const delay = Math.pow(3, attempt - 1) * 1000; // 1s, 3s, 9s
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

function appidImagePath(appid) {
  return path.join(IMAGES_DIR, String(appid), SUFFIX);
}

function isImageDownloaded(appid) {
  const imgPath = appidImagePath(appid);
  try {
    const stat = fs.statSync(imgPath);
    return stat.size > 500;
  } catch {
    return false;
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
  ensureDir(IMAGES_DIR);
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8');
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  log(`Starting download-covers`);
  log(`  Concurrency: ${CONCURRENCY}`);
  log(`  Force re-download: ${FORCE}`);
  log(`  Image dir: ${IMAGES_DIR}`);

  // ── Step 1: Load appids from games.db ────────────────────────────────
  if (!fs.existsSync(DB_PATH)) {
    console.error('[covers] ERROR: games.db not found at', DB_PATH);
    console.error('[covers] Run node scripts/convert-to-sqlite.js first');
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

  // ── Step 2: Determine which images need downloading ──────────────────
  let toDownload;
  if (FORCE) {
    toDownload = [...appids];
  } else {
    toDownload = appids.filter((aid) => !isImageDownloaded(aid));
  }

  const skipped = appids.length - toDownload.length;
  if (skipped > 0) log(`Skipping ${skipped} already-downloaded images`);

  if (toDownload.length === 0) {
    log('All images already downloaded. Nothing to do.');
    // Still regenerate manifest to ensure it's up to date
    const manifest = loadExistingManifest();
    saveManifest(manifest);
    log(`Manifest has ${Object.keys(manifest).length} entries`);
    return;
  }

  log(`Need to download ${toDownload.length} images`);

  // ── Step 3: Download with concurrency ────────────────────────────────
  let completed = 0;
  let successes = 0;
  let failures = 0;
  let bytesTotal = 0;
  const startTime = Date.now();

  // Load existing manifest to preserve previously downloaded entries
  const manifest = loadExistingManifest();

  async function processAppid(appid) {
    const result = await downloadWithRetry(appid);
    if (result) {
      const imgPath = appidImagePath(appid);
      writeAtomic(imgPath, result.buffer);
      manifest[appid] = { header: true };
      successes++;
      bytesTotal += result.buffer.length;
    } else {
      failures++;
    }
    completed++;

    if (completed % 1000 === 0 || completed === toDownload.length) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const rate = (completed / (parseFloat(elapsed) || 1)).toFixed(1);
      log(
        `Progress: ${completed}/${toDownload.length} ` +
        `(+${successes}, -${failures}) ` +
        `${rate}/s | ${(bytesTotal / 1024 / 1024).toFixed(1)} MB downloaded ` +
        `[${elapsed}s elapsed]`
      );

      // Periodic manifest save for resume safety
      saveManifest(manifest);
    }
  }

  // Launch in waves of CONCURRENCY
  let index = 0;
  async function next() {
    if (index >= toDownload.length) return;
    const appid = toDownload[index++];
    await processAppid(appid);
    await next(); // chain: next takes the slot immediately
  }

  // Fire CONCURRENCY parallel chains with stagger
  const workers = [];
  for (let i = 0; i < CONCURRENCY; i++) {
    workers.push(
      new Promise((resolve) => {
        setTimeout(() => resolve(next()), i * 200); // 200ms stagger
      })
    );
  }
  await Promise.all(workers);

  // ── Step 4: Final manifest save ──────────────────────────────────────
  saveManifest(manifest);

  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  log(`DONE in ${totalElapsed}s`);
  log(`  Attempted: ${toDownload.length}`);
  log(`  Success:   ${successes}`);
  log(`  Failed:    ${failures}`);
  log(`  Skipped:   ${skipped}`);
  log(`  Total:     ${(bytesTotal / 1024 / 1024).toFixed(1)} MB downloaded`);
  log(`  Manifest:  ${Object.keys(manifest).length} entries`);
  log(`  Path:      ${IMAGES_DIR}`);

  if (failures > 0) {
    log(`NOTE: ${failures} images failed. Run again to retry (will skip successes).`);
  }
}

main().catch((err) => {
  console.error('[covers] FATAL:', err);
  process.exit(1);
});
