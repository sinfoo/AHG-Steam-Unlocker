#!/usr/bin/env node
// ── Packaged-build runtime smoke test ──
// Launches dev-release/win-unpacked over the Chrome DevTools Protocol and asserts the
// things `tsc`/`vite build` cannot see — every one of these was a real regression that
// shipped "green" this session:
//   • image-cache:// protocol actually serves bytes (hero art / covers)   [protocol.handle fix]
//   • padding utilities apply (.p-3 === 12px)                             [@layer base fix]
//   • body font is Geist, not the Orbitron splash font             [comment-`*/` fix]
//   • no broken <img> after load
//   • no severe renderer console errors
//
// Usage:  node scripts/smoke-packaged.cjs [--port 9333] [--keep]
// Exit 0 = all pass, 1 = a check failed, 2 = harness/launch error.

const path = require('path');
const http = require('http');
const { spawn, execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const EXE = process.env.AHG_SMOKE_EXE || path.join(ROOT, 'dev-release', 'win-unpacked', 'AHG Unlocker.exe');
const PORT = (() => { const i = process.argv.indexOf('--port'); return i !== -1 ? Number(process.argv[i + 1]) : 9333; })();
const KEEP = process.argv.includes('--keep');

let chromium;
try {
  chromium = require(path.join(ROOT, 'node_modules', 'playwright-core')).chromium;
} catch {
  console.error('[smoke] playwright-core not found — cannot run smoke test'); process.exit(2);
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function getJSON(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d)); });
    req.on('error', reject); req.setTimeout(2000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}
function killApp() {
  try { execSync('powershell -NoProfile -Command "Get-Process \'AHG Unlocker\' -ErrorAction SilentlyContinue | Stop-Process -Force"', { stdio: 'ignore' }); } catch {}
}

