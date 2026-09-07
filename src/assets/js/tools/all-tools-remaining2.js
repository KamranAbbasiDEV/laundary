
JotTools['billionaire-sim'] = function (root) {
  const fortunes = [['Elon Musk', 250e9], ['Jeff Bezos', 200e9], ['Bill Gates', 130e9]];
  const ui = Jot.ui(`<select id="who">${fortunes.map(f=>`<option value="${f[1]}">${f[0]}</option>`).join('')}</select>
    <div class="row"><label>Spend per second $<input type="number" id="rate" value="1000"></label></div>
    <div class="btn-row"><button class="btn" id="go">Simulate</button></div><div class="output" id="out"></div>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const wealth = +Jot.$('#who', ui).value, rate = +Jot.$('#rate', ui).value;
    const secs = wealth / rate, days = secs / 86400, years = days / 365;
    Jot.$('#out', ui).textContent = `At $${rate.toLocaleString()}/sec, spending ${fortunes.find(f=>f[1]==wealth)[0]}'s fortune takes:\n${days.toFixed(0)} days (${years.toFixed(1)} years)`;
  };
};

JotTools['knot-guide'] = function (root) {
  const ui = Jot.ui(`<select id="knot"><option value="reef">Reef Knot</option><option value="bowline">Bowline</option><option value="clove">Clove Hitch</option></select>
    <svg id="svg" width="100%" height="180" viewBox="0 0 200 180" style="background:var(--surface-2);border-radius:8px;margin:1rem 0"></svg>
    <p id="desc" class="output"></p>`);
  root.appendChild(ui);
  const guides = {
    reef: { d: 'M40,90 Q100,40 160,90 Q100,140 40,90', desc: 'Reef: right over left, left over right. Good for joining two ropes of equal size.' },
    bowline: { d: 'M60,120 Q60,60 100,60 Q140,60 140,100 L100,140 L80,100 Q60,100 60,120', desc: 'Bowline: forms a fixed loop. Classic rescue and sailing knot.' },
    clove: { d: 'M50,140 L50,40 L100,70 L150,40 L150,140', desc: 'Clove hitch: quick attachment to a post or carabiner.' }
  };
  function show() {
    const k = guides[Jot.$('#knot', ui).value];
    Jot.$('#svg', ui).innerHTML = `<path d="${k.d}" fill="none" stroke="#22d3ee" stroke-width="4"/>`;
    Jot.$('#desc', ui).textContent = k.desc;
  }
  Jot.$('#knot', ui).onchange = show; show();
};

JotTools['business-names'] = function (root) {
  const ui = Jot.ui(`<input type="text" id="kw" placeholder="Keyword e.g. cloud"><div class="btn-row"><button class="btn" id="go">Generate Names</button></div><div class="output" id="out"></div>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const k = Jot.$('#kw', ui).value || 'tech';
    const pre = ['Neo','Hyper','Meta','Swift','Bright','Core','Peak','True'];
    const suf = ['ly','ify','hub','base','flow','stack','zone','nexus'];
    const names = [];
    for (let i = 0; i < 20; i++) names.push(pre[i%pre.length] + k + suf[i%suf.length]);
    Jot.$('#out', ui).textContent = names.join('\n');
  };
};

JotTools['salary-calculator'] = function (root) {
  const ui = Jot.ui(`<div class="row"><label>Target net $<input type="number" id="net" value="5000"></label><label>Tax rate %<input type="number" id="tax" value="25"></label></div>
    <div class="btn-row"><button class="btn" id="go">Calculate Gross</button></div><div class="output" id="out"></div>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const net = +Jot.$('#net', ui).value, tax = +Jot.$('#tax', ui).value / 100;
    const gross = net / (1 - tax);
    Jot.$('#out', ui).textContent = `Required gross: $${gross.toFixed(2)}/mo ($${(gross*12).toFixed(0)}/yr)`;
  };
};

