import { describe, expect, it } from 'vitest';
import { fullDayLeaveDates, leaveQuartersByDate } from '../../src/core/leave';
import type { LeaveEntry } from '../../src/core/types';

const e = (date: string, quarters: number, extra: Partial<LeaveEntry> = {}): LeaveEntry => ({
  id: `${date}-${quarters}-${Math.random()}`,
  date,
  quarters,
  type: 'annual',
  ...extra,
});

describe('leaveQuartersByDate', () => {
  it('날짜별 휴가량을 합해요 (유형과 관계없이, 하루 최대 4)', () => {
    const map = leaveQuartersByDate([
      e('2026-11-02', 2, { part: 'am' }),
      e('2026-11-02', 1, { part: 'pm', type: 'special' }),
      e('2026-11-03', 4),
      e('2026-11-04', 4),
      e('2026-11-04', 2),
    ]);
    expect(Object.fromEntries(map)).toEqual({ '2026-11-02': 3, '2026-11-03': 4, '2026-11-04': 4 });
  });

  it('온보딩 일괄 차감 항목은 그날 휴가가 아니라서 빼요', () => {
    const map = leaveQuartersByDate([e('2026-10-23', 29, { isBulk: true })]);
    expect(map.size).toBe(0);
  });
});

describe('fullDayLeaveDates', () => {
  it('하루 전체를 쉬는 날만 돌려줘요 (반차 두 번도 하루예요)', () => {
    const dates = fullDayLeaveDates([
      e('2026-11-02', 2, { part: 'am' }),
      e('2026-11-02', 2, { part: 'pm' }),
      e('2026-11-03', 2),
      e('2026-11-04', 4, { type: 'sick' }),
      e('2026-10-23', 40, { isBulk: true }),
    ]);
    expect([...dates].sort()).toEqual(['2026-11-02', '2026-11-04']);
  });
});
