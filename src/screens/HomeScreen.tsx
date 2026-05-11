import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Plus, Search, ChevronRight, LogOut, Sparkles } from 'lucide-react-native';
import { colors, fonts, radius } from '../theme';
import { useAuth } from '../context/AuthContext';
import { getNotes, type Note } from '../services/notes';
import { getCategories, type Category } from '../services/categories';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<HomeStackParamList, 'HomeMain'>;

export function HomeScreen(_props: Props) {
  const navigation = useNavigation<any>();
  const { user, logout } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [n, c] = await Promise.all([getNotes(), getCategories()]);
      setNotes(n);
      setCategories(c);
    } catch {
      // silently fail on home screen
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load(true);
  };

  const recentNotes = notes.slice(0, 3);

  return (
    <View style={styles.root}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.aiAccent} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>Good morning</Text>
              <Text style={styles.name}>{user?.email.split('@')[0] ?? 'there'}</Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('Notes', { screen: 'NoteEditor', params: { isNew: true } })}>
                <Plus size={20} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
                <LogOut size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Search */}
          <View style={styles.searchBar}>
            <Search size={16} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search notes, categories..."
              placeholderTextColor={colors.textMuted}
            />
          </View>

          {/* Recent Notes */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Notes</Text>
              <View style={styles.viewAllRow}>
                <Text style={styles.viewAll}>View all</Text>
                <ChevronRight size={14} color={colors.textMuted} />
              </View>
            </View>
            {recentNotes.length === 0 ? (
              <Text style={styles.emptyText}>No notes yet. Tap + to create one.</Text>
            ) : (
              <View style={styles.notesList}>
                {recentNotes.map((note) => (
                  <TouchableOpacity key={note.id} style={styles.noteCard} onPress={() => navigation.navigate('Notes', { screen: 'NoteEditor', params: { id: String(note.id) } })}>
                    <View style={styles.noteCardTop}>
                      <Text style={styles.noteTitle}>{note.title}</Text>
                      <ChevronRight size={16} color={colors.textMuted} />
                    </View>
                    <Text style={styles.notePreview} numberOfLines={2}>{note.content}</Text>
                    <View style={styles.noteFooter}>
                      <Text style={styles.noteDate}>
                        {new Date(note.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </Text>
                      <View style={styles.tagRow}>
                        {note.categories.slice(0, 2).map((cat) => (
                          <View key={cat.id} style={styles.tag}>
                            <Text style={styles.tagText}>{cat.title}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Categories */}
          {categories.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Categories</Text>
                <View style={styles.viewAllRow}>
                  <Text style={styles.viewAll}>View all</Text>
                  <ChevronRight size={14} color={colors.textMuted} />
                </View>
              </View>
              <View style={styles.categoryGrid}>
                {categories.slice(0, 3).map((cat) => (
                  <TouchableOpacity key={cat.id} style={styles.categoryCard}>
                    <View style={styles.categoryIcon}>
                      <Sparkles size={18} color={colors.aiAccent} />
                    </View>
                    <Text style={styles.categoryLabel} numberOfLines={1}>{cat.title}</Text>
                    <Text style={styles.categoryCount}>{cat.notes_count} {cat.notes_count === 1 ? 'note' : 'notes'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 24, gap: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: 8 },
  greeting: { fontFamily: fonts.inter.regular, fontSize: 14, color: colors.textSecondary },
  name: { fontFamily: fonts.spaceGrotesk.semiBold, fontSize: 28, color: colors.textPrimary, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  fab: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
  },
  logoutBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  searchInput: { flex: 1, fontFamily: fonts.inter.regular, fontSize: 14, color: colors.textPrimary },
  section: { gap: 14 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontFamily: fonts.spaceGrotesk.semiBold, fontSize: 18, color: colors.textPrimary },
  viewAllRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewAll: { fontFamily: fonts.inter.regular, fontSize: 13, color: colors.textMuted },
  emptyText: { fontFamily: fonts.inter.regular, fontSize: 14, color: colors.textMuted },
  notesList: { gap: 10 },
  noteCard: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 16, gap: 8,
  },
  noteCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  noteTitle: { fontFamily: fonts.inter.semiBold, fontSize: 15, color: colors.textPrimary, flex: 1 },
  notePreview: { fontFamily: fonts.inter.regular, fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  noteFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  noteDate: { fontFamily: fonts.inter.regular, fontSize: 12, color: colors.textMuted },
  tagRow: { flexDirection: 'row', gap: 6 },
  tag: {
    paddingHorizontal: 8, paddingVertical: 3,
    backgroundColor: colors.bgHover, borderRadius: radius.full,
  },
  tagText: { fontFamily: fonts.inter.medium, fontSize: 11, color: colors.textSecondary },
  categoryGrid: { flexDirection: 'row', gap: 12 },
  categoryCard: {
    flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg,
    padding: 14, gap: 8, alignItems: 'flex-start',
  },
  categoryIcon: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: colors.aiAccentLight, alignItems: 'center', justifyContent: 'center',
  },
  categoryLabel: { fontFamily: fonts.inter.semiBold, fontSize: 13, color: colors.textPrimary },
  categoryCount: { fontFamily: fonts.inter.regular, fontSize: 11, color: colors.textMuted },
});
