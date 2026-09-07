/** Comprehensive ASCII-safe cleanup for all-tools.js */
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '../src/assets/js/tools/all-tools.js');
let s = fs.readFileSync(file, 'utf8');

// ASCII-safe replacements for UI strings
const reps = [
  [/â†'/g, '->'],
  [/â†"/g, 'to'],
  [/â€"/g, '-'],
  [/â€¦/g, '...'],
  [/Â°/g, ''],
  [/xâ‚/g, 'x'],
  [/â‚/g, ''],
  [/â€"/g, '-'],
  [/â€"/g, '-'],
  [/Category<select id="cat"><option value="inches-cm">[^<]+<\/option><option value="lbs-kg">[^<]+<\/option><option value="fahrenheit-celsius">[^<]+<\/option><\/select>/,
    'Conversion<select id="cat"><option value="inches-cm">Inches to CM</option><option value="lbs-kg">Lbs to Kg</option><option value="fahrenheit-celsius">F to C</option><option value="km-miles">KM to Miles</option></select>'],
];

for (const [a, b] of reps) s = s.replace(a, b);

// Fix label wrapper for unit converter
s = s.replace('<label>Category<select id="cat">', '<label>Conversion<select id="cat">');

// Replace entire emoji-picker block
s = s.replace(/JotTools\['emoji-picker'\] = function \(root\) \{[\s\S]*?\n\};\n\nJotTools\['file-identify'\]/,
`JotTools['emoji-picker'] = function (root) {
  const emojis = ['\\u{1F600}','\\u{1F602}','\\u{1F970}','\\u{1F60E}','\\u{1F914}','\\u{1F44D}','\\u{1F389}','\\u{1F525}','\\u{1F4A1}','\\u{2705}','\\u{2764}\\u{FE0F}','\\u{2B50}','\\u{1F680}','\\u{1F4BB}','\\u{1F4DD}','\\u{1F3AF}','\\u{1F4B0}','\\u{1F6E0}\\u{FE0F}','\\u{1F310}','\\u{1F4F1}','\\u{1F3A8}','\\u{1F512}','\\u{26A1}','\\u{1F3C6}'];
  const ui = Jot.ui('<p style="color:var(--muted);font-size:.9rem">Click any emoji to copy.</p><div class="palette" id="grid"></div>');
  root.appendChild(ui);
  Jot.$('#grid', ui).innerHTML = emojis.map(function(e) { return '<span class="chip" style="font-size:1.5rem;cursor:pointer" title="Copy">' + e + '</span>'; }).join('');
  Jot.$$('#grid .chip', ui).forEach(function(c) { c.onclick = function() { Jot.copy(c.textContent); }; });
};

JotTools['file-identify']`);

// Fix equation solver output
s = s.replace(/`x[^`]*= \$\{\(\(-b\+Math\.sqrt\(d\)\)\/\(2\*a\)\)\.toFixed\(4\)\}\\n[^`]*`/g,
  '`x1 = ${((-b+Math.sqrt(d))/(2*a)).toFixed(4)}\\nx2 = ${((-b-Math.sqrt(d))/(2*a)).toFixed(4)}`');

// Remove duplicate JotTools bootstrap lines
s = s.replace(/^window\.JotTools = window\.JotTools \|\| \{\};\r?\n(?=JotTools)/gm, '');

fs.writeFileSync(file, s, 'utf8');
console.log('Fixed all-tools.js');
