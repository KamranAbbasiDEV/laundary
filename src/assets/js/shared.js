window.Jot = window.Jot || {};

Jot.$ = (sel, root = document) => root.querySelector(sel);
Jot.$$ = (sel, root = document) => [...root.querySelectorAll(sel)];

Jot.mount = function (fn) {
  document.addEventListener('DOMContentLoaded', () => {
    const root = Jot.$('#tool-root');
    if (root) fn(root);
  });
};

Jot.ui = function (html) {
  const wrap = document.createElement('div');
  wrap.className = 'tool-ui';
  wrap.innerHTML = html;
  return wrap;
};

Jot.toast = function (message) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(Jot._toastTimer);
  Jot._toastTimer = setTimeout(() => el.classList.remove('show'), 2000);
};

Jot.copy = async function (text, btn) {
  try {
    await navigator.clipboard.writeText(text);
    if (btn) {
      const orig = btn.textContent;
      btn.textContent = 'Copied';
      setTimeout(() => { btn.textContent = orig; }, 1500);
    } else {
      Jot.toast('Copied to clipboard');
    }
  } catch {
    Jot.toast('Copy failed — select text manually');
  }
};

Jot.download = function (filename, content, type = 'text/plain') {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
};

Jot.readFile = function (input, cb) {
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => cb(reader.result, file);
  reader.readAsText(file);
};

Jot.readFileBinary = function (input, cb) {
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => cb(reader.result, file);
  reader.readAsArrayBuffer(file);
};

Jot.assignFiles = function (input, files) {
  if (!input || !files?.length) return false;
  const dt = new DataTransfer();
  if (input.multiple) {
    [...files].forEach(f => dt.items.add(f));
  } else {
    dt.items.add(files[0]);
  }
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
};

Jot.enhanceFileInputs = function (root) {
  if (!root) return;
  Jot.$$(('input[type="file"]:not([data-drop-enhanced])'), root).forEach(input => {
    input.dataset.dropEnhanced = '1';
    if (input.closest('.file-drop-zone')) return;

    const zone = document.createElement('div');
    zone.className = 'file-drop-zone';
    zone.tabIndex = 0;
    zone.setAttribute('role', 'button');
    zone.setAttribute('aria-label', input.multiple ? 'Upload files' : 'Upload file');

    const hint = document.createElement('p');
    hint.className = 'file-drop-hint';
    hint.innerHTML = input.multiple
      ? '<strong>Drag & drop files here</strong><span>or click to browse</span>'
      : '<strong>Drag & drop a file here</strong><span>or click to browse</span>';

    const name = document.createElement('p');
    name.className = 'file-drop-name';
    name.textContent = 'No file selected';

    input.classList.add('file-drop-input');
    input.parentNode.insertBefore(zone, input);
    zone.appendChild(hint);
    zone.appendChild(name);
    zone.appendChild(input);

    const showName = () => {
      const files = input.files;
      if (!files?.length) {
        name.textContent = 'No file selected';
        zone.classList.remove('file-drop-zone--has-file');
        return;
      }
      name.textContent = files.length === 1 ? files[0].name : `${files.length} files selected`;
      zone.classList.add('file-drop-zone--has-file');
    };

    input.addEventListener('change', showName);

    const activate = () => zone.classList.add('file-drop-zone--active');
    const deactivate = () => zone.classList.remove('file-drop-zone--active');

    zone.addEventListener('click', e => {
      if (e.target === input) return;
      input.click();
    });

    zone.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        input.click();
      }
    });

    ['dragenter', 'dragover'].forEach(ev => {
      zone.addEventListener(ev, e => {
        e.preventDefault();
        activate();
      });
    });

    zone.addEventListener('dragleave', e => {
      if (!zone.contains(e.relatedTarget)) deactivate();
    });

    zone.addEventListener('drop', e => {
      e.preventDefault();
      deactivate();
      const files = e.dataTransfer?.files;
      if (!files?.length) return;
      Jot.assignFiles(input, files);
      showName();
    });

    showName();
  });
};

Jot.setStatus = function (el, msg, type = 'success') {
  el.textContent = msg;
  el.className = type === 'error' ? 'error' : 'success-msg';
};

Jot.simpleMarkdown = function (md) {
  let html = md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^### (.*)$/gm, '<h3>$1</h3>')
    .replace(/^## (.*)$/gm, '<h2>$1</h2>')
    .replace(/^# (.*)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/^\s*[-*] (.*)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`)
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hul])/gm, '');
  return `<div class="md-preview"><p>${html}</p></div>`;
};

Jot.formatJSON = function (str, indent = 2) {
  return JSON.stringify(JSON.parse(str), null, indent);
};

Jot.csvFromJson = function (arr) {
  if (!Array.isArray(arr) || !arr.length) throw new Error('JSON must be a non-empty array of objects');
  const keys = [...new Set(arr.flatMap(Object.keys))];
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [keys.join(','), ...arr.map(row => keys.map(k => esc(row[k])).join(','))].join('\n');
};

Jot.parseCSV = function (text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).filter(Boolean).map(line => {
    const vals = line.match(/("([^"]|"")*"|[^,]*)/g) || [];
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = (vals[i] || '').replace(/^"|"$/g, '').replace(/""/g, '"').trim();
    });
    return obj;
  });
};

Jot.slugify = s => s.toLowerCase().trim()
  .replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');

Jot.caseConvert = {
  upper: s => s.toUpperCase(),
  lower: s => s.toLowerCase(),
  title: s => s.replace(/\w\S*/g, t => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()),
  sentence: s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(),
  camel: s => s.replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '').replace(/^./, m => m.toLowerCase())
};

Jot.uuid = () => crypto.randomUUID();

