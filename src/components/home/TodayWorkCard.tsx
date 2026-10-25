import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { addDaysISO, startOfWeekMon, toISO } from '../../core/date';
import { isOffDay } from '../../core/holidays';
import type { ISODate, Profile, WorkLog } from '../../core/types';
import {
  WEEK_LIMIT_MIN,
  WEEK_NEAR_MIN,
  computeDay,
  computeWeek,
  isOngoing,
  type Now,
} from '../../core/worktime';
import { listWorkLogs, putWorkLog } from '../../db/repo';
import { formatMinutes } from '../../lib/format';
import { toHHmm } from '../../lib/today';
import { Card } from '../Card';

const WARNING = {
  none: { bar: 'bg-blue-600 dark:bg-blue-500', label: '' },
  near: { bar: 'bg-amber-500', label: '48시간 이상' },
  over: { bar: 'bg-red-600', label: '52시간 초과' },
} as const;

const buttonClass =
  'mt-3 h-12 w-full rounded-lg font-semibold text-white disabled:opacity-50 bg-blue-600 hover:bg-blue-700';

/** SPEC §8.2-4, §5.6: 출퇴근 버튼, 현재까지 근무, 이번 주 연장(추정), 주 52시간 게이지 */
export function TodayWorkCard({
  now,
  onRecorded,
  profile,
  off,
  leaveQByDate,
}: {
  now: Date;
  /** 기록한 뒤 화면 시각을 바로 갱신해요. */
  onRecorded: () => void;
  profile: Profile;
  off: Set<ISODate>;
  leaveQByDate: ReadonlyMap<ISODate, number>;
}) {
  const today = toISO(now);
  const nowAt: Now = { date: today, time: toHHmm(now) };
  const yesterday = addDaysISO(today, -1);
  const monday = startOfWeekMon(today);
  const from = yesterday < monday ? yesterday : monday;
  const sunday = addDaysISO(monday, 6);
  const logs = useLiveQuery(() => listWorkLogs({ from, to: sunday }), [from, sunday]);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  if (!logs) return null;

  const lunch = { start: profile.lunchStart, end: profile.lunchEnd };
  const todayLog = logs.find((l) => l.date === today);
  const yesterdayLog = logs.find((l) => l.date === yesterday);
  // 어제 시작한 야간 근무가 아직 진행 중이면 그 기록을 이어서 보여줘요.
  const active =
    todayLog ?? (yesterdayLog && isOngoing(yesterdayLog, nowAt) ? yesterdayLog : undefined);
  const day = active
    ? computeDay(active, {
        isOffDay: isOffDay(active.date, off),
        leaveQ: leaveQByDate.get(active.date) ?? 0,
        lunch,
        now: nowAt,
      })
    : undefined;
  const week = computeWeek(today, logs, { off, leaveQByDate, lunch, now: nowAt });
  const warning = WARNING[week.warning];

  const record = async (log: WorkLog) => {
    setSaving(true);
    try {
      await putWorkLog(log);
      setError(undefined);
      onRecorded();
    } catch {
      setError('기록하지 못했어요. 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  const clockIn = () => {
    const at = new Date();
    void record({ date: toISO(at), clockIn: toHHmm(at), clockOut: '' });
  };

  const clockOut = (log: WorkLog) => {
    const at = new Date();
    const time = toHHmm(at);
    if (log.date === toISO(at) && time < log.clockIn) {
      setError('출근 시각보다 이른 시각이에요. 기기 시계를 확인해 주세요.');
      return;
    }
    void record({ ...log, clockOut: time });
  };

  const todayLeaveQ = leaveQByDate.get(today) ?? 0;

  return (
    <Card title="오늘 근무">
      {!active ? (
        <>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {todayLeaveQ >= 4
              ? '오늘은 휴가예요.'
              : isOffDay(today, off)
                ? '오늘은 쉬는 날이에요.'
                : '아직 출근 기록이 없어요.'}
          </p>
          <button type="button" onClick={clockIn} disabled={saving} className={buttonClass}>
            출근하기
          </button>
        </>
      ) : active.clockOut === '' ? (
        <>
          <p className="text-sm">
            {active.date !== today && '어제 '}
            <span className="font-semibold tabular-nums">{active.clockIn}</span> 출근 · 현재까지{' '}
            <strong className="tabular-nums">{formatMinutes(day!.workedMin)}</strong>
          </p>
          <button
            type="button"
            onClick={() => clockOut(active)}
            disabled={saving}
            className={buttonClass}
          >
            퇴근하기
          </button>
        </>
      ) : (
        <p className="text-sm">
          <span className="font-semibold tabular-nums">
            {active.clockIn}–{active.clockOut}
          </span>{' '}
          · <strong className="tabular-nums">{formatMinutes(day!.workedMin)}</strong> 근무
          {day!.overtimeMin > 0 && ` (연장 추정 ${formatMinutes(day!.overtimeMin)})`}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-red-700 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="mt-4 border-t border-gray-100 pt-3 dark:border-gray-800">
        <p className="text-sm">
          이번 주 실근로 <strong className="tabular-nums">{formatMinutes(week.workedMin)}</strong> ·
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
      </div>
      <p className="mt-3 text-xs text-gray-600 dark:text-gray-400">
        연장근로는 기록으로 추정한 값이에요. 법적 판단이 아니에요.
      </p>
    </Card>
  );
}
