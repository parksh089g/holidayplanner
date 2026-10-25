import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { fixToday, goTo, onboard } from './helpers';

/** T3-3: 모든 화면을 밝게·어둡게 두 테마에서 axe(WCAG 2.1 AA)로 검사해요. */
async function expectNoViolations(page: Page, label: string) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const summary = violations.map(
    (v) => `${v.id}: ${v.help} → ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
  );
  expect(summary, `${label} 접근성 위반`).toEqual([]);
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`접근성 (${colorScheme === 'light' ? '밝게' : '어둡게'})`, () => {
    test.use({ colorScheme });

    test('온보딩과 모든 화면에 WCAG AA 위반이 없어요', async ({ page, isMobile }) => {
      await fixToday(page);
      await page.goto('./');
      await expect(
        page.getByRole('heading', { level: 1, name: '연차 플래너 시작하기' }),
      ).toBeVisible();
      await expectNoViolations(page, '온보딩');

      await onboard(page, { usedDays: '3' });
      await expectNoViolations(page, '홈');
      for (const name of ['달력', '추천', '근무', '설정'] as const) {
        await goTo(page, isMobile, name);
        await expectNoViolations(page, name);
      }

      // 열린 시트·대화상자도 검사해요.
      await goTo(page, isMobile, '달력');
      await page.getByRole('button', { name: /^10월 24일 / }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expectNoViolations(page, '날짜 시트(휴무일 경고)');
    });
  });
}
