import { expect, test } from '@playwright/test';
import { card, fixToday, goTo, onboard } from './helpers';

/** T3-1 회귀: 서비스워커를 설치하면 오프라인(비행기 모드)에서도 열려요. */
test('서비스워커 설치 후 오프라인에서도 모든 화면이 열려요', async ({
  page,
  context,
  isMobile,
}) => {
  test.skip(isMobile, '데스크톱 한 번만 확인해요');
  await fixToday(page);
  await onboard(page);

  // 서비스워커가 페이지를 제어하면 공휴일 파일을 캐시에 채워요.
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await expect
    .poll(() => page.evaluate(async () => (await (await caches.open('holidays')).keys()).length))
    .toBeGreaterThanOrEqual(2);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: '홈' })).toBeVisible();
  await expect(card(page, '다가오는 공휴일')).toContainText('12/25(금) 성탄절');
  await expect(page.getByText('공휴일 데이터를 불러오지 못했어요')).toHaveCount(0);
  for (const name of ['달력', '추천', '근무', '설정'] as const) {
    await goTo(page, isMobile, name);
  }
  await goTo(page, isMobile, '홈');
  await card(page, '오늘 근무').getByRole('button', { name: '출근하기' }).click();
  await expect(card(page, '오늘 근무')).toContainText('10:00 출근');
});
