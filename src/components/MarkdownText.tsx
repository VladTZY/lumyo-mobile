import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { fonts } from '../theme';

// Bold/italic (*, **, ***), underline (<u>…</u>), and bare asterisk runs
// (e.g. the freshly-inserted empty pair "****" before the user has typed
// anything inside it, or a stray unclosed marker) which are hidden so raw
// syntax never flashes on screen.
const INLINE = /(\*{1,3})([^*\n]+?)\1|<u>([^\n]*?)<\/u>|(\*{2,6})/g;

type Range = { start: number; end: number };
type Highlight = { range: Range; bg: { backgroundColor: string } };

/**
 * Renders markdown source with live inline styling, for use as TextInput
 * children. Every character of the source stays in the output (markers are
 * visually collapsed to zero size, not removed) so the native text always
 * equals the state string and selection offsets keep lining up.
 *
 * `highlight` (offsets into `text`, end exclusive) tints that range with
 * `highlightColor`. It is visual only: leaves are split at the boundaries but
 * every character is still emitted exactly once, in order.
 */
export function MarkdownText({
  text,
  highlight,
  highlightColor,
}: {
  text: string;
  highlight?: { start: number; end: number } | null;
  highlightColor?: string;
}) {
  return <Text>{renderLines(text, validRange(highlight, text.length, highlightColor))}</Text>;
}

function validRange(
  range: Range | null | undefined,
  length: number,
  color: string | undefined
): Highlight | null {
  if (!range || !color) return null;
  const { start, end } = range;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  const clamped = Math.min(end, length);
  if (start < 0 || start >= clamped) return null;
  return { range: { start, end: clamped }, bg: { backgroundColor: color } };
}

// Emits `str` (which starts at absolute offset `abs`), splitting it so the part
// inside the highlight range gets the background. Without overlap it is
// returned exactly as it would be without highlighting.
function piece(
  str: string,
  abs: number,
  style: object | undefined,
  key: string,
  hl: Highlight | null
): React.ReactNode {
  const from = hl ? Math.max(hl.range.start, abs) : 0;
  const to = hl ? Math.min(hl.range.end, abs + str.length) : 0;
  if (!hl || from >= to) {
    return style ? <Text key={key} style={style}>{str}</Text> : str;
  }
  const parts: React.ReactNode[] = [];
  if (from > abs) parts.push(str.slice(0, from - abs));
  parts.push(<Text key={`${key}-h`} style={hl.bg}>{str.slice(from - abs, to - abs)}</Text>);
  if (to < abs + str.length) parts.push(str.slice(to - abs));
  return <Text key={key} style={style}>{parts}</Text>;
}

function renderLines(text: string, hl: Highlight | null): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const lines = text.split('\n');
  let offset = 0;
  lines.forEach((line, i) => {
    let rest = line;
    let restAt = offset;
    // '• ' is what the toolbar inserts; '- ' still recognized for old notes.
    if (line.startsWith('• ') || line.startsWith('- ')) {
      nodes.push(piece(line.slice(0, 2), offset, s.bullet, `b${i}`, hl));
      rest = line.slice(2);
      restAt = offset + 2;
    }
    nodes.push(...renderInline(rest, i, restAt, hl));
    if (i < lines.length - 1) nodes.push(piece('\n', offset + line.length, undefined, `n${i}`, hl));
    offset += line.length + 1;
  });
  return nodes;
}

function renderInline(line: string, lineIdx: number, base: number, hl: Highlight | null): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = new RegExp(INLINE.source, 'g');
  let last = 0;
  let k = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    const key = `${lineIdx}-${k++}`;
    if (m.index > last) out.push(piece(line.slice(last, m.index), base + last, undefined, `${key}-t`, hl));
    const at = base + m.index;
    if (m[1] !== undefined) {
      const marks = m[1];
      const style = marks.length === 1 ? s.italic : marks.length === 2 ? s.bold : s.boldItalic;
      out.push(
        <Text key={key}>
          {piece(marks, at, s.marker, `${key}-a`, hl)}
          {piece(m[2], at + marks.length, style, `${key}-b`, hl)}
          {piece(marks, at + marks.length + m[2].length, s.marker, `${key}-c`, hl)}
        </Text>
      );
    } else if (m[3] !== undefined) {
      out.push(
        <Text key={key}>
          {piece('<u>', at, s.marker, `${key}-a`, hl)}
          {piece(m[3], at + 3, s.underline, `${key}-b`, hl)}
          {piece('</u>', at + 3 + m[3].length, s.marker, `${key}-c`, hl)}
        </Text>
      );
    } else {
      // Bare asterisk run with no content yet — hide it entirely.
      out.push(piece(m[4], at, s.marker, key, hl));
    }
    last = m.index + m[0].length;
  }
  if (last < line.length) out.push(piece(line.slice(last), base + last, undefined, `${lineIdx}-end`, hl));
  return out;
}

// Strips formatting markers for plain-text contexts like list previews.
export function stripMarkdown(text: string): string {
  return text
    .replace(/<\/?u>/g, '')
    .replace(/(\*{1,3})([^*\n]+)\1/g, '$2')
    .replace(/\[([^\]]*)\]\(([^)]*)\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*•]\s+/gm, '')
    .replace(/`([^`]+)`/g, '$1');
}

const s = StyleSheet.create({
  // Marker glyphs (**, *, <u>) stay in the rendered output so the text still
  // matches `content` character-for-character (selection offsets and
  // round-tripping depend on this), but are collapsed to take no visible
  // space — this hides them from view without stripping them from the string.
  marker: { fontSize: 0, color: 'transparent' },
  // Inherits the input's text color, so it follows light and dark themes.
  bullet: {},
  bold: { fontFamily: fonts.inter.semiBold },
  italic: { fontFamily: fonts.inter.italic },
  boldItalic: { fontFamily: fonts.inter.semiBoldItalic },
  underline: { textDecorationLine: 'underline' },
});
