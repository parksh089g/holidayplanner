import { WEEK_LIMIT_MIN, WEEK_NEAR_MIN, type WeekResult } from '../../core/worktime';
import { formatMinutes } from '../../lib/format';

const WARNING = {
  none: { bar: 'bg-blue-600 dark:bg-blue-500', label: '' },
  near: { bar: 'bg-amber-500', label: '48시간 이상' },
  over: { bar: 'bg-red-600', label: '52시간 초과' },
} as const;

/** 주 합계(실근로·연장 추정)와 주 52시간 게이지. 48시간 이상 노랑, 52시간 초과 빨강 + 글자 배지 (SPEC §8.5) */
export function WeekSummary({ week, label = '이번 주' }: { week: WeekResult; label?: string }) {
  const warning = WARNING[week.warning];
  return (
    <div>
      <p className="text-sm">
        {label} 실근로 <strong className="tabular-nums">{formatMinutes(week.workedMin)}</strong> ·
        연장(추정) <strong className="tabular-nums">{formatMinutes(week.overtimeMin)}</strong>
      </p>
      <div
        role="meter"
        aria-label="주 52시간 대비 실근로"
        aria-valuemin={0}
        aria-valuemax={WEEK_LIMIT_MIN}
        aria-valuenow={Math.min(week.workedMin, WEEK_LIMIT_MIN)}
        aria-valuetext={`${formatMinutes(week.workedMin)} / 52시간`}
        className="relative mt-2 h-3 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
      >
        <span
          className={`block h-full ${warning.bar}`}
          style={{ width: `${Math.min(100, (week.workedMin / WEEK_LIMIT_MIN) * 100)}%` }}
        />
        <span
          aria-hidden="true"
          className="absolute inset-y-0 w-0.5 bg-gray-500"
          style={{ left: `${(WEEK_NEAR_MIN / WEEK_LIMIT_MIN) * 100}%` }}
        />
      </div>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
        {week.remainingTo52Min >= 0
          ? `52시간까지 ${formatMinutes(week.remainingTo52Min)} 남았어요.`
          : `52시간을 ${formatMinutes(-week.remainingTo52Min)} 넘었어요.`}
        {warning.label && (
          <span
            className={`rounded-md px-1.5 py-0.5 text-xs font-semibold ${
              week.warning === 'over'
                ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200'
                : 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100'
            }`}
          >
            {warning.label}
          </span>
        )}
      </p>
      <p className="mt-3 text-xs text-gray-600 dark:text-gray-400">
        연장근로는 기록으로 추정한 값이에요. 법적 판단이 아니에요.
      </p>
    </div>
  );
}
