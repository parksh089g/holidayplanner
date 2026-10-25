import { candidateDays, type BridgeCandidate } from '../../core/bridge';
import { weekdayOf } from '../../core/date';
import type { ISODate } from '../../core/types';
import { dayColor } from '../../lib/calendarStyle';
import { CANDIDATE_DAY_CLASS } from '../../lib/candidateStyle';
import { formatDateRange, formatShortDate } from '../../lib/format';
import { primaryButtonClass } from '../../lib/ui';

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];

/** SPEC §8.4 후보 카드: 구간·쉬는 일수·연차·효율, 미니 달력, 잔여 부족 배지, 계획에 넣기 */
export function BridgeCandidateCard({
  candidate,
  thisYear,
  planned,
  insufficient,
  busy,
  onPlan,
}: {
  candidate: BridgeCandidate;
  thisYear: number;
  planned: Set<ISODate>;
  insufficient: boolean;
  busy: boolean;
  onPlan: (candidate: BridgeCandidate) => void;
}) {
  const range = formatDateRange(candidate.start, candidate.end, thisYear);
  const holidayNames = [...new Set(candidate.holidays.map((h) => h.name))];
  const days = candidateDays(candidate, planned);

  return (
    <li className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="text-base font-semibold">{range}</h2>
      <p className="mt-1 text-sm">
        <strong>{candidate.totalDays}일 쉬기</strong> · 연차 {candidate.leaveDays}일 · 효율{' '}
        {candidate.efficiency}
      </p>
      {holidayNames.length > 0 && (
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{holidayNames.join(', ')}</p>
      )}

      <ol aria-hidden="true" className="mt-3 flex flex-wrap gap-1">
        {days.map(({ date, kind }) => (
          <li
            key={date}
            className={`flex h-11 w-9 flex-col items-center justify-center rounded-md text-xs leading-tight ${CANDIDATE_DAY_CLASS[kind]}`}
          >
            <span
              className={
                kind === 'off'
                  ? dayColor(
                      date,
                      candidate.holidays.filter((h) => h.date === date),
                    )
                  : ''
              }
            >
              {WEEKDAY[weekdayOf(date)]}
            </span>
            <span className="font-semibold tabular-nums">{Number(date.slice(8))}</span>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
        연차 쓸 날: {candidate.leaveDates.map((d) => formatShortDate(d, thisYear)).join(', ')}
      </p>

      <div className="mt-3 flex items-center justify-between gap-3">
        {insufficient ? (
          <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900 dark:bg-amber-900 dark:text-amber-100">
            잔여 부족
          </span>
        ) : (
          <span />
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => onPlan(candidate)}
          aria-label={`${range} 계획에 넣기`}
          className={`${primaryButtonClass} h-11`}
        >
          계획에 넣기
        </button>
      </div>
    </li>
  );
}
