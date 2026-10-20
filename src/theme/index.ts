// Brand tokens from brand-identity/DESIGN.md. Plain constants only: no React
// or React Native imports, so tests can load this module directly in Node.
// Components read the active palette through useTheme() in ./ThemeContext.

export type ColorScheme = 'light' | 'dark';

export interface Colors {
  /** Page background (paper). */
  bgPrimary: string;
  /** Cards, search fields, toolbars (mist). */
  bgSurface: string;
  /** Pressed rows, neutral tags, disabled fills. */
  bgHover: string;
  /** Sheets and popovers that sit above the page. */
  bgElevated: string;
  border: string;
  /** Stronger border for focused inputs and unselected checkmarks. */
  borderStrong: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  /** Violet fill for primary actions. */
  accent: string;
  accentPressed: string;
  /** Text and icons placed on an accent fill. */
  onAccent: string;
  /** Violet for text, links and icons on the page background. */
  accentText: string;
  /** Citation chips and selected rows (haze). */
  citationBg: string;
  citationText: string;
  /** Background for the cited passage highlighted in a note (textPrimary stays >= 4.5:1). */
  highlightBg: string;
  /** The logo's spark; decorative only. */
  spark: string;
  /** Neutral high-contrast fill: tab indicator, user chat bubble. */
  ink: string;
  onInk: string;
  danger: string;
  dangerBg: string;
  backdrop: string;
}

export const lightColors: Colors = {
  bgPrimary: '#FFFFFF',
  bgSurface: '#FAFAFA',
  bgHover: '#F2F2F2',
  bgElevated: '#FFFFFF',
  border: '#E8E8E8',
  borderStrong: '#D4D4D4',
  textPrimary: '#0D0D0D',
  textSecondary: '#4D4D4D',
  // Graphite, 5.3:1 on white.
  textMuted: '#6B6B6B',
  accent: '#7C3AED',
  accentPressed: '#6D28D9',
  onAccent: '#FFFFFF',
  // Violet-deep: 7.1:1 on white, 6.0:1 on haze, so it passes AA at 12px.
  accentText: '#6D28D9',
  citationBg: '#EEE9FD',
  citationText: '#6D28D9',
  highlightBg: '#DDD0FC',
  spark: '#BCA3FE',
  ink: '#0D0D0D',
  onInk: '#FFFFFF',
  danger: '#C2410C',
  dangerBg: '#FFF4ED',
  backdrop: 'rgba(13, 13, 13, 0.32)',
};

export const darkColors: Colors = {
  bgPrimary: '#0A0A0A',
  bgSurface: '#141414',
  bgHover: '#1F1F1F',
  bgElevated: '#181818',
  border: '#262626',
  borderStrong: '#3A3A3A',
  textPrimary: '#F2F2F2',
  textSecondary: '#C7C7C7',
  // 7.8:1 on #0A0A0A.
  textMuted: '#A3A3A3',
  // The light-mode violet keeps white button labels at 5.7:1; the lighter
  // #A78BFA from DESIGN.md is used for violet text instead.
  accent: '#7C3AED',
  accentPressed: '#8B5CF6',
  onAccent: '#FFFFFF',
  accentText: '#A78BFA',
  citationBg: '#221A38',
  citationText: '#C4B5FD',
  highlightBg: '#3B2A6B',
  spark: '#BCA3FE',
  ink: '#F2F2F2',
  onInk: '#0A0A0A',
  danger: '#FB923C',
  dangerBg: '#2A1608',
  backdrop: 'rgba(0, 0, 0, 0.6)',
};

export const palettes: Record<ColorScheme, Colors> = {
  light: lightColors,
  dark: darkColors,
};

export const fonts = {
  spaceGrotesk: {
    regular: 'SpaceGrotesk_400Regular',
    medium: 'SpaceGrotesk_500Medium',
    semiBold: 'SpaceGrotesk_600SemiBold',
    bold: 'SpaceGrotesk_700Bold',
  },
  inter: {
    regular: 'Inter_400Regular',
    // Real italic faces — iOS does not synthesize italics for custom fonts,
    // so fontStyle: 'italic' alone renders upright with Inter.
    italic: 'Inter_400Regular_Italic',
    medium: 'Inter_500Medium',
    semiBold: 'Inter_600SemiBold',
    semiBoldItalic: 'Inter_600SemiBold_Italic',
    bold: 'Inter_700Bold',
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

// Buttons and inputs 10, cards 12, sheets 20; pills stay fully round.
export const radius = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 20,
  full: 100,
};
