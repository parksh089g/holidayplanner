import { describe, expect, it } from 'vitest';
import { annualDaysFor, computeAutoGrants } from '../../src/core/accrual';
import type { AutoGrant, ISODate } from '../../src/core/types';

const activeAt = (grants: AutoGrant[], asOf: ISODate) =>
  grants.filter((g) => g.grantDate <= asOf && asOf <= g.expireDate);

describe('computeAutoGrants', () => {
  it('A1: 입사 전날까지는 부여가 없어요', () => {
    expect(computeAutoGrants('2026-01-15', '2026-01-14')).toEqual([]);
  });

  it('A2: 1년 미만은 매월 1일씩, 최초 1년이 끝날 때 소멸해요', () => {
    const grants = computeAutoGrants('2026-01-15', '2026-04-15');
    expect(grants).toEqual([
      {
        id: 'auto-m-1',
        kind: 'monthly',
        grantDate: '2026-02-15',
        expireDate: '2027-01-14',
        quarters: 4,
        serviceYear: 0,
      },
      {
        id: 'auto-m-2',
        kind: 'monthly',
        grantDate: '2026-03-15',
        expireDate: '2027-01-14',
        quarters: 4,
        serviceYear: 0,
      },
      {
        id: 'auto-m-3',
        kind: 'monthly',
        grantDate: '2026-04-15',
        expireDate: '2027-01-14',
        quarters: 4,
        serviceYear: 0,
      },
    ]);
  });

  it('A3: 1년 되기 전날에는 월차 11건, 연차 0건', () => {
    const grants = computeAutoGrants('2025-03-02', '2026-03-01');
    expect(grants.filter((g) => g.kind === 'monthly')).toHaveLength(11);
    expect(grants.filter((g) => g.kind === 'annual')).toHaveLength(0);
    expect(grants[10]).toMatchObject({ grantDate: '2026-02-02', expireDate: '2026-03-01' });
  });

  it('A4: 1년이 되는 날 15일이 발생하고 다음 해 전날 소멸해요', () => {
    const grants = computeAutoGrants('2025-03-02', '2026-03-02');
    expect(grants.filter((g) => g.kind === 'monthly')).toHaveLength(11);
    expect(grants.filter((g) => g.kind === 'annual')).toEqual([
      {
        id: 'auto-y-1',
        kind: 'annual',
        grantDate: '2026-03-02',
        expireDate: '2027-03-01',
        quarters: 60,
        serviceYear: 1,
      },
    ]);
  });

  it('A5: 2021-03-02 입사자는 2026-10-23에 5년차 17일이 유효해요', () => {
    const active = activeAt(computeAutoGrants('2021-03-02', '2026-10-23'), '2026-10-23');
    expect(active).toEqual([
      {
        id: 'auto-y-5',
        kind: 'annual',
        grantDate: '2026-03-02',
        expireDate: '2027-03-01',
        quarters: 68,
        serviceYear: 5,
      },
    ]);
  });

  it('A6: 22년차는 상한 25일이에요', () => {
    const active = activeAt(computeAutoGrants('2004-01-01', '2026-10-23'), '2026-10-23');
    expect(active).toHaveLength(1);
    expect(active[0]).toMatchObject({
      serviceYear: 22,
      quarters: 100,
      grantDate: '2026-01-01',
      expireDate: '2026-12-31',
    });
  });

  it('A7: 31일 입사자의 월차는 말일로 보정해요', () => {
    const grants = computeAutoGrants('2026-01-31', '2026-03-31');
    expect(grants.map((g) => g.grantDate)).toEqual(['2026-02-28', '2026-03-31']);
  });

  it('A8: 2월 29일 입사자의 1년차 발생일은 평년 2월 28일이에요', () => {
    const grants = computeAutoGrants('2024-02-29', '2025-02-28');
    const annual = grants.filter((g) => g.kind === 'annual');
    expect(annual).toHaveLength(1);
    expect(annual[0]).toMatchObject({ grantDate: '2025-02-28', expireDate: '2026-02-27' });
    // 월차 소멸일과 1년차 발생일이 끊김 없이 이어져요.
    expect(grants[0].expireDate).toBe('2025-02-27');
  });

  it('부여분은 발생일 오름차순이고, 연차 소멸일 다음 날이 다음 연차 발생일이에요', () => {
    const grants = computeAutoGrants('2021-03-02', '2026-10-23');
    const dates = grants.map((g) => g.grantDate);
    expect([...dates].sort()).toEqual(dates);
    const annual = grants.filter((g) => g.kind === 'annual');
    expect(annual.map((g) => g.grantDate)).toEqual([
      '2022-03-02',
      '2023-03-02',
      '2024-03-02',
      '2025-03-02',
      '2026-03-02',
    ]);
    expect(annual.map((g) => g.expireDate)).toEqual([
      '2023-03-01',
      '2024-03-01',
      '2025-03-01',
      '2026-03-01',
      '2027-03-01',
    ]);
  });
});

describe('annualDaysFor', () => {
  it.each([
    [1, 15],
    [2, 15],
    [3, 16],
    [4, 16],
    [5, 17],
    [7, 18],
    [9, 19],
    [11, 20],
    [21, 25],
    [23, 25],
  ])('근속 %i년차는 %i일 (SPEC §5.1 표)', (serviceYear, days) => {
    expect(annualDaysFor(serviceYear)).toBe(days);
  });
});
