// Tester-added edge-case and invariant tests for src/lib/noteFormatting.ts.
// Complements tests/noteFormatting.test.js (does not repeat its cases).
// Expected values are hand-worked literals from the spec rules (R4-R7), not
// recomputed the way the module does.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');

function load(file, jsx, requireMap = {}) {
  const src = fs.readFileSync(file, 'utf8');
  const js = ts.transpileModule(src, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2019,
      esModuleInterop: true,
      ...(jsx ? { jsx: ts.JsxEmit.React } : {}),
    },
  }).outputText;
  const mod = { exports: {} };
  const req = (r) => (Object.prototype.hasOwnProperty.call(requireMap, r) ? requireMap[r] : require(r));
  new Function('exports', 'require', 'module', js)(mod.exports, req, mod);
  return mod.exports;
}

const { toggleFormat, activeFormats, processNewline, wordCount } = load(
  path.join(ROOT, 'src/lib/noteFormatting.ts')
);
const theme = load(path.join(ROOT, 'src/theme/index.ts'));
const { MarkdownText } = load(path.join(ROOT, 'src/components/MarkdownText.tsx'), true, {
  'react-native': { Text: 'Text', StyleSheet: { create: (o) => o } },
  '../theme': theme,
});

const s = (start, end = start) => ({ start, end });
const bullet = (text, sel) => toggleFormat(text, sel, 'bullet');
const eq = (got, text, sel) => assert.deepEqual(got, { text, sel });

// ---------------------------------------------------------------------------
// AC5 / R4: bullet toggle edge cases
// ---------------------------------------------------------------------------

test('bullet: selection starting mid-line and ending mid-line touches both whole lines', () => {
  eq(bullet('abc\ndef', s(1, 5)), '• abc\n• def', s(3, 9));
});

test('bullet: caret at very start and very end of a multi-line text', () => {
  eq(bullet('a\nb', s(0)), '• a\nb', s(2));
  eq(bullet('a\nb', s(3)), 'a\n• b', s(5));
});

test('bullet: select-all with trailing newline excludes the empty last line', () => {
  eq(bullet('a\nb\n', s(0, 4)), '• a\n• b\n', s(2, 8));
});

test('bullet: caret on an empty trailing line (all touched blank) gets a bullet', () => {
  eq(bullet('a\n', s(2)), 'a\n• ', s(4));
});

test('bullet: whitespace-only lines are skipped in a multi-line selection', () => {
  eq(bullet('a\n  \nb', s(0, 6)), '• a\n  \n• b', s(2, 10));
});

test('bullet: selection of only blank lines bullets every touched blank line', () => {
  // text 'a\n\n\nb', selection {2,3} touches the single empty line at offset 2.
  eq(bullet('a\n\n\nb', s(2, 3)), 'a\n• \n\nb', s(4, 5));
});

test('bullet: a lone "• " line is a bullet (not blank) and toggles off to empty', () => {
  eq(bullet('• ', s(2)), '', s(0));
});

test('bullet: mixed glyph and dash lines all remove on toggle-off', () => {
  eq(bullet('• a\n- b', s(0, 7)), 'a\nb', s(0, 3));
});

test('bullet: blank lines are skipped when removing', () => {
  eq(bullet('• a\n\n• b', s(0, 8)), 'a\n\nb', s(0, 4));
});

test('bullet: selection ends inside the second prefix when removing', () => {
  // start 1 is inside prefix 1 -> line start (0); end 5 is inside prefix 2
  // (offsets 4..5) -> line start 4, minus 2 for the first removal = 2.
  eq(bullet('• a\n• b', s(1, 5)), 'a\nb', s(0, 2));
});

test('bullet: selection inside one prefix collapses to the line start', () => {
  eq(bullet('• a', s(1, 2)), 'a', s(0, 0));
});

test('bullet: reversed selection is normalised', () => {
  eq(bullet('a\nb', s(3, 0)), '• a\n• b', s(2, 7));
});

