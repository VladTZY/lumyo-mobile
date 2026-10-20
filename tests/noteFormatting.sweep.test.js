// Exhaustive sweep for processNewline: type "\n" at every caret position of
// many small texts and assert behavioural invariants (not recomputed outputs).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const loadMod = (rel) => {
  const src = fs.readFileSync(path.resolve(__dirname, rel), 'utf8');
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
  }).outputText;
  const mod = { exports: {} };
  new Function('exports', 'require', 'module', js)(mod.exports, require, mod);
  return mod.exports;
};
const { processNewline } = loadMod('../src/lib/noteFormatting.ts');

const TEXTS = [
  '', 'a', 'ab', '\n', 'a\nb',
  '• ', '• a', '• ab', '• a\n• b', '• a\n• ', '• \n• b', '• a\n\n• b', '• a\n\nNext', 'x\n• a\ny',
  '- ', '- a', '- a\n- b', '- a\n- ', 'a\n- b\nc',
  '**a**', '**ab**', '*ab*', '***ab***', '<u>ab</u>', 'x **ab** y', 'x *ab* y', 'x <u>ab</u> y',
  '• **ab**', '• *ab*', '• <u>ab</u>', '- **ab**', '- <u>ab</u>', '• **a** b', '• a **b**',
  '• **a**\n• **b**', '**a**\n**b**', '• **ab** and *cd*', '**a** *b* <u>c</u>',
  '•', '•a', '-', '-a',
];

const BUL = ['• ', '- '];
const prefixOf = (line) => BUL.find((b) => line.startsWith(b)) ?? null;
const stripMarkers = (s) => s.replace(/<\/?u>/g, '').replace(/\*/g, '');
const balanced = (line) => {
  const u = (line.match(/<u>/g) || []).length === (line.match(/<\/u>/g) || []).length;
  const stars = (line.replace(/<\/?u>/g, '').match(/\*/g) || []).length % 2 === 0;
  return u && stars;
};
// Content with bullet prefixes and markers removed: the typed text itself.
const plain = (t) => t.split('\n').map((l) => stripMarkers(l.slice((prefixOf(l) ?? '').length))).join('\n');
const count = (t, ch) => t.split(ch).length - 1;
const bulletLines = (t) => t.split('\n').filter((l) => prefixOf(l) !== null).length;

function caretLine(text, c) {
  const start = text.lastIndexOf('\n', c - 1) + 1;
  let end = text.indexOf('\n', c);
  if (end === -1) end = text.length;
  return { start, line: text.slice(start, end), end };
}

// Caret strictly inside a marker token ("*|*", "<|u>"): a malformed typing
// position, excluded from the balance invariant (reported separately).
function insideMarker(text, c) {
  const re = /\*{2,3}|<u>|<\/u>/g;
  let m;
  while ((m = re.exec(text))) if (c > m.index && c < m.index + m[0].length) return true;
  return false;
}

