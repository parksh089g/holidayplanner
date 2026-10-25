import { toISO } from '../../core/date';
import type { ISODate, Profile, WorkLog } from '../../core/types';
import { computeWeek } from '../../core/worktime';
import { toHHmm } from '../../lib/today';
import { Card } from '../Card';
import { ClockPanel } from '../work/ClockPanel';
import { WeekSummary } from '../work/WeekSummary';

/**
 * SPEC §8.2-4: 출퇴근 버튼, 현재까지 근무, 이번 주 연장(추정), 주 52시간 게이지.
 * logs는 어제부터 이번 주 일요일까지예요. 홈이 미리 받아 넘겨서, 카드가 늦게 나타나며
 * 아래 카드를 밀어내지 않게 해요 (레이아웃 이동 방지).
 */
export function TodayWorkCard({
  now,
  onRecorded,
  profile,
  off,
  leaveQByDate,
  logs,
}: {
  now: Date;
  onRecorded: () => void;
  profile: Profile;
  off: Set<ISODate>;
  leaveQByDate: ReadonlyMap<ISODate, number>;
  logs: WorkLog[];
}) {
  const today = toISO(now);
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
