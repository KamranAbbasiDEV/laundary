window.JotTools = window.JotTools || {};

JotTools['json-formatter'] = function (root) {
  const ui = Jot.ui(`
    <textarea id="in" placeholder='Paste JSON here... {"hello":"world"}'></textarea>
    <div class="btn-row">
      <button class="btn" id="beautify">Beautify</button>
      <button class="btn btn-secondary" id="minify">Minify</button>
      <button class="btn btn-secondary" id="copy">Copy</button>
    </div>
    <div id="err" class="error"></div>
    <textarea id="out" placeholder="Output..." readonly></textarea>`);
  root.appendChild(ui);
  const inp = Jot.$('#in', ui), out = Jot.$('#out', ui), err = Jot.$('#err', ui);
  function run(mode) {
    err.textContent = '';
    try {
      out.value = mode === 'minify' ? JSON.stringify(JSON.parse(inp.value)) : Jot.formatJSON(inp.value);
    } catch (e) { err.textContent = 'Invalid JSON: ' + e.message; out.value = ''; }
  }
  Jot.$('#beautify', ui).onclick = () => run('beautify');
  Jot.$('#minify', ui).onclick = () => run('minify');
  Jot.$('#copy', ui).onclick = () => Jot.copy(out.value, Jot.$('#copy', ui));
};

JotTools['base64'] = function (root) {
  const ui = Jot.ui(`
    <textarea id="in" placeholder="Text to encode or Base64 to decode"></textarea>
    <div class="btn-row">
      <button class="btn" id="enc">Encode</button>
      <button class="btn btn-secondary" id="dec">Decode</button>
      <button class="btn btn-secondary" id="copy">Copy</button>
    </div>
    <div id="err" class="error"></div>
    <textarea id="out" readonly></textarea>`);
  root.appendChild(ui);
  const inp = Jot.$('#in', ui), out = Jot.$('#out', ui), err = Jot.$('#err', ui);
  Jot.$('#enc', ui).onclick = () => { err.textContent = ''; out.value = btoa(unescape(encodeURIComponent(inp.value))); };
  Jot.$('#dec', ui).onclick = () => {
    err.textContent = '';
    try { out.value = decodeURIComponent(escape(atob(inp.value.trim()))); }
    catch (e) { err.textContent = 'Invalid Base64'; }
  };
  Jot.$('#copy', ui).onclick = () => Jot.copy(out.value, Jot.$('#copy', ui));
};

JotTools['case-converter'] = function (root) {
  const ui = Jot.ui(`
    <textarea id="in" placeholder="Enter text..."></textarea>
    <div class="btn-row">
      <button class="btn btn-secondary" data-c="upper">UPPERCASE</button>
      <button class="btn btn-secondary" data-c="lower">lowercase</button>
      <button class="btn btn-secondary" data-c="title">Title Case</button>
      <button class="btn btn-secondary" data-c="sentence">Sentence case</button>
      <button class="btn btn-secondary" data-c="camel">camelCase</button>
      <button class="btn" id="copy">Copy</button>
    </div>
    <textarea id="out" readonly></textarea>`);
  root.appendChild(ui);
  const inp = Jot.$('#in', ui), out = Jot.$('#out', ui);
  Jot.$$('.btn[data-c]', ui).forEach(b => b.onclick = () => { out.value = Jot.caseConvert[b.dataset.c](inp.value); });
  Jot.$('#copy', ui).onclick = () => Jot.copy(out.value, Jot.$('#copy', ui));
};

JotTools['uuid-generator'] = function (root) {
  const ui = Jot.ui(`
    <div class="row">
      <label>Count <input type="number" id="count" value="1" min="1" max="500"></label>
    </div>
    <div class="btn-row"><button class="btn" id="gen">Generate UUIDs</button><button class="btn btn-secondary" id="copy">Copy All</button></div>
    <textarea id="out" readonly rows="6"></textarea>`);
  root.appendChild(ui);
  Jot.$('#gen', ui).onclick = () => {
    const n = Math.min(500, Math.max(1, +Jot.$('#count', ui).value || 1));
    Jot.$('#out', ui).value = Array.from({ length: n }, () => Jot.uuid()).join('\n');
  };
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
  Jot.$('#gen', ui).click();
};

JotTools['guid-bulk'] = JotTools['uuid-generator'];

JotTools['json-to-csv'] = function (root) {
  const ui = Jot.ui(`
    <textarea id="in" placeholder='[{"name":"Alice","age":30},{"name":"Bob","age":25}]'></textarea>
    <div class="btn-row"><button class="btn" id="go">Convert to CSV</button><button class="btn btn-secondary" id="dl">Download CSV</button></div>
    <div id="err" class="error"></div>
    <textarea id="out" readonly></textarea>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    try { Jot.$('#out', ui).value = Jot.csvFromJson(JSON.parse(Jot.$('#in', ui).value)); Jot.$('#err', ui).textContent = ''; }
    catch (e) { Jot.$('#err', ui).textContent = e.message; }
  };
  Jot.$('#dl', ui).onclick = () => Jot.download('export.csv', Jot.$('#out', ui).value, 'text/csv');
};

JotTools['csv-to-json'] = function (root) {
  const ui = Jot.ui(`
    <textarea id="in" placeholder="name,age\nAlice,30"></textarea>
    <div class="btn-row"><button class="btn" id="go">Convert to JSON</button><button class="btn btn-secondary" id="copy">Copy</button></div>
    <textarea id="out" readonly></textarea>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    Jot.$('#out', ui).value = JSON.stringify(Jot.parseCSV(Jot.$('#in', ui).value), null, 2);
  };
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
};

JotTools['jwt-decoder'] = function (root) {
  const ui = Jot.ui(`
    <textarea id="in" placeholder="Paste JWT token..."></textarea>
    <div class="btn-row"><button class="btn" id="go">Decode</button></div>
    <div id="err" class="error"></div>
    <label>Header</label><pre class="output" id="header"></pre>
    <label>Payload</label><pre class="output" id="payload"></pre>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    try {
      const d = Jot.decodeJwt(Jot.$('#in', ui).value.trim());
      Jot.$('#header', ui).textContent = JSON.stringify(d.header, null, 2);
      Jot.$('#payload', ui).textContent = JSON.stringify(d.payload, null, 2);
      Jot.$('#err', ui).textContent = '';
    } catch (e) { Jot.$('#err', ui).textContent = e.message; }
  };
};

JotTools['html-minifier'] = function (root) {
  const ui = Jot.ui(`<textarea id="in" placeholder="<div>  Hello  </div>"></textarea>
    <div class="btn-row"><button class="btn" id="go">Minify HTML</button><button class="btn btn-secondary" id="copy">Copy</button></div>
    <textarea id="out" readonly></textarea>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    Jot.$('#out', ui).value = Jot.$('#in', ui).value.replace(/<!--[\s\S]*?-->/g,'').replace(/\s+/g,' ').replace(/>\s+</g,'><').trim();
  };
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
};

JotTools['array-to-table'] = function (root) {
  const ui = Jot.ui(`<textarea id="in" placeholder='[{"a":1,"b":2}]'></textarea>
    <div class="btn-row"><button class="btn" id="go">Generate Table</button><button class="btn btn-secondary" id="copy">Copy HTML</button></div>
    <div id="err" class="error"></div><textarea id="out" readonly></textarea>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    try {
      const rows = JSON.parse(Jot.$('#in', ui).value);
      const keys = [...new Set(rows.flatMap(Object.keys))];
      let html = '<table><thead><tr>' + keys.map(k=>`<th>${k}</th>`).join('') + '</tr></thead><tbody>';
      rows.forEach(r => { html += '<tr>' + keys.map(k=>`<td>${r[k]??''}</td>`).join('') + '</tr>'; });
      Jot.$('#out', ui).value = html + '</tbody></table>';
      Jot.$('#err', ui).textContent = '';
    } catch(e) { Jot.$('#err', ui).textContent = e.message; }
  };
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
};
window.JotTools = window.JotTools || {};

JotTools['url-encoder'] = function (root) {
  const ui = Jot.ui(`<textarea id="in" placeholder="Text or encoded URL..."></textarea>
    <div class="btn-row"><button class="btn" id="enc">Encode</button><button class="btn btn-secondary" id="dec">Decode</button><button class="btn btn-secondary" id="copy">Copy</button></div>
    <textarea id="out" readonly></textarea>`);
  root.appendChild(ui);
  Jot.$('#enc', ui).onclick = () => Jot.$('#out', ui).value = encodeURIComponent(Jot.$('#in', ui).value);
  Jot.$('#dec', ui).onclick = () => { try { Jot.$('#out', ui).value = decodeURIComponent(Jot.$('#in', ui).value); } catch(e) { alert('Invalid encoding'); } };
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
};

JotTools['html-entities'] = function (root) {
  const ui = Jot.ui(`<textarea id="in"></textarea>
    <div class="btn-row"><button class="btn" id="enc">Encode</button><button class="btn btn-secondary" id="dec">Decode</button><button class="btn btn-secondary" id="copy">Copy</button></div>
    <textarea id="out" readonly></textarea>`);
  root.appendChild(ui);
  const map = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
  Jot.$('#enc', ui).onclick = () => Jot.$('#out', ui).value = Jot.$('#in', ui).value.replace(/[&<>"']/g, c => map[c]);
  Jot.$('#dec', ui).onclick = () => {
    const el = document.createElement('textarea');
    el.innerHTML = Jot.$('#in', ui).value;
    Jot.$('#out', ui).value = el.value;
  };
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
};

JotTools['slugify'] = function (root) {
  const ui = Jot.ui(`<input type="text" id="in" placeholder="My Blog Post Title!"><div class="btn-row"><button class="btn" id="go">Slugify</button><button class="btn btn-secondary" id="copy">Copy</button></div><div class="output" id="out"></div>`);
  root.appendChild(ui);
  const run = () => Jot.$('#out', ui).textContent = Jot.slugify(Jot.$('#in', ui).value);
  Jot.$('#in', ui).oninput = run;
  Jot.$('#go', ui).onclick = run;
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).textContent, Jot.$('#copy', ui));
};

JotTools['query-string'] = function (root) {
  const ui = Jot.ui(`<input type="text" id="in" placeholder="https://example.com?q=1&foo=bar"><div class="btn-row"><button class="btn" id="go">Parse</button></div><div id="table"></div>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const url = Jot.$('#in', ui).value;
    const q = url.includes('?') ? url.split('?')[1].split('#')[0] : url;
    const params = new URLSearchParams(q);
    let html = '<table><thead><tr><th>Key</th><th>Value</th></tr></thead><tbody>';
    params.forEach((v,k) => { html += `<tr><td>${k}</td><td>${v}</td></tr>`; });
    Jot.$('#table', ui).innerHTML = html + '</tbody></table>';
  };
};

JotTools['sitemap-generator'] = function (root) {
  const ui = Jot.ui(`<textarea id="in" placeholder="https://example.com/\nhttps://example.com/about" rows="8"></textarea>
    <div class="btn-row"><button class="btn" id="go">Generate sitemap.xml</button><button class="btn btn-secondary" id="dl">Download</button></div>
    <textarea id="out" readonly></textarea>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const urls = Jot.$('#in', ui).value.split(/\r?\n/).filter(Boolean);
    const body = urls.map(u => `  <url><loc>${u.trim()}</loc></url>`).join('\n');
    Jot.$('#out', ui).value = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>`;
  };
  Jot.$('#dl', ui).onclick = () => Jot.download('sitemap.xml', Jot.$('#out', ui).value, 'application/xml');
};

JotTools['og-preview'] = function (root) {
  const ui = Jot.ui(`
    <div class="row"><label>Title<input id="title" type="text" value="My Page Title"></label></div>
    <div class="row"><label>Description<textarea id="desc">Page description for social sharing.</textarea></label></div>
    <div class="row"><label>URL<input id="url" type="text" value="https://jotnexus.com"></label></div>
    <div class="row"><label>Image URL<input id="img" type="text" placeholder="https://..."></label></div>
    <h3>Preview</h3>
    <div class="preview-box" id="preview" style="max-width:500px;font-family:sans-serif"></div>`);
  root.appendChild(ui);
  function render() {
    const t = Jot.$('#title', ui).value, d = Jot.$('#desc', ui).value, u = Jot.$('#url', ui).value, img = Jot.$('#img', ui).value;
    let host = 'jotnexus.com';
    try { host = new URL(u || 'https://jotnexus.com').hostname; } catch (_) {}
    Jot.$('#preview', ui).innerHTML = `${img?`<img src="${img}" style="max-width:100%;border-radius:8px" onerror="this.style.display='none'">`:''}<div style="padding:12px;background:#f2f3f5"><div style="font-weight:700;color:#1c1e21">${t}</div><div style="color:#606770;font-size:14px;margin:4px 0">${d.slice(0,160)}</div><div style="color:#90949c;font-size:12px;text-transform:uppercase">${host}</div></div>`;
  }
  Jot.$$('.tool-ui input, .tool-ui textarea', ui).forEach(el => el.oninput = render);
  render();
};

JotTools['user-agent'] = function (root) {
  const ui = Jot.ui(`<div class="output" id="info"></div>`);
  root.appendChild(ui);
  Jot.$('#info', ui).textContent = [
    `User-Agent: ${navigator.userAgent}`,
    `Platform: ${navigator.platform}`,
    `Language: ${navigator.language}`,
    `Screen: ${screen.width}Ã-${screen.height} (${window.devicePixelRatio}x DPR)`,
    `Viewport: ${window.innerWidth}Ã-${window.innerHeight}`,
    `Cookies enabled: ${navigator.cookieEnabled}`,
    `Online: ${navigator.onLine}`
  ].join('\n');
};

