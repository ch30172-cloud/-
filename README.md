# Imutomat · אִמותומאט

A production-ready SaaS-shaped Hebrew typesetter. Deep-navy "ancient library"
workspace, brushed-gold accents, baseline-grid typography, balanced two-column
pagination with surgical drop-caps ("חלן"), Hebrew gematria numbering, and a
vector-clean PDF export.

## Layout canon

- Page **17 × 24 cm**, margins 2.5 cm top/bottom + 2.0 cm sides, gutter 0.6 cm,
  two columns at **6.2 cm** each. Net content height **19 cm**.
- Baseline grid **20 px** (15 pt). Every line snaps to `y = n · 20`.
- Anti-river typography: word-spacing cap (≤ 15 %), glyph scaling ± 1 %, last
  line centred via `text-align-last: center`.
- Drop-cap ("חלן"): paragraphs ≥ 3 lines get a gold-brushed first word at
  40 px (2 baseline units); line 2 hanging-indent at W + 5 px.
- Hebrew page numbering א, ב, …, ט"ו, ט"ז, …, ת"ק.
- Footnotes: two-column block at page bottom, separated by a thin gold rule.

## Interaction model

- **Imutomatics** top progress bar — `pages_rendered / total_pages`, animated.
- **Right rail**: Dashboard · Page · Headers · Styles (Vilna/Rashi) · Export ·
  Covers · Account · Help.
- **Footer**: live `Pages | Words | Chars | Paragraphs | Page Size`.
- **Floating toolbar**: 5-colour highlighter (red/orange/green/blue/white),
  B/I/U, squiggle / draw / erase.
- **Push/Pull knobs** (+ / −) next to every column → `manualOffset` in baseline
  units. User overrides freeze auto-balance for that page (precedence).
- **Debounced 300 ms** scoped reflow — recomputes only from the active page
  forward.
- Click a word → ivory/gold popup with length, occurrences, paragraph, page.

## Architecture

```
server.js              Express; /api/upload, /api/render, /api/presets,
                       /api/logic → "Access Denied" guard
lib/parse-docx.js      mammoth → items
lib/layout.js          measure (Puppeteer) + balanced split + footnote attach
lib/template.js        defaults · CSS (baseline grid, drop-cap, anti-river,
                       gold-on-screen) · gematria (א..ת"ק)
lib/presets.js         וילנא · רש"י · ספר קודש
lib/render.js          Puppeteer → vector PDF
public/index.html      Imutomat shell
public/styles.css      navy + brushed-gold theme
public/app.js          state machine, IndexedDB persistence, scoped reflow,
                       word inspector, ± offsets, exports
public/db.js           IndexedDB wrapper
public/worker.js       off-main-thread telemetry + balance calc
```

State is persisted in IndexedDB (`imutomat.docs`) and survives page reload.

## Run

```bash
npm install
npm start
# open http://localhost:3000
```

## Security

Any request to `/api/logic`, `/api/internals`, `/api/algorithm`, `/api/source`,
or `/api/core` is answered with `403 Imutomat Core Logic is proprietary and
protected. Access Denied.` The same string is exposed in the frontend as
`window.Imutomat.describe()`.
