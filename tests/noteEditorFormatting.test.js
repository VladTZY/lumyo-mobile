// Source-level guards for the note editor's formatting UI.
//
// The repo has no React renderer, so these read the source files whole (no
// line numbers) and assert the structural contracts: the screen uses the pure
// module in src/lib/noteFormatting.ts, the keyboard bar wiring is present, the
// footer padding is constant, and every icon and colour follows the theme
// rules. Behavioural cases for the helpers live in noteFormatting.test.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const screen = read('src/screens/NoteEditorScreen.tsx');
const controls = read('src/components/FormatControls.tsx');
const tabBar = read('src/navigation/TabBar.tsx');

// Every <Icon ...> element from lucide must carry strokeWidth={1.75}.
function lucideIconElements(src) {
  const imp = src.match(/import\s*\{([^}]*)\}\s*from\s*'lucide-react-native'/);
  assert.ok(imp, 'expected a lucide-react-native import');
  const names = imp[1].split(',').map((n) => n.trim()).filter(Boolean);
  const elements = [];
  for (const name of names) {
    const re = new RegExp(`<${name}\\b[^>]*?/>`, 'gs');
    elements.push(...(src.match(re) || []));
  }
  return elements;
}

test('screen uses the pure formatting module instead of local helpers', () => {
  assert.ok(screen.includes("from '../lib/noteFormatting'"));
  for (const gone of [
    'function toggleInline', 'function isWrappedWith', 'function processNewline',
    'function wordCount', 'INLINE_SPAN',
  ]) {
    assert.ok(!screen.includes(gone), `NoteEditorScreen.tsx must not define ${gone}`);
  }
  assert.ok(!screen.includes("'**'") && !screen.includes("'<u>'"), 'no formatting marker literals in the screen');
});

test('footer uses constant paddingBottom: 10 with no inset dependence', () => {
  assert.ok(
    /footer:\s*\{[^}]*paddingBottom:\s*10/s.test(screen),
    'Expected styles.footer in NoteEditorScreen.tsx to set paddingBottom: 10'
  );
  assert.ok(!screen.includes('Math.max(insets.bottom'), 'Footer padding must not depend on safe-area insets');
});

test('body TextInput disables its own scrolling so the outer ScrollView can scroll while the keyboard is up', () => {
  assert.ok(screen.includes('scrollEnabled={false}'));
});

test('save dismisses the keyboard', () => {
  const saveBody = screen.slice(screen.indexOf('const save = useCallback'), screen.indexOf('const handleBack'));
  assert.ok(saveBody.includes('Keyboard.dismiss()'), 'Expected save() to call Keyboard.dismiss()');
});

test('keyboard bar is wired through a per-instance InputAccessoryView on iOS', () => {
  for (const needle of [
    'InputAccessoryView', 'inputAccessoryViewID=', 'nativeID={accessoryId}', 'useId(', 'USE_IOS_ACCESSORY',
  ]) {
    assert.ok(screen.includes(needle), `Expected NoteEditorScreen.tsx to contain ${needle}`);
  }
});

test('Done dismisses the keyboard', () => {
  const start = screen.indexOf('const handleDone');
  assert.ok(start > -1, 'Expected a handleDone callback');
  const body = screen.slice(start, screen.indexOf('\n', screen.indexOf('}, [', start)));
  assert.ok(body.includes('Keyboard.dismiss()'));
});

test('FormatControls carries the accessibility labels and states', () => {
  for (const label of ['Text formatting', 'Bold', 'Italic', 'Underline', 'Bulleted list']) {
    assert.ok(controls.includes(label), `Expected FormatControls.tsx to contain "${label}"`);
  }
  assert.ok(/accessibilityState=\{\{[^}]*selected/.test(controls));
  assert.ok(/accessibilityState=\{\{[^}]*expanded/.test(controls));
});

test('every Lucide icon uses strokeWidth 1.75 and no hex colours are hard-coded', () => {
  for (const [name, src] of [['NoteEditorScreen.tsx', screen], ['FormatControls.tsx', controls]]) {
    const icons = lucideIconElements(src);
    assert.ok(icons.length > 0, `expected icons in ${name}`);
    for (const el of icons) {
      assert.ok(el.includes('strokeWidth={1.75}'), `${name}: icon without strokeWidth={1.75}: ${el}`);
    }
    assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(src), `${name} must not contain hex colour literals`);
  }
});

test('TabBar hides while the keyboard is up, on Android only', () => {
  assert.ok(tabBar.includes('useKeyboardShown'));
  assert.ok(/Platform\.OS === 'android' && keyboardShown/.test(tabBar));
});
