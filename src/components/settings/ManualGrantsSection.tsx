import { useId, useState, type FormEvent } from 'react';
import { addDaysISO, addYearsISO } from '../../core/date';
import type { ManualGrant } from '../../core/types';
import { deleteManualGrant, newId, putManualGrant } from '../../db/repo';
import { ValidationError, isISODate } from '../../db/validate';
import { formatDays, formatDotDate, parseDaysToQuarters } from '../../lib/format';
import { inputClass, secondaryButtonClass } from '../../lib/ui';
import { Card } from '../Card';

const signedDays = (q: number) => `${q > 0 ? '+' : ''}${formatDays(q)}일`;

/** SPEC §5.2, §8.6 수동 보정: 인사시스템 숫자 맞추기, 이월·포상 연차, 감액(음수) */
export function ManualGrantsSection({ grants }: { grants: ManualGrant[] }) {
  const id = useId();
  const [grantDate, setGrantDate] = useState('');
  const [expireDate, setExpireDate] = useState('');
  const [days, setDays] = useState('');
  const [memo, setMemo] = useState('');
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();

  const onGrantDate = (value: string) => {
    setGrantDate(value);
    // 소멸일을 비워 두었으면 1년 뒤 전날로 채워 둬요.
    if (isISODate(value) && !expireDate) setExpireDate(addDaysISO(addYearsISO(value, 1), -1));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(undefined);
    const quarters = parseDaysToQuarters(days, { allowNegative: true });
    if (quarters === undefined || quarters === 0) {
      setError('일수는 0.25일 단위로 입력해 주세요. 줄일 때는 -1처럼 음수로 입력해요.');
      return;
    }
    try {
      await putManualGrant({ id: newId(), grantDate, expireDate, quarters, memo: memo.trim() });
      setError(undefined);
      setMessage(`수동 보정을 추가했어요: ${signedDays(quarters)}`);
      setGrantDate('');
      setExpireDate('');
      setDays('');
      setMemo('');
    } catch (err) {
      setError(err instanceof ValidationError ? err.message : '저장하지 못했어요.');
    }
  };

  return (
    <Card title="수동 보정">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        인사시스템 숫자와 맞추거나 이월·포상 연차를 더할 때 써요. 줄이려면 음수(-1)로 입력해요.
      </p>
      {grants.length > 0 && (
        <ul className="mt-3 divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
          {grants.map((g) => {
            const label = `${formatDotDate(g.grantDate)}–${formatDotDate(g.expireDate)} ${signedDays(g.quarters)}`;
            return (
              <li key={g.id} className="flex items-center justify-between gap-2 py-1 pl-3 pr-1">
                <span className="text-sm">
                  <span className="tabular-nums">{label}</span>
                  {g.memo && (
                    <span className="block text-xs text-gray-600 dark:text-gray-400">{g.memo}</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    void deleteManualGrant(g.id).then(() => setMessage('수동 보정을 지웠어요.'))
                  }
                  aria-label={`${label} 삭제`}
                  className="h-11 shrink-0 rounded-lg px-3 text-sm font-medium text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                >
                  삭제
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <form onSubmit={onSubmit} noValidate className="mt-3 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor={`${id}-grant`} className="text-sm font-medium">
              발생일
            </label>
            <input
              id={`${id}-grant`}
              type="date"
              value={grantDate}
              onChange={(e) => onGrantDate(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor={`${id}-expire`} className="text-sm font-medium">
              소멸일
            </label>
            <input
              id={`${id}-expire`}
              type="date"
              value={expireDate}
              onChange={(e) => setExpireDate(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor={`${id}-days`} className="text-sm font-medium">
              일수
            </label>
            <input
              id={`${id}-days`}
              type="number"
              inputMode="decimal"
              step={0.25}
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor={`${id}-memo`} className="text-sm font-medium">
              보정 메모
            </label>
            <input
              id={`${id}-memo`}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className={inputClass}
            />
          </div>
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
        <button type="submit" className={`${secondaryButtonClass} w-full`}>
          수동 보정 추가
        </button>
      </form>
    </Card>
  );
}
