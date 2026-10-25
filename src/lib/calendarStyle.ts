import { weekdayOf } from '../core/date';
import type { Holiday, ISODate } from '../core/types';

/** 일요일·공휴일 빨강, 토요일 파랑 (SPEC §8.3). 공휴일 이름과 요일 글자가 함께 있어 색만으로 전달하지 않아요. */
export function dayColor(date: ISODate, holidays: Holiday[]): string {
  const weekday = weekdayOf(date);
  if (weekday === 0 || holidays.length > 0) return 'text-red-700 dark:text-red-400';
  if (weekday === 6) return 'text-blue-700 dark:text-blue-400';
  return '';
}
