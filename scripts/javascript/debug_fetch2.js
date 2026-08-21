const fs = require('fs');
const t = fs.readFileSync('backup_v1.0_20260510/main.cjs', 'utf-8');

const startMarker = "ipcMain.handle('fetch-dlcs'";
const idx = t.indexOf(startMarker);
console.log('Index:', idx);

const startOfLine = t.lastIndexOf('\n', idx) + 1;
console.log('Start of line:', startOfLine);

let braceDepth = 0;
let bracketDepth = 0;
let inString = false;
let stringChar = null;
let hasSeenOpeningBrace = false;

for (let i = startOfLine; i < Math.min(startOfLine + 200, t.length); i++) {
  const ch = t[i];
  const prev = i > 0 ? t[i - 1] : '';

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

  if (i < startOfLine + 200) {
    console.log(`i=${i}, ch=${ch === '\n' ? '\\n' : ch === '\r' ? '\\r' : ch}, brace=${braceDepth}, bracket=${bracketDepth}, hasSeen=${hasSeenOpeningBrace}`);
  }
}
