// Unit tests for src/components/MarkdownText.tsx (WYSIWYG marker-hiding, R1).
//
// There is no test runner configured in this repo (no jest/vitest, no
// "test" script in package.json). These tests use Node's built-in test
// runner (`node --test`, no new dependency) and the TypeScript compiler API
// (already an existing devDependency) to transpile the *actual* source file
// and execute it against a minimal in-memory mock of `react-native` (Text /
// StyleSheet.create), plus the real `react` and the real `src/theme` module
// (also transpiled). This exercises the real renderInline/renderLines logic
// verbatim rather than a re-implementation of it.
//
// Because MarkdownText's output is a plain React-element tree (Text is
// mocked to a plain string "type", not a real host component), we can call
// the component function directly and walk the returned element tree without
// any renderer/reconciler.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');
const MARKDOWN_TEXT_FILE = path.join(ROOT, 'src/components/MarkdownText.tsx');
const THEME_FILE = path.join(ROOT, 'src/theme/index.ts');

function transpile(file, jsx) {
  const src = fs.readFileSync(file, 'utf8');
  const compilerOptions = {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2019,
    esModuleInterop: true,
  };
  if (jsx) compilerOptions.jsx = ts.JsxEmit.React;
  const result = ts.transpileModule(src, {
    compilerOptions,
    reportDiagnostics: true,
  });
  assert.equal(
    result.diagnostics && result.diagnostics.length > 0 ? result.diagnostics.length : 0,
    0,
    `Unexpected TS diagnostics while transpiling ${file}`
  );
  return result.outputText;
}

function runCompiled(compiledJs, filename, requireMap) {
  const customRequire = (request) => {
    if (Object.prototype.hasOwnProperty.call(requireMap, request)) return requireMap[request];
    return require(request);
  };
  const mod = { exports: {} };
  const fn = new Function('exports', 'require', 'module', '__filename', '__dirname', compiledJs);
  fn(mod.exports, customRequire, mod, filename, path.dirname(filename));
  return mod.exports;
}

// --- Load the real theme module (pure constants, no JSX/RN import needed) ---
const themeExports = runCompiled(transpile(THEME_FILE, false), THEME_FILE, {});

// --- Minimal react-native mock: Text is just an opaque "host component"
// marker (a string), StyleSheet.create is the identity function, matching
// how the real RN API is used by MarkdownText.tsx. ---
const mockReactNative = {
  Text: 'Text',
  StyleSheet: { create: (obj) => obj },
};

// --- Load the real, unmodified MarkdownText.tsx source ---
const markdownTextSrc = fs.readFileSync(MARKDOWN_TEXT_FILE, 'utf8');
const { MarkdownText, stripMarkdown } = runCompiled(
  transpile(MARKDOWN_TEXT_FILE, true),
  MARKDOWN_TEXT_FILE,
  { 'react-native': mockReactNative, '../theme': themeExports }
);

// --- Tree-walking helpers ---
// Flattens the React-element tree returned by MarkdownText into a list of
// {text, styles} leaf runs, where `styles` is the array of style objects
// inherited down the Text-element chain to that leaf.
function flatten(node, inherited) {
  if (node === null || node === undefined || node === false) return [];
  if (typeof node === 'string') return [{ text: node, styles: inherited }];
  if (typeof node === 'number') return [{ text: String(node), styles: inherited }];
  if (Array.isArray(node)) return node.flatMap((n) => flatten(n, inherited));
  // React element: { type, props: { style, children } }
  if (node.props !== undefined) {
    const nextStyles = node.props.style !== undefined ? inherited.concat([node.props.style]) : inherited;
    return flatten(node.props.children, nextStyles);
  }
  return [];
}

function isHiddenStyle(styles) {
  return styles.some((st) => st && st.fontSize === 0 && st.color === 'transparent');
}

function runs(text) {
  const el = MarkdownText({ text });
  return flatten(el, []);
}

function fullText(text) {
  return runs(text).map((r) => r.text).join('');
}

function visibleText(text) {
  return runs(text)
    .filter((r) => !isHiddenStyle(r.styles))
    .map((r) => r.text)
    .join('');
}

function hasStyleProp(text, predicate) {
  return runs(text).some((r) => !isHiddenStyle(r.styles) && r.styles.some(predicate));
}

// ---------------------------------------------------------------------------
// R1.1 / R1.2 / AC1, AC2 — markers hidden on screen, content string unchanged
// ---------------------------------------------------------------------------

