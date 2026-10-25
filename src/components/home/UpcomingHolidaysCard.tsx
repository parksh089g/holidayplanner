import type { Holiday, ISODate } from '../../core/types';
import { formatDDay, formatShortDate } from '../../lib/format';
import { Card } from '../Card';

/** SPEC §8.2-5: 다가오는 공휴일 3개 */
export function UpcomingHolidaysCard({
  holidays,
  today,
  loading,
}: {
  holidays: Holiday[];
  today: ISODate;
  loading: boolean;
}) {
  const year = Number(today.slice(0, 4));
  return (
    <Card title="다가오는 공휴일">
      {loading ? (
        <p className="text-sm text-gray-600 dark:text-gray-400">공휴일을 불러오는 중이에요.</p>
      ) : holidays.length === 0 ? (
        <p className="text-sm text-gray-600 dark:text-gray-400">남은 공휴일 정보가 없어요.</p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {holidays.map((h) => (
            <li
              key={`${h.date}-${h.name}`}
              className="flex items-center justify-between py-2 text-sm"
            >
              <span>
                <span className="tabular-nums">{formatShortDate(h.date, year)}</span>{' '}
                <span className="font-medium">{h.name}</span>
                {h.kind === 'company' && (
                  <span className="ml-1 text-xs text-gray-600 dark:text-gray-400">(회사)</span>
                )}
              </span>
              <span className="tabular-nums text-gray-600 dark:text-gray-400">
                {formatDDay(today, h.date)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
