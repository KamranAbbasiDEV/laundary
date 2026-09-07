window.JotTools = window.JotTools || {};

JotTools['json-formatter'] = function (root) {
  const ui = Jot.ui(`
    <textarea id="in" placeholder='Paste JSON here… {"hello":"world"}'></textarea>
    <div class="btn-row">
      <button class="btn" id="beautify">Beautify</button>
      <button class="btn btn-secondary" id="minify">Minify</button>
      <button class="btn btn-secondary" id="copy">Copy</button>
    </div>
    <div id="err" class="error"></div>
    <textarea id="out" placeholder="Output…" readonly></textarea>`);
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
    <textarea id="in" placeholder="Enter text…"></textarea>
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
    <textarea id="in" placeholder="Paste JWT token…"></textarea>
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
