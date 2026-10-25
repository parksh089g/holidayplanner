/** @vitest-environment jsdom */
import 'fake-indexeddb/auto';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/App';
import { clearHolidayCache } from '../src/data/holidays';
import { getProfile, saveProfile } from '../src/db/repo';
import { resetDb, sampleProfile } from './db/fixtures';

type ChangeListener = (e: { matches: boolean }) => void;
let systemDark = false;
let listeners: ChangeListener[] = [];

function setSystemDark(dark: boolean) {
  systemDark = dark;
  listeners.forEach((listener) => listener({ matches: dark }));
}

beforeEach(async () => {
  await resetDb();
  clearHolidayCache();
  // 달력 화면이 공휴일 파일을 부르면 404로 답해요.
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })),
  );
  systemDark = false;
  listeners = [];
  window.matchMedia = vi.fn().mockImplementation((media: string) => ({
    media,
    get matches() {
      return systemDark;
    },
    addEventListener: (_: string, l: ChangeListener) => listeners.push(l),
    removeEventListener: (_: string, l: ChangeListener) => {
      listeners = listeners.filter((x) => x !== l);
    },
  }));
  document.documentElement.classList.remove('dark');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

const heading = (name: string) => screen.findByRole('heading', { level: 1, name });
const bottomTabs = () => screen.findByRole('navigation', { name: '하단 탭' });
const sidebar = () => screen.findByRole('navigation', { name: '주요 메뉴' });

describe('온보딩 이동 규칙 (SPEC §8.1)', () => {
  it.each(['/', '/calendar', '/settings', '/nope'])(
    '프로필이 없으면 %s로 들어와도 온보딩으로 보내요',
    async (path) => {
      renderAt(path);
      expect(await heading('연차 플래너 시작하기')).toBeTruthy();
    },
  );

  it('이미 온보딩했으면 온보딩 화면에서 홈으로 보내요', async () => {
    await saveProfile(sampleProfile());
    renderAt('/onboarding');
    expect(await heading('홈')).toBeTruthy();
  });
});

describe('레이아웃', () => {
  beforeEach(() => saveProfile(sampleProfile()));

  it('앱 이름 "연차 플래너"를 보여줘요', async () => {
    renderAt('/');
    await heading('홈');
    expect(screen.getAllByText('연차 플래너').length).toBeGreaterThan(0);
  });

  it('하단 탭은 홈·달력·추천·근무 4개이고 글자 라벨이 있어요', async () => {
    renderAt('/');
    const links = within(await bottomTabs()).getAllByRole('link');
    expect(links.map((a) => a.textContent)).toEqual(['홈', '달력', '추천', '근무']);
  });

  it('사이드바에는 설정까지 5개 메뉴가 있어요', async () => {
    renderAt('/');
    const links = within(await sidebar()).getAllByRole('link');
    expect(links.map((a) => a.textContent)).toEqual(['홈', '달력', '추천', '근무', '설정']);
  });

  it('모바일 상단 바에 설정 버튼이 있어요', async () => {
    renderAt('/');
    const header = await screen.findByRole('banner');
    expect(within(header).getByRole('link', { name: '설정' }).getAttribute('href')).toBe(
      '/settings',
    );
  });

  it.each([
    ['/', '홈'],
    ['/calendar', '달력'],
    ['/suggest', '추천'],
    ['/work', '근무'],
    ['/settings', '설정'],
  ])('%s 경로는 %s 화면이에요', async (path, title) => {
    renderAt(path);
    expect(await heading(title)).toBeTruthy();
  });

  it('현재 탭은 aria-current로 표시해요 (색만으로 구분하지 않아요)', async () => {
    renderAt('/calendar');
    const current = within(await bottomTabs()).getByRole('link', { current: 'page' });
    expect(current.textContent).toBe('달력');
  });

  it('탭을 누르면 그 화면으로 이동해요', async () => {
    renderAt('/');
    fireEvent.click(within(await bottomTabs()).getByRole('link', { name: '근무' }));
    expect(await heading('근무')).toBeTruthy();
  });

  it('모르는 경로는 홈으로 보내요', async () => {
    renderAt('/nope');
    expect(await heading('홈')).toBeTruthy();
  });
});

describe('다크 모드 토글', () => {
  const toggle = async () =>
    within(await screen.findByRole('banner')).getByRole('button', { name: /테마/ });
  const isDark = () => document.documentElement.classList.contains('dark');
  const savedTheme = async () => (await getProfile())?.theme;

  it('시스템 → 밝게 → 어둡게 → 시스템 순서로 바뀌고 프로필에 저장해요', async () => {
    await saveProfile(sampleProfile());
    renderAt('/');
    expect((await toggle()).getAttribute('aria-label')).toContain('시스템');
    for (const [next, dark] of [
      ['light', false],
      ['dark', true],
      ['system', false],
    ] as const) {
      fireEvent.click(await toggle());
      await waitFor(async () => expect(await savedTheme()).toBe(next));
      await waitFor(() => expect(isDark()).toBe(dark));
    }
  });

  it('프로필에 저장된 테마를 적용해요', async () => {
    await saveProfile(sampleProfile({ theme: 'dark' }));
    renderAt('/');
    await waitFor(() => expect(isDark()).toBe(true));
    expect((await toggle()).getAttribute('aria-label')).toContain('어둡게');
  });

  it('시스템 모드는 OS 설정을 따르고 바뀌면 바로 반영해요', async () => {
    await saveProfile(sampleProfile());
    systemDark = true;
    renderAt('/');
    await waitFor(() => expect(isDark()).toBe(true));
    act(() => setSystemDark(false));
    expect(isDark()).toBe(false);
  });

  it('직접 고른 테마는 OS 설정이 바뀌어도 유지돼요', async () => {
    await saveProfile(sampleProfile({ theme: 'dark' }));
    renderAt('/');
    await waitFor(() => expect(isDark()).toBe(true));
    act(() => setSystemDark(false));
    expect(isDark()).toBe(true);
  });

  it('온보딩 전에도 시스템 다크 모드를 따라요', async () => {
    systemDark = true;
    renderAt('/onboarding');
    await heading('연차 플래너 시작하기');
    expect(isDark()).toBe(true);
  });
});
