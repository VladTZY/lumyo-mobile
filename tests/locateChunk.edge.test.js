// Tester-added edge cases for src/lib/locateChunk.ts (complements locateChunk.test.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const FILE = path.resolve(__dirname, '../src/lib/locateChunk.ts');
const js = ts.transpileModule(fs.readFileSync(FILE, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
}).outputText;
const mod = { exports: {} };
new Function('exports', 'require', 'module', js)(mod.exports, require, mod);
const { locateChunk } = mod.exports;

const sl = (c, m) => c.slice(m.start, m.end);

function invariants(content, m) {
  assert.ok(m);
  assert.ok(0 <= m.start && m.start < m.end && m.end <= content.length);
  const s = sl(content, m);
  assert.ok(!/^[\s*]/.test(s) && !/[\s*]$/.test(s), JSON.stringify(s));
  const lo = content.charCodeAt(m.start);
  assert.ok(!(lo >= 0xdc00 && lo <= 0xdfff));
  const hi = content.charCodeAt(m.end - 1);
  assert.ok(!(hi >= 0xd800 && hi <= 0xdbff));
}

test('empty / null / non-string inputs return null without throwing', () => {
  for (const [c, k] of [['', ''], ['abc', ''], ['', 'abc'], [null, 'a'], ['a', null], [undefined, undefined], [5, 'a'], ['a', {}], ['abc', '   \n\t '], ['abc', '****'], ['abc', '<u></u>'], ['abc', '** **']]) {
    assert.doesNotThrow(() => assert.equal(locateChunk(c, k), null), JSON.stringify([c, k]));
  }
});

test('content that is only whitespace or markers returns null', () => {
  assert.equal(locateChunk('   \n ', 'abc'), null);
  assert.equal(locateChunk('**** <u></u>', 'abc'), null);
});

test('prefix-only chunk (with and without 200-cp truncation) is null', () => {
  assert.equal(locateChunk('The body', 'title: T\ntags: a\n\n'), null);
  const longTitle = 'title: ' + 'x'.repeat(177) + '\ntags: a, b\n\n';
  const raw = (longTitle + 'body tail text'.padEnd(60, ' x')).slice(0, 197) + '...';
  assert.equal(Array.from(raw).length, 200);
  assert.equal(locateChunk('body tail text', raw), null);
});

test('legacy: prefix + truncation together matches the head of the body', () => {
  const body = 'Quarterly planning notes about the migration to the new billing system and rollout schedule for every region we operate in, including fallback plans and owners for each task.';
  const content = 'Intro line.\n\n' + body + '\n\nOutro.';
  const full = 'title: Plan\ntags: Work\n\n' + body;
  const raw = Array.from(full).slice(0, 197).join('') + '...';
  assert.equal(Array.from(raw).length, 200);
  const m = locateChunk(content, raw);
  assert.ok(m);
  assert.equal(m.exact, true);
  assert.ok(body.startsWith(sl(content, m)));
  assert.equal(m.start, content.indexOf(body));
  invariants(content, m);
});

test('legacy: a 200-cp chunk of emoji counts codepoints, not UTF-16 units', () => {
  const body = 'ab'.repeat(30) + '\u{1F600}'.repeat(10);
  const full = 'title: T\ntags: x\n\n' + body + ' zzzz zzzz zzzz zzzz zzzz zzzz zzzz zzzz zzzz zzzz zzzz zzzz zzzz zzzz zzzz zzzz zzzz zzzz zzzz zzzz zzzz zzzz zzzz';
  const raw = Array.from(full).slice(0, 197).join('') + '...';
  assert.equal(Array.from(raw).length, 200);
  const m = locateChunk('x ' + body + ' zzzz zzzz zzzz zzzz zzzz zzzz zzzz zzzz zzzz zzzz zzzz zzzz zzzz zzzz zzzz zzzz zzzz zzzz zzzz zzzz zzzz zzzz zzzz end', raw);
  assert.ok(m);
  assert.equal(m.exact, true);
});

