import { eachDay } from './date';
import { isOffDay } from './holidays';
import type { Holiday, ISODate } from './types';

export interface BridgeOptions {
  from: ISODate;
  to: ISODate;
  /** 1–10 */
  maxLeaveDays: number;
  minTotalDays: number;
  /** true면 주말만 낀 평범한 휴가는 빼요. */
  requireHoliday: boolean;
  /** 이미 계획한 연차일은 쉬는 날로 취급해요. */
  plannedLeaveDates: Set<ISODate>;
}

export interface BridgeCandidate {
  start: ISODate;
  end: ISODate;
  /** 연속 휴무 일수 */
  totalDays: number;
  /** 연차를 써야 하는 평일 */
  leaveDates: ISODate[];
  leaveDays: number;
  /** totalDays / leaveDays, 소수 둘째 자리 */
  efficiency: number;
  /** 구간에 포함된 공휴일 */
  holidays: Holiday[];
}

const MAX_CANDIDATES = 30;

export function defaultBridgeOptions(asOf: ISODate): BridgeOptions {
  return {
    from: asOf,
    to: `${Number(asOf.slice(0, 4)) + 1}-12-31`,
    maxLeaveDays: 3,
    minTotalDays: 4,
    requireHoliday: true,
    plannedLeaveDates: new Set(),
  };
}

/**
 * 연차 n일로 가장 길게 쉬는 구간을 효율순으로 추천해요 (SPEC §5.5).
 * 잔여 연차는 모르므로 "잔여 부족" 판정은 화면에서 해요.
 */
export function suggestBridges(
  off: Set<ISODate>,
  holidays: Holiday[],
  opt: BridgeOptions,
): BridgeCandidate[] {
  const days = eachDay(opt.from, opt.to);
  const isOff = days.map((d) => isOffDay(d, off) || opt.plannedLeaveDates.has(d));
  const publicHolidayDates = new Set(
    holidays.filter((h) => h.kind !== 'company').map((h) => h.date),
  );

  // 구간 [s, e]의 휴무일·공휴일 수를 O(1)로 세기 위한 누적합
  const offCount = [0];
  const holidayCount = [0];
  days.forEach((d, i) => {
    offCount.push(offCount[i] + (isOff[i] ? 1 : 0));
    holidayCount.push(holidayCount[i] + (publicHolidayDates.has(d) ? 1 : 0));
  });

  // 연속된 휴무일 블록 (인덱스, 양 끝 포함)
  const blocks: { start: number; end: number }[] = [];
  isOff.forEach((offDay, i) => {
    if (!offDay) return;
    const last = blocks[blocks.length - 1];
    if (last && last.end === i - 1) last.end = i;
    else blocks.push({ start: i, end: i });
  });

  // 블록 i의 시작부터 블록 j의 끝까지를 후보로 봐요. 블록 사이에는 근무일이 반드시 있으므로
  // j > i면 leaveDays >= 1이고, 같은 leaveDays로 다른 후보를 포함하는 후보는 생기지 않아요
  // (SPEC §5.5-4의 지배 후보 제거가 따로 필요 없어요).
  const found: {
    start: number;
    end: number;
    totalDays: number;
    leaveDays: number;
    efficiency: number;
  }[] = [];
  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      const start = blocks[i].start;
      const end = blocks[j].end;
      const totalDays = end - start + 1;
      const leaveDays = totalDays - (offCount[end + 1] - offCount[start]);
      if (leaveDays > opt.maxLeaveDays) break;
      if (totalDays < opt.minTotalDays) continue;
      if (opt.requireHoliday && holidayCount[end + 1] - holidayCount[start] === 0) continue;
      const efficiency = Math.round((totalDays / leaveDays) * 100) / 100;
      found.push({ start, end, totalDays, leaveDays, efficiency });
    }
  }

  found.sort(
    (a, b) => b.efficiency - a.efficiency || b.totalDays - a.totalDays || a.start - b.start,
  );

  return found.slice(0, MAX_CANDIDATES).map(({ start, end, totalDays, leaveDays, efficiency }) => {
    const startDate = days[start];
    const endDate = days[end];
    return {
      start: startDate,
      end: endDate,
      totalDays,
      leaveDates: days.slice(start, end + 1).filter((_, k) => !isOff[start + k]),
      leaveDays,
      efficiency,
      holidays: holidays
        .filter((h) => startDate <= h.date && h.date <= endDate)
        .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),
    };
  });
}
