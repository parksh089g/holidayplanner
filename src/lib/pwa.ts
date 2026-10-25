import { toISO } from '../core/date';
import { prefetchHolidayFiles } from '../data/holidays';

/** 서비스워커가 이 페이지를 제어하기 시작하면 올해·내년 공휴일을 SW 캐시에 채워요. */
export function warmHolidayCacheOnControl(): void {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    const year = Number(toISO(new Date()).slice(0, 4));
    void prefetchHolidayFiles([year, year + 1]);
  });
}
