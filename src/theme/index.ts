export const colors = {
  accent: '#0D0D0D',
  accentLight: '#F0F0F0',
  aiAccent: '#7C5CFC',
  // Darker variant for small text on light backgrounds — #7C5CFC only hits
  // 3.9:1 on aiAccentLight, below the 4.5:1 WCAG AA floor for body sizes.
  aiAccentText: '#6B48F0',
  aiAccentLight: '#F3F0FF',
  bgHover: '#F5F5F5',
  bgPrimary: '#FFFFFF',
  bgSurface: '#FAFAFA',
  border: '#E8E8E8',
  textMuted: '#737373',
  textPrimary: '#0D0D0D',
  textSecondary: '#5E5E5E',
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

export const radius = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 16,
  full: 100,
};
