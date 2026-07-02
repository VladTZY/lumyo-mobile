import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { ChevronLeft, MoreHorizontal, Sparkles, ChevronRight, FileText } from 'lucide-react-native';
import { colors, fonts, radius } from '../theme';
import { stripMarkdown } from '../components/MarkdownText';
import { FadeSlideIn } from '../components/FadeSlideIn';
import { getCategory, type CategoryWithNotes } from '../services/categories';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CategoriesStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<CategoriesStackParamList, 'CategoryDetail'>;

export function CategoryDetailScreen({ route, navigation }: Props) {
  const { id, title } = route.params;
  const [category, setCategory] = useState<CategoryWithNotes | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await getCategory(Number(id));
      setCategory(data);
    } catch (e: any) {
      Alert.alert('Error', e.message);
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

  if (loading) {
    return (
      <View style={styles.root}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.aiAccent} />
        </View>
      </View>
    );
  }

  const notes = category?.notes ?? [];

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ChevronLeft size={20} color={colors.textPrimary} />
            <Text style={styles.backText}>Categories</Text>
          </TouchableOpacity>
          <MoreHorizontal size={18} color={colors.textPrimary} />
        </View>

        {/* Title */}
        <View style={styles.titleRow}>
          <View style={styles.titleIcon}>
            <Sparkles size={22} color={colors.aiAccent} />
          </View>
          <Text style={styles.title}>{title}</Text>
        </View>
        <Text style={styles.meta}>{notes.length} note{notes.length !== 1 ? 's' : ''}</Text>

        {/* Notes */}
        {notes.length === 0 ? (
          <FadeSlideIn style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <FileText size={24} color={colors.textSecondary} />
            </View>
            <Text style={styles.emptyTitle}>No notes in this category</Text>
            <Text style={styles.emptySubtitle}>Notes you add to “{title}” will show up here</Text>
          </FadeSlideIn>
        ) : (
          notes.map((note) => (
            <TouchableOpacity
              key={note.id}
              style={styles.item}
              onPress={() => (navigation as any).navigate('Notes', {
                screen: 'NoteEditor',
                params: { id: String(note.id) },
                initial: false,
              })}
            >
              <View style={styles.itemContent}>
                <Text style={styles.itemTitle}>{note.title}</Text>
                <Text style={styles.itemPreview} numberOfLines={2}>{stripMarkdown(note.content)}</Text>
                <Text style={styles.itemDate}>
                  {new Date(note.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Text>
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
  scroll: { flex: 1 },
  content: { paddingBottom: 24, gap: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 8,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { fontFamily: fonts.inter.medium, fontSize: 14, color: colors.textPrimary },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20 },
  titleIcon: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: colors.aiAccentLight, alignItems: 'center', justifyContent: 'center',
  },
  title: { fontFamily: fonts.spaceGrotesk.semiBold, fontSize: 24, color: colors.textPrimary, flex: 1 },
  meta: { fontFamily: fonts.inter.regular, fontSize: 12, color: colors.textMuted, paddingHorizontal: 20 },
  item: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 20, gap: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 14,
  },
  itemContent: { flex: 1, gap: 4 },
  itemTitle: { fontFamily: fonts.inter.semiBold, fontSize: 14, color: colors.textPrimary },
  itemPreview: { fontFamily: fonts.inter.regular, fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  itemDate: { fontFamily: fonts.inter.regular, fontSize: 12, color: colors.textMuted, marginTop: 2 },
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
});
