import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, RefreshControl, Modal,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { FolderPlus, Sparkles, Inbox, X, Wand2 } from 'lucide-react-native';
import { colors, fonts, radius } from '../theme';
import { getCategories, createCategory, autocategorizeAll, type Category } from '../services/categories';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CategoriesStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<CategoriesStackParamList, 'CategoriesMain'>;

export function CategoriesScreen({ navigation }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [categorizing, setCategorizing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await getCategories();
      setCategories(data);
    } catch (e: any) {
      Alert.alert('Error', e.message);
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

  const handleCreate = async () => {
    if (!newTitle.trim()) {
      Alert.alert('Name required', 'Please enter a category name.');
      return;
    }
    try {
      setCreating(true);
      const cat = await createCategory(newTitle.trim());
      setCategories((prev) => [...prev, cat]);
      setNewTitle('');
      setShowModal(false);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setCreating(false);
    }
  };

  const hasUncategorized = categories.some((c) => c.id === 0);

  const handleCategorizeAll = async () => {
    try {
      setCategorizing(true);
      const { categorized } = await autocategorizeAll();
      Alert.alert('Done', `${categorized} ${categorized === 1 ? 'note' : 'notes'} categorized.`);
      load(true);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setCategorizing(false);
    }
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

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Categories</Text>
            <Text style={styles.subtitle}>Organize your knowledge into collections</Text>
          </View>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setShowModal(true)}>
            <FolderPlus size={18} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {hasUncategorized && (
          <TouchableOpacity
            style={[styles.categorizeAllBtn, categorizing && styles.categorizeAllBtnDisabled]}
            onPress={handleCategorizeAll}
            disabled={categorizing}
          >
            {categorizing
              ? <ActivityIndicator size={14} color={colors.aiAccent} />
              : <Wand2 size={14} color={colors.aiAccent} />
            }
            <Text style={styles.categorizeAllText}>
              {categorizing ? 'Categorizing…' : 'Categorize all uncategorized notes'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Category Grid */}
        {categories.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No categories yet.</Text>
            <TouchableOpacity onPress={() => setShowModal(true)}>
              <Text style={styles.emptyAction}>Tap + to create your first category</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.grid}>
            {categories.map((cat) => {
              const isUncategorized = cat.id === 0;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.card, isUncategorized && styles.cardUncategorized]}
                  onPress={() => navigation.navigate('CategoryDetail', { id: String(cat.id), title: cat.title })}
                >
                  <View style={[styles.cardIcon, isUncategorized && styles.cardIconUncategorized]}>
                    {isUncategorized
                      ? <Inbox size={18} color={colors.textMuted} />
                      : <Sparkles size={18} color={colors.aiAccent} />
                    }
                  </View>
                  <Text style={styles.cardLabel} numberOfLines={2}>{cat.title}</Text>
                  <Text style={styles.cardMeta}>
                    {cat.notes_count} {cat.notes_count === 1 ? 'note' : 'notes'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Create Category Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity style={styles.modalBackdrop} onPress={() => setShowModal(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Category</Text>
              <TouchableOpacity onPress={() => { setShowModal(false); setNewTitle(''); }}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="e.g. Work Projects"
              placeholderTextColor={colors.textMuted}
              value={newTitle}
              onChangeText={setNewTitle}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleCreate}
            />

            <TouchableOpacity
              style={[styles.createBtn, creating && styles.createBtnDisabled]}
              onPress={handleCreate}
              disabled={creating}
            >
              {creating
                ? <ActivityIndicator color="#FFFFFF" />
                : <Text style={styles.createBtnText}>Create Category</Text>
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgPrimary },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 24, gap: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: 8 },
  title: { fontFamily: fonts.spaceGrotesk.semiBold, fontSize: 28, color: colors.textPrimary },
  subtitle: { fontFamily: fonts.inter.regular, fontSize: 14, color: colors.textSecondary, marginTop: 4 },
  categorizeAllBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.aiAccentLight, borderRadius: radius.full,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  categorizeAllBtnDisabled: { opacity: 0.6 },
  categorizeAllText: { fontFamily: fonts.inter.medium, fontSize: 12, color: colors.aiAccent },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    width: '47.5%', borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: 16, gap: 8,
  },
  cardUncategorized: { borderStyle: 'dashed' as const },
  cardIcon: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: colors.aiAccentLight, alignItems: 'center', justifyContent: 'center',
  },
  cardIconUncategorized: { backgroundColor: colors.bgHover },
  cardLabel: { fontFamily: fonts.inter.semiBold, fontSize: 14, color: colors.textPrimary },
  cardMeta: { fontFamily: fonts.inter.regular, fontSize: 12, color: colors.textMuted },
  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyText: { fontFamily: fonts.inter.semiBold, fontSize: 16, color: colors.textPrimary },
  emptyAction: { fontFamily: fonts.inter.regular, fontSize: 14, color: colors.aiAccent },
  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  modalSheet: {
    backgroundColor: colors.bgPrimary,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40, gap: 16,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontFamily: fonts.spaceGrotesk.semiBold, fontSize: 20, color: colors.textPrimary },
  fieldLabel: { fontFamily: fonts.inter.medium, fontSize: 14, color: colors.textPrimary },
  fieldInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: 14, paddingVertical: 13,
    fontFamily: fonts.inter.regular, fontSize: 15, color: colors.textPrimary,
  },
  createBtn: {
    backgroundColor: colors.accent, borderRadius: radius.md,
    paddingVertical: 15, alignItems: 'center', marginTop: 4,
  },
  createBtnDisabled: { opacity: 0.6 },
  createBtnText: { fontFamily: fonts.inter.semiBold, fontSize: 15, color: '#FFFFFF' },
});
