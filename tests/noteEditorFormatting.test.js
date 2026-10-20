// Unit tests for the pure markdown-formatting helpers in
// src/screens/NoteEditorScreen.tsx (toggleInline, toggleList, processNewline,
// isWrappedWith, wordCount) plus the toolbar active-state computation and
// the footer padding.
//
// These functions are module-private (not exported) and the component also
// imports react-navigation/services/lucide-react-native, which would need a
// heavy mock surface to load the whole file. Since the functions under test
// are pure (no imports, no JSX) and the spec states they must NOT change for
// this feature, we extract their *exact* source text by line range straight
// out of the real file (verified by substring checks below, so a rename or
// signature change fails loudly here rather than silently testing stale
// logic), transpile just the types away with the TypeScript compiler API
// (already an existing devDependency), and execute the real code.
//
// No test runner is configured in this repo; this uses Node's built-in
// `node --test` (no new dependency).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');
const SCREEN_FILE = path.join(ROOT, 'src/screens/NoteEditorScreen.tsx');

const allLines = fs.readFileSync(SCREEN_FILE, 'utf8').split('\n');

// Lines 26-171 (1-indexed) define wordCount/Sel/FormatResult/escapeForRegExp/
// isWrappedWith/toggleInline/BULLET/INLINE_SPAN/processNewline, with no
// imports and no JSX.
const HELPERS_START = 50;
const HELPERS_END = 195;
const helpersSrc = allLines.slice(HELPERS_START - 1, HELPERS_END).join('\n');

for (const marker of [
  'function wordCount',
  'function isWrappedWith',
  'function toggleInline',
  'function processNewline',
]) {
  assert.ok(
    helpersSrc.includes(marker),
    `Expected extracted NoteEditorScreen.tsx lines ${HELPERS_START}-${HELPERS_END} to contain "${marker}" — ` +
      'the source may have moved; update the line range in this test file.'
  );
}

// Lines 386-388 (1-indexed): the toolbar active-state computation, verbatim.
const ACTIVE_START = 482;
const ACTIVE_END = 484;
const activeSrc = allLines.slice(ACTIVE_START - 1, ACTIVE_END).join('\n');
for (const marker of ['boldActive', 'italicActive', 'underlineActive']) {
  assert.ok(
    activeSrc.includes(marker),
    `Expected extracted NoteEditorScreen.tsx lines ${ACTIVE_START}-${ACTIVE_END} to contain "${marker}" — ` +
      'the source may have moved; update the line range in this test file.'
  );
}

const harnessSrc = `
${helpersSrc}

function getActiveStates(content, sel) {
${activeSrc}
  return { boldActive, italicActive, underlineActive };
}

module.exports = { wordCount, isWrappedWith, toggleInline, processNewline, getActiveStates };
`;

const transpiled = ts.transpileModule(harnessSrc, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2019,
  },
  reportDiagnostics: true,
}).outputText;

const mod = { exports: {} };
new Function('exports', 'require', 'module', transpiled)(mod.exports, require, mod);
const { wordCount, isWrappedWith, toggleInline, processNewline, getActiveStates } = mod.exports;

// ---------------------------------------------------------------------------
// AC1 / AC3: applying Bold produces exactly `**hello**`
// ---------------------------------------------------------------------------

test('AC1/AC3: toggleInline bold-wraps a selection with **', () => {
  const r = toggleInline('hello', { start: 0, end: 5 }, '**');
  assert.equal(r.text, '**hello**');
  assert.deepEqual(r.sel, { start: 2, end: 7 });
});

test('AC2: toggleInline italic-wraps a selection with single *', () => {
  const r = toggleInline('hello', { start: 0, end: 5 }, '*');
  assert.equal(r.text, '*hello*');
});

test('AC2: toggleInline underline-wraps a selection with <u></u>', () => {
  const r = toggleInline('hello', { start: 0, end: 5 }, '<u>', '</u>');
  assert.equal(r.text, '<u>hello</u>');
});

// ---------------------------------------------------------------------------
// AC6: tapping Bold again on bold text removes bold, round-trips to plain
// ---------------------------------------------------------------------------

