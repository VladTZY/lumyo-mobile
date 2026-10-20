// Pure module: no imports. Markdown-style formatting for the note editor
// (inline spans, bullet lists, Enter handling, word count). Kept free of React
// Native so node --test can transpile and run it directly.

export type Sel = { start: number; end: number };
export type FormatResult = { text: string; sel: Sel };
export type Format = 'bold' | 'italic' | 'underline' | 'bullet';
export type ActiveFormats = Record<Format, boolean>;

// Bullet-list lines start with this glyph; Enter on one continues the list,
// Enter on an empty item ends it.
export const BULLET = '• ';

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isWrappedWith(text: string, sel: Sel, open: string, close = open): boolean {
  const selected = text.slice(sel.start, sel.end);
  if (selected.length >= open.length + close.length && selected.startsWith(open) && selected.endsWith(close)) {
    return true;
  }
  if (text.slice(0, sel.start).endsWith(open) && text.slice(sel.end).startsWith(close)) {
    return true;
  }
  // Caret (or selection) resting strictly inside an already-formatted span,
  // not touching the markers themselves — e.g. the caret placed mid-word
  // after tapping into "**bold**". Walk every non-overlapping open...close
  // pair left-to-right and check whether the caret/selection falls inside
  // one of them, so the toolbar highlight reflects "inside a formatted
  // span" the same way it does for an exact marker-touching selection.
  const pairPattern = new RegExp(`${escapeForRegExp(open)}([\\s\\S]*?)${escapeForRegExp(close)}`, 'g');
  let pair: RegExpExecArray | null;
  while ((pair = pairPattern.exec(text))) {
    const innerStart = pair.index + open.length;
    const innerEnd = pair.index + pair[0].length - close.length;
    if (innerStart < innerEnd && sel.start >= innerStart && sel.end <= innerEnd) {
      return true;
    }
  }
  return false;
}

function toggleInline(text: string, sel: Sel, open: string, close = open): FormatResult {
  const { start, end } = sel;
  const before = text.slice(0, start);
  const selected = text.slice(start, end);
  const after = text.slice(end);

  if (selected.length >= open.length + close.length && selected.startsWith(open) && selected.endsWith(close)) {
    const inner = selected.slice(open.length, selected.length - close.length);
    return { text: before + inner + after, sel: { start, end: start + inner.length } };
  }

  // A doubled marker around the selection belongs to a different format
  // (e.g. ** around an italic candidate is bold) — unless tripled, in which
  // case the single marker is genuinely present too.
  const partOfLongerMarker =
    before.endsWith(open + open) && after.startsWith(close + close) &&
    !(before.endsWith(open + open + open) && after.startsWith(close + close + close));
  if (before.endsWith(open) && after.startsWith(close) && !partOfLongerMarker) {
    return {
      text: before.slice(0, before.length - open.length) + selected + after.slice(close.length),
      sel: { start: start - open.length, end: end - open.length },
    };
  }

  if (start === end) {
    // Cursor right before a closing marker: step over it instead of inserting
    // a new pair — toggling the format off resumes unstyled typing after it.
    const closeIsOtherFormat =
      after.startsWith(close + close) && !after.startsWith(close + close + close);
    if (after.startsWith(close) && !closeIsOtherFormat) {
      const cursor = start + close.length;
      return { text, sel: { start: cursor, end: cursor } };
    }
    const cursor = start + open.length;
    return { text: before + open + close + after, sel: { start: cursor, end: cursor } };
  }
  return {
    text: before + open + selected + close + after,
    sel: { start: start + open.length, end: end + open.length },
  };
}

const INLINE: Record<'bold' | 'italic' | 'underline', [string, string]> = {
  bold: ['**', '**'],
  italic: ['*', '*'],
  underline: ['<u>', '</u>'],
};

// MarkdownText also renders '- ' lines as bullets, so they count as bullets
// here; toggling on never writes them.
const LEGACY_BULLET = '- ';

type Line = { start: number; line: string };

const clamp = (n: number, max: number) => Math.min(Math.max(Number.isFinite(n) ? n : 0, 0), max);

function normalise(text: string, sel: Sel): Sel {
  const a = clamp(sel.start, text.length);
  const b = clamp(sel.end, text.length);
  return { start: Math.min(a, b), end: Math.max(a, b) };
}

function bulletPrefix(line: string): string | null {
  if (line.startsWith(BULLET)) return BULLET;
  if (line.startsWith(LEGACY_BULLET)) return LEGACY_BULLET;
  return null;
}

const isBlank = (line: string) => line.trim() === '';

// Lines from the one holding the selection start to the one holding its end.
// A non-empty selection ending right after a newline stops short of the line
// it never actually touched.
function touchedLines(text: string, sel: Sel): Line[] {
  const { start, end } = sel;
  const last = start < end && text[end - 1] === '\n' ? end - 1 : end;
  let lineStart = start === 0 ? 0 : text.lastIndexOf('\n', start - 1) + 1;
  const lines: Line[] = [];
  while (lineStart <= last) {
    let lineEnd = text.indexOf('\n', lineStart);
    if (lineEnd === -1) lineEnd = text.length;
    lines.push({ start: lineStart, line: text.slice(lineStart, lineEnd) });
    lineStart = lineEnd + 1;
  }
  return lines;
}

// Blank lines are skipped, unless every touched line is blank.
function candidates(lines: Line[]): Line[] {
  const filled = lines.filter((l) => !isBlank(l.line));
  return filled.length ? filled : lines;
}

