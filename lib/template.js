// Imutomat — layout templates.
// Canonical page: 17×24 cm. Margins: top/bottom 2.5 cm, inside 2.0, outside 2.0,
// gutter 0.6, columns 6.2 cm each → 2.0 + 6.2 + 0.6 + 6.2 + 2.0 = 17.0 cm.
// Vertical net content: 24 − 2·2.5 = 19 cm.  Baseline grid: 20 px (15 pt).

const BASELINE_PX = 20;

function defaultConfig(overrides = {}) {
  const base = {
    title: 'מסמך',
    bookName: 'אִמותומאט',
    pageSize: { widthMm: 170, heightMm: 240 },
    margins: { topMm: 25, bottomMm: 25, insideMm: 20, outsideMm: 20 },
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
      body:     { family: 'Frank Ruhl Libre', sizePt: 11,   lineHeightPt: 15, weight: 400, align: 'justify', color: '#1a1a1a' },
      h1:       { family: 'Frank Ruhl Libre', sizePt: 22,   lineHeightPt: 30, weight: 700, align: 'center',  color: '#1a1a1a', spaceBeforeMm: 4, spaceAfterMm: 4 },
      h2:       { family: 'Frank Ruhl Libre', sizePt: 14,   lineHeightPt: 20, weight: 700, align: 'center',  color: '#1a1a1a', spaceBeforeMm: 2, spaceAfterMm: 1 },
      h3:       { family: 'Frank Ruhl Libre', sizePt: 12,   lineHeightPt: 15, weight: 700, align: 'right',   color: '#1a1a1a', spaceBeforeMm: 1.5, spaceAfterMm: 0.5 },
      footnote: { family: 'Frank Ruhl Libre', sizePt: 8.5,  lineHeightPt: 12, weight: 400, align: 'justify', color: '#1a1a1a' },
      ornament: { family: 'Frank Ruhl Libre', sizePt: 14,   weight: 400, color: '#666' },
    },
    indentFirstLineMm: 4,
    dropCap: { enabled: true, heightPx: 40, gapPx: 5, minLines: 3 },
    antiRiver: { maxWordSpacePct: 15, glyphScalePct: 1, lastLineCenter: true },
    baseline: BASELINE_PX,
    showGoldOnScreen: true,
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
function snapBaseline(px, baseline = BASELINE_PX) { return Math.ceil(px / baseline) * baseline; }

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
  const baseline = config.baseline || BASELINE_PX;
  return {
    pageWidthPx: pageW,
    pageHeightPx: pageH,
    contentWidthPx: contentW,
    contentHeightPx: snapBaseline(contentH, baseline),
    columnWidthPx: colW,
    columnHeightPx: snapBaseline(contentH, baseline),
    gutterPx: gutter,
    marginTopPx: top,
    marginBottomPx: bottom,
    marginInsidePx: inside,
    marginOutsidePx: outside,
    baseline,
  };
}

// Hebrew gematria — supports up to ת"ק (500) per spec, but handles 1..999 sensibly.
const ONES = ['', 'א','ב','ג','ד','ה','ו','ז','ח','ט'];
const TENS = ['', 'י','כ','ל','מ','נ','ס','ע','פ','צ'];
const HUNDREDS = ['', 'ק','ר','ש','ת'];