Jot.randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

Jot.convertUnit = function (value, conv) {
  const v = parseFloat(value);
  if (isNaN(v)) return NaN;
  if (conv.special === 'f_to_c') return (v - 32) * 5 / 9;
  if (conv.special === 'c_to_f') return v * 9 / 5 + 32;
  if (conv.special === 'mpg_to_l100') return 235.215 / v;
  if (conv.special === 'l100_to_mpg') return 235.215 / v;
  if (conv.special === 'f_to_k') return (v - 32) * 5 / 9 + 273.15;
  if (conv.special === 'k_to_f') return (v - 273.15) * 9 / 5 + 32;
  if (conv.op === 'mul') return v * conv.factor;
  if (conv.op === 'div') return v / conv.factor;
  if (conv.op === 'add') return v + conv.factor;
  if (conv.op === 'sub') return v - conv.factor;
  return v;
};

Jot.hash = async function (algo, text) {
  try {
    const buf = await crypto.subtle.digest(algo, new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    throw new Error(algo + ' not supported in this browser: ' + e.message);
  }
};

Jot.hashFile = async function (algo, buffer) {
  try {
    const buf = await crypto.subtle.digest(algo, buffer);
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    throw new Error(algo + ' not supported: ' + e.message);
  }
};

Jot.decodeJwt = function (token) {
  const parts = token.split('.');
  if (parts.length < 2) throw new Error('Invalid JWT format');
  const decode = p => JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/')));
  return { header: decode(parts[0]), payload: decode(parts[1]), signature: parts[2] || '' };
};

Jot.cronExplain = function (expr) {
  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5) throw new Error('Cron needs 5 fields: minute hour day month weekday');
  const [min, hour, dom, mon, dow] = parts;
  const bits = [];
  if (min === '*') bits.push('every minute');
  else if (min.startsWith('*/')) bits.push(`every ${min.slice(2)} minutes`);
  else bits.push(`at minute ${min}`);
  if (hour !== '*') bits.push(`hour ${hour}`);
  if (dom !== '*') bits.push(`day ${dom} of month`);
  if (mon !== '*') bits.push(`month ${mon}`);
  if (dow !== '*') bits.push(`weekday ${dow}`);
  return `Runs ${bits.join(', ')}.`;
};

Jot.romanToInt = function (roman) {
  const map = { I:1,V:5,X:10,L:50,C:100,D:500,M:1000 };
  const s = roman.toUpperCase().trim();
  if (!/^[IVXLCDM]+$/.test(s)) throw new Error('Invalid Roman numeral characters');
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const cur = map[s[i]], next = map[s[i+1]];
    if (!cur) throw new Error('Invalid Roman numeral');
    n += cur < next ? -cur : cur;
  }
  return n;
};

Jot.intToRoman = function (num) {
  const vals = [[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];
  let n = num, out = '';
  for (const [v,s] of vals) { while (n >= v) { out += s; n -= v; } }
  return out;
};

Jot.numberToWords = function (n) {
  if (n === 0) return 'zero';
  const ones = ['','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
  const tens = ['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
  const scales = ['','thousand','million','billion'];
  function chunk(num) {
    let s = '';
    if (num >= 100) { s += ones[Math.floor(num/100)] + ' hundred '; num %= 100; }
    if (num >= 20) { s += tens[Math.floor(num/10)] + (num%10 ? '-' + ones[num%10] : ''); }
    else if (num > 0) s += ones[num];
    return s.trim();
  }
  let i = 0, parts = [];
  while (n > 0) {
    const c = n % 1000;
    if (c) parts.unshift(chunk(c) + (scales[i] ? ' ' + scales[i] : ''));
    n = Math.floor(n / 1000); i++;
  }
  return parts.join(' ').trim();
};

Jot.passwordScore = function (pw) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  const labels = ['Very weak','Weak','Fair','Strong','Very strong'];
  const crack = [('<1 sec'), ('minutes'), ('hours'), ('years'), ('centuries')];
  return { score, label: labels[score] || labels[0], crack: crack[score] || crack[0] };
};

Jot.loadScript = function (src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
};

Jot.det = function (m) {
  const n = m.length;
  if (n === 1) return m[0][0];
  if (n === 2) return m[0][0]*m[1][1]-m[0][1]*m[1][0];
  if (n === 3) return m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1])-m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0])+m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]);
  throw new Error('Max 3x3 matrix supported');
};

Jot.drawQR = function (canvas, text) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const size = 200;
  canvas.width = size; canvas.height = size;
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#000';
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  const mod = Math.abs(hash);
  const cells = 25, cell = size / cells;
  for (let r = 0; r < cells; r++) {
    for (let c = 0; c < cells; c++) {
      const v = (mod * (r + 1) * (c + 7) + r * c) % 97;
      if ((r < 7 && c < 7) || (r < 7 && c > 17) || (r > 17 && c < 7)) {
        if ((r === 0 || r === 6 || c === 0 || c === 6 || (r > 1 && r < 5 && c > 1 && c < 5)) && (r < 7 && c < 7)) ctx.fillRect(c*cell,r*cell,cell,cell);
        else if (r < 7 && c > 17 && (r === 0 || r === 6 || c === 18 || c === 24 || (r > 1 && r < 5 && c > 19 && c < 23))) ctx.fillRect(c*cell,r*cell,cell,cell);
        else if (r > 17 && c < 7 && (r === 18 || r === 24 || c === 0 || c === 6 || (r > 19 && r < 23 && c > 1 && c < 5))) ctx.fillRect(c*cell,r*cell,cell,cell);
      } else if (v % 3 === 0) ctx.fillRect(c*cell, r*cell, cell, cell);
    }
  }
};
