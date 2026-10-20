// Tests for src/lib/passageScroll.ts (pure module, zero imports).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const FILE = path.resolve(__dirname, '../src/lib/passageScroll.ts');
const js = ts.transpileModule(fs.readFileSync(FILE, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
}).outputText;
const mod = { exports: {} };
new Function('exports', 'require', 'module', js)(mod.exports, require, mod);
const { passageScroll } = mod.exports;

const base = { lineHeight: 26, ratio: 0.25, viewportHeight: 800 };

test('native: outer scroll puts the passage line at the target ratio', () => {
  // Passage line top is 1000 - 26 = 974 inside the body; body starts at y=200.
  const r = passageScroll({ ...base, prefixHeight: 1000, bodyY: 200 });
  assert.equal(r.innerTop, 0);
  assert.equal(r.outerY, 200 + 974 - 200);
});

test('never scrolls above the top', () => {
  const r = passageScroll({ ...base, prefixHeight: 26, bodyY: 0 });
  assert.equal(r.outerY, 0);
  assert.equal(r.innerTop, 0);
});

test('a banner pushing the body down moves the outer scroll with it', () => {
  const a = passageScroll({ ...base, prefixHeight: 1000, bodyY: 200 });
  const b = passageScroll({ ...base, prefixHeight: 1000, bodyY: 250 });
  assert.equal(b.outerY - a.outerY, 50);
});

test('web: an internally scrolling textarea takes the in-body offset', () => {
  // Textarea is 400 tall: scroll it so the line sits 100px down inside it.
  const r = passageScroll({ ...base, prefixHeight: 1000, bodyY: 200, innerViewportHeight: 400 });
  assert.equal(r.innerTop, 974 - 100);
  // Remaining visible offset is 100, so the outer scroll only compensates that.
  assert.equal(r.outerY, 200 + 100 - 200);
});

test('web: a passage near the top of the textarea does not scroll it', () => {
  const r = passageScroll({ ...base, prefixHeight: 60, bodyY: 300, innerViewportHeight: 400 });
  assert.equal(r.innerTop, 0);
  assert.equal(r.outerY, 300 + 34 - 200);
});

test('non-finite inputs fall back to the top', () => {
  const r = passageScroll({ ...base, prefixHeight: 1000, bodyY: NaN });
  assert.equal(r.outerY, 0);
  assert.equal(r.innerTop, 0);
});
