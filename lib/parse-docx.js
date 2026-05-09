const mammoth = require('mammoth');

const STYLE_TO_TYPE = {
  'Title': 'title',
  'Heading 1': 'h1',
  'Heading 2': 'h2',
  'Heading 3': 'h3',
};

async function parseDocx(buffer) {
  const styleMap = [
    "p[style-name='Title'] => h1.doc-title",
    "p[style-name='Heading 1'] => h1.h1",
    "p[style-name='Heading 2'] => h2.h2",
    "p[style-name='Heading 3'] => h3.h3",
    "p[style-name='Footnote Text'] => p.footnote",
    "r[style-name='Footnote Reference'] => sup.footnote-ref",
  ];

  const result = await mammoth.convertToHtml({ buffer }, { styleMap });
  const html = result.value;

  const items = htmlToItems(html);
  const title = extractTitle(items);
  return { title, items, messages: result.messages };
}

function htmlToItems(html) {
  const items = [];
  const blockRegex = /<(h1|h2|h3|p)(\s+class="([^"]*)")?>([\s\S]*?)<\/\1>/g;
  let m;
  while ((m = blockRegex.exec(html)) !== null) {
    const tag = m[1];
    const cls = (m[3] || '').trim();
    const inner = m[4];
    const text = decodeEntities(stripTags(inner)).trim();
    if (!text) continue;

    let type = tag;
    if (cls === 'doc-title') type = 'title';
    else if (cls === 'footnote') type = 'footnote';
    else if (tag === 'p') type = 'p';

    if (type === 'p' && /^[\s•·●◆◇✦✧❋❉⁂※]+$/.test(text)) {
      items.push({ type: 'ornament', text });
      continue;
    }

    items.push({ type, text, html: cleanInlineHtml(inner) });
  }
  return items;
}

function cleanInlineHtml(html) {
  return html
    .replace(/<a[^>]*>/g, '')
    .replace(/<\/a>/g, '')
    .replace(/<span[^>]*>/g, '')
    .replace(/<\/span>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripTags(html) {
  return html.replace(/<[^>]+>/g, '');
}

function decodeEntities(s) {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractTitle(items) {
  const t = items.find(i => i.type === 'title');
  if (t) return t.text;
  const h = items.find(i => i.type === 'h1');
  return h ? h.text : 'מסמך';
}

module.exports = { parseDocx };
