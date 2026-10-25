import { useEffect } from 'react';
import type { ThemeMode } from '../store/ui';

/** <html>에 dark 클래스를 붙여요. 시스템 모드면 OS 설정 변경을 바로 따라가요. */
export function useApplyTheme(theme: ThemeMode) {
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches);
      document.documentElement.classList.toggle('dark', dark);
    };
    apply();
    if (theme !== 'system') return;
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
}
