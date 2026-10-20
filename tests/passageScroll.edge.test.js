// Edge cases for src/lib/passageScroll.ts (pure module, zero imports).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const FILE = path.resolve(__dirname, '../src/lib/passageScroll.ts');
const src = fs.readFileSync(FILE, 'utf8');
const js = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
}).outputText;
const mod = { exports: {} };
new Function('exports', 'require', 'module', js)(mod.exports, require, mod);
const { passageScroll } = mod.exports;

const base = { lineHeight: 26, ratio: 0.25, viewportHeight: 800, bodyY: 500 };

test('module has no imports', () => {
  assert.ok(!/^\s*import\s/m.test(src));
});

test('zero prefix height: passage at body top, outer scroll leaves 25% above it', () => {
  // lineTop 0, so outerY = 500 - 200
  assert.deepEqual(passageScroll({ ...base, prefixHeight: 0 }), { outerY: 300, innerTop: 0 });
});

test('negative prefix height behaves like zero', () => {
  assert.deepEqual(passageScroll({ ...base, prefixHeight: -50 }), { outerY: 300, innerTop: 0 });
});

test('prefix shorter than one line behaves like zero', () => {
  assert.deepEqual(passageScroll({ ...base, prefixHeight: 10 }), { outerY: 300, innerTop: 0 });
});

test('zero viewport height: no viewport offset is subtracted', () => {
  // lineTop = 126 - 26 = 100; outerY = 10 + 100
  assert.deepEqual(
    passageScroll({ ...base, prefixHeight: 126, bodyY: 10, viewportHeight: 0 }),
    { outerY: 110, innerTop: 0 },
  );
});

test('negative viewport height does not throw and stays finite and non-negative', () => {
  const r = passageScroll({ ...base, prefixHeight: 126, bodyY: 0, viewportHeight: -400 });
  assert.ok(Number.isFinite(r.outerY) && r.outerY >= 0);
});

test('negative bodyY with a deep passage still subtracts correctly', () => {
  // lineTop 974; -100 + 974 - 200
  assert.equal(passageScroll({ ...base, prefixHeight: 1000, bodyY: -100 }).outerY, 674);
});

test('negative bodyY with a shallow passage clamps to 0', () => {
  assert.equal(passageScroll({ ...base, prefixHeight: 26, bodyY: -100 }).outerY, 0);
});

test('offset far beyond any content stays finite (ScrollView clamps the bottom)', () => {
  const r = passageScroll({ ...base, prefixHeight: 1e9 });
  assert.equal(r.outerY, 500 + (1e9 - 26) - 200);
  assert.equal(r.innerTop, 0);
});

test('ratio 0 puts the passage at the very top, ratio 1 one viewport above it', () => {
  assert.equal(passageScroll({ ...base, prefixHeight: 1000, ratio: 0 }).outerY, 500 + 974);
  assert.equal(passageScroll({ ...base, prefixHeight: 1000, ratio: 1 }).outerY, 500 + 974 - 800);
});

test('lineHeight 0 uses the whole prefix height', () => {
  assert.equal(passageScroll({ ...base, prefixHeight: 1000, lineHeight: 0 }).outerY, 500 + 1000 - 200);
});

test('textarea: zero inner viewport pushes the whole offset into the textarea', () => {
  // innerTop = lineTop (974); outer = 500 + 0 - 200
  assert.deepEqual(
    passageScroll({ ...base, prefixHeight: 1000, innerViewportHeight: 0 }),
    { outerY: 300, innerTop: 974 },
  );
});

test('textarea: deep passage splits into inner scrollTop and a small outer remainder', () => {
  // lineTop 974, innerTop 974 - 100 = 874, remainder 100; outer = 500 + 100 - 200
  assert.deepEqual(
    passageScroll({ ...base, prefixHeight: 1000, innerViewportHeight: 400 }),
    { outerY: 400, innerTop: 874 },
  );
});

test('textarea: passage inside the top quarter of the textarea leaves innerTop at 0', () => {
  // lineTop 50 < 100, so innerTop 0; outer = 500 + 50 - 200
  assert.deepEqual(
    passageScroll({ ...base, prefixHeight: 76, innerViewportHeight: 400 }),
    { outerY: 350, innerTop: 0 },
  );
});

test('textarea: outer plus inner always equals the native single-scroll target (when unclamped)', () => {
  const native = passageScroll({ ...base, prefixHeight: 1000 }).outerY; // 1274
  const web = passageScroll({ ...base, prefixHeight: 1000, innerViewportHeight: 400 });
  assert.equal(web.outerY + web.innerTop, native);
});

test('textarea: non-finite inner viewport falls back to the top', () => {
  assert.deepEqual(
    passageScroll({ ...base, prefixHeight: 1000, innerViewportHeight: NaN }),
    { outerY: 0, innerTop: 0 },
  );
});

test('non-finite prefix, viewport or ratio fall back to the top', () => {
  for (const patch of [{ prefixHeight: Infinity }, { prefixHeight: NaN }, { viewportHeight: NaN }, { ratio: NaN }]) {
    assert.deepEqual(passageScroll({ ...base, prefixHeight: 1000, ...patch }), { outerY: 0, innerTop: 0 }, JSON.stringify(patch));
  }
});

test('never returns a negative outerY or innerTop across a grid', () => {
  for (const prefixHeight of [-10, 0, 26, 100, 5000])
    for (const bodyY of [-50, 0, 40, 900])
      for (const viewportHeight of [0, 300, 1200])
        for (const innerViewportHeight of [undefined, 0, 400]) {
          const r = passageScroll({ lineHeight: 26, ratio: 0.25, prefixHeight, bodyY, viewportHeight, innerViewportHeight });
          assert.ok(r.outerY >= 0 && r.innerTop >= 0 && Number.isFinite(r.outerY) && Number.isFinite(r.innerTop));
        }
});