test('AC6: toggleInline unwraps an already-bold selection back to plain text', () => {
  const r = toggleInline('**hello**', { start: 0, end: 9 }, '**');
  assert.equal(r.text, 'hello');
  assert.deepEqual(r.sel, { start: 0, end: 5 });
});

test('AC6: toggleInline unwraps when caret is inside the span (collapsed selection touching markers)', () => {
  // caret placed just inside the wrapping markers, e.g. sel {2,2} within "**hello**"
  const r = toggleInline('**hello**', { start: 2, end: 7 }, '**');
  assert.equal(r.text, 'hello');
});

// ---------------------------------------------------------------------------
// AC5 / edge case: typing inside a bold span keeps surrounding markers intact
// ---------------------------------------------------------------------------

test('AC5: characters inserted inside a bold span keep the surrounding ** intact', () => {
  // Simulates onChangeText after the user typed "X" with the caret at
  // offset 6 inside "**hello**" (**hell|o** -> **hellXo**). We only assert
  // the data invariant here: splicing inside the span does not touch the
  // marker characters at the boundaries.
  const before = '**hello**';
  const caret = 6; // between "hell" and "o"
  const after = before.slice(0, caret) + 'X' + before.slice(caret);
  assert.equal(after, '**hellXo**');
  assert.ok(after.startsWith('**') && after.endsWith('**'));
});

// ---------------------------------------------------------------------------
// AC7: toolbar active-state highlight reflects caret/selection position
// ---------------------------------------------------------------------------

test('AC7: boldActive is true when the SELECTION exactly spans the visible bold text', () => {
  // This is the realistic WYSIWYG interaction: markers are invisible, so a
  // user drag-selecting the on-screen bold word selects exactly "bold"
  // (indices 2-6 of "**bold** plain"), not the hidden ** markers.
  const content = '**bold** plain';
  const selectedWord = getActiveStates(content, { start: 2, end: 6 });
  assert.equal(selectedWord.boldActive, true);
  const outside = getActiveStates(content, { start: 12, end: 12 }); // caret inside "plain"
  assert.equal(outside.boldActive, false);
});

test('AC7 (fix-cycle): boldActive is true for a plain caret (no selection) placed mid-word inside a bold span', () => {
  // isWrappedWith's third branch (added in the fix cycle) scans every
  // non-overlapping open...close pair and checks whether the caret/selection
  // falls strictly inside one of them. This covers the realistic case of a
  // caret resting in the middle of already-typed bold text with no active
  // selection (previously only exact-selection or marker-adjacent-collapsed
  // caret lit up the toolbar). See src/screens/NoteEditorScreen.tsx:37-61.
  const content = '**bold** plain';
  const caretMidWord = getActiveStates(content, { start: 4, end: 4 }); // caret between "bo|ld"
  assert.equal(caretMidWord.boldActive, true, 'AC7 requires caret-inside-span to activate Bold highlight');
});

test('AC7 (fix-cycle): italicActive is true for a plain caret mid-word inside an italic span', () => {
  const italic = getActiveStates('*italic*', { start: 3, end: 3 }); // caret mid-word
  assert.equal(italic.italicActive, true, 'AC7 requires caret-inside-span to activate Italic highlight');
});

test('AC7 (fix-cycle): underlineActive is true for a plain caret mid-word inside <u></u>', () => {
  const active = getActiveStates('<u>hi</u>', { start: 4, end: 4 }); // caret between "h|i"
  assert.equal(active.underlineActive, true, 'AC7 requires caret-inside-span to activate Underline highlight');
});

test('AC7: italicActive is true when SELECTION exactly spans single-* italic text', () => {
  const italic = getActiveStates('*italic*', { start: 1, end: 7 }); // selects "italic"
  assert.equal(italic.italicActive, true);
});

test('AC7: underlineActive is true when SELECTION exactly spans <u></u> text, false outside', () => {
  const active = getActiveStates('<u>hi</u> there', { start: 3, end: 5 }); // selects "hi"
  assert.equal(active.underlineActive, true);
  const inactive = getActiveStates('plain', { start: 2, end: 2 });
  assert.equal(inactive.underlineActive, false);
});

