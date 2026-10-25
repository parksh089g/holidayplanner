import { describe, expect, it } from 'vitest';
import { computeAutoGrants } from '../../src/core/accrual';
import { computeBalance, expiredQBetween } from '../../src/core/balance';
import type { ISODate, LeaveEntry, LeaveType, ManualGrant } from '../../src/core/types';

let seq = 0;
function leave(date: ISODate, quarters: number, type: LeaveType = 'annual'): LeaveEntry {
  seq += 1;
  return { id: `e${seq}`, date, quarters, type };
}

function manual(
  grantDate: ISODate,
  expireDate: ISODate,
  quarters: number,
  id = `m-${grantDate}`,
): ManualGrant {
  return { id, grantDate, expireDate, quarters, memo: '' };
}

describe('computeBalance', () => {
  it('B1: 15일 부여에서 연차 3 + 반차 1 + 반반차 2를 쓰면 잔여 11일(44Q)', () => {
    const grant = manual('2026-01-01', '2026-12-31', 60);
    const entries = [
      leave('2026-02-02', 4),
      leave('2026-02-03', 4),
      leave('2026-02-04', 4),
      leave('2026-03-02', 2),
      leave('2026-04-01', 1),
      leave('2026-04-02', 1),
    ];
    const summary = computeBalance([grant], entries, '2026-10-23');
    expect(summary.remainingQ).toBe(44);
    expect(summary.usedQ).toBe(16);
    expect(summary.plannedQ).toBe(0);
    expect(summary.totalGrantedQ).toBe(60);
    expect(summary.overdrawn).toEqual([]);
  });

  it('B2: 월차 소멸 직전 사용분과 새 연차 발생 직후 사용분을 각각 맞는 부여분에서 차감해요', () => {
    const grants = computeAutoGrants('2025-03-02', '2026-12-31');
    const summary = computeBalance(
      grants,
      [leave('2026-02-27', 4), leave('2026-03-03', 4)],
      '2026-03-10',
    );
    const byId = new Map(summary.grants.map((b) => [b.grant.id, b]));
    expect(byId.get('auto-m-1')?.usedQ).toBe(4);
    expect(byId.get('auto-y-1')?.usedQ).toBe(4);
    // 2026-03-10에 유효한 건 1년차 15일뿐이에요.
    expect(summary.activeGrants.map((b) => b.grant.id)).toEqual(['auto-y-1']);
    expect(summary.remainingQ).toBe(56);
    // 쓰지 못한 월차 10일은 소멸로 집계해요.
    expect(summary.expiredQ).toBe(40);
  });

  it('B3: 두 부여분이 동시에 유효하면 소멸이 빠른 쪽부터 차감해요', () => {
    const carryOver = manual('2026-01-01', '2026-06-30', 8, 'carry');
    const annual = manual('2026-03-02', '2027-03-01', 60, 'annual');
    const summary = computeBalance(
      [annual, carryOver],
      [leave('2026-04-01', 4), leave('2026-04-02', 4), leave('2026-04-03', 4)],
      '2026-04-10',
    );
    const byId = new Map(summary.grants.map((b) => [b.grant.id, b]));
    expect(byId.get('carry')).toMatchObject({ usedQ: 8, remainingQ: 0 });
    expect(byId.get('annual')).toMatchObject({ usedQ: 4, remainingQ: 56 });
  });

  it('B3: 한 부여분이 모자라면 다음 부여분으로 넘어가요', () => {
    const carryOver = manual('2026-01-01', '2026-06-30', 2, 'carry');
    const annual = manual('2026-03-02', '2027-03-01', 60, 'annual');
    const summary = computeBalance([carryOver, annual], [leave('2026-04-01', 4)], '2026-04-10');
    const byId = new Map(summary.grants.map((b) => [b.grant.id, b]));
    expect(byId.get('carry')?.usedQ).toBe(2);
    expect(byId.get('annual')?.usedQ).toBe(2);
    expect(summary.overdrawn).toEqual([]);
  });

  it('B4: 잔여보다 많이 계획하면 초과 항목을 overdrawn으로 표시해요', () => {
    const grant = manual('2026-01-01', '2026-12-31', 8);
    const third = leave('2026-11-04', 4);
    const summary = computeBalance(
      [grant],
      [leave('2026-11-02', 4), leave('2026-11-03', 4), third],
      '2026-10-23',
    );
    expect(summary.overdrawn).toEqual([{ entryId: third.id, date: '2026-11-04', overdrawnQ: 4 }]);
    expect(summary.plannedQ).toBe(12);
    expect(summary.remainingQ).toBe(-4);
  });

  it('B4: 유효한 부여분이 없는 날의 휴가도 overdrawn이에요', () => {
    const grant = manual('2026-01-01', '2026-06-30', 8);
    const orphan = leave('2026-07-01', 4);
    const summary = computeBalance([grant], [orphan], '2026-06-15');
    expect(summary.overdrawn).toEqual([{ entryId: orphan.id, date: '2026-07-01', overdrawnQ: 4 }]);
    expect(summary.remainingQ).toBe(8);
  });

  it('B5: special 유형은 기록만 하고 차감하지 않아요', () => {
    const grant = manual('2026-01-01', '2026-12-31', 60);
    const summary = computeBalance(
      [grant],
      [leave('2026-05-01', 4, 'special'), leave('2026-05-02', 4, 'sick')],
      '2026-10-23',
    );
    expect(summary.usedQ).toBe(0);
    expect(summary.remainingQ).toBe(60);
  });

  it('B6: 미래 날짜 휴가는 plannedQ로 집계해요 (asOf 당일은 사용)', () => {
    const grant = manual('2026-01-01', '2026-12-31', 60);
    const summary = computeBalance(
      [grant],
      [leave('2026-10-23', 2), leave('2026-10-24', 4), leave('2026-12-24', 1)],
      '2026-10-23',
    );
    expect(summary.usedQ).toBe(2);
    expect(summary.plannedQ).toBe(5);
    expect(summary.remainingQ).toBe(53);
  });

  it('음수 수동 보정은 총 부여에서 빠지고 배분 대상이 아니에요', () => {
    const annual = manual('2026-03-02', '2027-03-01', 60, 'annual');
    const deduction = manual('2026-03-02', '2026-03-31', -8, 'deduct');
    const summary = computeBalance([annual, deduction], [leave('2026-03-10', 4)], '2026-03-20');
    const byId = new Map(summary.grants.map((b) => [b.grant.id, b]));
    expect(byId.get('deduct')?.usedQ).toBe(0);
    expect(byId.get('annual')?.usedQ).toBe(4);
    expect(summary.totalGrantedQ).toBe(52);
    expect(summary.remainingQ).toBe(48);
  });

  it('온보딩 일괄 차감 항목도 연차에서 차감해요', () => {
    const grants = computeAutoGrants('2021-03-02', '2027-12-31');
    const bulk: LeaveEntry = {
      id: 'bulk',
      date: '2026-10-23',
      quarters: 29,
      type: 'annual',
      memo: '앱 사용 전 사용분',
      isBulk: true,
    };
    const summary = computeBalance(grants, [bulk], '2026-10-23');
    expect(summary.usedQ).toBe(29);
    expect(summary.remainingQ).toBe(68 - 29);
  });

  it('소멸 D-day용으로 가장 빨리 소멸하는 잔여 부여분을 알려줘요', () => {
    const grants = computeAutoGrants('2021-03-02', '2027-12-31');
    const summary = computeBalance(grants, [leave('2026-11-02', 4)], '2026-10-23');
    expect(summary.nextExpiry).toEqual({ date: '2027-03-01', remainingQ: 64 });
  });

  it('잔여가 0이면 nextExpiry가 없어요', () => {
    const grant = manual('2026-01-01', '2026-12-31', 4);
    const summary = computeBalance([grant], [leave('2026-02-02', 4)], '2026-10-23');
    expect(summary.nextExpiry).toBeUndefined();
  });

  it('같은 날 소멸하는 월차들은 합쳐서 보여줘요', () => {
    const grants = computeAutoGrants('2026-01-15', '2027-12-31');
    const summary = computeBalance(grants, [leave('2026-05-04', 4)], '2026-06-01');
    // 2026-06-01까지 발생한 월차 4일 중 1일 사용
    expect(summary.nextExpiry).toEqual({ date: '2027-01-14', remainingQ: 12 });
  });

  it('다음 자동 발생을 알려줘요 (수동 보정은 제외)', () => {
    const grants = [
      ...computeAutoGrants('2021-03-02', '2027-12-31'),
      manual('2026-12-01', '2026-12-31', 4),
    ];
    const summary = computeBalance(grants, [], '2026-10-23');
    // 6년차도 17일이에요 (15 + floor(5 / 2)).
    expect(summary.nextGrant).toEqual({ date: '2027-03-02', quarters: 68 });
  });

  it('미래 부여분이 없으면 nextGrant가 없어요', () => {
    const summary = computeBalance(computeAutoGrants('2021-03-02', '2026-10-23'), [], '2026-10-23');
    expect(summary.nextGrant).toBeUndefined();
  });

  it('다음 연차 발생 이후의 계획은 그 부여분에서 차감해요', () => {
    const grants = computeAutoGrants('2021-03-02', '2027-12-31');
    const summary = computeBalance(grants, [leave('2027-03-05', 4)], '2026-10-23');
    const byId = new Map(summary.grants.map((b) => [b.grant.id, b]));
    expect(byId.get('auto-y-6')?.plannedQ).toBe(4);
    // 현재 유효 부여분 합계에는 들어가지 않아요.
    expect(summary.plannedQ).toBe(0);
    expect(summary.remainingQ).toBe(68);
  });
});

describe('expiredQBetween', () => {
  it('앱을 쓰기 시작한 뒤(from 이후) 소멸한 잔여만 세요 (B 계열 보조)', () => {
    // 2021-03-02 입사, 2026-10-23 온보딩. 과거 연차 기간은 사용 기록이 없어 전부 남은 걸로 보이지만 세지 않아요.
    const grants = computeAutoGrants('2021-03-02', '2027-12-31');
    const summary = computeBalance(grants, [leave('2026-11-02', 8)], '2027-03-10');
    expect(summary.expiredQ).toBeGreaterThan(60);
    // 2027-03-01에 소멸한 5년차 17일 중 2일 사용 → 15일(60Q)
    expect(expiredQBetween(summary.grants, '2026-10-23', '2027-03-10')).toBe(60);
  });

  it('아직 소멸 전이거나 잔여가 없으면 0이에요', () => {
    const grants = computeAutoGrants('2021-03-02', '2027-12-31');
    const summary = computeBalance(grants, [], '2026-10-23');
    expect(expiredQBetween(summary.grants, '2026-10-23', '2026-10-23')).toBe(0);
  });
});
