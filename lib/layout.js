const { buildMeasureDoc, buildPagedDoc, computeGeometry } = require('./template');

const MAX_GAP_STRETCH_PX = (2 / 72) * 96; // 2 points in CSS pixels

async function paginate({ items, config, browser }) {
  const geometry = computeGeometry(config);
  const fullConfig = { ...config, geometry };
  // Footnotes are out-of-flow; they're attached to the page where their
  // owning paragraph lives, by index range.
  const flowItems = items.map((it, i) => ({ ...it, _idx: i }))
    .filter((it) => it.type !== 'footnote');
  const lines = await measureLines({ items: flowItems, config: fullConfig, browser });
  // Re-map itemIdx from flow-index back to original-index.
  for (const ln of lines) ln.itemIdx = flowItems[ln.itemIdx]._idx;
  const pages = splitPages(lines, items, fullConfig);
  attachFootnotes(pages, items);
  const html = buildPagedDoc({ pages, items, config: fullConfig });
  return { html, pageCount: pages.length, lineCount: lines.length, geometry };
}

function attachFootnotes(pages, items) {
  for (const page of pages) {
    const all = [...(page.spanTop || []), ...(page.colA || []), ...(page.colB || [])];
    if (!all.length) { page.footnotes = []; continue; }
    const first = all[0].itemIdx;
    const last = all[all.length - 1].itemIdx;
    const fns = [];
    for (let i = first; i <= last; i++) {
      if (items[i] && items[i].type === 'footnote') fns.push(i);
    }
    page.footnotes = fns;
  }
}

async function measureLines({ items, config, browser }) {
  const page = await browser.newPage();
  await page.setContent(buildMeasureDoc({ items, config }), { waitUntil: 'networkidle0' });

  const lines = await page.evaluate(() => {
    const out = [];
    const blocks = document.querySelectorAll('[data-item]');
    blocks.forEach((el) => {
      const itemIdx = parseInt(el.dataset.item, 10);
      const itemType = el.dataset.type;
      const breakBefore = el.dataset.breakBefore === '1';

      const range = document.createRange();
      range.selectNodeContents(el);
      const rects = Array.from(range.getClientRects());
      const totalLen = (el.textContent || '').length;
      const elBox = el.getBoundingClientRect();
      const elStyle = getComputedStyle(el);
      const marginTop = parseFloat(elStyle.marginTop) || 0;
      const marginBottom = parseFloat(elStyle.marginBottom) || 0;

      if (rects.length === 0) {
        out.push({
          itemIdx, itemType, breakBefore,
          height: elBox.height + marginTop + marginBottom,
          chunkStart: 0, chunkEnd: totalLen,
          isFirst: true, isLast: true,
        });
        return;
      }

      const tolerance = 0.5;
      const merged = [];
      for (const r of rects) {
        const last = merged[merged.length - 1];
        if (last && Math.abs(r.top - last.top) < tolerance) {
          last.left = Math.min(last.left, r.left);
          last.right = Math.max(last.right, r.right);
          last.bottom = Math.max(last.bottom, r.bottom);
        } else {
          merged.push({ top: r.top, bottom: r.bottom, left: r.left, right: r.right });
        }
      }
      merged.sort((a, b) => a.top - b.top);

      let charsConsumed = 0;
      merged.forEach((m, i) => {
        const isFirst = i === 0;
        const isLast = i === merged.length - 1;
        const remaining = totalLen - charsConsumed;
        const ratio = elBox.width > 0 ? (m.right - m.left) / elBox.width : 1;
        const chunkLen = i === merged.length - 1 ? remaining : Math.max(1, Math.round(remaining * ratio));
        out.push({
          itemIdx, itemType, breakBefore: breakBefore && isFirst,
          height: (m.bottom - m.top) + (isFirst ? marginTop : 0) + (isLast ? marginBottom : 0),
          chunkStart: charsConsumed,
          chunkEnd: charsConsumed + chunkLen,
          isFirst, isLast,
        });
        charsConsumed += chunkLen;
      });
    });
    return out;
  });

  await page.close();
  return lines;
}

function splitPages(lines, items, config) {
  const fullColHeight = config.geometry.columnHeightPx;
  const pages = [];
  let i = 0;

  while (i < lines.length) {
    // 1. Detect chapter heading (h1/title) at start of page → spans both columns.
    const span = extractSpanTop(lines, i);
    const flowStart = i + span.length;
    const spanHeight = span.reduce((s, l) => s + l.height, 0);
    const effectiveColHeight = Math.max(0, fullColHeight - spanHeight);

    if (flowStart >= lines.length) {
      pages.push({ spanTop: span, colA: [], colB: [], slackPerGapA: 0, slackPerGapB: 0, equalizedHeight: 0 });
      break;
    }

    // 2. Find next h1 boundary; that's the natural ceiling for this page's content.
    let nextH1At = lines.length;
    for (let k = flowStart; k < lines.length; k++) {
      if (lines[k].breakBefore && k > flowStart) { nextH1At = k; break; }
    }

    // 3. Find the best (mid, end) such that columns can be made strictly equal
    //    within budget (≤ 2pt per inter-paragraph gap), and end ≤ nextH1At.
    const split = findBalancedSplit(lines, flowStart, nextH1At, effectiveColHeight);

    // 4. Compute per-gap stretch to make columns exactly equal in height.
    const colA = lines.slice(flowStart, split.mid);
    const colB = lines.slice(split.mid, split.end);
    const equalize = computeEqualization(colA, colB, effectiveColHeight, /*preH1*/ split.end === nextH1At && nextH1At < lines.length);

    pages.push({
      spanTop: span,
      colA, colB,
      slackPerGapA: equalize.slackA,
      slackPerGapB: equalize.slackB,
      equalizedHeight: equalize.target,
      effectiveColHeight,
    });

    i = split.end;
  }
  return pages;
}

