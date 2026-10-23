import { describe, expect, it } from 'vitest';
import { defaultBridgeOptions, suggestBridges, type BridgeOptions } from '../../src/core/bridge';
import { buildOffDaySet } from '../../src/core/holidays';
import type { Holiday } from '../../src/core/types';
import { holidaysOf } from './fixtures';

const holidays: Holiday[] = holidaysOf(2026, 2027);
const off = buildOffDaySet(holidays, new Set());

const options = (overrides: Partial<BridgeOptions> = {}): BridgeOptions => ({
  from: '2026-01-01',
  to: '2027-12-31',
  maxLeaveDays: 3,
  minTotalDays: 4,
  requireHoliday: true,
  plannedLeaveDates: new Set(),
  ...overrides,
});

const span = (c: { start: string; end: string }) => `${c.start}~${c.end}`;

describe('suggestBridges', () => {
  it('R1: 연차 1일로 5/1(금)–5/5(화) 5일 연휴, 효율 5.0', () => {
    const result = suggestBridges(off, holidays, options({ from: '2026-04-01', maxLeaveDays: 1 }));
    expect(result).toContainEqual(
      expect.objectContaining({
        start: '2026-05-01',
        end: '2026-05-05',
        totalDays: 5,
        leaveDates: ['2026-05-04'],
        leaveDays: 1,
        efficiency: 5,
      }),
    );
  });

  it('R2: 연차 3일로 9/19(토)–9/27(일) 9일 연휴', () => {
    const result = suggestBridges(off, holidays, options({ from: '2026-09-01', maxLeaveDays: 3 }));
    expect(result).toContainEqual(
      expect.objectContaining({
        start: '2026-09-19',
        end: '2026-09-27',
        totalDays: 9,
        leaveDates: ['2026-09-21', '2026-09-22', '2026-09-23'],
        efficiency: 3,
      }),
    );
  });

  it('SPEC §5.5 예시: 연차 5일로 9/24(목)–10/5(월) 12일, 효율 2.4', () => {
    const result = suggestBridges(
      off,
      holidays,
      options({ from: '2026-09-01', to: '2026-10-31', maxLeaveDays: 5 }),
    );
    expect(result).toContainEqual(
      expect.objectContaining({
        start: '2026-09-24',
        end: '2026-10-05',
        totalDays: 12,
        leaveDates: ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'],
        efficiency: 2.4,
      }),
    );
  });

  it('R3: requireHoliday면 공휴일 없는 구간은 없어요', () => {
    const withHoliday = suggestBridges(off, holidays, options({ maxLeaveDays: 5 }));
    expect(withHoliday.length).toBeGreaterThan(0);
    for (const c of withHoliday) {
      expect(c.holidays.some((h) => h.kind !== 'company')).toBe(true);
    }

    // 끄면 주말만 낀 평범한 휴가도 나와요.
    const plain = suggestBridges(
      off,
      holidays,
      options({ from: '2026-11-01', to: '2026-11-30', maxLeaveDays: 5, requireHoliday: false }),
    );
    expect(plain.length).toBeGreaterThan(0);
    expect(plain.every((c) => c.holidays.length === 0)).toBe(true);
  });

  it('R3: 회사 휴무일만 낀 구간은 공휴일 포함으로 치지 않아요', () => {
    const company: Holiday = { date: '2026-11-13', name: '창립기념일', kind: 'company' };
    const withCompany = [...holidays, company];
    const companyOff = buildOffDaySet(withCompany, new Set([company.date]));
    const result = suggestBridges(
      companyOff,
      withCompany,
      options({ from: '2026-11-01', to: '2026-11-30' }),
    );
    expect(result).toEqual([]);
  });

  it('R4: 계획한 연차일은 휴무로 취급해 후보가 확장돼요', () => {
    const range = { from: '2026-04-01', to: '2026-05-31', maxLeaveDays: 3 };
    const before = suggestBridges(off, holidays, options(range));
    expect(before.map(span)).not.toContain('2026-05-01~2026-05-10');

    const after = suggestBridges(
      off,
      holidays,
      options({ ...range, plannedLeaveDates: new Set(['2026-05-04']) }),
    );
    expect(after).toContainEqual(
      expect.objectContaining({
        start: '2026-05-01',
        end: '2026-05-10',
        totalDays: 10,
        leaveDates: ['2026-05-06', '2026-05-07', '2026-05-08'],
      }),
    );
  });

  it('효율 → 총 휴무 → 시작일 순으로 정렬하고 최대 30개예요', () => {
    const result = suggestBridges(
      off,
      holidays,
      options({ maxLeaveDays: 10, requireHoliday: false }),
    );
    expect(result).toHaveLength(30);
    for (let i = 1; i < result.length; i++) {
      const [a, b] = [result[i - 1], result[i]];
      const ordered =
        a.efficiency > b.efficiency ||
        (a.efficiency === b.efficiency &&
          (a.totalDays > b.totalDays || (a.totalDays === b.totalDays && a.start <= b.start)));
      expect(ordered, `${span(a)} → ${span(b)}`).toBe(true);
    }
  });

  it('조건을 지켜요: 연차 1–maxLeaveDays일, 총 휴무 minTotalDays일 이상, from–to 안', () => {
    const opt = options({ from: '2026-03-01', to: '2026-12-31', maxLeaveDays: 4, minTotalDays: 6 });
    const result = suggestBridges(off, holidays, opt);
    expect(result.length).toBeGreaterThan(0);
    for (const c of result) {
      expect(c.leaveDays).toBe(c.leaveDates.length);
      expect(c.leaveDays).toBeGreaterThanOrEqual(1);
      expect(c.leaveDays).toBeLessThanOrEqual(4);
      expect(c.totalDays).toBeGreaterThanOrEqual(6);
      expect(c.start >= opt.from && c.end <= opt.to).toBe(true);
      expect(c.efficiency).toBe(Math.round((c.totalDays / c.leaveDays) * 100) / 100);
    }
  });

  it('같은 연차 일수로 다른 후보에 완전히 포함되는 후보는 없어요 (SPEC §5.5-4)', () => {
    const result = suggestBridges(
      off,
      holidays,
      options({ maxLeaveDays: 10, requireHoliday: false }),
    );
    for (const a of result) {
      for (const b of result) {
        if (a === b || a.leaveDays !== b.leaveDays) continue;
        const contained = b.start <= a.start && a.end <= b.end;
        expect(contained, `${span(a)} ⊂ ${span(b)}`).toBe(false);
      }
    }
  });

  it('구간에 포함된 공휴일을 알려줘요', () => {
    const result = suggestBridges(off, holidays, options({ from: '2026-04-01', maxLeaveDays: 1 }));
    const mayDay = result.find((c) => c.start === '2026-05-01');
    expect(mayDay?.holidays.map((h) => h.name)).toEqual(['노동절', '어린이날']);
  });

  it('from이 to보다 늦으면 빈 배열이에요', () => {
    expect(
      suggestBridges(off, holidays, options({ from: '2027-01-01', to: '2026-12-31' })),
    ).toEqual([]);
  });

  it('2년치 계산이 50ms 이내예요', () => {
    const opt = options({ maxLeaveDays: 10, requireHoliday: false });
    const started = performance.now();
    suggestBridges(off, holidays, opt);
    expect(performance.now() - started).toBeLessThan(50);
  });
});

describe('defaultBridgeOptions', () => {
  it('asOf부터 다음 해 12-31까지, 연차 3일, 최소 4일, 공휴일 포함', () => {
    expect(defaultBridgeOptions('2026-10-23')).toEqual({
      from: '2026-10-23',
      to: '2027-12-31',
      maxLeaveDays: 3,
      minTotalDays: 4,
      requireHoliday: true,
      plannedLeaveDates: new Set(),
    });
  });
});
