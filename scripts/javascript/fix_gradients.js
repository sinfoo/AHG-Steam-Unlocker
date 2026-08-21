const fs = require('fs');
const path = 'C:\\Users\\USER\\Downloads\\filesOPENCODE\\ui\\src\\App.tsx';
let content = fs.readFileSync(path, 'utf8');

// Fix broken rgba syntax: rgba 139 92 246 0.3" -> rgba(139, 92, 246, 0.3)
content = content.replace(/rgba (\d+) (\d+) (\d+) ([\d.]+)"/g, 'rgba($1, $2, $3, $4)"');

// Fix broken gradient syntax: ${rgba 139 92 246 0.3} -> ${"rgba(139, 92, 246, 0.3)"}
content = content.replace(/\${rgba (\d+) (\d+) (\d+) ([\d.]+)}/g, '${"rgba($1, $2, $3, $4)"}');

// Fix hex+alpha patterns: COLORS.violet}40 -> COLORS.violetGlow
const hexAlphaMap = {
  'COLORS.violet}40': 'COLORS.violetGlow',
  'COLORS.violet}60': 'COLORS.violetGlow',
  'COLORS.violet}30': '"rgba(139, 92, 246, 0.3)"',
  'COLORS.violet}20': '"rgba(139, 92, 246, 0.2)"',
  'COLORS.violet}15': 'COLORS.violetDim',
  'COLORS.violet}10': 'COLORS.violetDim',
  'COLORS.violet}08': '"rgba(139, 92, 246, 0.08)"',
  'COLORS.blue}30': '"rgba(59, 130, 246, 0.3)"',
  'COLORS.blue}25': '"rgba(59, 130, 246, 0.25)"',
  'COLORS.blue}20': '"rgba(59, 130, 246, 0.2)"',
  'COLORS.green}60': '"rgba(34, 197, 94, 0.6)"',
  'COLORS.green}50': '"rgba(34, 197, 94, 0.5)"',
  'COLORS.green}30': '"rgba(34, 197, 94, 0.3)"',
  'COLORS.green}25': '"rgba(34, 197, 94, 0.25)"',
  'COLORS.green}20': '"rgba(34, 197, 94, 0.2)"',
  'COLORS.green}15': 'COLORS.greenDim',
  'COLORS.green}08': '"rgba(34, 197, 94, 0.08)"',
  'COLORS.red}40': '"rgba(239, 68, 68, 0.4)"',
  'COLORS.red}30': '"rgba(239, 68, 68, 0.3)"',
  'COLORS.red}25': '"rgba(239, 68, 68, 0.25)"',
  'COLORS.red}12': '"rgba(239, 68, 68, 0.12)"',
  'COLORS.amber}30': '"rgba(245, 158, 11, 0.3)"',
  'COLORS.amber}20': '"rgba(245, 158, 11, 0.2)"',
  'COLORS.amber}15': '"rgba(245, 158, 11, 0.15)"',
  'COLORS.amber}10': '"rgba(245, 158, 11, 0.1)"',
  'COLORS.amber}99': '"rgba(245, 158, 11, 0.99)"',
  'COLORS.pink}30': '"rgba(236, 72, 153, 0.3)"',
  'COLORS.cyan}25': '"rgba(6, 182, 212, 0.25)"',
  'COLORS.cyan}10': '"rgba(6, 182, 212, 0.1)"',
  'COLORS.border}50': '"rgba(42, 42, 68, 0.5)"',
  'COLORS.border}40': '"rgba(42, 42, 68, 0.4)"',
  'COLORS.border}10': '"rgba(42, 42, 68, 0.1)"',
  'COLORS.bgCard}80': '"rgba(18, 18, 31, 0.8)"',
  'colors.violet}30': '"rgba(139, 92, 246, 0.3)"',
  'colors.violet}20': '"rgba(139, 92, 246, 0.2)"',
  'colors.violet}15': '"rgba(139, 92, 246, 0.15)"',
  'colors.violet}10': '"rgba(139, 92, 246, 0.1)"',
  'colors.violet}08': '"rgba(139, 92, 246, 0.08)"',
  'colors.green}80': '"rgba(34, 197, 94, 0.8)"',
  'colors.green}40': '"rgba(34, 197, 94, 0.4)"',
  'colors.red}80': '"rgba(239, 68, 68, 0.8)"',
  'colors.amber}99': '"rgba(245, 158, 11, 0.99)"',
  'colors.amber}50': '"rgba(245, 158, 11, 0.5)"',
  'colors.amber}30': '"rgba(245, 158, 11, 0.3)"',
  'colors.amber}25': '"rgba(245, 158, 11, 0.25)"',
  'colors.amber}20': '"rgba(245, 158, 11, 0.2)"',
  'colors.blue}30': '"rgba(59, 130, 246, 0.3)"',
  'colors.blue}20': '"rgba(59, 130, 246, 0.2)"',
};

for (const [bad, good] of Object.entries(hexAlphaMap)) {
  content = content.split(bad).join(good);
}

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed all gradient syntax');
