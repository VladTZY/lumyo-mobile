import React, { forwardRef, useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator,
  type StyleProp, type ViewStyle, type TextInputProps,
} from 'react-native';
import { ChevronLeft, Search, type LucideIcon } from 'lucide-react-native';
import { fonts, radius, type Colors } from '../theme';
import { useStyles, useTheme } from '../theme/ThemeContext';
import { FadeSlideIn } from './FadeSlideIn';

// Shared building blocks so every screen draws headers, buttons, fields and
// empty states the same way. Sizes follow DESIGN.md: 44px minimum targets,
// radius 10 for controls and 12 for cards, borders before shadows.

const HIT_SLOP = { top: 4, bottom: 4, left: 4, right: 4 };

export function ScreenHeader({
  title, subtitle, right,
}: { title: string; subtitle?: string; right?: React.ReactNode }) {
  const s = useStyles(makeStyles);
  return (
    <View style={s.header}>
      <View style={s.headerText}>
        <Text style={s.headerTitle} accessibilityRole="header">{title}</Text>
        {subtitle ? <Text style={s.headerSubtitle}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={s.headerRight}>{right}</View> : null}
    </View>
  );
}

/** Back link for stacked screens: chevron plus the name of where it goes. */
export function BackButton({ label, onPress }: { label?: string; onPress: () => void }) {
  const s = useStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel={label ? `Back to ${label}` : 'Back'}
      style={({ pressed }) => [s.back, pressed && s.pressedFade]}
    >
      <ChevronLeft size={22} color={colors.textPrimary} strokeWidth={1.75} />
      {label ? <Text style={s.backText}>{label}</Text> : null}
    </Pressable>
  );
}

type IconButtonVariant = 'accent' | 'outline' | 'ghost';

export function IconButton({
  icon: Icon, label, onPress, variant = 'ghost', size = 40, disabled,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  variant?: IconButtonVariant;
  size?: number;
  disabled?: boolean;
}) {
  const s = useStyles(makeStyles);
  const { colors } = useTheme();
  const iconColor = variant === 'accent' ? colors.onAccent : colors.textPrimary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={size < 44 ? HIT_SLOP : undefined}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        s.iconBtn,
        { width: size, height: size, borderRadius: size / 2 },
        variant === 'accent' && s.iconBtnAccent,
        variant === 'outline' && s.iconBtnOutline,
        pressed && (variant === 'accent' ? s.iconBtnAccentPressed : s.iconBtnPressed),
        pressed && s.pressedScale,
        disabled && s.disabled,
      ]}
    >
      <Icon size={variant === 'accent' ? 20 : 19} color={iconColor} strokeWidth={variant === 'accent' ? 2 : 1.75} />
    </Pressable>
  );
}

export function Button({
  title, onPress, loading, disabled, variant = 'primary', icon: Icon, style, size = 'large',
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
  icon?: LucideIcon;
  style?: StyleProp<ViewStyle>;
  size?: 'large' | 'small';
}) {
  const s = useStyles(makeStyles);
  const { colors } = useTheme();
  const primary = variant === 'primary';
  const fg = primary ? colors.onAccent : colors.textPrimary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      style={({ pressed }) => [
        s.btn,
        size === 'small' && s.btnSmall,
        primary ? s.btnPrimary : s.btnSecondary,
        pressed && (primary ? s.btnPrimaryPressed : s.iconBtnPressed),
        pressed && s.pressedScale,
        (disabled || loading) && s.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {Icon ? <Icon size={size === 'small' ? 15 : 17} color={fg} strokeWidth={2} /> : null}
          <Text style={[s.btnText, size === 'small' && s.btnTextSmall, { color: fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

/** Labelled input with a leading icon; the border turns violet on focus. */
export const TextField = forwardRef<TextInput, TextInputProps & {
  label: string;
  icon?: LucideIcon;
  labelRight?: React.ReactNode;
  trailing?: React.ReactNode;
}>(function TextField({ label, icon: Icon, labelRight, trailing, onFocus, onBlur, ...props }, ref) {
  const s = useStyles(makeStyles);
  const { colors, scheme } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={s.field}>
      <View style={s.fieldLabelRow}>
        <Text style={s.fieldLabel}>{label}</Text>
        {labelRight}
      </View>
      <View style={[s.fieldBox, focused && s.fieldBoxFocused]}>
        {Icon ? <Icon size={17} color={focused ? colors.accentText : colors.textMuted} strokeWidth={1.75} /> : null}
        <TextInput
          ref={ref}
          style={s.fieldInput}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.accent}
          keyboardAppearance={scheme}
          accessibilityLabel={label}
          onFocus={(e) => { setFocused(true); onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); onBlur?.(e); }}
          {...props}
        />
        {trailing}
      </View>
    </View>
  );
});

export const SearchField = forwardRef<TextInput, TextInputProps>(function SearchField(props, ref) {
  const s = useStyles(makeStyles);
  const { colors, scheme } = useTheme();
  return (
    <View style={s.search}>
      <Search size={16} color={colors.textMuted} strokeWidth={1.75} />
      <TextInput
        ref={ref}
        style={s.searchInput}
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.accent}
        keyboardAppearance={scheme}
        returnKeyType="search"
        clearButtonMode="while-editing"
        autoCorrect={false}
        {...props}
      />
    </View>
  );
});

export function EmptyState({
  icon: Icon, title, body, action,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: { title: string; icon?: LucideIcon; onPress: () => void };
}) {
  const s = useStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <FadeSlideIn style={s.empty}>
      <View style={s.emptyIcon}>
        <Icon size={22} color={colors.textSecondary} strokeWidth={1.75} />
      </View>
      <Text style={s.emptyTitle}>{title}</Text>
      <Text style={s.emptyBody}>{body}</Text>
      {action ? (
        <Button title={action.title} icon={action.icon} onPress={action.onPress} size="small" style={s.emptyAction} />
      ) : null}
    </FadeSlideIn>
  );
}

/** Small neutral label for a note's category. */
export function Tag({ label }: { label: string }) {
  const s = useStyles(makeStyles);
  return (
    <View style={s.tag}>
      <Text style={s.tagText} numberOfLines={1}>{label}</Text>
    </View>
  );
}

/**
 * The signature element: a numbered marker plus the note's title. Tapping it
 * opens the note the answer came from.
 */
export function CitationChip({
  index, title, onPress,
}: { index: number; title: string; onPress?: () => void }) {
  const s = useStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      hitSlop={8}
      accessibilityRole={onPress ? 'link' : 'text'}
      accessibilityLabel={`Source ${index}: ${title}`}
      style={({ pressed }) => [s.chip, pressed && s.pressedFade]}
    >
      <Text style={s.chipIndex}>{index}</Text>
      <Text style={s.chipText} numberOfLines={1}>{title}</Text>
    </Pressable>
  );
}

