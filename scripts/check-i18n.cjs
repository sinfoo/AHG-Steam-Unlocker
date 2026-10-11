// Verifies every key in src/i18n/parts/<part>/en.ts exists in the 7 other language files of that part.
const fs = require('fs'), path = require('path')
const root = path.join(__dirname, '..', 'src', 'i18n', 'parts')
const LANGS = ['es', 'fr', 'de', 'pt', 'tr', 'zh', 'ar']
const keysOf = (f) => new Set([...fs.readFileSync(f, 'utf8').matchAll(/['"]([\w.\-]+)['"]\s*:/g)].map((m) => m[1]))
let bad = 0
for (const part of fs.readdirSync(root)) {
  const en = path.join(root, part, 'en.ts')
  if (!fs.existsSync(en)) continue
  const base = keysOf(en)
  for (const l of LANGS) {
    const f = path.join(root, part, l + '.ts')
    const have = fs.existsSync(f) ? keysOf(f) : new Set()
    const missing = [...base].filter((k) => !have.has(k))
    if (missing.length) { bad += missing.length; console.log(`${part}/${l}.ts missing ${missing.length}:\n  ` + missing.join('\n  ')) }
  }
  console.log(`${part}: ${base.size} keys`)
}
process.exit(bad ? 1 : 0)
