#!/usr/bin/env node
// Dev tool: screenshot pages of the PACKAGED app (dev-release/win-unpacked) over CDP.
// Usage: node scripts/shot-app.cjs <outDir> [Home Browse Library Favourites Recent Fixes Settings]
// Env: APP_DIR (default dev-release; build elsewhere with --config.directories.output=<dir>), PORT (default 9455).
// Only the instance it spawns is killed, so parallel runs with different APP_DIR/PORT don't collide.
// Viewport 1600x2300 (tall, so the whole page scroll area is visible, like the prototype shots).
const path = require('path'), http = require('http'), fs = require('fs')
const { spawn, execSync } = require('child_process')
const ROOT = path.join(__dirname, '..')
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright-core'))
const sleep = ms => new Promise(r => setTimeout(r, ms))
const get = u => new Promise((res, rej) => { http.get(u, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(d)) }).on('error', rej) })
let child
const kill = () => { try { if (child) execSync('taskkill /PID ' + child.pid + ' /T /F', { stdio: 'ignore' }) } catch {} }
const OUT = process.argv[2] || path.join(ROOT, 'shots')
const PAGES = process.argv.slice(3).length ? process.argv.slice(3) : ['Home', 'Browse', 'Library', 'Favourites', 'Recent', 'Fixes', 'Settings']
const PORT = Number(process.env.PORT || 9455)
const APP_DIR = process.env.APP_DIR || 'dev-release'
;(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  child = spawn(path.join(ROOT, APP_DIR, 'win-unpacked', 'AHG Unlocker.exe'), ['--remote-debugging-port=' + PORT], { detached: true, stdio: 'ignore' }); child.unref()
  for (let i = 0; i < 100; i++) { try { await get(`http://127.0.0.1:${PORT}/json/version`); break } catch { await sleep(200) } }
  const b = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`)
  const page = b.contexts()[0].pages()[0]
  const cdp = await b.contexts()[0].newCDPSession(page)
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 2300, deviceScaleFactor: 1, mobile: false })
  for (let i = 0; i < 120; i++) { if (await page.evaluate(() => document.getElementById('loadingScreen')?.classList.contains('hidden') && !!document.querySelector('nav')).catch(() => false)) break; await sleep(500) }
  await sleep(3000)
  // sidebar labels are translated; match by nav position instead of text: Home, Browse, Fixes, Library, Favourites, Recent, then Settings
  const order = { Home: 0, Browse: 1, Fixes: 2, Library: 3, Favourites: 4, Recent: 5 }
  for (const n of PAGES) {
    try {
      if (n === 'Settings') await page.evaluate(() => { const bs = [...document.querySelectorAll('nav button')]; bs.find(x => /settings/i.test(x.title || x.textContent))?.click() })
      else await page.evaluate(i => { document.querySelectorAll('nav button.v2-nav')[i]?.click() }, order[n])
      await sleep(2500)
      await page.screenshot({ path: path.join(OUT, n + '.png') })
      console.log('shot', n)
    } catch (e) { console.log('fail', n, e.message.slice(0, 80)) }
  }
  kill(); process.exit(0)
})()
