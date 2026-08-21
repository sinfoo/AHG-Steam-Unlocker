#!/usr/bin/env node
/**
 * sync-main.js
 *
 * Synchronizes electron/main.cjs → dist-electron/main.cjs and
 * electron/preload.cjs → dist-electron/preload.cjs.
 *
 * Usage:
 *   node scripts/sync-main.js          # one-shot copy
 *   node scripts/sync-main.js --watch  # poll every 1s and copy on change
 *
 * Uses only Node.js built-ins — no external dependencies.
 */

const path = require('path');
const fs = require('fs');

const PROJECT_ROOT = path.resolve(__dirname, '..');

const FILE_PAIRS = [
  {
    src: path.join(PROJECT_ROOT, 'electron', 'main.cjs'),
    dest: path.join(PROJECT_ROOT, 'dist-electron', 'main.cjs'),
    label: 'electron/main.cjs → dist-electron/main.cjs',
  },
  {
    src: path.join(PROJECT_ROOT, 'electron', 'preload.cjs'),
    dest: path.join(PROJECT_ROOT, 'dist-electron', 'preload.cjs'),
    label: 'electron/preload.cjs → dist-electron/preload.cjs',
  },
];

/**
 * Perform a single sync pass: copy each source to its destination.
 * Returns the number of files successfully copied.
 */
function syncAll() {
  let copied = 0;

  for (const { src, dest, label } of FILE_PAIRS) {
    try {
      if (!fs.existsSync(src)) {
        console.error(`[sync-main] SKIP — source not found: ${src}`);
        continue;
      }
      fs.copyFileSync(src, dest);
      console.log(`[sync-main] OK   ${label}`);
      copied++;
    } catch (err) {
      console.error(`[sync-main] FAIL ${label} — ${err.message}`);
    }
  }

  return copied;
}

/**
 * Watch mode — poll each source file every 1000 ms and re-copy on change.
 * Prints a banner and the initial sync status, then watches forever.
 */
function startWatch() {
  const WATCH_INTERVAL_MS = 1000;

  console.log('[sync-main] Watch mode enabled (polling every 1s). Press Ctrl+C to stop.');
  console.log('');

  // Do an initial sync so files are up to date before watching.
  const initial = syncAll();
  console.log(`[sync-main] Initial sync: ${initial} / ${FILE_PAIRS.length} file(s) copied.`);
  console.log('');

  for (const { src, dest, label } of FILE_PAIRS) {
    if (!fs.existsSync(src)) {
      console.error(`[sync-main] SKIP watch — source not found: ${src}`);
      continue;
    }

    fs.watchFile(src, { interval: WATCH_INTERVAL_MS }, (curr, prev) => {
      // Only act if the file was actually modified (mtime changed).
      if (curr.mtimeMs === prev.mtimeMs) return;

      try {
        fs.copyFileSync(src, dest);
        console.log(`[sync-main] SYNC  ${label}  (mtime: ${new Date(curr.mtimeMs).toISOString()})`);
      } catch (err) {
        console.error(`[sync-main] FAIL  ${label} — ${err.message}`);
      }
    });
  }
}

// ─── CLI entry point ──────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const isWatch = args.includes('--watch');

if (isWatch) {
  startWatch();
} else {
  const count = syncAll();
  process.exit(count > 0 ? 0 : 1);
}