JotTools['tweet-counter'] = function (root) {
  const ui = Jot.ui(`<textarea id="in" placeholder="Write your tweet..." maxlength="4000"></textarea><div class="stats"><div class="stat"><strong id="count">0</strong>characters</div><div class="stat"><strong id="remain">280</strong>remaining</div></div><div id="warn" class="error"></div>`);
  root.appendChild(ui);
  const limit = 280;
  Jot.$('#in', ui).oninput = () => {
    const n = Jot.$('#in', ui).value.length;
    Jot.$('#count', ui).textContent = n;
    Jot.$('#remain', ui).textContent = limit - n;
    Jot.$('#warn', ui).textContent = n > limit ? `Over limit by ${n - limit} characters!` : '';
  };
};

JotTools['keyword-density'] = function (root) {
  const ui = Jot.ui(`<textarea id="in" placeholder="Paste article text..." rows="8"></textarea><div class="btn-row"><button class="btn" id="go">Analyze</button></div><div id="table"></div>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const words = Jot.$('#in', ui).value.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
    const freq = {};
    words.forEach(w => freq[w] = (freq[w]||0)+1);
    const sorted = Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,20);
    let html = '<table><thead><tr><th>Word</th><th>Count</th><th>Density</th></tr></thead><tbody>';
    sorted.forEach(([w,c]) => html += `<tr><td>${w}</td><td>${c}</td><td>${((c/words.length)*100).toFixed(2)}%</td></tr>`);
    Jot.$('#table', ui).innerHTML = html + '</tbody></table>';
  };
};
window.JotTools = window.JotTools || {};

JotTools['word-counter'] = function (root) {
  const ui = Jot.ui(`<textarea id="in" placeholder="Start typing or paste text..." rows="8"></textarea>
    <div class="stats">
      <div class="stat"><strong id="words">0</strong>Words</div>
      <div class="stat"><strong id="chars">0</strong>Characters</div>
      <div class="stat"><strong id="sent">0</strong>Sentences</div>
      <div class="stat"><strong id="read">0 min</strong>Read time</div>
    </div>`);
  root.appendChild(ui);
  Jot.$('#in', ui).oninput = () => {
    const t = Jot.$('#in', ui).value;
    const words = t.trim() ? t.trim().split(/\s+/).length : 0;
    Jot.$('#words', ui).textContent = words;
    Jot.$('#chars', ui).textContent = t.length;
    Jot.$('#sent', ui).textContent = (t.match(/[.!?]+(\s|$)/g) || []).length || (t.trim()?1:0);
    Jot.$('#read', ui).textContent = Math.max(1, Math.ceil(words/200)) + ' min';
  };
};

JotTools['lorem-ipsum'] = function (root) {
  const p = `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.`;
  const ui = Jot.ui(`<div class="row"><label>Paragraphs<input type="number" id="n" value="3" min="1" max="20"></label></div>
    <div class="btn-row"><button class="btn" id="go">Generate</button><button class="btn btn-secondary" id="copy">Copy</button></div><textarea id="out" readonly rows="10"></textarea>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => Jot.$('#out', ui).value = Array.from({length:+Jot.$('#n',ui).value||3},()=>p).join('\n\n');
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
};

JotTools['mock-text'] = function (root) {
  const corp = ['Leverage synergistic paradigms','Optimize cross-functional deliverables','Drive scalable growth initiatives'];
  const ui = Jot.ui(`<div class="row"><label>Style<select id="style"><option value="corp">Corporate</option><option value="tech">Tech</option></select></label></div>
    <div class="btn-row"><button class="btn" id="go">Generate</button></div><textarea id="out" readonly></textarea>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const tech = ['Deploy the microservice mesh','Refactor the JSON pipeline','Ship the client-side WASM bundle'];
    const arr = Jot.$('#style', ui).value === 'corp' ? corp : tech;
    Jot.$('#out', ui).value = arr.sort(()=>Math.random()-.5).join('. ') + '.';
  };
};

JotTools['list-randomizer'] = function (root) {
  const ui = Jot.ui(`<textarea id="in" placeholder="One item per line" rows="8"></textarea>
    <div class="btn-row"><button class="btn" id="go">Shuffle</button><button class="btn btn-secondary" id="copy">Copy</button></div><textarea id="out" readonly></textarea>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const lines = Jot.$('#in', ui).value.split(/\r?\n/).filter(l=>l.trim());
    for (let i = lines.length - 1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [lines[i],lines[j]]=[lines[j],lines[i]]; }
    Jot.$('#out', ui).value = lines.join('\n');
  };
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
};

JotTools['list-dedupe'] = function (root) {
  const ui = Jot.ui(`<textarea id="in" rows="8"></textarea><div class="btn-row"><button class="btn" id="go">Remove Duplicates</button></div><textarea id="out" readonly></textarea>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => Jot.$('#out', ui).value = [...new Set(Jot.$('#in', ui).value.split(/\r?\n/))].join('\n');
};

JotTools['text-joiner'] = function (root) {
  const ui = Jot.ui(`<textarea id="a" placeholder="Block A" rows="4"></textarea><textarea id="b" placeholder="Block B" rows="4"></textarea>
    <label>Separator<input id="sep" value="\n---\n"></label>
    <div class="btn-row"><button class="btn" id="go">Join</button><button class="btn btn-secondary" id="copy">Copy</button></div><textarea id="out" readonly></textarea>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => Jot.$('#out', ui).value = Jot.$('#a',ui).value + Jot.$('#sep',ui).value + Jot.$('#b',ui).value;
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
};

JotTools['morse-code'] = function (root) {
  const M = {A:'.-',B:'-...',C:'-.-.',D:'-..',E:'.',F:'..-.',G:'--.',H:'....',I:'..',J:'.---',K:'-.-',L:'.-..',M:'--',N:'-.',O:'---',P:'.--.',Q:'--.-',R:'.-.',S:'...',T:'-',U:'..-',V:'...-',W:'.--',X:'-..-',Y:'-.--',Z:'--..','0':'-----','1':'.----','2':'..---','3':'...--','4':'....-','5':'.....','6':'-....','7':'--...','8':'---..','9':'----.'};
  const R = Object.fromEntries(Object.entries(M).map(([k,v])=>[v,k]));
  const ui = Jot.ui(`<textarea id="in"></textarea><div class="btn-row"><button class="btn" id="enc">To Morse</button><button class="btn btn-secondary" id="dec">From Morse</button></div><textarea id="out" readonly></textarea>`);
  root.appendChild(ui);
  Jot.$('#enc', ui).onclick = () => Jot.$('#out', ui).value = Jot.$('#in', ui).value.toUpperCase().split('').map(c=>M[c]|| (c===' '?'/':'')).join(' ');
  Jot.$('#dec', ui).onclick = () => Jot.$('#out', ui).value = Jot.$('#in', ui).value.split(' ').map(s=>R[s]|| (s==='/'?' ':'')).join('');
};

JotTools['number-to-words'] = function (root) {
  const ui = Jot.ui(`<input type="number" id="in" placeholder="1234"><div class="btn-row"><button class="btn" id="go">Convert</button></div><div class="output" id="out"></div>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => Jot.$('#out', ui).textContent = Jot.numberToWords(+Jot.$('#in', ui).value);
};

JotTools['ascii-art'] = function (root) {
  const ui = Jot.ui(`<input type="text" id="in" placeholder="HELLO" maxlength="12"><div class="btn-row"><button class="btn" id="go">Generate</button></div><pre class="output" id="out"></pre>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const t = Jot.$('#in', ui).value.toUpperCase();
    Jot.$('#out', ui).textContent = t.split('').map(c=>`  ${c}  `).join('') + '\n' + t.split('').map(()=>' === ').join('');
  };
};

JotTools['srt-shifter'] = function (root) {
  const ui = Jot.ui(`<div class="row"><label>Shift ms<input type="number" id="ms" value="1000"></label></div>
    <textarea id="in" placeholder="SRT content" rows="10"></textarea><div class="btn-row"><button class="btn" id="go">Shift Times</button><button class="btn btn-secondary" id="copy">Copy</button></div><textarea id="out" readonly></textarea>`);
  root.appendChild(ui);
  const shift = (t, ms) => t.replace(/(\d{2}):(\d{2}):(\d{2}),(\d{3})/g, (_,h,m,s,x) => {
    let total = (+h*3600+ +m*60+ +s)*1000 + +x + ms;
    if (total < 0) total = 0;
    const H = Math.floor(total/3600000); total %= 3600000;
    const M = Math.floor(total/60000); total %= 60000;
    const S = Math.floor(total/1000); const X = total % 1000;
    return `${String(H).padStart(2,'0')}:${String(M).padStart(2,'0')}:${String(S).padStart(2,'0')},${String(X).padStart(3,'0')}`;
  });
  Jot.$('#go', ui).onclick = () => Jot.$('#out', ui).value = shift(Jot.$('#in', ui).value, +Jot.$('#ms', ui).value);
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
};

JotTools['vtt-to-srt'] = function (root) {
  const ui = Jot.ui(`<textarea id="in" placeholder="WEBVTT content" rows="10"></textarea><div class="btn-row"><button class="btn" id="go">Convert to SRT</button><button class="btn btn-secondary" id="copy">Copy</button></div><textarea id="out" readonly></textarea>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    let s = Jot.$('#in', ui).value.replace(/^WEBVTT.*\n/i,'').replace(/(\d{2}:\d{2}:\d{2})\.(\d{3})/g,'$1,$2');
    const blocks = s.trim().split(/\n\n+/); let i = 1;
    Jot.$('#out', ui).value = blocks.map(b => `${i++}\n${b}`).join('\n\n');
  };
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
};

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
      else html += `<div><span class="diff-del">${la}</span> â†’ <span class="diff-add">${lb}</span></div>`;
    }
    Jot.$('#out', ui).innerHTML = html;
  };
};

JotTools['epoch-converter'] = function (root) {
  const ui = Jot.ui(`<div class="row"><label>Unix timestamp<input type="number" id="epoch" placeholder="1700000000"></label></div>
    <div class="btn-row"><button class="btn" id="toDate">Timestamp â†’ Date</button><button class="btn btn-secondary" id="toEpoch">Now â†’ Timestamp</button></div>
    <div class="row"><label>Date/time<input type="datetime-local" id="dt"></label></div>
    <div class="btn-row"><button class="btn btn-secondary" id="fromDate">Date â†’ Timestamp</button></div>
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
    try {
      const f = Jot.$('#file', ui).files[0];
      Jot.$('#out', ui).textContent = f
        ? await Jot.hashFile(algo, await f.arrayBuffer())
        : await Jot.hash(algo, Jot.$('#in', ui).value);
    } catch (e) {
      Jot.$('#out', ui).textContent = e.message;
    }
  }
  Jot.$('#sha256', ui).onclick = () => run('SHA-256');
  Jot.$('#sha1', ui).onclick = () => run('SHA-1');
};

JotTools['regex-tester'] = function (root) {
  const ui = Jot.ui(`<input type="text" id="pat" placeholder="Pattern (without slashes)" value="\\w+">
    <input type="text" id="flags" placeholder="Flags" value="g" style="max-width:100px">
    <textarea id="text" rows="6" placeholder="Test string...">Hello world 123</textarea>
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
    <button class="btn" id="toR">Number â†’ Roman</button><button class="btn btn-secondary" id="toN">Roman â†’ Number</button></div>
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
  const ui = Jot.ui(`<input type="text" id="in" placeholder="Enter password..."><div class="output" id="out"></div>`);
  root.appendChild(ui);
  Jot.$('#in', ui).oninput = () => {
    const r = Jot.passwordScore(Jot.$('#in', ui).value);
    Jot.$('#out', ui).textContent = `Strength: ${r.label}\nEstimated crack time: ${r.crack}`;
  };
};

JotTools['qr-code'] = function (root) {
  const ui = Jot.ui(`<input type="text" id="in" placeholder="https://jotnexus.com" value="https://jotnexus.com">
    <div class="btn-row"><button class="btn" id="go">Generate QR</button><button class="btn btn-secondary" id="dl">Download PNG</button></div>
    <div id="qr-wrap" style="margin:1rem 0"></div>`);
  root.appendChild(ui);
  let lastCanvas = null;
  async function draw() {
    const wrap = Jot.$('#qr-wrap', ui);
    wrap.textContent = 'Generating...';
    try {
      await Jot.loadScript('https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js');
      wrap.innerHTML = '';
      await new Promise((resolve, reject) => {
        QRCode.toCanvas(Jot.$('#in', ui).value || ' ', { width: 220, margin: 2 }, (err, canvas) => {
          if (err) reject(err);
          else { lastCanvas = canvas; wrap.appendChild(canvas); resolve(); }
        });
      });
    } catch (e) {
      wrap.textContent = '';
      const cv = document.createElement('canvas');
      wrap.appendChild(cv);
      Jot.drawQR(cv, Jot.$('#in', ui).value || ' ');
      lastCanvas = cv;
    }
  }
  Jot.$('#go', ui).onclick = draw;
  Jot.$('#dl', ui).onclick = () => {
    if (!lastCanvas) return draw().then(() => {
      if (lastCanvas) { const a = document.createElement('a'); a.download = 'qr.png'; a.href = lastCanvas.toDataURL(); a.click(); }
    });
    const a = document.createElement('a'); a.download = 'qr.png'; a.href = lastCanvas.toDataURL(); a.click();
  };
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
    <button class="btn" id="enc">Text â†’ Binary</button><button class="btn btn-secondary" id="dec">Binary â†’ Text</button></div>
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
      html += `<div style="font-size:${s}px;margin:.25rem 0">Heading ${i+2} â€” ${s}px</div>`;
    }
    Jot.$('#scale', ui).innerHTML = html;
  }
  Jot.$('#base', ui).oninput = upd; Jot.$('#ratio', ui).oninput = upd; upd();
};

JotTools['unit-converter'] = function (root) {
  const CONV = {
    'inches-cm': { factor: 2.54, op: 'mul' }, 'cm-inches': { factor: 2.54, op: 'div' },
    'feet-meters': { factor: 0.3048, op: 'mul' }, 'meters-feet': { factor: 0.3048, op: 'div' },
    'miles-km': { factor: 1.60934, op: 'mul' }, 'km-miles': { factor: 1.60934, op: 'div' },
    'lbs-kg': { factor: 0.453592, op: 'mul' }, 'kg-lbs': { factor: 0.453592, op: 'div' },
    'gallons-liters': { factor: 3.78541, op: 'mul' }, 'liters-gallons': { factor: 3.78541, op: 'div' },
    'fahrenheit-celsius': { special: 'f_to_c' }, 'celsius-fahrenheit': { special: 'c_to_f' },
    'bytes-kb': { factor: 1024, op: 'div' }, 'kb-bytes': { factor: 1024, op: 'mul' },
    'kb-mb': { factor: 1024, op: 'div' }, 'mb-kb': { factor: 1024, op: 'mul' },
    'mb-gb': { factor: 1024, op: 'div' }, 'gb-mb': { factor: 1024, op: 'mul' },
    'yards-meters': { factor: 0.9144, op: 'mul' }, 'meters-yards': { factor: 0.9144, op: 'div' },
    'oz-grams': { factor: 28.3495, op: 'mul' }, 'grams-oz': { factor: 28.3495, op: 'div' },
    'mph-kph': { factor: 1.60934, op: 'mul' }, 'kph-mph': { factor: 1.60934, op: 'div' },
    'acres-hectares': { factor: 0.404686, op: 'mul' }, 'hectares-acres': { factor: 0.404686, op: 'div' }
  };
  const from = root.dataset.from, to = root.dataset.to;
  const key = from && to ? `${from}-${to}` : null;
  const ui = Jot.ui(`<div class="row">
    ${!key ? '<label>Conversion<select id="cat"><option value="inches-cm">Inches to CM</option><option value="lbs-kg">Lbs to Kg</option><option value="fahrenheit-celsius">F to C</option><option value="km-miles">KM to Miles</option></select></label>' : ''}
    <label>Value<input type="number" id="val" value="1"></label></div>
    <div class="output" id="out" style="font-size:1.5rem;margin-top:1rem"></div>`);
  root.appendChild(ui);
  function run() {
    const k = key || Jot.$('#cat', ui)?.value || 'inches-cm';
    const conv = CONV[k];
    if (!conv) { Jot.$('#out', ui).textContent = 'Conversion not found'; return; }
    const parts = k.split('-');
    const f = from || parts[0], t2 = to || parts.slice(1).join('-');
    const v = +Jot.$('#val', ui).value;
    const r = Jot.convertUnit(v, conv);
    Jot.$('#out', ui).textContent = `${v} ${f} = ${r.toFixed(4)} ${t2}`;
  }
  Jot.$('#val', ui).oninput = run;
  if (Jot.$('#cat', ui)) Jot.$('#cat', ui).onchange = run;
  run();
};

JotTools['height-weight'] = function (root) {
  const ui = Jot.ui(`<div class="row"><label>Feet<input type="number" id="ft" value="5"></label><label>Inches<input type="number" id="in" value="10"></label></div>
    <div class="output" id="hout"></div>
    <div class="row"><label>Pounds<input type="number" id="lb" value="160"></label></div>
    <div class="output" id="wout"></div>`);
  root.appendChild(ui);
  function upd() {
    const cm = (+Jot.$('#ft',ui).value * 12 + +Jot.$('#in',ui).value) * 2.54;
    Jot.$('#hout', ui).textContent = `Height: ${cm.toFixed(1)} cm`;
    Jot.$('#wout', ui).textContent = `Weight: ${(+Jot.$('#lb',ui).value * 0.453592).toFixed(1)} kg`;
  }
  Jot.$$('.tool-ui input', ui).forEach(i => i.oninput = upd); upd();
};

JotTools['bmr-calculator'] = function (root) {
  const ui = Jot.ui(`<div class="row"><label>Sex<select id="sex"><option value="m">Male</option><option value="f">Female</option></select></label>
    <label>Age<input type="number" id="age" value="30"></label><label>Weight (kg)<input type="number" id="kg" value="70"></label><label>Height (cm)<input type="number" id="cm" value="175"></label>
    <label>Activity<select id="act"><option value="1.2">Sedentary</option><option value="1.55" selected>Moderate</option><option value="1.9">Very active</option></select></label></div>
    <div class="btn-row"><button class="btn" id="go">Calculate</button></div><div class="output" id="out"></div>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const age=+Jot.$('#age',ui).value, kg=+Jot.$('#kg',ui).value, cm=+Jot.$('#cm',ui).value;
    let bmr = Jot.$('#sex',ui).value==='m' ? 10*kg+6.25*cm-5*age+5 : 10*kg+6.25*cm-5*age-161;
    const tdee = bmr * +Jot.$('#act',ui).value;
    Jot.$('#out', ui).textContent = `BMR: ${bmr.toFixed(0)} kcal/day\nTDEE: ${tdee.toFixed(0)} kcal/day`;
  };
};

JotTools['loan-calculator'] = function (root) {
  const ui = Jot.ui(`<div class="row"><label>Loan amount<input type="number" id="p" value="200000"></label>
    <label>Annual rate %<input type="number" id="r" value="6.5" step="0.1"></label><label>Years<input type="number" id="y" value="30"></label></div>
    <div class="btn-row"><button class="btn" id="go">Calculate</button></div><div class="output" id="out"></div>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const P=+Jot.$('#p',ui).value, r=+Jot.$('#r',ui).value/100/12, n=+Jot.$('#y',ui).value*12;
    const pay = r ? P*r*Math.pow(1+r,n)/(Math.pow(1+r,n)-1) : P/n;
    Jot.$('#out', ui).textContent = `Monthly payment: $${pay.toFixed(2)}\nTotal paid: $${(pay*n).toFixed(2)}`;
  };
};

JotTools['compound-interest'] = function (root) {
  const ui = Jot.ui(`<div class="row"><label>Initial $<input type="number" id="p" value="1000"></label>
    <label>Monthly $<input type="number" id="m" value="100"></label><label>Rate %<input type="number" id="r" value="7" step="0.1"></label><label>Years<input type="number" id="y" value="10"></label></div>
    <div class="btn-row"><button class="btn" id="go">Forecast</button></div><div class="output" id="out"></div>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    let bal=+Jot.$('#p',ui).value; const m=+Jot.$('#m',ui).value, rate=+Jot.$('#r',ui).value/100/12, months=+Jot.$('#y',ui).value*12;
    for (let i=0;i<months;i++) bal = bal*(1+rate)+m;
    Jot.$('#out', ui).textContent = `Future balance: $${bal.toFixed(2)}`;
  };
};

JotTools['sales-tax'] = function (root) {
  const ui = Jot.ui(`<div class="row"><label>Amount<input type="number" id="amt" value="100"></label><label>Tax rate %<input type="number" id="tax" value="8.25" step="0.01"></label></div>
    <div class="btn-row"><button class="btn" id="add">Add tax</button><button class="btn btn-secondary" id="rem">Remove tax</button></div>
    <div class="output" id="out"></div>`);
  root.appendChild(ui);
  Jot.$('#add', ui).onclick = () => {
    const a=+Jot.$('#amt',ui).value, t=+Jot.$('#tax',ui).value/100;
    Jot.$('#out', ui).textContent = `Total with tax: $${(a*(1+t)).toFixed(2)} (tax: $${(a*t).toFixed(2)})`;
  };
  Jot.$('#rem', ui).onclick = () => {
    const a=+Jot.$('#amt',ui).value, t=+Jot.$('#tax',ui).value/100;
    Jot.$('#out', ui).textContent = `Pre-tax amount: $${(a/(1+t)).toFixed(2)}`;
  };
};

JotTools['etsy-fee'] = function (root) {
  const ui = Jot.ui(`<div class="row"><label>Sale price $<input type="number" id="price" value="35"></label><label>Shipping $<input type="number" id="ship" value="5"></label></div>
    <div class="btn-row"><button class="btn" id="go">Calculate fees</button></div><div class="output" id="out"></div>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const total = +Jot.$('#price',ui).value + +Jot.$('#ship',ui).value;
    const listing = 0.20, trans = total * 0.065, pay = total * 0.03 + 0.25;
    const fees = listing + trans + pay;
    Jot.$('#out', ui).textContent = `Total fees: $${fees.toFixed(2)}\nNet profit: $${(total - fees).toFixed(2)}`;
  };
};

JotTools['break-even'] = function (root) {
  const ui = Jot.ui(`<div class="row"><label>Fixed costs $<input type="number" id="fixed" value="5000"></label>
    <label>Price per unit $<input type="number" id="price" value="50"></label><label>Variable cost $<input type="number" id="var" value="20"></label></div>
    <div class="btn-row"><button class="btn" id="go">Calculate</button></div><div class="output" id="out"></div>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const margin = +Jot.$('#price',ui).value - +Jot.$('#var',ui).value;
    const units = margin > 0 ? Math.ceil(+Jot.$('#fixed',ui).value / margin) : Infinity;
    Jot.$('#out', ui).textContent = margin > 0 ? `Break-even: ${units} units` : 'Price must exceed variable cost';
  };
};

JotTools['meeting-cost'] = function (root) {
  const ui = Jot.ui(`<div class="row"><label>Attendees<input type="number" id="n" value="6"></label>
    <label>Avg hourly rate $<input type="number" id="rate" value="75"></label><label>Duration (min)<input type="number" id="min" value="60"></label></div>
    <div class="btn-row"><button class="btn" id="go">Calculate</button></div><div class="output" id="out"></div>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const cost = +Jot.$('#n',ui).value * +Jot.$('#rate',ui).value * (+Jot.$('#min',ui).value/60);
    Jot.$('#out', ui).textContent = `Meeting cost: $${cost.toFixed(2)}`;
  };
};

JotTools['equation-solver'] = function (root) {
  const ui = Jot.ui(`<p style="color:var(--muted);font-size:.9rem">Quadratic axÂ² + bx + c = 0</p>
    <div class="row"><label>a<input type="number" id="a" value="1"></label><label>b<input type="number" id="b" value="-3"></label><label>c<input type="number" id="c" value="2"></label></div>
    <div class="btn-row"><button class="btn" id="go">Solve</button></div><div class="output" id="out"></div>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const a=+Jot.$('#a',ui).value, b=+Jot.$('#b',ui).value, c=+Jot.$('#c',ui).value;
    const d = b*b - 4*a*c;
    if (d < 0) Jot.$('#out', ui).textContent = 'No real roots';
    else if (d === 0) Jot.$('#out', ui).textContent = `x = ${(-b/(2*a)).toFixed(4)}`;
    else Jot.$('#out', ui).textContent = `x1 = ${((-b+Math.sqrt(d))/(2*a)).toFixed(4)}\nx2 = ${((-b-Math.sqrt(d))/(2*a)).toFixed(4)}`;
  };
};

JotTools['stopwatch'] = function (root) {
  const ui = Jot.ui(`<div class="output" id="disp" style="font-size:2.5rem;font-family:var(--mono);text-align:center">00:00.00</div>
    <div class="btn-row"><button class="btn" id="start">Start</button><button class="btn btn-secondary" id="lap">Lap</button><button class="btn btn-secondary" id="reset">Reset</button></div>
    <div id="laps"></div>`);
  root.appendChild(ui);
  let start=0, elapsed=0, timer=null, running=false;
  function fmt(ms) {
    const m=Math.floor(ms/60000), s=Math.floor(ms/1000%60), x=Math.floor(ms%1000/10);
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(x).padStart(2,'0')}`;
  }
  function tick() { Jot.$('#disp',ui).textContent = fmt(elapsed + (running ? Date.now()-start : 0)); }
  Jot.$('#start', ui).onclick = () => {
    if (!running) { start=Date.now(); running=true; timer=setInterval(tick, 30); Jot.$('#start',ui).textContent='Stop'; }
    else { elapsed += Date.now()-start; running=false; clearInterval(timer); Jot.$('#start',ui).textContent='Start'; tick(); }
  };
  Jot.$('#lap', ui).onclick = () => {
    const d=document.createElement('div'); d.textContent='Lap: '+fmt(elapsed+(running?Date.now()-start:0));
    Jot.$('#laps', ui).prepend(d);
  };
  Jot.$('#reset', ui).onclick = () => { clearInterval(timer); running=false; elapsed=0; Jot.$('#disp',ui).textContent='00:00.00'; Jot.$('#laps',ui).innerHTML=''; Jot.$('#start',ui).textContent='Start'; };
};

JotTools['timezone-converter'] = function (root) {
  const zones = ['America/New_York','America/Los_Angeles','Europe/London','Europe/Paris','Asia/Tokyo','Asia/Karachi','Australia/Sydney'];
  const ui = Jot.ui(`<div class="output" id="out"></div>`);
  root.appendChild(ui);
  function upd() {
    const now = new Date();
    Jot.$('#out', ui).textContent = zones.map(z => {
      try { return `${z}: ${now.toLocaleString('en-US',{timeZone:z, hour:'2-digit', minute:'2-digit', weekday:'short'})}`; }
      catch { return z; }
    }).join('\n');
  }
  upd(); setInterval(upd, 30000);
};

JotTools['audio-generator'] = function (root) {
  const ui = Jot.ui(`<div class="row"><label>Frequency Hz<input type="number" id="freq" value="440"></label>
    <label>Wave<select id="wave"><option value="sine">Sine</option><option value="square">Square</option><option value="sawtooth">Saw</option><option value="triangle">Triangle</option></select></label></div>
    <div class="btn-row"><button class="btn" id="play">Play</button><button class="btn btn-secondary" id="stop">Stop</button></div>`);
  root.appendChild(ui);
  let ctx, osc;
  function stopOsc() {
    if (osc) { try { osc.stop(); } catch (_) {} osc.disconnect(); osc = null; }
  }
  Jot.$('#play', ui).onclick = () => {
    stopOsc();
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    osc = ctx.createOscillator();
    osc.type = Jot.$('#wave', ui).value;
    osc.frequency.value = +Jot.$('#freq', ui).value;
    osc.connect(ctx.destination); osc.start();
  };
  Jot.$('#stop', ui).onclick = stopOsc;
};

JotTools['image-compressor'] = function (root) {
  const ui = Jot.ui(`<div class="drop-zone" id="dz">Drop image or click to upload</div><input type="file" id="file" accept="image/*" hidden>
    <div class="row"><label>Quality<input type="range" id="q" min="0.1" max="1" step="0.05" value="0.8"></label></div>
    <canvas id="cv" style="display:none"></canvas><img id="prev" style="max-width:100%;margin-top:1rem"><br>
    <button class="btn" id="dl">Download</button>`);
  root.appendChild(ui);
  let imgData, loadedImg = null;
  function compress() {
    if (!loadedImg) return;
    const cv = Jot.$('#cv', ui), ctx = cv.getContext('2d');
    if (!ctx) return;
    cv.width = loadedImg.width; cv.height = loadedImg.height;
    ctx.drawImage(loadedImg, 0, 0);
    imgData = cv.toDataURL('image/jpeg', +Jot.$('#q', ui).value);
    Jot.$('#prev', ui).src = imgData;
  }
  Jot.$('#dz', ui).onclick = () => Jot.$('#file', ui).click();
  Jot.$('#file', ui).onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const img = new Image();
    img.onload = () => { loadedImg = img; compress(); };
    img.src = URL.createObjectURL(f);
  };
  Jot.$('#q', ui).oninput = compress;
  Jot.$('#dl', ui).onclick = () => { if (!imgData) return; const a=document.createElement('a'); a.download='compressed.jpg'; a.href=imgData; a.click(); };
};

JotTools['data-url'] = function (root) {
  const ui = Jot.ui(`<div class="drop-zone" id="dz">Upload image â†’ data URL</div><input type="file" id="file" accept="image/*" hidden>
    <textarea id="out" readonly rows="6"></textarea><button class="btn" id="copy">Copy</button>`);
  root.appendChild(ui);
  Jot.$('#dz', ui).onclick = () => Jot.$('#file', ui).click();
  Jot.$('#file', ui).onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => Jot.$('#out', ui).value = r.result;
    r.readAsDataURL(f);
  };
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
};

JotTools['exif-stripper'] = function (root) {
  JotTools['image-compressor'](root);
  const ui = root.querySelector('.tool-ui');
  const note = document.createElement('p');
  note.className = 'success-msg';
  note.textContent = 'Re-encoding via canvas removes most EXIF/GPS metadata.';
  ui.prepend(note);
};

JotTools['palette-picker'] = function (root) {
  const ui = Jot.ui(`<input type="file" id="file" accept="image/*"><div class="palette" id="pal"></div>`);
  root.appendChild(ui);
  Jot.$('#file', ui).onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement('canvas'), ctx = cv.getContext('2d');
      cv.width = 80; cv.height = 80;
      ctx.drawImage(img, 0, 0, 80, 80);
      const data = ctx.getImageData(0, 0, 80, 80).data;
      const freq = {};
      for (let i = 0; i < data.length; i += 16) {
        const key = `#${[data[i],data[i+1],data[i+2]].map(x=>x.toString(16).padStart(2,'0')).join('')}`;
        freq[key] = (freq[key]||0)+1;
      }
      Jot.$('#pal', ui).innerHTML = Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,8)
        .map(([c]) => `<span class="swatch" style="background:${c}" title="${c}"></span><span class="chip">${c}</span>`).join('');
    };
    img.src = URL.createObjectURL(f);
  };
};

