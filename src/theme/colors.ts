export const lightColors = {
  // Background colors
  background: '#FFFFFF',
  backgroundSecondary: '#F5F5F5',
  card: '#FFFFFF',
  cardElevated: '#FFFFFF',

  // Text colors
  text: '#1A1A1A',
  textSecondary: '#666666',
  textTertiary: '#999999',
  textInverse: '#FFFFFF',

  // Primary colors
  primary: '#2E7D32',
  primaryLight: '#4CAF50',
  primaryDark: '#1B5E20',

  // Accent colors
  accent: '#FF6F00',
  accentLight: '#FF9800',
  accentDark: '#E65100',

  // Status colors
  success: '#4CAF50',
  error: '#F44336',
  warning: '#FF9800',
  info: '#2196F3',

  // Border colors
  border: '#E0E0E0',
  borderDark: '#BDBDBD',

  // Highlight colors (for المفهرس tab)
  highlightPrimary: '#FFEB3B',
  highlightSecondary: '#FFF59D',
  highlightTertiary: '#F5F5F5',

  // Surface colors
  surface: '#FAFAFA',
  surfaceElevated: '#FFFFFF',

  // Overlay
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.3)',

  // Disabled
  disabled: '#BDBDBD',
  disabledText: '#9E9E9E',
} as const;

export const darkColors = {
  // Background colors
  background: '#121212',
  backgroundSecondary: '#1E1E1E',
  card: '#1E1E1E',
  cardElevated: '#2C2C2C',

  // Text colors
  text: '#FFFFFF',
  textSecondary: '#B0B0B0',
  textTertiary: '#808080',
  textInverse: '#1A1A1A',

  // Primary colors
  primary: '#66BB6A',
  primaryLight: '#81C784',
  primaryDark: '#4CAF50',

  // Accent colors
  accent: '#FF9800',
  accentLight: '#FFB74D',
  accentDark: '#F57C00',

  // Status colors
  success: '#66BB6A',
  error: '#EF5350',
  warning: '#FFB74D',
  info: '#42A5F5',

  // Border colors
  border: '#333333',
  borderDark: '#4D4D4D',

  // Highlight colors (for المفهرس tab)
  highlightPrimary: '#F9A825',
  highlightSecondary: '#FBC02D',
  highlightTertiary: '#424242',

  // Surface colors
  surface: '#1E1E1E',
  surfaceElevated: '#2C2C2C',

  // Overlay
  overlay: 'rgba(0, 0, 0, 0.7)',
  overlayLight: 'rgba(0, 0, 0, 0.5)',

  // Disabled
  disabled: '#616161',
  disabledText: '#757575',
} as const;

export type ColorTheme = typeof lightColors;
export type ColorName = keyof ColorTheme;

export const colors = {
  light: lightColors,
  dark: darkColors,
};

export default colors;
