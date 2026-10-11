// ── Install/Game IPC handlers ──
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const AdmZip = require('adm-zip');
const { ipcMain, app, dialog } = require('electron');
const { spawn } = require('child_process');
const state = require('../utils/state.cjs');
const { httpGet, httpGetWithProgress, execCmd } = require('../utils/httpUtils.cjs');
const { downloadDepotKeys, findInCachedDepotkeys, ensureRepoIndex, getOrderedRepos, recordRepoManifestCount, recordRepoSpeed, indexRepoAppids } = require('../utils/repoUtils.cjs');
const { fetchDlcInfos, saveDlcInfoCache } = require('../utils/steamApi.cjs');
const { findSteamPath, getCustomDepotCachePath, getCustomStPluginPath, getDepotDownloaderPath } = require('../utils/steamUtils.cjs');
const { getResourcePath } = require('../utils/pathUtils.cjs');
const { wrapHandler } = require('../utils/rateLimiter.cjs');
const db = require('../db.cjs');
const ryuuDownloader = require('../ryuuDownloader.cjs');
const { getHealthyEndpoints, markHealthy } = require('../utils/apiHealthCheck.cjs');

// ── Constants ──
const DLC_MANIFEST_SEARCH_REPOS = 3;

// ── Helper functions ──

// Download actual manifest files
async function downloadManifest(appid, depotid, manifestid, repo, steamPath) {
  // depotid/manifestid come from mirror-supplied depotkeys JSON and land in the
  // written file path. Steam IDs are always numeric — reject anything else so a
  // hostile mirror can't use "..\\..\\" to write outside depotcache.
  if (!/^\d+$/.test(String(depotid)) || !/^\d+$/.test(String(manifestid))) return false;
  const depotCache = getCustomDepotCachePath() || path.join(steamPath, 'depotcache');
  fs.mkdirSync(depotCache, { recursive: true });

  // Try different URL formats for manifests
  const urlFormats = [
    `https://raw.githubusercontent.com/${repo}/main/depotcache/${depotid}_${manifestid}.manifest`,
    `https://raw.githubusercontent.com/${repo}/main/manifests/${depotid}_${manifestid}.manifest`,
    `https://raw.githubusercontent.com/${repo}/master/depotcache/${depotid}_${manifestid}.manifest`,
    `https://raw.githubusercontent.com/${repo}/master/manifests/${depotid}_${manifestid}.manifest`,
    `https://raw.githubusercontent.com/${repo}/refs/heads/main/depotcache/${depotid}_${manifestid}.manifest`,
  ];

  for (const url of urlFormats) {
    try {
      const data = await new Promise((resolve, reject) => {
        const req = https.get(url, { headers: { 'User-Agent': 'AHG-Steam-Unlocker' } }, (res) => {
          if (res.statusCode === 200) {
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks)));
          } else {
            reject(new Error(`HTTP ${res.statusCode}`));
          }
        });
        req.on('error', reject);
        req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
      });

      // Save the manifest file
      const manifestPath = path.join(depotCache, `${depotid}_${manifestid}.manifest`);
      fs.writeFileSync(manifestPath, data);
      console.log(`[MAIN] Saved manifest to ${manifestPath}`);
      return true;
    } catch (e) {
      continue;
    }
  }
  return false;
}

// Download full zip from GitHub releases for the game
async function downloadFromMirrorSingle(appid, repo) {
  return new Promise(async (resolve, reject) => {
    // First, try to get the depotkeys to find app manifests
    let depotKeysData = null;
    try {
      depotKeysData = await downloadDepotKeys(repo);
      const depotKeys = JSON.parse(depotKeysData.toString());

      // Look for this appid in depotkeys
      if (depotKeys[appid]) {
        const appData = depotKeys[appid];
        const depots = appData.depots || {};

        // Download each depot's manifest
        for (const depotId in depots) {
          const depotData = depots[depotId];
          if (depotData.manifestid) {
            await downloadManifest(appid, depotId, depotData.manifestid, repo, findSteamPath());
          }
        }

        resolve(Buffer.from(JSON.stringify({ appid, depots, installed: true })));
        return;
      }
    } catch (e) {
      console.log(`[MAIN] Could not get depotkeys: ${e.message}`);
    }

    // Fallback: try to get direct manifest files
    const urlFormats = [
      `https://raw.githubusercontent.com/${repo}/main/depotcache/${appid}.json`,
      `https://raw.githubusercontent.com/${repo}/main/depotcache/${appid}_manifest.json`,
      `https://raw.githubusercontent.com/${repo}/master/depotcache/${appid}.json`,
      `https://raw.githubusercontent.com/${repo}/master/manifests/${appid}.json`,
      `https://raw.githubusercontent.com/${repo}/refs/heads/main/${appid}.json`,
    ];

    for (const url of urlFormats) {
      try {
        const data = await new Promise((resolve, reject) => {
          const req = https.get(url, { headers: { 'User-Agent': 'AHG-Steam-Unlocker' } }, (res) => {
            if (res.statusCode === 200) {
              const chunks = [];
              res.on('data', (chunk) => chunks.push(chunk));
              res.on('end', () => resolve(Buffer.concat(chunks)));
            } else {
              reject(new Error(`HTTP ${res.statusCode}`));
            }
          });
          req.on('error', reject);
          req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
        });
        resolve(data);
        return;
      } catch (e) {
        continue;
      }
    }

    reject(new Error('Not found in any format'));
  });
}

