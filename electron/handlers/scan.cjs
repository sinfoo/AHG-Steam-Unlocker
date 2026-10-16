// ── Game scanning and cover-fetch IPC handlers ──
const path = require('path');
const fs = require('fs');
const { ipcMain, app } = require('electron');
const db = require('../db.cjs');
const state = require('../utils/state.cjs');
const { getOrderedRepos, downloadDepotKeys, MIRROR_REPOS } = require('../utils/repoUtils.cjs');
const { fetchSteamGameCover } = require('../utils/steamApi.cjs');
const { wrapHandler } = require('../utils/rateLimiter.cjs');

function registerScanHandlers() {
  // Scan for New Games - checks manifest repos for new entries (stored in SQLite)
  ipcMain.handle('scan-for-new-games', wrapHandler('scan-for-new-games', async () => {
    console.log('[MAIN] scan-for-new-games called');
    try {
      // Build lookup from existing games in SQLite (authoritative)
      const existingIds = new Set();
      const allIds = db.getAllGameIds();
      for (const entry of allIds) {
        existingIds.add(entry.appid);
      }
      
      let newGamesList = [];
      const totalRepos = MIRROR_REPOS.length;
      let reposScanned = 0;
      
      // Scan mirrors for new manifests
      for (const repo of getOrderedRepos()) {
        try {
          console.log('[MAIN] Scanning repo:', repo);
          
          // Send progress
          if (state.mainWindow) state.mainWindow.webContents.send('scan-progress', { 
            progress: Math.round((reposScanned / totalRepos) * 100), 
            status: `Scanning ${repo}...` 
          });
          
          // Download depotkeys.json
          const depotKeysData = await downloadDepotKeys(repo);
          const depotKeys = JSON.parse(depotKeysData.toString());
          
          console.log('[MAIN] Found', Object.keys(depotKeys).length, 'entries in depotkeys');
          
          // Collect new appids and build game objects
          for (const [appid, appData] of Object.entries(depotKeys)) {
            if (!existingIds.has(appid) && /^\d+$/.test(appid)) {
              const name = appData.name || appData.common_name || appData.game_name || appData.title || `App ${appid}`;
              
              let size = appData.size || appData.total_size || appData.cb_disk_original || null;
              if (size && typeof size === 'string') size = parseInt(size, 10);
              if (size && isNaN(size)) size = null;
              
              const gameObj = {
                appid: appid,
                name: name,
                type: 'game',
                header_image: `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/header.jpg`,
                tags: appData.tags || [],
                size: size || undefined,
                added_date: new Date().toISOString(),
              };
              
              // Write to SQLite
              try { db.upsertGame(gameObj); } catch (e) { /* skip */ }
              
              newGamesList.push(gameObj);
              existingIds.add(appid);
            }
          }
          
          reposScanned++;
          
          if (newGamesList.length > 0) {
            console.log('[MAIN] Found', newGamesList.length, 'new games from', repo);
            break; // Stop after first successful repo
          }
        } catch (e) {
          console.log('[MAIN] Repo scan failed:', repo, '-', e.message);
          reposScanned++;
          continue;
        }
      }
      
      // Send completion
      if (state.mainWindow) state.mainWindow.webContents.send('scan-progress', { 
        progress: 100, 
        status: newGamesList.length > 0 ? `Found ${newGamesList.length} new games!` : 'Scan complete' 
      });
      
      if (newGamesList.length > 0) {
        // Persist SQLite changes
        try { db.persist(); } catch (e) { console.warn('[MAIN] SQLite persist error:', e.message); }
        
        // Save to recently added file (for UI tracking)
        const userDataPath = app.getPath('userData');
        const recentAddedFile = path.join(userDataPath, 'recently_added.json');
        let recentAdded = [];
        try {
          if (fs.existsSync(recentAddedFile)) {
            recentAdded = JSON.parse(await fs.promises.readFile(recentAddedFile, 'utf-8'));
          }
        } catch (e) {
          console.error('[SCAN] Error reading recently added file:', e.message);
        }
        
        recentAdded = [...newGamesList, ...recentAdded].slice(0, 100);
        await fs.promises.writeFile(recentAddedFile, JSON.stringify(recentAdded));
        
        // Verify cover URLs for newly added games via Steam API
        console.log('[MAIN] Verifying covers for', newGamesList.length, 'new games...');
        for (const game of newGamesList) {
          const realCover = await fetchSteamGameCover(game.appid);
          if (realCover) {
            game.header_image = realCover;
            try { db.updateGameCover(game.appid, realCover); } catch (e) { /* skip */ }
          }
          // Small delay to avoid Steam API rate limits
          await new Promise(r => setTimeout(r, 300));
        }
        try { db.persist(); } catch (e) { console.warn('[MAIN] SQLite persist error:', e.message); }
        console.log('[MAIN] Cover verification complete');
      }
      
      return { success: true, found: newGamesList.length, added: newGamesList };
    } catch (error) {
      console.log('[MAIN] scan-for-new-games error:', error);
      if (state.mainWindow) state.mainWindow.webContents.send('scan-progress', { progress: 0, status: 'Error: ' + error.message });
      return { success: false, error: error.message };
    }
  }, { windowMs: 30000, maxCalls: 1 }));

  // Fetch missing game covers — queries SQLite for empty headers and fetches from Steam API
  ipcMain.handle('fetch-missing-covers', wrapHandler('fetch-missing-covers', async () => {
    console.log('[MAIN] fetch-missing-covers called');
    try {
      // Find games with missing/empty header_image from SQLite (authoritative)
      let gamesArray;
      let existingIds = new Set();
      const result = db.queryGames({ limit: 999999, sort: 'name_asc' });
      gamesArray = result.games || [];
      existingIds = new Set(gamesArray.map(g => g.appid));
      
      const missing = gamesArray.filter((g) => !g.header_image || g.header_image.trim() === '');
      console.log('[MAIN] Games missing cover:', missing.length);
      
      // Also check for fix games not in the DB
      let fixesMissing = [];
      try {
        const allFixes = db.getAllFixes();
        fixesMissing = allFixes.filter(f => !existingIds.has(f.appid));
        console.log('[MAIN] Fix games not in DB:', fixesMissing.length);
      } catch (e) { /* skip */ }
      
      if (missing.length > 0 && state.mainWindow) {
        state.mainWindow.webContents.send('cover-fetch-progress', {
          progress: 0,
          status: `Fetching covers for ${missing.length} games...`
        });
      }
      
      let fixed = 0;
      
      // Fetch real covers for missing entries
      for (let i = 0; i < missing.length; i++) {
        const game = missing[i];
        const realCover = await fetchSteamGameCover(game.appid);
        const coverUrl = realCover || `https://cdn.akamai.steamstatic.com/steam/apps/${game.appid}/header.jpg`;
        
        try { db.updateGameCover(game.appid, coverUrl); } catch (e) { /* skip */ }
        fixed++;
        
        if (state.mainWindow && (i + 1) % 10 === 0) {
          state.mainWindow.webContents.send('cover-fetch-progress', {
            progress: Math.round(((i + 1) / Math.max(missing.length, 1)) * 100),
            status: `Fetched ${i + 1}/${missing.length} covers...`
          });
        }
        
        await new Promise(r => setTimeout(r, 300));
      }
      
      // Add missing fix games to SQLite
      for (const f of fixesMissing) {
        try {
          db.upsertGame({
            appid: f.appid,
            name: f.name || `App ${f.appid}`,
            header_image: `https://cdn.akamai.steamstatic.com/steam/apps/${f.appid}/header.jpg`,
            type: 'game',
            tags: [],
            nsfw: false,
            drm: false,
            dlc: [],
            added_date: new Date().toISOString(),
            updated_date: new Date().toISOString(),
          });
        } catch (e) { /* skip */ }
        fixed++;
      }
      
      // Persist all changes
      try { db.persist(); } catch (e) { console.warn('[MAIN] SQLite persist error:', e.message); }
      
      console.log('[MAIN] fetch-missing-covers complete: fixed', fixed);
      if (state.mainWindow) {
        state.mainWindow.webContents.send('cover-fetch-progress', {
          progress: 100,
          status: `Fixed ${fixed} game covers`
        });
      }
      
      return { success: true, scanned: gamesArray.length, fixed };
    } catch (error) {
      console.log('[MAIN] fetch-missing-covers error:', error);
      return { success: false, error: error.message };
    }
  }, { windowMs: 30000, maxCalls: 1 }));
}

module.exports = { registerScanHandlers };
