const state = {
  items: [],
  title: '',
  presetId: '',
  pageCount: 0,
};

const $ = (id) => document.getElementById(id);
const status = (msg) => { $('status').textContent = msg; };

async function loadPresets() {
  const r = await fetch('/api/presets');
  const presets = await r.json();
  const grid = $('presetGrid');
  grid.innerHTML = '';
  for (const [id, p] of Object.entries(presets)) {
    const el = document.createElement('div');
    el.className = 'preset';
    el.textContent = p.label;
    el.dataset.id = id;
    el.addEventListener('click', () => {
      document.querySelectorAll('.preset').forEach(x => x.classList.remove('active'));
      el.classList.add('active');
      state.presetId = id;
      if (state.items.length) renderPreview();
    });
    grid.appendChild(el);
  }
}

function setupFileInput() {
  const drop = $('fileDrop');
  const input = $('fileInput');
  drop.addEventListener('click', () => input.click());
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('dragging'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('dragging'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('dragging');
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });
  input.addEventListener('change', (e) => {
    if (e.target.files[0]) handleFile(e.target.files[0]);
  });
}

async function handleFile(file) {
  status('מעלה ומפרק את הקובץ...');
  $('fileInfo').textContent = file.name + ' (' + Math.round(file.size / 1024) + ' KB)';
  const fd = new FormData();
  fd.append('file', file);
  try {
    const r = await fetch('/api/upload', { method: 'POST', body: fd });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Upload failed');
    state.items = data.items;
    state.title = data.title;
    if (!$('bookName').value) $('bookName').value = data.title;
    status(`נטענו ${data.items.length} בלוקים. מעמדת...`);
    await renderPreview();
  } catch (e) {
    status('שגיאה: ' + e.message);
  }
}

const FONTS = ['Frank Ruhl Libre', 'Noto Serif Hebrew', 'Heebo', 'Assistant'];

function fillFontPickers() {
  document.querySelectorAll('select[data-font]').forEach(sel => {
    sel.innerHTML = '';
    FONTS.forEach(f => {
      const o = document.createElement('option');
      o.value = f; o.textContent = f;
      sel.appendChild(o);
    });
    sel.value = sel.id.startsWith('body') ? 'Frank Ruhl Libre' : 'Frank Ruhl Libre';
  });
}

function fontSpec(prefix, defaults) {
  return {
    family: $(`${prefix}_font`).value,
    sizePt: +$(`${prefix}_size`).value,
    lineHeightPt: $(`${prefix}_lh`) ? +$(`${prefix}_lh`).value : defaults.lineHeightPt,
    weight: +$(`${prefix}_weight`).value,
    align: $(`${prefix}_align`) ? $(`${prefix}_align`).value : defaults.align,
    color: $(`${prefix}_color`) ? $(`${prefix}_color`).value : (defaults.color || '#1a1a1a'),
    spaceAfterMm: $(`${prefix}_after`) ? +$(`${prefix}_after`).value : (defaults.spaceAfterMm || 0),
  };
}

function gatherConfig() {
  const body = fontSpec('body', { lineHeightPt: 14, align: 'justify' });
  const h1 = fontSpec('h1', { lineHeightPt: 28, align: 'center', spaceAfterMm: 4 });
  const h2 = fontSpec('h2', { lineHeightPt: 18, align: 'center', spaceAfterMm: 1 });
  const h3 = fontSpec('h3', { lineHeightPt: 16, align: 'right', spaceAfterMm: 0.5 });
  return {
    title: state.title,
    bookName: $('bookName').value,
    pageSize: { widthMm: +$('pageW').value, heightMm: +$('pageH').value },
    margins: { topMm: +$('mTop').value, bottomMm: +$('mBot').value, insideMm: +$('mIn').value, outsideMm: +$('mOut').value },
    columns: { count: +$('colCount').value, gutterMm: +$('gutter').value },
    fonts: { body, h1, h2, h3 },
    pageNumber: { mode: $('pnMode').value, startAt: +$('pnStart').value, enabled: true, fontFamily: body.family, fontSizePt: body.sizePt },
    runningHeader: { enabled: true, style: 1, fontFamily: body.family, fontSizePt: body.sizePt, showRule: true },
  };
}

async function renderPreview() {
  if (!state.items.length) return;
  status('מעמדת...');
  const t0 = performance.now();
  const r = await fetch('/api/render', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: state.items, presetId: state.presetId, configOverrides: gatherConfig(), format: 'html' }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    status('שגיאה בעימוד: ' + (err.error || r.statusText));
    return;
  }
  const html = await r.text();
  const pageCount = +r.headers.get('X-Page-Count') || 0;
  state.pageCount = pageCount;
  showPreview(html);
  const ms = Math.round(performance.now() - t0);
  status(`עומדו ${pageCount} עמודים ב-${ms}ms`);
}

function showPreview(html) {
  const preview = $('preview');
  preview.innerHTML = '';
  const iframe = document.createElement('iframe');
  preview.appendChild(iframe);
  iframe.srcdoc = html;
}

async function downloadPDF() {
  if (!state.items.length) { status('אין מה לייצא'); return; }
  status('מייצרת PDF...');
  try {
    const r = await fetch('/api/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: state.items, presetId: state.presetId, configOverrides: gatherConfig(), format: 'pdf' }),
    });
    if (!r.ok) throw new Error((await r.json()).error || 'Render failed');
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (state.title || 'document') + '.pdf';
    a.click();
    URL.revokeObjectURL(url);
    status('הורד');
  } catch (e) {
    status('שגיאה: ' + e.message);
  }
}

let debounceTimer;
function bindLiveControls() {
  const ids = [
    'pageW','pageH','mTop','mBot','mIn','mOut','colCount','gutter',
    'bookName','pnMode','pnStart',
    'body_font','body_size','body_lh','body_weight','body_align',
    'h1_font','h1_size','h1_lh','h1_weight','h1_color','h1_after',
    'h2_font','h2_size','h2_lh','h2_weight','h2_align','h2_color','h2_after',
    'h3_font','h3_size','h3_lh','h3_weight','h3_align','h3_color','h3_after',
  ];
  ids.forEach(id => {
    const el = $(id);
    if (!el) return;
    const ev = (el.type === 'color' || el.type === 'number' || el.tagName === 'SELECT') ? 'change' : 'input';
    el.addEventListener(ev, () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => { if (state.items.length) renderPreview(); }, 200);
    });
  });
  $('renderBtn').addEventListener('click', renderPreview);
  $('reflowBtn').addEventListener('click', renderPreview);
  $('pdfBtn').addEventListener('click', downloadPDF);
}

(async function init() {
  fillFontPickers();
  await loadPresets();
  setupFileInput();
  bindLiveControls();
})();