// Helper: download from DepotBox.org
async function downloadFromDepotBox(appid, depotCache, luaPath, sendLog) {
  try {
    // Try the direct download endpoint
    const url = 'https://depotbox.org/' + appid;

    // First, get the page to check if game exists
    const pageData = await httpGet(url);
    const pageStr = pageData.toString();

    // Check if there's a direct download link or if CAPTCHA is required
    if (pageStr.includes('Try Direct Download') || pageStr.includes('download')) {
      sendLog('Downloading game files...');

      // Try to get the download - this may require CAPTCHA handling
      // For now, try common download URL patterns
      const downloadUrls = [
        'https://depotbox.org/api/download?appid=' + appid,
        'https://depotbox.org/download/' + appid,
        'https://depotbox.org/' + appid + '/download'
      ];

      for (const dlUrl of downloadUrls) {
        try {
          const zipData = await httpGet(dlUrl);

          // Check if it's a valid ZIP
          if (zipData.length > 100 && zipData[0] === 0x50 && zipData[1] === 0x4B) {

            const zip = new AdmZip(zipData);
            const entries = zip.getEntries();

            let manifestCount = 0;
            let totalSize = 0;
            let hasLua = false;

            for (const entry of entries) {
              const fn = path.basename(entry.entryName);
              if (fn.endsWith('.manifest')) {
                const content = zip.readFile(entry);
                const destPath = path.join(depotCache, fn);
                fs.writeFileSync(destPath, content);
                manifestCount++;
                totalSize += content.length;
              } else if (fn.endsWith('.lua') && !hasLua) {
                const luaData = zip.readFile(entry);
                const luaDest = path.join(luaPath, appid + '.lua');
                fs.writeFileSync(luaDest, luaData);
                hasLua = true;
              }
            }

            if (manifestCount > 0 && !hasLua) {
              const lp = path.join(luaPath, appid + '.lua');
              const stubContent = 'addappid(' + appid + ')';
              fs.writeFileSync(lp, stubContent);
              console.log('[LUA-DEBUG] Generated stub for ' + appid + ' (depotbox): "' + stubContent + '"');
            }

            if (manifestCount > 0) {
              fs.writeFileSync(path.join(depotCache, appid + '_appinfo.json'), JSON.stringify({ appid: appid, source: 'depotbox.org' }));
              sendLog('Game files ready');
              return { success: true, manifestCount, totalSize };
            }
          }
        } catch (err) {
          // URL failed, try next
        }
      }
    } else if (pageStr.includes('CAPTCHA') || pageStr.includes('Turnstile')) {
      sendLog('Download not available directly');
    } else {
      sendLog('Game not found');
    }
  } catch (err) {
    sendLog('Download error: ' + err.message);
  }
  return { success: false };
}

// Helper: download using DepotDownloader.exe (Steam CDN)
async function downloadWithDepotDownloader(appid, depotCache, luaPath, sendLog) {
  try {
    const ddPath = getDepotDownloaderPath();
    if (!fs.existsSync(ddPath)) {
      return { success: false };
    }

    // Create temp directory for download
    const tempDir = path.join(app.getPath('temp'), 'ahg_depot_' + appid);
    fs.mkdirSync(tempDir, { recursive: true });

    sendLog('Downloading game files...');

    // Run DepotDownloader with anonymous login
    // Command: DepotDownloader.exe -app <appid> -dir <tempDir>
    const args = [
      '-app', appid.toString(),
      '-dir', tempDir
      // Anonymous login - no username/password needed for free games
    ];

    await new Promise((resolve, reject) => {
      const proc = spawn(ddPath, args, {
        cwd: path.dirname(ddPath),
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => {
        const text = data.toString();
        stdout += text;
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          sendLog('Game files downloaded');
          resolve();
        } else {
          reject(new Error('Downloader exit code: ' + code));
        }
      });

      proc.on('error', (err) => {
        reject(err);
      });
    });

    // Check for downloaded files
    let manifestCount = 0;

    async function searchAndCopy(dir) {
      if (!fs.existsSync(dir)) return;
      const files = await fs.promises.readdir(dir, { recursive: true, withFileTypes: true });
      for (const file of files) {
        if (file.isFile()) {
          const filePath = path.join(file.path || dir, file.name);
          const ext = path.extname(file.name).toLowerCase();

          if (ext === '.manifest') {
            const destPath = path.join(depotCache, file.name);
            await fs.promises.copyFile(filePath, destPath);
            manifestCount++;
          } else if (ext === '.lua' || file.name.endsWith('.lua')) {
            const luaDest = path.join(luaPath, appid + '.lua');
            await fs.promises.copyFile(filePath, luaDest);
          }
        }
      }
    }

    await searchAndCopy(tempDir);

    // Clean up temp directory
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) {
      console.error('[INSTALL] Error cleaning up temp directory:', e.message);
    }

    if (manifestCount > 0) {
      // Generate Lua if not present
      const luaPathFinal = path.join(luaPath, appid + '.lua');
      if (!fs.existsSync(luaPathFinal)) {
        const stubContent = 'addappid(' + appid + ')';
        fs.writeFileSync(luaPathFinal, stubContent);
        console.log('[LUA-DEBUG] Generated stub for ' + appid + ' (depotdownloader): "' + stubContent + '"');
      }

      fs.writeFileSync(path.join(depotCache, appid + '_appinfo.json'), JSON.stringify({ appid: appid, source: 'DepotDownloader' }));
      sendLog('Game files ready');
      return { success: true, manifestCount, totalSize: 0 };
    } else {
      sendLog('No game files found');
    }
  } catch (err) {
    sendLog('Download error: ' + err.message);
  }
  return { success: false };
}

