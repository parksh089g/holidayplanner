import { useCallback, useEffect, useState } from 'react';

/** 화면용 현재 시각. 30초마다, 그리고 탭으로 돌아올 때 새로 읽어요. */
export function useNow(intervalMs = 30_000): [Date, () => void] {
  const [now, setNow] = useState(() => new Date());
  const refresh = useCallback(() => setNow(new Date()), []);

  useEffect(() => {
    const id = setInterval(refresh, intervalMs);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [intervalMs, refresh]);

  return [now, refresh];
}
