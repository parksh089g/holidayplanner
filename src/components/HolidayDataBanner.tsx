import { AlertIcon } from './icons';

const yearsText = (years: number[]) => years.map((y) => `${y}년`).join(', ');

/** 공휴일 파일이 없거나 불러오지 못한 연도를 알려요. 그 해는 주말만 휴무로 계산해요 (SPEC §7). */
export function HolidayDataBanner({
  missingYears,
  failedYears,
}: {
  missingYears: number[];
  failedYears: number[];
}) {
  if (missingYears.length === 0 && failedYears.length === 0) return null;
  return (
    <div
      role="status"
      className="mt-4 flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
    >
      <AlertIcon className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="space-y-1">
        {missingYears.length > 0 && (
          <p>{yearsText(missingYears)} 공휴일 데이터가 없어요. 주말만 휴무로 계산해요.</p>
        )}
        {failedYears.length > 0 && (
          <p>
            {yearsText(failedYears)} 공휴일 데이터를 불러오지 못했어요. 주말만 휴무로 계산해요.
            네트워크를 확인하고 다시 열어 주세요.
          </p>
        )}
      </div>
    </div>
  );
}
