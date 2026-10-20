import React, { useEffect, useId, useRef, useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Pressable, StyleSheet, InputAccessoryView,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Keyboard, AccessibilityInfo,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, Folder, Mic, RefreshCw, X, ScrollText } from 'lucide-react-native';
import { fonts, radius, type Colors } from '../theme';
import { useStyles, useTheme } from '../theme/ThemeContext';
import { LogoMark } from '../components/Logo';
import { BackButton, CenteredSpinner, Tag } from '../components/ui';
import { MarkdownText } from '../components/MarkdownText';
import { FormatControls } from '../components/FormatControls';
import { useKeyboardShown } from '../components/useKeyboardShown';
import { useDictation } from '../components/useDictation';
import { DictationBar } from '../components/DictationBar';
import { dictationTarget, insertTranscript } from '../lib/dictation';
import { FadeSlideIn } from '../components/FadeSlideIn';
import { locateChunk } from '../lib/locateChunk';
import { passageScroll } from '../lib/passageScroll';
import {
  toggleFormat, activeFormats, processNewline, wordCount,
  type Sel, type FormatResult, type Format,
} from '../lib/noteFormatting';
import { getNote, createNote, updateNote, autocategorizeNote, type Note } from '../services/notes';
import { getSummary, generateSummary, type NoteSummary } from '../services/summaries';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { NotesStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<NotesStackParamList, 'NoteEditor'>;

const SUMMARY_POLL_INTERVAL = 2000;

// The format bar above the keyboard is an InputAccessoryView on iOS so it
// moves with the keyboard natively. On Fabric, any native prop update on a
// focused input with an accessory (a format tap sets `selection`) makes UIKit
// reload its input views. Typing only changes children, so it should be safe,
// but this can't be confirmed without a device: set to false to fall back to
// the in-layout bar Android uses.
const USE_IOS_ACCESSORY = true;

const SAVED_FLASH_MS = 1500;
// Brings the 36px AI pills and Save button up to the 44px minimum touch target.
const PILL_HITSLOP = { top: 4, bottom: 4, left: 2, right: 2 };
const SAVE_HITSLOP = { top: 4, bottom: 4, left: 4, right: 4 };

// Matches bodyInput.lineHeight; used to place the cited passage on screen.
const BODY_LINE_HEIGHT = 26;
// The cited passage lands this far down the viewport.
const SCROLL_TARGET_RATIO = 0.25;
const BANNER_HITSLOP = { top: 4, bottom: 4, left: 8, right: 8 };

type SourceNotice = 'exact' | 'approx' | 'missing';
// Web renders the body as a plain textarea, so it can scroll to the passage
// but cannot highlight it; its copy must not claim a highlight.
const SOURCE_NOTICE_TEXT: Record<SourceNotice, string> = Platform.OS === 'web'
  ? {
    exact: 'Scrolled to the passage Lumyo used.',
    approx: 'This note changed since Lumyo read it. Scrolled to the closest passage.',
    missing: "This note changed since Lumyo read it, so the passage can't be found.",
  }
  : {
    exact: 'Highlighted the passage Lumyo used.',
    approx: 'This note changed since Lumyo read it. Highlighted the closest passage.',
    missing: "This note changed since Lumyo read it, so the passage can't be highlighted.",
  };

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function NoteEditorScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { colors, scheme } = useTheme();
  const styles = useStyles(makeStyles);
  const { id: routeId, isNew: routeIsNew, sourceChunk, sourceNonce } = route.params;
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

  const keyboardShown = useKeyboardShown();
  const accessoryId = `note-format-${useId()}`;
  const useAccessory = Platform.OS === 'ios' && USE_IOS_ACCESSORY;
  const [formatOpen, setFormatOpen] = useState(false);
  const [bodyFocused, setBodyFocused] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bodyRef = useRef<TextInput>(null);
  const [sel, setSel] = useState<Sel>({ start: 0, end: 0 });
  // Set transiently to move the cursor after a formatting edit, then released
  // so the input goes back to driving its own selection.
  const [forcedSel, setForcedSel] = useState<Sel | undefined>();

  // Cited-passage highlight. Lives only in state and render output: `content`,
  // save() and the autosave never see it.
  const [highlight, setHighlight] = useState<{ start: number; end: number } | null>(null);
  const [sourceNotice, setSourceNotice] = useState<SourceNotice | null>(null);
  const [pendingScroll, setPendingScroll] = useState(false);
  const handledNonceRef = useRef<number | undefined>(undefined);
  const scrollRef = useRef<ScrollView>(null);
  const bodyYRef = useRef<number | null>(null);
  const prefixHRef = useRef<number | null>(null);
  const viewportHRef = useRef(0);

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

  // Locate the cited passage once the note has loaded, and again for each new
  // tap (sourceNonce) on an already-open screen.
  useEffect(() => {
    if (loading || !note || sourceNonce === undefined || sourceNonce === handledNonceRef.current) return;
    handledNonceRef.current = sourceNonce;
    if (!sourceChunk?.trim()) return;
    const m = locateChunk(contentRef.current, sourceChunk);
    if (!m) {
      setHighlight(null);
      setSourceNotice('missing');
      setPendingScroll(false);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      return;
    }
    setHighlight({ start: m.start, end: m.end });
    setSourceNotice(m.exact ? 'exact' : 'approx');
    setPendingScroll(true);
  }, [loading, note, sourceNonce, sourceChunk]);

  const clearHighlight = useCallback(() => {
    setHighlight(null);
    setSourceNotice(null);
    setPendingScroll(false);
  }, []);

  // Scrolls from the latest measurements. On web the textarea has a fixed
  // height and scrolls itself, so it takes the in-body offset first.
  const scrollToPassage = useCallback(() => {
    if (prefixHRef.current === null) return;
    const web = Platform.OS === 'web';
    const el = web ? (bodyRef.current as any) : null;
    const { outerY, innerTop } = passageScroll({
      prefixHeight: prefixHRef.current,
      lineHeight: BODY_LINE_HEIGHT,
      bodyY: bodyYRef.current ?? NaN,
      viewportHeight: viewportHRef.current,
      ratio: SCROLL_TARGET_RATIO,
      innerViewportHeight: el && typeof el.clientHeight === 'number' ? el.clientHeight : undefined,
    });
    if (el && typeof el.clientHeight === 'number') el.scrollTop = innerTop;
    scrollRef.current?.scrollTo({ y: outerY, animated: true });
  }, []);

  // Fires once the hidden measurer has laid out the text before the passage.
  // The banner mounts in the same commit, so bodyWrap's y may still be stale
  // here; scroll again next frame, after its onLayout has had a chance to run.
  const onMeasure = useCallback((e: LayoutChangeEvent) => {
    prefixHRef.current = e.nativeEvent.layout.height;
    scrollToPassage();
    requestAnimationFrame(scrollToPassage);
    setPendingScroll(false);
  }, [scrollToPassage]);

  // VoiceOver ignores accessibilityLiveRegion, so announce the banner there.
  useEffect(() => {
    if (sourceNotice && Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(SOURCE_NOTICE_TEXT[sourceNotice]);
    }
  }, [sourceNotice]);

  useEffect(() => () => stopPolling(), [stopPolling]);
  useEffect(() => () => {
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
  }, []);

  // The format panel closes whenever the keyboard goes away, however that
  // happens (Done, Android back, interactive dismissal, navigating off).
  const wasKeyboardShown = useRef(false);
  useEffect(() => {
    if (wasKeyboardShown.current && !keyboardShown) setFormatOpen(false);
    wasKeyboardShown.current = keyboardShown;
  }, [keyboardShown]);

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
      setJustSaved(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setJustSaved(false), SAVED_FLASH_MS);
      if (Platform.OS !== 'web') AccessibilityInfo.announceForAccessibility('Note saved');
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

  // Editing makes a just-saved note dirty again, so the "Saved" flash ends.
  const clearSaved = useCallback(() => {
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = null;
    setJustSaved(false);
  }, []);

  const applyFormat = useCallback((transform: (text: string, sel: Sel) => FormatResult) => {
    clearHighlight();
    clearSaved();
    const result = transform(contentRef.current, sel);
    setContent(result.text);
    isDirty.current = true;
    setSel(result.sel);
    setForcedSel(result.sel);
    bodyRef.current?.focus();
  }, [sel, clearHighlight, clearSaved]);

  const onFormat = useCallback(
    (f: Format) => applyFormat((t, s) => toggleFormat(t, s, f)),
    [applyFormat],
  );

  // Dictation inserts where the caret was when recording started, even if
  // the keyboard (and so the live selection) went away in between.
  const dictationSelRef = useRef<Sel>({ start: 0, end: 0 });
  // False until the body reports a selection, i.e. the user placed a caret.
  const selKnownRef = useRef(false);
  const dictation = useDictation(useCallback((text: string) => {
    clearHighlight();
    clearSaved();
    const result = insertTranscript(contentRef.current, dictationSelRef.current, text);
    setContent(result.text);
    isDirty.current = true;
    setSel(result.sel);
    setForcedSel(result.sel);
  }, [clearHighlight, clearSaved]));
  const dictating = dictation.phase !== 'idle';

  const startDictation = useCallback(() => {
    dictationSelRef.current = dictationTarget(sel, selKnownRef.current, contentRef.current.length);
    // The recorder lives in the footer, which only shows without the keyboard.
    Keyboard.dismiss();
    setFormatOpen(false);
    dictation.start();
  }, [sel, dictation]);

  // Done only hides the keyboard: saving can raise validation alerts, which
  // shouldn't fire mid-writing. Back-navigation already autosaves.
  const handleDone = useCallback(() => {
    Keyboard.dismiss();
    setFormatOpen(false);
  }, []);

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

  const active = activeFormats(content, sel);
  const web = Platform.OS === 'web';

  const controls = (
    <FormatControls active={active} open={formatOpen} onOpenChange={setFormatOpen} onFormat={onFormat} />
  );
  const doneButton = (
    <Pressable
      style={({ pressed }) => [styles.doneBtn, pressed && styles.pressed]}
      onPress={handleDone}
      accessibilityRole="button"
      accessibilityLabel="Done"
      accessibilityHint="Hides the keyboard"
    >
      <Text style={styles.doneText}>Done</Text>
    </Pressable>
  );
  const micButton = (
    <Pressable
      style={({ pressed }) => [styles.micBtn, pressed && styles.micBtnPressed]}
      onPress={startDictation}
      accessibilityRole="button"
      accessibilityLabel="Dictate"
      accessibilityHint="Records your voice and adds the text to the note"
    >
      <Mic size={20} color={colors.textPrimary} strokeWidth={1.75} />
    </Pressable>
  );
  const keyboardBar = (
    <View style={styles.keyboardBar}>
      {controls}
      <View style={styles.barEnd}>{micButton}{doneButton}</View>
    </View>
  );
  const wordCountText = <Text style={styles.wordCount}>{words} {words === 1 ? 'word' : 'words'}</Text>;

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
          <Pressable
            style={({ pressed }) => [styles.aiBtn, categorizing && styles.aiBtnDisabled, pressed && styles.pressed]}
            onPress={handleAutocategorize}
            disabled={categorizing}
            hitSlop={PILL_HITSLOP}
            accessibilityRole="button"
            accessibilityLabel="File it"
            accessibilityHint="Lumyo picks a category for this note"
            accessibilityState={{ disabled: categorizing, busy: categorizing }}
          >
            {categorizing ? (
              <ActivityIndicator size="small" color={colors.citationText} />
            ) : (
              <Folder size={14} color={colors.citationText} strokeWidth={1.75} />
            )}
            <Text style={styles.aiBtnText}>
              {categorizing ? 'Filing…' : 'File it'}
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.aiBtn, summarizing && styles.aiBtnDisabled, pressed && styles.pressed]}
            onPress={handleSummarize}
            disabled={summarizing}
            hitSlop={PILL_HITSLOP}
            accessibilityRole="button"
            accessibilityLabel="Summarize"
            accessibilityHint="Lumyo writes a short summary of this note"
            accessibilityState={{ disabled: summarizing, busy: summarizing }}
          >
            {summarizing ? (
              <ActivityIndicator size="small" color={colors.citationText} />
            ) : (
              <ScrollText size={14} color={colors.citationText} strokeWidth={1.75} />
            )}
            <Text style={styles.aiBtnText}>
              {summarizing ? 'Summarizing…' : 'Summarize'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Editor */}
      <ScrollView
        ref={scrollRef}
        onLayout={(e) => { viewportHRef.current = e.nativeEvent.layout.height; }}
        style={styles.scroll}
        contentContainerStyle={styles.editorContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <TextInput
          style={styles.titleInput}
          value={title}
          onChangeText={(t) => { setTitle(t); clearSaved(); isDirty.current = true; }}
          placeholder="Title"
          placeholderTextColor={colors.textMuted}
          multiline
          rejectResponderTermination={false}
          selectionColor={colors.accent}
          keyboardAppearance={scheme}
          accessibilityLabel="Note title"
          autoFocus={routeIsNew}
          returnKeyType="next"
          submitBehavior="submit"
          blurOnSubmit
          onSubmitEditing={() => bodyRef.current?.focus()}
        />

        {/* Meta row */}
        <View style={styles.metaRow}>
          {category && <Tag label={category.title} />}
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
                <TouchableOpacity
                  style={styles.summaryActionBtn}
                  onPress={handleResummarize}
                  hitSlop={BANNER_HITSLOP}
                  accessibilityRole="button"
                  accessibilityLabel="Summarize again"
                >
                  <RefreshCw size={13} color={colors.citationText} strokeWidth={1.75} />
                  <Text style={styles.summaryActionText}>Summarize again</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.summaryActionBtn}
                  onPress={handleDismiss}
                  hitSlop={BANNER_HITSLOP}
                  accessibilityRole="button"
                  accessibilityLabel="Hide summary"
                >
                  <X size={13} color={colors.citationText} strokeWidth={1.75} />
                  <Text style={styles.summaryActionText}>Hide</Text>
                </TouchableOpacity>
              </View>
            )}
          </FadeSlideIn>
        )}

        {/* Which passage the answer used, and whether it could be found. */}
        {sourceNotice && (
          <View accessibilityLiveRegion="polite">
            <FadeSlideIn style={styles.sourceBanner}>
              <LogoMark size={13} />
              <Text style={styles.sourceBannerText}>{SOURCE_NOTICE_TEXT[sourceNotice]}</Text>
              <TouchableOpacity
                style={styles.summaryActionBtn}
                onPress={clearHighlight}
                hitSlop={BANNER_HITSLOP}
                accessibilityRole="button"
                accessibilityLabel="Hide highlight notice"
              >
                <X size={13} color={colors.citationText} strokeWidth={1.75} />
                <Text style={styles.summaryActionText}>Hide</Text>
              </TouchableOpacity>
            </FadeSlideIn>
          </View>
        )}

        {/* Body — children (not value) so nested Text spans style the
            markdown live while the underlying string stays editable.
            react-native-web can't render children inside a textarea, so web
            falls back to a plain controlled value. */}
        <View
          style={styles.bodyWrap}
          onLayout={(e) => { bodyYRef.current = e.nativeEvent.layout.y; }}
        >
          <TextInput
            ref={bodyRef}
            style={styles.bodyInput}
            value={web ? content : undefined}
            onChangeText={(t) => {
              clearHighlight();
              clearSaved();
              isDirty.current = true;
              const adjusted = processNewline(contentRef.current, t, sel.start);
              if (adjusted) {
                setContent(adjusted.text);
                setSel(adjusted.sel);
                setForcedSel(adjusted.sel);
              } else {
                setContent(t);
              }
            }}
            selection={forcedSel}
            inputAccessoryViewID={useAccessory ? accessoryId : undefined}
            onFocus={() => setBodyFocused(true)}
            onBlur={() => setBodyFocused(false)}
            onSelectionChange={(e) => {
              selKnownRef.current = true;
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
            {!web && content.length > 0
              ? <MarkdownText text={content} highlight={highlight} highlightColor={colors.highlightBg} />
              : undefined}
          </TextInput>
          {/* Invisible copy of the text before the passage; its height says how
              far down the passage starts (TextInput has no offset-to-position API). */}
          {pendingScroll && highlight && (
            <Text
              style={[styles.bodyInput, styles.measurer]}
              onLayout={onMeasure}
              accessible={false}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              pointerEvents="none"
            >
              {web
                // Web shows raw markers, so measure the plain prefix. The
                // zero-width space keeps a trailing newline from collapsing.
                ? `${content.slice(0, highlight.start)}\u200b`
                : <MarkdownText text={content.slice(0, highlight.start)} />}
            </Text>
          )}
        </View>
      </ScrollView>

      {/* In-layout format bar (Android, or iOS with the accessory flag off):
          shown only while the keyboard is up and the body is being edited. */}
      {!useAccessory && keyboardShown && bodyFocused && keyboardBar}

      {/* Resting footer; hidden while typing so the keyboard bar is alone.
          Web has no keyboard events, so its footer carries the controls. */}
      {dictating && <DictationBar dictation={dictation} />}
      {!keyboardShown && !dictating && (
        <View style={styles.footer}>
          <View style={styles.footerStart}>
            {web && controls}
            {!(web && formatOpen) && micButton}
            {!(web && formatOpen) && wordCountText}
          </View>
          <Pressable
            style={({ pressed }) => [styles.saveBtn, saving && styles.saveBtnDisabled, pressed && styles.pressed]}
            onPress={save}
            disabled={saving}
            hitSlop={SAVE_HITSLOP}
            accessibilityRole="button"
            accessibilityLabel="Save note"
            accessibilityState={{ disabled: saving, busy: saving }}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.onAccent} />
            ) : justSaved ? (
              <>
                <Check size={16} color={colors.onAccent} strokeWidth={1.75} />
                <Text style={styles.saveBtnText}>Saved</Text>
              </>
            ) : (
              <Text style={styles.saveBtnText}>Save</Text>
            )}
          </Pressable>
        </View>
      )}

      {/* iOS: positioned natively above the keyboard, so its place in the
          tree doesn't affect layout. Attached to the body input only. */}
      {useAccessory && (
        <InputAccessoryView nativeID={accessoryId} backgroundColor={colors.bgSurface}>
          {keyboardBar}
        </InputAccessoryView>
      )}
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
  sourceBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.citationBg, borderRadius: radius.lg,
    paddingVertical: 8, paddingLeft: 12, paddingRight: 4,
  },
  sourceBannerText: {
    flex: 1, fontFamily: fonts.inter.regular, fontSize: 13, lineHeight: 18, color: colors.citationText,
  },
  bodyWrap: { position: 'relative' },
  measurer: { position: 'absolute', top: 0, left: 0, right: 0, opacity: 0, minHeight: 0 },
  bodyInput: {
    fontFamily: fonts.inter.regular, fontSize: 16,
    color: colors.textPrimary, lineHeight: 26, minHeight: 400, padding: 0,
    // The body is the page itself, so the browser's focus box around the
    // whole textarea reads as a bug; the caret shows where focus is.
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
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
  keyboardBar: {
    height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, backgroundColor: colors.bgSurface,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderStrong,
  },
  barEnd: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footerStart: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  micBtn: { width: 44, height: 44, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  micBtnPressed: { backgroundColor: colors.bgHover },
  doneBtn: { minHeight: 44, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  doneText: { fontFamily: fonts.inter.semiBold, fontSize: 15, color: colors.accentText },
  pressed: { opacity: 0.75 },
  wordCount: { fontFamily: fonts.inter.regular, fontSize: 12, color: colors.textMuted, fontVariant: ['tabular-nums'] },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.accent, borderRadius: radius.md,
    paddingHorizontal: 18, minHeight: 36, minWidth: 104, // wide enough for check + "Saved"
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontFamily: fonts.inter.semiBold, fontSize: 14, color: colors.onAccent },
});
