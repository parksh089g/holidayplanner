import { toISO } from '../core/date';

/** 화면에서 쓰는 오늘 날짜. core 함수에는 이 값을 asOf로 넘겨요 (CLAUDE.md). */
export const todayISO = () => toISO(new Date());
