/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/App';
import { useUiStore } from '../src/store/ui';

type ChangeListener = (e: { matches: boolean }) => void;
let systemDark = false;
let listeners: ChangeListener[] = [];

function setSystemDark(dark: boolean) {
  systemDark = dark;
  listeners.forEach((listener) => listener({ matches: dark }));
}

beforeEach(() => {
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
  useUiStore.setState({ theme: 'system' });
  document.documentElement.classList.remove('dark');
});

afterEach(cleanup);

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

const bottomTabs = () => screen.getByRole('navigation', { name: '하단 탭' });
const sidebar = () => screen.getByRole('navigation', { name: '주요 메뉴' });

describe('레이아웃', () => {
  it('앱 이름 "연차 플래너"를 보여줘요', () => {
    renderAt('/');
    expect(screen.getAllByText('연차 플래너').length).toBeGreaterThan(0);
  });

  it('하단 탭은 홈·달력·추천·근무 4개이고 글자 라벨이 있어요', () => {
    renderAt('/');
    const links = within(bottomTabs()).getAllByRole('link');
    expect(links.map((a) => a.textContent)).toEqual(['홈', '달력', '추천', '근무']);
  });

  it('사이드바에는 설정까지 5개 메뉴가 있어요', () => {
    renderAt('/');
    const links = within(sidebar()).getAllByRole('link');
    expect(links.map((a) => a.textContent)).toEqual(['홈', '달력', '추천', '근무', '설정']);
  });

  it('모바일 상단 바에 설정 버튼이 있어요', () => {
    renderAt('/');
    const header = screen.getByRole('banner');
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
  ])('%s 경로는 %s 화면이에요', (path, title) => {
    renderAt(path);
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeTruthy();
  });

  it('현재 탭은 aria-current로 표시해요 (색만으로 구분하지 않아요)', () => {
    renderAt('/calendar');
    const current = within(bottomTabs()).getByRole('link', { current: 'page' });
    expect(current.textContent).toBe('달력');
  });

  it('탭을 누르면 그 화면으로 이동해요', () => {
    renderAt('/');
    fireEvent.click(within(bottomTabs()).getByRole('link', { name: '근무' }));
    expect(screen.getByRole('heading', { level: 1, name: '근무' })).toBeTruthy();
  });

  it('모르는 경로는 홈으로 보내요', () => {
    renderAt('/nope');
    expect(screen.getByRole('heading', { level: 1, name: '홈' })).toBeTruthy();
  });
});

describe('다크 모드 토글', () => {
  const toggle = () => within(screen.getByRole('banner')).getByRole('button', { name: /테마/ });
  const isDark = () => document.documentElement.classList.contains('dark');

  it('시스템 → 밝게 → 어둡게 → 시스템 순서로 바뀌어요', () => {
    renderAt('/');
    expect(toggle().getAttribute('aria-label')).toContain('시스템');
    fireEvent.click(toggle());
    expect(useUiStore.getState().theme).toBe('light');
    expect(isDark()).toBe(false);
    fireEvent.click(toggle());
    expect(useUiStore.getState().theme).toBe('dark');
    expect(isDark()).toBe(true);
    fireEvent.click(toggle());
    expect(useUiStore.getState().theme).toBe('system');
  });

  it('시스템 모드는 OS 설정을 따르고 바뀌면 바로 반영해요', () => {
    systemDark = true;
    renderAt('/');
    expect(isDark()).toBe(true);
    act(() => setSystemDark(false));
    expect(isDark()).toBe(false);
  });

  it('직접 고른 테마는 OS 설정이 바뀌어도 유지돼요', () => {
    renderAt('/');
    fireEvent.click(toggle()); // light
    fireEvent.click(toggle()); // dark
    act(() => setSystemDark(false));
    expect(isDark()).toBe(true);
  });
});