JotTools['bond-yield'] = function (root) {
  const ui = Jot.ui(`<div class="row"><label>Face value $<input type="number" id="face" value="1000"></label><label>Price $<input type="number" id="price" value="950"></label>
    <label>Coupon %<input type="number" id="coupon" value="5" step="0.1"></label><label>Years<input type="number" id="yrs" value="10"></label></div>
    <div class="btn-row"><button class="btn" id="go">Calculate YTM</button></div><div class="output" id="out"></div>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const F=+Jot.$('#face',ui).value, P=+Jot.$('#price',ui).value, c=+Jot.$('#coupon',ui).value/100, n=+Jot.$('#yrs',ui).value;
    const ytm = ((c * F + (F - P) / n) / ((F + P) / 2)) * 100;
    Jot.$('#out', ui).textContent = `Approx YTM: ${ytm.toFixed(2)}%`;
  };
};

JotTools['dividend-tax'] = function (root) {
  const ui = Jot.ui(`<div class="row"><label>Dividend $<input type="number" id="div" value="1000"></label><label>Tax rate %<input type="number" id="tax" value="15"></label></div>
    <div class="btn-row"><button class="btn" id="go">Calculate</button></div><div class="output" id="out"></div>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const d=+Jot.$('#div',ui).value, t=+Jot.$('#tax',ui).value/100;
    Jot.$('#out', ui).textContent = `After tax: $${(d*(1-t)).toFixed(2)} (tax: $${(d*t).toFixed(2)})\nYield kept: ${((1-t)*100).toFixed(1)}%`;
  };
};

JotTools['physics-solver'] = function (root) {
  const ui = Jot.ui(`<select id="mode"><option value="v">Find velocity (d/t)</option><option value="d">Find distance (v*t)</option><option value="t">Find time (d/v)</option></select>
    <div class="row"><label>v (m/s)<input type="number" id="v" value="10"></label><label>d (m)<input type="number" id="d" value="100"></label><label>t (s)<input type="number" id="t" value="10"></label></div>
    <div class="btn-row"><button class="btn" id="go">Solve</button></div><div class="output" id="out"></div>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const v=+Jot.$('#v',ui).value, d=+Jot.$('#d',ui).value, t=+Jot.$('#t',ui).value;
    const m = Jot.$('#mode', ui).value;
    if (m==='v') Jot.$('#out', ui).textContent = `v = ${(d/t).toFixed(2)} m/s`;
    if (m==='d') Jot.$('#out', ui).textContent = `d = ${(v*t).toFixed(2)} m`;
    if (m==='t') Jot.$('#out', ui).textContent = `t = ${(d/v).toFixed(2)} s`;
  };
};

JotTools['anagram-solver'] = function (root) {
  const ui = Jot.ui(`<input type="text" id="in" placeholder="listen" maxlength="8"><div class="btn-row"><button class="btn" id="go">Find Anagrams</button></div><div class="output" id="out"></div>`);
  root.appendChild(ui);
  const dict = ['listen','silent','enlist','inlets','tinsel','rat','tar','art','eat','tea','ate','cat','act','stop','pots','tops','opt','pot','top'];
  Jot.$('#go', ui).onclick = () => {
    const w = Jot.$('#in', ui).value.toLowerCase().split('').sort().join('');
    const found = dict.filter(d => d.split('').sort().join('') === w && d !== Jot.$('#in', ui).value.toLowerCase());
    Jot.$('#out', ui).textContent = found.length ? found.join(', ') : 'No matches in dictionary (max 8 chars). Try: listen, stop, cat';
  };
};

JotTools['font-pairing'] = function (root) {
  const pairs = [['Georgia','Arial'],['Impact','Helvetica'],['Courier New','Verdana'],['Times New Roman','Tahoma']];
  const ui = Jot.ui(`<select id="pair">${pairs.map((p,i)=>`<option value="${i}">${p[0]} + ${p[1]}</option>`).join('')}</select>
    <div id="prev" style="margin:1rem 0;padding:1.5rem;background:#fff;color:#111;border-radius:8px"></div>`);
  root.appendChild(ui);
  function show() {
    const [h,b] = pairs[+Jot.$('#pair', ui).value];
    Jot.$('#prev', ui).innerHTML = `<div style="font-family:${h};font-size:2rem;font-weight:700">Heading Sample</div><div style="font-family:${b};font-size:1rem;margin-top:.5rem">Body text preview for JotNexus typography pairing tool.</div>`;
  }
  Jot.$('#pair', ui).onchange = show; show();
};

JotTools['font-subset'] = function (root) {
  const ui = Jot.ui(`<input type="file" id="file" accept=".woff,.woff2,.ttf,.otf"><textarea id="txt" rows="3">The quick brown fox jumps over the lazy dog.</textarea>
    <div id="prev" style="font-size:24px;margin:1rem 0;padding:1rem;background:var(--surface-2);border-radius:8px"></div>`);
  root.appendChild(ui);
  Jot.$('#file', ui).onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const url = URL.createObjectURL(f);
    Jot.$('#prev', ui).style.fontFamily = 'CustomFont';
    let st = document.getElementById('jot-font-style');
    if (!st) { st = document.createElement('style'); st.id = 'jot-font-style'; document.head.appendChild(st); }
    st.textContent = `@font-face{font-family:CustomFont;src:url('${url}')}`;
    Jot.$('#prev', ui).textContent = Jot.$('#txt', ui).value;
  };
  Jot.$('#txt', ui).oninput = () => Jot.$('#prev', ui).textContent = Jot.$('#txt', ui).value;
};

JotTools['matrix-solver'] = function (root) {
  const ui = Jot.ui(`<p>Enter 2x2 or 3x3 matrix (space-separated rows):</p>
    <textarea id="in" rows="4">3 8\n4 6</textarea><div class="btn-row"><button class="btn" id="go">Determinant</button></div><div class="output" id="out"></div>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    try {
      const m = Jot.$('#in', ui).value.trim().split(/\n/).map(r => r.trim().split(/\s+/).map(Number));
      Jot.$('#out', ui).textContent = `Determinant: ${Jot.det(m)}`;
    } catch (e) { Jot.$('#out', ui).textContent = e.message; }
  };
};

