import { useRef, type MouseEvent, type TouchEvent } from 'react';
import { monthGrid, type YearMonth } from '../../core/calendar';
import { weekdayOf } from '../../core/date';
import type { Holiday, ISODate, LeaveEntry } from '../../core/types';
import { dayColor } from '../../lib/calendarStyle';
import { describeLeave, leaveChipClass, leaveChipLabel } from '../../lib/leaveLabels';

export interface DayInfo {
  holidays: Holiday[];
  /** 일괄 차감 항목은 빼고 넘겨요. */
  leaves: LeaveEntry[];
  hasLog: boolean;
}

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];
const WEEKDAY_NAME = ['일', '월', '화', '수', '목', '금', '토'];
const SWIPE_PX = 50;

function dayLabel(date: ISODate, info: DayInfo, today: ISODate): string {
  const [, month, day] = date.split('-').map(Number);
  const parts = [`${month}월 ${day}일 ${WEEKDAY_NAME[weekdayOf(date)]}요일`];
  if (date === today) parts.push('오늘');
  parts.push(...info.holidays.map((h) => h.name));
  parts.push(...info.leaves.map((e) => describeLeave(e)));
  if (info.hasLog) parts.push('근무 기록 있음');
  return parts.join(', ');
}

export function MonthView({
  month,
  today,
  dayInfo,
  onSelect,
  onShift,
}: {
  month: YearMonth;
  today: ISODate;
  dayInfo: (date: ISODate) => DayInfo;
  onSelect: (date: ISODate, trigger: HTMLElement) => void;
  /** 스와이프로 앞뒤 달로 옮겨요. */
  onShift: (months: number) => void;
}) {
  const touch = useRef<{ x: number; y: number }>();

  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: TouchEvent) => {
    const start = touch.current;
    touch.current = undefined;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy)) return;
    onShift(dx < 0 ? 1 : -1);
  };

  return (
    <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div aria-hidden="true" className="grid grid-cols-7 pb-1 text-center text-xs font-medium">
        {WEEKDAYS.map((w, i) => (
          <span
            key={w}
            className={
              i === 6
                ? 'text-red-700 dark:text-red-400'
                : i === 5
                  ? 'text-blue-700 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400'
            }
          >
            {w}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-gray-200 bg-gray-200 dark:border-gray-800 dark:bg-gray-800">
        {monthGrid(month)
          .flat()
          .map((date, i) => {
            if (!date) return <div key={`blank-${i}`} className="bg-gray-50 dark:bg-gray-950" />;
            const info = dayInfo(date);
            const isToday = date === today;
            return (
              <button
                key={date}
                type="button"
                onClick={(e: MouseEvent<HTMLButtonElement>) => onSelect(date, e.currentTarget)}
                className={`flex h-[4.5rem] min-w-0 flex-col items-stretch gap-0.5 bg-white p-1 text-left hover:bg-gray-50 focus-visible:relative focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:bg-gray-900 dark:hover:bg-gray-800 ${
                  isToday ? 'ring-2 ring-inset ring-blue-600 dark:ring-blue-400' : ''
                }`}
              >
                {/* 스크린리더는 이 설명만 읽어요. 보이는 숫자·칩은 장식으로 숨겨요. */}
                <span className="sr-only">{dayLabel(date, info, today)}</span>
                <span
                  aria-hidden="true"
                  className={`text-xs font-semibold tabular-nums ${dayColor(date, info.holidays)}`}
                >
                  {Number(date.slice(8))}
                </span>
                {info.holidays[0] && (
                  <span
                    aria-hidden="true"
                    className="truncate text-[10px] leading-tight text-red-700 dark:text-red-400"
                  >
                    {info.holidays[0].name}
                  </span>
                )}
                {info.leaves.slice(0, 2).map((entry) => (
                  <span
                    key={entry.id}
                    aria-hidden="true"
                    className={`truncate rounded px-0.5 text-[10px] font-semibold leading-tight ${leaveChipClass(entry)}`}
                  >
                    {leaveChipLabel(entry)}
                  </span>
                ))}
                {info.hasLog && (
                  <span
                    aria-hidden="true"
                    className="mx-auto mt-auto h-1.5 w-1.5 shrink-0 rounded-full bg-gray-500 dark:bg-gray-400"
                  />
                )}
              </button>
            );
          })}
      </div>
    </div>
  );
}
