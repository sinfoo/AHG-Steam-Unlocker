// electron/ryuuDownloader.cjs
// Main-process Ryuu API downloader — downloads .manifest + .lua files from generator.ryuu.lol
// Replaces Stages 1-2 of the 6-stage mirror-repo pipeline in installSteamGame()
// Usage: require('./ryuuDownloader.cjs')

const path = require('path');
const fs = require('fs');
const https = require('https');
const AdmZip = require('adm-zip');
const { httpGet } = require('./utils/httpUtils.cjs');

const RYUU_API_BASE = 'https://generator.ryuu.lol';
// Reseller key lives in config/secrets.json (gitignored, packaged) — never in source.
const DEFAULT_AUTH_CODE = require('./utils/secrets.cjs').secrets.ryuuAuthCode || '';
if (!DEFAULT_AUTH_CODE) console.warn('[RYUU] ryuuAuthCode missing from config/secrets.json — Ryuu API calls will 401');

// ── Helpers ──

function httpGetBuffer(url, signal, timeoutMs = 15000) {
  // Delegates to shared httpGet from httpUtils.cjs which sends proper headers:
  //   User-Agent: Mozilla/5.0 (...Chrome/120...)
  //   Referer: https://generator.ryuu.lol/
  //   Origin: https://generator.ryuu.lol
  //   Accept: application/zip,application/octet-stream,*/*
  // Also handles redirects, 404 rejection, and rejects non-ZIP responses.
  return httpGet(url, signal, timeoutMs);
}

function findSteamPath() {
  // Try common Steam paths on Windows
  const candidates = [
    'C:\\Program Files (x86)\\Steam',
    'C:\\Program Files\\Steam',
    path.join(process.env.LOCALAPPDATA || '', 'Steam'),
    path.join(process.env.PROGRAMFILES || '', 'Steam'),
    path.join(process.env['PROGRAMFILES(X86)'] || '', 'Steam'),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p) && fs.existsSync(path.join(p, 'steam.exe'))) {
      return p;
    }
  }

  // Try registry
  try {
    const { execSync } = require('child_process');
    const result = execSync(
      'reg query "HKCU\\Software\\Valve\\Steam" /v SteamPath 2>nul',
      { encoding: 'utf8', timeout: 3000 }
    );
    const match = result.match(/SteamPath\s+REG_SZ\s+(.+)/);
    if (match) {
      const steamPath = match[1].trim().replace(/\\\\/g, '\\');
      if (fs.existsSync(steamPath)) return steamPath;
    }
  } catch { /* registry not available */ }

  return null;
}

// ── Reseller API calls (request game / request update / update game) ──
// These endpoints return small JSON payloads like {"message":"..."}.
function ryuuApiCall(endpoint, appid, authCode = DEFAULT_AUTH_CODE, timeoutMs = 20000) {
  return new Promise((resolve) => {
    const url = `${RYUU_API_BASE}/${endpoint}?appid=${appid}&auth_code=${authCode}`;
    const req = https.get(url, { timeout: timeoutMs }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, ...JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, message: data.slice(0, 200) }); }
      });
    });
    req.on('error', (e) => resolve({ status: 0, message: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, message: 'timeout' }); });
  });
}

/** Ask Ryuu to add a game that is not in their database yet (Request Game API). */
const requestGame = (appid, authCode) => ryuuApiCall('resellerrequest', appid, authCode);

// Turn a raw resellerrequest response into a user-facing outcome. Observed server
// replies: "Game requested successfully", "Game is already in database",
// "Free games are not supported", "Game not found in Steam database".
function interpretRequestGame(res) {
  const text = (res.message || res.error || '').toLowerCase();
  if (text.includes('requested successfully') || text.includes('already in database')) {
    return { requested: true, reason: 'Not on Ryuu yet — we\'ve requested it. Try again later.' };
  }
  if (text.includes('free games')) {
    return { requested: false, reason: 'This is a free-to-play game — install it directly from Steam.' };
  }
  if (text.includes('not found in steam')) {
    return { requested: false, reason: 'Not a recognised paid Steam game, so it can\'t be requested.' };
  }
  return { requested: false, reason: res.message || res.error || 'Could not submit a request right now.' };
}
/** Ask Ryuu to refresh a stale game (Request Update API). */
const requestGameUpdate = (appid, authCode) => ryuuApiCall('resellerrequestupdate', appid, authCode);
/** Regenerate a game's manifests server-side right now (Update Game API). */
const updateGame = (appid, authCode) => ryuuApiCall('resellerupdate', appid, authCode, 60000);

// ── Exported API ──

/**
 * Download game manifests from Ryuu API and install to Steam.
 * @param {string} appid — Steam App ID
 * @param {object} [options]
 * @param {string} [options.authCode] — Ryuu auth code (default: secrets.ryuuAuthCode)
 * @param {string} [options.steamPath] — Steam installation path (auto-detected if omitted)
 * @param {string} [options.depotCache] — Custom depotcache path (default: steamPath/depotcache)
 * @param {string} [options.luaPath] — Custom stplug-in path (default: steamPath/config/stplug-in)
 * @param {function} [options.onProgress] — Callback for progress messages
 * @param {AbortSignal} [options.signal] — AbortSignal for cancellation
 * @returns {Promise<{success: boolean, manifestCount: number, totalSize: number, hasLua: boolean, message: string}>}
 */