JotTools['storage-converter'] = function (root) {
  const ui = Jot.ui(`<div class="row"><label>Value<input type="number" id="val" value="1"></label>
    <label>From<select id="from"><option value="0">Bytes</option><option value="1" selected>KB</option><option value="2">MB</option><option value="3">GB</option><option value="4">TB</option></select></label></div>
    <div class="btn-row"><button class="btn" id="go">Convert All</button></div><div class="output" id="out"></div>`);
  root.appendChild(ui);
  const units = ['Bytes','KB','MB','GB','TB'];
  Jot.$('#go', ui).onclick = () => {
    const bytes = +Jot.$('#val', ui).value * Math.pow(1024, +Jot.$('#from', ui).value);
    Jot.$('#out', ui).textContent = units.map((u,i) => `${u}: ${(bytes / Math.pow(1024, i)).toFixed(4)}`).join('\n');
  };
  Jot.$('#go', ui).click();
};

JotTools['gps-converter'] = function (root) {
  const ui = Jot.ui(`<div class="tabs"><button class="tab active" data-m="dms">DMS to Decimal</button><button class="tab" data-m="dec">Decimal to DMS</button></div>
    <div id="panel-dms"><div class="row"><label>Deg<input type="number" id="dg" value="40"></label><label>Min<input type="number" id="mn" value="26"></label><label>Sec<input type="number" id="sc" value="46"></label>
    <label>Dir<select id="dir"><option>N</option><option>S</option><option>E</option><option>W</option></select></label></div></div>
    <div id="panel-dec" class="hidden"><input type="number" id="dec" value="40.446111" step="any"></div>
    <div class="btn-row"><button class="btn" id="go">Convert</button></div><div class="output" id="out"></div>`);
  root.appendChild(ui);
  let mode = 'dms';
  Jot.$$('.tab', ui).forEach(t => t.onclick = () => { mode = t.dataset.m; Jot.$$('.tab',ui).forEach(x=>x.classList.remove('active')); t.classList.add('active');
    Jot.$('#panel-dms', ui).classList.toggle('hidden', mode!=='dms'); Jot.$('#panel-dec', ui).classList.toggle('hidden', mode!=='dec'); });
  Jot.$('#go', ui).onclick = () => {
    if (mode === 'dms') {
      let dec = +Jot.$('#dg',ui).value + +Jot.$('#mn',ui).value/60 + +Jot.$('#sc',ui).value/3600;
      if (['S','W'].includes(Jot.$('#dir',ui).value)) dec *= -1;
      Jot.$('#out', ui).textContent = dec.toFixed(6);
    } else {
      let dec = +Jot.$('#dec', ui).value, sign = dec < 0 ? -1 : 1;
      dec = Math.abs(dec);
      const dg = Math.floor(dec), mn = Math.floor((dec-dg)*60), sc = ((dec-dg)*60-mn)*60;
      Jot.$('#out', ui).textContent = `${sign<0?'-':''}${dg}d ${mn}m ${sc.toFixed(2)}s`;
    }
  };
};

