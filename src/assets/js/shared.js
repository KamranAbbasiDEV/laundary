window.Jot = window.Jot || {};

Jot.$ = (sel, root = document) => root.querySelector(sel);
Jot.$$ = (sel, root = document) => [...root.querySelectorAll(sel)];

Jot.mount = function (fn) {
  document.addEventListener('DOMContentLoaded', () => {
    const root = Jot.$('#tool-root');
    if (root) fn(root);
  });
};

Jot.ui = function (html) {
  const wrap = document.createElement('div');
  wrap.className = 'tool-ui';
  wrap.innerHTML = html;
  return wrap;
};

Jot.toast = function (message) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(Jot._toastTimer);
  Jot._toastTimer = setTimeout(() => el.classList.remove('show'), 2000);
};

Jot.copy = async function (text, btn) {
  try {
    await navigator.clipboard.writeText(text);
    if (btn) {
      const orig = btn.textContent;
      btn.textContent = 'Copied';
      setTimeout(() => { btn.textContent = orig; }, 1500);
    } else {
      Jot.toast('Copied to clipboard');
    }
  } catch {
    Jot.toast('Copy failed — select text manually');
  }
};

Jot.download = function (filename, content, type = 'text/plain') {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
};

Jot.readFile = function (input, cb) {
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => cb(reader.result, file);
  reader.readAsText(file);
};

Jot.readFileBinary = function (input, cb) {
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => cb(reader.result, file);
  reader.readAsArrayBuffer(file);
};

Jot.assignFiles = function (input, files) {
  if (!input || !files?.length) return false;
  const dt = new DataTransfer();
  if (input.multiple) {
    [...files].forEach(f => dt.items.add(f));
  } else {
    dt.items.add(files[0]);
  }
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
};

Jot.shouldSkipFileDrop = function (input) {
  if (!input || input.type !== 'file') return true;
  if (input.dataset.noDrop !== undefined) return true;
  if (input.hidden || input.hasAttribute('hidden')) return true;
  if (input.closest('.file-drop-zone')) return true;
  const parent = input.parentElement;
  if (parent?.querySelector(':scope > .drop-zone')) return true;
  return false;
};

Jot.enhanceFileInputs = function (root) {
  if (!root) return;
  Jot.$$(('input[type="file"]:not([data-drop-enhanced])'), root).forEach(input => {
    if (Jot.shouldSkipFileDrop(input)) {
      input.dataset.dropEnhanced = '1';
      return;
    }
    input.dataset.dropEnhanced = '1';
    if (input.closest('.file-drop-zone')) return;

    const zone = document.createElement('div');
    zone.className = 'file-drop-zone';
    zone.tabIndex = 0;
    zone.setAttribute('role', 'button');
    zone.setAttribute('aria-label', input.multiple ? 'Upload files' : 'Upload file');

    const hint = document.createElement('p');
    hint.className = 'file-drop-hint';
    hint.innerHTML = input.multiple
      ? '<strong>Drag & drop files here</strong><span>or click to browse</span>'
      : '<strong>Drag & drop a file here</strong><span>or click to browse</span>';

    const name = document.createElement('p');
    name.className = 'file-drop-name';
    name.textContent = 'No file selected';

    input.classList.add('file-drop-input');
    input.parentNode.insertBefore(zone, input);
    zone.appendChild(hint);
    zone.appendChild(name);
    zone.appendChild(input);

    const showName = () => {
      const files = input.files;
      if (!files?.length) {
        name.textContent = 'No file selected';
        zone.classList.remove('file-drop-zone--has-file');
        return;
      }
      name.textContent = files.length === 1 ? files[0].name : `${files.length} files selected`;
      zone.classList.add('file-drop-zone--has-file');
    };

    input.addEventListener('change', showName);

    const activate = () => zone.classList.add('file-drop-zone--active');
    const deactivate = () => zone.classList.remove('file-drop-zone--active');

    zone.addEventListener('click', e => {
      if (e.target === input) return;
      input.click();
    });

    zone.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        input.click();
      }
    });

    ['dragenter', 'dragover'].forEach(ev => {
      zone.addEventListener(ev, e => {
        e.preventDefault();
        activate();
      });
    });

    zone.addEventListener('dragleave', e => {
      if (!zone.contains(e.relatedTarget)) deactivate();
    });

    zone.addEventListener('drop', e => {
      e.preventDefault();
      deactivate();
      const files = e.dataTransfer?.files;
      if (!files?.length) return;
      Jot.assignFiles(input, files);
      showName();
    });

    showName();
  });
};

Jot.logoUploadHtml = function (prefix = 'logo') {
  return `<div class="logo-upload-block">
    <label>Logo / image (optional)<input type="file" id="${prefix}" accept="image/*" data-logo-upload></label>
    <div class="logo-preview" id="${prefix}-preview"></div>
    <button type="button" class="btn btn-secondary btn-sm" id="${prefix}-clear" style="display:none">Remove logo</button>
  </div>`;
};