test('AC1/R1.1: bold markers (**) are not visible; text renders styled', () => {
  assert.equal(visibleText('**hello**'), 'hello');
  assert.equal(fullText('**hello**'), '**hello**'); // char-for-char preserved (R1.2)
  assert.ok(hasStyleProp('**hello**', (st) => st.fontFamily === themeExports.fonts.inter.semiBold));
});

test('AC2/R1.1: italic markers (*) are not visible; text renders with a real italic font face', () => {
  // iOS does not synthesize italics for custom fonts, so the style must use
  // the loaded Inter italic face rather than fontStyle: 'italic'.
  assert.equal(visibleText('*hello*'), 'hello');
  assert.equal(fullText('*hello*'), '*hello*');
  assert.ok(hasStyleProp('*hello*', (st) => st.fontFamily === themeExports.fonts.inter.italic));
});

test('AC2: bold-italic markers (***) are not visible; text renders with the semibold-italic face', () => {
  assert.equal(visibleText('***hello***'), 'hello');
  assert.equal(fullText('***hello***'), '***hello***');
  assert.ok(hasStyleProp('***hello***', (st) => st.fontFamily === themeExports.fonts.inter.semiBoldItalic));
});

test('AC2: underline markers (<u></u>) are not visible; text renders underlined', () => {
  assert.equal(visibleText('<u>hello</u>'), 'hello');
  assert.equal(fullText('<u>hello</u>'), '<u>hello</u>');
  assert.ok(hasStyleProp('<u>hello</u>', (st) => st.textDecorationLine === 'underline'));
});

test('link support removed: [text](url) renders as plain visible text', () => {
  const src = '[click here](https://example.com)';
  assert.equal(visibleText(src), src);
  assert.equal(fullText(src), src);
});

test('edge case: nested/adjacent markers on one line render correctly and round-trip', () => {
  const src = '**bold** *italic* text';
  assert.equal(visibleText(src), 'bold italic text');
  assert.equal(fullText(src), src);
});

test('edge case: marker immediately followed by punctuation still matches and round-trips', () => {
  const src = '**bold**!';
  assert.equal(visibleText(src), 'bold!');
  assert.equal(fullText(src), src);
});

test('edge case: unbalanced/partial markers (lone *) render as plain text, not hidden', () => {
  const src = 'a *b';
  assert.equal(visibleText(src), src);
  assert.equal(fullText(src), src);
});

test('edge case: bare asterisk runs (fresh empty pair "****", stray "**") are hidden, not shown raw', () => {
  // The moment the toolbar inserts an empty pair the user must not see the
  // raw markers — they stay in the string but render collapsed.
  assert.equal(visibleText('****'), '');
  assert.equal(fullText('****'), '****');
  assert.equal(visibleText('x ** y'), 'x  y');
  assert.equal(fullText('x ** y'), 'x ** y');
});

test('edge case: empty content does not crash and produces no visible/hidden text', () => {
  assert.doesNotThrow(() => MarkdownText({ text: '' }));
  assert.equal(fullText(''), '');
  assert.equal(visibleText(''), '');
});

test('R1: bullet prefixes ("• " and legacy "- ") stay visible (not treated as hidden markers)', () => {
  for (const prefix of ['• ', '- ']) {
    const src = `${prefix}**bold** item`;
    assert.equal(fullText(src), src);
    assert.equal(visibleText(src), `${prefix}bold item`);
    const bulletRun = runs(src)[0];
    assert.equal(bulletRun.text, prefix);
    assert.ok(!isHiddenStyle(bulletRun.styles), 'bullet prefix must not be hidden');
  }
});

test('multi-line content: bullets and inline styles across lines round-trip', () => {
  const src = '- **first**\n- second\nplain *third*';
  assert.equal(fullText(src), src);
  assert.equal(visibleText(src), '- first\n- second\nplain third');
});

// ---------------------------------------------------------------------------
// stripMarkdown (must be unchanged per spec — used for previews elsewhere)
// ---------------------------------------------------------------------------

