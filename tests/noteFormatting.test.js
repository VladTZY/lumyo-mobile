// Tests for src/lib/noteFormatting.ts (pure module, zero imports).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const FILE = path.resolve(__dirname, '../src/lib/noteFormatting.ts');
const src = fs.readFileSync(FILE, 'utf8');
const js = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
}).outputText;
const mod = { exports: {} };
new Function('exports', 'require', 'module', js)(mod.exports, require, mod);
const { toggleFormat, activeFormats, processNewline, wordCount, BULLET } = mod.exports;

function typeNewlineAt(text, p) {
  return text.slice(0, p) + '\n' + text.slice(p);
}
const sel = (start, end = start) => ({ start, end });

// ---------------------------------------------------------------------------
// Purity and exports
// ---------------------------------------------------------------------------

test('module has no imports or requires and exposes its interface', () => {
  assert.ok(!/^\s*import\s/m.test(src), 'noteFormatting.ts must have no import lines');
  assert.ok(!src.includes('require('), 'noteFormatting.ts must not call require(');
  for (const fn of [toggleFormat, activeFormats, processNewline, wordCount]) {
    assert.equal(typeof fn, 'function');
  }
  assert.equal(BULLET, '• ');
});

// ---------------------------------------------------------------------------
// Inline formats
// ---------------------------------------------------------------------------

test('toggleFormat wraps a selection with the right markers', () => {
  assert.deepEqual(toggleFormat('hello', sel(0, 5), 'bold'), { text: '**hello**', sel: sel(2, 7) });
  assert.equal(toggleFormat('hello', sel(0, 5), 'italic').text, '*hello*');
  assert.equal(toggleFormat('hello', sel(0, 5), 'underline').text, '<u>hello</u>');
});

test('toggleFormat unwraps an already-bold selection', () => {
  assert.deepEqual(toggleFormat('**hello**', sel(0, 9), 'bold'), { text: 'hello', sel: sel(0, 5) });
  assert.equal(toggleFormat('**hello**', sel(2, 7), 'bold').text, 'hello');
});

test('activeFormats: bold, selection and caret inside a span', () => {
  const content = '**bold** plain';
  assert.equal(activeFormats(content, sel(2, 6)).bold, true);
  assert.equal(activeFormats(content, sel(12)).bold, false);
  assert.equal(activeFormats(content, sel(4)).bold, true);
});

test('activeFormats: italic and underline', () => {
  assert.equal(activeFormats('*italic*', sel(3)).italic, true);
  assert.equal(activeFormats('*italic*', sel(1, 7)).italic, true);
  assert.equal(activeFormats('<u>hi</u>', sel(4)).underline, true);
  assert.equal(activeFormats('<u>hi</u> there', sel(3, 5)).underline, true);
  assert.equal(activeFormats('plain', sel(2)).underline, false);
});

test('activeFormats: gaps, boundaries and partial overlaps', () => {
  const bold = '**bold** **also**';
  assert.equal(activeFormats(bold, sel(bold.indexOf(' '))).bold, false);
  const italic = '*italic* *more*';
  assert.equal(activeFormats(italic, sel(italic.indexOf(' '))).italic, false);
  const adjacent = '**one****two**';
  assert.equal(activeFormats(adjacent, sel(adjacent.indexOf('**', 2) + 1)).bold, false);
  assert.equal(activeFormats('**bold** plain', sel(4, 10)).bold, false);
  assert.equal(activeFormats('**bold word**', sel(4, 9)).bold, true);
});

test('activeFormats: a lone unmatched marker does not throw and reports false', () => {
  assert.doesNotThrow(() => activeFormats('a *b', sel(2)));
  const a = activeFormats('a *b', sel(0));
  assert.equal(a.italic, false);
  assert.equal(a.bold, false);
  assert.equal(a.underline, false);
});

// ---------------------------------------------------------------------------
// processNewline
// ---------------------------------------------------------------------------

test('processNewline: closes and reopens spans around the break', () => {
  let old = '**bold**';
  assert.deepEqual(processNewline(old, typeNewlineAt(old, 6)), { text: '**bold**\n', sel: sel(9) });
  assert.deepEqual(processNewline(old, typeNewlineAt(old, 4)), { text: '**bo**\n**ld**', sel: sel(9) });
  assert.deepEqual(processNewline(old, typeNewlineAt(old, 2)), { text: '\n**bold**', sel: sel(3) });
  old = '<u>hi</u>';
  assert.deepEqual(processNewline(old, typeNewlineAt(old, 5)), { text: '<u>hi</u>\n', sel: sel(10) });
});

test('processNewline: bullet continuation and ending', () => {
  assert.deepEqual(processNewline('• item', typeNewlineAt('• item', 6)), { text: '• item\n• ', sel: sel(9) });
  assert.deepEqual(processNewline('a\n• ', typeNewlineAt('a\n• ', 4)), { text: 'a\n', sel: sel(2) });
});

test('processNewline: null for plain newlines and non-newline edits', () => {
  assert.equal(processNewline('hello', typeNewlineAt('hello', 5)), null);
  assert.equal(processNewline('**bold**', typeNewlineAt('**bold**', 8)), null);
  assert.equal(processNewline('ab', 'axb'), null);
  assert.equal(processNewline('ab', 'a\n\nb'), null);
  assert.equal(processNewline('ab', 'a'), null);
});