Jot.bindLogoUpload = function (root, opts = {}) {
  const prefix = opts.prefix || 'logo';
  const input = opts.input || Jot.$(`#${prefix}`, root) || Jot.$('input[data-logo-upload]', root);
  const preview = opts.preview || Jot.$(`#${prefix}-preview`, root);
  const clearBtn = opts.clearBtn || Jot.$(`#${prefix}-clear`, root);
  if (!input) return { get: () => '' };

  let dataUrl = '';
  const notify = () => { if (opts.onChange) opts.onChange(dataUrl); };

  input.addEventListener('change', e => {
    const f = e.target.files?.[0];
    if (!f || !f.type.startsWith('image/')) {
      dataUrl = '';
      if (preview) preview.innerHTML = '';
      if (clearBtn) clearBtn.style.display = 'none';
      notify();
      return;
    }
    const r = new FileReader();
    r.onload = () => {
      dataUrl = r.result;
      if (preview) preview.innerHTML = `<img src="${dataUrl}" alt="Logo preview">`;
      if (clearBtn) clearBtn.style.display = '';
      notify();
    };
    r.readAsDataURL(f);
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      dataUrl = '';
      input.value = '';
      if (preview) preview.innerHTML = '';
      clearBtn.style.display = 'none';
      notify();
    });
  }

  return { get: () => dataUrl };
};

Jot.drawFitImage = function (ctx, img, x, y, maxW, maxH) {
  const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
  const w = img.width * ratio;
  const h = img.height * ratio;
  ctx.drawImage(img, x, y, w, h);
  return { w, h };
};

Jot.loadImageFromDataUrl = function (dataUrl) {
  return new Promise((resolve, reject) => {
    if (!dataUrl) { resolve(null); return; }
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
};

Jot.ensureCompareGrid = function (ui, canvas, labels = {}) {
  if (ui.querySelector('.compare-grid')) {
    return {
      grid: ui.querySelector('.compare-grid'),
      orig: ui.querySelector('.preview-orig, #prev-orig'),
      canvas,
      show() { ui.querySelector('.compare-grid').style.display = ''; },
    };
  }
  const origLabel = labels.original || 'Original';
  const resultLabel = labels.result || 'Preview';
  const grid = document.createElement('div');
  grid.className = 'compare-grid';
  grid.style.display = 'none';
  const origCard = document.createElement('div');
  origCard.className = 'compare-card';
  origCard.innerHTML = `<p class="compare-label">${origLabel}</p>`;
  const origImg = document.createElement('img');
  origImg.className = 'preview-orig';
  origImg.id = 'prev-orig';
  origImg.alt = 'Original';
  origCard.appendChild(origImg);
  const resultCard = document.createElement('div');
  resultCard.className = 'compare-card';
  resultCard.innerHTML = `<p class="compare-label">${resultLabel}</p>`;
  const anchor = canvas.parentNode;
  anchor.insertBefore(grid, canvas);
  grid.appendChild(origCard);
  grid.appendChild(resultCard);
  resultCard.appendChild(canvas);
  canvas.style.maxWidth = '100%';
  return {
    grid,
    orig: origImg,
    canvas,
    show() { grid.style.display = ''; },
  };
};

Jot.unlockPanel = function (ui, panelSel, fields) {
  const panel = Jot.$(panelSel, ui);
  if (panel) panel.classList.remove('tool-panel--locked');
  const note = ui.querySelector('.tool-panel-note');
  if (note) note.style.display = 'none';
  (fields || Jot.$$('#settings input, #settings select, #settings button', ui)).forEach(el => { el.disabled = false; });
};

Jot.imageEffectTool = function (root, extraHtml, applyFn, downloadName) {
  const ui = Jot.ui(`<input type="file" accept="image/*" id="file">${extraHtml || ''}
    <div class="compare-grid" id="compare" style="display:none">
      <div class="compare-card"><p class="compare-label">Original</p><img id="prev-orig" alt="Original"></div>
      <div class="compare-card"><p class="compare-label">Preview</p><canvas id="c"></canvas></div>
    </div>
    <div class="btn-row"><button class="btn" id="go" disabled>Update preview</button><button class="btn btn-secondary" id="dl" disabled>Download</button></div>`);
  root.appendChild(ui);
  let img;
  function run() {
    if (!img) return;
    applyFn(img, Jot.$('#c', ui), ui);
    Jot.$('#dl', ui).disabled = false;
  }
  Jot.$('#file', ui).addEventListener('change', e => {
    const f = e.target.files?.[0];
    if (!f) { Jot.toast('Please upload a file first'); return; }
    Jot._loadImg(f, i => {
      img = i;
      Jot.$('#prev-orig', ui).src = i.src;
      Jot.$('#compare', ui).style.display = '';
      Jot.$('#go', ui).disabled = false;
      run();
    });
  });
  Jot.$('#go', ui).onclick = run;
  Jot.$('#dl', ui).onclick = () => {
    const a = document.createElement('a');
    a.href = Jot.$('#c', ui).toDataURL('image/png');
    a.download = downloadName || 'output.png';
    a.click();
  };
  ui.querySelectorAll('input[type="range"], input[type="number"], input[type="color"], .row input').forEach(el => {
    el.addEventListener('input', () => { if (img) run(); });
  });
  return ui;
};

Jot.enhanceVisualPreviews = function (root, ui) {
  if (ui.dataset.previewEnhanced) return;
  const toolId = root.dataset.tool || '';
  const fileInput = ui.querySelector('input[type="file"]#file')
    || ui.querySelector('input[type="file"][accept*="image"]:not([data-logo-upload]):not([data-no-drop])');
  const canvas = ui.querySelector('canvas');
  const skipAuto = new Set(['signature-pad', 'drawing-canvas', 'whiteboard']);

  if (fileInput && canvas && !skipAuto.has(toolId) && !ui.querySelector('.compare-grid')) {
    const hidden = canvas.style.display === 'none';
    if (hidden) Jot._wireHiddenCanvasPreview(ui, fileInput, canvas);
    else Jot._wireImageCanvasPreview(ui, fileInput, canvas, toolId);
    ui.dataset.previewEnhanced = '1';
  }

  Jot.$$('[id="preview"], [id="prev"], .preview-box, #qr-wrap, .invoice-preview-wrap', ui).forEach(el => {
    if (el.dataset.previewLabeled) return;
    el.dataset.previewLabeled = '1';
    const prev = el.previousElementSibling;
    if (prev?.classList?.contains('preview-heading') || prev?.classList?.contains('tool-panel-title')) return;
    const h = document.createElement('p');
    h.className = 'preview-heading';
    h.textContent = el.id === 'qr-wrap' ? 'QR preview' : 'Live preview';
    el.parentNode.insertBefore(h, el);
  });

  const livePrev = ui.querySelector('#prev, #preview, .preview-box');
  const textIn = ui.querySelector('textarea#in, textarea:first-of-type');
  const genBtn = ui.querySelector('#go, #gen, #render');
  if (livePrev && textIn && genBtn && !textIn.dataset.livePreview) {
    textIn.dataset.livePreview = '1';
    const run = () => { try { genBtn.click(); } catch {} };
    let t;
    textIn.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(run, 350);
    });
  }
};

