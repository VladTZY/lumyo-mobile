import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView,
} from 'react-native';
import { X, Check, Folder, ChevronDown, ChevronRight, FileText } from 'lucide-react-native';
import { fonts, type Colors } from '../theme';
import { useStyles, useTheme } from '../theme/ThemeContext';
import { Button, CenteredSpinner, EmptyState, IconButton } from '../components/ui';
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

function Checkbox({ checked, partial }: { checked: boolean; partial?: boolean }) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <View style={[styles.check, (checked || partial) && styles.checkOn]}>
      {checked
        ? <Check size={13} color={colors.onAccent} strokeWidth={3} />
        : partial ? <View style={styles.checkPartial} /> : null}
    </View>
  );
}

export function SourceSelectorScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
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

  if (loading) return <View style={styles.root}><CenteredSpinner /></View>;

  const allIds = notes.map((n) => n.id);
  const everythingSelected = allIds.length > 0 && allIds.every((id) => selected.includes(id));

  return (
    <View style={styles.root}>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title} accessibilityRole="header">Choose notes</Text>
          <Text style={styles.subtitle}>Lumyo answers only from the notes you tick here.</Text>
        </View>
        <IconButton icon={X} label="Close" onPress={() => navigation.goBack()} />
      </View>

      {notes.length > 0 && (
        <Pressable
          style={({ pressed }) => [styles.selectAll, pressed && styles.pressed]}
          onPress={() => setSelected(everythingSelected ? [] : allIds)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: everythingSelected }}
        >
          <Text style={styles.selectAllText}>{everythingSelected ? 'Clear all' : `Select all ${allIds.length} notes`}</Text>
          <Checkbox checked={everythingSelected} partial={selected.length > 0 && !everythingSelected} />
        </Pressable>
      )}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {groups.length === 0 && (
          <EmptyState
            icon={FileText}
            title="No notes to choose from"
            body="Write a note first. Then come back and ask it questions."
          />
        )}
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
                <Pressable
                  style={styles.categoryLeft}
                  onPress={() => toggleCollapse(key)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: !isCollapsed }}
                  accessibilityLabel={`${group.title}, ${selectedInGroup} of ${noteIds.length} selected`}
                >
                  {isCollapsed
                    ? <ChevronRight size={16} color={colors.textMuted} />
                    : <ChevronDown size={16} color={colors.textMuted} />
                  }
                  <Folder size={16} color={colors.textSecondary} strokeWidth={1.75} />
                  <Text style={styles.categoryTitle} numberOfLines={1}>{group.title}</Text>
                  <Text style={styles.categoryCount}>
                    {selectedInGroup}/{noteIds.length}
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.selectAllBtn}
                  onPress={() => toggleCategory(group)}
                  hitSlop={8}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: allSelected }}
                  accessibilityLabel={`Select every note in ${group.title}`}
                >
                  <Checkbox checked={allSelected} partial={selectedInGroup > 0 && !allSelected} />
                </Pressable>
              </View>

              {/* Notes in group */}
              {!isCollapsed && group.notes.map((note) => {
                const isSelected = selected.includes(note.id);
                return (
                  <Pressable
                    key={note.id}
                    style={({ pressed }) => [styles.sourceItem, isSelected && styles.sourceItemSelected, pressed && styles.pressed]}
                    onPress={() => toggleNote(note.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected }}
                    accessibilityLabel={note.title}
                  >
                    <View style={styles.sourceInfo}>
                      <Text style={styles.sourceTitle} numberOfLines={1}>{note.title}</Text>
                      <Text style={styles.sourceDate}>{formatDate(note.updated_at)}</Text>
                    </View>
                    <Checkbox checked={isSelected} />
                  </Pressable>
                );
              })}
            </View>
          );
        })}
      </ScrollView>

      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        <Text style={styles.selectedCount}>
          {selected.length === 0
            ? 'No notes chosen'
            : `${selected.length} ${selected.length === 1 ? 'note' : 'notes'} chosen`}
        </Text>
        <Button
          title={chatId ? 'Save' : 'Start chat'}
          size="small"
          onPress={handleConfirm}
          disabled={selected.length === 0}
        />
      </View>
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgPrimary },
  pressed: { backgroundColor: colors.bgHover },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingLeft: 20, paddingRight: 12, paddingTop: 12, paddingBottom: 12, gap: 8,
  },
  headerLeft: { flex: 1, gap: 4 },
  title: {
    fontFamily: fonts.spaceGrotesk.semiBold, fontSize: 26, letterSpacing: -0.5, color: colors.textPrimary,
  },
  subtitle: { fontFamily: fonts.inter.regular, fontSize: 14, lineHeight: 20, color: colors.textMuted },

  selectAll: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, minHeight: 48,
    borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  selectAllText: { fontFamily: fonts.inter.semiBold, fontSize: 14, color: colors.accentText },

  scroll: { flex: 1 },
  content: { paddingBottom: 16 },

  groupContainer: {},
  categoryRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, minHeight: 48,
    backgroundColor: colors.bgSurface,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  categoryLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minHeight: 48 },
  categoryTitle: { fontFamily: fonts.inter.semiBold, fontSize: 14, color: colors.textPrimary, flexShrink: 1 },
  categoryCount: { fontFamily: fonts.inter.regular, fontSize: 12, color: colors.textMuted, fontVariant: ['tabular-nums'] },
  selectAllBtn: { paddingLeft: 12, paddingVertical: 12 },

  check: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 1.5, borderColor: colors.borderStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkPartial: { width: 10, height: 2, borderRadius: 1, backgroundColor: colors.onAccent },

  sourceItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    paddingVertical: 12, paddingRight: 20, paddingLeft: 48, minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  sourceItemSelected: { backgroundColor: colors.citationBg },
  sourceInfo: { gap: 2, flex: 1 },
  sourceTitle: { fontFamily: fonts.inter.medium, fontSize: 15, color: colors.textPrimary },
  sourceDate: { fontFamily: fonts.inter.regular, fontSize: 12, color: colors.textMuted },

  bottomBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    // Sits above the always-visible tab bar now, so no extra bottom inset.
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderStrong, backgroundColor: colors.bgPrimary,
  },
  selectedCount: { fontFamily: fonts.inter.medium, fontSize: 14, color: colors.textSecondary },
});