function hebrewNumeral(n) {
  if (n <= 0) return '';
  let s = '', r = n;
  while (r >= 500) { s += 'תק'; r -= 500; }
  if (r >= 100) { s += HUNDREDS[Math.floor(r / 100)]; r %= 100; }
  if (r === 15) s += 'טו';
  else if (r === 16) s += 'טז';
  else {
    if (r >= 10) { s += TENS[Math.floor(r / 10)]; r %= 10; }
    if (r > 0) s += ONES[r];
  }
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
  const bl = g.baseline;
  const goldGrad = 'linear-gradient(45deg, #bf953f, #fcf6ba, #b38728, #fbf5b7, #aa771c)';
  return `
    @page {
      size: ${config.pageSize.widthMm}mm ${config.pageSize.heightMm}mm;
      margin: 0;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #f7f4ec; }
    body {
      font-family: ${fontStack(f.body.family)};
      font-size: ${f.body.sizePt}pt;
      line-height: ${bl}px;
      direction: rtl;
      color: ${f.body.color};
      font-weight: ${f.body.weight};
      text-rendering: geometricPrecision;
      -webkit-font-smoothing: antialiased;
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
      margin-bottom: ${bl}px;
    }
    .span-top h1 {
      font-family: ${fontStack(f.h1.family)};
      font-size: ${f.h1.sizePt}pt;
      line-height: ${snapBaseline(ptToPx(f.h1.lineHeightPt), bl)}px;
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
      font-weight: 700;
    }
    /* 4-element classical sefer header: page-letter | section | tractate | book */
    .running-header.rh-style-4 {
      border-bottom: none;
      padding-bottom: 0;
      align-items: baseline;
      font-weight: 700;
    }
    .running-header.rh-style-4 .hdr-center {
      flex: 1;
      display: flex;
      justify-content: space-around;
      gap: 24px;
    }
    .running-header.rh-style-4 .hdr-section {
      font-family: ${fontStack(f.h1.family)};
      font-size: ${config.runningHeader.fontSizePt + 1}pt;
      font-weight: 700;
    }
    .running-header.rh-style-4 .hdr-tractate {
      font-family: ${fontStack(config.runningHeader.fontFamily)};
      font-size: ${config.runningHeader.fontSizePt}pt;
      font-weight: 400;
    }
    .running-header.rh-style-4 .hdr-right,
    .running-header.rh-style-4 .hdr-left {
      font-family: ${fontStack(f.h1.family)};
      font-size: ${config.runningHeader.fontSizePt + 2}pt;
      font-weight: 700;
    }

    p, h1, h2, h3 { margin: 0; padding: 0; }
    .doc p, .doc h2, .doc h3 { line-height: ${bl}px; }
    .doc h2 {
      font-family: ${fontStack(f.h2.family)};
      font-size: ${f.h2.sizePt}pt;
      line-height: ${snapBaseline(ptToPx(f.h2.lineHeightPt), bl)}px;
      font-weight: ${f.h2.weight};
      text-align: ${f.h2.align};
      color: ${f.h2.color};
      margin-top: ${snapBaseline(mmToPx(f.h2.spaceBeforeMm || 0), bl)}px;
      margin-bottom: ${snapBaseline(mmToPx(f.h2.spaceAfterMm || 0), bl)}px;
    }
    .doc h3 {
      font-family: ${fontStack(f.h3.family)};
      font-size: ${f.h3.sizePt}pt;
      line-height: ${snapBaseline(ptToPx(f.h3.lineHeightPt), bl)}px;
      font-weight: ${f.h3.weight};
      text-align: ${f.h3.align};
      color: ${f.h3.color};
      margin-top: ${snapBaseline(mmToPx(f.h3.spaceBeforeMm || 0), bl)}px;
      margin-bottom: ${snapBaseline(mmToPx(f.h3.spaceAfterMm || 0), bl)}px;
    }
    .doc p {
      text-align: ${f.body.align};
      text-align-last: ${config.antiRiver && config.antiRiver.lastLineCenter ? 'center' : 'right'};
      text-indent: ${config.indentFirstLineMm}mm;
      hyphens: auto;
      hanging-punctuation: first last;
      color: ${f.body.color};
      word-spacing: 0;
      /* Anti-river: cap inter-word stretch. Browsers honor this as a hint. */
      text-justify: inter-word;
    }
    .doc p.no-indent { text-indent: 0; }
    .doc .ornament {
      text-align: center;
      text-align-last: center;
      font-family: ${fontStack(f.ornament.family)};
      font-size: ${f.ornament.sizePt}pt;
      color: ${f.ornament.color};
      margin: ${bl}px 0;
      line-height: ${bl}px;
    }
    .doc h2 + p, .doc h3 + p { text-indent: 0; }

    /* Lead-word ("חלן"): inline bold opener — same line-height, no float,
       no colour change. Just heavier weight so the paragraph entry reads. */
    .doc p.dropcap { text-indent: ${config.indentFirstLineMm}mm; }
    .doc p.dropcap.no-indent { text-indent: 0; }
    .doc p.dropcap .dc-word {
      font-family: ${fontStack(f.body.family)};
      font-weight: 700;
      font-size: 1em;
      color: ${f.body.color};
      letter-spacing: 0.005em;
      margin-left: 3px;
    }

    /* Chapter-closing ornament that spans both columns at the bottom. */
    .span-bot {
      width: 100%;
      text-align: center;
      font-family: ${fontStack(f.ornament.family)};
      font-size: ${f.ornament.sizePt}pt;
      color: ${f.ornament.color};
      margin-top: ${bl}px;
      line-height: ${bl}px;
    }

    /* Footnotes: 2-column block at column bottom, separated by thin gold rule. */
    .footnotes {
      border-top: 0.5pt solid #b38728;
      margin-top: ${bl}px;
      padding-top: ${bl / 2}px;
      column-count: 2;
      column-gap: ${g.gutterPx}px;
      font-family: ${fontStack(f.footnote.family)};
      font-size: ${f.footnote.sizePt}pt;
      line-height: ${snapBaseline(ptToPx(f.footnote.lineHeightPt), bl)}px;
    }
    .footnotes p { text-indent: 0; margin: 0 0 ${bl / 4}px; text-align: justify; }
    .footnotes .fn-ref { font-weight: 700; margin-left: 3px; }

    /* Word interactivity (in the editor preview; harmless in PDF). */
    .word { cursor: text; }
    .word.hi { background: linear-gradient(180deg, transparent 60%, #fbf5b7 60%); }

    /* Measure-mode container: single column at column-width */
    .measure {
      width: ${g.columnWidthPx}px;
      direction: rtl;
    }
  `;
}

