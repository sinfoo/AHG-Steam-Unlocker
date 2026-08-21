// ── Discord authentication IPC handlers ──
const path = require('path');
const fs = require('fs');
const http = require('http');
const { ipcMain, app, shell } = require('electron');
const state = require('../utils/state.cjs');
const { wrapHandler } = require('../utils/rateLimiter.cjs');
const { secrets, secretsDiag, DISCORD_CLIENT_ID } = require('../utils/secrets.cjs');

const APP_VERSION = require('../../package.json').version;

// ── Constants ──
// The guild ID is fixed and authoritative. It used to be resolved at runtime from
// an invite code, which silently broke once that invite expired: resolution failed,
// the ID stayed null, and membership fell back to matching the guild *name*
// 'AHG Unlocker' — but the server is named 'AHG Script', so isInGuild was always false.
const DISCORD_GUILD_ID = '1251277120999784559';
const DISCORD_CHANNEL_ID = '1502571428757635092';
const DISCORD_REDIRECT_PORT = 18765;

// Invites do expire, so this stays overridable from secrets.json without a rebuild.
const DISCORD_INVITE_URL = 'https://discord.gg/' + (secrets.discordInvite || 'GGB4TzDxY9');

// ── Module-level state ──
let discordAuthData = null;
let discordOAuthServer = null;

// ── Helper: is this user a member of the AHG guild? ──
function isMemberOfGuild(guilds) {
  return Array.isArray(guilds) && guilds.some(function (g) { return g.id === DISCORD_GUILD_ID; });
}

// ── Helper: save auth to disk ──
function saveDiscordAuth(authData) {
  try {
    const authFile = path.join(app.getPath('userData'), 'discord_auth.json');
    fs.writeFileSync(authFile, JSON.stringify(authData, null, 2));
    discordAuthData = authData;
    return true;
  } catch (e) {
    console.error('[DISCORD] Error saving auth:', e.message);
    return false;
  }
}

// ── Helper: load auth from disk ──
function loadDiscordAuth() {
  try {
    const authFile = path.join(app.getPath('userData'), 'discord_auth.json');
    if (fs.existsSync(authFile)) {
      const data = JSON.parse(fs.readFileSync(authFile, 'utf-8'));
      discordAuthData = data;
      return data;
    }
  } catch (e) {
    console.error('[DISCORD] Error loading auth:', e.message);
  }
  return null;
}

// ── Helper: clear auth from disk ──
function clearDiscordAuth() {
  try {
    const authFile = path.join(app.getPath('userData'), 'discord_auth.json');
    if (fs.existsSync(authFile)) fs.unlinkSync(authFile);
    discordAuthData = null;
  } catch (e) {
    console.error('[DISCORD] Error clearing Discord auth:', e.message);
  }
}

// ── Helper: Discord API fetch with Bearer token ──
function discordFetchWithToken(endpoint, token) {
  return fetch('https://discord.com/api/v10' + endpoint, {
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
    }
  }).then(function(r) {
    if (!r.ok) {
      console.error('[DISCORD] API call to ' + endpoint + ' failed: HTTP', r.status);
      return null;
    }
    return r.json();
  }).catch(function(err) {
    console.error('[DISCORD] API call to ' + endpoint + ' network error:', err.message);
    return null;
  });
}

