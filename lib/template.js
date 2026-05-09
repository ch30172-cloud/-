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
      body:     { family: 'Frank Ruhl Libre', sizePt: 11, lineHeightPt: 14, weight: 400, align: 'justify', color: '#1a1a1a' },
      h1:       { family: 'Frank Ruhl Libre', sizePt: 22, lineHeightPt: 28, weight: 700, align: 'center',  color: '#1a1a1a', spaceBeforeMm: 4, spaceAfterMm: 4 },
      h2:       { family: 'Frank Ruhl Libre', sizePt: 14, lineHeightPt: 18, weight: 700, align: 'center',  color: '#1a1a1a', spaceBeforeMm: 2, spaceAfterMm: 1 },
      h3:       { family: 'Frank Ruhl Libre', sizePt: 12, lineHeightPt: 16, weight: 700, align: 'right',   color: '#1a1a1a', spaceBeforeMm: 1.5, spaceAfterMm: 0.5 },
      ornament: { family: 'Frank Ruhl Libre', sizePt: 14, weight: 400, color: '#666' },
    },
    indentFirstLineMm: 4,
  };
  return deepMerge(base, overrides);
}

function deepMerge(a, b) {
  if (!b) return a;
  const out = Array.isArray(a) ? a.slice() : { ...a };
  for (const k of Object.keys(b)) {
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
  const colCount = config.columns.count || 2;
  const gutter = mmToPx(config.columns.gutterMm);
  const colW = (contentW - gutter * (colCount - 1)) / colCount;
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

const HEBREW_NUMERALS = ['', 'א','ב','ג','ד','ה','ו','ז','ח','ט','י','יא','יב','יג','יד','טו','טז','יז','יח','יט','כ'];

function hebrewNumeral(n) {
  if (n <= 0) return '';
  if (n <= 20) return HEBREW_NUMERALS[n];
  const tens = ['', 'י','כ','ל','מ','נ','ס','ע','פ','צ'];
  const ones = ['', 'א','ב','ג','ד','ה','ו','ז','ח','ט'];
  const hundreds = ['', 'ק','ר','ש','ת'];
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

function fontStack(family) {
  return `'${family}', 'Frank Ruhl Libre', 'Noto Serif Hebrew', serif`;
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
      font-family: ${fontStack(f.body.family)};
      font-size: ${f.body.sizePt}pt;
      line-height: ${f.body.lineHeightPt}pt;
      direction: rtl;
      color: ${f.body.color};
      font-weight: ${f.body.weight};
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
    }
    .page.right .page-content { right: ${g.marginInsidePx}px; }
    .page.left  .page-content { right: ${g.marginOutsidePx}px; }

    .span-top {
      width: 100%;
      margin-bottom: ${ptToPx(f.h1.lineHeightPt) * 0.3}px;
    }
    .span-top h1 {
      font-family: ${fontStack(f.h1.family)};
      font-size: ${f.h1.sizePt}pt;
      line-height: ${f.h1.lineHeightPt}pt;
      font-weight: ${f.h1.weight};
      text-align: center;
      color: ${f.h1.color};
      margin: 0;
      padding: 0;
    }

    .cols {
      display: flex;
      flex-direction: row;
      gap: ${g.gutterPx}px;
      align-items: flex-start;
    }
    .col {
      width: ${g.columnWidthPx}px;
      position: relative;
    }
    .col-inner { width: 100%; }

    .running-header {
      position: absolute;
      top: ${g.marginTopPx * 0.4}px;
      left: ${g.marginOutsidePx}px;
      right: ${g.marginInsidePx}px;
      width: ${g.contentWidthPx}px;
      font-family: ${fontStack(config.runningHeader.fontFamily)};
      font-size: ${config.runningHeader.fontSizePt}pt;
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      ${config.runningHeader.showRule ? `border-bottom: 0.5pt solid #999; padding-bottom: 4px;` : ''}
    }
    .page.right .running-header { left: ${g.marginInsidePx}px; right: ${g.marginOutsidePx}px; }
    .running-header .page-num {
      font-family: ${fontStack(config.pageNumber.fontFamily)};
      font-size: ${config.pageNumber.fontSizePt}pt;
      font-weight: 600;
    }

    p, h1, h2, h3 { margin: 0; padding: 0; }
    .doc h2 {
      font-family: ${fontStack(f.h2.family)};
      font-size: ${f.h2.sizePt}pt;
      line-height: ${f.h2.lineHeightPt}pt;
      font-weight: ${f.h2.weight};
      text-align: ${f.h2.align};
      color: ${f.h2.color};
      margin-top: ${mmToPx(f.h2.spaceBeforeMm || 0)}px;
      margin-bottom: ${mmToPx(f.h2.spaceAfterMm || 0)}px;
    }
    .doc h3 {
      font-family: ${fontStack(f.h3.family)};
      font-size: ${f.h3.sizePt}pt;
      line-height: ${f.h3.lineHeightPt}pt;
      font-weight: ${f.h3.weight};
      text-align: ${f.h3.align};
      color: ${f.h3.color};
      margin-top: ${mmToPx(f.h3.spaceBeforeMm || 0)}px;
      margin-bottom: ${mmToPx(f.h3.spaceAfterMm || 0)}px;
    }
    .doc p {
      text-align: ${f.body.align};
      text-indent: ${config.indentFirstLineMm}mm;
      hyphens: auto;
      hanging-punctuation: first last;
      color: ${f.body.color};
    }
    .doc p.no-indent { text-indent: 0; }
    .doc .ornament {
      text-align: center;
      font-family: ${fontStack(f.ornament.family)};
      font-size: ${f.ornament.sizePt}pt;
      color: ${f.ornament.color};
      margin: ${ptToPx(f.body.lineHeightPt) * 0.5}px 0;
    }
    .doc h2 + p, .doc h3 + p { text-indent: 0; }

    /* Measure-mode container: single column at column-width */
    .measure {
      width: ${g.columnWidthPx}px;
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
<link href="https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@400;500;700&family=Noto+Serif+Hebrew:wght@400;500;700&family=Heebo:wght@400;500;700&family=Assistant:wght@400;500;700&display=swap" rel="stylesheet">
<style>${commonCSS(config)}</style>
</head>
<body>
  <div class="doc measure">${blocks}</div>
</body>
</html>`;
}

function buildPagedDoc({ pages, items, config }) {
  const startAt = config.pageNumber.startAt || 1;
  const pageHTML = pages.map((p, idx) => {
    const num = startAt + idx;
    const side = num % 2 === 1 ? 'right' : 'left';
    const colA = renderColumn(p.colA, items, p.slackPerGapA);
    const colB = renderColumn(p.colB, items, p.slackPerGapB);
    const span = renderSpanTop(p.spanTop, items);
    const header = renderHeader(num, side, items, p, config);
    return `<section class="page ${side}" data-page="${num}">
      ${header}
      <div class="page-content">
        ${span}
        <div class="cols">
          <div class="col col-a"><div class="col-inner doc">${colA}</div></div>
          <div class="col col-b"><div class="col-inner doc">${colB}</div></div>
        </div>
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
<link href="https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@400;500;700&family=Noto+Serif+Hebrew:wght@400;500;700&family=Heebo:wght@400;500;700&family=Assistant:wght@400;500;700&display=swap" rel="stylesheet">
<style>${commonCSS(config)}</style>
</head>
<body>
${pageHTML}
</body>
</html>`;
}

function renderSpanTop(spanLines, items) {
  if (!spanLines || spanLines.length === 0) return '';
  const idx = spanLines[0].itemIdx;
  const item = items[idx];
  const text = escapeHTML(item.text || '');
  return `<div class="span-top"><h1>${text}</h1></div>`;
}

function renderColumn(linesInCol, items, slackPerGapPx) {
  if (!linesInCol || linesInCol.length === 0) return '';
  // Group consecutive lines belonging to the same item.
  const groups = [];
  let cur = null;
  for (const ln of linesInCol) {
    if (!cur || cur.itemIdx !== ln.itemIdx) {
      cur = { itemIdx: ln.itemIdx, itemType: ln.itemType, lines: [] };
      groups.push(cur);
    }
    cur.lines.push(ln);
  }

  const gapPx = Math.max(0, slackPerGapPx || 0);
  return groups.map((g, gi) => {
    const item = items[g.itemIdx];
    const text = (item.text || '').slice(g.lines[0].chunkStart, g.lines[g.lines.length - 1].chunkEnd);
    const isContinuation = !g.lines[0].isFirst;
    const extraStyle = gi > 0 && gapPx > 0
      ? ` style="margin-top: calc(var(--orig-margin, 0px) + ${gapPx}px)"`
      : '';
    return renderItem({ ...item, text }, isContinuation, extraStyle);
  }).join('');
}

function renderItem(item, isContinuation, extraStyle = '') {
  const t = escapeHTML(item.text);
  const noIndentClass = isContinuation && (item.type === 'p' || !item.type) ? ' no-indent' : '';
  switch (item.type) {
    case 'title':
    case 'h1':       return `<h1${extraStyle}>${t}</h1>`;
    case 'h2':       return `<h2${extraStyle}>${t}</h2>`;
    case 'h3':       return `<h3${extraStyle}>${t}</h3>`;
    case 'ornament': return `<p class="ornament"${extraStyle}>${t}</p>`;
    default:         return `<p class="${noIndentClass.trim()}"${extraStyle}>${t}</p>`;
  }
}

function itemToHTML(item, i, forMeasure) {
  const breakBefore = forMeasure && (item.type === 'h1' || item.type === 'title') ? 1 : 0;
  const t = escapeHTML(item.text || '');
  const attrs = `data-item="${i}" data-type="${item.type}" data-break-before="${breakBefore}"`;
  switch (item.type) {
    case 'title':
    case 'h1':       return `<h1 ${attrs}>${t}</h1>`;
    case 'h2':       return `<h2 ${attrs}>${t}</h2>`;
    case 'h3':       return `<h3 ${attrs}>${t}</h3>`;
    case 'ornament': return `<p class="ornament" ${attrs}>${t}</p>`;
    default:         return `<p ${attrs}>${t}</p>`;
  }
}

function renderHeader(num, side, items, page, config) {
  if (!config.runningHeader.enabled) return '';
  const label = pageLabel(num, config.pageNumber.mode);
  const book = escapeHTML(config.bookName || '');
  const chapterTitle = escapeHTML(findChapterForPage(items, page) || '');
  const style = config.runningHeader.style;
  let leftSide = '', center = '', rightSide = '';
  if (style === 1) { rightSide = book; leftSide = `<span class="page-num">${label}</span>`; }
  else if (style === 2) { rightSide = book; center = chapterTitle; leftSide = `<span class="page-num">${label}</span>`; }
  else if (style === 3) { center = chapterTitle; leftSide = `<span class="page-num">${label}</span>`; }

  const a = side === 'right' ? rightSide : leftSide;
  const c = center;
  const b = side === 'right' ? leftSide : rightSide;
  return `<div class="running-header">
    <span class="hdr-right">${a}</span>
    <span class="hdr-center">${c}</span>
    <span class="hdr-left">${b}</span>
  </div>`;
}

function findChapterForPage(items, page) {
  if (page.spanTop && page.spanTop[0]) return items[page.spanTop[0].itemIdx]?.text || '';
  const all = [...(page.colA || []), ...(page.colB || [])];
  for (const ln of all) {
    if (ln.itemType === 'h1' || ln.itemType === 'title') return items[ln.itemIdx]?.text || '';
  }
  const startIdx = all[0]?.itemIdx ?? 0;
  for (let i = startIdx; i >= 0; i--) {
    if (items[i] && (items[i].type === 'h1' || items[i].type === 'title')) return items[i].text;
  }
  return '';
}

function escapeHTML(s) {
  return String(s == null ? '' : s)
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
