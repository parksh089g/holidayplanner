import type { MouseEvent } from 'react';
import { weekdayOf } from '../../core/date';
import type { Holiday, ISODate } from '../../core/types';
import { DAY_STANDARD_MIN, type DayResult } from '../../core/worktime';
import { dayColor } from '../../lib/calendarStyle';
import { formatMinutes } from '../../lib/format';

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];

const SEGMENTS = [
  { key: 'regular', label: '정규', className: 'bg-blue-600 dark:bg-blue-500' },
  { key: 'overtime', label: '초과', className: 'bg-amber-500' },
  { key: 'leave', label: '휴가 인정', className: 'bg-teal-400 dark:bg-teal-600' },
] as const;

function parts(day: DayResult) {
  return {
    regular: day.workedMin - day.overtimeMin,
    overtime: day.overtimeMin,
    leave: day.leaveCreditMin,
  };
}

function summary(day: DayResult): string {
  if (day.inProgress && day.workedMin === 0) return '근무 중';
  const texts: string[] = [];
  if (day.hasLog) texts.push(formatMinutes(day.workedMin));
  if (day.overtimeMin > 0) texts.push(`초과 ${formatMinutes(day.overtimeMin)}`);
  if (day.leaveCreditMin > 0) texts.push(`휴가 ${formatMinutes(day.leaveCreditMin)}`);
  return texts.length > 0 ? texts.join(' · ') : '기록 없음';
}

/** SPEC §8.5 요일별 막대: 정규 8시간 / 초과 / 휴가 인정 시간. 숫자도 글자로 보여줘요. */
export function WeekDayBars({
  days,
  today,
  holidaysByDate,
  isOff,
  onSelect,
}: {
  days: DayResult[];
  today: ISODate;
  holidaysByDate: ReadonlyMap<ISODate, Holiday[]>;
  isOff: (date: ISODate) => boolean;
  onSelect: (date: ISODate, trigger: HTMLElement) => void;
}) {
  const scale = Math.max(600, ...days.map((d) => d.workedMin + d.leaveCreditMin));
  const pct = (min: number) => `${(min / scale) * 100}%`;

  return (
    <div>
      <ul className="space-y-1">
        {days.map((day) => {
          const holidays = holidaysByDate.get(day.date) ?? [];
          const [, month, date] = day.date.split('-').map(Number);
          const weekday = WEEKDAY[weekdayOf(day.date)];
          const text = summary(day);
          const extra = [
            day.date === today && '오늘',
            ...holidays.map((h) => h.name),
            isOff(day.date) && holidays.length === 0 && '쉬는 날',
          ].filter(Boolean);
          const p = parts(day);
          return (
            <li key={day.date}>
              <button
                type="button"
                onClick={(e: MouseEvent<HTMLButtonElement>) => onSelect(day.date, e.currentTarget)}
                className={`grid min-h-12 w-full grid-cols-[3rem_1fr] items-center gap-x-3 gap-y-1 rounded-lg px-2 py-1.5 text-left hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:hover:bg-gray-800 ${
                  day.date === today ? 'bg-blue-50 dark:bg-blue-950' : ''
                }`}
              >
                <span className="sr-only">
                  {[`${month}월 ${date}일 ${weekday}요일`, ...extra, text].join(', ')}
                </span>
                {/* 막대 폭을 요일마다 같게 두려고 글자는 막대 위에 따로 써요. */}
                <span
                  aria-hidden="true"
                  className={`row-span-2 text-sm font-semibold ${dayColor(day.date, holidays)}`}
                >
                  {weekday} <span className="tabular-nums">{date}</span>
                </span>
                <span
                  aria-hidden="true"
                  className="text-xs tabular-nums text-gray-700 dark:text-gray-300"
                >
                  {text}
                </span>
                <span
                  aria-hidden="true"
                  className="relative flex h-3 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
                >
                  {SEGMENTS.map((s) => (
                    <span key={s.key} className={s.className} style={{ width: pct(p[s.key]) }} />
                  ))}
                  <span
                    className="absolute inset-y-0 w-0.5 bg-gray-400 dark:bg-gray-500"
                    style={{ left: pct(DAY_STANDARD_MIN) }}
                  />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <ul
        aria-label="막대 색 설명"
        className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-700 dark:text-gray-300"
      >
        {SEGMENTS.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span aria-hidden="true" className={`h-3 w-3 rounded-sm ${s.className}`} />
            {s.label}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-3 w-0.5 bg-gray-400" />
          8시간
        </li>
      </ul>
    </div>
  );
}