export function CenteredSpinner() {
  const s = useStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <View style={s.center}>
      <ActivityIndicator color={colors.accentText} />
    </View>
  );
}

/** Pressed-state background for list rows. */
export function rowPressed(colors: Colors, pressed: boolean) {
  return pressed ? { backgroundColor: colors.bgHover } : null;
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, gap: 12,
  },
  headerText: { flex: 1, gap: 4 },
  headerTitle: {
    fontFamily: fonts.spaceGrotesk.semiBold, fontSize: 30, lineHeight: 36,
    letterSpacing: -0.6, color: colors.textPrimary,
  },
  headerSubtitle: { fontFamily: fonts.inter.regular, fontSize: 14, lineHeight: 20, color: colors.textMuted },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 2 },

  back: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 44, paddingRight: 8, marginLeft: -6 },
  backText: { fontFamily: fonts.inter.medium, fontSize: 15, color: colors.textPrimary },

  iconBtn: { alignItems: 'center', justifyContent: 'center' },
  iconBtnAccent: { backgroundColor: colors.accent },
  iconBtnAccentPressed: { backgroundColor: colors.accentPressed },
  iconBtnOutline: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgPrimary },
  iconBtnPressed: { backgroundColor: colors.bgHover },
  pressedScale: { transform: [{ scale: 0.97 }] },
  pressedFade: { opacity: 0.6 },
  disabled: { opacity: 0.45 },

  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    minHeight: 50, borderRadius: radius.md, paddingHorizontal: 20,
  },
  btnSmall: { minHeight: 40, paddingHorizontal: 16 },
  btnPrimary: { backgroundColor: colors.accent },
  btnPrimaryPressed: { backgroundColor: colors.accentPressed },
  btnSecondary: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgPrimary },
  btnText: { fontFamily: fonts.inter.semiBold, fontSize: 15 },
  btnTextSmall: { fontSize: 14 },

  field: { gap: 8 },
  fieldLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fieldLabel: { fontFamily: fonts.inter.medium, fontSize: 14, color: colors.textPrimary },
  fieldBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50,
    backgroundColor: colors.bgPrimary, borderWidth: 1, borderColor: colors.borderStrong,
    borderRadius: radius.md, paddingHorizontal: 14,
  },
  // 2px ring per DESIGN.md, drawn as a thicker border with padding trimmed
  // by 1px so the text doesn't shift on focus.
  fieldBoxFocused: { borderWidth: 2, borderColor: colors.accent, paddingHorizontal: 13 },
  fieldInput: {
    flex: 1, fontFamily: fonts.inter.regular, fontSize: 16, color: colors.textPrimary, paddingVertical: 12,
  },

  search: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: 14, minHeight: 44,
  },
  searchInput: {
    flex: 1, fontFamily: fonts.inter.regular, fontSize: 15, color: colors.textPrimary, paddingVertical: 10,
  },

  empty: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 32, gap: 6 },
  emptyIcon: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  emptyTitle: { fontFamily: fonts.spaceGrotesk.semiBold, fontSize: 18, color: colors.textPrimary, textAlign: 'center' },
  emptyBody: {
    fontFamily: fonts.inter.regular, fontSize: 14, lineHeight: 21, color: colors.textMuted,
    textAlign: 'center', maxWidth: 300,
  },
  emptyAction: { marginTop: 14 },

  tag: {
    paddingHorizontal: 8, paddingVertical: 3, maxWidth: 160,
    backgroundColor: colors.bgHover, borderRadius: radius.full,
  },
  tagText: { fontFamily: fonts.inter.medium, fontSize: 12, color: colors.textSecondary },

  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%',
    backgroundColor: colors.citationBg, borderRadius: radius.full,
    paddingLeft: 4, paddingRight: 10, paddingVertical: 4,
  },
  chipIndex: {
    minWidth: 18, height: 18, borderRadius: 9, overflow: 'hidden',
    backgroundColor: colors.bgPrimary, color: colors.citationText,
    fontFamily: fonts.inter.semiBold, fontSize: 11, lineHeight: 18, textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  chipText: { flexShrink: 1, fontFamily: fonts.inter.medium, fontSize: 12, color: colors.citationText },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