Jot._wireImageCanvasPreview = function (ui, fileInput, canvas, toolId) {
  const cmp = Jot.ensureCompareGrid(ui, canvas);
  let ready = false;

  const triggerPreview = () => {
    if (!ready) return;
    const go = ui.querySelector('#go');
    if (!go || go.disabled) return;
    const label = (go.textContent || '').toLowerCase();
    if (label.includes('download') || label.includes('remove background')) return;
    go.click();
  };

  fileInput.addEventListener('change', () => {
    const f = fileInput.files?.[0];
    if (!f) return;
    const img = new Image();
    img.onload = () => {
      cmp.orig.src = img.src;
      cmp.show();
      ready = true;
      setTimeout(triggerPreview, 50);
    };
    img.src = URL.createObjectURL(f);
  });

  ui.querySelectorAll('.row input, .tool-panel input, input[type="range"], input[type="color"]').forEach(el => {
    el.addEventListener('input', triggerPreview);
    el.addEventListener('change', triggerPreview);
  });
  ui.querySelectorAll('.btn[data-a], #flip').forEach(btn => {
    btn.addEventListener('click', () => setTimeout(triggerPreview, 50));
  });
};

Jot._wireHiddenCanvasPreview = function (ui, fileInput, canvas) {
  const wrap = document.createElement('div');
  wrap.className = 'compare-grid';
  wrap.style.display = 'none';
  wrap.innerHTML = '<div class="compare-card"><p class="compare-label">Original</p><img class="preview-orig" alt="Original"></div><div class="compare-card"><p class="compare-label">Preview</p><img class="preview-result-img" alt="Preview"></div>';
  canvas.parentNode.insertBefore(wrap, canvas);
  const origImg = wrap.querySelector('.preview-orig');
  const resultImg = wrap.querySelector('.preview-result-img');

  const syncResult = () => {
    if (canvas.width > 0 && canvas.height > 0) {
      resultImg.src = canvas.toDataURL('image/png');
      wrap.style.display = '';
    }
  };

  fileInput.addEventListener('change', () => {
    const f = fileInput.files?.[0];
    if (!f) return;
    const img = new Image();
    img.onload = () => {
      origImg.src = img.src;
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext('2d').drawImage(img, 0, 0);
      syncResult();
    };
    img.src = URL.createObjectURL(f);
  });

  ui.querySelectorAll('#go, .btn-row .btn:not(.btn-secondary)').forEach(btn => {
    btn.addEventListener('click', () => setTimeout(syncResult, 100));
  });
};

/**
 * Drag-to-select + drag-to-move crop on #source-wrap / #prev-orig.
 * Expects #x #y #w #h inputs and calls render() after changes.
 */
