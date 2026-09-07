// Extended tools bundle — 81 additional tools

// Hand-written extended tool implementations (included by generate-extended-catalog.js)

Jot._factorUI = function (root, units) {
  const opts = units.map(u => '<option value="' + u.id + '">' + u.label + '</option>').join('');
  const ui = Jot.ui('<div class="row"><label>Amount <input type="number" id="val" value="1" step="any"></label></div><div class="row"><label>From <select id="from">' + opts + '</select></label><label>To <select id="to">' + opts + '</select></label></div><div class="btn-row"><button class="btn" id="go">Convert</button><button class="btn btn-secondary" id="swap">Swap</button></div><div class="output output--empty" id="out">Results will appear here.</div>');
  root.appendChild(ui);
  const map = Object.fromEntries(units.map(u => [u.id, u]));
  function run() {
    const v = +Jot.$('#val', ui).value, from = map[Jot.$('#from', ui).value], to = map[Jot.$('#to', ui).value];
    if (!from || !to || isNaN(v)) return;
    const base = from.toBase(v);
    Jot.$('#out', ui).textContent = to.fromBase(base).toFixed(6).replace(/\.0+$/, '') + ' ' + to.label;
  }
  Jot.$('#go', ui).onclick = run;
  Jot.$('#swap', ui).onclick = () => { const a = Jot.$('#from', ui); const b = Jot.$('#to', ui); const t = a.value; a.value = b.value; b.value = t; run(); };
  run();
};

JotTools['pressure-converter'] = function (root) {
  Jot._factorUI(root, [
    { id: 'psi', label: 'PSI', toBase: v => v * 6894.76, fromBase: v => v / 6894.76 },
    { id: 'bar', label: 'Bar', toBase: v => v * 100000, fromBase: v => v / 100000 },
    { id: 'pa', label: 'Pascal', toBase: v => v, fromBase: v => v },
    { id: 'atm', label: 'atm', toBase: v => v * 101325, fromBase: v => v / 101325 }
  ]);
};

JotTools['energy-converter'] = function (root) {
  Jot._factorUI(root, [
    { id: 'j', label: 'Joules', toBase: v => v, fromBase: v => v },
    { id: 'cal', label: 'Calories', toBase: v => v * 4.184, fromBase: v => v / 4.184 },
    { id: 'kwh', label: 'kWh', toBase: v => v * 3.6e6, fromBase: v => v / 3.6e6 },
    { id: 'btu', label: 'BTU', toBase: v => v * 1055.06, fromBase: v => v / 1055.06 }
  ]);
};

JotTools['power-converter'] = function (root) {
  Jot._factorUI(root, [
    { id: 'w', label: 'Watts', toBase: v => v, fromBase: v => v },
    { id: 'kw', label: 'kW', toBase: v => v * 1000, fromBase: v => v / 1000 },
    { id: 'hp', label: 'Horsepower', toBase: v => v * 745.7, fromBase: v => v / 745.7 }
  ]);
};

JotTools['torque-converter'] = function (root) {
  Jot._factorUI(root, [
    { id: 'nm', label: 'N·m', toBase: v => v, fromBase: v => v },
    { id: 'lbft', label: 'lb·ft', toBase: v => v * 1.35582, fromBase: v => v / 1.35582 }
  ]);
};

JotTools['frequency-converter'] = function (root) {
  Jot._factorUI(root, [
    { id: 'hz', label: 'Hz', toBase: v => v, fromBase: v => v },
    { id: 'khz', label: 'kHz', toBase: v => v * 1e3, fromBase: v => v / 1e3 },
    { id: 'mhz', label: 'MHz', toBase: v => v * 1e6, fromBase: v => v / 1e6 }
  ]);
};

JotTools['data-rate'] = function (root) {
  Jot._factorUI(root, [
    { id: 'mbps', label: 'Mbps', toBase: v => v, fromBase: v => v },
    { id: 'mbs', label: 'MB/s', toBase: v => v * 8, fromBase: v => v / 8 },
    { id: 'kbps', label: 'Kbps', toBase: v => v / 1000, fromBase: v => v * 1000 }
  ]);
};

JotTools['speed-converter'] = function (root) {
  Jot._factorUI(root, [
    { id: 'ms', label: 'm/s', toBase: v => v, fromBase: v => v },
    { id: 'kmh', label: 'km/h', toBase: v => v / 3.6, fromBase: v => v * 3.6 },
    { id: 'mph', label: 'mph', toBase: v => v * 0.44704, fromBase: v => v / 0.44704 }
  ]);
};

JotTools['area-converter'] = function (root) {
  Jot._factorUI(root, [
    { id: 'sqft', label: 'sq ft', toBase: v => v, fromBase: v => v },
    { id: 'sqm', label: 'sq m', toBase: v => v * 10.7639, fromBase: v => v / 10.7639 },
    { id: 'acre', label: 'acres', toBase: v => v * 43560, fromBase: v => v / 43560 }
  ]);
};

JotTools['angle-converter'] = function (root) {
  const ui = Jot.ui('<div class="row"><label>Value <input type="number" id="v" value="90"></label><label>From <select id="f"><option value="deg">Degrees</option><option value="rad">Radians</option><option value="grad">Gradians</option></select></label></div><div class="btn-row"><button class="btn" id="go">Convert all</button></div><div class="output output--empty" id="out">Results will appear here.</div>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    let d = +Jot.$('#v', ui).value;
    const f = Jot.$('#f', ui).value;
    if (f === 'rad') d = d * 180 / Math.PI;
    if (f === 'grad') d = d * 0.9;
    Jot.$('#out', ui).textContent = `Degrees: ${d.toFixed(4)}\nRadians: ${(d * Math.PI / 180).toFixed(4)}\nGradians: ${(d / 0.9).toFixed(4)}`;
  };
  Jot.$('#go', ui).click();
};

JotTools['fuel-economy'] = function (root) {
  const ui = Jot.ui('<div class="row"><label>MPG (US) <input type="number" id="mpg" value="30"></label></div><div class="output output--empty" id="out">Results will appear here.</div>');
  root.appendChild(ui);
  Jot.$('#mpg', ui).oninput = () => {
    const mpg = +Jot.$('#mpg', ui).value;
    if (!mpg) return;
    Jot.$('#out', ui).textContent = `L/100km: ${(235.215 / mpg).toFixed(2)}\nkm/L: ${(mpg * 0.425144).toFixed(2)}`;
  };
  Jot.$('#mpg', ui).dispatchEvent(new Event('input'));
};

JotTools['cooking-converter'] = function (root) {
  const ui = Jot.ui('<div class="row"><label>Cups <input type="number" id="c" value="1" step="0.25"></label></div><div class="output output--empty" id="out">Results will appear here.</div>');
  root.appendChild(ui);
  Jot.$('#c', ui).oninput = () => {
    const c = +Jot.$('#c', ui).value;
    Jot.$('#out', ui).textContent = `Tbsp: ${(c * 16).toFixed(1)}\nml: ${(c * 236.588).toFixed(0)}\nfl oz: ${(c * 8).toFixed(2)}`;
  };
  Jot.$('#c', ui).dispatchEvent(new Event('input'));
};

JotTools['kelvin-converter'] = function (root) {
  const ui = Jot.ui('<div class="row"><label>Celsius <input type="number" id="c" value="25"></label></div><div class="output output--empty" id="out">Results will appear here.</div>');
  root.appendChild(ui);
  Jot.$('#c', ui).oninput = () => {
    const c = +Jot.$('#c', ui).value;
    Jot.$('#out', ui).textContent = `Kelvin: ${(c + 273.15).toFixed(2)} K\nFahrenheit: ${(c * 9/5 + 32).toFixed(2)} °F`;
  };
  Jot.$('#c', ui).dispatchEvent(new Event('input'));
};

JotTools['nautical-converter'] = function (root) {
  const ui = Jot.ui('<div class="row"><label>Nautical miles <input type="number" id="n" value="1"></label></div><div class="output output--empty" id="out">Results will appear here.</div>');
  root.appendChild(ui);
  Jot.$('#n', ui).oninput = () => {
    const n = +Jot.$('#n', ui).value;
    Jot.$('#out', ui).textContent = `Kilometers: ${(n * 1.852).toFixed(3)}\nStatute miles: ${(n * 1.15078).toFixed(3)}`;
  };
  Jot.$('#n', ui).dispatchEvent(new Event('input'));
};

JotTools['stone-converter'] = function (root) {
  const ui = Jot.ui('<div class="row"><label>Stone <input type="number" id="st" value="10"></label><label>Pounds <input type="number" id="lb" value="0"></label></div><div class="output output--empty" id="out">Results will appear here.</div>');
  root.appendChild(ui);
  function run() {
    const kg = (+Jot.$('#st', ui).value * 6.35029) + (+Jot.$('#lb', ui).value * 0.453592);
    Jot.$('#out', ui).textContent = `Kilograms: ${kg.toFixed(2)} kg\nPounds total: ${(kg / 0.453592).toFixed(1)} lb`;
  }
  Jot.$('#st', ui).oninput = run; Jot.$('#lb', ui).oninput = run; run();
};

