function defaultConfig(overrides = {}) {
  const base = {
    title: 'מסמך',
    bookName: 'מזבח אדמה',
    pageSize: { widthMm: 148, heightMm: 210 },
    margins: { topMm: 18, bottomMm: 18, insideMm: 16, outsideMm: 14 },
    columns: { count: 2, gutterMm: 6 },
    runningHeader: {
      enabled: true,
      style: 1,
      fontFamily: 'Frank Ruhl Libre',
      fontSizePt: 11,
      showRule: true,
    },
    pageNumber: {
      enabled: true,
      mode: 'hebrew',
      fontFamily: 'Frank Ruhl Libre',
      fontSizePt: 11,
      startAt: 1,
    },
    fonts: {
      body: { family: 'Frank Ruhl Libre', sizePt: 11, lineHeightPt: 14, weight: 400, align: 'justify' },
      h1:   { family: 'Frank Ruhl Libre', sizePt: 20, lineHeightPt: 26, weight: 700, align: 'center' },
      h2:   { family: 'Frank Ruhl Libre', sizePt: 14, lineHeightPt: 18, weight: 700, align: 'center' },
      h3:   { family: 'Frank Ruhl Libre', sizePt: 12, lineHeightPt: 16, weight: 700, align: 'right' },
      ornament: { family: 'Frank Ruhl Libre', sizePt: 14, weight: 400, color: '#666' },
    },
    breakH1OnNewPage: true,
    indentFirstLineMm: 4,
    spacingMm: { afterH1: 4, afterH2: 2, afterH3: 1.5, beforeH2: 3, beforeH3: 2 },
  };
  return deepMerge(base, overrides);
}

function deepMerge(a, b) {
  const out = Array.isArray(a) ? a.slice() : { ...a };
  for (const k of Object.keys(b || {})) {
    if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object') {
      out[k] = deepMerge(a[k], b[k]);
    } else {
      out[k] = b[k];
    }
  }
  return out;
}

function mmToPx(mm) { return (mm / 25.4) * 96; }
function ptToPx(pt) { return (pt / 72) * 96; }

function computeGeometry(config) {
  const pageW = mmToPx(config.pageSize.widthMm);
  const pageH = mmToPx(config.pageSize.heightMm);
  const top = mmToPx(config.margins.topMm);
  const bottom = mmToPx(config.margins.bottomMm);
  const inside = mmToPx(config.margins.insideMm);
  const outside = mmToPx(config.margins.outsideMm);
  const contentW = pageW - inside - outside;
  const contentH = pageH - top - bottom;
  const gutter = mmToPx(config.columns.gutterMm);
  const colW = (contentW - gutter * (config.columns.count - 1)) / config.columns.count;
  return {
    pageWidthPx: pageW,
    pageHeightPx: pageH,
    contentWidthPx: contentW,
    contentHeightPx: contentH,
    columnWidthPx: colW,
    columnHeightPx: contentH,
    gutterPx: gutter,
    marginTopPx: top,
    marginBottomPx: bottom,
    marginInsidePx: inside,
    marginOutsidePx: outside,
  };
}

const HEBREW_NUMERALS = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 'יא', 'יב', 'יג', 'יד', 'טו', 'טז', 'יז', 'יח', 'יט', 'כ'];

function hebrewNumeral(n) {
  if (n <= 0) return '';
  if (n <= 20) return HEBREW_NUMERALS[n];
  const tens = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
  const ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
  const hundreds = ['', 'ק', 'ר', 'ש', 'ת'];
  let s = '';
  let r = n;
  while (r >= 400) { s += 'ת'; r -= 400; }
  if (r >= 100) { s += hundreds[Math.floor(r / 100)]; r %= 100; }
  if (r === 15) return s + 'טו';
  if (r === 16) return s + 'טז';
  if (r >= 10) { s += tens[Math.floor(r / 10)]; r %= 10; }
  if (r > 0) s += ones[r];
  if (s.length >= 2) s = s.slice(0, -1) + '"' + s.slice(-1);
  else if (s.length === 1) s = s + "'";
  return s;
}

function pageLabel(n, mode) {
  if (mode === 'hebrew') return hebrewNumeral(n);
  if (mode === 'hebrew-spread') {
    return hebrewNumeral(Math.ceil(n / 2)) + (n % 2 === 1 ? '.' : ':');
  }
  return String(n);
}

