const fs = require('fs');

const v70 = fs.readFileSync('backup_v0.70_20260503_1400/electron/main.cjs', 'utf-8');
const v70Lines = v70.split('\n');
const v10 = fs.readFileSync('backup_v1.0_20260510/main.cjs', 'utf-8');
const v10Lines = v10.split('\n');

// Find app.whenReady boundary in v1.0
let v10TopLevelEnd = 0;
for (let i = 0; i < v10Lines.length; i++) {
  if (v10Lines[i].includes('app.whenReady()')) {
    v10TopLevelEnd = i;
    break;
  }
}
console.log('v1.0 top-level ends at line', v10TopLevelEnd + 1);

// Helper: extract a block (function/const/let) starting at lineIdx, returns {block, endLineIdx}
function extractDeclaration(lines, startIdx) {
  let braceDepth = 0;
  let bracketDepth = 0;
  let inString = false;
  let inTemplate = false;
  let stringChar = null;
  let result = [];
  
  for (let j = startIdx; j < lines.length; j++) {
    const l = lines[j];
    let depthDelta = 0;
    let bracketDelta = 0;
    let k = 0;
    while (k < l.length) {
      const ch = l[k];
      const prev = k > 0 ? l[k - 1] : '';
      if (!inString && !inTemplate) {
        if (ch === "'" || ch === '"') { inString = true; stringChar = ch; }
        else if (ch === '`') { inTemplate = true; }
      } else if (inString) {
        if (ch === stringChar && prev !== '\\') { inString = false; stringChar = null; }
      } else if (inTemplate) {
        if (ch === '`' && prev !== '\\') { inTemplate = false; }
        k++; continue;
      }
      if (!inString && !inTemplate) {
        if (ch === '{') depthDelta++;
        if (ch === '}') depthDelta--;
        if (ch === '[') bracketDelta++;
        if (ch === ']') bracketDelta--;
      }
      k++;
    }
    braceDepth += depthDelta;
    bracketDepth += bracketDelta;
    result.push(l);
    
    if (braceDepth === 0 && bracketDepth === 0 && result.length > 1) {
      // Check if the next non-empty line starts a new declaration
      let nextLine = j + 1;
      while (nextLine < lines.length && lines[nextLine].trim() === '') nextLine++;
      if (nextLine >= lines.length || 
          lines[nextLine].trim().startsWith('function ') || 
          lines[nextLine].trim().startsWith('async function ') ||
          lines[nextLine].trim().startsWith('const ') ||
          lines[nextLine].trim().startsWith('let ') ||
          lines[nextLine].trim().startsWith('var ') ||
          lines[nextLine].trim().startsWith('//') || // comment
          lines[nextLine].includes('app.whenReady')) {
        return { block: result.join('\n'), endLineIdx: j };
      }
    }
  }
  return { block: result.join('\n'), endLineIdx: lines.length - 1 };
}

// Get top-level declarations from v0.70.2
const v70Decls = new Map(); // name -> first line
for (let i = 0; i < v70Lines.length; i++) {
  const trimmed = v70Lines[i].trim();
  if (trimmed.startsWith('function ') || trimmed.startsWith('async function ') ||
      trimmed.startsWith('const ') || trimmed.startsWith('let ') || trimmed.startsWith('var ')) {
    const nameMatch = trimmed.match(/(?:function|async function|const|let|var)\s+(\w+)/);
    if (nameMatch) {
      v70Decls.set(nameMatch[1], trimmed);
    }
  }
}
console.log('v0.70 has', v70Decls.size, 'top-level declarations');

// Get top-level declarations from v1.0 (only until app.whenReady)
const v10NewDecls = [];
const v10AllTopLevelNames = new Set();

for (let i = 0; i < v10TopLevelEnd; i++) {
  const trimmed = v10Lines[i].trim();
  if (trimmed.startsWith('function ') || trimmed.startsWith('async function ') ||
      trimmed.startsWith('const ') || trimmed.startsWith('let ') || trimmed.startsWith('var ')) {
    const nameMatch = trimmed.match(/(?:function|async function|const|let|var)\s+(\w+)/);
    if (!nameMatch) continue;
    const name = nameMatch[1];
    
    // Skip if already in v0.70.2
    if (v70Decls.has(name)) continue;
    
    // Skip if already processed (another decl with same name)
    if (v10AllTopLevelNames.has(name)) continue;
    v10AllTopLevelNames.add(name);
    
    // Extract the full declaration
    const { block, endLineIdx } = extractDeclaration(v10Lines, i);
    v10NewDecls.push({ name, block, lineIdx: i });
    console.log('NEW top-level:', name, '(' + block.length + ' chars)');
    i = endLineIdx; // Skip processed lines
  }
}

// Build additions
const additions = [];
additions.push('');
additions.push('// ── ADDITIONAL FEATURES (from v1.0) ──');
additions.push('');

// First add supporting function/variable blocks
for (const decl of v10NewDecls) {
  additions.push(decl.block);
  additions.push('');
}

// Now extract NEW IPC handlers (from inside v1.0's app.whenReady)
const v70Handlers = new Set();
for (const line of v70Lines) {
  const m = line.match(/ipcMain\.handle\('([^']+)'/);
  if (m) v70Handlers.add(m[1]);
}

console.log('\nv0.70 has', v70Handlers.size, 'IPC handlers');

// Find handlers in v1.0 (these are INSIDE app.whenReady)
const v10NewHandlers = [];
for (let i = v10TopLevelEnd; i < v10Lines.length; i++) {
  const trimmed = v10Lines[i].trim();
  const m = trimmed.match(/ipcMain\.handle\('([^']+)'/);
  if (!m) continue;
  const name = m[1];
  if (v70Handlers.has(name)) continue;
  
  const { block, endLineIdx } = extractDeclaration(v10Lines, i);
  v10NewHandlers.push({ name, block });
  console.log('NEW handler:', name, '(' + block.length + ' chars)');
  i = endLineIdx; // Skip processed lines
}

additions.push('// ── ADDITIONAL IPC HANDLERS ──');
additions.push('');

for (const handler of v10NewHandlers) {
  additions.push(handler.block);
  additions.push('');
}

fs.writeFileSync('additions3.txt', additions.join('\n'));
console.log('\nWrote', additions.length, 'lines to additions3.txt');
