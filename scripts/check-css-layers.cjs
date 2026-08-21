#!/usr/bin/env node
// ── CSS regression guard for the Tailwind v4 build ──
// Catches the two index.css mistakes that silently broke the packaged UI:
//   1. An UNLAYERED universal reset (`* { margin/padding }` outside @layer). Tailwind v4
//      emits utilities in @layer utilities, and an unlayered rule beats every layered
//      one regardless of specificity — so it nukes every p-*/m-* utility app-wide.
//   2. A `*/` sequence inside a CSS comment (e.g. a `p-*/m-*` glob in prose) which closes
//      the comment early and corrupts the following rule (once dropped body{font-family}).
// Runs as a `npm run build` pre-step. Exits non-zero on violation.

const fs = require('fs');
const path = require('path');

const CSS_FILE = path.join(__dirname, '..', 'src', 'index.css');
const errors = [];

let raw;
try {
  raw = fs.readFileSync(CSS_FILE, 'utf8');
} catch (e) {
  console.error('[css-guard] cannot read ' + CSS_FILE + ': ' + e.message);
  process.exit(2);
}

// ── Check 2 first (operates on raw text): accidental comment-closing `*/` in a glob ──
// Valid comment closes are preceded by whitespace or `*`. `p-*/` (dash before `*/`) is
// almost always an accidental close inside intended prose.
const lines = raw.split(/\r?\n/);
lines.forEach((line, i) => {
  const m = line.match(/[A-Za-z0-9_-]\*\//);
  if (m) {
    errors.push(
      `index.css:${i + 1}: "${m[0]}" looks like a glob (e.g. p-*/m-*) that closes a CSS ` +
      `comment early. Rewrite the comment to avoid the "*/" sequence.\n    > ${line.trim()}`,
    );
  }
});

// ── Check 1: unlayered universal reset touching margin/padding ──
// Strip comments, then walk top-level blocks tracking @layer depth.
const noComments = raw.replace(/\/\*[\s\S]*?\*\//g, '');
let depth = 0;          // brace depth
let layerDepth = -1;    // brace depth at which the nearest @layer opened (-1 = none open)
let i = 0;
while (i < noComments.length) {
  // Find the next rule header (up to `{` or `}`)
  const nextBrace = noComments.search.call(noComments.slice(i), /[{}]/);
  if (nextBrace === -1) break;
  const braceIdx = i + nextBrace;
  const header = noComments.slice(i, braceIdx).trim();
  const ch = noComments[braceIdx];

  if (ch === '{') {
    const isLayer = /@layer\b/.test(header);
    depth++;
    if (isLayer && layerDepth === -1) layerDepth = depth;
    // A selector rule (not an at-rule) at this level: check for bare `*` + margin/padding
    if (!header.startsWith('@')) {
      const selectorTouchesAll = /(^|,)\s*\*(\s|,|::|$)/.test(header);
      // peek the body
      // find matching close for this block to read its declarations
      if (selectorTouchesAll) {
        let d = 1, j = braceIdx + 1;
        while (j < noComments.length && d > 0) { const c = noComments[j]; if (c === '{') d++; else if (c === '}') d--; j++; }
        const body = noComments.slice(braceIdx + 1, j - 1);
        const insideLayer = layerDepth !== -1 && depth >= layerDepth;
        if (/\b(margin|padding)\b\s*:/.test(body) && !insideLayer) {
          errors.push(
            `index.css: an UNLAYERED universal reset (selector "${header}") sets margin/padding ` +
            `outside @layer. Wrap it in \`@layer base { ... }\` or it will override every ` +
            `p-*/m-* utility app-wide.`,
          );
        }
      }
    }
    i = braceIdx + 1;
  } else { // '}'
    if (layerDepth !== -1 && depth === layerDepth) layerDepth = -1;
    depth--;
    i = braceIdx + 1;
  }
}

if (errors.length) {
  console.error('\n[css-guard] FAILED — ' + errors.length + ' issue(s) in src/index.css:\n');
  errors.forEach(e => console.error('  • ' + e + '\n'));
  process.exit(1);
}

console.log('[css-guard] OK — index.css layering and comments are clean');
