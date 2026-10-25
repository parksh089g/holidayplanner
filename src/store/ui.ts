import { create } from 'zustand';

export type ThemeMode = 'system' | 'light' | 'dark';

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

interface UiState {
  // TODO(T2-1): 프로필(Dexie)의 theme과 연결해 저장해요. 지금은 새로고침하면 시스템으로 돌아가요.
  theme: ThemeMode;
  cycleTheme: () => void;
}

/** UI 상태만 둬요. 데이터의 원천은 Dexie예요 (CLAUDE.md). */
export const useUiStore = create<UiState>()((set) => ({
  theme: 'system',
  cycleTheme: () => set((state) => ({ theme: NEXT_THEME[state.theme] })),
}));
