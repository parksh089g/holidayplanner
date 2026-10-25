/** @vitest-environment jsdom */
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../../src/App';
import { clearHolidayCache } from '../../src/data/holidays';
import {
  getWorkLog,
  listWorkLogs,
  putLeaveEntry,
  putWorkLog,
  saveProfile,
} from '../../src/db/repo';
import { useWorkStore } from '../../src/store/work';
import { holidayFiles } from '../core/fixtures';
import { leave, resetDb, sampleProfile, workLog } from '../db/fixtures';

async function setup(onboardedOn: string) {
  const [y, m, d] = onboardedOn.split('-').map(Number);
  await saveProfile(sampleProfile({ onboardedAt: new Date(y, m - 1, d, 9).toISOString() }));
}

beforeEach(async () => {
  await resetDb();
  clearHolidayCache();
  useWorkStore.setState({ weekStart: undefined });
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 23, 14, 0)); // 2026-10-23(금) 14:00
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
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function renderWork() {
  render(
    <MemoryRouter initialEntries={['/work']}>
      <AppRoutes />
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { level: 1, name: '근무' });
}

const weekSection = () => screen.findByRole('region', { name: '주간 근무' });
const dayButton = async (month: number, day: number) =>
  within(await weekSection()).findByRole('button', {
    name: new RegExp(`^${month}월 ${day}일 `),
  });
/** 주간 막대에서 접근 가능한 이름이 정확히 name인 날 (스크린리더가 듣는 이름) */
const expectDay = async (name: string) =>
  expect(await within(await weekSection()).findByRole('button', { name })).toBeTruthy();

describe('근무 화면: 주 단위 (SPEC §8.5)', () => {
  it('요일별로 실근로·초과·휴가 인정 시간을 보여주고 주 합계를 내요', async () => {
    await setup('2026-10-19');
    await putWorkLog(workLog('2026-10-19', { clockIn: '09:00', clockOut: '20:00' }));
    await putLeaveEntry(leave('full', '2026-10-20'));
    await putLeaveEntry(leave('half', '2026-10-21', { quarters: 2, part: 'am' }));
    await putWorkLog(workLog('2026-10-21', { clockIn: '14:00', clockOut: '18:00' }));
    await putWorkLog(workLog('2026-10-23', { clockIn: '09:00', clockOut: '' }));
    await renderWork();

    const section = await weekSection();
    expect(within(section).getByRole('heading', { level: 2 }).textContent).toBe(
      '10/19(월) – 10/25(일)',
    );
    expect(within(section).getByText('이번 주')).toBeTruthy();
    await expectDay('10월 19일 월요일, 10시간 · 초과 2시간');
    await expectDay('10월 20일 화요일, 휴가 8시간');
    await expectDay('10월 21일 수요일, 4시간 · 휴가 4시간');
    await expectDay('10월 22일 목요일, 기록 없음');
    await expectDay('10월 23일 금요일, 오늘, 4시간');
    await expectDay('10월 24일 토요일, 쉬는 날, 기록 없음');
    // 실근로 600 + 240 + 240(진행 중, 점심 제외) = 18시간
    expect(section.textContent).toContain('이번 주 실근로 18시간 · 연장(추정) 2시간');
    expect(section.textContent).toContain('52시간까지 34시간 남았어요.');
  });

  it('이전·다음 주로 옮기고 이번 주로 돌아와요 (공휴일 표시)', async () => {
    await setup('2026-10-01');
    await renderWork();
    // 이번 주(10/19)에서 두 주 전
    fireEvent.click(await screen.findByRole('button', { name: '이전 주' }));
    fireEvent.click(screen.getByRole('button', { name: '이전 주' }));
    const section = await weekSection();
    await within(section).findByRole('heading', { level: 2, name: '10/5(월) – 10/11(일)' });
    await expectDay('10월 5일 월요일, 대체공휴일(개천절), 기록 없음');
    await expectDay('10월 9일 금요일, 한글날, 기록 없음');
    expect(section.textContent).toContain('이 주 실근로');
    fireEvent.click(within(section).getByRole('button', { name: '이번 주로' }));
    await within(section).findByRole('heading', { level: 2, name: '10/19(월) – 10/25(일)' });
    fireEvent.click(screen.getByRole('button', { name: '다음 주' }));
    await within(section).findByRole('heading', { level: 2, name: '10/26(월) – 11/1(일)' });
  });

  it('52시간을 넘긴 주는 "52시간 초과"로 알려줘요', async () => {
    await setup('2026-10-01');
    for (const d of ['12', '13', '14', '15', '16']) {
      await putWorkLog(workLog(`2026-10-${d}`, { clockIn: '08:00', clockOut: '21:00' }));
    }
    await renderWork();
    fireEvent.click(await screen.findByRole('button', { name: '이전 주' }));
    const section = await weekSection();
    await waitFor(() => expect(section.textContent).toContain('52시간 초과'));
    expect(section.textContent).toContain('이 주 실근로 60시간');
    expect(section.textContent).toContain('52시간을 8시간 넘었어요.');
  });

  it('날짜를 누르면 시트에서 근무 기록을 고칠 수 있어요', async () => {
    await setup('2026-10-19');
    await renderWork();
    fireEvent.click(await dayButton(10, 22));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: '10월 22일 (목)' })).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: '근무 기록 저장' }));
    await within(dialog).findByText('근무 기록을 저장했어요.');
    fireEvent.click(within(dialog).getByRole('button', { name: '닫기' }));
    await expectDay('10월 22일 목요일, 8시간');
  });

  it('이 화면에서도 출근할 수 있어요', async () => {
    await setup('2026-10-19');
    await renderWork();
    const today = (await screen.findByRole('heading', { level: 2, name: '오늘 근무' })).closest(
      'section',
    )!;
    fireEvent.click(within(today).getByRole('button', { name: '출근하기' }));
    await waitFor(async () => expect((await getWorkLog('2026-10-23'))?.clockIn).toBe('14:00'));
  });
});

