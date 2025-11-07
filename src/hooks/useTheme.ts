import { useColorScheme } from 'react-native';
import { lightTheme, darkTheme, Theme, ThemeMode } from '@theme';
import { useSettingsStore } from '@store/settingsStore';

export function useTheme(): Theme {
  const systemColorScheme = useColorScheme();
  const userThemePreference = useSettingsStore(state => state.theme);

  // Determine theme mode
  let themeMode: ThemeMode;

  if (userThemePreference === 'auto') {
    themeMode = systemColorScheme === 'dark' ? 'dark' : 'light';
  } else {
    themeMode = userThemePreference;
  }

  // Return appropriate theme
  return themeMode === 'dark' ? darkTheme : lightTheme;
}

export default useTheme;
