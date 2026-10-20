// Theme palette tests: highlightBg token (AC22) and theme purity.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const THEME_FILE = path.resolve(__dirname, '../src/theme/index.ts');
const themeSrc = fs.readFileSync(THEME_FILE, 'utf8');
const js = ts.transpileModule(themeSrc, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
}).outputText;
const mod = { exports: {} };
new Function('exports', 'require', 'module', js)(mod.exports, require, mod);
const { lightColors, darkColors } = mod.exports;

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

for (const [name, palette] of [['light', lightColors], ['dark', darkColors]]) {
  test(`AC22: ${name} highlightBg exists and keeps textPrimary at >= 4.5:1`, () => {
    assert.match(palette.highlightBg, /^#[0-9A-Fa-f]{6}$/);
    assert.ok(contrast(palette.highlightBg, palette.textPrimary) >= 4.5);
    assert.notEqual(palette.highlightBg, palette.bgPrimary);
    assert.notEqual(palette.highlightBg, palette.citationBg);
  });
}

test('AC22: theme module stays pure constants (no imports)', () => {
  assert.doesNotMatch(themeSrc, /^\s*import\s/m);
  assert.doesNotMatch(themeSrc, /\brequire\(/);
});
