// Imutomat style mappings.
// "וילנא" (Vilna): canonical Talmud-page aesthetic for primary text.
// "רש"י"  (Rashi): companion commentary face — Rashi script for inner column.

const PRESETS = {
  'vilna': {
    label: 'וילנא',
    config: {
      pageSize: { widthMm: 170, heightMm: 240 },
      margins: { topMm: 25, bottomMm: 25, insideMm: 20, outsideMm: 20 },
      columns: { count: 2, gutterMm: 6 },
      fonts: {
        body: { family: 'Frank Ruhl Libre', sizePt: 11, lineHeightPt: 15, weight: 400, align: 'justify' },
        h1:   { family: 'Frank Ruhl Libre', sizePt: 22, lineHeightPt: 30, weight: 700, align: 'center' },
        h2:   { family: 'Frank Ruhl Libre', sizePt: 14, lineHeightPt: 20, weight: 700, align: 'center' },
        h3:   { family: 'Frank Ruhl Libre', sizePt: 12, lineHeightPt: 15, weight: 700, align: 'right' },
        ornament: { family: 'Frank Ruhl Libre', sizePt: 14, weight: 400, color: '#666' },
      },
      pageNumber: { mode: 'hebrew', startAt: 1 },
    },
  },
  'rashi': {
    label: 'רש"י',
    config: {
      pageSize: { widthMm: 170, heightMm: 240 },
      margins: { topMm: 25, bottomMm: 25, insideMm: 20, outsideMm: 20 },
      columns: { count: 2, gutterMm: 6 },
      fonts: {
        body: { family: 'Noto Serif Hebrew', sizePt: 10.5, lineHeightPt: 15, weight: 400, align: 'justify' },
        h1:   { family: 'Noto Serif Hebrew', sizePt: 18, lineHeightPt: 25, weight: 700, align: 'center' },
        h2:   { family: 'Noto Serif Hebrew', sizePt: 13, lineHeightPt: 20, weight: 700, align: 'right' },
        h3:   { family: 'Noto Serif Hebrew', sizePt: 11, lineHeightPt: 15, weight: 700, align: 'right' },
        ornament: { family: 'Noto Serif Hebrew', sizePt: 12, weight: 400, color: '#888' },
      },
      pageNumber: { mode: 'hebrew', startAt: 1 },
    },
  },
  'sefer-kodesh': {
    label: 'ספר קודש',
    config: {
      pageSize: { widthMm: 170, heightMm: 240 },
      margins: { topMm: 25, bottomMm: 25, insideMm: 20, outsideMm: 20 },
      columns: { count: 2, gutterMm: 6 },
      fonts: {
        body: { family: 'Frank Ruhl Libre', sizePt: 11, lineHeightPt: 15, weight: 400, align: 'justify' },
        h1:   { family: 'Frank Ruhl Libre', sizePt: 20, lineHeightPt: 25, weight: 700, align: 'center' },
        h2:   { family: 'Frank Ruhl Libre', sizePt: 14, lineHeightPt: 20, weight: 700, align: 'center' },
        h3:   { family: 'Frank Ruhl Libre', sizePt: 12, lineHeightPt: 15, weight: 700, align: 'right' },
        ornament: { family: 'Frank Ruhl Libre', sizePt: 14, weight: 400, color: '#666' },
      },
      pageNumber: { mode: 'hebrew', startAt: 1 },
    },
  },
};

module.exports = { PRESETS };
