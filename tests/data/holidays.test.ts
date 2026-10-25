import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Holiday } from '../../src/core/types';
import {
  clearHolidayCache,
  holidayUrl,
  loadHolidayYear,
  loadHolidays,
  mergeHolidays,
  parseHolidayFile,
  prefetchHolidayFiles,
  type FetchLike,
} from '../../src/data/holidays';
import { ValidationError } from '../../src/db/validate';
import { holidayFiles } from '../core/fixtures';

const file2026 = holidayFiles.find((f) => f.year === 2026)!;
const file2027 = holidayFiles.find((f) => f.year === 2027)!;

/** 연도별 응답을 흉내 내요. 없는 연도는 404예요. */
function fakeFetch(responses: Record<number, unknown>): FetchLike & ReturnType<typeof vi.fn> {
  return vi.fn(async (url: string) => {
    const year = Number(/(\d{4})\.json$/.exec(url)?.[1]);
    if (!(year in responses)) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => responses[year] };
  });
}

beforeEach(clearHolidayCache);
afterEach(() => vi.restoreAllMocks());

describe('holidayUrl', () => {
  it('배포 경로(base) 아래 holidays/{year}.json이에요', () => {
    expect(holidayUrl(2026)).toBe('/holidayplanner/holidays/2026.json');
  });
});

describe('parseHolidayFile', () => {
  it.each(holidayFiles)('저장소의 $year.json은 통과해요', (file) => {
    expect(parseHolidayFile(JSON.parse(JSON.stringify(file)), file.year)).toEqual(file);
  });

  it('필요 없는 필드는 버려요', () => {
    const parsed = parseHolidayFile(
      { ...file2026, extra: 1, holidays: [{ ...file2026.holidays[0], note: 'x' }] },
      2026,
    );
    expect(parsed).toEqual({ ...file2026, holidays: [file2026.holidays[0]] });
  });

  const h = (overrides: Partial<Holiday>) => ({
    date: '2026-01-01',
    name: '신정',
    kind: 'legal',
    ...overrides,
  });
  it.each([
    ['객체가 아님', null],
    ['연도가 다름', { ...file2026, year: 2027 }],
    ['verified 없음', { year: 2026, source: '', holidays: [] }],
    ['holidays가 배열이 아님', { ...file2026, holidays: {} }],
    ['그 해가 아닌 날짜', { ...file2026, holidays: [h({ date: '2027-01-01' })] }],
    ['없는 날짜', { ...file2026, holidays: [h({ date: '2026-02-30' })] }],
    ['빈 이름', { ...file2026, holidays: [h({ name: ' ' })] }],
    ['회사 휴무일 포함', { ...file2026, holidays: [h({ kind: 'company' })] }],
  ])('%s이면 거부해요', (_, data) => {
    expect(() => parseHolidayFile(data, 2026)).toThrow(ValidationError);
  });
});

