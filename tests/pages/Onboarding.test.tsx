/** @vitest-environment jsdom */
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../../src/App';
import { getProfile, listLeaveEntries } from '../../src/db/repo';
import { resetDb } from '../db/fixtures';

beforeEach(async () => {
  await resetDb();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 23, 10, 0)); // 2026-10-23 (SPEC §8.1 완료 조건의 asOf)
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })),
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

function renderOnboarding() {
  render(
    <MemoryRouter initialEntries={['/onboarding']}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

const next = () => fireEvent.click(screen.getByRole('button', { name: /다음|시작하기/ }));
const input = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
const type = (label: string, value: string) =>
  fireEvent.change(input(label), { target: { value } });

async function goToStep3(hireDate: string) {
  renderOnboarding();
  await screen.findByRole('heading', { name: '입사일을 알려 주세요' });
  type('입사일', hireDate);
  next();
  await screen.findByRole('heading', { name: '근무시간을 확인해 주세요' });
  next();
  await screen.findByRole('heading', { name: '현재 연차 기간에 이미 쓴 연차를 알려 주세요' });
}

describe('온보딩 (SPEC §8.1)', () => {
  it('완료 조건: 입사일 2021-03-02 → "현재 연차 기간 2026.03.02–2027.03.01, 발생 17일"', async () => {
    await goToStep3('2021-03-02');
    expect(screen.getByText('앱이 계산한 현재 연차 기간')).toBeTruthy();
    expect(screen.getByText('2026.03.02–2027.03.01, 발생 17일')).toBeTruthy();
  });

  it('입사 1년 미만이면 지금까지 생긴 월차와 안내를 보여줘요', async () => {
    await goToStep3('2026-06-01');
    expect(screen.getByText('2026.06.01–2027.05.31, 발생 4일')).toBeTruthy();
    expect(screen.getByText(/한 달 개근할 때마다 1일씩/)).toBeTruthy();
  });

  it('입사일은 필수이고 오늘 이후는 막아요', async () => {
    renderOnboarding();
    await screen.findByRole('heading', { name: '입사일을 알려 주세요' });
    next();
    expect(screen.getByRole('alert').textContent).toBe('입사일을 입력해 주세요.');
    expect(input('입사일').getAttribute('aria-invalid')).toBe('true');

    type('입사일', '2026-10-24');
    next();
    expect(screen.getByRole('alert').textContent).toBe('입사일은 오늘 이후일 수 없어요.');
    expect(screen.queryByRole('heading', { name: '근무시간을 확인해 주세요' })).toBeNull();

    type('입사일', '2026-10-23');
    next();
    expect(await screen.findByRole('heading', { name: '근무시간을 확인해 주세요' })).toBeTruthy();
  });

  it('근무시간 기본값은 09:00–18:00, 점심 12:00–13:00이고 순서가 틀리면 막아요', async () => {
    renderOnboarding();
    await screen.findByRole('heading', { name: '입사일을 알려 주세요' });
    type('입사일', '2021-03-02');
    next();
    await screen.findByRole('heading', { name: '근무시간을 확인해 주세요' });
    expect(['출근', '퇴근', '점심 시작', '점심 끝'].map((l) => input(l).value)).toEqual([
      '09:00',
      '18:00',
      '12:00',
      '13:00',
    ]);

    type('퇴근', '08:00');
    next();
    expect(screen.getByRole('alert').textContent).toBe('퇴근 시각은 출근 시각보다 늦어야 해요.');

    type('퇴근', '18:00');
    type('점심 시작', '18:30');
    type('점심 끝', '19:00');
    next();
    expect(screen.getByRole('alert').textContent).toBe('점심시간은 근무시간 안에 있어야 해요.');
  });

  it('이전으로 돌아가도 입력값이 남아 있어요', async () => {
    await goToStep3('2021-03-02');
    fireEvent.click(screen.getByRole('button', { name: '이전' }));
    fireEvent.click(screen.getByRole('button', { name: '이전' }));
    expect(input('입사일').value).toBe('2021-03-02');
  });

  it('이미 쓴 연차는 0.25일 단위만 받아요', async () => {
    await goToStep3('2021-03-02');
    for (const bad of ['-1', '1.1', '']) {
      type('이미 쓴 연차 (일)', bad);
      next();
      expect(screen.getByRole('alert').textContent).toBe('0.25일 단위로 0일 이상 입력해 주세요.');
    }
  });

  it('발생보다 많이 입력하면 확인을 권해요 (막지는 않아요)', async () => {
    await goToStep3('2026-06-01');
    type('이미 쓴 연차 (일)', '5');
    expect(screen.getByText(/발생한 연차보다 많이 입력했어요/)).toBeTruthy();
  });

  it('완료하면 프로필과 일괄 차감 항목을 저장하고 홈으로 가요', async () => {
    await goToStep3('2021-03-02');
    type('이미 쓴 연차 (일)', '7.25');
    next();
    expect(await screen.findByRole('heading', { level: 1, name: '홈' })).toBeTruthy();

    expect(await getProfile()).toMatchObject({
      id: 'me',
      hireDate: '2021-03-02',
      workStart: '09:00',
      workEnd: '18:00',
      lunchStart: '12:00',
      lunchEnd: '13:00',
      theme: 'system',
      schemaVersion: 1,
    });
    const entries = await listLeaveEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      date: '2026-10-23',
      quarters: 29,
      type: 'annual',
      memo: '앱 사용 전 사용분',
      isBulk: true,
    });
  });

  it('이미 쓴 연차가 0이면 차감 항목을 만들지 않아요', async () => {
    await goToStep3('2021-03-02');
    next();
    await screen.findByRole('heading', { level: 1, name: '홈' });
    await waitFor(async () => expect(await getProfile()).toBeDefined());
    expect(await listLeaveEntries()).toEqual([]);
  });
});
