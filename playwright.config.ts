import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

/** E2E: 빌드한 앱을 vite preview로 띄워 실제 브라우저로 확인해요 (T3-2). */
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/holidayplanner/`,
    // 날짜 계산이 CI(UTC)에서도 같도록 시간대를 고정해요.
    timezoneId: 'Asia/Seoul',
    locale: 'ko-KR',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/holidayplanner/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
