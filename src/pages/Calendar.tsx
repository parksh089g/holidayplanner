import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useMemo, useRef, useState } from 'react';
import { DaySheet } from '../components/calendar/DaySheet';
import { MonthView, type DayInfo } from '../components/calendar/MonthView';
import { YearView } from '../components/calendar/YearView';
import { HolidayDataBanner } from '../components/HolidayDataBanner';
import { computeAutoGrants } from '../core/accrual';
import { monthRange, shiftMonth } from '../core/calendar';
import { addYearsISO, toISO } from '../core/date';
import { isOffDay } from '../core/holidays';
import { leaveQuartersByDate } from '../core/leave';
import type { Holiday, ISODate, LeaveEntry } from '../core/types';
import { getProfile, listLeaveEntries, listManualGrants, listWorkLogs } from '../db/repo';
import { useHolidays } from '../hooks/useHolidays';
import { useNow } from '../hooks/useNow';
import { useCalendarStore } from '../store/calendar';

const navButton =
  'inline-flex h-11 w-11 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-gray-200 dark:hover:bg-gray-800';

function groupByDate<T extends { date: ISODate }>(items: T[]): Map<ISODate, T[]> {
  const map = new Map<ISODate, T[]>();
  for (const item of items) map.set(item.date, [...(map.get(item.date) ?? []), item]);
  return map;
}

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path
        d={dir === 'left' ? 'm15 6-6 6 6 6' : 'm9 6 6 6-6 6'}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** SPEC §8.3 달력: 월 보기(기본)·연간 보기, 날짜를 누르면 휴가·근무 시트 */
export default function Calendar() {
  const [now] = useNow(60_000);
  const today = toISO(now);
  const { month: storedMonth, view, setMonth, setView } = useCalendarStore();
  const month = storedMonth ?? today.slice(0, 7);
  const year = Number(month.slice(0, 4));
  const range =
    view === 'month' ? monthRange(month) : { from: `${year}-01-01`, to: `${year}-12-31` };

  const holidays = useHolidays([year]);
  const profile = useLiveQuery(getProfile);
  const entries = useLiveQuery(() => listLeaveEntries());
  const manualGrants = useLiveQuery(listManualGrants);
  const logs = useLiveQuery(() => listWorkLogs(range), [range.from, range.to]);
  const [selected, setSelected] = useState<ISODate>();
  const trigger = useRef<HTMLElement | null>(null);

  const holidaysByDate = useMemo(
    () => groupByDate<Holiday>(holidays.holidays),
    [holidays.holidays],
  );
  const entriesByDate = useMemo(() => groupByDate<LeaveEntry>(entries ?? []), [entries]);
  const leaveQByDate = useMemo(() => leaveQuartersByDate(entries ?? []), [entries]);
  const logByDate = useMemo(() => new Map((logs ?? []).map((l) => [l.date, l])), [logs]);
  // 보고 있는 기간까지 자동 발생분을 계산해 잔여 경고에 써요.
  const grants = useMemo(() => {
    if (!profile || !manualGrants) return undefined;
    const nextYear = addYearsISO(today, 1);
    const until = range.to > nextYear ? range.to : nextYear;
    return [...computeAutoGrants(profile.hireDate, until), ...manualGrants];
  }, [profile, manualGrants, today, range.to]);

  const dayInfo = useCallback(
    (date: ISODate): DayInfo => ({
      holidays: holidaysByDate.get(date) ?? [],
      // 온보딩 일괄 차감은 그날 쉰 게 아니라서 달력 칩으로 그리지 않아요.
      leaves: (entriesByDate.get(date) ?? []).filter((e) => !e.isBulk),
      hasLog: logByDate.has(date),
    }),
    [holidaysByDate, entriesByDate, logByDate],
  );

  const closeSheet = useCallback(() => {
    setSelected(undefined);
    trigger.current?.focus();
  }, []);

  const loaded = profile && entries && grants && logs;
  const [, m] = month.split('-').map(Number);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">달력</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMonth(today.slice(0, 7))}
            className="h-11 rounded-lg border border-gray-300 px-3 text-sm font-medium hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            오늘
          </button>
          <div
            role="group"
            aria-label="보기"
            className="flex rounded-lg border border-gray-300 p-0.5 dark:border-gray-700"
          >
            {(
              [
                ['month', '월'],
                ['year', '연간'],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={`h-10 rounded-md px-3 text-sm ${
                  view === v
                    ? 'bg-blue-600 font-semibold text-white'
                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <button
          type="button"
          className={navButton}
          aria-label={view === 'month' ? '이전 달' : '이전 해'}
          onClick={() => setMonth(shiftMonth(month, view === 'month' ? -1 : -12))}
        >
          <Chevron dir="left" />
        </button>
        <h2 aria-live="polite" className="text-lg font-semibold tabular-nums">
          {view === 'month' ? `${year}년 ${m}월` : `${year}년`}
        </h2>
        <button
          type="button"
          className={navButton}
          aria-label={view === 'month' ? '다음 달' : '다음 해'}
          onClick={() => setMonth(shiftMonth(month, view === 'month' ? 1 : 12))}
        >
          <Chevron dir="right" />
        </button>
      </div>

      <HolidayDataBanner missingYears={holidays.missingYears} failedYears={holidays.failedYears} />

      {loaded && (
        <div className="mt-3">
          {view === 'month' ? (
            <MonthView
              month={month}
              today={today}
              dayInfo={dayInfo}
              onSelect={(date, el) => {
                trigger.current = el;
                setSelected(date);
              }}
              onShift={(n) => setMonth(shiftMonth(month, n))}
            />
          ) : (
            <YearView
              year={year}
              today={today}
              dayInfo={dayInfo}
              onPickMonth={(ym) => {
                setMonth(ym);
                setView('month');
              }}
            />
          )}
          {view === 'month' && (
            <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
              날짜를 누르면 휴가와 근무 기록을 넣을 수 있어요. 점은 근무 기록이 있는 날이에요.
            </p>
          )}
        </div>
      )}

      {loaded && selected && (
        <DaySheet
          key={selected}
          date={selected}
          today={today}
          profile={profile}
          isOff={isOffDay(selected, holidays.off)}
          holidays={holidaysByDate.get(selected) ?? []}
          entries={entriesByDate.get(selected) ?? []}
          allEntries={entries}
          grants={grants}
          log={logByDate.get(selected)}
          leaveQ={leaveQByDate.get(selected) ?? 0}
          onClose={closeSheet}
        />
      )}
    </div>
  );
}
