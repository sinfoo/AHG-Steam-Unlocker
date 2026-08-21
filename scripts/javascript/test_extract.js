const fs = require('fs');
const cur = fs.readFileSync('backup_v1.0_20260510/main.cjs', 'utf-8');
const lines = cur.split('\n');

function extractHandlerAtLine(lineIdx) {
  let depth = 0;
  let inString = false;
  let firstLine = true;
  
  for (let i = lineIdx; i < lines.length; i++) {
    const line = lines[i];
    let inTemplate = false;
    
    for (let j = 0; j < line.length; j++) {
      const ch = line[j];
      const prev = j > 0 ? line[j-1] : '';
      
      if (!inString && !inTemplate) {
        if (ch === "'" || ch === '"') { inString = true; }
        else if (ch === '`') { inTemplate = true; }
      } else if (inString) {
        if (ch === (ch === "'" ? "'" : '"') && prev !== '\\') { inString = false; }
      } else if (inTemplate) {
        if (ch === '`' && prev !== '\\') { inTemplate = false; }
        // Skip ${} expressions in template literals - this is simplified
      }
      
      if (!inString && !inTemplate) {
        if (ch === '{') depth++;
        if (ch === '}') depth--;
      }
    }
    
    if (firstLine) {
      // Skip the first line's opening brace in depth count
      // Actually the first line's depth contributes to the handler
      firstLine = false;
    }
    
    // Check if this line completes the handler
    if (depth === 0 && line.trim().endsWith('})') || line.trim().endsWith('});') || line.trim() === '})' || line.trim() === '});') {
      // Verify this is truly the end by checking next lines
      let nextNonEmpty = i + 1;
      while (nextNonEmpty < lines.length && lines[nextNonEmpty].trim() === '') nextNonEmpty++;
      if (nextNonEmpty < lines.length && lines[nextNonEmpty].includes('ipcMain.handle')) {
        return lines.slice(lineIdx, i + 1).join('\n');
      }
    }
    
    // Alternative end: semicolon at depth 0 (for simple one-liners)
    if (depth === 0 && line.includes(');')) {
      // Check if this is a simple handler registration
      return lines.slice(lineIdx, i + 1).join('\n');
    }
  }
  return null;
}

// Test: extract fetch-dlcs
const idx = cur.indexOf("ipcMain.handle('fetch-dlcs'");
const lineNum = cur.substring(0, idx).split('\n').length - 1;
console.log('fetch-dlcs at line', lineNum + 1);
const extracted = extractHandlerAtLine(lineNum);
if (extracted) {
  console.log('Extracted:', extracted.length, 'chars');
  console.log('Last 200 chars:');
  console.log(extracted.slice(-200));
} else {
  console.log('FAILED');
}