/* === REMAINING A-Z TOOLS === */

JotTools['barcode'] = function (root) {
  const ui = Jot.ui(`<input type="text" id="in" value="JOTNEXUS123"><div class="btn-row"><button class="btn" id="go">Generate Barcode</button><button class="btn btn-secondary" id="dl">Download SVG</button></div><svg id="svg" width="100%" height="80" style="background:#fff;border-radius:8px"></svg>`);
  root.appendChild(ui);
  function draw() {
    const text = Jot.$('#in', ui).value || '0';
    const svg = Jot.$('#svg', ui);
    let x = 10, bars = '';
    for (let i = 0; i < text.length; i++) {
      const w = (text.charCodeAt(i) % 3) + 1;
      if (i % 2 === 0) bars += `<rect x="${x}" y="10" width="${w*3}" height="50" fill="#000"/>`;
      x += w * 3 + 2;
    }
    svg.innerHTML = bars + `<text x="10" y="72" font-size="10" fill="#000">${text}</text>`;
  }
  Jot.$('#go', ui).onclick = draw;
  Jot.$('#dl', ui).onclick = () => Jot.download('barcode.svg', `<svg xmlns="http://www.w3.org/2000/svg">${Jot.$('#svg',ui).innerHTML}</svg>`, 'image/svg+xml');
  draw();
};

