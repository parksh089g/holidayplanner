import type { HolidayFile } from '../../src/core/types';

const files = import.meta.glob<HolidayFile>('../../public/holidays/*.json', {
  eager: true,
  import: 'default',
});

/** public/holidays/*.json 전체 (연도 오름차순) */
export const holidayFiles: HolidayFile[] = Object.values(files).sort((a, b) => a.year - b.year);

export function holidaysOf(...years: number[]) {
  return holidayFiles.filter((f) => years.includes(f.year)).flatMap((f) => f.holidays);
}
