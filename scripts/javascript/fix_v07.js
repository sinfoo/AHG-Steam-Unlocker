const fs = require('fs');
const path = 'C:\\Users\\USER\\Downloads\\filesOPENCODE\\ui\\src\\App.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Remove light theme entirely - replace all theme logic with dark only
// Remove system theme detection
content = content.replace(/const \[systemTheme[^\]]*\][^;]*;[^\n]*\n/g, '');
content = content.replace(/const \[isSystemDark[^\]]*\][^;]*;[^\n]*\n/g, '');
content = content.replace(/const effectiveTheme =[^;]*;\n/g, 'const effectiveTheme = \'dark\';\n');
content = content.replace(/theme !== \'dark\' \?[^:]*:[^;\n]*;\n/g, '');
content = content.replace(/ts === \'light\' \?[^:]*:[^;\n]*;\n/g, '');

// 2. Change "Browse games" to "Catalogue" in navItems
content = content.replace(/label: \'Browse games\'/g, "label: 'Catalogue'");
content = content.replace(/label: \'Browse\'/g, "label: 'Catalogue'");

// 3. Add new manifest sources to the search
const newSources = `
// Additional manifest sources (v0.7)
const ADDITIONAL_MANIFEST_SOURCES = [
  'https://steamtools.site',
  'https://manifest.youngzm.com',
  'https://ssmg4.github.io/ManifestHubDownloader/',
  'https://cysaw.org',
  'https://ahd-manifest.lovable.app',
];
`;

// Find a good place to insert (after MIRROR_REPOS)
const mirrorEnd = content.indexOf('];', content.indexOf('MIRROR_REPOS'));
if (mirrorEnd > 0) {
  content = content.slice(0, mirrorEnd + 2) + newSources + content.slice(mirrorEnd + 2);
}

fs.writeFileSync(path, content, 'utf8');
console.log('Applied fixes: removed light theme, changed Browse to Catalogue, added manifest sources');
