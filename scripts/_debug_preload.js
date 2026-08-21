const fs = require('fs');
const text = fs.readFileSync('electron/preload.cjs', 'utf-8');

// Debug: find the exposeInMainWorld marker
const markers = [
  "exposeInMainWorld('electronAPI',",
  'exposeInMainWorld("electronAPI",',
];
let startIdx = -1;
for (const m of markers) {
  startIdx = text.indexOf(m);
  if (startIdx !== -1) {
    console.log('Found marker:', JSON.stringify(m), 'at index:', startIdx);
    break;
  }
}
if (startIdx === -1) {
  console.log('NO MARKER FOUND');
  
  // Search for just exposeInMainWorld
  const re = /exposeInMainWorld/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    console.log('Found exposeInMainWorld at:', m.index, 'context:', JSON.stringify(text.slice(m.index, m.index + 100)));
  }
  process.exit(1);
}

// Show context around marker
console.log('Context around marker:');
console.log(JSON.stringify(text.slice(startIdx, startIdx + 120)));
console.log('---');

// Find opening brace
const bodyStart = text.indexOf('{', startIdx + markers[0].length);
console.log('Opening brace at index:', bodyStart, 'char:', JSON.stringify(text[bodyStart]));
console.log('Context before brace:', JSON.stringify(text.slice(bodyStart - 20, bodyStart)));
console.log('Context after brace:', JSON.stringify(text.slice(bodyStart, bodyStart + 100)));

// Now manually try extractElectronApiBody
function extractElectronApiBody(text) {
  const markers = [
    "exposeInMainWorld('electronAPI',",
    'exposeInMainWorld("electronAPI",',
  ];
  let startIdx = -1;
  for (const m of markers) {
    startIdx = text.indexOf(m);
    if (startIdx !== -1) break;
  }
  if (startIdx === -1) return null;

  const bodyStart = text.indexOf('{', startIdx + markers[0].length);
  if (bodyStart === -1) return null;

  let depth = 0;
  let inString = false;
  let stringChar = null;
  let inTemplate = false;
  let debugInfo = {};

  for (let i = bodyStart; i < text.length; i++) {
    const ch = text[i];

    if (!inTemplate && (ch === '"' || ch === "'")) {
      if (!inString) {
        inString = true;
        stringChar = ch;
      } else if (ch === stringChar && text[i - 1] !== '\\') {
        inString = false;
        stringChar = null;
      }
      continue;
    }
    if (!inString && ch === '`') {
      inTemplate = !inTemplate;
      continue;
    }

    if (!inString && !inTemplate) {
      if (ch === '{') {
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0) {
          console.log('Found closing brace at index:', i);
          console.log('Body length:', i - bodyStart - 1);
          return text.substring(bodyStart + 1, i);
        }
      }
    }
  }
  return null;
}

const apiBody = extractElectronApiBody(text);
if (!apiBody) {
  console.log('extractElectronApiBody returned null!');
  process.exit(1);
}

console.log('First 200 chars of body:', JSON.stringify(apiBody.slice(0, 200)));
console.log('Last 200 chars of body:', JSON.stringify(apiBody.slice(-200)));

// Now try to split into entries
const methodStartRe = /(?=^|\n)(\w+):\s*(?:async\s+)?\(/gm;
const entries = [];
let lastIdx = 0;
let m;
let matchCount = 0;
while ((m = methodStartRe.exec(apiBody)) !== null) {
  matchCount++;
  if (lastIdx > 0) {
    entries.push({ name: m[1], index: m.index });
  }
  lastIdx = m.index;
}

console.log('Match count:', matchCount);
console.log('Entry pointer count:', entries.length);
if (entries.length > 0) {
  console.log('First 5 entries:', entries.slice(0, 5).map(e => e.name));
  console.log('Last 5 entries:', entries.slice(-5).map(e => e.name));
} else {
  console.log('No entries found. Let me do an alternative approach...');
  
  // Try using matchAll directly
  const allMethods = [...apiBody.matchAll(/(?:^|\n)(\w+):\s*(?:async\s+)?\(/g)];
  console.log('matchAll found:', allMethods.length, 'methods');
  console.log('First 20 method names:', allMethods.slice(0, 20).map(m => m[1]));
  console.log('Last 20 method names:', allMethods.slice(-20).map(m => m[1]));
}
