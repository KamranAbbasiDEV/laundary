const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '../src/assets/js/tools/all-tools.js');
let s = fs.readFileSync(file, 'utf8');
const bad = "emojis.filter(e => !q)";
if (s.includes(bad)) {
  s = s.replace(bad, 'emojis.filter(function() { return true; })');
  fs.writeFileSync(file, s, 'utf8');
  console.log('Fixed emoji filter bug');
} else {
  console.log('Emoji filter already fixed or block replaced');
}
