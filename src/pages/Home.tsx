import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { computeAutoGrants } from '../core/accrual';
import { computeBalance, expiredQBetween } from '../core/balance';
import { defaultBridgeOptions, suggestBridges } from '../core/bridge';
import { addYearsISO, toISO } from '../core/date';
import { upcomingHolidays } from '../core/holidays';
import { fullDayLeaveDates, leaveQuartersByDate } from '../core/leave';
import { QUARTERS_PER_DAY } from '../core/types';
import { BalanceCard } from '../components/home/BalanceCard';
import { NextBridgeCard } from '../components/home/NextBridgeCard';
import { TodayWorkCard } from '../components/home/TodayWorkCard';
import { UpcomingHolidaysCard } from '../components/home/UpcomingHolidaysCard';
import { HolidayDataBanner } from '../components/HolidayDataBanner';
import { getProfile, listLeaveEntries, listManualGrants } from '../db/repo';
import { useHolidays } from '../hooks/useHolidays';
import { useNow } from '../hooks/useNow';

/** SPEC §8.2. 계산은 core 함수에 맡기고 결과만 보여줘요 (CLAUDE.md). */
export default function Home() {
  const [now, refreshNow] = useNow();
  const today = toISO(now);
  const year = Number(today.slice(0, 4));
  const profile = useLiveQuery(getProfile);
  const entries = useLiveQuery(() => listLeaveEntries());
  const manualGrants = useLiveQuery(listManualGrants);
  const holidays = useHolidays([year, year + 1]);

  const leave = useMemo(() => {
    if (!profile || !entries || !manualGrants) return undefined;
    // 다음 자동 발생(nextGrant)과 내년 계획 배분을 위해 1년 뒤까지 계산해요.
    const grants = [...computeAutoGrants(profile.hireDate, addYearsISO(today, 1)), ...manualGrants];
    const summary = computeBalance(grants, entries, today);
    // 앱을 쓰기 전 기간은 사용 기록이 없으니 온보딩 이후 소멸분만 보여줘요.
    const onboardedOn = toISO(new Date(profile.onboardedAt));
    return {
      grants,
      summary,
      expiredQ: expiredQBetween(summary.grants, onboardedOn, today),
      leaveQByDate: leaveQuartersByDate(entries),
      plannedDaysOff: fullDayLeaveDates(entries),
    };
  }, [profile, entries, manualGrants, today]);

  const bridge = useMemo(() => {
    if (!leave || !entries || holidays.loading) return undefined;
    const [first] = suggestBridges(holidays.off, holidays.holidays, {
      ...defaultBridgeOptions(today),
      plannedLeaveDates: leave.plannedDaysOff,
    });
    if (!first) return { candidate: undefined, insufficient: false };
    const remainingAtStart = computeBalance(leave.grants, entries, first.start).remainingQ;
    return {
      candidate: first,
      insufficient: first.leaveDays * QUARTERS_PER_DAY > remainingAtStart,
    };
  }, [leave, entries, holidays, today]);

  const upcoming = useMemo(
    () => upcomingHolidays(holidays.holidays, today, 3),
    [holidays.holidays, today],
  );

  return (
    <div>
      <h1 className="text-2xl font-bold">홈</h1>
      <HolidayDataBanner missingYears={holidays.missingYears} failedYears={holidays.failedYears} />
      {profile && leave && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <BalanceCard summary={leave.summary} today={today} expiredQ={leave.expiredQ} />
          <TodayWorkCard
            now={now}
            onRecorded={refreshNow}
            profile={profile}
            off={holidays.off}
            leaveQByDate={leave.leaveQByDate}
          />
          <NextBridgeCard
            loading={!bridge}
            candidate={bridge?.candidate}
            insufficient={bridge?.insufficient ?? false}
            today={today}
          />
          <UpcomingHolidaysCard holidays={upcoming} today={today} loading={holidays.loading} />
        </div>
      )}
    </div>
  );
}