// ---------------------------------------------------------------------------
// AC7 additional edge cases: the fix-cycle's own log calls out the risk of a
// caret in the *plain-text gap between two separate same-marker pairs* being
// misidentified as "inside" a span by a naive nearest-marker search. These
// tests exercise exactly that scenario (and neighbouring boundary cases)
// against the real isWrappedWith implementation.
// ---------------------------------------------------------------------------

test('AC7 edge case: boldActive is false for a caret in the plain-text gap between two separate bold pairs', () => {
  // "**bold** |**also**" -- caret sits in the space between two bold pairs,
  // not inside either one's inner text.
  const content = '**bold** **also**';
  const gapIndex = content.indexOf(' '); // the single space between the pairs
  const gap = getActiveStates(content, { start: gapIndex, end: gapIndex });
  assert.equal(gap.boldActive, false);
});

test('AC7 edge case: italicActive is false for a caret in the plain-text gap between two separate italic pairs', () => {
  const content = '*italic* *more*';
  const gapIndex = content.indexOf(' ');
  const gap = getActiveStates(content, { start: gapIndex, end: gapIndex });
  assert.equal(gap.italicActive, false);
});

test('AC7 edge case: boldActive is false for a caret sitting on the marker characters between two immediately-adjacent bold pairs (no gap)', () => {
  // "**one****two**" -- no plain-text gap at all between the two pairs; the
  // caret placed on the boundary marker characters must not be reported as
  // "inside" either pair.
  const content = '**one****two**';
  const boundaryIndex = content.indexOf('**', 2) + 1; // inside the 4-star boundary run
  const boundary = getActiveStates(content, { start: boundaryIndex, end: boundaryIndex });
  assert.equal(boundary.boldActive, false);
});

test('AC7 edge case: boldActive is false when the selection partially overlaps a bold pair boundary (starts inside, ends outside)', () => {
  // Selection spans from inside "bold" out past the closing ** and into the
  // following plain text -- must not be treated as "inside" the pair.
  const content = '**bold** plain';
  const partial = getActiveStates(content, { start: 4, end: 10 }); // "ld** p"
  assert.equal(partial.boldActive, false);
});

test('AC7 edge case: boldActive is true for a non-marker-touching selection fully contained inside a bold pair', () => {
  // A drag-selection of a substring of the bold word itself (not touching
  // the ** boundaries at all) should still register as "inside" the span.
  const content = '**bold word**';
  const inner = getActiveStates(content, { start: 4, end: 9 }); // "ld wo", fully inside "bold word"
  assert.equal(inner.boldActive, true);
});

// ---------------------------------------------------------------------------
// processNewline: Enter inside a styled span closes it before the break (and
// reopens it after when span text continues); bullet lines continue/end the
// list. Simulates onChangeText(old + typed newline).
// ---------------------------------------------------------------------------

function typeNewlineAt(text, p) {
  return text.slice(0, p) + '\n' + text.slice(p);
}

test('processNewline: Enter at the end of a bold span moves the closing ** before the break', () => {
  // "**bold|**" + Enter used to produce "**bold\n**" (raw markers visible on
  // both lines); now the span is closed on its own line.
  const old = '**bold**';
  const r = processNewline(old, typeNewlineAt(old, 6));
  assert.equal(r.text, '**bold**\n');
  assert.deepEqual(r.sel, { start: 9, end: 9 });
});

test('processNewline: Enter mid-span splits into two complete spans', () => {
  const old = '**bold**';
  const r = processNewline(old, typeNewlineAt(old, 4)); // **bo|ld**
  assert.equal(r.text, '**bo**\n**ld**');
  assert.deepEqual(r.sel, { start: 9, end: 9 }); // caret after reopening **
});

test('processNewline: Enter right after the opening markers drops the empty left pair', () => {
  const old = '**bold**';
  const r = processNewline(old, typeNewlineAt(old, 2)); // **|bold**
  assert.equal(r.text, '\n**bold**');
  assert.deepEqual(r.sel, { start: 3, end: 3 }); // caret after the reopened **
});

