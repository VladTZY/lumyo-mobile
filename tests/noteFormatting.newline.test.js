// Fix-cycle tests for processNewline: ambiguous Enter position (optional
// pre-edit caret hint) and bullet continuation through styled spans.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const src = fs.readFileSync(path.resolve(__dirname, '../src/lib/noteFormatting.ts'), 'utf8');
const js = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
}).outputText;
const mod = { exports: {} };
new Function('exports', 'require', 'module', js)(mod.exports, require, mod);
const { processNewline } = mod.exports;

const s = (n) => ({ start: n, end: n });
const eq = (got, text, sel) => assert.deepEqual(got, { text, sel });

test('hinted caret at end of a middle bullet item continues the list', () => {
  eq(processNewline('• a\n• b', '• a\n\n• b', 3), '• a\n• \n• b', s(6));
});

test('hinted caret at column 0 of the next bullet item moves that item down', () => {
  // Caret before "• b": Enter inserts a blank line above it; no continuation.
  assert.equal(processNewline('• a\n• b', '• a\n\n• b', 4), null);
});

test('hinted caret on a blank line after a bullet item gets no bullet', () => {
  assert.equal(processNewline('• a\n\nNext', '• a\n\n\nNext', 4), null);
});

test('hinted Enter on an empty middle item ends the list', () => {
  eq(processNewline('• a\n• \n• b', '• a\n• \n\n• b', 6), '• a\n\n• b', s(4));
});

test('unhinted blank line after a bullet item falls back to run start and continues', () => {
  eq(processNewline('• a\n\nNext', '• a\n\n\nNext'), '• a\n• \n\nNext', s(6));
});

test('unhinted ambiguity after a non-bullet line is left alone', () => {
  assert.equal(processNewline('a\nb', 'a\n\nb'), null);
});

test('an out-of-range hint is ignored in favour of the fallback', () => {
  eq(processNewline('• a\n• b', '• a\n\n• b', 99), '• a\n• \n• b', s(6));
});

test('Enter at the end of a bold span on a bullet line keeps the bullet', () => {
  eq(processNewline('• **ab**', '• **ab\n**'), '• **ab**\n• ', s(11));
});

test('Enter mid-span on a bullet line closes, reopens and keeps the bullet', () => {
  eq(processNewline('• **ab**', '• **a\nb**'), '• **a**\n• **b**', s(12));
});

test('dash bullet and underline spans get the same treatment', () => {
  eq(processNewline('- <u>ab</u>', '- <u>a\nb</u>'), '- <u>a</u>\n- <u>b</u>', s(16));
  eq(processNewline('• <u>ab</u>', '• <u>ab\n</u>'), '• <u>ab</u>\n• ', s(14));
});
