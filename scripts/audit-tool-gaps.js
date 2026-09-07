/**
 * Audits live tools for UX completeness after polishToolUx.
 * Run: node scripts/audit-tool-gaps.js
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
});

const { window } = dom;
const { document } = window;

window.crypto = {
  randomUUID: () => '00000000-0000-4000-8000-000000000000',
  subtle: { digest: async () => new Uint8Array(32).buffer },
};
window.screen = { width: 1920, height: 1080 };
window.navigator = { userAgent: 'test', platform: 'test', language: 'en', cookieEnabled: true, onLine: true };
window.devicePixelRatio = 1;
window.HTMLCanvasElement.prototype.getContext = function () {
  return {
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: 'left', globalAlpha: 1,
    fillRect: () => {}, strokeRect: () => {}, rect: () => {}, drawImage: () => {},
    stroke: () => {}, strokeText: () => {},
    beginPath: () => {}, moveTo: () => {}, lineTo: () => {}, closePath: () => {},
    fillText: () => {}, measureText: (t) => ({ width: String(t).length * 10 }),
    getImageData: () => ({ data: new Uint8ClampedArray(256) }),
  };
};
window.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,test';

const scriptEl = document.createElement('script');
scriptEl.textContent = shared + '\n' + allTools + '\n' + allToolsExt + '\n' + allToolsMega;
document.body.appendChild(scriptEl);
window.Jot.loadScript = async () => {};

const live = tools.filter(t => t.status === 'live');
const gaps = [];

for (const tool of live) {
  const root = document.getElementById('tool-root');
  root.innerHTML = '';
  root.dataset.tool = tool.id;
  root.dataset.toolDesc = tool.description || '';
  root.dataset.toolCategory = tool.category || '';
  const fn = window.JotTools?.[tool.id];
  if (!fn) { gaps.push({ id: tool.id, issues: ['missing implementation'] }); continue; }
  try {
    fn(root);
    window.Jot.enhanceFileInputs?.(root);
    window.Jot.polishToolUx?.(root);
  } catch (e) {
    gaps.push({ id: tool.id, issues: ['mount error: ' + e.message] });
    continue;
  }
  const ui = root.querySelector('.tool-ui');
  if (!ui) { gaps.push({ id: tool.id, issues: ['empty UI'] }); continue; }

  const issues = [];
  if (!ui.querySelector('.hint')) issues.push('no hint');
  if (!ui.querySelector('.local-badge')) issues.push('no privacy badge');
  const hasOutput = ui.querySelector('#out, .output, canvas, #preview, #prev, .preview-box, #qr-wrap, .compare-grid, .stats, .tool-live-output, #scale, #table, #list, .palette');
  const hasAction = ui.querySelector('.btn, button[type="button"], input[type="file"]');
  if (!hasOutput && !hasAction) issues.push('no output or action');
  if (issues.length) gaps.push({ id: tool.id, issues });
}

if (gaps.length) {
  console.log('Tools with remaining gaps after polish:', gaps.length);
  gaps.slice(0, 30).forEach(g => console.log(' -', g.id + ':', g.issues.join(', ')));
  if (gaps.length > 30) console.log(` ... and ${gaps.length - 30} more`);
} else {
  console.log('OK: All', live.length, 'live tools pass UX completeness audit');
}
