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
  listLeaveEntries,
  putLeaveEntry,
  putWorkLog,
  saveProfile,
} from '../../src/db/repo';
import { useCalendarStore } from '../../src/store/calendar';
import { holidayFiles } from '../core/fixtures';
import { leave, resetDb, sampleProfile, workLog } from '../db/fixtures';

beforeEach(async () => {
  await resetDb();
  clearHolidayCache();
  useCalendarStore.setState({ month: undefined, view: 'month' });
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

async function renderCalendar() {
  render(
    <MemoryRouter initialEntries={['/calendar']}>
      <AppRoutes />
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { level: 1, name: '달력' });
}

/** 날짜 칸 버튼 (aria-label이 "10월 26일 월요일…"로 시작) */
const cell = (month: number, day: number) =>
  screen.findByRole('button', { name: new RegExp(`^${month}월 ${day}일 `) });

/** 접근 가능한 이름이 정확히 name인 칸 (스크린리더가 듣는 이름) */
const named = (name: string | RegExp) => screen.findByRole('button', { name });

async function openDay(month: number, day: number) {
  fireEvent.click(await cell(month, day));
  return screen.findByRole('dialog');
}

const choose = (dialog: HTMLElement, name: string | RegExp) =>
  fireEvent.click(within(dialog).getByRole('radio', { name }));

describe('월 보기 (SPEC §8.3)', () => {
  it('이번 달을 월요일부터 보여주고 공휴일 이름과 오늘을 표시해요', async () => {
    await renderCalendar();
    expect(screen.getByRole('heading', { level: 2, name: '2026년 10월' })).toBeTruthy();
    expect(await named('10월 3일 토요일, 개천절')).toBe(await cell(10, 3));
    expect((await cell(10, 5)).textContent).toContain('대체공휴일(개천절)');
    expect(await named('10월 23일 금요일, 오늘')).toBe(await cell(10, 23));
    // 일요일·공휴일 빨강, 토요일 파랑
    expect((await cell(10, 4)).querySelector('span[aria-hidden="true"]')!.className).toContain(
      'text-red-700',
    );
    expect((await cell(10, 10)).querySelector('span[aria-hidden="true"]')!.className).toContain(
      'text-blue-700',
    );
    expect((await cell(10, 9)).querySelector('span[aria-hidden="true"]')!.className).toContain(
      'text-red-700',
    );
  });

  it('휴가 칩은 글자로 구분하고 근무 기록이 있으면 알려줘요 (일괄 차감은 칩으로 안 그려요)', async () => {
    const entries: LeaveEntry[] = [
      leave('a', '2026-10-26'),
      leave('b', '2026-10-27', { quarters: 2, part: 'am' }),
      leave('c', '2026-10-28', { quarters: 1, part: 'pm' }),
      leave('d', '2026-10-29', { type: 'special' }),
      { ...leave('bulk', '2026-10-23', { quarters: 29, isBulk: true }), memo: '앱 사용 전 사용분' },
    ];
    for (const e of entries) await putLeaveEntry(e);
    await putWorkLog(workLog('2026-10-21'));
    await renderCalendar();

    await waitFor(async () => expect((await cell(10, 26)).textContent).toContain('연차'));
    expect((await cell(10, 27)).textContent).toContain('반차');
    expect((await cell(10, 28)).textContent).toContain('반반차');
    expect((await cell(10, 29)).textContent).toContain('특별');
    expect(await named('10월 28일 수요일, 연차 오후 반반차')).toBe(await cell(10, 28));
    expect(await named(/^10월 21일 .*근무 기록 있음$/)).toBe(await cell(10, 21));
    expect(await named('10월 23일 금요일, 오늘')).toBe(await cell(10, 23));
  });

  it('이전·다음 버튼, 스와이프, 오늘 버튼으로 달을 옮겨요', async () => {
    await renderCalendar();
    // 달 이동은 zustand 상태라 렌더가 끝날 때까지 기다려요.
    const title = (name: string) => screen.findByRole('heading', { level: 2, name });
    fireEvent.click(screen.getByRole('button', { name: '다음 달' }));
    await title('2026년 11월');
    fireEvent.click(screen.getByRole('button', { name: '이전 달' }));
    fireEvent.click(screen.getByRole('button', { name: '이전 달' }));
    await title('2026년 9월');

    const grid = (await cell(9, 1)).parentElement!.parentElement!;
    fireEvent.touchStart(grid, { touches: [{ clientX: 300, clientY: 100 }] });
    fireEvent.touchEnd(grid, { changedTouches: [{ clientX: 200, clientY: 110 }] });
    await title('2026년 10월');
    fireEvent.touchStart(grid, { touches: [{ clientX: 200, clientY: 100 }] });
    fireEvent.touchEnd(grid, { changedTouches: [{ clientX: 210, clientY: 300 }] }); // 세로 스크롤
    await title('2026년 10월');
    expect(useCalendarStore.getState().month).toBe('2026-10');

    fireEvent.click(screen.getByRole('button', { name: '다음 달' }));
    fireEvent.click(screen.getByRole('button', { name: '다음 달' }));
    await title('2026년 12월');
    fireEvent.click(screen.getByRole('button', { name: '오늘' }));
    await title('2026년 10월');
  });

  it('연간 보기에서 12개월을 보고 월을 누르면 그 달로 가요', async () => {
    await putLeaveEntry(leave('a', '2026-12-24'));
    await renderCalendar();
    fireEvent.click(screen.getByRole('button', { name: '연간' }));
    const months = await screen.findAllByRole('button', { name: /^\d+월 보기/ });
    expect(months).toHaveLength(12);
    expect(await named('12월 보기, 공휴일 1일, 휴가 1일')).toBe(months[11]);
    fireEvent.click(months[11]);
    await screen.findByRole('heading', { level: 2, name: '2026년 12월' });
    expect(screen.getByRole('button', { name: '월' }).getAttribute('aria-pressed')).toBe('true');
  });
});

describe('날짜 시트: 휴가', () => {
  it('연차 종일을 추가하면 저장하고 달력에 칩이 생겨요', async () => {
    await renderCalendar();
    const dialog = await openDay(10, 26);
    expect(within(dialog).getByRole('heading', { name: '10월 26일 (월)' })).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: '휴가 추가' }));
    await within(dialog).findByText('휴가를 추가했어요: 연차 종일');
    const [saved] = await listLeaveEntries();
    expect(saved).toMatchObject({ date: '2026-10-26', quarters: 4, type: 'annual' });
    expect(saved.part).toBeUndefined();
    await waitFor(async () => expect((await cell(10, 26)).textContent).toContain('연차'));
  });

  it('반반차는 근무시간으로 계산한 시각을 보여주고 오전·오후를 저장해요', async () => {
    await renderCalendar();
    const dialog = await openDay(10, 27);
    choose(dialog, '반반차');
    expect(within(dialog).getByRole('radio', { name: '오전 09:00–11:00' })).toBeTruthy();
    choose(dialog, '오후 16:00–18:00');
    fireEvent.change(within(dialog).getByLabelText('휴가 메모 (선택)'), {
      target: { value: ' 병원 ' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: '휴가 추가' }));
    await within(dialog).findByText('휴가를 추가했어요: 연차 오후 반반차 (16:00–18:00)');
    expect((await listLeaveEntries())[0]).toMatchObject({ quarters: 1, part: 'pm', memo: '병원' });
  });

  it('휴무일에는 연차를 막고, 다른 유형은 허용해요', async () => {
    await renderCalendar();
    const dialog = await openDay(10, 24); // 토요일
    expect(within(dialog).getByText('쉬는 날')).toBeTruthy();
    expect(within(dialog).getByRole('alert').textContent).toBe('휴무일에는 연차를 쓸 수 없어요.');
    const add = within(dialog).getByRole('button', { name: '휴가 추가' }) as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText('종류'), { target: { value: 'special' } });
    expect(within(dialog).queryByRole('alert')).toBeNull();
    expect(add.disabled).toBe(false);
  });

  it('하루 1일을 넘기거나 같은 시간대에 겹치면 막아요', async () => {
    await putLeaveEntry(leave('am', '2026-10-27', { quarters: 2, part: 'am' }));
    await renderCalendar();
    const dialog = await openDay(10, 27);
    await within(dialog).findByText('연차 오전 반차');
    expect(within(dialog).getByRole('alert').textContent).toBe(
      '하루에 쓸 수 있는 휴가는 1일까지예요.',
    );
    choose(dialog, '반반차');
    expect(within(dialog).getByRole('alert').textContent).toBe('오전에 이미 휴가가 있어요.');
    choose(dialog, /^오후/);
    expect(within(dialog).queryByRole('alert')).toBeNull();
  });

  it('잔여보다 많으면 경고하지만 추가는 할 수 있어요 (SPEC §5.3-3)', async () => {
    await putLeaveEntry({ ...leave('bulk', '2026-10-23', { quarters: 68, isBulk: true }) });
    await renderCalendar();
    const dialog = await openDay(10, 26);
    expect(
      await within(dialog).findByText('잔여 연차보다 많아요. 그래도 추가할 수 있어요.'),
    ).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: '휴가 추가' }));
    await within(dialog).findByText('휴가를 추가했어요: 연차 종일');
  });

  it('휴가를 삭제할 수 있어요', async () => {
    await putLeaveEntry(leave('a', '2026-10-26'));
    await renderCalendar();
    const dialog = await openDay(10, 26);
    fireEvent.click(await within(dialog).findByRole('button', { name: '연차 종일 삭제' }));
    await within(dialog).findByText('휴가를 지웠어요: 연차 종일');
    expect(await listLeaveEntries()).toEqual([]);
  });

  it('Esc로 닫으면 누른 날짜 칸으로 초점이 돌아가요', async () => {
    await renderCalendar();
    const target = await cell(10, 26);
    fireEvent.click(target);
    await screen.findByRole('dialog');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(target);
  });
});

