import { addDaysISO, addMonthsISO, addYearsISO } from './date';
import { QUARTERS_PER_DAY, type AutoGrant, type ISODate } from './types';

const MAX_ANNUAL_DAYS = 25;

/** 근속 n년차에 발생하는 연차 일수 (근로기준법 제60조 제1·4항) */
export function annualDaysFor(serviceYear: number): number {
  return Math.min(MAX_ANNUAL_DAYS, 15 + Math.floor((serviceYear - 1) / 2));
}

/**
 * 입사일 기준 자동 발생 연차 (SPEC §5.1).
 * grantDate <= until인 부여분만 발생일 오름차순으로 돌려줘요.
 */
export function computeAutoGrants(hireDate: ISODate, until: ISODate): AutoGrant[] {
  const grants: AutoGrant[] = [];

  // 1년 미만 월차: 최초 1년 근로가 끝날 때까지 사용 (2020.3.31 개정)
  const firstYearEnd = addDaysISO(addYearsISO(hireDate, 1), -1);
  for (let k = 1; k <= 11; k++) {
    const grantDate = addMonthsISO(hireDate, k);
    if (grantDate > until) return grants;
    grants.push({
      id: `auto-m-${k}`,
      kind: 'monthly',
      grantDate,
      expireDate: firstYearEnd,
      quarters: QUARTERS_PER_DAY,
      serviceYear: 0,
    });
  }

  for (let n = 1; ; n++) {
    const grantDate = addYearsISO(hireDate, n);
    if (grantDate > until) return grants;
    grants.push({
      id: `auto-y-${n}`,
      kind: 'annual',
      grantDate,
      expireDate: addDaysISO(addYearsISO(hireDate, n + 1), -1),
      quarters: annualDaysFor(n) * QUARTERS_PER_DAY,
      serviceYear: n,
    });
  }
}

export interface LeavePeriod {
  start: ISODate;
  end: ISODate;
  /** 지금까지 발생한 양. 입사 1년 미만이면 월차 누적이에요. */
  grantedQ: number;
  /** 입사 1년 미만(월차 기간) */
  firstYear: boolean;
}

/**
 * asOf가 속한 연차 기간과 발생량 (SPEC §8.1 온보딩 안내).
 * 사용자가 인사시스템 숫자와 비교할 수 있게 보여줘요. 입사 전이면 undefined예요.
 */
export function currentLeavePeriod(hireDate: ISODate, asOf: ISODate): LeavePeriod | undefined {
  if (asOf < hireDate) return undefined;
  const grants = computeAutoGrants(hireDate, asOf);
  const latest = grants[grants.length - 1];
  if (!latest || latest.kind === 'monthly') {
    return {
      start: hireDate,
      end: addDaysISO(addYearsISO(hireDate, 1), -1),
      grantedQ: grants.reduce((total, g) => total + g.quarters, 0),
      firstYear: true,
    };
  }
  return {
    start: latest.grantDate,
    end: latest.expireDate,
    grantedQ: latest.quarters,
    firstYear: false,
  };
}
