const fs = require('fs');
const t = fs.readFileSync('backup_v1.0_20260510/main.cjs', 'utf-8');
const idx = t.indexOf("ipcMain.handle('fetch-dlcs'");
console.log('Index:', idx);
if (idx >= 0) {
  console.log('Context:');
  console.log(JSON.stringify(t.substring(idx - 5, idx + 60)));
}