JotTools['bip39'] = function (root) {
  const ui = Jot.ui(`<textarea id="in" rows="4" placeholder="Enter 12-24 seed words separated by spaces"></textarea>
    <div class="btn-row"><button class="btn" id="go">Validate</button></div><div id="out" class="output"></div>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const words = Jot.$('#in', ui).value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const validCounts = [12, 15, 18, 21, 24];
    if (!validCounts.includes(words.length)) {
      Jot.$('#out', ui).textContent = `Invalid word count: ${words.length}. Must be 12, 15, 18, 21, or 24.`;
      Jot.$('#out', ui).style.color = 'var(--danger)';
      return;
    }
    const bad = words.filter(w => !/^[a-z]+$/.test(w));
    if (bad.length) { Jot.$('#out', ui).textContent = 'Invalid characters in: ' + bad.join(', '); return; }
    Jot.$('#out', ui).style.color = 'var(--success)';
    Jot.$('#out', ui).textContent = `Format valid: ${words.length} words. Note: Full BIP39 checksum validation requires the complete wordlist â€” verify with your wallet before use.`;
  };
};

JotTools['currency-rates'] = function (root) {
  const ui = Jot.ui(`<div class="row"><label>Amount<input type="number" id="amt" value="100"></label>
    <label>From<select id="from"><option USD selected>USD</option><option EUR>EUR</option><option GBP>GBP</option><option PKR>PKR</option><option JPY>JPY</option></select></label>
    <label>To<select id="to"><option EUR selected>EUR</option><option USD>USD</option><option GBP>GBP</option><option PKR>PKR</option><option JPY>JPY</option></select></label></div>
    <div class="btn-row"><button class="btn" id="go">Convert</button></div><div id="out" class="output"></div><p class="success-msg">Uses free Frankfurter API for daily rates.</p>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = async () => {
    Jot.$('#out', ui).textContent = 'Loading rates...';
    try {
      const from = Jot.$('#from', ui).value, to = Jot.$('#to', ui).value, amt = +Jot.$('#amt', ui).value;
      const r = await fetch(`https://api.frankfurter.app/latest?from=${from}&to=${to}`);
      const d = await r.json();
      const rate = d.rates[to];
      Jot.$('#out', ui).textContent = `${amt} ${from} = ${(amt * rate).toFixed(2)} ${to} (rate: ${rate})`;
    } catch (e) { Jot.$('#out', ui).textContent = 'Failed to fetch rates. Try again later.'; }
  };
};

JotTools['dns-lookup'] = function (root) {
  const ui = Jot.ui(`<input type="text" id="domain" placeholder="example.com"><select id="type"><option>A</option><option>AAAA</option><option>MX</option><option>TXT</option><option>CNAME</option></select>
    <div class="btn-row"><button class="btn" id="go">Lookup</button></div><pre class="output" id="out"></pre>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = async () => {
    const name = Jot.$('#domain', ui).value.trim(), type = Jot.$('#type', ui).value;
    Jot.$('#out', ui).textContent = 'Querying...';
    try {
      const r = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`, { headers: { Accept: 'application/dns-json' } });
      const d = await r.json();
      Jot.$('#out', ui).textContent = JSON.stringify(d, null, 2);
    } catch (e) { Jot.$('#out', ui).textContent = 'Lookup failed: ' + e.message; }
  };
};

JotTools['dns-propagation'] = function (root) {
  const resolvers = [
    ['Cloudflare', 'https://cloudflare-dns.com/dns-query'],
    ['Google', 'https://dns.google/resolve'],
  ];
  const ui = Jot.ui(`<input type="text" id="domain" placeholder="example.com"><select id="type"><option>A</option><option>AAAA</option><option>MX</option><option>TXT</option></select>
    <div class="btn-row"><button class="btn" id="go">Check Propagation</button></div><pre class="output" id="out"></pre>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = async () => {
    const name = Jot.$('#domain', ui).value.trim(), type = Jot.$('#type', ui).value;
    Jot.$('#out', ui).textContent = 'Checking resolvers...';
    const results = [];
    for (const [label, base] of resolvers) {
      try {
        const url = base.includes('google') ? `${base}?name=${name}&type=${type}` : `${base}?name=${encodeURIComponent(name)}&type=${type}`;
        const r = await fetch(url, { headers: { Accept: 'application/dns-json' } });
        const d = await r.json();
        const ans = (d.Answer || d.answer || []).map(a => a.data || a).join(', ') || 'No records';
        results.push(`${label}: ${ans}`);
      } catch { results.push(`${label}: Error`); }
    }
    Jot.$('#out', ui).textContent = results.join('\n');
  };
};

JotTools['ip-lookup'] = function (root) {
  const ui = Jot.ui(`<div class="btn-row"><button class="btn" id="go">Get My IP Info</button></div><pre class="output" id="out"></pre>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = async () => {
    Jot.$('#out', ui).textContent = 'Fetching...';
    try {
      const ip = await (await fetch('https://api.ipify.org?format=json')).json();
      let geo = {};
      try { geo = await (await fetch(`https://ipapi.co/${ip.ip}/json/`)).json(); } catch {}
      Jot.$('#out', ui).textContent = JSON.stringify({ ip: ip.ip, ...geo }, null, 2);
    } catch (e) { Jot.$('#out', ui).textContent = 'Failed: ' + e.message; }
  };
  Jot.$('#go', ui).click();
};

JotTools['invoice-pdf'] = function (root) {
  const ui = Jot.ui(`<div class="row"><label>From<input id="from" value="Your Name"></label><label>To<input id="to" value="Client Name"></label></div>
    <div class="row"><label>Invoice #<input id="num" value="INV-001"></label><label>Amount $<input type="number" id="amt" value="500"></label></div>
    <textarea id="items" rows="3">Web design services</textarea>
    <div class="btn-row"><button class="btn" id="go">Generate & Print</button></div><div id="preview" class="preview-box"></div>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const html = `<h2>INVOICE ${Jot.$('#num',ui).value}</h2><p><strong>From:</strong> ${Jot.$('#from',ui).value}<br><strong>To:</strong> ${Jot.$('#to',ui).value}</p><p>${Jot.$('#items',ui).value}</p><h3>Total: $${Jot.$('#amt',ui).value}</h3>`;
    Jot.$('#preview', ui).innerHTML = html;
    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>Invoice</title></head><body>${html}<script>window.print()</script></body></html>`);
    w.document.close();
  };
};

