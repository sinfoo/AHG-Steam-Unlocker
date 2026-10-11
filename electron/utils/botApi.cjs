// ── Bot API client — the bot holds every server-side secret ──
// (GitHub gist token, bot token). The desktop app only
// needs the bot's public HTTPS URL: secrets.licenseApiUrl when set (fixed domain),
// otherwise the URL the bot publishes to a public gist (free Cloudflare quick
// tunnel whose address changes on every bot restart).
const { app } = require('electron');
const { secrets } = require('./secrets.cjs');

const ENDPOINT_URL = 'https://api.github.com/gists/2cbf912a75c7a5aa3c601abcc0d704b9';
const ENDPOINT_TTL = 5 * 60 * 1000;
let endpointCache = { url: '', at: 0 };

async function resolveBase(force) {
  if (secrets.licenseApiUrl) return secrets.licenseApiUrl;
  if (!force && endpointCache.url && Date.now() - endpointCache.at < ENDPOINT_TTL) return endpointCache.url;
  try {
    const res = await fetch(ENDPOINT_URL, {
      headers: { 'User-Agent': 'AHG-Steam-Unlocker', Accept: 'application/vnd.github.v3+json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return endpointCache.url;
    const gist = await res.json();
    const { url } = JSON.parse(gist.files['endpoint.json'].content);
    // Only ever talk to a Cloudflare quick-tunnel host from the gist.
    if (typeof url === 'string' && /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(url)) {
      endpointCache = { url, at: Date.now() };
    }
  } catch (e) {
    console.warn('[BOT-API] endpoint lookup failed:', e.message);
  }
  return endpointCache.url;
}

async function post(base, route, body) {
  const res = await fetch(`${base}/${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'AHG-Steam-Unlocker' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON error body */ }
  return { ok: res.ok, status: res.status, data };
}

// POST JSON to the bot. Returns { ok, status, data } or null when unreachable.
async function botApi(route, body) {
  for (const force of [false, true]) {
    const base = (await resolveBase(force) || '').replace(/\/+$/, '');
    if (!base || (app.isPackaged && !base.startsWith('https://'))) {
      console.warn('[BOT-API] no bot URL available');
      return null;
    }
    try {
      const res = await post(base, route, body);
      // A dead quick tunnel answers 530/502 — re-read the gist once for a fresh URL.
      if (!force && !secrets.licenseApiUrl && (res.status === 530 || res.status === 502)) continue;
      return res;
    } catch (e) {
      console.warn('[BOT-API]', route, 'error:', e.message);
      if (force || secrets.licenseApiUrl) return null;
    }
  }
  return null;
}

module.exports = { botApi, resolveBotUrl: resolveBase };