test('stripMarkdown: strips bold/italic/underline/link/bullet/heading/code markers', () => {
  assert.equal(stripMarkdown('**bold**'), 'bold');
  assert.equal(stripMarkdown('*italic*'), 'italic');
  assert.equal(stripMarkdown('***both***'), 'both');
  assert.equal(stripMarkdown('<u>under</u>'), 'under');
  assert.equal(stripMarkdown('[text](url)'), 'text');
  assert.equal(stripMarkdown('- item'), 'item');
  assert.equal(stripMarkdown('• item'), 'item');
  assert.equal(stripMarkdown('# Heading'), 'Heading');
  assert.equal(stripMarkdown('`code`'), 'code');
});

test('stripMarkdown: leaves plain text untouched', () => {
  assert.equal(stripMarkdown('just plain text'), 'just plain text');
});

// ---------------------------------------------------------------------------
// highlight / highlightColor (cited-passage highlight, visual only)
// ---------------------------------------------------------------------------

const HL = '#123456';
const hasBg = (r) => r.styles.some((st) => st && st.backgroundColor === HL);

function hlRuns(text, highlight, highlightColor = HL) {
  return flatten(MarkdownText({ text, highlight, highlightColor }), []);
}

test('AC11: null/undefined highlight renders identically to no highlight', () => {
  const src = 'aa **bold** cc\n• x *i*';
  const base = JSON.stringify(MarkdownText({ text: src }));
  assert.equal(JSON.stringify(MarkdownText({ text: src, highlight: null, highlightColor: HL })), base);
  assert.equal(JSON.stringify(MarkdownText({ text: src, highlight: undefined })), base);
});

test('AC12: highlight spanning a bold boundary tints exactly text.slice(start, end)', () => {
  const text = 'aa **bold** cc';
  const rs = hlRuns(text, { start: 5, end: 12 });
  assert.equal(rs.map((r) => r.text).join(''), text);
  assert.equal(rs.filter((r) => !isHiddenStyle(r.styles)).map((r) => r.text).join(''), 'aa bold cc');
  assert.equal(rs.filter(hasBg).map((r) => r.text).join(''), text.slice(5, 12));
  assert.equal(rs.filter((r) => hasBg(r) && !isHiddenStyle(r.styles)).map((r) => r.text).join(''), 'bold ');
});

test('AC12: highlight inside plain text splits the run and round-trips', () => {
  const text = 'hello world today';
  const rs = hlRuns(text, { start: 6, end: 11 });
  assert.equal(rs.map((r) => r.text).join(''), text);
  assert.equal(rs.filter(hasBg).map((r) => r.text).join(''), 'world');
});

test('AC13: highlight across newline and bullet prefix', () => {
  const text = '• a\n• b';
  const rs = hlRuns(text, { start: 2, end: 7 });
  assert.equal(rs.map((r) => r.text).join(''), text);
  assert.equal(rs.filter(hasBg).map((r) => r.text).join(''), text.slice(2, 7));
});

test('AC13: highlight over underline markers', () => {
  const text = 'x <u>under</u> y';
  const rs = hlRuns(text, { start: 2, end: 14 });
  assert.equal(rs.map((r) => r.text).join(''), text);
  assert.equal(rs.filter(hasBg).map((r) => r.text).join(''), text.slice(2, 14));
});

test('AC14: invalid ranges and missing color never throw and add no background', () => {
  const text = 'aa **bold** cc';
  for (const range of [{ start: 5, end: 5 }, { start: 9, end: 3 }, { start: -1, end: 2 }, { start: NaN, end: 4 }]) {
    let rs;
    assert.doesNotThrow(() => { rs = hlRuns(text, range); });
    assert.equal(rs.filter(hasBg).length, 0);
    assert.equal(rs.map((r) => r.text).join(''), text);
  }
  const noColor = flatten(MarkdownText({ text, highlight: { start: 0, end: 4 } }), []);
  assert.equal(noColor.filter(hasBg).length, 0);
  assert.equal(
    JSON.stringify(MarkdownText({ text, highlight: { start: 0, end: 4 } })),
    JSON.stringify(MarkdownText({ text }))
  );
});

test('AC14: end past the text is clamped, highlighting everything', () => {
  const text = 'aa **bold** cc';
  const rs = hlRuns(text, { start: 0, end: 999 });
  assert.equal(rs.filter(hasBg).map((r) => r.text).join(''), text);
});

test('MarkdownText imports stay minimal (react, react-native, ../theme)', () => {
  const imports = [...markdownTextSrc.matchAll(/from '([^']+)'/g)].map((m) => m[1]).sort();
  assert.deepEqual(imports, ['../theme', 'react', 'react-native']);
});