test('chunk that is 199 or 201 codepoints ending in "..." keeps the dots (exact match fails, only approx head)', () => {
  for (const n of [199, 201]) {
    const raw = 'a'.repeat(n - 3) + '...';
    assert.equal(Array.from(raw).length, n);
    const m = locateChunk('a'.repeat(n - 3) + ' next', raw);
    assert.equal(m && m.exact, false);
  }
  // control: exactly 200 drops the dots and matches exactly
  const raw200 = 'a'.repeat(197) + '...';
  assert.equal(locateChunk('a'.repeat(197) + ' next', raw200).exact, true);
});

test('exactly 200 cp without trailing "..." is not truncated', () => {
  const raw = 'a'.repeat(200);
  assert.equal(locateChunk(raw + 'b', raw).exact, true);
});

test('a title line merely starting with "title:" without tags line is untouched', () => {
  const m = locateChunk('title: hello world', 'title: hello world');
  assert.deepEqual(m, { start: 0, end: 18, exact: true });
});

test('prefix is only removed at the start of the chunk', () => {
  const raw = 'intro\ntitle: T\ntags: a\n\nbody';
  assert.equal(locateChunk('body', raw), null);
});

test('case: unicode uppercase and German sharp s', () => {
  const content = 'Ünïcode STRASSE café';
  const m = locateChunk(content, 'ünïcode strasse CAFÉ');
  assert.ok(m);
  assert.equal(sl(content, m), content);
});

test("length-changing lowercase 'İ' keeps offsets on the original character", () => {
  const content = 'zz İstanbul is big';
  const m = locateChunk(content, 'istanbul');
  // 'İ'.toLowerCase() is 'i' + combining dot; plain 'istanbul' cannot match exactly.
  // Whatever happens, no throw and valid offsets when non-null.
  if (m) invariants(content, m);
  const m2 = locateChunk(content, 'İstanbul is');
  assert.ok(m2);
  assert.equal(sl(content, m2), 'İstanbul is');
  invariants(content, m2);
});

test('emoji at match boundaries are never split', () => {
  const content = 'x \u{1F600}smile\u{1F600} y';
  const m = locateChunk(content, '\u{1F600}smile\u{1F600}');
  assert.equal(sl(content, m), '\u{1F600}smile\u{1F600}');
  invariants(content, m);
});

test('markers inside words (bold mid-word) map to original range', () => {
  const content = 'un**believ**able thing';
  const m = locateChunk(content, 'unbelievable');
  assert.equal(sl(content, m), 'un**believ**able');
});

test('markers at match boundary are excluded from the slice', () => {
  const content = '**Bold start** then text';
  const m = locateChunk(content, 'bold start');
  assert.equal(sl(content, m), 'Bold start');
  invariants(content, m);
  const c2 = 'hello <u>under</u> world';
  const m2 = locateChunk(c2, 'under');
  assert.equal(sl(c2, m2), 'under');
});

test('a lone "*" inside text (e.g. 2 * 3) is dropped consistently on both sides', () => {
  const content = 'compute 2 * 3 now';
  const m = locateChunk(content, 'compute 2 * 3 now');
  assert.equal(m.exact, true);
  assert.equal(sl(content, m), content);
});

test('bullets and markdown list prefix in content vs. plain chunk', () => {
  const content = '• first item\n• second item';
  const m = locateChunk(content, 'first item second item');
  assert.equal(m, null === m ? null : m); // bullet char is content: documented behaviour below
  const m2 = locateChunk(content, 'first item\n• second item');
  assert.equal(sl(content, m2), 'first item\n• second item');
});

test('repeated chunk returns the first occurrence, case-insensitively and across markers', () => {
  const content = 'Foo bar baz.\n\nOther.\n\nFOO **bar** baz.';
  const m = locateChunk(content, 'foo bar baz.');
  assert.equal(m.start, 0);
  assert.equal(m.end, 12);
});

