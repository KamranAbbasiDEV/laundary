/** Fix mojibake from PowerShell UTF-8 merges in all-tools.js */
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '../src/assets/js/tools/all-tools.js');
let s = fs.readFileSync(file, 'utf8');
const reps = [
  [/â€¦/g, '...'],
  [/â†'/g, '->'],
  [/â†"/g, 'to'],
  [/Â°F/g, 'F'],
  [/Â°C/g, 'C'],
  [/â€"/g, '-'],
  [/[\uFFFD]/g, ''],
];
for (const [a, b] of reps) s = s.replace(a, b);
// Remove duplicate bootstrap lines from file merges
s = s.replace(/^window\.JotTools = window\.JotTools \|\| \{\};\r?\n(?=JotTools)/gm, '');
fs.writeFileSync(file, s, 'utf8');
console.log('Encoding cleanup done');
