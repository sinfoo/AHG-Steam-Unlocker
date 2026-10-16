#!/usr/bin/env node
// ── Packaged-build perf + leak probe ──
// Launches the packaged app over CDP, then:
//   • startup: time until the app shell (nav) renders
//   • navigation: cycles every sidebar page N rounds, timing click -> two painted frames
//   • long tasks (>50ms) on the renderer main thread during the run
//   • JS heap after a forced GC, per round (steady growth across rounds = leak)
//   • total working set of all app processes at the end
// Usage: node scripts/perf-packaged.cjs [--rounds 4] [--port 9370]   (AHG_SMOKE_EXE overrides the exe)
const path = require('path');
const http = require('http');
const { spawn, execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const EXE = process.env.AHG_SMOKE_EXE || path.join(ROOT, 'dev-release', 'win-unpacked', 'AHG Unlocker.exe');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i !== -1 ? Number(process.argv[i + 1]) : d; };
const PORT = arg('--port', 9370);
const ROUNDS = arg('--rounds', 4);
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright-core'));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const up = () => new Promise(r => { const q = http.get(`http://127.0.0.1:${PORT}/json/version`, s => { s.resume(); r(true); }); q.on('error', () => r(false)); q.setTimeout(1000, () => { q.destroy(); r(false); }); });
const kill = () => { try { execSync(`powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name='AHG Unlocker.exe'\\" | Where-Object ExecutablePath -eq '${EXE.replace(/'/g, "''")}' | % { Stop-Process -Id $_.ProcessId -Force }"`, { stdio: 'ignore' }); } catch {} };
const MB = (b) => (b / 1048576).toFixed(1) + ' MB';

(async () => {
  kill();
  const t0 = Date.now();
  spawn(EXE, [`--remote-debugging-port=${PORT}`], { detached: true, stdio: 'ignore' }).unref();
  for (let i = 0; i < 40 && !(await up()); i++) await sleep(500);
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
  const ctx = browser.contexts()[0];
  let page = ctx.pages().find(p => p.url().includes('index.html')) || ctx.pages()[0];
  await page.waitForFunction(() => !!document.querySelector('nav button'), null, { timeout: 60000 });
  const startup = Date.now() - t0;
  await sleep(3000);

  const cdp = await ctx.newCDPSession(page);
  await cdp.send('HeapProfiler.enable');
  const heap = async () => { await cdp.send('HeapProfiler.collectGarbage'); await sleep(300); return (await cdp.send('Runtime.getHeapUsage')).usedSize; };

  await page.evaluate(() => {
    window.__longTasks = [];
    new PerformanceObserver(l => l.getEntries().forEach(e => window.__longTasks.push(Math.round(e.duration)))).observe({ type: 'longtask', buffered: false });
  });

  const navCount = await page.evaluate(() => document.querySelectorAll('nav button.v2-nav').length);
  const baseline = await heap();
  const navTimes = {};
  const heaps = [];
  for (let r = 0; r < ROUNDS; r++) {
    for (let i = 0; i < navCount; i++) {
      const res = await page.evaluate(async (idx) => {
        const b = document.querySelectorAll('nav button.v2-nav')[idx];
        if (!b) return null;
        const label = (b.getAttribute('title') || b.textContent || '').trim().slice(0, 24);
        const s = performance.now();
        b.click();
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        return { label, ms: performance.now() - s };
      }, i);
      if (res) (navTimes[res.label] ||= []).push(res.ms);
      await sleep(600);
    }
    heaps.push(await heap());
  }
  const longTasks = await page.evaluate(() => window.__longTasks);

  const ws = execSync(`powershell -NoProfile -Command "(Get-CimInstance Win32_Process -Filter \\"Name='AHG Unlocker.exe'\\" | Where-Object ExecutablePath -eq '${EXE.replace(/'/g, "''")}' | Measure-Object WorkingSetSize -Sum).Sum"`).toString().trim();

  console.log(`startup to shell: ${startup} ms`);
  console.log(`nav pages: ${navCount}, rounds: ${ROUNDS}`);
  for (const [k, v] of Object.entries(navTimes)) {
    const s = [...v].sort((a, b) => a - b);
    console.log(`  ${k.padEnd(24)} first ${v[0].toFixed(0)} ms | median ${s[Math.floor(s.length / 2)].toFixed(0)} ms | max ${s[s.length - 1].toFixed(0)} ms`);
  }
  console.log(`long tasks: ${longTasks.length} total, ${longTasks.filter(d => d > 200).length} over 200ms, worst ${Math.max(0, ...longTasks)} ms`);
  console.log(`heap after GC: baseline ${MB(baseline)} -> rounds ${heaps.map(MB).join(' -> ')}`);
  console.log(`working set (all processes): ${MB(Number(ws))}`);
  await browser.close().catch(() => {});
  kill();
})().catch(e => { console.error('perf probe failed:', e.message); kill(); process.exit(1); });