function toggleBullet(text: string, sel: Sel): FormatResult {
  const cands = candidates(touchedLines(text, sel));
  const removing = cands.every((l) => bulletPrefix(l.line) !== null);
  const edits = removing ? cands : cands.filter((l) => bulletPrefix(l.line) === null);

  let out = '';
  let cursor = 0;
  for (const { start } of edits) {
    out += text.slice(cursor, start);
    cursor = removing ? start + BULLET.length : start;
    if (!removing) out += BULLET;
  }
  out += text.slice(cursor);

  // Edits sit on disjoint lines, so each original offset moves by the sum of
  // its shift past every edit.
  const map = (p: number) =>
    edits.reduce((acc, { start }) => {
      if (!removing) return p >= start ? acc + BULLET.length : acc;
      if (p >= start + BULLET.length) return acc - BULLET.length;
      return p > start ? acc + (start - p) : acc;
    }, p);
  return { text: out, sel: { start: map(sel.start), end: map(sel.end) } };
}

export function toggleFormat(text: string, sel: Sel, format: Format): FormatResult {
  const s = normalise(text, sel);
  if (format === 'bullet') return toggleBullet(text, s);
  const [open, close] = INLINE[format];
  return toggleInline(text, s, open, close);
}

export function activeFormats(text: string, sel: Sel): ActiveFormats {
  const bold = isWrappedWith(text, sel, '**');
  const italic = isWrappedWith(text, sel, '***') || (isWrappedWith(text, sel, '*') && !bold);
  const underline = isWrappedWith(text, sel, '<u>', '</u>');
  const bullet = candidates(touchedLines(text, normalise(text, sel)))
    .every((l) => bulletPrefix(l.line) !== null);
  return { bold, italic, underline, bullet };
}

// Spans MarkdownText styles within a single line. A newline typed inside one
// would strand the closing marker on the next line and break the styling.
const INLINE_SPAN = /(\*{1,3})([^*\n]+?)\1|<u>([^\n]*?)<\/u>/g;

// Adjusts a just-typed newline the way Apple Notes behaves: a span the caret
// was inside is closed before the break (and reopened after it when span text
// continues), bullet lines continue the list, and an empty bullet item ends
// it. Returns null when the change is not a single typed newline or needs no
// adjustment.
//
// A newline typed next to an existing one yields the same newText whether it
// went at the end of line N or the start of line N+1. `caret` (the pre-edit
// selection start) resolves that; without a usable hint the break is assumed
// to follow a bullet line when one ends there, else to open the later line.
export function processNewline(oldText: string, newText: string, caret?: number): FormatResult | null {
  if (newText.length !== oldText.length + 1) return null;
  let p = 0;
  while (p < oldText.length && oldText[p] === newText[p]) p++;
  if (newText[p] !== '\n' || oldText.slice(p) !== newText.slice(p + 1)) return null;

  if (p > 0 && oldText[p - 1] === '\n') {
    let runStart = p - 1;
    while (runStart > 0 && oldText[runStart - 1] === '\n') runStart--;
    if (caret !== undefined && Number.isInteger(caret) && caret >= runStart && caret <= p) {
      p = caret;
    } else {
      const prevStart = runStart === 0 ? 0 : oldText.lastIndexOf('\n', runStart - 1) + 1;
      if (bulletPrefix(oldText.slice(prevStart, runStart)) !== null) p = runStart;
    }
  }

  const lineStart = oldText.lastIndexOf('\n', p - 1) + 1;
  let lineEnd = oldText.indexOf('\n', p);
  if (lineEnd === -1) lineEnd = oldText.length;
  const line = oldText.slice(lineStart, lineEnd);

  // Enter on an empty bullet item removes the bullet and ends the list.
  const prefix = bulletPrefix(line);
  if (prefix !== null && oldText.slice(lineStart, p) === prefix && p === lineEnd) {
    return { text: oldText.slice(0, lineStart) + oldText.slice(p), sel: { start: lineStart, end: lineStart } };
  }

  // Newline inside a styled span: close the span before the break, reopen it
  // after when its text continues on the next line.
  const re = new RegExp(INLINE_SPAN.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    const open = m[1] !== undefined ? m[1] : '<u>';
    const close = m[1] !== undefined ? m[1] : '</u>';
    const matchStart = lineStart + m.index;
    const matchEnd = matchStart + m[0].length;
    const innerStart = matchStart + open.length;
    const innerEnd = matchEnd - close.length;
    if (p < innerStart || p > innerEnd) continue;

    const left = oldText.slice(innerStart, p);
    const right = oldText.slice(p, innerEnd);
    const before = oldText.slice(0, matchStart);
    // A bullet line keeps its list going across the break.
    const carried = prefix !== null && p >= lineStart + prefix.length ? prefix : '';
    const text =
      before +
      (left ? open + left + close : '') +
      '\n' +
      carried +
      (right ? open + right + close : '') +
      oldText.slice(matchEnd);
    const cursor =
      before.length + (left ? open.length + left.length + close.length : 0) + 1 + carried.length + (right ? open.length : 0);
    return { text, sel: { start: cursor, end: cursor } };
  }

  // Enter on a bullet line continues the list on the next line.
  if (prefix !== null && p >= lineStart + prefix.length) {
    const cursor = p + 1 + prefix.length;
    return {
      text: newText.slice(0, p + 1) + prefix + newText.slice(p + 1),
      sel: { start: cursor, end: cursor },
    };
  }

  return null;
}

// Bullet prefixes and tokens made only of formatting markers are not words.
export function wordCount(text: string): number {
  return text
    .split('\n')
    .flatMap((line) => line.slice((bulletPrefix(line) ?? '').length).split(/\s+/))
    .filter((token) => token.replace(/\*|<u>|<\/u>/g, '') !== '')
    .length;
}
