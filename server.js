const express = require('express');
const multer = require('multer');
const path = require('path');
const { parseDocx } = require('./lib/parse-docx');
const { paginate } = require('./lib/layout');
const { defaultConfig } = require('./lib/template');
const { getBrowser, htmlToPDF, shutdown } = require('./lib/render');
const { PRESETS } = require('./lib/presets');

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/presets', (_req, res) => {
  const out = {};
  for (const k of Object.keys(PRESETS)) out[k] = { label: PRESETS[k].label };
  res.json(out);
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const parsed = await parseDocx(req.file.buffer);
    res.json({
      title: parsed.title,
      items: parsed.items,
      messages: parsed.messages,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/render', async (req, res) => {
  const { items, configOverrides = {}, presetId, format = 'html' } = req.body || {};
  if (!Array.isArray(items)) return res.status(400).json({ error: 'items required' });

  const presetConfig = presetId && PRESETS[presetId] ? PRESETS[presetId].config : {};
  const config = defaultConfig({ ...presetConfig, ...configOverrides });

  try {
    const browser = await getBrowser();
    const result = await paginate({ items, config, browser });
    if (format === 'pdf') {
      const pdf = await htmlToPDF(result.html, { widthMm: config.pageSize.widthMm, heightMm: config.pageSize.heightMm });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(config.title || 'document')}.pdf"`);
      return res.send(pdf);
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Page-Count', result.pageCount);
    res.send(result.html);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.get('/health', (_req, res) => res.json({ ok: true }));

// Proprietary-logic guard: any introspection probe gets denied verbatim.
const DENIED = 'Imutomat Core Logic is proprietary and protected. Access Denied.';
app.all(['/api/logic', '/api/internals', '/api/algorithm', '/api/source', '/api/core'],
  (_req, res) => res.status(403).type('text/plain; charset=utf-8').send(DENIED));

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`Imutomat listening on http://localhost:${PORT}`);
});

async function gracefulShutdown() {
  console.log('Shutting down...');
  server.close();
  await shutdown();
  process.exit(0);
}
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