function extractSpanTop(lines, i) {
  const first = lines[i];
  if (!first || (first.itemType !== 'h1' && first.itemType !== 'title')) return [];
  const span = [];
  let k = i;
  while (k < lines.length && lines[k].itemIdx === first.itemIdx) {
    span.push(lines[k]);
    k++;
  }
  return span;
}

function countGaps(colLines) {
  if (colLines.length === 0) return 0;
  let gaps = 0;
  let prevIdx = colLines[0].itemIdx;
  for (let k = 1; k < colLines.length; k++) {
    if (colLines[k].itemIdx !== prevIdx) {
      gaps++;
      prevIdx = colLines[k].itemIdx;
    }
  }
  return gaps;
}

function sumHeights(colLines) {
  return colLines.reduce((s, l) => s + l.height, 0);
}

// Returns true iff cols can be brought to a common height T by adding ≤ 2pt per gap.
function isFeasibleEqual(colA, colB, capPerGap) {
  const ha = sumHeights(colA);
  const hb = sumHeights(colB);
  const ga = countGaps(colA);
  const gb = countGaps(colB);
  // Target T = max(ha, hb). Shorter col needs (T - shortH) extra spread over its gaps.
  const T = Math.max(ha, hb);
  const needA = T - ha;
  const needB = T - hb;
  if (ga === 0 && needA > 0.5) return false;
  if (gb === 0 && needB > 0.5) return false;
  if (ga > 0 && needA / ga > capPerGap + 0.01) return false;
  if (gb > 0 && needB / gb > capPerGap + 0.01) return false;
  return true;
}

function findBalancedSplit(lines, start, hardEnd, colHeight) {
  // Two-pass:
  //  Pass A: largest end ≤ hardEnd with a mid where slack ≤ 2pt per gap and T ≤ colHeight.
  //  Pass B (fallback): largest end with the mid that minimises required max-slack.
  // Within each pass, among same end, prefer larger T (more page fill).
  let feasible = null;
  let fallback = null;

  for (let end = start + 1; end <= hardEnd; end++) {
    const total = sumHeights(lines.slice(start, end));
    if (total > 2 * colHeight + MAX_GAP_STRETCH_PX * 16) break;

    let bestForEnd = null;
    let bestFeasibleForEnd = null;
    for (let mid = start + 1; mid <= end; mid++) {
      const colA = lines.slice(start, mid);
      const colB = lines.slice(mid, end);
      const ha = sumHeights(colA);
      const hb = sumHeights(colB);
      const ga = countGaps(colA);
      const gb = countGaps(colB);
      if (ha > colHeight + MAX_GAP_STRETCH_PX * ga + 0.5) continue;
      if (hb > colHeight + MAX_GAP_STRETCH_PX * gb + 0.5) continue;
      const T = Math.max(ha, hb);
      const needA = T - ha;
      const needB = T - hb;
      const slackA = ga > 0 ? needA / ga : (needA > 0.5 ? Infinity : 0);
      const slackB = gb > 0 ? needB / gb : (needB > 0.5 ? Infinity : 0);
      const maxSlack = Math.max(slackA, slackB);

      if (!bestForEnd || maxSlack < bestForEnd.maxSlack || (maxSlack === bestForEnd.maxSlack && T > bestForEnd.T)) {
        bestForEnd = { mid, T, maxSlack };
      }
      if (T <= colHeight + 0.5 && maxSlack <= MAX_GAP_STRETCH_PX + 0.01) {
        if (!bestFeasibleForEnd || T > bestFeasibleForEnd.T) {
          bestFeasibleForEnd = { mid, T };
        }
      }
    }

    if (bestFeasibleForEnd) {
      feasible = { end, mid: bestFeasibleForEnd.mid };
    }
    if (bestForEnd) {
      fallback = { end, mid: bestForEnd.mid };
    }
  }

  if (feasible) return feasible;
  if (fallback) return fallback;
  return { mid: start + 1, end: Math.min(start + 1, hardEnd) };
}

function computeEqualization(colA, colB, colHeight, preH1) {
  const ha = sumHeights(colA);
  const hb = sumHeights(colB);
  const ga = countGaps(colA);
  const gb = countGaps(colB);
  const target = Math.max(ha, hb);
  const slackA = ga > 0 ? Math.min(MAX_GAP_STRETCH_PX, (target - ha) / ga) : 0;
  const slackB = gb > 0 ? Math.min(MAX_GAP_STRETCH_PX, (target - hb) / gb) : 0;
  return { slackA, slackB, target };
}

module.exports = { paginate };
