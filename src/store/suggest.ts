import { create } from 'zustand';

export interface SuggestFilters {
  /** 1–10 */
  maxLeaveDays: number;
  minTotalDays: number;
  /** 없으면 오늘부터 내년 말까지 */
  year?: number;
  requireHoliday: boolean;
}

export const DEFAULT_SUGGEST_FILTERS: SuggestFilters = {
  maxLeaveDays: 3,
  minTotalDays: 4,
  year: undefined,
  requireHoliday: true,
};

interface SuggestState extends SuggestFilters {
  setFilters: (changes: Partial<SuggestFilters>) => void;
}

/** 추천 화면 필터(UI 상태). 다른 화면에 다녀와도 유지돼요. */
export const useSuggestStore = create<SuggestState>()((set) => ({
  ...DEFAULT_SUGGEST_FILTERS,
  setFilters: (changes) => set(changes),
}));
