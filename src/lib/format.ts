import { QUARTERS_PER_DAY, type ISODate } from '../core/types';

/** '2026-03-02' → '2026.03.02' */
export const formatDotDate = (iso: ISODate) => iso.split('-').join('.');

/** quarter → 일수 표시 (44 → '11', 39 → '9.75'). 계산은 quarter로 하고 표시할 때만 나눠요. */
export const formatDays = (quarters: number) => String(quarters / QUARTERS_PER_DAY);

/** 입력한 일수를 quarter로. 0 이상 0.25일 단위가 아니면 undefined예요. */
export function parseDaysToQuarters(input: string): number | undefined {
  const text = input.trim();
  if (text === '') return undefined;
  const days = Number(text);
  if (!Number.isFinite(days) || days < 0) return undefined;
  const quarters = days * QUARTERS_PER_DAY;
  return Number.isInteger(quarters) ? quarters : undefined;
}
