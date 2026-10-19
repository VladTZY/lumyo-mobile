import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView, RefreshControl,
} from 'react-native';
import { Plus, Search, ChevronRight, FileText, Folder, ArrowUpRight } from 'lucide-react-native';
import { fonts, radius, type Colors } from '../theme';
import { useStyles, useTheme } from '../theme/ThemeContext';
import { stripMarkdown } from '../components/MarkdownText';
import { Logo, LogoMark } from '../components/Logo';
import { CenteredSpinner, EmptyState, IconButton, Tag } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { getNotes, type Note } from '../services/notes';
import { getCategories, type Category } from '../services/categories';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<HomeStackParamList, 'HomeMain'>;

function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return 'Up late';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function HomeScreen({ navigation: stack }: Props) {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
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
      // Home is a summary view; the Notes and Categories tabs surface errors.
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Runs on first focus too, so this is the only load trigger. Later visits
  // refresh silently to pick up notes written in other tabs.
  const loadedOnce = React.useRef(false);
  useEffect(() => stack.addListener('focus', () => {
    load(loadedOnce.current);
    loadedOnce.current = true;
  }), [stack, load]);

  const onRefresh = () => {
    setRefreshing(true);
    load(true);
  };

  const newNote = () =>
    navigation.navigate('Notes', { screen: 'NoteEditor', params: { isNew: true }, initial: false });
  const openNote = (id: number) =>
    navigation.navigate('Notes', { screen: 'NoteEditor', params: { id: String(id) }, initial: false });

  const name = user?.email.split('@')[0] ?? '';
  const initial = (name[0] ?? '?').toUpperCase();
  const recentNotes = notes.slice(0, 3);
  const namedCategories = categories.filter((c) => c.id !== 0);

  if (loading) return <View style={styles.root}><CenteredSpinner /></View>;

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textMuted} colors={[colors.accent]} />
        }
      >
        <View style={styles.topBar}>
          <Logo height={30} style={styles.logo} />
          <View style={styles.topActions}>
            <IconButton icon={Plus} label="New note" variant="accent" onPress={newNote} />
            <Pressable
              onPress={() => stack.navigate('Settings')}
              accessibilityRole="button"
              accessibilityLabel="Settings and account"
              style={({ pressed }) => [styles.avatar, pressed && styles.avatarPressed]}
            >
              <Text style={styles.avatarText}>{initial}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.hello}>
          <Text style={styles.greeting}>{greeting()},</Text>
          <Text style={styles.name} numberOfLines={1}>{name || 'there'}</Text>
        </View>

        <Pressable
          onPress={() => navigation.navigate('Notes', { screen: 'NotesMain', params: { focusSearch: true } })}
          accessibilityRole="search"
          accessibilityLabel="Search notes"
          style={({ pressed }) => [styles.search, pressed && styles.pressedBg]}
        >
          <Search size={16} color={colors.textMuted} strokeWidth={1.75} />
          <Text style={styles.searchText}>Search your notes</Text>
        </Pressable>

        <Pressable
          onPress={() => navigation.navigate('Chat', { screen: 'ChatMain', params: {}, initial: false })}
          accessibilityRole="button"
          accessibilityLabel="Ask your notes"
          style={({ pressed }) => [styles.ask, pressed && styles.pressedBg]}
        >
          <View style={styles.askMark}>
            <LogoMark size={22} />
          </View>
          <View style={styles.askText}>
            <Text style={styles.askTitle}>Ask your notes</Text>
            <Text style={styles.askBody}>Choose which notes to read. Every answer points to its source.</Text>
          </View>
          <ArrowUpRight size={18} color={colors.textMuted} strokeWidth={1.75} />
        </Pressable>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent notes</Text>
            {notes.length > 0 && (
              <Pressable
                style={styles.viewAll}
                hitSlop={10}
                onPress={() => navigation.navigate('Notes', { screen: 'NotesMain' })}
                accessibilityRole="link"
              >
                <Text style={styles.viewAllText}>All {notes.length}</Text>
                <ChevronRight size={14} color={colors.textMuted} />
              </Pressable>
            )}
          </View>

          {recentNotes.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No notes yet"
              body="Write your first note. Lumyo summarizes it and files it into a category for you."
              action={{ title: 'New note', icon: Plus, onPress: newNote }}
            />
          ) : (
            <View style={styles.notesList}>
              {recentNotes.map((note) => (
                <Pressable
                  key={note.id}
                  style={({ pressed }) => [styles.noteCard, pressed && styles.pressedBg]}
                  onPress={() => openNote(note.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open note ${note.title}`}
                >
                  <Text style={styles.noteTitle} numberOfLines={1}>{note.title}</Text>
                  <Text style={styles.notePreview} numberOfLines={2}>{stripMarkdown(note.content)}</Text>
                  <View style={styles.noteFooter}>
                    <Text style={styles.noteDate}>{shortDate(note.updated_at)}</Text>
                    {note.categories.slice(0, 2).map((cat) => <Tag key={cat.id} label={cat.title} />)}
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {namedCategories.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Categories</Text>
              <Pressable
                style={styles.viewAll}
                hitSlop={10}
                onPress={() => navigation.navigate('Categories', { screen: 'CategoriesMain' })}
                accessibilityRole="link"
              >
                <Text style={styles.viewAllText}>All {namedCategories.length}</Text>
                <ChevronRight size={14} color={colors.textMuted} />
              </Pressable>
            </View>
            <View style={styles.categoryGrid}>
              {namedCategories.slice(0, 4).map((cat) => (
                <Pressable
                  key={cat.id}
                  style={({ pressed }) => [styles.categoryCard, pressed && styles.pressedBg]}
                  onPress={() => navigation.navigate('Categories', {
                    screen: 'CategoryDetail',
                    params: { id: String(cat.id), title: cat.title },
                    initial: false,
                  })}
                  accessibilityRole="button"
                  accessibilityLabel={`${cat.title}, ${cat.notes_count} ${cat.notes_count === 1 ? 'note' : 'notes'}`}
                >
                  <Folder size={18} color={colors.accentText} strokeWidth={1.75} />
                  <View style={styles.categoryText}>
                    <Text style={styles.categoryLabel} numberOfLines={1}>{cat.title}</Text>
                    <Text style={styles.categoryCount}>
                      {cat.notes_count} {cat.notes_count === 1 ? 'note' : 'notes'}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgPrimary },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 32, gap: 20 },
  pressedBg: { backgroundColor: colors.bgHover },

  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 },
  logo: { marginLeft: -4 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarPressed: { backgroundColor: colors.bgHover },
  avatarText: { fontFamily: fonts.spaceGrotesk.semiBold, fontSize: 16, color: colors.textPrimary },

  hello: { paddingTop: 8 },
  greeting: { fontFamily: fonts.inter.regular, fontSize: 15, color: colors.textMuted },
  name: {
    fontFamily: fonts.spaceGrotesk.semiBold, fontSize: 30, lineHeight: 38,
    letterSpacing: -0.6, color: colors.textPrimary,
  },

  search: {
    flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44,
    backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: 14,
  },
  searchText: { fontFamily: fonts.inter.regular, fontSize: 15, color: colors.textMuted },

  ask: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg,
    paddingVertical: 16, paddingHorizontal: 16,
  },
  askMark: {
    width: 44, height: 44, borderRadius: radius.md,
    backgroundColor: colors.citationBg, alignItems: 'center', justifyContent: 'center',
  },
  askText: { flex: 1, gap: 3 },
  askTitle: { fontFamily: fonts.spaceGrotesk.semiBold, fontSize: 17, color: colors.textPrimary },
  askBody: { fontFamily: fonts.inter.regular, fontSize: 13, lineHeight: 19, color: colors.textMuted },

  section: { gap: 12, marginTop: 8 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  sectionTitle: { fontFamily: fonts.spaceGrotesk.semiBold, fontSize: 19, color: colors.textPrimary },
  viewAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewAllText: { fontFamily: fonts.inter.medium, fontSize: 13, color: colors.textMuted },

  notesList: { gap: 10 },
  noteCard: {
    backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: 16, gap: 6,
  },
  noteTitle: { fontFamily: fonts.inter.semiBold, fontSize: 16, color: colors.textPrimary },
  notePreview: { fontFamily: fonts.inter.regular, fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  noteFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  noteDate: { fontFamily: fonts.inter.regular, fontSize: 12, color: colors.textMuted, marginRight: 'auto' },

  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  categoryCard: {
    flexBasis: '48%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg,
    paddingVertical: 14, paddingHorizontal: 14,
  },
  categoryText: { flex: 1, gap: 2 },
  categoryLabel: { fontFamily: fonts.inter.semiBold, fontSize: 14, color: colors.textPrimary },
  categoryCount: { fontFamily: fonts.inter.regular, fontSize: 12, color: colors.textMuted },
});
