/* =========================================================
   Imutomat — frontend orchestrator.
   - Central state, persisted in IndexedDB.
   - Debounced (300ms) scoped reflow.
   - User overrides win and freeze auto-balance for the page.
   - Live word/char/paragraph telemetry into the footer.
   - Web Worker stub for heavy layout calc.
   ========================================================= */

import { db } from '/db.js';

const $ = (id) => document.getElementById(id);

const state = {
  docId: 'default',
  items: [],
  title: '',
  presetId: 'vilna',
  pageCount: 0,
  totalPagesEstimate: 0,
  manualOffsets: {},   // { [pageNum]: { a: int, b: int } } in baseline units
  frozen: {},          // { [pageNum]: true } — auto-balance suspended
  squiggle: [],        // freehand annotations per page (svg path data)
  tool: null,
  activeColor: '#d23a3a',
  lastRenderedHTML: '',
};

const fbStatus = (msg) => { $('fbStatus').textContent = msg; };

// ============== Tabs ==============
function setupTabs() {
  document.querySelectorAll('.rail-tab').forEach((t) => {
    t.addEventListener('click', () => {
      document.querySelectorAll('.rail-tab').forEach(x => x.classList.remove('active'));
      document.querySelectorAll('.rail-pane').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      document.querySelector(`.rail-pane[data-pane="${t.dataset.tab}"]`).classList.add('active');
    });
  });
}

// ============== File ingest ==============
function setupFileInput() {
  const input = $('fileInput');
  input.addEventListener('change', (e) => { if (e.target.files[0]) handleFile(e.target.files[0]); });

  const stage = $('stage');
  ['dragover','dragenter'].forEach(ev => stage.addEventListener(ev, (e) => { e.preventDefault(); stage.classList.add('dragover'); }));
  ['dragleave','drop'].forEach(ev => stage.addEventListener(ev, () => stage.classList.remove('dragover')));
  stage.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });
}

async function handleFile(file) {
  fbStatus('מעלה ומפרק את הקובץ...');
  const fd = new FormData();
  fd.append('file', file);
  try {
    const r = await fetch('/api/upload', { method: 'POST', body: fd });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Upload failed');
    state.items = data.items;
    state.title = data.title;
    if (!$('bookName').value) $('bookName').value = data.title;
    state.manualOffsets = {};
    state.frozen = {};
    state.totalPagesEstimate = estimatePages(data.items);
    updateImutomatics(0, state.totalPagesEstimate);
    updateTelemetry();
    await persist();
    fbStatus(`נטענו ${data.items.length} בלוקים. מעמדת...`);
    await renderPreview();
  } catch (e) {
    fbStatus('שגיאה: ' + e.message);
  }
}

function estimatePages(items) {
  // Rough first guess: ~80 lines/page × ~10 words/line ≈ 800 words/page.
  const wc = items.reduce((s, it) => s + countWords(it.text), 0);
  return Math.max(1, Math.ceil(wc / 800));
}

// ============== Presets ==============
async function loadPresets() {
  const r = await fetch('/api/presets');
  const presets = await r.json();
  const grid = $('presetGrid');
  grid.innerHTML = '';
  for (const [id, p] of Object.entries(presets)) {
    const el = document.createElement('div');
    el.className = 'preset' + (id === state.presetId ? ' active' : '');
    el.textContent = p.label;
    el.dataset.id = id;
    el.addEventListener('click', () => {
      grid.querySelectorAll('.preset').forEach(x => x.classList.remove('active'));
      el.classList.add('active');
      state.presetId = id;
      scheduleReflow({ scoped: false });
    });
    grid.appendChild(el);
  }
}