JotTools['shoe-size'] = function (root) {
  const ui = Jot.ui('<div class="row"><label>US Men <input type="number" id="us" value="10" step="0.5"></label></div><div class="output output--empty" id="out">Results will appear here.</div>');
  root.appendChild(ui);
  Jot.$('#us', ui).oninput = () => {
    const us = +Jot.$('#us', ui).value;
    Jot.$('#out', ui).textContent = `UK: ${(us - 0.5).toFixed(1)}\nEU: ${(us + 33).toFixed(0)}\nCM: ${((us + 22) * 0.847).toFixed(1)} (approx)`;
  };
  Jot.$('#us', ui).dispatchEvent(new Event('input'));
};

JotTools['ring-size'] = function (root) {
  const ui = Jot.ui('<div class="row"><label>US size <input type="number" id="us" value="7" step="0.25"></label></div><div class="output output--empty" id="out">Results will appear here.</div>');
  root.appendChild(ui);
  Jot.$('#us', ui).oninput = () => {
    const us = +Jot.$('#us', ui).value;
    Jot.$('#out', ui).textContent = `UK: ${(us - 0.5).toFixed(2)}\nDiameter mm: ${(11.63 + us * 0.813).toFixed(2)} (approx)`;
  };
  Jot.$('#us', ui).dispatchEvent(new Event('input'));
};

JotTools['rgb-cmyk'] = function (root) {
  const ui = Jot.ui('<div class="row"><label>Hex <input type="text" id="hex" value="#2563eb"></label></div><div class="btn-row"><button class="btn" id="go">Convert</button></div><div class="output output--empty" id="out">Results will appear here.</div>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    let h = Jot.$('#hex', ui).value.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255;
    const k = 1 - Math.max(r, g, b);
    const c = k === 1 ? 0 : (1 - r - k) / (1 - k);
    const m = k === 1 ? 0 : (1 - g - k) / (1 - k);
    const y = k === 1 ? 0 : (1 - b - k) / (1 - k);
    Jot.$('#out', ui).textContent = `CMYK: ${(c*100).toFixed(0)}%, ${(m*100).toFixed(0)}%, ${(y*100).toFixed(0)}%, ${(k*100).toFixed(0)}%`;
  };
  Jot.$('#go', ui).click();
};

JotTools['hours-decimal'] = function (root) {
  const ui = Jot.ui('<div class="row"><label>Hours <input type="number" id="h" value="2"></label><label>Minutes <input type="number" id="m" value="30"></label></div><div class="output output--empty" id="out">Results will appear here.</div>');
  root.appendChild(ui);
  function run() { Jot.$('#out', ui).textContent = 'Decimal hours: ' + (+Jot.$('#h', ui).value + +Jot.$('#m', ui).value / 60).toFixed(4); }
  Jot.$('#h', ui).oninput = run; Jot.$('#m', ui).oninput = run; run();
};

JotTools['fuel-cost'] = function (root) {
  const ui = Jot.ui('<div class="row"><label>Distance (miles) <input type="number" id="d" value="100"></label><label>MPG <input type="number" id="mpg" value="28"></label><label>Price/gal $<input type="number" id="p" value="3.5" step="0.01"></label></div><div class="output output--empty" id="out">Results will appear here.</div>');
  root.appendChild(ui);
  function run() {
    const cost = (+Jot.$('#d', ui).value / +Jot.$('#mpg', ui).value) * +Jot.$('#p', ui).value;
    Jot.$('#out', ui).textContent = `Trip fuel cost: $${cost.toFixed(2)}`;
  }
  Jot.$('#d', ui).oninput = run; Jot.$('#mpg', ui).oninput = run; Jot.$('#p', ui).oninput = run; run();
};

Jot._loadImg = function (file, cb) { const img = new Image(); img.onload = () => cb(img); img.src = URL.createObjectURL(file); };
Jot._canvasFromImg = function (img, w, h) {
  const c = document.createElement('canvas');
  c.width = w || img.width; c.height = h || img.height;
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c;
};

JotTools['background-remover'] = function (root) {
  const ui = Jot.ui(`<input type="file" id="file" accept="image/*">
    <div class="btn-row"><button class="btn" id="go" disabled>Remove background</button><button class="btn btn-secondary" id="dl" disabled>Download PNG</button></div>
    <p class="hint" style="margin-top:0">First use downloads an AI model (~40MB). Processing runs locally.</p>
    <div class="compare-grid" id="compare" style="display:none">
      <div class="compare-card"><p class="compare-label">Original</p><img id="prev-orig" alt="Original"></div>
      <div class="compare-card"><p class="compare-label">Result preview</p><canvas id="c"></canvas></div>
    </div>
    <div class="output output--empty" id="out">Upload an image to preview the result.</div>`);
  root.appendChild(ui);
  let file;
  Jot.$('#file', ui).onchange = e => {
    file = e.target.files?.[0];
    if (!file) return;
    Jot._loadImg(file, img => {
      Jot.$('#prev-orig', ui).src = img.src;
      Jot.$('#compare', ui).style.display = '';
      Jot.$('#go', ui).disabled = false;
      Jot.$('#out', ui).textContent = `Ready to process ${file.name}`;
    });
  };
  Jot.$('#go', ui).onclick = async () => {
    if (!file) { Jot.toast('Please upload a file first'); return; }
    Jot.$('#out', ui).textContent = 'Loading AI model…';
    try {
      await Jot.loadScript('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.5/dist/index.min.js');
      const blob = await removeBackground(file);
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const c = Jot.$('#c', ui); c.width = img.width; c.height = img.height;
        c.getContext('2d').drawImage(img, 0, 0);
        Jot.$('#out', ui).textContent = 'Done — download your transparent PNG below.';
        Jot.$('#dl', ui).disabled = false;
        Jot.$('#dl', ui).onclick = () => {
          const a = document.createElement('a'); a.href = url; a.download = 'no-bg.png'; a.click();
        };
      };
      img.src = url;
    } catch (e) { Jot.$('#out', ui).textContent = 'Error: ' + e.message; }
  };
};

JotTools['image-cropper'] = function (root) {
  const ui = Jot.ui(`<input type="file" accept="image/*" id="file">
    <div class="tool-panel tool-panel--locked" id="settings">
      <p class="tool-panel-title">Crop area</p>
      <p class="tool-panel-note" id="settings-note">Upload an image above to set crop coordinates.</p>
      <div class="row">
        <label>X <input type="number" id="x" value="0" min="0" disabled></label>
        <label>Y <input type="number" id="y" value="0" min="0" disabled></label>
        <label>Width <input type="number" id="w" value="200" min="1" disabled></label>
        <label>Height <input type="number" id="h" value="200" min="1" disabled></label>
      </div>
      <p class="estimate-line" id="crop-info">Crop size will appear here after upload.</p>
    </div>
    <div class="compare-grid" id="compare" style="display:none">
      <div class="compare-card">
        <p class="compare-label">Original (crop area)</p>
        <div class="crop-source-wrap" id="source-wrap">
          <img id="prev-orig" alt="Original">
          <div class="crop-overlay" id="crop-box"></div>
        </div>
      </div>
      <div class="compare-card">
        <p class="compare-label">Cropped preview</p>
        <canvas id="c"></canvas>
      </div>
    </div>
    <div class="btn-row"><button class="btn" id="dl" disabled>Download cropped image</button></div>`);
  root.appendChild(ui);

  let img = null;
  let scale = 1;

  function clampCrop() {
    if (!img) return;
    let x = Math.max(0, +Jot.$('#x', ui).value || 0);
    let y = Math.max(0, +Jot.$('#y', ui).value || 0);
    let w = Math.max(1, +Jot.$('#w', ui).value || 1);
    let h = Math.max(1, +Jot.$('#h', ui).value || 1);
    if (x + w > img.width) w = img.width - x;
    if (y + h > img.height) h = img.height - y;
    Jot.$('#x', ui).value = x;
    Jot.$('#y', ui).value = y;
    Jot.$('#w', ui).value = w;
    Jot.$('#h', ui).value = h;
    return { x, y, w, h };
  }

  function renderCrop() {
    if (!img) return;
    const { x, y, w, h } = clampCrop();
    const c = Jot.$('#c', ui);
    c.width = w;
    c.height = h;
    c.getContext('2d').drawImage(img, x, y, w, h, 0, 0, w, h);

    const box = Jot.$('#crop-box', ui);
    const orig = Jot.$('#prev-orig', ui);
    scale = orig.clientWidth / img.width || 1;
    box.style.left = (x * scale) + 'px';
    box.style.top = (y * scale) + 'px';
    box.style.width = (w * scale) + 'px';
    box.style.height = (h * scale) + 'px';

    Jot.$('#crop-info', ui).textContent = `Crop: ${w}×${h}px from ${img.width}×${img.height}px original · region at (${x}, ${y})`;
    Jot.$('#dl', ui).disabled = false;
  }

  Jot.$('#file', ui).addEventListener('change', e => {
    const f = e.target.files?.[0];
    if (!f) { Jot.toast('Please upload a file first'); return; }
    Jot._loadImg(f, i => {
      img = i;
      Jot.unlockPanel(ui, '#settings', Jot.$$('#x,#y,#w,#h', ui));
      Jot.$('#prev-orig', ui).src = i.src;
      Jot.$('#w', ui).value = i.width;
      Jot.$('#h', ui).value = i.height;
      Jot.$('#compare', ui).style.display = '';
      renderCrop();
    });
  });

  Jot.$$('#x,#y,#w,#h', ui).forEach(el => el.addEventListener('input', renderCrop));
  window.addEventListener('resize', () => { if (img) renderCrop(); });

  Jot.$('#dl', ui).onclick = () => {
    if (!img) return;
    const a = document.createElement('a');
    a.href = Jot.$('#c', ui).toDataURL('image/png');
    a.download = 'cropped.png';
    a.click();
    Jot.toast('Download started');
  };
};