// Try LuaTools/ManifestHub free APIs as fallback (after GitHub mirrors)
async function tryLuaToolsApis(appid, depotCache, luaPath, sendLog, signal) {
  // Try Morrenus if API key is configured
  const DISCORD_DATA_PATH = path.join(app.getPath('userData'), 'discord_auth.json');
  let morrenusKey = null;
  try {
    if (fs.existsSync(DISCORD_DATA_PATH)) {
      const authData = JSON.parse(fs.readFileSync(DISCORD_DATA_PATH, 'utf-8'));
      morrenusKey = authData.morrenusApiKey || null;
    }
  } catch (e) {
    console.error('[INSTALL] Error reading Discord auth for Morrenus key:', e.message);
  }

  // Build API list: Morrenus first if key available, then free APIs
  const apis = [];
  if (morrenusKey) {
    apis.push({ name: 'Morrenus', url: 'https://hubcapmanifest.com/api/v1/manifest/<appid>?api_key=' + morrenusKey });
  }
  apis.push(...state.LUATOOLS_APIS);

  if (apis.length === 0) return null;
  if (signal && signal.aborted) { sendLog('Operation aborted'); return null; }

  // ── Pre-flight health check: probe all APIs, skip unhealthy ones ──
  // Uses lightweight HEAD requests (3s timeout) to avoid waiting 10s+ on dead endpoints
  const healthyApis = await getHealthyEndpoints(apis, sendLog);
  if (healthyApis.length === 0) {
    sendLog('All LuaTools APIs are unreachable, skipping LuaTools stage');
    return null;
  }
  if (healthyApis.length < apis.length) {
    sendLog(`Proceeding with ${healthyApis.length}/${apis.length} healthy APIs`);
  }

  // Shared abort: first successful API cancels all others immediately.
  // Also wired to the external signal so user cancellation kills in-flight requests.
  const winnerAbort = new AbortController();
  if (signal) signal.addEventListener('abort', () => winnerAbort.abort());

  const results = await Promise.allSettled(healthyApis.map(async (api) => {
    if (winnerAbort.signal.aborted) return null;

    const url = api.url.replace('<appid>', String(appid));

    try {
      // 10s timeout per API — Sushi (raw GitHub) responds in <1s, others are unreachable
      const zipData = await httpGetWithProgress(url, null, winnerAbort.signal, 10000);

      if (winnerAbort.signal.aborted) return null;

      // Validate ZIP header
      if (zipData.length < 4 || zipData[0] !== 0x50 || zipData[1] !== 0x4B) {
        return null;
      }

      const zip = new AdmZip(zipData);
      const entries = zip.getEntries();

      let manifestCount = 0;
      let totalSize = 0;
      let hasLua = false;

      for (const entry of entries) {
        const fn = path.basename(entry.entryName);
        if (fn.endsWith('.manifest')) {
          const content = zip.readFile(entry);
          const destPath = path.join(depotCache, fn);
          fs.writeFileSync(destPath, content);
          manifestCount++;
          totalSize += content.length;
        } else if (fn.endsWith('.lua') && !hasLua) {
          const luaData = zip.readFile(entry);
          const luaDest = path.join(luaPath, appid + '.lua');
          fs.writeFileSync(luaDest, luaData);
          hasLua = true;
        }
      }

      if (manifestCount > 0) sendLog('Downloading files...');
      markHealthy(api.name); // Update health cache
      winnerAbort.abort(); // Cancel all other in-flight requests immediately
      return { foundRepo: 'LuaTools: ' + api.name, manifestCount, totalSize, hasLua };
    } catch (err) {
      if (winnerAbort.signal.aborted) return null; // cancelled by another API's success, ignore
      return null;
    }
  }));

  // Return first successful result
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) return result.value;
  }
  return null;
}
// Install game - checks GitHub mirrors (Warden/SteamAutoCracks priority) first, then LuaTools APIs
async function installSteamGame(appid, steamPath, sendLog, signal) {
  // Use custom paths from settings if configured, otherwise default to Steam folder
  const depotCache = getCustomDepotCachePath() || path.join(steamPath, 'depotcache');
  const luaPath = getCustomStPluginPath() || path.join(steamPath, 'config', 'stplug-in');

  try {
    fs.mkdirSync(depotCache, { recursive: true });
    fs.mkdirSync(luaPath, { recursive: true });
  } catch (e) {
    sendLog('ERROR: Cannot write to folders!');
    return { foundRepo: null, manifestCount: 0 };
  }

  // Check if game config already exists — if so, still refresh manifests
  // (handles case where Steam wasn't restarted after a previous install)
  const luaFile = path.join(luaPath, appid + '.lua');
  const alreadyInstalled = fs.existsSync(luaFile);
  if (alreadyInstalled) {
    sendLog('Refreshing game files...');
  }

  sendLog('Adding the game...');

  let foundRepo = null;
  let manifestCount = 0;
  let totalSize = 0;
  let hasLua = false;

  // ── Stage 1: Ryuu API Generator (PRIMARY — fastest, ~2s) ──
  if (!foundRepo) {
    try {
      const ryuuResult = await ryuuDownloader.downloadGame(appid, {
        steamPath,
        depotCache,
        luaPath,
        onProgress: sendLog,
        signal,
        authCode: state.apiConfig?.ryuu?.auth_code,
      });
      if (ryuuResult.success) {
        foundRepo = 'ryuu-api';
        manifestCount = ryuuResult.manifestCount;
        totalSize = ryuuResult.totalSize || 0;
        hasLua = ryuuResult.hasLua;
        sendLog('Downloaded game files');
      }
    } catch (err) {
      // fall through to next stage
    }
  }

  // ── Stage 2: Cached depotkeys (instant, no network) ──
  if (!foundRepo) {
    const cachedHit = findInCachedDepotkeys(appid);
    if (cachedHit) {
      try {
        const result = await tryRepoForGame(appid, cachedHit.repo, depotCache, luaPath, sendLog);
        if (result) {
          foundRepo = cachedHit.repo;
          manifestCount = result.manifestCount;
          totalSize = result.totalSize || 0;
          hasLua = result.hasLua;
          state.repoHitCache.add(cachedHit.repo);
          recordRepoManifestCount(cachedHit.repo, manifestCount);
        }
      } catch (e) {
        // fall through
      }
    }
  }

  // ── Stage 3: Parallel ZIP branch probing across ALL repos ──
  if (!foundRepo) {
    const orderedRepos = getOrderedRepos();
    if (orderedRepos.length > 0) {
      const zipAbort = new AbortController();

      await Promise.allSettled(orderedRepos.map(async (repo) => {
        if (foundRepo || zipAbort.signal.aborted) return;

        const url = `https://github.com/${repo}/archive/refs/heads/${appid}.zip`;
        const startTime = Date.now();

        let zipData;
        try {
          zipData = await httpGet(url, zipAbort.signal, state.REPO_TIMEOUT_MS);
        } catch (e) {
          recordRepoSpeed(repo, Date.now() - startTime);
          return;
        }

        if (foundRepo || zipAbort.signal.aborted) return;

        if (zipData.length < 4 || zipData[0] !== 0x50 || zipData[1] !== 0x4B) return;

        const zip = new AdmZip(zipData);
        const entries = zip.getEntries();
        let foundManifests = false;

        for (const entry of entries) {
          const fn = path.basename(entry.entryName);
          if (fn.endsWith('.manifest')) {
            const content = zip.readFile(entry);
            const destPath = path.join(depotCache, fn);
            fs.writeFileSync(destPath, content);
            manifestCount++;
            totalSize += content.length;
            foundManifests = true;
          } else if (fn.endsWith('.lua') && !hasLua) {
            const luaData = zip.readFile(entry);
            fs.writeFileSync(path.join(luaPath, appid + '.lua'), luaData);
            hasLua = true;
            const preview = luaData.toString('utf8', 0, 200).replace(/\n/g, '\\n');
            console.log(`[LUA-DEBUG] Mirror ZIP lua for ${appid}: ${luaData.length} bytes, "${preview}"`);
          }
        }

        if (foundManifests && !foundRepo && !zipAbort.signal.aborted) {
          foundRepo = repo;
          state.repoHitCache.add(repo);
          state.repoNegativeCache.delete(repo);
          recordRepoManifestCount(repo, manifestCount);
          sendLog('Found game files');
          zipAbort.abort();
        }
      }));
      if (foundRepo) zipAbort.abort();
    }

    // ── Stage 4: LuaTools/ManifestHub APIs ──
    if (!foundRepo) {
      const luaToolsResult = await tryLuaToolsApis(appid, depotCache, luaPath, sendLog, signal);
      if (luaToolsResult) {
        foundRepo = luaToolsResult.foundRepo;
        manifestCount = luaToolsResult.manifestCount;
        totalSize = luaToolsResult.totalSize || 0;
        hasLua = luaToolsResult.hasLua;
      }
    }

    // ── Stage 5: DepotBox.org ──
    if (!state.skipDepotStages && !foundRepo) {
      try {
        const depotBoxResult = await downloadFromDepotBox(appid, depotCache, luaPath, sendLog);
        if (depotBoxResult.success) {
          foundRepo = 'depotbox.org';
          manifestCount = depotBoxResult.manifestCount;
          totalSize = depotBoxResult.totalSize || 0;
        }
      } catch (err) {
        console.warn('[INSTALL] Stage 5 (depotbox.org) failed for', appid, ':', err.message);
      }
    }

    // ── Stage 6: DepotDownloader (Steam CDN — last resort) ──
    if (!state.skipDepotStages && !foundRepo) {
      try {
        const ddResult = await downloadWithDepotDownloader(appid, depotCache, luaPath, sendLog);
        if (ddResult.success) {
          foundRepo = 'DepotDownloader';
          manifestCount = ddResult.manifestCount;
          totalSize = ddResult.totalSize || 0;
        }
      } catch (err) {
        console.warn('[INSTALL] Stage 6 (DepotDownloader) failed for', appid, ':', err.message);
      }
    }
  }

  if (foundRepo) {
    if (!hasLua) {
      fs.writeFileSync(path.join(luaPath, appid + '.lua'), 'addappid(' + appid + ')\n');
    }
    fs.writeFileSync(path.join(depotCache, appid + '_appinfo.json'), JSON.stringify({ appid: appid }));
    sendLog('Game Added!');
  } else if (alreadyInstalled) {
    // All stages failed, but game may already be installed — report specifically
    sendLog('Game may already be added. Try restarting Steam.');
    return { foundRepo: null, manifestCount: 0, alreadyInstalled: true };
  }

  // ── No source had the game: submit an add request to Ryuu (Request Game API) ──
  // Every source (Ryuu + mirrors + DepotDownloader) has now failed, so this is the
  // right — and only — place to ask Ryuu to add it. The server decides: it accepts
  // paid games, rejects free/unknown ones. We surface its real answer, not a guess.
  if (!foundRepo && !signal?.aborted) {
    try {
      const res = await ryuuDownloader.requestGame(appid, state.apiConfig?.ryuu?.auth_code);
      const outcome = ryuuDownloader.interpretRequestGame(res);
      sendLog(outcome.reason);
      return { foundRepo: null, manifestCount: 0, requested: outcome.requested, requestMessage: outcome.reason };
    } catch (e) {
      console.warn('[INSTALL] requestGame failed for', appid, ':', e.message);
    }
  }

  // ── Post-Install Verification ──
  // Sends directly to renderer DevTools via IPC (bypasses sendLog regex stripping)
  const sendVerify = (msg) => {
    console.log('[VERIFY] ' + msg);
    try {
      if (state.mainWindow && !state.mainWindow.isDestroyed()) {
        state.mainWindow.webContents.send('install-log', { appid, message: '[VERIFY] ' + msg });
      }
    } catch (e) { /* ignore */ }
  };
  if (foundRepo) {
    sendVerify('=== Post-Install Verification ===');
    sendVerify('Reported: ' + manifestCount + ' manifests, hasLua=' + hasLua);

    const luaFile = path.join(luaPath, appid + '.lua');
    if (fs.existsSync(luaFile)) {
      const luaContent = fs.readFileSync(luaFile, 'utf-8');
      sendVerify('Lua file size: ' + luaContent.length + ' bytes');
      if (luaContent.includes('addappid')) {
        sendVerify('Lua has addappid()');
      } else {
        sendVerify('Lua MISSING addappid() — wrong format! Content: "' + luaContent.replace(/\n/g, '\\n').substring(0, 200) + '"');
      }
    } else {
      sendVerify('Lua file NOT FOUND at: ' + luaFile);
    }

    const manifestFiles = fs.readdirSync(depotCache).filter(f => f.endsWith('.manifest'));
    sendVerify('Manifests on disk: ' + manifestFiles.length + ' files');
    if (manifestFiles.length > 0) {
      const samples = manifestFiles.slice(0, 3).map(f => f + '=' + fs.statSync(path.join(depotCache, f)).size + 'b').join(', ');
      sendVerify('Samples: ' + samples);
    }
    if (manifestFiles.length < manifestCount) {
      sendVerify('Fewer manifests on disk (' + manifestFiles.length + ') than reported (' + manifestCount + ')');
    } else {
      sendVerify('Manifest count on disk matches');
    }
    sendVerify('=== End Verification ===');
  }

  return { foundRepo, manifestCount, totalSize };
}