describe('날짜 시트: 근무 기록', () => {
  it('정시로 채워 두고 실근로를 미리 보여준 뒤 저장해요', async () => {
    await renderCalendar();
    const dialog = await openDay(10, 22);
    expect(within(dialog).getByText(/실근로/).textContent).toBe(
      '실근로 8시간 · 휴게 1시간 · 연장(추정) 0분',
    );
    fireEvent.change(within(dialog).getByLabelText('퇴근'), { target: { value: '20:30' } });
    expect(within(dialog).getByText(/실근로/).textContent).toBe(
      '실근로 10시간 30분 · 휴게 1시간 · 연장(추정) 2시간 30분',
    );
    fireEvent.click(within(dialog).getByRole('button', { name: '근무 기록 저장' }));
    await within(dialog).findByText('근무 기록을 저장했어요.');
    expect(await getWorkLog('2026-10-22')).toEqual({
      date: '2026-10-22',
      clockIn: '09:00',
      clockOut: '20:30',
    });
  });

  it('지난 날은 퇴근 시각이 필요하고, 휴게를 직접 넣을 수 있어요', async () => {
    await renderCalendar();
    const dialog = await openDay(10, 22);
    fireEvent.change(within(dialog).getByLabelText('퇴근'), { target: { value: '' } });
    expect(within(dialog).getByRole('alert').textContent).toContain('퇴근 시각을 입력해 주세요.');
    fireEvent.change(within(dialog).getByLabelText('퇴근'), { target: { value: '18:00' } });
    fireEvent.change(within(dialog).getByLabelText(/^휴게/), { target: { value: '30' } });
    expect(within(dialog).getByText(/실근로/).textContent).toContain('실근로 8시간 30분');
    fireEvent.click(within(dialog).getByRole('button', { name: '근무 기록 저장' }));
    await within(dialog).findByText('근무 기록을 저장했어요.');
    expect((await getWorkLog('2026-10-22'))?.breakMinutes).toBe(30);
  });

  it('오늘은 퇴근 칸을 비워 근무 중으로 저장할 수 있어요', async () => {
    await renderCalendar();
    const dialog = await openDay(10, 23);
    fireEvent.change(within(dialog).getByLabelText('출근'), { target: { value: '08:40' } });
    fireEvent.change(within(dialog).getByLabelText('퇴근'), { target: { value: '' } });
    expect(within(dialog).queryByRole('alert')).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: '근무 기록 저장' }));
    await within(dialog).findByText('근무 기록을 저장했어요.');
    expect((await getWorkLog('2026-10-23'))?.clockOut).toBe('');
  });

  it('휴무일 근무는 전부 연장이라고 알려주고, 기존 기록을 지울 수 있어요', async () => {
    await putWorkLog(workLog('2026-10-24', { clockIn: '10:00', clockOut: '14:00' }));
    await renderCalendar();
    const dialog = await openDay(10, 24);
    expect((within(dialog).getByLabelText('출근') as HTMLInputElement).value).toBe('10:00');
    expect(within(dialog).getByText(/실근로/).textContent).toContain(
      '휴무일 근무라 전부 연장으로 봐요.',
    );
    fireEvent.click(within(dialog).getByRole('button', { name: '근무 기록 삭제' }));
    await within(dialog).findByText('근무 기록을 지웠어요.');
    expect(await getWorkLog('2026-10-24')).toBeUndefined();
  });
});