JotTools['image-rotate'] = function (root) {
  const ui = Jot.ui(`<input type="file" accept="image/*" id="file">
    <div class="btn-row"><button class="btn btn-secondary" data-a="90">Rotate 90°</button><button class="btn btn-secondary" data-a="180">180°</button><button class="btn btn-secondary" data-a="270">270°</button><button class="btn btn-secondary" id="flip">Flip H</button><button class="btn" id="go" disabled>Update preview</button><button class="btn btn-secondary" id="dl" disabled>Download</button></div>
    <div class="compare-grid" id="compare" style="display:none">
      <div class="compare-card"><p class="compare-label">Original</p><img id="prev-orig" alt="Original"></div>
      <div class="compare-card"><p class="compare-label">Preview</p><canvas id="c"></canvas></div>
    </div>`);
  root.appendChild(ui);
  let img, flip = false, lastDeg = 0;
  Jot.$('#file', ui).onchange = e => {
    const f = e.target.files[0]; if (!f) { Jot.toast('Please upload a file first'); return; }
    Jot._loadImg(f, i => {
      img = i;
      Jot.$('#prev-orig', ui).src = i.src;
      Jot.$('#compare', ui).style.display = '';
      Jot.$('#go', ui).disabled = false;
      draw(0);
    });
  };
  function draw(deg) {
    if (!img) return;
    lastDeg = deg;
    const c = Jot.$('#c', ui), rad = deg * Math.PI / 180;
    const w = deg % 180 ? img.height : img.width, h = deg % 180 ? img.width : img.height;
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.translate(w / 2, h / 2);
    ctx.rotate(rad);
    ctx.scale(flip ? -1 : 1, 1);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    Jot.$('#dl', ui).disabled = false;
  }
  Jot.$$('.btn[data-a]', ui).forEach(b => b.onclick = () => draw(+b.dataset.a));
  Jot.$('#flip', ui).onclick = () => { flip = !flip; draw(lastDeg); };
  Jot.$('#go', ui).onclick = () => draw(lastDeg);
  Jot.$('#dl', ui).onclick = () => { const a = document.createElement('a'); a.href = Jot.$('#c', ui).toDataURL('image/png'); a.download = 'rotated.png'; a.click(); };
};

['image-grayscale','image-blur','invert-image','pixelate-image'].forEach(id => {
  JotTools[id] = function (root) {
    const ui = Jot.ui(`<input type="file" accept="image/*" id="file">
      <div class="compare-grid" id="compare" style="display:none">
        <div class="compare-card"><p class="compare-label">Original</p><img id="prev-orig" alt="Original"></div>
        <div class="compare-card"><p class="compare-label">Preview</p><canvas id="c"></canvas></div>
      </div>
      <div class="btn-row"><button class="btn" id="go" disabled>Apply effect</button><button class="btn btn-secondary" id="dl" disabled>Download</button></div>`);
    root.appendChild(ui);
    let img;
    function apply() {
      if (!img) return;
      const c = Jot.$('#c', ui); c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d'); ctx.filter = 'none'; ctx.drawImage(img, 0, 0);
      if (id === 'image-blur') { ctx.filter = 'blur(6px)'; ctx.drawImage(img, 0, 0); }
      else if (id === 'pixelate-image') {
        const s = 14; const tw = Math.ceil(c.width / s), th = Math.ceil(c.height / s);
        const t = document.createElement('canvas'); t.width = tw; t.height = th;
        t.getContext('2d').drawImage(c, 0, 0, tw, th);
        ctx.imageSmoothingEnabled = false; ctx.drawImage(t, 0, 0, tw, th, 0, 0, c.width, c.height);
      } else {
        const d = ctx.getImageData(0, 0, c.width, c.height), p = d.data;
        for (let i = 0; i < p.length; i += 4) {
          if (id === 'image-grayscale') { const g = p[i] * 0.299 + p[i + 1] * 0.587 + p[i + 2] * 0.114; p[i] = p[i + 1] = p[i + 2] = g; }
          if (id === 'invert-image') { p[i] = 255 - p[i]; p[i + 1] = 255 - p[i + 1]; p[i + 2] = 255 - p[i + 2]; }
        }
        ctx.putImageData(d, 0, 0);
      }
      Jot.$('#dl', ui).disabled = false;
    }
    Jot.$('#file', ui).addEventListener('change', e => {
      const f = e.target.files[0]; if (!f) { Jot.toast('Please upload a file first'); return; }
      Jot._loadImg(f, i => {
        img = i;
        Jot.$('#prev-orig', ui).src = i.src;
        Jot.$('#compare', ui).style.display = '';
        Jot.$('#go', ui).disabled = false;
        apply();
      });
    });
    Jot.$('#go', ui).onclick = apply;
    Jot.$('#dl', ui).onclick = () => { const a = document.createElement('a'); a.href = Jot.$('#c', ui).toDataURL('image/png'); a.download = id + '.png'; a.click(); };
  };
});

JotTools['image-watermark'] = function (root) {
  const ui = Jot.ui(`<p class="hint">Upload an image, then add a text watermark and/or logo overlay.</p>
    <input type="file" accept="image/*" id="file">
    <div class="tool-panel tool-panel--locked" id="settings">
      <p class="tool-panel-note" id="settings-note">Upload an image above to unlock watermark options.</p>
      <label>Watermark text <input type="text" id="txt" value="© JotNexus" disabled></label>
      ${Jot.logoUploadHtml('wmlogo')}
      <label>Logo opacity <span id="opv" class="range-value">70%</span>
        <input type="range" id="opacity" min="0.1" max="1" step="0.05" value="0.7" disabled>
      </label>
    </div>
    <div class="btn-row"><button class="btn" id="go" disabled>Apply watermark</button><button class="btn btn-secondary" id="dl" disabled>Download</button></div>
    <canvas id="c" style="max-width:100%"></canvas>`);
  root.appendChild(ui);
  let logoDataUrl = '';
  Jot.bindLogoUpload(ui, { prefix: 'wmlogo', onChange: url => { logoDataUrl = url; apply(); } });

  function unlock() {
    Jot.$('#settings', ui).classList.remove('tool-panel--locked');
    Jot.$('#settings-note', ui).style.display = 'none';
    Jot.$('#txt', ui).disabled = false;
    Jot.$('#opacity', ui).disabled = false;
  }

  async function apply() {
    const f = Jot.$('#file', ui).files[0]; if (!f) { Jot.toast('Please upload a file first'); return; }
    Jot._loadImg(f, async img => {
      const c = Jot.$('#c', ui); c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
      const t = Jot.$('#txt', ui).value.trim();
      if (t) {
        ctx.font = Math.max(16, img.width / 20) + 'px sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 2;
        ctx.strokeText(t, 20, img.height - 30); ctx.fillText(t, 20, img.height - 30);
      }
      if (logoDataUrl) {
        const logo = await Jot.loadImageFromDataUrl(logoDataUrl);
        if (logo) {
          ctx.globalAlpha = +Jot.$('#opacity', ui).value;
          Jot.drawFitImage(ctx, logo, img.width - Math.min(img.width * 0.25, 180) - 20, 20, Math.min(img.width * 0.25, 180), Math.min(img.height * 0.15, 120));
          ctx.globalAlpha = 1;
        }
      }
      Jot.$('#dl', ui).disabled = false;
    });
  }

  Jot.$('#file', ui).addEventListener('change', () => { unlock(); apply(); });
  Jot.$('#go', ui).onclick = apply;
  Jot.$('#txt', ui).addEventListener('input', apply);
  Jot.$('#opacity', ui).addEventListener('input', () => {
    Jot.$('#opv', ui).textContent = `${Math.round(+Jot.$('#opacity', ui).value * 100)}%`;
    apply();
  });
  Jot.$('#dl', ui).onclick = () => { const a = document.createElement('a'); a.href = Jot.$('#c', ui).toDataURL('image/png'); a.download = 'watermarked.png'; a.click(); };
};

