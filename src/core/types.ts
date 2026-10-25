/** 'YYYY-MM-DD' 형식의 날짜 문자열 (로컬 날짜). */
export type ISODate = string;

/** 'HH:mm' 형식의 시각 문자열. */
export type HHmm = string;

/** 휴가 일수는 0.25일 단위 정수로 다뤄요. 1일 = 4, 반차 = 2, 반반차 = 1. */
export const QUARTERS_PER_DAY = 4;

// ── 연차 부여 (SPEC §5.1, §5.2) ──

export interface AutoGrant {
  /** 'auto-m-3', 'auto-y-1'처럼 결정적인 ID */
  id: string;
  kind: 'monthly' | 'annual';
  grantDate: ISODate;
  /** 이 날까지 사용할 수 있어요 (포함). */
  expireDate: ISODate;
  quarters: number;
  /** monthly는 0, annual은 근속연수 n */
  serviceYear: number;
}

export interface ManualGrant {
  id: string;
  grantDate: ISODate;
  expireDate: ISODate;
  /** 음수면 차감 */
  quarters: number;
  memo: string;
}

export type Grant = AutoGrant | ManualGrant;

// ── 휴가 기록 (SPEC §6) ──

export type LeaveType = 'annual' | 'special' | 'sick' | 'other';

export interface LeaveEntry {
  id: string;
  date: ISODate;
  /** 반반차 1, 반차 2, 연차 4. 일괄 차감 항목은 임의 값 허용 */
  quarters: number;
  part?: 'am' | 'pm';
  type: LeaveType;
  memo?: string;
  /** 온보딩 일괄 차감 */
  isBulk?: boolean;
}

// ── 공휴일 (SPEC §5.4, §7) ──

export type HolidayKind = 'legal' | 'substitute' | 'election' | 'temporary' | 'company';

export interface Holiday {
  date: ISODate;
  name: string;
  kind: HolidayKind;
}

export interface HolidayFile {
  year: number;
  source: string;
  verified: boolean;
  holidays: Holiday[];
}

// ── 근무 기록 (SPEC §5.6) ──

export interface WorkLog {
  date: ISODate;
  clockIn: HHmm;
  /** 퇴근 전에는 '' (진행 중) */
  clockOut: HHmm | '';
  breakMinutes?: number;
  note?: string;
}

// ── 프로필 (SPEC §6) ──

export type ThemeMode = 'system' | 'light' | 'dark';

export interface Profile {
  /** 항상 'me' 한 건 */
  id: 'me';
  hireDate: ISODate;
  workStart: HHmm;
  workEnd: HHmm;
  lunchStart: HHmm;
  lunchEnd: HHmm;
  theme: ThemeMode;
  /** ISO datetime */
  onboardedAt: string;
  schemaVersion: 1;
}
