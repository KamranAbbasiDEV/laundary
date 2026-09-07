// mega-tool-impls.js

window.JotTools = window.JotTools || {};

Jot._pdfLib = Jot._pdfLib || async function () {
  await Jot.loadScript('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js');
  return window.PDFLib;
};

Jot._ffmpeg = Jot._ffmpeg || async function (onLog) {
  await Jot.loadScript('https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/umd/ffmpeg.js');
  await Jot.loadScript('https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/umd/util.js');
  const { FFmpeg } = FFmpegWASM;
  const { fetchFile } = FFmpegUtil;
  const ff = new FFmpeg();
  if (onLog) ff.on('log', e => onLog(e.message));
  await ff.load({ coreURL: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js' });
  return { ff, fetchFile };
};

Jot._loadImg = Jot._loadImg || function (file, cb) {
  const img = new Image();
  img.onload = () => cb(img);
  img.src = URL.createObjectURL(file);
};

function megaFfmpeg(root, accept, runFn) {
  const ui = Jot.ui('<input type="file" id="file" accept="' + accept + '"><div class="btn-row"><button class="btn" id="go">Process</button></div><div class="output" id="out">First run downloads encoder (~25MB).</div>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = async () => {
    const f = Jot.$('#file', ui).files[0];
    if (!f) return;
    try {
      const { ff, fetchFile } = await Jot._ffmpeg(m => { Jot.$('#out', ui).textContent = m.slice(0, 120); });
      await runFn(ff, fetchFile, f, ui);
    } catch (e) { Jot.$('#out', ui).textContent = 'Error: ' + e.message; }
  };
}

function taTool(root, html, run) {
  const ui = Jot.ui(html);
  root.appendChild(ui);
  const go = Jot.$('#go', ui);
  if (go) go.onclick = () => run(ui);
  const copy = Jot.$('#copy', ui);
  if (copy) copy.onclick = () => Jot.copy(Jot.$('#out', ui).value || Jot.$('#out', ui).textContent, copy);
}

function calcBtn(root, html, run) {
  const ui = Jot.ui(html);
  root.appendChild(ui);
  const go = Jot.$('#go', ui);
  if (go) { go.onclick = () => run(ui); go.click(); }
  else Jot.$$('input,select', ui).forEach(el => { el.oninput = () => run(ui); });
}

Jot._base32 = {
  abc: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',
  enc(s) {
    const bytes = new TextEncoder().encode(s);
    let bits = 0, val = 0, out = '';
    for (const b of bytes) {
      val = (val << 8) | b; bits += 8;
      while (bits >= 5) { bits -= 5; out += this.abc[(val >> bits) & 31]; }
    }
    if (bits) out += this.abc[(val << (5 - bits)) & 31];
    return out;
  },
  dec(s) {
    const map = Object.fromEntries([...this.abc].map((c, i) => [c, i]));
    let bits = 0, val = 0; const out = [];
    for (const c of s.toUpperCase().replace(/=+$/, '')) {
      if (!(c in map)) continue;
      val = (val << 5) | map[c]; bits += 5;
      if (bits >= 8) { bits -= 8; out.push((val >> bits) & 255); }
    }
    return new TextDecoder().decode(new Uint8Array(out));
  }
};

Jot._base58 = {
  abc: '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz',
  enc(buf) {
    const digits = [0];
    for (const byte of buf) {
      let carry = byte;
      for (let j = 0; j < digits.length; j++) {
        carry += digits[j] << 8; digits[j] = carry % 58; carry = (carry / 58) | 0;
      }
      while (carry) { digits.push(carry % 58); carry = (carry / 58) | 0; }
    }
    let str = '';
    for (const b of buf) { if (b === 0) str += this.abc[0]; else break; }
    for (let i = digits.length - 1; i >= 0; i--) str += this.abc[digits[i]];
    return str;
  },
  dec(s) {
    const map = Object.fromEntries([...this.abc].map((c, i) => [c, i]));
    const bytes = [0];
    for (const c of s) {
      let carry = map[c];
      if (carry === undefined) throw new Error('Invalid Base58');
      for (let j = 0; j < bytes.length; j++) {
        carry += bytes[j] * 58; bytes[j] = carry & 255; carry >>= 8;
      }
      while (carry) { bytes.push(carry & 255); carry >>= 8; }
    }
    for (const c of s) { if (c === this.abc[0]) bytes.unshift(0); else break; }
    return new Uint8Array(bytes.reverse());
  }
};

Jot._mapChars = function (text, offsetFn) {
  return [...text].map(ch => {
    const c = ch.charCodeAt(0);
    if (c >= 65 && c <= 90) return String.fromCharCode(offsetFn(c, true));
    if (c >= 97 && c <= 122) return String.fromCharCode(offsetFn(c, false));
    return ch;
  }).join('');
};

Jot._deepMerge = function (a, b) {
  if (!b || typeof b !== 'object') return b;
  const out = Array.isArray(a) ? [...a] : { ...a };
  Object.keys(b).forEach(k => {
    if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k])) out[k] = Jot._deepMerge(out[k] || {}, b[k]);
    else out[k] = b[k];
  });
  return out;
};

Jot._jsonDiff = function (a, b, path) {
  path = path || '';
  const lines = [];
  if (typeof a !== typeof b || (a && b && Array.isArray(a) !== Array.isArray(b))) {
    lines.push(path + ': ' + JSON.stringify(a) + ' → ' + JSON.stringify(b));
    return lines;
  }
  if (a && typeof a === 'object') {
    const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
    keys.forEach(k => lines.push(...Jot._jsonDiff(a[k], b[k], path ? path + '.' + k : k)));
  } else if (a !== b) lines.push(path + ': ' + JSON.stringify(a) + ' → ' + JSON.stringify(b));
  return lines;
};

// PDF tools
JotTools['pdf-reorder'] = function (root) {
  const ui = Jot.ui('<input type="file" accept="application/pdf" id="file"><label>New page order (e.g. 3,1,2) <input type="text" id="ord" value="1"></label><div class="btn-row"><button class="btn" id="go">Reorder & Download</button></div><div class="output" id="out"></div>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = async () => {
    const f = Jot.$('#file', ui).files[0]; if (!f) return;
    const { PDFDocument } = await Jot._pdfLib();
    const src = await PDFDocument.load(await f.arrayBuffer());
    const order = Jot.$('#ord', ui).value.split(',').map(n => +n.trim() - 1);
    const out = await PDFDocument.create();
    const pages = await out.copyPages(src, order);
    pages.forEach(p => out.addPage(p));
    Jot.download('reordered.pdf', await out.save(), 'application/pdf');
    Jot.$('#out', ui).textContent = 'Reordered ' + order.length + ' pages';
  };
};

JotTools['pdf-extract-text'] = function (root) {
  const ui = Jot.ui('<input type="file" accept="application/pdf" id="file"><div class="btn-row"><button class="btn" id="go">Extract text</button><button class="btn btn-secondary" id="copy">Copy</button></div><textarea id="out" rows="12" readonly></textarea>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = async () => {
    const f = Jot.$('#file', ui).files[0]; if (!f) return;
    await Jot.loadScript('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js');
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
    const pdf = await pdfjsLib.getDocument({ data: await f.arrayBuffer() }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map(it => it.str).join(' ') + '\n\n';
    }
    Jot.$('#out', ui).value = text.trim();
  };
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
};

JotTools['pdf-watermark'] = function (root) {
  const ui = Jot.ui('<input type="file" accept="application/pdf" id="file"><label>Watermark text <input type="text" id="wm" value="CONFIDENTIAL"></label><div class="btn-row"><button class="btn" id="go">Add watermark</button></div>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = async () => {
    const f = Jot.$('#file', ui).files[0]; if (!f) return;
    const { PDFDocument, StandardFonts, rgb, degrees } = await Jot._pdfLib();
    const pdf = await PDFDocument.load(await f.arrayBuffer());
    const font = await pdf.embedFont(StandardFonts.HelveticaBold);
    const wm = Jot.$('#wm', ui).value;
    pdf.getPages().forEach(page => {
      const { width, height } = page.getSize();
      page.drawText(wm, { x: width * 0.15, y: height * 0.5, size: 48, font, color: rgb(0.75, 0.75, 0.75), rotate: degrees(45), opacity: 0.35 });
    });
    Jot.download('watermarked.pdf', await pdf.save(), 'application/pdf');
  };
};

JotTools['pdf-unlock'] = function (root) {
  const ui = Jot.ui('<input type="file" accept="application/pdf" id="file"><label>Password <input type="password" id="pw"></label><div class="btn-row"><button class="btn" id="go">Unlock & Download</button></div><div class="output" id="out"></div>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = async () => {
    const f = Jot.$('#file', ui).files[0]; if (!f) return;
    try {
      const { PDFDocument } = await Jot._pdfLib();
      const pdf = await PDFDocument.load(await f.arrayBuffer(), { password: Jot.$('#pw', ui).value });
      Jot.download('unlocked.pdf', await pdf.save(), 'application/pdf');
      Jot.$('#out', ui).textContent = 'Saved without encryption';
    } catch (e) { Jot.$('#out', ui).textContent = 'Failed: ' + e.message; }
  };
};

// Image tools
JotTools['heic-converter'] = function (root) {
  const ui = Jot.ui('<input type="file" accept="image/*,.heic,.heif" id="file"><div class="btn-row"><button class="btn" id="go">Convert to JPG</button></div><div class="output" id="out"></div><canvas id="c" style="display:none"></canvas>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const f = Jot.$('#file', ui).files[0]; if (!f) return;
    Jot._loadImg(f, img => {
      const c = Jot.$('#c', ui); c.width = img.width; c.height = img.height;
      c.getContext('2d').drawImage(img, 0, 0);
      c.toBlob(b => { Jot.download('converted.jpg', b, 'image/jpeg'); Jot.$('#out', ui).textContent = 'Downloaded JPG'; }, 'image/jpeg', 0.92);
    });
  };
};

JotTools['avif-converter'] = function (root) {
  const ui = Jot.ui('<input type="file" accept="image/avif,image/*" id="file"><div class="btn-row"><button class="btn" id="go">Convert to PNG</button></div><div class="output" id="out"></div><canvas id="c" style="display:none"></canvas>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const f = Jot.$('#file', ui).files[0]; if (!f) return;
    Jot._loadImg(f, img => {
      const c = Jot.$('#c', ui); c.width = img.width; c.height = img.height;
      c.getContext('2d').drawImage(img, 0, 0);
      c.toBlob(b => { Jot.download('converted.png', b, 'image/png'); Jot.$('#out', ui).textContent = 'Downloaded PNG'; }, 'image/png');
    });
  };
};

JotTools['image-sharpen'] = function (root) {
  const ui = Jot.ui('<input type="file" accept="image/*" id="file"><label>Amount <input type="range" id="amt" min="0" max="200" value="100"></label><div class="btn-row"><button class="btn" id="go">Sharpen</button><button class="btn btn-secondary" id="dl">Download</button></div><canvas id="c" style="max-width:100%"></canvas>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const f = Jot.$('#file', ui).files[0]; if (!f) return;
    Jot._loadImg(f, img => {
      const c = Jot.$('#c', ui); c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d');
      ctx.filter = 'contrast(' + (+Jot.$('#amt', ui).value / 100 + 1).toFixed(2) + ') saturate(1.2)';
      ctx.drawImage(img, 0, 0);
    });
  };
  Jot.$('#dl', ui).onclick = () => { const a = document.createElement('a'); a.href = Jot.$('#c', ui).toDataURL('image/png'); a.download = 'sharpened.png'; a.click(); };
};

JotTools['image-border'] = function (root) {
  const ui = Jot.ui('<input type="file" accept="image/*" id="file"><div class="row"><label>Border px <input type="number" id="b" value="20"></label><label>Color <input type="color" id="col" value="#2563eb"></label></div><div class="btn-row"><button class="btn" id="go">Apply</button><button class="btn btn-secondary" id="dl">Download</button></div><canvas id="c" style="max-width:100%"></canvas>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const f = Jot.$('#file', ui).files[0]; if (!f) return;
    Jot._loadImg(f, img => {
      const b = +Jot.$('#b', ui).value;
      const c = Jot.$('#c', ui); c.width = img.width + b * 2; c.height = img.height + b * 2;
      const ctx = c.getContext('2d');
      ctx.fillStyle = Jot.$('#col', ui).value;
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, b, b);
    });
  };
  Jot.$('#dl', ui).onclick = () => { const a = document.createElement('a'); a.href = Jot.$('#c', ui).toDataURL('image/png'); a.download = 'bordered.png'; a.click(); };
};

JotTools['gif-maker'] = function (root) {
  const ui = Jot.ui('<input type="file" accept="image/*" id="file" multiple><label>Delay ms <input type="number" id="d" value="500"></label><div class="btn-row"><button class="btn" id="go">Create GIF frames</button></div><div class="output" id="out">Select multiple images. Downloads PNG sprite sheet if GIF encoder unavailable.</div><canvas id="c" style="max-width:100%"></canvas>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = async () => {
    const files = [...Jot.$('#file', ui).files]; if (!files.length) return;
    const imgs = await Promise.all(files.map(f => new Promise(res => Jot._loadImg(f, res))));
    const w = Math.max(...imgs.map(i => i.width)), h = Math.max(...imgs.map(i => i.height));
    const c = Jot.$('#c', ui); c.width = w; c.height = h * imgs.length;
    const ctx = c.getContext('2d');
    imgs.forEach((img, i) => ctx.drawImage(img, 0, i * h, w, h));
    c.toBlob(b => { Jot.download('frames.png', b, 'image/png'); Jot.$('#out', ui).textContent = 'Downloaded vertical sprite (' + imgs.length + ' frames)'; }, 'image/png');
  };
};

JotTools['transparent-png'] = function (root) {
  const ui = Jot.ui('<input type="file" accept="image/*" id="file"><label>Key color <input type="color" id="col" value="#ffffff"></label><label>Tolerance <input type="number" id="tol" value="40"></label><div class="btn-row"><button class="btn" id="go">Remove background</button><button class="btn btn-secondary" id="dl">Download</button></div><canvas id="c" style="max-width:100%"></canvas>');
  root.appendChild(ui);
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  Jot.$('#go', ui).onclick = () => {
    const f = Jot.$('#file', ui).files[0]; if (!f) return;
    Jot._loadImg(f, img => {
      const c = Jot.$('#c', ui); c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height);
      const [kr, kg, kb] = hex(Jot.$('#col', ui).value), tol = +Jot.$('#tol', ui).value;
      for (let i = 0; i < d.data.length; i += 4) {
        if (Math.abs(d.data[i] - kr) + Math.abs(d.data[i + 1] - kg) + Math.abs(d.data[i + 2] - kb) < tol * 3) d.data[i + 3] = 0;
      }
      ctx.putImageData(d, 0, 0);
    });
  };
  Jot.$('#dl', ui).onclick = () => { const a = document.createElement('a'); a.href = Jot.$('#c', ui).toDataURL('image/png'); a.download = 'transparent.png'; a.click(); };
};

JotTools['image-collage'] = function (root) {
  const ui = Jot.ui('<input type="file" accept="image/*" id="file" multiple><label>Columns <input type="number" id="cols" value="2" min="1" max="4"></label><div class="btn-row"><button class="btn" id="go">Build collage</button><button class="btn btn-secondary" id="dl">Download</button></div><canvas id="c" style="max-width:100%"></canvas>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = async () => {
    const files = [...Jot.$('#file', ui).files]; if (!files.length) return;
    const imgs = await Promise.all(files.map(f => new Promise(res => Jot._loadImg(f, res))));
    const cols = +Jot.$('#cols', ui).value || 2;
    const cell = 300, rows = Math.ceil(imgs.length / cols);
    const c = Jot.$('#c', ui); c.width = cols * cell; c.height = rows * cell;
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    imgs.forEach((img, i) => {
      const x = (i % cols) * cell, y = Math.floor(i / cols) * cell;
      const scale = Math.min(cell / img.width, cell / img.height);
      const w = img.width * scale, h = img.height * scale;
      ctx.drawImage(img, x + (cell - w) / 2, y + (cell - h) / 2, w, h);
    });
  };
  Jot.$('#dl', ui).onclick = () => { const a = document.createElement('a'); a.href = Jot.$('#c', ui).toDataURL('image/png'); a.download = 'collage.png'; a.click(); };
};

// Video / audio
JotTools['video-rotate'] = function (root) {
  megaFfmpeg(root, 'video/*', async (ff, fetchFile, f, ui) => {
    await ff.writeFile('in', await fetchFile(f));
    await ff.exec(['-i', 'in', '-vf', 'transpose=1', '-c:a', 'copy', 'out.mp4']);
    Jot.download('rotated.mp4', await ff.readFile('out.mp4'), 'video/mp4');
    Jot.$('#out', ui).textContent = 'Downloaded rotated.mp4';
  });
};