function commonCSS(config) {
  const g = computeGeometry(config);
  const f = config.fonts;
  return `
    @page {
      size: ${config.pageSize.widthMm}mm ${config.pageSize.heightMm}mm;
      margin: 0;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #f4f1ea; }
    body {
      font-family: '${f.body.family}', 'Frank Ruhl Libre', 'Noto Serif Hebrew', serif;
      font-size: ${f.body.sizePt}pt;
      line-height: ${f.body.lineHeightPt}pt;
      direction: rtl;
      color: #1a1a1a;
    }
    .page {
      position: relative;
      width: ${config.pageSize.widthMm}mm;
      height: ${config.pageSize.heightMm}mm;
      background: #fff;
      page-break-after: always;
      break-after: page;
      overflow: hidden;
    }
    .page:last-child { page-break-after: auto; break-after: auto; }
    .page-content {
      position: absolute;
      top: ${g.marginTopPx}px;
      bottom: ${g.marginBottomPx}px;
      width: ${g.contentWidthPx}px;
      display: flex;
      flex-direction: row;
      gap: ${g.gutterPx}px;
    }
    .page.right .page-content { right: ${g.marginInsidePx}px; }
    .page.left  .page-content { right: ${g.marginOutsidePx}px; }
    .col {
      width: ${g.columnWidthPx}px;
      height: ${g.columnHeightPx}px;
      overflow: hidden;
      position: relative;
    }
    .col-inner {
      position: absolute;
      top: 0; right: 0; left: 0;
      width: 100%;
    }
    .running-header {
      position: absolute;
      top: ${g.marginTopPx * 0.4}px;
      left: ${g.marginOutsidePx}px;
      right: ${g.marginInsidePx}px;
      width: ${g.contentWidthPx}px;
      font-family: '${config.runningHeader.fontFamily}', serif;
      font-size: ${config.runningHeader.fontSizePt}pt;
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      ${config.runningHeader.showRule ? `border-bottom: 0.5pt solid #999; padding-bottom: 4px;` : ''}
    }
    .page.right .running-header { left: ${g.marginInsidePx}px; right: ${g.marginOutsidePx}px; }
    .running-header .page-num {
      font-family: '${config.pageNumber.fontFamily}', serif;
      font-size: ${config.pageNumber.fontSizePt}pt;
      font-weight: 600;
    }
    p, h1, h2, h3 { margin: 0; padding: 0; }
    .doc h1 {
      font-family: '${f.h1.family}', serif;
      font-size: ${f.h1.sizePt}pt;
      line-height: ${f.h1.lineHeightPt}pt;
      font-weight: ${f.h1.weight};
      text-align: ${f.h1.align};
      margin-top: ${ptToPx(f.h1.lineHeightPt) * 0.4}px;
      margin-bottom: ${ptToPx(f.h1.lineHeightPt) * 0.4}px;
    }
    .doc h2 {
      font-family: '${f.h2.family}', serif;
      font-size: ${f.h2.sizePt}pt;
      line-height: ${f.h2.lineHeightPt}pt;
      font-weight: ${f.h2.weight};
      text-align: ${f.h2.align};
      margin-top: ${ptToPx(f.h2.lineHeightPt) * 0.5}px;
      margin-bottom: ${ptToPx(f.h2.lineHeightPt) * 0.25}px;
    }
    .doc h3 {
      font-family: '${f.h3.family}', serif;
      font-size: ${f.h3.sizePt}pt;
      line-height: ${f.h3.lineHeightPt}pt;
      font-weight: ${f.h3.weight};
      text-align: ${f.h3.align};
      margin-top: ${ptToPx(f.h3.lineHeightPt) * 0.4}px;
      margin-bottom: ${ptToPx(f.h3.lineHeightPt) * 0.2}px;
    }
    .doc p {
      text-align: ${f.body.align};
      text-indent: ${config.indentFirstLineMm}mm;
      hyphens: auto;
      hanging-punctuation: first last;
      word-spacing: 0.01em;
    }
    .doc p.no-indent { text-indent: 0; }
    .doc .ornament {
      text-align: center;
      font-family: '${f.ornament.family}', serif;
      font-size: ${f.ornament.sizePt}pt;
      color: ${f.ornament.color};
      margin: ${ptToPx(f.body.lineHeightPt) * 0.5}px 0;
    }
    .doc h1 + p, .doc h2 + p, .doc h3 + p { text-indent: 0; }

    /* Measure-mode container: single column at column-width */
    .measure {
      width: ${g.columnWidthPx}px;
      padding: 0;
      direction: rtl;
    }
  `;
}

function buildMeasureDoc({ items, config }) {
  const blocks = items.map((it, i) => itemToHTML(it, i, /*forMeasure*/true)).join('\n');
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@400;500;700&family=Noto+Serif+Hebrew:wght@400;500;700&display=swap" rel="stylesheet">
<style>${commonCSS(config)}</style>
</head>
<body>
  <div class="doc measure">
    ${blocks}
  </div>
</body>
</html>`;
}

