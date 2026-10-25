import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useMemo, useRef, useState } from 'react';
import { DaySheet } from '../components/calendar/DaySheet';
import { Card } from '../components/Card';
import { HolidayDataBanner } from '../components/HolidayDataBanner';
import { Toast } from '../components/Toast';
import { ClockPanel } from '../components/work/ClockPanel';
import { MissingDaysCard } from '../components/work/MissingDaysCard';
import { WeekDayBars } from '../components/work/WeekDayBars';
import { WeekSummary } from '../components/work/WeekSummary';
import { computeAutoGrants } from '../core/accrual';
import { addDaysISO, addYearsISO, startOfWeekMon, toISO } from '../core/date';
import { isOffDay } from '../core/holidays';
import { leaveQuartersByDate } from '../core/leave';
import type { Holiday, ISODate, WorkLog } from '../core/types';
import { computeWeek, findMissingWorkDays, type MissingWorkDay } from '../core/worktime';
import {
  getProfile,
  listLeaveEntries,
  listManualGrants,
  listWorkLogs,
  replaceWorkLogs,
} from '../db/repo';
import { useHolidays } from '../hooks/useHolidays';
import { useNow } from '../hooks/useNow';
import { formatDateRange } from '../lib/format';
import { toHHmm } from '../lib/today';
import { useWorkStore } from '../store/work';

/** 기록 누락을 찾는 기간: 최근 4주(온보딩 이후)부터 어제까지 */
const MISSING_LOOKBACK_DAYS = 28;

const navButton =
  'inline-flex h-11 w-11 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-gray-200 dark:hover:bg-gray-800';

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

