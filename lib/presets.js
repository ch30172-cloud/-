const PRESETS = {
  'sefer-kodesh': {
    label: 'ספר קודש',
    config: {
      pageSize: { widthMm: 148, heightMm: 210 },
      margins: { topMm: 18, bottomMm: 18, insideMm: 16, outsideMm: 14 },
      columns: { count: 2, gutterMm: 6 },
      fonts: {
        body: { family: 'Frank Ruhl Libre', sizePt: 11, lineHeightPt: 14, weight: 400, align: 'justify' },
        h1:   { family: 'Frank Ruhl Libre', sizePt: 20, lineHeightPt: 26, weight: 700, align: 'center' },
        h2:   { family: 'Frank Ruhl Libre', sizePt: 14, lineHeightPt: 18, weight: 700, align: 'center' },
        h3:   { family: 'Frank Ruhl Libre', sizePt: 12, lineHeightPt: 16, weight: 700, align: 'right' },
        ornament: { family: 'Frank Ruhl Libre', sizePt: 14, weight: 400, color: '#666' },
      },
      pageNumber: { mode: 'hebrew', startAt: 1 },
    },
  },
  'mamar-academi': {
    label: 'מאמר אקדמי',
    config: {
      pageSize: { widthMm: 170, heightMm: 240 },
      margins: { topMm: 22, bottomMm: 22, insideMm: 22, outsideMm: 18 },
      columns: { count: 2, gutterMm: 8 },
      fonts: {
        body: { family: 'Noto Serif Hebrew', sizePt: 10.5, lineHeightPt: 13.5, weight: 400, align: 'justify' },
        h1:   { family: 'Noto Serif Hebrew', sizePt: 18, lineHeightPt: 24, weight: 700, align: 'center' },
        h2:   { family: 'Noto Serif Hebrew', sizePt: 13, lineHeightPt: 17, weight: 700, align: 'right' },
        h3:   { family: 'Noto Serif Hebrew', sizePt: 11, lineHeightPt: 15, weight: 700, align: 'right' },
        ornament: { family: 'Noto Serif Hebrew', sizePt: 12, weight: 400, color: '#888' },
      },
      pageNumber: { mode: 'arabic', startAt: 1 },
    },
  },
  'roman': {
    label: 'רומן/ספרות',
    config: {
      pageSize: { widthMm: 130, heightMm: 200 },
      margins: { topMm: 20, bottomMm: 20, insideMm: 18, outsideMm: 14 },
      columns: { count: 1, gutterMm: 0 },
      fonts: {
        body: { family: 'Frank Ruhl Libre', sizePt: 11, lineHeightPt: 16, weight: 400, align: 'justify' },
        h1:   { family: 'Frank Ruhl Libre', sizePt: 22, lineHeightPt: 28, weight: 700, align: 'center' },
        h2:   { family: 'Frank Ruhl Libre', sizePt: 14, lineHeightPt: 20, weight: 600, align: 'center' },
        h3:   { family: 'Frank Ruhl Libre', sizePt: 12, lineHeightPt: 16, weight: 600, align: 'right' },
        ornament: { family: 'Frank Ruhl Libre', sizePt: 14, weight: 400, color: '#999' },
      },
      pageNumber: { mode: 'arabic', startAt: 1 },
    },
  },
};

module.exports = { PRESETS };
