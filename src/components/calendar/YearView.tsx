import { monthGrid, type YearMonth } from '../../core/calendar';
import type { ISODate } from '../../core/types';
import { dayColor } from '../../lib/calendarStyle';
import type { DayInfo } from './MonthView';

/** "연간" 보기: 12개월 미니 달력. 월을 누르면 그 달의 월 보기로 가요 (SPEC §8.3). */
export function YearView({
  year,
  today,
  dayInfo,
  onPickMonth,
}: {
  year: number;
  today: ISODate;
  dayInfo: (date: ISODate) => DayInfo;
  onPickMonth: (month: YearMonth) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 12 }, (_, i) => {
        const month = `${year}-${String(i + 1).padStart(2, '0')}`;
        const dates = monthGrid(month).flat();
        const days = dates.filter((d): d is ISODate => d !== null);
        const leaveDays = days.filter((d) => dayInfo(d).leaves.length > 0).length;
        const holidayDays = days.filter((d) => dayInfo(d).holidays.length > 0).length;
        return (
          <button
            key={month}
            type="button"
            onClick={() => onPickMonth(month)}
            className="rounded-lg border border-gray-200 p-2 text-left hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-gray-800 dark:hover:bg-gray-900"
          >
            <span className="sr-only">{`${i + 1}월 보기, 공휴일 ${holidayDays}일, 휴가 ${leaveDays}일`}</span>
            <span
              aria-hidden="true"
              className="flex items-baseline justify-between text-sm font-semibold"
            >
              {i + 1}월
              {leaveDays > 0 && (
                <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                  휴가 {leaveDays}일
                </span>
              )}
            </span>
            <span
              aria-hidden="true"
              className="mt-1 grid grid-cols-7 gap-px text-center text-[10px]"
            >
              {dates.map((date, j) => {
                if (!date) return <span key={`b-${j}`} />;
                const info = dayInfo(date);
                const onLeave = info.leaves.length > 0;
                return (
                  <span
                    key={date}
                    className={`rounded-sm tabular-nums leading-4 ${
                      onLeave ? 'bg-blue-600 text-white' : dayColor(date, info.holidays)
                    } ${date === today ? 'ring-1 ring-blue-600 dark:ring-blue-400' : ''}`}
                  >
                    {Number(date.slice(8))}
                  </span>
                );
              })}
            </span>
          </button>
        );
      })}
    </div>
  );
}