Jot.setupInteractiveCrop = function (ui, getImg, render) {
  const wrap = Jot.$('#source-wrap', ui);
  if (!wrap || wrap.dataset.cropInteractive) return;
  wrap.dataset.cropInteractive = '1';

  let active = false;
  let mode = 'draw';
  let anchor = { x: 0, y: 0 };
  let startCrop = null;

  function imgScale() {
    const img = getImg();
    const el = Jot.$('#prev-orig', ui);
    if (!img || !el?.clientWidth) return 1;
    return el.clientWidth / img.width;
  }

  function pointerToImage(clientX, clientY) {
    const rect = wrap.getBoundingClientRect();
    const s = imgScale();
    return {
      x: Math.round((clientX - rect.left) / s),
      y: Math.round((clientY - rect.top) / s),
    };
  }

  function aspectRatio() {
    const sel = Jot.$('#aspect', ui);
    if (!sel || !sel.value || sel.value === 'free') return null;
    const [a, b] = sel.value.split(':').map(Number);
    return b ? a / b : null;
  }

  function constrainAspect(w, h) {
    const r = aspectRatio();
    if (!r) return { w, h };
    if (w / h >= r) return { w: Math.round(h * r), h };
    return { w, h: Math.round(w / r) };
  }

  function setCrop(x, y, w, h, opts = {}) {
    const img = getImg();
    if (!img) return;
    if (opts.applyAspect !== false) ({ w, h } = constrainAspect(w, h));
    x = Math.max(0, Math.min(Math.round(x), img.width - 1));
    y = Math.max(0, Math.min(Math.round(y), img.height - 1));
    w = Math.max(1, Math.min(Math.round(w), img.width - x));
    h = Math.max(1, Math.min(Math.round(h), img.height - y));
    Jot.$('#x', ui).value = x;
    Jot.$('#y', ui).value = y;
    Jot.$('#w', ui).value = w;
    Jot.$('#h', ui).value = h;
    render();
  }

  function insideCrop(px, py) {
    const x = +Jot.$('#x', ui).value;
    const y = +Jot.$('#y', ui).value;
    const w = +Jot.$('#w', ui).value;
    const h = +Jot.$('#h', ui).value;
    return px >= x && px <= x + w && py >= y && py <= y + h;
  }

  wrap.setAttribute('role', 'application');
  wrap.setAttribute('aria-label', 'Crop image: drag to select an area, drag inside the selection to move it');
  wrap.tabIndex = 0;

  wrap.addEventListener('pointerdown', e => {
    const img = getImg();
    if (!img || e.button > 0) return;
    e.preventDefault();
    wrap.setPointerCapture(e.pointerId);
    wrap.classList.add('crop-source-wrap--active');
    active = true;
    const pt = pointerToImage(e.clientX, e.clientY);
    if (insideCrop(pt.x, pt.y)) {
      mode = 'move';
      startCrop = {
        x: +Jot.$('#x', ui).value,
        y: +Jot.$('#y', ui).value,
        w: +Jot.$('#w', ui).value,
        h: +Jot.$('#h', ui).value,
      };
      anchor = pt;
    } else {
      mode = 'draw';
      anchor = pt;
      setCrop(pt.x, pt.y, 1, 1);
    }
  });

  wrap.addEventListener('pointermove', e => {
    if (!active) return;
    const pt = pointerToImage(e.clientX, e.clientY);
    if (mode === 'draw') {
      const x = Math.min(anchor.x, pt.x);
      const y = Math.min(anchor.y, pt.y);
      let w = Math.abs(pt.x - anchor.x);
      let h = Math.abs(pt.y - anchor.y);
      ({ w, h } = constrainAspect(w, h));
      setCrop(x, y, w, h);
    } else if (startCrop) {
      const dx = pt.x - anchor.x;
      const dy = pt.y - anchor.y;
      setCrop(startCrop.x + dx, startCrop.y + dy, startCrop.w, startCrop.h, { applyAspect: false });
    }
  });

  const end = e => {
    if (!active) return;
    active = false;
    mode = 'draw';
    startCrop = null;
    wrap.classList.remove('crop-source-wrap--active');
    try { wrap.releasePointerCapture(e.pointerId); } catch {}
  };
  wrap.addEventListener('pointerup', end);
  wrap.addEventListener('pointercancel', end);
};

Jot.fillToolGaps = function (ui, primaryFile) {
  if (ui.dataset.gapsFilled) return;
  ui.dataset.gapsFilled = '1';

  Jot._gapResultHeading(ui);
  Jot._gapInlineOutputs(ui);
  Jot._gapReadonlyOutputs(ui);
  Jot._gapLiveRegions(ui);
  Jot._gapCopyButton(ui);
  Jot._gapClearButton(ui);
  Jot._gapFileMeta(ui, primaryFile);
  Jot._gapShortcutTip(ui);
};

Jot._gapResultHeading = function (ui) {
  const targets = [
    ui.querySelector('textarea#out'),
    ui.querySelector('pre#out, pre.output'),
    ui.querySelector('#out.output'),
    ui.querySelector('.output#out'),
  ].filter(Boolean);
  targets.forEach(el => {
    if (el.closest('.compare-grid, .invoice-preview-wrap')) return;
    const prev = el.previousElementSibling;
    if (prev?.classList?.contains('result-heading') || prev?.classList?.contains('preview-heading')) return;
    const h = document.createElement('p');
    h.className = 'result-heading';
    h.textContent = 'Result';
    el.parentNode.insertBefore(h, el);
  });
  if (ui.querySelector('#err') && !ui.querySelector('#err').previousElementSibling?.classList?.contains('result-heading')) {
    const err = ui.querySelector('#err');
    if (!err.textContent) err.textContent = '';
  }
};

