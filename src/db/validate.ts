import { parseISO } from '../core/date';
import type { Holiday, LeaveEntry, ManualGrant, Profile, WorkLog } from '../core/types';
import { toMinutes } from '../core/worktime';

/** 저장·가져오기 전에 형식이 틀린 데이터를 막아요. 메시지는 화면에 그대로 보여줄 수 있어요. */
export class ValidationError extends Error {
  override name = 'ValidationError';
}

function check(condition: boolean, message: string): asserts condition {
  if (!condition) throw new ValidationError(message);
}

const succeeds = (fn: () => unknown) => {
  try {
    fn();
    return true;
  } catch {
    return false;
  }
};

export const isISODate = (v: unknown): v is string =>
  typeof v === 'string' && succeeds(() => parseISO(v));

export const isHHmm = (v: unknown): v is string =>
  typeof v === 'string' && succeeds(() => toMinutes(v));

const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

const THEMES = new Set(['system', 'light', 'dark']);
const LEAVE_TYPES = new Set(['annual', 'special', 'sick', 'other']);

export function validateProfile(p: Profile): void {
  check(p.id === 'me', '프로필 id는 me여야 해요.');
  check(isISODate(p.hireDate), '입사일 형식이 올바르지 않아요.');
  for (const key of ['workStart', 'workEnd', 'lunchStart', 'lunchEnd'] as const) {
    check(isHHmm(p[key]), `${key} 시각 형식이 올바르지 않아요.`);
  }
  check(p.workStart < p.workEnd, '퇴근 시각은 출근 시각보다 늦어야 해요.');
  check(p.lunchStart < p.lunchEnd, '점심 종료 시각은 시작 시각보다 늦어야 해요.');
  check(THEMES.has(p.theme), '테마 값이 올바르지 않아요.');
  check(
    isNonEmptyString(p.onboardedAt) && !Number.isNaN(Date.parse(p.onboardedAt)),
    '온보딩 시각 형식이 올바르지 않아요.',
  );
  check(p.schemaVersion === 1, '지원하지 않는 프로필 버전이에요.');
}

export function validateManualGrant(g: ManualGrant): void {
  check(isNonEmptyString(g.id), '보정 항목 id가 없어요.');
  check(isISODate(g.grantDate) && isISODate(g.expireDate), '보정 날짜 형식이 올바르지 않아요.');
  check(g.grantDate <= g.expireDate, '소멸일은 발생일보다 빠를 수 없어요.');
  check(
    Number.isInteger(g.quarters) && g.quarters !== 0,
    '보정 일수는 0.25일 단위로 0이 아니어야 해요.',
  );
  check(typeof g.memo === 'string', '메모 형식이 올바르지 않아요.');
}

export function validateLeaveEntry(e: LeaveEntry): void {
  check(isNonEmptyString(e.id), '휴가 id가 없어요.');
  check(isISODate(e.date), '휴가 날짜 형식이 올바르지 않아요.');
  check(LEAVE_TYPES.has(e.type), '휴가 유형이 올바르지 않아요.');
  check(
    Number.isInteger(e.quarters) && e.quarters > 0,
    '휴가 일수는 0.25일 단위로 0보다 커야 해요.',
  );
  if (!e.isBulk) {
    check([1, 2, 4].includes(e.quarters), '휴가는 연차·반차·반반차 중 하나여야 해요.');
  }
  if (e.part !== undefined) {
    check(e.part === 'am' || e.part === 'pm', '오전·오후 값이 올바르지 않아요.');
    check(e.quarters === 1 || e.quarters === 2, '오전·오후는 반차·반반차에만 지정해요.');
  }
  check(e.memo === undefined || typeof e.memo === 'string', '메모 형식이 올바르지 않아요.');
}

export function validateWorkLog(l: WorkLog): void {
  check(isISODate(l.date), '근무 날짜 형식이 올바르지 않아요.');
  check(isHHmm(l.clockIn), '출근 시각 형식이 올바르지 않아요.');
  check(l.clockOut === '' || isHHmm(l.clockOut), '퇴근 시각 형식이 올바르지 않아요.');
  check(
    l.breakMinutes === undefined ||
      (Number.isInteger(l.breakMinutes) && l.breakMinutes >= 0 && l.breakMinutes <= 1440),
    '휴게 시간은 0–1440분 사이 정수여야 해요.',
  );
  check(l.note === undefined || typeof l.note === 'string', '메모 형식이 올바르지 않아요.');
}

export function validateCustomHoliday(h: Holiday): void {
  check(isISODate(h.date), '휴무일 날짜 형식이 올바르지 않아요.');
  check(h.kind === 'company', '직접 추가하는 휴무일은 회사 휴무일만 돼요.');
  check(isNonEmptyString(h.name), '휴무일 이름을 입력해 주세요.');
}
