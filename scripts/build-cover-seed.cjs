#!/usr/bin/env node
// ── Pre-warmed cover-seed builder ──
// Generates a read-only image-cache "seed" of popular game covers in the EXACT
// DiskCacheManager on-disk format (electron/services/imageDiskCache.cjs):
//   resources/cover-seed/<shard>/<appid>_header.jpg.webp  +  manifest.json
// It is shipped via package.json `extraResources` and imported into the runtime
// cache on first launch (DiskCacheManager._seedIfEmpty), so popular covers render
// INSTANTLY even on a cold cache.
//
// Source of truth for URLs: games.db `header_image` (the hashed store_item_assets
// URL — the plain /steam/apps/<id>/header.jpg path 404s now).
//
// Usage:  node scripts/build-cover-seed.cjs [count]
//   count — optional cap on number of popular appids (default: all of popular_ids.json)

const fs = require('fs');
const path = require('path');
const https = require('https');
const sharp = require('sharp');
const initSqlJs = require('../node_modules/sql.js');

const ROOT = path.join(__dirname, '..');
const SHARD_COUNT = 1000;            // must match DiskCacheManager DEFAULT_SHARD_COUNT
const OUT_DIR = path.join(ROOT, 'resources', 'cover-seed');
const CONCURRENCY = 12;
const COUNT = process.argv[2] ? parseInt(process.argv[2], 10) : Infinity;
const WEBP_QUALITY = 82;

const shardName = (appid) => { const n = parseInt(appid, 10); return String(isNaN(n) ? 0 : n % SHARD_COUNT).padStart(4, '0'); };
const cacheKey = (appid) => `${appid}_header.jpg`; // matches _cacheKey(appid, ['header.jpg'])

function fetchBuf(url) {
  return new Promise((res, rej) => {
    https.get(url, { headers: { 'User-Agent': 'AHG/9.4' }, timeout: 15000 }, (r) => {
      if (r.statusCode !== 200) { r.resume(); return rej(new Error('HTTP ' + r.statusCode)); }
      const c = []; r.on('data', d => c.push(d)); r.on('end', () => res(Buffer.concat(c)));
    }).on('error', rej).on('timeout', function () { this.destroy(); rej(new Error('timeout')); });
  });
}

(async () => {
  const popular = require(path.join(ROOT, 'data', 'popular_ids.json')).map(String);
  const ids = [...new Set(popular)].slice(0, COUNT);
  console.log(`[seed] building cover-seed for ${ids.length} popular appids → ${OUT_DIR}`);

  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(path.join(ROOT, 'games.db')));
  const headerOf = new Map();
  const stmt = db.prepare('SELECT header_image FROM games WHERE appid = $a');
  for (const id of ids) {
    stmt.bind({ $a: id });
    if (stmt.step()) { const row = stmt.getAsObject(); if (row.header_image) headerOf.set(id, row.header_image); }
    stmt.reset();
  }
  stmt.free();

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const manifest = {};
  let totalSize = 0, ok = 0, skipped = 0, failed = 0, processed = 0;
  const now = Date.now();

  async function processOne(appid) {
    const url = headerOf.get(appid);
    const key = cacheKey(appid);
    const shard = shardName(appid);
    const shardDir = path.join(OUT_DIR, shard);
    const filePath = path.join(shardDir, key + '.webp');
    try {
      let buf;
      if (fs.existsSync(filePath)) { buf = fs.readFileSync(filePath); skipped++; }      // resumable
      else if (!url) { failed++; return; }
      else {
        const jpg = await fetchBuf(url);
        buf = await sharp(jpg).webp({ quality: WEBP_QUALITY }).toBuffer();
        fs.mkdirSync(shardDir, { recursive: true });
        fs.writeFileSync(filePath, buf);
        ok++;
      }
      manifest[key] = { shard, mimeType: 'image/webp', fileSize: buf.length, lastAccessed: now, cachedAt: now };
      totalSize += buf.length;
    } catch { failed++; }
    finally { if (++processed % 100 === 0) console.log(`  ${processed}/${ids.length} (new ${ok}, skip ${skipped}, fail ${failed})`); }
  }

  let idx = 0;
  const worker = async () => { while (idx < ids.length) { await processOne(ids[idx++]); } };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify({ entries: manifest, totalSize, updatedAt: now }));
  console.log(`[seed] DONE: ${Object.keys(manifest).length} covers | ${(totalSize / 1024 / 1024).toFixed(1)} MB | new ${ok}, skip ${skipped}, fail ${failed}`);
  process.exit(0);
})().catch(e => { console.error('[seed] fatal:', e.message); process.exit(1); });
