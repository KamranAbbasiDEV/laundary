window.JotTools = window.JotTools || {};

JotTools['url-encoder'] = function (root) {
  const ui = Jot.ui(`<textarea id="in" placeholder="Text or encoded URL…"></textarea>
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
    <div class="row"><label>Image URL<input id="img" type="text" placeholder="https://…"></label></div>
    <h3>Preview</h3>
    <div class="preview-box" id="preview" style="max-width:500px;font-family:sans-serif"></div>`);
  root.appendChild(ui);
  function render() {
    const t = Jot.$('#title', ui).value, d = Jot.$('#desc', ui).value, u = Jot.$('#url', ui).value, img = Jot.$('#img', ui).value;
    Jot.$('#preview', ui).innerHTML = `${img?`<img src="${img}" style="max-width:100%;border-radius:8px" onerror="this.style.display='none'">`:''}<div style="padding:12px;background:#f2f3f5"><div style="font-weight:700;color:#1c1e21">${t}</div><div style="color:#606770;font-size:14px;margin:4px 0">${d.slice(0,160)}</div><div style="color:#90949c;font-size:12px;text-transform:uppercase">${new URL(u||'https://jotnexus.com').hostname}</div></div>`;
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
    `Screen: ${screen.width}×${screen.height} (${window.devicePixelRatio}x DPR)`,
    `Viewport: ${window.innerWidth}×${window.innerHeight}`,
    `Cookies enabled: ${navigator.cookieEnabled}`,
    `Online: ${navigator.onLine}`
  ].join('\n');
};

JotTools['tweet-counter'] = function (root) {
  const ui = Jot.ui(`<textarea id="in" placeholder="Write your tweet…" maxlength="4000"></textarea><div class="stats"><div class="stat"><strong id="count">0</strong>characters</div><div class="stat"><strong id="remain">280</strong>remaining</div></div><div id="warn" class="error"></div>`);
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
  const ui = Jot.ui(`<textarea id="in" placeholder="Paste article text…" rows="8"></textarea><div class="btn-row"><button class="btn" id="go">Analyze</button></div><div id="table"></div>`);
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
