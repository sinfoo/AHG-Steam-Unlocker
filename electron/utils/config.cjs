// ── Config persistence and DLC cache module ──
const path = require('path');
const fs = require('fs');
const https = require('https');
const { app } = require('electron');

const httpsAgent = new https.Agent({ keepAlive: true });

// Custom Steam path persistence
function getCustomSteamConfig() {
  try {
    const f = path.join(app.getPath('userData'), 'steam_custom_paths.json');
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf-8'));
  } catch (e) {}
  return {};
}

function saveCustomSteamConfig(config) {
  try {
    const f = path.join(app.getPath('userData'), 'steam_custom_paths.json');
    fs.writeFileSync(f, JSON.stringify(config, null, 2));
    return true;
  } catch (e) { return false; }
}

// Load custom path config at module level
let customSteamConfig = {};
try { customSteamConfig = getCustomSteamConfig(); } catch (e) {}

// DLC Info Cache for persistent DLC name/cover lookups
const dlcInfoCache = new Map();
const DLC_CACHE_FILE = 'dlc_info_cache.json';

function loadDlcInfoCache() {
  try {
    const f = path.join(app.getPath('userData'), DLC_CACHE_FILE);
    if (fs.existsSync(f)) {
      const data = JSON.parse(fs.readFileSync(f, 'utf-8'));
      for (const [k, v] of Object.entries(data)) dlcInfoCache.set(k, v);
      console.log('[DLC] Loaded', dlcInfoCache.size, 'cached DLC infos');
    }
  } catch (e) { console.log('[DLC] Cache load error:', e.message); }
}

function saveDlcInfoCache() {
  try {
    const f = path.join(app.getPath('userData'), DLC_CACHE_FILE);
    fs.writeFileSync(f, JSON.stringify(Object.fromEntries(dlcInfoCache)));
  } catch (e) { console.log('[DLC] Cache save error:', e.message); }
}

// Batch fetch DLC names from Steam Store API
async function fetchDlcInfos(dlcIds) {
  const result = {};

  // Filter: only IDs not in cache OR with stale "App {id}" placeholder names
  const toFetch = dlcIds.filter(id => {
    const cached = dlcInfoCache.get(id);
    return !cached || !cached.name || cached.name.startsWith('App ');
  });

  // Return well-cached entries immediately
  for (const id of dlcIds) {
    if (!toFetch.includes(id) && dlcInfoCache.has(id)) {
      result[id] = dlcInfoCache.get(id);
    }
  }

  // Batch fetch missing/stale ones (50 per batch)
  for (let i = 0; i < toFetch.length; i += 50) {
    const batch = toFetch.slice(i, i + 50);
    const ids = batch.join(',');
    try {
      const url = `https://store.steampowered.com/api/appdetails?appids=${ids}&cc=us&l=en`;
      const data = await new Promise((resolve, reject) => {
        const req = https.get(url, {
          agent: httpsAgent,
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        }, (rsp) => {
          if (rsp.statusCode !== 200) { reject(new Error('HTTP ' + rsp.statusCode)); return; }
          const buf = []; rsp.on('data', c => buf.push(c));
          rsp.on('end', () => resolve(JSON.parse(Buffer.concat(buf).toString())));
        });
        req.on('error', reject); req.setTimeout(30000, () => { req.destroy(); reject(new Error('timeout')); });
      });
      for (const [id, info] of Object.entries(data)) {
        if (info && info.success && info.data) {
          const entry = {
            name: info.data.name || ('App ' + id),
            header_image: info.data.header_image || `https://i.steamstatic.com/store_item_assets/steam/apps/${id}/header.jpg`
          };
          dlcInfoCache.set(id, entry);
          result[id] = entry;
        }
      }
    } catch (e) {
      console.log('[DLC] Batch fetch error, trying individual fallback:', e.message);
      // Fallback: try each DLC individually with retries
      for (const id of batch) {
        try {
          const fallbackUrl = `https://store.steampowered.com/api/appdetails?appids=${id}&cc=us&l=en`;
          const fallbackData = await new Promise((resolve, reject) => {
            const req = https.get(fallbackUrl, {
              agent: httpsAgent,
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
            }, (rsp) => {
              if (rsp.statusCode !== 200) { reject(new Error('HTTP ' + rsp.statusCode)); return; }
              const buf = []; rsp.on('data', c => buf.push(c));
              rsp.on('end', () => resolve(JSON.parse(Buffer.concat(buf).toString())));
            });
            req.on('error', reject); req.setTimeout(20000, () => { req.destroy(); reject(new Error('timeout')); });
          });
          const fbInfo = fallbackData[id];
          if (fbInfo && fbInfo.success && fbInfo.data) {
            const entry = {
              name: fbInfo.data.name || ('App ' + id),
              header_image: fbInfo.data.header_image || `https://i.steamstatic.com/store_item_assets/steam/apps/${id}/header.jpg`
            };
            dlcInfoCache.set(id, entry);
            result[id] = entry;
          }
        } catch (e2) {
          console.log('[DLC] Individual fallback error for', id, ':', e2.message);
        }
      }
    }
  }

  // Save after any fetch attempt (even partial/stale)
  if (toFetch.length > 0) saveDlcInfoCache();
  return result;
}

module.exports = {
  getCustomSteamConfig,
  saveCustomSteamConfig,
  customSteamConfig,
  dlcInfoCache,
  DLC_CACHE_FILE,
  loadDlcInfoCache,
  saveDlcInfoCache,
  fetchDlcInfos
};
