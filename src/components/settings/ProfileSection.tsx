import { useId, useState, type FormEvent } from 'react';
import { currentLeavePeriod } from '../../core/accrual';
import type { ISODate, Profile } from '../../core/types';
import { updateProfile } from '../../db/repo';
import { ValidationError, isISODate } from '../../db/validate';
import { formatDays, formatDotDate } from '../../lib/format';
import { inputClass, primaryButtonClass } from '../../lib/ui';
import { workTimesError, type WorkTimes } from '../../lib/workTimes';
import { Card } from '../Card';

const TIME_FIELDS = [
  ['workStart', '출근'],
  ['workEnd', '퇴근'],
  ['lunchStart', '점심 시작'],
  ['lunchEnd', '점심 끝'],
] as const;

/** SPEC §8.6 프로필: 입사일, 근무시간, 점심시간 */
export function ProfileSection({ profile, today }: { profile: Profile; today: ISODate }) {
  const id = useId();
  const [hireDate, setHireDate] = useState(profile.hireDate);
  const [times, setTimes] = useState<WorkTimes>({
    workStart: profile.workStart,
    workEnd: profile.workEnd,
    lunchStart: profile.lunchStart,
    lunchEnd: profile.lunchEnd,
  });
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();

  const period = isISODate(hireDate) ? currentLeavePeriod(hireDate, today) : undefined;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(undefined);
    const problem = !isISODate(hireDate)
      ? '입사일을 입력해 주세요.'
      : hireDate > today
        ? '입사일은 오늘 이후일 수 없어요.'
        : workTimesError(times);
    setError(problem);
    if (problem) return;
    try {
      await updateProfile({ hireDate, ...times });
      setMessage('프로필을 저장했어요.');
    } catch (err) {
      setError(err instanceof ValidationError ? err.message : '저장하지 못했어요.');
    }
  };

  return (
    <Card title="프로필">
      <form onSubmit={onSubmit} noValidate className="space-y-3">
        <div>
          <label htmlFor={`${id}-hire`} className="text-sm font-medium">
            입사일
          </label>
          <input
            id={`${id}-hire`}
            type="date"
            max={today}
            value={hireDate}
            onChange={(e) => setHireDate(e.target.value)}
            className={inputClass}
          />
          {period && (
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
              현재 연차 기간 {formatDotDate(period.start)}–{formatDotDate(period.end)}, 발생{' '}
              {formatDays(period.grantedQ)}일. 입사일을 바꾸면 자동 발생 연차를 모두 다시 계산해요.
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {TIME_FIELDS.map(([key, label]) => (
            <div key={key}>
              <label htmlFor={`${id}-${key}`} className="text-sm font-medium">
                {label}
              </label>
              <input
                id={`${id}-${key}`}
                type="time"
                value={times[key]}
                onChange={(e) => setTimes({ ...times, [key]: e.target.value })}
                className={inputClass}
              />
            </div>
          ))}
        </div>
        {error && (
          <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-400">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="text-sm font-medium text-blue-700 dark:text-blue-300">
            {message}
          </p>
        )}
        <button type="submit" className={`${primaryButtonClass} w-full`}>
          프로필 저장
        </button>
      </form>
    </Card>
  );
}
