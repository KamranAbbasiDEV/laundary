const t = require('../data/tools.json');
const fs = require('fs');
const path = require('path');
const toolsDir = path.join(__dirname, '../src/assets/js/tools');
const js = fs.readdirSync(toolsDir)
  .filter(f => /^all-tools.*\.js$/.test(f))
  .map(f => fs.readFileSync(path.join(toolsDir, f), 'utf8'))
  .join('\n');
const missing = t.filter(x => {
  const directRegistration = js.includes(`JotTools['${x.id}']`);
  const dynamicRegistration = js.includes(`'${x.id}'`) || js.includes(`"${x.id}"`);
  return !directRegistration && !dynamicRegistration;
});
console.log('Missing:', missing.map(x => x.id).join(', ') || 'none');
console.log('Count missing:', missing.length);
