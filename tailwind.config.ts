import type { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      // 외부 폰트 없이 기기에 있는 한국어 글꼴을 써요 (CLAUDE.md).
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          '"Apple SD Gothic Neo"',
          '"Malgun Gothic"',
          '"Noto Sans KR"',
          ...defaultTheme.fontFamily.sans,
        ],
      },
    },
  },
  plugins: [],
} satisfies Config;
