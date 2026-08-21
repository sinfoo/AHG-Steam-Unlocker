const fs = require('fs');
const path = 'C:\\Users\\USER\\Downloads\\filesOPENCODE\\ui\\src\\App.tsx';
let content = fs.readFileSync(path, 'utf8');

// Fix duplicate style attributes by merging them
// Pattern: style={{...}} ... style={{...}}
// We need to merge the second style into the first

let fixed = content;
let iterations = 0;

while (iterations < 10) {
  // Find JSX elements with duplicate style attributes
  const match = fixed.match(/<(\w+)([^>]*?)style=\{(\{[^}]*\})\}([^>]*?)style=\{(\{[^}]*\})\}([^>]*?)>/s);
  
  if (!match) break;
  
  const [fullMatch, tag, before, style1, between, style2, after] = match;
  
  // Merge: combine the two style objects
  // Extract the content inside the curly braces
  const style1Content = style1.slice(1, -1); // Remove outer {}
  const style2Content = style2.slice(1, -1); // Remove outer {}
  
  const mergedStyle = `style={${style1Content ? style1Content + ',\n' : ''}${style2Content}}`;
  
  // Replace the element
  const newElement = `<${tag}${before}${mergedStyle}${between}${after}>`;
  fixed = fixed.replace(fullMatch, newElement);
  
  iterations++;
}

fs.writeFileSync(path, fixed, 'utf8');
console.log(`Fixed ${iterations} duplicate style attributes`);
