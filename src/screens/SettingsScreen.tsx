import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Alert } from 'react-native';
import { Smartphone, Sun, Moon, LogOut, type LucideIcon } from 'lucide-react-native';
import { fonts, radius, type Colors } from '../theme';
import { useStyles, useTheme, type AppearancePreference } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { LogoMark } from '../components/Logo';
import { BackButton } from '../components/ui';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<HomeStackParamList, 'Settings'>;

const APPEARANCE_OPTIONS: { value: AppearancePreference; label: string; icon: LucideIcon }[] = [
  { value: 'system', label: 'System', icon: Smartphone },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
];

export function SettingsScreen({ navigation }: Props) {
  const { user, logout } = useAuth();
  const { colors, preference, setPreference, scheme } = useTheme();
  const styles = useStyles(makeStyles);

  const confirmSignOut = () => {
    Alert.alert('Sign out of Lumyo?', 'Your notes stay saved to your account.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => { logout().catch(() => {}); } },
    ]);
  };

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <BackButton label="Home" onPress={() => navigation.goBack()} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title} accessibilityRole="header">Settings</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          <View style={styles.segmented} accessibilityRole="radiogroup" accessibilityLabel="Appearance">
            {APPEARANCE_OPTIONS.map(({ value, label, icon: Icon }) => {
              const selected = preference === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setPreference(value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={label}
                  style={({ pressed }) => [
                    styles.segment,
                    selected && styles.segmentOn,
                    pressed && !selected && styles.segmentPressed,
                  ]}
                >
                  <Icon size={18} color={selected ? colors.textPrimary : colors.textMuted} strokeWidth={1.75} />
                  <Text style={[styles.segmentText, selected && styles.segmentTextOn]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.hint}>
            {preference === 'system'
              ? `Matches your device, which is set to ${scheme} right now.`
              : `Lumyo stays ${preference} whatever your device uses.`}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Email</Text>
              <Text style={styles.rowValue} numberOfLines={1}>{user?.email}</Text>
            </View>
            <View style={styles.divider} />
            <Pressable
              onPress={confirmSignOut}
              accessibilityRole="button"
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <LogOut size={18} color={colors.danger} strokeWidth={1.75} />
              <Text style={styles.signOut}>Sign out</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.about}>
          <LogoMark size={28} />
          <Text style={styles.aboutText}>Lumyo answers from the notes you choose, and shows where each answer came from.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgPrimary },
  topBar: { paddingHorizontal: 20, paddingTop: 4 },
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 28 },
  title: {
    fontFamily: fonts.spaceGrotesk.semiBold, fontSize: 30, lineHeight: 36,
    letterSpacing: -0.6, color: colors.textPrimary, marginTop: 4,
  },
  section: { gap: 10 },
  sectionTitle: { fontFamily: fonts.inter.semiBold, fontSize: 14, color: colors.textSecondary },

  segmented: {
    flexDirection: 'row', padding: 4, gap: 4,
    backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg,
  },
  segment: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: radius.sm, minHeight: 64,
  },
  segmentOn: {
    backgroundColor: colors.bgPrimary, borderWidth: 1, borderColor: colors.borderStrong,
  },
  segmentPressed: { backgroundColor: colors.bgHover },
  segmentText: { fontFamily: fonts.inter.medium, fontSize: 13, color: colors.textMuted },
  segmentTextOn: { color: colors.textPrimary, fontFamily: fonts.inter.semiBold },
  hint: { fontFamily: fonts.inter.regular, fontSize: 13, lineHeight: 19, color: colors.textMuted },

  card: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, minHeight: 52,
  },
  rowPressed: { backgroundColor: colors.bgHover },
  rowLabel: { fontFamily: fonts.inter.medium, fontSize: 15, color: colors.textPrimary },
  rowValue: { flex: 1, textAlign: 'right', fontFamily: fonts.inter.regular, fontSize: 15, color: colors.textMuted },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: 16 },
  signOut: { fontFamily: fonts.inter.medium, fontSize: 15, color: colors.danger },

  about: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingTop: 8 },
  aboutText: { flex: 1, fontFamily: fonts.inter.regular, fontSize: 13, lineHeight: 19, color: colors.textMuted },
});
