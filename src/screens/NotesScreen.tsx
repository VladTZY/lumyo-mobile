import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ScrollView, Alert, RefreshControl,
} from 'react-native';
import { Plus, ChevronRight, FileText, SearchX } from 'lucide-react-native';
import { fonts, type Colors } from '../theme';
import { useStyles, useTheme } from '../theme/ThemeContext';
import { stripMarkdown } from '../components/MarkdownText';
import { CenteredSpinner, EmptyState, IconButton, ScreenHeader, SearchField, Tag } from '../components/ui';
import { getNotes, type Note } from '../services/notes';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { NotesStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<NotesStackParamList, 'NotesMain'>;

export function NotesScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const searchRef = useRef<TextInput>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await getNotes();
      setNotes(data);
    } catch (e: any) {
      Alert.alert("Couldn't load your notes", e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Reload when returning from NoteEditor
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => load(true));
    return unsub;
  }, [navigation, load]);

  // Arriving from the search field on Home: focus search, then clear the
  // flag so later visits to this tab don't pop the keyboard.
  const focusSearch = route.params?.focusSearch;
  useEffect(() => {
    if (!focusSearch || loading) return;
    const t = setTimeout(() => searchRef.current?.focus(), 250);
    navigation.setParams({ focusSearch: undefined });
    return () => clearTimeout(t);
  }, [focusSearch, loading, navigation]);

  const onRefresh = () => {
    setRefreshing(true);
    load(true);
  };

  const q = query.trim().toLowerCase();
  const filtered = q
    ? notes.filter((n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q))
    : notes;

  if (loading) return <View style={styles.root}><CenteredSpinner /></View>;

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Notes"
        subtitle={notes.length > 0 ? `${notes.length} ${notes.length === 1 ? 'note' : 'notes'}` : undefined}
        right={
          <IconButton
            icon={Plus}
            label="New note"
            variant="accent"
            onPress={() => navigation.navigate('NoteEditor', { isNew: true })}
          />
        }
      />

      {notes.length > 0 && (
        <View style={styles.searchWrap}>
          <SearchField
            ref={searchRef}
            placeholder="Search titles and text"
            value={query}
            onChangeText={setQuery}
          />
        </View>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textMuted} colors={[colors.accent]} />
        }
      >
        {filtered.length === 0 ? (
          q ? (
            <EmptyState
              icon={SearchX}
              title="Nothing matches"
              body={`No note mentions “${query.trim()}”. Try a shorter word, or ask your notes in Chat.`}
            />
          ) : (
            <EmptyState
              icon={FileText}
              title="No notes yet"
              body="Write your first note. Lumyo summarizes it and files it into a category for you."
              action={{ title: 'New note', icon: Plus, onPress: () => navigation.navigate('NoteEditor', { isNew: true }) }}
            />
          )
        ) : (
          filtered.map((note, i) => (
            <Pressable
              key={note.id}
              style={({ pressed }) => [styles.noteItem, pressed && styles.pressed]}
              onPress={() => navigation.navigate('NoteEditor', { id: String(note.id) })}
              accessibilityRole="button"
              accessibilityLabel={`Open note ${note.title}`}
            >
              <View style={[styles.noteInner, i === filtered.length - 1 && styles.noteInnerLast]}>
                <View style={styles.noteContent}>
                  <Text style={styles.noteTitle} numberOfLines={1}>{note.title}</Text>
                  <Text style={styles.notePreview} numberOfLines={2}>{stripMarkdown(note.content)}</Text>
                  <View style={styles.noteMeta}>
                    <Text style={styles.noteDate}>
                      {new Date(note.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </Text>
                    {note.categories.slice(0, 2).map((cat) => <Tag key={cat.id} label={cat.title} />)}
                  </View>
                </View>
                <ChevronRight size={16} color={colors.textMuted} />
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgPrimary },
  searchWrap: { paddingHorizontal: 20, paddingBottom: 8 },
  scroll: { flex: 1 },
  list: { paddingBottom: 24, flexGrow: 1 },
  pressed: { backgroundColor: colors.bgHover },
  noteItem: { paddingHorizontal: 20 },
  noteInner: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderStrong,
  },
  noteInnerLast: { borderBottomWidth: 0 },
  noteContent: { flex: 1, gap: 4 },
  noteTitle: { fontFamily: fonts.inter.semiBold, fontSize: 16, color: colors.textPrimary },
  notePreview: { fontFamily: fonts.inter.regular, fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  noteMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  noteDate: { fontFamily: fonts.inter.regular, fontSize: 12, color: colors.textMuted },
});
