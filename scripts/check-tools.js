const t = require('../data/tools.json');
const fs = require('fs');
const js = ['all-tools.js', 'all-tools-remaining.js', 'all-tools-remaining2.js']
  .map(f => fs.readFileSync(require('path').join(__dirname, '../src/assets/js/tools', f), 'utf8'))
  .join('\n');
const missing = t.filter(x => !js.includes(`JotTools['${x.id}']`));
console.log('Missing:', missing.map(x => x.id).join(', ') || 'none');
console.log('Count missing:', missing.length);