// Helper: try a single repo for the game
async function tryRepoForGame(appid, repo, depotCache, luaPath, sendLog) {
  // PRIMARY: Try depotkeys.json -> individual manifest downloads
  // Race 2 primary URL formats concurrently (main/depotcache + main/manifests)
  // Fallback to master variants if both fail — avoids 6 sequential attempts at 10s each

  let depotKeysFailed = false;

  try {
    const depotKeysData = await downloadDepotKeys(repo);
    const depotKeys = JSON.parse(depotKeysData.toString());

    if (depotKeys[appid]) {
      const appData = depotKeys[appid];
      const depots = appData.depots || {};
      const depotIds = Object.keys(depots);
      sendLog('Downloading game files...');

      let manifestCount = 0;
      let totalSize = 0;
      let hasLua = false;

      // Total timeout wrapper: aborts after REPO_TIMEOUT_MS regardless of activity
      const tryUrls = async (urls) => {
        const results = await Promise.allSettled(urls.map(url =>
          new Promise((resolve, reject) => {
            const req = https.get(url, { headers: { 'User-Agent': 'AHG-Steam-Unlocker' } }, (res) => {
              if (res.statusCode === 200) {
                const chunks = [];
                const totalTimer = setTimeout(() => { req.destroy(); reject(new Error('Timeout')); }, state.REPO_TIMEOUT_MS);
                res.on('data', (chunk) => chunks.push(chunk));
                res.on('end', () => { clearTimeout(totalTimer); resolve(Buffer.concat(chunks)); });
                res.on('error', (e) => { clearTimeout(totalTimer); reject(e); });
              } else {
                reject(new Error('HTTP ' + res.statusCode));
              }
            });
            req.on('error', reject);
            req.setTimeout(state.REPO_TIMEOUT_MS, () => { req.destroy(); reject(new Error('Timeout')); });
          })
        ));
        for (const r of results) {
          if (r.status === 'fulfilled') return r.value;
        }
        return null;
      };

      // Parallel manifest downloads across all depots using Promise.allSettled
      const manifestResults = await Promise.allSettled(depotIds.map(async (depotId) => {
        const depotData = depots[depotId];
        if (!depotData.manifestid) return null;

        const depotid = depotId;
        const manifestid = depotData.manifestid;
        // Numeric-only guard — depot/manifest IDs build the write path (traversal defense).
        if (!/^\d+$/.test(String(depotid)) || !/^\d+$/.test(String(manifestid))) return null;

        // Race primary URLs concurrently (main/depotcache + main/manifests)
        const primaryUrls = [
          `https://raw.githubusercontent.com/${repo}/main/depotcache/${depotid}_${manifestid}.manifest`,
          `https://raw.githubusercontent.com/${repo}/main/manifests/${depotid}_${manifestid}.manifest`,
        ];
        const fallbackUrls = [
          `https://raw.githubusercontent.com/${repo}/master/depotcache/${depotid}_${manifestid}.manifest`,
          `https://raw.githubusercontent.com/${repo}/master/manifests/${depotid}_${manifestid}.manifest`,
        ];

        let data = await tryUrls(primaryUrls);
        if (!data) data = await tryUrls(fallbackUrls);

        if (data) {
          const fn = depotid + '_' + manifestid + '.manifest';
          fs.writeFileSync(path.join(depotCache, fn), data);

          return { size: data.length };
        }
        return null;
      }));

      // Collect results from parallel depot downloads
      for (const r of manifestResults) {
        if (r.status === 'fulfilled' && r.value) {
          manifestCount++;
          totalSize += r.value.size;
        }
      }

      // After manifests, try to fetch a lua file for this appid
      // NOTE: config.vcf URLs intentionally excluded — VCF is NOT Lua and breaks SteamTools
      if (!hasLua) {
        const luaUrls = [
          'https://raw.githubusercontent.com/' + repo + '/main/' + appid + '.lua',
          'https://raw.githubusercontent.com/' + repo + '/master/' + appid + '.lua',
          'https://raw.githubusercontent.com/' + repo + '/main/stplug-in/' + appid + '.lua',
          'https://raw.githubusercontent.com/' + repo + '/master/stplug-in/' + appid + '.lua',
        ];
        // Race Lua URLs concurrently (main + master) with total timeout
        const luaResults = await Promise.allSettled(luaUrls.map(luaUrl =>
          new Promise((resolve, reject) => {
            const req = https.get(luaUrl, { headers: { 'User-Agent': 'AHG-Steam-Unlocker' } }, (res) => {
              if (res.statusCode === 200) {
                const chunks = [];
                const totalTimer = setTimeout(() => { req.destroy(); reject(new Error('Timeout')); }, state.REPO_TIMEOUT_MS);
                res.on('data', (chunk) => chunks.push(chunk));
                res.on('end', () => { clearTimeout(totalTimer); resolve({ data: Buffer.concat(chunks), url: luaUrl }); });
                res.on('error', (e) => { clearTimeout(totalTimer); reject(e); });
              } else {
                reject(new Error('HTTP ' + res.statusCode));
              }
            });
            req.on('error', reject);
            req.setTimeout(state.REPO_TIMEOUT_MS, () => { req.destroy(); reject(new Error('Timeout')); });
          })
        ));
        for (const r of luaResults) {
          if (r.status === 'fulfilled' && !hasLua) {
            const luaDest = path.join(luaPath, appid + '.lua');
            fs.writeFileSync(luaDest, r.value.data);
            hasLua = true;
            const preview = r.value.data.toString('utf8', 0, 200).replace(/\n/g, '\\n');
            console.log('[LUA-DEBUG] URL-fetched lua for ' + appid + ' (from ' + r.value.url + '): ' + r.value.data.length + ' bytes, "' + preview + '"');
            break;
          }
        }
      }

      if (manifestCount > 0) {
        sendLog('Game files ready');
        return { manifestCount, totalSize, hasLua };
      }
    }
  } catch (e) {
    depotKeysFailed = true;
  }

  // If depotkeys was found and parsed but game not in it: game is definitely not here
  // Skip the ZIP fallback (saves 3-30s per dead repo)
  if (!depotKeysFailed) {
    return null;
  }

  // FALLBACK: ZIP branch approach — only for repos without depotkeys.json
  const url = 'https://github.com/' + repo + '/archive/refs/heads/' + appid + '.zip';

  // Cap ZIP fallback at 5s total (httpGet defaults to 30s idle timeout)
  let zipData;
  try {
    zipData = await Promise.race([
      httpGet(url),
      new Promise((_, reject) => setTimeout(() => reject(new Error('ZIP fallback timeout')), 5000))
    ]);
  } catch (e) {
    return null;
  }

  if (zipData.length < 4 || zipData[0] !== 0x50 || zipData[1] !== 0x4B) {
    return null;
  }

  const zip = new AdmZip(zipData);
  const entries = zip.getEntries();

  const depots = {};
  let manifestCount = 0;
  let totalSize = 0;
  let hasLua = false;
  let luaData = null;

  for (const entry of entries) {
    const fn = path.basename(entry.entryName);
    if (fn.endsWith('.manifest')) {
      const parts = fn.slice(0, -9).split('_');
      if (parts.length === 2 && parts.every(function(p) { return /^\d+$/.test(p); })) {
        const did = parts[0];
        const mid = parts[1];
        if (!depots[did] || parseInt(mid) > parseInt(depots[did])) {
          depots[did] = mid;
        }
        const content = zip.readFile(entry);
        const destPath = path.join(depotCache, fn);
        fs.writeFileSync(destPath, content);
        manifestCount++;
        totalSize += content.length;
      }
    } else if (fn.endsWith('.lua') && !luaData) {
      luaData = zip.readFile(entry);
      const luaDest = path.join(luaPath, appid + '.lua');
      fs.writeFileSync(luaDest, luaData);
      hasLua = true;
    }
  }
  if (manifestCount === 0) return null;
  return { manifestCount, totalSize, hasLua };
}

