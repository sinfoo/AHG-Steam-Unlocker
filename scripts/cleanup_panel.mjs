import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.resolve(__dirname, '../src/App.tsx');
let content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// Find the GameDetailPanel component call end
const panelEndIdx = lines.findIndex(l => l.includes('      />') && lines[lines.indexOf(l) - 1]?.includes('toggleFavorite'));
// Actually let's use the component call as anchor
const startIdx = lines.findIndex(l => l.includes('      <GameDetailPanel'));
let endIdx = startIdx;
// Find the closing /> of the component
for (let i = startIdx; i < lines.length; i++) {
  if (lines[i].includes('/>')) {
    endIdx = i;
    break;
  }
}

console.log('Component call at lines', startIdx + 1, '-', endIdx + 1);

// Find the orphaned block end: </AnimatePresence> followed by NoInternetModal
const orphanEndIdx = lines.findIndex((l, idx) => {
  return l.trim() === '</AnimatePresence>' && idx > endIdx && lines[idx + 1]?.trim() === '' && lines[idx + 2]?.includes('NoInternetModal');
});

if (orphanEndIdx === -1) {
  console.error('Could not find orphaned block end');
  process.exit(1);
}

console.log('Orphaned block from line', endIdx + 2, 'to', orphanEndIdx + 1);

// Remove the orphaned lines
lines.splice(endIdx + 1, orphanEndIdx - endIdx);

// Also check if there's a double-empty line after the component
if (lines[endIdx + 1] === '' && lines[endIdx + 2] === '') {
  // Keep just one empty line
  lines.splice(endIdx + 1, 1);
}

fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log('Cleanup done!');
