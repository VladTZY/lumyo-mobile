import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { colors, fonts } from '../theme';

// Bold/italic (*, **, ***), underline (<u>…</u>) and links ([text](url)).
const INLINE = /(\*{1,3})([^*\n]+?)\1|<u>([^\n]*?)<\/u>|\[([^\]\n]*)\]\(([^)\n]*)\)/g;

/**
 * Renders markdown source with live inline styling, for use as TextInput
 * children. Every character of the source stays in the output (markers are
 * dimmed, not hidden) so the native text always equals the state string and
 * selection offsets keep lining up.
 */
export function MarkdownText({ text }: { text: string }) {
  return <Text>{renderLines(text)}</Text>;
}

function renderLines(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    let rest = line;
    if (line.startsWith('- ')) {
      nodes.push(<Text key={`b${i}`} style={s.bullet}>{'- '}</Text>);
      rest = line.slice(2);
    }
    nodes.push(...renderInline(rest, i));
    if (i < lines.length - 1) nodes.push('\n');
  });
  return nodes;
}

function renderInline(line: string, lineIdx: number): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = new RegExp(INLINE.source, 'g');
  let last = 0;
  let k = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    if (m.index > last) out.push(line.slice(last, m.index));
    const key = `${lineIdx}-${k++}`;
    if (m[1] !== undefined) {
      const marks = m[1];
      const style = marks.length === 1 ? s.italic : marks.length === 2 ? s.bold : s.boldItalic;
      out.push(
        <Text key={key}>
          <Text style={s.marker}>{marks}</Text>
          <Text style={style}>{m[2]}</Text>
          <Text style={s.marker}>{marks}</Text>
        </Text>
      );
    } else if (m[3] !== undefined) {
      out.push(
        <Text key={key}>
          <Text style={s.marker}>{'<u>'}</Text>
          <Text style={s.underline}>{m[3]}</Text>
          <Text style={s.marker}>{'</u>'}</Text>
        </Text>
      );
    } else {
      out.push(
        <Text key={key}>
          <Text style={s.marker}>[</Text>
          <Text style={s.link}>{m[4]}</Text>
          <Text style={s.marker}>{']('}</Text>
          <Text style={s.linkUrl}>{m[5]}</Text>
          <Text style={s.marker}>)</Text>
        </Text>
      );
    }
    last = m.index + m[0].length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

// Strips formatting markers for plain-text contexts like list previews.
export function stripMarkdown(text: string): string {
  return text
    .replace(/<\/?u>/g, '')
    .replace(/(\*{1,3})([^*\n]+)\1/g, '$2')
    .replace(/\[([^\]]*)\]\(([^)]*)\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*]\s+/gm, '')
    .replace(/`([^`]+)`/g, '$1');
}

const s = StyleSheet.create({
  marker: { color: colors.textMuted },
  bullet: { color: colors.textSecondary },
  bold: { fontFamily: fonts.inter.semiBold },
  italic: { fontStyle: 'italic' },
  boldItalic: { fontFamily: fonts.inter.semiBold, fontStyle: 'italic' },
  underline: { textDecorationLine: 'underline' },
  link: { color: colors.aiAccentText },
  linkUrl: { color: colors.textMuted },
});