JotTools['webp-converter'] = function (root) {
  const ui = Jot.ui(`<input type="file" accept="image/*" id="file">
    <div class="compare-grid" id="compare" style="display:none">
      <div class="compare-card"><p class="compare-label">Original</p><img id="prev-orig" alt="Original"></div>
      <div class="compare-card"><p class="compare-label">Converted preview</p><img id="prev-out" alt="Preview"></div>
    </div>
    <div class="btn-row"><button class="btn" id="png" disabled>Download PNG</button><button class="btn btn-secondary" id="jpg" disabled>Download JPG</button><button class="btn btn-secondary" id="webp" disabled>Download WebP</button></div>
    <canvas id="c" style="display:none"></canvas>`);
  root.appendChild(ui);
  let img;
  Jot.$('#file', ui).onchange = e => {
    const f = e.target.files[0]; if (!f) { Jot.toast('Please upload a file first'); return; }
    Jot._loadImg(f, i => {
      img = i;
      Jot.$('#prev-orig', ui).src = i.src;
      Jot.$('#compare', ui).style.display = '';
      const c = Jot.$('#c', ui); c.width = i.width; c.height = i.height;
      c.getContext('2d').drawImage(i, 0, 0);
      Jot.$('#prev-out', ui).src = c.toDataURL('image/png');
      Jot.$$('#png,#jpg,#webp', ui).forEach(b => { b.disabled = false; });
    });
  };
  function save(type, ext) {
    if (!img) return;
    const c = Jot.$('#c', ui); c.width = img.width; c.height = img.height;
    c.getContext('2d').drawImage(img, 0, 0);
    const url = c.toDataURL(type, 0.92);
    Jot.$('#prev-out', ui).src = url;
    const a = document.createElement('a'); a.href = url; a.download = 'out.' + ext; a.click();
  }
  Jot.$('#png', ui).onclick = () => save('image/png', 'png');
  Jot.$('#jpg', ui).onclick = () => save('image/jpeg', 'jpg');
  Jot.$('#webp', ui).onclick = () => save('image/webp', 'webp');
};

JotTools['svg-to-png'] = function (root) {
  const ui = Jot.ui('<input type="file" accept="image/svg+xml,.svg" id="file"><div class="row"><label>Width <input type="number" id="w" value="512"></label></div><div class="btn-row"><button class="btn" id="go">Convert</button></div><canvas id="c" style="max-width:100%"></canvas>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const f = Jot.$('#file', ui).files[0]; if (!f) { Jot.toast('Please upload a file first'); return; }
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      const w = +Jot.$('#w', ui).value, h = img.height * (w / img.width);
      const c = Jot.$('#c', ui); c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      const a = document.createElement('a'); a.href = c.toDataURL('image/png'); a.download = 'svg.png'; a.click();
    };
    img.src = url;
  };
};

Jot._pdfLib = async function () {
  await Jot.loadScript('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js');
  return window.PDFLib;
};

JotTools['image-to-pdf'] = JotTools['images-to-pdf'] = function (root) {
  const multi = document.getElementById('tool-root').dataset.tool === 'images-to-pdf';
  const ui = Jot.ui('<input type="file" accept="image/*" id="file" ' + (multi ? 'multiple' : '') + '><div class="btn-row"><button class="btn" id="go">Create PDF</button></div><div class="output output--empty" id="out">Results will appear here.</div>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = async () => {
    const files = [...Jot.$('#file', ui).files]; if (!files.length) return;
    const { PDFDocument } = await Jot._pdfLib();
    const pdf = await PDFDocument.create();
    for (const f of files) {
      const buf = await f.arrayBuffer();
      const img = f.type.includes('png') ? await pdf.embedPng(buf) : await pdf.embedJpg(buf);
      const page = pdf.addPage([img.width, img.height]);
      page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
    }
    Jot.download('images.pdf', await pdf.save(), 'application/pdf');
    Jot.$('#out', ui).textContent = `Created PDF with ${files.length} page(s)`;
  };
};

JotTools['pdf-to-jpg'] = JotTools['pdf-to-images'] = function (root) {
  const ui = Jot.ui('<input type="file" accept="application/pdf" id="file"><div class="btn-row"><button class="btn" id="go">Export pages</button></div><div class="output output--empty" id="out">Results will appear here.</div><div id="prev"></div>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = async () => {
    const f = Jot.$('#file', ui).files[0]; if (!f) { Jot.toast('Please upload a file first'); return; }
    Jot.$('#out', ui).textContent = 'Rendering pages…';
    const pdfjs = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.mjs';
    const doc = await pdfjs.getDocument(await f.arrayBuffer()).promise;
    Jot.$('#prev', ui).innerHTML = '';
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const vp = page.getViewport({ scale: 1.5 });
      const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
      await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
      const a = document.createElement('a'); a.href = c.toDataURL('image/jpeg', 0.92); a.download = `page-${i}.jpg`; a.textContent = `Download page ${i}`; a.className = 'btn btn-secondary'; a.style.margin = '.25rem';
      Jot.$('#prev', ui).appendChild(a);
    }
    Jot.$('#out', ui).textContent = `Exported ${doc.numPages} page(s)`;
  };
};

JotTools['pdf-compressor'] = function (root) {
  const ui = Jot.ui(`
    <p class="hint">Upload a PDF to optimize and re-save locally. Text-based PDFs often shrink 5–30%; scanned pages may not compress much.</p>
    <input type="file" accept="application/pdf" id="file">
    <p class="estimate-line" id="pre-hint" style="display:none"></p>
    <div class="btn-row"><button class="btn" id="go" disabled>Compress & download</button></div>
    <div class="stats" id="stats" style="display:none">
      <div class="stat"><strong id="orig">—</strong>Original</div>
      <div class="stat"><strong id="new">—</strong>Optimized</div>
      <div class="stat"><strong id="saved">—</strong>Saved</div>
    </div>
    <div class="output output--empty" id="out">Results will appear here.</div>`);
  root.appendChild(ui);

  Jot.$('#file', ui).addEventListener('change', () => {
    const f = Jot.$('#file', ui).files?.[0];
    Jot.$('#go', ui).disabled = !f;
    const hint = Jot.$('#pre-hint', ui);
    if (!f) {
      hint.style.display = 'none';
      return;
    }
    hint.style.display = '';
    hint.textContent = `Ready to optimize ${f.name} (${Jot.formatBytes(f.size)}). Exact savings depend on how the PDF was built — you'll see results after compression.`;
  });

  Jot.$('#go', ui).onclick = async () => {
    const f = Jot.$('#file', ui).files?.[0];
    if (!f) { Jot.toast('Please upload a file first'); return; }
    const btn = Jot.$('#go', ui);
    btn.disabled = true;
    btn.textContent = 'Compressing…';
    Jot.$('#out', ui).textContent = 'Processing PDF in your browser…';
    try {
      const { PDFDocument } = await Jot._pdfLib();
      const src = await PDFDocument.load(await f.arrayBuffer(), { ignoreEncryption: true });
      const out = await PDFDocument.create();
      const pages = await out.copyPages(src, src.getPageIndices());
      pages.forEach(p => out.addPage(p));
      const bytes = await out.save({ useObjectStreams: true });
      Jot.download('compressed.pdf', bytes, 'application/pdf');
      const saved = Math.max(0, (1 - bytes.length / f.size) * 100);
      Jot.$('#orig', ui).textContent = Jot.formatBytes(f.size);
      Jot.$('#new', ui).textContent = Jot.formatBytes(bytes.length);
      Jot.$('#saved', ui).textContent = `${saved.toFixed(0)}% · ${Jot.formatBytes(Math.max(0, f.size - bytes.length))} saved`;
      Jot.$('#stats', ui).style.display = '';
      Jot.$('#out', ui).textContent = `Done — ${src.getPageCount()} page(s) optimized. Download started.`;
      Jot.toast('PDF compressed');
    } catch (e) {
      Jot.$('#out', ui).textContent = 'Could not compress this PDF. Try a different file.';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Compress & download';
    }
  };
};

JotTools['pdf-rotate'] = function (root) {
  const ui = Jot.ui('<input type="file" accept="application/pdf" id="file"><div class="row"><label>Page <input type="number" id="pg" value="1" min="1"></label><label>Degrees <select id="deg"><option value="90">90</option><option value="180">180</option><option value="270">270</option></select></label></div><div class="btn-row"><button class="btn" id="go">Rotate & Download</button></div>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = async () => {
    const f = Jot.$('#file', ui).files[0]; if (!f) { Jot.toast('Please upload a file first'); return; }
    const { PDFDocument, degrees } = await Jot._pdfLib();
    const pdf = await PDFDocument.load(await f.arrayBuffer());
    const i = +Jot.$('#pg', ui).value - 1;
    const page = pdf.getPage(i);
    page.setRotation(degrees(+Jot.$('#deg', ui).value));
    Jot.download('rotated.pdf', await pdf.save(), 'application/pdf');
  };
};

JotTools['pdf-delete-pages'] = function (root) {
  const ui = Jot.ui('<input type="file" accept="application/pdf" id="file"><label>Pages to remove (e.g. 1,3,5) <input type="text" id="rm" value="1"></label><div class="btn-row"><button class="btn" id="go">Delete pages</button></div>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = async () => {
    const f = Jot.$('#file', ui).files[0]; if (!f) { Jot.toast('Please upload a file first'); return; }
    const rm = new Set(Jot.$('#rm', ui).value.split(',').map(n => +n.trim() - 1));
    const { PDFDocument } = await Jot._pdfLib();
    const src = await PDFDocument.load(await f.arrayBuffer());
    const out = await PDFDocument.create();
    const idx = src.getPageIndices().filter(i => !rm.has(i));
    const pages = await out.copyPages(src, idx);
    pages.forEach(p => out.addPage(p));
    Jot.download('edited.pdf', await out.save(), 'application/pdf');
  };
};

