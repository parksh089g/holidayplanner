import { version } from '../../../package.json';
import type { HolidaysState } from '../../hooks/useHolidays';
import { Card } from '../Card';

function yearStatus(year: number, h: HolidaysState): string {
  if (h.loading) return '불러오는 중이에요';
  if (h.missingYears.includes(year)) return '데이터 없음 · 주말만 휴무로 계산해요';
  if (h.failedYears.includes(year)) return '불러오지 못했어요 · 네트워크를 확인해 주세요';
  if (h.unverifiedYears.includes(year)) return '공휴일 데이터 확인 중 · 정부 발표와 다를 수 있어요';
  return '확인됨';
}

/** SPEC §7, §8.6 공휴일 데이터 상태와 앱 버전 */
export function AboutSection({ years, holidays }: { years: number[]; holidays: HolidaysState }) {
  return (
    <Card title="공휴일 데이터 · 앱 정보">
      <dl className="space-y-1 text-sm">
        {years.map((year) => (
          <div key={year} className="flex flex-wrap justify-between gap-x-3">
            <dt className="font-medium">{year}년 공휴일</dt>
            <dd className="text-gray-600 dark:text-gray-400">{yearStatus(year, holidays)}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-3">
          <dt className="font-medium">앱 버전</dt>
          <dd className="tabular-nums text-gray-600 dark:text-gray-400">v{version}</dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-gray-600 dark:text-gray-400">
        계산 결과는 참고용이에요. 회사 취업규칙과 인사시스템 값이 우선해요.
      </p>
    </Card>
  );
}