function buildMeasureDoc({ items, config }) {
  const blocks = items.map((it, i) => itemToHTML(it, i, /*forMeasure*/true, config)).join('\n');
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
    const colA = renderColumn(p.colA, items, p.slackPerGapA, config);
    const colB = renderColumn(p.colB, items, p.slackPerGapB, config);
    const span = renderSpanTop(p.spanTop, items);
    const spanBot = renderSpanBottom(p.spanBottom, items);
    const footnotes = renderFootnotes(p.footnotes, items);
    const header = renderHeader(num, side, items, p, config);
    return `<section class="page ${side}" data-page="${num}">
      ${header}
      <div class="page-content">
        ${span}
        <div class="cols">
          <div class="col col-a"><div class="col-inner doc">${colA}</div></div>
          <div class="col col-b"><div class="col-inner doc">${colB}</div></div>
        </div>
        ${spanBot}
        ${footnotes}
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
  return `<div class="span-top"><h1>${escapeHTML(item.text || '')}</h1></div>`;
}

function renderSpanBottom(lines, items) {
  if (!lines || lines.length === 0) return '';
  // Group by itemIdx and emit as a single span-bot band (ornament).
  const seen = new Set();
  const parts = [];
  for (const ln of lines) {
    if (seen.has(ln.itemIdx)) continue;
    seen.add(ln.itemIdx);
    const it = items[ln.itemIdx];
    if (!it) continue;
    parts.push(`<div>${escapeHTML(it.text || '❦')}</div>`);
  }
  return `<div class="span-bot">${parts.join('')}</div>`;
}

function renderFootnotes(fnIdxs, items) {
  if (!fnIdxs || fnIdxs.length === 0) return '';
  const html = fnIdxs.map((idx, i) => {
    const it = items[idx];
    if (!it) return '';
    const num = i + 1;
    return `<p><span class="fn-ref">${num}.</span>${escapeHTML(it.text)}</p>`;
  }).join('');
  return `<div class="footnotes">${html}</div>`;
}

function renderColumn(linesInCol, items, slackPerGapPx, config) {
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

  const gapPx = Math.max(0, slackPerGapPx || 0);
  const dc = config.dropCap || {};
  return groups.map((g, gi) => {
    const item = items[g.itemIdx];
    const text = (item.text || '').slice(g.lines[0].chunkStart, g.lines[g.lines.length - 1].chunkEnd);
    const isContinuation = !g.lines[0].isFirst;
    const extraStyle = gi > 0 && gapPx > 0
      ? ` style="margin-top: ${gapPx}px"`
      : '';
    const enableDropCap = dc.enabled
      && !isContinuation
      && (item.type === 'p' || !item.type)
      && g.lines.length >= (dc.minLines || 3);
    return renderItem({ ...item, text }, isContinuation, extraStyle, enableDropCap);
  }).join('');
}

function renderItem(item, isContinuation, extraStyle, dropCap) {
  const t = escapeHTML(item.text);
  const noIndentClass = isContinuation && (item.type === 'p' || !item.type) ? ' no-indent' : '';
  switch (item.type) {
    case 'title':
    case 'h1':       return `<h1${extraStyle}>${t}</h1>`;
    case 'h2':       return `<h2${extraStyle}>${t}</h2>`;
    case 'h3':       return `<h3${extraStyle}>${t}</h3>`;
    case 'ornament': return `<p class="ornament"${extraStyle}>${t}</p>`;
    default: {
      if (dropCap) {
        const firstSpace = item.text.indexOf(' ');
        if (firstSpace > 0) {
          const first = escapeHTML(item.text.slice(0, firstSpace));
          const rest = escapeHTML(item.text.slice(firstSpace + 1));
          return `<p class="dropcap line2-hang${noIndentClass}"${extraStyle}><span class="dc-word">${first}</span>${rest}</p>`;
        }
      }
      return `<p class="${noIndentClass.trim()}"${extraStyle}>${t}</p>`;
    }
  }
}

function itemToHTML(item, i, forMeasure, config) {
  const breakBefore = forMeasure && (item.type === 'h1' || item.type === 'title') ? 1 : 0;
  const t = escapeHTML(item.text || '');
  const attrs = `data-item="${i}" data-type="${item.type}" data-break-before="${breakBefore}"`;
  switch (item.type) {
    case 'title':
    case 'h1':       return `<h1 ${attrs}>${t}</h1>`;
    case 'h2':       return `<h2 ${attrs}>${t}</h2>`;
    case 'h3':       return `<h3 ${attrs}>${t}</h3>`;
    case 'ornament': return `<p class="ornament" ${attrs}>${t}</p>`;
    case 'footnote': return `<p class="footnote-src" ${attrs} style="display:none">${t}</p>`;
    default:         return `<p ${attrs}>${t}</p>`;
  }
}

function renderHeader(num, side, items, page, config) {
  if (!config.runningHeader.enabled) return '';
  const label = pageLabel(num, config.pageNumber.mode);
  const book = escapeHTML(config.bookName || '');
  const chapterTitle = escapeHTML(findChapterForPage(items, page) || '');
  const section = escapeHTML(config.runningHeader.section || '');
  const tractate = escapeHTML(config.runningHeader.tractate || '');
  const style = config.runningHeader.style;
  let leftSide = '', center = '', rightSide = '';
  if (style === 1) { rightSide = book; leftSide = `<span class="page-num">${label}</span>`; }
  else if (style === 2) { rightSide = book; center = chapterTitle; leftSide = `<span class="page-num">${label}</span>`; }
  else if (style === 3) { center = chapterTitle; leftSide = `<span class="page-num">${label}</span>`; }
  else if (style === 4) {
    // 4-element classical sefer header. Visual order (RTL):
    //   [page-letter]   [section]   [tractate]   [book/author]
    // Mapped to the running-header flex (right/center/left):
    //   right  = page-letter
    //   center = section · tractate (two spans)
    //   left   = book/author
    const cTract = tractate || chapterTitle;
    const cSect = section || '';
    rightSide = `<span class="page-num">${label}</span>`;
    center = `<span class="hdr-section">${cSect}</span><span class="hdr-tractate">${cTract}</span>`;
    leftSide = book;
  }

  const a = side === 'right' ? rightSide : leftSide;
  const c = center;
  const b = side === 'right' ? leftSide : rightSide;
  return `<div class="running-header rh-style-${style}">
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
  BASELINE_PX,
};
