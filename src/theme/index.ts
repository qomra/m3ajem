import colors, { lightColors, darkColors, ColorTheme } from './colors';
import typography, { TypographyVariant } from './typography';
import { spacing, borderRadius, shadows, SpacingValue, BorderRadiusValue, ShadowValue } from './spacing';

export type ThemeMode = 'light' | 'dark';

export interface Theme {
  mode: ThemeMode;
  colors: ColorTheme;
  typography: typeof typography;
  spacing: typeof spacing;
  borderRadius: typeof borderRadius;
  shadows: typeof shadows;
}

export const lightTheme: Theme = {
  mode: 'light',
  colors: lightColors,
  typography,
  spacing,
  borderRadius,
  shadows,
};

export const darkTheme: Theme = {
  mode: 'dark',
  colors: darkColors,
  typography,
  spacing,
  borderRadius,
  shadows,
};

export const themes = {
  light: lightTheme,
  dark: darkTheme,
};

export type {
  ColorTheme,
  TypographyVariant,
  SpacingValue,
  BorderRadiusValue,
  ShadowValue,
};

export { colors, typography, spacing, borderRadius, shadows };

export default themes;
