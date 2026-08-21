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

function stageUpdate(zipPath) {
  const zip = new AdmZip(zipPath);
  const dir = stagingDir();
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  console.log('[MAIN] Extracting update ZIP to staging...');
  zip.extractAllTo(dir, true);
  return { filesCopied: countFiles(getStagedRoot() || dir) };
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

// Called by the restart-app handler. Spawns a hidden cmd script that waits for this
// process to exit, robocopies the staged files onto the install dir (the release zip
// root IS the install root: exe + resources\ — NOT resources\ as the old code
// assumed), starts the new exe, and cleans up after itself.
function applyStagedUpdateOnExit() {
  const sourceRoot = getStagedRoot();
  if (!sourceRoot) return false;
  if (!app.isPackaged) {
    console.log('[UPDATES] Dev build — skipping staged update swap');
    return false;
  }
  const installDir = path.dirname(process.execPath);
  const exePath = process.execPath;
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
    `robocopy "${sourceRoot}" "${installDir}" /E /IS /IT /R:3 /W:1 >nul`,
    `start "" "${exePath}"`,
    `rd /s /q "${stagingDir()}"`,
    'del "%~f0"',
  ].join('\r\n');
  fs.writeFileSync(batPath, bat);
  const { spawn } = require('child_process');
  spawn('cmd.exe', ['/c', batPath], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  console.log('[UPDATES] Staged update will be applied by', batPath);
  return true;
}

function registerUpdateHandlers() {
  // Check for new releases on GitHub
  ipcMain.handle('check-for-updates', async () => {
    console.log('[MAIN] Checking for updates from GitHub...');
    try {
      const url = `https://api.github.com/repos/${GITHUB_REPO}/releases`;
      const data = await new Promise((resolve, reject) => {
        const req = https.get(url, {
          headers: {
            'User-Agent': 'AHG-Steam-Unlocker',
            'Accept': 'application/vnd.github.v3+json'
          }
        }, (res) => {
          if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => resolve(Buffer.concat(chunks)));
        });
        req.on('error', reject);
        req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout')); });
      });

      const releases = JSON.parse(data.toString());
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

      return {
        success: true,
        latestTag,
        hasUpdate,
        currentVersion,
        latestVersion: latestTag,
        releaseNotes: latest.body || '',
        releaseUrl: latest.html_url,
        publishedAt: latest.published_at,
        downloadUrl: latest.assets?.[0]?.browser_download_url || null,
        downloadSize: latest.assets?.[0]?.size || 0,
      };
    } catch (error) {
      console.error('[MAIN] Error checking updates:', error);
      return { success: false, message: error.message };
    }
  });

  // Download update ZIP from GitHub
  ipcMain.handle('download-update', async (event, downloadUrl, savePath) => {
    console.log('[MAIN] Downloading update from:', downloadUrl);
    try {
      const tempDir = app.getPath('temp');
      const zipFileName = 'ahg-update.zip';
      const finalSavePath = savePath || path.join(tempDir, zipFileName);

      const data = await new Promise((resolve, reject) => {
        const req = https.get(downloadUrl, {
          headers: {
            'User-Agent': 'AHG-Steam-Unlocker',
            'Accept': 'application/octet-stream'
          }
        }, (res) => {
          if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 303 || res.statusCode === 307 || res.statusCode === 308) {
            const redirectUrl = res.headers.location;
            if (redirectUrl) {
              console.log('[MAIN] Following redirect to:', redirectUrl);
              const redirectReq = https.get(redirectUrl, {
                headers: {
                  'User-Agent': 'AHG-Steam-Unlocker',
                  'Accept': 'application/octet-stream'
                }
              }, (redirectRes) => {
                if (redirectRes.statusCode !== 200) { reject(new Error(`HTTP ${redirectRes.statusCode}`)); return; }
                const chunks = [];
                const contentLength = parseInt(redirectRes.headers['content-length'] || 0);
                let received = 0;

                redirectRes.on('data', (chunk) => {
                  chunks.push(chunk);
                  received += chunk.length;
                  if (contentLength && state.mainWindow) {
                    state.mainWindow.webContents.send('download-progress', {
                      received,
                      total: contentLength,
                      percent: Math.round(received * 100 / contentLength)
                    });
                  }
                });
                redirectRes.on('end', () => resolve(Buffer.concat(chunks)));
              });
              redirectReq.on('error', reject);
              redirectReq.setTimeout(120000, () => { redirectReq.destroy(); reject(new Error('Timeout')); });
              return;
            }
          }
          if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
          const chunks = [];
          const contentLength = parseInt(res.headers['content-length'] || 0);
          let received = 0;

          res.on('data', (chunk) => {
            chunks.push(chunk);
            received += chunk.length;
            if (contentLength && state.mainWindow) {
              state.mainWindow.webContents.send('download-progress', {
                received,
                total: contentLength,
                percent: Math.round(received * 100 / contentLength)
              });
            }
          });
          res.on('end', () => resolve(Buffer.concat(chunks)));
        });
        req.on('error', reject);
        req.setTimeout(120000, () => { req.destroy(); reject(new Error('Timeout')); });
      });

      fs.writeFileSync(finalSavePath, data);
      console.log('[MAIN] Update ZIP saved to:', finalSavePath);

      // Stage the update — actual file replacement happens on restart, when the
      // exe/asar are no longer locked.
      try {
        const { filesCopied } = stageUpdate(finalSavePath);
        return { success: true, message: 'Update staged — restart the app to apply it', path: finalSavePath, filesCopied, staged: true };
      } catch (extractErr) {
        console.error('[MAIN] Extraction error:', extractErr);
        return { success: false, message: 'Downloaded but could not extract: ' + extractErr.message, path: finalSavePath, extracted: false };
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