// ── Helper: OAuth callback HTTP server ──
function startOAuthCallbackServer() {
  return new Promise(function(resolve, reject) {
    try {
      if (discordOAuthServer) { try { discordOAuthServer.close(); } catch(e) {
        console.error('[DISCORD] Error closing OAuth server:', e.message);
      } }
      var http = require('http');
      var callbackProcessed = false; // Guard flag for stray requests after callback handled
      var server = http.createServer(function(req, res) {
        try {
          // If callback already processed, return OK for stray requests (favicon, preloads, etc.)
          if (callbackProcessed) {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('OK');
            return;
          }
          var u = new URL(req.url, 'http://localhost:' + DISCORD_REDIRECT_PORT);
          if (u.pathname === '/callback' && u.searchParams.get('code')) {
            var code = u.searchParams.get('code');
            console.log('[DISCORD] OAuth callback received, code length:', code.length);
            res.writeHead(200, { 'Content-Type': 'text/html' });
            // End response immediately, then close server after short delay to
            // handle any stray requests (browser favicon, preload, etc.) that arrive
            // while the server is still accepting connections. This prevents the
            // race condition where a stray request hits a closing server.
            callbackProcessed = true;
            res.end('<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connected - AHG Unlocker</title><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#030308;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen,Ubuntu,Cantarell,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;overflow:hidden}.card{background:linear-gradient(180deg,rgba(15,15,30,.95) 0%,rgba(5,5,15,.98) 100%);border:1px solid rgba(139,92,246,.2);border-radius:32px;padding:60px 48px 48px;text-align:center;max-width:440px;width:90%;box-shadow:0 0 80px rgba(139,92,246,.15)}h1{font-size:28px;font-weight:800;background:linear-gradient(135deg,#8b5cf6,#a78bfa,#6366f1);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin:0 0 8px}p{font-size:15px;color:#94a3b8;margin:0 0 32px;line-height:1.5}.badge{display:inline-flex;align-items:center;gap:8px;padding:10px 20px;border-radius:14px;font-size:13px;font-weight:600;background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.25);color:#22c55e;margin-bottom:28px}.badge-dot{width:8px;height:8px;border-radius:50%;background:#22c55e;box-shadow:0 0 8px rgba(34,197,94,.6)}</style></head><body><div class="card"><div style="width:80px;height:80px;border-radius:24px;display:flex;align-items:center;justify-content:center;margin:0 auto 24px;background:linear-gradient(135deg,rgba(34,197,94,.2),rgba(34,197,94,.1))"><svg viewBox="0 0 24 24" style="width:40px;height:40px"><polyline points="20 6 9 17 4 12" fill="none" stroke="#22c55e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></div><h1>Discord Connected!</h1><p>Your account has been linked to<br>AHG Unlocker successfully.</p><div class="badge"><span class="badge-dot"></span>Premium Access Active</div><p style="font-size:13px;color:#64748b">You can close this tab and return to<br>the app. Your premium features are now active.</p></div></body></html>');
            // Delay closing server to absorb stray requests
            setTimeout(function() {
              try { server.close(); } catch(e) {
                console.error('[DISCORD] Error closing server after successful callback:', e.message);
              }
              resolve(code);
            }, 500);
          } else if (u.pathname === '/callback') {
            var errDesc = u.searchParams.get('error_description') || u.searchParams.get('error') || 'No authorization code returned';
            console.warn('[DISCORD] Callback error:', errDesc);
            res.writeHead(400, { 'Content-Type': 'text/html' });
            callbackProcessed = true;
            res.end('<!DOCTYPE html><html><body><h2>Discord Authorization Failed</h2><p>' + errDesc + '</p><p>Please close this tab and try again.</p></body></html>');
            setTimeout(function() {
              try { server.close(); } catch(e) {
                console.error('[DISCORD] Error closing server after error callback:', e.message);
              }
              reject(new Error(errDesc));
            }, 500);
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end('<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connecting - AHG Unlocker</title><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#030308;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen,Ubuntu,Cantarell,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;overflow:hidden}.card{background:linear-gradient(180deg,rgba(15,15,30,.95) 0%,rgba(5,5,15,.98) 100%);border:1px solid rgba(139,92,246,.2);border-radius:32px;padding:60px 48px 48px;text-align:center;max-width:440px;width:90%;box-shadow:0 0 80px rgba(139,92,246,.15)}.spinner{width:40px;height:40px;border:3px solid rgba(139,92,246,.2);border-top-color:#8b5cf6;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 24px}@keyframes spin{to{transform:rotate(360deg)}}h1{font-size:28px;font-weight:800;background:linear-gradient(135deg,#8b5cf6,#a78bfa,#6366f1);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin:0 0 8px}p{font-size:15px;color:#94a3b8;margin:0;line-height:1.5}</style></head><body><div class="card"><div class="spinner"></div><h1>Connecting...</h1><p>Waiting for Discord authorization<br>in your browser.</p></div></body></html>');
          }
        } catch(e) {
          console.error('[DISCORD] OAuth server handler error:', e.message);
          try { res.writeHead(200); res.end('OK'); } catch(e2) {
            console.error('[DISCORD] Error sending OK response:', e2.message);
          }
        }
      });
      // Port retry: if EADDRINUSE, retry once after a short delay (handles TIME_WAIT)
      var startServer = function(port, retriesLeft) {
        try { server.close(); } catch(e) {
          console.error('[DISCORD] Error closing server during port retry:', e.message);
        }
        server.listen(port, '127.0.0.1', function() {
          console.log('[DISCORD] OAuth callback server listening on 127.0.0.1:' + port);
        });
      };
      startServer(DISCORD_REDIRECT_PORT, 1);
      server.on('error', function(err) {
        if (err.code === 'EADDRINUSE') {
          console.warn('[DISCORD] Port', DISCORD_REDIRECT_PORT, 'in use — retrying once after delay...');
          setTimeout(function() {
            try { server.close(); } catch(e) {
              console.error('[DISCORD] Error closing server during delayed retry:', e.message);
            }
            server.listen(DISCORD_REDIRECT_PORT, '127.0.0.1', function() {
              console.log('[DISCORD] OAuth callback server listening on 127.0.0.1:' + DISCORD_REDIRECT_PORT + ' (retry)');
            });
            server.on('error', function(err2) {
              if (err2.code === 'EADDRINUSE') {
                console.error('[DISCORD] Port', DISCORD_REDIRECT_PORT, 'still in use after retry');
                reject(new Error('Port ' + DISCORD_REDIRECT_PORT + ' is in use. Close other applications and try again.'));
              } else {
                console.error('[DISCORD] OAuth server error:', err2.code, err2.message);
                reject(err2);
              }
            });
          }, 500);
        } else {
          console.error('[DISCORD] OAuth server error:', err.code, err.message);
          reject(err);
        }
      });
      server.on('listening', function() {
        var addr = server.address();
        console.log('[DISCORD] OAuth server ready on port', addr ? addr.port : DISCORD_REDIRECT_PORT);
      });
      discordOAuthServer = server;
    } catch(e) {
      console.error('[DISCORD] OAuth server creation error:', e.message);
      reject(e);
    }
  });
}

