import { useLiveQuery } from 'dexie-react-hooks';
import { getProfile, updateProfile } from '../db/repo';
import { nextTheme } from '../lib/theme';

/** 테마는 프로필(Dexie)에 저장해요. 온보딩 전(프로필 없음)에는 시스템 설정을 따라요. */
export function useTheme() {
  const profile = useLiveQuery(getProfile);
  const theme = profile?.theme ?? 'system';

  const cycleTheme = () => {
    if (profile) void updateProfile({ theme: nextTheme(theme) });
  };

  return { theme, cycleTheme };
}
