import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.resolve(__dirname, '../src/App.tsx');
let content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// Find the GameDetailPanel component call
const compStartIdx = lines.findIndex(l => l.includes('<GameDetailPanel'));
if (compStartIdx === -1) {
  console.error('Could not find GameDetailPanel component');
  process.exit(1);
}
console.log('GameDetailPanel starts at line', compStartIdx + 1);

// Find the closing /> of GameDetailPanel (lines with toggleFavorite prop before it)
let compCloseIdx = -1;
for (let i = compStartIdx; i < lines.length; i++) {
  if (lines[i].includes('/>')) {
    compCloseIdx = i;
    break;
  }
}
console.log('GameDetailPanel close at line', compCloseIdx + 1, ':', JSON.stringify(lines[compCloseIdx]));

// Find the orphaned end: the </AnimatePresence> before NoInternetModal
// Read from just after the component to find the orphaned end
let orphanEndIdx = -1;
for (let i = compCloseIdx + 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (line === '</AnimatePresence>') {
    // Check if NoInternetModal follows within a few lines
    for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
      if (lines[j].trim() !== '' && lines[j].includes('NoInternetModal')) {
        orphanEndIdx = i;
        console.log('Found orphaned </AnimatePresence> at line', i + 1);
        break;
      }
    }
    if (orphanEndIdx !== -1) break;
  }
}

if (orphanEndIdx === -1) {
  console.error('Could not find orphaned block end. Debug info:');
  // Show all lines from compCloseIdx+1 for context
  for (let i = compCloseIdx + 1; i < Math.min(compCloseIdx + 300, lines.length); i++) {
    if (lines[i].includes('AnimatePresence') || lines[i].includes('NoInternet')) {
      console.log(`  Line ${i+1}: ${lines[i].replace(/\r/g, '').substring(0, 100)}`);
    }
  }
  process.exit(1);
}

// Remove orphaned lines: compCloseIdx+1 to orphanEndIdx (inclusive)
const removed = lines.splice(compCloseIdx + 1, orphanEndIdx - compCloseIdx);
console.log('Removed', removed.length, 'orphaned lines (lines', compCloseIdx + 2, 'to', orphanEndIdx + 1 + ')');

// Check for multiple blank lines after the component call and clean up
const afterComp = compCloseIdx + 1;
if (afterComp < lines.length && lines[afterComp].trim() === '' && 
    afterComp + 1 < lines.length && lines[afterComp + 1].trim() === '') {
  lines.splice(afterComp, 1); // remove one blank
  console.log('Cleaned up extra blank line');
}

// Check if the line after removal already has the correct content
console.log('Line after removal:', JSON.stringify(lines[compCloseIdx + 1]));
console.log('Next line:', JSON.stringify(lines[compCloseIdx + 2]));

fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log('Done! File now has', lines.length, 'lines');