// Download manifest full
async function downloadManifestFull(appid, depotId, manifestId, repo, depotCache) {
  const urlFormats = [];
  for (const branch of state.MIRROR_ALT_URLS) {
    urlFormats.push(
      `https://raw.githubusercontent.com/${repo}/${branch}/depotcache/${depotId}_${manifestId}.manifest`,
      `https://raw.githubusercontent.com/${repo}/${branch}/manifests/${depotId}_${manifestId}.manifest`,
      `https://raw.githubusercontent.com/${repo}/${branch}/depot/${depotId}_${manifestId}.manifest`,
    );
  }

  for (const url of urlFormats) {
    try {
      const data = await new Promise((resolve, reject) => {
        const req = https.get(url, { headers: { 'User-Agent': 'AHG-Steam-Unlocker' } }, (res) => {
          if (res.statusCode === 200) {
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks)));
          } else {
            reject(new Error(`HTTP ${res.statusCode}`));
          }
        });
        req.on('error', reject);
        req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
      });

      const manifestPath = path.join(depotCache, `${depotId}_${manifestId}.manifest`);
      fs.writeFileSync(manifestPath, data);
      return true;
    } catch (e) {
      continue;
    }
  }
  return false;
}

// Extract bundled lua
async function extractBundledLua(repo, appid, luaPath) {
  const urlFormats = [];
  for (const branch of state.MIRROR_ALT_URLS) {
    urlFormats.push(
      `https://raw.githubusercontent.com/${repo}/${branch}/stplug-in/${appid}.lua`,
      `https://raw.githubusercontent.com/${repo}/${branch}/lua/${appid}.lua`,
      `https://raw.githubusercontent.com/${repo}/${branch}/scripts/${appid}.lua`,
    );
  }

  for (const url of urlFormats) {
    try {
      const data = await new Promise((resolve, reject) => {
        const req = https.get(url, { headers: { 'User-Agent': 'AHG-Steam-Unlocker' } }, (res) => {
          if (res.statusCode === 200) {
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks)));
          } else {
            reject(new Error(`HTTP ${res.statusCode}`));
          }
        });
        req.on('error', reject);
        req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
      });

      const luaFile = path.join(luaPath, `${appid}.lua`);
      fs.writeFileSync(luaFile, data);
      return true;
    } catch (e) {
      continue;
    }
  }
  return false;
}

