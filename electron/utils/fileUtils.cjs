// ── File utility functions ──
const path = require('path');
const fs = require('fs');

function copyRecursive(srcDir, destDir) {
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      if (entry.name === 'AHG Unlocker.exe' && process.platform === 'win32') {
        const tempExe = path.join(destDir, 'AHG Unlocker.exe.new');
        fs.copyFileSync(srcPath, tempExe);
        console.log('[MAIN] Copied (pending): AHG Unlocker.exe -> .new');
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}

module.exports = { copyRecursive };