// ============== Config gather ==============
function gatherConfig() {
  return {
    title: state.title,
    bookName: $('bookName').value,
    pageSize: { widthMm: +$('pageW').value, heightMm: +$('pageH').value },
    margins: { topMm: +$('mTop').value, bottomMm: +$('mBot').value, insideMm: +$('mIn').value, outsideMm: +$('mOut').value },
    columns: { count: +$('colCount').value, gutterMm: +$('gutter').value },
    pageNumber: { mode: $('pnMode').value, startAt: +$('pnStart').value, enabled: true },
    runningHeader: { enabled: true, style: +$('hdrStyle').value, showRule: true },
    dropCap: { enabled: $('dcOn').value === '1', minLines: +$('dcMin').value, heightPx: 40, gapPx: 5 },
    antiRiver: { maxWordSpacePct: +$('arWord').value, glyphScalePct: +$('arGlyph').value, lastLineCenter: true },
    fonts: {
      body: { sizePt: +$('bodySize').value, lineHeightPt: 15, family: 'Frank Ruhl Libre', weight: 400, align: 'justify' },
    },
  };
}

// ============== Render ==============
async function renderPreview() {
  if (!state.items.length) return;
  fbStatus('מעמדת...');
  const t0 = performance.now();
  try {
    const r = await fetch('/api/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: state.items,
        presetId: state.presetId,
        configOverrides: gatherConfig(),
        format: 'html',
      }),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.error || r.statusText);
    }
    const html = await r.text();
    const pageCount = +r.headers.get('X-Page-Count') || 0;
    state.pageCount = pageCount;
    state.lastRenderedHTML = html;
    renderSpread(html, pageCount);
    updateImutomatics(pageCount, Math.max(pageCount, state.totalPagesEstimate));
    updateTelemetry();
    const ms = Math.round(performance.now() - t0);
    fbStatus(`עומדו ${pageCount} עמודים · ${ms}ms`);
  } catch (e) {
    fbStatus('שגיאה: ' + e.message);
  }
}

