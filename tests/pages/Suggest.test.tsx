/** @vitest-environment jsdom */
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../../src/App';
import { clearHolidayCache } from '../../src/data/holidays';
import { listLeaveEntries, putLeaveEntry, saveProfile } from '../../src/db/repo';
import { DEFAULT_SUGGEST_FILTERS, useSuggestStore } from '../../src/store/suggest';
import { holidayFiles } from '../core/fixtures';
import { leave, resetDb, sampleProfile } from '../db/fixtures';

beforeEach(async () => {
  await resetDb();
  clearHolidayCache();
  useSuggestStore.setState(DEFAULT_SUGGEST_FILTERS);
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 23, 10, 0)); // 2026-10-23(금)
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const year = Number(/(\d{4})\.json$/.exec(url)?.[1]);
      const file = holidayFiles.find((f) => f.year === year);
      return file
        ? { ok: true, status: 200, json: async () => file }
        : { ok: false, status: 404, json: async () => ({}) };
    }),
  );
  window.matchMedia = vi.fn().mockImplementation(() => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  await saveProfile(sampleProfile());
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function renderSuggest() {
  render(
    <MemoryRouter initialEntries={['/suggest']}>
      <AppRoutes />
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { level: 1, name: '추천' });
}

/** 후보 카드 제목(구간)들 */
const titles = async () =>
  (await screen.findAllByRole('heading', { level: 2 })).map((h) => h.textContent);
const card = async (title: string) =>
  (await screen.findByRole('heading', { level: 2, name: title })).closest('li')!;
const setSelect = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('추천 (SPEC §8.4)', () => {
  it('기본 필터(연차 3일, 4일 이상, 공휴일 포함)로 오늘 이후 후보를 효율순으로 보여줘요', async () => {
    await renderSuggest();
    expect((await titles())[0]).toBe('2027년 9/11(토) – 9/16(목)');
    const first = await card('2027년 9/11(토) – 9/16(목)');
    expect(first.textContent).toContain('6일 쉬기 · 연차 1일 · 효율 6');
    expect(first.textContent).toContain('연차 쓸 날: 2027년 9/13(월)');
    expect(screen.getByText(/^후보 \d+개/)).toBeTruthy();
    expect(screen.getByRole('switch', { name: '공휴일 포함만' }).getAttribute('aria-checked')).toBe(
      'true',
    );
  });

  it('SPEC 예시: 연차 5일로 9/24(목) – 10/5(월) 12일, 효율 2.4', async () => {
    vi.setSystemTime(new Date(2026, 8, 1, 10, 0));
    await renderSuggest();
    setSelect('연차 최대', '5');
    setSelect('연도', '2026');
    const spec = await card('9/24(목) – 10/5(월)');
    expect(spec.textContent).toContain('12일 쉬기 · 연차 5일 · 효율 2.4');
    expect(spec.textContent).toContain(
      '연차 쓸 날: 9/28(월), 9/29(화), 9/30(수), 10/1(목), 10/2(금)',
    );
    expect(spec.textContent).toContain('추석 연휴, 추석, 개천절, 대체공휴일(개천절)');
  });

  it('연도를 고르면 그 해 안에서만 찾고, 없으면 안내해요', async () => {
    await renderSuggest();
    await titles();
    setSelect('연도', '2026');
    expect(await screen.findByText(/조건에 맞는 연휴가 없어요/)).toBeTruthy();
    setSelect('연차 최대', '4');
    expect(await titles()).toContain('12/19(토) – 12/27(일)');
    setSelect('연도', '2027');
    expect((await titles())[0]).toBe('2027년 9/11(토) – 9/16(목)');
  });

  it('"공휴일 포함만"을 끄면 주말만 낀 구간도 나와요', async () => {
    await renderSuggest();
    setSelect('연차 최대', '5');
    setSelect('연도', '2026');
    await titles();
    expect(screen.queryByRole('heading', { level: 2, name: '11/7(토) – 11/15(일)' })).toBeNull();
    fireEvent.click(screen.getByRole('switch', { name: '공휴일 포함만' }));
    expect(await card('11/7(토) – 11/15(일)')).toBeTruthy();
  });

  it('그 시점 잔여가 모자라면 "잔여 부족"을 표시해요', async () => {
    await putLeaveEntry({ ...leave('bulk', '2026-10-23', { quarters: 68, isBulk: true }) });
    await renderSuggest();
    expect((await card('2027년 9/11(토) – 9/16(목)')).textContent).not.toContain('잔여 부족');
    setSelect('연도', '2026');
    setSelect('연차 최대', '4');
    await waitFor(async () =>
      expect((await card('12/19(토) – 12/27(일)')).textContent).toContain('잔여 부족'),
    );
  });

  it('계획에 넣으면 연차를 만들고, 되돌리기로 지워요', async () => {
    await renderSuggest();
    const first = await card('2027년 9/11(토) – 9/16(목)');
    fireEvent.click(within(first).getByRole('button', { name: /계획에 넣기$/ }));
    expect(await screen.findByText('연차 1일을 계획에 넣었어요.')).toBeTruthy();
    const added = await listLeaveEntries();
    expect(added).toEqual([
      expect.objectContaining({
        date: '2027-09-13',
        quarters: 4,
        type: 'annual',
        memo: '추천 연휴',
      }),
    ]);
    // 계획한 날은 쉬는 날로 보여서 더 긴 연휴가 맨 위로 와요 (R4).
    await waitFor(async () => expect((await titles())[0]).toBe('2027년 9/11(토) – 9/19(일)'));

    fireEvent.click(screen.getByRole('button', { name: '되돌리기' }));
    expect(await screen.findByText('되돌렸어요.')).toBeTruthy();
    expect(await listLeaveEntries()).toEqual([]);
    await waitFor(async () => expect((await titles())[0]).toBe('2027년 9/11(토) – 9/16(목)'));
  });

  it('이미 반차가 있는 날이 끼어 있으면 넣지 않고 알려줘요', async () => {
    await putLeaveEntry(leave('half', '2027-09-13', { quarters: 2, part: 'am' }));
    await renderSuggest();
    const first = await card('2027년 9/11(토) – 9/16(목)');
    fireEvent.click(within(first).getByRole('button', { name: /계획에 넣기$/ }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      '2027년 9/13(월)에 이미 휴가가 있어서 넣지 못했어요. 달력에서 확인해 주세요.',
    );
    expect(await listLeaveEntries()).toHaveLength(1);
  });

  it('필터는 다른 화면에 다녀와도 유지돼요', async () => {
    await renderSuggest();
    setSelect('연차 최대', '7');
    fireEvent.click(
      within(screen.getByRole('navigation', { name: '하단 탭' })).getByRole('link', { name: '홈' }),
    );
    await screen.findByRole('heading', { level: 1, name: '홈' });
    fireEvent.click(
      within(screen.getByRole('navigation', { name: '하단 탭' })).getByRole('link', {
        name: '추천',
      }),
    );
    await screen.findByRole('heading', { level: 1, name: '추천' });
    expect((screen.getByLabelText('연차 최대') as HTMLSelectElement).value).toBe('7');
  });
});