JotTools['nginx-generator'] = function (root) {
  const ui = Jot.ui(`<div class="row"><label>Domain<input id="dom" value="jotnexus.com"></label><label>Port<input type="number" id="port" value="3000"></label></div>
    <label><input type="checkbox" id="ssl" checked> SSL (Let's Encrypt paths)</label>
    <div class="btn-row"><button class="btn" id="go">Generate</button><button class="btn btn-secondary" id="copy">Copy</button></div>
    <textarea id="out" class="output" rows="14" readonly></textarea>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const dom = Jot.$('#dom', ui).value, port = Jot.$('#port', ui).value, ssl = Jot.$('#ssl', ui).checked;
    let cfg = `server {\n    listen 80;\n    server_name ${dom} www.${dom};\n`;
    if (ssl) cfg += `    return 301 https://$host$request_uri;\n}\n\nserver {\n    listen 443 ssl http2;\n    server_name ${dom} www.${dom};\n    ssl_certificate /etc/letsencrypt/live/${dom}/fullchain.pem;\n    ssl_certificate_key /etc/letsencrypt/live/${dom}/privkey.pem;\n`;
    cfg += `    location / {\n        proxy_pass http://127.0.0.1:${port};\n        proxy_set_header Host $host;\n        proxy_set_header X-Real-IP $remote_addr;\n    }\n}`;
    Jot.$('#out', ui).value = cfg;
  };
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
  Jot.$('#go', ui).click();
};

JotTools['inline-css'] = function (root) {
  const ui = Jot.ui(`<textarea id="css" rows="4" placeholder=".title { color: red; font-size: 20px; }"></textarea>
    <textarea id="html" rows="4" placeholder='<div class="title">Hello</div>'></textarea>
    <div class="btn-row"><button class="btn" id="go">Inline CSS</button></div><textarea id="out" readonly></textarea>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const rules = {};
    Jot.$('#css', ui).value.replace(/([^{]+)\{([^}]+)\}/g, (_, sel, props) => {
      rules[sel.trim()] = props.trim().replace(/\s+/g, ' ');
    });
    let html = Jot.$('#html', ui).value;
    Object.entries(rules).forEach(([sel, props]) => {
      const cls = sel.replace('.', '');
      html = html.replace(new RegExp(`class="${cls}"`, 'g'), `style="${props}"`);
    });
    Jot.$('#out', ui).value = html;
  };
};

JotTools['js-deobfuscator'] = function (root) {
  const ui = Jot.ui(`<textarea id="in" rows="8" placeholder="Paste obfuscated JS"></textarea>
    <div class="btn-row"><button class="btn" id="go">Beautify</button></div><textarea id="out" readonly rows="8"></textarea>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    let s = Jot.$('#in', ui).value.replace(/;/g, ';\n').replace(/\{/g, '{\n').replace(/\}/g, '\n}\n');
    Jot.$('#out', ui).value = s.replace(/\n\s*\n/g, '\n').trim();
  };
};

JotTools['bcrypt-tester'] = function (root) {
  const ui = Jot.ui(`<input type="text" id="pw" placeholder="Password"><div class="btn-row"><button class="btn" id="hash">Hash (bcrypt)</button></div>
    <div class="output" id="out"></div><input type="text" id="chk" placeholder="Verify hash"><button class="btn btn-secondary" id="verify">Verify</button><div id="ver" class="output"></div>`);
  root.appendChild(ui);
  let lastHash = '';
  Jot.$('#hash', ui).onclick = async () => {
    Jot.$('#out', ui).textContent = 'Hashing...';
    await Jot.loadScript('https://cdn.jsdelivr.net/npm/bcryptjs@2.4.3/dist/bcrypt.min.js');
    if (typeof bcrypt === 'undefined') { Jot.$('#out', ui).textContent = 'bcrypt library failed to load.'; return; }
    lastHash = bcrypt.hashSync(Jot.$('#pw', ui).value, 10);
    Jot.$('#out', ui).textContent = lastHash;
  };
  Jot.$('#verify', ui).onclick = async () => {
    await Jot.loadScript('https://cdn.jsdelivr.net/npm/bcryptjs@2.4.3/dist/bcrypt.min.js');
    const ok = bcrypt.compareSync(Jot.$('#pw', ui).value, Jot.$('#chk', ui).value || lastHash);
    Jot.$('#ver', ui).textContent = ok ? 'Match!' : 'No match';
  };
};

JotTools['xor-cipher'] = function (root) {
  const ui = Jot.ui(`<input type="text" id="key" placeholder="Key" value="secret"><textarea id="in" rows="4"></textarea>
    <div class="btn-row"><button class="btn" id="enc">Encrypt</button><button class="btn btn-secondary" id="dec">Decrypt</button></div>
    <textarea id="out" readonly></textarea>`);
  root.appendChild(ui);
  const xor = (text, key, decode) => {
    const out = [];
    for (let i = 0; i < text.length; i++) {
      const c = decode ? parseInt(text.substr(i, 2), 16) : text.charCodeAt(i);
      out.push(String.fromCharCode(c ^ key.charCodeAt(i % key.length)));
      if (decode) i++;
    }
    return decode ? out.join('') : out.map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
  };
  Jot.$('#enc', ui).onclick = () => Jot.$('#out', ui).value = xor(Jot.$('#in', ui).value, Jot.$('#key', ui).value, false);
  Jot.$('#dec', ui).onclick = () => Jot.$('#out', ui).value = xor(Jot.$('#in', ui).value, Jot.$('#key', ui).value, true);
};

JotTools['xpath-tester'] = function (root) {
  const ui = Jot.ui(`<textarea id="xml" rows="6"><root><item id="1">Hello</item><item id="2">World</item></root></textarea>
    <input type="text" id="xp" value="//item" placeholder="XPath query"><div class="btn-row"><button class="btn" id="go">Evaluate</button></div>
    <pre class="output" id="out"></pre>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    try {
      const doc = new DOMParser().parseFromString(Jot.$('#xml', ui).value, 'text/xml');
      const r = doc.evaluate(Jot.$('#xp', ui).value, doc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
      const nodes = [];
      for (let i = 0; i < r.snapshotLength; i++) nodes.push(r.snapshotItem(i).textContent);
      Jot.$('#out', ui).textContent = nodes.length ? nodes.join('\n') : 'No matches';
    } catch (e) { Jot.$('#out', ui).textContent = e.message; }
  };
};

JotTools['keycode'] = function (root) {
  const ui = Jot.ui(`<p>Press any key...</p><pre class="output" id="out">Waiting...</pre>`);
  root.appendChild(ui);
  window.addEventListener('keydown', e => {
    Jot.$('#out', ui).textContent = `key: ${e.key}\ncode: ${e.code}\nkeyCode: ${e.keyCode}\nwhich: ${e.which}`;
  }, { once: false });
};

JotTools['proxy-formatter'] = function (root) {
  const ui = Jot.ui(`<textarea id="in" rows="8" placeholder="messy proxy list"></textarea><div class="btn-row"><button class="btn" id="go">Clean</button><button class="btn btn-secondary" id="copy">Copy</button></div><textarea id="out" readonly></textarea>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const lines = Jot.$('#in', ui).value.match(/\d{1,3}(?:\.\d{1,3}){3}:\d+/g) || [];
    Jot.$('#out', ui).value = [...new Set(lines)].join('\n');
  };
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
};

JotTools['link-opener'] = function (root) {
  const ui = Jot.ui(`<textarea id="in" rows="8" placeholder="One URL per line"></textarea><div class="btn-row"><button class="btn" id="go">Open All</button></div>
    <p class="success-msg">Allow popups if blocked by browser.</p>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    Jot.$('#in', ui).value.split(/\r?\n/).filter(u => u.trim()).forEach(u => window.open(u.trim(), '_blank'));
  };
};

JotTools['email-signature'] = function (root) {
  const ui = Jot.ui(`<div class="row"><label>Name<input id="n" value="Jane Doe"></label><label>Title<input id="t" value="Designer"></label></div>
    <div class="row"><label>Email<input id="e" value="jane@jotnexus.com"></label><label>Phone<input id="p" value="+1 555 0100"></label></div>
    <div class="btn-row"><button class="btn" id="go">Generate</button><button class="btn btn-secondary" id="copy">Copy HTML</button></div>
    <div id="prev" class="preview-box"></div><textarea id="out" readonly></textarea>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const html = `<table><tr><td><strong>${Jot.$('#n',ui).value}</strong><br>${Jot.$('#t',ui).value}<br><a href="mailto:${Jot.$('#e',ui).value}">${Jot.$('#e',ui).value}</a><br>${Jot.$('#p',ui).value}</td></tr></table>`;
    Jot.$('#prev', ui).innerHTML = html;
    Jot.$('#out', ui).value = html;
  };
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
  Jot.$('#go', ui).click();
};

JotTools['meta-ad-checker'] = function (root) {
  const ui = Jot.ui(`<textarea id="in" rows="4" placeholder="Primary text..."></textarea>
    <div class="stats"><div class="stat"><strong id="c">0</strong>/125 primary text</div><div class="stat"><strong id="h">0</strong>/40 headline (paste below)</div></div>
    <input type="text" id="head" placeholder="Headline"><div id="warn" class="error"></div>`);
  root.appendChild(ui);
  function chk() {
    const c = Jot.$('#in', ui).value.length, h = Jot.$('#head', ui).value.length;
    Jot.$('#c', ui).textContent = c; Jot.$('#h', ui).textContent = h;
    Jot.$('#warn', ui).textContent = (c > 125 ? 'Primary text over 125! ' : '') + (h > 40 ? 'Headline over 40!' : '');
  }
  Jot.$('#in', ui).oninput = chk; Jot.$('#head', ui).oninput = chk;
};

JotTools['ad-text-checker'] = function (root) {
  const ui = Jot.ui(`<input type="text" id="h" placeholder="Headline (max 30)"><input type="text" id="d" placeholder="Description (max 90)">
    <div class="output" id="out"></div>`);
  root.appendChild(ui);
  function chk() {
    const h = Jot.$('#h', ui).value.length, d = Jot.$('#d', ui).value.length;
    Jot.$('#out', ui).textContent = `Headline: ${h}/30 ${h>30?'OVER':''}\nDescription: ${d}/90 ${d>90?'OVER':''}`;
  }
  Jot.$('#h', ui).oninput = chk; Jot.$('#d', ui).oninput = chk;
};

JotTools['regex-cheatsheet'] = function (root) {
  const patterns = [
    ['Email', '[\\w.-]+@[\\w.-]+\\.[a-z]{2,}'],
    ['URL', 'https?:\\/\\/[\\w.-]+'],
    ['Phone US', '\\(\\d{3}\\)\\s?\\d{3}-\\d{4}'],
    ['Digits', '\\d+'],
    ['Word', '\\b\\w+\\b'],
    ['IPv4', '\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b'],
    ['Date ISO', '\\d{4}-\\d{2}-\\d{2}'],
    ['Hex color', '#[0-9a-fA-F]{6}'],
  ];
  const ui = Jot.ui(`<input type="search" id="q" placeholder="Search patterns..."><div id="list"></div>`);
  root.appendChild(ui);
  function render() {
    const q = Jot.$('#q', ui).value.toLowerCase();
    Jot.$('#list', ui).innerHTML = patterns.filter(p => p[0].toLowerCase().includes(q)).map(p =>
      `<div class="faq-item"><strong>${p[0]}</strong><code class="chip" style="cursor:pointer">${p[1]}</code></div>`).join('');
    Jot.$$('#list .chip', ui).forEach(c => c.onclick = () => Jot.copy(c.textContent));
  }
  Jot.$('#q', ui).oninput = render; render();
};

JotTools['svg-optimizer'] = function (root) {
  const ui = Jot.ui(`<textarea id="in" rows="8" placeholder="Paste SVG..."></textarea><div class="btn-row"><button class="btn" id="go">Minify</button><button class="btn btn-secondary" id="copy">Copy</button></div><textarea id="out" readonly></textarea>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    Jot.$('#out', ui).value = Jot.$('#in', ui).value.replace(/<!--[\s\S]*?-->/g,'').replace(/\s+/g,' ').replace(/>\s+</g,'><').trim();
  };
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
};

JotTools['svg-tracer'] = function (root) {
  const ui = Jot.ui(`<input type="file" id="file" accept="image/*"><div class="btn-row"><button class="btn" id="go">Wrap as SVG</button><button class="btn btn-secondary" id="copy">Copy SVG</button></div><textarea id="out" readonly></textarea>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const f = Jot.$('#file', ui).files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      Jot.$('#out', ui).value = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><image href="${r.result}" width="100%" height="100%"/></svg>`;
    };
    r.readAsDataURL(f);
  };
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
};

JotTools['favicon-generator'] = function (root) {
  const ui = Jot.ui(`<input type="file" id="file" accept="image/*"><div class="row"><label>Size<select id="sz"><option>16</option><option selected>32</option><option>48</option></select></label></div>
    <canvas id="cv"></canvas><div class="btn-row"><button class="btn" id="dl">Download PNG</button></div>`);
  root.appendChild(ui);
  Jot.$('#file', ui).onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const sz = +Jot.$('#sz', ui).value;
    const img = new Image();
    img.onload = () => {
      const cv = Jot.$('#cv', ui); cv.width = cv.height = sz;
      cv.getContext('2d').drawImage(img, 0, 0, sz, sz);
    };
    img.src = URL.createObjectURL(f);
  };
  Jot.$('#dl', ui).onclick = () => { const a = document.createElement('a'); a.download='favicon.png'; a.href=Jot.$('#cv',ui).toDataURL(); a.click(); };
};

JotTools['ase-converter'] = function (root) {
  const ui = Jot.ui(`<input type="file" id="file" accept=".ase,.aco"><div class="output" id="out">Upload ASE/ACO swatch file to extract hex colors from binary data.</div><div class="palette" id="pal"></div>`);
  root.appendChild(ui);
  Jot.$('#file', ui).onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      const bytes = new Uint8Array(r.result);
      const colors = [];
      for (let i = 0; i < bytes.length - 3; i++) {
        if (bytes[i] <= 255 && bytes[i+1] <= 255 && bytes[i+2] <= 255) {
          const hex = `#${bytes[i].toString(16).padStart(2,'0')}${bytes[i+1].toString(16).padStart(2,'0')}${bytes[i+2].toString(16).padStart(2,'0')}`;
          if (/^#[0-9a-f]{6}$/i.test(hex) && !colors.includes(hex)) colors.push(hex);
        }
      }
      Jot.$('#pal', ui).innerHTML = colors.slice(0, 24).map(c => `<span class="swatch" style="background:${c}" title="${c}"></span><span class="chip">${c}</span>`).join('');
      Jot.$('#out', ui).textContent = `Found ${colors.slice(0,24).length} color candidates`;
    };
    r.readAsArrayBuffer(f);
  };
};

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
  const emojis = ['\u{1F600}','\u{1F602}','\u{1F970}','\u{1F60E}','\u{1F914}','\u{1F44D}','\u{1F389}','\u{1F525}','\u{1F4A1}','\u{2705}','\u{2764}\u{FE0F}','\u{2B50}','\u{1F680}','\u{1F4BB}','\u{1F4DD}','\u{1F3AF}','\u{1F4B0}','\u{1F6E0}\u{FE0F}','\u{1F310}','\u{1F4F1}','\u{1F3A8}','\u{1F512}','\u{26A1}','\u{1F3C6}'];
  const ui = Jot.ui('<p style="color:var(--muted);font-size:.9rem">Click any emoji to copy.</p><div class="palette" id="grid"></div>');
  root.appendChild(ui);
  Jot.$('#grid', ui).innerHTML = emojis.map(function(e) { return '<span class="chip" style="font-size:1.5rem;cursor:pointer" title="Copy">' + e + '</span>'; }).join('');
  Jot.$$('#grid .chip', ui).forEach(function(c) { c.onclick = function() { Jot.copy(c.textContent); }; });
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
    Jot.$('#out', ui).value = 'Loading...';
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
    Jot.$('#out', ui).textContent = 'Creating zip...';
    await Jot.loadScript('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js');
    if (typeof JSZip === 'undefined') { Jot.$('#out', ui).textContent = 'JSZip failed to load.'; return; }
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
    Jot.$('#out', ui).textContent = 'Processing...';
    await Jot.loadScript('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js');
    const PDFLib = window.PDFLib;
    if (!PDFLib) { Jot.$('#out', ui).textContent = 'PDF library failed to load.'; return; }
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
  const ui = Jot.ui(`<input type="file" id="file" accept="audio/*"><p>Press keys 1-9 to play loaded clips (load one file mapped to all keys for demo).</p><div class="output" id="out">Load an audio file...</div>`);
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

