import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import { getStoredAppearance, setStoredAppearance } from '../services/api';
import { palettes, type ColorScheme, type Colors } from './index';

/** What the person picked in Settings; 'system' follows the device. */
export type AppearancePreference = 'system' | ColorScheme;

interface ThemeContextValue {
  colors: Colors;
  scheme: ColorScheme;
  preference: AppearancePreference;
  setPreference: (preference: AppearancePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isPreference(value: string | null): value is AppearancePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

// Pushes the choice down to native UI the app doesn't draw itself (alerts,
// the keyboard, the share sheet). react-native-web has no setColorScheme.
function applyNativeScheme(preference: AppearancePreference) {
  if (typeof Appearance.setColorScheme !== 'function') return;
  Appearance.setColorScheme(preference === 'system' ? null : preference);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<AppearancePreference>('system');
  const [ready, setReady] = useState(false);
  // With an override applied this reports the override, so it is only
  // consulted while the preference is 'system'.
  const systemScheme = useColorScheme();

  useEffect(() => {
    getStoredAppearance()
      .then((stored) => {
        if (isPreference(stored)) {
          setPreferenceState(stored);
          applyNativeScheme(stored);
        }
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const setPreference = useCallback((next: AppearancePreference) => {
    setPreferenceState(next);
    applyNativeScheme(next);
    setStoredAppearance(next).catch(() => {});
  }, []);

  const scheme: ColorScheme =
    preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;

  const value = useMemo(
    () => ({ colors: palettes[scheme], scheme, preference, setPreference }),
    [scheme, preference, setPreference],
  );

  // Hold the first frame until the stored choice is known, so a dark-mode
  // user never sees a white flash on launch.
  if (!ready) return null;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

/**
 * Builds a screen's StyleSheet from the active palette, rebuilt only when the
 * palette changes. Pass a module-level factory:
 *   const makeStyles = (colors: Colors) => StyleSheet.create({ ... });
 */
export function useStyles<T>(factory: (colors: Colors) => T): T {
  const { colors } = useTheme();
  return useMemo(() => factory(colors), [factory, colors]);
}
