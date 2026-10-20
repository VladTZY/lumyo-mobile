// Tests for src/lib/locateChunk.ts (pure module, zero imports).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const FILE = path.resolve(__dirname, '../src/lib/locateChunk.ts');
const src = fs.readFileSync(FILE, 'utf8');
const js = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
}).outputText;
const mod = { exports: {} };
new Function('exports', 'require', 'module', js)(mod.exports, require, mod);
const { locateChunk } = mod.exports;

function slice(content, m) {
  return content.slice(m.start, m.end);
}

// Invariants of AC10 for every non-null result.
function checkInvariants(content, m) {
  assert.ok(m, 'expected a match');
  assert.ok(0 <= m.start && m.start < m.end && m.end <= content.length);
  const s = slice(content, m);
  assert.ok(!/^[\s*]/.test(s) && !/[\s*]$/.test(s), `slice must start/end on content chars: ${JSON.stringify(s)}`);
  assert.ok(!s.startsWith('<u>') && !s.endsWith('</u>'));
  const lo = content.charCodeAt(m.start);
  assert.ok(!(lo >= 0xdc00 && lo <= 0xdfff), 'start splits a surrogate pair');
  const last = content.charCodeAt(m.end - 1);
  assert.ok(!(last >= 0xd800 && last <= 0xdbff), 'end splits a surrogate pair');
}

test('AC1: exact plain substring', () => {
  assert.deepEqual(locateChunk('alpha beta gamma', 'beta'), { start: 6, end: 10, exact: true });
});

test('AC2: whitespace runs collapse', () => {
  const content = 'One.\n\nTwo  three.\nFour.';
  const m = locateChunk(content, 'Two three. Four.');
  assert.equal(m.exact, true);
  assert.equal(slice(content, m), 'Two  three.\nFour.');
});

test('AC2: CRLF, tabs and NBSP collapse', () => {
  const content = 'a\r\nb\tc d';
  const m = locateChunk(content, 'b c d');
  assert.equal(slice(content, m), 'b\tc d');
});

test('AC4: case-insensitive', () => {
  const m = locateChunk('Hello World', 'hello world');
  assert.equal(m.exact, true);
  assert.deepEqual([m.start, m.end], [0, 11]);
});

test('AC3: markers stripped on the content side', () => {
  const content = 'Use **bold** words here';
  const m = locateChunk(content, 'Use bold words');
  assert.equal(m.exact, true);
  assert.equal(slice(content, m), 'Use **bold** words');
});

test('AC3: markers stripped on the chunk side', () => {
  const content = 'Use bold words';
  const m = locateChunk(content, 'Use **bold** words');
  assert.equal(slice(content, m), 'Use bold words');
});

test('AC3: <u>, * and *** markers', () => {
  const c1 = 'x <u>under</u> line y';
  assert.equal(slice(c1, locateChunk(c1, 'x under line')), 'x <u>under</u> line');
  const c2 = 'go *it* and ***both*** now';
  assert.equal(slice(c2, locateChunk(c2, 'it and both now')), 'it* and ***both*** now');
});

test('AC5: legacy prefix is stripped', () => {
  const content = 'Intro. The body text continues.';
  const m = locateChunk(content, 'title: My note\ntags: Work, Ideas\n\nThe body text');
  assert.equal(slice(content, m), 'The body text');
});

test('AC5: multi-line title prefix', () => {
  const content = 'zzz The body yyy';
  const m = locateChunk(content, 'title: A\nB\ntags: \n\nThe body');
  assert.equal(slice(content, m), 'The body');
});

test('AC6: 200-codepoint chunk ending in ... drops the omission', () => {
  const body = 'word '.repeat(60).trim();
  const raw = body.slice(0, 197) + '...';
  assert.equal(Array.from(raw).length, 200);
  const content = body + ' and more after';
  const m = locateChunk(content, raw);
  assert.equal(m.exact, true);
  assert.equal(slice(content, m), body.slice(0, 197).trimEnd());
});

test('AC6: a shorter chunk ending in ... keeps it', () => {
  assert.equal(locateChunk('wait for it', 'wait for it...'), null);
  const content = 'wait for it... done';
  assert.equal(slice(content, locateChunk(content, 'wait for it...')), 'wait for it...');
});

test('AC7: first of several occurrences wins', () => {
  assert.deepEqual(locateChunk('foo bar foo bar', 'foo'), { start: 0, end: 3, exact: true });
});

