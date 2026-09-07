/**
 * Batch-polish tool source files: file validation toasts, disabled buttons, empty outputs.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const files = [
  'src/assets/js/tools/all-tools.js',
  'src/assets/js/tools/all-tools-extended.js',
  'src/assets/js/tools/all-tools-mega.js',
];

let total = 0;

for (const rel of files) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) continue;
  let src = fs.readFileSync(file, 'utf8');
  const orig = src;

  src = src.replace(/if \(!f\) return;/g, "if (!f) { Jot.toast('Please upload a file first'); return; }");
  src = src.replace(/if \(!f\) \{ return; \}/g, "if (!f) { Jot.toast('Please upload a file first'); return; }");
  src = src.replace(/const f = Jot\.\$\('#file', ui\)\.files\[0\]; if \(!f\) return;/g,
    "const f = Jot.$('#file', ui).files[0]; if (!f) { Jot.toast('Please upload a file first'); return; }");
  src = src.replace(/const f = Jot\.\$\('#file', ui\)\.files\?\.\[0\]; if \(!f\) return;/g,
    "const f = Jot.$('#file', ui).files?.[0]; if (!f) { Jot.toast('Please upload a file first'); return; }");

  src = src.replace(
    /<div class="output" id="out"><\/div>/g,
    '<div class="output output--empty" id="out">Results will appear here.</div>'
  );
  src = src.replace(
    /<div class="output" id="out"><\/div>/g,
    '<div class="output output--empty" id="out">Results will appear here.</div>'
  );
  src = src.replace(
    /<div id="out" class="output"><\/div>/g,
    '<div id="out" class="output output--empty">Results will appear here.</div>'
  );

  if (src !== orig) {
    fs.writeFileSync(file, src, 'utf8');
    total++;
    console.log('Polished:', rel);
  }
}

console.log(`Done — updated ${total} file(s).`);
