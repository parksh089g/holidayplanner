import { create } from 'zustand';
import type { YearMonth } from '../core/calendar';

interface CalendarState {
  /** 보고 있는 달. 없으면 이번 달이에요. */
  month?: YearMonth;
  view: 'month' | 'year';
  setMonth: (month: YearMonth) => void;
  setView: (view: 'month' | 'year') => void;
}

/** 달력 화면의 UI 상태만 둬요. 데이터의 원천은 Dexie예요 (CLAUDE.md). */
export const useCalendarStore = create<CalendarState>()((set) => ({
  month: undefined,
  view: 'month',
  setMonth: (month) => set({ month }),
  setView: (view) => set({ view }),
}));