test('AC8: null cases', () => {
  assert.equal(locateChunk('some content', 'totally different'), null);
  assert.equal(locateChunk('', 'x'), null);
  assert.equal(locateChunk('content', ''), null);
  assert.equal(locateChunk('content', '   \n '), null);
  assert.equal(locateChunk('content', '****'), null);
  assert.equal(locateChunk('content', '<u></u>'), null);
  assert.equal(locateChunk('content', 'title: T\ntags: a\n\n'), null);
  assert.equal(locateChunk(undefined, undefined), null);
});

const HEAD = 'The quick brown fox jumps over the lazy dog near the river bank';
const TAIL = 'and finally the story ends with a calm and quiet sunset view';
const MID_A = 'alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo';
const MID_B = 'one two three four five six seven eight nine ten eleven twelve ab';

test('AC9: approximate head+tail when the middle changed', () => {
  const chunk = `${HEAD} ${MID_A} ${TAIL}`;
  const content = `Intro. ${HEAD} ${MID_B} ${TAIL} Outro.`;
  const m = locateChunk(content, chunk);
  assert.equal(m.exact, false);
  assert.equal(m.start, content.indexOf(HEAD));
  assert.equal(m.end, content.indexOf(TAIL) + TAIL.length);
  checkInvariants(content, m);
});

test('AC9: head only', () => {
  const chunk = `${HEAD} ${MID_A} ${TAIL}`;
  const content = `Intro. ${HEAD} then something else entirely.`;
  const m = locateChunk(content, chunk);
  assert.equal(m.exact, false);
  assert.equal(m.start, 7);
  assert.equal(slice(content, m), HEAD.slice(0, 40).trimEnd());
});

test('AC9: tail only', () => {
  const chunk = `${HEAD} ${MID_A} ${TAIL}`;
  const content = `Unrelated start. ${TAIL}`;
  const m = locateChunk(content, chunk);
  assert.equal(m.exact, false);
  assert.equal(slice(content, m), TAIL.slice(-40));
});

test('AC9: span over 2x chunk length falls through to head only', () => {
  const chunk = `${HEAD} ${MID_A} ${TAIL}`;
  const filler = 'lorem ipsum dolor sit amet '.repeat(40);
  const content = `${HEAD} ${filler} ${TAIL}`;
  const m = locateChunk(content, chunk);
  assert.equal(m.exact, false);
  assert.equal(slice(content, m), HEAD.slice(0, 40).trimEnd());
});

test('AC10: emoji and length-changing lowercase keep valid offsets', () => {
  const c1 = 'start \u{1F600} smile \u{1F600} end tail';
  const m1 = locateChunk(c1, '\u{1F600} smile \u{1F600}');
  assert.equal(slice(c1, m1), '\u{1F600} smile \u{1F600}');
  checkInvariants(c1, m1);

  const c2 = 'a İstanbul b';
  const m2 = locateChunk(c2, 'İstanbul');
  assert.equal(slice(c2, m2), 'İstanbul');
  checkInvariants(c2, m2);

  const c3 = 'x **bold \u{1F600}** y';
  const m3 = locateChunk(c3, 'bold \u{1F600}');
  checkInvariants(c3, m3);
});

test('AC10: invariants hold for earlier cases', () => {
  for (const [c, k] of [
    ['alpha beta gamma', 'beta'],
    ['One.\n\nTwo  three.\nFour.', 'Two three. Four.'],
    ['Use **bold** words here', 'Use bold words'],
    ['x <u>under</u> line y', 'x under line'],
  ]) {
    checkInvariants(c, locateChunk(c, k));
  }
});

test('whitespace on both sides of a skipped marker collapses to one space', () => {
  // Chunk saved with spaces around a stray marker; the note later lost it.
  const content = 'a **b** c';
  const m = locateChunk(content, 'a ** b c');
  assert.ok(m);
  assert.equal(m.exact, true);
  assert.equal(slice(content, m), 'a **b** c');
});

test('bullet marker present on only one side still matches exactly', () => {
  const withBullet = 'intro\n* item one\n* item two';
  const m1 = locateChunk(withBullet, 'intro item one item two');
  assert.ok(m1);
  assert.equal(m1.exact, true);
  const m2 = locateChunk('intro\nitem one\nitem two', 'intro\n* item one\n* item two');
  assert.ok(m2);
  assert.equal(m2.exact, true);
});