describe('loadHolidayYear', () => {
  it('불러온 연도는 메모리에 캐시해요', async () => {
    const fetcher = fakeFetch({ 2026: file2026 });
    expect(await loadHolidayYear(2026, fetcher)).toEqual({ status: 'ok', file: file2026 });
    expect(await loadHolidayYear(2026, fetcher)).toEqual({ status: 'ok', file: file2026 });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledWith('/holidayplanner/holidays/2026.json');
  });

  it('동시에 여러 번 불러도 요청은 한 번이에요', async () => {
    const fetcher = fakeFetch({ 2026: file2026 });
    await Promise.all([loadHolidayYear(2026, fetcher), loadHolidayYear(2026, fetcher)]);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('파일이 없으면(404) missing이고 다시 요청하지 않아요', async () => {
    const fetcher = fakeFetch({});
    expect(await loadHolidayYear(2030, fetcher)).toEqual({ status: 'missing' });
    expect(await loadHolidayYear(2030, fetcher)).toEqual({ status: 'missing' });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('서버 오류는 error이고 다음에 다시 요청해요', async () => {
    const fetcher = vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) }));
    expect(await loadHolidayYear(2026, fetcher)).toEqual({ status: 'error' });
    await loadHolidayYear(2026, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('네트워크 오류(오프라인)도 error이고 다음에 다시 요청해요', async () => {
    const fetcher = vi
      .fn<FetchLike>()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => file2026 });
    expect(await loadHolidayYear(2026, fetcher)).toEqual({ status: 'error' });
    expect(await loadHolidayYear(2026, fetcher)).toEqual({ status: 'ok', file: file2026 });
  });

  it('형식이 틀린 파일은 error로 보고 경고를 남겨요', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetcher = fakeFetch({ 2026: { ...file2026, year: 2025 } });
    expect(await loadHolidayYear(2026, fetcher)).toEqual({ status: 'error' });
    expect(warn).toHaveBeenCalledOnce();
  });

  it('기본으로 전역 fetch를 써요', async () => {
    const fetcher = fakeFetch({ 2026: file2026 });
    vi.stubGlobal('fetch', fetcher);
    try {
      expect((await loadHolidayYear(2026)).status).toBe('ok');
      expect(fetcher).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('loadHolidays', () => {
  it('여러 해를 합쳐 날짜순으로 돌려주고 없는·미검증 연도를 알려줘요', async () => {
    const fetcher = fakeFetch({ 2026: file2026, 2027: file2027 });
    const result = await loadHolidays([2027, 2026, 2028], fetcher);
    const dates = result.holidays.map((x) => x.date);
    expect(dates).toEqual([...dates].sort());
    expect(dates).toHaveLength(file2026.holidays.length + file2027.holidays.length);
    expect(result.missingYears).toEqual([2028]);
    expect(result.failedYears).toEqual([]);
    expect(result.unverifiedYears).toEqual([2026, 2027]);
  });

  it('불러오지 못한 연도는 failedYears로 알려줘요', async () => {
    const fetcher = vi.fn<FetchLike>().mockRejectedValue(new TypeError('offline'));
    const result = await loadHolidays([2026], fetcher);
    expect(result).toEqual({
      holidays: [],
      missingYears: [],
      failedYears: [2026],
      unverifiedYears: [],
    });
  });
});

describe('mergeHolidays', () => {
  it('공휴일과 회사 휴무일을 날짜순으로 합쳐요 (같은 날이면 둘 다 둬요)', () => {
    const company: Holiday[] = [
      { date: '2026-05-01', name: '창립기념일', kind: 'company' },
      { date: '2026-04-15', name: '워크숍', kind: 'company' },
    ];
    const merged = mergeHolidays(file2026.holidays, company);
    expect(merged).toHaveLength(file2026.holidays.length + 2);
    expect(merged.filter((x) => x.date === '2026-05-01').map((x) => x.name)).toEqual([
      '노동절',
      '창립기념일',
    ]);
    const dates = merged.map((x) => x.date);
    expect(dates).toEqual([...dates].sort());
  });
});

describe('prefetchHolidayFiles', () => {
  it('연도별 파일을 다시 요청하고, 실패해도 예외를 내지 않아요', async () => {
    const fetcher = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => file2026 })
      .mockRejectedValueOnce(new TypeError('offline'));
    await expect(prefetchHolidayFiles([2026, 2027], fetcher)).resolves.toBeUndefined();
    expect(fetcher.mock.calls.map((c) => c[0])).toEqual([
      '/holidayplanner/holidays/2026.json',
      '/holidayplanner/holidays/2027.json',
    ]);
  });

  it('메모리 캐시와 따로 움직여요 (캐시된 연도도 다시 요청해요)', async () => {
    const fetcher = fakeFetch({ 2026: file2026 });
    await loadHolidayYear(2026, fetcher);
    await prefetchHolidayFiles([2026], fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
