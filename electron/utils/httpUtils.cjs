// ── HTTP utility functions for main process ──
const https = require('https');
const http = require('http');
const { spawn } = require('child_process');

function httpGetOnce(url, onProgress, signal, timeoutMs) {
  if (timeoutMs === undefined) timeoutMs = 30000;
  return new Promise(function(res, rej) {
    if (signal && signal.aborted) {
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      rej(err);
      return;
    }
    var u = new URL(url);
    var opts = {
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/zip,application/octet-stream,*/*',
        'Referer': 'https://generator.ryuu.lol/',
        'Origin': 'https://generator.ryuu.lol'
      }
    };
    var mod = u.protocol === 'https:' ? https : http;
    var req = mod.request(opts, function(rsp) {
      if (rsp.statusCode === 301 || rsp.statusCode === 302 || rsp.statusCode === 303 || rsp.statusCode === 307 || rsp.statusCode === 308) {
        var loc = rsp.headers.location;
        if (loc) {
          if (!loc.startsWith('http')) loc = u.origin + loc;
          httpGetOnce(loc, onProgress, signal, timeoutMs).then(res).catch(rej);
          return;
        }
      }
      if (rsp.statusCode == 404) { rej(new Error('404')); return; }
      if (rsp.statusCode != 200) { rej(new Error('HTTP ' + rsp.statusCode + ' ' + (http.STATUS_CODES[rsp.statusCode] || 'Unknown'))); return; }
      var totalSize = parseInt(rsp.headers['content-length'], 10) || 0;
      var downloaded = 0;
      var lastSent = 0; // progress callbacks throttled to ~6/s; each one becomes an IPC message
      var startTime = Date.now();
      var buf = [];
      rsp.on('data', function(c) {
        if (signal && signal.aborted) {
          req.destroy();
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          rej(err);
          return;
        }
        buf.push(c);
        downloaded += c.length;
        var elapsed = (Date.now() - startTime) / 1000;
        var speed = elapsed > 0 ? downloaded / elapsed : 0;
        var nowMs = Date.now();
        if (onProgress && (nowMs - lastSent >= 150 || downloaded === totalSize)) {
          lastSent = nowMs;
          onProgress({ totalSize: totalSize, downloaded: downloaded, speed: speed, percent: totalSize > 0 ? (downloaded / totalSize) * 100 : 0 });
        }
      });
      rsp.on('end', function() {
        var data = Buffer.concat(buf);
        res(data);
      });
    });
    req.on('error', function(e) {
      if (signal && signal.aborted) {
        const err = new Error('The operation was aborted');
        err.name = 'AbortError';
        rej(err);
        return;
      }
      rej(e);
    });
    req.setTimeout(timeoutMs, function() { req.destroy(); rej(new Error('timeout')); });
    if (signal) {
      signal.addEventListener('abort', function() {
        req.destroy();
        const err = new Error('The operation was aborted');
        err.name = 'AbortError';
        rej(err);
      }, { once: true });
    }
    req.end();
  });
}

// raw.githubusercontent.com -> jsDelivr (same repo content via a reputable CDN).
// Only on network failure/timeout/5xx: a 404 is a real "not found", not an outage.
// ponytail: jsDelivr only; third-party GitHub proxies could serve tampered .lua, so none are used.
const RAW = /^https:\/\/raw\.githubusercontent\.com\/([^/]+\/[^/]+)\/(?:refs\/heads\/)?([^/]+)\/(.+)$/;
function httpGetWithProgress(url, onProgress, signal, timeoutMs) {
  return httpGetOnce(url, onProgress, signal, timeoutMs).catch(function(e) {
    const m = RAW.exec(url);
    const outage = e && e.name !== 'AbortError' && e.message !== '404' && !/^HTTP 4/.test(e.message);
    if (!m || !outage) throw e;
    return httpGetOnce('https://cdn.jsdelivr.net/gh/' + m[1] + '@' + m[2] + '/' + m[3], onProgress, signal, timeoutMs)
      .catch(function() { throw e; });
  });
}

function httpGet(url, signal, timeoutMs) {
  return httpGetWithProgress(url, null, signal, timeoutMs);
}

function execCmd(cmd) {
  return new Promise(function(res, rej) {
    console.log('[EXEC] ' + cmd);
    var c = spawn('powershell', ['-ExecutionPolicy', 'Bypass', '-Command', cmd], { shell: false });
    var err = '';
    c.stderr.on('data', function(d) { err += d.toString(); });
    c.on('close', function(code) {
      console.log('[EXEC] Exit code: ' + code);
      if (code === 0) res();
      else rej(new Error(err || 'Exit code ' + code));
    });
    c.on('error', function(e) { console.log('[EXEC] Error: ' + e.message); rej(e); });
  });
}

module.exports = { httpGetWithProgress, httpGet, execCmd };