JotTools['graph-paper'] = function (root) {
  const ui = Jot.ui(`<div class="row"><label>Spacing px<input type="number" id="sp" value="20"></label><label>Size px<input type="number" id="sz" value="400"></label></div>
    <div class="btn-row"><button class="btn" id="go">Generate</button><button class="btn btn-secondary" id="dl">Download PNG</button></div><canvas id="cv"></canvas>`);
  root.appendChild(ui);
  function draw() {
    const sp=+Jot.$('#sp',ui).value, sz=+Jot.$('#sz',ui).value, cv=Jot.$('#cv',ui), ctx=cv.getContext('2d');
    cv.width=cv.height=sz; ctx.fillStyle='#fff'; ctx.fillRect(0,0,sz,sz); ctx.strokeStyle='#ccc';
    for (let i=0;i<=sz;i+=sp) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,sz); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(sz,i); ctx.stroke(); }
  }
  Jot.$('#go', ui).onclick = draw;
  Jot.$('#dl', ui).onclick = () => { draw(); const a=document.createElement('a'); a.download='graph-paper.png'; a.href=Jot.$('#cv',ui).toDataURL(); a.click(); };
  draw();
};

JotTools['quote-card'] = function (root) {
  const ui = Jot.ui(`<textarea id="q" rows="3">The best time to plant a tree was 20 years ago. The second best time is now.</textarea>
    <div class="row"><label>BG<input type="color" id="bg" value="#6366f1"></label><label>Text<input type="color" id="fg" value="#ffffff"></label></div>
    <div class="btn-row"><button class="btn" id="go">Render</button><button class="btn btn-secondary" id="dl">Download</button></div><canvas id="cv" width="600" height="400" style="max-width:100%"></canvas>`);
  root.appendChild(ui);
  function draw() {
    const cv=Jot.$('#cv',ui), ctx=cv.getContext('2d');
    ctx.fillStyle=Jot.$('#bg',ui).value; ctx.fillRect(0,0,600,400);
    ctx.fillStyle=Jot.$('#fg',ui).value; ctx.font='24px Georgia'; ctx.textAlign='center';
    wrapText(ctx, Jot.$('#q',ui).value, 300, 200, 520, 32);
  }
  function wrapText(ctx, text, x, y, max, lh) {
    const words = text.split(' '); let line = '', ly = y - 20;
    words.forEach(w => { const t = line + w + ' '; if (ctx.measureText(t).width > max && line) { ctx.fillText(line, x, ly); line = w + ' '; ly += lh; } else line = t; });
    ctx.fillText(line, x, ly);
  }
  Jot.$('#go', ui).onclick = draw;
  Jot.$('#dl', ui).onclick = () => { draw(); const a=document.createElement('a'); a.download='quote.png'; a.href=Jot.$('#cv',ui).toDataURL(); a.click(); };
  draw();
};

JotTools['emoji-picker'] = function (root) {
  const emojis = ['😀','😂','🥰','😎','🤔','👍','🎉','🔥','💡','✅','❤️','⭐','🚀','💻','📝','🎯','💰','🛠️','🌐','📱','🎨','🔒','⚡','🏆'];
  const ui = Jot.ui(`<input type="search" id="q" placeholder="Search…"><div class="palette" id="grid"></div>`);
  root.appendChild(ui);
  function render() {
    const q = Jot.$('#q', ui).value;
    Jot.$('#grid', ui).innerHTML = emojis.filter(e => !q).map(e => `<span class="chip" style="font-size:1.5rem;cursor:pointer">${e}</span>`).join('');
    Jot.$$('#grid .chip', ui).forEach(c => c.onclick = () => Jot.copy(c.textContent));
  }
  render();
};