JotTools['video-merge'] = function (root) {
  const ui = Jot.ui('<input type="file" accept="video/*" id="file" multiple><div class="btn-row"><button class="btn" id="go">Merge videos</button></div><div class="output" id="out">First run downloads encoder (~25MB).</div>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = async () => {
    const files = [...Jot.$('#file', ui).files]; if (files.length < 2) return;
    try {
      const { ff, fetchFile } = await Jot._ffmpeg(m => { Jot.$('#out', ui).textContent = m.slice(0, 120); });
      for (let i = 0; i < files.length; i++) await ff.writeFile('v' + i, await fetchFile(files[i]));
      const args = files.flatMap((_, i) => ['-i', 'v' + i]);
      args.push('-filter_complex', 'concat=n=' + files.length + ':v=1:a=1', 'out.mp4');
      await ff.exec(args);
      Jot.download('merged.mp4', await ff.readFile('out.mp4'), 'video/mp4');
      Jot.$('#out', ui).textContent = 'Merged ' + files.length + ' videos';
    } catch (e) { Jot.$('#out', ui).textContent = 'Error: ' + e.message; }
  };
};

JotTools['video-crop'] = function (root) {
  const ui = Jot.ui('<input type="file" accept="video/*" id="file"><div class="row"><label>Width <input type="number" id="w" value="640"></label><label>Height <input type="number" id="h" value="480"></label><label>X <input type="number" id="x" value="0"></label><label>Y <input type="number" id="y" value="0"></label></div><div class="btn-row"><button class="btn" id="go">Crop</button></div><div class="output" id="out">First run downloads encoder (~25MB).</div>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = async () => {
    const f = Jot.$('#file', ui).files[0]; if (!f) return;
    const w = Jot.$('#w', ui).value, h = Jot.$('#h', ui).value, x = Jot.$('#x', ui).value, y = Jot.$('#y', ui).value;
    try {
      const { ff, fetchFile } = await Jot._ffmpeg(m => { Jot.$('#out', ui).textContent = m.slice(0, 120); });
      await ff.writeFile('in', await fetchFile(f));
      await ff.exec(['-i', 'in', '-vf', 'crop=' + w + ':' + h + ':' + x + ':' + y, 'out.mp4']);
      Jot.download('cropped.mp4', await ff.readFile('out.mp4'), 'video/mp4');
      Jot.$('#out', ui).textContent = 'Done';
    } catch (e) { Jot.$('#out', ui).textContent = 'Error: ' + e.message; }
  };
};

JotTools['mov-converter'] = function (root) {
  megaFfmpeg(root, 'video/*,.mov', async (ff, fetchFile, f, ui) => {
    await ff.writeFile('in', await fetchFile(f));
    await ff.exec(['-i', 'in', '-c:v', 'libx264', '-c:a', 'aac', 'out.mp4']);
    Jot.download('converted.mp4', await ff.readFile('out.mp4'), 'video/mp4');
    Jot.$('#out', ui).textContent = 'Converted to MP4';
  });
};

JotTools['audio-speed'] = function (root) {
  const ui = Jot.ui('<input type="file" accept="audio/*" id="file"><label>Speed <input type="number" id="sp" value="1.5" step="0.1" min="0.5" max="2"></label><div class="btn-row"><button class="btn" id="go">Change speed</button></div><div class="output" id="out">First run downloads encoder (~25MB).</div>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = async () => {
    const f = Jot.$('#file', ui).files[0]; if (!f) return;
    const sp = +Jot.$('#sp', ui).value;
    try {
      const { ff, fetchFile } = await Jot._ffmpeg();
      await ff.writeFile('in', await fetchFile(f));
      await ff.exec(['-i', 'in', '-filter:a', 'atempo=' + Math.min(2, Math.max(0.5, sp)), 'out.mp3']);
      Jot.download('speed.mp3', await ff.readFile('out.mp3'), 'audio/mpeg');
      Jot.$('#out', ui).textContent = 'Done';
    } catch (e) { Jot.$('#out', ui).textContent = 'Error: ' + e.message; }
  };
};

JotTools['audio-volume'] = function (root) {
  megaFfmpeg(root, 'audio/*', async (ff, fetchFile, f, ui) => {
    await ff.writeFile('in', await fetchFile(f));
    await ff.exec(['-i', 'in', '-filter:a', 'volume=2.0', 'out.mp3']);
    Jot.download('louder.mp3', await ff.readFile('out.mp3'), 'audio/mpeg');
    Jot.$('#out', ui).textContent = 'Volume boosted 2x';
  });
};

JotTools['audio-reverse'] = function (root) {
  megaFfmpeg(root, 'audio/*', async (ff, fetchFile, f, ui) => {
    await ff.writeFile('in', await fetchFile(f));
    await ff.exec(['-i', 'in', '-af', 'areverse', 'out.mp3']);
    Jot.download('reversed.mp3', await ff.readFile('out.mp3'), 'audio/mpeg');
    Jot.$('#out', ui).textContent = 'Reversed audio downloaded';
  });
};

JotTools['record-audio'] = function (root) {
  const ui = Jot.ui('<div class="btn-row"><button class="btn" id="rec">Record</button><button class="btn btn-secondary" id="stop">Stop</button><button class="btn btn-secondary" id="dl">Download</button></div><audio id="play" controls style="width:100%;margin-top:.75rem"></audio><div class="output" id="out"></div>');
  root.appendChild(ui);
  let rec, chunks = [], blob;
  Jot.$('#rec', ui).onclick = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks = []; rec = new MediaRecorder(stream);
      rec.ondataavailable = e => chunks.push(e.data);
      rec.onstop = () => { blob = new Blob(chunks, { type: 'audio/webm' }); Jot.$('#play', ui).src = URL.createObjectURL(blob); Jot.$('#out', ui).textContent = 'Recording ready'; };
      rec.start(); Jot.$('#out', ui).textContent = 'Recording...';
    } catch (e) { Jot.$('#out', ui).textContent = 'Mic access denied: ' + e.message; }
  };
  Jot.$('#stop', ui).onclick = () => rec && rec.stop();
  Jot.$('#dl', ui).onclick = () => { if (blob) Jot.download('recording.webm', blob, 'audio/webm'); };
};

JotTools['ogg-converter'] = function (root) {
  megaFfmpeg(root, 'audio/*,.ogg', async (ff, fetchFile, f, ui) => {
    await ff.writeFile('in', await fetchFile(f));
    await ff.exec(['-i', 'in', 'out.wav']);
    Jot.download('converted.wav', await ff.readFile('out.wav'), 'audio/wav');
    Jot.$('#out', ui).textContent = 'Converted to WAV';
  });
};

JotTools['flac-converter'] = function (root) {
  megaFfmpeg(root, 'audio/*,.flac', async (ff, fetchFile, f, ui) => {
    await ff.writeFile('in', await fetchFile(f));
    await ff.exec(['-i', 'in', 'out.wav']);
    Jot.download('converted.wav', await ff.readFile('out.wav'), 'audio/wav');
    Jot.$('#out', ui).textContent = 'Converted to WAV';
  });
};

// Security / crypto
JotTools['sha512-hash'] = function (root) {
  const ui = Jot.ui('<textarea id="in" rows="4" placeholder="Text to hash"></textarea><input type="file" id="file"><div class="btn-row"><button class="btn" id="go">SHA-512</button><button class="btn btn-secondary" id="copy">Copy</button></div><textarea id="out" readonly rows="3"></textarea>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = async () => {
    const f = Jot.$('#file', ui).files[0];
    const h = f ? await Jot.hashFile('SHA-512', await f.arrayBuffer()) : await Jot.hash('SHA-512', Jot.$('#in', ui).value);
    Jot.$('#out', ui).value = h;
  };
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
};

JotTools['sha384-hash'] = function (root) {
  const ui = Jot.ui('<textarea id="in" rows="4" placeholder="Text to hash"></textarea><input type="file" id="file"><div class="btn-row"><button class="btn" id="go">SHA-384</button><button class="btn btn-secondary" id="copy">Copy</button></div><textarea id="out" readonly rows="3"></textarea>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = async () => {
    const f = Jot.$('#file', ui).files[0];
    const h = f ? await Jot.hashFile('SHA-384', await f.arrayBuffer()) : await Jot.hash('SHA-384', Jot.$('#in', ui).value);
    Jot.$('#out', ui).value = h;
  };
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
};

JotTools['hmac-generator'] = function (root) {
  const ui = Jot.ui('<textarea id="msg" rows="3" placeholder="Message"></textarea><label>Secret key <input type="text" id="key"></label><label>Algorithm <select id="algo"><option value="SHA-256">SHA-256</option><option value="SHA-512">SHA-512</option></select></label><div class="btn-row"><button class="btn" id="go">Generate HMAC</button><button class="btn btn-secondary" id="copy">Copy</button></div><textarea id="out" readonly rows="2"></textarea>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = async () => {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(Jot.$('#key', ui).value), { name: 'HMAC', hash: Jot.$('#algo', ui).value }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(Jot.$('#msg', ui).value));
    Jot.$('#out', ui).value = [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
  };
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
};

JotTools['pbkdf2-generator'] = function (root) {
  const ui = Jot.ui('<label>Password <input type="password" id="pw"></label><label>Salt <input type="text" id="salt" value="salt"></label><label>Iterations <input type="number" id="it" value="100000"></label><label>Length bytes <input type="number" id="len" value="32"></label><div class="btn-row"><button class="btn" id="go">Derive key</button></div><textarea id="out" readonly rows="2"></textarea>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = async () => {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(Jot.$('#pw', ui).value), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(Jot.$('#salt', ui).value), iterations: +Jot.$('#it', ui).value, hash: 'SHA-256' }, key, +Jot.$('#len', ui).value * 8);
    Jot.$('#out', ui).value = [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('');
  };
};

JotTools['htpasswd-generator'] = function (root) {
  const ui = Jot.ui('<label>Username <input type="text" id="user" value="admin"></label><label>Password <input type="password" id="pw"></label><div class="btn-row"><button class="btn" id="go">Generate</button><button class="btn btn-secondary" id="copy">Copy</button></div><textarea id="out" readonly rows="2"></textarea>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = async () => {
    await Jot.loadScript('https://cdn.jsdelivr.net/npm/bcryptjs@2.4.3/dist/bcrypt.min.js');
    const hash = bcrypt.hashSync(Jot.$('#pw', ui).value, 10);
    Jot.$('#out', ui).value = Jot.$('#user', ui).value + ':' + hash.replace(/^\$2a\$/, '$2y$');
  };
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
};

JotTools['api-key-generator'] = function (root) {
  const ui = Jot.ui('<label>Length <input type="number" id="len" value="32" min="8" max="128"></label><label>Prefix <input type="text" id="pre" value="sk_live_"></label><div class="btn-row"><button class="btn" id="go">Generate</button><button class="btn btn-secondary" id="copy">Copy</button></div><textarea id="out" readonly rows="2"></textarea>');
  root.appendChild(ui);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  Jot.$('#go', ui).onclick = () => {
    const len = +Jot.$('#len', ui).value;
    const arr = new Uint8Array(len);
    crypto.getRandomValues(arr);
    Jot.$('#out', ui).value = Jot.$('#pre', ui).value + [...arr].map(b => chars[b % chars.length]).join('');
  };
  Jot.$('#go', ui).click();
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
};

JotTools['caesar-cipher'] = function (root) {
  const ui = Jot.ui('<textarea id="in" rows="4"></textarea><label>Shift <input type="number" id="sh" value="3"></label><div class="btn-row"><button class="btn" id="enc">Encode</button><button class="btn btn-secondary" id="dec">Decode</button></div><textarea id="out" readonly rows="4"></textarea>');
  root.appendChild(ui);
  const shift = (s, n) => [...s].map(c => {
    const u = c.toUpperCase();
    if (u < 'A' || u > 'Z') return c;
    const base = c === u ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + n + 26) % 26) + base);
  }).join('');
  Jot.$('#enc', ui).onclick = () => { Jot.$('#out', ui).value = shift(Jot.$('#in', ui).value, +Jot.$('#sh', ui).value); };
  Jot.$('#dec', ui).onclick = () => { Jot.$('#out', ui).value = shift(Jot.$('#in', ui).value, -+Jot.$('#sh', ui).value); };
};

JotTools['atbash-cipher'] = function (root) {
  taTool(root, '<textarea id="in" rows="4"></textarea><div class="btn-row"><button class="btn" id="go">Atbash</button></div><textarea id="out" readonly rows="4"></textarea>', ui => {
    Jot.$('#out', ui).value = [...Jot.$('#in', ui).value].map(c => {
      const u = c.toUpperCase();
      if (u >= 'A' && u <= 'Z') return String.fromCharCode(90 - (c.charCodeAt(0) - (c === u ? 65 : 97)) + (c === u ? 65 : 97));
      return c;
    }).join('');
  });
};

JotTools['vigenere-cipher'] = function (root) {
  const ui = Jot.ui('<textarea id="in" rows="4"></textarea><label>Keyword <input type="text" id="key" value="KEY"></label><div class="btn-row"><button class="btn" id="enc">Encrypt</button><button class="btn btn-secondary" id="dec">Decrypt</button></div><textarea id="out" readonly rows="4"></textarea>');
  root.appendChild(ui);
  const run = dec => {
    const key = Jot.$('#key', ui).value.replace(/[^a-zA-Z]/g, '').toUpperCase();
    let ki = 0;
    Jot.$('#out', ui).value = [...Jot.$('#in', ui).value].map(c => {
      const u = c.toUpperCase();
      if (u < 'A' || u > 'Z') return c;
      const base = c === u ? 65 : 97;
      const k = key.charCodeAt(ki++ % key.length) - 65;
      const sh = dec ? -k : k;
      return String.fromCharCode(((c.charCodeAt(0) - base + sh + 26) % 26) + base);
    }).join('');
  };
  Jot.$('#enc', ui).onclick = () => run(false);
  Jot.$('#dec', ui).onclick = () => run(true);
};

JotTools['base32-encoder'] = function (root) {
  const ui = Jot.ui('<textarea id="in" rows="4"></textarea><div class="btn-row"><button class="btn" id="enc">Encode</button><button class="btn btn-secondary" id="dec">Decode</button><button class="btn btn-secondary" id="copy">Copy</button></div><textarea id="out" readonly rows="4"></textarea>');
  root.appendChild(ui);
  Jot.$('#enc', ui).onclick = () => { Jot.$('#out', ui).value = Jot._base32.enc(Jot.$('#in', ui).value); };
  Jot.$('#dec', ui).onclick = () => { try { Jot.$('#out', ui).value = Jot._base32.dec(Jot.$('#in', ui).value); } catch (e) { Jot.$('#out', ui).value = e.message; } };
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
};

JotTools['base58-encoder'] = function (root) {
  const ui = Jot.ui('<textarea id="in" rows="4"></textarea><div class="btn-row"><button class="btn" id="enc">Encode</button><button class="btn btn-secondary" id="dec">Decode</button></div><textarea id="out" readonly rows="4"></textarea>');
  root.appendChild(ui);
  Jot.$('#enc', ui).onclick = () => { Jot.$('#out', ui).value = Jot._base58.enc(new TextEncoder().encode(Jot.$('#in', ui).value)); };
  Jot.$('#dec', ui).onclick = () => { try { Jot.$('#out', ui).value = new TextDecoder().decode(Jot._base58.dec(Jot.$('#in', ui).value)); } catch (e) { Jot.$('#out', ui).value = e.message; } };
};

JotTools['punycode-converter'] = function (root) {
  const ui = Jot.ui('<input type="text" id="in" placeholder="münchen.de or xn--..."><div class="btn-row"><button class="btn" id="enc">To Punycode</button><button class="btn btn-secondary" id="dec">From Punycode</button></div><div class="output" id="out"></div>');
  root.appendChild(ui);
  Jot.$('#enc', ui).onclick = () => {
    try { Jot.$('#out', ui).textContent = 'https://' + new URL('http://' + Jot.$('#in', ui).value).hostname; }
    catch { Jot.$('#out', ui).textContent = 'Invalid domain'; }
  };
  Jot.$('#dec', ui).onclick = () => {
    const s = Jot.$('#in', ui).value;
    try {
      if (s.startsWith('xn--')) Jot.$('#out', ui).textContent = s.replace(/^xn--/, '') + ' (decode via browser IDN)';
      else Jot.$('#out', ui).textContent = 'xn--' + [...s].map(c => c.charCodeAt(0).toString(16)).join('-');
    } catch (e) { Jot.$('#out', ui).textContent = e.message; }
  };
};

