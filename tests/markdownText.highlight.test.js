// Tester-added: MarkdownText highlight never alters text content (exhaustive range sweep).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');
function load(file, jsx, map) {
  const src = fs.readFileSync(file, 'utf8');
  const out = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019, esModuleInterop: true, ...(jsx ? { jsx: ts.JsxEmit.React } : {}) },
  }).outputText;
  const mod = { exports: {} };
  new Function('exports', 'require', 'module', out)(mod.exports, (r) => (r in map ? map[r] : require(r)), mod);
  return mod.exports;
}
const theme = load(path.join(ROOT, 'src/theme/index.ts'), false, {});
const { MarkdownText } = load(path.join(ROOT, 'src/components/MarkdownText.tsx'), true, {
  'react-native': { Text: 'Text', StyleSheet: { create: (o) => o } },
  '../theme': theme,
});

function flatten(node, inh) {
  if (node === null || node === undefined || node === false) return [];
  if (typeof node === 'string') return [{ text: node, styles: inh }];
  if (typeof node === 'number') return [{ text: String(node), styles: inh }];
  if (Array.isArray(node)) return node.flatMap((n) => flatten(n, inh));
  if (node.props !== undefined) {
    return flatten(node.props.children, node.props.style !== undefined ? inh.concat([node.props.style]) : inh);
  }
  return [];
}
const C = '#abcdef';
const hasBg = (r) => r.styles.some((s) => s && (Array.isArray(s) ? s.some((x) => x && x.backgroundColor === C) : s.backgroundColor === C));

const SAMPLES = [
  'plain text only',
  'aa **bold** cc',
  '*it* and ***both*** and <u>u</u>',
  '• a\n• b\n- legacy\n\nlast **line**',
  '**** stray ** and * lone',
  'emoji \u{1F600} **\u{1F600}** end',
  'a\r\nb\r\n',
  '',
  '[link](http://x) # head `code`',
];

test('highlight over every [start,end) range: text round-trips and tinted text equals slice', () => {
  for (const text of SAMPLES) {
    const base = flatten(MarkdownText({ text }), []).map((r) => r.text).join('');
    assert.equal(base, text);
    for (let s = 0; s <= text.length; s++) {
      for (let e = s; e <= text.length + 2; e++) {
        const rs = flatten(MarkdownText({ text, highlight: { start: s, end: e }, highlightColor: C }), []);
        const ctx = JSON.stringify({ text, s, e });
        assert.equal(rs.map((r) => r.text).join(''), text, 'round-trip ' + ctx);
        const tinted = rs.filter(hasBg).map((r) => r.text).join('');
        const want = s < Math.min(e, text.length) ? text.slice(s, Math.min(e, text.length)) : '';
        assert.equal(tinted, want, 'tint ' + ctx);
      }
    }
  }
});

test('highlight keeps React keys unique among siblings', () => {
  const text = 'aa **bold** cc *i* <u>u</u>\n• x';
  const seen = [];
  (function walk(n) {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) {
      const keys = n.filter((c) => c && c.key != null).map((c) => c.key);
      assert.equal(new Set(keys).size, keys.length, 'duplicate keys: ' + keys);
      n.forEach(walk);
      return;
    }
    if (n.props) walk(n.props.children);
  })(MarkdownText({ text, highlight: { start: 3, end: 22 }, highlightColor: C }));
  assert.ok(seen.length === 0);
});

test('non-finite / non-number ranges never throw and tint nothing', () => {
  const text = 'aa **bold** cc';
  for (const h of [{ start: NaN, end: 4 }, { start: 0, end: NaN }, { start: Infinity, end: 5 }, { start: 0, end: Infinity }, { start: '1', end: '3' }, {}, { start: 2 }]) {
    let rs;
    assert.doesNotThrow(() => { rs = flatten(MarkdownText({ text, highlight: h, highlightColor: C }), []); }, JSON.stringify(h));
    assert.equal(rs.map((r) => r.text).join(''), text);
  }
  for (const col of ['', undefined, null]) {
    const rs = flatten(MarkdownText({ text, highlight: { start: 0, end: 4 }, highlightColor: col }), []);
    assert.equal(rs.filter(hasBg).length, 0);
  }
});
