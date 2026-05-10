/* Imutomat — layout Web Worker.
   Heavy column-balance arithmetic runs off the main thread to keep UI at 60fps.
   The server is the source of truth for paginated HTML; this worker does the
   client-side scoped recompute (manual offsets and word/char telemetry). */

self.addEventListener('message', (e) => {
  const { type, payload } = e.data || {};
  if (type === 'telemetry') {
    const items = payload.items || [];
    let w = 0, c = 0, p = 0;
    for (const it of items) {
      const s = (it.text || '').trim();
      w += (s.match(/\S+/g) || []).length;
      c += (it.text || '').length;
      if (it.type === 'p' || !it.type) p++;
    }
    self.postMessage({ type: 'telemetry:done', payload: { words: w, chars: c, paras: p } });
  } else if (type === 'balance') {
    // Snap heights to baseline and emit balanced split (heuristic).
    const { lines, colHeight, baseline = 20 } = payload;
    const snap = (px) => Math.ceil(px / baseline) * baseline;
    const total = lines.reduce((s, l) => s + snap(l.height), 0);
    const target = total / 2;
    let acc = 0, mid = 0;
    for (let i = 0; i < lines.length; i++) {
      acc += snap(lines[i].height);
      if (acc >= target) { mid = i + 1; break; }
    }
    self.postMessage({ type: 'balance:done', payload: { mid, target, total } });
  }
});
