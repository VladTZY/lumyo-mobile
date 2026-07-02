import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { Plus, Search, ChevronRight, FileText } from 'lucide-react-native';
import { colors, fonts, radius } from '../theme';
import { stripMarkdown } from '../components/MarkdownText';
import { FadeSlideIn } from '../components/FadeSlideIn';
import { getNotes, type Note } from '../services/notes';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { NotesStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<NotesStackParamList, 'NotesMain'>;

export function NotesScreen({ navigation }: Props) {
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
      Alert.alert('Error', e.message);
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

  const onRefresh = () => {
    setRefreshing(true);
    load(true);
  };

  const filtered = query.trim()
    ? notes.filter((n) =>
        n.title.toLowerCase().includes(query.toLowerCase()) ||
        n.content.toLowerCase().includes(query.toLowerCase())
      )
    : notes;

  if (loading) {
    return (
      <View style={styles.root}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.aiAccent} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Notes</Text>
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate('NoteEditor', { isNew: true })}
          accessibilityRole="button"
          accessibilityLabel="New note"
        >
          <Plus size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchBar}>
        <Search size={16} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search notes..."
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {filtered.length === 0 ? (
          query ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No notes match your search.</Text>
            </View>
          ) : (
            <FadeSlideIn style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <FileText size={24} color={colors.textSecondary} />
              </View>
              <Text style={styles.emptyTitle}>No notes yet</Text>
              <Text style={styles.emptySubtitle}>Capture your first thought and let AI organize it</Text>
              <TouchableOpacity
                style={styles.emptyCta}
                onPress={() => navigation.navigate('NoteEditor', { isNew: true })}
              >
                <Plus size={16} color="#FFFFFF" />
                <Text style={styles.emptyCtaText}>New Note</Text>
              </TouchableOpacity>
            </FadeSlideIn>
          )
        ) : (
          filtered.map((note) => (
            <TouchableOpacity
              key={note.id}
              style={styles.noteItem}
              onPress={() => navigation.navigate('NoteEditor', { id: String(note.id) })}
            >
              <View style={styles.noteContent}>
                <Text style={styles.noteTitle}>{note.title}</Text>
                <Text style={styles.notePreview} numberOfLines={2}>{stripMarkdown(note.content)}</Text>
                <View style={styles.noteMeta}>
                  <Text style={styles.noteDate}>
                    {new Date(note.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </Text>
                  {note.categories.slice(0, 2).map((cat) => (
                    <View key={cat.id} style={styles.tag}>
                      <Text style={styles.tagText}>{cat.title}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <ChevronRight size={16} color={colors.textMuted} />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4,
  },
  title: { fontFamily: fonts.spaceGrotesk.semiBold, fontSize: 28, color: colors.textPrimary },
  fab: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.bgSurface, marginHorizontal: 20,
    borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontFamily: fonts.inter.regular, fontSize: 14, color: colors.textPrimary },
  scroll: { flex: 1, marginTop: 8 },
  noteItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14, gap: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  noteContent: { flex: 1, gap: 4 },
  noteTitle: { fontFamily: fonts.inter.semiBold, fontSize: 15, color: colors.textPrimary },
  notePreview: { fontFamily: fonts.inter.regular, fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  noteMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2, flexWrap: 'wrap' },
  noteDate: { fontFamily: fonts.inter.regular, fontSize: 12, color: colors.textMuted },
  tag: {
    paddingHorizontal: 8, paddingVertical: 2,
    backgroundColor: colors.bgHover, borderRadius: radius.full,
  },
  tagText: { fontFamily: fonts.inter.medium, fontSize: 11, color: colors.textSecondary },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontFamily: fonts.inter.regular, fontSize: 14, color: colors.textMuted },
  emptyState: { alignItems: 'center', gap: 8, paddingTop: 60, paddingHorizontal: 40 },
  emptyIconWrap: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: colors.bgSurface,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  emptyTitle: { fontFamily: fonts.spaceGrotesk.semiBold, fontSize: 16, color: colors.textPrimary },
  emptySubtitle: {
    fontFamily: fonts.inter.regular, fontSize: 13, color: colors.textSecondary,
    textAlign: 'center', lineHeight: 19,
  },
  emptyCta: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8,
    backgroundColor: colors.accent, borderRadius: radius.full,
    paddingHorizontal: 18, paddingVertical: 10,
  },
  emptyCtaText: { fontFamily: fonts.inter.semiBold, fontSize: 13, color: '#FFFFFF' },
});
