import type { ComponentType } from 'react';
import { CalendarIcon, ClockIcon, HomeIcon, SettingsIcon, SparkleIcon } from './icons';

export interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** '/'는 하위 경로에서 활성으로 보지 않아요. */
  end?: boolean;
}

/** 모바일 하단 탭 (SPEC §8) */
export const MAIN_TABS: NavItem[] = [
  { to: '/', label: '홈', icon: HomeIcon, end: true },
  { to: '/calendar', label: '달력', icon: CalendarIcon },
  { to: '/suggest', label: '추천', icon: SparkleIcon },
  { to: '/work', label: '근무', icon: ClockIcon },
];

export const SETTINGS_TAB: NavItem = { to: '/settings', label: '설정', icon: SettingsIcon };