Jot._gapInlineOutputs = function (ui) {
  const regions = [
    { sel: '.stats', label: 'Live stats' },
    { sel: '#scale', label: 'Type scale preview' },
    { sel: '#table', label: 'Analysis' },
    { sel: '#list', label: 'Patterns' },
    { sel: '.palette', label: 'Picker' },
  ];
  regions.forEach(({ sel, label }) => {
    const el = ui.querySelector(sel);
    if (!el) return;
    if (!el.getAttribute('aria-live')) el.setAttribute('aria-live', 'polite');
    el.classList.add('tool-live-output');
    const prev = el.previousElementSibling;
    if (prev?.classList?.contains('result-heading') || prev?.classList?.contains('preview-heading')) return;
    const h = document.createElement('p');
    h.className = 'result-heading';
    h.textContent = label;
    el.parentNode.insertBefore(h, el);
  });
};

Jot._gapReadonlyOutputs = function (ui) {
  ui.querySelectorAll('textarea#out, textarea[id="out"]').forEach(ta => {
    ta.readOnly = true;
    if (!ta.getAttribute('rows')) ta.setAttribute('rows', '6');
  });
};

Jot._gapLiveRegions = function (ui) {
  Jot.$$('#out, .output, #preview, #prev, .preview-box, #qr-wrap', ui).forEach(el => {
    if (!el.getAttribute('aria-live')) el.setAttribute('aria-live', 'polite');
  });
};

Jot._gapCopyButton = function (ui) {
  if (ui.querySelector('#copy')) return;
  const out = ui.querySelector('textarea#out, pre#out, pre.output');
  if (!out) return;
  const row = Jot._gapBtnRow(ui, out);
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn-secondary';
  btn.id = 'copy';
  btn.textContent = 'Copy result';
  btn.disabled = true;
  btn.onclick = () => Jot.copy(out.value !== undefined ? out.value : out.textContent, btn);
  row.appendChild(btn);
};

Jot._gapClearButton = function (ui) {
  if (ui.querySelector('#clear, #clr')) return;
  const inp = ui.querySelector('textarea#in');
  if (!inp) return;
  const row = ui.querySelector('.btn-row');
  if (!row) return;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn-secondary';
  btn.id = 'clear';
  btn.textContent = 'Clear';
  btn.onclick = () => {
    inp.value = '';
    ui.querySelectorAll('textarea#out, #out.output, pre#out').forEach(o => {
      if (o.value !== undefined) o.value = '';
      else o.textContent = '';
    });
    ui.querySelectorAll('#err').forEach(e => { e.textContent = ''; });
    Jot.toast('Cleared');
  };
  row.appendChild(btn);
};

Jot._gapFileMeta = function (ui, primaryFile) {
  if (!primaryFile || ui.querySelector('.file-meta')) return;
  const meta = document.createElement('p');
  meta.className = 'file-meta';
  meta.hidden = true;
  const anchor = primaryFile.closest('.file-drop-zone') || primaryFile;
  anchor.insertAdjacentElement('afterend', meta);
  const sync = () => {
    const files = primaryFile.files;
    if (!files?.length) { meta.hidden = true; return; }
    meta.hidden = false;
    meta.textContent = files.length > 1
      ? `${files.length} files selected · ${Jot.formatBytes([...files].reduce((s, f) => s + f.size, 0))} total`
      : `${files[0].name} · ${Jot.formatBytes(files[0].size)}`;
  };
  primaryFile.addEventListener('change', sync);
};

Jot._gapBtnRow = function (ui, nearEl) {
  let row = ui.querySelector('.btn-row');
  if (!row) {
    row = document.createElement('div');
    row.className = 'btn-row';
    nearEl.insertAdjacentElement('afterend', row);
  }
  return row;
};

Jot._gapShortcutTip = function (ui) {
  if (ui.querySelector('.shortcut-tip')) return;
  const go = ui.querySelector('#go');
  const ta = ui.querySelector('textarea#in, textarea:first-of-type');
  if (!go || !ta) return;
  const tip = document.createElement('p');
  tip.className = 'shortcut-tip';
  tip.textContent = 'Tip: Press Ctrl+Enter (Cmd+Enter on Mac) to run the tool.';
  const badge = ui.querySelector('.local-badge');
  if (badge) badge.insertAdjacentElement('beforebegin', tip);
  else ui.appendChild(tip);
};

