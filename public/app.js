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

function gatherConfig() {
  const c = {
    title: state.title,
    bookName: $('bookName').value,
    pageSize: { widthMm: +$('pageW').value, heightMm: +$('pageH').value },
    margins: { topMm: +$('mTop').value, bottomMm: +$('mBot').value, insideMm: +$('mIn').value, outsideMm: +$('mOut').value },
    columns: { count: +$('colCount').value, gutterMm: +$('gutter').value },
    fonts: {
      body: { family: $('bodyFont').value, sizePt: +$('bodySize').value, lineHeightPt: +$('bodyLh').value, weight: 400, align: 'justify' },
    },
    pageNumber: { mode: $('pnMode').value, startAt: +$('pnStart').value, enabled: true, fontFamily: $('bodyFont').value, fontSizePt: +$('bodySize').value },
    runningHeader: { enabled: true, style: 1, fontFamily: $('bodyFont').value, fontSizePt: +$('bodySize').value, showRule: true },
  };
  return c;
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
  const ids = ['pageW','pageH','mTop','mBot','mIn','mOut','colCount','gutter','bodySize','bodyLh','bodyFont','bookName','pnMode','pnStart'];
  ids.forEach(id => {
    $(id).addEventListener('change', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => { if (state.items.length) renderPreview(); }, 200);
    });
  });
  $('renderBtn').addEventListener('click', renderPreview);
  $('reflowBtn').addEventListener('click', renderPreview);
  $('pdfBtn').addEventListener('click', downloadPDF);
}

(async function init() {
  await loadPresets();
  setupFileInput();
  bindLiveControls();
})();