JotTools['json-diff'] = function (root) {
  taTool(root, '<textarea id="a" rows="6" placeholder="JSON A"></textarea><textarea id="b" rows="6" placeholder="JSON B"></textarea><div class="btn-row"><button class="btn" id="go">Compare</button></div><textarea id="out" readonly rows="8"></textarea>', ui => {
    try {
      const a = JSON.parse(Jot.$('#a', ui).value), b = JSON.parse(Jot.$('#b', ui).value);
      const lines = Jot._jsonDiff(a, b);
      Jot.$('#out', ui).value = lines.length ? lines.join('\n') : 'No differences';
    } catch (e) { Jot.$('#out', ui).value = e.message; }
  });
};

JotTools['jsonpath-tester'] = function (root) {
  const ui = Jot.ui('<textarea id="json" rows="6">{"store":{"book":[{"title":"A","price":8.95},{"title":"B","price":12.99}]}}</textarea><label>Path (dot notation) <input type="text" id="path" value="store.book.0.title"></label><div class="btn-row"><button class="btn" id="go">Query</button></div><textarea id="out" readonly rows="4"></textarea>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    try {
      let cur = JSON.parse(Jot.$('#json', ui).value);
      Jot.$('#path', ui).value.split('.').forEach(k => { cur = cur?.[k]; });
      Jot.$('#out', ui).value = JSON.stringify(cur, null, 2);
    } catch (e) { Jot.$('#out', ui).value = e.message; }
  };
  Jot.$('#go', ui).click();
};

JotTools['json-merge'] = function (root) {
  taTool(root, '<textarea id="a" rows="6">{"a":1,"nested":{"x":1}}</textarea><textarea id="b" rows="6">{"b":2,"nested":{"y":2}}</textarea><div class="btn-row"><button class="btn" id="go">Merge</button><button class="btn btn-secondary" id="copy">Copy</button></div><textarea id="out" readonly rows="8"></textarea>', ui => {
    try {
      const m = Jot._deepMerge(JSON.parse(Jot.$('#a', ui).value), JSON.parse(Jot.$('#b', ui).value));
      Jot.$('#out', ui).value = JSON.stringify(m, null, 2);
    } catch (e) { Jot.$('#out', ui).value = e.message; }
  });
};

JotTools['graphql-formatter'] = function (root) {
  taTool(root, '<textarea id="in" rows="8" placeholder="query { user { id name } }"></textarea><div class="btn-row"><button class="btn" id="go">Format</button><button class="btn btn-secondary" id="copy">Copy</button></div><textarea id="out" readonly rows="8"></textarea>', ui => {
    let q = Jot.$('#in', ui).value.trim();
    q = q.replace(/\s*{\s*/g, ' {\n  ').replace(/\s*}\s*/g, '\n}\n').replace(/,\s*/g, ',\n  ');
    Jot.$('#out', ui).value = q;
  });
};

