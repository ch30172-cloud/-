// Tests for the balanced-columns engine. Runs without browser by stubbing template.
const fs = require('fs');
const path = require('path');

// Extract the standalone helper functions from layout.js source.
const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'layout.js'), 'utf8');
const fns = ['countGaps', 'sumHeights', 'isFeasibleEqual', 'findBalancedSplit', 'computeEqualization', 'extractSpanTop', 'splitPages']
  .map(name => {
    const m = src.match(new RegExp(`function ${name}\\([\\s\\S]*?\\n\\}`));
    if (!m) throw new Error('missing ' + name);
    return m[0];
  }).join('\n\n');
const constMatch = src.match(/const MAX_GAP_STRETCH_PX[^;]+;/);
const code = `${constMatch[0]}\n${fns}\nmodule.exports = { findBalancedSplit, computeEqualization, splitPages, MAX_GAP_STRETCH_PX };`;
const m = { exports: {} };
new Function('module', 'exports', code)(m, m.exports);
const { findBalancedSplit, computeEqualization, splitPages, MAX_GAP_STRETCH_PX } = m.exports;

let testNum = 0;
function assert(cond, msg) {
  testNum++;
  if (!cond) { console.error(`FAIL [${testNum}]:`, msg); process.exit(1); }
  console.log(`OK   [${testNum}]:`, msg);
}
function approxEqual(a, b, eps = 0.6) { return Math.abs(a - b) <= eps; }

function makeLines(specs) {
  // specs: array of [height, itemIdx, type, breakBefore?]
  return specs.map(([h, idx, type = 'p', br = false]) => ({
    itemIdx: idx, itemType: type, breakBefore: br,
    height: h, chunkStart: 0, chunkEnd: 100, isFirst: true, isLast: true,
  }));
}
const sumH = (a) => a.reduce((s, l) => s + l.height, 0);

// --- Test 1: Equal columns within budget on a regular page ----------
{
  // 8 paragraphs, 2 lines each (height 10 each), col height 40 → 2 pages of 4 paras each
  const specs = [];
  for (let p = 0; p < 8; p++) for (let l = 0; l < 2; l++) specs.push([10, p, 'p']);
  const lines = makeLines(specs);
  const pages = splitPages(lines, [], { geometry: { columnHeightPx: 40 } });
  console.log('Test 1 pages:', pages.map(p => ({a: sumH(p.colA), b: sumH(p.colB), sa: round(p.slackPerGapA), sb: round(p.slackPerGapB)})));
  pages.forEach((p, i) => {
    const ha = sumH(p.colA) + p.slackPerGapA * Math.max(0, distinctItems(p.colA) - 1);
    const hb = sumH(p.colB) + p.slackPerGapB * Math.max(0, distinctItems(p.colB) - 1);
    assert(approxEqual(ha, hb, 0.6), `page ${i+1} cols equal after slack (a=${round(ha)}, b=${round(hb)})`);
  });
}

// --- Test 2: H1 forces a span at top, prev page may end short ----------
{
  // 6 paras × 2 lines each = 120, col=60 → fits 1 page
  // then h1 (14)
  // then 4 paras × 2 lines = 80, fits next page below span
  const specs = [];
  for (let p = 0; p < 6; p++) for (let l = 0; l < 2; l++) specs.push([10, p, 'p']);
  specs.push([14, 100, 'h1', true]);
  for (let p = 101; p < 105; p++) for (let l = 0; l < 2; l++) specs.push([10, p, 'p']);
  const lines = makeLines(specs);
  const pages = splitPages(lines, [], { geometry: { columnHeightPx: 60 } });
  console.log('Test 2 pages:');
  pages.forEach((p, i) => console.log(`  page ${i+1}: span=${p.spanTop.length} a=${sumH(p.colA)} b=${sumH(p.colB)} sa=${round(p.slackPerGapA)} sb=${round(p.slackPerGapB)}`));

  const h1Page = pages.find(p => p.spanTop.length > 0);
  assert(h1Page, 'a page contains the h1 in spanTop');

  pages.forEach((p, i) => {
    const ha = sumH(p.colA) + p.slackPerGapA * Math.max(0, distinctItems(p.colA) - 1);
    const hb = sumH(p.colB) + p.slackPerGapB * Math.max(0, distinctItems(p.colB) - 1);
    assert(approxEqual(ha, hb, 0.6), `page ${i+1} cols equal after slack (a=${round(ha)}, b=${round(hb)})`);
  });
}

// --- Test 3: 2pt cap respected ----------
{
  const specs = [
    [10, 0, 'p'], [10, 0, 'p'], [10, 0, 'p'], // para 0: 30
    [10, 1, 'p'], [10, 1, 'p'], [10, 1, 'p'],
    [10, 2, 'p'], [10, 2, 'p'], [10, 2, 'p'],
    [10, 3, 'p'], [10, 3, 'p'], [10, 3, 'p'],
  ];
  const lines = makeLines(specs);
  const pages = splitPages(lines, [], { geometry: { columnHeightPx: 60 } });
  pages.forEach((p, i) => {
    assert(p.slackPerGapA <= MAX_GAP_STRETCH_PX + 0.01, `page ${i+1} slackA ≤ 2pt`);
    assert(p.slackPerGapB <= MAX_GAP_STRETCH_PX + 0.01, `page ${i+1} slackB ≤ 2pt`);
  });
}

// --- Test 4: No content lost ----------
{
  const heights = [12, 8, 5, 18, 22, 6, 14, 9, 11, 7, 13, 16, 4, 8, 10];
  const specs = heights.map((h, i) => [h, Math.floor(i / 3), 'p']);
  const lines = makeLines(specs);
  const pages = splitPages(lines, [], { geometry: { columnHeightPx: 50 } });
  const totalLines = pages.reduce((n, p) => n + p.spanTop.length + p.colA.length + p.colB.length, 0);
  assert(totalLines === lines.length, `no lines lost (got ${totalLines}, expected ${lines.length})`);
}

function distinctItems(arr) { const s = new Set(); arr.forEach(l => s.add(l.itemIdx)); return s.size; }
function round(n) { return Math.round(n * 100) / 100; }

console.log('\nAll tests passed.');