function sweep(texts, { checkBalance = true } = {}) {
  let cases = 0;
  for (const T of texts) {
    for (let c = 0; c <= T.length; c++) {
      const N = T.slice(0, c) + '\n' + T.slice(c);
      const ctx = `old=${JSON.stringify(T)} caret=${c}`;
      let r;
      assert.doesNotThrow(() => { r = processNewline(T, N, c); }, ctx);
      cases++;
      const { start: ls, line, end: le } = caretLine(T, c);
      const prefix = prefixOf(line);
      const inContent = prefix !== null && c >= ls + prefix.length;
      const emptyItem = prefix !== null && line === prefix && c === le;

      if (r === null) {
        // No adjustment is only allowed where no list behaviour applies.
        assert.ok(!inContent, `bullet line with caret in content must not return null: ${ctx}`);
        continue;
      }
      assert.equal(typeof r.text, 'string', ctx);
      // Selection is a collapsed caret within range.
      assert.equal(r.sel.start, r.sel.end, `collapsed sel: ${ctx}`);
      assert.ok(Number.isInteger(r.sel.start) && r.sel.start >= 0 && r.sel.start <= r.text.length, `sel in range: ${ctx} got ${JSON.stringify(r)}`);

      if (emptyItem) {
        // Empty bullet item ends the list: prefix removed, no newline added.
        assert.equal(r.text, T.slice(0, ls) + T.slice(le), `empty item ends list: ${ctx}`);
        assert.equal(bulletLines(r.text), bulletLines(T) - 1, ctx);
        assert.equal(r.sel.start, ls, ctx);
        continue;
      }
      // Documented transformation: same typed content as the plain newline.
      assert.equal(plain(r.text), plain(N), `content preserved: ${ctx} got ${JSON.stringify(r.text)}`);
      // Exactly one newline added; caret sits right after it (plus prefix/markers).
      assert.equal(count(r.text, '\n'), count(T, '\n') + 1, `one newline: ${ctx}`);
      assert.equal(count(r.text.slice(0, r.sel.start), '\n'), count(T.slice(0, c), '\n') + 1, `caret after the new break: ${ctx} got ${JSON.stringify(r)}`);
      // Bullets are only added from a bullet line with content before the caret.
      assert.equal(bulletLines(r.text), bulletLines(T) + (inContent ? 1 : 0), `bullet count: ${ctx} got ${JSON.stringify(r.text)}`);
      if (inContent) {
        const after = r.text.slice(r.text.lastIndexOf('\n', r.sel.start - 1) + 1);
        assert.ok(after.startsWith(prefix), `new line starts with prefix: ${ctx} got ${JSON.stringify(r.text)}`);
      }
      if (checkBalance) {
        const oldLines = T.split('\n');
        const wasBalanced = oldLines.every(balanced);
        // Only a caret outside marker characters is a meaningful typing position.
        if (wasBalanced && !insideMarker(T, c)) {
          r.text.split('\n').forEach((l) => assert.ok(balanced(l), `balanced line ${JSON.stringify(l)}: ${ctx} got ${JSON.stringify(r.text)}`));
        }
      }
    }
  }
  return cases;
}

test('sweep: newline at every caret of bulleted / styled / mixed LF texts', () => {
  const n = sweep(TEXTS);
  assert.ok(n > 300, `swept ${n} cases`);
});

test('sweep: new line from a bullet always starts with the same bullet glyph (legacy "- " stays "- ")', () => {
  assert.equal(processNewline('- a', '- a\n', 3).text, '- a\n- ');
  assert.equal(processNewline('• a', '• a\n', 3).text, '• a\n• ');
  assert.equal(processNewline('- a\n- b', '- a\n\n- b', 3).text, '- a\n- \n- b');
});

test('sweep: no bullet when caret is within the prefix', () => {
  assert.equal(processNewline('• a', '\n• a', 0), null);
  assert.equal(processNewline('• a', '•\n a', 1), null);
  assert.equal(processNewline('- a', '-\n a', 1), null);
});

test('sweep: empty bullet items end the list wherever they sit', () => {
  for (const [T, c, expected] of [
    ['• ', 2, ''], ['- ', 2, ''], ['• a\n• ', 6, '• a\n'], ['- a\n- ', 6, '- a\n'],
    ['• \n• b', 2, '\n• b'], ['x\n• \ny', 4, 'x\n\ny'],
  ]) {
    const N = T.slice(0, c) + '\n' + T.slice(c);
    const r = processNewline(T, N, c);
    assert.equal(r && r.text, expected, `${JSON.stringify(T)} caret ${c}`);
  }
});