JotTools['curl-converter'] = function (root) {
  taTool(root, '<textarea id="in" rows="6" placeholder="curl -X POST https://api.example.com -H &quot;Authorization: Bearer token&quot; -d &quot;{}&quot;"></textarea><div class="btn-row"><button class="btn" id="go">Convert</button><button class="btn btn-secondary" id="copy">Copy</button></div><textarea id="out" readonly rows="10"></textarea>', ui => {
    const c = Jot.$('#in', ui).value;
    const url = (c.match(/curl\s+(?:-X\s+\w+\s+)?['"]?([^\s'"]+)/) || [])[1] || 'https://example.com';
    const method = ((c.match(/-X\s+(\w+)/) || [])[1] || 'GET').toUpperCase();
    const headers = [...c.matchAll(/-H\s+['"]([^'"]+)['"]/g)].map(m => m[1]);
    const body = (c.match(/-d\s+['"]([^'"]*)['"]/) || [])[1];
    let code = 'fetch("' + url + '", {\n  method: "' + method + '"';
    if (headers.length) code += ',\n  headers: {\n    ' + headers.map(h => { const i = h.indexOf(':'); return '"' + h.slice(0, i).trim() + '": "' + h.slice(i + 1).trim() + '"'; }).join(',\n    ') + '\n  }';
    if (body) code += ',\n  body: ' + JSON.stringify(body);
    code += '\n}).then(r => r.json()).then(console.log);';
    Jot.$('#out', ui).value = code;
  });
};

JotTools['utm-builder'] = function (root) {
  const ui = Jot.ui('<label>URL <input type="url" id="url" value="https://example.com"></label><div class="row"><label>Source <input type="text" id="src" value="google"></label><label>Medium <input type="text" id="med" value="cpc"></label><label>Campaign <input type="text" id="camp" value="spring"></label></div><div class="btn-row"><button class="btn" id="go">Build</button><button class="btn btn-secondary" id="copy">Copy</button></div><textarea id="out" readonly rows="2"></textarea>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const u = new URL(Jot.$('#url', ui).value);
    u.searchParams.set('utm_source', Jot.$('#src', ui).value);
    u.searchParams.set('utm_medium', Jot.$('#med', ui).value);
    u.searchParams.set('utm_campaign', Jot.$('#camp', ui).value);
    Jot.$('#out', ui).value = u.toString();
  };
  Jot.$('#go', ui).click();
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
};

JotTools['utm-parser'] = function (root) {
  taTool(root, '<input type="url" id="in" value="https://example.com?utm_source=google&utm_medium=cpc&utm_campaign=spring"><div class="btn-row"><button class="btn" id="go">Parse</button></div><textarea id="out" readonly rows="6"></textarea>', ui => {
    try {
      const u = new URL(Jot.$('#in', ui).value);
      const lines = [];
      u.searchParams.forEach((v, k) => { if (k.startsWith('utm_')) lines.push(k + ': ' + v); });
      Jot.$('#out', ui).value = lines.join('\n') || 'No UTM parameters found';
    } catch (e) { Jot.$('#out', ui).value = e.message; }
  });
};

JotTools['docker-compose-gen'] = function (root) {
  const ui = Jot.ui('<label>Service name <input type="text" id="name" value="web"></label><label>Image <input type="text" id="img" value="nginx:latest"></label><label>Port <input type="text" id="port" value="8080:80"></label><div class="btn-row"><button class="btn" id="go">Generate</button><button class="btn btn-secondary" id="copy">Copy</button></div><textarea id="out" readonly rows="10"></textarea>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const n = Jot.$('#name', ui).value, img = Jot.$('#img', ui).value, port = Jot.$('#port', ui).value;
    Jot.$('#out', ui).value = 'version: "3.8"\nservices:\n  ' + n + ':\n    image: ' + img + '\n    ports:\n      - "' + port + '"\n    restart: unless-stopped\n';
  };
  Jot.$('#go', ui).click();
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
};

JotTools['gitignore-advanced'] = function (root) {
  const ui = Jot.ui('<div class="row"><label><input type="checkbox" id="node" checked> Node</label><label><input type="checkbox" id="py" checked> Python</label><label><input type="checkbox" id="go"> Go</label><label><input type="checkbox" id="idea" checked> IDE</label></div><div class="btn-row"><button class="btn" id="go">Build</button><button class="btn btn-secondary" id="copy">Copy</button></div><textarea id="out" readonly rows="12"></textarea>');
  root.appendChild(ui);
  const blocks = { node: 'node_modules/\nnpm-debug.log\n.env\n', py: '__pycache__/\n*.pyc\n.venv/\n', go: 'bin/\n*.exe\n', idea: '.idea/\n.vscode/\n*.swp\n' };
  Jot.$('#go', ui).onclick = () => {
    Jot.$('#out', ui).value = Object.entries(blocks).filter(([k]) => Jot.$('#' + k, ui).checked).map(([, v]) => v).join('\n');
  };
  Jot.$('#go', ui).click();
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
};

JotTools['readme-generator'] = function (root) {
  const ui = Jot.ui('<label>Project <input type="text" id="name" value="My Project"></label><label>Description <input type="text" id="desc" value="A useful tool"></label><label>Install <input type="text" id="inst" value="npm install"></label><div class="btn-row"><button class="btn" id="go">Generate</button><button class="btn btn-secondary" id="copy">Copy</button></div><textarea id="out" readonly rows="14"></textarea>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const n = Jot.$('#name', ui).value, d = Jot.$('#desc', ui).value, i = Jot.$('#inst', ui).value;
    Jot.$('#out', ui).value = '# ' + n + '\n\n' + d + '\n\n## Install\n\n```bash\n' + i + '\n```\n\n## Usage\n\nDescribe usage here.\n\n## License\n\nMIT\n';
  };
  Jot.$('#go', ui).click();
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
};

JotTools['semver-calculator'] = function (root) {
  calcBtn(root, '<label>Version <input type="text" id="v" value="1.2.3"></label><div class="btn-row"><button class="btn" id="maj">Major</button><button class="btn btn-secondary" id="min">Minor</button><button class="btn btn-secondary" id="pat">Patch</button></div><div class="output" id="out"></div>', ui => {});
  const ui = root.querySelector('.tool-ui');
  const bump = (i) => {
    const p = Jot.$('#v', ui).value.split('.').map(Number);
    p[i]++; for (let j = i + 1; j < 3; j++) p[j] = 0;
    Jot.$('#v', ui).value = p.join('.');
    Jot.$('#out', ui).textContent = 'New version: ' + p.join('.');
  };
  Jot.$('#maj', ui).onclick = () => bump(0);
  Jot.$('#min', ui).onclick = () => bump(1);
  Jot.$('#pat', ui).onclick = () => bump(2);
};

JotTools['chmod-calculator'] = function (root) {
  calcBtn(root, '<label>Numeric <input type="text" id="num" value="755"></label><div class="btn-row"><button class="btn" id="go">Convert</button></div><div class="output" id="out"></div>', ui => {
    const n = Jot.$('#num', ui).value.padStart(3, '0').slice(-3);
    const sym = [...n].map(d => 'rwx'[+d >> 2] + 'rwx'[(+d >> 1) & 1] + 'rwx'[+d & 1]).join('');
    Jot.$('#out', ui).textContent = 'Symbolic: ' + sym.replace(/(.{3})/g, '$1 ').trim();
  });
};

JotTools['crontab-generator'] = function (root) {
  const ui = Jot.ui('<div class="row"><label>Min <input type="text" id="m" value="0"></label><label>Hour <input type="text" id="h" value="*"></label><label>DOM <input type="text" id="d" value="*"></label><label>Mon <input type="text" id="mo" value="*"></label><label>DOW <input type="text" id="w" value="*"></label></div><label>Command <input type="text" id="cmd" value="/usr/bin/backup.sh"></label><div class="btn-row"><button class="btn" id="go">Generate</button></div><div class="output" id="out"></div>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const expr = [Jot.$('#m', ui), Jot.$('#h', ui), Jot.$('#d', ui), Jot.$('#mo', ui), Jot.$('#w', ui)].map(el => el.value).join(' ');
    Jot.$('#out', ui).textContent = expr + ' ' + Jot.$('#cmd', ui).value + '\n' + Jot.cronExplain(expr);
  };
  Jot.$('#go', ui).click();
};

JotTools['mac-generator'] = function (root) {
  const ui = Jot.ui('<label>Count <input type="number" id="n" value="5"></label><div class="btn-row"><button class="btn" id="go">Generate</button><button class="btn btn-secondary" id="copy">Copy</button></div><textarea id="out" readonly rows="6"></textarea>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const lines = [];
    for (let i = 0; i < +Jot.$('#n', ui).value; i++) {
      const b = new Uint8Array(6); crypto.getRandomValues(b); b[0] = (b[0] | 2) & 0xfe;
      lines.push([...b].map(x => x.toString(16).padStart(2, '0')).join(':').replace(/(?<=^|:)(..)/g, '$1:').slice(0, 17));
    }
    Jot.$('#out', ui).value = lines.join('\n');
  };
  Jot.$('#go', ui).click();
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
};

JotTools['cidr-calculator'] = function (root) {
  calcBtn(root, '<label>CIDR <input type="text" id="cidr" value="192.168.1.0/24"></label><div class="btn-row"><button class="btn" id="go">Calculate</button></div><div class="output" id="out"></div>', ui => {
    const [ip, bits] = Jot.$('#cidr', ui).value.split('/');
    const b = +bits || 24;
    const parts = ip.split('.').map(Number);
    const num = (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
    const mask = b === 0 ? 0 : (~0 << (32 - b)) >>> 0;
    const net = num & mask, bc = net | (~mask >>> 0);
    const fmt = n => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
    Jot.$('#out', ui).textContent = 'Network: ' + fmt(net) + '\nBroadcast: ' + fmt(bc) + '\nHosts: ' + Math.max(0, (bc - net - 1));
  });
};

JotTools['ipv6-converter'] = function (root) {
  taTool(root, '<input type="text" id="in" value="2001:0db8:0000:0000:0000:ff00:0042:8329"><div class="btn-row"><button class="btn" id="go">Compress/Expand</button></div><textarea id="out" readonly rows="3"></textarea>', ui => {
    let s = Jot.$('#in', ui).value.trim();
    if (s.includes('::')) {
      const halves = s.split('::');
      const left = halves[0] ? halves[0].split(':') : [];
      const right = halves[1] ? halves[1].split(':') : [];
      const missing = 8 - left.length - right.length;
      s = [...left, ...Array(missing).fill('0000'), ...right].map(h => h.padStart(4, '0')).join(':');
      Jot.$('#out', ui).value = 'Expanded: ' + s;
    } else {
      s = s.split(':').map(h => h.replace(/^0+/, '') || '0').join(':').replace(/\b0(:0)+/, '::');
      Jot.$('#out', ui).value = 'Compressed: ' + s;
    }
  });
};

JotTools['mime-lookup'] = function (root) {
  const mimes = { html: 'text/html', css: 'text/css', js: 'application/javascript', json: 'application/json', png: 'image/png', jpg: 'image/jpeg', gif: 'image/gif', pdf: 'application/pdf', zip: 'application/zip', mp4: 'video/mp4', mp3: 'audio/mpeg', svg: 'image/svg+xml', webp: 'image/webp', avif: 'image/avif' };
  const ui = Jot.ui('<input type="search" id="q" placeholder="Extension e.g. png"><div class="output" id="out" style="margin-top:.75rem"></div>');
  root.appendChild(ui);
  const show = () => {
    const q = Jot.$('#q', ui).value.toLowerCase().replace(/^\./, '');
    Jot.$('#out', ui).innerHTML = Object.entries(mimes).filter(([k, v]) => !q || k.includes(q) || v.includes(q)).map(([k, v]) => '<div><strong>.' + k + '</strong> → ' + v + '</div>').join('') || 'No match';
  };
  Jot.$('#q', ui).oninput = show; show();
};

JotTools['http-header-parser'] = function (root) {
  taTool(root, '<textarea id="in" rows="8" placeholder="HTTP/1.1 200 OK\\nContent-Type: application/json\\n\\n{&quot;ok&quot;:true}"></textarea><div class="btn-row"><button class="btn" id="go">Parse</button></div><textarea id="out" readonly rows="10"></textarea>', ui => {
    const raw = Jot.$('#in', ui).value.replace(/\\n/g, '\n');
    const [head, body] = raw.split(/\r?\n\r?\n/, 2);
    const lines = head.split(/\r?\n/);
    const out = ['Status: ' + lines[0], 'Headers:'];
    lines.slice(1).forEach(l => { const i = l.indexOf(':'); if (i > 0) out.push('  ' + l.slice(0, i).trim() + ': ' + l.slice(i + 1).trim()); });
    if (body) out.push('Body length: ' + body.length);
    Jot.$('#out', ui).value = out.join('\n');
  });
};

JotTools['jwt-rs256-decoder'] = function (root) {
  taTool(root, '<textarea id="in" rows="4" placeholder="eyJ..."></textarea><div class="btn-row"><button class="btn" id="go">Decode</button></div><textarea id="out" readonly rows="10"></textarea>', ui => {
    try {
      const d = Jot.decodeJwt(Jot.$('#in', ui).value.trim());
      Jot.$('#out', ui).value = 'Header:\n' + JSON.stringify(d.header, null, 2) + '\n\nPayload:\n' + JSON.stringify(d.payload, null, 2) + '\n\nAlgorithm: ' + (d.header.alg || 'unknown');
    } catch (e) { Jot.$('#out', ui).value = e.message; }
  });
};

JotTools['pemcert-decoder'] = function (root) {
  taTool(root, '<textarea id="in" rows="8" placeholder="-----BEGIN CERTIFICATE-----"></textarea><div class="btn-row"><button class="btn" id="go">Decode</button></div><textarea id="out" readonly rows="8"></textarea>', ui => {
    const pem = Jot.$('#in', ui).value.trim();
    const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
    try {
      const der = atob(b64);
      Jot.$('#out', ui).value = 'PEM type: ' + (pem.match(/BEGIN ([^-]+)/) || ['', 'UNKNOWN'])[1] + '\nDER length: ' + der.length + ' bytes\nBase64 length: ' + b64.length;
    } catch (e) { Jot.$('#out', ui).value = 'Invalid PEM: ' + e.message; }
  });
};

// Math calculators
JotTools['factorial-calc'] = function (root) {
  calcBtn(root, '<label>n <input type="number" id="n" value="5" min="0" max="170"></label><div class="btn-row"><button class="btn" id="go">Calculate</button></div><div class="output" id="out"></div>', ui => {
    let n = +Jot.$('#n', ui).value, r = 1n;
    for (let i = 2n; i <= BigInt(n); i++) r *= i;
    Jot.$('#out', ui).textContent = n + '! = ' + r.toString();
  });
};

JotTools['permutation-calc'] = function (root) {
  calcBtn(root, '<div class="row"><label>n <input type="number" id="n" value="10"></label><label>r <input type="number" id="r" value="3"></label></div><div class="btn-row"><button class="btn" id="go">Calculate</button></div><div class="output" id="out"></div>', ui => {
    const fact = n => { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; };
    const n = +Jot.$('#n', ui).value, r = +Jot.$('#r', ui).value;
    const nPr = fact(n) / fact(n - r), nCr = fact(n) / (fact(r) * fact(n - r));
    Jot.$('#out', ui).textContent = 'nPr = ' + nPr + '\nnCr = ' + nCr;
  });
};

JotTools['stats-calculator'] = function (root) {
  taTool(root, '<textarea id="in" rows="3" placeholder="1,2,3,4,5"></textarea><div class="btn-row"><button class="btn" id="go">Calculate</button></div><textarea id="out" readonly rows="6"></textarea>', ui => {
    const nums = Jot.$('#in', ui).value.split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
    const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
    const sorted = [...nums].sort((a, b) => a - b);
    const med = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
    const variance = nums.reduce((s, n) => s + (n - mean) ** 2, 0) / nums.length;
    Jot.$('#out', ui).value = 'Count: ' + nums.length + '\nMean: ' + mean.toFixed(4) + '\nMedian: ' + med + '\nStd dev: ' + Math.sqrt(variance).toFixed(4);
  });
};

JotTools['quadratic-calc'] = function (root) {
  calcBtn(root, '<div class="row"><label>a <input type="number" id="a" value="1"></label><label>b <input type="number" id="b" value="-3"></label><label>c <input type="number" id="c" value="2"></label></div><div class="btn-row"><button class="btn" id="go">Solve</button></div><div class="output" id="out"></div>', ui => {
    const a = +Jot.$('#a', ui).value, b = +Jot.$('#b', ui).value, c = +Jot.$('#c', ui).value;
    const d = b * b - 4 * a * c;
    if (d < 0) Jot.$('#out', ui).textContent = 'No real roots (discriminant ' + d + ')';
    else { const s = Math.sqrt(d); Jot.$('#out', ui).textContent = 'x1 = ' + ((-b + s) / (2 * a)).toFixed(4) + '\nx2 = ' + ((-b - s) / (2 * a)).toFixed(4); }
  });
};

JotTools['pythagorean-calc'] = function (root) {
  calcBtn(root, '<div class="row"><label>a <input type="number" id="a" value="3"></label><label>b <input type="number" id="b" value="4"></label><label>c (optional) <input type="number" id="c" value=""></label></div><div class="btn-row"><button class="btn" id="go">Calculate</button></div><div class="output" id="out"></div>', ui => {
    const a = +Jot.$('#a', ui).value, b = +Jot.$('#b', ui).value, c = +Jot.$('#c', ui).value;
    if (c) Jot.$('#out', ui).textContent = 'Missing side: ' + Math.sqrt(Math.abs(c * c - (a * a + b * b))).toFixed(4);
    else Jot.$('#out', ui).textContent = 'Hypotenuse c = ' + Math.sqrt(a * a + b * b).toFixed(4);
  });
};

JotTools['circle-calc'] = function (root) {
  calcBtn(root, '<label>Radius <input type="number" id="r" value="5"></label><div class="btn-row"><button class="btn" id="go">Calculate</button></div><div class="output" id="out"></div>', ui => {
    const r = +Jot.$('#r', ui).value;
    Jot.$('#out', ui).textContent = 'Area: ' + (Math.PI * r * r).toFixed(4) + '\nCircumference: ' + (2 * Math.PI * r).toFixed(4);
  });
};

JotTools['triangle-area'] = function (root) {
  calcBtn(root, '<div class="row"><label>Base <input type="number" id="b" value="10"></label><label>Height <input type="number" id="h" value="6"></label></div><div class="btn-row"><button class="btn" id="go">Calculate</button></div><div class="output" id="out"></div>', ui => {
    Jot.$('#out', ui).textContent = 'Area: ' + (0.5 * +Jot.$('#b', ui).value * +Jot.$('#h', ui).value).toFixed(4);
  });
};

JotTools['volume-calc'] = function (root) {
  calcBtn(root, '<label>Shape <select id="sh"><option value="cube">Cube</option><option value="sphere">Sphere</option><option value="cylinder">Cylinder</option></select></label><label>r / side <input type="number" id="r" value="3"></label><label>Height <input type="number" id="h" value="5"></label><div class="btn-row"><button class="btn" id="go">Calculate</button></div><div class="output" id="out"></div>', ui => {
    const sh = Jot.$('#sh', ui).value, r = +Jot.$('#r', ui).value, h = +Jot.$('#h', ui).value;
    let v = sh === 'cube' ? r ** 3 : sh === 'sphere' ? (4 / 3) * Math.PI * r ** 3 : Math.PI * r * r * h;
    Jot.$('#out', ui).textContent = 'Volume: ' + v.toFixed(4);
  });
};

JotTools['log-calculator'] = function (root) {
  calcBtn(root, '<label>x <input type="number" id="x" value="100"></label><div class="btn-row"><button class="btn" id="go">Calculate</button></div><div class="output" id="out"></div>', ui => {
    const x = +Jot.$('#x', ui).value;
    Jot.$('#out', ui).textContent = 'ln(x): ' + Math.log(x).toFixed(6) + '\nlog10(x): ' + Math.log10(x).toFixed(6) + '\nlog2(x): ' + Math.log2(x).toFixed(6);
  });
};

// Finance
JotTools['apy-calculator'] = function (root) {
  calcBtn(root, '<label>APR % <input type="number" id="apr" value="5"></label><label>Compounds/year <input type="number" id="n" value="12"></label><div class="btn-row"><button class="btn" id="go">Calculate</button></div><div class="output" id="out"></div>', ui => {
    const apr = +Jot.$('#apr', ui).value / 100, n = +Jot.$('#n', ui).value;
    Jot.$('#out', ui).textContent = 'APY: ' + ((Math.pow(1 + apr / n, n) - 1) * 100).toFixed(4) + '%';
  });
};

JotTools['rule-of-72'] = function (root) {
  calcBtn(root, '<label>Rate % <input type="number" id="r" value="8"></label><div class="btn-row"><button class="btn" id="go">Calculate</button></div><div class="output" id="out"></div>', ui => {
    Jot.$('#out', ui).textContent = 'Years to double: ~' + (72 / +Jot.$('#r', ui).value).toFixed(1);
  });
};

JotTools['inflation-calc'] = function (root) {
  calcBtn(root, '<label>Amount $ <input type="number" id="amt" value="1000"></label><label>Years <input type="number" id="y" value="10"></label><label>Inflation % <input type="number" id="inf" value="3"></label><div class="btn-row"><button class="btn" id="go">Calculate</button></div><div class="output" id="out"></div>', ui => {
    const amt = +Jot.$('#amt', ui).value, y = +Jot.$('#y', ui).value, inf = +Jot.$('#inf', ui).value / 100;
    const future = amt * Math.pow(1 + inf, y), today = amt / Math.pow(1 + inf, y);
    Jot.$('#out', ui).textContent = 'Future value: $' + future.toFixed(2) + '\nToday\'s purchasing power: $' + today.toFixed(2);
  });
};

JotTools['hourly-salary'] = function (root) {
  calcBtn(root, '<label>Hourly $ <input type="number" id="h" value="25"></label><label>Hours/week <input type="number" id="hw" value="40"></label><div class="btn-row"><button class="btn" id="go">Calculate</button></div><div class="output" id="out"></div>', ui => {
    const annual = +Jot.$('#h', ui).value * +Jot.$('#hw', ui).value * 52;
    Jot.$('#out', ui).textContent = 'Annual salary: $' + annual.toFixed(2) + '\nMonthly: $' + (annual / 12).toFixed(2);
  });
};

JotTools['paycheck-calc'] = function (root) {
  calcBtn(root, '<label>Gross $ <input type="number" id="g" value="5000"></label><label>Tax % <input type="number" id="t" value="22"></label><label>Deductions $ <input type="number" id="d" value="200"></label><div class="btn-row"><button class="btn" id="go">Calculate</button></div><div class="output" id="out"></div>', ui => {
    const net = +Jot.$('#g', ui).value * (1 - +Jot.$('#t', ui).value / 100) - +Jot.$('#d', ui).value;
    Jot.$('#out', ui).textContent = 'Net pay: $' + net.toFixed(2);
  });
};

JotTools['retirement-calc'] = function (root) {
  calcBtn(root, '<label>Current savings $ <input type="number" id="s" value="50000"></label><label>Monthly contrib $ <input type="number" id="m" value="500"></label><label>Years <input type="number" id="y" value="25"></label><label>Return % <input type="number" id="r" value="7"></label><div class="btn-row"><button class="btn" id="go">Project</button></div><div class="output" id="out"></div>', ui => {
    const s = +Jot.$('#s', ui).value, m = +Jot.$('#m', ui).value, y = +Jot.$('#y', ui).value, r = +Jot.$('#r', ui).value / 100 / 12, n = y * 12;
    const fv = s * Math.pow(1 + r, n) + m * ((Math.pow(1 + r, n) - 1) / r);
    Jot.$('#out', ui).textContent = 'Projected balance: $' + fv.toFixed(2);
  });
};

JotTools['stripe-fee'] = function (root) {
  calcBtn(root, '<label>Charge $ <input type="number" id="amt" value="100"></label><div class="btn-row"><button class="btn" id="go">Calculate</button></div><div class="output" id="out"></div>', ui => {
    const amt = +Jot.$('#amt', ui).value, fee = amt * 0.029 + 0.30;
    Jot.$('#out', ui).textContent = 'Fee: $' + fee.toFixed(2) + '\nNet: $' + (amt - fee).toFixed(2);
  });
};

JotTools['paypal-fee'] = function (root) {
  calcBtn(root, '<label>Receive $ <input type="number" id="amt" value="100"></label><div class="btn-row"><button class="btn" id="go">Calculate</button></div><div class="output" id="out"></div>', ui => {
    const amt = +Jot.$('#amt', ui).value, fee = amt * 0.0349 + 0.49;
    Jot.$('#out', ui).textContent = 'Fee: $' + fee.toFixed(2) + '\nNet: $' + (amt - fee).toFixed(2);
  });
};

JotTools['cpm-calculator'] = function (root) {
  calcBtn(root, '<label>Cost $ <input type="number" id="c" value="500"></label><label>Impressions <input type="number" id="i" value="100000"></label><div class="btn-row"><button class="btn" id="go">Calculate</button></div><div class="output" id="out"></div>', ui => {
    Jot.$('#out', ui).textContent = 'CPM: $' + ((+Jot.$('#c', ui).value / +Jot.$('#i', ui).value) * 1000).toFixed(2);
  });
};

JotTools['ctr-calculator'] = function (root) {
  calcBtn(root, '<label>Clicks <input type="number" id="cl" value="250"></label><label>Impressions <input type="number" id="im" value="10000"></label><div class="btn-row"><button class="btn" id="go">Calculate</button></div><div class="output" id="out"></div>', ui => {
    Jot.$('#out', ui).textContent = 'CTR: ' + ((+Jot.$('#cl', ui).value / +Jot.$('#im', ui).value) * 100).toFixed(2) + '%';
  });
};

JotTools['roas-calculator'] = function (root) {
  calcBtn(root, '<label>Revenue $ <input type="number" id="rev" value="5000"></label><label>Ad spend $ <input type="number" id="sp" value="1000"></label><div class="btn-row"><button class="btn" id="go">Calculate</button></div><div class="output" id="out"></div>', ui => {
    Jot.$('#out', ui).textContent = 'ROAS: ' + (+Jot.$('#rev', ui).value / +Jot.$('#sp', ui).value).toFixed(2) + 'x';
  });
};

JotTools['amazon-fba'] = function (root) {
  calcBtn(root, '<label>Price $ <input type="number" id="p" value="29.99"></label><label>Cost $ <input type="number" id="c" value="8"></label><label>FBA fee $ <input type="number" id="f" value="5.50"></label><label>Referral % <input type="number" id="r" value="15"></label><div class="btn-row"><button class="btn" id="go">Calculate</button></div><div class="output" id="out"></div>', ui => {
    const p = +Jot.$('#p', ui).value, c = +Jot.$('#c', ui).value, f = +Jot.$('#f', ui).value, ref = p * (+Jot.$('#r', ui).value / 100);
    const profit = p - c - f - ref;
    Jot.$('#out', ui).textContent = 'Net profit: $' + profit.toFixed(2) + ' (' + ((profit / p) * 100).toFixed(1) + '% margin)';
  });
};

// Health / fitness
JotTools['ideal-weight'] = function (root) {
  calcBtn(root, '<label>Height cm <input type="number" id="h" value="175"></label><label>Sex <select id="s"><option value="m">Male</option><option value="f">Female</option></select></label><div class="btn-row"><button class="btn" id="go">Calculate</button></div><div class="output" id="out"></div>', ui => {
    const h = +Jot.$('#h', ui).value, m = Jot.$('#s', ui).value === 'm';
    const devine = m ? 50 + 2.3 * ((h / 2.54) - 60) : 45.5 + 2.3 * ((h / 2.54) - 60);
    Jot.$('#out', ui).textContent = 'Devine ideal weight: ' + devine.toFixed(1) + ' kg';
  });
};

JotTools['body-fat'] = function (root) {
  calcBtn(root, '<div class="row"><label>Waist cm <input type="number" id="w" value="85"></label><label>Neck cm <input type="number" id="n" value="38"></label><label>Height cm <input type="number" id="h" value="175"></label></div><div class="btn-row"><button class="btn" id="go">Estimate (US Navy male)</button></div><div class="output" id="out"></div>', ui => {
    const w = +Jot.$('#w', ui).value, n = +Jot.$('#n', ui).value, h = +Jot.$('#h', ui).value;
    const bf = 495 / (1.0324 - 0.19077 * Math.log10(w - n) + 0.15456 * Math.log10(h)) - 450;
    Jot.$('#out', ui).textContent = 'Body fat: ' + bf.toFixed(1) + '%';
  });
};

JotTools['macro-calculator'] = function (root) {
  calcBtn(root, '<label>Calories <input type="number" id="cal" value="2000"></label><label>Protein g <input type="number" id="p" value="150"></label><label>Fat g <input type="number" id="f" value="65"></label><div class="btn-row"><button class="btn" id="go">Calculate</button></div><div class="output" id="out"></div>', ui => {
    const cal = +Jot.$('#cal', ui).value, p = +Jot.$('#p', ui).value, f = +Jot.$('#f', ui).value;
    const carbs = (cal - p * 4 - f * 9) / 4;
    Jot.$('#out', ui).textContent = 'Carbs: ' + carbs.toFixed(0) + 'g\nProtein: ' + ((p * 4 / cal) * 100).toFixed(0) + '%\nFat: ' + ((f * 9 / cal) * 100).toFixed(0) + '%';
  });
};

JotTools['water-intake'] = function (root) {
  calcBtn(root, '<label>Weight kg <input type="number" id="w" value="70"></label><label>Activity <select id="a"><option value="1">Low</option><option value="1.2">Moderate</option><option value="1.4">High</option></select></label><div class="btn-row"><button class="btn" id="go">Calculate</button></div><div class="output" id="out"></div>', ui => {
    const ml = +Jot.$('#w', ui).value * 35 * +Jot.$('#a', ui).value;
    Jot.$('#out', ui).textContent = 'Daily water: ' + ml.toFixed(0) + ' ml (' + (ml / 1000).toFixed(1) + ' L)';
  });
};

JotTools['pace-calculator'] = function (root) {
  calcBtn(root, '<label>Distance km <input type="number" id="d" value="10"></label><label>Time min <input type="number" id="t" value="50"></label><div class="btn-row"><button class="btn" id="go">Calculate</button></div><div class="output" id="out"></div>', ui => {
    const pace = +Jot.$('#t', ui).value / +Jot.$('#d', ui).value;
    Jot.$('#out', ui).textContent = 'Pace: ' + Math.floor(pace) + ':' + String(Math.round((pace % 1) * 60)).padStart(2, '0') + ' min/km\nSpeed: ' + (60 / pace).toFixed(2) + ' km/h';
  });
};

JotTools['one-rep-max'] = function (root) {
  calcBtn(root, '<label>Weight kg <input type="number" id="w" value="100"></label><label>Reps <input type="number" id="r" value="5"></label><div class="btn-row"><button class="btn" id="go">Estimate 1RM</button></div><div class="output" id="out"></div>', ui => {
    const w = +Jot.$('#w', ui).value, r = +Jot.$('#r', ui).value;
    Jot.$('#out', ui).textContent = 'Estimated 1RM (Epley): ' + (w * (1 + r / 30)).toFixed(1) + ' kg';
  });
};

JotTools['steps-converter'] = function (root) {
  calcBtn(root, '<label>Steps <input type="number" id="s" value="10000"></label><label>Stride m <input type="number" id="st" value="0.75" step="0.01"></label><div class="btn-row"><button class="btn" id="go">Convert</button></div><div class="output" id="out"></div>', ui => {
    const km = (+Jot.$('#s', ui).value * +Jot.$('#st', ui).value) / 1000;
    Jot.$('#out', ui).textContent = 'Distance: ' + km.toFixed(2) + ' km (' + (km * 0.621371).toFixed(2) + ' mi)';
  });
};

// Date / time
JotTools['pregnancy-due'] = function (root) {
  calcBtn(root, '<label>Last period <input type="date" id="d"></label><div class="btn-row"><button class="btn" id="go">Calculate</button></div><div class="output" id="out"></div>', ui => {
    const d = new Date(Jot.$('#d', ui).value);
    if (isNaN(d)) return;
    d.setDate(d.getDate() + 280);
    Jot.$('#out', ui).textContent = 'Estimated due date: ' + d.toISOString().slice(0, 10);
  });
};

JotTools['ovulation-calc'] = function (root) {
  calcBtn(root, '<label>Last period <input type="date" id="d"></label><label>Cycle days <input type="number" id="c" value="28"></label><div class="btn-row"><button class="btn" id="go">Calculate</button></div><div class="output" id="out"></div>', ui => {
    const d = new Date(Jot.$('#d', ui).value), c = +Jot.$('#c', ui).value;
    if (isNaN(d)) return;
    const ov = new Date(d); ov.setDate(ov.getDate() + c - 14);
    const start = new Date(ov); start.setDate(start.getDate() - 2);
    const end = new Date(ov); end.setDate(end.getDate() + 2);
    Jot.$('#out', ui).textContent = 'Ovulation ~' + ov.toISOString().slice(0, 10) + '\nFertile window: ' + start.toISOString().slice(0, 10) + ' to ' + end.toISOString().slice(0, 10);
  });
};

JotTools['days-until'] = function (root) {
  calcBtn(root, '<label>Target date <input type="date" id="d"></label><div class="btn-row"><button class="btn" id="go">Count</button></div><div class="output" id="out"></div>', ui => {
    const target = new Date(Jot.$('#d', ui).value), now = new Date();
    const days = Math.ceil((target - now) / 86400000);
    Jot.$('#out', ui).textContent = days >= 0 ? days + ' days remaining' : Math.abs(days) + ' days ago';
  });
};

JotTools['date-add'] = function (root) {
  calcBtn(root, '<label>Start <input type="date" id="d"></label><label>Days <input type="number" id="days" value="30"></label><div class="btn-row"><button class="btn" id="go">Add</button><button class="btn btn-secondary" id="sub">Subtract</button></div><div class="output" id="out"></div>', ui => {
    const run = sign => {
      const d = new Date(Jot.$('#d', ui).value);
      d.setDate(d.getDate() + sign * +Jot.$('#days', ui).value);
      Jot.$('#out', ui).textContent = d.toISOString().slice(0, 10);
    };
    Jot.$('#go', ui).onclick = () => run(1);
    Jot.$('#sub', ui).onclick = () => run(-1);
  });
};

JotTools['world-clock'] = function (root) {
  const zones = [['New York', 'America/New_York'], ['London', 'Europe/London'], ['Tokyo', 'Asia/Tokyo'], ['Sydney', 'Australia/Sydney']];
  const ui = Jot.ui('<div class="btn-row"><button class="btn" id="go">Refresh</button></div><div class="output" id="out"></div>');
  root.appendChild(ui);
  const show = () => {
    Jot.$('#out', ui).innerHTML = zones.map(([n, z]) => {
      const t = new Date().toLocaleString('en-US', { timeZone: z, hour: '2-digit', minute: '2-digit', hour12: true, weekday: 'short' });
      return '<div><strong>' + n + '</strong> ' + t + '</div>';
    }).join('');
  };
  Jot.$('#go', ui).onclick = show; show();
};

JotTools['meeting-planner'] = function (root) {
  const ui = Jot.ui('<label>Your time (local) <input type="time" id="t" value="09:00"></label><div class="output" id="out" style="margin-top:.75rem"></div>');
  root.appendChild(ui);
  const zones = [['UTC', 0], ['London', 0], ['Berlin', 1], ['Dubai', 4], ['Singapore', 8], ['Tokyo', 9]];
  Jot.$('#t', ui).oninput = () => {
    const [h, m] = Jot.$('#t', ui).value.split(':').map(Number);
    Jot.$('#out', ui).innerHTML = zones.map(([n, off]) => {
      const d = new Date(); d.setUTCHours(h - off, m);
      return '<div><strong>' + n + '</strong> ' + d.toUTCString().slice(17, 22) + ' UTC' + (off >= 0 ? '+' : '') + off + '</div>';
    }).join('');
  };
  Jot.$('#t', ui).dispatchEvent(new Event('input'));
};

JotTools['unix-ms'] = function (root) {
  const ui = Jot.ui('<label>Unix ms <input type="text" id="ms" value=""></label><div class="btn-row"><button class="btn" id="toDate">To date</button><button class="btn btn-secondary" id="now">Now</button></div><div class="output" id="out"></div>');
  root.appendChild(ui);
  Jot.$('#toDate', ui).onclick = () => { Jot.$('#out', ui).textContent = new Date(+Jot.$('#ms', ui).value).toISOString(); };
  Jot.$('#now', ui).onclick = () => { const n = Date.now(); Jot.$('#ms', ui).value = n; Jot.$('#out', ui).textContent = new Date(n).toISOString(); };
  Jot.$('#now', ui).click();
};

JotTools['sleep-calculator'] = function (root) {
  calcBtn(root, '<label>Wake at <input type="time" id="w" value="07:00"></label><div class="btn-row"><button class="btn" id="go">Best bedtimes</button></div><div class="output" id="out"></div>', ui => {
    const [h, m] = Jot.$('#w', ui).value.split(':').map(Number);
    const wake = h * 60 + m;
    const times = [6, 5, 4, 3].map(cycles => {
      const bed = wake - cycles * 90 - 15;
      const bh = ((bed % 1440) + 1440) % 1440;
      return Math.floor(bh / 60).toString().padStart(2, '0') + ':' + (bh % 60).toString().padStart(2, '0') + ' (' + cycles + ' cycles)';
    });
    Jot.$('#out', ui).textContent = 'Go to sleep at:\n' + times.join('\n');
  });
};

// Unicode text generators
JotTools['zalgo-text'] = function (root) {
  const marks = ['\u0300', '\u0301', '\u0302', '\u0303', '\u0304', '\u0305', '\u0306', '\u0307', '\u0308'];
  taTool(root, '<textarea id="in" rows="3">Hello</textarea><div class="btn-row"><button class="btn" id="go">Zalgo</button><button class="btn btn-secondary" id="copy">Copy</button></div><textarea id="out" readonly rows="4"></textarea>', ui => {
    Jot.$('#out', ui).value = [...Jot.$('#in', ui).value].map(c => c + marks.sort(() => Math.random() - 0.5).slice(0, Jot.randomInt(1, 4)).join('')).join('');
  });
};

JotTools['bubble-text'] = function (root) {
  taTool(root, '<textarea id="in" rows="3">Hello</textarea><div class="btn-row"><button class="btn" id="go">Convert</button><button class="btn btn-secondary" id="copy">Copy</button></div><textarea id="out" readonly rows="3"></textarea>', ui => {
    Jot.$('#out', ui).value = Jot._mapChars(Jot.$('#in', ui).value, (c, u) => c + (u ? 0x24B6 - 65 : 0x24D0 - 97));
  });
};

JotTools['wide-text'] = function (root) {
  taTool(root, '<textarea id="in" rows="3">Hello</textarea><div class="btn-row"><button class="btn" id="go">Convert</button><button class="btn btn-secondary" id="copy">Copy</button></div><textarea id="out" readonly rows="3"></textarea>', ui => {
    Jot.$('#out', ui).value = [...Jot.$('#in', ui).value].map(c => {
      const code = c.charCodeAt(0);
      if (code >= 33 && code <= 126) return String.fromCharCode(code + 0xFEE0);
      if (code === 32) return '\u3000';
      return c;
    }).join('');
  });
};

JotTools['small-caps'] = function (root) {
  const map = { a: '\u1D00', b: '\u0299', c: '\u1D04', d: '\u1D05', e: '\u1D07', f: '\u0493', g: '\u0262', h: '\u029C', i: '\u026A', j: '\u1D0A', k: '\u1D0B', l: '\u029F', m: '\u1D0D', n: '\u0274', o: '\u1D0F', p: '\u1D18', q: '\u0071', r: '\u0280', s: '\u0073', t: '\u1D1B', u: '\u1D1C', v: '\u1D20', w: '\u1D21', x: '\u0078', y: '\u028F', z: '\u1D22' };
  taTool(root, '<textarea id="in" rows="3">Hello World</textarea><div class="btn-row"><button class="btn" id="go">Convert</button><button class="btn btn-secondary" id="copy">Copy</button></div><textarea id="out" readonly rows="3"></textarea>', ui => {
    Jot.$('#out', ui).value = [...Jot.$('#in', ui).value.toLowerCase()].map(c => map[c] || c).join('');
  });
};

JotTools['bold-text'] = function (root) {
  taTool(root, '<textarea id="in" rows="3">Hello</textarea><div class="btn-row"><button class="btn" id="go">Bold</button><button class="btn btn-secondary" id="copy">Copy</button></div><textarea id="out" readonly rows="3"></textarea>', ui => {
    Jot.$('#out', ui).value = Jot._mapChars(Jot.$('#in', ui).value, (c, u) => c + (u ? 0x1D400 - 65 : 0x1D41A - 97));
  });
};

JotTools['italic-text'] = function (root) {
  taTool(root, '<textarea id="in" rows="3">Hello</textarea><div class="btn-row"><button class="btn" id="go">Italic</button><button class="btn btn-secondary" id="copy">Copy</button></div><textarea id="out" readonly rows="3"></textarea>', ui => {
    Jot.$('#out', ui).value = Jot._mapChars(Jot.$('#in', ui).value, (c, u) => c + (u ? 0x1D434 - 65 : 0x1D44E - 97));
  });
};

JotTools['invisible-char'] = function (root) {
  const ui = Jot.ui('<p>Zero-width space (U+200B), zero-width joiner (U+200D), word joiner (U+2060)</p><div class="btn-row"><button class="btn" id="zwsp">Copy ZWSP</button><button class="btn btn-secondary" id="zwj">Copy ZWJ</button><button class="btn btn-secondary" id="wj">Copy WJ</button></div><textarea id="out" readonly rows="2"></textarea>');
  root.appendChild(ui);
  Jot.$('#zwsp', ui).onclick = () => { Jot.$('#out', ui).value = '\u200B'; Jot.copy('\u200B', Jot.$('#zwsp', ui)); };
  Jot.$('#zwj', ui).onclick = () => { Jot.$('#out', ui).value = '\u200D'; Jot.copy('\u200D', Jot.$('#zwj', ui)); };
  Jot.$('#wj', ui).onclick = () => { Jot.$('#out', ui).value = '\u2060'; Jot.copy('\u2060', Jot.$('#wj', ui)); };
};

JotTools['duplicate-finder'] = function (root) {
  taTool(root, '<textarea id="in" rows="6"></textarea><div class="btn-row"><button class="btn" id="go">Find duplicates</button></div><textarea id="out" readonly rows="6"></textarea>', ui => {
    const words = Jot.$('#in', ui).value.toLowerCase().match(/\b\w+\b/g) || [];
    const counts = {};
    words.forEach(w => { counts[w] = (counts[w] || 0) + 1; });
    Jot.$('#out', ui).value = Object.entries(counts).filter(([, n]) => n > 1).map(([w, n]) => w + ': ' + n).join('\n') || 'No duplicates';
  });
};

JotTools['syllable-counter'] = function (root) {
  taTool(root, '<textarea id="in" rows="4">The quick brown fox</textarea><div class="btn-row"><button class="btn" id="go">Count</button></div><textarea id="out" readonly rows="4"></textarea>', ui => {
    const count = w => (w.toLowerCase().replace(/(?:[^laeiouy]|ed|[^laeiouy]e)$/, '').replace(/^y/, '').match(/[aeiouy]{1,2}/g) || []).length || 1;
    const words = Jot.$('#in', ui).value.match(/\b\w+\b/g) || [];
    Jot.$('#out', ui).value = 'Total syllables: ' + words.reduce((s, w) => s + count(w), 0) + '\nWords: ' + words.length;
  });
};

JotTools['flesch-score'] = function (root) {
  taTool(root, '<textarea id="in" rows="6">The quick brown fox jumps over the lazy dog.</textarea><div class="btn-row"><button class="btn" id="go">Score</button></div><textarea id="out" readonly rows="4"></textarea>', ui => {
    const text = Jot.$('#in', ui).value;
    const words = text.match(/\b\w+\b/g) || [];
    const sentences = Math.max(1, (text.match(/[.!?]+/g) || []).length);
    const syll = w => (w.toLowerCase().replace(/(?:[^laeiouy]|ed|[^laeiouy]e)$/, '').match(/[aeiouy]{1,2}/g) || []).length || 1;
    const sylTotal = words.reduce((s, w) => s + syll(w), 0);
    const ease = 206.835 - 1.015 * (words.length / sentences) - 84.6 * (sylTotal / words.length);
    Jot.$('#out', ui).value = 'Flesch Reading Ease: ' + ease.toFixed(1) + '\nGrade level: ' + (0.39 * (words.length / sentences) + 11.8 * (sylTotal / words.length) - 15.59).toFixed(1);
  });
};

JotTools['sort-paragraphs'] = function (root) {
  const ui = Jot.ui('<textarea id="in" rows="6"></textarea><div class="btn-row"><button class="btn" id="az">A–Z</button><button class="btn btn-secondary" id="len">By length</button></div><textarea id="out" readonly rows="6"></textarea>');
  root.appendChild(ui);
  const run = mode => {
    let paras = Jot.$('#in', ui).value.split(/\n\s*\n/).filter(Boolean);
    if (mode === 'az') paras.sort((a, b) => a.localeCompare(b));
    else paras.sort((a, b) => a.length - b.length);
    Jot.$('#out', ui).value = paras.join('\n\n');
  };
  Jot.$('#az', ui).onclick = () => run('az');
  Jot.$('#len', ui).onclick = () => run('len');
};

JotTools['remove-punctuation'] = function (root) {
  taTool(root, '<textarea id="in" rows="4">Hello, world!</textarea><div class="btn-row"><button class="btn" id="go">Remove</button><button class="btn btn-secondary" id="copy">Copy</button></div><textarea id="out" readonly rows="4"></textarea>', ui => {
    Jot.$('#out', ui).value = Jot.$('#in', ui).value.replace(/[^\w\s]|_/g, '').replace(/\s+/g, ' ').trim();
  });
};

JotTools['sentence-capitalize'] = function (root) {
  taTool(root, '<textarea id="in" rows="4">hello world. how are you?</textarea><div class="btn-row"><button class="btn" id="go">Capitalize</button><button class="btn btn-secondary" id="copy">Copy</button></div><textarea id="out" readonly rows="4"></textarea>', ui => {
    Jot.$('#out', ui).value = Jot.$('#in', ui).value.replace(/(^\w|\.\s+\w|\?\s+\w|!\s+\w)/g, m => m.toUpperCase());
  });
};

JotTools['word-frequency'] = function (root) {
  taTool(root, '<textarea id="in" rows="6"></textarea><div class="btn-row"><button class="btn" id="go">Count</button></div><textarea id="out" readonly rows="8"></textarea>', ui => {
    const counts = {};
    (Jot.$('#in', ui).value.toLowerCase().match(/\b\w+\b/g) || []).forEach(w => { counts[w] = (counts[w] || 0) + 1; });
    Jot.$('#out', ui).value = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([w, n]) => w + ': ' + n).join('\n');
  });
};

JotTools['ngram-generator'] = function (root) {
  taTool(root, '<textarea id="in" rows="4">the quick brown fox</textarea><label>n <input type="number" id="n" value="2" min="1" max="5"></label><div class="btn-row"><button class="btn" id="go">Generate</button></div><textarea id="out" readonly rows="6"></textarea>', ui => {
    const words = Jot.$('#in', ui).value.toLowerCase().match(/\b\w+\b/g) || [], n = +Jot.$('#n', ui).value;
    const grams = [];
    for (let i = 0; i <= words.length - n; i++) grams.push(words.slice(i, i + n).join(' '));
    Jot.$('#out', ui).value = grams.join('\n');
  });
};

// Developer / web / design
JotTools['csv-excel'] = function (root) {
  taTool(root, '<textarea id="in" rows="6" placeholder="a,b,c\\n1,2,3"></textarea><div class="btn-row"><button class="btn" id="go">To TSV</button><button class="btn btn-secondary" id="dl">Download</button></div><textarea id="out" readonly rows="6"></textarea>', ui => {
    Jot.$('#out', ui).value = Jot.$('#in', ui).value.replace(/,/g, '\t');
  });
};

JotTools['excel-csv'] = function (root) {
  taTool(root, '<textarea id="in" rows="6" placeholder="tab separated"></textarea><div class="btn-row"><button class="btn" id="go">To CSV</button></div><textarea id="out" readonly rows="6"></textarea>', ui => {
    Jot.$('#out', ui).value = Jot.$('#in', ui).value.split('\n').map(r => r.split('\t').map(v => '"' + v.replace(/"/g, '""') + '"').join(',')).join('\n');
  });
};

JotTools['schema-generator'] = function (root) {
  const ui = Jot.ui('<label>Name <input type="text" id="name" value="Organization"></label><label>URL <input type="url" id="url" value="https://example.com"></label><div class="btn-row"><button class="btn" id="go">Generate</button><button class="btn btn-secondary" id="copy">Copy</button></div><textarea id="out" readonly rows="10"></textarea>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    Jot.$('#out', ui).value = JSON.stringify({ '@context': 'https://schema.org', '@type': 'Organization', name: Jot.$('#name', ui).value, url: Jot.$('#url', ui).value }, null, 2);
  };
  Jot.$('#go', ui).click();
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
};

JotTools['faq-schema'] = function (root) {
  const ui = Jot.ui('<textarea id="in" rows="6" placeholder="Question|Answer per line"></textarea><div class="btn-row"><button class="btn" id="go">Generate</button><button class="btn btn-secondary" id="copy">Copy</button></div><textarea id="out" readonly rows="10"></textarea>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const items = Jot.$('#in', ui).value.split('\n').filter(Boolean).map(l => {
      const [q, a] = l.split('|');
      return { '@type': 'Question', name: (q || '').trim(), acceptedAnswer: { '@type': 'Answer', text: (a || '').trim() } };
    });
    Jot.$('#out', ui).value = JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: items }, null, 2);
  };
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
};

JotTools['breadcrumb-schema'] = function (root) {
  const ui = Jot.ui('<textarea id="in" rows="4" placeholder="Home|/\\nProducts|/products"></textarea><div class="btn-row"><button class="btn" id="go">Generate</button><button class="btn btn-secondary" id="copy">Copy</button></div><textarea id="out" readonly rows="10"></textarea>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const items = Jot.$('#in', ui).value.split('\n').filter(Boolean).map((l, i) => {
      const [name, url] = l.split('|');
      return { '@type': 'ListItem', position: i + 1, name: (name || '').trim(), item: (url || '').trim() };
    });
    Jot.$('#out', ui).value = JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items }, null, 2);
  };
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
};

