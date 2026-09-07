
JotTools['diff-checker'] = function (root) {
  const ui = Jot.ui(`<div class="row"><label>Text A<textarea id="a" rows="8"></textarea></label><label>Text B<textarea id="b" rows="8"></textarea></label></div>
    <div class="btn-row"><button class="btn" id="go">Compare</button></div><div class="output" id="out"></div>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const a = Jot.$('#a', ui).value.split('\n'), b = Jot.$('#b', ui).value.split('\n');
    const max = Math.max(a.length, b.length);
    let html = '';
    for (let i = 0; i < max; i++) {
      const la = a[i] ?? '', lb = b[i] ?? '';
      if (la === lb) html += `<div>${la || ' '}</div>`;
      else html += `<div><span class="diff-del">${la}</span> → <span class="diff-add">${lb}</span></div>`;
    }
    Jot.$('#out', ui).innerHTML = html;
  };
};

JotTools['epoch-converter'] = function (root) {
  const ui = Jot.ui(`<div class="row"><label>Unix timestamp<input type="number" id="epoch" placeholder="1700000000"></label></div>
    <div class="btn-row"><button class="btn" id="toDate">Timestamp → Date</button><button class="btn btn-secondary" id="toEpoch">Now → Timestamp</button></div>
    <div class="row"><label>Date/time<input type="datetime-local" id="dt"></label></div>
    <div class="btn-row"><button class="btn btn-secondary" id="fromDate">Date → Timestamp</button></div>
    <div class="output" id="out"></div>`);
  root.appendChild(ui);
  Jot.$('#toDate', ui).onclick = () => {
    const n = +Jot.$('#epoch', ui).value;
    Jot.$('#out', ui).textContent = isNaN(n) ? 'Invalid' : new Date(n * (n < 1e12 ? 1000 : 1)).toString();
  };
  Jot.$('#toEpoch', ui).onclick = () => { Jot.$('#epoch', ui).value = Math.floor(Date.now()/1000); Jot.$('#out', ui).textContent = 'Current timestamp set.'; };
  Jot.$('#fromDate', ui).onclick = () => {
    const d = new Date(Jot.$('#dt', ui).value);
    Jot.$('#out', ui).textContent = isNaN(d) ? 'Invalid date' : Math.floor(d.getTime()/1000);
  };
};

JotTools['hash-generator'] = function (root) {
  const ui = Jot.ui(`<textarea id="in" placeholder="Text or use file below" rows="4"></textarea>
    <input type="file" id="file"><div class="btn-row"><button class="btn" id="sha256">SHA-256</button><button class="btn btn-secondary" id="sha1">SHA-1</button></div>
    <div class="output" id="out"></div>`);
  root.appendChild(ui);
  async function run(algo) {
    const f = Jot.$('#file', ui).files[0];
    if (f) Jot.$('#out', ui).textContent = await Jot.hashFile(algo, await f.arrayBuffer());
    else Jot.$('#out', ui).textContent = await Jot.hash(algo, Jot.$('#in', ui).value);
  }
  Jot.$('#sha256', ui).onclick = () => run('SHA-256');
  Jot.$('#sha1', ui).onclick = () => run('SHA-1');
};

JotTools['regex-tester'] = function (root) {
  const ui = Jot.ui(`<input type="text" id="pat" placeholder="Pattern (without slashes)" value="\\w+">
    <input type="text" id="flags" placeholder="Flags" value="g" style="max-width:100px">
    <textarea id="text" rows="6" placeholder="Test string…">Hello world 123</textarea>
    <div id="err" class="error"></div><div class="output" id="out"></div>`);
  root.appendChild(ui);
  function run() {
    try {
      const re = new RegExp(Jot.$('#pat', ui).value, Jot.$('#flags', ui).value);
      const t = Jot.$('#text', ui).value;
      const m = [...t.matchAll(re)];
      Jot.$('#out', ui).textContent = m.length ? m.map(x => x[0]).join('\n') : 'No matches';
      Jot.$('#err', ui).textContent = '';
    } catch (e) { Jot.$('#err', ui).textContent = e.message; }
  }
  Jot.$('#pat', ui).oninput = run; Jot.$('#flags', ui).oninput = run; Jot.$('#text', ui).oninput = run;
  run();
};

JotTools['markdown-to-html'] = function (root) {
  const ui = Jot.ui(`<textarea id="in" rows="8" placeholder="# Hello **world**"></textarea>
    <div class="btn-row"><button class="btn" id="go">Convert</button><button class="btn btn-secondary" id="copy">Copy HTML</button></div>
    <div class="preview-box" id="preview"></div><textarea id="out" readonly rows="6"></textarea>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const html = Jot.simpleMarkdown(Jot.$('#in', ui).value);
    Jot.$('#preview', ui).innerHTML = html;
    Jot.$('#out', ui).value = html;
  };
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
};

