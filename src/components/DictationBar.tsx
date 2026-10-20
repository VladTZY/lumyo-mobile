import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Animated, Easing } from 'react-native';
import { X, Square, RotateCcw, AlertCircle } from 'lucide-react-native';
import { fonts, radius, type Colors } from '../theme';
import { useStyles, useTheme } from '../theme/ThemeContext';
import { useReducedMotion } from './FadeSlideIn';
import { formatElapsed } from '../lib/dictation';
import type { Dictation } from './useDictation';

const BARS = [0.45, 0.8, 1, 0.7, 0.5];

// Five bars that rise with the input level; the outer bars move less so it
// reads as a voice meter rather than a single slider.
function LevelMeter({ level }: { level: number }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.meter} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {BARS.map((weight, i) => (
        <View key={i} style={[styles.meterBar, { height: 4 + Math.round(16 * level * weight) }]} />
      ))}
    </View>
  );
}

function RecordingDot() {
  const styles = useStyles(makeStyles);
  const reduced = useReducedMotion();
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 0.35, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [reduced, pulse]);

  return <Animated.View style={[styles.dot, { opacity: pulse }]} />;
}

/**
 * Replaces the editor footer while dictating: recording (cancel, timer,
 * level, stop), transcribing (progress, cancel) and error (retry, discard).
 */
export function DictationBar({ dictation }: { dictation: Dictation }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { phase } = dictation;

  if (phase === 'recording') {
    return (
      <View style={styles.bar}>
        <Pressable
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressedBg]}
          onPress={dictation.cancel}
          accessibilityRole="button"
          accessibilityLabel="Discard recording"
        >
          <X size={20} color={colors.textSecondary} strokeWidth={1.75} />
        </Pressable>
        <View
          style={styles.status}
          accessible
          accessibilityLabel={`Recording, ${formatElapsed(dictation.elapsedMs)}`}
        >
          <RecordingDot />
          <Text style={styles.timer}>{formatElapsed(dictation.elapsedMs)}</Text>
          <LevelMeter level={dictation.level} />
        </View>
        <Pressable
          style={({ pressed }) => [styles.stopBtn, pressed && styles.stopBtnPressed]}
          onPress={dictation.stop}
          accessibilityRole="button"
          accessibilityLabel="Stop and transcribe"
        >
          <Square size={14} color={colors.onAccent} fill={colors.onAccent} strokeWidth={0} />
          <Text style={styles.stopText}>Done</Text>
        </Pressable>
      </View>
    );
  }

  if (phase === 'transcribing') {
    return (
      <View style={styles.bar}>
        <View style={styles.status} accessible accessibilityLabel="Transcribing your recording" accessibilityLiveRegion="polite">
          <ActivityIndicator size="small" color={colors.accentText} />
          <Text style={styles.message}>Transcribing…</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.textBtn, pressed && styles.pressedBg]}
          onPress={dictation.cancel}
          accessibilityRole="button"
          accessibilityLabel="Cancel transcription"
        >
          <Text style={styles.textBtnLabel}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  if (phase === 'error') {
    return (
      <View style={styles.bar}>
        <View style={styles.status} accessible accessibilityLiveRegion="polite">
          <AlertCircle size={18} color={colors.danger} strokeWidth={1.75} />
          <Text style={styles.errorText} numberOfLines={2}>{dictation.error}</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.textBtn, pressed && styles.pressedBg]}
          onPress={dictation.retry}
          accessibilityRole="button"
          accessibilityLabel={dictation.canRetry ? 'Try transcribing again' : 'Try recording again'}
        >
          <RotateCcw size={15} color={colors.accentText} strokeWidth={1.75} />
          <Text style={styles.textBtnLabel}>Try again</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressedBg]}
          onPress={dictation.cancel}
          accessibilityRole="button"
          accessibilityLabel={dictation.canRetry ? 'Discard recording' : 'Dismiss'}
        >
          <X size={20} color={colors.textSecondary} strokeWidth={1.75} />
        </Pressable>
      </View>
    );
  }

  return null;
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  // Same height and chrome as the resting footer, so swapping is seamless.
  bar: {
    minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: colors.bgSurface,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderStrong,
  },
  status: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 },
  iconBtn: { width: 44, height: 44, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  pressedBg: { backgroundColor: colors.bgHover },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.recording },
  timer: {
    fontFamily: fonts.inter.semiBold, fontSize: 15, color: colors.textPrimary,
    fontVariant: ['tabular-nums'], minWidth: 40,
  },
  meter: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 20 },
  meterBar: { width: 3, borderRadius: 1.5, backgroundColor: colors.textMuted },
  stopBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44,
    paddingHorizontal: 16, borderRadius: radius.md, backgroundColor: colors.accent,
  },
  stopBtnPressed: { backgroundColor: colors.accentPressed },
  stopText: { fontFamily: fonts.inter.semiBold, fontSize: 14, color: colors.onAccent },
  message: { fontFamily: fonts.inter.medium, fontSize: 14, color: colors.textSecondary },
  errorText: { flex: 1, fontFamily: fonts.inter.regular, fontSize: 13, lineHeight: 18, color: colors.textPrimary },
  textBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44,
    paddingHorizontal: 12, borderRadius: radius.sm,
  },
  textBtnLabel: { fontFamily: fonts.inter.semiBold, fontSize: 14, color: colors.accentText },
});