async function downloadGame(appid, options = {}) {
  const {
    authCode = DEFAULT_AUTH_CODE,
    steamPath: providedSteamPath,
    depotCache: providedDepotCache,
    luaPath: providedLuaPath,
    onProgress = () => {},
    signal,
  } = options;

  const steamPath = providedSteamPath || findSteamPath();
  if (!steamPath || !fs.existsSync(steamPath)) {
    return { success: false, manifestCount: 0, totalSize: 0, hasLua: false, message: 'Steam not found' };
  }

  // Use custom paths if explicitly provided, otherwise derive from steamPath
  const depotCache = providedDepotCache || path.join(steamPath, 'depotcache');
  const luaPath = providedLuaPath || path.join(steamPath, 'config', 'stplug-in');
  fs.mkdirSync(depotCache, { recursive: true });
  fs.mkdirSync(luaPath, { recursive: true });

  onProgress('Downloading game files...');

  try {
    // Fire manifest + LUA requests in parallel (matches legacy tryRyuuLolPrimary)
    const manifestUrl = `${RYUU_API_BASE}/secure_download?appid=${appid}&auth_code=${authCode}`;
    const luaUrl = `${RYUU_API_BASE}/resellerlua?appid=${appid}&auth_code=${authCode}`;

    const [manifestResult, luaResult] = await Promise.allSettled([
      httpGetBuffer(manifestUrl, signal, 15000),
      httpGetBuffer(luaUrl, signal, 15000),
    ]);

    onProgress('Preparing files...');

    let manifestCount = 0;
    let totalSize = 0;
    let hasLua = false;

    // Process manifest ZIP
    if (manifestResult.status === 'fulfilled') {
      const zipBuffer = manifestResult.value;
      try {
        const zip = new AdmZip(zipBuffer);
        const entries = zip.getEntries();

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
            const luaDest = path.join(luaPath, `${appid}.lua`);
            fs.writeFileSync(luaDest, luaData);
            hasLua = true;
          }
        }
      } catch (zipErr) {
        // /secure_download responded with non-ZIP content — log diagnostics
        const preview = zipBuffer.slice(0, 200).toString('utf8').replace(/\n/g, '\\n');
        console.log('[RYUU-DIAG] /secure_download response (preview):', preview);
        console.log('[RYUU-DIAG] /secure_download bytes:', zipBuffer.length, 'ZIP error:', zipErr.message);
        onProgress('Manifest download: invalid response from server');
      }
    } else {
      // /secure_download failed (network error, timeout, 4xx/5xx)
      const reason = manifestResult.reason;
      const errMsg = reason?.message || 'failed';
      onProgress(`Manifest download: ${errMsg}`);
      console.log('[RYUU-DIAG] /secure_download failed for', appid, ':', errMsg);
      // NOTE: do NOT submit an add request here. downloadGame is Ryuu-only and runs
      // as Stage 1 of the multi-source pipeline — a mirror may still have the game.
      // The request is submitted by installSteamGame only after ALL sources fail.
    }

    // If no LUA found in ZIP, try the /resellerlua result
    if (!hasLua && luaResult.status === 'fulfilled') {
      const luaData = luaResult.value;
      const luaText = luaData.toString('utf8').trim();
      if (luaText.length > 0) {
        const luaDest = path.join(luaPath, `${appid}.lua`);
        fs.writeFileSync(luaDest, luaText);
        hasLua = true;
      }
    }

    // Generate Lua stub if none found anywhere
    if (!hasLua) {
      const lp = path.join(luaPath, `${appid}.lua`);
      const stubContent = `addappid(${appid})`;
      fs.writeFileSync(lp, stubContent);
      onProgress('Game files prepared');
    }

    // Write appinfo.json
    fs.writeFileSync(
      path.join(depotCache, `${appid}_appinfo.json`),
      JSON.stringify({ appid, installedAt: new Date().toISOString(), source: 'ryuu' })
    );

    onProgress('Game files ready');

    return {
      success: manifestCount > 0,
      manifestCount,
      totalSize,
      hasLua,
      message: manifestCount > 0
        ? 'Game files downloaded successfully'
        : 'No game files found',
    };
  } catch (err) {
    const message = err.name === 'AbortError' ? 'Download cancelled' : err.message;
    onProgress(`FAILED: ${message}`);
    return { success: false, manifestCount: 0, totalSize: 0, hasLua: false, message };
  }
}

/**
 * Download DLC manifests for multiple DLC appids under a base game.
 * @param {string} baseAppid — Base game appid (for file naming)
 * @param {string[]} dlcAppids — DLC appids to download
 * @param {object} [options] — Same options as downloadGame
 * @returns {Promise<{success: boolean, totalManifests: number, results: Array}>}
 */
async function downloadDlcManifests(baseAppid, dlcAppids, options = {}) {
  const results = [];

  for (const dlcAppid of dlcAppids) {
    const result = await downloadGame(dlcAppid, {
      ...options,
      onProgress: (msg) => options.onProgress?.(`DLC: ${msg}`),
    });
    results.push({ appid: dlcAppid, ...result });
  }

  const totalManifests = results.reduce((sum, r) => sum + (r.manifestCount || 0), 0);
  const allSucceeded = results.every(r => r.success);

  return {
    success: allSucceeded,
    totalManifests,
    results,
  };
}

/**
 * Check if a game is available on Ryuu API (HEAD request).
 * @param {string} appid
 * @param {string} [authCode]
 * @returns {Promise<boolean>}
 */
function checkAvailability(appid, authCode = DEFAULT_AUTH_CODE) {
  return new Promise((resolve) => {
    const url = `${RYUU_API_BASE}/secure_download?appid=${appid}&auth_code=${authCode}`;
    const req = https.request(url, { method: 'HEAD' }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(5000, () => { req.destroy(); resolve(false); });
    req.end();
  });
}

module.exports = {
  downloadGame,
  downloadDlcManifests,
  checkAvailability,
  findSteamPath,
  requestGame,
  interpretRequestGame,
  requestGameUpdate,
  updateGame,
  RYUU_API_BASE,
  DEFAULT_AUTH_CODE,
};
