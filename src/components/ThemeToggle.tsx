import type { ThemeMode } from '../core/types';
import { useTheme } from '../hooks/useTheme';
import { THEME_LABEL } from '../lib/theme';
import { MonitorIcon, MoonIcon, SunIcon } from './icons';

const THEME_ICON: Record<ThemeMode, typeof SunIcon> = {
  system: MonitorIcon,
  light: SunIcon,
  dark: MoonIcon,
};

/** 누를 때마다 시스템 → 밝게 → 어둡게 순서로 바꿔요. */
export function ThemeToggle({ showLabel = false }: { showLabel?: boolean }) {
  const { theme, cycleTheme } = useTheme();
  const Icon = THEME_ICON[theme];
  const label = THEME_LABEL[theme];

  return (
    <button
      type="button"
      onClick={cycleTheme}
      // 보이는 글자("테마: 시스템")로 시작해야 음성 명령으로도 찾을 수 있어요 (WCAG 2.5.3).
      aria-label={`테마: ${label}, 눌러서 바꾸기`}
      className={`inline-flex h-11 items-center gap-3 rounded-lg text-sm text-gray-600 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-gray-300 dark:hover:bg-gray-800 ${
        showLabel ? 'w-full px-3' : 'w-11 justify-center'
      }`}
    >
      <Icon />
      {showLabel && <span>테마: {label}</span>}
    </button>
  );
}