JotTools['markdown-editor'] = function (root) {
  JotTools['markdown-to-html'](root);
  const ui = root.querySelector('.tool-ui');
  Jot.$('#in', ui).oninput = () => Jot.$('#go', ui).click();
};

JotTools['cron-parser'] = function (root) {
  const ui = Jot.ui(`<input type="text" id="in" placeholder="*/15 * * * *" value="0 9 * * 1-5">
    <div class="btn-row"><button class="btn" id="go">Explain</button></div><div class="output" id="out"></div>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    try { Jot.$('#out', ui).textContent = Jot.cronExplain(Jot.$('#in', ui).value); }
    catch (e) { Jot.$('#out', ui).textContent = e.message; }
  };
  Jot.$('#go', ui).click();
};

JotTools['random-number'] = function (root) {
  const ui = Jot.ui(`<div class="row"><label>Min<input type="number" id="min" value="1"></label><label>Max<input type="number" id="max" value="100"></label></div>
    <div class="btn-row"><button class="btn" id="go">Generate</button></div><div class="output" id="out" style="font-size:2rem;text-align:center"></div>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const min = +Jot.$('#min', ui).value, max = +Jot.$('#max', ui).value;
    Jot.$('#out', ui).textContent = Jot.randomInt(Math.min(min,max), Math.max(min,max));
  };
};

JotTools['random-string'] = function (root) {
  const ui = Jot.ui(`<div class="row"><label>Length<input type="number" id="len" value="16"></label></div>
    <div class="btn-row"><button class="btn" id="go">Generate</button><button class="btn btn-secondary" id="copy">Copy</button></div><div class="output" id="out"></div>`);
  root.appendChild(ui);
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  Jot.$('#go', ui).onclick = () => {
    const n = +Jot.$('#len', ui).value || 16;
    Jot.$('#out', ui).textContent = Array.from({length:n}, () => chars[Math.floor(Math.random()*chars.length)]).join('');
  };
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).textContent, Jot.$('#copy', ui));
  Jot.$('#go', ui).click();
};

JotTools['roman-numerals'] = function (root) {
  const ui = Jot.ui(`<input type="text" id="in" placeholder="2024 or MMXXIV"><div class="btn-row">
    <button class="btn" id="toR">Number → Roman</button><button class="btn btn-secondary" id="toN">Roman → Number</button></div>
    <div class="output" id="out"></div><div id="err" class="error"></div>`);
  root.appendChild(ui);
  Jot.$('#toR', ui).onclick = () => { Jot.$('#out', ui).textContent = Jot.intToRoman(+Jot.$('#in', ui).value); };
  Jot.$('#toN', ui).onclick = () => {
    try { Jot.$('#out', ui).textContent = Jot.romanToInt(Jot.$('#in', ui).value.toUpperCase()); Jot.$('#err',ui).textContent=''; }
    catch(e){ Jot.$('#err',ui).textContent='Invalid Roman numeral'; }
  };
};

