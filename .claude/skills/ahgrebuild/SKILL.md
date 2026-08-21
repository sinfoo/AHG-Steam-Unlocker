---
name: ahgrebuild
description: >-
  Rebuild the AHG Unlocker app into dev-release\win-unpacked. Runs the full
  rebuild chain: TypeScript check, Vite build, syncs main.cjs/preload.cjs to
  dist-electron, then creates the unpacked Electron build. The user types
  /ahgrebuild and expects it to rebuild immediately — no questions, no
  prompts, no extra steps. Always run this when the user invokes it.
  Do NOT ask what to do — just execute the rebuild and report the result.
---

# Skill: ahgrebuild

AHG Unlocker dev rebuild command. Rebuilds the app into `dev-release\win-unpacked`.

## Build Steps (execute in order)

### 1. Build the renderer + TypeScript check
```powershell
npm run build
```
This runs `tsc --noEmit && vite build`.

### 2. Sync main.cjs / preload.cjs to dist-electron
```powershell
node scripts/sync-main.js
```
This copies `electron/main.cjs` → `dist-electron/main.cjs` and `electron/preload.cjs` → `dist-electron/preload.cjs`.

### 3. Create unpacked build in dev-release\win-unpacked
```powershell
npx electron-builder --win --dir --config.win.signAndEditExecutable=false --config.directories.output=dev-release
```
This produces the unpacked app at `dev-release\win-unpacked\`.

> **Note:** `--win` and `--config.win.signAndEditExecutable=false` prevent
> electron-builder from downloading macOS code-signing tools (winCodeSign),
> which fail on Windows when the user lacks SeCreateSymbolicLinkPrivilege
> (common without admin rights). If winCodeSign errors still appear, they are
> **cosmetic** — the Windows EXE is already packaged and asar integrity is
> updated before the signing step runs. Proceed normally.

### 3.5 Fix truncated EXE (electron-builder PE corruption workaround)
electron-builder v25.1.8 on Windows 11 build 26100+ truncates the EXE during the
"updating asar integrity" step (~50MB missing from PE sections). Detect and fix:

```powershell
node -e "
const fs = require('fs');
const path = 'dev-release/win-unpacked/AHG Unlocker.exe';
const fd = fs.openSync(path, 'r');
const peOff = Buffer.alloc(4); fs.readSync(fd, peOff, 0, 4, 0x3C);
const peO = peOff.readUInt32LE(0);
const coff = Buffer.alloc(20); fs.readSync(fd, coff, 0, 20, peO + 4);
const ohs = coff.readUInt16LE(16);
let maxEnd = 0;
for (let i = 0; i < coff.readUInt16LE(2); i++) {
  const s = Buffer.alloc(40);
  fs.readSync(fd, s, 0, 40, peO + 24 + ohs + i * 40);
  const end = s.readUInt32LE(16) + s.readUInt32LE(20);
  if (end > maxEnd) maxEnd = end;
}
fs.closeSync(fd);
const size = fs.statSync(path).size;
if (maxEnd > size) {
  console.log('EXE truncated (' + (maxEnd - size) + ' bytes missing), replacing with clean copy...');
  fs.copyFileSync('node_modules/electron/dist/electron.exe', path);
  console.log('Fixed.');
}
"
```

### 3.6 Embed the app icon (Explorer icon)
electron-builder with `signAndEditExecutable=false` skips the icon/version edit, so the exe
shows the default Electron icon in File Explorer. Re-apply it with rcedit (runs AFTER the
truncation fix so it survives an exe replacement):
```powershell
node scripts/embed-icon.cjs
```

### 4. Verify the build
```powershell
if (Test-Path 'dev-release\win-unpacked\AHG Unlocker.exe') { Write-Output 'EXE OK' } else { throw 'EXE not found' }
```

### 5. Runtime smoke test (catches packaged-only regressions)
```powershell
node scripts/smoke-packaged.cjs
```
Launches the packaged app over CDP and asserts what `tsc`/`vite` can't see: the
`image-cache://` protocol serves bytes, padding utilities apply, body font is Inter
(not the Orbitron splash font), no broken images, no console errors. Exit 0 = pass.
A non-zero exit is a **real failure** — report it; do not claim the rebuild succeeded.

## Response

After completion, respond with **exactly one line**:
- Success: `✅ Rebuilt dev-release\win-unpacked`
- On any build step failure: `❌ Rebuild failed at step N: [error summary]`
- Cosmetic winCodeSign errors in step 3 (cannot extract darwin signing tools on Windows) are NOT build failures — continue to step 3.5.

## Constraints

- **NO confirmation prompts.** Execute immediately.
- **NO verbose output.** One line response after success.
- **Run ALL steps.** Do not skip any step even if an earlier step seems sufficient.
- **If a true build step fails, stop** and report which step failed. Cosmetic winCodeSign/7z extraction errors in step 3 are not build failures.
