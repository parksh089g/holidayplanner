import { useId, useState, type FormEvent } from 'react';
import type { Holiday } from '../../core/types';
import { deleteCustomHoliday, putCustomHoliday } from '../../db/repo';
import { ValidationError } from '../../db/validate';
import { formatShortDate } from '../../lib/format';
import { inputClass, secondaryButtonClass } from '../../lib/ui';
import { Card } from '../Card';

/** SPEC §5.4, §8.6 회사 휴무일 (창립기념일 등). 추가한 날은 휴무로 계산해요. */
export function CompanyHolidaysSection({ holidays }: { holidays: Holiday[] }) {
  const id = useId();
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(undefined);
    try {
      await putCustomHoliday({ date, name, kind: 'company' });
      setError(undefined);
      setMessage(`회사 휴무일을 추가했어요: ${name.trim()}`);
      setDate('');
      setName('');
    } catch (err) {
      setError(err instanceof ValidationError ? err.message : '저장하지 못했어요.');
    }
  };

  return (
    <Card title="회사 휴무일">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        창립기념일처럼 회사가 쉬는 날을 넣으면 달력·추천·근무 계산에서 휴무로 봐요.
      </p>
      {holidays.length > 0 && (
        <ul className="mt-3 divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
          {holidays.map((h) => {
            const label = `${h.date.slice(0, 4)}년 ${formatShortDate(h.date)} ${h.name}`;
            return (
              <li key={h.date} className="flex items-center justify-between gap-2 py-1 pl-3 pr-1">
                <span className="text-sm tabular-nums">{label}</span>
                <button
                  type="button"
                  onClick={() =>
                    void deleteCustomHoliday(h.date).then(() =>
                      setMessage('회사 휴무일을 지웠어요.'),
                    )
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
            <label htmlFor={`${id}-date`} className="text-sm font-medium">
              날짜
            </label>
            <input
              id={`${id}-date`}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor={`${id}-name`} className="text-sm font-medium">
              이름
            </label>
            <input
              id={`${id}-name`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="창립기념일"
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
          회사 휴무일 추가
        </button>
      </form>
    </Card>
  );
}