JotTools['pdf-page-numbers'] = function (root) {
  const ui = Jot.ui('<input type="file" accept="application/pdf" id="file"><div class="btn-row"><button class="btn" id="go">Add page numbers</button></div>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = async () => {
    const f = Jot.$('#file', ui).files[0]; if (!f) { Jot.toast('Please upload a file first'); return; }
    const { PDFDocument, StandardFonts, rgb } = await Jot._pdfLib();
    const pdf = await PDFDocument.load(await f.arrayBuffer());
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    pdf.getPages().forEach((page, i) => {
      const { width } = page.getSize();
      page.drawText(String(i + 1), { x: width / 2 - 10, y: 20, size: 10, font, color: rgb(0.3, 0.3, 0.3) });
    });
    Jot.download('numbered.pdf', await pdf.save(), 'application/pdf');
  };
};

JotTools['text-to-pdf'] = function (root) {
  const ui = Jot.ui('<textarea id="in" rows="10" placeholder="Enter text..."></textarea><div class="btn-row"><button class="btn" id="go">Download PDF</button></div>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = async () => {
    const { PDFDocument, StandardFonts } = await Jot._pdfLib();
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([612, 792]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const lines = Jot.$('#in', ui).value.split('\n');
    let y = 750;
    lines.forEach(line => { if (y < 50) return; page.drawText(line.slice(0, 80), { x: 50, y, size: 11, font }); y -= 14; });
    Jot.download('text.pdf', await pdf.save(), 'application/pdf');
  };
};

JotTools['html-to-pdf'] = function (root) {
  const ui = Jot.ui('<textarea id="in" rows="8" placeholder="&lt;h1&gt;Hello&lt;/h1&gt;"></textarea><div class="btn-row"><button class="btn" id="go">Preview &amp; Print to PDF</button></div><iframe id="frame" style="width:100%;height:300px;border:1px solid var(--border);margin-top:1rem"></iframe>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const frame = Jot.$('#frame', ui);
    frame.srcdoc = Jot.$('#in', ui).value;
    frame.onload = () => frame.contentWindow.print();
  };
};

// Video/audio tools using ffmpeg.wasm
Jot._ffmpeg = async function (onLog) {
  await Jot.loadScript('https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/umd/ffmpeg.js');
  await Jot.loadScript('https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/umd/util.js');
  const { FFmpeg } = FFmpegWASM;
  const { fetchFile } = FFmpegUtil;
  const ff = new FFmpeg();
  if (onLog) ff.on('log', e => onLog(e.message));
  await ff.load({ coreURL: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js' });
  return { ff, fetchFile };
};

function ffmpegTool(root, accept, runFn) {
  const ui = Jot.ui('<input type="file" id="file" accept="' + accept + '"><div class="btn-row"><button class="btn" id="go" disabled>Process</button></div><div class="output output--empty" id="out">Ready — upload a file to begin. First run downloads encoder (~25MB, one-time).</div>');
  root.appendChild(ui);
  Jot.$('#file', ui).addEventListener('change', () => {
    Jot.$('#go', ui).disabled = !Jot.$('#file', ui).files?.[0];
  });
  Jot.$('#go', ui).onclick = async () => {
    const f = Jot.$('#file', ui).files[0]; if (!f) { Jot.toast('Please upload a file first'); return; }
    const btn = Jot.$('#go', ui);
    btn.disabled = true;
    Jot.$('#out', ui).textContent = 'Loading encoder…';
    try {
      const { ff, fetchFile } = await Jot._ffmpeg(m => { Jot.$('#out', ui).textContent = m.slice(0, 120); });
      await runFn(ff, fetchFile, f, ui);
    } catch (e) { Jot.$('#out', ui).textContent = 'Error: ' + e.message; }
    finally { btn.disabled = false; }
  };
}

JotTools['video-to-mp3'] = function (root) {
  ffmpegTool(root, 'video/*', async (ff, fetchFile, f, ui) => {
    await ff.writeFile('in', await fetchFile(f));
    await ff.exec(['-i', 'in', '-vn', '-acodec', 'libmp3lame', 'out.mp3']);
    const data = await ff.readFile('out.mp3');
    Jot.download('audio.mp3', data, 'audio/mpeg');
    Jot.$('#out', ui).textContent = 'Downloaded audio.mp3';
  });
};

JotTools['video-compressor'] = function (root) {
  ffmpegTool(root, 'video/*', async (ff, fetchFile, f, ui) => {
    await ff.writeFile('in', await fetchFile(f));
    await ff.exec(['-i', 'in', '-vcodec', 'libx264', '-crf', '28', 'out.mp4']);
    const data = await ff.readFile('out.mp4');
    Jot.download('compressed.mp4', data, 'video/mp4');
    Jot.$('#out', ui).textContent = 'Saved compressed.mp4';
  });
};

JotTools['video-trimmer'] = function (root) {
  const ui = Jot.ui('<input type="file" accept="video/*" id="file"><div class="row"><label>Start sec <input type="number" id="s" value="0"></label><label>End sec <input type="number" id="e" value="10"></label></div><div class="btn-row"><button class="btn" id="go">Trim</button></div><div class="output output--empty" id="out">Results will appear here.</div>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = async () => {
    const f = Jot.$('#file', ui).files[0]; if (!f) { Jot.toast('Please upload a file first'); return; }
    const s = Jot.$('#s', ui).value, e = Jot.$('#e', ui).value;
    Jot.$('#out', ui).textContent = 'Processing…';
    const { ff, fetchFile } = await Jot._ffmpeg();
    await ff.writeFile('in', await fetchFile(f));
    await ff.exec(['-i', 'in', '-ss', s, '-to', e, '-c', 'copy', 'out.mp4']);
    Jot.download('trimmed.mp4', await ff.readFile('out.mp4'), 'video/mp4');
    Jot.$('#out', ui).textContent = 'Done';
  };
};

JotTools['video-to-gif'] = function (root) {
  ffmpegTool(root, 'video/*', async (ff, fetchFile, f, ui) => {
    await ff.writeFile('in', await fetchFile(f));
    await ff.exec(['-i', 'in', '-t', '5', '-vf', 'fps=10,scale=480:-1', 'out.gif']);
    Jot.download('out.gif', await ff.readFile('out.gif'), 'image/gif');
    Jot.$('#out', ui).textContent = 'Downloaded GIF (first 5 sec)';
  });
};

JotTools['gif-to-mp4'] = function (root) {
  ffmpegTool(root, 'image/gif', async (ff, fetchFile, f, ui) => {
    await ff.writeFile('in.gif', await fetchFile(f));
    await ff.exec(['-i', 'in.gif', '-movflags', 'faststart', '-pix_fmt', 'yuv420p', 'out.mp4']);
    Jot.download('out.mp4', await ff.readFile('out.mp4'), 'video/mp4');
    Jot.$('#out', ui).textContent = 'Done';
  });
};

JotTools['video-mute'] = function (root) {
  ffmpegTool(root, 'video/*', async (ff, fetchFile, f, ui) => {
    await ff.writeFile('in', await fetchFile(f));
    await ff.exec(['-i', 'in', '-an', '-c:v', 'copy', 'out.mp4']);
    Jot.download('muted.mp4', await ff.readFile('out.mp4'), 'video/mp4');
    Jot.$('#out', ui).textContent = 'Audio removed';
  });
};

JotTools['video-speed'] = function (root) {
  const ui = Jot.ui('<input type="file" accept="video/*" id="file"><label>Speed <input type="number" id="sp" value="2" step="0.1" min="0.5" max="4"></label><div class="btn-row"><button class="btn" id="go">Change speed</button></div><div class="output output--empty" id="out">Results will appear here.</div>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = async () => {
    const f = Jot.$('#file', ui).files[0]; if (!f) { Jot.toast('Please upload a file first'); return; }
    const sp = +Jot.$('#sp', ui).value;
    Jot.$('#out', ui).textContent = 'Processing…';
    const { ff, fetchFile } = await Jot._ffmpeg();
    await ff.writeFile('in', await fetchFile(f));
    await ff.exec(['-i', 'in', '-filter:v', `setpts=${(1/sp).toFixed(2)}*PTS`, '-filter:a', `atempo=${Math.min(2, sp)}`, 'out.mp4']);
    Jot.download('speed.mp4', await ff.readFile('out.mp4'), 'video/mp4');
    Jot.$('#out', ui).textContent = 'Done';
  };
};

JotTools['audio-trimmer'] = function (root) {
  const ui = Jot.ui('<input type="file" accept="audio/*" id="file"><div class="row"><label>Start <input type="number" id="s" value="0"></label><label>End sec <input type="number" id="e" value="30"></label></div><div class="btn-row"><button class="btn" id="go">Trim</button></div><div class="output output--empty" id="out">Results will appear here.</div>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = async () => {
    const f = Jot.$('#file', ui).files[0]; if (!f) { Jot.toast('Please upload a file first'); return; }
    const { ff, fetchFile } = await Jot._ffmpeg();
    await ff.writeFile('in', await fetchFile(f));
    await ff.exec(['-i', 'in', '-ss', Jot.$('#s', ui).value, '-to', Jot.$('#e', ui).value, '-c', 'copy', 'out.mp3']);
    Jot.download('trimmed.mp3', await ff.readFile('out.mp3'), 'audio/mpeg');
    Jot.$('#out', ui).textContent = 'Done';
  };
};

JotTools['audio-converter'] = function (root) {
  ffmpegTool(root, 'audio/*', async (ff, fetchFile, f, ui) => {
    await ff.writeFile('in', await fetchFile(f));
    await ff.exec(['-i', 'in', 'out.wav']);
    Jot.download('out.wav', await ff.readFile('out.wav'), 'audio/wav');
    Jot.$('#out', ui).textContent = 'Converted to WAV';
  });
};

JotTools['merge-audio'] = function (root) {
  const ui = Jot.ui('<input type="file" accept="audio/*" id="file" multiple><div class="btn-row"><button class="btn" id="go">Merge</button></div><div class="output output--empty" id="out">Results will appear here.</div>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = async () => {
    const files = [...Jot.$('#file', ui).files]; if (files.length < 2) return;
    const { ff, fetchFile } = await Jot._ffmpeg();
    for (let i = 0; i < files.length; i++) await ff.writeFile('a' + i, await fetchFile(files[i]));
    const args = files.flatMap((_, i) => ['-i', 'a' + i]);
    args.push('-filter_complex', `concat=n=${files.length}:v=0:a=1`, 'out.mp3');
    await ff.exec(args);
    Jot.download('merged.mp3', await ff.readFile('out.mp3'), 'audio/mpeg');
    Jot.$('#out', ui).textContent = 'Merged ' + files.length + ' files';
  };
};

JotTools['text-to-speech'] = function (root) {
  const ui = Jot.ui('<textarea id="in" rows="6" placeholder="Text to speak"></textarea><div class="btn-row"><button class="btn" id="go">Speak</button><button class="btn btn-secondary" id="stop">Stop</button></div>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(Jot.$('#in', ui).value);
    speechSynthesis.speak(u);
  };
  Jot.$('#stop', ui).onclick = () => speechSynthesis.cancel();
};

JotTools['speech-to-text'] = function (root) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const ui = Jot.ui('<div class="btn-row"><button class="btn" id="go">Start listening</button><button class="btn btn-secondary" id="stop">Stop</button></div><textarea id="out" rows="8" placeholder="Transcript..."></textarea>');
  root.appendChild(ui);
  if (!SR) { Jot.$('#out', ui).value = 'Speech recognition not supported in this browser.'; return; }
  const rec = new SR(); rec.continuous = true; rec.interimResults = true;
  rec.onresult = e => { Jot.$('#out', ui).value = [...e.results].map(r => r[0].transcript).join(''); };
  Jot.$('#go', ui).onclick = () => rec.start();
  Jot.$('#stop', ui).onclick = () => rec.stop();
};

JotTools['scientific-calc'] = function (root) {
  const ui = Jot.ui('<input type="text" id="in" placeholder="e.g. sin(45)*2+sqrt(16)" style="font-family:var(--mono)"><div class="btn-row"><button class="btn" id="go">Calculate</button></div><div class="output output--empty" id="out">Results will appear here.</div>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    try {
      const expr = Jot.$('#in', ui).value.replace(/sin/g, 'Math.sin').replace(/cos/g, 'Math.cos').replace(/tan/g, 'Math.tan').replace(/sqrt/g, 'Math.sqrt').replace(/log/g, 'Math.log10').replace(/ln/g, 'Math.log').replace(/pi/g, 'Math.PI').replace(/\^/g, '**');
      Jot.$('#out', ui).textContent = Function('"use strict"; return (' + expr + ')')();
    } catch (e) { Jot.$('#out', ui).textContent = 'Invalid expression'; }
  };
};

JotTools['fraction-calc'] = function (root) {
  const ui = Jot.ui('<div class="row"><label>a/b <input type="text" id="a" value="1/2"></label><label>op <select id="op"><option>+</option><option>-</option><option>*</option><option>/</option></select></label><label>c/d <input type="text" id="b" value="1/3"></label></div><div class="btn-row"><button class="btn" id="go">Calculate</button></div><div class="output output--empty" id="out">Results will appear here.</div>');
  root.appendChild(ui);
  const parse = s => { const [n,d]=s.split('/').map(Number); return {n,d:d||1}; };
  const simp = (n,d) => { const g=(a,b)=>b?g(b,a%b):a; const x=g(Math.abs(n),Math.abs(d)); return [n/x,d/x]; };
  Jot.$('#go', ui).onclick = () => {
    const A=parse(Jot.$('#a',ui).value), B=parse(Jot.$('#b',ui).value), op=Jot.$('#op',ui).value;
    let n,d; if(op==='+'){n=A.n*B.d+B.n*A.d;d=A.d*B.d;} else if(op==='-'){n=A.n*B.d-B.n*A.d;d=A.d*B.d;} else if(op==='*'){n=A.n*B.n;d=A.d*B.d;} else {n=A.n*B.d;d=A.d*B.n;}
    const [sn,sd]=simp(n,d); Jot.$('#out',ui).textContent=sn+'/'+(sd||1);
  };
};

JotTools['gpa-calculator'] = function (root) {
  const ui = Jot.ui('<textarea id="in" rows="6" placeholder="grade,credits per line e.g. A,3"></textarea><div class="btn-row"><button class="btn" id="go">Calculate GPA</button></div><div class="output output--empty" id="out">Results will appear here.</div>');
  root.appendChild(ui);
  const map = { A:4, 'A-':3.7, 'B+':3.3, B:3, 'B-':2.7, 'C+':2.7, C:2, 'C-':1.7, D:1, F:0 };
  Jot.$('#go', ui).onclick = () => {
    let pts=0, cr=0;
    Jot.$('#in', ui).value.split('\n').filter(Boolean).forEach(line => {
      const [g,c]=line.split(','); const cred=+c||0; pts+=(map[g.trim().toUpperCase()]||0)*cred; cr+=cred;
    });
    Jot.$('#out', ui).textContent = cr ? 'GPA: ' + (pts/cr).toFixed(2) : 'Enter grade,credits lines';
  };
};

JotTools['iban-validator'] = function (root) {
  const ui = Jot.ui('<input type="text" id="in" placeholder="GB82WEST12345698765432"><div class="btn-row"><button class="btn" id="go">Validate</button></div><div class="output output--empty" id="out">Results will appear here.</div>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const iban = Jot.$('#in', ui).value.replace(/\s/g,'').toUpperCase();
    if (iban.length < 15) { Jot.$('#out', ui).textContent = 'Too short'; return; }
    const r = iban.slice(4)+iban.slice(0,4);
    const num = r.replace(/[A-Z]/g, c => (c.charCodeAt(0)-55).toString());
    let mod = num; while (mod.length > 2) mod = (parseInt(mod.slice(0,9),10)%97)+mod.slice(9);
    Jot.$('#out', ui).textContent = parseInt(mod,10)%97===1 ? 'Valid IBAN format' : 'Invalid IBAN checksum';
  };
};

JotTools['html-to-markdown'] = function (root) {
  const ui = Jot.ui('<textarea id="in" rows="8" placeholder="<h1>Title</h1>"></textarea><div class="btn-row"><button class="btn" id="go">Convert</button><button class="btn btn-secondary" id="copy">Copy</button></div><textarea id="out" readonly rows="8"></textarea>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    let h = Jot.$('#in', ui).value;
    h = h.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n').replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n').replace(/<strong>(.*?)<\/strong>/gi, '**$1**').replace(/<em>(.*?)<\/em>/gi, '*$1*').replace(/<a[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)').replace(/<li>(.*?)<\/li>/gi, '- $1\n').replace(/<[^>]+>/g, '').replace(/\n{3,}/g, '\n\n');
    Jot.$('#out', ui).value = h.trim();
  };
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
};

JotTools['xml-to-json'] = function (root) {
  const ui = Jot.ui('<textarea id="in" rows="8" placeholder="<root>...</root>"></textarea><div class="btn-row"><button class="btn" id="go">To JSON</button></div><textarea id="out" readonly rows="8"></textarea><div id="err" class="error"></div>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    Jot.$('#err', ui).textContent = '';
    try {
      const doc = new DOMParser().parseFromString(Jot.$('#in', ui).value, 'text/xml');
      function node(n) {
        if (n.nodeType === 3) return n.textContent.trim() || undefined;
        const o = {}; [...n.children].forEach(c => { const k = c.tagName; o[k] = o[k] ? [].concat(o[k], node(c)) : node(c); });
        return Object.keys(o).length ? o : n.textContent.trim();
      }
      Jot.$('#out', ui).value = JSON.stringify(node(doc.documentElement), null, 2);
    } catch (e) { Jot.$('#err', ui).textContent = e.message; }
  };
};

JotTools['json-to-xml'] = function (root) {
  const ui = Jot.ui('<textarea id="in" rows="8"></textarea><div class="btn-row"><button class="btn" id="go">To XML</button></div><textarea id="out" readonly rows="8"></textarea>');
  root.appendChild(ui);
  function build(k, v) {
    if (v && typeof v === 'object' && !Array.isArray(v)) return Object.entries(v).map(([ck,cv]) => build(ck, cv)).join('');
    if (Array.isArray(v)) return v.map(i => `<${k}>${typeof i === 'object' ? build('item', i) : i}</${k}>`).join('');
    return `<${k}>${v}</${k}>`;
  }
  Jot.$('#go', ui).onclick = () => {
    try { Jot.$('#out', ui).value = '<?xml version="1.0"?>\n<root>' + build('root', JSON.parse(Jot.$('#in', ui).value)) + '</root>'; }
    catch { Jot.$('#out', ui).value = 'Invalid JSON'; }
  };
};

JotTools['unicode-escape'] = function (root) {
  const ui = Jot.ui('<textarea id="in"></textarea><div class="btn-row"><button class="btn" id="enc">To escapes</button><button class="btn btn-secondary" id="dec">From escapes</button></div><textarea id="out" readonly></textarea>');
  root.appendChild(ui);
  Jot.$('#enc', ui).onclick = () => { Jot.$('#out', ui).value = [...Jot.$('#in', ui).value].map(c => '\\u'+c.charCodeAt(0).toString(16).padStart(4,'0')).join(''); };
  Jot.$('#dec', ui).onclick = () => { Jot.$('#out', ui).value = Jot.$('#in', ui).value.replace(/\\u([0-9a-fA-F]{4})/g, (_,h)=>String.fromCharCode(parseInt(h,16))); };
};

JotTools['ascii-table'] = function (root) {
  const ui = Jot.ui('<div class="output" id="out" style="font-family:var(--mono);font-size:.75rem;max-height:400px;overflow:auto"></div>');
  root.appendChild(ui);
  let t = 'Dec  Hex  Char\n';
  for (let i = 32; i < 127; i++) t += i + '  0x' + i.toString(16).padStart(2,'0') + '  ' + String.fromCharCode(i) + '\n';
  Jot.$('#out', ui).textContent = t;
};

JotTools['instagram-formatter'] = function (root) {
  const ui = Jot.ui('<textarea id="in" rows="6"></textarea><div class="btn-row"><button class="btn" id="go">Add line breaks</button><button class="btn btn-secondary" id="copy">Copy</button></div><textarea id="out" readonly rows="6"></textarea>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => { Jot.$('#out', ui).value = Jot.$('#in', ui).value.replace(/\n/g, '\n\u200B\n'); };
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
};

JotTools['hashtag-generator'] = function (root) {
  const ui = Jot.ui('<input type="text" id="in" placeholder="travel photography sunset"><div class="btn-row"><button class="btn" id="go">Generate</button><button class="btn btn-secondary" id="copy">Copy</button></div><textarea id="out" readonly rows="4"></textarea>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    Jot.$('#out', ui).value = Jot.$('#in', ui).value.split(/\s+/).filter(Boolean).map(w => '#' + w.replace(/[^a-zA-Z0-9]/g,'').toLowerCase()).join(' ');
  };
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
};

JotTools['week-number'] = function (root) {
  const ui = Jot.ui('<input type="date" id="d"><div class="output output--empty" id="out">Results will appear here.</div>');
  root.appendChild(ui);
  Jot.$('#d', ui).value = new Date().toISOString().slice(0,10);
  Jot.$('#d', ui).oninput = () => {
    const d = new Date(Jot.$('#d', ui).value);
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay()||7));
    const y = t.getUTCFullYear();
    Jot.$('#out', ui).textContent = 'ISO week ' + Math.ceil((((t - new Date(Date.UTC(y,0,1))) / 86400000) + 1) / 7) + ' of ' + y;
  };
  Jot.$('#d', ui).dispatchEvent(new Event('input'));
};

