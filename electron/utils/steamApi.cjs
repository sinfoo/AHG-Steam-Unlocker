// ── Steam Store API wrappers ──
const https = require('https');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const state = require('./state.cjs');

// Fetch Steam game cover URL from store API
async function fetchSteamGameCover(appid) {
  try {
    const url = `https://store.steampowered.com/api/appdetails?appids=${appid}&cc=us&l=en&filters=basic`;
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'AHGUnlocker/0.90.1' },
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) return null;
    const json = await resp.json();
    const entry = json[appid];
    if (entry && entry.success && entry.data && entry.data.header_image) {
      return entry.data.header_image;
    }
    return null;
  } catch (e) {
    console.log('[MAIN] fetchSteamGameCover error for', appid, ':', e.message);
    return null;
  }
}

// DLC Cache persistence
function loadDlcInfoCache() {
  try {
    const f = path.join(app.getPath('userData'), state.DLC_CACHE_FILE);
    if (fs.existsSync(f)) {
      const data = JSON.parse(fs.readFileSync(f, 'utf-8'));
      for (const [k, v] of Object.entries(data)) state.dlcInfoCache.set(k, v);
      console.log('[DLC] Loaded', state.dlcInfoCache.size, 'cached DLC infos');
    }
  } catch (e) { console.log('[DLC] Cache load error:', e.message); }
}

function saveDlcInfoCache() {
  try {
    const f = path.join(app.getPath('userData'), state.DLC_CACHE_FILE);
    fs.writeFileSync(f, JSON.stringify(Object.fromEntries(state.dlcInfoCache)));
  } catch (e) { console.log('[DLC] Cache save error:', e.message); }
}

// Batch fetch DLC names from Steam Store API
async function fetchDlcInfos(dlcIds) {
  const result = {};

  // Filter: only IDs not in cache OR with stale "App {id}" placeholder names
  const toFetch = dlcIds.filter(id => {
    const cached = state.dlcInfoCache.get(id);
    return !cached || !cached.name || cached.name.startsWith('App ');
  });

  // Return well-cached entries immediately
  for (const id of dlcIds) {
    if (!toFetch.includes(id) && state.dlcInfoCache.has(id)) {
      result[id] = state.dlcInfoCache.get(id);
    }
  }

  // Batch fetch missing/stale ones (50 per batch)
  for (let i = 0; i < toFetch.length; i += 50) {
    const batch = toFetch.slice(i, i + 50);
    const ids = batch.join(',');
    try {
      const url = `https://store.steampowered.com/api/appdetails?appids=${ids}&cc=us&l=en`;
      const data = await new Promise((resolve, reject) => {
        const u = new URL(url);
        const req = https.get({
          hostname: u.hostname, path: u.pathname + u.search,
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        }, (rsp) => {
          if (rsp.statusCode !== 200) { reject(new Error('HTTP ' + rsp.statusCode)); return; }
          const buf = []; rsp.on('data', c => buf.push(c));
          rsp.on('end', () => resolve(JSON.parse(Buffer.concat(buf).toString())));
        });
        req.on('error', reject); req.setTimeout(30000, () => { req.destroy(); reject(new Error('timeout')); }); req.end();
      });
      for (const [id, info] of Object.entries(data)) {
        if (info && info.success && info.data) {
          const entry = {
            name: info.data.name || ('App ' + id),
            header_image: info.data.header_image || `https://i.steamstatic.com/store_item_assets/steam/apps/${id}/header.jpg`
          };
          state.dlcInfoCache.set(id, entry);
          result[id] = entry;
        }
      }
    } catch (e) {
      console.log('[DLC] Batch fetch error, trying individual fallback:', e.message);
      for (const id of batch) {
        try {
          const fallbackUrl = `https://store.steampowered.com/api/appdetails?appids=${id}&cc=us&l=en`;
          const fallbackData = await new Promise((resolve, reject) => {
            const u = new URL(fallbackUrl);
            const req = https.get({
              hostname: u.hostname, path: u.pathname + u.search,
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
            }, (rsp) => {
              if (rsp.statusCode !== 200) { reject(new Error('HTTP ' + rsp.statusCode)); return; }
              const buf = []; rsp.on('data', c => buf.push(c));
              rsp.on('end', () => resolve(JSON.parse(Buffer.concat(buf).toString())));
            });
            req.on('error', reject); req.setTimeout(20000, () => { req.destroy(); reject(new Error('timeout')); }); req.end();
          });
          const fbInfo = fallbackData[id];
          if (fbInfo && fbInfo.success && fbInfo.data) {
            const entry = {
              name: fbInfo.data.name || ('App ' + id),
              header_image: fbInfo.data.header_image || `https://i.steamstatic.com/store_item_assets/steam/apps/${id}/header.jpg`
            };
            state.dlcInfoCache.set(id, entry);
            result[id] = entry;
          }
        } catch (e2) {
          console.log('[DLC] Individual fallback error for', id, ':', e2.message);
        }
      }
    }
  }

  if (toFetch.length > 0) saveDlcInfoCache();
  return result;
}

// Get app data from Steam Store API
async function getSteamAppData(appid) {
  return new Promise((resolve, reject) => {
    const url = `https://store.steampowered.com/api/appdetails?appids=${appid}`;
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
}

module.exports = { fetchSteamGameCover, fetchDlcInfos, getSteamAppData, loadDlcInfoCache, saveDlcInfoCache };
