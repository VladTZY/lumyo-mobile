import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft, Sparkles,
  Bold, Italic, Underline, List, Link2, Folder, RefreshCw, X,
} from 'lucide-react-native';
import { colors, fonts, radius } from '../theme';
import { MarkdownText } from '../components/MarkdownText';
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

function isWrappedWith(text: string, sel: Sel, open: string, close = open): boolean {
  const selected = text.slice(sel.start, sel.end);
  if (selected.length >= open.length + close.length && selected.startsWith(open) && selected.endsWith(close)) {
    return true;
  }
  return text.slice(0, sel.start).endsWith(open) && text.slice(sel.end).startsWith(close);
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

function toggleList(text: string, sel: Sel): FormatResult {
  const blockStart = text.lastIndexOf('\n', sel.start - 1) + 1;
  let blockEnd = text.indexOf('\n', sel.end);
  if (blockEnd === -1) blockEnd = text.length;
  const lines = text.slice(blockStart, blockEnd).split('\n');
  const allListed = lines.every((l) => l.startsWith('- ') || !l.trim());
  const newLines = allListed
    ? lines.map((l) => (l.startsWith('- ') ? l.slice(2) : l))
    : lines.map((l) => (!l.trim() || l.startsWith('- ') ? l : '- ' + l));
  const newBlock = newLines.join('\n');
  const delta = newLines[0].length - lines[0].length;
  const start = Math.max(blockStart, sel.start + delta);
  const end = Math.max(start, sel.end + (newBlock.length - (blockEnd - blockStart)));
  return { text: text.slice(0, blockStart) + newBlock + text.slice(blockEnd), sel: { start, end } };
}

function insertLink(text: string, sel: Sel): FormatResult {
  const selected = text.slice(sel.start, sel.end) || 'link text';
  const urlStart = sel.start + selected.length + 3; // past "[" + text + "]("
  return {
    text: text.slice(0, sel.start) + `[${selected}](url)` + text.slice(sel.end),
    sel: { start: urlStart, end: urlStart + 3 },
  };
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function NoteEditorScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
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

  if (loading) {
    return (
      <View style={styles.root}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.aiAccent} />
        </View>
      </View>
    );
  }

  const category = note?.categories?.[0];
  const dateStr = note ? formatDate(note.updated_at) : formatDate(new Date().toISOString());
  const words = wordCount(content);
  const showSummaryCard = summary && !summaryDismissed;

  const boldActive = isWrappedWith(content, sel, '**');
  const italicActive = isWrappedWith(content, sel, '***') || (isWrappedWith(content, sel, '*') && !boldActive);
  const underlineActive = isWrappedWith(content, sel, '<u>', '</u>');
  const listActive = content
    .slice(content.lastIndexOf('\n', sel.start - 1) + 1)
    .startsWith('- ');

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.top}
    >

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <ChevronLeft size={22} color={colors.textPrimary} />
          <Text style={styles.backText}>Notes</Text>
        </TouchableOpacity>
        <View style={styles.topActions}>
          <TouchableOpacity
            style={[styles.aiBtn, categorizing && styles.aiBtnDisabled]}
            onPress={handleAutocategorize}
            disabled={categorizing}
          >
            {categorizing ? (
              <ActivityIndicator size={14} color={colors.aiAccent} />
            ) : (
              <Folder size={14} color={colors.aiAccent} />
            )}
            <Text style={styles.aiBtnText}>
              {categorizing ? 'Categorizing…' : 'Auto-tag'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.aiBtn, summarizing && styles.aiBtnDisabled]}
            onPress={handleSummarize}
            disabled={summarizing}
          >
            {summarizing ? (
              <ActivityIndicator size={14} color={colors.aiAccent} />
            ) : (
              <Sparkles size={14} color={colors.aiAccent} />
            )}
            <Text style={styles.aiBtnText}>
              {summarizing ? 'Generating…' : summary ? 'Resummarize' : 'Summarize'}
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
          placeholder="Note title"
          placeholderTextColor={colors.textMuted}
          multiline
          selectionColor={colors.aiAccent}
        />

        {/* Meta row */}
        <View style={styles.metaRow}>
          {category && (
            <View style={styles.catTag}>
              <Folder size={12} color={colors.textSecondary} />
              <Text style={styles.catTagText}>{category.title}</Text>
            </View>
          )}
          <Text style={styles.dateText}>{dateStr}</Text>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* AI Summary card */}
        {showSummaryCard && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <Sparkles size={16} color={colors.aiAccent} />
              <Text style={styles.summaryTitle}>AI Summary</Text>
            </View>

            {summary.status === 'pending' || summary.status === 'generating' ? (
              <View style={styles.summaryLoading}>
                <ActivityIndicator size="small" color={colors.aiAccent} />
                <Text style={styles.summaryLoadingText}>Generating summary…</Text>
              </View>
            ) : summary.status === 'failed' ? (
              <Text style={styles.summaryError}>
                {summary.error_message || 'Failed to generate summary.'}
              </Text>
            ) : (
              <Text style={styles.summaryBody}>{summary.content}</Text>
            )}

            {(summary.status === 'completed' || summary.status === 'failed') && (
              <View style={styles.summaryActions}>
                <TouchableOpacity style={styles.summaryActionBtn} onPress={handleResummarize}>
                  <RefreshCw size={12} color={colors.aiAccent} />
                  <Text style={styles.summaryActionText}>Resummarize</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.summaryActionBtn} onPress={handleDismiss}>
                  <X size={12} color={colors.aiAccent} />
                  <Text style={styles.summaryActionText}>Dismiss</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Body — children (not value) so nested Text spans style the
            markdown live while the underlying string stays editable.
            react-native-web can't render children inside a textarea, so web
            falls back to a plain controlled value. */}
        <TextInput
          ref={bodyRef}
          style={styles.bodyInput}
          value={Platform.OS === 'web' ? content : undefined}
          onChangeText={(t) => { setContent(t); isDirty.current = true; }}
          selection={forcedSel}
          onSelectionChange={(e) => {
            setSel(e.nativeEvent.selection);
            if (forcedSel) setForcedSel(undefined);
          }}
          placeholder="Start writing..."
          placeholderTextColor={colors.textMuted}
          multiline
          textAlignVertical="top"
          selectionColor={colors.aiAccent}
        >
          {Platform.OS !== 'web' && content.length > 0
            ? <MarkdownText text={content} />
            : undefined}
        </TextInput>
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
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
          <TouchableOpacity
            style={[styles.toolBtn, listActive && styles.toolBtnActive]}
            onPress={() => applyFormat(toggleList)}
            hitSlop={TOOLBTN_HITSLOP}
            accessibilityRole="button"
            accessibilityLabel="Bulleted list"
            accessibilityState={{ selected: listActive }}
          >
            <List size={18} color={listActive ? colors.textPrimary : colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.toolBtn}
            onPress={() => applyFormat(insertLink)}
            hitSlop={TOOLBTN_HITSLOP}
            accessibilityRole="button"
            accessibilityLabel="Insert link"
          >
            <Link2 size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <Text style={styles.wordCount}>{words} words</Text>
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={save}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator size={14} color="#FFFFFF" />
            : <Text style={styles.saveBtnText}>Save</Text>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backText: { fontFamily: fonts.inter.regular, fontSize: 14, color: colors.textSecondary },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  aiBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.aiAccentLight, borderRadius: radius.full,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  aiBtnDisabled: { opacity: 0.6 },
  aiBtnText: { fontFamily: fonts.inter.medium, fontSize: 12, color: colors.aiAccentText },
  iconCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.bgSurface,
    alignItems: 'center', justifyContent: 'center',
  },
  scroll: { flex: 1 },
  editorContent: { paddingHorizontal: 20, paddingBottom: 20, gap: 16 },
  titleInput: {
    fontFamily: fonts.spaceGrotesk.semiBold,
    fontSize: 22, color: colors.textPrimary,
    lineHeight: 30, letterSpacing: -0.3,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  catTag: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.accentLight, borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  catTagText: { fontFamily: fonts.inter.medium, fontSize: 12, color: colors.textSecondary },
  dateText: { fontFamily: fonts.inter.regular, fontSize: 12, color: colors.textMuted },
  divider: { height: 1, backgroundColor: colors.border },
  // Summary card
  summaryCard: {
    backgroundColor: '#F3F0FF',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#D4C8FF',
    padding: 16,
    gap: 12,
  },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  summaryTitle: {
    fontFamily: fonts.spaceGrotesk.semiBold,
    fontSize: 14, color: colors.aiAccentText,
  },
  summaryLoading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  summaryLoadingText: {
    fontFamily: fonts.inter.regular, fontSize: 13, color: colors.aiAccentText,
  },
  summaryBody: {
    fontFamily: fonts.inter.regular,
    fontSize: 13, color: '#4A3580', lineHeight: 20,
  },
  summaryError: {
    fontFamily: fonts.inter.regular,
    fontSize: 13, color: '#E53E3E',
  },
  summaryActions: { flexDirection: 'row', gap: 10 },
  summaryActionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.aiAccent,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  summaryActionText: {
    fontFamily: fonts.inter.medium, fontSize: 12, color: colors.aiAccentText,
  },
  bodyInput: {
    fontFamily: fonts.inter.regular, fontSize: 15,
    color: colors.textPrimary, lineHeight: 24, minHeight: 400,
  },
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.bgSurface,
    borderTopWidth: 1, borderTopColor: colors.border,
    paddingHorizontal: 20, paddingTop: 10,
  },
  toolbarLeft: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  toolBtn: {
    width: 36, height: 36, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  toolBtnActive: { backgroundColor: colors.accentLight },
  wordCount: { fontFamily: fonts.inter.regular, fontSize: 11, color: colors.textMuted },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.accent, borderRadius: radius.full,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontFamily: fonts.inter.semiBold, fontSize: 12, color: '#FFFFFF' },
});