JotTools['iso-timestamp'] = function (root) {
  const ui = Jot.ui('<input type="datetime-local" id="d"><div class="btn-row"><button class="btn" id="go">To ISO</button><button class="btn btn-secondary" id="now">Now</button></div><div class="output output--empty" id="out">Results will appear here.</div>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => { Jot.$('#out', ui).textContent = new Date(Jot.$('#d', ui).value).toISOString(); };
  Jot.$('#now', ui).onclick = () => { Jot.$('#out', ui).textContent = new Date().toISOString(); };
};

JotTools['flexbox-gen'] = function (root) {
  const ui = Jot.ui('<div class="row"><label>Direction <select id="dir"><option>row</option><option>column</option></select></label><label>Justify <select id="j"><option>flex-start</option><option>center</option><option>space-between</option><option>space-around</option></select></label><label>Align <select id="a"><option>stretch</option><option>center</option><option>flex-start</option></select></label><label>Gap <input type="number" id="g" value="8"></label></div><div id="demo" style="display:flex;min-height:80px;border:1px solid var(--border);padding:8px;background:var(--bg-subtle)"><div style="background:var(--accent);color:#fff;padding:1rem;flex:1">A</div><div style="background:#71717a;color:#fff;padding:1rem;flex:1">B</div></div><textarea id="out" readonly rows="3" style="margin-top:.75rem"></textarea>');
  root.appendChild(ui);
  function upd() {
    const css = `display: flex; flex-direction: ${Jot.$('#dir',ui).value}; justify-content: ${Jot.$('#j',ui).value}; align-items: ${Jot.$('#a',ui).value}; gap: ${Jot.$('#g',ui).value}px;`;
    Jot.$('#demo', ui).style.cssText = css + 'min-height:80px;border:1px solid var(--border);padding:8px';
    Jot.$('#out', ui).value = css;
  }
  Jot.$$('select,input', ui).forEach(el => el.oninput = upd); upd();
};

JotTools['css-grid-gen'] = function (root) {
  const ui = Jot.ui('<div class="row"><label>Columns <input type="text" id="c" value="repeat(3, 1fr)"></label><label>Gap <input type="number" id="g" value="12"></label></div><div id="demo" style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px"><div style="background:var(--bg-muted);padding:1rem">1</div><div style="background:var(--bg-muted);padding:1rem">2</div><div style="background:var(--bg-muted);padding:1rem">3</div></div><textarea id="out" readonly rows="2" style="margin-top:.75rem"></textarea>');
  root.appendChild(ui);
  function upd() {
    const css = `display: grid; grid-template-columns: ${Jot.$('#c',ui).value}; gap: ${Jot.$('#g',ui).value}px;`;
    Jot.$('#demo', ui).style.cssText = css;
    Jot.$('#out', ui).value = css;
  }
  Jot.$('#c', ui).oninput = upd; Jot.$('#g', ui).oninput = upd;
};

JotTools['color-shades'] = function (root) {
  const ui = Jot.ui('<input type="color" id="c" value="#2563eb"><div class="palette" id="pal"></div><textarea id="out" readonly rows="4" style="margin-top:.75rem"></textarea>');
  root.appendChild(ui);
  function run() {
    const hex = Jot.$('#c', ui).value;
    const pal = Jot.$('#pal', ui); pal.innerHTML = ''; const lines = [];
    for (let i = 1; i <= 5; i++) {
      const chip = document.createElement('span'); chip.className = 'chip';
      chip.style.background = hex; chip.style.opacity = (i/5).toFixed(2); chip.textContent = i*20+'%';
      pal.appendChild(chip); lines.push(hex + ' @ ' + (i*20) + '%');
    }
    Jot.$('#out', ui).value = lines.join('\n');
  }
  Jot.$('#c', ui).oninput = run; run();
};

JotTools['meme-generator'] = function (root) {
  const ui = Jot.ui('<input type="file" accept="image/*" id="file"><label>Top <input type="text" id="top" value="TOP TEXT"></label><label>Bottom <input type="text" id="bot" value="BOTTOM TEXT"></label><div class="btn-row"><button class="btn" id="go">Generate</button><button class="btn btn-secondary" id="dl">Download</button></div><canvas id="c" style="max-width:100%"></canvas>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const f = Jot.$('#file', ui).files[0]; if (!f) { Jot.toast('Please upload a file first'); return; }
    Jot._loadImg(f, img => {
      const c = Jot.$('#c', ui); c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.textAlign = 'center';
      ctx.font = 'bold ' + Math.floor(img.width/10) + 'px Impact,sans-serif';
      ['top','bot'].forEach((id, i) => {
        const t = Jot.$('#'+id, ui).value.toUpperCase();
        ctx.strokeText(t, img.width/2, i ? img.height-20 : 50);
        ctx.fillText(t, img.width/2, i ? img.height-20 : 50);
      });
    });
  };
  Jot.$('#dl', ui).onclick = () => { const a = document.createElement('a'); a.href = Jot.$('#c', ui).toDataURL('image/png'); a.download = 'meme.png'; a.click(); };
};

JotTools['signature-pad'] = function (root) {
  const ui = Jot.ui('<canvas id="c" width="500" height="180" style="border:1px solid var(--border);cursor:crosshair;max-width:100%"></canvas><div class="btn-row"><button class="btn btn-secondary" id="clr">Clear</button><button class="btn" id="dl">Download PNG</button></div>');
  root.appendChild(ui);
  const c = Jot.$('#c', ui), ctx = c.getContext('2d'); ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
  let draw = false;
  c.onmousedown = () => draw = true; c.onmouseup = () => draw = false;
  c.onmousemove = e => { if (!draw) return; const r = c.getBoundingClientRect(); ctx.lineTo(e.clientX-r.left, e.clientY-r.top); ctx.stroke(); ctx.beginPath(); ctx.moveTo(e.clientX-r.left, e.clientY-r.top); };
  Jot.$('#clr', ui).onclick = () => { ctx.clearRect(0,0,c.width,c.height); };
  Jot.$('#dl', ui).onclick = () => { const a = document.createElement('a'); a.href = c.toDataURL('image/png'); a.download = 'signature.png'; a.click(); };
};

JotTools['json-schema'] = function (root) {
  const ui = Jot.ui('<label>JSON<textarea id="json" rows="6">{"name":"test","count":1}</textarea></label><label>Schema<textarea id="schema" rows="6">{"type":"object","required":["name"],"properties":{"name":{"type":"string"},"count":{"type":"number"}}}</textarea></label><div class="btn-row"><button class="btn" id="go">Validate</button></div><div class="output output--empty" id="out">Results will appear here.</div>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    try {
      const data = JSON.parse(Jot.$('#json', ui).value), schema = JSON.parse(Jot.$('#schema', ui).value);
      const errs = [];
      if (schema.type === 'object') {
        (schema.required||[]).forEach(k => { if (!(k in data)) errs.push('Missing: ' + k); });
        Object.entries(schema.properties||{}).forEach(([k,v]) => { if (k in data && typeof data[k] !== v.type) errs.push(k + ' should be ' + v.type); });
      }
      Jot.$('#out', ui).textContent = errs.length ? errs.join('\n') : 'Valid against schema';
    } catch (e) { Jot.$('#out', ui).textContent = e.message; }
  };
};

