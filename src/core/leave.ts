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

export type LeaveProblem = 'annual-on-off-day' | 'over-one-day' | 'same-part';

/**
 * 휴가를 새로 넣기 전에 확인해요 (SPEC §8.3).
 * - 휴무일에는 연차를 막아요 (다른 유형은 허용)
 * - 그날 휴가 합계가 하루(4 quarter)를 넘으면 막아요
 * - 같은 오전·오후에 반차·반반차가 이미 있으면 막아요
 */
export function checkNewLeave(
  entry: Pick<LeaveEntry, 'quarters' | 'type' | 'part'>,
  sameDay: LeaveEntry[],
  isOffDay: boolean,
): LeaveProblem | undefined {
  if (entry.type === 'annual' && isOffDay) return 'annual-on-off-day';
  const others = sameDay.filter((e) => !e.isBulk);
  const total = others.reduce((sum, e) => sum + e.quarters, entry.quarters);
  if (total > QUARTERS_PER_DAY) return 'over-one-day';
  if (entry.part && others.some((e) => e.part === entry.part)) return 'same-part';
  return undefined;
}
