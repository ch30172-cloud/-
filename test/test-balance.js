// Lightweight test for column-balancing math (no browser).
// Run: node test/test-balance.js

const Module = require('module');
const path = require('path');

// Stub template so layout.js loads without pulling Puppeteer
const stubPath = path.join(__dirname, '..', 'lib', 'template.js');
const realRequire = Module.prototype.require;
Module.prototype.require = function (id) {
  if (id === './template' || id === path.join('.', 'template')) {
    return {
      buildMeasureDoc: () => '',
      buildPagedDoc: () => '',
      computeGeometry: () => ({}),
    };
  }
  return realRequire.apply(this, arguments);
};

const layout = require('../lib/layout.js');
Module.prototype.require = realRequire;

// Re-implement splitPages locally by exporting bits we need.
// Instead, directly invoke via internal test surface:
function makeLines(heights, opts = {}) {
  return heights.map((h, i) => ({
    itemIdx: opts.itemAt ? opts.itemAt(i) : i,
    itemType: 'p',
    breakBefore: opts.breakBeforeAt ? opts.breakBeforeAt(i) : false,
    height: h,
    chunkStart: 0, chunkEnd: 100,
    isFirst: true, isLast: true,
  }));
}

// Re-export internal functions via eval of the source for testing
const fs = require('fs');
const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'layout.js'), 'utf8');
const splitPagesMatch = src.match(/function splitPages[\s\S]*?\n\}/);
const findBestMatch = src.match(/function findBestPageSplit[\s\S]*?\n\}/);
const bestSplitMatch = src.match(/function bestSplitWithin[\s\S]*?\n\}/);
const fnSrc = bestSplitMatch[0] + '\n' + findBestMatch[0] + '\n' + splitPagesMatch[0] + '\nmodule.exports = { splitPages };';
const m = { exports: {} };
new Function('module', 'exports', fnSrc)(m, m.exports);
const { splitPages } = m.exports;

function approxEqual(a, b, eps = 0.6) { return Math.abs(a - b) <= eps; }
function sumH(arr) { return arr.reduce((s, l) => s + l.height, 0); }

function assert(cond, msg) {
  if (!cond) { console.error('FAIL:', msg); process.exit(1); }
  console.log('OK:  ', msg);
}

// Test 1: 10 lines of 10px each, colHeight 30 → expect 2 pages of (cols 30+30=60), last page 10+10=20
{
  const lines = makeLines(Array(10).fill(10));
  const cfg = { geometry: { columnHeightPx: 30 } };
  const pages = splitPages(lines, cfg);
  console.log('Test 1 pages:', pages.map(p => ({a: sumH(p.colA), b: sumH(p.colB)})));
  assert(pages.length === 2, '2 pages for 10 lines @ colHeight 30');
  assert(approxEqual(sumH(pages[0].colA), sumH(pages[0].colB)), 'page 1 cols balanced');
}

// Test 2: lines of mixed heights, balance check
{
  const heights = [20, 10, 5, 15, 25, 8, 12, 30, 5, 5];
  const lines = makeLines(heights);
  const cfg = { geometry: { columnHeightPx: 50 } };
  const pages = splitPages(lines, cfg);
  console.log('Test 2 pages:', pages.map(p => ({a: sumH(p.colA), b: sumH(p.colB)})));
  pages.forEach((p, i) => {
    const a = sumH(p.colA), b = sumH(p.colB);
    assert(a <= 50.6 && b <= 50.6, `page ${i+1} both columns within colHeight (a=${a}, b=${b})`);
  });
  const total = pages.flatMap(p => [...p.colA, ...p.colB]).length;
  assert(total === heights.length, 'no lines lost or duplicated');
}

// Test 3: break-before forces a new page
{
  const heights = [10, 10, 10, 10, 10, 10];
  const lines = makeLines(heights, { breakBeforeAt: i => i === 3 });
  const cfg = { geometry: { columnHeightPx: 100 } };
  const pages = splitPages(lines, cfg);
  console.log('Test 3 pages:', pages.map(p => ({a: p.colA.length, b: p.colB.length})));
  assert(pages.length >= 2, 'break-before creates a page boundary');
  assert(pages[0].colA.length + pages[0].colB.length === 3, 'first page has 3 lines (before break)');
}

// Test 4: best split picks balanced mid
{
  const heights = [40, 10, 10, 40];
  const lines = makeLines(heights);
  const cfg = { geometry: { columnHeightPx: 50 } };
  const pages = splitPages(lines, cfg);
  console.log('Test 4 pages:', pages.map(p => ({a: sumH(p.colA), b: sumH(p.colB)})));
  assert(pages.length === 1, 'fits in 1 page');
  const a = sumH(pages[0].colA), b = sumH(pages[0].colB);
  assert(approxEqual(a, b, 1), `cols balanced (a=${a}, b=${b})`);
}

console.log('\nAll balance tests passed.');
