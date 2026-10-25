import { useState } from 'react';
import { addDaysISO, toISO } from '../../core/date';
import { isOffDay } from '../../core/holidays';
import { QUARTERS_PER_DAY, type ISODate, type Profile, type WorkLog } from '../../core/types';
import { computeDay, isOngoing, type Now } from '../../core/worktime';
import { putWorkLog } from '../../db/repo';
import { formatMinutes } from '../../lib/format';
import { toHHmm } from '../../lib/today';
import { primaryButtonClass } from '../../lib/ui';

/**
 * 출근/퇴근 버튼과 오늘 근무 상태 (SPEC §5.6-5). 지금 시각을 분 단위 그대로 저장해요.
 * logs에는 어제와 오늘 기록이 들어 있어야 해요 (어제 시작한 야간 근무를 이어서 퇴근).
 */
export function ClockPanel({
  now,
  onRecorded,
  profile,
  off,
  leaveQByDate,
  logs,
}: {
  now: Date;
  /** 기록한 뒤 화면 시각을 바로 갱신해요. */
  onRecorded: () => void;
  profile: Profile;
  off: Set<ISODate>;
  leaveQByDate: ReadonlyMap<ISODate, number>;
  logs: WorkLog[];
}) {
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  const today = toISO(now);
  const nowAt: Now = { date: today, time: toHHmm(now) };
  const todayLog = logs.find((l) => l.date === today);
  const yesterdayLog = logs.find((l) => l.date === addDaysISO(today, -1));
  // 어제 시작한 야간 근무가 아직 진행 중이면 그 기록을 이어서 보여줘요.
  const active =
    todayLog ?? (yesterdayLog && isOngoing(yesterdayLog, nowAt) ? yesterdayLog : undefined);
  const day = active
    ? computeDay(active, {
        isOffDay: isOffDay(active.date, off),
        leaveQ: leaveQByDate.get(active.date) ?? 0,
        lunch: { start: profile.lunchStart, end: profile.lunchEnd },
        now: nowAt,
      })
    : undefined;

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

  const buttonClass = `${primaryButtonClass} mt-3 w-full`;

  return (
    <div>
      {!active || !day ? (
        <>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {(leaveQByDate.get(today) ?? 0) >= QUARTERS_PER_DAY
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
            <strong className="tabular-nums">{formatMinutes(day.workedMin)}</strong>
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
          · <strong className="tabular-nums">{formatMinutes(day.workedMin)}</strong> 근무
          {day.overtimeMin > 0 && ` (연장 추정 ${formatMinutes(day.overtimeMin)})`}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
