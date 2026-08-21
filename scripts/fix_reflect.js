const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '..', 'src', 'hooks', 'useAppSetters.ts');
let content = fs.readFileSync(filePath, 'utf-8');

// Replace: receiver.apply(null, args) -> Reflect.apply(receiver, null, args)
// Pattern: capture everything before .apply(null, args)
const pattern = /([a-zA-Z_$][a-zA-Z0-9_$().]*?)\.apply\(null,\s*args\)/g;
const replaced = content.replace(pattern, (match, receiver) => {
  return `Reflect.apply(${receiver}, null, args)`;
});

fs.writeFileSync(filePath, replaced, 'utf-8');
const count = (replaced.match(/Reflect\.apply\(/g) || []).length;
console.log(`Done - ${count} occurrences replaced`);