JotTools['twitter-card'] = function (root) {
  const ui = Jot.ui('<label>Title <input type="text" id="t" value="Page title"></label><label>Description <input type="text" id="d" value="Description"></label><label>Image URL <input type="url" id="img" value="https://example.com/image.jpg"></label><div class="btn-row"><button class="btn" id="go">Generate</button><button class="btn btn-secondary" id="copy">Copy</button></div><textarea id="out" readonly rows="8"></textarea>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    Jot.$('#out', ui).value = ['<meta name="twitter:card" content="summary_large_image">', '<meta name="twitter:title" content="' + Jot.$('#t', ui).value + '">', '<meta name="twitter:description" content="' + Jot.$('#d', ui).value + '">', '<meta name="twitter:image" content="' + Jot.$('#img', ui).value + '">'].join('\n');
  };
  Jot.$('#go', ui).click();
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
};

JotTools['linkedin-preview'] = function (root) {
  const ui = Jot.ui('<label>Title <input type="text" id="t" value="Post title"></label><label>Text <textarea id="txt" rows="4">Your post content here.</textarea></label><div id="prev" style="border:1px solid var(--border);padding:1rem;margin-top:.75rem;background:var(--bg-subtle)"></div>');
  root.appendChild(ui);
  const upd = () => { Jot.$('#prev', ui).innerHTML = '<strong>' + Jot.$('#t', ui).value + '</strong><p style="margin:.5rem 0 0">' + Jot.$('#txt', ui).value.replace(/\n/g, '<br>') + '</p>'; };
  Jot.$('#t', ui).oninput = upd; Jot.$('#txt', ui).oninput = upd; upd();
};