Jot._toolHint = function (ui, desc, category) {
  const hasPrimaryFile = ui.querySelector('input[type="file"]#file')
    || ui.querySelector('input[type="file"]:not([data-logo-upload]):not([data-no-drop])');
  const hasTextarea = ui.querySelector('textarea');
  const hasNumberInputs = ui.querySelector('input[type="number"]');
  const hasCanvas = ui.querySelector('canvas');
  const action = hasPrimaryFile
    ? ' Upload your file to begin.'
    : hasTextarea
      ? ' Enter or paste below, then run the tool.'
      : hasNumberInputs
        ? ' Adjust the values, then run the tool.'
        : hasCanvas
          ? ' Configure options and render your result.'
          : ' Fill in the fields and run the tool.';
  if (desc) return desc.replace(/\s*\.$/, '') + '.' + action;
  const catHints = {
    pdf: 'Upload a PDF to process it locally in your browser.',
    image: 'Upload an image to edit or convert it locally.',
    video: 'Upload a video file. First use may download a browser encoder (~25MB).',
    audio: 'Upload an audio file to process it locally.',
    developer: 'Enter your input below. Nothing is sent to a server.',
    text: 'Type or paste your text below.',
    finance: 'Enter your numbers below to calculate results instantly.',
    security: 'Enter text or upload a file. Hashing runs locally in your browser.',
  };
  return (catHints[category] || 'Free online tool — runs locally in your browser, no signup required.') + action;
};

Jot.polishToolUx = function (root) {
  if (!root) return;
  const ui = root.querySelector('.tool-ui') || root;
  if (ui.dataset.polished) return;
  ui.dataset.polished = '1';

  const desc = root.dataset.toolDesc || '';
  const category = root.dataset.toolCategory || '';
  const isOptionalFile = input => input.dataset.noDrop !== undefined || input.hasAttribute('data-logo-upload');
  const fileInputs = Jot.$$('input[type="file"]:not([data-no-drop])', ui);
  const primaryFile = ui.querySelector('input[type="file"]#file')
    || fileInputs.find(i => !isOptionalFile(i))
    || null;

  if (!ui.querySelector('.hint')) {
    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.textContent = Jot._toolHint(ui, desc, category);
    ui.insertBefore(hint, ui.firstChild);
  }

  ui.querySelectorAll('textarea:not([placeholder])').forEach(el => {
    if (!el.placeholder) el.placeholder = 'Enter or paste text here…';
  });
  ui.querySelectorAll('input[type="text"]:not([placeholder]), input[type="url"]:not([placeholder])').forEach(el => {
    if (!el.placeholder && !el.value) el.placeholder = 'Enter value…';
  });

  ui.querySelectorAll('label').forEach(label => {
    const control = label.querySelector('input, select, textarea');
    if (control && !control.id) {
      control.id = 'fld-' + Math.random().toString(36).slice(2, 9);
    }
    if (control && !label.querySelector('input[type="checkbox"]') && label.textContent.trim() && !control.getAttribute('aria-label')) {
      control.setAttribute('aria-label', label.textContent.trim());
    }
  });

  Jot.fillToolGaps(ui, primaryFile);

  const gateBtn = (btn, testFn) => {
    if (!btn || btn.dataset.fileGated) return;
    btn.dataset.fileGated = '1';
    const update = () => { btn.disabled = !testFn(); };
    update();
    primaryFile.addEventListener('change', update);
  };

  if (primaryFile) {
    const needsMulti = primaryFile.multiple;
    const fileTest = () => {
      const n = primaryFile.files?.length || 0;
      return needsMulti ? n >= 2 : n >= 1;
    };
    gateBtn(ui.querySelector('#go'), fileTest);
    if (!ui.querySelector('#go')) {
      Jot.$$('.btn-row .btn:not(.btn-secondary)', ui).forEach(btn => gateBtn(btn, fileTest));
    }
    const dl = ui.querySelector('#dl');
    if (dl && !ui.querySelector('canvas')) gateBtn(dl, fileTest);
  }

  const outEl = ui.querySelector('#out, .output');
  const copyBtn = ui.querySelector('#copy');
  if (copyBtn && outEl && !copyBtn.dataset.copyPolished) {
    copyBtn.dataset.copyPolished = '1';
    const readOut = () => (outEl.value !== undefined ? outEl.value : outEl.textContent || '').trim();
    const syncCopy = () => { copyBtn.disabled = !readOut(); };
    syncCopy();
    outEl.addEventListener('input', syncCopy);
    if (outEl.tagName !== 'TEXTAREA' && outEl.tagName !== 'INPUT') {
      new MutationObserver(syncCopy).observe(outEl, { childList: true, characterData: true, subtree: true });
    }
    copyBtn.addEventListener('click', e => {
      if (!readOut()) { e.preventDefault(); Jot.toast('Nothing to copy yet — run the tool first'); }
    }, true);
  }

  const canvas = ui.querySelector('canvas');
  const dlBtn = ui.querySelector('#dl');
  if (canvas && dlBtn && !dlBtn.dataset.canvasPolished) {
    dlBtn.dataset.canvasPolished = '1';
    const syncDl = () => { dlBtn.disabled = !(canvas.width > 0 && canvas.height > 0); };
    syncDl();
    const goBtn = ui.querySelector('#go');
    if (goBtn) goBtn.addEventListener('click', () => setTimeout(syncDl, 50));
    primaryFile?.addEventListener('change', () => setTimeout(syncDl, 300));
  }

  ui.querySelectorAll('input[type="range"]').forEach(range => {
    if (range.dataset.rangePolished || range.disabled) return;
    range.dataset.rangePolished = '1';
    const vid = range.id ? range.id + 'v' : null;
    if (vid && ui.querySelector('#' + vid)) return;
    const val = document.createElement('span');
    val.className = 'range-value';
    val.id = vid || '';
    const pct = range.max > 1 && range.max <= 100 && range.min >= 0;
    const update = () => {
      val.textContent = pct ? `${Math.round(+range.value)}%` : range.value;
    };
    update();
    range.addEventListener('input', update);
    const label = range.closest('label');
    if (label) label.insertBefore(val, range);
    else range.parentNode.insertBefore(val, range);
  });

  const goBtn = ui.querySelector('#go');
  const textIn = ui.querySelector('textarea#in');
  const optionalFile = ui.querySelector('input[type="file"][data-no-drop], input[type="file"][data-logo-upload]');
  if (goBtn && textIn && !primaryFile && !ui.querySelector('input[type="number"]') && !goBtn.dataset.validPolished) {
    goBtn.dataset.validPolished = '1';
    goBtn.addEventListener('click', e => {
      const hasFile = optionalFile?.files?.length;
      if (!textIn.value.trim() && !hasFile) {
        e.stopImmediatePropagation();
        Jot.toast(optionalFile ? 'Please enter text or choose a file first' : 'Please enter some text first');
      }
    }, true);
  }

  if (goBtn && textIn) {
    textIn.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        goBtn.click();
      }
    });
  }

  ui.querySelectorAll('.output, #out').forEach(el => {
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') return;
    if (el.classList.contains('file-meta') || el.classList.contains('local-badge')) return;
    if (!el.dataset.emptyPolished) {
      el.dataset.emptyPolished = '1';
      const placeholder = el.dataset.placeholder || 'Results will appear here.';
      if (!el.textContent.trim() || el.textContent.trim() === 'Results will appear here.') {
        if (!el.textContent.trim()) el.textContent = placeholder;
        el.classList.add('output--empty');
      }
      new MutationObserver(() => {
        const empty = !el.textContent.trim() || el.textContent.trim() === placeholder;
        el.classList.toggle('output--empty', empty);
      }).observe(el, { childList: true, characterData: true, subtree: true });
    }
  });

  if (!ui.querySelector('.local-badge')) {
    const badge = document.createElement('p');
    badge.className = 'local-badge';
    badge.textContent = 'Private · Processed locally in your browser';
    ui.appendChild(badge);
  }

  Jot.enhanceVisualPreviews(root, ui);
};

