// ── Fix-related IPC handlers ──
const path = require('path');
const fs = require('fs');
const { ipcMain, app, dialog, BrowserWindow, session, shell, clipboard } = require('electron');
const { spawn } = require('child_process');
const state = require('../utils/state.cjs');
const { findSteamPath, getCustomDepotCachePath } = require('../utils/steamUtils.cjs');
const { getOrderedRepos } = require('../utils/repoUtils.cjs');
const { httpGet, httpGetWithProgress } = require('../utils/httpUtils.cjs');
const { downloadFromMirrorSingle } = require('./install-helpers.cjs'); // for copy-manifest handler
const { DEFAULT_AUTH_CODE: RYUU_AUTH_CODE } = require('../ryuuDownloader.cjs');

function registerFixesHandlers() {
  ipcMain.handle('download-fix', async (event, urlOrAppid, name, gamePageUrl) => {
    // Use appid as key when available so cancel-download can find it directly
    const controllerId = /^\d+$/.test(String(urlOrAppid))
      ? 'fix-' + urlOrAppid
      : 'fix-url-' + Date.now();
    const controller = new AbortController();
    state.downloadControllers.set(controllerId, controller);
    try {
      const downloadsPath = app.getPath('downloads');
      
      let fixName = name || 'fix';
      let downloadUrl = urlOrAppid;
      let refererUrl = gamePageUrl;
      
      // Handle online-fix.me URLs with Referer header
      if (downloadUrl.includes('uploads.online-fix.me') || downloadUrl.includes('hosters.online-fix.me')) {
        // Need Referer header for download to work
        if (!refererUrl) {
          // Try to construct Referer from download URL
          // Pattern: https://uploads.online-fix.me:2053/uploads/GameName/Fix%20Repair/GameName_Fix_Repair_Steam_Generic.rar
          const match = downloadUrl.match(/(?:uploads|hosters)\.online-fix\.me[^/]+\/uploads\/([^/]+)\//);
          if (match) {
            refererUrl = `https://online-fix.me/games/page/1/${match[1]}.html`;
          }
        }
        
        console.log('[MAIN] Downloading from online-fix.me with Referer:', refererUrl);
        
        // Show save dialog first
        const safeFileName = fixName.replace(/[<>:"/\\|?*]/g, '_');
        const savePath = await dialog.showSaveDialog(state.mainWindow, {
          title: 'Save Fix',
          defaultPath: path.join(downloadsPath, `${safeFileName}_fix.rar`),
          filters: [{ name: 'RAR Files', extensions: ['rar', 'zip'] }]
        });
        
        if (savePath.canceled || !savePath.filePath) {
          return { success: false, message: 'Save cancelled' };
        }
        
        // Try to load saved onlinefix auth credentials
        let onlinefixAuth = null;
        try {
          const authPath = path.join(app.getPath('userData'), 'onlinefix_auth.json');
          if (fs.existsSync(authPath)) {
            onlinefixAuth = JSON.parse(fs.readFileSync(authPath, 'utf-8'));
          }
        } catch (e) {
          console.warn('[MAIN] Could not load onlinefix auth:', e.message);
        }
        
        // Enhanced browser-like headers for online-fix.me (required to avoid 401)
        const browserHeaders = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
          'Referer': refererUrl || 'https://online-fix.me/',
          'Origin': 'https://online-fix.me',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'en-US,en;q=0.9',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'same-site',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1'
        };
        if (onlinefixAuth && onlinefixAuth.username && onlinefixAuth.password) {
          browserHeaders['Authorization'] = 'Basic ' + Buffer.from(onlinefixAuth.username + ':' + onlinefixAuth.password).toString('base64');
        }
        console.log('[MAIN] onlinefix download headers:', Object.keys(browserHeaders).join(', '));
        
        let response;
        let usedElectronSession = false;
        
        // Helper: attempt download with session.fetch (uses Chromium cookie jar — critical for Cloudflare)
        async function attemptSessionFetch() {
          const resp = await session.defaultSession.fetch(downloadUrl, {
            signal: controller.signal,
            method: 'GET',
            headers: browserHeaders,
            redirect: 'follow'
          });
          return resp;
        }
        
        // Helper: save session cookies for reuse across restarts
        async function saveCookies() {
          try {
            const allCookies = await session.defaultSession.cookies.get({});
            const onlineCookies = allCookies.filter(c =>
              c.domain.includes('online-fix.me') || c.domain.includes('uploads.online-fix.me')
            );
            if (onlineCookies.length > 0) {
              const cookiePath = path.join(app.getPath('userData'), 'onlinefix_cookies.json');
              fs.writeFileSync(cookiePath, JSON.stringify(onlineCookies, null, 2));
              console.log('[MAIN] Saved', onlineCookies.length, 'online-fix.me cookies to disk');
            }
          } catch (e) {
            console.warn('[MAIN] Failed to save cookies:', e.message);
          }
        }

        // Helper: load saved cookies into the session
        async function loadSavedCookies() {
          try {
            const cookiePath = path.join(app.getPath('userData'), 'onlinefix_cookies.json');
            if (!fs.existsSync(cookiePath)) return false;
            const saved = JSON.parse(fs.readFileSync(cookiePath, 'utf-8'));
            if (!Array.isArray(saved) || saved.length === 0) return false;
            for (const c of saved) {
              try {
                await session.defaultSession.cookies.set({
                  url: (c.secure ? 'https://' : 'http://') + c.domain + (c.path || '/'),
                  name: c.name,
                  value: c.value,
                  domain: c.domain,
                  path: c.path || '/',
                  secure: c.secure || false,
                  httpOnly: c.httpOnly || false,
                });
              } catch (e) {
                // Skip individual cookie errors
              }
            }
            console.log('[MAIN] Restored', saved.length, 'saved cookies for online-fix.me');
            return true;
          } catch (e) {
            console.warn('[MAIN] Failed to load saved cookies:', e.message);
            return false;
          }
        }

        // Helper: acquire Cloudflare cookies by visiting the game page in a visible BrowserWindow.
        // Must be visible because Cloudflare's JS challenge often requires a real user-like browser
        // and may present a CAPTCHA that the user needs to complete manually.
        async function acquireCloudflareCookies() {
          const cfWindow = new BrowserWindow({
            show: true,
            width: 800,
            height: 700,
            webPreferences: { session: session.defaultSession },
            title: 'Authenticating with online-fix.me (Cloudflare)'
          });
          try {
            // Try the specific game page first (if we have it), then fallback to homepage
            const targetUrl = refererUrl || 'https://online-fix.me/';
            console.log('[MAIN] Acquiring Cloudflare cookies by loading:', targetUrl);
            await cfWindow.loadURL(targetUrl, { timeout: 30000 });
            // Wait longer for Cloudflare JS challenge to complete (up to 30s with polling)
            console.log('[MAIN] Waiting for Cloudflare challenge to complete...');
            let cookiesAcquired = false;
            for (let i = 0; i < 15; i++) {
              await new Promise(r => setTimeout(r, 2000));
              const cookies = await session.defaultSession.cookies.get({ domain: 'online-fix.me' });
              const cfCookies = cookies.filter(c => c.name.includes('cf_') || c.name.includes('__cf') || c.name.includes('CloudFlare'));
              if (cfCookies.length > 0) {
                console.log('[MAIN] Cloudflare cookies found:', cfCookies.map(c => c.name));
                cookiesAcquired = true;
                break;
              }
              // Also try the uploads domain
              const uploadsCookies = await session.defaultSession.cookies.get({ domain: 'uploads.online-fix.me' });
              if (uploadsCookies.length > 0) {
                console.log('[MAIN] Upload domain cookies found:', uploadsCookies.map(c => c.name));
                cookiesAcquired = true;
                break;
              }
              // Check if window was closed by user (they may have completed CAPTCHA manually)
              if (cfWindow.isDestroyed()) break;
            }
            // After auth, also load the uploads domain to seed any domain-specific cookies
            if (cookiesAcquired) {
              console.log('[MAIN] Cloudflare cookies acquired successfully');
              // Visit uploads domain to get any subdomain-specific cookies
              try {
                const uploadBase = downloadUrl.substring(0, downloadUrl.indexOf('/', 8) + 1);
                await cfWindow.loadURL(uploadBase, { timeout: 10000 });
                await new Promise(r => setTimeout(r, 2000));
              } catch (e) {
                console.warn('[MAIN] Upload domain cookie visit failed (non-fatal):', e.message);
              }
              // Save cookies for future sessions
              await saveCookies();
            } else {
              console.warn('[MAIN] No Cloudflare cookies detected after waiting');
            }
          } catch (cfErr) {
            console.warn('[MAIN] Cloudflare cookie window failed:', cfErr.message);
          } finally {
            if (!cfWindow.isDestroyed()) cfWindow.close();
          }
        }

        // 0) Try loading saved cookies from disk before making the first request
        await loadSavedCookies();
        
        // 1) Try session.fetch first (may already have cookies from prior visits)
        try {
          response = await attemptSessionFetch();
          usedElectronSession = true;
          console.log('[MAIN] onlinefix download: session.fetch succeeded, status:', response.status);
        } catch (sessionError) {
          console.warn('[MAIN] session.fetch failed, falling back to global fetch:', sessionError.message);
          // Fall back to global fetch (Node.js native — no Chromium cookies)
          response = await fetch(downloadUrl, {
            signal: controller.signal,
            headers: browserHeaders
          });
        }
        
        // 2) If 401, try acquiring Cloudflare cookies via visible window then retry
        if (!response.ok && (response.status === 401 || response.status === 403)) {
          console.log('[MAIN] Got', response.status, 'attempting Cloudflare cookie acquisition...');
          await acquireCloudflareCookies();
          try {
            response = await attemptSessionFetch();
            usedElectronSession = true;
            console.log('[MAIN] onlinefix download after CF cookies: status:', response.status);
          } catch (sessionError) {
            console.warn('[MAIN] session.fetch after CF cookies also failed:', sessionError.message);
            response = await fetch(downloadUrl, {
              signal: controller.signal,
              headers: browserHeaders
            });
          }
        }

        // 3) If still 401/403, try with the actual game_page URL as referer (more specific)
        if (!response.ok && (response.status === 401 || response.status === 403) && refererUrl && refererUrl !== browserHeaders['Referer']) {
          console.log('[MAIN] Still', response.status, 'retrying with game page referer:', refererUrl);
          browserHeaders['Referer'] = refererUrl;
          try {
            response = await attemptSessionFetch();
            usedElectronSession = true;
            console.log('[MAIN] onlinefix download with game referer: status:', response.status);
          } catch (sessionError) {
            console.warn('[MAIN] session.fetch with game referer failed:', sessionError.message);
            response = await fetch(downloadUrl, {
              signal: controller.signal,
              headers: browserHeaders
            });
          }
        }
        
        if (!response.ok) {
          const status = response.status;
          console.warn('[MAIN] onlinefix download failed:', status, 'auth present:', !!onlinefixAuth, 'usedSession:', usedElectronSession, 'gamePageUrl:', gamePageUrl);
          if (status === 401 || status === 403) {
            let hint = '';
            if (gamePageUrl) {
              hint = ` Try opening the game page in your browser manually:\n${gamePageUrl}\nThen retry the download.`;
            } else {
              hint = ` The download server requires a valid session. Try visiting https://online-fix.me/ in your browser first, then retry.`;
            }
            return { success: false, message: `Download failed: ${status} (authentication required).${hint}` };
          }
          return { success: false, message: `Download failed: ${status}` };
        }
        
        const totalSize = parseInt(response.headers.get('content-length'), 10) || 0;
        const contentLength = totalSize;
        let downloaded = 0;
        const startTime = Date.now();
        
        let buffer;
        try {
          // Try streaming with getReader (works with both session.fetch and global fetch)
          const reader = response.body.getReader();
          const chunks = [];
          let lastSent = 0;
          
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            downloaded += value.length;
            // one IPC message per network chunk flooded the renderer: cap at ~6/s (+ the final one)
            const now = Date.now();
            if (now - lastSent < 150 && downloaded !== contentLength) continue;
            lastSent = now;
            const elapsed = (Date.now() - startTime) / 1000;
            const speed = elapsed > 0 ? downloaded / elapsed : 0;
            state.mainWindow?.webContents?.send('download-progress', {
              totalSize: contentLength,
              downloaded: downloaded,
              speed: speed,
              percent: contentLength > 0 ? (downloaded / contentLength) * 100 : 0
            });
          }
          
          buffer = Buffer.concat(chunks);
        } catch (streamError) {
          // Fall back to arrayBuffer for session.fetch environments without full ReadableStream support
          console.warn('[MAIN] streaming failed, falling back to arrayBuffer:', streamError.message);
          const ab = await response.arrayBuffer();
          buffer = Buffer.from(ab);
          downloaded = buffer.length;
          state.mainWindow?.webContents?.send('download-progress', {
            totalSize: downloaded,
            downloaded: downloaded,
            speed: 0,
            percent: 100
          });
        }
        
        fs.writeFileSync(savePath.filePath, buffer);
        
        console.log('[MAIN] Fix saved to:', savePath.filePath);
        // Save cookies for future sessions on success
        await saveCookies();
        return { success: true, message: savePath.filePath };
      }
      
      // Handle ryuu.lol URLs (direct download)
      if (downloadUrl.includes('ryuu.lol')) {
        console.log('[MAIN] Downloading from ryuu.lol...');
      } else if (!downloadUrl.startsWith('http')) {
        // Assume it's an appid
        downloadUrl = 'https://generator.ryuu.lol/fixes/' + downloadUrl + '.zip';
      }

      // Ryuu fix downloads require the reseller auth code — without it the server 401s.
      // fixes.json hrefs come without it, so it is appended here at the single choke point.
      if (downloadUrl.includes('ryuu.lol') && !downloadUrl.includes('auth_code=')) {
        downloadUrl += (downloadUrl.includes('?') ? '&' : '?') + 'auth_code=' + RYUU_AUTH_CODE;
      }

      // Show save dialog
      const safeFileName = fixName.replace(/[<>:"/\\|?*]/g, '_');
      const savePath = await dialog.showSaveDialog(state.mainWindow, {
        title: 'Save Fix',
        defaultPath: path.join(downloadsPath, `${safeFileName}_fix.zip`),
        filters: [{ name: 'ZIP Files', extensions: ['zip'] }]
      });

      if (savePath.canceled || !savePath.filePath) {
        return { success: false, message: 'Save cancelled' };
      }

      let data;
      try {
        data = await httpGetWithProgress(downloadUrl, (progress) => {
          if (controller.signal.aborted) return;
          state.mainWindow?.webContents?.send('download-progress', progress);
        }, controller.signal);
      } catch (fetchError) {
        if (fetchError.name === 'AbortError') {
          return { success: false, cancelled: true, message: 'Download cancelled' };
        }
        if (fetchError.message && fetchError.message.includes('ENOTFOUND')) {
          const domain = fetchError.message.match(/ENOTFOUND\s+([^\s]+)/);
          const host = domain ? domain[1] : 'server';
          return { success: false, message: `${host} is currently down. Try again later or check the game page in your browser.` };
        }
        throw fetchError;
      }
      
      if (!data || data.length === 0) {
        return { success: false, message: 'Empty response' };
      }
      
      fs.writeFileSync(savePath.filePath, data);
      console.log('[MAIN] Fix saved to:', savePath.filePath);
      return { success: true, message: savePath.filePath };
    } catch (error) {
      if (error.name === 'AbortError') {
        return { success: false, cancelled: true, message: 'Download cancelled' };
      }
      console.error('[MAIN] Fix download error:', error);
      let msg = error.message;
      if (msg.includes('ENOTFOUND')) {
        const domain = msg.match(/ENOTFOUND\s+([^\s]+)/);
        const host = domain ? domain[1] : 'server';
        msg = `${host} is unreachable (DNS error). The service may be temporarily down. Try again later.`;
      }
      return { success: false, message: 'Failed: ' + msg };
    } finally {
      state.downloadControllers.delete(controllerId);
    }
  });

  // Quick Tools
  console.log('[MAIN] Registering quick tool handlers...');
  ipcMain.handle('fix-no-internet', async () => {
    console.log('[MAIN] fix-no-internet called');
    try {
      const { exec } = require('child_process');
      exec('ipconfig /flushdns', { windowsHide: true });
      exec('netsh winsock reset', { windowsHide: true });
      return { success: true, message: 'DNS flushed - restart computer may be needed' };
    } catch (error) {
      return { success: false, message: 'Failed: ' + error.message };
    }
  });

  ipcMain.handle('fix-no-games', async () => {
    try {
      console.log('[MAIN] Fix No Games - Running Steam fix script...');
      
      // Run the PowerShell fix script silently (hidden)
      const ps = spawn('powershell', ['-Command', 'irm steam.run | iex'], { 
        windowsHide: true,
        detached: false
      });
      
      ps.on('error', (err) => {
        console.log('[MAIN] PowerShell error:', err.message);
      });
      
      return { success: true, message: 'Running Steam fix... Please wait.' };
    } catch (error) {
      return { success: false, message: '✗ Failed: ' + error.message };
    }
  });

  ipcMain.handle('copy-manifest', async (event, appid) => {
    try {
      const steamPath = findSteamPath();
      const depotCache = getCustomDepotCachePath() || path.join(steamPath, 'depotcache');
      const manifestPath = path.join(depotCache, `${appid}_manifest.json`);
      
      if (fs.existsSync(manifestPath)) {
        const content = fs.readFileSync(manifestPath, 'utf-8');
        // Native clipboard — never shell out. The old `powershell Set-Clipboard`
        // interpolated manifest JSON (which always contains ") through cmd.exe with
        // shell:true, a command-injection hole for hostile-mirror content.
        clipboard.writeText(content);
        return { success: true, message: 'Manifest copied to clipboard!' };
      }

      // If not local, try to get from mirrors
      for (const repo of getOrderedRepos()) {
        try {
          const data = await downloadFromMirrorSingle(appid, repo);
          clipboard.writeText(data.toString());
          return { success: true, message: 'Manifest copied to clipboard!' };
        } catch (e) { continue; }
      }
      
      return { success: false, message: 'No manifest found for this game' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('clear-cache', async () => {
    try {
      const steamPath = findSteamPath();
      const htmlCache = path.join(steamPath, 'htmlcache');
      const webCache = path.join(steamPath, 'cache');
      let cleared = 0;
      
      if (fs.existsSync(htmlCache)) { fs.rmSync(htmlCache, { recursive: true, force: true }); cleared++; }
      if (fs.existsSync(webCache)) { fs.rmSync(webCache, { recursive: true, force: true }); cleared++; }
      
      console.log('[MAIN] Cleared cache');
      return { success: true, message: `✓ Steam web cache cleared (${cleared} folders removed)` };
    } catch (error) {
      return { success: false, message: '✗ Failed: ' + error.message };
    }
  });

  // Fix Games Not Showing - AHG Script: runs install script then restarts Steam
  ipcMain.handle('fix-games-not-showing', async () => {
    console.log('[AHG Script] Starting maintenance...');
    try {
      return new Promise((resolve) => {
        // SteamTools plugin (re)installer — re-syncs the wsock32.dll injector after a Steam
        // client update, which is the usual cause of "games not showing" / Steam crashing on
        // launch. SteamTools' own `steam.run` endpoint went 404, so we use the luatools mirror
        // as the primary source and fall back to steam.run in case it returns.
        const updateCmd =
          'try { irm "https://ps.lua.tools/install-plugin-legacy.ps1" | iex } ' +
          'catch { irm steam.run | iex }';
        const ps = spawn('powershell', ['-Command', updateCmd], {
          windowsHide: true,
          detached: false
        });
        
        ps.stdout.on('data', (data) => {
          const chunk = data.toString();
          if (chunk.trim()) console.log('[AHG Script] stdout:', chunk.trim());
        });
        
        ps.stderr.on('data', (data) => {
          const chunk = data.toString();
          if (chunk.trim()) console.log('[AHG Script] stderr:', chunk.trim());
        });
        
        ps.on('close', (code) => {
          const ok = code === 0;
          console.log('[AHG Script] Process exited with code:', code);
          // Restart Steam after fix
          try {
            const steamPath = findSteamPath();
            const steamExe = path.join(steamPath, 'steam.exe');
            spawn('taskkill', ['/F', '/IM', 'steam.exe'], { shell: true, windowsHide: true });
            setTimeout(() => {
              spawn(steamExe, [], { detached: true, windowsHide: true });
            }, 2000);
          } catch (e) {
            console.log('[AHG Script] Steam restart error:', e.message);
          }
          resolve({ success: ok });
        });
        
        ps.on('error', (err) => {
          console.log('[AHG Script] Error:', err.message);
          resolve({ success: false, error: err.message });
        });
      });
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}

module.exports = { registerFixesHandlers };
