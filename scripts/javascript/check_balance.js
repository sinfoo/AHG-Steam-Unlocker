const fs = require('fs');
const content = fs.readFileSync('C:/Users/USER/Downloads/filesOPENCODE/electron/main.cjs', 'utf8');
let cleaned = '';
let inStr = false, inRegex = false, strChar = '';
for (let i = 0; i < content.length; i++) {
  const ch = content[i];
  const prev = i > 0 ? content[i-1] : '';
  
  if (inStr) {
    if (ch === '\\' && prev === '\\') continue;
    if (ch === strChar && prev !== '\\') inStr = false;
    continue;
  }
  if (inRegex) {
    if (ch === '/' && prev !== '\\') inRegex = false;
    continue;
  }
  
  if (ch === '"' || ch === "'") {
    inStr = true;
    strChar = ch;
    continue;
  }
  if (ch === '/' && prev !== '\\' && /[([{=,:;!&|?& ]/.test(content[i-1] || ' ')) {
    inRegex = true;
    continue;
  }
  
  cleaned += ch;
}

let curly = 0, bracket = 0, paren = 0;
for (const ch of cleaned) {
  if (ch === '{') curly++;
  if (ch === '}') curly--;
  if (ch === '[') bracket++;
  if (ch === ']') bracket--;
  if (ch === '(') paren++;
  if (ch === ')') paren--;
}
console.log('Curly:', curly, 'Bracket:', bracket, 'Paren:', paren);
