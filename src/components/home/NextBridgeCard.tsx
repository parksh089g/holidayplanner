import { Link } from 'react-router';
import type { BridgeCandidate } from '../../core/bridge';
import type { ISODate } from '../../core/types';
import { formatShortDate } from '../../lib/format';
import { Card } from '../Card';

/** SPEC §8.2-3: 오늘 이후 1위 추천 연휴 + 더 보기 */
export function NextBridgeCard({
  loading,
  candidate,
  insufficient,
  today,
}: {
  loading: boolean;
  candidate?: BridgeCandidate;
  /** 그 시점 잔여 연차로 부족하면 true (§5.5-6) */
  insufficient: boolean;
  today: ISODate;
}) {
  const year = Number(today.slice(0, 4));
  const date = (iso: ISODate) => formatShortDate(iso, year);

  return (
    <Card
      title="다음 추천 연휴"
      action={
        <Link
          to="/suggest"
          className="-my-2 inline-flex h-11 items-center rounded-lg px-2 text-sm font-medium text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950"
        >
          더 보기
        </Link>
      }
    >
      {loading ? (
        <p className="text-sm text-gray-600 dark:text-gray-400">공휴일을 불러오는 중이에요.</p>
      ) : !candidate ? (
        <p className="text-sm text-gray-600 dark:text-gray-400">
          연차 3일 안에서 공휴일을 낀 연휴를 찾지 못했어요.
        </p>
      ) : (
        <>
          <p className="text-lg font-semibold">
            {/* 끝 날짜는 시작과 같은 해면 연도를 생략해요. */}
            {date(candidate.start)} –{' '}
            {formatShortDate(candidate.end, Number(candidate.start.slice(0, 4)))}
          </p>
          <p className="mt-1 text-sm">
            <strong>{candidate.totalDays}일 쉬기</strong> · 연차 {candidate.leaveDays}일 · 효율{' '}
            {candidate.efficiency}
          </p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            연차 쓰는 날: {candidate.leaveDates.map(date).join(', ')}
          </p>
          {candidate.holidays.length > 0 && (
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {[...new Set(candidate.holidays.map((h) => h.name))].join(', ')}
            </p>
          )}
          {insufficient && (
            <p className="mt-2 inline-block rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900 dark:bg-amber-900 dark:text-amber-100">
              잔여 부족
            </p>
          )}
        </>
      )}
    </Card>
  );
}