JotTools['yearly-savings'] = function (root) {
  const ui = Jot.ui(`<div class="row"><label>Initial $<input type="number" id="p" value="1000"></label><label>Monthly $<input type="number" id="m" value="200"></label>
    <label>Rate %<input type="number" id="r" value="7" step="0.1"></label><label>Years<input type="number" id="y" value="10"></label></div>
    <div class="btn-row"><button class="btn" id="go">Project</button></div><div class="output" id="out"></div>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    let bal = +Jot.$('#p', ui).value;
    const m = +Jot.$('#m', ui).value, rate = +Jot.$('#r', ui).value / 100 / 12, years = +Jot.$('#y', ui).value;
    let lines = [];
    for (let y = 1; y <= years; y++) {
      for (let i = 0; i < 12; i++) bal = bal * (1 + rate) + m;
      lines.push(`Year ${y}: $${bal.toFixed(2)}`);
    }
    Jot.$('#out', ui).textContent = lines.join('\n');
  };
  Jot.$('#go', ui).click();
};

JotTools['octal-converter'] = function (root) {
  const ui = Jot.ui(`<input type="text" id="in" placeholder="Octal 377 or decimal 255"><div class="btn-row">
    <button class="btn" id="toDec">Octal to Decimal</button><button class="btn btn-secondary" id="toOct">Decimal to Octal</button></div>
    <div class="output" id="out"></div>`);
  root.appendChild(ui);
  Jot.$('#toDec', ui).onclick = () => {
    try { Jot.$('#out', ui).textContent = parseInt(Jot.$('#in', ui).value, 8).toString(10); }
    catch { Jot.$('#out', ui).textContent = 'Invalid octal'; }
  };
  Jot.$('#toOct', ui).onclick = () => {
    const n = parseInt(Jot.$('#in', ui).value, 10);
    Jot.$('#out', ui).textContent = isNaN(n) ? 'Invalid decimal' : n.toString(8);
  };
};

JotTools['password-generator'] = function (root) {
  const ui = Jot.ui(`<div class="row">
    <label>Length <input type="number" id="len" value="16" min="4" max="128"></label>
    <label><input type="checkbox" id="upper" checked> A-Z</label>
    <label><input type="checkbox" id="lower" checked> a-z</label>
    <label><input type="checkbox" id="num" checked> 0-9</label>
    <label><input type="checkbox" id="sym" checked> Symbols</label>
  </div>
  <div class="btn-row"><button class="btn" id="gen">Generate</button><button class="btn btn-secondary" id="copy">Copy</button></div>
  <textarea id="out" readonly rows="4"></textarea>`);
  root.appendChild(ui);
  function gen() {
    let chars = '';
    if (Jot.$('#upper', ui).checked) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (Jot.$('#lower', ui).checked) chars += 'abcdefghijklmnopqrstuvwxyz';
    if (Jot.$('#num', ui).checked) chars += '0123456789';
    if (Jot.$('#sym', ui).checked) chars += '!@#$%^&*()-_=+[]{}|;:,.<>?';
    if (!chars) return '';
    const len = Math.min(128, Math.max(4, +Jot.$('#len', ui).value || 16));
    const arr = new Uint32Array(len);
    crypto.getRandomValues(arr);
    return Array.from(arr, n => chars[n % chars.length]).join('');
  }
  Jot.$('#gen', ui).onclick = () => { Jot.$('#out', ui).value = gen(); };
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
  Jot.$('#gen', ui).click();
};

JotTools['tip-calculator'] = function (root) {
  const ui = Jot.ui(`<div class="row">
    <label>Bill amount $<input type="number" id="bill" value="50" step="0.01"></label>
    <label>Tip % <input type="number" id="tip" value="18" step="0.1"></label>
    <label>People <input type="number" id="people" value="1" min="1"></label>
  </div>
  <div class="btn-row"><button class="btn" id="go">Calculate</button></div>
  <div class="stats" id="stats"></div>`);
  root.appendChild(ui);
  function run() {
    const bill = +Jot.$('#bill', ui).value, tipPct = +Jot.$('#tip', ui).value, people = Math.max(1, +Jot.$('#people', ui).value);
    const tip = bill * tipPct / 100, total = bill + tip;
    Jot.$('#stats', ui).innerHTML = `
      <div class="stat"><strong>$${tip.toFixed(2)}</strong>Tip amount</div>
      <div class="stat"><strong>$${total.toFixed(2)}</strong>Total with tip</div>
      <div class="stat"><strong>$${(total / people).toFixed(2)}</strong>Per person</div>`;
  }
  Jot.$('#go', ui).onclick = run;
  run();
};

JotTools['bmi-calculator'] = function (root) {
  const ui = Jot.ui(`<div class="row">
    <label>Weight (kg) <input type="number" id="w" value="70" step="0.1"></label>
    <label>Height (cm) <input type="number" id="h" value="175" step="0.1"></label>
  </div>
  <div class="btn-row"><button class="btn" id="go">Calculate BMI</button></div>
  <div class="output" id="out"></div>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const w = +Jot.$('#w', ui).value, h = +Jot.$('#h', ui).value / 100;
    if (!w || !h) { Jot.$('#out', ui).textContent = 'Enter valid weight and height'; return; }
    const bmi = w / (h * h);
    const cat = bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal' : bmi < 30 ? 'Overweight' : 'Obese';
    Jot.$('#out', ui).textContent = `BMI: ${bmi.toFixed(1)} — ${cat}`;
  };
  Jot.$('#go', ui).click();
};

JotTools['image-resizer'] = function (root) {
  const ui = Jot.ui(`<input type="file" id="file" accept="image/*">
    <div class="row"><label>Width px <input type="number" id="w" value="800" min="1"></label>
    <label>Height px <input type="number" id="h" value="600" min="1"></label>
    <label><input type="checkbox" id="aspect" checked> Keep aspect ratio</label></div>
    <div class="btn-row"><button class="btn" id="go">Resize & Download</button></div>
    <canvas id="c" style="max-width:100%;margin-top:1rem"></canvas>`);
  root.appendChild(ui);
  let img;
  Jot.$('#file', ui).onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    img = new Image();
    img.onload = () => {
      if (Jot.$('#aspect', ui).checked) {
        const ratio = img.width / img.height;
        Jot.$('#w', ui).value = Math.round(+Jot.$('#w', ui).value || img.width);
        Jot.$('#h', ui).value = Math.round(+Jot.$('#w', ui).value / ratio);
      }
    };
    img.src = URL.createObjectURL(f);
  };
  Jot.$('#go', ui).onclick = () => {
    if (!img) return;
    const w = +Jot.$('#w', ui).value, h = +Jot.$('#h', ui).value;
    const c = Jot.$('#c', ui), ctx = c.getContext('2d');
    c.width = w; c.height = h;
    ctx.drawImage(img, 0, 0, w, h);
    const a = document.createElement('a');
    a.href = c.toDataURL('image/png');
    a.download = 'resized.png';
    a.click();
  };
};

JotTools['pdf-merger'] = function (root) {
  const ui = Jot.ui(`<input type="file" id="file" accept="application/pdf" multiple>
    <div class="btn-row"><button class="btn" id="go">Merge PDFs</button></div>
    <div class="output" id="out">Select two or more PDF files</div>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = async () => {
    const files = [...Jot.$('#file', ui).files];
    if (files.length < 2) { Jot.$('#out', ui).textContent = 'Select at least 2 PDF files'; return; }
    Jot.$('#out', ui).textContent = 'Merging...';
    await Jot.loadScript('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js');
    const { PDFDocument } = window.PDFLib;
    const merged = await PDFDocument.create();
    for (const f of files) {
      const src = await PDFDocument.load(await f.arrayBuffer());
      const pages = await merged.copyPages(src, src.getPageIndices());
      pages.forEach(p => merged.addPage(p));
    }
    const bytes = await merged.save();
    Jot.download('merged.pdf', bytes, 'application/pdf');
    Jot.$('#out', ui).textContent = `Merged ${files.length} files (${merged.getPageCount()} pages)`;
  };
};

JotTools['md5-hash'] = function (root) {
  const ui = Jot.ui(`<textarea id="in" placeholder="Text to hash"></textarea>
    <div class="btn-row"><button class="btn" id="go">Generate MD5</button><button class="btn btn-secondary" id="copy">Copy</button></div>
    <input type="file" id="file"><div class="output" id="out"></div>`);
  root.appendChild(ui);
  async function md5(text) {
    await Jot.loadScript('https://cdn.jsdelivr.net/npm/spark-md5@3.0.2/spark-md5.min.js');
    return SparkMD5.hash(text);
  }
  Jot.$('#go', ui).onclick = async () => {
    Jot.$('#out', ui).textContent = await md5(Jot.$('#in', ui).value);
  };
  Jot.$('#file', ui).onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    await Jot.loadScript('https://cdn.jsdelivr.net/npm/spark-md5@3.0.2/spark-md5.min.js');
    const buf = await f.arrayBuffer();
    Jot.$('#out', ui).textContent = SparkMD5.ArrayBuffer.hash(buf);
  };
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).textContent, Jot.$('#copy', ui));
};

JotTools['js-minifier'] = function (root) {
  const ui = Jot.ui(`<textarea id="in" placeholder="Paste JavaScript..." rows="8"></textarea>
    <div class="btn-row"><button class="btn" id="min">Minify</button><button class="btn btn-secondary" id="fmt">Beautify</button><button class="btn btn-secondary" id="copy">Copy</button></div>
    <textarea id="out" readonly rows="8"></textarea>`);
  root.appendChild(ui);
  Jot.$('#min', ui).onclick = () => {
    Jot.$('#out', ui).value = Jot.$('#in', ui).value.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').replace(/\s+/g, ' ').trim();
  };
  Jot.$('#fmt', ui).onclick = () => {
    let s = Jot.$('#in', ui).value.replace(/;/g, ';\n').replace(/\{/g, ' {\n').replace(/\}/g, '\n}\n');
    Jot.$('#out', ui).value = s;
  };
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
};

JotTools['css-minifier'] = function (root) {
  const ui = Jot.ui(`<textarea id="in" placeholder="Paste CSS..." rows="8"></textarea>
    <div class="btn-row"><button class="btn" id="min">Minify</button><button class="btn btn-secondary" id="fmt">Beautify</button><button class="btn btn-secondary" id="copy">Copy</button></div>
    <textarea id="out" readonly rows="8"></textarea>`);
  root.appendChild(ui);
  Jot.$('#min', ui).onclick = () => {
    Jot.$('#out', ui).value = Jot.$('#in', ui).value.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').replace(/\s*([{}:;,])\s*/g, '$1').trim();
  };
  Jot.$('#fmt', ui).onclick = () => {
    Jot.$('#out', ui).value = Jot.$('#in', ui).value.replace(/\{/g, ' {\n  ').replace(/;/g, ';\n  ').replace(/\}/g, '\n}\n').replace(/\n\s+\n/g, '\n');
  };
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
};

JotTools['yaml-json'] = function (root) {
  const ui = Jot.ui(`<textarea id="in" placeholder="Paste YAML or JSON..." rows="10"></textarea>
    <div class="btn-row"><button class="btn" id="y2j">YAML to JSON</button><button class="btn btn-secondary" id="j2y">JSON to YAML</button><button class="btn btn-secondary" id="copy">Copy</button></div>
    <div id="err" class="error"></div><textarea id="out" readonly rows="10"></textarea>`);
  root.appendChild(ui);
  Jot.$('#y2j', ui).onclick = async () => {
    Jot.$('#err', ui).textContent = '';
    try {
      await Jot.loadScript('https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/dist/js-yaml.min.js');
      Jot.$('#out', ui).value = JSON.stringify(jsyaml.load(Jot.$('#in', ui).value), null, 2);
    } catch (e) { Jot.$('#err', ui).textContent = e.message; }
  };
  Jot.$('#j2y', ui).onclick = async () => {
    Jot.$('#err', ui).textContent = '';
    try {
      await Jot.loadScript('https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/dist/js-yaml.min.js');
      Jot.$('#out', ui).value = jsyaml.dump(JSON.parse(Jot.$('#in', ui).value));
    } catch (e) { Jot.$('#err', ui).textContent = e.message; }
  };
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
};

JotTools['text-reverser'] = function (root) {
  const ui = Jot.ui(`<textarea id="in" placeholder="Text to reverse"></textarea>
    <div class="btn-row"><button class="btn btn-secondary" data-m="chars">Reverse chars</button><button class="btn btn-secondary" data-m="words">Reverse words</button><button class="btn btn-secondary" data-m="lines">Reverse lines</button><button class="btn" id="copy">Copy</button></div>
    <textarea id="out" readonly></textarea>`);
  root.appendChild(ui);
  Jot.$$('.btn[data-m]', ui).forEach(b => b.onclick = () => {
    const t = Jot.$('#in', ui).value;
    const m = b.dataset.m;
    Jot.$('#out', ui).value = m === 'chars' ? [...t].reverse().join('') : m === 'words' ? t.split(/\s+/).reverse().join(' ') : t.split('\n').reverse().join('\n');
  });
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
};

JotTools['find-replace'] = function (root) {
  const ui = Jot.ui(`<textarea id="in" rows="8"></textarea>
    <div class="row"><label>Find <input type="text" id="find"></label><label>Replace <input type="text" id="rep"></label></div>
    <label><input type="checkbox" id="regex"> Use regex</label>
    <div class="btn-row"><button class="btn" id="go">Replace All</button><button class="btn btn-secondary" id="copy">Copy</button></div>
    <div id="err" class="error"></div><textarea id="out" readonly rows="8"></textarea>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    Jot.$('#err', ui).textContent = '';
    try {
      const f = Jot.$('#find', ui).value, r = Jot.$('#rep', ui).value, t = Jot.$('#in', ui).value;
      Jot.$('#out', ui).value = Jot.$('#regex', ui).checked ? t.replace(new RegExp(f, 'g'), r) : t.split(f).join(r);
    } catch (e) { Jot.$('#err', ui).textContent = e.message; }
  };
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
};

