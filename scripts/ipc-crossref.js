#!/usr/bin/env node

/**
 * scripts/ipc-crossref.js — Build-time IPC cross-reference checker
 *
 * Cross-references IPC channel strings and API method names across three layers:
 *   handlers/*.cjs  →  ipcMain.handle('CHANNEL', ...)
 *   preload.cjs     →  METHOD: (...args) => ipcRenderer.invoke('CHANNEL', ...)
 *   bridge.ts       →  api.methodName(...)  (via (window as any).electronAPI)
 *
 * Also checks send/on-based APIs (window controls, listeners).
 *
 * Usage:
 *   node scripts/ipc-crossref.js
 *   Exit 0 = all matched, Exit 1 = mismatches found
 */

const fs = require('fs')
const path = require('path')

// ── Paths ──
const ROOT = path.resolve(__dirname, '..')
const HANDLERS_DIR = path.join(ROOT, 'electron', 'handlers')
const PRELOAD_PATH = path.join(ROOT, 'electron', 'preload.cjs')
const BRIDGE_PATH = path.join(ROOT, 'src', 'bridge.ts')

// ── Regex Patterns ──
const HANDLER_RE = /ipcMain\.(?:handle|on)\(['"]([^'"]+)['"]\s*,/g

// Match methods in preload electronAPI that use ipcRenderer.invoke/send:
//   getAppPath: () => ipcRenderer.invoke('get-app-path'),
//   queryGames: (opts) => ipcRenderer.invoke('db:query-games', opts),
//   fetchDLCs: (appid, gameName) => ipcRenderer.invoke('fetch-dlcs', ...),
//   sendNotification: ({ title, body }) => ipcRenderer.invoke('send-notification', ...),
//   minimizeWindow: () => ipcRenderer.send('window-minimize'),
const PRELOAD_INVOKE_SEND_RE = /(\w+):\s*(?:async\s+)?\([^)]*\)\s*=>\s*\{?\s*ipcRenderer\.(?:invoke|send)\(['"]([^'"]+)['"]/g

// Match methods in preload electronAPI that use ipcRenderer.on (inline arrow):
//   onCoverFetchProgress: (callback) => ipcRenderer.on('cover-fetch-progress', ...),
const PRELOAD_ON_INLINE_RE = /(\w+):\s*\([^)]*\)\s*=>\s*ipcRenderer\.on\(['"]([^'"]+)['"]/g

// Match methods in preload electronAPI that use ipcRenderer.on (block body):
//   onCustomFixesUpdated: (callback) => { ipcRenderer.on('custom-fixes-updated', ...) },
// These are harder — we catch them via the PRELOAD_ON_INLINE_RE or fall back
// to scanning ipcRenderer.on inside the electronAPI block.

// Match inline ipcRenderer.on/send in main electronAPI (for block-body methods)
const PRELOAD_IPC_RE = /ipcRenderer\.(?:invoke|send|on)\(['"]([^'"]+)['"]/g

// Match bridge.ts calls: api.methodName(...) or api?.methodName(...)
const BRIDGE_CALL_RE = /api\??\.(\w+)\s*\(/g

// ── Helpers ──

function cyan(s)  { return `\x1b[36m${s}\x1b[0m` }
function green(s) { return `\x1b[32m${s}\x1b[0m` }
function yellow(s){ return `\x1b[33m${s}\x1b[0m` }
function red(s)   { return `\x1b[31m${s}\x1b[0m` }
function dim(s)   { return `\x1b[2m${s}\x1b[0m` }

function unique(arr) {
  return [...new Set(arr)]
}

function extractAll(regex, text, group = 1) {
  const results = []
  let m
  while ((m = regex.exec(text)) !== null) {
    results.push(m[group])
  }
  return results
}

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8')
  } catch (e) {
    console.error(red(`  ERROR: Cannot read ${filePath}: ${e.message}`))
    return null
  }
}

// ── Phase 1: Extract from Handler Files ──

function extractHandlers() {
  const channels = {}   // channel → file
  const sendChannels = {} // webContents.send channel → file

  let files
  try {
    files = fs.readdirSync(HANDLERS_DIR)
  } catch (e) {
    console.error(red(`  ERROR: Cannot read handlers dir ${HANDLERS_DIR}: ${e.message}`))
    return { channels: {}, count: 0, sendChannels: {} }
  }

  const SEND_RE = /\.send\(['"]([^'"]+)['"]/g

  for (const file of files) {
    if (!file.endsWith('.cjs')) continue
    const text = readFileSafe(path.join(HANDLERS_DIR, file))
    if (!text) continue

    const found = extractAll(HANDLER_RE, text)
    for (const ch of found) {
      channels[ch] = file
    }

    const sends = extractAll(SEND_RE, text)
    for (const ch of sends) {
      sendChannels[ch] = file
    }
  }

  return { channels, count: Object.keys(channels).length, sendChannels }
}

// ── Phase 2: Extract from Preload ──

/**
 * Extract the body of the electronAPI object by counting brace depth.
 * This is necessary because naive regex can't handle nested {} inside the object.
 */
function extractElectronApiBody(text) {
  const markers = [
    "exposeInMainWorld('electronAPI',",
    'exposeInMainWorld("electronAPI",',
  ]
  let startIdx = -1
  for (const m of markers) {
    startIdx = text.indexOf(m)
    if (startIdx !== -1) break
  }
  if (startIdx === -1) return null

  // Find the opening brace after the marker
  const bodyStart = text.indexOf('{', startIdx + markers[0].length)
  if (bodyStart === -1) return null

  let depth = 0
  let inString = false
  let stringChar = null
  let inTemplate = false

  for (let i = bodyStart; i < text.length; i++) {
    const ch = text[i]

    // Handle string literals
    if (!inTemplate && (ch === '"' || ch === "'")) {
      if (!inString) {
        inString = true
        stringChar = ch
      } else if (ch === stringChar && text[i - 1] !== '\\') {
        inString = false
        stringChar = null
      }
      continue
    }
    // Handle template literals
    if (!inString && ch === '`') {
      inTemplate = !inTemplate
      continue
    }
    // Handle regex literals (start with / and not comment)
    // Skip for simplicity — no regex in the electronAPI body

    if (!inString && !inTemplate) {
      if (ch === '{') {
        depth++
      } else if (ch === '}') {
        depth--
        if (depth === 0) {
          return text.substring(bodyStart + 1, i)
        }
      }
    }
  }

  return null
}

function extractPreload() {
  const text = readFileSafe(PRELOAD_PATH)
  if (!text) return { invokeMethods: {}, onMethods: {}, inlineOn: [], count: 0 }

  const invokeMethods = {}
  const onMethods = {}

  // Extract the electronAPI object body using brace-depth parsing
  const apiBody = extractElectronApiBody(text)
  if (!apiBody) {
    console.error(red('  ERROR: Could not locate electronAPI object body in preload.cjs'))
    return { invokeMethods, onMethods, inlineOn: [], count: 0 }
  }

  // Split into individual method entries
  // Each entry starts (possibly indented) with `methodName: (` or `methodName: async (`
  // We find all method positions, then slice entries between adjacent positions.
  const methodStartRe = /(?:^|\n)\s*(\w+):\s*(?:async\s+)?\(/gm
  const methodMatches = [...apiBody.matchAll(methodStartRe)]

  const entries = []
  for (let i = 0; i < methodMatches.length; i++) {
    const start = methodMatches[i].index
    const end = i + 1 < methodMatches.length ? methodMatches[i + 1].index : apiBody.length
    entries.push(apiBody.substring(start, end))
  }

  for (const entry of entries) {
    // Entry starts with `\n  methodName:` due to how we slice, so allow leading whitespace
    const nameMatch = entry.match(/^\s*(\w+):/)
    if (!nameMatch) continue
    const name = nameMatch[1]

    // Skip non-IPC properties
    if (name === 'platform' || name === 'isPackaged') continue

    // Check for ipcRenderer.invoke, .send, or .on
    const ipcMatch = entry.match(/ipcRenderer\.(invoke|send|on)\(['"]([^'"]+)['"]/)
    if (ipcMatch) {
      const ipcType = ipcMatch[1]
      const channel = ipcMatch[2]
      if (ipcType === 'invoke' || ipcType === 'send') {
        invokeMethods[name] = channel
      } else if (ipcType === 'on') {
        onMethods[name] = channel
      }
    }
    // Methods with no ipcRenderer call (e.g. fetchImage) are silently skipped
  }

  // Collect all ipcRenderer.on channels for cross-checking
  const allOnChannels = [...text.matchAll(/ipcRenderer\.on\(['"]([^'"]+)['"]/g)]
    .map(m => m[1])
  const exposedChannels = new Set(Object.values(onMethods))
  const inlineOn = allOnChannels.filter(ch => !exposedChannels.has(ch))

  return {
    invokeMethods,   // method → channel (from ipcRenderer.invoke/send)
    onMethods,       // method → channel (exposed on* methods using ipcRenderer.on)
    inlineOn,        // channels used in ipcRenderer.on that are NOT exposed methods
    count: Object.keys(invokeMethods).length + Object.keys(onMethods).length
  }
}

// ── Phase 3: Extract from Bridge.ts ──

function extractBridge() {
  const text = readFileSafe(BRIDGE_PATH)
  if (!text) return { methods: [], count: 0 }

  const called = extractAll(BRIDGE_CALL_RE, text)
  return { methods: unique(called), count: unique(called).length }
}

// ── Analysis ──

function crossref(handlers, preload, bridge) {
  const issues = []

  // ── Channel match: handlers (ipcMain.handle/on) ↔ preload.invoke ──
  const handlerChannels = new Set(Object.keys(handlers.channels))
  const preloadInvokeChannels = new Set(Object.values(preload.invokeMethods))
  const preloadOnChannelsSet = new Set(Object.values(preload.onMethods))
  const preloadAllChannels = new Set([...preloadInvokeChannels, ...preloadOnChannelsSet])

  // Channels in handlers but NOT in preload (handler has no preload counterpart)
  const handlerOrphans = [...handlerChannels].filter(ch => !preloadAllChannels.has(ch))
  for (const ch of handlerOrphans) {
    issues.push({ type: 'HANDLER_ORPHAN', severity: 'error', channel: ch, detail: `Handler ${handlers.channels[ch]} registers '${ch}' but preload has no matching invoke/on` })
  }

  // Channels in preload.invoke but NOT in handlers (invoke-only, should have handler)
  const invokeOrphans = [...preloadInvokeChannels].filter(ch => !handlerChannels.has(ch))
  for (const ch of invokeOrphans) {
    const method = Object.entries(preload.invokeMethods).find(([,v]) => v === ch)?.[0]
    issues.push({ type: 'PRELOAD_INVOKE_ORPHAN', severity: 'error', channel: ch, detail: `Preload method '${method}' invokes '${ch}' but no handler registers ipcMain.handle for it` })
  }

  // Channels in preload.on but NOT in handlers AND NOT in webContents.send
  const sendChannelsSet = new Set(Object.keys(handlers.sendChannels))
  const onOrphans = [...preloadOnChannelsSet].filter(ch => !handlerChannels.has(ch) && !sendChannelsSet.has(ch))
  for (const ch of onOrphans) {
    const method = Object.entries(preload.onMethods).find(([,v]) => v === ch)?.[0]
    issues.push({ type: 'PRELOAD_ON_ORPHAN', severity: 'error', channel: ch, detail: `Preload method '${method}' listens for '${ch}' via ipcRenderer.on() but no handler sends it via webContents.send()` })
  }

  // Preload.on channels that DO have matching webContents.send — info only
  const onMatched = [...preloadOnChannelsSet].filter(ch => !handlerChannels.has(ch) && sendChannelsSet.has(ch))
  for (const ch of onMatched) {
    const method = Object.entries(preload.onMethods).find(([,v]) => v === ch)?.[0]
    issues.push({ type: 'PRELOAD_ON_MATCHED', severity: 'info', channel: ch, detail: `Preload '${method}' listens for '${ch}' → handler ${handlers.sendChannels[ch]} sends it via webContents.send() (expected pattern)` })
  }

  // ── Method match: preload ↔ bridge.ts ──
  const preloadMethods = new Set([...Object.keys(preload.invokeMethods), ...Object.keys(preload.onMethods)])
  const bridgeMethods = new Set(bridge.methods)

  // Methods in preload but NOT in bridge.ts
  const preloadMethodOrphans = [...preloadMethods].filter(m => !bridgeMethods.has(m))
  for (const m of preloadMethodOrphans) {
    const ch = preload.invokeMethods[m] || preload.onMethods[m]
    issues.push({ type: 'PRELOAD_METHOD_ORPHAN', severity: 'warning', method: m, channel: ch, detail: `Preload exposes '${m}' (→ '${ch}') but bridge.ts never calls it` })
  }

  // Methods in bridge.ts but NOT in preload
  const bridgeMethodOrphans = [...bridgeMethods].filter(m => !preloadMethods.has(m))
  for (const m of bridgeMethodOrphans) {
    issues.push({ type: 'BRIDGE_METHOD_ORPHAN', severity: 'error', method: m, detail: `Bridge.ts calls 'api.${m}()' but preload does not expose '${m}'` })
  }

  return issues
}

// ── Formatted Output ──

function printSummary(handlers, preload, bridge) {
  const handlerChCount = handlers.count
  const preloadInvokeCount = Object.keys(preload.invokeMethods).length
  const preloadOnCount = Object.keys(preload.onMethods).length
  const bridgeCount = bridge.count

  console.log()
  console.log(cyan('╔══════════════════════════════════════════════════════════╗'))
  console.log(cyan('║      IPC Cross-Reference Report                        ║'))
  console.log(cyan('╚══════════════════════════════════════════════════════════╝'))
  console.log()

  // ── Layer Summary Table ──
  console.log(dim('┌──────────────────────┬────────┬──────────────────────────┐'))
  console.log(dim('│ Layer                │ Count  │ Details                  │'))
  console.log(dim('├──────────────────────┼────────┼──────────────────────────┤'))
  console.log(`│ ${'electron/handlers/*.cjs'.padEnd(20)} │ ${String(handlerChCount).padEnd(6)} │ ipcMain.handle/on channels │`)
  console.log(`│ ${'electron/preload.cjs'.padEnd(20)} │ ${String(preloadInvokeCount).padEnd(6)} │ ipcRenderer.invoke methods │`)
  console.log(`│ ${'electron/preload.cjs'.padEnd(20)} │ ${String(preloadOnCount).padEnd(6)} │ ipcRenderer.on methods     │`)
  console.log(`│ ${'src/bridge.ts'.padEnd(20)} │ ${String(bridgeCount).padEnd(6)} │ api.method() calls         │`)
  console.log(dim('└──────────────────────┴────────┴──────────────────────────┘'))
  console.log()
}

function printIssues(issues) {
  const errors = issues.filter(i => i.severity === 'error')
  const warnings = issues.filter(i => i.severity === 'warning')
  const infos = issues.filter(i => i.severity === 'info')

  if (errors.length === 0 && warnings.length === 0) {
    console.log(green('  ✅  ALL IPC LAYERS SYNCHRONIZED — NO ISSUES'))
    console.log()
    if (infos.length > 0) {
      for (const item of infos) {
        console.log(`  ${dim('ℹ')} ${item.detail}`)
      }
      console.log()
    }
    return
  }

  // Group by type
  const groupByType = (items) => {
    const groups = {}
    for (const iss of items) {
      if (!groups[iss.type]) groups[iss.type] = []
      groups[iss.type].push(iss)
    }
    return groups
  }

  const errorGroups = groupByType(errors)
  const warningGroups = groupByType(warnings)

  if (errors.length > 0) {
    console.log(red(`  ❌  ${errors.length} error(s) — must fix:`))
    console.log()
    for (const [type, items] of Object.entries(errorGroups)) {
      const label = {
        HANDLER_ORPHAN:         'Handler → Preload: Missing invoke/on',
        PRELOAD_INVOKE_ORPHAN:  'Preload → Handler: Missing ipcMain.handle',
        PRELOAD_ON_ORPHAN:      'Preload → Handler: ipcRenderer.on without webContents.send',
        BRIDGE_METHOD_ORPHAN:   'Bridge → Preload:  Missing preload method',
      }[type] || type
      console.log(yellow(`  ▸ ${label} (${items.length})`))
      for (const item of items) {
        console.log(`    ${dim('•')} ${item.detail}`)
      }
      console.log()
    }
  }

  if (warnings.length > 0) {
    console.log(yellow(`  ⚠  ${warnings.length} warning(s) — review:`))
    console.log()
    for (const [type, items] of Object.entries(warningGroups)) {
      const label = {
        PRELOAD_METHOD_ORPHAN: 'Preload → Bridge:  Unused preload method',
      }[type] || type
      console.log(yellow(`  ▸ ${label} (${items.length})`))
      for (const item of items) {
        console.log(`    ${dim('•')} ${item.detail}`)
      }
      console.log()
    }
  }

  if (infos.length > 0) {
    console.log(dim(`  ℹ  ${infos.length} info(s) — expected patterns:`))
    console.log()
    for (const [type, items] of Object.entries(groupByType(infos))) {
      for (const item of items) {
        console.log(`    ${dim('•')} ${item.detail}`)
      }
    }
    console.log()
  }
}

function printMatched(handlers, preload, bridge) {
  const handlerChannels = Object.keys(handlers.channels).sort()
  const preloadInvokeChannels = Object.values(preload.invokeMethods).sort()
  const preloadOnChannels = Object.values(preload.onMethods).sort()

  console.log(dim('── Handler Channels ──'))
  for (const ch of handlerChannels) {
    console.log(`  ${dim('H')} ${ch} ${dim('←')} ${handlers.channels[ch]}`)
  }

  console.log()
  console.log(dim('── Preload Invoke Channels ──'))
  for (const [method, ch] of Object.entries(preload.invokeMethods).sort((a,b) => a[0].localeCompare(b[0]))) {
    console.log(`  ${dim('P')} ${ch} ${dim('← method:')} ${method}`)
  }

  if (Object.keys(preload.onMethods).length > 0) {
    console.log()
    console.log(dim('── Preload on/send Channels ──'))
    for (const [method, ch] of Object.entries(preload.onMethods).sort((a,b) => a[0].localeCompare(b[0]))) {
      console.log(`  ${dim('P')} ${ch} ${dim('← method:')} ${method}`)
    }
  }

  console.log()
  console.log(dim('── Bridge Method Calls ──'))
  for (const m of bridge.methods.sort()) {
    console.log(`  ${dim('B')} ${m}()`)
  }
  console.log()
}

// ── Main ──

function main() {
  console.log(dim('ipc-crossref.js — scanning IPC layers...'))

  const handlers = extractHandlers()
  const preload = extractPreload()
  const bridge = extractBridge()

  printSummary(handlers, preload, bridge)

  const issues = crossref(handlers, preload, bridge)
  printIssues(issues)

  const verbose = process.argv.includes('--verbose') || process.argv.includes('-v')
  if (verbose) {
    printMatched(handlers, preload, bridge)
  }

  // ── Exit code (errors only) ──
  const errorCount = issues.filter(i => i.severity === 'error').length
  const warningCount = issues.filter(i => i.severity === 'warning').length
  const infoCount = issues.filter(i => i.severity === 'info').length

  if (errorCount > 0) {
    console.log(red(`  → ${errorCount} error(s) found. IPC layers have synchronization gaps.`))
    if (warningCount > 0) console.log(yellow(`  → ${warningCount} warning(s) — review suggested.`))
    console.log()
    process.exit(1)
  } else if (warningCount > 0) {
    console.log(yellow(`  → ${warningCount} warning(s) — no errors, but review suggested.`))
    console.log()
    process.exit(0)
  } else {
    console.log(green('  → All IPC channels and methods are synchronized across all layers.'))
    console.log()
    process.exit(0)
  }
}

main()
