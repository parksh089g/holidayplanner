import { expect, test } from '@playwright/test';
import { card, dayCell, fixToday, goTo, onboard } from './helpers';

test.beforeEach(async ({ page }) => {
  await fixToday(page);
});

/** TASKS T3-2: 온보딩 → 휴가 등록 → 추천 계획 넣기 → 백업/복원 */
test('온보딩부터 휴가 등록, 추천 계획, 백업·초기화·복원까지', async ({ page, isMobile }) => {
  // 1. 온보딩: 2021-03-02 입사, 이미 3일 사용 → 잔여 14일
  await page.goto('./');
  await page.getByLabel('입사일').fill('2021-03-02');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByLabel('이미 쓴 연차 (일)').fill('3');
  await expect(page.getByText('2026.03.02–2027.03.01, 발생 17일')).toBeVisible();
  await page.getByRole('button', { name: '시작하기' }).click();
  await expect(page.getByRole('heading', { level: 1, name: '홈' })).toBeVisible();
  const balance = card(page, '잔여 연차');
  await expect(balance).toContainText('2027.03.01 소멸 예정 14일 (D-129)');

  // 2. 달력: 10/26(월) 연차 추가, 토요일 연차는 막혀요
  await goTo(page, isMobile, '달력');
  await dayCell(page, 10, 26).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByRole('heading', { name: '10월 26일 (월)' })).toBeVisible();
  await sheet.getByRole('button', { name: '휴가 추가' }).click();
  await expect(sheet.getByRole('status')).toHaveText('휴가를 추가했어요: 연차 종일');
  await page.keyboard.press('Escape');
  await expect(dayCell(page, 10, 26)).toContainText('연차');

  await dayCell(page, 10, 24).click();
  await expect(sheet.getByRole('alert')).toHaveText('휴무일에는 연차를 쓸 수 없어요.');
  await expect(sheet.getByRole('button', { name: '휴가 추가' })).toBeDisabled();
  await page.keyboard.press('Escape');

  // 3. 추천: 1위를 계획에 넣고 → 되돌리고 → 다시 넣기
  await goTo(page, isMobile, '추천');
  const first = page
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { level: 2, name: '2027년 9/11(토) – 9/16(목)' }) });
  await first.getByRole('button', { name: /계획에 넣기$/ }).click();
  await expect(page.getByText('연차 1일을 계획에 넣었어요.')).toBeVisible();
  await page.getByRole('button', { name: '되돌리기' }).click();
  await expect(page.getByText('되돌렸어요.')).toBeVisible();
  await first.getByRole('button', { name: /계획에 넣기$/ }).click();
  await expect(page.getByText('연차 1일을 계획에 넣었어요.')).toBeVisible();
  // 계획한 날은 쉬는 날이 되어 더 긴 연휴가 1위로 올라와요.
  await expect(page.getByRole('heading', { level: 2 }).first()).toHaveText(
    '2027년 9/11(토) – 9/19(일)',
  );

  // 홈: 이번 연차 기간 사용 3일 + 계획 1일(10/26) → 잔여 13일 (2027년 계획은 다음 연차에서 빠져요)
  await goTo(page, isMobile, '홈');
  await expect(balance).toContainText('2027.03.01 소멸 예정 13일 (D-129)');

  // 4. 백업 내보내기
  await goTo(page, isMobile, '설정');
  const [exported] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: '내보내기' }).click(),
  ]);
  expect(exported.suggestedFilename()).toBe('holidayplanner-backup-20261023.json');
  const backupPath = test.info().outputPath('backup.json');
  await exported.saveAs(backupPath);

  // 5. 전체 초기화 → 온보딩
  await page.getByRole('button', { name: '전체 초기화' }).click();
  const reset = page.getByRole('dialog', { name: '모든 데이터를 지울까요?' });
  await expect(reset.getByRole('button', { name: '모두 지우기' })).toBeDisabled();
  await reset.getByLabel('확인하려면 "초기화"를 입력해 주세요').fill('초기화');
  await reset.getByRole('button', { name: '모두 지우기' }).click();
  await expect(page.getByRole('heading', { level: 1, name: '연차 플래너 시작하기' })).toBeVisible();

  // 6. 다시 시작한 뒤 백업을 가져와 복원
  await onboard(page);
  await expect(balance).toContainText('2027.03.01 소멸 예정 17일 (D-129)');
  await goTo(page, isMobile, '설정');
  await page.getByLabel('백업 파일 고르기').setInputFiles(backupPath);
  const confirm = page.getByRole('dialog', { name: '이 백업으로 바꿀까요?' });
  await expect(confirm).toContainText('2026.10.23 10:00에 만든 백업이에요.');
  await expect(confirm).toContainText('휴가 3건');
  const [beforeImport] = await Promise.all([
    page.waitForEvent('download'),
    confirm.getByRole('button', { name: '바꾸기' }).click(),
  ]);
  expect(beforeImport.suggestedFilename()).toBe(
    'holidayplanner-backup-20261023-before-import.json',
  );
  await expect(page.getByText(/백업으로 바꿨어요/)).toBeVisible();

  await goTo(page, isMobile, '홈');
  await expect(balance).toContainText('2027.03.01 소멸 예정 13일 (D-129)');
  await goTo(page, isMobile, '달력');
  await expect(dayCell(page, 10, 26)).toContainText('연차');
});