JotTools['percentage-calculator'] = function (root) {
  const ui = Jot.ui(`<div class="row"><label>Value A<input type="number" id="a" value="50"></label><label>Value B<input type="number" id="b" value="200"></label></div>
    <div class="btn-row"><button class="btn" id="go">Calculate</button></div><div class="output" id="out"></div>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const a = +Jot.$('#a', ui).value, b = +Jot.$('#b', ui).value;
    const pct = b ? ((a/b)*100).toFixed(2) : 0;
    const change = a ? (((b-a)/a)*100).toFixed(2) : 0;
    Jot.$('#out', ui).textContent = `A is ${pct}% of B\nChange from A to B: ${change}%`;
  };
  Jot.$('#go', ui).click();
};

JotTools['age-calculator'] = function (root) {
  const ui = Jot.ui(`<div class="row"><label>Birth date<input type="date" id="birth"></label></div>
    <div class="btn-row"><button class="btn" id="go">Calculate Age</button></div><div class="output" id="out"></div>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const b = new Date(Jot.$('#birth', ui).value), now = new Date();
    if (isNaN(b)) return Jot.$('#out', ui).textContent = 'Select a valid date';
    let y = now.getFullYear()-b.getFullYear(), m = now.getMonth()-b.getMonth(), d = now.getDate()-b.getDate();
    if (d<0){ m--; d+=30; } if (m<0){ y--; m+=12; }
    Jot.$('#out', ui).textContent = `${y} years, ${m} months, ${d} days`;
  };
};

