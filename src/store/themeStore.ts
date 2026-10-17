import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { DEFAULT_THEME_ID, getTheme, isKnownTheme } from '@/theme/themes';
import type { ThemeTokens } from '@/theme/tokens';

interface ThemeState {
  themeId: string;
  /** Set the active theme. Unknown ids safely fall back to the default. */
  setTheme: (id: string | undefined | null) => void;
  /** Advance to the next theme in the catalog (used by a quick toggle). */
  toggleTheme: (ids: string[]) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      themeId: DEFAULT_THEME_ID,
      setTheme: (id) =>
        set({ themeId: isKnownTheme(id) ? id : DEFAULT_THEME_ID }),
      toggleTheme: (ids) => {
        if (ids.length === 0) return;
        const current = get().themeId;
        const idx = ids.indexOf(current);
        set({ themeId: ids[(idx + 1) % ids.length] });
      },
    }),
    {
      name: 'arc-theme',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

/** Resolved theme tokens for the active theme. Re-renders on theme change. */
export function useTheme(): ThemeTokens {
  const themeId = useThemeStore((s) => s.themeId);
  return getTheme(themeId);
}
