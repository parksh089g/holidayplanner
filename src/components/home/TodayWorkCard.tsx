import { useLiveQuery } from 'dexie-react-hooks';
import { addDaysISO, startOfWeekMon, toISO } from '../../core/date';
import type { ISODate, Profile } from '../../core/types';
import { computeWeek } from '../../core/worktime';
import { listWorkLogs } from '../../db/repo';
import { toHHmm } from '../../lib/today';
import { Card } from '../Card';
import { ClockPanel } from '../work/ClockPanel';
import { WeekSummary } from '../work/WeekSummary';

/** SPEC §8.2-4: 출퇴근 버튼, 현재까지 근무, 이번 주 연장(추정), 주 52시간 게이지 */
export function TodayWorkCard({
  now,
  onRecorded,
  profile,
  off,
  leaveQByDate,
}: {
  now: Date;
  onRecorded: () => void;
  profile: Profile;
  off: Set<ISODate>;
  leaveQByDate: ReadonlyMap<ISODate, number>;
}) {
  const today = toISO(now);
  const yesterday = addDaysISO(today, -1);
  const monday = startOfWeekMon(today);
  const from = yesterday < monday ? yesterday : monday;
  const sunday = addDaysISO(monday, 6);
  const logs = useLiveQuery(() => listWorkLogs({ from, to: sunday }), [from, sunday]);

  if (!logs) return null;

  const week = computeWeek(today, logs, {
    off,
    leaveQByDate,
    lunch: { start: profile.lunchStart, end: profile.lunchEnd },
    now: { date: today, time: toHHmm(now) },
  });

  return (
    <Card title="오늘 근무">
      <ClockPanel
        now={now}
        onRecorded={onRecorded}
        profile={profile}
        off={off}
        leaveQByDate={leaveQByDate}
        logs={logs}
      />
      <div className="mt-4 border-t border-gray-100 pt-3 dark:border-gray-800">
        <WeekSummary week={week} />
      </div>
    </Card>
  );
}
