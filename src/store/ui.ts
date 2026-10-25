import { create } from 'zustand';
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

interface UiState {
  /** 프로필이 없을 때(온보딩 전) 쓰는 테마. 프로필이 있으면 프로필 값이 우선이에요. */
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
}

/** UI 상태만 둬요. 데이터의 원천은 Dexie예요 (CLAUDE.md). */
export const useUiStore = create<UiState>()((set) => ({
  theme: 'system',
  setTheme: (theme) => set({ theme }),
}));
