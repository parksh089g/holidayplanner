import { useId } from 'react';
import type { SuggestFilters } from '../../store/suggest';
import { inputClass } from '../../lib/ui';

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

/** SPEC §8.4 상단 필터: 연차 최대 n일, 최소 연휴 n일, 연도, 공휴일 포함만 */
export function SuggestFiltersBar({
  filters,
  thisYear,
  onChange,
}: {
  filters: SuggestFilters;
  thisYear: number;
  onChange: (changes: Partial<SuggestFilters>) => void;
}) {
  const id = useId();
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <div>
        <label htmlFor={`${id}-max`} className="text-sm font-medium">
          연차 최대
        </label>
        <select
          id={`${id}-max`}
          value={filters.maxLeaveDays}
          onChange={(e) => onChange({ maxLeaveDays: Number(e.target.value) })}
          className={inputClass}
        >
          {range(1, 10).map((n) => (
            <option key={n} value={n}>
              {n}일
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`${id}-min`} className="text-sm font-medium">
          최소 연휴
        </label>
        <select
          id={`${id}-min`}
          value={filters.minTotalDays}
          onChange={(e) => onChange({ minTotalDays: Number(e.target.value) })}
          className={inputClass}
        >
          {range(3, 16).map((n) => (
            <option key={n} value={n}>
              {n}일 이상
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`${id}-year`} className="text-sm font-medium">
          연도
        </label>
        <select
          id={`${id}-year`}
          value={filters.year ?? 'all'}
          onChange={(e) =>
            onChange({ year: e.target.value === 'all' ? undefined : Number(e.target.value) })
          }
          className={inputClass}
        >
          <option value="all">오늘~{thisYear + 1}년 말</option>
          <option value={thisYear}>{thisYear}년 남은 기간</option>
          <option value={thisYear + 1}>{thisYear + 1}년</option>
        </select>
      </div>
      <div className="flex items-end">
        <button
          type="button"
          role="switch"
          aria-checked={filters.requireHoliday}
          onClick={() => onChange({ requireHoliday: !filters.requireHoliday })}
          className="flex h-12 w-full items-center justify-between gap-2 rounded-lg border border-gray-300 px-3 text-sm font-medium dark:border-gray-700"
        >
          공휴일 포함만
          <span
            aria-hidden="true"
            className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${
              filters.requireHoliday ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left] ${
                filters.requireHoliday ? 'left-[1.125rem]' : 'left-0.5'
              }`}
            />
          </span>
        </button>
      </div>
    </div>
  );
}
