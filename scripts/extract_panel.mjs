import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.resolve(__dirname, '../src/App.tsx');
let content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// Step 1: Add import after line containing the import for AnimatedBackground
const importLine = "import { GameDetailPanel } from './components/GameDetailPanel'";
const importTarget = "import { AnimatedBackground } from './components/AnimatedBackground'";

const importIdx = lines.findIndex(l => l.includes(importTarget));
if (importIdx === -1) {
  console.error('Could not find import target');
  process.exit(1);
}
lines.splice(importIdx + 1, 0, importLine);
console.log('Added import at line', importIdx + 2);

// Step 2: Find and replace the GameDetailPanel block
const startIdx = lines.findIndex(l => l.includes('{/* Game Detail Panel - Fully Reimagined */}'));
if (startIdx === -1) {
  console.error('Could not find GameDetailPanel start marker');
  process.exit(1);
}

// Find closing </AnimatePresence> after the start marker
const afterStart = lines.slice(startIdx + 1);
const endRelIdx = afterStart.findIndex(l => l.trim() === '</AnimatePresence>');
if (endRelIdx === -1) {
  console.error('Could not find closing AnimatePresence');
  process.exit(1);
}
const endIdx = startIdx + 1 + endRelIdx;
const blockLines = lines.slice(startIdx, endIdx + 1);

console.log('Found block from line', startIdx + 1, 'to', endIdx + 1, '(' + blockLines.length + ' lines)');

// Replace with component usage
const replacement = [
  '      <GameDetailPanel',
  '        colors={COLORS}',
  '        detailPanelOverlay={detailPanelOverlay}',
  '        installFailedAppid={installFailedAppid}',
  '        handleInstallGame={handleInstallGame}',
  '        handleInstallFromZip={handleInstallFromZip}',
  '        showToast={showToast}',
  '        toggleFavorite={toggleFavorite}',
  '      />',
];

lines.splice(startIdx, endIdx - startIdx + 1, ...replacement);
fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log('Done! Replaced ' + blockLines.length + ' lines with ' + replacement.length + ' lines');
