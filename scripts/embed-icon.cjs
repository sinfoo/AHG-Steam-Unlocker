#!/usr/bin/env node
// ── Embed the app icon + version metadata into the packaged exe ──
// The rebuild uses electron-builder with `signAndEditExecutable=false` (to avoid the
// winCodeSign download that fails without admin). That flag also skips the icon/version
// edit, so the exe keeps the default Electron icon in File Explorer (the taskbar icon is
// fine — that comes from the BrowserWindow at runtime). This re-applies the icon with
// rcedit, which electron-builder already ships in its winCodeSign cache.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const EXE = path.join(ROOT, 'dev-release', 'win-unpacked', 'AHG Unlocker.exe');
const ICON = path.join(ROOT, 'AHG Unlocker Icon.ico');

function findRcedit() {
  const cache = path.join(os.homedir(), 'AppData', 'Local', 'electron-builder', 'Cache', 'winCodeSign');
  const candidates = [path.join(cache, 'rcedit-x64.exe')];
  // Also scan versioned subfolders (winCodeSign/<id>/rcedit-x64.exe)
  try {
    for (const d of fs.readdirSync(cache)) {
      const p = path.join(cache, d, 'rcedit-x64.exe');
      if (fs.existsSync(p)) candidates.push(p);
    }
  } catch { /* cache dir missing */ }
  return candidates.find(p => fs.existsSync(p)) || null;
}

function readVersion() {
  try { return require(path.join(ROOT, 'package.json')).version || '1.0.0'; } catch { return '1.0.0'; }
}

if (!fs.existsSync(EXE)) { console.error('[embed-icon] exe not found: ' + EXE); process.exit(2); }
if (!fs.existsSync(ICON)) { console.error('[embed-icon] icon not found: ' + ICON); process.exit(2); }

const rcedit = findRcedit();
if (!rcedit) {
  console.error('[embed-icon] rcedit-x64.exe not found in the electron-builder cache — skipping icon embed.');
  process.exit(0); // non-fatal: don't fail the build over a cosmetic icon
}

const version = readVersion();
try {
  execFileSync(rcedit, [
    EXE,
    '--set-icon', ICON,
    '--set-version-string', 'ProductName', 'AHG Unlocker',
    '--set-version-string', 'FileDescription', 'AHG Unlocker',
    '--set-version-string', 'CompanyName', 'AHG',
    '--set-version-string', 'LegalCopyright', 'AHG',
    '--set-file-version', version + '.0',
    '--set-product-version', version + '.0',
  ], { stdio: 'pipe' });
  console.log('[embed-icon] OK — embedded ' + path.basename(ICON) + ' + version metadata into the exe via rcedit');
} catch (e) {
  console.error('[embed-icon] rcedit failed: ' + (e.stderr ? e.stderr.toString() : e.message));
  process.exit(0); // cosmetic — never block the build
}
