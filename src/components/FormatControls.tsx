import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { ALargeSmall, Bold, Italic, Underline, List } from 'lucide-react-native';
import { radius, type Colors } from '../theme';
import { useStyles, useTheme } from '../theme/ThemeContext';
import type { ActiveFormats, Format } from '../lib/noteFormatting';

type Props = {
  active: ActiveFormats;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFormat: (format: Format) => void;
};

const TOGGLES = [
  { format: 'bold', Icon: Bold, label: 'Bold' },
  { format: 'italic', Icon: Italic, label: 'Italic' },
  { format: 'underline', Icon: Underline, label: 'Underline' },
  { format: 'bullet', Icon: List, label: 'Bulleted list' },
] as const;

// Toggles are 44 wide and 42 tall inside the group's 1px border, so 1px of
// vertical slop reaches 44 without leaving the group's bounds (Android drops
// touches outside the parent) or overlapping a neighbour horizontally.
const TOGGLE_HITSLOP = { top: 1, bottom: 1 };

// The "Aa" disclosure and, when open, the format toggles. Bar chrome
// (background, border, height) belongs to the screen.
export function FormatControls({ active, open, onOpenChange, onFormat }: Props) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);

  return (
    <View style={styles.row}>
      <Pressable
        style={({ pressed }) => [styles.aa, (open || pressed) && styles.aaOpen]}
        onPress={() => onOpenChange(!open)}
        accessibilityRole="button"
        accessibilityLabel="Text formatting"
        accessibilityState={{ expanded: open }}
      >
        <ALargeSmall size={20} color={colors.textPrimary} strokeWidth={1.75} />
      </Pressable>
      {open && (
        <View style={styles.group}>
          {TOGGLES.map(({ format, Icon, label }) => {
            const on = active[format];
            return (
              <Pressable
                key={format}
                style={styles.toggle}
                onPress={() => onFormat(format)}
                hitSlop={TOGGLE_HITSLOP}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ selected: on }}
              >
                {({ pressed }) => (
                  <View style={[styles.toggleFill, pressed && styles.toggleFillPressed, on && styles.toggleFillActive]}>
                    <Icon size={18} color={on ? colors.onInk : colors.textSecondary} strokeWidth={1.75} />
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  aa: {
    width: 44, height: 44, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  aaOpen: { backgroundColor: colors.bgHover },
  group: {
    flexDirection: 'row', marginLeft: 8,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
  },
  toggle: { width: 44, height: 42, alignItems: 'center', justifyContent: 'center' },
  toggleFill: {
    width: 36, height: 32, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  toggleFillPressed: { backgroundColor: colors.bgHover },
  toggleFillActive: { backgroundColor: colors.ink },
});