// ── Helper: post a game message to Discord channel ──
async function postGameToDiscord(gameName, appid, coverUrl, userName, dlcCount) {
  try {
    if (!secrets.discordBotToken) { console.log('[DISCORD] No bot token'); return false; }
    var fields = [
      { name: '\u{1F4CB} App ID', value: String(appid), inline: true },
      { name: '\u{1F4E6} Source', value: 'AHG Unlocker v' + APP_VERSION, inline: true },
      { name: '\u{1F464} Added by', value: userName || 'A user', inline: true }
    ];
    if (dlcCount > 0) {
      fields.push({ name: '\u{1F3AE} DLCs', value: String(dlcCount) + ' unlocked', inline: true });
    }
    var embed = {
      embeds: [{
        title: '\u{1F389} ' + gameName,
        description: '\u{2705} **' + (userName || 'A user') + '** added this game to **AHG Steam Unlocker**',
        url: 'https://steamdb.info/app/' + appid + '/',
        color: 0x8b5cf6,
        fields: fields,
        image: coverUrl ? { url: coverUrl } : undefined,
        timestamp: new Date().toISOString(),
        footer: { text: 'AHG Steam Unlocker', icon_url: 'https://cdn.discord.com/embed/avatars/0.png' }
      }]
    };
    var res = await fetch('https://discord.com/api/v10/channels/' + DISCORD_CHANNEL_ID + '/messages', {
      method: 'POST',
      headers: { 'Authorization': 'Bot ' + secrets.discordBotToken, 'Content-Type': 'application/json' },
      body: JSON.stringify(embed)
    });
    return res.ok;
  } catch (e) {
    console.error('[DISCORD] Post error:', e.message);
    return false;
  }
}


