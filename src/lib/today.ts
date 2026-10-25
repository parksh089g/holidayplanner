import { toISO } from '../core/date';
import type { HHmm } from '../core/types';

/** 화면에서 쓰는 오늘 날짜. core 함수에는 이 값을 asOf로 넘겨요 (CLAUDE.md). */
export const todayISO = () => toISO(new Date());

/** Date의 로컬 시각을 'HH:mm'으로. 분 단위 그대로예요 (SPEC §5.6-5). */
export const toHHmm = (date: Date): HHmm =>
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
