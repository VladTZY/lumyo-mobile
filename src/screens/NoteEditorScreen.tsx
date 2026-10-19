import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bold, Italic, Underline, Folder, RefreshCw, X, ScrollText } from 'lucide-react-native';
import { fonts, radius, type Colors } from '../theme';
import { useStyles, useTheme } from '../theme/ThemeContext';
import { LogoMark } from '../components/Logo';
import { BackButton, CenteredSpinner } from '../components/ui';
import { MarkdownText } from '../components/MarkdownText';
import { FadeSlideIn } from '../components/FadeSlideIn';
import { getNote, createNote, updateNote, autocategorizeNote, type Note } from '../services/notes';
import { getSummary, generateSummary, type NoteSummary } from '../services/summaries';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { NotesStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<NotesStackParamList, 'NoteEditor'>;

const SUMMARY_POLL_INTERVAL = 2000;

// Brings the 36px toolbar buttons up to the 44px minimum touch target.
const TOOLBTN_HITSLOP = { top: 4, bottom: 4, left: 4, right: 4 };

function wordCount(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

type Sel = { start: number; end: number };
type FormatResult = { text: string; sel: Sel };

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

// Bullet-list lines (in existing notes) start with this glyph; Enter on one
// continues the list, Enter on an empty item ends it.
const BULLET = '• ';

// Spans MarkdownText styles within a single line. A newline typed inside one
// would strand the closing marker on the next line and break the styling.
const INLINE_SPAN = /(\*{1,3})([^*\n]+?)\1|<u>([^\n]*?)<\/u>/g;

// Adjusts a just-typed newline the way Apple Notes behaves: a span the caret
// was inside is closed before the break (and reopened after it when span text
// continues), bullet lines continue the list, and an empty bullet item ends
// it. Returns null when the change is not a single typed newline or needs no
// adjustment.
function processNewline(oldText: string, newText: string): FormatResult | null {
  if (newText.length !== oldText.length + 1) return null;
  let p = 0;
  while (p < oldText.length && oldText[p] === newText[p]) p++;
  if (newText[p] !== '\n' || oldText.slice(p) !== newText.slice(p + 1)) return null;

  const lineStart = oldText.lastIndexOf('\n', p - 1) + 1;
  let lineEnd = oldText.indexOf('\n', p);
  if (lineEnd === -1) lineEnd = oldText.length;
  const line = oldText.slice(lineStart, lineEnd);

  // Enter on an empty bullet item removes the bullet and ends the list.
  if (oldText.slice(lineStart, p) === BULLET && p === lineEnd) {
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
    const text =
      before +
      (left ? open + left + close : '') +
      '\n' +
      (right ? open + right + close : '') +
      oldText.slice(matchEnd);
    const cursor =
      before.length + (left ? open.length + left.length + close.length : 0) + 1 + (right ? open.length : 0);
    return { text, sel: { start: cursor, end: cursor } };
  }

  // Enter on a bullet line continues the list on the next line.
  if (line.startsWith(BULLET) && p >= lineStart + BULLET.length) {
    const cursor = p + 1 + BULLET.length;
    return {
      text: newText.slice(0, p + 1) + BULLET + newText.slice(p + 1),
      sel: { start: cursor, end: cursor },
    };
  }

  return null;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function NoteEditorScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { colors, scheme } = useTheme();
  const styles = useStyles(makeStyles);
  const { id: routeId, isNew: routeIsNew } = route.params;
  const [noteId, setNoteId] = useState(routeId);
  const [isNew, setIsNew] = useState(routeIsNew);

  const [note, setNote] = useState<Note | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const isDirty = useRef(false);
  const titleRef = useRef(title);
  const contentRef = useRef(content);
  const noteIdRef = useRef(noteId);
  const isNewRef = useRef(isNew);
  const savingRef = useRef(false);

  const bodyRef = useRef<TextInput>(null);
  const [sel, setSel] = useState<Sel>({ start: 0, end: 0 });
  // Set transiently to move the cursor after a formatting edit, then released
  // so the input goes back to driving its own selection.
  const [forcedSel, setForcedSel] = useState<Sel | undefined>();

  const [summary, setSummary] = useState<NoteSummary | null>(null);
  const [summaryDismissed, setSummaryDismissed] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback((noteId: number) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const updated = await getSummary(noteId);
        if (updated) {
          setSummary(updated);
          if (updated.status === 'completed' || updated.status === 'failed') {
            stopPolling();
            setSummarizing(false);
          }
        }
      } catch {
        stopPolling();
        setSummarizing(false);
      }
    }, SUMMARY_POLL_INTERVAL);
  }, [stopPolling]);

  const load = useCallback(async () => {
    if (!noteId) return;
    try {
      const data = await getNote(Number(noteId));
      setNote(data);
      setTitle(data.title);
      setContent(data.content);
      if (data.note_summary) {
        setSummary(data.note_summary);
        if (data.note_summary.status === 'pending' || data.note_summary.status === 'generating') {
          setSummarizing(true);
          startPolling(Number(noteId));
        }
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [noteId, startPolling]);

  useEffect(() => { titleRef.current = title; }, [title]);
  useEffect(() => { contentRef.current = content; }, [content]);
  useEffect(() => { noteIdRef.current = noteId; }, [noteId]);
  useEffect(() => { isNewRef.current = isNew; }, [isNew]);

  useEffect(() => { if (!isNew) load(); }, [load, isNew]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', () => {
      if (!isDirty.current || savingRef.current) return;
      const t = titleRef.current.trim();
      const c = contentRef.current.trim();
      if (!t || !c) return;
      if (isNewRef.current) {
        createNote(t, c).catch(() => {});
      } else if (noteIdRef.current) {
        updateNote(Number(noteIdRef.current), t, c).catch(() => {});
      }
      isDirty.current = false;
    });
    return unsubscribe;
  }, [navigation]);

  const save = useCallback(async () => {
    Keyboard.dismiss();
    if (!title.trim()) {
      Alert.alert('Title required', 'Please add a title before saving.');
      return;
    }
    if (!content.trim()) {
      Alert.alert('Content required', 'Please add some content before saving.');
      return;
    }
    try {
      setSaving(true);
      savingRef.current = true;
      if (isNew) {
        const created = await createNote(title.trim(), content.trim());
        setNote(created);
        setNoteId(String(created.id));
        setIsNew(false);
      } else if (noteId) {
        await updateNote(Number(noteId), title.trim(), content.trim());
      }
      isDirty.current = false;
    } catch (e: any) {
      Alert.alert('Save failed', e.message);
    } finally {
      setSaving(false);
      savingRef.current = false;
    }
  }, [title, content, noteId, isNew]);

  const handleBack = () => {
    navigation.goBack();
  };

  const handleSummarize = useCallback(async () => {
    if (!noteId) {
      Alert.alert('Save first', 'Please save the note before summarizing.');
      return;
    }
    try {
      setSummarizing(true);
      setSummaryDismissed(false);
      const pending = await generateSummary(Number(noteId));
      setSummary(pending);
      startPolling(Number(noteId));
    } catch (e: any) {
      setSummarizing(false);
      Alert.alert('Error', e.message);
    }
  }, [noteId, startPolling]);

  const handleResummarize = useCallback(async () => {
    if (!noteId) return;
    try {
      setSummarizing(true);
      const pending = await generateSummary(Number(noteId));
      setSummary(pending);
      startPolling(Number(noteId));
    } catch (e: any) {
      setSummarizing(false);
      Alert.alert('Error', e.message);
    }
  }, [noteId, startPolling]);

  const handleDismiss = useCallback(() => {
    setSummaryDismissed(true);
    stopPolling();
  }, [stopPolling]);

  const applyFormat = useCallback((transform: (text: string, sel: Sel) => FormatResult) => {
    const result = transform(contentRef.current, sel);
    setContent(result.text);
    isDirty.current = true;
    setSel(result.sel);
    setForcedSel(result.sel);
    bodyRef.current?.focus();
  }, [sel]);

  const [categorizing, setCategorizing] = useState(false);

  const handleAutocategorize = useCallback(async () => {
    if (!noteId) {
      Alert.alert('Save first', 'Please save the note before categorizing.');
      return;
    }
    try {
      setCategorizing(true);
      const updated = await autocategorizeNote(Number(noteId));
      setNote(updated);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setCategorizing(false);
    }
  }, [noteId]);

  if (loading) return <View style={styles.root}><CenteredSpinner /></View>;

  const category = note?.categories?.[0];
  const dateStr = note ? formatDate(note.updated_at) : formatDate(new Date().toISOString());
  const words = wordCount(content);
  const showSummaryCard = summary && !summaryDismissed;

  const boldActive = isWrappedWith(content, sel, '**');
  const italicActive = isWrappedWith(content, sel, '***') || (isWrappedWith(content, sel, '*') && !boldActive);
  const underlineActive = isWrappedWith(content, sel, '<u>', '</u>');

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.top}
    >

      {/* Top bar */}
      <View style={styles.topBar}>
        <BackButton label="Notes" onPress={handleBack} />
        <View style={styles.topActions}>
          <TouchableOpacity
            style={[styles.aiBtn, categorizing && styles.aiBtnDisabled]}
            onPress={handleAutocategorize}
            disabled={categorizing}
          >
            {categorizing ? (
              <ActivityIndicator size="small" color={colors.citationText} />
            ) : (
              <Folder size={14} color={colors.citationText} strokeWidth={1.75} />
            )}
            <Text style={styles.aiBtnText}>
              {categorizing ? 'Filing…' : 'File it'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.aiBtn, summarizing && styles.aiBtnDisabled]}
            onPress={handleSummarize}
            disabled={summarizing}
          >
            {summarizing ? (
              <ActivityIndicator size="small" color={colors.citationText} />
            ) : (
              <ScrollText size={14} color={colors.citationText} strokeWidth={1.75} />
            )}
            <Text style={styles.aiBtnText}>
              {summarizing ? 'Summarizing…' : 'Summarize'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Editor */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.editorContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <TextInput
          style={styles.titleInput}
          value={title}
          onChangeText={(t) => { setTitle(t); isDirty.current = true; }}
          placeholder="Title"
          placeholderTextColor={colors.textMuted}
          multiline
          rejectResponderTermination={false}
          selectionColor={colors.accent}
          keyboardAppearance={scheme}
          accessibilityLabel="Note title"
        />

        {/* Meta row */}
        <View style={styles.metaRow}>
          {category && (
            <View style={styles.catTag}>
              <Folder size={12} color={colors.textSecondary} strokeWidth={1.75} />
              <Text style={styles.catTagText}>{category.title}</Text>
            </View>
          )}
          <Text style={styles.dateText}>{dateStr}</Text>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* AI Summary card */}
        {showSummaryCard && (
          <FadeSlideIn style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <LogoMark size={15} />
              <Text style={styles.summaryTitle}>Summary</Text>
            </View>

            {summary.status === 'pending' || summary.status === 'generating' ? (
              <View style={styles.summaryLoading}>
                <ActivityIndicator size="small" color={colors.citationText} />
                <Text style={styles.summaryLoadingText}>Reading this note…</Text>
              </View>
            ) : summary.status === 'failed' ? (
              <Text style={styles.summaryError}>
                {summary.error_message || "Couldn't summarize this note. Try again."}
              </Text>
            ) : (
              <Text style={styles.summaryBody}>{summary.content}</Text>
            )}

            {(summary.status === 'completed' || summary.status === 'failed') && (
              <View style={styles.summaryActions}>
                <TouchableOpacity style={styles.summaryActionBtn} onPress={handleResummarize} accessibilityRole="button">
                  <RefreshCw size={13} color={colors.citationText} strokeWidth={1.75} />
                  <Text style={styles.summaryActionText}>Summarize again</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.summaryActionBtn} onPress={handleDismiss} accessibilityRole="button">
                  <X size={13} color={colors.citationText} strokeWidth={1.75} />
                  <Text style={styles.summaryActionText}>Hide</Text>
                </TouchableOpacity>
              </View>
            )}
          </FadeSlideIn>
        )}

        {/* Body — children (not value) so nested Text spans style the
            markdown live while the underlying string stays editable.
            react-native-web can't render children inside a textarea, so web
            falls back to a plain controlled value. */}
        <TextInput
          ref={bodyRef}
          style={styles.bodyInput}
          value={Platform.OS === 'web' ? content : undefined}
          onChangeText={(t) => {
            isDirty.current = true;
            const adjusted = processNewline(contentRef.current, t);
            if (adjusted) {
              setContent(adjusted.text);
              setSel(adjusted.sel);
              setForcedSel(adjusted.sel);
            } else {
              setContent(t);
            }
          }}
          selection={forcedSel}
          onSelectionChange={(e) => {
            setSel(e.nativeEvent.selection);
            if (forcedSel) setForcedSel(undefined);
          }}
          placeholder="Start writing…"
          placeholderTextColor={colors.textMuted}
          keyboardAppearance={scheme}
          accessibilityLabel="Note text"
          multiline
          // Let the outer ScrollView own the drag gesture — a focused
          // multiline TextInput otherwise swallows it and the note can't be
          // scrolled while the keyboard is up. The input grows with its
          // content, so it never needs to scroll itself.
          scrollEnabled={false}
          // Makes the focus-press cancelable on iOS: a drag that turns into a
          // scroll no longer focuses the input and pops the keyboard — only a
          // clean tap does.
          rejectResponderTermination={false}
          textAlignVertical="top"
          selectionColor={colors.accent}
        >
          {Platform.OS !== 'web' && content.length > 0
            ? <MarkdownText text={content} />
            : undefined}
        </TextInput>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.toolbarLeft}>
          <TouchableOpacity
            style={[styles.toolBtn, boldActive && styles.toolBtnActive]}
            onPress={() => applyFormat((t, s) => toggleInline(t, s, '**'))}
            hitSlop={TOOLBTN_HITSLOP}
            accessibilityRole="button"
            accessibilityLabel="Bold"
            accessibilityState={{ selected: boldActive }}
          >
            <Bold size={18} color={boldActive ? colors.textPrimary : colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toolBtn, italicActive && styles.toolBtnActive]}
            onPress={() => applyFormat((t, s) => toggleInline(t, s, '*'))}
            hitSlop={TOOLBTN_HITSLOP}
            accessibilityRole="button"
            accessibilityLabel="Italic"
            accessibilityState={{ selected: italicActive }}
          >
            <Italic size={18} color={italicActive ? colors.textPrimary : colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toolBtn, underlineActive && styles.toolBtnActive]}
            onPress={() => applyFormat((t, s) => toggleInline(t, s, '<u>', '</u>'))}
            hitSlop={TOOLBTN_HITSLOP}
            accessibilityRole="button"
            accessibilityLabel="Underline"
            accessibilityState={{ selected: underlineActive }}
          >
            <Underline size={18} color={underlineActive ? colors.textPrimary : colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <Text style={styles.wordCount}>{words} {words === 1 ? 'word' : 'words'}</Text>
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={save}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator size="small" color={colors.onAccent} />
            : <Text style={styles.saveBtnText}>Save</Text>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 4, paddingBottom: 8,
  },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aiBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36,
    backgroundColor: colors.citationBg, borderRadius: radius.full,
    paddingHorizontal: 12,
  },
  aiBtnDisabled: { opacity: 0.6 },
  aiBtnText: { fontFamily: fonts.inter.semiBold, fontSize: 13, color: colors.citationText },
  scroll: { flex: 1 },
  editorContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, gap: 14 },
  titleInput: {
    fontFamily: fonts.spaceGrotesk.semiBold,
    fontSize: 28, color: colors.textPrimary,
    lineHeight: 34, letterSpacing: -0.56, padding: 0,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  catTag: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.bgHover, borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  catTagText: { fontFamily: fonts.inter.medium, fontSize: 12, color: colors.textSecondary },
  dateText: { fontFamily: fonts.inter.regular, fontSize: 12, color: colors.textMuted },
  divider: { height: 1, backgroundColor: colors.border },
  // Summary card
  summaryCard: {
    backgroundColor: colors.citationBg,
    borderRadius: radius.lg,
    padding: 16,
    gap: 10,
  },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  summaryTitle: {
    fontFamily: fonts.spaceGrotesk.semiBold,
    fontSize: 14, color: colors.citationText,
  },
  summaryLoading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  summaryLoadingText: {
    fontFamily: fonts.inter.regular, fontSize: 14, color: colors.citationText,
  },
  summaryBody: {
    fontFamily: fonts.inter.regular,
    fontSize: 15, color: colors.textPrimary, lineHeight: 23,
  },
  summaryError: {
    fontFamily: fonts.inter.regular,
    fontSize: 14, lineHeight: 20, color: colors.danger,
  },
  summaryActions: { flexDirection: 'row', gap: 4, marginLeft: -8 },
  summaryActionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: radius.sm, minHeight: 36,
    paddingHorizontal: 8,
  },
  summaryActionText: {
    fontFamily: fonts.inter.semiBold, fontSize: 13, color: colors.citationText,
  },
  bodyInput: {
    fontFamily: fonts.inter.regular, fontSize: 16,
    color: colors.textPrimary, lineHeight: 26, minHeight: 400, padding: 0,
  },
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.bgSurface,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderStrong,
    // Constant padding rather than the home-indicator inset: the inset reads
    // as a hole under the toolbar both with the keyboard up and down. Matches
    // ChatScreen's input row.
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 10,
  },
  toolbarLeft: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  toolBtn: {
    width: 36, height: 36, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  toolBtnActive: { backgroundColor: colors.bgHover },
  wordCount: { fontFamily: fonts.inter.regular, fontSize: 12, color: colors.textMuted, fontVariant: ['tabular-nums'] },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.accent, borderRadius: radius.md,
    paddingHorizontal: 18, minHeight: 36, minWidth: 72,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontFamily: fonts.inter.semiBold, fontSize: 14, color: colors.onAccent },
});