// ── Register all Discord IPC handlers ──
function registerDiscordHandlers() {

  // ── Discord OAuth Login ──
  ipcMain.handle('discord-login', wrapHandler('discord-login', async function() {
    try {
      console.log('[DISCORD] Starting OAuth login flow...');

      // ── Validate credentials before starting flow ──
      if (!DISCORD_CLIENT_ID || DISCORD_CLIENT_ID.length < 10) {
        console.error('[DISCORD] Client ID is invalid or not configured');
        return { success: false, message: 'Discord client ID is not configured' };
      }

      // Diagnostic: log all secret key names and their lengths (NOT values)
      var diagKeys = Object.keys(secrets);
      console.log('[DISCORD] Secrets keys found: ' + (diagKeys.length ? diagKeys.join(', ') : 'NONE'));
      for (var _dk = 0; _dk < diagKeys.length; _dk++) {
        var _kv = secrets[diagKeys[_dk]];
        console.log('[DISCORD]   ' + diagKeys[_dk] + ': exists=' + (typeof _kv !== 'undefined' && _kv !== null) + ' type=' + typeof _kv + ' len=' + (typeof _kv === 'string' ? _kv.length : (typeof _kv === 'object' ? JSON.stringify(_kv).length : 'n/a')));
      }

      if (!secrets.discordClientSecret || secrets.discordClientSecret.length < 10) {
        console.error('[DISCORD] Client secret is missing — secretsDiag:', JSON.stringify(secretsDiag));

        // ── Last-chance lazy load: try copying from userData if the user pasted it ──
        try {
          var cfgFile = path.join(app.getPath('userData'), 'discord_config.json');
          if (fs.existsSync(cfgFile)) {
            var cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf-8'));
            if (cfg.clientSecret && cfg.clientSecret.length >= 10) {
              secrets.discordClientSecret = cfg.clientSecret;
              console.log('[DISCORD] Loaded clientSecret from userData discord_config.json');
            }
          }
        } catch (_lzErr) {
          console.log('[DISCORD] Lazy-load fallback failed:', _lzErr.message);
        }

        // Re-check after lazy load attempt
        if (!secrets.discordClientSecret || secrets.discordClientSecret.length < 10) {
          return { success: false, message: 'Discord client secret is not configured', diagnostics: secretsDiag };
        }
      }
      var hasSecret = secrets.discordClientSecret ? 'yes' : 'no';
      var secretLen = secrets.discordClientSecret ? String(secrets.discordClientSecret.length) : '0';
      console.log('[DISCORD] Credentials validated (secret exists: ' + hasSecret + ', length: ' + secretLen + ')');

      var serverPromise = startOAuthCallbackServer();
      var authUrl = 'https://discord.com/api/v10/oauth2/authorize?client_id=' + DISCORD_CLIENT_ID + '&redirect_uri=http://localhost:' + DISCORD_REDIRECT_PORT + '/callback&response_type=code&scope=identify+guilds';
      console.log('[DISCORD] Redirect URI: http://localhost:' + DISCORD_REDIRECT_PORT + '/callback');
      console.log('[DISCORD] Opening auth URL in browser...');
      shell.openExternal(authUrl).catch(function(err) {
        console.log('[DISCORD] Failed to open browser:', err.message);
      });

      // ── Wait for callback with 5-minute timeout ──
      var code;
      try {
        code = await Promise.race([
          serverPromise,
          new Promise(function(_, reject) {
            setTimeout(function() {
              reject(new Error('Authorization timed out after 5 minutes'));
            }, 300000);
          })
        ]);
      } catch (e) {
        return { success: false, message: 'Auth cancelled or failed: ' + e.message };
      }
      console.log('[DISCORD] Authorization code received, exchanging for token...');

      // ── Exchange code for token ──
      var tokenResponse = await fetch('https://discord.com/api/v10/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: DISCORD_CLIENT_ID,
          client_secret: secrets.discordClientSecret,
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: 'http://localhost:' + DISCORD_REDIRECT_PORT + '/callback',
        })
      });
      if (!tokenResponse.ok) {
        var errorBody = '';
        try { errorBody = await tokenResponse.text(); } catch(e) {
          console.error('[DISCORD] Error reading token response body:', e.message);
        }
        console.error('[DISCORD] Token exchange FAILED — HTTP', tokenResponse.status, '| body:', errorBody);
        const discordError = errorBody ? ' - ' + errorBody.slice(0, 200) : '';
        return { success: false, message: 'Failed to exchange authorization code (HTTP ' + tokenResponse.status + ')' + discordError };
      }
      var tokenData = await tokenResponse.json();
      console.log('[DISCORD] Token exchange succeeded (expires_in: ' + (tokenData.expires_in || '?') + 's)');
      var accessToken = tokenData.access_token;
      var refreshToken = tokenData.refresh_token;

      // ── Fetch user info ──
      var user = await discordFetchWithToken('/users/@me', accessToken);
      if (!user) {
        try {
          var userFetch = await fetch('https://discord.com/api/v10/users/@me', {
            headers: { 'Authorization': 'Bearer ' + accessToken }
          });
          var userStatus = userFetch.status;
          var userBody = '';
          try { userBody = await userFetch.text(); } catch(e) {
            console.error('[DISCORD] Error reading user fetch response body:', e.message);
          }
          console.error('[DISCORD] User fetch FAILED — HTTP', userStatus, '| body:', userBody);
        } catch(e2) {
          console.error('[DISCORD] User fetch diagnostics error:', e2.message);
        }
        return { success: false, message: 'Failed to fetch Discord user info' };
      }
      console.log('[DISCORD] User authenticated:', user.username, '(id: ' + user.id + ')');

      var guilds = await discordFetchWithToken('/users/@me/guilds', accessToken);
      var isInGuild = isMemberOfGuild(guilds);
      var authData = {
        accessToken: accessToken,
        refreshToken: refreshToken,
        user: {
          id: user.id,
          username: user.username,
          discriminator: user.discriminator,
          avatar: user.avatar,
          globalName: user.global_name || user.username
        },
        isInGuild: !!isInGuild,
        connectedAt: new Date().toISOString(),
        expiresAt: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString() : null
      };
      saveDiscordAuth(authData);
      return {
        success: true,
        user: authData.user,
        isInGuild: authData.isInGuild,
        message: 'Discord connected successfully!'
      };
    } catch (e) {
      console.error('[DISCORD] Login error:', e.message);
      return { success: false, message: 'Discord auth failed: ' + e.message };
    }
  }, { windowMs: 10000, maxCalls: 1 }));

  // ── Secrets diagnostics for renderer ──
  // SECURITY: Only exposes existence flags — no secret values, no lengths, no key names.
  ipcMain.handle('get-secrets-diag', async function() {
    return {
      loaded: secretsDiag.loaded,
      hasDiscordClientSecret: !!secrets.discordClientSecret,
      environment: {
        isPackaged: secretsDiag.isPackaged,
        userData: secretsDiag.userData,
      },
    };
  });

  // ── Allow renderer to manually set discord config (saved to userData) ──
  // SECURITY: clientSecret change invalidates all existing OAuth tokens.
  // The handler enforces write-once-after-auth semantics: if auth tokens exist,
  // changing the secret automatically clears them (preventing secret-swap privilege escalation).
  ipcMain.handle('set-discord-config', async function(event, config) {
    try {
      if (!config || typeof config !== 'object') {
        return { success: false, message: 'Invalid config object' };
      }
      // Validate if clientSecret provided — Discord secrets are 32+ alphanumeric
      if (config.clientSecret) {
        if (typeof config.clientSecret !== 'string') {
          return { success: false, message: 'Client secret must be a string' };
        }
        if (!/^[a-zA-Z0-9_-]{32,}$/.test(config.clientSecret)) {
          return { success: false, message: 'Client secret must be at least 32 characters (alphanumeric, underscores, hyphens)' };
        }
      }
      var cfgPath = path.join(app.getPath('userData'), 'discord_config.json');
      var existing = {};
      var secretChanged = false;
      try {
        if (fs.existsSync(cfgPath)) {
          existing = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
          if (config.clientSecret && existing.clientSecret !== config.clientSecret) {
            secretChanged = true;
          }
        }
      } catch(e) {
        console.error('[DISCORD] Error reading existing discord config:', e.message);
      }
      // Merge: only update provided fields
      if (config.clientSecret) existing.clientSecret = config.clientSecret;
      if (config.hasOwnProperty('clientId')) existing.clientId = config.clientId;
      fs.writeFileSync(cfgPath, JSON.stringify(existing, null, 2));
      // If clientSecret was set, update in-memory secret
      if (existing.clientSecret && existing.clientSecret.length >= 10) {
        secrets.discordClientSecret = existing.clientSecret;
      }
      // If secret changed and there was existing auth, clear auth data (prevents secret-swap interception)
      if (secretChanged) {
        var authPath = path.join(app.getPath('userData'), 'discord_auth.json');
        try { if (fs.existsSync(authPath)) fs.unlinkSync(authPath); } catch(e) { console.debug('[DISCORD] Failed to delete auth file:', e.message); }
        discordAuthData = null;
        console.log('[DISCORD] Client secret changed — existing OAuth tokens cleared');
      }
      return { success: true, message: 'Discord config saved' };
    } catch (e) {
      return { success: false, message: e.message };
    }
  });

  // ── Check existing Discord auth ──
  ipcMain.handle('check-discord-auth', wrapHandler('check-discord-auth', async function() {
    var auth = loadDiscordAuth();
    if (!auth || !auth.accessToken) return { authenticated: false };
    var user = await discordFetchWithToken('/users/@me', auth.accessToken);
    if (!user && auth.refreshToken) {
      try {
        var refreshRes = await fetch('https://discord.com/api/v10/oauth2/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: DISCORD_CLIENT_ID,
            client_secret: secrets.discordClientSecret,
            grant_type: 'refresh_token',
            refresh_token: auth.refreshToken,
          })
        });
        if (refreshRes.ok) {
          var td = await refreshRes.json();
          auth.accessToken = td.access_token;
          auth.refreshToken = td.refresh_token || auth.refreshToken;
          saveDiscordAuth(auth);
          var guilds = await discordFetchWithToken('/users/@me/guilds', auth.accessToken);
          return { authenticated: true, user: auth.user, isInGuild: isMemberOfGuild(guilds) };
        }
      } catch (e) {
        console.error('[DISCORD] Error refreshing token:', e.message);
      }
      clearDiscordAuth();
      return { authenticated: false };
    }
    if (!user) { clearDiscordAuth(); return { authenticated: false }; }
    var guilds = await discordFetchWithToken('/users/@me/guilds', auth.accessToken);
    return { authenticated: true, user: auth.user, isInGuild: isMemberOfGuild(guilds) };
  }, { windowMs: 5000, maxCalls: 5 }));

  // ── Discord logout ──
  ipcMain.handle('discord-logout', async function() {
    if (discordAuthData && discordAuthData.accessToken) {
      try {
        await fetch('https://discord.com/api/v10/oauth2/token/revoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: DISCORD_CLIENT_ID,
            client_secret: secrets.discordClientSecret,
            token: discordAuthData.accessToken,
          })
        });
      } catch (e) {
        console.error('[DISCORD] Error revoking token on logout:', e.message);
      }
    }
    clearDiscordAuth();
    return { success: true };
  });

  // ── Set game sharing preference ──
  ipcMain.handle('set-game-sharing', async function(event, enabled) {
    try {
      var sf = path.join(app.getPath('userData'), 'discord_settings.json');
      fs.writeFileSync(sf, JSON.stringify({ shareGames: !!enabled }));
      return { success: true };
    } catch (e) { return { success: false, message: e.message }; }
  });

  // ── Get game sharing preference ──
  ipcMain.handle('get-game-sharing', async function() {
    try {
      var sf = path.join(app.getPath('userData'), 'discord_settings.json');
      if (fs.existsSync(sf)) {
        return { enabled: JSON.parse(fs.readFileSync(sf, 'utf-8')).shareGames || false };
      }
    } catch (e) {
      console.error('[DISCORD] Error reading game sharing preference:', e.message);
    }
    return { enabled: false };
  });

  // ── Get discord startup pref ──
  ipcMain.handle('get-discord-startup-pref', async function() {
    try {
      var sf = path.join(app.getPath('userData'), 'discord_startup_pref.json');
      if (fs.existsSync(sf)) {
        return JSON.parse(fs.readFileSync(sf, 'utf-8'));
      }
    } catch (e) {
      console.error('[DISCORD] Error reading discord startup preference:', e.message);
    }
    return { showOnStartup: true };
  });

  // ── Set discord startup pref ──
  ipcMain.handle('set-discord-startup-pref', async function(event, pref) {
    try {
      var sf = path.join(app.getPath('userData'), 'discord_startup_pref.json');
      fs.writeFileSync(sf, JSON.stringify(pref));
      return { success: true };
    } catch (e) { return { success: false, message: e.message }; }
  });

  // ── Share game to Discord channel ──
  ipcMain.handle('share-game-to-discord', wrapHandler('share-game-to-discord', async function(event, appid, gameName, coverUrl, dlcCount) {
    try {
      var auth = loadDiscordAuth();
      if (!auth) return { success: false, message: 'Not authenticated' };
      var ok = await postGameToDiscord(gameName, appid, coverUrl, auth.user?.globalName || auth.user?.username, dlcCount);
      return { success: ok, message: ok ? 'Shared to Discord!' : 'Failed to share' };
    } catch (e) { return { success: false, message: e.message }; }
  }, { windowMs: 10000, maxCalls: 2 }));
}

module.exports = { registerDiscordHandlers, DISCORD_INVITE_URL, DISCORD_GUILD_ID };