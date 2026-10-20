import React, { useEffect, useRef, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Animated, Platform } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Home, Folder, FileText, MessageCircle } from 'lucide-react-native';
import type { Colors } from '../theme';
import { useStyles, useTheme } from '../theme/ThemeContext';
import { useReducedMotion } from '../components/FadeSlideIn';
import { useKeyboardShown } from '../components/useKeyboardShown';

// root: the first screen of each tab's stack, used when re-tapping a tab.
const TABS = [
  { key: 'Home', root: 'HomeMain', Icon: Home },
  { key: 'Categories', root: 'CategoriesMain', Icon: Folder },
  { key: 'Notes', root: 'NotesMain', Icon: FileText },
  { key: 'Chat', root: 'ChatList', Icon: MessageCircle },
];

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const reduced = useReducedMotion();
  const [tabWidth, setTabWidth] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const positioned = useRef(false);
  const keyboardShown = useKeyboardShown();

  useEffect(() => {
    if (tabWidth <= 0) return;
    const target = state.index * tabWidth;
    // Jump on first layout (and when reduce-motion is on); spring afterwards.
    if (!positioned.current || reduced) {
      translateX.setValue(target);
      positioned.current = true;
      return;
    }
    Animated.spring(translateX, {
      toValue: target,
      useNativeDriver: true,
      friction: 22,
      tension: 220,
    }).start();
  }, [state.index, tabWidth, reduced, translateX]);

  // Android resizes the window for the keyboard, which would stack this bar
  // on top of the editor's format bar. iOS's keyboard covers it already.
  // After every hook so the hook order stays stable.
  if (Platform.OS === 'android' && keyboardShown) return null;

  return (
    <View style={styles.wrapper}>
      <View
        style={styles.pill}
        onLayout={(e) => setTabWidth((e.nativeEvent.layout.width - 8) / TABS.length)}
      >
        {tabWidth > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[styles.indicator, { width: tabWidth, transform: [{ translateX }] }]}
          />
        )}
        {TABS.map((tab, index) => {
          const isFocused = state.index === index;
          // Icons cross-fade in step with the sliding pill so the active
          // (on-ink) icon never sits on the page background mid-flight.
          const activeOpacity = tabWidth > 0
            ? translateX.interpolate({
                inputRange: [(index - 1) * tabWidth, index * tabWidth, (index + 1) * tabWidth],
                outputRange: [0, 1, 0],
                extrapolate: 'clamp',
              })
            : (isFocused ? 1 : 0);
          const inactiveOpacity = tabWidth > 0
            ? translateX.interpolate({
                inputRange: [(index - 1) * tabWidth, index * tabWidth, (index + 1) * tabWidth],
                outputRange: [1, 0, 1],
                extrapolate: 'clamp',
              })
            : (isFocused ? 0 : 1);
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tab}
              onPress={() => {
                // Re-tapping the active tab returns to the root of its stack.
                if (isFocused) navigation.navigate(tab.key, { screen: tab.root });
                else navigation.navigate(tab.key);
              }}
              activeOpacity={0.8}
              accessibilityRole="tab"
              accessibilityLabel={tab.key}
              accessibilityState={{ selected: isFocused }}
            >
              <Animated.View style={{ opacity: inactiveOpacity }}>
                <tab.Icon size={20} color={colors.textMuted} strokeWidth={1.75} />
              </Animated.View>
              <Animated.View style={[StyleSheet.absoluteFill, styles.iconOverlay, { opacity: activeOpacity }]}>
                <tab.Icon size={20} color={colors.onInk} strokeWidth={2} />
              </Animated.View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  wrapper: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    backgroundColor: colors.bgPrimary,
  },
  pill: {
    flexDirection: 'row',
    backgroundColor: colors.bgSurface,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    height: 56,
  },
  indicator: {
    position: 'absolute',
    left: 4,
    top: 4,
    bottom: 4,
    borderRadius: 22,
    backgroundColor: colors.ink,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  iconOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
