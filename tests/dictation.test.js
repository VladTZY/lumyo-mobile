// Tests for src/lib/dictation.ts (pure module, zero imports).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const FILE = path.resolve(__dirname, '../src/lib/dictation.ts');
const src = fs.readFileSync(FILE, 'utf8');
const js = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
}).outputText;
const mod = { exports: {} };
new Function('exports', 'require', 'module', js)(mod.exports, require, mod);
const { insertTranscript, formatElapsed, meterLevel, uploadFile, MAX_RECORDING_MS } = mod.exports;

const at = (n) => ({ start: n, end: n });

test('module has no imports, so tests and the app load the same code', () => {
  assert.ok(!/^\s*import\s/m.test(src));
});

// --- insertTranscript -----------------------------------------------------

test('fills an empty note and puts the caret after the text', () => {
  assert.deepEqual(insertTranscript('', at(0), 'Book the lab'), { text: 'Book the lab', sel: at(12) });
});

test('adds a space after a word before the caret', () => {
  const r = insertTranscript('Remember', at(8), 'to email Priya');
  assert.equal(r.text, 'Remember to email Priya');
  assert.deepEqual(r.sel, at(23));
});

test('adds no extra space when the text before already ends in whitespace', () => {
  assert.equal(insertTranscript('Notes: ', at(7), 'buy milk').text, 'Notes: buy milk');
  assert.equal(insertTranscript('Line one\n', at(9), 'Line two').text, 'Line one\nLine two');
});

test('adds a space before following text so words do not run together', () => {
  const r = insertTranscript('Hello world', at(6), 'big');
  assert.equal(r.text, 'Hello big world');
  assert.deepEqual(r.sel, at(9));
});

test('does not add a space before punctuation that follows', () => {
  assert.equal(insertTranscript('Call Dan.', at(8), 'tomorrow').text, 'Call Dan tomorrow.');
});

test('writes right after a bullet prefix without doubling the space', () => {
  const r = insertTranscript('• ', at(2), 'first item');
  assert.equal(r.text, '• first item');
  assert.deepEqual(r.sel, at(12));
});

test('replaces a selection', () => {
  const r = insertTranscript('Meet on Monday', { start: 8, end: 14 }, 'Thursday');
  assert.equal(r.text, 'Meet on Thursday');
  assert.deepEqual(r.sel, at(16));
});

test('handles a reversed or out-of-range selection by clamping', () => {
  assert.equal(insertTranscript('abc', { start: 10, end: 2 }, 'x').text, 'ab x');
  assert.equal(insertTranscript('abc', { start: -5, end: -1 }, 'x').text, 'x abc');
});

test('trims the transcript and ignores a blank one', () => {
  assert.equal(insertTranscript('a', at(1), '  b \n').text, 'a b');
  assert.deepEqual(insertTranscript('keep', at(2), '   '), { text: 'keep', sel: at(2) });
});

test('keeps surrogate pairs intact when the caret sits after an emoji', () => {
  const content = 'Plan 🎉';
  const r = insertTranscript(content, at(content.length), 'party');
  assert.equal(r.text, 'Plan 🎉 party');
});

// --- formatElapsed --------------------------------------------------------

test('formats elapsed time as m:ss', () => {
  assert.equal(formatElapsed(0), '0:00');
  assert.equal(formatElapsed(7_400), '0:07');
  assert.equal(formatElapsed(65_000), '1:05');
  assert.equal(formatElapsed(600_000), '10:00');
});

test('treats negative or invalid durations as zero', () => {
  assert.equal(formatElapsed(-50), '0:00');
  assert.equal(formatElapsed(NaN), '0:00');
});

// --- meterLevel -----------------------------------------------------------

test('maps metering dBFS to a 0..1 level', () => {
  assert.equal(meterLevel(0), 1);
  assert.equal(meterLevel(-60), 0);
  assert.equal(meterLevel(-160), 0);
  assert.equal(meterLevel(-30), 0.5);
});

test('returns 0 when metering is missing', () => {
  assert.equal(meterLevel(undefined), 0);
  assert.equal(meterLevel(NaN), 0);
});

// --- uploadFile -----------------------------------------------------------

test('native recordings upload as m4a', () => {
  assert.deepEqual(uploadFile('file:///tmp/rec-1.m4a', 'ios'), {
    uri: 'file:///tmp/rec-1.m4a', name: 'recording.m4a', type: 'audio/mp4',
  });
  assert.deepEqual(uploadFile('file:///data/rec.m4a', 'android').type, 'audio/mp4');
});

test('web recordings use the browser recorder mime type', () => {
  assert.deepEqual(uploadFile('blob:http://x/1', 'web', 'audio/webm;codecs=opus'), {
    uri: 'blob:http://x/1', name: 'recording.webm', type: 'audio/webm',
  });
  assert.equal(uploadFile('blob:x', 'web', 'audio/mp4').name, 'recording.m4a');
});

test('web falls back to webm when the browser gives no mime type', () => {
  assert.equal(uploadFile('blob:x', 'web').type, 'audio/webm');
});

test('a native file with another extension keeps it', () => {
  assert.deepEqual(uploadFile('file:///tmp/a.wav', 'android'), {
    uri: 'file:///tmp/a.wav', name: 'recording.wav', type: 'audio/wav',
  });
});

test('caps recordings well under the server size limit', () => {
  assert.equal(MAX_RECORDING_MS, 10 * 60 * 1000);
});

// --- dictationTarget ------------------------------------------------------

const { dictationTarget } = mod.exports;

test('dictates at the caret once the user has placed one', () => {
  assert.deepEqual(dictationTarget({ start: 3, end: 5 }, true, 20), { start: 3, end: 5 });
});

test('appends at the end when the caret was never placed', () => {
  assert.deepEqual(dictationTarget({ start: 0, end: 0 }, false, 13), { start: 13, end: 13 });
});

test('collapses runs of spaces the model leaves inside a transcript', () => {
  assert.equal(insertTranscript('', at(0), 'for Thursday  at   3.').text, 'for Thursday at 3.');
});