/** SPEC §8.5 근무: 출퇴근, 주 단위 요일별 막대·주 합계·52시간, 기록 누락과 정시로 채우기 */
export default function Work() {
  const [now, refreshNow] = useNow();
  const today = toISO(now);
  const thisYear = Number(today.slice(0, 4));
  const yesterday = addDaysISO(today, -1);
  const currentWeek = startOfWeekMon(today);
  const { weekStart: storedWeek, shiftWeek, resetWeek } = useWorkStore();
  const weekStart = storedWeek ?? currentWeek;
  const weekEnd = addDaysISO(weekStart, 6);
  const lookbackFrom = addDaysISO(today, -MISSING_LOOKBACK_DAYS);

  const years = [weekStart, weekEnd, lookbackFrom, today].map((d) => Number(d.slice(0, 4)));
  const holidays = useHolidays(years);
  const profile = useLiveQuery(getProfile);
  const entries = useLiveQuery(() => listLeaveEntries());
  const manualGrants = useLiveQuery(listManualGrants);
  const weekLogs = useLiveQuery(
    () => listWorkLogs({ from: weekStart, to: weekEnd }),
    [weekStart, weekEnd],
  );
  const recentLogs = useLiveQuery(
    () => listWorkLogs({ from: lookbackFrom, to: today }),
    [lookbackFrom, today],
  );

  const [selected, setSelected] = useState<ISODate>();
  const trigger = useRef<HTMLElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; undo?: () => Promise<void> }>();

  const leaveQByDate = useMemo(() => leaveQuartersByDate(entries ?? []), [entries]);
  const holidaysByDate = useMemo(() => {
    const map = new Map<ISODate, Holiday[]>();
    for (const h of holidays.holidays) map.set(h.date, [...(map.get(h.date) ?? []), h]);
    return map;
  }, [holidays.holidays]);
  const grants = useMemo(
    () =>
      profile && manualGrants
        ? [...computeAutoGrants(profile.hireDate, addYearsISO(today, 1)), ...manualGrants]
        : undefined,
    [profile, manualGrants, today],
  );

  const nowAt = { date: today, time: toHHmm(now) };
  const lunch = profile ? { start: profile.lunchStart, end: profile.lunchEnd } : undefined;
  const week =
    weekLogs && lunch
      ? computeWeek(weekStart, weekLogs, { off: holidays.off, leaveQByDate, lunch, now: nowAt })
      : undefined;

  // 공휴일을 다 불러온 뒤에 찾아야 공휴일을 누락으로 잘못 보지 않아요.
  const missing = useMemo(() => {
    if (!profile || !recentLogs || holidays.loading) return undefined;
    const onboardedOn = toISO(new Date(profile.onboardedAt));
    return findMissingWorkDays({
      from: onboardedOn > lookbackFrom ? onboardedOn : lookbackFrom,
      to: yesterday,
      logs: recentLogs,
      off: holidays.off,
      leaveQByDate,
      standard: profile,
      now: { date: today, time: toHHmm(now) },
    });
  }, [profile, recentLogs, holidays, leaveQByDate, lookbackFrom, yesterday, today, now]);

  const openDay = (date: ISODate, el: HTMLElement) => {
    trigger.current = el;
    setSelected(date);
  };
  const closeSheet = useCallback(() => {
    setSelected(undefined);
    trigger.current?.focus();
  }, []);

  const fill = async (days: MissingWorkDay[]) => {
    const logs = days.flatMap((d) => (d.fill ? [d.fill] : []));
    // 되돌리기: 퇴근만 채운 날은 원래 기록으로, 새로 만든 날은 지워요.
    const before = new Map((recentLogs ?? []).map((l) => [l.date, l]));
    const restore = logs.flatMap((l) => {
      const prev = before.get(l.date);
      return prev ? [prev] : [];
    });
    const created = logs.filter((l) => !before.has(l.date)).map((l) => l.date);
    setBusy(true);
    try {
      await replaceWorkLogs(logs, []);
      setToast({
        message: `${logs.length}일을 정시로 채웠어요.`,
        undo: async () => {
          await replaceWorkLogs(restore, created);
          setToast({ message: '되돌렸어요.' });
        },
      });
    } catch {
      setToast({ message: '채우지 못했어요. 다시 시도해 주세요.' });
    } finally {
      setBusy(false);
    }
  };

  const dismissToast = useCallback(() => setToast(undefined), []);
  const isCurrentWeek = weekStart === currentWeek;
  const clockLogs: WorkLog[] = (recentLogs ?? []).filter((l) => l.date >= yesterday);

  return (
    <div>
      <h1 className="text-2xl font-bold">근무</h1>
      <HolidayDataBanner missingYears={holidays.missingYears} failedYears={holidays.failedYears} />

      {profile && recentLogs && week && (
        <div className="mt-4 space-y-4">
          <Card title="오늘 근무">
            <ClockPanel
              now={now}
              onRecorded={refreshNow}
              profile={profile}
              off={holidays.off}
              leaveQByDate={leaveQByDate}
              logs={clockLogs}
            />
          </Card>

          <section
            aria-label="주간 근무"
            className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                className={navButton}
                aria-label="이전 주"
                onClick={() => shiftWeek(-1, currentWeek)}
              >
                <Chevron dir="left" />
              </button>
              <div className="text-center">
                <h2 aria-live="polite" className="text-base font-semibold tabular-nums">
                  {formatDateRange(weekStart, weekEnd, thisYear)}
                </h2>
                {isCurrentWeek ? (
                  <p className="text-xs text-gray-600 dark:text-gray-400">이번 주</p>
                ) : (
                  <button
                    type="button"
                    onClick={resetWeek}
                    className="h-8 px-2 text-xs font-medium text-blue-700 dark:text-blue-300"
                  >
                    이번 주로
                  </button>
                )}
              </div>
              <button
                type="button"
                className={navButton}
                aria-label="다음 주"
                onClick={() => shiftWeek(1, currentWeek)}
              >
                <Chevron dir="right" />
              </button>
            </div>
            <div className="mt-3">
              <WeekSummary week={week} label={isCurrentWeek ? '이번 주' : '이 주'} />
            </div>
            <div className="mt-4 border-t border-gray-100 pt-3 dark:border-gray-800">
              <WeekDayBars
                days={week.days}
                today={today}
                holidaysByDate={holidaysByDate}
                isOff={(date) => isOffDay(date, holidays.off)}
                onSelect={openDay}
              />
              <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                날짜를 누르면 근무 기록과 휴가를 고칠 수 있어요.
              </p>
            </div>
          </section>

          {missing && (
            <MissingDaysCard
              days={missing}
              thisYear={thisYear}
              standard={profile}
              busy={busy}
              onFill={(days) => void fill(days)}
              onEdit={openDay}
            />
          )}
        </div>
      )}

      {profile && entries && grants && selected && (
        <DaySheet
          key={selected}
          date={selected}
          today={today}
          profile={profile}
          isOff={isOffDay(selected, holidays.off)}
          holidays={holidaysByDate.get(selected) ?? []}
          entries={entries.filter((e) => e.date === selected)}
          allEntries={entries}
          grants={grants}
          log={[...(weekLogs ?? []), ...(recentLogs ?? [])].find((l) => l.date === selected)}
          leaveQ={leaveQByDate.get(selected) ?? 0}
          onClose={closeSheet}
        />
      )}

      {toast && (
        <Toast
          message={toast.message}
          actionLabel={toast.undo ? '되돌리기' : undefined}
          onAction={toast.undo ? () => void toast.undo?.() : undefined}
          onDismiss={dismissToast}
        />
      )}
    </div>
  );
}