// Background DLC manifest downloader — best-effort, never blocks registration
// Tries top-N repos (by manifest count) to find and download existing manifests for DLCs
// Fetch a DLC's own key-bearing lua (addappid(depot,1,"key") lines) from a repo,
// like the base game does. A DLC with real content depots needs these decryption
// keys — a bare addappid(dlcId) only flags ownership and never mounts the files,
// which is why some DLCs "don't actually get added". Writes {dlcId}.lua on success,
// overwriting the ownership-only stub register-dlcs wrote. Returns true if written.
async function fetchDlcLua(dlcId, repo, luaPath) {
  if (!/^\d+$/.test(String(dlcId))) return false;
  const urls = [
    `https://raw.githubusercontent.com/${repo}/main/${dlcId}.lua`,
    `https://raw.githubusercontent.com/${repo}/master/${dlcId}.lua`,
    `https://raw.githubusercontent.com/${repo}/main/stplug-in/${dlcId}.lua`,
    `https://raw.githubusercontent.com/${repo}/master/stplug-in/${dlcId}.lua`,
  ];
  for (const url of urls) {
    try {
      const data = await new Promise((resolve, reject) => {
        const req = https.get(url, { headers: { 'User-Agent': 'AHG-Steam-Unlocker' } }, (res) => {
          if (res.statusCode !== 200) { reject(new Error('HTTP ' + res.statusCode)); return; }
          const chunks = [];
          res.on('data', c => chunks.push(c));
          res.on('end', () => resolve(Buffer.concat(chunks)));
        });
        req.on('error', reject);
        req.setTimeout(state.REPO_TIMEOUT_MS, () => { req.destroy(); reject(new Error('Timeout')); });
      });
      // Only accept a real unlock lua (must contain addappid) — repos sometimes serve
      // a 200 HTML 404 page.
      if (data && data.includes('addappid')) {
        fs.writeFileSync(path.join(luaPath, dlcId + '.lua'), data);
        console.log(`[MAIN] DLC lua (with keys): ${dlcId}.lua from ${repo}`);
        return true;
      }
    } catch (_) { /* try next url */ }
  }
  return false;
}

