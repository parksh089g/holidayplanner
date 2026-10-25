import { compareISO } from '../core/date';
import type { Holiday, HolidayFile, HolidayKind } from '../core/types';
import { ValidationError, isISODate } from '../db/validate';

/** fetch에서 쓰는 부분만 (테스트에서 바꿔 끼워요) */
export type FetchLike = (
  url: string,
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

export type YearResult =
  { status: 'ok'; file: HolidayFile } | { status: 'missing' } | { status: 'error' };

export interface LoadedHolidays {
  /** 날짜 오름차순 */
  holidays: Holiday[];
  /** 파일이 없는 연도: 주말만 휴무로 계산해요 (SPEC §7). */
  missingYears: number[];
  /** 네트워크·서버 오류나 형식 오류로 불러오지 못한 연도. 다음에 다시 시도해요. */
  failedYears: number[];
  /** verified: false인 연도 */
  unverifiedYears: number[];
}

const PUBLIC_KINDS = new Set<HolidayKind>(['legal', 'substitute', 'election', 'temporary']);

export const holidayUrl = (year: number) => `${import.meta.env.BASE_URL}holidays/${year}.json`;

function check(condition: boolean, message: string): asserts condition {
  if (!condition) throw new ValidationError(message);
}

/** public/holidays/{year}.json 형식을 검사하고 필요한 필드만 남겨요. */
export function parseHolidayFile(data: unknown, year: number): HolidayFile {
  check(typeof data === 'object' && data !== null, `${year}년 공휴일 파일이 객체가 아니에요.`);
  const raw = data as Record<string, unknown>;
  check(raw.year === year, `${year}년 파일의 year 값이 달라요.`);
  check(typeof raw.source === 'string', `${year}년 파일에 source가 없어요.`);
  check(typeof raw.verified === 'boolean', `${year}년 파일에 verified가 없어요.`);
  check(Array.isArray(raw.holidays), `${year}년 파일의 holidays가 배열이 아니에요.`);

  const holidays = raw.holidays.map((item: unknown): Holiday => {
    const h = (item ?? {}) as Record<string, unknown>;
    check(
      isISODate(h.date) && h.date.startsWith(`${year}-`),
      `${year}년 파일에 잘못된 날짜가 있어요: ${String(h.date)}`,
    );
    check(typeof h.name === 'string' && h.name.trim() !== '', `${h.date} 공휴일 이름이 없어요.`);
    check(PUBLIC_KINDS.has(h.kind as HolidayKind), `${h.date} 공휴일 종류가 올바르지 않아요.`);
    return { date: h.date, name: h.name, kind: h.kind as HolidayKind };
  });

  return { year, source: raw.source, verified: raw.verified, holidays };
}

const cache = new Map<number, Promise<YearResult>>();

/** 테스트용 */
export const clearHolidayCache = () => cache.clear();

async function fetchYear(year: number, fetcher: FetchLike): Promise<YearResult> {
  let response: Awaited<ReturnType<FetchLike>>;
  try {
    response = await fetcher(holidayUrl(year));
  } catch {
    return { status: 'error' };
  }
  if (response.status === 404) return { status: 'missing' };
  if (!response.ok) return { status: 'error' };
  try {
    return { status: 'ok', file: parseHolidayFile(await response.json(), year) };
  } catch (error) {
    console.warn(`${year}년 공휴일 데이터를 읽지 못했어요.`, error);
    return { status: 'error' };
  }
}

/**
 * 한 해의 공휴일 파일을 불러와요. 결과는 메모리에 캐시하고, 오류(error)만 캐시하지 않아
 * 다음 호출에서 다시 시도해요. 오프라인 캐시는 서비스워커가 맡아요 (T3-1).
 */
export function loadHolidayYear(
  year: number,
  fetcher: FetchLike = (url) => fetch(url),
): Promise<YearResult> {
  const cached = cache.get(year);
  if (cached) return cached;
  const pending = fetchYear(year, fetcher).then((result) => {
    if (result.status === 'error') cache.delete(year);
    return result;
  });
  cache.set(year, pending);
  return pending;
}

export async function loadHolidays(years: number[], fetcher?: FetchLike): Promise<LoadedHolidays> {
  const sorted = [...new Set(years)].sort((a, b) => a - b);
  const results = await Promise.all(sorted.map((year) => loadHolidayYear(year, fetcher)));
  const loaded: LoadedHolidays = {
    holidays: [],
    missingYears: [],
    failedYears: [],
    unverifiedYears: [],
  };
  results.forEach((result, i) => {
    const year = sorted[i];
    if (result.status === 'missing') loaded.missingYears.push(year);
    else if (result.status === 'error') loaded.failedYears.push(year);
    else {
      loaded.holidays.push(...result.file.holidays);
      if (!result.file.verified) loaded.unverifiedYears.push(year);
    }
  });
  loaded.holidays.sort((a, b) => compareISO(a.date, b.date));
  return loaded;
}

/** 공휴일과 사용자 회사 휴무일을 날짜순으로 합쳐요. 같은 날이면 공휴일이 먼저예요. */
export function mergeHolidays(publicHolidays: Holiday[], customHolidays: Holiday[]): Holiday[] {
  return [...publicHolidays, ...customHolidays].sort((a, b) => compareISO(a.date, b.date));
}
