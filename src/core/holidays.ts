import { addDaysISO, compareISO, isWeekend, weekdayOf } from './date';
import type { Holiday, ISODate } from './types';

/**
 * 휴무일 집합을 만들어요. 회사 휴무일(kind 'company')은 enabledCompanyDates에 있는 날짜만 넣어요.
 * 토·일은 넣지 않고 isOffDay가 따로 판정해요.
 */
export function buildOffDaySet(
  holidays: Holiday[],
  enabledCompanyDates: Set<ISODate>,
): Set<ISODate> {
  const off = new Set<ISODate>();
  for (const h of holidays) {
    if (h.kind !== 'company' || enabledCompanyDates.has(h.date)) off.add(h.date);
  }
  return off;
}

/** 토·일이거나 off에 들어 있으면 휴무예요. */
export function isOffDay(date: ISODate, off: Set<ISODate>): boolean {
  return off.has(date) || isWeekend(date);
}

const LUNAR_HOLIDAYS = ['설날', '추석'];
const SUBSTITUTABLE = new Set([
  '삼일절',
  '어린이날',
  '노동절',
  '부처님오신날',
  '제헌절',
  '광복절',
  '개천절',
  '한글날',
  '기독탄신일',
  '성탄절',
]);

interface Trigger {
  /** 이 날 다음의 첫 비공휴일이 대체공휴일이에요. */
  after: ISODate;
  name: string;
}

/** 연속한 날짜끼리 묶어요. 입력은 오름차순이어야 해요. */
function groupConsecutive(dates: ISODate[]): ISODate[][] {
  const groups: ISODate[][] = [];
  for (const date of dates) {
    const last = groups[groups.length - 1];
    if (last && addDaysISO(last[last.length - 1], 1) === date) last.push(date);
    else groups.push([date]);
  }
  return groups;
}

/**
 * 대체공휴일을 규칙으로 계산해요 (「관공서의 공휴일에 관한 규정」 제3조, SPEC §5.4).
 *
 * **데이터 검증 테스트 전용이에요.** 화면에는 public/holidays/{year}.json의 substitute를 써요.
 * 이름으로 설날·추석·대체 대상 공휴일을 구분하므로 데이터의 이름 표기를 바꾸면 여기도 맞춰야 해요.
 */
export function deriveSubstitutes(base: Holiday[]): Holiday[] {
  const holidays = base.filter((h) => h.kind !== 'substitute' && h.kind !== 'company');
  const countByDate = new Map<ISODate, number>();
  for (const h of holidays) countByDate.set(h.date, (countByDate.get(h.date) ?? 0) + 1);
  const overlaps = (date: ISODate) => (countByDate.get(date) ?? 0) > 1;

  const triggers: Trigger[] = [];
  const handledOverlaps = new Set<ISODate>();

  // 설날·추석 연휴: 일요일 또는 다른 공휴일과 겹치면
  for (const name of LUNAR_HOLIDAYS) {
    const dates = holidays
      .filter((h) => h.name.startsWith(name))
      .map((h) => h.date)
      .sort();
    for (const group of groupConsecutive(dates)) {
      const overlapping = group.filter(overlaps);
      if (overlapping.length > 0 || group.some((d) => weekdayOf(d) === 0)) {
        triggers.push({ after: group[group.length - 1], name });
        overlapping.forEach((d) => handledOverlaps.add(d));
      }
    }
  }

  // 삼일절·어린이날 등: 토·일 또는 다른 공휴일과 겹치면
  const singles = holidays
    .filter((h) => SUBSTITUTABLE.has(h.name))
    .sort((a, b) => compareISO(a.date, b.date));
  for (const h of singles) {
    if (overlaps(h.date)) {
      if (handledOverlaps.has(h.date)) continue;
      handledOverlaps.add(h.date);
      triggers.push({ after: h.date, name: h.name });
    } else if (isWeekend(h.date)) {
      triggers.push({ after: h.date, name: h.name });
    }
  }

  const taken = new Set(countByDate.keys());
  return triggers
    .sort((a, b) => compareISO(a.after, b.after))
    .map(({ after, name }) => {
      let date = addDaysISO(after, 1);
      while (taken.has(date) || isWeekend(date)) date = addDaysISO(date, 1);
      taken.add(date);
      return { date, name: `대체공휴일(${name})`, kind: 'substitute' as const };
    });
}

/** asOf(포함) 이후 공휴일을 날짜순으로 count개 돌려줘요. */
export function upcomingHolidays(holidays: Holiday[], asOf: ISODate, count: number): Holiday[] {
  return holidays
    .filter((h) => h.date >= asOf)
    .sort((a, b) => compareISO(a.date, b.date))
    .slice(0, count);
}