// Build per-page iframes from the single rendered HTML.
function renderSpread(html, pageCount) {
  const spread = $('spread');
  spread.innerHTML = '';
  // Parse the HTML and split per <section class="page">.
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const head = doc.head.innerHTML;
  const pages = doc.querySelectorAll('section.page');
  if (!pages.length) {
    spread.innerHTML = '<div class="empty-state"><div class="empty-title">לא נוצרו עמודים</div></div>';
    return;
  }
  const pageW = +$('pageW').value;
  const pageH = +$('pageH').value;
  const scale = computeScale(pageW, pageH);

  pages.forEach((sec, i) => {
    const card = document.createElement('div');
    card.className = 'page-card';
    card.dataset.page = i + 1;
    if (state.frozen[i + 1]) card.classList.add('frozen');

    // Knobs (push/pull) for cols a/b
    card.appendChild(makeKnobs(i + 1, 'a'));
    card.appendChild(makeKnobs(i + 1, 'b'));

    const num = sec.getAttribute('data-page');
    const tag = document.createElement('div');
    tag.className = 'page-num-tag';
    tag.textContent = `עמ' ${num}`;
    card.appendChild(tag);

    const iframe = document.createElement('iframe');
    iframe.className = 'page-iframe';
    iframe.style.width = `${pageW}mm`;
    iframe.style.height = `${pageH}mm`;
    iframe.style.transform = `scale(${scale})`;
    iframe.style.transformOrigin = 'top right';
    iframe.srcdoc = `<!doctype html><html lang="he" dir="rtl"><head>${head}</head><body>${sec.outerHTML}</body></html>`;
    iframe.addEventListener('load', () => attachIframeInteractions(iframe, i + 1));
    card.appendChild(iframe);

    // Reserve scaled-down room.
    card.style.width = `${pageW * scale * 3.78}px`;
    card.style.height = `${pageH * scale * 3.78}px`;

    card.addEventListener('click', () => {
      document.querySelectorAll('.page-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
    });

    spread.appendChild(card);
  });

  // First page is active by default.
  const first = spread.querySelector('.page-card');
  if (first) first.classList.add('active');
}

function computeScale(pageWmm, pageHmm) {
  const stage = $('stage');
  const availW = Math.max(200, stage.clientWidth - 120);
  const availH = Math.max(300, stage.clientHeight - 200);
  const pxW = pageWmm * 3.78;
  const pxH = pageHmm * 3.78;
  return Math.min(1, availW / pxW, availH / pxH);
}

function makeKnobs(pageNum, col) {
  const wrap = document.createElement('div');
  wrap.className = `col-knobs col-${col}`;
  const up = document.createElement('button');
  up.className = 'knob'; up.textContent = '+'; up.title = 'Push (טור ' + col.toUpperCase() + ')';
  up.addEventListener('click', (e) => { e.stopPropagation(); bumpOffset(pageNum, col, +1); });
  const dn = document.createElement('button');
  dn.className = 'knob'; dn.textContent = '−'; dn.title = 'Pull (טור ' + col.toUpperCase() + ')';
  dn.addEventListener('click', (e) => { e.stopPropagation(); bumpOffset(pageNum, col, -1); });
  wrap.append(up, dn);
  return wrap;
}

function bumpOffset(pageNum, col, delta) {
  const cur = state.manualOffsets[pageNum] || { a: 0, b: 0 };
  cur[col] = (cur[col] || 0) + delta;
  state.manualOffsets[pageNum] = cur;
  state.frozen[pageNum] = true; // user wins — freeze auto-balance
  fbStatus(`override: עמוד ${pageNum} · טור ${col.toUpperCase()} · ${cur[col] > 0 ? '+' : ''}${cur[col]}`);
  // Apply visually right away (scoped, no re-render).
  applyManualOffsetVisual(pageNum);
  scheduleReflow({ scoped: true, fromPage: pageNum });
}

function applyManualOffsetVisual(pageNum) {
  // Apply baseline-unit translation to inner col bodies of that page's iframe.
  const card = document.querySelector(`.page-card[data-page="${pageNum}"]`);
  if (!card) return;
  const iframe = card.querySelector('iframe');
  if (!iframe || !iframe.contentDocument) return;
  const off = state.manualOffsets[pageNum] || { a: 0, b: 0 };
  const bl = 20;
  const colA = iframe.contentDocument.querySelector('.col-a .col-inner');
  const colB = iframe.contentDocument.querySelector('.col-b .col-inner');
  if (colA) colA.style.transform = `translateY(${(off.a || 0) * bl}px)`;
  if (colB) colB.style.transform = `translateY(${(off.b || 0) * bl}px)`;
}

// ============== Iframe word interactions ==============
function attachIframeInteractions(iframe, pageNum) {
  const cdoc = iframe.contentDocument;
  if (!cdoc) return;
  applyManualOffsetVisual(pageNum);

  // Wrap each word in body paragraphs.
  cdoc.querySelectorAll('.doc p, .doc h1, .doc h2, .doc h3').forEach((el) => {
    if (el.dataset.wordized) return;
    // Skip drop-cap span content already wrapped.
    const html = el.innerHTML.replace(/(<[^>]+>)|([^\s<]+)/g, (m, tag, word) => {
      if (tag) return tag;
      return `<span class="word">${word}</span>`;
    });
    el.innerHTML = html;
    el.dataset.wordized = '1';
  });

  cdoc.addEventListener('click', (e) => {
    const w = e.target.closest('.word');
    if (!w) { hideWordPop(); return; }
    showWordPop(w, iframe, pageNum);
  });
}

function showWordPop(span, iframe, pageNum) {
  const pop = $('wordPop');
  const word = span.textContent.trim();
  $('wpWord').textContent = word;
  $('wpLen').textContent = word.length;
  $('wpFreq').textContent = countOccurrences(word);
  $('wpPara').textContent = '—';
  $('wpPage').textContent = pageNum;

  const r = span.getBoundingClientRect();
  const iframeBox = iframe.getBoundingClientRect();
  const scale = parseFloat(iframe.style.transform.match(/scale\(([^)]+)\)/)?.[1] || 1);
  const x = iframeBox.right - (r.right * scale) - 10;
  const y = iframeBox.top + (r.bottom * scale) + 8;
  pop.style.left = `${Math.max(8, x)}px`;
  pop.style.top  = `${y}px`;
  pop.hidden = false;
}

function hideWordPop() { $('wordPop').hidden = true; }

