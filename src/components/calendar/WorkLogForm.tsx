import { useId, useState, type FormEvent } from 'react';
import type { ISODate, Profile, WorkLog } from '../../core/types';
import { computeDay } from '../../core/worktime';
import { deleteWorkLog, putWorkLog } from '../../db/repo';
import { isHHmm } from '../../db/validate';
import { formatMinutes } from '../../lib/format';
import { toHHmm } from '../../lib/today';
import { inputClass, primaryButtonClass, secondaryButtonClass } from '../../lib/ui';

function draftError(d: {
  date: ISODate;
  today: ISODate;
  clockIn: string;
  clockOut: string;
  breakMinutes?: number;
}): string | undefined {
  if (!isHHmm(d.clockIn)) return '출근 시각을 입력해 주세요.';
  if (d.clockOut === '' && d.date !== d.today) {
    return '퇴근 시각을 입력해 주세요. 근무 중 기록은 오늘만 남길 수 있어요.';
  }
  if (d.clockOut !== '' && !isHHmm(d.clockOut)) return '퇴근 시각을 입력해 주세요.';
  const b = d.breakMinutes;
  if (b !== undefined && !(Number.isInteger(b) && b >= 0 && b <= 1440)) {
    return '휴게 시간은 0–1440분 정수로 입력해 주세요.';
  }
  return undefined;
}

/** 근무 기록 입력·수정·삭제 (SPEC §8.3). 처음 열면 프로필 근무시간으로 채워 둬요. */
export function WorkLogForm({
  date,
  today,
  profile,
  isOff,
  leaveQ,
  log,
  onMessage,
}: {
  date: ISODate;
  today: ISODate;
  profile: Profile;
  isOff: boolean;
  leaveQ: number;
  log?: WorkLog;
  onMessage: (message: string) => void;
}) {
  const id = useId();
  const [clockIn, setClockIn] = useState(log?.clockIn ?? profile.workStart);
  const [clockOut, setClockOut] = useState<string>(log ? log.clockOut : profile.workEnd);
  const [breakText, setBreakText] = useState(log?.breakMinutes?.toString() ?? '');
  const [note, setNote] = useState(log?.note ?? '');
  const [saving, setSaving] = useState(false);

  const breakMinutes = breakText.trim() === '' ? undefined : Number(breakText);
  const error = draftError({ date, today, clockIn, clockOut, breakMinutes });

  const draft: WorkLog = {
    date,
    clockIn,
    clockOut,
    ...(breakMinutes !== undefined ? { breakMinutes } : {}),
    ...(note.trim() ? { note: note.trim() } : {}),
  };
  const preview = error
    ? undefined
    : computeDay(draft, {
        isOffDay: isOff,
        leaveQ,
        lunch: { start: profile.lunchStart, end: profile.lunchEnd },
        now: date === today ? { date: today, time: toHHmm(new Date()) } : undefined,
      });

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (error) return;
    setSaving(true);
    try {
      await putWorkLog(draft);
      onMessage('근무 기록을 저장했어요.');
    } catch {
      onMessage('근무 기록을 저장하지 못했어요. 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    await deleteWorkLog(date);
    setClockIn(profile.workStart);
    setClockOut(profile.workEnd);
    setBreakText('');
    setNote('');
    onMessage('근무 기록을 지웠어요.');
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={`${id}-in`} className="text-sm font-medium">
            출근
          </label>
          <input
            id={`${id}-in`}
            type="time"
            value={clockIn}
            onChange={(e) => setClockIn(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor={`${id}-out`} className="text-sm font-medium">
            퇴근
          </label>
          <input
            id={`${id}-out`}
            type="time"
            value={clockOut}
            onChange={(e) => setClockOut(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>
      <div>
        <label htmlFor={`${id}-break`} className="text-sm font-medium">
          휴게 (분, 비우면 점심시간과 겹친 만큼 자동)
        </label>
        <input
          id={`${id}-break`}
          type="number"
          inputMode="numeric"
          min={0}
          max={1440}
          step={1}
          value={breakText}
          onChange={(e) => setBreakText(e.target.value)}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor={`${id}-note`} className="text-sm font-medium">
          근무 메모 (선택)
        </label>
        <input
          id={`${id}-note`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={inputClass}
        />
      </div>

      {date === today && (
        <p className="text-xs text-gray-600 dark:text-gray-400">
          오늘은 퇴근 칸을 비우면 근무 중으로 저장돼요.
        </p>
      )}
      {error ? (
        <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-400">
          {error}
        </p>
      ) : (
        preview && (
          <p className="text-sm">
            실근로 <strong>{formatMinutes(preview.workedMin)}</strong> · 휴게{' '}
            {formatMinutes(preview.breakMin)} · 연장(추정) {formatMinutes(preview.overtimeMin)}
            {isOff && preview.workedMin > 0 && (
              <span className="block text-gray-600 dark:text-gray-400">
                휴무일 근무라 전부 연장으로 봐요.
              </span>
            )}
            {clockOut !== '' && clockOut < clockIn && (
              <span className="block text-gray-600 dark:text-gray-400">
                퇴근이 출근보다 빨라서 다음 날 퇴근으로 계산해요.
              </span>
            )}
          </p>
        )
      )}

      <div className="flex gap-2">
        {log && (
          <button type="button" onClick={onDelete} className={`${secondaryButtonClass} flex-1`}>
            근무 기록 삭제
          </button>
        )}
        <button
          type="submit"
          disabled={saving || error !== undefined}
          className={`${primaryButtonClass} flex-[2]`}
        >
          근무 기록 저장
        </button>
      </div>
    </form>
  );
}