Jot.setStatus = function (el, msg, type = 'success') {
  el.textContent = msg;
  el.className = type === 'error' ? 'error' : 'success-msg';
};

Jot.simpleMarkdown = function (md) {
  let html = md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^### (.*)$/gm, '<h3>$1</h3>')
    .replace(/^## (.*)$/gm, '<h2>$1</h2>')
    .replace(/^# (.*)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/^\s*[-*] (.*)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`)
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hul])/gm, '');
  return `<div class="md-preview"><p>${html}</p></div>`;
};

Jot.formatJSON = function (str, indent = 2) {
  return JSON.stringify(JSON.parse(str), null, indent);
};

Jot.formatBytes = function (bytes) {
  if (!bytes && bytes !== 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

Jot.downloadPdfFromElement = async function (element, filename) {
  await Jot.loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js');
  await html2pdf().set({
    margin: 10,
    filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  }).from(element).save();
};

Jot.csvFromJson = function (arr) {
  if (!Array.isArray(arr) || !arr.length) throw new Error('JSON must be a non-empty array of objects');
  const keys = [...new Set(arr.flatMap(Object.keys))];
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [keys.join(','), ...arr.map(row => keys.map(k => esc(row[k])).join(','))].join('\n');
};

Jot.parseCSV = function (text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).filter(Boolean).map(line => {
    const vals = line.match(/("([^"]|"")*"|[^,]*)/g) || [];
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = (vals[i] || '').replace(/^"|"$/g, '').replace(/""/g, '"').trim();
    });
    return obj;
  });
};

Jot.slugify = s => s.toLowerCase().trim()
  .replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');

Jot.caseConvert = {
  upper: s => s.toUpperCase(),
  lower: s => s.toLowerCase(),
  title: s => s.replace(/\w\S*/g, t => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()),
  sentence: s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(),
  camel: s => s.replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '').replace(/^./, m => m.toLowerCase())
};

Jot.uuid = () => crypto.randomUUID();

Jot.randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

Jot.convertUnit = function (value, conv) {
  const v = parseFloat(value);
  if (isNaN(v)) return NaN;
  if (conv.special === 'f_to_c') return (v - 32) * 5 / 9;
  if (conv.special === 'c_to_f') return v * 9 / 5 + 32;
  if (conv.special === 'mpg_to_l100') return 235.215 / v;
  if (conv.special === 'l100_to_mpg') return 235.215 / v;
  if (conv.special === 'f_to_k') return (v - 32) * 5 / 9 + 273.15;
  if (conv.special === 'k_to_f') return (v - 273.15) * 9 / 5 + 32;
  if (conv.op === 'mul') return v * conv.factor;
  if (conv.op === 'div') return v / conv.factor;
  if (conv.op === 'add') return v + conv.factor;
  if (conv.op === 'sub') return v - conv.factor;
  return v;
};

