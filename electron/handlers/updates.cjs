// ── Auto-update IPC handlers (GitHub releases) ──
const path = require('path');
const fs = require('fs');
const https = require('https');
const crypto = require('crypto');
const AdmZip = require('adm-zip');
const { ipcMain, app } = require('electron');
const state = require('../utils/state.cjs');

// Public, binaries-only repo: the source repo is private, so unauthenticated
// release checks against it 404.
const GITHUB_REPO = 'sinfoo/AHG-Steam-Unlocker-Releases';

// The asset found by the last check-for-updates. download-update only accepts this
// URL and verifies its sha256, so a compromised renderer can't make us stage
// arbitrary code, and a corrupted/tampered download is rejected.
let checkedAsset = null;

function countFiles(dir) {
  let count = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      count += countFiles(path.join(dir, entry.name));
    } else {
      count++;
    }
  }
  return count;
}

// ── Staged install ──
// The running exe and app.asar are LOCKED on Windows, so copying the update over
// the live install (the old approach) silently failed or half-copied. Instead the
// update is extracted to a staging dir, and on restart a detached script waits for
// the app to exit, copies the files, and relaunches the new build.

function stagingDir() {
  return path.join(app.getPath('temp'), 'ahg-update-staged');
}

// Release zips may wrap everything in a single root folder — unwrap it.
function getStagedRoot() {
  const dir = stagingDir();
  if (!fs.existsSync(dir)) return null;
  const entries = fs.readdirSync(dir);
  if (entries.length === 0) return null;
  if (entries.length === 1 && fs.statSync(path.join(dir, entries[0])).isDirectory()) {
    return path.join(dir, entries[0]);
  }
  return dir;
}

/**
 * Validate that a staged update actually looks like an install root.
 * The v1.0.0 updater crashed with ENOENT on resources\app.asar because nothing
 * ever checked the extracted layout before trying to install it — now we fail
 * early with a descriptive error instead of half-installing.
 * @returns {{ ok: boolean, root: string|null, reason?: string }}
 */
function validateStagedLayout() {
  const root = getStagedRoot();
  if (!root) {
    return { ok: false, root: null, reason: 'extracted package is empty' };
  }
  const asarPath = path.join(root, 'resources', 'app.asar');
  if (!fs.existsSync(asarPath)) {
    let found = 'nothing';
    try { found = fs.readdirSync(root).slice(0, 10).join(', ') || 'nothing'; } catch {}
    return {
      ok: false,
      root,
      reason: `resources\\app.asar missing in the update package (found: ${found}). The release asset is probably not a full app package.`,
    };
  }
  return { ok: true, root };
}

function stageUpdate(zipPath) {
  // Electron's patched fs treats paths ending in .asar as archives: writing or listing the
  // package's own resourcespp.asar fails (ENOENT chmod ...app.asar) unless asar support is off.
  const prevNoAsar = process.noAsar;
  process.noAsar = true;
  try { return stageUpdateRaw(zipPath); } finally { process.noAsar = prevNoAsar; }
}

function stageUpdateRaw(zipPath) {
  // Validate the ZIP itself before touching the staging dir
  let zip;
  try {
    zip = new AdmZip(zipPath);
    const entries = zip.getEntries();
    if (!entries || entries.length === 0) {
      throw new Error('ZIP contains no entries');
    }
  } catch (e) {
    throw new Error(`Downloaded file is not a valid update package: ${e.message}`);
  }

  const dir = stagingDir();
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  console.log('[MAIN] Extracting update ZIP to staging...');
  zip.extractAllTo(dir, true);

  const layout = validateStagedLayout();
  if (!layout.ok) {
    // Clean up the bad staging so a later retry starts fresh
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
    throw new Error(`Update package layout invalid: ${layout.reason}`);
  }
  return { filesCopied: countFiles(layout.root) };
}

// Called by the restart-app handler. Spawns a hidden cmd script that waits for this
// process to exit, robocopies the staged files onto the install dir (the release zip
// root IS the install root: exe + resources\ — NOT resources\ as the old code
// assumed), starts the new exe, and cleans up after itself.
// Setup releases: AHG-Unlocker-Setup.exe --update <install dir> waits for this process to
// exit, downloads + verifies the latest MSI, installs it into the same folder with its own
// progress window, and relaunches the app (or the old build if the install fails).
const setupPath = () => path.join(app.getPath('temp'), 'ahg-update-setup.exe');
let setupStaged = false;

