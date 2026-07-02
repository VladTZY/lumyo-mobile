import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Home, Folder, FileText, MessageCircle } from 'lucide-react-native';
import { colors } from '../theme';

const TABS = [
  { key: 'Home', Icon: Home },
  { key: 'Categories', Icon: Folder },
  { key: 'Notes', Icon: FileText },
  { key: 'Chat', Icon: MessageCircle },
];

// Focused-content screens where the tab bar would stack under the screen's
// own footer (editor toolbar, chat input) — hide it there.
const HIDDEN_ON = ['NoteEditor', 'ChatMain', 'SourceSelector'];

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const focusedTab = state.routes[state.index];
  const nestedState = focusedTab.state;
  const nestedRoute = nestedState?.routes?.[nestedState.index ?? 0];
  if (nestedRoute && HIDDEN_ON.includes(nestedRoute.name)) return null;

  return (
    <View style={styles.wrapper}>
      <View style={styles.pill}>
        {TABS.map((tab, index) => {
          const isFocused = state.index === index;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, isFocused && styles.tabActive]}
              onPress={() => navigation.navigate(tab.key)}
              activeOpacity={0.8}
            >
              <tab.Icon
                size={18}
                color={isFocused ? '#FFFFFF' : colors.textMuted}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 21,
    paddingTop: 12,
    paddingBottom: 21,
    backgroundColor: colors.bgPrimary,
  },
  pill: {
    flexDirection: 'row',
    backgroundColor: colors.bgPrimary,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    height: 56,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  tabActive: {
    backgroundColor: colors.accent,
  },
});