Jot.hash = async function (algo, text) {
  try {
    const buf = await crypto.subtle.digest(algo, new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    throw new Error(algo + ' not supported in this browser: ' + e.message);
  }
};

Jot.hashFile = async function (algo, buffer) {
  try {
    const buf = await crypto.subtle.digest(algo, buffer);
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    throw new Error(algo + ' not supported: ' + e.message);
  }
};

Jot.decodeJwt = function (token) {
  const parts = token.split('.');
  if (parts.length < 2) throw new Error('Invalid JWT format');
  const decode = p => JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/')));
  return { header: decode(parts[0]), payload: decode(parts[1]), signature: parts[2] || '' };
};

Jot.cronExplain = function (expr) {
  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5) throw new Error('Cron needs 5 fields: minute hour day month weekday');
  const [min, hour, dom, mon, dow] = parts;
  const bits = [];
  if (min === '*') bits.push('every minute');
  else if (min.startsWith('*/')) bits.push(`every ${min.slice(2)} minutes`);
  else bits.push(`at minute ${min}`);
  if (hour !== '*') bits.push(`hour ${hour}`);
  if (dom !== '*') bits.push(`day ${dom} of month`);
  if (mon !== '*') bits.push(`month ${mon}`);
  if (dow !== '*') bits.push(`weekday ${dow}`);
  return `Runs ${bits.join(', ')}.`;
};

Jot.romanToInt = function (roman) {
  const map = { I:1,V:5,X:10,L:50,C:100,D:500,M:1000 };
  const s = roman.toUpperCase().trim();
  if (!/^[IVXLCDM]+$/.test(s)) throw new Error('Invalid Roman numeral characters');
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const cur = map[s[i]], next = map[s[i+1]];
    if (!cur) throw new Error('Invalid Roman numeral');
    n += cur < next ? -cur : cur;
  }
  return n;
};

Jot.intToRoman = function (num) {
  const vals = [[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];
  let n = num, out = '';
  for (const [v,s] of vals) { while (n >= v) { out += s; n -= v; } }
  return out;
};

Jot.numberToWords = function (n) {
  if (n === 0) return 'zero';
  const ones = ['','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
  const tens = ['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
  const scales = ['','thousand','million','billion'];
  function chunk(num) {
    let s = '';
    if (num >= 100) { s += ones[Math.floor(num/100)] + ' hundred '; num %= 100; }
    if (num >= 20) { s += tens[Math.floor(num/10)] + (num%10 ? '-' + ones[num%10] : ''); }
    else if (num > 0) s += ones[num];
    return s.trim();
  }
  let i = 0, parts = [];
  while (n > 0) {
    const c = n % 1000;
    if (c) parts.unshift(chunk(c) + (scales[i] ? ' ' + scales[i] : ''));
    n = Math.floor(n / 1000); i++;
  }
  return parts.join(' ').trim();
};

Jot.passwordScore = function (pw) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  const labels = ['Very weak','Weak','Fair','Strong','Very strong'];
  const crack = [('<1 sec'), ('minutes'), ('hours'), ('years'), ('centuries')];
  return { score, label: labels[score] || labels[0], crack: crack[score] || crack[0] };
};

Jot.loadScript = function (src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
};

Jot.det = function (m) {
  const n = m.length;
  if (n === 1) return m[0][0];
  if (n === 2) return m[0][0]*m[1][1]-m[0][1]*m[1][0];
  if (n === 3) return m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1])-m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0])+m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]);
  throw new Error('Max 3x3 matrix supported');
};

Jot.drawQR = function (canvas, text) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const size = 200;
  canvas.width = size; canvas.height = size;
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#000';
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  const mod = Math.abs(hash);
  const cells = 25, cell = size / cells;
  for (let r = 0; r < cells; r++) {
    for (let c = 0; c < cells; c++) {
      const v = (mod * (r + 1) * (c + 7) + r * c) % 97;
      if ((r < 7 && c < 7) || (r < 7 && c > 17) || (r > 17 && c < 7)) {
        if ((r === 0 || r === 6 || c === 0 || c === 6 || (r > 1 && r < 5 && c > 1 && c < 5)) && (r < 7 && c < 7)) ctx.fillRect(c*cell,r*cell,cell,cell);
        else if (r < 7 && c > 17 && (r === 0 || r === 6 || c === 18 || c === 24 || (r > 1 && r < 5 && c > 19 && c < 23))) ctx.fillRect(c*cell,r*cell,cell,cell);
        else if (r > 17 && c < 7 && (r === 18 || r === 24 || c === 0 || c === 6 || (r > 19 && r < 23 && c > 1 && c < 5))) ctx.fillRect(c*cell,r*cell,cell,cell);
      } else if (v % 3 === 0) ctx.fillRect(c*cell, r*cell, cell, cell);
    }
  }
};