JotTools['canonical-tag'] = function (root) {
  const ui = Jot.ui('<label>Canonical URL <input type="url" id="u" value="https://example.com/page"></label><div class="btn-row"><button class="btn" id="go">Generate</button><button class="btn btn-secondary" id="copy">Copy</button></div><textarea id="out" readonly rows="2"></textarea>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => { Jot.$('#out', ui).value = '<link rel="canonical" href="' + Jot.$('#u', ui).value + '">'; };
  Jot.$('#go', ui).click();
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
};

JotTools['hreflang-generator'] = function (root) {
  const ui = Jot.ui('<textarea id="in" rows="4" placeholder="en|https://example.com/en\\nfr|https://example.com/fr"></textarea><div class="btn-row"><button class="btn" id="go">Generate</button><button class="btn btn-secondary" id="copy">Copy</button></div><textarea id="out" readonly rows="8"></textarea>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    Jot.$('#out', ui).value = Jot.$('#in', ui).value.split('\n').filter(Boolean).map(l => {
      const [lang, url] = l.split('|');
      return '<link rel="alternate" hreflang="' + (lang || '').trim() + '" href="' + (url || '').trim() + '">';
    }).join('\n');
  };
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
};

JotTools['css-animation'] = function (root) {
  const ui = Jot.ui('<label>Duration s <input type="number" id="d" value="1" step="0.1"></label><label>Name <input type="text" id="n" value="fadeIn"></label><div id="demo" style="width:60px;height:60px;background:var(--accent);margin:1rem 0;animation:fadeIn 1s infinite alternate"></div><style id="css"></style><textarea id="out" readonly rows="8"></textarea>');
  root.appendChild(ui);
  const upd = () => {
    const d = Jot.$('#d', ui).value, n = Jot.$('#n', ui).value;
    const css = '@keyframes ' + n + ' { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }\n.' + n + ' { animation: ' + n + ' ' + d + 's ease infinite alternate; }';
    Jot.$('#css', ui).textContent = css;
    Jot.$('#demo', ui).style.animation = n + ' ' + d + 's ease infinite alternate';
    Jot.$('#out', ui).value = css;
  };
  Jot.$('#d', ui).oninput = upd; Jot.$('#n', ui).oninput = upd; upd();
};

JotTools['css-filter'] = function (root) {
  const ui = Jot.ui('<input type="file" accept="image/*" id="file"><div class="row"><label>Blur <input type="range" id="blur" min="0" max="10" value="0"></label><label>Bright <input type="range" id="br" min="50" max="200" value="100"></label></div><canvas id="c" style="max-width:100%"></canvas><textarea id="out" readonly rows="2" style="margin-top:.75rem"></textarea>');
  root.appendChild(ui);
  const draw = () => {
    const f = Jot.$('#file', ui).files[0]; if (!f) return;
    Jot._loadImg(f, img => {
      const c = Jot.$('#c', ui); c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d');
      const blur = Jot.$('#blur', ui).value, br = Jot.$('#br', ui).value;
      ctx.filter = 'blur(' + blur + 'px) brightness(' + (br / 100).toFixed(2) + ')';
      ctx.drawImage(img, 0, 0);
      Jot.$('#out', ui).value = 'filter: blur(' + blur + 'px) brightness(' + (br / 100).toFixed(2) + ');';
    });
  };
  Jot.$('#file', ui).onchange = draw;
  Jot.$('#blur', ui).oninput = draw; Jot.$('#br', ui).oninput = draw;
};

JotTools['css-text-shadow'] = function (root) {
  const ui = Jot.ui('<label>Text <input type="text" id="t" value="Shadow"></label><div class="row"><label>X <input type="number" id="x" value="2"></label><label>Y <input type="number" id="y" value="2"></label><label>Blur <input type="number" id="b" value="4"></label><label>Color <input type="color" id="c" value="#000000"></label></div><div id="demo" style="font-size:2rem;font-weight:700;margin:1rem 0">Shadow</div><textarea id="out" readonly rows="2"></textarea>');
  root.appendChild(ui);
  const upd = () => {
    const css = 'text-shadow: ' + Jot.$('#x', ui).value + 'px ' + Jot.$('#y', ui).value + 'px ' + Jot.$('#b', ui).value + 'px ' + Jot.$('#c', ui).value;
    Jot.$('#demo', ui).textContent = Jot.$('#t', ui).value;
    Jot.$('#demo', ui).style.cssText = 'font-size:2rem;font-weight:700;margin:1rem 0;' + css;
    Jot.$('#out', ui).value = css + ';';
  };
  Jot.$$('input', ui).forEach(el => el.oninput = upd); upd();
};

JotTools['css-spinner'] = function (root) {
  const ui = Jot.ui('<div id="spin" style="width:40px;height:40px;border:4px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin 1s linear infinite;margin:1rem 0"></div><style>@keyframes spin{to{transform:rotate(360deg)}}</style><textarea id="out" readonly rows="4"></textarea>');
  root.appendChild(ui);
  Jot.$('#out', ui).value = '.spinner { width: 40px; height: 40px; border: 4px solid #e5e7eb; border-top-color: #2563eb; border-radius: 50%; animation: spin 1s linear infinite; }\n@keyframes spin { to { transform: rotate(360deg); } }';
};

JotTools['css-glass'] = function (root) {
  const ui = Jot.ui('<label>Blur px <input type="number" id="b" value="12"></label><label>Opacity <input type="number" id="o" value="0.15" step="0.05" min="0" max="1"></label><div id="demo" style="padding:2rem;background:linear-gradient(135deg,#667eea,#764ba2);border-radius:12px;margin:1rem 0"><div id="glass" style="padding:1.5rem;border-radius:8px;color:#fff">Glass panel</div></div><textarea id="out" readonly rows="4"></textarea>');
  root.appendChild(ui);
  const upd = () => {
    const css = 'background: rgba(255,255,255,' + Jot.$('#o', ui).value + '); backdrop-filter: blur(' + Jot.$('#b', ui).value + 'px); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px;';
    Jot.$('#glass', ui).style.cssText = css + 'padding:1.5rem;color:#fff';
    Jot.$('#out', ui).value = css;
  };
  Jot.$('#b', ui).oninput = upd; Jot.$('#o', ui).oninput = upd; upd();
};

JotTools['wcag-contrast'] = function (root) {
  const ui = Jot.ui('<div class="row"><label>Foreground <input type="color" id="fg" value="#111111"></label><label>Background <input type="color" id="bg" value="#ffffff"></label></div><div class="btn-row"><button class="btn" id="go">Check</button></div><div class="output" id="out"></div>');
  root.appendChild(ui);
  const lum = hex => {
    const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  };
  Jot.$('#go', ui).onclick = () => {
    const fg = Jot.$('#fg', ui).value, bg = Jot.$('#bg', ui).value;
    const l1 = lum(fg), l2 = lum(bg);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    Jot.$('#out', ui).textContent = 'Contrast ratio: ' + ratio.toFixed(2) + ':1\nAA normal text: ' + (ratio >= 4.5 ? 'Pass' : 'Fail') + '\nAAA normal text: ' + (ratio >= 7 ? 'Pass' : 'Fail');
  };
  Jot.$('#go', ui).click();
};

JotTools['golden-ratio'] = function (root) {
  calcBtn(root, '<label>Width <input type="number" id="w" value="1000"></label><div class="btn-row"><button class="btn" id="go">Calculate</button></div><div class="output" id="out"></div>', ui => {
    const phi = (1 + Math.sqrt(5)) / 2, w = +Jot.$('#w', ui).value;
    Jot.$('#out', ui).textContent = 'Major section: ' + (w / phi).toFixed(2) + '\nMinor section: ' + (w - w / phi).toFixed(2);
  });
};

JotTools['business-card'] = function (root) {
  const ui = Jot.ui('<label>Name <input type="text" id="n" value="Jane Doe"></label><label>Title <input type="text" id="t" value="Designer"></label><label>Email <input type="email" id="e" value="jane@example.com"></label><div class="btn-row"><button class="btn" id="go">Render</button><button class="btn btn-secondary" id="dl">Download</button></div><canvas id="c" width="1050" height="600" style="max-width:100%;border:1px solid var(--border)"></canvas>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const c = Jot.$('#c', ui), ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#2563eb'; ctx.fillRect(0, 0, c.width, 8);
    ctx.fillStyle = '#111'; ctx.font = 'bold 48px sans-serif'; ctx.fillText(Jot.$('#n', ui).value, 60, 120);
    ctx.font = '32px sans-serif'; ctx.fillStyle = '#555'; ctx.fillText(Jot.$('#t', ui).value, 60, 180);
    ctx.fillText(Jot.$('#e', ui).value, 60, 260);
  };
  Jot.$('#go', ui).click();
  Jot.$('#dl', ui).onclick = () => { const a = document.createElement('a'); a.href = Jot.$('#c', ui).toDataURL('image/png'); a.download = 'business-card.png'; a.click(); };
};

JotTools['certificate-gen'] = function (root) {
  const ui = Jot.ui('<label>Recipient <input type="text" id="n" value="John Smith"></label><label>Title <input type="text" id="t" value="Certificate of Achievement"></label><div class="btn-row"><button class="btn" id="go">Render</button><button class="btn btn-secondary" id="dl">Download</button></div><canvas id="c" width="1100" height="850" style="max-width:100%;border:1px solid var(--border)"></canvas>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const c = Jot.$('#c', ui), ctx = c.getContext('2d');
    ctx.fillStyle = '#fefce8'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = '#ca8a04'; ctx.lineWidth = 8; ctx.strokeRect(30, 30, c.width - 60, c.height - 60);
    ctx.fillStyle = '#854d0e'; ctx.font = 'bold 52px serif'; ctx.textAlign = 'center';
    ctx.fillText(Jot.$('#t', ui).value, c.width / 2, 200);
    ctx.font = '40px serif'; ctx.fillStyle = '#111';
    ctx.fillText('Presented to', c.width / 2, 340);
    ctx.font = 'bold 56px serif'; ctx.fillText(Jot.$('#n', ui).value, c.width / 2, 430);
    ctx.textAlign = 'left';
  };
  Jot.$('#go', ui).click();
  Jot.$('#dl', ui).onclick = () => { const a = document.createElement('a'); a.href = Jot.$('#c', ui).toDataURL('image/png'); a.download = 'certificate.png'; a.click(); };
};

// Games / random
JotTools['wheel-spinner'] = function (root) {
  const ui = Jot.ui('<textarea id="in" rows="4" placeholder="Option 1\\nOption 2\\nOption 3"></textarea><div class="btn-row"><button class="btn" id="go">Spin</button></div><div class="output" id="out" style="font-size:1.5rem;font-weight:700;margin-top:1rem"></div>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const opts = Jot.$('#in', ui).value.split('\n').filter(Boolean);
    if (!opts.length) return;
    Jot.$('#out', ui).textContent = opts[Jot.randomInt(0, opts.length - 1)];
  };
};

JotTools['lottery-numbers'] = function (root) {
  calcBtn(root, '<label>Count <input type="number" id="n" value="6" min="1" max="10"></label><label>Max <input type="number" id="m" value="49"></label><div class="btn-row"><button class="btn" id="go">Generate</button></div><div class="output" id="out"></div>', ui => {
    const n = +Jot.$('#n', ui).value, m = +Jot.$('#m', ui).value, set = new Set();
    while (set.size < n) set.add(Jot.randomInt(1, m));
    Jot.$('#out', ui).textContent = [...set].sort((a, b) => a - b).join(', ');
  });
};

