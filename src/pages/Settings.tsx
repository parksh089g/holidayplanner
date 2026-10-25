import { useLiveQuery } from 'dexie-react-hooks';
import { AboutSection } from '../components/settings/AboutSection';
import { BackupSection } from '../components/settings/BackupSection';
import { CompanyHolidaysSection } from '../components/settings/CompanyHolidaysSection';
import { ManualGrantsSection } from '../components/settings/ManualGrantsSection';
import { ProfileSection } from '../components/settings/ProfileSection';
import { ResetSection } from '../components/settings/ResetSection';
import { ThemeSection } from '../components/settings/ThemeSection';
import { toISO } from '../core/date';
import { getProfile, listCustomHolidays, listManualGrants } from '../db/repo';
import { useHolidays } from '../hooks/useHolidays';
import { useNow } from '../hooks/useNow';

/** SPEC §8.6 설정 */
export default function Settings() {
  const [now] = useNow(60_000);
  const today = toISO(now);
  const thisYear = Number(today.slice(0, 4));
  const years = [thisYear, thisYear + 1];
  const holidays = useHolidays(years);
  const profile = useLiveQuery(getProfile);
  const manualGrants = useLiveQuery(listManualGrants);
  const customHolidays = useLiveQuery(listCustomHolidays);

  return (
    <div>
      <h1 className="text-2xl font-bold">설정</h1>
      {profile && manualGrants && customHolidays && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {/* 백업을 가져와 프로필이 통째로 바뀔 때만 입력값을 새로 채워요. */}
          <ProfileSection key={profile.onboardedAt} profile={profile} today={today} />
          <div className="space-y-4">
            <ThemeSection />
            <BackupSection today={today} />
          </div>
          <ManualGrantsSection grants={manualGrants} />
          <CompanyHolidaysSection holidays={customHolidays} />
          <AboutSection years={years} holidays={holidays} />
          <ResetSection />
        </div>
      )}
    </div>
  );
}