test('wordCount basics', () => {
  assert.equal(wordCount(''), 0);
  assert.equal(wordCount('   '), 0);
  assert.equal(wordCount('hello'), 1);
  assert.equal(wordCount('**hello** world'), 2);
});

// ---------------------------------------------------------------------------
// Bullet toggle: [text, sel, expected text, expected sel]
// ---------------------------------------------------------------------------

const BULLET_CASES = [
  ['hello', sel(5), '• hello', sel(7)],
  ['hello', sel(0), '• hello', sel(2)],
  ['• hello', sel(7), 'hello', sel(5)],
  ['• hello', sel(1), 'hello', sel(0)],
  ['', sel(0), '• ', sel(2)],
  ['a\nb\nc', sel(0, 5), '• a\n• b\n• c', sel(2, 11)],
  ['a\nb\nc', sel(2), 'a\n• b\nc', sel(4)],
  ['• a\nb', sel(0, 5), '• a\n• b', sel(0, 7)],
  ['• a\n• b', sel(0, 7), 'a\nb', sel(0, 3)],
  ['a\n\nb', sel(0, 4), '• a\n\n• b', sel(2, 8)],
  ['a\nb', sel(0, 2), '• a\nb', sel(2, 4)],
  ['- a', sel(3), 'a', sel(1)],
  ['**bold**', sel(4), '• **bold**', sel(6)],
  ['hello', sel(99), '• hello', sel(7)],
];

for (const [text, s, expText, expSel] of BULLET_CASES) {
  test(`bullet toggle ${JSON.stringify(text)} ${JSON.stringify(s)}`, () => {
    const r = toggleFormat(text, s, 'bullet');
    assert.equal(r.text, expText);
    assert.deepEqual(r.sel, expSel);
  });
}

test('bullet toggle never throws on reversed or out-of-range selections', () => {
  assert.doesNotThrow(() => toggleFormat('a\nb', sel(5, -3), 'bullet'));
  assert.deepEqual(toggleFormat('a\nb', sel(3, 0), 'bullet'), { text: '• a\n• b', sel: sel(2, 7) });
});

test('bullet toggle: mixed bullet and dash lines add only the missing ones', () => {
  assert.equal(toggleFormat('- a\nb', sel(0, 5), 'bullet').text, '- a\n• b');
  assert.equal(toggleFormat('- a\n• b', sel(0, 7), 'bullet').text, 'a\nb');
});

test('bullet toggle: indented lines are not bullets and get the bullet at column 0', () => {
  assert.equal(toggleFormat('  x', sel(3), 'bullet').text, '•   x');
});

test('bullet toggle: a selection ending at column 0 does not touch that line', () => {
  assert.equal(toggleFormat('a\nb', sel(0, 2), 'bullet').text, '• a\nb');
});

test('bullet toggle round-trips for inputs with no bullets', () => {
  for (const [text, s, , expSel] of BULLET_CASES) {
    if (/^(• |- )/m.test(text)) continue;
    const once = toggleFormat(text, s, 'bullet');
    const twice = toggleFormat(once.text, once.sel, 'bullet');
    assert.equal(twice.text, text, `round trip of ${JSON.stringify(text)}`);
    assert.ok(expSel);
  }
});

test('activeFormats().bullet predicts what a tap will do', () => {
  assert.equal(activeFormats('• a', sel(3)).bullet, true);
  assert.equal(activeFormats('- a', sel(3)).bullet, true);
  assert.equal(activeFormats('a', sel(1)).bullet, false);
  assert.equal(activeFormats('• a\nb', sel(0, 5)).bullet, false);
  assert.equal(activeFormats('• a\n\n• b', sel(0, 8)).bullet, true);
  assert.equal(activeFormats('', sel(0)).bullet, false);
  assert.equal(activeFormats('• ', sel(2)).bullet, true);
});

// ---------------------------------------------------------------------------
// processNewline with dash bullets
// ---------------------------------------------------------------------------

test('processNewline: dash bullets continue and end like glyph bullets', () => {
  assert.deepEqual(processNewline('- item', '- item\n'), { text: '- item\n- ', sel: sel(9) });
  assert.deepEqual(processNewline('a\n- ', 'a\n- \n'), { text: 'a\n', sel: sel(2) });
});

test('processNewline: continuation works on the output of a bullet toggle', () => {
  const t = toggleFormat('hello', sel(5), 'bullet');
  assert.deepEqual(processNewline(t.text, t.text + '\n'), { text: '• hello\n• ', sel: sel(10) });
});

// ---------------------------------------------------------------------------
// wordCount ignores bullet prefixes and bare markers
// ---------------------------------------------------------------------------

test('wordCount: bullets and bare markers are not words', () => {
  assert.equal(wordCount('• one\n• two'), 2);
  assert.equal(wordCount('- one\n- two'), 2);
  assert.equal(wordCount('• '), 0);
  assert.equal(wordCount('****'), 0);
  assert.equal(wordCount('<u></u>'), 0);
  assert.equal(wordCount('a - b'), 3);
});