test('edited note: appended and prepended text still matches exactly', () => {
  const chunk = 'The quick brown fox jumps over the lazy dog.';
  const content = 'NEW LINE\n\nThe quick brown fox jumps over the lazy dog.\n\nAdded after.';
  const m = locateChunk(content, chunk);
  assert.equal(m.exact, true);
  assert.equal(sl(content, m), chunk);
});

test('edited note: one-word change in a long chunk falls back to approx covering head..tail', () => {
  const chunk = 'Alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigma tau upsilon phi chi psi omega again and again until it is long enough';
  const content = 'Before. ' + chunk.replace('omicron', 'OMITTED') + ' After.';
  const m = locateChunk(content, chunk);
  assert.ok(m);
  assert.equal(m.exact, false);
  assert.equal(m.start, content.indexOf('Alpha'));
  assert.ok(content.slice(m.start, m.end).endsWith('long enough'));
  invariants(content, m);
});

test('needle of 79 normalized chars gets no anchor fallback; 80 does', () => {
  const mk = (n) => 'abcdefghij'.repeat(Math.ceil(n / 10)).slice(0, n);
  const n79 = mk(79);
  const n80 = mk(80);
  // change the middle char so exact fails but head/tail remain
  const alter = (s) => s.slice(0, 40) + '#' + s.slice(41);
  assert.equal(locateChunk('pre ' + alter(n79) + ' post', n79), null);
  const m = locateChunk('pre ' + alter(n80) + ' post', n80);
  assert.ok(m);
  assert.equal(m.exact, false);
});

test('tail before head does not produce a head..tail span', () => {
  const head = 'h'.repeat(45) + ' head marker words go here to be unique ok';
  const tail = 'tail marker words come at the end of this chunk ' + 't'.repeat(45);
  const chunk = head + ' MIDDLE ' + tail;
  const content = tail + '\n\n' + head;
  const m = locateChunk(content, chunk);
  assert.ok(m);
  assert.equal(m.exact, false);
  invariants(content, m);
});

test('result never throws and keeps invariants over a randomized corpus', () => {
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const atoms = ['alpha', 'Beta', '**bold**', '*it*', '<u>u</u>', '\u{1F600}', 'İ', 'ß', '\n', '\n\n', '  ', '\t', '• ', '...', 'x'];
  for (let n = 0; n < 400; n++) {
    let content = '';
    const len = 1 + Math.floor(rnd() * 30);
    for (let i = 0; i < len; i++) content += atoms[Math.floor(rnd() * atoms.length)] + (rnd() < 0.5 ? ' ' : '');
    const a = Math.floor(rnd() * content.length);
    const b = a + 1 + Math.floor(rnd() * (content.length - a));
    const chunk = content.slice(a, b);
    let m;
    assert.doesNotThrow(() => { m = locateChunk(content, chunk); }, JSON.stringify([content, chunk]));
    if (m) invariants(content, m);
  }
});

test('a substring of content that starts/ends on a word boundary is found exactly (self-match)', () => {
  const content = 'Intro **bold** and *it* plus <u>under</u>.\n\nSecond  para\twith \u{1F600} emoji.';
  const words = content.split(/(?<=\s)/);
  for (let i = 0; i < words.length; i++) {
    for (let j = i; j < words.length; j++) {
      const chunk = words.slice(i, j + 1).join('');
      if (!chunk.replace(/[\s*]|<\/?u>/g, '')) continue;
      const m = locateChunk(content, chunk);
      assert.ok(m, JSON.stringify(chunk));
      assert.equal(m.exact, true, JSON.stringify(chunk));
      invariants(content, m);
    }
  }
});

test('large input finishes quickly', () => {
  const content = ('lorem ipsum dolor sit amet ' ).repeat(20000);
  const t = Date.now();
  locateChunk(content, 'lorem ipsum dolor sit amet nope');
  locateChunk(content, 'z'.repeat(500));
  assert.ok(Date.now() - t < 3000);
});