JotTools['file-identify'] = function (root) {
  const sigs = [[0x89,0x50,'PNG'],[0xFF,0xD8,'JPEG'],[0x47,0x49,'GIF'],[0x25,0x50,'PDF'],[0x50,0x4B,'ZIP'],[0x52,0x61,'RAR/WebP?']];
  const ui = Jot.ui(`<input type="file" id="file"><div class="output" id="out"></div>`);
  root.appendChild(ui);
  Jot.$('#file', ui).onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      const b = new Uint8Array(r.result);
      const hex = [...b.slice(0,8)].map(x=>x.toString(16).padStart(2,'0')).join(' ');
      let type = 'Unknown';
      for (const [a,b2,name] of sigs) if (b[0]===a && b[1]===b2) type = name;
      Jot.$('#out', ui).textContent = `File: ${f.name}\nMIME: ${f.type||'unknown'}\nMagic: ${hex}\nDetected: ${type}`;
    };
    r.readAsArrayBuffer(f);
  };
};

JotTools['webhook-tester'] = function (root) {
  const ui = Jot.ui(`<textarea id="json" rows="8">{"event":"test","user_id":123,"timestamp":"2026-01-01"}</textarea>
    <div class="btn-row"><button class="btn" id="validate">Validate JSON</button><button class="btn btn-secondary" id="curl">Copy as cURL</button></div>
    <input type="text" id="url" placeholder="Webhook URL (optional)" value="https://webhook.site/your-id">
    <div class="btn-row"><button class="btn btn-secondary" id="send">Send POST</button></div><pre class="output" id="out"></pre>`);
  root.appendChild(ui);
  Jot.$('#validate', ui).onclick = () => { try { JSON.parse(Jot.$('#json',ui).value); Jot.$('#out',ui).textContent='Valid JSON'; } catch(e){ Jot.$('#out',ui).textContent=e.message; } };
  Jot.$('#curl', ui).onclick = () => {
    const j = Jot.$('#json',ui).value.replace(/'/g,"'\\''");
    Jot.copy(`curl -X POST '${Jot.$('#url',ui).value}' -H 'Content-Type: application/json' -d '${j}'`);
  };
  Jot.$('#send', ui).onclick = async () => {
    try {
      const r = await fetch(Jot.$('#url',ui).value, { method:'POST', headers:{'Content-Type':'application/json'}, body: Jot.$('#json',ui).value });
      Jot.$('#out', ui).textContent = `Status: ${r.status}\n${await r.text()}`;
    } catch(e) { Jot.$('#out', ui).textContent = 'Send failed (CORS may block): ' + e.message; }
  };
};

JotTools['responsive-preview'] = function (root) {
  const ui = Jot.ui(`<input type="file" id="file" accept="image/*"><div class="row" id="frames"></div>`);
  root.appendChild(ui);
  const widths = [320, 768, 1024, 1440];
  Jot.$('#file', ui).onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const url = URL.createObjectURL(f);
    Jot.$('#frames', ui).innerHTML = widths.map(w =>
      `<div style="margin-bottom:1rem"><label>${w}px</label><div style="width:${Math.min(w,100)}%;max-width:${w}px;border:1px solid var(--border);overflow:hidden;border-radius:8px"><img src="${url}" style="width:100%"></div></div>`).join('');
  };
};

JotTools['youtube-transcript'] = function (root) {
  const ui = Jot.ui(`<input type="text" id="vid" placeholder="YouTube video ID or URL"><div class="btn-row"><button class="btn" id="go">Fetch Transcript</button></div>
    <textarea id="out" readonly rows="12"></textarea><p class="success-msg">Fetches public captions when available via YouTube timedtext API.</p>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = async () => {
    let id = Jot.$('#vid', ui).value.trim();
    const m = id.match(/(?:v=|youtu\.be\/)([\w-]{11})/); if (m) id = m[1];
    Jot.$('#out', ui).value = 'Loading…';
    try {
      const r = await fetch(`https://www.youtube.com/api/timedtext?v=${id}&lang=en`);
      const xml = await r.text();
      if (!xml || xml.includes('error')) throw new Error('No captions found');
      const texts = [...xml.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map(m => m[1].replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"'));
      Jot.$('#out', ui).value = texts.join(' ');
    } catch (e) { Jot.$('#out', ui).value = 'Could not fetch transcript. Video may have no captions, or browser blocked the request.\n\nTip: Copy captions manually from YouTube > ... > Show transcript.'; }
  };
};

JotTools['gif-splitter'] = function (root) {
  const ui = Jot.ui(`<input type="file" id="file" accept="image/gif"><div id="frames" class="palette"></div>
    <p class="success-msg">Shows GIF preview. For multi-frame GIFs, displays animated preview (full frame extraction requires server-side processing).</p>`);
  root.appendChild(ui);
  Jot.$('#file', ui).onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const url = URL.createObjectURL(f);
    Jot.$('#frames', ui).innerHTML = `<img src="${url}" style="max-width:100%;border-radius:8px"><br><a class="btn btn-secondary" href="${url}" download="animation.gif">Download GIF</a>`;
  };
};

