const fs = require('fs');

function extractBlock(text, startMarker) {
  const idx = text.indexOf(startMarker);
  if (idx === -1) return null;

  const startOfLine = text.lastIndexOf('\n', idx) + 1;

  let braceDepth = 0;
  let bracketDepth = 0;
  let inString = false;
  let stringChar = null;
  let endIdx = -1;
  let hasSeenOpeningBrace = false;

  for (let i = startOfLine; i < text.length; i++) {
    const ch = text[i];
    const prev = i > 0 ? text[i - 1] : '';

    if (!inString) {
      if (ch === "'" || ch === '"' || ch === '`') {
        inString = true;
        stringChar = ch;
      }
    } else if (ch === stringChar && prev !== '\\') {
      inString = false;
      stringChar = null;
    }

    if (!inString) {
      if (ch === '{') {
        braceDepth++;
        hasSeenOpeningBrace = true;
      }
      if (ch === '}') braceDepth--;
      if (ch === '[') bracketDepth++;
      if (ch === ']') bracketDepth--;
    }

    // End condition 1: semicolon at depth 0 without having seen a brace
    if (!hasSeenOpeningBrace && braceDepth === 0 && bracketDepth === 0 && ch === ';') {
      endIdx = i + 1;
      break;
    }

    // End condition 2: braceDepth returns to 0 after having been > 0
    if (hasSeenOpeningBrace && braceDepth === 0) {
      // Check what comes after the closing brace
      let j = i + 1;
      while (j < text.length && (text[j] === ' ' || text[j] === '\r' || text[j] === '\n')) {
        j++;
      }
      // End at semicolon, or at comma (for arrays), or at end of line with next line being a new statement
      if (text[j] === ';' || text[j] === ',' || text[j] === '\n' || text[j] === ')' || text[j] === ']' || j >= text.length) {
        endIdx = j >= text.length ? text.length : j + 1;
        if (text[j] === ';' || text[j] === ',' || text[j] === ')' || text[j] === ']') {
          endIdx = j + 1;
        }
        break;
      }
    }
  }

  if (endIdx === -1) return null;

  return text.slice(startOfLine, endIdx);
}

const cur = fs.readFileSync('backup_v1.0_20260510/main.cjs', 'utf-8');

const items = [
  { type: 'var', marker: '// Discord OAuth config' },
  { type: 'var', marker: 'const DISCORD_CLIENT_ID' },
  { type: 'var', marker: 'const DISCORD_CLIENT_SECRET' },
  { type: 'var', marker: 'const DISCORD_BOT_TOKEN' },
  { type: 'var', marker: 'const DISCORD_GUILD_INVITE' },
  { type: 'var', marker: 'let resolvedGuildId' },
  { type: 'var', marker: 'let discordAuthData' },
  { type: 'func', marker: 'function getDepotDownloaderPath' },
  { type: 'func', marker: 'async function downloadFromDepotBox' },
  { type: 'func', marker: 'async function downloadWithDepotDownloader' },
  { type: 'func', marker: 'async function downloadFromAuthedSource' },
  { type: 'func', marker: 'function loadDlcInfoCache' },
  { type: 'func', marker: 'function saveDlcInfoCache' },
  { type: 'func', marker: 'async function fetchDlcInfos' },
  { type: 'func', marker: 'function loadFreeGamesCache' },
  { type: 'func', marker: 'function saveFreeGamesCache' },
  { type: 'func', marker: 'function saveAuthedSourceKey' },
  { type: 'func', marker: 'function loadAuthedSourceKeys' },
  { type: 'var', marker: 'const AUTHED_MANIFEST_SOURCES' },
  { type: 'func', marker: 'async function resolveGuildId' },
  { type: 'func', marker: 'function saveDiscordAuth' },
  { type: 'func', marker: 'function loadDiscordAuth' },
  { type: 'func', marker: 'function clearDiscordAuth' },
  { type: 'func', marker: 'function discordFetchWithToken' },
  { type: 'func', marker: 'async function fetchAuthedSourceKeys' },
  { type: 'func', marker: 'function startOAuthCallbackServer' },
  { type: 'func', marker: 'async function postGameToDiscord' },
  { type: 'func', marker: 'function httpGetWithProgress' },
  { type: 'var', marker: 'let currentDownloadReq' },
  { type: 'var', marker: 'let currentDownloadAbort' },
];

const extracted = {};

for (const item of items) {
  // Skip comment header
  const block = extractBlock(cur, item.marker);
  if (block) {
    extracted[item.marker] = block.trim();
    console.log(`OK: ${item.marker} (${block.length} chars)`);
  } else {
    console.log(`FAIL: ${item.marker}`);
  }
}

// Now extract IPC handlers
const handlers = [
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

for (const handler of handlers) {
  const marker = "ipcMain.handle('" + handler + "'";
  const block = extractBlock(cur, marker);
  if (block) {
    extracted[marker] = block.trim();
    console.log(`OK: handler ${handler} (${block.length} chars)`);
  } else {
    console.log(`FAIL: handler ${handler}`);
  }
}

// Output to file
const lines = [];
for (const [key, value] of Object.entries(extracted)) {
  lines.push(value);
}
fs.writeFileSync('extracted_fns.txt', lines.join('\n\n') + '\n');
console.log(`\nWrote ${lines.length} blocks to extracted_fns.txt`);
