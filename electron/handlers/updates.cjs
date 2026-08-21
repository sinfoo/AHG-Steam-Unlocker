// ── Auto-update IPC handlers (GitHub releases) ──
const path = require('path');
const fs = require('fs');
const https = require('https');
const AdmZip = require('adm-zip');
const { ipcMain, app } = require('electron');
const state = require('../utils/state.cjs');

const GITHUB_REPO = 'ahg-team/AHG-Steam-Unlocker';

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
function applyStagedUpdateOnExit() {
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
    '@echo off',
    'set TRIES=0',
    ':wait',
    `tasklist /FI "PID eq ${process.pid}" 2>nul | find "${process.pid}" >nul`,
    'if not errorlevel 1 (',
    '  set /a TRIES+=1',
    '  if %TRIES% GEQ 60 goto copy',
    '  ping -n 2 127.0.0.1 >nul',
    '  goto wait',
    ')',
    ':copy',
    `robocopy "${sourceRoot}" "${installDir}" /E /IS /IT /R:3 /W:1 /LOG:"${logPath}" /NFL /NDL /NP >nul`,
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

/** Pick the best downloadable asset from a GitHub release (prefer .zip). */
function pickReleaseAsset(assets) {
  if (!Array.isArray(assets) || assets.length === 0) return null;
  const zips = assets.filter(a => /\.zip$/i.test(a.name || ''));
  const winZip = zips.find(a => /win|windows|portable|x64/i.test(a.name || ''));
  return winZip || zips[0] || assets[0];
}

/** Stream an HTTPS response to disk with progress events. */
function streamToFile(res, filePath, onProgress) {
  return new Promise((resolve, reject) => {
    const total = parseInt(res.headers['content-length'] || '0', 10);
    let received = 0;
    const out = fs.createWriteStream(filePath);
    res.on('data', (chunk) => {
      received += chunk.length;
      if (total && onProgress) onProgress(received, total);
    });
    res.pipe(out);
    out.on('finish', () => out.close(() => resolve({ received, total })));
    out.on('error', reject);
    res.on('error', reject);
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

function registerUpdateHandlers() {
  // Check for new releases on GitHub
  ipcMain.handle('check-for-updates', async () => {
    console.log('[MAIN] Checking for updates from GitHub...');
    try {
      const url = `https://api.github.com/repos/${GITHUB_REPO}/releases`;
      const res = await httpsGet(url, {
        'User-Agent': 'AHG-Steam-Unlocker',
        'Accept': 'application/vnd.github.v3+json',
      });
      const chunks = [];
      for await (const chunk of res) chunks.push(chunk);
      const releases = JSON.parse(Buffer.concat(chunks).toString());
      if (!releases || releases.length === 0) {
        return { success: false, message: 'No releases found' };
      }

      const latest = releases[0];
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
  ipcMain.handle('download-update', async (event, downloadUrl, savePath) => {
    console.log('[MAIN] Downloading update from:', downloadUrl);
    try {
      if (!downloadUrl || !/^https:\/\//.test(downloadUrl)) {
        return { success: false, message: 'Invalid download URL' };
      }
      const tempDir = app.getPath('temp');
      const zipFileName = 'ahg-update.zip';
      const finalSavePath = savePath || path.join(tempDir, zipFileName);

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
      });
      console.log('[MAIN] Update ZIP saved to:', finalSavePath);

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
  });

  // Install update from cached ZIP (re-extract)
  ipcMain.handle('install-update', async () => {
    console.log('[MAIN] Installing update from cached ZIP...');
    try {
      const tempDir = app.getPath('temp');
      const zipPath = path.join(tempDir, 'ahg-update.zip');

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