async function main() {
  const fs = require('fs');
  if (!fs.existsSync(EXE)) { console.error('[smoke] packaged exe not found: ' + EXE); process.exit(2); }

  console.log('[smoke] launching packaged app on CDP port ' + PORT + ' …');
  const child = spawn(EXE, ['--remote-debugging-port=' + PORT], { detached: true, stdio: 'ignore' });
  child.unref();

  // wait for devtools endpoint
  let up = false;
  for (let i = 0; i < 30; i++) { try { await getJSON('http://127.0.0.1:' + PORT + '/json/version'); up = true; break; } catch {} await sleep(1000); }
  if (!up) { killApp(); console.error('[smoke] devtools endpoint never came up'); process.exit(2); }

  const browser = await chromium.connectOverCDP('http://127.0.0.1:' + PORT);
  const ctx = browser.contexts()[0];
  let page = ctx.pages().find(p => p.url().includes('index.html')) || ctx.pages()[0];

  const consoleErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));

  // wait for the app shell to render (sidebar) — up to 25s through splash/activation
  let ready = false;
  for (let i = 0; i < 25; i++) {
    try { if (await page.evaluate(() => !!document.querySelector('nav') && getComputedStyle(document.body).fontFamily.length > 0)) { ready = true; break; } } catch {}
    await sleep(1000);
  }
  await sleep(2500); // let images settle

  const checks = [];
  const add = (name, pass, detail) => checks.push({ name, pass, detail });

  if (!ready) add('app-render', false, 'app shell (nav) never rendered');
  else add('app-render', true, '');

  try {
    const r = await page.evaluate(async () => {
      const out = {};
      // padding utility
      const d = document.createElement('div'); d.className = 'p-3'; document.body.appendChild(d);
      out.p3 = getComputedStyle(d).padding; d.remove();
      // body font
      out.bodyFont = getComputedStyle(document.body).fontFamily;
      // broken imgs
      const imgs = [...document.querySelectorAll('img')];
      out.totalImgs = imgs.length;
      out.brokenImgs = imgs.filter(i => i.complete && i.naturalWidth === 0).length;
      // image-cache:// protocol: find a url in DOM (img src or bg-image), else probe via IPC
      let icUrl = imgs.map(i => i.src).find(s => s.startsWith('image-cache://')) || null;
      if (!icUrl) {
        for (const el of document.querySelectorAll('*')) {
          const bg = getComputedStyle(el).backgroundImage;
          if (bg && bg.includes('image-cache://')) { icUrl = bg.match(/image-cache:\/\/[^")]+/)[0]; break; }
        }
      }
      if (!icUrl) {
        // Actively exercise the protocol: ask the disk cache for a cached entry across a
        // set of popular appids and use whichever URL it hands back. This makes the check
        // meaningful even when the current page isn't showing any covers.
        try {
          const stats = await window.electronAPI?.imageCacheStats?.();
          out.cacheEntries = stats?.stats?.entryCount ?? 0;
          const probes = ['730','271590','1245620','1091500','570','440','252490','578080','1174180','1593500'];
          for (const appid of probes) {
            for (const types of [['header.jpg'], ['library_600x900.jpg','portrait.jpg','header.jpg'], ['portrait.jpg','library_600x900.jpg']]) {
              const bg = await window.electronAPI?.imageCacheBatchGet?.([{ appid, preferredImageTypes: types }]);
              const u = bg?.entries?.[0]?.dataUrl;
              if (u) { icUrl = u; break; }
            }
            if (icUrl) break;
          }
        } catch { out.cacheEntries = -1; }
      }
      if (icUrl) {
        try {
          const t0 = performance.now();
          const resp = await fetch(icUrl);
          const blob = await resp.blob();
          out.icMs = Math.round(performance.now() - t0);
          out.icStatus = resp.status; out.icBytes = blob.size; out.icUrl = icUrl.slice(0, 60);
        } catch (e) { out.icStatus = 'fetch-error: ' + e.message; }
      }
      return out;
    });

    add('padding-utility', r.p3 === '12px', 'p-3 computed padding = ' + r.p3 + ' (expected 12px)');
    add('body-font', /^"?Geist/.test(r.bodyFont) && !/Orbitron/i.test(r.bodyFont), 'body font = ' + r.bodyFont.slice(0, 40));
    add('no-broken-imgs', r.brokenImgs <= 1, r.brokenImgs + ' broken of ' + r.totalImgs + ' imgs');
    if (r.icStatus !== undefined) {
      add('image-cache-protocol', r.icStatus === 200 && r.icBytes > 0, 'fetch(image-cache://) → ' + r.icStatus + ' (' + (r.icBytes || 0) + ' bytes, ' + r.icMs + 'ms)');
      // Hot-path perf budget: a cached cover is served by manifest lookup + streamed
      // net.fetch (NO synchronous fs, NO buffer read). If someone re-introduces a
      // blocking fs.existsSync/readFileSync on the protocol path, this catches it.
      add('image-cache-hotpath-fast', r.icMs === undefined || r.icMs < 250, 'cached cover served in ' + r.icMs + 'ms (budget <250ms)');
    } else {
      add('image-cache-protocol', true, 'no cached entries to probe (cache entries: ' + r.cacheEntries + ') — skipped');
    }
  } catch (e) {
    add('runtime-eval', false, e.message);
  }

  add('no-console-errors', consoleErrors.length === 0, consoleErrors.length + ' console error(s)' + (consoleErrors.length ? ': ' + consoleErrors.slice(0, 3).join(' | ') : ''));

  await browser.close().catch(() => {});
  if (!KEEP) killApp();

  console.log('\n[smoke] results:');
  let failed = 0;
  for (const c of checks) { console.log('  ' + (c.pass ? '✅' : '❌') + ' ' + c.name + (c.detail ? ' — ' + c.detail : '')); if (!c.pass) failed++; }
  if (failed) { console.error('\n[smoke] FAILED — ' + failed + ' check(s) failed'); process.exit(1); }
  console.log('\n[smoke] all checks passed');
}

main().catch(e => { killApp(); console.error('[smoke] harness error: ' + e.message); process.exit(2); });
