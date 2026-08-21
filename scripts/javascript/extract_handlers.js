const fs = require('fs');
const cur = fs.readFileSync('backup_v1.0_20260510/main.cjs', 'utf-8');
const v70 = fs.readFileSync('electron/main.cjs', 'utf-8');

const handlersToExtract = [
  'open-external',
  'check-free-games', 
  'cancel-download',
  'register-dlcs',
  'fetch-dlcs',
  'extract-fix',
  'open-file-location',
  'fix-no-games-stream',
  'install-update',
  'discord-login',
  'check-discord-auth',
  'discord-logout',
  'set-game-sharing',
  'get-game-sharing',
  'share-game-to-discord',
  'export-library',
  'import-library',
  'save-search-history',
  'get-search-history',
  'check-game-updates',
  'get-steam-status',
];

const functionsToExtract = [
  'function getDepotDownloaderPath',
  'async function downloadFromDepotBox',
  'async function downloadWithDepotDownloader',
  'async function downloadFromAuthedSource',
  'function loadDlcInfoCache',
  'function saveDlcInfoCache',
  'async function fetchDlcInfos',
  'function loadFreeGamesCache',
  'function saveFreeGamesCache',
  'function saveAuthedSourceKey',
  'function loadAuthedSourceKeys',
  'const AUTHED_MANIFEST_SOURCES',
  'async function resolveGuildId',
  'function saveDiscordAuth',
  'function loadDiscordAuth',
  'function clearDiscordAuth',
  'function discordFetchWithToken',
  'async function fetchAuthedSourceKeys',
  'function startOAuthCallbackServer',
  'async function postGameToDiscord',
  'function httpGetWithProgress',
  'let currentDownloadReq',
  'let currentDownloadAbort',
];

function extractBlock(text, startMarker, endPattern) {
  const idx = text.indexOf(startMarker);
  if (idx === -1) return null;
  
  const startOfLine = text.lastIndexOf('\n', idx) + 1;
  
  let depth = 0;
  let inString = false;
  let inTemplate = false;
  let stringChar = null;
  let endIdx = -1;
  let lineStart = startOfLine;
  
  for (let i = startOfLine; i < text.length; i++) {
    const ch = text[i];
    const prev = i > 0 ? text[i-1] : '';
    
    // Track string state
    if (!inString && !inTemplate) {
      if (ch === "'" || ch === '"' || ch === '`') {
        inString = true;
        stringChar = ch;
      }
    } else if (inString) {
      if (ch === stringChar && prev !== '\\') {
        inString = false;
        stringChar = null;
      }
    }
    
    if (!inString && !inTemplate) {
      if (ch === '{') depth++;
      if (ch === '}') {
        depth--;
        if (depth === 0) {
          // Check next char after }
          let j = i + 1;
          while (j < text.length && text[j] === ' ') j++;
          if (text[j] === ')' || text[j] === ';' || text[j] === ',' || text[j] === '\n') {
            endIdx = j + 1;
            break;
          }
        }
        if (depth < 0) {
          // Found a standalone closing brace
          endIdx = i + 1;
          break;
        }
      }
    }
    
    // For non-brace-delimited blocks (like variable assignments with arrays)
    if (ch === ';' && depth === 0 && endIdx === -1) {
      endIdx = i + 1;
      break;
    }
  }
  
  if (endIdx === -1) return null;
  
  return text.slice(startOfLine, endIdx);
}

let additions = '\n\n// ── ADDITIONAL FEATURES (from v1.0) ──\n\n';

// First extract supporting functions
for (const fn of functionsToExtract) {
  const block = extractBlock(cur, fn, null);
  if (block) {
    additions += block + '\n\n';
    console.log('EXTRACTED function: ' + fn);
  } else {
    console.log('NOT FOUND function: ' + fn);
  }
}

// Then extract IPC handlers
additions += '\n// ── ADDITIONAL IPC HANDLERS ──\n\n';

for (const handler of handlersToExtract) {
  const pattern = "ipcMain.handle('" + handler + "'";
  const block = extractBlock(cur, pattern, null);
  if (block) {
    additions += block + '\n\n';
    console.log('EXTRACTED handler: ' + handler);
  } else {
    console.log('NOT FOUND handler: ' + handler);
  }
}

// Write to file
fs.writeFileSync('additions.txt', additions);
console.log('\nWritten ' + additions.length + ' chars to additions.txt');
