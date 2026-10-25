import { HolidayDataBanner } from '../components/HolidayDataBanner';
import { PagePlaceholder } from '../components/PagePlaceholder';
import { useHolidays } from '../hooks/useHolidays';
import { todayISO } from '../lib/today';

export default function Calendar() {
  // TODO(T2-5): 보고 있는 달의 연도로 바꿔요.
  const year = Number(todayISO().slice(0, 4));
  const { missingYears, failedYears } = useHolidays([year]);

  return (
    <>
      <PagePlaceholder
        title="달력"
        description="공휴일과 휴가를 달력에서 보고 휴가를 등록할 수 있게 될 거예요."
      />
      <HolidayDataBanner missingYears={missingYears} failedYears={failedYears} />
    </>
  );
}
