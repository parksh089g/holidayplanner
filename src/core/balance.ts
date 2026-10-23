import type { AutoGrant, Grant, ISODate, LeaveEntry } from './types';

export interface GrantBalance {
  grant: Grant;
  /** asOf 이전(포함) 사용분 */
  usedQ: number;
  /** asOf 이후 계획분 */
  plannedQ: number;
  /** quarters - usedQ - plannedQ. 음수면 초과 사용이에요. */
  remainingQ: number;
}

export interface OverdrawnEntry {
  entryId: string;
  date: ISODate;
  /** 부여분에서 차감하지 못한 양 */
  overdrawnQ: number;
}

export interface BalanceSummary {
  asOf: ISODate;
  /** 입력한 모든 부여분 (발생일 오름차순) */
  grants: GrantBalance[];
  /** grantDate <= asOf <= expireDate인 부여분 (소멸일 오름차순) */
  activeGrants: GrantBalance[];
  totalGrantedQ: number;
  usedQ: number;
  plannedQ: number;
  remainingQ: number;
  /** asOf 전에 소멸한 부여분의 남은 양 */
  expiredQ: number;
  overdrawn: OverdrawnEntry[];
  /** 가장 빨리 소멸하는, 잔여가 남은 부여분 */
  nextExpiry?: { date: ISODate; remainingQ: number };
  /** 다음 자동 발생 */
  nextGrant?: { date: ISODate; quarters: number };
}

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

const isValidOn = (grant: Grant, date: ISODate) =>
  grant.grantDate <= date && date <= grant.expireDate;

const isAutoGrant = (grant: Grant): grant is AutoGrant => 'kind' in grant;

const sum = (balances: GrantBalance[], pick: (b: GrantBalance) => number) =>
  balances.reduce((total, b) => total + pick(b), 0);

/**
 * 부여분별 사용·계획·잔여를 계산해요 (SPEC §5.3).
 *
 * 연차(type 'annual') 휴가를 날짜 오름차순으로, 그 날짜에 유효한 부여분 중 소멸일이 빠른 것부터
 * 차감해요. 차감하지 못한 양은 overdrawn으로 알려주고, 유효한 부여분이 있으면 소멸이 가장 늦은
 * 부여분에 음수로 반영해요.
 *
 * nextGrant를 알려면 grants에 asOf 이후 자동 발생분도 넣어야 해요
 * (예: computeAutoGrants(hireDate, addYearsISO(asOf, 1))).
 */
export function computeBalance(
  grants: Grant[],
  entries: LeaveEntry[],
  asOf: ISODate,
): BalanceSummary {
  const balances: GrantBalance[] = [...grants]
    .sort((a, b) => compare(a.grantDate, b.grantDate) || compare(a.id, b.id))
    .map((grant) => ({ grant, usedQ: 0, plannedQ: 0, remainingQ: grant.quarters }));
  const byExpiry = [...balances].sort(
    (a, b) =>
      compare(a.grant.expireDate, b.grant.expireDate) ||
      compare(a.grant.grantDate, b.grant.grantDate) ||
      compare(a.grant.id, b.grant.id),
  );

  const annualEntries = entries
    .filter((e) => e.type === 'annual')
    .sort(
      (a, b) =>
        compare(a.date, b.date) || Number(!!b.isBulk) - Number(!!a.isBulk) || compare(a.id, b.id),
    );

  const overdrawn: OverdrawnEntry[] = [];
  for (const entry of annualEntries) {
    const isUsed = entry.date <= asOf;
    const charge = (balance: GrantBalance, quarters: number) => {
      if (isUsed) balance.usedQ += quarters;
      else balance.plannedQ += quarters;
      balance.remainingQ -= quarters;
    };

    const valid = byExpiry.filter((b) => isValidOn(b.grant, entry.date));
    let left = entry.quarters;
    for (const balance of valid) {
      if (left <= 0) break;
      const take = Math.min(left, balance.remainingQ);
      if (take <= 0) continue;
      charge(balance, take);
      left -= take;
    }

    if (left > 0) {
      const latest = valid[valid.length - 1];
      if (latest) charge(latest, left);
      overdrawn.push({ entryId: entry.id, date: entry.date, overdrawnQ: left });
    }
  }

  const activeGrants = byExpiry.filter((b) => isValidOn(b.grant, asOf));

  const expiredQ = sum(
    balances.filter((b) => b.grant.expireDate < asOf),
    (b) => Math.max(0, b.remainingQ),
  );

  let nextExpiry: BalanceSummary['nextExpiry'];
  const expiring = activeGrants.find((b) => b.remainingQ > 0);
  if (expiring) {
    const date = expiring.grant.expireDate;
    nextExpiry = {
      date,
      remainingQ: sum(
        activeGrants.filter((b) => b.grant.expireDate === date),
        (b) => Math.max(0, b.remainingQ),
      ),
    };
  }

  const upcoming = balances.find((b) => isAutoGrant(b.grant) && b.grant.grantDate > asOf);
  const nextGrant = upcoming
    ? { date: upcoming.grant.grantDate, quarters: upcoming.grant.quarters }
    : undefined;

  return {
    asOf,
    grants: balances,
    activeGrants,
    totalGrantedQ: sum(activeGrants, (b) => b.grant.quarters),
    usedQ: sum(activeGrants, (b) => b.usedQ),
    plannedQ: sum(activeGrants, (b) => b.plannedQ),
    remainingQ: sum(activeGrants, (b) => b.remainingQ),
    expiredQ,
    overdrawn,
    nextExpiry,
    nextGrant,
  };
}