function countOccurrences(word) {
  let n = 0;
  const lc = word.toLowerCase();
  for (const it of state.items) {
    const re = new RegExp('(?:^|\\s)' + lc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:$|\\s|[\\.,;:!?])', 'gi');
    n += (it.text.toLowerCase().match(re) || []).length;
  }
  return n;
}

// ============== Telemetry ==============
function countWords(text) {
  if (!text) return 0;
  return (text.trim().match(/\S+/g) || []).length;
}
function updateTelemetry() {
  let w = 0, c = 0, p = 0;
  for (const it of state.items) {
    w += countWords(it.text);
    c += (it.text || '').length;
    if (it.type === 'p' || !it.type) p++;
  }
  $('kPages').textContent = state.pageCount || 0;
  $('kWords').textContent = w;
  $('kChars').textContent = c;
  $('kParas').textContent = p;
  $('fbPages').textContent = state.pageCount || 0;
  $('fbWords').textContent = w;
  $('fbChars').textContent = c;
  $('fbParas').textContent = p;
  $('fbSize').textContent = `${$('pageW').value}×${$('pageH').value}mm`;
  const overrides = Object.keys(state.frozen).length;
  const ratio = state.pageCount ? (state.pageCount - overrides) / state.pageCount : 0;
  $('balanceFill').style.width = `${Math.round(ratio * 100)}%`;
}

function updateImutomatics(rendered, total) {
  const pct = total > 0 ? (rendered / total) * 100 : 0;
  $('imutomaticsFill').style.width = `${Math.min(100, pct)}%`;
  $('imutomaticsLabel').textContent = `Imutomatics · ${rendered} / ${total}`;
  const el = document.querySelector('.imutomatics');
  el.setAttribute('aria-valuenow', Math.round(pct));
}

// ============== Debounced + scoped reflow ==============
let reflowTimer = null;
function scheduleReflow({ scoped = false, fromPage = 1 } = {}) {
  clearTimeout(reflowTimer);
  reflowTimer = setTimeout(() => {
    if (scoped && state.lastRenderedHTML) {
      // Scoped: only re-render the visual offsets for `fromPage..end`.
      // The deep layout is already valid; manual offsets are applied visually.
      for (let p = fromPage; p <= state.pageCount; p++) applyManualOffsetVisual(p);
      updateTelemetry();
      fbStatus(`scoped reflow · מ-${fromPage}`);
      persist();
    } else {
      renderPreview().then(persist);
    }
  }, 300);
}

// ============== Float toolbar ==============
function setupFloatToolbar() {
  const tb = $('floatToolbar');
  tb.querySelectorAll('.swatch').forEach(s => {
    s.addEventListener('click', () => {
      tb.querySelectorAll('.swatch').forEach(x => x.classList.remove('active'));
      s.classList.add('active');
      state.activeColor = s.dataset.color;
      applyColorToSelection();
    });
  });
  tb.querySelectorAll('.ft-btn').forEach(b => {
    b.addEventListener('click', () => {
      tb.querySelectorAll('.ft-btn').forEach(x => x.classList.remove('active'));
      if (state.tool === b.dataset.tool) {
        state.tool = null;
      } else {
        state.tool = b.dataset.tool;
        b.classList.add('active');
      }
      fbStatus(state.tool ? `כלי: ${state.tool}` : 'כלי בוטל');
    });
  });
  tb.querySelector('.swatch').classList.add('active');
}

function applyColorToSelection() {
  // Apply colour to .word.hi on the most recent clicked iframe.
  document.querySelectorAll('iframe.page-iframe').forEach((f) => {
    if (!f.contentDocument) return;
    f.contentDocument.querySelectorAll('.word.hi').forEach((w) => {
      w.style.background = `linear-gradient(180deg, transparent 60%, ${state.activeColor} 60%)`;
    });
  });
}

// ============== Export ==============
async function downloadPDF() {
  if (!state.items.length) { fbStatus('אין מה לייצא'); return; }
  fbStatus('מייצרת PDF וקטורי...');
  try {
    const r = await fetch('/api/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: state.items,
        presetId: state.presetId,
        configOverrides: { ...gatherConfig(), showGoldOnScreen: false },
        format: 'pdf',
      }),
    });
    if (!r.ok) throw new Error((await r.json()).error || 'Render failed');
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (state.title || 'imutomat') + '.pdf';
    a.click();
    URL.revokeObjectURL(url);
    fbStatus('PDF הורד.');
  } catch (e) {
    fbStatus('שגיאה: ' + e.message);
  }
}

