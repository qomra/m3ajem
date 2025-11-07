import { create } from 'zustand';

export type ThemePreference = 'light' | 'dark' | 'auto';
export type FontSize = 'small' | 'medium' | 'large';

interface SettingsState {
  // Theme settings
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;

  // Font size
  fontSize: FontSize;
  setFontSize: (fontSize: FontSize) => void;

  // Chat settings
  chatProvider: string | null;
  setChatProvider: (provider: string | null) => void;

  // Reset all settings
  reset: () => void;
}

const initialState = {
  theme: 'auto' as ThemePreference,
  fontSize: 'medium' as FontSize,
  chatProvider: null,
};

export const useSettingsStore = create<SettingsState>(set => ({
  ...initialState,

  setTheme: theme => set({ theme }),
  setFontSize: fontSize => set({ fontSize }),
  setChatProvider: chatProvider => set({ chatProvider }),

  reset: () => set(initialState),
}));

export default useSettingsStore;
