import { create } from 'zustand';
import { addDaysISO } from '../core/date';
import type { ISODate } from '../core/types';

interface WorkState {
  /** 보고 있는 주의 월요일. 없으면 이번 주예요. */
  weekStart?: ISODate;
  /** 이번 주로 돌아가요. */
  resetWeek: () => void;
  /** 보고 있는 주에서 n주 옮겨요. 연달아 눌러도 마지막 상태를 기준으로 계산해요. */
  shiftWeek: (weeks: number, currentWeek: ISODate) => void;
}

/** 근무 화면 UI 상태 (CLAUDE.md: 데이터는 Dexie, UI 상태만 Zustand) */
export const useWorkStore = create<WorkState>()((set) => ({
  weekStart: undefined,
  resetWeek: () => set({ weekStart: undefined }),
  shiftWeek: (weeks, currentWeek) =>
    set((s) => ({ weekStart: addDaysISO(s.weekStart ?? currentWeek, weeks * 7) })),
}));
