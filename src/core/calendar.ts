import { addDaysISO, addMonthsISO, eachDay, weekdayOf } from './date';
import type { ISODate } from './types';

/** 'YYYY-MM' */
export type YearMonth = string;

const YEAR_MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

function firstDay(ym: YearMonth): ISODate {
  if (!YEAR_MONTH.test(ym)) throw new RangeError(`월 형식이 올바르지 않아요: ${ym}`);
  return `${ym}-01`;
}

/** 그 달의 첫날과 마지막 날 (양 끝 포함) */
export function monthRange(ym: YearMonth): { from: ISODate; to: ISODate } {
  const from = firstDay(ym);
  return { from, to: addDaysISO(addMonthsISO(from, 1), -1) };
}

export function shiftMonth(ym: YearMonth, months: number): YearMonth {
  return addMonthsISO(firstDay(ym), months).slice(0, 7);
}

/** 월요일부터 시작하는 달력 칸. 한 줄에 7칸이고 그 달이 아닌 칸은 null이에요. */
export function monthGrid(ym: YearMonth): (ISODate | null)[][] {
  const { from, to } = monthRange(ym);
  const leading = (weekdayOf(from) + 6) % 7; // 월 = 0 … 일 = 6
  const cells: (ISODate | null)[] = [...Array<null>(leading).fill(null), ...eachDay(from, to)];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (ISODate | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
