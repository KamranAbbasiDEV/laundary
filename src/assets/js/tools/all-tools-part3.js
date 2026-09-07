
JotTools['unit-converter'] = function (root) {
  const CONV = {
    'inches-cm': { factor: 2.54, op: 'mul' }, 'cm-inches': { factor: 2.54, op: 'div' },
    'feet-meters': { factor: 0.3048, op: 'mul' }, 'meters-feet': { factor: 0.3048, op: 'div' },
    'miles-km': { factor: 1.60934, op: 'mul' }, 'km-miles': { factor: 1.60934, op: 'div' },
    'lbs-kg': { factor: 0.453592, op: 'mul' }, 'kg-lbs': { factor: 0.453592, op: 'div' },
    'gallons-liters': { factor: 3.78541, op: 'mul' }, 'liters-gallons': { factor: 3.78541, op: 'div' },
    'fahrenheit-celsius': { special: 'f_to_c' }, 'celsius-fahrenheit': { special: 'c_to_f' },
    'bytes-kb': { factor: 1024, op: 'div' }, 'kb-mb': { factor: 1024, op: 'div' }, 'mb-gb': { factor: 1024, op: 'div' }
  };
  const from = root.dataset.from, to = root.dataset.to;
  const key = from && to ? `${from}-${to}` : null;
  const ui = Jot.ui(`<div class="row">
    ${!key ? '<label>Category<select id="cat"><option value="inches-cm">Inches ↔ CM</option><option value="lbs-kg">Lbs ↔ Kg</option><option value="fahrenheit-celsius">°F → °C</option></select></label>' : ''}
    <label>Value<input type="number" id="val" value="1"></label></div>
    <div class="output" id="out" style="font-size:1.5rem;margin-top:1rem"></div>`);
  root.appendChild(ui);
  function run() {
    const k = key || Jot.$('#cat', ui)?.value || 'inches-cm';
    const [f, t2] = k.split('-');
    const conv = CONV[k] || CONV['inches-cm'];
    const v = +Jot.$('#val', ui).value;
    let r = Jot.convertUnit(v, conv);
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
  const ui = Jot.ui(`<p style="color:var(--muted);font-size:.9rem">Quadratic ax² + bx + c = 0</p>
    <div class="row"><label>a<input type="number" id="a" value="1"></label><label>b<input type="number" id="b" value="-3"></label><label>c<input type="number" id="c" value="2"></label></div>
    <div class="btn-row"><button class="btn" id="go">Solve</button></div><div class="output" id="out"></div>`);
  root.appendChild(ui);
  Jot.$('#go', ui).onclick = () => {
    const a=+Jot.$('#a',ui).value, b=+Jot.$('#b',ui).value, c=+Jot.$('#c',ui).value;
    const d = b*b - 4*a*c;
    if (d < 0) Jot.$('#out', ui).textContent = 'No real roots';
    else if (d === 0) Jot.$('#out', ui).textContent = `x = ${(-b/(2*a)).toFixed(4)}`;
    else Jot.$('#out', ui).textContent = `x₁ = ${((-b+Math.sqrt(d))/(2*a)).toFixed(4)}\nx₂ = ${((-b-Math.sqrt(d))/(2*a)).toFixed(4)}`;
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
  Jot.$('#play', ui).onclick = () => {
    ctx = ctx || new AudioContext();
    osc = ctx.createOscillator();
    osc.type = Jot.$('#wave', ui).value;
    osc.frequency.value = +Jot.$('#freq', ui).value;
    osc.connect(ctx.destination); osc.start();
  };
  Jot.$('#stop', ui).onclick = () => { if (osc) { osc.stop(); osc=null; } };
};

JotTools['image-compressor'] = function (root) {
  const ui = Jot.ui(`<div class="drop-zone" id="dz">Drop image or click to upload</div><input type="file" id="file" accept="image/*" hidden>
    <div class="row"><label>Quality<input type="range" id="q" min="0.1" max="1" step="0.05" value="0.8"></label></div>
    <canvas id="cv" style="display:none"></canvas><img id="prev" style="max-width:100%;margin-top:1rem"><br>
    <button class="btn" id="dl">Download</button>`);
  root.appendChild(ui);
  let imgData;
  Jot.$('#dz', ui).onclick = () => Jot.$('#file', ui).click();
  Jot.$('#file', ui).onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const img = new Image();
    img.onload = () => {
      const cv = Jot.$('#cv', ui), ctx = cv.getContext('2d');
      cv.width = img.width; cv.height = img.height;
      ctx.drawImage(img, 0, 0);
      imgData = cv.toDataURL('image/jpeg', +Jot.$('#q', ui).value);
      Jot.$('#prev', ui).src = imgData;
    };
    img.src = URL.createObjectURL(f);
  };
  Jot.$('#q', ui).oninput = () => Jot.$('#file', ui).dispatchEvent(new Event('change'));
  Jot.$('#dl', ui).onclick = () => { if (!imgData) return; const a=document.createElement('a'); a.download='compressed.jpg'; a.href=imgData; a.click(); };
};

JotTools['data-url'] = function (root) {
  const ui = Jot.ui(`<div class="drop-zone" id="dz">Upload image → data URL</div><input type="file" id="file" accept="image/*" hidden>
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
