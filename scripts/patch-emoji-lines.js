const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '../src/assets/js/tools/all-tools.js');
const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
const start = lines.findIndex(l => l.includes("JotTools['emoji-picker']"));
const end = lines.findIndex((l, i) => i > start && l.includes("JotTools['file-identify']"));
if (start < 0 || end < 0) throw new Error('emoji-picker block not found');

const block = [
  "JotTools['emoji-picker'] = function (root) {",
  "  const emojis = ['\\u{1F600}','\\u{1F602}','\\u{1F970}','\\u{1F60E}','\\u{1F914}','\\u{1F44D}','\\u{1F389}','\\u{1F525}','\\u{1F4A1}','\\u{2705}','\\u{2764}\\u{FE0F}','\\u{2B50}','\\u{1F680}','\\u{1F4BB}','\\u{1F4DD}','\\u{1F3AF}','\\u{1F4B0}','\\u{1F6E0}\\u{FE0F}','\\u{1F310}','\\u{1F4F1}','\\u{1F3A8}','\\u{1F512}','\\u{26A1}','\\u{1F3C6}'];",
  "  const ui = Jot.ui('<p style=\"color:var(--muted);font-size:.9rem\">Click any emoji to copy.</p><div class=\"palette\" id=\"grid\"></div>');",
  '  root.appendChild(ui);',
  "  Jot.$('#grid', ui).innerHTML = emojis.map(function(e) { return '<span class=\"chip\" style=\"font-size:1.5rem;cursor:pointer\" title=\"Copy\">' + e + '</span>'; }).join('');",
  "  Jot.$$('#grid .chip', ui).forEach(function(c) { c.onclick = function() { Jot.copy(c.textContent); }; });",
  '};',
  ''
];

const out = [...lines.slice(0, start), ...block, ...lines.slice(end)];
fs.writeFileSync(file, out.join('\n'), 'utf8');
console.log('emoji-picker replaced lines', start + 1, '-', end);
