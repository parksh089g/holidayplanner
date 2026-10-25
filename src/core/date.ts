import {
  addDays,
  addMonths,
  addYears,
  differenceInCalendarDays,
  eachDayOfInterval,
  startOfWeek,
} from 'date-fns';
import type { ISODate } from './types';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** 'YYYY-MM-DD'를 로컬 자정 Date로 바꿔요. 형식이 틀리거나 없는 날짜면 예외를 던져요. */
export function parseISO(iso: ISODate): Date {
  const match = ISO_DATE.exec(iso);
  if (!match) throw new RangeError(`날짜 형식이 올바르지 않아요: ${iso}`);
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    throw new RangeError(`없는 날짜예요: ${iso}`);
  }
  return date;
}

/** Date의 로컬 날짜를 'YYYY-MM-DD'로 바꿔요. */
export function toISO(date: Date): ISODate {
  const y = String(date.getFullYear()).padStart(4, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysISO(iso: ISODate, days: number): ISODate {
  return toISO(addDays(parseISO(iso), days));
}

/** 말일 보정은 date-fns를 따라요: addMonthsISO('2026-01-31', 1) = '2026-02-28' */
export function addMonthsISO(iso: ISODate, months: number): ISODate {
  return toISO(addMonths(parseISO(iso), months));
}

/** 2월 29일은 평년에 2월 28일로 보정돼요. */
export function addYearsISO(iso: ISODate, years: number): ISODate {
  return toISO(addYears(parseISO(iso), years));
}

/** sort 비교 함수. 'YYYY-MM-DD'는 문자열 순서가 곧 날짜 순서예요. */
export function compareISO(a: ISODate, b: ISODate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** to - from (일). from이 더 늦으면 음수예요. */
export function diffDays(from: ISODate, to: ISODate): number {
  return differenceInCalendarDays(parseISO(to), parseISO(from));
}

/** 0 = 일요일 … 6 = 토요일 */
export function weekdayOf(iso: ISODate): number {
  return parseISO(iso).getDay();
}

export function isWeekend(iso: ISODate): boolean {
  const weekday = weekdayOf(iso);
  return weekday === 0 || weekday === 6;
}

/** 그 날짜가 속한 주의 월요일 */
export function startOfWeekMon(iso: ISODate): ISODate {
  return toISO(startOfWeek(parseISO(iso), { weekStartsOn: 1 }));
}

/** from부터 to까지 (양 끝 포함). from이 더 늦으면 빈 배열이에요. */
export function eachDay(from: ISODate, to: ISODate): ISODate[] {
  if (from > to) return [];
  return eachDayOfInterval({ start: parseISO(from), end: parseISO(to) }).map(toISO);
}
