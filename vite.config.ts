import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // GitHub Pages 프로젝트 사이트 경로: https://<github-id>.github.io/holidayplanner/
  base: '/holidayplanner/',
  plugins: [
    react(),
    // SPEC §9: 앱 셸 precache, 공휴일 JSON은 StaleWhileRevalidate
    VitePWA({
      registerType: 'autoUpdate',
      // 아이콘은 아래 globPatterns가 이미 precache해요 (중복 방지)
      includeManifestIcons: false,
      manifest: {
        name: '연차 플래너',
        short_name: '연차',
        description: '남은 연차 계산, 샌드위치 연휴 추천, 초과근무 정산',
        lang: 'ko',
        display: 'standalone',
        start_url: '/holidayplanner/',
        scope: '/holidayplanner/',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: /\/holidays\/\d{4}\.json$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'holidays',
              expiration: { maxEntries: 20 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/core/**/*.ts'],
      exclude: ['src/core/types.ts'],
      thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 },
    },
  },
});
