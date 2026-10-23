import { describe, expect, it } from 'vitest';
import {
  addDaysISO,
  addMonthsISO,
  addYearsISO,
  diffDays,
  eachDay,
  isWeekend,
  parseISO,
  startOfWeekMon,
  toISO,
  weekdayOf,
} from '../../src/core/date';

describe('parseISO', () => {
  it('로컬 자정 기준 Date를 만들어요', () => {
    const date = parseISO('2026-03-01');
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 2, 1]);
    expect([date.getHours(), date.getMinutes()]).toEqual([0, 0]);
  });

  it.each(['2026-3-1', '2026/03/01', '20260301', '', '2026-03-01T00:00'])(
    '형식이 틀린 %j는 거부해요',
    (input) => {
      expect(() => parseISO(input)).toThrow(RangeError);
    },
  );

  it.each(['2026-02-29', '2026-13-01', '2026-04-31', '2026-00-10'])(
    '없는 날짜 %s는 거부해요',
    (input) => {
      expect(() => parseISO(input)).toThrow(RangeError);
    },
  );

  it('윤년 2월 29일은 받아요', () => {
    expect(toISO(parseISO('2024-02-29'))).toBe('2024-02-29');
  });
});

describe('toISO', () => {
  it('월·일을 두 자리로 맞춰요', () => {
    expect(toISO(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('addDaysISO / addMonthsISO / addYearsISO', () => {
  it('월·연도 경계를 넘겨요', () => {
    expect(addDaysISO('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysISO('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('월 말일을 보정해요', () => {
    expect(addMonthsISO('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsISO('2026-01-31', 2)).toBe('2026-03-31');
  });

  it('2월 29일 입사자는 평년에 2월 28일로 보정해요', () => {
    expect(addYearsISO('2024-02-29', 1)).toBe('2025-02-28');
    expect(addYearsISO('2024-02-29', 4)).toBe('2028-02-29');
  });
});

describe('diffDays', () => {
  it('to - from 일수를 돌려줘요', () => {
    expect(diffDays('2026-01-01', '2026-12-31')).toBe(364);
    expect(diffDays('2026-10-23', '2027-03-01')).toBe(129);
    expect(diffDays('2026-03-02', '2026-03-01')).toBe(-1);
  });
});

describe('weekdayOf / isWeekend', () => {
  it('0 = 일요일 … 6 = 토요일', () => {
    expect(weekdayOf('2026-10-23')).toBe(5);
    expect(weekdayOf('2026-10-25')).toBe(0);
  });

  it('토·일만 주말이에요', () => {
    expect(isWeekend('2026-10-24')).toBe(true);
    expect(isWeekend('2026-10-25')).toBe(true);
    expect(isWeekend('2026-10-26')).toBe(false);
  });
});

describe('startOfWeekMon', () => {
  it('주의 시작은 월요일이에요', () => {
    expect(startOfWeekMon('2026-10-25')).toBe('2026-10-19');
    expect(startOfWeekMon('2026-10-19')).toBe('2026-10-19');
    expect(startOfWeekMon('2027-01-01')).toBe('2026-12-28');
  });
});

describe('eachDay', () => {
  it('양 끝을 포함해요', () => {
    expect(eachDay('2026-02-27', '2026-03-02')).toEqual([
      '2026-02-27',
      '2026-02-28',
      '2026-03-01',
      '2026-03-02',
    ]);
    expect(eachDay('2026-01-01', '2026-01-01')).toEqual(['2026-01-01']);
  });

  it('from이 더 늦으면 빈 배열이에요', () => {
    expect(eachDay('2026-01-02', '2026-01-01')).toEqual([]);
  });
});