test('bullet: negative, NaN and huge offsets are clamped, never throw', () => {
  eq(bullet('hello', s(-5, -1)), '• hello', s(2));
  eq(bullet('hello', { start: NaN, end: NaN }), '• hello', s(2));
  eq(bullet('hello', s(-9, 99)), '• hello', s(2, 7));
});

test('bullet: unicode and emoji', () => {
  eq(bullet('hi \u{1F600}', s(5)), '• hi \u{1F600}', s(7));
  eq(bullet('\u{1F600} x', s(0)), '• \u{1F600} x', s(2));
  eq(bullet('• \u{1F600}', s(4)), '\u{1F600}', s(2));
  // caret between the surrogate halves: must not throw, shifts by 2.
  eq(bullet('\u{1F600}', s(1)), '• \u{1F600}', s(3));
});

test('bullet: CRLF text keeps the carriage returns', () => {
  eq(bullet('a\r\nb', s(0, 4)), '• a\r\n• b', s(2, 8));
});

test('bullet: empty text and empty-text caret clamps', () => {
  eq(bullet('', s(0)), '• ', s(2));
  eq(bullet('', s(5, 9)), '• ', s(2));
});

test('bullet: large documents toggle correctly and quickly', () => {
  const lines = Array.from({ length: 20000 }, (_, i) => `line ${i}`);
  const text = lines.join('\n');
  const t0 = Date.now();
  const on = bullet(text, s(0, text.length));
  assert.ok(on.text.startsWith('• line 0\n• line 1\n'));
  assert.ok(on.text.endsWith('\n• line 19999'));
  assert.equal(on.text.length, text.length + 2 * 20000);
  assert.deepEqual(on.sel, s(2, text.length + 40000));
  const off = bullet(on.text, on.sel);
  assert.equal(off.text, text);
  assert.deepEqual(off.sel, s(0, text.length));
  assert.ok(Date.now() - t0 < 3000, 'toggle on 20k lines should take well under 3s');
});

// ---------------------------------------------------------------------------
// Inline formats through toggleFormat
// ---------------------------------------------------------------------------

test('inline: empty text caret inserts an empty pair and toggles back off', () => {
  eq(toggleFormat('', s(0), 'bold'), '****', s(2));
  eq(toggleFormat('', s(0), 'italic'), '**', s(1));
  eq(toggleFormat('', s(0), 'underline'), '<u></u>', s(3));
  eq(toggleFormat('****', s(2), 'bold'), '', s(0));
  eq(toggleFormat('**', s(1), 'italic'), '', s(0));
  eq(toggleFormat('<u></u>', s(3), 'underline'), '', s(0));
});

test('inline: reversed and out-of-range selections normalise', () => {
  eq(toggleFormat('hello', s(5, 0), 'bold'), '**hello**', s(2, 7));
  eq(toggleFormat('hello', s(-3, 99), 'bold'), '**hello**', s(2, 7));
  assert.doesNotThrow(() => toggleFormat('hello', { start: NaN, end: 4 }, 'italic'));
});

test('inline: wrap then unwrap restores text and selection', () => {
  for (const f of ['bold', 'italic', 'underline']) {
    const on = toggleFormat('hello world', s(6, 11), f);
    const off = toggleFormat(on.text, on.sel, f);
    eq(off, 'hello world', s(6, 11));
  }
});

test('inline: emoji selection wraps', () => {
  eq(toggleFormat('\u{1F600}!', s(0, 2), 'bold'), '**\u{1F600}**!', s(2, 4));
});

test('inline: caret before a closing marker steps over it', () => {
  eq(toggleFormat('**ab**', s(4), 'bold'), '**ab**', s(6));
});

// ---------------------------------------------------------------------------
// activeFormats
// ---------------------------------------------------------------------------

test('activeFormats: all false for empty text', () => {
  assert.deepEqual(activeFormats('', s(0)), { bold: false, italic: false, underline: false, bullet: false });
});

