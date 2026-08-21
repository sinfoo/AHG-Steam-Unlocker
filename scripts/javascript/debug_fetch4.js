const fs = require('fs');
const t = fs.readFileSync('backup_v1.0_20260510/main.cjs', 'utf-8');

// Test extraction of fetch-dlcs
const startMarker = "ipcMain.handle('fetch-dlcs'";
const idx = t.indexOf(startMarker);
const startOfLine = t.lastIndexOf('\n', idx) + 1;

// Also find where the function ENDS by looking for '});' at proper depth
let braceDepth = 0;
let inString = false;
let inTemplate = false;
let stringChar = null;

// First scan to find depth at start of line
for (let i = 0; i < startOfLine; i++) {
  const ch = t[i];
  const prev = i > 0 ? t[i - 1] : '';
  if (!inString && !inTemplate) {
    if (ch === "'" || ch === '"') { inString = true; stringChar = ch; }
    if (ch === '`') { inTemplate = true; }
  } else if (inString) {
    if (ch === stringChar && prev !== '\\') { inString = false; stringChar = null; }
  } else if (inTemplate) {
    if (ch === '`' && prev !== '\\') { inTemplate = false; }
  }
  if (!inString && !inTemplate) {
    if (ch === '{') braceDepth++;
    if (ch === '}') braceDepth--;
    if (ch === '[') {}
    if (ch === ']') {}
  }
}

console.log('Depth at start of fetch-dlcs handler:', braceDepth);

// Now scan from handler start
for (let i = startOfLine; i < t.length; i++) {
  const ch = t[i];
  const prev = i > 0 ? t[i - 1] : '';
  if (!inString && !inTemplate) {
    if (ch === "'" || ch === '"') { inString = true; stringChar = ch; }
    if (ch === '`') { inTemplate = true; }
  } else if (inString) {
    if (ch === stringChar && prev !== '\\') { inString = false; stringChar = null; }
  } else if (inTemplate) {
    if (ch === '`' && prev !== '\\') { inTemplate = false; }
  }
  if (!inString && !inTemplate) {
    if (ch === '{') braceDepth++;
    if (ch === '}') braceDepth--;
  }
  
  // Check for handler close: braceDepth returns to original depth
  if (ch === '}' && braceDepth === 0) {
    // This is the closing } of the handler
    const after = t.substring(i, i + 10);
    console.log('Found closing } at pos', i, ', after:', JSON.stringify(after));
    
    // Check if it's followed by ); which would end ipcMain.handle
    let j = i + 1;
    while (j < t.length && (t[j] === ' ' || t[j] === '\r' || t[j] === '\n')) j++;
    if (t[j] === ')') {
      j++;
      while (j < t.length && (t[j] === ' ' || t[j] === '\r' || t[j] === '\n')) j++;
      if (t[j] === ';') {
        console.log('Handler close found at', j + 1);
        break;
      }
    }
    break;
  }
}
console.log('Final depth:', braceDepth);
