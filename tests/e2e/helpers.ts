import { expect, type Locator, type Page } from '@playwright/test';

/** 모든 E2E의 "오늘": 2026-10-23(금) 10:00 KST (SPEC §8.1 완료 조건과 같아요) */
export const TODAY = new Date('2026-10-23T10:00:00+09:00');

export async function fixToday(page: Page) {
  // 시계만 고정하고 타이머는 그대로 둬요.
  await page.clock.setFixedTime(TODAY);
}

export async function onboard(page: Page, { hireDate = '2021-03-02', usedDays = '0' } = {}) {
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1, name: '연차 플래너 시작하기' })).toBeVisible();
  await page.getByLabel('입사일').fill(hireDate);
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByLabel('이미 쓴 연차 (일)').fill(usedDays);
  await page.getByRole('button', { name: '시작하기' }).click();
  await expect(page.getByRole('heading', { level: 1, name: '홈' })).toBeVisible();
}

/** 모바일은 하단 탭, 768px 이상은 사이드바로 이동해요. */
export async function goTo(
  page: Page,
  isMobile: boolean,
  name: '홈' | '달력' | '추천' | '근무' | '설정',
) {
  if (name === '설정' && isMobile) {
    await page.getByRole('banner').getByRole('link', { name: '설정' }).click();
  } else {
    const nav = page.getByRole('navigation', { name: isMobile ? '하단 탭' : '주요 메뉴' });
    await nav.getByRole('link', { name }).click();
  }
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}

/** 제목(h2)으로 카드·섹션을 찾아요. */
export const card = (page: Page, title: string): Locator =>
  page.locator('section').filter({ has: page.getByRole('heading', { level: 2, name: title }) });

export const dayCell = (page: Page, month: number, day: number): Locator =>
  page.getByRole('button', { name: new RegExp(`^${month}월 ${day}일 `) });