describe('기록이 빠진 날 (SPEC §8.5)', () => {
  async function seedMissing() {
    await setup('2026-10-14');
    await putWorkLog(workLog('2026-10-15', { clockIn: '09:10', clockOut: '' }));
    await putLeaveEntry(leave('half', '2026-10-16', { quarters: 2, part: 'am' }));
    await putWorkLog(workLog('2026-10-19'));
    await putLeaveEntry(leave('full', '2026-10-20'));
    await putWorkLog(workLog('2026-10-21'));
  }

  const missingCard = async () =>
    (await screen.findByRole('heading', { level: 2, name: '기록이 빠진 날' })).closest('section')!;

  it('온보딩 이후 지난 근무일 중 기록이 없거나 퇴근 기록이 없는 날을 보여줘요', async () => {
    await seedMissing();
    await renderWork();
    const card = await missingCard();
    await waitFor(() => expect(within(card).getAllByRole('listitem')).toHaveLength(4));
    expect(
      within(card)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual([
      '10/14(수) · 기록 없음정시로 채우기',
      '10/15(목) · 퇴근 기록 없음 (출근 09:10)정시로 채우기',
      '10/16(금) · 기록 없음반차·반반차가 있어 직접 입력해야 해요.직접 입력',
      '10/22(목) · 기록 없음정시로 채우기',
    ]);
  });

  it('"모두 정시로 채우기"로 한 번에 채우고, 되돌리기로 원래대로 돌려요', async () => {
    await seedMissing();
    await renderWork();
    const card = await missingCard();
    fireEvent.click(await within(card).findByRole('button', { name: '3일 모두 정시로 채우기' }));
    expect(await screen.findByText('3일을 정시로 채웠어요.')).toBeTruthy();
    expect(await getWorkLog('2026-10-14')).toEqual(workLog('2026-10-14'));
    expect(await getWorkLog('2026-10-15')).toEqual(
      workLog('2026-10-15', { clockIn: '09:10', clockOut: '18:00' }),
    );
    expect(await getWorkLog('2026-10-22')).toEqual(workLog('2026-10-22'));
    await waitFor(() => expect(within(card).getAllByRole('listitem')).toHaveLength(1));

    fireEvent.click(screen.getByRole('button', { name: '되돌리기' }));
    expect(await screen.findByText('되돌렸어요.')).toBeTruthy();
    expect(await getWorkLog('2026-10-14')).toBeUndefined();
    expect((await getWorkLog('2026-10-15'))?.clockOut).toBe('');
    expect((await listWorkLogs()).map((l) => l.date)).toEqual([
      '2026-10-15',
      '2026-10-19',
      '2026-10-21',
    ]);
  });

  it('한 날만 정시로 채울 수도 있어요', async () => {
    await seedMissing();
    await renderWork();
    const card = await missingCard();
    fireEvent.click(await within(card).findByRole('button', { name: '10/22(목) 정시로 채우기' }));
    await screen.findByText('1일을 정시로 채웠어요.');
    expect(await getWorkLog('2026-10-22')).toEqual(workLog('2026-10-22'));
    expect(await getWorkLog('2026-10-14')).toBeUndefined();
  });

  it('반차가 있는 날은 직접 입력 시트를 열어요', async () => {
    await seedMissing();
    await renderWork();
    const card = await missingCard();
    fireEvent.click(await within(card).findByRole('button', { name: '10/16(금) 직접 입력' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: '10월 16일 (금)' })).toBeTruthy();
    expect(within(dialog).getByText('연차 오전 반차')).toBeTruthy();
  });

  it('빠진 기록이 없으면 그렇게 알려줘요', async () => {
    await setup('2026-10-23');
    await renderWork();
    expect((await missingCard()).textContent).toContain('최근 4주 동안 빠진 기록이 없어요.');
  });
});