JotTools['zip-packer'] = function (root) {
  const ui = Jot.ui(`<input type="file" id="file" multiple><div class="btn-row"><button class="btn" id="go">Create ZIP</button></div><div id="out" class="output"></div>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = async () => {
    const files = Jot.$('#file', ui).files;
    if (!files.length) return;
    Jot.$('#out', ui).textContent = 'Creating zip…';
    await Jot.loadScript('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js');
    const zip = new JSZip();
    for (const f of files) zip.file(f.name, f);
    const blob = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'archive.zip'; a.click();
    Jot.$('#out', ui).textContent = `Created zip with ${files.length} file(s)`;
  };
};

JotTools['tar-unpacker'] = function (root) {
  const ui = Jot.ui(`<input type="file" id="file" accept=".gz,.gzip"><div class="btn-row"><button class="btn" id="go">Decompress GZIP</button></div><div class="output" id="out"></div>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = async () => {
    const f = Jot.$('#file', ui).files[0]; if (!f) return;
    await Jot.loadScript('https://cdn.jsdelivr.net/npm/pako@2.1.0/dist/pako.min.js');
    const buf = new Uint8Array(await f.arrayBuffer());
    try {
      const out = pako.ungzip(buf);
      Jot.download('decompressed.bin', out, 'application/octet-stream');
      Jot.$('#out', ui).textContent = `Decompressed ${out.length} bytes`;
    } catch (e) { Jot.$('#out', ui).textContent = 'GZIP decompress failed: ' + e.message; }
  };
};

JotTools['pdf-splitter'] = function (root) {
  const ui = Jot.ui(`<input type="file" id="file" accept="application/pdf"><div class="row"><label>Page #<input type="number" id="pg" value="1" min="1"></label></div>
    <div class="btn-row"><button class="btn" id="go">Extract Page</button></div><div class="output" id="out"></div>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = async () => {
    const f = Jot.$('#file', ui).files[0]; if (!f) return;
    Jot.$('#out', ui).textContent = 'Processing…';
    await Jot.loadScript('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js');
    const { PDFDocument } = PDFLib;
    const src = await PDFDocument.load(await f.arrayBuffer());
    const pg = +Jot.$('#pg', ui).value - 1;
    if (pg < 0 || pg >= src.getPageCount()) { Jot.$('#out', ui).textContent = 'Invalid page number'; return; }
    const newPdf = await PDFDocument.create();
    const [page] = await newPdf.copyPages(src, [pg]);
    newPdf.addPage(page);
    const bytes = await newPdf.save();
    Jot.download('page.pdf', bytes, 'application/pdf');
    Jot.$('#out', ui).textContent = `Extracted page ${pg+1} of ${src.getPageCount()}`;
  };
};

JotTools['soundboard'] = function (root) {
  const ui = Jot.ui(`<input type="file" id="file" accept="audio/*"><p>Press keys 1-9 to play loaded clips (load one file mapped to all keys for demo).</p><div class="output" id="out">Load an audio file…</div>`);
  root.appendChild(ui);
  let audio;
  Jot.$('#file', ui).onchange = e => {
    audio = new Audio(URL.createObjectURL(e.target.files[0]));
    Jot.$('#out', ui).textContent = 'Loaded! Press 1-9 to play.';
  };
  window.addEventListener('keydown', e => {
    if (audio && e.key >= '1' && e.key <= '9') { audio.currentTime = 0; audio.play(); }
  });
};