test('activeFormats: bold italic ***x*** reports both bold and italic', () => {
  const t = '***both***';
  assert.deepEqual(activeFormats(t, s(3, 7)), { bold: true, italic: true, underline: false, bullet: false });
  assert.deepEqual(activeFormats(t, s(5)), { bold: true, italic: true, underline: false, bullet: false });
  const whole = '***bold italic***';
  const a = activeFormats(whole, s(0, whole.length));
  assert.equal(a.bold, true);
  assert.equal(a.italic, true);
});

test('activeFormats: italic-only and bold-only are distinguished', () => {
  const it = activeFormats('*a*', s(1));
  assert.equal(it.italic, true);
  assert.equal(it.bold, false);
  const bd = activeFormats('**a**', s(2, 3));
  assert.equal(bd.bold, true);
  assert.equal(bd.italic, false);
});

test('activeFormats: underline inside bold and bold inside underline', () => {
  const a = activeFormats('**<u>x</u>**', s(5, 6));
  assert.equal(a.bold, true);
  assert.equal(a.underline, true);
  assert.equal(a.italic, false);
  const b = activeFormats('<u>**x**</u>', s(5, 6));
  assert.equal(b.bold, true);
  assert.equal(b.underline, true);
});

test('activeFormats: bullet line with styled text', () => {
  const a = activeFormats('• **a**', s(4));
  assert.deepEqual(a, { bold: true, italic: false, underline: false, bullet: true });
});

test('activeFormats: unbalanced markers report false and never throw', () => {
  assert.deepEqual(activeFormats('a *b', s(3)), { bold: false, italic: false, underline: false, bullet: false });
  assert.doesNotThrow(() => activeFormats('abc', s(99, -1)));
  assert.equal(activeFormats('abc', s(99, -1)).bullet, false);
});

test('activeFormats: bullet follows candidate rules for blanks and mixed lines', () => {
  assert.equal(activeFormats('• a\n  \n- b', s(0, 9)).bullet, true);
  assert.equal(activeFormats('• a\n  \nb', s(0, 8)).bullet, false);
  // selection ending at column 0 excludes the unbulleted second line
  assert.equal(activeFormats('• a\nb', s(0, 4)).bullet, true);
  // all blank -> every blank line is a candidate -> not bulleted
  assert.equal(activeFormats('\n\n', s(0, 1)).bullet, false);
});

// ---------------------------------------------------------------------------
// processNewline interplay with bullets and spans
// ---------------------------------------------------------------------------

const nl = (text, p) => text.slice(0, p) + '\n' + text.slice(p);

test('processNewline: Enter mid-bullet splits the line and continues the list', () => {
  eq(processNewline('• ab', nl('• ab', 3)), '• a\n• b', s(6));
});

test('processNewline: Enter inside the glyph prefix is left alone', () => {
  assert.equal(processNewline('• a', nl('• a', 1)), null);
});

test('processNewline: Enter right after the prefix of a non-empty item continues', () => {
  eq(processNewline('• a', nl('• a', 2)), '• \n• a', s(5));
});

test('processNewline: empty dash item on the first line ends the list', () => {
  eq(processNewline('- ', '- \n'), '', s(0));
});

test('processNewline: empty item in the middle of a list is removed', () => {
  eq(processNewline('• a\n• \n• b', nl('• a\n• \n• b', 6)), '• a\n\n• b', s(4));
});

test('processNewline: Enter at the end of a middle bullet item continues the list', () => {
  // Enter typed at the end of line 1 of a 2-item list; the new "\n" lands next
  // to the existing one, so the caret position is ambiguous from text alone.
  eq(processNewline('• a\n• b', '• a\n\n• b'), '• a\n• \n• b', s(6));
  eq(processNewline('- a\n- b', '- a\n\n- b'), '- a\n- \n- b', s(6));
});

test('processNewline: lines that only look like bullets are not continued', () => {
  assert.equal(processNewline('a - b', 'a - b\n'), null);
  assert.equal(processNewline('-x', '-x\n'), null);
  assert.equal(processNewline('•x', '•x\n'), null);
  assert.equal(processNewline('  • a', '  • a\n'), null);
});

