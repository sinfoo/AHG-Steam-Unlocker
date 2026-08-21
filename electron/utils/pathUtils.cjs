// ── Path resolution utilities ──
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

function getResourcePath(relativePath) {
  console.log('[MAIN] getResourcePath called:', relativePath, 'packaged:', app.isPackaged);

  const possiblePaths = [];

  if (app.isPackaged) {
    possiblePaths.push(path.join(process.resourcesPath, relativePath));
    possiblePaths.push(path.join(process.resourcesPath, 'app', relativePath));
  } else {
    possiblePaths.push(path.join(__dirname, '..', relativePath));
    possiblePaths.push(path.join(__dirname, '..', '..', relativePath));
    possiblePaths.push(path.join(__dirname, '..', '..', '..', relativePath));
  }

  for (const p of possiblePaths) {
    console.log('[MAIN] Checking path:', p, 'exists:', fs.existsSync(p));
    if (fs.existsSync(p)) {
      return p;
    }
  }

  return possiblePaths[0];
}

module.exports = { getResourcePath };
