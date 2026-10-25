import { diffDays, weekdayOf } from '../core/date';
import { QUARTERS_PER_DAY, type ISODate } from '../core/types';

/** '2026-03-02' → '2026.03.02' */
export const formatDotDate = (iso: ISODate) => iso.split('-').join('.');

/** quarter → 일수 표시 (44 → '11', 39 → '9.75'). 계산은 quarter로 하고 표시할 때만 나눠요. */
export const formatDays = (quarters: number) => String(quarters / QUARTERS_PER_DAY);

/** 입력한 일수를 quarter로. 0.25일 단위가 아니거나 (allowNegative가 아닐 때) 음수면 undefined예요. */
export function parseDaysToQuarters(
  input: string,
  { allowNegative = false }: { allowNegative?: boolean } = {},
): number | undefined {
  const text = input.trim();
  if (text === '') return undefined;
  const days = Number(text);
  if (!Number.isFinite(days) || (!allowNegative && days < 0)) return undefined;
  const quarters = days * QUARTERS_PER_DAY;
  return Number.isInteger(quarters) ? quarters : undefined;
}

const WEEKDAY_LABEL = ['일', '월', '화', '수', '목', '금', '토'];

/** '2026-09-24' → '9/24(목)'. refYear와 다른 해면 '2027년 9/11(토)'처럼 연도를 붙여요. */
export function formatShortDate(iso: ISODate, refYear?: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const text = `${month}/${day}(${WEEKDAY_LABEL[weekdayOf(iso)]})`;
  return refYear === undefined || year === refYear ? text : `${year}년 ${text}`;
}

/** 오늘부터 date까지: 'D-129', 'D-DAY', 지났으면 'D+3' */
export function formatDDay(today: ISODate, date: ISODate): string {
  const days = diffDays(today, date);
  if (days === 0) return 'D-DAY';
  return days > 0 ? `D-${days}` : `D+${-days}`;
}

/** 분 → '8시간 30분', '3시간', '45분', '0분' (부호는 앞에 붙여요) */
export function formatMinutes(minutes: number): string {
  const sign = minutes < 0 ? '-' : '';
  const abs = Math.abs(minutes);
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  if (hours === 0) return `${sign}${mins}분`;
  return `${sign}${hours}시간${mins === 0 ? '' : ` ${mins}분`}`;
}

/** '9/24(목) – 10/5(월)'. 시작이 refYear와 다른 해면 연도를 붙이고, 끝은 시작과 같은 해면 연도를 생략해요. */
export function formatDateRange(start: ISODate, end: ISODate, refYear: number): string {
  return `${formatShortDate(start, refYear)} – ${formatShortDate(end, Number(start.slice(0, 4)))}`;
}