JotTools['bingo-card'] = function (root) {
  const ui = Jot.ui('<div class="btn-row"><button class="btn" id="go">Generate card</button><button class="btn btn-secondary" id="copy">Copy</button></div><textarea id="out" readonly rows="12"></textarea>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const pick = (min, max, n) => { const s = new Set(); while (s.size < n) s.add(Jot.randomInt(min, max)); return [...s].sort((a, b) => a - b); };
    const cols = [pick(1, 15, 5), pick(16, 30, 5), pick(31, 45, 4), pick(46, 60, 5), pick(61, 75, 5)];
    cols[2].splice(2, 0, 'FREE');
    const rows = [];
    for (let r = 0; r < 5; r++) rows.push(['B', 'I', 'N', 'G', 'O'].map((_, c) => cols[c][r]).join('\t'));
    Jot.$('#out', ui).value = 'B\tI\tN\tG\tO\n' + rows.join('\n');
  };
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
};

JotTools['team-generator'] = function (root) {
  const ui = Jot.ui('<textarea id="in" rows="6" placeholder="One name per line"></textarea><label>Teams <input type="number" id="t" value="2"></label><div class="btn-row"><button class="btn" id="go">Split</button></div><textarea id="out" readonly rows="8"></textarea>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const names = Jot.$('#in', ui).value.split('\n').filter(Boolean).sort(() => Math.random() - 0.5);
    const teams = Array.from({ length: +Jot.$('#t', ui).value }, () => []);
    names.forEach((n, i) => teams[i % teams.length].push(n));
    Jot.$('#out', ui).value = teams.map((t, i) => 'Team ' + (i + 1) + ':\n' + t.join('\n')).join('\n\n');
  };
};

JotTools['decision-maker'] = function (root) {
  const ui = Jot.ui('<textarea id="in" rows="4" placeholder="Pizza\\nSushi\\nTacos"></textarea><div class="btn-row"><button class="btn" id="go">Decide</button></div><div class="output" id="out"></div>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const opts = Jot.$('#in', ui).value.split('\n').filter(Boolean);
    Jot.$('#out', ui).textContent = opts.length ? 'Pick: ' + opts[Jot.randomInt(0, opts.length - 1)] : 'Add options';
  };
};

JotTools['magic-8ball'] = function (root) {
  const answers = ['Yes', 'No', 'Maybe', 'Ask again later', 'Definitely', 'Cannot predict now', 'Outlook good', 'Very doubtful'];
  const ui = Jot.ui('<input type="text" id="q" placeholder="Ask a question"><div class="btn-row"><button class="btn" id="go">Shake</button></div><div class="output" id="out"></div>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => { Jot.$('#out', ui).textContent = answers[Jot.randomInt(0, answers.length - 1)]; };
};

JotTools['rock-paper-scissors'] = function (root) {
  const ui = Jot.ui('<div class="btn-row"><button class="btn" id="r">Rock</button><button class="btn btn-secondary" id="p">Paper</button><button class="btn btn-secondary" id="s">Scissors</button></div><div class="output" id="out"></div>');
  root.appendChild(ui);
  const play = pick => {
    const opts = ['rock', 'paper', 'scissors'];
    const cpu = opts[Jot.randomInt(0, 2)];
    let result = 'Tie!';
    if (pick !== cpu) {
      const win = (pick === 'rock' && cpu === 'scissors') || (pick === 'paper' && cpu === 'rock') || (pick === 'scissors' && cpu === 'paper');
      result = win ? 'You win!' : 'You lose!';
    }
    Jot.$('#out', ui).textContent = 'You: ' + pick + ' | CPU: ' + cpu + ' — ' + result;
  };
  Jot.$('#r', ui).onclick = () => play('rock');
  Jot.$('#p', ui).onclick = () => play('paper');
  Jot.$('#s', ui).onclick = () => play('scissors');
};

JotTools['yes-no-oracle'] = function (root) {
  const ui = Jot.ui('<div class="btn-row"><button class="btn" id="go">Ask</button></div><div class="output" id="out" style="font-size:2rem;font-weight:700"></div>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => { Jot.$('#out', ui).textContent = Math.random() < 0.5 ? 'Yes' : 'No'; };
};

JotTools['bracket-generator'] = function (root) {
  const ui = Jot.ui('<textarea id="in" rows="6" placeholder="8 team names"></textarea><div class="btn-row"><button class="btn" id="go">Generate</button></div><textarea id="out" readonly rows="10"></textarea>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    let teams = Jot.$('#in', ui).value.split('\n').filter(Boolean);
    while (teams.length & (teams.length - 1)) teams.push('BYE');
    teams = teams.sort(() => Math.random() - 0.5);
    const lines = ['Round 1:'];
    for (let i = 0; i < teams.length; i += 2) lines.push('  ' + teams[i] + ' vs ' + teams[i + 1]);
    Jot.$('#out', ui).value = lines.join('\n');
  };
};

JotTools['name-combiner'] = function (root) {
  calcBtn(root, '<div class="row"><label>Name 1 <input type="text" id="a" value="Alex"></label><label>Name 2 <input type="text" id="b" value="Sam"></label></div><div class="btn-row"><button class="btn" id="go">Combine</button></div><div class="output" id="out"></div>', ui => {
    const a = Jot.$('#a', ui).value, b = Jot.$('#b', ui).value;
    const mid = Math.ceil(a.length / 2);
    Jot.$('#out', ui).textContent = [a.slice(0, mid) + b.slice(mid), b.slice(0, mid) + a.slice(mid), a.slice(0, 2) + b.slice(2)].join('\n');
  });
};

// Code generators
JotTools['json-to-ts'] = function (root) {
  taTool(root, '<textarea id="in" rows="8">{"id":1,"name":"Test","active":true}</textarea><label>Root name <input type="text" id="n" value="Root"></label><div class="btn-row"><button class="btn" id="go">Generate</button><button class="btn btn-secondary" id="copy">Copy</button></div><textarea id="out" readonly rows="10"></textarea>', ui => {
    const ts = (obj, name) => {
      if (Array.isArray(obj)) return 'type ' + name + ' = ' + ts(obj[0] || {}, name + 'Item') + '[];';
      if (obj && typeof obj === 'object') {
        const props = Object.entries(obj).map(([k, v]) => '  ' + k + ': ' + (typeof v === 'object' && v !== null ? k.charAt(0).toUpperCase() + k.slice(1) : typeof v) + ';').join('\n');
        return 'interface ' + name + ' {\n' + props + '\n}';
      }
      return typeof obj;
    };
    try { Jot.$('#out', ui).value = ts(JSON.parse(Jot.$('#in', ui).value), Jot.$('#n', ui).value); }
    catch (e) { Jot.$('#out', ui).value = e.message; }
  });
};

JotTools['json-to-go'] = function (root) {
  taTool(root, '<textarea id="in" rows="8">{"id":1,"name":"Test"}</textarea><label>Struct name <input type="text" id="n" value="Root"></label><div class="btn-row"><button class="btn" id="go">Generate</button></div><textarea id="out" readonly rows="10"></textarea>', ui => {
    try {
      const obj = JSON.parse(Jot.$('#in', ui).value);
      const goType = v => typeof v === 'number' ? (Number.isInteger(v) ? 'int' : 'float64') : typeof v === 'boolean' ? 'bool' : 'string';
      Jot.$('#out', ui).value = 'type ' + Jot.$('#n', ui).value + ' struct {\n' + Object.entries(obj).map(([k, v]) => '  ' + k.charAt(0).toUpperCase() + k.slice(1) + ' ' + goType(v) + ' `json:"' + k + '"`').join('\n') + '\n}';
    } catch (e) { Jot.$('#out', ui).value = e.message; }
  });
};

JotTools['json-to-python'] = function (root) {
  taTool(root, '<textarea id="in" rows="8">{"id":1,"name":"Test"}</textarea><label>Class name <input type="text" id="n" value="Root"></label><div class="btn-row"><button class="btn" id="go">Generate</button></div><textarea id="out" readonly rows="10"></textarea>', ui => {
    try {
      const obj = JSON.parse(Jot.$('#in', ui).value);
      const pyType = v => typeof v === 'number' ? (Number.isInteger(v) ? 'int' : 'float') : typeof v === 'boolean' ? 'bool' : 'str';
      Jot.$('#out', ui).value = 'from dataclasses import dataclass\n\n@dataclass\nclass ' + Jot.$('#n', ui).value + ':\n' + Object.entries(obj).map(([k, v]) => '    ' + k + ': ' + pyType(v)).join('\n');
    } catch (e) { Jot.$('#out', ui).value = e.message; }
  });
};

JotTools['sql-to-json'] = function (root) {
  taTool(root, '<textarea id="in" rows="6" placeholder="INSERT INTO t (a,b) VALUES (1,\'x\');"></textarea><div class="btn-row"><button class="btn" id="go">Parse</button></div><textarea id="out" readonly rows="8"></textarea>', ui => {
    const rows = [];
    const re = /VALUES\s*\(([^)]+)\)/gi;
    let m;
    const sql = Jot.$('#in', ui).value;
    const cols = ((sql.match(/\(([^)]+)\)\s*VALUES/i) || [])[1] || '').split(',').map(s => s.trim());
    while ((m = re.exec(sql))) {
      const vals = m[1].split(',').map(v => v.trim().replace(/^'|'$/g, ''));
      const row = {}; cols.forEach((c, i) => { row[c] = isNaN(vals[i]) ? vals[i] : +vals[i]; });
      rows.push(row);
    }
    Jot.$('#out', ui).value = JSON.stringify(rows, null, 2);
  });
};

JotTools['html-table-json'] = function (root) {
  taTool(root, '<textarea id="in" rows="8"><table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table></textarea><div class="btn-row"><button class="btn" id="go">Convert</button></div><textarea id="out" readonly rows="8"></textarea>', ui => {
    const doc = new DOMParser().parseFromString(Jot.$('#in', ui).value, 'text/html');
    const table = doc.querySelector('table');
    if (!table) { Jot.$('#out', ui).value = 'No table found'; return; }
    const headers = [...table.querySelectorAll('tr:first-child th, tr:first-child td')].map(c => c.textContent.trim());
    const rows = [...table.querySelectorAll('tr')].slice(1).map(tr => {
      const cells = [...tr.querySelectorAll('td, th')].map(c => c.textContent.trim());
      const o = {}; headers.forEach((h, i) => { o[h || 'col' + i] = cells[i]; }); return o;
    });
    Jot.$('#out', ui).value = JSON.stringify(rows, null, 2);
  });
};

JotTools['markdown-table'] = function (root) {
  taTool(root, '<textarea id="in" rows="4" placeholder="Name,Score\\nAlice,95\\nBob,88"></textarea><div class="btn-row"><button class="btn" id="go">Generate</button><button class="btn btn-secondary" id="copy">Copy</button></div><textarea id="out" readonly rows="8"></textarea>', ui => {
    const rows = Jot.$('#in', ui).value.trim().split('\n').map(r => r.split(',').map(c => c.trim()));
    if (!rows.length) return;
    const header = '| ' + rows[0].join(' | ') + ' |';
    const sep = '| ' + rows[0].map(() => '---').join(' | ') + ' |';
    const body = rows.slice(1).map(r => '| ' + r.join(' | ') + ' |').join('\n');
    Jot.$('#out', ui).value = [header, sep, body].filter(Boolean).join('\n');
  });
};

JotTools['lorem-json'] = function (root) {
  const ui = Jot.ui('<label>Count <input type="number" id="n" value="3"></label><div class="btn-row"><button class="btn" id="go">Generate</button><button class="btn btn-secondary" id="copy">Copy</button></div><textarea id="out" readonly rows="10"></textarea>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const arr = Array.from({ length: +Jot.$('#n', ui).value }, (_, i) => ({ id: i + 1, name: 'Item ' + (i + 1), value: Jot.randomInt(1, 100), active: Math.random() > 0.5 }));
    Jot.$('#out', ui).value = JSON.stringify(arr, null, 2);
  };
  Jot.$('#go', ui).click();
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
};

JotTools['fake-user'] = function (root) {
  const ui = Jot.ui('<label>Count <input type="number" id="n" value="3"></label><div class="btn-row"><button class="btn" id="go">Generate</button><button class="btn btn-secondary" id="copy">Copy</button></div><textarea id="out" readonly rows="12"></textarea>');
  root.appendChild(ui);
  const first = ['Alex', 'Jordan', 'Taylor', 'Casey', 'Morgan'], last = ['Smith', 'Lee', 'Brown', 'Garcia', 'Kim'];
  Jot.$('#go', ui).onclick = () => {
    const users = Array.from({ length: +Jot.$('#n', ui).value }, () => {
      const fn = first[Jot.randomInt(0, first.length - 1)], ln = last[Jot.randomInt(0, last.length - 1)];
      return { name: fn + ' ' + ln, email: fn.toLowerCase() + '.' + ln.toLowerCase() + '@example.com', id: crypto.randomUUID() };
    });
    Jot.$('#out', ui).value = JSON.stringify(users, null, 2);
  };
  Jot.$('#go', ui).click();
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
};

JotTools['nanoid-generator'] = function (root) {
  const ui = Jot.ui('<label>Count <input type="number" id="n" value="5"></label><label>Length <input type="number" id="len" value="21"></label><div class="btn-row"><button class="btn" id="go">Generate</button><button class="btn btn-secondary" id="copy">Copy</button></div><textarea id="out" readonly rows="6"></textarea>');
  root.appendChild(ui);
  const abc = '_-0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  Jot.$('#go', ui).onclick = () => {
    const gen = () => { const a = new Uint8Array(+Jot.$('#len', ui).value); crypto.getRandomValues(a); return [...a].map(b => abc[b % abc.length]).join(''); };
    Jot.$('#out', ui).value = Array.from({ length: +Jot.$('#n', ui).value }, gen).join('\n');
  };
  Jot.$('#go', ui).click();
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
};

JotTools['ulid-generator'] = function (root) {
  const ui = Jot.ui('<label>Count <input type="number" id="n" value="5"></label><div class="btn-row"><button class="btn" id="go">Generate</button><button class="btn btn-secondary" id="copy">Copy</button></div><textarea id="out" readonly rows="6"></textarea>');
  root.appendChild(ui);
  const enc = n => { const abc = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; let s = ''; while (n > 0) { s = abc[n % 32] + s; n = Math.floor(n / 32); } return s.padStart(10, '0'); };
  Jot.$('#go', ui).onclick = () => {
    const lines = Array.from({ length: +Jot.$('#n', ui).value }, () => {
      const t = enc(Date.now()), r = new Uint8Array(10); crypto.getRandomValues(r);
      const rand = [...r].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
      return (t + rand).toUpperCase().slice(0, 26);
    });
    Jot.$('#out', ui).value = lines.join('\n');
  };
  Jot.$('#go', ui).click();
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
};

JotTools['slug-bulk'] = function (root) {
  taTool(root, '<textarea id="in" rows="6" placeholder="One title per line"></textarea><div class="btn-row"><button class="btn" id="go">Slugify</button><button class="btn btn-secondary" id="copy">Copy</button></div><textarea id="out" readonly rows="6"></textarea>', ui => {
    Jot.$('#out', ui).value = Jot.$('#in', ui).value.split('\n').filter(Boolean).map(Jot.slugify).join('\n');
  });
};

JotTools['color-palette-gen'] = function (root) {
  const ui = Jot.ui('<input type="color" id="c" value="#2563eb"><div class="btn-row"><button class="btn" id="go">Generate</button></div><div class="palette" id="pal"></div><textarea id="out" readonly rows="4" style="margin-top:.75rem"></textarea>');
  root.appendChild(ui);
  const shift = (hex, deg) => {
    const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
      const d = max - min; s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (max === g) h = ((b - r) / d + 2) / 6;
      else h = ((r - g) / d + 4) / 6;
    }
    h = (h + deg / 360 + 1) % 1;
    const hue2rgb = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1/6) return p + (q - p) * 6 * t; if (t < 1/2) return q; if (t < 2/3) return p + (q - p) * (2/3 - t) * 6; return p; };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const rr = Math.round(hue2rgb(p, q, h + 1/3) * 255), gg = Math.round(hue2rgb(p, q, h) * 255), bb = Math.round(hue2rgb(p, q, h - 1/3) * 255);
    return '#' + [rr, gg, bb].map(x => x.toString(16).padStart(2, '0')).join('');
  };
  Jot.$('#go', ui).onclick = () => {
    const base = Jot.$('#c', ui).value;
    const colors = [0, 30, 60, 180, 210, 240].map(d => shift(base, d));
    Jot.$('#pal', ui).innerHTML = colors.map(c => '<span class="chip" style="background:' + c + ';padding:.5rem 1rem;color:#fff">' + c + '</span>').join('');
    Jot.$('#out', ui).value = colors.join('\n');
  };
  Jot.$('#go', ui).click();
};

