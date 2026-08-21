# P1.2 — Decompose electron/main.cjs (6363 lines → domain modules)

## Goal
Extract 116 IPC handlers, shared utilities, and module-level state from the monolithic `electron/main.cjs` into domain-specific modules under `electron/handlers/` and shared utilities under `electron/utils/`, leaving main.cjs as a thin orchestrator.

## Success Criteria
- main.cjs < 500 lines (from 6363)
- All IPC handlers work identically (no behavioral changes)
- Node.js syntax check passes: `node -c electron/main.cjs && node -c electron/utils/*.cjs && node -c electron/handlers/*.cjs`
- All existing `ipcMain.handle()` routes preserved

## Phase 1 — Utility Modules (foundational, extract first)

### 1. `electron/utils/state.cjs` — Shared module-level state
**Lines to extract:**
- 100-102: `let mainWindow, pythonProcess, tray`
- 104-196: `MIRROR_REPOS`, `LUATOOLS_APIS`, `MIRROR_ALT_URLS` constants
- 205-221: All cache maps (repoSpeedCache, repoNegativeCache, etc.)
- 351: `DEFAULT_STEAM_PATH`

### 2. `electron/utils/log.cjs` — Logging utilities
- Lines 70-96: `safeLog` function

### 3. `electron/utils/httpUtils.cjs` — HTTP helpers
- Generic HTTPS GET/POST utilities

### 4. `electron/utils/repoUtils.cjs` — Mirror repo utilities
- Lines 224-244: `findInCachedDepotkeys`
- Lines 246-292: `ensureRepoIndex`, `indexRepoAppids`
- Lines 295-329: `getOrderedRepos`, `recordRepoSpeed`, `recordRepoManifestCount`

### 5. `electron/utils/steamApi.cjs` — Steam API wrappers
- Lines 48-67: `fetchSteamGameCover`
- Lines 395-497: DLC cache/infos

### 6. `electron/utils/steamUtils.cjs` — Steam path/config
- Lines 351-372: `getCustomSteamConfig`, `saveCustomSteamConfig`
- Lines 531-564: `findSteamPath`

### 7. `electron/utils/pathUtils.cjs` — Path utilities
- Lines 503-529: `getResourcePath`

### 8. `electron/utils/fileUtils.cjs` — File utilities
- `copyRecursive(src, dest)`

## Phase 2 — Handler Modules

### 9. `electron/handlers/window.cjs` — Lines 576-815
- createWindow, app lifecycle, tray, window IPC

### 10. `electron/handlers/install.cjs` — Lines ~1164-2960
- install-game-with-logs, add-to-steam, tryRepoForGame, etc.

### 11. `electron/handlers/db.cjs` — Lines ~911-1090
- All db:* IPC handlers

### 12. `electron/handlers/config.cjs` — Lines ~1095-1163
- browse-path, config get/set handlers

### 13. `electron/handlers/fixes.cjs` — Lines ~2985-3350
- download-fix, extract-fix, fix-no-internet, etc.

### 14. `electron/handlers/scan.cjs` — Lines ~3488-3690
- scan-for-new-games, fetch-missing-covers, scan-new-manifests

### 15. `electron/handlers/installed.cjs` — Lines ~3694-3900
- get-installed-games, save-installed, remove-installed-game

### 16. `electron/handlers/updates.cjs` — Lines ~3900-4210
- check-for-updates, download-update, install-update

### 17. `electron/handlers/discord.cjs` — Lines ~4594-5220
- discord-login, check-discord-auth, discord-logout, OAuth

### 18. `electron/handlers/license.cjs` — Lines ~5231-5497
- check-license, activate-license, deactivate-license

### 19. `electron/handlers/user.cjs` — Lines ~5504-5968
- user-stats, achievements, collections, pinned-games, owned-games

### 20. `electron/handlers/persistence.cjs` — Lines ~4214-4592
- favorites, recent, window-state, ui-settings, schedule

### 21. `electron/handlers/steam.cjs` — Lines ~3352-3485, 6250
- restart-steam, open-steam-folder, steam-status, launch-game, refresh-steam

### 22. `electron/handlers/misc.cjs` — Lines ~6007-6361
- Remaining/stub handlers

## Phase 3 — Rewrite main.cjs (target: <500 lines)
1. Imports all utils + handlers
2. `app.whenReady()` → createWindow + register IPC
3. App lifecycle events
4. Auto-sync startup

## Execution Order
```
Phase 1 (sequential — must be first):
  [1] state.cjs     [2] log.cjs     [3] httpUtils.cjs
  [4] repoUtils.cjs  [5] steamApi.cjs  [6] steamUtils.cjs
  [7] pathUtils.cjs  [8] fileUtils.cjs

Phase 2 Batch A (parallel):
  [9] window.cjs  [10] db.cjs  [11] config.cjs  [12] steam.cjs

Phase 2 Batch B (parallel):
  [13] install.cjs  [14] fixes.cjs  [15] scan.cjs  [16] installed.cjs  [17] updates.cjs

Phase 2 Batch C (parallel):
  [18] discord.cjs  [19] license.cjs  [20] user.cjs  [21] persistence.cjs  [22] misc.cjs

Phase 3:
  [23] Rewrite main.cjs  [24] Verify  [25] Update ENHANCE.md
```
