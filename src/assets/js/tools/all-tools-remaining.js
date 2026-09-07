
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
    Jot.$('#out', ui).textContent = `Format valid: ${words.length} words. Note: Full BIP39 checksum validation requires the complete wordlist — verify with your wallet before use.`;
  };
};

JotTools['currency-rates'] = function (root) {
  const ui = Jot.ui(`<div class="row"><label>Amount<input type="number" id="amt" value="100"></label>
    <label>From<select id="from"><option USD selected>USD</option><option EUR>EUR</option><option GBP>GBP</option><option PKR>PKR</option><option JPY>JPY</option></select></label>
    <label>To<select id="to"><option EUR selected>EUR</option><option USD>USD</option><option GBP>GBP</option><option PKR>PKR</option><option JPY>JPY</option></select></label></div>
    <div class="btn-row"><button class="btn" id="go">Convert</button></div><div id="out" class="output"></div><p class="success-msg">Uses free Frankfurter API for daily rates.</p>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = async () => {
    Jot.$('#out', ui).textContent = 'Loading rates…';
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
    Jot.$('#out', ui).textContent = 'Querying…';
    try {
      const r = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`, { headers: { Accept: 'application/dns-json' } });
      const d = await r.json();
      Jot.$('#out', ui).textContent = JSON.stringify(d, null, 2);
    } catch (e) { Jot.$('#out', ui).textContent = 'Lookup failed: ' + e.message; }
  };
};

JotTools['dns-propagation'] = JotTools['dns-lookup'];

JotTools['ip-lookup'] = function (root) {
  const ui = Jot.ui(`<div class="btn-row"><button class="btn" id="go">Get My IP Info</button></div><pre class="output" id="out"></pre>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = async () => {
    Jot.$('#out', ui).textContent = 'Fetching…';
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
    Jot.$('#out', ui).textContent = 'Hashing…';
    await Jot.loadScript('https://cdn.jsdelivr.net/npm/bcryptjs@2.4.3/dist/bcrypt.min.js');
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
  const ui = Jot.ui(`<p>Press any key…</p><pre class="output" id="out">Waiting…</pre>`);
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
  const ui = Jot.ui(`<textarea id="in" rows="4" placeholder="Primary text…"></textarea>
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
  const ui = Jot.ui(`<input type="search" id="q" placeholder="Search patterns…"><div id="list"></div>`);
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
  const ui = Jot.ui(`<textarea id="in" rows="8" placeholder="Paste SVG…"></textarea><div class="btn-row"><button class="btn" id="go">Minify</button><button class="btn btn-secondary" id="copy">Copy</button></div><textarea id="out" readonly></textarea>`);
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
