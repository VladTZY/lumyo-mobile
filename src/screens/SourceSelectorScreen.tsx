import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator,
} from 'react-native';
import { X, FileText, CheckCircle2, Circle, Folder, ChevronDown, ChevronRight } from 'lucide-react-native';
import { colors, fonts, radius } from '../theme';
import { getNotes, type Note } from '../services/notes';
import { updateChat } from '../services/chat';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ChatStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<ChatStackParamList, 'SourceSelector'>;

interface CategoryGroup {
  id: number | null;
  title: string;
  notes: Note[];
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function SourceSelectorScreen({ route, navigation }: Props) {
  const { chatId, selectedIds: initialIds } = route.params;
  const [notes, setNotes] = useState<Note[]>([]);
  const [selected, setSelected] = useState<number[]>(initialIds || []);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  useEffect(() => {
    getNotes()
      .then(setNotes)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const groups = useMemo<CategoryGroup[]>(() => {
    const catMap = new Map<string, CategoryGroup>();
    const uncategorized: Note[] = [];

    notes.forEach((note) => {
      if (!note.categories || note.categories.length === 0) {
        uncategorized.push(note);
      } else {
        note.categories.forEach((cat) => {
          const key = String(cat.id);
          if (!catMap.has(key)) {
            catMap.set(key, { id: cat.id, title: cat.title, notes: [] });
          }
          catMap.get(key)!.notes.push(note);
        });
      }
    });

    const sortNotes = (arr: Note[]) =>
      arr.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    const result: CategoryGroup[] = Array.from(catMap.values())
      .sort((a, b) => a.title.localeCompare(b.title));
    result.forEach((g) => sortNotes(g.notes));

    if (uncategorized.length > 0) {
      result.push({ id: null, title: 'Uncategorized', notes: sortNotes(uncategorized) });
    }

    return result;
  }, [notes]);

  const toggleNote = (id: number) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const toggleCategory = (group: CategoryGroup) => {
    const noteIds = group.notes.map((n) => n.id);
    const allSelected = noteIds.every((id) => selected.includes(id));

    setSelected((prev) => {
      if (allSelected) {
        return prev.filter((id) => !noteIds.includes(id));
      } else {
        const newSet = new Set([...prev, ...noteIds]);
        return Array.from(newSet);
      }
    });
  };

  const toggleCollapse = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleConfirm = useCallback(async () => {
    if (chatId) {
      try { await updateChat(chatId, selected); } catch {}
    }
    navigation.navigate('ChatMain', { chatId, sourceNoteIds: selected });
  }, [chatId, selected, navigation]);

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

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Sources</Text>
          <Text style={styles.subtitle}>Select documents to chat with</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <X size={22} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {groups.map((group) => {
          const key = group.id != null ? String(group.id) : 'uncategorized';
          const isCollapsed = collapsed.has(key);
          const noteIds = group.notes.map((n) => n.id);
          const selectedInGroup = noteIds.filter((id) => selected.includes(id)).length;
          const allSelected = selectedInGroup === noteIds.length;

          return (
            <View key={key} style={styles.groupContainer}>
              {/* Category header */}
              <View style={styles.categoryRow}>
                <TouchableOpacity
                  style={styles.categoryLeft}
                  onPress={() => toggleCollapse(key)}
                >
                  {isCollapsed
                    ? <ChevronRight size={16} color={colors.textSecondary} />
                    : <ChevronDown size={16} color={colors.textSecondary} />
                  }
                  <Folder size={16} color={colors.textSecondary} />
                  <Text style={styles.categoryTitle}>{group.title}</Text>
                  <Text style={styles.categoryCount}>
                    {selectedInGroup}/{noteIds.length}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.selectAllBtn, allSelected && styles.selectAllBtnActive]}
                  onPress={() => toggleCategory(group)}
                >
                  {allSelected
                    ? <CheckCircle2 size={18} color={colors.aiAccent} />
                    : <Circle size={18} color={colors.border} />
                  }
                </TouchableOpacity>
              </View>

              {/* Notes in group */}
              {!isCollapsed && group.notes.map((note) => {
                const isSelected = selected.includes(note.id);
                return (
                  <TouchableOpacity
                    key={note.id}
                    style={[styles.sourceItem, isSelected && styles.sourceItemSelected]}
                    onPress={() => toggleNote(note.id)}
                  >
                    <View style={styles.sourceLeft}>
                      <FileText size={16} color={isSelected ? colors.aiAccent : colors.textMuted} />
                      <View style={styles.sourceInfo}>
                        <Text style={styles.sourceTitle}>{note.title}</Text>
                        <Text style={styles.sourceDate}>{formatDate(note.updated_at)}</Text>
                      </View>
                    </View>
                    {isSelected
                      ? <CheckCircle2 size={18} color={colors.aiAccent} />
                      : <Circle size={18} color={colors.border} />
                    }
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })}
      </ScrollView>

      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        <Text style={styles.selectedCount}>
          {selected.length} source{selected.length !== 1 ? 's' : ''} selected
        </Text>
        <TouchableOpacity
          style={[styles.confirmBtn, selected.length === 0 && styles.confirmBtnDisabled]}
          onPress={handleConfirm}
          disabled={selected.length === 0}
        >
          <Text style={styles.confirmBtnText}>Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerLeft: { gap: 2 },
  title: { fontFamily: fonts.spaceGrotesk.semiBold, fontSize: 20, color: colors.textPrimary },
  subtitle: { fontFamily: fonts.inter.regular, fontSize: 13, color: colors.textSecondary },
  scroll: { flex: 1 },
  content: { paddingVertical: 8 },

  groupContainer: { marginBottom: 4 },
  categoryRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
    backgroundColor: colors.bgSurface,
  },
  categoryLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  categoryTitle: { fontFamily: fonts.inter.semiBold, fontSize: 14, color: colors.textPrimary },
  categoryCount: { fontFamily: fonts.inter.regular, fontSize: 12, color: colors.textMuted },
  selectAllBtn: { padding: 4 },
  selectAllBtnActive: {},

  sourceItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, paddingHorizontal: 20, paddingLeft: 52,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  sourceItemSelected: { backgroundColor: colors.aiAccentLight },
  sourceLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  sourceInfo: { gap: 2, flex: 1 },
  sourceTitle: { fontFamily: fonts.inter.medium, fontSize: 14, color: colors.textPrimary },
  sourceDate: { fontFamily: fonts.inter.regular, fontSize: 12, color: colors.textMuted },

  bottomBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    // Sits above the always-visible tab bar now, so no extra bottom inset.
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10,
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bgPrimary,
  },
  selectedCount: { fontFamily: fonts.inter.medium, fontSize: 14, color: colors.textSecondary },
  confirmBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.accent, borderRadius: radius.full,
    paddingHorizontal: 20, paddingVertical: 12,
  },
  confirmBtnDisabled: { opacity: 0.4 },
  confirmBtnText: { fontFamily: fonts.inter.semiBold, fontSize: 14, color: '#FFFFFF' },
});
