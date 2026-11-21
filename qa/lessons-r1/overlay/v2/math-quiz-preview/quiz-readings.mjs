import { readingTokens, svgReadingLayout } from './zhuyin.mjs';

// Load the existing audited, unambiguous character readings only on first use.
// The public copy is byte-identical to src/chinese-practice/sounds-single.json;
// site staging excludes src/, so the runtime must use the modules/ path.
let singleReadings;
let pending;
export function load() {
  if (singleReadings) return Promise.resolve();
  if (!pending) pending = fetch(new URL('./readings.json', import.meta.url))
    .then(response => { if (!response.ok) throw new Error('Readings unavailable'); return response.json(); })
    .then(data => { singleReadings = data; })
    .finally(() => { pending = null; });
  return pending;
}

function tokenOptions({ mathFoundation = false } = {}) {
  return { singleReadings: singleReadings || {}, useReviewedDefaults: mathFoundation };
}

export function tokens(text, options) {
  // Exact reviewed phrases resolve polyphones; other characters need an
  // unambiguous audited reading. Missing/context-dependent readings stay blank.
  return readingTokens(String(text), tokenOptions(options));
}

function renderText(text, React, options) {
  return tokens(text, options).map(({ char, reading }, index) => {
    if (!reading) return char;
    const tone = reading.match(/[ˊˇˋ˙]/)?.[0] || '';
    return React.createElement('ruby', { key: index, className: 'quiz-reading', 'aria-label': char },
      char,
      React.createElement('rt', { 'aria-hidden': true },
        React.createElement('span', { className: 'quiz-reading-sounds' },
          Array.from(reading.replace(/[ˊˇˋ˙]/g, '')).map((sound, i) => React.createElement('span', { key: i }, sound))),
        tone ? React.createElement('span', { className: 'quiz-reading-tone' + (tone === '˙' ? ' neutral' : '') }, tone) : null));
  });
}

export function render(content, React, options) {
  if (typeof content === 'string') return renderText(content, React, options);
  if (Array.isArray(content)) return content.map(item => render(item, React, options));
  if (!React.isValidElement(content) || ['svg', 'ruby', 'canvas', 'img'].includes(content.type)) return content;
  if (content.props.children === undefined) return content;
  return React.cloneElement(content, {}, render(content.props.children, React, options));
}

// Standalone SVG labels cannot inherit HTML ruby from their surrounding img.
// The model supplies only its own escaped math labels and unchanged geometry.
const foundationPictures = new WeakMap();
const escapeXml = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);

function foundationLabel(x, y, value, size=22) {
  const { tokens: labels, width } = svgReadingLayout(String(value), size, tokenOptions({ mathFoundation: true }));
  if (!labels.some(t => t.reading)) return `<text x="${x}" y="${y}" text-anchor="middle" font-size="${size}" fill="#173b50">${escapeXml(value)}</text>`;
  const left = x - width / 2, small = size * .36;
  const span = (text, x, y, font, assist = false) => `<tspan x="${x.toFixed(2)}" y="${y.toFixed(2)}" font-size="${font.toFixed(2)}"${assist ? ' aria-hidden="true"' : ''}>${escapeXml(text)}</tspan>`;
  let chunks = '';
  for (const { char, reading, x: offset } of labels) {
    chunks += span(char, left + offset, y, size);
    if (!reading) continue;
    const marks = Array.from(reading.replace(/[ˊˇˋ˙]/g, ''));
    const tone = reading.match(/[ˊˇˋ˙]/)?.[0], rx = left + offset + size * 1.02;
    const top = y - size * .25 - (marks.length - 1) * small * .48;
    marks.forEach((glyph, i) => { chunks += span(glyph, rx, top + i * small, small, true); });
    if (tone) chunks += span(tone, tone === '˙' ? rx : rx + small * .82, tone === '˙' ? top - small * .70 : y - size * .21, small, true);
  }
  return `<text fill="#173b50" aria-label="${escapeXml(value)}">${chunks}</text>`;
}

export function mathFoundationPicture(q, foundations) {
  if (!q || q.fig !== 'foundation' || !foundations?.byId?.(q.unitId) || !foundations?.picture) return q?.picture || '';
  if (!foundationPictures.has(q)) {
    const step = ['calendar', 'dates'].includes(q.kind) ? 0 : q.steps;
    const svg = foundations.picture(q, step, { label: foundationLabel });
    foundationPictures.set(q, 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
  }
  return foundationPictures.get(q);
}