// Shared wait-for-exit prelude: exact PID filter; a match row contains the image
// name, the "no tasks" INFO line doesn't. No pipe: in the detached, console-less cmd
// this runs in, `tasklist | find` hung forever on find's stdin, so the update never ran.
function waitForExitLines(next) {
  const pidFile = path.join(app.getPath('temp'), 'ahg-update-pid.txt');
  return [
    '@echo off',
    'set TRIES=0',
    ':wait',
    `tasklist /NH /FI "PID eq ${process.pid}" > "${pidFile}" 2>nul`,
    `findstr /I /C:".exe" "${pidFile}" >nul`,
    'if not errorlevel 1 (',
    '  set /a TRIES+=1',
    `  if %TRIES% GEQ 60 goto ${next}`,
    '  ping -n 2 127.0.0.1 >nul',
    '  goto wait',
    ')',
  ];
}

function applySetupOnExit() {
  const installDir = path.dirname(process.execPath);
  const { spawn } = require('child_process');
  spawn(setupPath(), ['--update', installDir], { detached: true, stdio: 'ignore' }).unref();
  console.log('[UPDATES] Setup will update', installDir);
  return true;
}

function applyStagedUpdateOnExit() {
  if (setupStaged && fs.existsSync(setupPath())) {
    if (!app.isPackaged) { console.log('[UPDATES] Dev build — skipping setup update'); return false; }
    return applySetupOnExit();
  }
  const layout = validateStagedLayout();
  if (!layout.ok) {
    console.error('[UPDATES] Refusing to apply staged update:', layout.reason);
    return false;
  }
  if (!app.isPackaged) {
    console.log('[UPDATES] Dev build — skipping staged update swap');
    return false;
  }
  const sourceRoot = layout.root;
  const installDir = path.dirname(process.execPath);
  const exePath = process.execPath;
  const logPath = path.join(app.getPath('temp'), 'ahg-update-apply.log');
  const batPath = path.join(app.getPath('temp'), 'ahg-apply-update.bat');
  const bat = [
    ...waitForExitLines('copy'),
    ':copy',
    `robocopy "${sourceRoot}" "${installDir}" /E /IS /IT /R:15 /W:1 /LOG:"${logPath}" /NFL /NDL /NP >nul`,
    // Robocopy exit codes 0–7 are success (copied/purged/extras); 8+ is failure.
    'if errorlevel 8 goto fail',
    `start "" "${exePath}"`,
    `rd /s /q "${stagingDir()}"`,
    'del "%~f0"',
    'exit',
    ':fail',
    `echo Robocopy failed with exit code %errorlevel% >> "${logPath}"`,
    // Relaunch the OLD build so the user is not left with a dead shortcut
    `start "" "${exePath}"`,
    'del "%~f0"',
  ].join('\r\n');
  fs.writeFileSync(batPath, bat);
  const { spawn } = require('child_process');
  spawn('cmd.exe', ['/c', batPath], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  console.log('[UPDATES] Staged update will be applied by', batPath);
  return true;
}

/** Pick the best downloadable asset from a GitHub release (prefer the setup exe, then .zip). */
function pickReleaseAsset(assets) {
  if (!Array.isArray(assets) || assets.length === 0) return null;
  const setup = assets.find(a => /setup\.exe$/i.test(a.name || ''));
  if (setup) return setup;
  const zips = assets.filter(a => /\.zip$/i.test(a.name || ''));
  const winZip = zips.find(a => /win|windows|portable|x64/i.test(a.name || ''));
  return winZip || zips[0] || assets[0];
}

/** Stream an HTTPS response to disk with progress events. */
let activeDownload = null; // response stream of the running update download (for cancel)

function streamToFile(res, filePath, onProgress, hash) {
  return new Promise((resolve, reject) => {
    const total = parseInt(res.headers['content-length'] || '0', 10);
    let received = 0;
    let lastSent = 0;
    activeDownload = res;
    const out = fs.createWriteStream(filePath);
    // On any error, close the write stream and delete the truncated file so a
    // dropped download doesn't leak a handle or leave a corrupt partial zip behind.
    const fail = (err) => {
      out.destroy();
      fs.rm(filePath, { force: true }, () => reject(err));
    };
    res.on('data', (chunk) => {
      received += chunk.length;
      if (hash) hash.update(chunk);
      // one IPC message per chunk flooded the renderer; ~6 updates/s is plenty for a progress bar
      const now = Date.now();
      if (total && onProgress && (now - lastSent >= 150 || received === total)) { lastSent = now; onProgress(received, total); }
    });
    res.pipe(out);
    out.on('finish', () => {
      activeDownload = null;
      if (res.destroyed && total && received < total) return fail(new Error('Download cancelled'));
      out.close(() => resolve({ received, total }));
    });
    out.on('error', fail);
    res.on('error', fail);
    res.on('close', () => { if (activeDownload === res) activeDownload = null; });
  });
}

function httpsGet(url, headers, redirectDepth = 0) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        const location = res.headers.location;
        res.resume();
        if (!location || redirectDepth >= 5) {
          reject(new Error(`Redirect loop or missing Location (HTTP ${res.statusCode})`));
          return;
        }
        resolve(httpsGet(location, headers, redirectDepth + 1));
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      resolve(res);
    });
    req.on('error', reject);
    req.setTimeout(120000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

// A staged update is only applied from restart-app, so anything still in temp at startup is
// stale (applied, failed or abandoned): ~150-230 MB per update otherwise left behind forever.
function cleanupUpdateLeftovers() {
  const tmp = app.getPath('temp');
  for (const f of ['ahg-update.zip', 'ahg-update.msi', 'ahg-update-setup.exe', 'ahg-update-staged', 'ahg-apply-update.bat', 'ahg-update-pid.txt']) {
    fs.rm(path.join(tmp, f), { recursive: true, force: true }, () => {});
  }
}

function registerUpdateHandlers() {
  cleanupUpdateLeftovers();

  ipcMain.handle('cancel-update-download', () => {
    if (!activeDownload) return { success: false };
    activeDownload.destroy(new Error('Download cancelled'));
    activeDownload = null;
    return { success: true };
  });
  // Check for new releases on GitHub
  ipcMain.handle('check-for-updates', async () => {
    console.log('[MAIN] Checking for updates from GitHub...');
    try {
      // /releases/latest skips drafts and prereleases (releases[0] could be a draft).
      const url = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
      const res = await httpsGet(url, {
        'User-Agent': 'AHG-Steam-Unlocker',
        'Accept': 'application/vnd.github.v3+json',
      });
      const chunks = [];
      for await (const chunk of res) chunks.push(chunk);
      const latest = JSON.parse(Buffer.concat(chunks).toString());
      if (!latest || !latest.tag_name) {
        return { success: false, message: 'No releases found' };
      }
      const currentVersion = (app.getVersion() || '').replace(/^v/, '');
      const normalizeVer = (v) => (v || '').replace(/^v/, '').replace(/(\.0)+$/, '');
      const latestTag = normalizeVer(latest.tag_name || '');
      const curVer = normalizeVer(currentVersion);

      const curParts = curVer.split('.').map(Number);
      const latParts = latestTag.split('.').map(Number);
      let hasUpdate = false;
      for (let i = 0; i < Math.max(curParts.length, latParts.length); i++) {
        const c = curParts[i] || 0;
        const l = latParts[i] || 0;
        if (l > c) { hasUpdate = true; break; }
        if (l < c) { hasUpdate = false; break; }
      }

      const asset = pickReleaseAsset(latest.assets);
      checkedAsset = asset ? { url: asset.browser_download_url, digest: asset.digest || null, setup: /setup\.exe$/i.test(asset.name || '') } : null;
      return {
        success: true,
        latestTag,
        hasUpdate,
        currentVersion,
        latestVersion: latestTag,
        releaseNotes: latest.body || '',
        releaseUrl: latest.html_url,
        publishedAt: latest.published_at,
        downloadUrl: asset?.browser_download_url || null,
        downloadSize: asset?.size || 0,
        assetName: asset?.name || null,
      };
    } catch (error) {
      console.error('[MAIN] Error checking updates:', error);
      return { success: false, message: error.message };
    }
  });

  // Download update ZIP from GitHub (streamed to disk — no 200+MB memory buffer)
  // One update download at a time: a second trigger (auto-check modal + manual click, or a
  // double click) used to run two streams into the same file, so the bar jumped between
  // their two percentages and the file was corrupted.
  let downloadInFlight = false;
  ipcMain.handle('download-update', async (_event, downloadUrl) => {
    if (downloadInFlight) return { success: false, message: 'An update download is already running' };
    downloadInFlight = true;
    try { return await downloadUpdate(downloadUrl); } finally { downloadInFlight = false; }
  });

  async function downloadUpdate(downloadUrl) {
    console.log('[MAIN] Downloading update from:', downloadUrl);
    try {
      if (!checkedAsset || downloadUrl !== checkedAsset.url) {
        return { success: false, message: 'Invalid download URL — check for updates first' };
      }
      const isSetup = checkedAsset.setup;
      // Always the temp dir: never write to a renderer-chosen path.
      const finalSavePath = isSetup ? setupPath() : path.join(app.getPath('temp'), 'ahg-update.zip');
      setupStaged = false;

      // Zip swap writes into the install dir: fail before a 230MB download if that can't work.
      // (Setup installs per-user via Windows Installer, so it doesn't need this.)
      if (app.isPackaged && !isSetup) {
        const probe = path.join(path.dirname(process.execPath), '.ahg-write-test');
        try { fs.writeFileSync(probe, ''); fs.unlinkSync(probe); }
        catch { return { success: false, message: 'Install folder is not writable. Move AHG Unlocker to a folder you own (e.g. Desktop) and retry.' }; }
      }
      const [algo, expected] = (checkedAsset.digest || '').split(':');
      const hash = expected ? crypto.createHash(algo) : null;
      const res = await httpsGet(downloadUrl, {
        'User-Agent': 'AHG-Steam-Unlocker',
        'Accept': 'application/octet-stream',
      });
      await streamToFile(res, finalSavePath, (received, total) => {
        if (state.mainWindow) {
          state.mainWindow.webContents.send('download-progress', {
            received,
            total,
            percent: Math.round(received * 100 / total),
          });
        }
      }, hash);
      console.log('[MAIN] Update saved to:', finalSavePath);
      if (hash) {
        if (hash.digest('hex') !== expected) {
          try { fs.unlinkSync(finalSavePath); } catch { /* best effort */ }
          return { success: false, message: 'Update download failed integrity check — please retry' };
        }
      }

      if (isSetup) {
        setupStaged = true;
        return { success: true, message: 'Update ready — restarting to install', path: finalSavePath, staged: true };
      }

      // Stage the update — actual file replacement happens on restart, when the
      // exe/asar are no longer locked. Layout is validated here so a bad package
      // fails NOW (with a clear message) instead of at install time.
      try {
        const { filesCopied } = stageUpdate(finalSavePath);
        return { success: true, message: 'Update staged — restart the app to apply it', path: finalSavePath, filesCopied, staged: true };
      } catch (extractErr) {
        console.error('[MAIN] Extraction error:', extractErr);
        return { success: false, message: 'Downloaded but could not install: ' + extractErr.message, path: finalSavePath, extracted: false };
      }
    } catch (error) {
      console.error('[MAIN] Download error:', error);
      return { success: false, message: error.message };
    }
  }

  // Install update from cached ZIP (re-extract)
  ipcMain.handle('install-update', async () => {
    console.log('[MAIN] Installing update from cached ZIP...');
    try {
      if (checkedAsset?.setup && fs.existsSync(setupPath())) {
        setupStaged = true;
        return { success: true, message: 'Update ready — restarting to install', staged: true };
      }
      const zipPath = path.join(app.getPath('temp'), 'ahg-update.zip');

      if (!fs.existsSync(zipPath)) {
        return { success: false, message: 'Update file not found. Please download again.' };
      }

      const { filesCopied } = stageUpdate(zipPath);
      return { success: true, message: 'Update staged — restart the app to apply it', filesCopied, staged: true };
    } catch (error) {
      console.error('[MAIN] Install error:', error);
      return { success: false, message: error.message };
    }
  });
}

module.exports = { registerUpdateHandlers, applyStagedUpdateOnExit };