JotTools['line-sorter'] = function (root) {
  const ui = Jot.ui(`<textarea id="in" placeholder="One item per line"></textarea>
    <div class="btn-row"><button class="btn" id="az">Sort A–Z</button><button class="btn btn-secondary" id="za">Sort Z–A</button><button class="btn btn-secondary" id="copy">Copy</button></div>
    <textarea id="out" readonly></textarea>`);
  root.appendChild(ui);
  function sort(desc) {
    const lines = Jot.$('#in', ui).value.split('\n').filter(l => l.length);
    lines.sort((a, b) => desc ? b.localeCompare(a) : a.localeCompare(b));
    Jot.$('#out', ui).value = lines.join('\n');
  }
  Jot.$('#az', ui).onclick = () => sort(false);
  Jot.$('#za', ui).onclick = () => sort(true);
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
};

JotTools['remove-empty-lines'] = function (root) {
  const ui = Jot.ui(`<textarea id="in"></textarea><div class="btn-row"><button class="btn" id="go">Remove Empty Lines</button><button class="btn btn-secondary" id="copy">Copy</button></div><textarea id="out" readonly></textarea>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => { Jot.$('#out', ui).value = Jot.$('#in', ui).value.split('\n').filter(l => l.trim()).join('\n'); };
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
};

JotTools['trim-whitespace'] = function (root) {
  const ui = Jot.ui(`<textarea id="in"></textarea><div class="btn-row"><button class="btn" id="go">Trim Lines</button><button class="btn btn-secondary" id="copy">Copy</button></div><textarea id="out" readonly></textarea>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => { Jot.$('#out', ui).value = Jot.$('#in', ui).value.split('\n').map(l => l.trim()).join('\n'); };
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
};

JotTools['countdown-timer'] = function (root) {
  const ui = Jot.ui(`<div class="row"><label>Target date/time <input type="datetime-local" id="dt"></label></div>
    <div class="btn-row"><button class="btn" id="start">Start</button><button class="btn btn-secondary" id="stop">Stop</button></div>
    <div class="output" id="out" style="font-size:1.5rem;text-align:center;padding:1.5rem">Set a date and start</div>`);
  root.appendChild(ui);
  let timer;
  function tick() {
    const target = new Date(Jot.$('#dt', ui).value).getTime();
    const diff = target - Date.now();
    if (isNaN(target)) { Jot.$('#out', ui).textContent = 'Invalid date'; return; }
    if (diff <= 0) { Jot.$('#out', ui).textContent = 'Time is up!'; clearInterval(timer); return; }
    const d = Math.floor(diff / 86400000), h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000), s = Math.floor((diff % 60000) / 1000);
    Jot.$('#out', ui).textContent = `${d}d ${h}h ${m}m ${s}s remaining`;
  }
  Jot.$('#start', ui).onclick = () => { clearInterval(timer); timer = setInterval(tick, 1000); tick(); };
  Jot.$('#stop', ui).onclick = () => clearInterval(timer);
};

JotTools['discount-calculator'] = function (root) {
  const ui = Jot.ui(`<div class="row"><label>Original price $<input type="number" id="price" value="100"></label><label>Discount % <input type="number" id="disc" value="20"></label></div>
    <div class="btn-row"><button class="btn" id="go">Calculate</button></div><div class="stats" id="stats"></div>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const p = +Jot.$('#price', ui).value, d = +Jot.$('#disc', ui).value;
    const saved = p * d / 100, final = p - saved;
    Jot.$('#stats', ui).innerHTML = `<div class="stat"><strong>$${saved.toFixed(2)}</strong>You save</div><div class="stat"><strong>$${final.toFixed(2)}</strong>Final price</div>`;
  };
  Jot.$('#go', ui).click();
};

JotTools['mortgage-calculator'] = function (root) {
  const ui = Jot.ui(`<div class="row"><label>Loan amount $<input type="number" id="amt" value="300000"></label><label>Rate % <input type="number" id="rate" value="6.5" step="0.01"></label><label>Years <input type="number" id="years" value="30"></label></div>
    <div class="btn-row"><button class="btn" id="go">Calculate</button></div><div class="output" id="out"></div>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const P = +Jot.$('#amt', ui).value, r = +Jot.$('#rate', ui).value / 100 / 12, n = +Jot.$('#years', ui).value * 12;
    const pay = r ? P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1) : P / n;
    Jot.$('#out', ui).textContent = `Monthly payment: $${pay.toFixed(2)}\nTotal paid: $${(pay * n).toFixed(2)}\nTotal interest: $${(pay * n - P).toFixed(2)}`;
  };
  Jot.$('#go', ui).click();
};

JotTools['meta-tags'] = function (root) {
  const ui = Jot.ui(`<div class="row"><label>Title <input type="text" id="title" placeholder="Page title"></label></div>
    <label>Description<textarea id="desc" rows="3"></textarea></label>
    <label>URL <input type="text" id="url" placeholder="https://example.com/page"></label>
    <div class="btn-row"><button class="btn" id="go">Generate</button><button class="btn btn-secondary" id="copy">Copy</button></div>
    <textarea id="out" readonly rows="10"></textarea>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const t = Jot.$('#title', ui).value, d = Jot.$('#desc', ui).value, u = Jot.$('#url', ui).value;
    Jot.$('#out', ui).value = `<title>${t}</title>\n<meta name="description" content="${d}">\n<meta property="og:title" content="${t}">\n<meta property="og:description" content="${d}">\n<meta property="og:url" content="${u}">\n<meta name="twitter:card" content="summary">\n<meta name="twitter:title" content="${t}">\n<meta name="twitter:description" content="${d}">`;
  };
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
};

JotTools['robots-txt'] = function (root) {
  const ui = Jot.ui(`<label>User-agent <input type="text" id="ua" value="*"></label>
    <label>Disallow paths (one per line)<textarea id="dis" rows="4">/admin</textarea></label>
    <label>Sitemap URL <input type="text" id="site" placeholder="https://example.com/sitemap.xml"></label>
    <div class="btn-row"><button class="btn" id="go">Generate</button><button class="btn btn-secondary" id="copy">Copy</button></div>
    <textarea id="out" readonly rows="8"></textarea>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const ua = Jot.$('#ua', ui).value, dis = Jot.$('#dis', ui).value.split('\n').filter(Boolean).map(p => `Disallow: ${p.trim()}`).join('\n');
    const sm = Jot.$('#site', ui).value.trim();
    Jot.$('#out', ui).value = `User-agent: ${ua}\nAllow: /\n${dis}${sm ? '\n\nSitemap: ' + sm : ''}`;
  };
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
  Jot.$('#go', ui).click();
};

JotTools['png-jpg-converter'] = function (root) {
  const ui = Jot.ui(`<input type="file" id="file" accept="image/*">
    <div class="btn-row"><button class="btn" id="png">Save as PNG</button><button class="btn btn-secondary" id="jpg">Save as JPG</button></div>
    <canvas id="c" style="display:none"></canvas><div class="output" id="out"></div>`);
  root.appendChild(ui);
  let img;
  Jot.$('#file', ui).onchange = e => { const f = e.target.files[0]; if (!f) return; img = new Image(); img.onload = () => Jot.$('#out', ui).textContent = `Loaded ${img.width}x${img.height}`; img.src = URL.createObjectURL(f); };
  function save(fmt) {
    if (!img) return;
    const c = Jot.$('#c', ui); c.width = img.width; c.height = img.height;
    c.getContext('2d').drawImage(img, 0, 0);
    const a = document.createElement('a'); a.href = c.toDataURL(fmt === 'jpg' ? 'image/jpeg' : 'image/png', 0.92);
    a.download = 'converted.' + fmt; a.click();
  }
  Jot.$('#png', ui).onclick = () => save('png');
  Jot.$('#jpg', ui).onclick = () => save('jpg');
};

JotTools['rot13'] = function (root) {
  const ui = Jot.ui(`<textarea id="in" placeholder="Text to encode/decode"></textarea>
    <div class="btn-row"><button class="btn" id="go">ROT13</button><button class="btn btn-secondary" id="copy">Copy</button></div>
    <textarea id="out" readonly></textarea>`);
  root.appendChild(ui);
  const rot = s => s.replace(/[a-zA-Z]/g, c => String.fromCharCode((c <= 'Z' ? 90 : 122) >= (c = c.charCodeAt(0) + 13) ? c : c - 26));
  Jot.$('#go', ui).onclick = () => { Jot.$('#out', ui).value = rot(Jot.$('#in', ui).value); };
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
};

JotTools['credit-card-validator'] = function (root) {
  const ui = Jot.ui(`<input type="text" id="in" placeholder="4111 1111 1111 1111"><div class="btn-row"><button class="btn" id="go">Validate</button></div><div class="output" id="out"></div>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const num = Jot.$('#in', ui).value.replace(/\D/g, '');
    let sum = 0, alt = false;
    for (let i = num.length - 1; i >= 0; i--) {
      let n = +num[i]; if (alt) { n *= 2; if (n > 9) n -= 9; } sum += n; alt = !alt;
    }
    const type = /^4/.test(num) ? 'Visa' : /^5[1-5]/.test(num) ? 'Mastercard' : /^3[47]/.test(num) ? 'Amex' : 'Unknown';
    Jot.$('#out', ui).textContent = sum % 10 === 0 && num.length >= 13 ? `Valid ${type} card` : 'Invalid card number';
  };
};

JotTools['dice-roller'] = function (root) {
  const ui = Jot.ui(`<div class="row"><label>Dice <input type="number" id="dice" value="2" min="1" max="20"></label><label>Sides <input type="number" id="sides" value="6" min="2" max="100"></label></div>
    <div class="btn-row"><button class="btn" id="go">Roll</button></div><div class="output" id="out"></div>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const n = +Jot.$('#dice', ui).value, s = +Jot.$('#sides', ui).value;
    const rolls = Array.from({ length: n }, () => Jot.randomInt(1, s));
    Jot.$('#out', ui).textContent = rolls.join(', ') + ' — Total: ' + rolls.reduce((a, b) => a + b, 0);
  };
};

