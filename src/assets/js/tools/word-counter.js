window.JotTools = window.JotTools || {};

JotTools['word-counter'] = function (root) {
  const ui = Jot.ui(`<textarea id="in" placeholder="Start typing or paste text…" rows="8"></textarea>
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
