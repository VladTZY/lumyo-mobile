import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView,
  ActivityIndicator, Alert, RefreshControl, Modal,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { FolderPlus, Folder, Inbox, X, FolderInput } from 'lucide-react-native';
import { fonts, radius, type Colors } from '../theme';
import { useStyles, useTheme } from '../theme/ThemeContext';
import { Button, CenteredSpinner, EmptyState, IconButton, ScreenHeader, TextField } from '../components/ui';
import { getCategories, createCategory, autocategorizeAll, type Category } from '../services/categories';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CategoriesStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<CategoriesStackParamList, 'CategoriesMain'>;

export function CategoriesScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
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
      Alert.alert("Couldn't load categories", e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => navigation.addListener('focus', () => load(true)), [navigation, load]);

  const onRefresh = () => {
    setRefreshing(true);
    load(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setNewTitle('');
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) {
      Alert.alert('Name needed', 'Give the category a name.');
      return;
    }
    try {
      setCreating(true);
      const cat = await createCategory(newTitle.trim());
      setCategories((prev) => [...prev, cat]);
      closeModal();
    } catch (e: any) {
      Alert.alert("Couldn't create the category", e.message);
    } finally {
      setCreating(false);
    }
  };

  const uncategorized = categories.find((c) => c.id === 0);

  const handleCategorizeAll = async () => {
    try {
      setCategorizing(true);
      const { categorized } = await autocategorizeAll();
      Alert.alert('Notes filed', `${categorized} ${categorized === 1 ? 'note was' : 'notes were'} sorted into categories.`);
      load(true);
    } catch (e: any) {
      Alert.alert("Couldn't sort your notes", e.message);
    } finally {
      setCategorizing(false);
    }
  };

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
        <ScreenHeader
          title="Categories"
          subtitle="Lumyo files each note as you write. Add your own categories too."
          right={<IconButton icon={FolderPlus} label="New category" variant="outline" onPress={() => setShowModal(true)} />}
        />

        <View style={styles.body}>
          {uncategorized && uncategorized.notes_count > 0 && (
            <Pressable
              style={({ pressed }) => [styles.banner, pressed && styles.bannerPressed, categorizing && styles.busy]}
              onPress={handleCategorizeAll}
              disabled={categorizing}
              accessibilityRole="button"
              accessibilityState={{ busy: categorizing }}
            >
              {categorizing
                ? <ActivityIndicator size="small" color={colors.citationText} />
                : <FolderInput size={18} color={colors.citationText} strokeWidth={1.75} />}
              <View style={styles.bannerText}>
                <Text style={styles.bannerTitle}>
                  {categorizing
                    ? 'Sorting your notes…'
                    : `File ${uncategorized.notes_count} uncategorized ${uncategorized.notes_count === 1 ? 'note' : 'notes'}`}
                </Text>
                {!categorizing && (
                  <Text style={styles.bannerBody}>Lumyo reads each one and picks the best category.</Text>
                )}
              </View>
            </Pressable>
          )}

          {categories.length === 0 ? (
            <EmptyState
              icon={Folder}
              title="No categories yet"
              body="Write a note and Lumyo files it for you, or make a category yourself."
              action={{ title: 'New category', icon: FolderPlus, onPress: () => setShowModal(true) }}
            />
          ) : (
            <View style={styles.grid}>
              {categories.map((cat) => {
                const isUncategorized = cat.id === 0;
                return (
                  <Pressable
                    key={cat.id}
                    style={({ pressed }) => [
                      styles.card,
                      isUncategorized && styles.cardUncategorized,
                      pressed && styles.cardPressed,
                    ]}
                    onPress={() => navigation.navigate('CategoryDetail', { id: String(cat.id), title: cat.title })}
                    accessibilityRole="button"
                    accessibilityLabel={`${cat.title}, ${cat.notes_count} ${cat.notes_count === 1 ? 'note' : 'notes'}`}
                  >
                    <View style={[styles.cardIcon, isUncategorized && styles.cardIconMuted]}>
                      {isUncategorized
                        ? <Inbox size={18} color={colors.textMuted} strokeWidth={1.75} />
                        : <Folder size={18} color={colors.citationText} strokeWidth={1.75} />}
                    </View>
                    <Text style={styles.cardLabel} numberOfLines={2}>{cat.title}</Text>
                    <Text style={styles.cardMeta}>
                      {cat.notes_count} {cat.notes_count === 1 ? 'note' : 'notes'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      <Modal visible={showModal} transparent animationType="fade" onRequestClose={closeModal}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.modalBackdrop} onPress={closeModal} accessibilityLabel="Close" />
          <View style={styles.sheet}>
            <View style={styles.grabber} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>New category</Text>
              <IconButton icon={X} label="Close" onPress={closeModal} size={36} />
            </View>

            <TextField
              label="Name"
              icon={Folder}
              placeholder="e.g. Thesis research"
              value={newTitle}
              onChangeText={setNewTitle}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleCreate}
            />

            <Button title="Create category" onPress={handleCreate} loading={creating} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgPrimary },
  scroll: { flex: 1 },
  content: { paddingBottom: 32 },
  body: { paddingHorizontal: 20, gap: 16, paddingTop: 4 },

  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.citationBg, borderRadius: radius.lg,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  bannerPressed: { opacity: 0.8 },
  busy: { opacity: 0.7 },
  bannerText: { flex: 1, gap: 2 },
  bannerTitle: { fontFamily: fonts.inter.semiBold, fontSize: 14, color: colors.citationText },
  bannerBody: { fontFamily: fonts.inter.regular, fontSize: 13, lineHeight: 18, color: colors.citationText, opacity: 0.85 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    flexBasis: '47%', flexGrow: 1, minHeight: 128,
    backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: 16, gap: 6,
  },
  cardUncategorized: { borderStyle: 'dashed', backgroundColor: colors.bgPrimary, borderColor: colors.borderStrong },
  cardPressed: { backgroundColor: colors.bgHover },
  cardIcon: {
    width: 36, height: 36, borderRadius: radius.md, marginBottom: 'auto',
    backgroundColor: colors.citationBg, alignItems: 'center', justifyContent: 'center',
  },
  cardIconMuted: { backgroundColor: colors.bgHover },
  cardLabel: { fontFamily: fonts.inter.semiBold, fontSize: 15, lineHeight: 20, color: colors.textPrimary, marginTop: 14 },
  cardMeta: { fontFamily: fonts.inter.regular, fontSize: 12, color: colors.textMuted },

  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.backdrop },
  sheet: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    borderWidth: 1, borderBottomWidth: 0, borderColor: colors.border,
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 36, gap: 18,
  },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheetTitle: { fontFamily: fonts.spaceGrotesk.semiBold, fontSize: 21, color: colors.textPrimary },
});