JotTools['coin-flip'] = function (root) {
  const ui = Jot.ui(`<div class="btn-row"><button class="btn" id="go">Flip Coin</button></div><div class="output" id="out" style="font-size:2rem;text-align:center;padding:1rem">—</div>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => { Jot.$('#out', ui).textContent = Math.random() < 0.5 ? 'Heads' : 'Tails'; };
};

JotTools['cron-generator'] = function (root) {
  const ui = Jot.ui(`<div class="row"><label>Minute <input type="text" id="min" value="0"></label><label>Hour <input type="text" id="hour" value="*"></label></div>
    <div class="row"><label>Day <input type="text" id="dom" value="*"></label><label>Month <input type="text" id="mon" value="*"></label><label>Weekday <input type="text" id="dow" value="*"></label></div>
    <p style="font-size:.8125rem;color:var(--text-muted)">Quick: <button class="btn btn-secondary" data-p="0 * * * *">Hourly</button> <button class="btn btn-secondary" data-p="0 0 * * *">Daily</button> <button class="btn btn-secondary" data-p="0 0 * * 0">Weekly</button></p>
    <div class="output" id="out"></div><div class="output" id="explain" style="margin-top:.5rem"></div>`);
  root.appendChild(ui);
  function update() {
    const expr = [Jot.$('#min', ui).value, Jot.$('#hour', ui).value, Jot.$('#dom', ui).value, Jot.$('#mon', ui).value, Jot.$('#dow', ui).value].join(' ');
    Jot.$('#out', ui).textContent = expr;
    try { Jot.$('#explain', ui).textContent = Jot.cronExplain(expr); } catch (e) { Jot.$('#explain', ui).textContent = e.message; }
  }
  Jot.$$('input', ui).forEach(i => i.oninput = update);
  Jot.$$('.btn[data-p]', ui).forEach(b => b.onclick = () => { const p = b.dataset.p.split(' '); ['min','hour','dom','mon','dow'].forEach((id, i) => Jot.$('#'+id, ui).value = p[i]); update(); });
  update();
};

JotTools['html-formatter'] = function (root) {
  const ui = Jot.ui(`<textarea id="in" rows="8" placeholder="Paste HTML"></textarea>
    <div class="btn-row"><button class="btn" id="go">Format</button><button class="btn btn-secondary" id="copy">Copy</button></div>
    <textarea id="out" readonly rows="8"></textarea>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    let s = Jot.$('#in', ui).value.replace(/>\s+</g, '><').trim();
    let out = '', indent = 0;
    s.replace(/(<\/?[^>]+>)/g, (tag, offset, str) => {
      if (tag.startsWith('</')) indent = Math.max(0, indent - 1);
      out += '  '.repeat(indent) + tag + '\n';
      if (tag.startsWith('<') && !tag.startsWith('</') && !tag.endsWith('/>') && !/^(br|hr|img|input|meta|link)/i.test(tag)) indent++;
      return tag;
    });
    Jot.$('#out', ui).value = out || s.replace(/></g, '>\n<');
  };
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
};

JotTools['remove-line-breaks'] = function (root) {
  const ui = Jot.ui(`<textarea id="in"></textarea><div class="btn-row"><button class="btn" id="go">Join Lines</button><button class="btn btn-secondary" id="copy">Copy</button></div><textarea id="out" readonly></textarea>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => { Jot.$('#out', ui).value = Jot.$('#in', ui).value.replace(/\n+/g, ' ').trim(); };
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
};

JotTools['add-line-numbers'] = function (root) {
  const ui = Jot.ui(`<textarea id="in"></textarea><div class="btn-row"><button class="btn" id="go">Add Numbers</button><button class="btn btn-secondary" id="copy">Copy</button></div><textarea id="out" readonly></textarea>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    Jot.$('#out', ui).value = Jot.$('#in', ui).value.split('\n').map((l, i) => `${String(i + 1).padStart(4, ' ')} | ${l}`).join('\n');
  };
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
};

JotTools['pomodoro-timer'] = function (root) {
  const ui = Jot.ui(`<div class="output" id="display" style="font-size:2.5rem;text-align:center;padding:1rem">25:00</div>
    <p id="phase" style="text-align:center;color:var(--text-muted)">Work session</p>
    <div class="btn-row"><button class="btn" id="start">Start</button><button class="btn btn-secondary" id="pause">Pause</button><button class="btn btn-secondary" id="reset">Reset</button></div>`);
  root.appendChild(ui);
  let secs = 25 * 60, work = true, timer, running = false;
  function render() {
    const m = Math.floor(secs / 60), s = secs % 60;
    Jot.$('#display', ui).textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    Jot.$('#phase', ui).textContent = work ? 'Work session' : 'Break time';
  }
  function tick() {
    if (secs <= 0) { work = !work; secs = work ? 25 * 60 : 5 * 60; }
    else secs--;
    render();
  }
  Jot.$('#start', ui).onclick = () => { if (!running) { running = true; timer = setInterval(tick, 1000); } };
  Jot.$('#pause', ui).onclick = () => { running = false; clearInterval(timer); };
  Jot.$('#reset', ui).onclick = () => { clearInterval(timer); running = false; work = true; secs = 25 * 60; render(); };
  render();
};

JotTools['prime-checker'] = function (root) {
  const ui = Jot.ui(`<input type="number" id="in" value="97"><div class="btn-row"><button class="btn" id="go">Check</button></div><div class="output" id="out"></div>`);
  root.appendChild(ui);
  function isPrime(n) {
    if (n < 2) return false; if (n === 2) return true; if (n % 2 === 0) return false;
    for (let i = 3; i * i <= n; i += 2) if (n % i === 0) return false;
    return true;
  }
  Jot.$('#go', ui).onclick = () => {
    const n = +Jot.$('#in', ui).value;
    const nearby = [];
    for (let i = Math.max(2, n - 5); i <= n + 5; i++) if (isPrime(i)) nearby.push(i);
    Jot.$('#out', ui).textContent = isPrime(n) ? `${n} is prime. Nearby primes: ${nearby.join(', ')}` : `${n} is not prime. Nearby primes: ${nearby.join(', ')}`;
  };
};

JotTools['palindrome-checker'] = function (root) {
  const ui = Jot.ui(`<textarea id="in" placeholder="Enter word or phrase"></textarea><div class="btn-row"><button class="btn" id="go">Check</button></div><div class="output" id="out"></div>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const clean = Jot.$('#in', ui).value.toLowerCase().replace(/[^a-z0-9]/g, '');
    Jot.$('#out', ui).textContent = clean && clean === [...clean].reverse().join('') ? 'Palindrome!' : 'Not a palindrome';
  };
};

JotTools['random-picker'] = function (root) {
  const ui = Jot.ui(`<textarea id="in" placeholder="One name per line"></textarea><div class="btn-row"><button class="btn" id="go">Pick Winner</button></div><div class="output" id="out" style="font-size:1.5rem;text-align:center;padding:1rem">—</div>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const lines = Jot.$('#in', ui).value.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) { Jot.$('#out', ui).textContent = 'Add names first'; return; }
    Jot.$('#out', ui).textContent = lines[Jot.randomInt(0, lines.length - 1)];
  };
};

JotTools['gitignore-generator'] = function (root) {
  const templates = {
    node: 'node_modules/\n.env\n.env.local\ndist/\nbuild/\n*.log\n.DS_Store',
    python: '__pycache__/\n*.py[cod]\n.venv/\nvenv/\n.env\n*.egg-info/\n.pytest_cache/',
    java: 'target/\n*.class\n*.jar\n.idea/\n*.iml',
    web: '.DS_Store\nnode_modules/\ndist/\n.env\n*.log\n.vscode/'
  };
  const ui = Jot.ui(`<div class="btn-row">${Object.keys(templates).map(k => `<button class="btn btn-secondary" data-t="${k}">${k}</button>`).join('')}</div>
    <textarea id="out" rows="12"></textarea><div class="btn-row"><button class="btn btn-secondary" id="copy">Copy</button></div>`);
  root.appendChild(ui);
  Jot.$$('.btn[data-t]', ui).forEach(b => b.onclick = () => { Jot.$('#out', ui).value = templates[b.dataset.t]; });
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
  Jot.$('[data-t="node"]', ui).click();
};

JotTools['hex-text'] = function (root) {
  const ui = Jot.ui(`<textarea id="in" placeholder="Hex or text"></textarea>
    <div class="btn-row"><button class="btn" id="h2t">Hex to Text</button><button class="btn btn-secondary" id="t2h">Text to Hex</button><button class="btn btn-secondary" id="copy">Copy</button></div>
    <div id="err" class="error"></div><textarea id="out" readonly></textarea>`);
  root.appendChild(ui);
  Jot.$('#h2t', ui).onclick = () => {
    Jot.$('#err', ui).textContent = '';
    try {
      const hex = Jot.$('#in', ui).value.replace(/\s/g, '');
      Jot.$('#out', ui).value = hex.match(/.{1,2}/g).map(h => String.fromCharCode(parseInt(h, 16))).join('');
    } catch { Jot.$('#err', ui).textContent = 'Invalid hex'; }
  };
  Jot.$('#t2h', ui).onclick = () => {
    Jot.$('#out', ui).value = [...Jot.$('#in', ui).value].map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' ');
  };
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
};

JotTools['profit-margin'] = function (root) {
  const ui = Jot.ui(`<div class="row"><label>Cost $<input type="number" id="cost" value="40"></label><label>Price $<input type="number" id="price" value="100"></label></div>
    <div class="btn-row"><button class="btn" id="go">Calculate</button></div><div class="stats" id="stats"></div>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const cost = +Jot.$('#cost', ui).value, price = +Jot.$('#price', ui).value;
    const profit = price - cost;
    const margin = price ? (profit / price * 100) : 0;
    const markup = cost ? (profit / cost * 100) : 0;
    Jot.$('#stats', ui).innerHTML = `<div class="stat"><strong>${margin.toFixed(1)}%</strong>Profit margin</div><div class="stat"><strong>${markup.toFixed(1)}%</strong>Markup</div><div class="stat"><strong>$${profit.toFixed(2)}</strong>Profit</div>`;
  };
  Jot.$('#go', ui).click();
};

JotTools['hours-calculator'] = function (root) {
  const ui = Jot.ui(`<div class="row"><label>Hours <input type="number" id="h" value="2"></label><label>Minutes <input type="number" id="m" value="30"></label></div>
    <div class="btn-row"><button class="btn" id="add">Add to now</button><button class="btn btn-secondary" id="sub">Subtract from now</button></div>
    <div class="output" id="out"></div>`);
  root.appendChild(ui);
  function calc(add) {
    const ms = (+Jot.$('#h', ui).value * 3600000) + (+Jot.$('#m', ui).value * 60000);
    const d = new Date(Date.now() + (add ? ms : -ms));
    Jot.$('#out', ui).textContent = d.toLocaleString();
  }
  Jot.$('#add', ui).onclick = () => calc(true);
  Jot.$('#sub', ui).onclick = () => calc(false);
};

JotTools['reading-time'] = function (root) {
  const ui = Jot.ui(`<textarea id="in" placeholder="Paste article text"></textarea><div class="output" id="out"></div>`);
  root.appendChild(ui);
  Jot.$('#in', ui).oninput = () => {
    const words = Jot.$('#in', ui).value.trim().split(/\s+/).filter(Boolean).length;
    const wpm = 238;
    Jot.$('#out', ui).textContent = `${words} words · ~${Math.max(1, Math.ceil(words / wpm))} min read · ~${Math.ceil(words / 150)} min aloud`;
  };
};

JotTools['jwt-encoder'] = function (root) {
  const ui = Jot.ui(`<label>Header JSON<textarea id="hdr" rows="2">{"alg":"HS256","typ":"JWT"}</textarea></label>
    <label>Payload JSON<textarea id="pay" rows="4">{"sub":"1234567890","name":"John Doe","iat":1516239022}</textarea></label>
    <label>Secret <input type="text" id="secret" value="your-256-bit-secret"></label>
    <div class="btn-row"><button class="btn" id="go">Sign JWT</button><button class="btn btn-secondary" id="copy">Copy</button></div>
    <div id="err" class="error"></div><textarea id="out" readonly rows="3"></textarea>`);
  root.appendChild(ui);
  const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const b64urlStr = s => btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  Jot.$('#go', ui).onclick = async () => {
    Jot.$('#err', ui).textContent = '';
    try {
      const h = b64urlStr(JSON.stringify(JSON.parse(Jot.$('#hdr', ui).value)));
      const p = b64urlStr(JSON.stringify(JSON.parse(Jot.$('#pay', ui).value)));
      const data = h + '.' + p;
      const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(Jot.$('#secret', ui).value), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
      Jot.$('#out', ui).value = data + '.' + b64url(sig);
    } catch (e) { Jot.$('#err', ui).textContent = e.message; }
  };
  Jot.$('#copy', ui).onclick = () => Jot.copy(Jot.$('#out', ui).value, Jot.$('#copy', ui));
};

JotTools['text-diff-stats'] = function (root) {
  const ui = Jot.ui(`<textarea id="in" placeholder="Paste text to analyze" rows="8"></textarea><div class="stats" id="stats"></div>`);
  root.appendChild(ui);
  Jot.$('#in', ui).oninput = () => {
    const t = Jot.$('#in', ui).value;
    const words = t.trim().split(/\s+/).filter(Boolean);
    const sentences = t.split(/[.!?]+/).filter(s => s.trim()).length;
    const chars = t.length;
    const avgWord = words.length ? (chars / words.length).toFixed(1) : 0;
    const avgSent = sentences ? (words.length / sentences).toFixed(1) : 0;
    Jot.$('#stats', ui).innerHTML = `
      <div class="stat"><strong>${words.length}</strong>Words</div>
      <div class="stat"><strong>${chars}</strong>Characters</div>
      <div class="stat"><strong>${sentences}</strong>Sentences</div>
      <div class="stat"><strong>${avgWord}</strong>Avg word length</div>
      <div class="stat"><strong>${avgSent}</strong>Words per sentence</div>`;
  };
};
