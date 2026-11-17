// ── Ryuu request IPC handlers: find a game, request it (or an update), track your requests ──
// Every customer shares one reseller key, so the request channels are rate limited and the
// key never leaves the main process. resellerrequests lists the whole reseller account, so
// each user only sees the appids they requested themselves (kept in userData).
const path = require('path');
const fs = require('fs');
const { app, ipcMain } = require('electron');
const state = require('../utils/state.cjs');
const { wrapHandler } = require('../utils/rateLimiter.cjs');
const ryuuDownloader = require('../ryuuDownloader.cjs');

const STEAM_APP_URL = /store\.steampowered\.com\/app\/(\d+)|steamcommunity\.com\/app\/(\d+)|steamdb\.info\/app\/(\d+)/i;

/** "1245620", " 1245620 ", or a Steam store/SteamDB link → 1245620; anything else → null. */
function parseAppId(input) {
  const s = String(input ?? '').trim();
  const m = s.match(STEAM_APP_URL);
  const digits = m ? (m[1] || m[2] || m[3]) : (/^\d{1,10}$/.test(s) ? s : null);
  const n = digits ? Number(digits) : NaN;
  return Number.isSafeInteger(n) && n > 0 && n < 2 ** 32 ? n : null;
}

const authCode = () => state.apiConfig?.ryuu?.auth_code;
const requestsFile = () => path.join(app.getPath('userData'), 'ryuu_requests.json');

function loadRequests() {
  try { return JSON.parse(fs.readFileSync(requestsFile(), 'utf-8')); } catch { return []; }
}

/** Remember a request this user made (newest first, one entry per appid + kind). */
function recordRequest(appid, name, kind) {
  const list = loadRequests().filter(r => !(String(r.appid) === String(appid) && r.kind === kind));
  list.unshift({ appid: String(appid), name: name || '', kind, requestedAt: new Date().toISOString() });
  try { fs.writeFileSync(requestsFile(), JSON.stringify(list.slice(0, 200), null, 2)); } catch (e) {
    console.warn('[REQUESTS] Could not save request history:', e.message);
  }
}

async function getJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'AHG-Steam-Unlocker' }, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const headerImage = (appid) => `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/header.jpg`;

// Soundtracks, DLC, tools and the like are never what someone wants to request. (Copy in src/utils/gameMatch.ts.)
const NOT_A_GAME = /\b(soundtrack|ost|artbook|art book|wallpapers?|dlc|season pass|expansion pass|upgrade|bundle|pack|demo|playtest|dedicated server|sdk|toolkit|editor|beta|redmod|redkit)\b/i;

