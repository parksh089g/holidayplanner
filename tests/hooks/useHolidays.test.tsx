/** @vitest-environment jsdom */
import 'fake-indexeddb/auto';
import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isOffDay } from '../../src/core/holidays';
import { clearHolidayCache } from '../../src/data/holidays';
import { putCustomHoliday } from '../../src/db/repo';
import { useHolidays } from '../../src/hooks/useHolidays';
import Calendar from '../../src/pages/Calendar';
import { holidayFiles } from '../core/fixtures';
import { resetDb } from '../db/fixtures';

function stubFetch(available: number[], { offline = false } = {}) {
  const fetcher = vi.fn(async (url: string) => {
    if (offline) throw new TypeError('Failed to fetch');
    const year = Number(/(\d{4})\.json$/.exec(url)?.[1]);
    const file = available.includes(year) ? holidayFiles.find((f) => f.year === year) : undefined;
    return file
      ? { ok: true, status: 200, json: async () => file }
      : { ok: false, status: 404, json: async () => ({}) };
  });
  vi.stubGlobal('fetch', fetcher);
  return fetcher;
}

beforeEach(async () => {
  clearHolidayCache();
  await resetDb();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('useHolidays', () => {
  it('공휴일 파일을 불러와 휴무일 집합을 만들어요', async () => {
    stubFetch([2026]);
    const { result } = renderHook(() => useHolidays([2026]));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(isOffDay('2026-03-02', result.current.off)).toBe(true); // 대체공휴일
    expect(isOffDay('2026-03-03', result.current.off)).toBe(false);
    expect(result.current.unverifiedYears).toEqual([2026]);
    expect(result.current.missingYears).toEqual([]);
  });

  it('사용자가 추가한 회사 휴무일을 바로 합쳐요', async () => {
    stubFetch([2026]);
    const { result } = renderHook(() => useHolidays([2026]));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(() => putCustomHoliday({ date: '2026-04-15', name: '창립기념일', kind: 'company' }));
    await waitFor(() => expect(isOffDay('2026-04-15', result.current.off)).toBe(true));
    expect(result.current.holidays.some((h) => h.name === '창립기념일')).toBe(true);
  });

  it('파일이 없는 연도와 불러오지 못한 연도를 구분해요', async () => {
    stubFetch([2026]);
    const { result } = renderHook(() => useHolidays([2026, 2030]));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.missingYears).toEqual([2030]);

    clearHolidayCache();
    stubFetch([], { offline: true });
    const offline = renderHook(() => useHolidays([2026]));
    await waitFor(() => expect(offline.result.current.loading).toBe(false));
    expect(offline.result.current.failedYears).toEqual([2026]);
    expect(offline.result.current.holidays).toEqual([]);
  });

  it('같은 연도 목록이면 순서가 달라도 다시 불러오지 않아요', async () => {
    const fetcher = stubFetch([2026, 2027]);
    const { result, rerender } = renderHook(({ years }) => useHolidays(years), {
      initialProps: { years: [2026, 2027] },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    rerender({ years: [2027, 2026] });
    expect(result.current.loading).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe('달력 화면 배너', () => {
  const renderCalendar = () =>
    render(
      <MemoryRouter>
        <Calendar />
      </MemoryRouter>,
    );

  it('올해 파일이 없으면 "공휴일 데이터가 없어요" 배너를 보여줘요', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2030, 4, 1));
    stubFetch([2026, 2027]);
    renderCalendar();
    expect((await screen.findByRole('status')).textContent).toContain(
      '2030년 공휴일 데이터가 없어요. 주말만 휴무로 계산해요.',
    );
  });

  it('올해 파일이 있으면 배너가 없어요', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 25));
    const fetcher = stubFetch([2026]);
    renderCalendar();
    await waitFor(() => expect(fetcher).toHaveBeenCalled());
    await act(async () => {});
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('오프라인이라 불러오지 못하면 그렇게 알려줘요', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 25));
    stubFetch([], { offline: true });
    renderCalendar();
    expect((await screen.findByRole('status')).textContent).toContain(
      '2026년 공휴일 데이터를 불러오지 못했어요',
    );
  });
});
