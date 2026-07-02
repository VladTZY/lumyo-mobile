import React, { useEffect, useRef, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Home, Folder, FileText, MessageCircle } from 'lucide-react-native';
import { colors } from '../theme';
import { useReducedMotion } from '../components/FadeSlideIn';

const TABS = [
  { key: 'Home', Icon: Home },
  { key: 'Categories', Icon: Folder },
  { key: 'Notes', Icon: FileText },
  { key: 'Chat', Icon: MessageCircle },
];

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const reduced = useReducedMotion();
  const [tabWidth, setTabWidth] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const positioned = useRef(false);

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
          // (white) icon never sits on the white background mid-flight.
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
              onPress={() => navigation.navigate(tab.key)}
              activeOpacity={0.8}
              accessibilityRole="tab"
              accessibilityLabel={tab.key}
              accessibilityState={{ selected: isFocused }}
            >
              <Animated.View style={{ opacity: inactiveOpacity }}>
                <tab.Icon size={18} color={colors.textMuted} />
              </Animated.View>
              <Animated.View style={[StyleSheet.absoluteFill, styles.iconOverlay, { opacity: activeOpacity }]}>
                <tab.Icon size={18} color="#FFFFFF" />
              </Animated.View>
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
  indicator: {
    position: 'absolute',
    left: 4,
    top: 4,
    bottom: 4,
    borderRadius: 22,
    backgroundColor: colors.accent,
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