JotTools['http-status'] = function (root) {
  const codes = {200:'OK',201:'Created',204:'No Content',301:'Moved Permanently',302:'Found',304:'Not Modified',400:'Bad Request',401:'Unauthorized',403:'Forbidden',404:'Not Found',429:'Too Many Requests',500:'Internal Server Error',502:'Bad Gateway',503:'Service Unavailable'};
  const ui = Jot.ui('<input type="search" id="q" placeholder="Search code or name"><div class="output" id="out" style="margin-top:.75rem"></div>');
  root.appendChild(ui);
  function show(filter) {
    Jot.$('#out', ui).innerHTML = Object.entries(codes).filter(([c,n]) => !filter || c.includes(filter) || n.toLowerCase().includes(filter)).map(([c,n]) => `<div><strong>${c}</strong> ${n}</div>`).join('');
  }
  Jot.$('#q', ui).oninput = () => show(Jot.$('#q', ui).value.toLowerCase());
  show('');
};

JotTools['extract-urls'] = function (root) {
  const ui = Jot.ui('<textarea id="in" rows="8"></textarea><div class="btn-row"><button class="btn" id="go">Extract</button><button class="btn btn-secondary" id="copy">Copy</button></div><textarea id="out" readonly rows="8"></textarea>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => { Jot.$('#out', ui).value = [...new Set(Jot.$('#in', ui).value.match(/https?:\/\/[^\s<>"']+/g)||[])].join('\n'); };
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
};

JotTools['extract-emails'] = function (root) {
  const ui = Jot.ui('<textarea id="in" rows="8"></textarea><div class="btn-row"><button class="btn" id="go">Extract</button><button class="btn btn-secondary" id="copy">Copy</button></div><textarea id="out" readonly rows="8"></textarea>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => { Jot.$('#out', ui).value = [...new Set(Jot.$('#in', ui).value.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g)||[])].join('\n'); };
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
};

JotTools['transpose-text'] = function (root) {
  const ui = Jot.ui('<textarea id="in" placeholder="tab or comma separated"></textarea><div class="btn-row"><button class="btn" id="go">Transpose</button></div><textarea id="out" readonly></textarea>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const rows = Jot.$('#in', ui).value.split('\n').map(r => r.split(/[\t,]/));
    const cols = rows[0]?.map((_, i) => rows.map(r => r[i]||'').join('\t')) || [];
    Jot.$('#out', ui).value = cols.join('\n');
  };
};

JotTools['column-to-rows'] = function (root) {
  const ui = Jot.ui('<textarea id="in" placeholder="one column per line"></textarea><div class="btn-row"><button class="btn" id="go">To rows</button></div><textarea id="out" readonly></textarea>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => { Jot.$('#out', ui).value = Jot.$('#in', ui).value.split('\n').join(', '); };
};

JotTools['business-days'] = function (root) {
  const ui = Jot.ui('<div class="row"><label>Start <input type="date" id="a"></label><label>End <input type="date" id="b"></label></div><div class="output output--empty" id="out">Results will appear here.</div>');
  root.appendChild(ui);
  function run() {
    let a = new Date(Jot.$('#a', ui).value), b = new Date(Jot.$('#b', ui).value);
    if (isNaN(a)) return;
    let n = 0; const step = a <= b ? 1 : -1; const end = b;
    while ((step > 0 ? a <= end : a >= end)) { const d = a.getDay(); if (d && d < 6) n++; a.setDate(a.getDate() + step); }
    Jot.$('#out', ui).textContent = Math.abs(n) + ' business days';
  }
  Jot.$('#a', ui).oninput = run; Jot.$('#b', ui).oninput = run;
};

JotTools['car-loan'] = function (root) {
  const ui = Jot.ui('<div class="row"><label>Price $<input type="number" id="p" value="25000"></label><label>Down $<input type="number" id="d" value="5000"></label><label>Rate % <input type="number" id="r" value="5.9" step="0.1"></label><label>Months <input type="number" id="m" value="60"></label></div><div class="btn-row"><button class="btn" id="go">Calculate</button></div><div class="output output--empty" id="out">Results will appear here.</div>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const P = +Jot.$('#p', ui).value - +Jot.$('#d', ui).value, r = +Jot.$('#r', ui).value/100/12, n = +Jot.$('#m', ui).value;
    const pay = P * r * Math.pow(1+r,n) / (Math.pow(1+r,n)-1);
    Jot.$('#out', ui).textContent = 'Monthly payment: $' + pay.toFixed(2);
  };
  Jot.$('#go', ui).click();
};

JotTools['debt-payoff'] = function (root) {
  const ui = Jot.ui('<div class="row"><label>Balance $<input type="number" id="b" value="5000"></label><label>APR % <input type="number" id="r" value="18"></label><label>Monthly pay $<input type="number" id="m" value="200"></label><label>Extra $<input type="number" id="x" value="50"></label></div><div class="btn-row"><button class="btn" id="go">Calculate</button></div><div class="output output--empty" id="out">Results will appear here.</div>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    let bal = +Jot.$('#b', ui).value, r = +Jot.$('#r', ui).value/100/12, pay = +Jot.$('#m', ui).value + +Jot.$('#x', ui).value, months = 0;
    while (bal > 0 && months < 600) { bal = bal * (1+r) - pay; months++; }
    Jot.$('#out', ui).textContent = months >= 600 ? 'Payment too low' : `Paid off in ${months} months (~${(months/12).toFixed(1)} years)`;
  };
};

JotTools['csv-to-xml'] = function (root) {
  const ui = Jot.ui('<textarea id="in" rows="8" placeholder="csv"></textarea><div class="btn-row"><button class="btn" id="go">To XML</button></div><textarea id="out" readonly rows="8"></textarea>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    try {
      const rows = Jot.parseCSV(Jot.$('#in', ui).value);
      Jot.$('#out', ui).value = '<?xml version="1.0"?>\n<rows>\n' + rows.map(r => '  <row>' + Object.entries(r).map(([k,v]) => `<${k}>${v}</${k}>`).join('') + '</row>').join('\n') + '\n</rows>';
    } catch (e) { Jot.$('#out', ui).value = e.message; }
  };
};

JotTools['xml-to-csv'] = function (root) {
  const ui = Jot.ui('<textarea id="in" rows="8"></textarea><div class="btn-row"><button class="btn" id="go">To CSV</button></div><textarea id="out" readonly rows="8"></textarea>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const doc = new DOMParser().parseFromString(Jot.$('#in', ui).value, 'text/xml');
    const rows = [...doc.querySelectorAll('row')].map(row => { const o = {}; [...row.children].forEach(c => o[c.tagName] = c.textContent); return o; });
    Jot.$('#out', ui).value = Jot.csvFromJson(rows);
  };
};

JotTools['qr-decoder'] = function (root) {
  const ui = Jot.ui('<input type="file" accept="image/*" id="file"><div class="btn-row"><button class="btn" id="go">Decode</button></div><div class="output output--empty" id="out">Results will appear here.</div><canvas id="c" style="display:none"></canvas>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = async () => {
    const f = Jot.$('#file', ui).files[0]; if (!f) { Jot.toast('Please upload a file first'); return; }
    await Jot.loadScript('https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js');
    Jot._loadImg(f, img => {
      const c = Jot.$('#c', ui); c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height);
      const r = jsQR(d.data, c.width, c.height);
      Jot.$('#out', ui).textContent = r ? r.data : 'No QR code found';
    });
  };
};
