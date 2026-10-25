/** @vitest-environment jsdom */
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../../src/App';
import type { LeaveEntry } from '../../src/core/types';
import { clearHolidayCache } from '../../src/data/holidays';
import {
  getWorkLog,
  putLeaveEntry,
  putManualGrant,
  putWorkLog,
  saveProfile,
} from '../../src/db/repo';
import { holidayFiles } from '../core/fixtures';
import { resetDb, sampleProfile, workLog } from '../db/fixtures';

const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute);

beforeEach(async () => {
  await resetDb();
  clearHolidayCache();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(at(23, 10)); // 2026-10-23(금) 10:00
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
  await saveProfile(sampleProfile({ onboardedAt: at(23, 9).toISOString() }));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const bulk = (quarters: number): LeaveEntry => ({
  id: 'bulk',
  date: '2026-10-23',
  quarters,
  type: 'annual',
  memo: '앱 사용 전 사용분',
  isBulk: true,
});

async function renderHome() {
  render(
    <MemoryRouter>
      <AppRoutes />
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { level: 1, name: '홈' });
}

const card = async (title: string) =>
  (await screen.findByRole('heading', { level: 2, name: title })).closest('section')!;

describe('홈 (SPEC §8.2)', () => {
  it('잔여 연차 큰 숫자와 사용·계획·잔여, 소멸 D-day를 보여줘요', async () => {
    await putLeaveEntry(bulk(29));
    await putLeaveEntry({ id: 'p', date: '2026-11-02', quarters: 2, part: 'am', type: 'annual' });
    await renderHome();
    const balance = await card('잔여 연차');
    await waitFor(() => expect(balance.textContent).toContain('9.25일'));
    expect(balance.textContent).toContain('17일이 생겼어요');
    expect(within(balance).getByText('사용').nextSibling?.textContent).toBe('7.25일');
    expect(within(balance).getByText('계획').nextSibling?.textContent).toBe('0.5일');
    expect(within(balance).getByText('잔여').nextSibling?.textContent).toBe('9.25일');
    expect(balance.textContent).toContain('2027.03.01 소멸 예정 9.25일 (D-129)');
  });

  it('잔여가 0이면 소멸 D-day를 숨겨요', async () => {
    await putLeaveEntry(bulk(68));
    await renderHome();
    const balance = await card('잔여 연차');
    await waitFor(() =>
      expect(within(balance).getByText('사용').nextSibling?.textContent).toBe('17일'),
    );
    expect(balance.textContent).not.toContain('소멸 예정');
  });

  it('오늘 이후 1위 추천 연휴를 보여주고 더 보기로 추천 화면에 가요', async () => {
    await renderHome();
    const bridge = await card('다음 추천 연휴');
    await waitFor(() => expect(bridge.textContent).toContain('2027년 9/11(토) – 9/16(목)'));
    expect(bridge.textContent).toContain('6일 쉬기 · 연차 1일 · 효율 6');
    expect(bridge.textContent).toContain('연차 쓰는 날: 2027년 9/13(월)');
    expect(bridge.textContent).toContain('추석 연휴, 추석');
    expect(bridge.textContent).not.toContain('추석, 추석 연휴');
    expect(bridge.textContent).not.toContain('잔여 부족');
    expect(within(bridge).getByRole('link', { name: '더 보기' }).getAttribute('href')).toBe(
      '/suggest',
    );
  });

  it('그 시점 잔여 연차가 모자라면 "잔여 부족"을 표시해요 (§5.5-6)', async () => {
    await putManualGrant({
      id: 'cut',
      grantDate: '2027-03-02',
      expireDate: '2028-03-01',
      quarters: -68,
      memo: '6년차 감액',
    });
    await renderHome();
    const bridge = await card('다음 추천 연휴');
    await waitFor(() => expect(bridge.textContent).toContain('잔여 부족'));
  });

  it('다가오는 공휴일 3개를 D-day와 함께 보여줘요', async () => {
    await renderHome();
    const upcoming = await card('다가오는 공휴일');
    await waitFor(() => expect(within(upcoming).getAllByRole('listitem')).toHaveLength(3));
    expect(
      within(upcoming)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['12/25(금) 성탄절D-63', '2027년 1/1(금) 신정D-70', '2027년 2/6(토) 설날 연휴D-106']);
  });
});

describe('오늘 근무 (SPEC §8.2-4, §5.6)', () => {
  it('출근하면 지금 시각을 분 단위로 저장하고, 퇴근하면 근무시간을 보여줘요', async () => {
    vi.setSystemTime(at(23, 9, 7));
    await renderHome();
    const work = await card('오늘 근무');
    expect(work.textContent).toContain('아직 출근 기록이 없어요.');
    fireEvent.click(within(work).getByRole('button', { name: '출근하기' }));
    await waitFor(() => expect(work.textContent).toContain('09:07 출근 · 현재까지 0분'));
    expect(await getWorkLog('2026-10-23')).toEqual({
      date: '2026-10-23',
      clockIn: '09:07',
      clockOut: '',
    });

    vi.setSystemTime(at(23, 18, 37));
    fireEvent.click(within(work).getByRole('button', { name: '퇴근하기' }));
    await waitFor(() => expect(work.textContent).toContain('09:07–18:37 · 8시간 30분 근무'));
    expect(work.textContent).toContain('(연장 추정 30분)');
    expect((await getWorkLog('2026-10-23'))?.clockOut).toBe('18:37');
  });

  it('어제 시작한 야간 근무가 진행 중이면 이어서 퇴근할 수 있어요', async () => {
    vi.setSystemTime(at(23, 1, 30));
    await putWorkLog(workLog('2026-10-22', { clockIn: '22:00', clockOut: '' }));
    await renderHome();
    const work = await card('오늘 근무');
    await waitFor(() =>
      expect(work.textContent).toContain('어제 22:00 출근 · 현재까지 3시간 30분'),
    );
    fireEvent.click(within(work).getByRole('button', { name: '퇴근하기' }));
    await waitFor(async () => expect((await getWorkLog('2026-10-22'))?.clockOut).toBe('01:30'));
  });

  it('출근 시각보다 이른 시각에는 퇴근을 막아요', async () => {
    await putWorkLog(workLog('2026-10-23', { clockIn: '11:00', clockOut: '' }));
    await renderHome();
    const work = await card('오늘 근무');
    fireEvent.click(await within(work).findByRole('button', { name: '퇴근하기' }));
    expect((await within(work).findByRole('alert')).textContent).toContain(
      '출근 시각보다 이른 시각이에요',
    );
    expect((await getWorkLog('2026-10-23'))?.clockOut).toBe('');
  });

  it('이번 주 실근로·연장(추정)과 주 52시간 게이지를 보여줘요', async () => {
    // 월–목 08:00–21:00 (점심 1시간 빼고 하루 12시간) = 48시간
    for (const day of ['19', '20', '21', '22']) {
      await putWorkLog(workLog(`2026-10-${day}`, { clockIn: '08:00', clockOut: '21:00' }));
    }
    await renderHome();
    const work = await card('오늘 근무');
    await waitFor(() => expect(work.textContent).toContain('이번 주 실근로 48시간'));
    expect(work.textContent).toContain('연장(추정) 16시간');
    expect(work.textContent).toContain('52시간까지 4시간 남았어요.');
    expect(work.textContent).toContain('48시간 이상');
    const meter = within(work).getByRole('meter', { name: '주 52시간 대비 실근로' });
    expect(meter.getAttribute('aria-valuenow')).toBe('2880');
    expect(work.textContent).toContain('법적 판단이 아니에요');
  });

  it('오늘이 휴무일이나 휴가면 알려줘요', async () => {
    vi.setSystemTime(at(24, 10)); // 토요일
    await renderHome();
    expect((await card('오늘 근무')).textContent).toContain('오늘은 쉬는 날이에요.');
    cleanup();

    vi.setSystemTime(at(26, 10));
    await putLeaveEntry({ id: 'v', date: '2026-10-26', quarters: 4, type: 'annual' });
    await renderHome();
    await waitFor(async () =>
      expect((await card('오늘 근무')).textContent).toContain('오늘은 휴가예요.'),
    );
  });
});
