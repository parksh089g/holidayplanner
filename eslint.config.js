import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'coverage'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "NewExpression[callee.name='Date'][arguments.length=1][arguments.0.type='Literal']",
          message: "new Date('YYYY-MM-DD')는 UTC로 해석돼요. core/date.ts의 parseISO를 쓰세요.",
        },
      ],
    },
  },
  // CLAUDE.md 구조 원칙: src/core는 순수 함수만 둬요.
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: ['react', 'react-dom', 'dexie', 'dexie-react-hooks', 'zustand'].map((name) => ({
            name,
            message: 'src/core에서는 UI·저장소 라이브러리를 import하지 않아요.',
          })),
        },
      ],
      'no-restricted-globals': [
        'error',
        ...['window', 'document', 'navigator', 'localStorage', 'indexedDB'].map((name) => ({
          name,
          message: 'src/core는 브라우저 전역에 접근하지 않아요.',
        })),
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "NewExpression[callee.name='Date'][arguments.length=1][arguments.0.type='Literal']",
          message: "new Date('YYYY-MM-DD')는 UTC로 해석돼요. core/date.ts의 parseISO를 쓰세요.",
        },
        {
          selector: "MemberExpression[object.name='Date'][property.name='now']",
          message: '오늘 날짜는 asOf 인자로 받아요.',
        },
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: '오늘 날짜는 asOf 인자로 받아요.',
        },
      ],
    },
  },
  prettier,
);
