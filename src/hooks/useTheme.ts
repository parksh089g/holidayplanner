import { useLiveQuery } from 'dexie-react-hooks';
import type { ThemeMode } from '../core/types';
import { getProfile, updateProfile } from '../db/repo';
import { nextTheme } from '../lib/theme';

/**
 * 테마는 프로필(Dexie)에 저장해요. 온보딩 전(프로필 없음)에는 시스템 설정을 따라요.
 * 바꿀 때는 화면에 불러온 값이 아니라 DB의 현재 프로필을 기준으로 해서, 불러오기 전에 눌러도 맞게 저장해요.
 */
export function useTheme() {
  const profile = useLiveQuery(getProfile);
  const theme = profile?.theme ?? 'system';

  const setTheme = (mode: ThemeMode) => {
    void getProfile().then((current) => current && updateProfile({ theme: mode }));
  };
  const cycleTheme = () => {
    void getProfile().then(
      (current) => current && updateProfile({ theme: nextTheme(current.theme) }),
    );
  };

  return { theme, setTheme, cycleTheme };
}