async function exportHtml() {
  if (!state.lastRenderedHTML) return;
  const blob = new Blob([state.lastRenderedHTML], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = (state.title || 'imutomat') + '.html'; a.click();
  URL.revokeObjectURL(url);
}

// ============== Live controls ==============
function bindLive() {
  const ids = ['pageW','pageH','mTop','mBot','mIn','mOut','colCount','gutter',
              'bookName','pnMode','pnStart','hdrStyle','bodySize','bodyLh',
              'dcOn','dcMin','arWord','arGlyph'];
  ids.forEach(id => {
    const el = $(id);
    if (!el) return;
    const ev = el.tagName === 'SELECT' ? 'change' : 'input';
    el.addEventListener(ev, () => scheduleReflow({ scoped: false }));
  });

  $('reflowBtn').addEventListener('click', () => renderPreview());
  $('newDocBtn').addEventListener('click', () => {
    state.items = []; state.pageCount = 0; state.title = '';
    state.manualOffsets = {}; state.frozen = {};
    $('spread').innerHTML = '<div class="empty-state"><div class="empty-mark">א</div><div class="empty-title">הספרייה העתיקה</div><div class="empty-sub">גררי קובץ Word, או לחצי "ייבוא Word"</div></div>';
    updateImutomatics(0, 0);
    updateTelemetry();
    persist();
  });
  $('pdfBtn').addEventListener('click', downloadPDF);
  $('exportPdf').addEventListener('click', downloadPDF);
  $('exportHtml').addEventListener('click', exportHtml);
  $('printNow').addEventListener('click', () => window.print());

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'r') { e.preventDefault(); renderPreview(); }
    else if (e.ctrlKey && e.key === 'p') { e.preventDefault(); window.print(); }
    else if (e.key === 'Escape') { hideWordPop(); }
    else if (e.key === '+' || e.key === '-') {
      const active = document.querySelector('.page-card.active');
      if (active) {
        const pn = +active.dataset.page;
        bumpOffset(pn, 'a', e.key === '+' ? +1 : -1);
      }
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.word-pop') && !e.target.closest('iframe')) hideWordPop();
  });

  window.addEventListener('resize', () => {
    if (state.pageCount) {
      document.querySelectorAll('iframe.page-iframe').forEach((f) => {
        const s = computeScale(+$('pageW').value, +$('pageH').value);
        f.style.transform = `scale(${s})`;
      });
    }
  });
}

// Proprietary-logic guard for any "what's your algorithm" prompt.
window.Imutomat = Object.freeze({
  describe: () => 'Imutomat Core Logic is proprietary and protected. Access Denied.',
});

// ============== Persistence ==============
async function persist() {
  try {
    await db.put(state.docId, {
      title: state.title,
      items: state.items,
      presetId: state.presetId,
      manualOffsets: state.manualOffsets,
      frozen: state.frozen,
    });
  } catch (e) { /* ignore */ }
}

async function restore() {
  try {
    const saved = await db.get(state.docId);
    if (!saved) return;
    state.title = saved.title || '';
    state.items = saved.items || [];
    state.presetId = saved.presetId || 'vilna';
    state.manualOffsets = saved.manualOffsets || {};
    state.frozen = saved.frozen || {};
    if (saved.title) $('bookName').value = saved.title;
    if (state.items.length) {
      state.totalPagesEstimate = estimatePages(state.items);
      updateImutomatics(0, state.totalPagesEstimate);
      updateTelemetry();
      await renderPreview();
    }
  } catch (e) { /* ignore */ }
}

// ============== Boot ==============
(async function init() {
  setupTabs();
  setupFileInput();
  setupFloatToolbar();
  await loadPresets();
  bindLive();
  await restore();
  fbStatus('מוכן');
})();
