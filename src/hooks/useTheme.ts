import { useLiveQuery } from 'dexie-react-hooks';
import { getProfile, updateProfile } from '../db/repo';
import { nextTheme, useUiStore } from '../store/ui';

/** 프로필이 있으면 프로필(Dexie)의 테마를 쓰고 저장해요. 온보딩 전에는 UI 상태만 바꿔요. */
export function useTheme() {
  const profile = useLiveQuery(getProfile);
  const localTheme = useUiStore((s) => s.theme);
  const setLocalTheme = useUiStore((s) => s.setTheme);
  const theme = profile?.theme ?? localTheme;

  const cycleTheme = () => {
    const next = nextTheme(theme);
    if (profile) void updateProfile({ theme: next });
    else setLocalTheme(next);
  };

  return { theme, cycleTheme };
}