// Steam throttles its search endpoints per IP (storesearch answers 403 after a burst), so try
// three of them in turn, and remember answers: typing the same word twice costs nothing.
const SEARCHES = [
  async (term) => (await getJson(`https://steamcommunity.com/actions/SearchApps/${encodeURIComponent(term)}`))
    .map(it => ({ appid: String(it.appid), name: it.name || '' })),
  async (term) => ((await getJson(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(term)}&l=english&cc=US`)).items || [])
    .filter(it => it.type === 'app' && it.id).map(it => ({ appid: String(it.id), name: it.name || '' })),
  async (term) => {
    const res = await fetch(`https://store.steampowered.com/search/suggest?term=${encodeURIComponent(term)}&f=games&cc=US&realm=1&l=english`,
      { headers: { 'User-Agent': 'AHG-Steam-Unlocker' }, signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    return [...html.matchAll(/data-ds-appid="(\d+)"[\s\S]*?class="match_name">([^<]*)</g)].map(m => ({ appid: m[1], name: m[2].replace(/&amp;/g, '&').replace(/&#0?39;/g, "'") }));
  },
];
const searchCache = new Map(); // term → { at, results }
const CACHE_MS = 15 * 60 * 1000;

async function searchSteam(term) {
  const key = term.toLowerCase();
  const hit = searchCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.results;
  let lastError = null;
  for (const search of SEARCHES) {
    try {
      const seen = new Set();
      const results = (await search(term))
        .filter(r => r.appid && !NOT_A_GAME.test(r.name) && !seen.has(r.appid) && seen.add(r.appid))
        .slice(0, 8)
        .map(r => ({ ...r, image: headerImage(r.appid) }));
      if (results.length === 0) continue; // a source that knows nothing: ask the next one
      searchCache.set(key, { at: Date.now(), results });
      return results;
    } catch (e) { lastError = e; }
  }
  if (lastError) throw lastError;
  searchCache.set(key, { at: Date.now(), results: [] });
  return [];
}

/** Name, App ID or Steam link → up to 8 Steam games: [{ appid, name, image }]. */
async function lookup(query) {
  const appid = parseAppId(query);
  if (appid) {
    let name = '';
    try {
      const data = await getJson(`https://store.steampowered.com/api/appdetails?appids=${appid}&filters=basic`);
      name = data?.[appid]?.data?.name || '';
    } catch { /* unknown or delisted on the store: still requestable by id */ }
    return [{ appid: String(appid), name, image: headerImage(appid) }];
  }
  const term = String(query ?? '').trim().slice(0, 100);
  return term.length < 3 ? [] : searchSteam(term);
}

function registerRequestHandlers() {
  ipcMain.handle('ryuu-lookup', wrapHandler('ryuu-lookup', async (_e, query) => {
    try { return { success: true, results: await lookup(query) }; }
    catch (e) {
      console.warn('[REQUESTS] Steam search failed:', e.message);
      return { success: false, results: [], message: 'busy' };
    }
  }, { windowMs: 60000, maxCalls: 40 }));

  // kind: 'game' asks Ryuu to add a game it doesn't have; 'update' asks it to refresh one it has.
  ipcMain.handle('ryuu-request', wrapHandler('ryuu-request', async (_e, appidInput, name, kind) => {
    const appid = parseAppId(appidInput);
    if (!appid) return { success: false, message: 'Please enter a valid App ID.' };
    const isUpdate = kind === 'update';
    const res = isUpdate
      ? await ryuuDownloader.requestGameUpdate(appid, authCode())
      : await ryuuDownloader.requestGame(appid, authCode());
    if (isUpdate) {
      const ok = res.status === 200;
      if (ok) recordRequest(appid, name, 'update');
      return { success: ok, message: res.message || res.error || (ok ? 'Update requested.' : 'Could not request an update right now.') };
    }
    // interpretRequestGame words "already in database" for the failed-install path; here the
    // user asked for a game Ryuu already has, so say that instead of "we've requested it".
    if (/already in database/i.test(res.message || res.error || '')) {
      return { success: true, message: 'Already on Ryuu — it appears in the catalogue after the next sync (up to 30 min).' };
    }
    const outcome = ryuuDownloader.interpretRequestGame(res);
    if (outcome.requested) recordRequest(appid, name, 'game');
    return { success: outcome.requested, message: outcome.reason };
  }, { windowMs: 60000, maxCalls: 6 }));

  // This user's requests, with Ryuu's live status (pending / fulfilled) where the server knows it.
  ipcMain.handle('ryuu-my-requests', wrapHandler('ryuu-my-requests', async () => {
    const mine = loadRequests();
    if (mine.length === 0) return { success: true, requests: [] };
    let server = new Map();
    try {
      const url = `${ryuuDownloader.RYUU_API_BASE}/resellerrequests?auth_code=${encodeURIComponent(authCode() || '')}`;
      const data = await getJson(url);
      for (const [kind, rows] of [['game', data?.game_requests], ['update', data?.update_requests]]) {
        for (const r of rows || []) server.set(`${kind}:${r.appid}`, r);
      }
    } catch (e) {
      console.warn('[REQUESTS] resellerrequests failed:', e.message);
      server = null;
    }
    return {
      success: true,
      requests: mine.map(r => {
        const s = server?.get(`${r.kind}:${r.appid}`);
        const fulfilled = !!s?.fulfilled_at || s?.status === 'fulfilled';
        return { ...r, name: r.name || s?.game_name || '', status: server ? (fulfilled ? 'fulfilled' : 'pending') : 'unknown', fulfilledAt: s?.fulfilled_at || null };
      }),
    };
  }, { windowMs: 60000, maxCalls: 20 }));
}

module.exports = { registerRequestHandlers, parseAppId, recordRequest, NOT_A_GAME };
