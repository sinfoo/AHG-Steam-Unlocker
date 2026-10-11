#!/usr/bin/env node
// Dev tool: electron-builder on Win11 26100+ truncates the packaged EXE; restore a clean electron.exe if so.
// Usage: node scripts/fix-exe.cjs [appDir=dev-release]
const fs = require('fs'), path = require('path')
const exe = path.join(__dirname, '..', process.argv[2] || 'dev-release', 'win-unpacked', 'AHG Unlocker.exe')
const fd = fs.openSync(exe, 'r')
const po = Buffer.alloc(4); fs.readSync(fd, po, 0, 4, 0x3C)
const peO = po.readUInt32LE(0)
const coff = Buffer.alloc(20); fs.readSync(fd, coff, 0, 20, peO + 4)
const ohs = coff.readUInt16LE(16)
let maxEnd = 0
for (let i = 0; i < coff.readUInt16LE(2); i++) {
  const s = Buffer.alloc(40); fs.readSync(fd, s, 0, 40, peO + 24 + ohs + i * 40)
  maxEnd = Math.max(maxEnd, s.readUInt32LE(16) + s.readUInt32LE(20))
}
fs.closeSync(fd)
if (maxEnd > fs.statSync(exe).size) { fs.copyFileSync(path.join(__dirname, '..', 'node_modules', 'electron', 'dist', 'electron.exe'), exe); console.log('exe fixed') } else console.log('exe ok')
