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

// Get top-level declarations from v0.70.2
const v70Decls = new Set();
for (const line of v70Lines) {
  const trimmed = line.trim();
  if (trimmed.startsWith('function ') || trimmed.startsWith('async function ') ||
      trimmed.startsWith('const ') || trimmed.startsWith('let ') || trimmed.startsWith('var ')) {
    v70Decls.add(trimmed);
  }
}
console.log('v0.70 has', v70Decls.size, 'top-level declarations');

// Get top-level declarations from v1.0
const v10Decls = [];
for (let i = 0; i < v10TopLevelEnd; i++) {
  const line = v10Lines[i];
  const trimmed = line.trim();
  if (trimmed.startsWith('function ') || trimmed.startsWith('async function ') ||
      trimmed.startsWith('const ') || trimmed.startsWith('let ') || trimmed.startsWith('var ')) {
    // Extract the entire declaration/function
    let braceDepth = 0;
    let inString = false;
    let inTemplate = false;
    let stringChar = null;
    let result = [line];
    
    for (let j = i + 1; j <= v10TopLevelEnd; j++) {
      const l = v10Lines[j];
      let depthDelta = 0;
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
        }
        k++;
      }
      braceDepth += depthDelta;
      result.push(l);
      if (braceDepth === 0) break;
    }
    
    v10Decls.push({
      firstLine: result[0],
      block: result.join('\n'),
      lineIdx: i
    });
    i += result.length - 1; // Skip processed lines
  }
}
console.log('v1.0 has', v10Decls.length, 'top-level declarations');

// Find new declarations (not in v0.70.2)
const additions = [];
additions.push('');
additions.push('// ── ADDITIONAL FEATURES (from v1.0) ──');
additions.push('');

for (const decl of v10Decls) {
  // Check if this declaration exists in v0.70.2
  const firstLine = decl.firstLine;
  const nameMatch = firstLine.match(/(?:function|async function|const|let|var)\s+(\w+)/);
  if (!nameMatch) continue;
  
  const name = nameMatch[1];
  let exists = false;
  
  // Check if v0.70.2 has a decl with the same name
  for (const v70Decl of v70Decls) {
    if (v70Decl.includes(name) && v70Decl.startsWith(firstLine.substring(0, firstLine.indexOf(name) + name.length))) {
      exists = true;
      break;
    }
  }
  
  if (!exists) {
    additions.push(decl.block);
    additions.push('');
    console.log('NEW:', name, '(' + decl.block.length + ' chars)');
  }
}

// Add new IPC handlers (after the v0.70.2 handlers)
// First, find all v0.70.2 handlers
const v70Handlers = new Set();
for (const line of v70Lines) {
  const m = line.match(/ipcMain\.handle\('([^']+)'/);
  if (m) v70Handlers.add(m[1]);
}

// Find the first handler in v1.0 that's inside app.whenReady
let v10FirstHandlerLine = -1;
let v10LastHandlerLine = -1;
for (let i = v10TopLevelEnd; i < v10Lines.length; i++) {
  if (v10Lines[i].includes("ipcMain.handle('")) {
    v10FirstHandlerLine = i;
    break;
  }
}
// Find last handler
for (let i = v10Lines.length - 1; i >= 0; i--) {
  if (v10Lines[i].includes("ipcMain.handle('")) {
    v10LastHandlerLine = i;
    break;
  }
}
console.log('v1.0 handlers from line', v10FirstHandlerLine + 1, 'to', v10LastHandlerLine + 1);

// Extract each new handler
additions.push('// ── ADDITIONAL IPC HANDLERS ──');
additions.push('');

for (let i = v10FirstHandlerLine; i <= v10LastHandlerLine; i++) {
  const line = v10Lines[i];
  const m = line.match(/ipcMain\.handle\('([^']+)'/);
  if (!m) continue;
  
  const handlerName = m[1];
  if (v70Handlers.has(handlerName)) continue; // Skip existing handlers
  
  // Extract the handler block
  let braceDepth = 0;
  let inString = false;
  let inTemplate = false;
  let stringChar = null;
  let result = [line];
  let firstLine = true;
  
  for (let j = i + 1; j < v10Lines.length; j++) {
    const l = v10Lines[j];
    let depthDelta = 0;
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
      }
      k++;
    }
    braceDepth += depthDelta;
    result.push(l);
    
    if (braceDepth === 0 && result.length > 1) {
      break;
    }
  }
  
  additions.push(result.join('\n'));
  additions.push('');
  console.log('NEW handler:', handlerName);
}

fs.writeFileSync('additions2.txt', additions.join('\n'));
console.log('\nWrote', additions.length, 'lines to additions2.txt');