function buildPagedDoc({ pages, items, config }) {
  const startAt = config.pageNumber.startAt || 1;
  const pageHTML = pages.map((p, idx) => {
    const num = startAt + idx;
    const side = num % 2 === 1 ? 'right' : 'left';
    const colA = renderColumn(p.colA, items, config);
    const colB = renderColumn(p.colB, items, config);
    const header = renderHeader(num, side, items, p, config);
    return `<section class="page ${side}" data-page="${num}">
      ${header}
      <div class="page-content">
        <div class="col col-a"><div class="col-inner doc">${colA}</div></div>
        <div class="col col-b"><div class="col-inner doc">${colB}</div></div>
      </div>
    </section>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8">
<title>${escapeHTML(config.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@400;500;700&family=Noto+Serif+Hebrew:wght@400;500;700&display=swap" rel="stylesheet">
<style>${commonCSS(config)}</style>
</head>
<body>
${pageHTML}
</body>
</html>`;
}

function renderColumn(linesInCol, items, config) {
  if (!linesInCol || linesInCol.length === 0) return '';
  const groups = [];
  let cur = null;
  for (const ln of linesInCol) {
    if (!cur || cur.itemIdx !== ln.itemIdx) {
      cur = { itemIdx: ln.itemIdx, itemType: ln.itemType, lines: [] };
      groups.push(cur);
    }
    cur.lines.push(ln);
  }

  return groups.map(g => {
    const item = items[g.itemIdx];
    const text = sliceItem(item, g.lines[0].chunkStart, g.lines[g.lines.length - 1].chunkEnd);
    const isContinuation = !g.lines[0].isFirst;
    const cls = isContinuation && g.itemType === 'p' ? 'no-indent' : '';
    return renderItem({ ...item, text }, cls);
  }).join('');
}

function sliceItem(item, start, end) {
  const text = item.text || '';
  return text.slice(start, end);
}

function renderItem(item, extraClass = '') {
  const cls = extraClass ? ` class="${extraClass}"` : '';
  const t = escapeHTML(item.text);
  switch (item.type) {
    case 'title':
    case 'h1': return `<h1${cls}>${t}</h1>`;
    case 'h2': return `<h2${cls}>${t}</h2>`;
    case 'h3': return `<h3${cls}>${t}</h3>`;
    case 'ornament': return `<p class="ornament${extraClass ? ' ' + extraClass : ''}">${t}</p>`;
    default: return `<p${cls}>${t}</p>`;
  }
}

function itemToHTML(item, i, forMeasure) {
  const breakBefore = forMeasure && item.type === 'h1' ? 1 : 0;
  const t = escapeHTML(item.text || '');
  const attrs = `data-item="${i}" data-type="${item.type}" data-break-before="${breakBefore}"`;
  switch (item.type) {
    case 'title': return `<h1 ${attrs}>${t}</h1>`;
    case 'h1':    return `<h1 ${attrs}>${t}</h1>`;
    case 'h2':    return `<h2 ${attrs}>${t}</h2>`;
    case 'h3':    return `<h3 ${attrs}>${t}</h3>`;
    case 'ornament': return `<p class="ornament" ${attrs}>${t}</p>`;
    default: return `<p ${attrs}>${t}</p>`;
  }
}

function renderHeader(num, side, items, page, config) {
  if (!config.runningHeader.enabled) return '';
  const label = pageLabel(num, config.pageNumber.mode);
  const book = escapeHTML(config.bookName || '');
  const chapterTitle = escapeHTML(findChapterForPage(items, page) || '');

  const style = config.runningHeader.style;
  let leftSide = '', center = '', rightSide = '';
  if (style === 1) { rightSide = book; center = ''; leftSide = `<span class="page-num">${label}</span>`; }
  else if (style === 2) { rightSide = book; center = chapterTitle; leftSide = `<span class="page-num">${label}</span>`; }
  else if (style === 3) { rightSide = ''; center = chapterTitle; leftSide = `<span class="page-num">${label}</span>`; }

  if (side === 'right') {
    return `<div class="running-header">
      <span class="hdr-right">${rightSide}</span>
      <span class="hdr-center">${center}</span>
      <span class="hdr-left">${leftSide}</span>
    </div>`;
  } else {
    return `<div class="running-header">
      <span class="hdr-right">${leftSide}</span>
      <span class="hdr-center">${center}</span>
      <span class="hdr-left">${rightSide}</span>
    </div>`;
  }
}

function findChapterForPage(items, page) {
  const allLines = [...(page.colA || []), ...(page.colB || [])];
  for (const ln of allLines) {
    if (ln.itemType === 'h1' || ln.itemType === 'title') return items[ln.itemIdx].text;
  }
  for (let i = (allLines[0]?.itemIdx || 0); i >= 0; i--) {
    if (items[i] && (items[i].type === 'h1' || items[i].type === 'title')) return items[i].text;
  }
  return '';
}

function escapeHTML(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = {
  defaultConfig,
  computeGeometry,
  buildMeasureDoc,
  buildPagedDoc,
  hebrewNumeral,
  pageLabel,
};
