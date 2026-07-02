import React from 'react';
import { Text, StyleSheet, Platform } from 'react-native';
import Markdown, { MarkdownIt, type RenderRules } from 'react-native-markdown-display';
import { colors, fonts } from '../theme';

// Markdown has no underline syntax; the note editor emits <u>…</u>, so parse
// it with a custom inline rule and render it as underlined text.
const markdownIt = MarkdownIt({ typographer: true });
markdownIt.inline.ruler.before('emphasis', 'underline', (state: any, silent: boolean) => {
  if (!state.src.startsWith('<u>', state.pos)) return false;
  const close = state.src.indexOf('</u>', state.pos + 3);
  if (close < 0) return false;
  if (!silent) {
    const token = state.push('underline', '', 0);
    token.content = state.src.slice(state.pos + 3, close);
  }
  state.pos = close + 4;
  return true;
});

const rules: RenderRules = {
  underline: (node, _children, _parent, styles, inheritedStyles = {}) => (
    <Text key={node.key} style={[inheritedStyles, styles.text, mdStyles.underline]}>
      {node.content}
    </Text>
  ),
};

export function NoteMarkdown({ children }: { children: string }) {
  return (
    <Markdown markdownit={markdownIt} rules={rules} style={mdStyles}>
      {children}
    </Markdown>
  );
}

// Strips formatting markers for plain-text contexts like list previews.
export function stripMarkdown(text: string): string {
  return text
    .replace(/<\/?u>/g, '')
    .replace(/(\*{1,3})([^*\n]+)\1/g, '$2')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*]\s+/gm, '')
    .replace(/`([^`]+)`/g, '$1');
}

const mdStyles = StyleSheet.create({
  body: { fontFamily: fonts.inter.regular, fontSize: 15, color: colors.textPrimary, lineHeight: 24 },
  heading1: { fontFamily: fonts.spaceGrotesk.semiBold, fontSize: 20, color: colors.textPrimary, marginTop: 12, marginBottom: 4 },
  heading2: { fontFamily: fonts.spaceGrotesk.semiBold, fontSize: 18, color: colors.textPrimary, marginTop: 10, marginBottom: 4 },
  heading3: { fontFamily: fonts.spaceGrotesk.semiBold, fontSize: 16, color: colors.textPrimary, marginTop: 8, marginBottom: 4 },
  strong: { fontFamily: fonts.inter.semiBold },
  em: { fontStyle: 'italic' },
  underline: { textDecorationLine: 'underline' },
  bullet_list: { marginVertical: 4 },
  ordered_list: { marginVertical: 4 },
  list_item: { marginVertical: 2 },
  code_inline: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13, backgroundColor: colors.bgSurface, color: colors.aiAccent,
    paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4,
  },
  fence: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13, backgroundColor: colors.bgSurface, color: colors.textPrimary,
    padding: 12, borderRadius: 8, marginVertical: 8, overflow: 'hidden',
  },
  blockquote: {
    backgroundColor: colors.bgSurface, borderLeftWidth: 3, borderLeftColor: colors.aiAccent,
    paddingHorizontal: 12, paddingVertical: 8, marginVertical: 6, borderRadius: 4,
  },
  hr: { backgroundColor: colors.border, height: 1, marginVertical: 12 },
  paragraph: { marginTop: 0, marginBottom: 8 },
  link: { color: colors.aiAccent, textDecorationLine: 'underline' },
});
