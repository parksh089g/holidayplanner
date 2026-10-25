import type { CandidateDayKind } from '../core/bridge';

/** 추천 카드 미니 달력: 날의 종류별 색. 범례와 "연차 쓸 날" 글자로도 알려줘요. */
export const CANDIDATE_DAY_CLASS: Record<CandidateDayKind, string> = {
  off: 'bg-gray-100 dark:bg-gray-800',
  leave: 'bg-blue-600 text-white',
  planned:
    'bg-sky-100 text-sky-900 ring-1 ring-inset ring-sky-400 dark:bg-sky-900 dark:text-sky-100',
};

export const CANDIDATE_DAY_LEGEND: { kind: CandidateDayKind; label: string; swatch: string }[] = [
  { kind: 'off', label: '쉬는 날', swatch: 'bg-gray-200 dark:bg-gray-700' },
  { kind: 'leave', label: '연차 쓸 날', swatch: 'bg-blue-600' },
  {
    kind: 'planned',
    label: '이미 계획한 연차',
    swatch: 'bg-sky-100 ring-1 ring-inset ring-sky-400 dark:bg-sky-900',
  },
];
