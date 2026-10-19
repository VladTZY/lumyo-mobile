import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView, Alert, RefreshControl,
} from 'react-native';
import { Folder, Inbox, ChevronRight, FileText } from 'lucide-react-native';
import { fonts, radius, type Colors } from '../theme';
import { useStyles, useTheme } from '../theme/ThemeContext';
import { stripMarkdown } from '../components/MarkdownText';
import { BackButton, CenteredSpinner, EmptyState } from '../components/ui';
import { getCategory, type CategoryWithNotes } from '../services/categories';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CategoriesStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<CategoriesStackParamList, 'CategoryDetail'>;

export function CategoryDetailScreen({ route, navigation }: Props) {
  const { id, title } = route.params;
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const [category, setCategory] = useState<CategoryWithNotes | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const isUncategorized = id === '0';

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await getCategory(Number(id));
      setCategory(data);
    } catch (e: any) {
      Alert.alert("Couldn't load this category", e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load(true);
  };

  const notes = category?.notes ?? [];

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <BackButton label="Categories" onPress={() => navigation.goBack()} />
      </View>

      {loading ? <CenteredSpinner /> : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textMuted} colors={[colors.accent]} />
          }
        >
          <View style={styles.titleBlock}>
            <View style={[styles.titleIcon, isUncategorized && styles.titleIconMuted]}>
              {isUncategorized
                ? <Inbox size={22} color={colors.textMuted} strokeWidth={1.75} />
                : <Folder size={22} color={colors.citationText} strokeWidth={1.75} />}
            </View>
            <Text style={styles.title} accessibilityRole="header">{title}</Text>
            <Text style={styles.meta}>{notes.length} {notes.length === 1 ? 'note' : 'notes'}</Text>
          </View>

          {notes.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Nothing here yet"
              body={`Notes that Lumyo files under “${title}” will show up here.`}
            />
          ) : (
            <View style={styles.list}>
              {notes.map((note, i) => (
                <Pressable
                  key={note.id}
                  style={({ pressed }) => [styles.item, i > 0 && styles.itemDivider, pressed && styles.itemPressed]}
                  onPress={() => (navigation as any).navigate('Notes', {
                    screen: 'NoteEditor',
                    params: { id: String(note.id) },
                    initial: false,
                  })}
                  accessibilityRole="button"
                  accessibilityLabel={`Open note ${note.title}`}
                >
                  <View style={styles.itemContent}>
                    <Text style={styles.itemTitle} numberOfLines={1}>{note.title}</Text>
                    <Text style={styles.itemPreview} numberOfLines={2}>{stripMarkdown(note.content)}</Text>
                    <Text style={styles.itemDate}>
                      {new Date(note.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </Text>
                  </View>
                  <ChevronRight size={16} color={colors.textMuted} />
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgPrimary },
  topBar: { paddingHorizontal: 20, paddingTop: 4 },
  scroll: { flex: 1 },
  content: { paddingBottom: 32, gap: 20 },
  titleBlock: { paddingHorizontal: 20, paddingTop: 8, gap: 6 },
  titleIcon: {
    width: 44, height: 44, borderRadius: radius.md, marginBottom: 8,
    backgroundColor: colors.citationBg, alignItems: 'center', justifyContent: 'center',
  },
  titleIconMuted: { backgroundColor: colors.bgHover },
  title: {
    fontFamily: fonts.spaceGrotesk.semiBold, fontSize: 28, lineHeight: 34,
    letterSpacing: -0.56, color: colors.textPrimary,
  },
  meta: { fontFamily: fonts.inter.regular, fontSize: 14, color: colors.textMuted },
  list: {
    marginHorizontal: 20, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.bgSurface,
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  itemDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  itemPressed: { backgroundColor: colors.bgHover },
  itemContent: { flex: 1, gap: 4 },
  itemTitle: { fontFamily: fonts.inter.semiBold, fontSize: 15, color: colors.textPrimary },
  itemPreview: { fontFamily: fonts.inter.regular, fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  itemDate: { fontFamily: fonts.inter.regular, fontSize: 12, color: colors.textMuted, marginTop: 2 },
});
