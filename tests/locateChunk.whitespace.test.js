// locateChunk: whitespace adjacent to skipped markers must collapse to one space (fix cycle 1).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const js = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../src/lib/locateChunk.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
}).outputText;
const mod = { exports: {} };
new Function('exports', 'require', 'module', js)(mod.exports, require, mod);
const { locateChunk } = mod.exports;

function expectExact(content, chunk, expectedSlice) {
  const m = locateChunk(content, chunk);
  assert.ok(m, `no match for ${JSON.stringify(chunk)} in ${JSON.stringify(content)}`);
  assert.equal(m.exact, true);
  assert.equal(content.slice(m.start, m.end), expectedSlice);
}

test("marker between spaces in the chunk: 'a ** b c' matches content 'a **b** c'", () => {
  expectExact('a **b** c', 'a ** b c', 'a **b** c');
});

test("marker between spaces in the content: 'a ** b c' matches chunk 'a b c'", () => {
  expectExact('a ** b c', 'a b c', 'a ** b c');
});

test('bullet marker on the content side only', () => {
  expectExact('line\n* item two', 'line item two', 'line\n* item two');
});

test('bullet marker on the chunk side only', () => {
  expectExact('line item two', 'line\n* item two', 'line item two');
});

test('<u> tags next to whitespace collapse the same way', () => {
  expectExact('x <u> y</u> z', 'x y z', 'x <u> y</u> z');
});

test('several markers and mixed whitespace in a row collapse to a single space', () => {
  expectExact('a \t** \n*** b', 'a b', 'a \t** \n*** b');
});

test('marker followed by space at the end of the chunk does not leave a trailing space', () => {
  expectExact('foo bar baz', 'foo bar **  ', 'foo bar');
});

test('marker preceded by space at the start of the chunk does not leave a leading space', () => {
  expectExact('foo bar baz', '  ** bar baz', 'bar baz');
});

test('slice never begins or ends on whitespace or marker characters', () => {
  const content = 'intro ** middle ** text ** outro';
  const m = locateChunk(content, 'middle text');
  assert.ok(m);
  const s = content.slice(m.start, m.end);
  assert.ok(!/^[\s*]/.test(s) && !/[\s*]$/.test(s), JSON.stringify(s));
  assert.equal(s, 'middle ** text');
});

test('plain double spaces still collapse (regression)', () => {
  expectExact('One.  Two   three.', 'One. Two three.', 'One.  Two   three.');
});
