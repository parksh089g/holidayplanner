import type { BalanceSummary } from '../../core/balance';
import type { ISODate } from '../../core/types';
import { formatDDay, formatDays, formatDotDate } from '../../lib/format';
import { Card } from '../Card';

function Legend({ swatch, label, quarters }: { swatch: string; label: string; quarters: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-sm ${swatch}`} />
      <dt className="text-gray-600 dark:text-gray-400">{label}</dt>
      <dd className="font-semibold tabular-nums">{formatDays(quarters)}일</dd>
    </div>
  );
}

/** SPEC §8.2-1, 2: 잔여 연차 + 사용/계획/잔여 막대 + 소멸 D-day */
export function BalanceCard({
  summary,
  today,
  expiredQ,
}: {
  summary: BalanceSummary;
  today: ISODate;
  /** 온보딩 이후 소멸한 양 */
  expiredQ: number;
}) {
  const { usedQ, plannedQ, remainingQ, totalGrantedQ, nextExpiry, overdrawn } = summary;
  const scale = Math.max(totalGrantedQ, usedQ + plannedQ, 1);
  const width = (q: number) => `${(Math.max(0, q) / scale) * 100}%`;

  return (
    <Card title="잔여 연차">
      <p className="flex items-baseline gap-1">
        <span className="text-4xl font-bold tabular-nums">{formatDays(remainingQ)}</span>
        <span className="text-lg font-semibold">일</span>
      </p>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
        이번 연차 기간에 {formatDays(totalGrantedQ)}일이 생겼어요.
      </p>

      <div
        aria-hidden="true"
        className="mt-3 flex h-3 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
      >
        <span className="bg-blue-600 dark:bg-blue-500" style={{ width: width(usedQ) }} />
        <span className="bg-sky-300 dark:bg-sky-700" style={{ width: width(plannedQ) }} />
      </div>
      <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <Legend swatch="bg-blue-600 dark:bg-blue-500" label="사용" quarters={usedQ} />
        <Legend swatch="bg-sky-300 dark:bg-sky-700" label="계획" quarters={plannedQ} />
        <Legend swatch="bg-gray-200 dark:bg-gray-700" label="잔여" quarters={remainingQ} />
      </dl>

      {nextExpiry && (
        <p className="mt-3 text-sm font-medium">
          {formatDotDate(nextExpiry.date)} 소멸 예정 {formatDays(nextExpiry.remainingQ)}일 (
          {formatDDay(today, nextExpiry.date)})
        </p>
      )}
      {expiredQ > 0 && (
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          지난 연차 기간에 쓰지 못하고 소멸한 연차가 {formatDays(expiredQ)}일 있어요.
        </p>
      )}
      {overdrawn.length > 0 && (
        <p className="mt-2 text-sm font-medium text-amber-800 dark:text-amber-300">
          잔여보다 많이 쓰거나 계획한 휴가가 {overdrawn.length}건 있어요.
        </p>
      )}
    </Card>
  );
}
