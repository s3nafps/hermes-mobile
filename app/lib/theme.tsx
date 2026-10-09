import { DefaultTheme, DarkTheme, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { setBackgroundColorAsync } from 'expo-system-ui';
import { createContext, Fragment, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { applyScheme, currentScheme, palettes, type Scheme } from '@/constants/tokens';
import { getItem, setItem } from '@/lib/gateway/storage';

export type ThemePref = 'system' | Scheme;

type ThemeValue = {
  pref: ThemePref;
  scheme: Scheme;
  setPref: (pref: ThemePref) => void;
};

const ThemeContext = createContext<ThemeValue | null>(null);
const PREF_KEY = 'appearance';

// Chooses the palette, then remounts the screens below when it changes. Components read the
// palette while they render, so the remount is what brings every screen up to date.
export function ThemeProvider({ children }: { children: ReactNode }) {
  const system: Scheme = useColorScheme() === 'light' ? 'light' : 'dark';
  const [pref, setPrefState] = useState<ThemePref>('system');

  useEffect(() => {
    getItem(PREF_KEY)
      .then((saved) => {
        if (saved === 'light' || saved === 'dark' || saved === 'system') setPrefState(saved);
      })
      .catch(() => {
        // Without a saved choice the app follows the system setting.
      });
  }, []);

  const scheme: Scheme = pref === 'system' ? system : pref;
  // Applied during render, before any child reads the palette.
  applyScheme(scheme);

  useEffect(() => {
    void setBackgroundColorAsync(palettes[scheme].bg).catch(() => {});
  }, [scheme]);

  const setPref = useCallback((next: ThemePref) => {
    setPrefState(next);
    void setItem(PREF_KEY, next).catch(() => {});
  }, []);

  const value = useMemo(() => ({ pref, scheme, setPref }), [pref, scheme, setPref]);

  return (
    <ThemeContext.Provider value={value}>
      <NavigationThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <Fragment key={scheme}>{children}</Fragment>
      </NavigationThemeProvider>
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside ThemeProvider.');
  return value;
}

// Builds a StyleSheet from the palette in use. The sheet is made the first time it is read in
// each scheme, so module-level styles follow the theme instead of freezing the import-time colours.
export function themed<T extends object>(build: () => T): T {
  const sheets = new Map<Scheme, T>();
  return new Proxy({} as T, {
    get(_target, key) {
      const scheme = currentScheme();
      let sheet = sheets.get(scheme);
      if (!sheet) {
        sheet = build();
        sheets.set(scheme, sheet);
      }
      return Reflect.get(sheet, key);
    },
  });
}
