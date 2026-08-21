const fs = require('fs');
const t = fs.readFileSync('backup_v1.0_20260510/main.cjs', 'utf-8');

const startMarker = "ipcMain.handle('fetch-dlcs'";
const idx = t.indexOf(startMarker);
const startOfLine = t.lastIndexOf('\n', idx) + 1;

let braceDepth = 0;
let bracketDepth = 0;
let inString = false;
let inTemplate = false;
let stringChar = null;
let hasSeenOpeningBrace = false;
let endIdx = -1;

for (let i = startOfLine; i < t.length; i++) {
  const ch = t[i];
  const prev = i > 0 ? t[i - 1] : '';

  if (!inString && !inTemplate) {
    if (ch === "'" || ch === '"') {
      inString = true;
      stringChar = ch;
    }
    if (ch === '`') {
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
    // Don't count ${} inside template literals
    continue;
  }

  if (!inString && !inTemplate) {
    if (ch === '{') {
      braceDepth++;
      hasSeenOpeningBrace = true;
    }
    if (ch === '}') braceDepth--;
    if (ch === '[') bracketDepth++;
    if (ch === ']') bracketDepth--;
  }

  if (hasSeenOpeningBrace && braceDepth === 0) {
    let j = i + 1;
    while (j < t.length && (t[j] === ' ' || t[j] === '\r' || t[j] === '\n')) j++;
    if (t[j] === ';' || t[j] === ',' || t[j] === '\n' || t[j] === ')' || t[j] === ']' || j >= t.length) {
      endIdx = j >= t.length ? t.length : j + 1;
      if (t[j] === ';' || t[j] === ',' || t[j] === ')' || t[j] === ']') endIdx = j + 1;
      break;
    }
  }
}

const extracted = endIdx !== -1 ? t.slice(startOfLine, endIdx) : null;
console.log('Result:', extracted ? 'OK ' + extracted.length + ' chars' : 'NULL');
if (extracted) {
  console.log('Last 100 chars:');
  console.log(extracted.slice(-100));
}
if (!extracted) {
  // Find where braceDepth is wrong
  console.log('Searching for issues...');
  braceDepth = 0;
  bracketDepth = 0;
  inString = false;
  inTemplate = false;
  for (let i = startOfLine; i < Math.min(startOfLine + 3000, t.length); i++) {
    const ch = t[i];
    const prev = i > 0 ? t[i - 1] : '';

    if (!inString && !inTemplate) {
      if (ch === "'" || ch === '"') { inString = true; stringChar = ch; }
      if (ch === '`') { inTemplate = true; }
    } else if (inString) {
      if (ch === stringChar && prev !== '\\') { inString = false; stringChar = null; }
    } else if (inTemplate) {
      if (ch === '`' && prev !== '\\') { inTemplate = false; }
      continue;
    }

    if (!inString && !inTemplate) {
      if (ch === '{') braceDepth++;
      if (ch === '}') braceDepth--;
      if (ch === '[') bracketDepth++;
      if (ch === ']') bracketDepth--;
    }
  }
  console.log('Final braceDepth:', braceDepth, 'bracketDepth:', bracketDepth);
}