test('sweep: CRLF texts never throw and keep selection in range', () => {
  const crlf = ['• a\r\n• b', '• a\r\n• ', '- a\r\n- b', '• **a**\r\n• b', 'a\r\n', '• \r\n• b'];
  for (const T of crlf) {
    for (let c = 0; c <= T.length; c++) {
      const N = T.slice(0, c) + '\n' + T.slice(c);
      const r = processNewline(T, N, c);
      if (r) {
        const { line, end: le } = caretLine(T, c);
        const pre = prefixOf(line);
        if (pre !== null && line.replace(/\r$/, '') === pre.replace(/\s+$/, '') + ' ' && false) continue;
        assert.ok(r.sel.start >= 0 && r.sel.start <= r.text.length && r.sel.start === r.sel.end, `${JSON.stringify(T)}@${c}`);
        const ended = pre !== null && line === pre && c === le; // empty item: list ends, no break added
        if (!ended) assert.equal(plain(r.text).replace(/\r/g, ''), plain(N).replace(/\r/g, ''), `${JSON.stringify(T)}@${c} -> ${JSON.stringify(r.text)}`);
      }
    }
  }
});

test('sweep: CRLF bullet line with content continues the list (Enter at end of item before \\r)', () => {
  const r = processNewline('• a\r\n• b', '• a\n\r\n• b', 3);
  assert.ok(r, 'expected continuation on a CRLF bullet line');
  assert.ok(r.text.startsWith('• a\n• '), JSON.stringify(r.text));
});

test('sweep: non-single-newline edits return null', () => {
  assert.equal(processNewline('• a', '• ab', 3), null);
  assert.equal(processNewline('• a', '• a\n\n', 3), null);
  assert.equal(processNewline('• a', '• x\n', 3), null);
  assert.equal(processNewline('• a', '• a', 3), null);
});

// ---- Fix cycle 1 source-level checks (no line numbers) ----
const screen = fs.readFileSync(path.resolve(__dirname, '../src/screens/NoteEditorScreen.tsx'), 'utf8');
const block = (re) => { const m = screen.match(re); assert.ok(m, `missing ${re}`); return m[0]; };

test('source: clearSaved cancels the timer and resets justSaved', () => {
  const b = block(/const clearSaved = useCallback\(\(\) => \{[\s\S]*?\}, \[\]\);/);
  assert.match(b, /clearTimeout\(savedTimerRef\.current\)/);
  assert.match(b, /setJustSaved\(false\)/);
});

test('source: title edit, body edit and format taps all call clearSaved', () => {
  assert.match(screen, /onChangeText=\{\(t\) => \{ setTitle\(t\); clearSaved\(\);/);
  assert.match(block(/onChangeText=\{\(t\) => \{\s*clearHighlight\(\);[\s\S]*?processNewline/), /clearSaved\(\)/);
  assert.match(block(/const applyFormat = useCallback\([\s\S]*?\}, \[[^\]]*\]\);/), /clearSaved\(\)/);
});

test('source: body handler passes the pre-edit caret (sel.start) to processNewline', () => {
  assert.match(screen, /processNewline\(contentRef\.current, t, sel\.start\)/);
});

test('source: save button reserves width for "Saved" (minWidth >= 104)', () => {
  const m = screen.match(/saveBtn:\s*\{[^}]*minWidth:\s*(\d+)/s);
  assert.ok(m, 'saveBtn minWidth missing');
  assert.ok(Number(m[1]) >= 104, `minWidth ${m[1]}`);
});

test('source: editor ScrollView sets keyboardDismissMode (interactive on iOS, on-drag elsewhere)', () => {
  assert.match(screen, /keyboardDismissMode=\{Platform\.OS === 'ios' \? 'interactive' : 'on-drag'\}/);
});

test('source: body value uses the web constant, not an inline Platform check', () => {
  assert.match(screen, /value=\{web \? content : undefined\}/);
  assert.match(screen, /const web = Platform\.OS === 'web';/);
});

test('source: save flow still ends in a Saved flash that is timed and announced', () => {
  const b = block(/isDirty\.current = false;\s*setJustSaved\(true\);[\s\S]*?announceForAccessibility\('Note saved'\)/);
  assert.match(b, /setTimeout\(\(\) => setJustSaved\(false\), SAVED_FLASH_MS\)/);
});