async function tryDlcManifests(dlcIds, depotCache, sourceRepo, luaPath) {
  if (!dlcIds || dlcIds.length === 0) return 0;

  // Build repo list: sourceRepo first (same repo that found the game), then top repos
  const repos = [];
  if (sourceRepo && state.MIRROR_REPOS.includes(sourceRepo)) {
    repos.push(sourceRepo);
  }
  const topRepos = getOrderedRepos().slice(0, DLC_MANIFEST_SEARCH_REPOS);
  for (const r of topRepos) {
    if (!repos.includes(r)) repos.push(r);
  }
  console.log(`[MAIN] Searching ${repos.length} repos for ${dlcIds.length} DLC manifests (sourceRepo: ${sourceRepo || 'none'})...`);

  let totalFound = 0;
  const luaWritten = new Set();

  for (const repo of repos) {
    if (totalFound >= dlcIds.length) break; // already found all DLC manifests
    try {
      const depotKeysData = await downloadDepotKeys(repo);
      const depotKeys = JSON.parse(depotKeysData.toString());

      for (const dlcId of dlcIds) {
        if (!depotKeys[dlcId]) continue;
        const appData = depotKeys[dlcId];
        const depots = appData.depots || {};
        const depotIds = Object.keys(depots);

        // Grab the DLC's key-bearing lua so content depots actually decrypt/mount.
        if (luaPath && !luaWritten.has(dlcId)) {
          if (await fetchDlcLua(dlcId, repo, luaPath)) luaWritten.add(dlcId);
        }

        const urlFormats = [
          `https://raw.githubusercontent.com/${repo}/main/depotcache/%depotid%_%manifestid%.manifest`,
          `https://raw.githubusercontent.com/${repo}/master/depotcache/%depotid%_%manifestid%.manifest`,
        ];

        for (const depotId of depotIds) {
          const depotData = depots[depotId];
          if (!depotData.manifestid) continue;
          const manifestid = depotData.manifestid;
          let saved = false;

          for (const urlTemplate of urlFormats) {
            if (saved) break;
            const url = urlTemplate.replace('%depotid%', depotId).replace('%manifestid%', manifestid);
            try {
              const data = await new Promise((resolve, reject) => {
                const req = https.get(url, { headers: { 'User-Agent': 'AHG-Steam-Unlocker' } }, (res) => {
                  if (res.statusCode === 200) {
                    const chunks = [];
                    res.on('data', (chunk) => chunks.push(chunk));
                    res.on('end', () => resolve(Buffer.concat(chunks)));
                  } else {
                    reject(new Error('HTTP ' + res.statusCode));
                  }
                });
                req.on('error', reject);
                req.setTimeout(state.REPO_TIMEOUT_MS, () => { req.destroy(); reject(new Error('Timeout')); });
              });
              const fn = `${depotId}_${manifestid}.manifest`;
              fs.writeFileSync(path.join(depotCache, fn), data);
              totalFound++;
              console.log(`[MAIN] DLC manifest: ${fn} from ${repo}`);
              saved = true;
            } catch (_) { /* try next URL format */ }
          }
        }
      }
      // Track this repo's manifest contribution for future DLC searches
      if (totalFound > 0) {
        recordRepoManifestCount(repo, totalFound);
      }
    } catch (e) {
      console.log(`[MAIN] DLC manifest search failed for ${repo}: ${e.message.slice(0, 60)}`);
    }
  }

  console.log(`[MAIN] DLC manifest search complete: found ${totalFound} manifests across ${repos.length} repos`);
  return totalFound;
}

// -- Exports --
module.exports = { downloadManifest, downloadFromMirrorSingle, downloadFromDepotBox, downloadWithDepotDownloader, tryLuaToolsApis, installSteamGame, tryRepoForGame, downloadManifestFull, extractBundledLua, tryDlcManifests };
