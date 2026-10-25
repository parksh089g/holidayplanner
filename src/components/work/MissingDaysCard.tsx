import type { ISODate } from '../../core/types';
import type { MissingWorkDay } from '../../core/worktime';
import { formatShortDate } from '../../lib/format';
import { primaryButtonClass } from '../../lib/ui';
import { Card } from '../Card';

const REASON = { 'no-log': '기록 없음', 'no-clock-out': '퇴근 기록 없음' } as const;

/** SPEC §8.5 기록이 빠진 지난 근무일과 "정시로 채우기" */
export function MissingDaysCard({
  days,
  thisYear,
  standard,
  busy,
  onFill,
  onEdit,
}: {
  days: MissingWorkDay[];
  thisYear: number;
  standard: { workStart: string; workEnd: string };
  busy: boolean;
  onFill: (days: MissingWorkDay[]) => void;
  onEdit: (date: ISODate, trigger: HTMLElement) => void;
}) {
  const fillable = days.filter((d) => d.fill);
  return (
    <Card title="기록이 빠진 날">
      {days.length === 0 ? (
        <p className="text-sm text-gray-600 dark:text-gray-400">
          최근 4주 동안 빠진 기록이 없어요.
        </p>
      ) : (
        <>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            정시({standard.workStart}–{standard.workEnd})로 채우거나 직접 입력해 주세요.
          </p>
          <ul className="mt-2 divide-y divide-gray-100 dark:divide-gray-800">
            {days.map((d) => {
              const date = formatShortDate(d.date, thisYear);
              return (
                <li key={d.date} className="flex items-center justify-between gap-2 py-1">
                  <span className="text-sm">
                    <span className="font-medium tabular-nums">{date}</span> · {REASON[d.reason]}
                    {d.reason === 'no-clock-out' && d.fill && ` (출근 ${d.fill.clockIn})`}
                    {d.partialLeave && (
                      <span className="block text-xs text-gray-600 dark:text-gray-400">
                        반차·반반차가 있어 직접 입력해야 해요.
                      </span>
                    )}
                  </span>
                  {d.fill ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onFill([d])}
                      aria-label={`${date} 정시로 채우기`}
                      className="h-11 shrink-0 rounded-lg px-3 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50 dark:text-blue-300 dark:hover:bg-blue-950"
                    >
                      정시로 채우기
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => onEdit(d.date, e.currentTarget)}
                      aria-label={`${date} 직접 입력`}
                      className="h-11 shrink-0 rounded-lg px-3 text-sm font-medium text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950"
                    >
                      직접 입력
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          {fillable.length > 1 && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onFill(fillable)}
              className={`${primaryButtonClass} mt-3 w-full`}
            >
              {fillable.length}일 모두 정시로 채우기
            </button>
          )}
        </>
      )}
    </Card>
  );
}
