import { describe, expect, it } from 'vitest';
import { monthGrid, monthRange, shiftMonth } from '../../src/core/calendar';

describe('monthGrid', () => {
  it('월요일부터 시작하고 앞뒤 빈칸은 null이에요 (2026년 10월: 1일이 목요일)', () => {
    const weeks = monthGrid('2026-10');
    expect(weeks).toHaveLength(5);
    expect(weeks[0]).toEqual([
      null,
      null,
      null,
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ]);
    expect(weeks[4]).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      null,
    ]);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });

  it('1일이 월요일이면 앞 빈칸이 없어요 (2027년 2월, 28일)', () => {
    const weeks = monthGrid('2027-02');
    expect(weeks[0][0]).toBe('2027-02-01');
    expect(weeks.flat().filter(Boolean)).toHaveLength(28);
    expect(weeks).toHaveLength(4);
  });

  it('1일이 일요일이면 앞에 빈칸 6개예요 (2026년 3월)', () => {
    const weeks = monthGrid('2026-03');
    expect(weeks[0].indexOf('2026-03-01')).toBe(6);
    expect(weeks).toHaveLength(6);
  });

  it('윤년 2월은 29일까지예요', () => {
    expect(monthGrid('2028-02').flat().filter(Boolean).pop()).toBe('2028-02-29');
  });
});

describe('shiftMonth / monthRange', () => {
  it('연도를 넘겨 앞뒤 달로 옮겨요', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-10', 14)).toBe('2027-12');
  });

  it('그 달의 첫날과 마지막 날', () => {
    expect(monthRange('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(monthRange('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });

  it('형식이 틀리면 거부해요', () => {
    expect(() => monthGrid('2026-13')).toThrow(RangeError);
    expect(() => shiftMonth('2026-1', 1)).toThrow(RangeError);
  });
});