test('processNewline: bullet line ending in a styled span continues the list at end', () => {
  eq(processNewline('• **ab**', '• **ab**\n'), '• **ab**\n• ', s(11));
});

test('processNewline: Enter inside a styled span on a bullet line keeps every line balanced', () => {
  const r = processNewline('• **ab**', nl('• **ab**', 5));
  assert.ok(r, 'expected an adjustment');
  for (const line of r.text.split('\n')) {
    const stars = (line.match(/\*\*/g) || []).length;
    assert.equal(stars % 2, 0, `unbalanced ** in ${JSON.stringify(line)}`);
  }
  // Review finding 2: the bullet carries over the break, so the new line is a list item too.
  assert.equal(r.text, '• **a**\n• **b**');
});

test('processNewline: multi-char edits and deletions return null', () => {
  assert.equal(processNewline('a', 'a\n\n'), null);
  assert.equal(processNewline('ab', 'a'), null);
  assert.equal(processNewline('• a', '• a\nb'), null);
});

test('processNewline then bullet toggle: list round-trips through Enter', () => {
  const on = bullet('a', s(1));
  const entered = processNewline(on.text, nl(on.text, on.sel.start));
  eq(entered, '• a\n• ', s(6));
  const ended = processNewline(entered.text, nl(entered.text, entered.sel.start));
  eq(ended, '• a\n', s(4));
});

// ---------------------------------------------------------------------------
// wordCount
// ---------------------------------------------------------------------------

test('wordCount: marker-only tokens and bullets', () => {
  const cases = [
    ['***', 0],
    ['** **', 0],
    ['<u> </u>', 0],
    ['a **', 1],
    ['**a** **b**', 2],
    ['<u>a</u>', 1],
    ['a\n\nb', 2],
    [' a\tb\n c ', 3],
    ['\u{1F600} hi', 2],
    ['• \u{1F600}', 1],
    ['- - a', 2],
    ['a-b', 1],
    ['• ', 0],
    ['- ', 0],
    ['• a\n• \n• b', 2],
  ];
  for (const [text, n] of cases) assert.equal(wordCount(text), n, JSON.stringify(text));
});

test('wordCount: toggling bullets or bold never changes the word count', () => {
  const t = 'one two\nthree';
  assert.equal(wordCount(bullet(t, s(0, t.length)).text), 3);
  assert.equal(wordCount(toggleFormat(t, s(0, 7), 'bold').text), 3);
  assert.equal(wordCount(toggleFormat(t, s(0, 7), 'underline').text), 3);
});

// ---------------------------------------------------------------------------
// Round-trip and structural invariants (exhaustive over small inputs)
// ---------------------------------------------------------------------------

const SAMPLES = ['', 'a', 'a\nb', 'a\n\nb', 'a\n', '\na', '\n\n', 'a\n  \nb', '\u{1F600}\nb', '**b**\nx', 'ab\ncd\nef'];
const BULLETED = ['• a', '• a\n• b', '• a\n\n• b', '• ', '• a\n'];

function* allSels(text) {
  for (let a = 0; a <= text.length; a++) for (let b = a; b <= text.length; b++) yield s(a, b);
}

test('invariant: toggling bullet twice restores text for bullet-free inputs (all selections)', () => {
  for (const text of SAMPLES) {
    for (const sel of allSels(text)) {
      const once = bullet(text, sel);
      const twice = bullet(once.text, once.sel);
      assert.equal(twice.text, text, `text=${JSON.stringify(text)} sel=${JSON.stringify(sel)}`);
    }
  }
});

