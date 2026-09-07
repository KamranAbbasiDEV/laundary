/**
 * Smoke-test all JotTools in jsdom — catches throws on mount.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const tools = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/tools.json'), 'utf8').replace(/^\uFEFF/, ''));
const shared = fs.readFileSync(path.join(__dirname, '../src/assets/js/shared.js'), 'utf8');
const allTools = fs.readFileSync(path.join(__dirname, '../src/assets/js/tools/all-tools.js'), 'utf8');
const extPath = path.join(__dirname, '../src/assets/js/tools/all-tools-extended.js');
const megaPath = path.join(__dirname, '../src/assets/js/tools/all-tools-mega.js');
const allToolsExt = fs.existsSync(extPath) ? fs.readFileSync(extPath, 'utf8') : '';
const allToolsMega = fs.existsSync(megaPath) ? fs.readFileSync(megaPath, 'utf8') : '';

const dom = new JSDOM('<!DOCTYPE html><html><body><div id="tool-root"></div></body></html>', {
  url: 'https://www.jotnexus.com/',
  runScripts: 'dangerously',
  resources: 'usable',
});

const { window } = dom;
const { document } = window;

// Mock crypto for hash tools
window.crypto = {
  randomUUID: () => '00000000-0000-4000-8000-000000000000',
  subtle: {
    digest: async () => new Uint8Array(32).buffer,
  },
};

window.screen = { width: 1920, height: 1080 };
window.navigator = { userAgent: 'test', platform: 'test', language: 'en', cookieEnabled: true, onLine: true };
window.devicePixelRatio = 1;
// Mock canvas for jsdom
window.HTMLCanvasElement.prototype.getContext = function () {
  return {
    fillStyle: '', fillRect: () => {}, drawImage: () => {}, stroke: () => {},
    beginPath: () => {}, moveTo: () => {}, lineTo: () => {},
    fillText: () => {}, measureText: (t) => ({ width: t.length * 10 }),
    getImageData: () => ({ data: new Uint8ClampedArray(256) }),
  };
};
window.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,test';

const scriptEl = document.createElement('script');
scriptEl.textContent = shared + '\n' + allTools + '\n' + allToolsExt + '\n' + allToolsMega;
document.body.appendChild(scriptEl);

const failures = [];
for (const tool of tools) {
  const root = document.getElementById('tool-root');
  root.innerHTML = '';
  root.dataset.tool = tool.id;
  delete root.dataset.from;
  delete root.dataset.to;
  const fn = window.JotTools && window.JotTools[tool.id];
  if (!fn) {
    failures.push({ id: tool.id, error: 'No JotTools function' });
    continue;
  }
  try {
    fn(root);
    if (!root.querySelector('.tool-ui') && !root.innerHTML.trim()) {
      failures.push({ id: tool.id, error: 'Mounted but empty DOM' });
    }
  } catch (e) {
    failures.push({ id: tool.id, error: e.message });
  }
}

if (failures.length) {
  console.error('FAILURES (' + failures.length + '):');
  failures.forEach(f => console.error(' -', f.id + ':', f.error));
  process.exit(1);
}
console.log('OK: All', tools.length, 'tools mounted without throwing');
