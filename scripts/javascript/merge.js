const fs = require('fs');

// Read the clean v0.70.2 file
const v70 = fs.readFileSync('backup_v0.70_20260503_1400/electron/main.cjs', 'utf-8');
const v70Lines = v70.split('\n');

// Read the v1.0 backup
const v10 = fs.readFileSync('backup_v1.0_20260510/main.cjs', 'utf-8');
const v10Lines = v10.split('\n');

// Get all handler names from v0.70.2
const v70Handlers = new Set();
for (const line of v70Lines) {
  const m = line.match(/ipcMain\.handle\('([^']+)'/);
  if (m) v70Handlers.add(m[1]);
}
console.log('v0.70.2 has', v70Handlers.size, 'handlers');

// Find all handler names in v1.0
const v10Handlers = new Map(); // name -> line index
for (let i = 0; i < v10Lines.length; i++) {
  const m = v10Lines[i].match(/ipcMain\.handle\('([^']+)'/);
  if (m) v10Handlers.set(m[1], i);
}
console.log('v1.0 has', v10Handlers.size, 'handlers');

// Find new handlers
const newHandlers = [];
for (const [name, lineIdx] of v10Handlers) {
  if (!v70Handlers.has(name)) {
    newHandlers.push({ name, lineIdx });
    console.log('NEW handler:', name, 'at v1.0 line', lineIdx + 1);
  }
}

// Also find new supporting variables/functions
const v70Fns = new Set();
const fnMarkers = ['function ', 'const ', 'let ', 'async function '];
for (const line of v70Lines) {
  const trimmed = line.trim();
  for (const m of fnMarkers) {
    if (trimmed.startsWith(m)) {
      // Extract the name
      const name = trimmed.substring(m.length).split(/[=( \t{]/)[0];
      if (name) v70Fns.add(name);
    }
  }
}

console.log('\nv0.70.2 has', v70Fns.size, 'top-level declarations');

// Now let's extract the new handlers from v1.0
// First, remove the extracted_fns.txt and extracted_handlers.txt
// We'll write everything to additions.txt

// Helper: extract a handler/block given a start line index
function extractBlock(startLineIdx) {
  let braceDepth = 0;
  let inString = false;
  let inTemplate = false;
  let stringChar = null;
  let result = [];
  let finished = false;
  
  for (let i = startLineIdx; i < v10Lines.length && !finished; i++) {
    const line = v10Lines[i];
    let depthDelta = 0;
    let j = 0;
    
    while (j < line.length) {
      const ch = line[j];
      const prev = j > 0 ? line[j - 1] : '';
      
      // Handle string states
      if (!inString && !inTemplate) {
        if (ch === "'" || ch === '"') {
          inString = true;
          stringChar = ch;
        } else if (ch === '`') {
          inTemplate = true;
        }
      } else if (inString) {
        if (ch === stringChar && prev !== '\\') {
          inString = false;
          stringChar = null;
        }
      } else if (inTemplate) {
        if (ch === '`' && prev !== '\\') {
          inTemplate = false;
        }
        // Skip template literal contents
        j++;
        continue;
      }
      
      // Count braces (only when not in string/template)
      if (!inString && !inTemplate) {
        if (ch === '{') depthDelta++;
        if (ch === '}') depthDelta--;
      }
      
      j++;
    }
    
    braceDepth += depthDelta;
    result.push(line);
    
    // End condition: braceDepth returned to 0 and we're at end of handler
    if (braceDepth === 0 && result.length > 1) {
      // Check next line to see if there's another handler
      const nextIdx = i + 1;
      let nextNonEmpty = nextIdx;
      while (nextNonEmpty < v10Lines.length && v10Lines[nextNonEmpty].trim() === '') nextNonEmpty++;
      if (nextNonEmpty < v10Lines.length && v10Lines[nextNonEmpty].includes('ipcMain.handle')) {
        finished = true;
      } else if (nextNonEmpty >= v10Lines.length) {
        finished = true;
      } else {
        // Could be followed by another function declaration
        // Check if next line starts a new top-level declaration
        const nextTrimmed = v10Lines[nextNonEmpty].trim();
        if (nextTrimmed.startsWith('function ') || nextTrimmed.startsWith('async function ') || nextTrimmed.startsWith('const ') || nextTrimmed.startsWith('let ')) {
          // But only stop if the current block looks complete
          // Check if the result ends with proper closure
          const lastLine = result[result.length - 1].trim();
          if (lastLine === '});' || lastLine === '})' || lastLine.endsWith('});') || lastLine.endsWith('})')) {
            finished = true;
          }
        }
      }
    }
  }
  
  return result.join('\n');
}

// Extract new handlers
const additions = [];
additions.push('');
additions.push('// ── ADDITIONAL FEATURES (from v1.0) ──');
additions.push('');

// First add supporting variables (Discord OAuth config, etc.)
const newVarMarkers = [
  'const DISCORD_CLIENT_ID',
  'const DISCORD_CLIENT_SECRET',
  'const DISCORD_BOT_TOKEN',
  'const DISCORD_GUILD_INVITE',
  'let resolvedGuildId',
  'let discordAuthData',
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

for (const marker of newVarMarkers) {
  // Find the start line in v1.0
  for (let i = 0; i < v10Lines.length; i++) {
    if (v10Lines[i].trim().startsWith(marker)) {
      const block = extractBlock(i);
      if (block) {
        additions.push(block);
        additions.push('');
        console.log('ADDED:', marker);
      }
      break;
    }
  }
}

// Add IPC handlers
additions.push('// ── ADDITIONAL IPC HANDLERS ──');
additions.push('');

for (const { name } of newHandlers) {
  // Find the start line in v1.0
  for (let i = 0; i < v10Lines.length; i++) {
    if (v10Lines[i].trim().startsWith(`ipcMain.handle('${name}'`)) {
      const block = extractBlock(i);
      if (block) {
        additions.push(block);
        additions.push('');
        console.log('ADDED handler:', name);
      } else {
        console.log('FAILED to extract handler:', name);
      }
      break;
    }
  }
}

fs.writeFileSync('additions.txt', additions.join('\n'));
console.log('\nWrote', additions.length, 'lines to additions.txt');