JotTools['date-duration'] = function (root) {
  const ui = Jot.ui(`<div class="row"><label>Start<input type="date" id="s"></label><label>End<input type="date" id="e"></label></div>
    <div class="btn-row"><button class="btn" id="go">Calculate</button></div><div class="output" id="out"></div>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const s = new Date(Jot.$('#s', ui).value), e = new Date(Jot.$('#e', ui).value);
    const days = Math.round(Math.abs(e-s)/86400000);
    Jot.$('#out', ui).textContent = isNaN(days) ? 'Invalid dates' : `${days} days (${Math.floor(days/7)} weeks approx.)`;
  };
};

JotTools['password-strength'] = function (root) {
  const ui = Jot.ui(`<input type="text" id="in" placeholder="Enter password…"><div class="output" id="out"></div>`);
  root.appendChild(ui);
  Jot.$('#in', ui).oninput = () => {
    const r = Jot.passwordScore(Jot.$('#in', ui).value);
    Jot.$('#out', ui).textContent = `Strength: ${r.label}\nEstimated crack time: ${r.crack}`;
  };
};

JotTools['qr-code'] = function (root) {
  const ui = Jot.ui(`<input type="text" id="in" placeholder="https://jotnexus.com" value="https://jotnexus.com">
    <div class="btn-row"><button class="btn" id="go">Generate QR</button><button class="btn btn-secondary" id="dl">Download PNG</button></div>
    <canvas id="cv"></canvas>`);
  root.appendChild(ui);
  function draw() { Jot.drawQR(Jot.$('#cv', ui), Jot.$('#in', ui).value || ' '); }
  Jot.$('#go', ui).onclick = draw;
  Jot.$('#dl', ui).onclick = () => { draw(); const a=document.createElement('a'); a.download='qr.png'; a.href=Jot.$('#cv',ui).toDataURL(); a.click(); };
  draw();
};

JotTools['xml-formatter'] = function (root) {
  const ui = Jot.ui(`<textarea id="in" rows="8" placeholder="<root><item>test</item></root>"></textarea>
    <div class="btn-row"><button class="btn" id="go">Format</button><button class="btn btn-secondary" id="copy">Copy</button></div>
    <textarea id="out" readonly></textarea>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    let xml = Jot.$('#in', ui).value.replace(/>\s*</g,'>\n<').split('\n');
    let indent = 0;
    Jot.$('#out', ui).value = xml.map(line => {
      line = line.trim();
      if (line.match(/^<\//)) indent = Math.max(0, indent-1);
      const out = '  '.repeat(indent) + line;
      if (line.match(/^<[^/!?][^>]*[^/]>$/)) indent++;
      return out;
    }).join('\n');
  };
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
};

JotTools['sql-formatter'] = function (root) {
  const ui = Jot.ui(`<textarea id="in" rows="6" placeholder="SELECT * FROM users WHERE id=1"></textarea>
    <div class="btn-row"><button class="btn" id="go">Format SQL</button></div><textarea id="out" readonly></textarea>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    Jot.$('#out', ui).value = Jot.$('#in', ui).value
      .replace(/\s+/g,' ')
      .replace(/\b(SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|GROUP BY|ORDER BY|HAVING|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|AND|OR)\b/gi, '\n$1')
      .trim();
  };
};

JotTools['binary-text'] = function (root) {
  const ui = Jot.ui(`<textarea id="in" rows="4"></textarea><div class="btn-row">
    <button class="btn" id="enc">Text → Binary</button><button class="btn btn-secondary" id="dec">Binary → Text</button></div>
    <textarea id="out" readonly></textarea>`);
  root.appendChild(ui);
  Jot.$('#enc', ui).onclick = () => Jot.$('#out', ui).value = [...Jot.$('#in',ui).value].map(c=>c.charCodeAt(0).toString(2).padStart(8,'0')).join(' ');
  Jot.$('#dec', ui).onclick = () => Jot.$('#out', ui).value = Jot.$('#in',ui).value.split(/\s+/).map(b=>String.fromCharCode(parseInt(b,2)||0)).join('');
};

JotTools['base-converter'] = function (root) {
  const ui = Jot.ui(`<div class="row"><label>Decimal<input type="number" id="dec" value="255"></label></div>
    <div class="output" id="out"></div>`);
  root.appendChild(ui);
  const run = () => {
    const n = +Jot.$('#dec', ui).value;
    Jot.$('#out', ui).textContent = `Hex: ${n.toString(16).toUpperCase()}\nBinary: ${n.toString(2)}\nOctal: ${n.toString(8)}`;
  };
  Jot.$('#dec', ui).oninput = run; run();
};

JotTools['color-picker'] = function (root) {
  const ui = Jot.ui(`<input type="color" id="c" value="#6366f1"><div class="row">
    <label>Hex<input id="hex" value="#6366f1"></label></div><div class="output" id="out"></div>`);
  root.appendChild(ui);
  function sync(from) {
    let hex = from==='picker' ? Jot.$('#c',ui).value : Jot.$('#hex',ui).value;
    if (!hex.startsWith('#')) hex = '#'+hex;
    const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
    Jot.$('#c',ui).value = hex; Jot.$('#hex',ui).value = hex;
    Jot.$('#out', ui).textContent = `RGB: ${r}, ${g}, ${b}\nHSL: ${rgbToHsl(r,g,b)}`;
  }
  function rgbToHsl(r,g,b){
    r/=255;g/=255;b/=255; const max=Math.max(r,g,b), min=Math.min(r,g,b);
    let h,s,l=(max+min)/2;
    if(max===min) h=s=0; else { const d=max-min; s=l>0.5?d/(2-max-min):d/(max+min);
      switch(max){case r:h=(g-b)/d+(g<b?6:0);break;case g:h=(b-r)/d+2;break;case b:h=(r-g)/d+4;break;}
      h/=6; }
    return `${Math.round(h*360)}, ${Math.round(s*100)}%, ${Math.round(l*100)}%`;
  }
  Jot.$('#c', ui).oninput = () => sync('picker');
  Jot.$('#hex', ui).oninput = () => sync('hex');
  sync('picker');
};

JotTools['css-box-shadow'] = function (root) {
  const ui = Jot.ui(`<div class="row">
    <label>X<input type="number" id="x" value="0"></label><label>Y<input type="number" id="y" value="8"></label>
    <label>Blur<input type="number" id="blur" value="24"></label><label>Spread<input type="number" id="spread" value="0"></label>
    <label>Color<input type="color" id="color" value="#000000"></label></div>
    <div id="box" style="width:120px;height:120px;background:#6366f1;border-radius:12px;margin:1rem auto"></div>
    <div class="output" id="out"></div><button class="btn" id="copy">Copy CSS</button>`);
  root.appendChild(ui);
  function upd() {
    const css = `${Jot.$('#x',ui).value}px ${Jot.$('#y',ui).value}px ${Jot.$('#blur',ui).value}px ${Jot.$('#spread',ui).value}px ${Jot.$('#color',ui).value}88`;
    Jot.$('#box', ui).style.boxShadow = css;
    Jot.$('#out', ui).textContent = `box-shadow: ${css};`;
  }
  Jot.$$('.tool-ui input', ui).forEach(i => i.oninput = upd);
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).textContent, Jot.$('#copy', ui));
  upd();
};

JotTools['css-gradient'] = function (root) {
  const ui = Jot.ui(`<div class="row"><label>Color 1<input type="color" id="c1" value="#6366f1"></label><label>Color 2<input type="color" id="c2" value="#22d3ee"></label></div>
    <div class="row"><label>Angle<input type="number" id="ang" value="135"></label></div>
    <div id="box" style="height:100px;border-radius:12px;margin:1rem 0"></div>
    <div class="output" id="out"></div><button class="btn" id="copy">Copy CSS</button>`);
  root.appendChild(ui);
  function upd() {
    const css = `linear-gradient(${Jot.$('#ang',ui).value}deg, ${Jot.$('#c1',ui).value}, ${Jot.$('#c2',ui).value})`;
    Jot.$('#box', ui).style.background = css;
    Jot.$('#out', ui).textContent = `background: ${css};`;
  }
  Jot.$$('.tool-ui input', ui).forEach(i => i.oninput = upd);
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).textContent, Jot.$('#copy', ui));
  upd();
};

JotTools['gradient-text'] = function (root) {
  const ui = Jot.ui(`<input type="text" id="txt" value="Gradient Text"><div class="row">
    <label>C1<input type="color" id="c1" value="#6366f1"></label><label>C2<input type="color" id="c2" value="#22d3ee"></label></div>
    <div id="preview" style="font-size:2.5rem;font-weight:800;margin:1rem 0"></div>
    <div class="output" id="out"></div>`);
  root.appendChild(ui);
  function upd() {
    const css = `background: linear-gradient(90deg, ${Jot.$('#c1',ui).value}, ${Jot.$('#c2',ui).value}); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;`;
    Jot.$('#preview', ui).style = css; Jot.$('#preview', ui).textContent = Jot.$('#txt', ui).value;
    Jot.$('#out', ui).textContent = css;
  }
  Jot.$$('.tool-ui input', ui).forEach(i => i.oninput = upd); upd();
};

JotTools['pixel-to-rem'] = function (root) {
  const ui = Jot.ui(`<div class="row"><label>Pixels<input type="number" id="px" value="16"></label><label>Root font (px)<input type="number" id="root" value="16"></label></div>
    <div class="output" id="out"></div>`);
  root.appendChild(ui);
  const run = () => Jot.$('#out', ui).textContent = `${(+Jot.$('#px',ui).value / +Jot.$('#root',ui).value).toFixed(4)} rem`;
  Jot.$('#px', ui).oninput = run; Jot.$('#root', ui).oninput = run; run();
};

JotTools['aspect-ratio'] = function (root) {
  const ui = Jot.ui(`<div class="row"><label>Width<input type="number" id="w" value="1920"></label><label>Ratio W<input type="number" id="rw" value="16"></label><label>Ratio H<input type="number" id="rh" value="9"></label></div>
    <div class="btn-row"><button class="btn" id="go">Calculate Height</button></div><div class="output" id="out"></div>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const h = (+Jot.$('#w',ui).value * +Jot.$('#rh',ui).value / +Jot.$('#rw',ui).value).toFixed(2);
    Jot.$('#out', ui).textContent = `Height: ${h}px (${Jot.$('#rw',ui).value}:${Jot.$('#rh',ui).value})`;
  };
};

JotTools['typography-scale'] = function (root) {
  const ui = Jot.ui(`<div class="row"><label>Base size (px)<input type="number" id="base" value="16"></label><label>Ratio<input type="number" id="ratio" value="1.25" step="0.05"></label></div>
    <div id="scale"></div>`);
  root.appendChild(ui);
  function upd() {
    const b = +Jot.$('#base',ui).value, r = +Jot.$('#ratio',ui).value;
    let html = '';
    for (let i = -1; i <= 4; i++) {
      const s = (b * Math.pow(r, i)).toFixed(1);
      html += `<div style="font-size:${s}px;margin:.25rem 0">Heading ${i+2} — ${s}px</div>`;
    }
    Jot.$('#scale', ui).innerHTML = html;
  }
  Jot.$('#base', ui).oninput = upd; Jot.$('#ratio', ui).oninput = upd; upd();
};
