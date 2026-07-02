import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, Easing, AccessibilityInfo,
  type StyleProp, type ViewStyle,
} from 'react-native';

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => { if (mounted) setReduced(v); })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { mounted = false; sub?.remove(); };
  }, []);
  return reduced;
}

interface Props {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  delay?: number;
}

/**
 * Gentle enter animation for content appearing in place (empty states,
 * AI cards): fade in with a small upward settle. Skipped entirely when the
 * system reduce-motion setting is on.
 */
export function FadeSlideIn({ children, style, delay = 0 }: Props) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduced) {
      progress.setValue(1);
      return;
    }
    Animated.timing(progress, {
      toValue: 1,
      duration: 240,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [reduced, delay, progress]);

  return (
    <Animated.View
      style={[style, {
        opacity: progress,
        transform: [{
          translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }),
        }],
      }]}
    >
      {children}
    </Animated.View>
  );
}
