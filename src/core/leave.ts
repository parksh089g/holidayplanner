import { QUARTERS_PER_DAY, type ISODate, type LeaveEntry } from './types';

/**
 * 날짜별 휴가량(quarter, 하루 최대 4). 유형과 관계없이 그날 쉰 양이에요.
 * 온보딩 일괄 차감(isBulk)은 그날 쉰 게 아니라서 빼요.
 */
export function leaveQuartersByDate(entries: LeaveEntry[]): Map<ISODate, number> {
  const byDate = new Map<ISODate, number>();
  for (const entry of entries) {
    if (entry.isBulk) continue;
    const sum = (byDate.get(entry.date) ?? 0) + entry.quarters;
    byDate.set(entry.date, Math.min(QUARTERS_PER_DAY, sum));
  }
  return byDate;
}

/** 하루 전체를 쉬는 날. 추천(§5.5)에서 휴무로 취급해요. */
export function fullDayLeaveDates(entries: LeaveEntry[]): Set<ISODate> {
  const dates = new Set<ISODate>();
  for (const [date, quarters] of leaveQuartersByDate(entries)) {
    if (quarters >= QUARTERS_PER_DAY) dates.add(date);
  }
  return dates;
}
