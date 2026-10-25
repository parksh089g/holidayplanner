/** 공용 폼 스타일. 터치 영역 44px 이상(h-11·h-12) (CLAUDE.md). */
export const inputClass =
  'mt-1 block h-12 w-full rounded-lg border border-gray-300 bg-white px-3 text-base text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/30 aria-[invalid=true]:border-red-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100';

export const primaryButtonClass =
  'h-12 rounded-lg bg-blue-600 px-4 font-semibold text-white hover:bg-blue-700 disabled:opacity-50';

export const secondaryButtonClass =
  'h-12 rounded-lg border border-gray-300 px-4 font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800';

/** 라디오를 버튼처럼 보이게 감싸는 label */
export const choiceClass =
  'flex h-11 cursor-pointer items-center justify-center rounded-lg border border-gray-300 px-2 text-sm text-gray-700 has-[:checked]:border-blue-600 has-[:checked]:bg-blue-50 has-[:checked]:font-semibold has-[:checked]:text-blue-800 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-blue-600 dark:border-gray-700 dark:text-gray-300 dark:has-[:checked]:border-blue-400 dark:has-[:checked]:bg-blue-950 dark:has-[:checked]:text-blue-200';
