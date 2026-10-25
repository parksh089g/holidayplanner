import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { buildOffDaySet } from '../core/holidays';
import type { Holiday, ISODate } from '../core/types';
import { loadHolidays, mergeHolidays, type LoadedHolidays } from '../data/holidays';
import { listCustomHolidays } from '../db/repo';

export interface HolidaysState {
  /** 공휴일 파일을 아직 불러오는 중 */
  loading: boolean;
  /** 공휴일 + 회사 휴무일, 날짜순 */
  holidays: Holiday[];
  /** 토·일은 빼고 isOffDay와 함께 써요. */
  off: Set<ISODate>;
  missingYears: number[];
  failedYears: number[];
  unverifiedYears: number[];
}

const NO_CUSTOM: Holiday[] = [];

/** 연도별 공휴일 파일과 사용자가 추가한 회사 휴무일(Dexie)을 합쳐요 (SPEC §7). */
export function useHolidays(years: number[]): HolidaysState {
  const key = [...new Set(years)].sort((a, b) => a - b).join(',');
  const custom = useLiveQuery(listCustomHolidays, [], NO_CUSTOM);
  const [loaded, setLoaded] = useState<{ key: string; result: LoadedHolidays }>();

  useEffect(() => {
    let cancelled = false;
    const list = key === '' ? [] : key.split(',').map(Number);
    void loadHolidays(list).then((result) => {
      if (!cancelled) setLoaded({ key, result });
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  const result = loaded?.key === key ? loaded.result : undefined;

  return useMemo(() => {
    const holidays = mergeHolidays(result?.holidays ?? [], custom);
    // 사용자가 추가한 회사 휴무일은 모두 쉬는 날이에요.
    const off = buildOffDaySet(holidays, new Set(custom.map((h) => h.date)));
    return {
      loading: !result,
      holidays,
      off,
      missingYears: result?.missingYears ?? [],
      failedYears: result?.failedYears ?? [],
      unverifiedYears: result?.unverifiedYears ?? [],
    };
  }, [result, custom]);
}
