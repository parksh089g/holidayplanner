import type { HHmm } from '../core/types';
import { isHHmm } from '../db/validate';

export interface WorkTimes {
  workStart: HHmm;
  workEnd: HHmm;
  lunchStart: HHmm;
  lunchEnd: HHmm;
}

export const DEFAULT_WORK_TIMES: WorkTimes = {
  workStart: '09:00',
  workEnd: '18:00',
  lunchStart: '12:00',
  lunchEnd: '13:00',
};

/** 온보딩·설정의 근무시간 입력 검사. 문제가 없으면 undefined예요. */
export function workTimesError(t: WorkTimes): string | undefined {
  if (!Object.values(t).every(isHHmm)) return '시각을 모두 입력해 주세요.';
  if (t.workStart >= t.workEnd) return '퇴근 시각은 출근 시각보다 늦어야 해요.';
  if (t.lunchStart >= t.lunchEnd) return '점심 종료 시각은 시작 시각보다 늦어야 해요.';
  if (t.lunchStart < t.workStart || t.lunchEnd > t.workEnd) {
    return '점심시간은 근무시간 안에 있어야 해요.';
  }
  return undefined;
}
