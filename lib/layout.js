const { buildMeasureDoc, buildPagedDoc, computeGeometry } = require('./template');

async function paginate({ items, config, browser }) {
  const geometry = computeGeometry(config);
  const fullConfig = { ...config, geometry };
  const lines = await measureLines({ items, config: fullConfig, browser });
  const pages = splitPages(lines, fullConfig);
  const html = buildPagedDoc({ pages, items, config: fullConfig });
  return { html, pageCount: pages.length, lineCount: lines.length, geometry };
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
      if (rects.length === 0) {
        const r = el.getBoundingClientRect();
        out.push({
          itemIdx, itemType, breakBefore,
          top: r.top, bottom: r.bottom, height: r.height,
          chunkStart: 0, chunkEnd: (el.textContent || '').length,
          isFirst: true, isLast: true,
        });
        return;
      }

      const totalLen = (el.textContent || '').length;
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

      const elBox = el.getBoundingClientRect();
      const elStyle = getComputedStyle(el);
      const marginTop = parseFloat(elStyle.marginTop) || 0;
      const marginBottom = parseFloat(elStyle.marginBottom) || 0;

      let charsConsumed = 0;
      merged.forEach((m, i) => {
        const isFirst = i === 0;
        const isLast = i === merged.length - 1;
        const chunkLen = approxCharsForLine(el, m, totalLen, charsConsumed);
        out.push({
          itemIdx, itemType, breakBefore: breakBefore && isFirst,
          top: m.top - (isFirst ? marginTop : 0),
          bottom: m.bottom + (isLast ? marginBottom : 0),
          height: (m.bottom - m.top) + (isFirst ? marginTop : 0) + (isLast ? marginBottom : 0),
          chunkStart: charsConsumed,
          chunkEnd: charsConsumed + chunkLen,
          isFirst, isLast,
        });
        charsConsumed += chunkLen;
      });

      function approxCharsForLine(el, lineRect, totalLen, alreadyConsumed) {
        const remaining = totalLen - alreadyConsumed;
        const lineWidth = lineRect.right - lineRect.left;
        const fullWidth = elBox.width;
        if (fullWidth <= 0) return remaining;
        const ratio = lineWidth / fullWidth;
        return Math.max(1, Math.round(remaining * ratio));
      }
    });
    return out;
  });

  await page.close();
  return lines;
}

function splitPages(lines, config) {
  const colHeightPx = config.geometry.columnHeightPx;
  const pages = [];
  let i = 0;

  while (i < lines.length) {
    const { mid, end } = findBestPageSplit(lines, i, colHeightPx);
    pages.push({
      colA: lines.slice(i, mid),
      colB: lines.slice(mid, end),
    });
    i = end;
  }
  return pages;
}

function findBestPageSplit(lines, start, colHeight) {
  // Strategy: extend `end` as far as possible while a valid (mid, end) split exists
  // (both columns fit within colHeight). Then pick the most-balanced mid for that end.
  let end = start;
  let lastValidEnd = start;
  let lastValidMid = start;
  let totalH = 0;
  const heights = [];

  while (end < lines.length) {
    if (end > start && lines[end].breakBefore) break;
    if (end > start && totalH + lines[end].height > 2 * colHeight + 0.5) break;

    heights.push(lines[end].height);
    totalH += lines[end].height;
    end++;

    const split = bestSplitWithin(heights, colHeight);
    if (split) {
      lastValidEnd = end;
      lastValidMid = start + split.midOffset;
    } else {
      // No valid split exists at this length → roll back; the previous end was the max.
      break;
    }
  }

  if (lastValidEnd === start) {
    // Single line larger than 2*colHeight - emit it alone in colA to make progress.
    return { mid: start + 1, end: Math.min(start + 1, lines.length) };
  }
  return { mid: lastValidMid, end: lastValidEnd };
}

function bestSplitWithin(heights, colHeight) {
  const total = heights.reduce((a, b) => a + b, 0);
  let best = null;
  let acc = 0;
  for (let k = 0; k <= heights.length; k++) {
    const left = acc;
    const right = total - acc;
    if (left <= colHeight + 0.5 && right <= colHeight + 0.5) {
      const diff = Math.abs(left - right);
      if (!best || diff < best.diff) best = { midOffset: k, diff };
    }
    if (k < heights.length) acc += heights[k];
  }
  return best;
}

module.exports = { paginate };