JotTools['gradient-palette'] = function (root) {
  const ui = Jot.ui('<input type="color" id="a" value="#2563eb"><input type="color" id="b" value="#9333ea"><label>Stops <input type="number" id="n" value="5"></label><div class="btn-row"><button class="btn" id="go">Generate</button></div><div id="grad" style="height:60px;border-radius:8px;margin:1rem 0"></div><textarea id="out" readonly rows="3"></textarea>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const a = Jot.$('#a', ui).value, b = Jot.$('#b', ui).value, n = +Jot.$('#n', ui).value;
    const lerp = (c1, c2, t) => {
      const p = i => Math.round(parseInt(c1.slice(i, i + 2), 16) * (1 - t) + parseInt(c2.slice(i, i + 2), 16) * t);
      return '#' + [1, 3, 5].map(i => p(i).toString(16).padStart(2, '0')).join('');
    };
    const stops = Array.from({ length: n }, (_, i) => lerp(a, b, i / (n - 1)));
    Jot.$('#grad', ui).style.background = 'linear-gradient(90deg,' + stops.join(',') + ')';
    Jot.$('#out', ui).value = 'background: linear-gradient(90deg, ' + stops.join(', ') + ');';
  };
  Jot.$('#go', ui).click();
};

JotTools['favicon-from-text'] = function (root) {
  const ui = Jot.ui('<label>Text <input type="text" id="t" value="JN" maxlength="2"></label><label>BG <input type="color" id="bg" value="#2563eb"></label><label>Color <input type="color" id="fg" value="#ffffff"></label><div class="btn-row"><button class="btn" id="go">Render</button><button class="btn btn-secondary" id="dl">Download</button></div><canvas id="c" width="64" height="64" style="border:1px solid var(--border)"></canvas>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const c = Jot.$('#c', ui), ctx = c.getContext('2d');
    ctx.fillStyle = Jot.$('#bg', ui).value; ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = Jot.$('#fg', ui).value; ctx.font = 'bold 28px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(Jot.$('#t', ui).value.slice(0, 2).toUpperCase(), 32, 34);
  };
  Jot.$('#go', ui).click();
  Jot.$('#dl', ui).onclick = () => { const a = document.createElement('a'); a.href = Jot.$('#c', ui).toDataURL('image/png'); a.download = 'favicon.png'; a.click(); };
};

JotTools['invoice-number'] = function (root) {
  const ui = Jot.ui('<label>Prefix <input type="text" id="pre" value="INV-"></label><label>Start <input type="number" id="s" value="1001"></label><label>Count <input type="number" id="n" value="5"></label><div class="btn-row"><button class="btn" id="go">Generate</button><button class="btn btn-secondary" id="copy">Copy</button></div><textarea id="out" readonly rows="6"></textarea>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const pre = Jot.$('#pre', ui).value, start = +Jot.$('#s', ui).value;
    Jot.$('#out', ui).value = Array.from({ length: +Jot.$('#n', ui).value }, (_, i) => pre + String(start + i).padStart(4, '0')).join('\n');
  };
  Jot.$('#go', ui).click();
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
};

JotTools['receipt-maker'] = function (root) {
  const ui = Jot.ui('<label>From <input type="text" id="from" value="Acme Co"></label><label>To <input type="text" id="to" value="Customer"></label><label>Amount $ <input type="number" id="amt" value="99.99"></label><label>Description <input type="text" id="desc" value="Services rendered"></label><div class="btn-row"><button class="btn" id="go">Download PDF</button></div><div class="output" id="out"></div>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = async () => {
    const { PDFDocument, StandardFonts } = await Jot._pdfLib();
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([612, 792]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const lines = ['RECEIPT', 'From: ' + Jot.$('#from', ui).value, 'To: ' + Jot.$('#to', ui).value, 'Date: ' + new Date().toLocaleDateString(), '', Jot.$('#desc', ui).value, '', 'Amount: $' + (+Jot.$('#amt', ui).value).toFixed(2)];
    lines.forEach((l, i) => page.drawText(l, { x: 50, y: 720 - i * 24, size: i === 0 ? 18 : 12, font }));
    Jot.download('receipt.pdf', await pdf.save(), 'application/pdf');
    Jot.$('#out', ui).textContent = 'Receipt downloaded';
  };
};

JotTools['quote-calculator'] = function (root) {
  calcBtn(root, '<label>Hours <input type="number" id="h" value="40"></label><label>Rate $/hr <input type="number" id="r" value="75"></label><label>Expenses $ <input type="number" id="e" value="200"></label><label>Margin % <input type="number" id="m" value="15"></label><div class="btn-row"><button class="btn" id="go">Calculate</button></div><div class="output" id="out"></div>', ui => {
    const sub = +Jot.$('#h', ui).value * +Jot.$('#r', ui).value + +Jot.$('#e', ui).value;
    const total = sub * (1 + +Jot.$('#m', ui).value / 100);
    Jot.$('#out', ui).textContent = 'Subtotal: $' + sub.toFixed(2) + '\nQuote: $' + total.toFixed(2);
  });
};

JotTools['unit-price'] = function (root) {
  calcBtn(root, '<div class="row"><label>Price $ <input type="number" id="p1" value="4.99"></label><label>Qty <input type="number" id="q1" value="12"></label></div><div class="row"><label>Price $ <input type="number" id="p2" value="7.99"></label><label>Qty <input type="number" id="q2" value="24"></label></div><div class="btn-row"><button class="btn" id="go">Compare</button></div><div class="output" id="out"></div>', ui => {
    const u1 = +Jot.$('#p1', ui).value / +Jot.$('#q1', ui).value, u2 = +Jot.$('#p2', ui).value / +Jot.$('#q2', ui).value;
    Jot.$('#out', ui).textContent = 'Unit 1: $' + u1.toFixed(4) + '\nUnit 2: $' + u2.toFixed(4) + '\nBest: Option ' + (u1 <= u2 ? '1' : '2');
  });
};

JotTools['markup-calculator'] = function (root) {
  calcBtn(root, '<label>Cost $ <input type="number" id="c" value="50"></label><label>Markup % <input type="number" id="m" value="40"></label><div class="btn-row"><button class="btn" id="go">Calculate</button></div><div class="output" id="out"></div>', ui => {
    const cost = +Jot.$('#c', ui).value, price = cost * (1 + +Jot.$('#m', ui).value / 100);
    Jot.$('#out', ui).textContent = 'Selling price: $' + price.toFixed(2) + '\nProfit: $' + (price - cost).toFixed(2);
  });
};

JotTools['vat-calculator'] = function (root) {
  const ui = Jot.ui('<label>Amount <input type="number" id="amt" value="100"></label><label>VAT % <input type="number" id="v" value="20"></label><div class="btn-row"><button class="btn" id="add">Add VAT</button><button class="btn btn-secondary" id="rem">Remove VAT</button></div><div class="output" id="out"></div>');
  root.appendChild(ui);
  Jot.$('#add', ui).onclick = () => {
    const amt = +Jot.$('#amt', ui).value, vat = amt * (+Jot.$('#v', ui).value / 100);
    Jot.$('#out', ui).textContent = 'Inc VAT: ' + (amt + vat).toFixed(2) + ' (VAT: ' + vat.toFixed(2) + ')';
  };
  Jot.$('#rem', ui).onclick = () => {
    const amt = +Jot.$('#amt', ui).value, net = amt / (1 + +Jot.$('#v', ui).value / 100);
    Jot.$('#out', ui).textContent = 'Ex VAT: ' + net.toFixed(2) + ' (VAT: ' + (amt - net).toFixed(2) + ')';
  };
  Jot.$('#add', ui).click();
};

JotTools['currency-format'] = function (root) {
  calcBtn(root, '<label>Amount <input type="number" id="amt" value="1234.56"></label><label>Locale <input type="text" id="loc" value="en-US"></label><label>Currency <input type="text" id="cur" value="USD"></label><div class="btn-row"><button class="btn" id="go">Format</button></div><div class="output" id="out"></div>', ui => {
    try {
      Jot.$('#out', ui).textContent = new Intl.NumberFormat(Jot.$('#loc', ui).value, { style: 'currency', currency: Jot.$('#cur', ui).value }).format(+Jot.$('#amt', ui).value);
    } catch (e) { Jot.$('#out', ui).textContent = e.message; }
  });
};

JotTools['number-format'] = function (root) {
  calcBtn(root, '<label>Number <input type="number" id="n" value="1234567.891"></label><label>Decimals <input type="number" id="d" value="2"></label><div class="btn-row"><button class="btn" id="go">Format</button></div><div class="output" id="out"></div>', ui => {
    Jot.$('#out', ui).textContent = (+Jot.$('#n', ui).value).toLocaleString('en-US', { minimumFractionDigits: +Jot.$('#d', ui).value, maximumFractionDigits: +Jot.$('#d', ui).value });
  });
};

JotTools['binary-calculator'] = function (root) {
  calcBtn(root, '<label>A <input type="text" id="a" value="1010"></label><label>B <input type="text" id="b" value="1100"></label><label>Op <select id="op"><option value="+">+</option><option value="-">-</option></select></label><div class="btn-row"><button class="btn" id="go">Calculate</button></div><div class="output" id="out"></div>', ui => {
    const a = parseInt(Jot.$('#a', ui).value, 2), b = parseInt(Jot.$('#b', ui).value, 2);
    const r = Jot.$('#op', ui).value === '+' ? a + b : a - b;
    Jot.$('#out', ui).textContent = 'Result: ' + r.toString(2) + ' (' + r + ')';
  });
};

JotTools['hex-calculator'] = function (root) {
  calcBtn(root, '<label>A <input type="text" id="a" value="FF"></label><label>B <input type="text" id="b" value="10"></label><label>Op <select id="op"><option value="+">+</option><option value="-">-</option></select></label><div class="btn-row"><button class="btn" id="go">Calculate</button></div><div class="output" id="out"></div>', ui => {
    const a = parseInt(Jot.$('#a', ui).value, 16), b = parseInt(Jot.$('#b', ui).value, 16);
    const r = Jot.$('#op', ui).value === '+' ? a + b : a - b;
    Jot.$('#out', ui).textContent = 'Result: 0x' + r.toString(16).toUpperCase() + ' (' + r + ')';
  });
};

JotTools['subnet-mask'] = function (root) {
  calcBtn(root, '<label>IP <input type="text" id="ip" value="192.168.1.10"></label><label>Mask <input type="text" id="mask" value="255.255.255.0"></label><div class="btn-row"><button class="btn" id="go">Calculate</button></div><div class="output" id="out"></div>', ui => {
    const ip = Jot.$('#ip', ui).value.split('.').map(Number);
    const mask = Jot.$('#mask', ui).value.split('.').map(Number);
    const num = ip => (ip[0] << 24) + (ip[1] << 16) + (ip[2] << 8) + ip[3];
    const fmt = n => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
    const n = num(ip) & num(mask);
    Jot.$('#out', ui).textContent = 'Network: ' + fmt(n) + '\nBroadcast: ' + fmt(n | (~num(mask) >>> 0));
  });
};

JotTools['port-lookup'] = function (root) {
  const ports = { 20: 'FTP data', 21: 'FTP', 22: 'SSH', 23: 'Telnet', 25: 'SMTP', 53: 'DNS', 80: 'HTTP', 110: 'POP3', 143: 'IMAP', 443: 'HTTPS', 3306: 'MySQL', 5432: 'PostgreSQL', 6379: 'Redis', 8080: 'HTTP alt', 27017: 'MongoDB' };
  const ui = Jot.ui('<input type="search" id="q" placeholder="Port or service"><div class="output" id="out" style="margin-top:.75rem"></div>');
  root.appendChild(ui);
  const show = () => {
    const q = Jot.$('#q', ui).value.toLowerCase();
    Jot.$('#out', ui).innerHTML = Object.entries(ports).filter(([p, s]) => !q || p.includes(q) || s.toLowerCase().includes(q)).map(([p, s]) => '<div><strong>' + p + '</strong> ' + s + '</div>').join('') || 'No match';
  };
  Jot.$('#q', ui).oninput = show; show();
};

JotTools['ascii-art-banner'] = function (root) {
  taTool(root, '<input type="text" id="in" value="HELLO"><div class="btn-row"><button class="btn" id="go">Generate</button><button class="btn btn-secondary" id="copy">Copy</button></div><textarea id="out" readonly rows="6" style="font-family:var(--mono)"></textarea>', ui => {
    const t = Jot.$('#in', ui).value.toUpperCase();
    const banner = t.split('').map(c => c === ' ' ? '     ' : ' ' + c + ' ').join('');
    Jot.$('#out', ui).value = '# ' + banner + '\n# ' + '='.repeat(banner.length) + '\n# ' + t;
  });
};

JotTools['figlet-text'] = function (root) {
  taTool(root, '<input type="text" id="in" value="Hi"><div class="btn-row"><button class="btn" id="go">Generate</button><button class="btn btn-secondary" id="copy">Copy</button></div><textarea id="out" readonly rows="8" style="font-family:var(--mono);font-size:.7rem"></textarea>', ui => {
    const map = { H: ['#   #', '#   #', '#####', '#   #', '#   #'], i: [' ### ', '  #  ', '  #  ', '  #  ', ' ### '], '!': ['  #  ', '  #  ', '  #  ', '     ', '  #  '] };
    const lines = ['', '', '', '', ''];
    [...Jot.$('#in', ui).value].forEach(ch => {
      const art = map[ch] || map[ch.toUpperCase()] || [' ' + ch + ' ', '     ', '     ', '     ', '     '];
      art.forEach((l, i) => { lines[i] += l + '  '; });
    });
    Jot.$('#out', ui).value = lines.join('\n');
  });
};

JotTools['dot-matrix'] = function (root) {
  taTool(root, '<input type="text" id="in" value="ON"><div class="btn-row"><button class="btn" id="go">Render</button><button class="btn btn-secondary" id="copy">Copy</button></div><textarea id="out" readonly rows="8" style="font-family:var(--mono)"></textarea>', ui => {
    Jot.$('#out', ui).value = [...Jot.$('#in', ui).value.toUpperCase()].map(c => {
      const on = c !== ' ';
      return on ? '█▀█\n█▀█\n▀ ▀' : '   \n   \n   ';
    }).join(' ');
  });
};

JotTools['encrypt-text'] = function (root) {
  const ui = Jot.ui('<textarea id="in" rows="4" placeholder="Secret message"></textarea><label>Passphrase <input type="password" id="pw"></label><div class="btn-row"><button class="btn" id="enc">Encrypt</button><button class="btn btn-secondary" id="dec">Decrypt</button><button class="btn btn-secondary" id="copy">Copy</button></div><textarea id="out" readonly rows="4"></textarea>');
  root.appendChild(ui);
  const derive = async pw => crypto.subtle.importKey('raw', await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pw)), 'AES-GCM', false, ['encrypt', 'decrypt']);
  Jot.$('#enc', ui).onclick = async () => {
    const key = await derive(Jot.$('#pw', ui).value);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(Jot.$('#in', ui).value));
    Jot.$('#out', ui).value = btoa(String.fromCharCode(...iv, ...new Uint8Array(ct)));
  };
  Jot.$('#dec', ui).onclick = async () => {
    try {
      const raw = Uint8Array.from(atob(Jot.$('#out', ui).value || Jot.$('#in', ui).value), c => c.charCodeAt(0));
      const key = await derive(Jot.$('#pw', ui).value);
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.slice(0, 12) }, key, raw.slice(12));
      Jot.$('#out', ui).value = new TextDecoder().decode(pt);
    } catch (e) { Jot.$('#out', ui).value = 'Decrypt failed: ' + e.message; }
  };
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
};

JotTools['hash-compare'] = function (root) {
  const ui = Jot.ui('<textarea id="a" rows="2" placeholder="Hash 1"></textarea><textarea id="b" rows="2" placeholder="Hash 2"></textarea><div class="btn-row"><button class="btn" id="go">Compare</button></div><div class="output" id="out"></div>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const a = Jot.$('#a', ui).value.trim().toLowerCase(), b = Jot.$('#b', ui).value.trim().toLowerCase();
    Jot.$('#out', ui).textContent = a === b ? 'Hashes match' : 'Hashes do NOT match';
  };
};

JotTools['password-leak'] = function (root) {
  const ui = Jot.ui('<label>Password <input type="password" id="pw"></label><div class="btn-row"><button class="btn" id="go">Check (k-anonymity)</button></div><div class="output" id="out">Uses Have I Been Pwned range API — only first 5 hash chars sent.</div>');
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = async () => {
    const pw = Jot.$('#pw', ui).value;
    if (!pw) return;
    try {
      const hash = await Jot.hash('SHA-1', pw);
      const prefix = hash.slice(0, 5).toUpperCase(), suffix = hash.slice(5).toUpperCase();
      const res = await fetch('https://api.pwnedpasswords.com/range/' + prefix);
      const text = await res.text();
      const line = text.split('\n').find(l => l.startsWith(suffix));
      const count = line ? +line.split(':')[1] : 0;
      Jot.$('#out', ui).textContent = count ? 'Found in ' + count.toLocaleString() + ' breaches — change this password!' : 'Not found in known breaches';
    } catch (e) { Jot.$('#out', ui).textContent = 'Check failed: ' + e.message; }
  };
};