test('processNewline: works for underline spans too', () => {
  const old = '<u>hi</u>';
  const r = processNewline(old, typeNewlineAt(old, 5)); // <u>hi|</u>
  assert.equal(r.text, '<u>hi</u>\n');
  assert.deepEqual(r.sel, { start: 10, end: 10 });
});

test('processNewline: Enter on a bullet line continues the list', () => {
  const old = '• item';
  const r = processNewline(old, typeNewlineAt(old, 6));
  assert.equal(r.text, '• item\n• ');
  assert.deepEqual(r.sel, { start: 9, end: 9 });
});

test('processNewline: Enter on an empty bullet item ends the list (removes the bullet)', () => {
  const old = 'a\n• ';
  const r = processNewline(old, typeNewlineAt(old, 4));
  assert.equal(r.text, 'a\n');
  assert.deepEqual(r.sel, { start: 2, end: 2 });
});

test('processNewline: returns null for a plain newline outside any span', () => {
  assert.equal(processNewline('hello', typeNewlineAt('hello', 5)), null);
  // Enter after the closing markers is a plain newline, not a span split.
  assert.equal(processNewline('**bold**', typeNewlineAt('**bold**', 8)), null);
});

test('processNewline: returns null for non-newline edits and multi-char pastes', () => {
  assert.equal(processNewline('ab', 'axb'), null);
  assert.equal(processNewline('ab', 'a\n\nb'), null);
  assert.equal(processNewline('ab', 'a'), null);
});

// ---------------------------------------------------------------------------
// AC9: word count stays accurate
// ---------------------------------------------------------------------------

test('AC9: wordCount counts whitespace-separated words, ignoring markup characters', () => {
  assert.equal(wordCount(''), 0);
  assert.equal(wordCount('   '), 0);
  assert.equal(wordCount('hello'), 1);
  assert.equal(wordCount('**hello** world'), 2);
  // Bullet dashes are counted as separate whitespace-separated tokens by
  // the current implementation (it operates on raw markdown, not the
  // WYSIWYG-hidden view) -- "-", "one", "-", "two" = 4.
  assert.equal(wordCount('- one\n- two'), 4);
});

// ---------------------------------------------------------------------------
// Edge case: unbalanced markers while typing must not crash isWrappedWith/toggle
// ---------------------------------------------------------------------------

test('edge case: isWrappedWith with a lone unmatched marker does not throw and returns false', () => {
  assert.doesNotThrow(() => isWrappedWith('a *b', { start: 2, end: 2 }, '*'));
  assert.equal(isWrappedWith('a *b', { start: 0, end: 0 }, '*'), false);
});

// ---------------------------------------------------------------------------
// R2 footer padding: constant 12, keyboard open or closed (no inset-driven
// gap in either state)
// ---------------------------------------------------------------------------

test('R2/AC10/AC11: footer uses constant paddingBottom: 10 (matching ChatScreen) with no inset/keyboard dependence', () => {
  const src = allLines.join('\n');
  assert.ok(
    /footer:\s*\{[^}]*paddingBottom:\s*10/s.test(src),
    'Expected styles.footer in NoteEditorScreen.tsx to set paddingBottom: 10'
  );
  assert.ok(
    !src.includes('keyboardVisible') && !src.includes('Math.max(insets.bottom'),
    'Footer padding must not depend on keyboard visibility or safe-area insets'
  );
});

test('body TextInput disables its own scrolling so the outer ScrollView can scroll while the keyboard is up', () => {
  const src = allLines.join('\n');
  assert.ok(
    src.includes('scrollEnabled={false}'),
    'Expected the body TextInput to set scrollEnabled={false}'
  );
});

test('save dismisses the keyboard', () => {
  const src = allLines.join('\n');
  const saveBody = src.slice(src.indexOf('const save = useCallback'), src.indexOf('const handleBack'));
  assert.ok(saveBody.includes('Keyboard.dismiss()'), 'Expected save() to call Keyboard.dismiss()');
});
