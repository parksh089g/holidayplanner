import { describe, expect, it } from 'vitest';
import {
  formatDDay,
  formatDateRange,
  formatDays,
  formatDotDate,
  formatMinutes,
  formatShortDate,
  parseDaysToQuarters,
} from '../../src/lib/format';
import { toHHmm } from '../../src/lib/today';

describe('formatDotDate', () => {
  it("'2026-03-02' → '2026.03.02'", () => {
    expect(formatDotDate('2026-03-02')).toBe('2026.03.02');
  });
});

describe('formatDays', () => {
  it.each([
    [68, '17'],
    [39, '9.75'],
    [2, '0.5'],
    [1, '0.25'],
    [0, '0'],
    [-4, '-1'],
  ])('%i quarter는 %s일이에요', (q, text) => {
    expect(formatDays(q)).toBe(text);
  });
});

describe('parseDaysToQuarters', () => {
  it.each([
    ['0', 0],
    ['7.25', 29],
    [' 0.5 ', 2],
    ['15', 60],
  ])('%j → %i', (input, q) => {
    expect(parseDaysToQuarters(input)).toBe(q);
  });

  it.each(['', ' ', '-1', '1.1', '0.3', 'abc', 'Infinity'])('%j는 받지 않아요', (input) => {
    expect(parseDaysToQuarters(input)).toBeUndefined();
  });
});

describe('formatShortDate', () => {
  it('같은 해면 월/일(요일), 다른 해면 연도를 붙여요', () => {
    expect(formatShortDate('2026-09-24', 2026)).toBe('9/24(목)');
    expect(formatShortDate('2027-09-11', 2026)).toBe('2027년 9/11(토)');
    expect(formatShortDate('2026-10-25')).toBe('10/25(일)');
  });
});

describe('formatDDay', () => {
  it.each([
    ['2027-03-01', 'D-129'],
    ['2026-10-23', 'D-DAY'],
    ['2026-10-20', 'D+3'],
  ])('2026-10-23 기준 %s는 %s', (date, text) => {
    expect(formatDDay('2026-10-23', date)).toBe(text);
  });
});

describe('formatMinutes', () => {
  it.each([
    [510, '8시간 30분'],
    [180, '3시간'],
    [45, '45분'],
    [0, '0분'],
    [-60, '-1시간'],
    [3120, '52시간'],
  ])('%i분은 %s', (min, text) => {
    expect(formatMinutes(min)).toBe(text);
  });
});

describe('toHHmm', () => {
  it('로컬 시각을 분 단위 그대로 HH:mm으로 바꿔요', () => {
    expect(toHHmm(new Date(2026, 9, 23, 9, 5, 59))).toBe('09:05');
    expect(toHHmm(new Date(2026, 9, 23, 23, 0))).toBe('23:00');
  });
});

describe('formatDateRange', () => {
  it('같은 해는 연도 없이, 다른 해는 시작에만 연도를 붙여요', () => {
    expect(formatDateRange('2026-09-24', '2026-10-05', 2026)).toBe('9/24(목) – 10/5(월)');
    expect(formatDateRange('2027-09-11', '2027-09-16', 2026)).toBe('2027년 9/11(토) – 9/16(목)');
    expect(formatDateRange('2026-12-25', '2027-01-03', 2026)).toBe('12/25(금) – 2027년 1/3(일)');
  });
});

describe('parseDaysToQuarters allowNegative', () => {
  it('수동 보정은 음수(감액)도 받아요', () => {
    expect(parseDaysToQuarters('-1.5', { allowNegative: true })).toBe(-6);
    expect(parseDaysToQuarters('-1.5')).toBeUndefined();
    expect(parseDaysToQuarters('-0.3', { allowNegative: true })).toBeUndefined();
  });
});
