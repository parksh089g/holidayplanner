import type { ThemeMode } from '../core/types';

export const THEME_LABEL: Record<ThemeMode, string> = {
  system: '시스템',
  light: '밝게',
  dark: '어둡게',
};

const NEXT_THEME: Record<ThemeMode, ThemeMode> = {
  system: 'light',
  light: 'dark',
  dark: 'system',
};

export const nextTheme = (theme: ThemeMode) => NEXT_THEME[theme];