test('invariant: toggling twice restores text for all-bullet inputs (all selections)', () => {
  for (const text of BULLETED) {
    for (const sel of allSels(text)) {
      if (!activeFormats(text, sel).bullet) continue;
      // Spec R4 maps an end at or inside a bullet prefix to column 0 of its
      // line, and a non-empty selection ending at column 0 then excludes that
      // line on the next tap, so those selections are not invertible by
      // design (see test report).
      let off = 0;
      const endsInPrefix = text.split('\n').some((line) => {
        const L = off;
        off += line.length + 1;
        return /^(• |- )/.test(line) && sel.start < sel.end && sel.end > L && sel.end <= L + 2;
      });
      if (endsInPrefix) continue;
      const once = bullet(text, sel);
      const twice = bullet(once.text, once.sel);
      assert.equal(twice.text, text, `text=${JSON.stringify(text)} sel=${JSON.stringify(sel)}`);
    }
  }
});

test('invariant: selection stays in range, ordered, and a caret stays a caret', () => {
  for (const text of [...SAMPLES, ...BULLETED]) {
    for (const sel of allSels(text)) {
      const r = bullet(text, sel);
      assert.ok(r.sel.start >= 0 && r.sel.end <= r.text.length, `range ${JSON.stringify([text, sel, r])}`);
      assert.ok(r.sel.start <= r.sel.end, `order ${JSON.stringify([text, sel, r])}`);
      if (sel.start === sel.end) assert.equal(r.sel.start, r.sel.end, `caret ${JSON.stringify([text, sel])}`);
    }
  }
});

test('invariant: bullet toggle only changes bullet prefixes (content is preserved)', () => {
  const strip = (t) => t.split('\n').map((l) => l.replace(/^(• |- )/, '')).join('\n');
  for (const text of [...SAMPLES, ...BULLETED]) {
    for (const sel of allSels(text)) {
      assert.equal(strip(bullet(text, sel).text), strip(text), JSON.stringify([text, sel]));
    }
  }
});

test('invariant: activeFormats().bullet predicts the direction of the toggle', () => {
  for (const text of [...SAMPLES, ...BULLETED, '- a\n• b', 'a\n• b']) {
    for (const sel of allSels(text)) {
      const r = bullet(text, sel);
      if (activeFormats(text, sel).bullet) {
        assert.ok(r.text.length < text.length, `expected removal ${JSON.stringify([text, sel])}`);
      } else {
        assert.ok(r.text.length > text.length, `expected insertion ${JSON.stringify([text, sel])}`);
      }
    }
  }
});

test('invariant: toggling bullet twice also restores the selection for bullet-free inputs', () => {
  for (const text of ['a\nb', 'abc\ndef', 'ab\ncd\nef']) {
    for (const sel of allSels(text)) {
      const once = bullet(text, sel);
      const twice = bullet(once.text, once.sel);
      assert.deepEqual(twice.sel, sel, JSON.stringify([text, sel]));
    }
  }
});

test('invariant: inline toggle twice restores text for every selection of a plain word', () => {
  for (const f of ['bold', 'italic', 'underline']) {
    for (const sel of allSels('hello')) {
      const once = toggleFormat('hello', sel, f);
      const twice = toggleFormat(once.text, once.sel, f);
      assert.equal(twice.text, 'hello', `${f} ${JSON.stringify(sel)}`);
    }
  }
});

// ---------------------------------------------------------------------------
// MarkdownText still renders every character (storage stays plain text)
// ---------------------------------------------------------------------------

function flat(node) {
  if (node === null || node === undefined || node === false) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(flat).join('');
  if (node.props !== undefined) return flat(node.props.children);
  return '';
}

test('MarkdownText renders toggleFormat/processNewline output char-for-char', () => {
  const outputs = [
    bullet('a\nb\nc', s(0, 5)).text,
    bullet('• a\n- b', s(0, 7)).text,
    toggleFormat('hello', s(0, 5), 'bold').text,
    toggleFormat('hello', s(0, 5), 'underline').text,
    '• **bold** and *it*\n- <u>u</u>\n\n• ',
    processNewline('• hello', '• hello\n').text,
    processNewline('• **ab**', nl('• **ab**', 5)).text,
    '\u{1F600} • x',
  ];
  for (const t of outputs) {
    assert.equal(flat(MarkdownText({ text: t })), t, JSON.stringify(t));
  }
});
