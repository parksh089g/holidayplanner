import { addDaysISO, diffDays, startOfWeekMon } from './date';
import { isOffDay } from './holidays';
import type { HHmm, ISODate, WorkLog } from './types';

/** 소정근로 1일 8시간 */
export const DAY_STANDARD_MIN = 480;
/** 소정근로 주 40시간 */
export const WEEK_STANDARD_MIN = 2400;
/** 주 48시간부터 경고 */
export const WEEK_NEAR_MIN = 2880;
/** 주 52시간 */
export const WEEK_LIMIT_MIN = 3120;

const MINUTES_PER_DAY = 1440;
const LEAVE_CREDIT_PER_QUARTER = DAY_STANDARD_MIN / 4;
const DEFAULT_LUNCH = { start: '12:00', end: '13:00' };

export interface Lunch {
  start: HHmm;
  end: HHmm;
}

export interface DayResult {
  date: ISODate;
  hasLog: boolean;
  /** 퇴근 기록 전 */
  inProgress: boolean;
  breakMin: number;
  /** 실근로 = (퇴근 - 출근) - 휴게 */
  workedMin: number;
  /** 근무일: max(0, workedMin - 480), 휴무일: workedMin 전부 */
  overtimeMin: number;
  isOffDayWork: boolean;
  /** 그날 휴가 인정 시간 (연차 480, 반차 240, 반반차 120) */
  leaveCreditMin: number;
}

export interface WeekResult {
  /** 월요일 */
  weekStart: ISODate;
  days: DayResult[];
  /** 실근로 합계 (휴가 인정 시간 제외) */
  workedMin: number;
  /** max(Σ 일별 초과, workedMin - 2400) */
  overtimeMin: number;
  /** 3120 - workedMin (음수면 초과) */
  remainingTo52Min: number;
  warning: 'none' | 'near' | 'over';
}

export interface Now {
  date: ISODate;
  time: HHmm;
}

export interface DayOptions {
  isOffDay: boolean;
  /** 그날 휴가 quarter 합계 */
  leaveQ: number;
  lunch?: Lunch;
  /** 진행 중 기록(clockOut '')은 출근 후 24시간 안에서 이 시각까지 근무로 계산해요. */
  now?: Now;
}

export interface WeekContext {
  off: Set<ISODate>;
  leaveQByDate?: ReadonlyMap<ISODate, number>;
  lunch?: Lunch;
  now?: Now;
}

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** 'HH:mm'을 0시 기준 분으로 바꿔요. */
export function toMinutes(hhmm: HHmm): number {
  const match = HHMM.exec(hhmm);
  if (!match) throw new RangeError(`시각 형식이 올바르지 않아요: ${hhmm}`);
  return Number(match[1]) * 60 + Number(match[2]);
}

const overlap = (aStart: number, aEnd: number, bStart: number, bEnd: number) =>
  Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));

const leaveCreditMin = (leaveQ: number) =>
  Math.min(DAY_STANDARD_MIN, leaveQ * LEAVE_CREDIT_PER_QUARTER);

/** 퇴근(또는 지금) 시각을 출근일 0시 기준 분으로 돌려줘요. 계산할 수 없으면 undefined예요. */
function endMinutes(log: WorkLog, start: number, now: Now | undefined): number | undefined {
  if (log.clockOut !== '') {
    const end = toMinutes(log.clockOut);
    return end < start ? end + MINUTES_PER_DAY : end; // 자정을 넘긴 근무
  }
  if (!now) return undefined;
  // 진행 중: 아직 출근 전이거나 24시간이 넘게 지난 기록(퇴근 누락)은 계산하지 않아요.
  const elapsed = diffDays(log.date, now.date) * MINUTES_PER_DAY + toMinutes(now.time);
  return elapsed > start && elapsed - start <= MINUTES_PER_DAY ? elapsed : undefined;
}

/** 하루 근무시간을 정산해요 (SPEC §5.6). */
export function computeDay(log: WorkLog, opts: DayOptions): DayResult {
  const inProgress = log.clockOut === '';
  const start = toMinutes(log.clockIn);
  const end = endMinutes(log, start, opts.now);
  let breakMin = 0;
  let workedMin = 0;

  if (end !== undefined) {
    const manualBreak = log.breakMinutes;
    if (typeof manualBreak === 'number' && Number.isFinite(manualBreak)) {
      breakMin = Math.max(0, manualBreak);
    } else {
      // 입력이 없으면(null 포함) 점심시간과 겹친 만큼 자동 차감 (자정을 넘기면 다음 날 점심도 확인)
      const lunch = opts.lunch ?? DEFAULT_LUNCH;
      const lunchStart = toMinutes(lunch.start);
      const lunchEnd = toMinutes(lunch.end);
      breakMin =
        overlap(start, end, lunchStart, lunchEnd) +
        overlap(start, end, lunchStart + MINUTES_PER_DAY, lunchEnd + MINUTES_PER_DAY);
    }
    workedMin = Math.max(0, end - start - breakMin);
  }

  return {
    date: log.date,
    hasLog: true,
    inProgress,
    breakMin,
    workedMin,
    overtimeMin: opts.isOffDay ? workedMin : Math.max(0, workedMin - DAY_STANDARD_MIN),
    isOffDayWork: opts.isOffDay && workedMin > 0,
    leaveCreditMin: leaveCreditMin(opts.leaveQ),
  };
}

/**
 * 월요일부터 7일을 정산해요. 52시간 판정은 실근로만 합산해요 (휴가 인정 시간 제외).
 * 연장 수치는 추정이에요. 화면에 법적 판단이 아니라는 안내를 붙여요.
 */
export function computeWeek(weekStart: ISODate, logs: WorkLog[], ctx: WeekContext): WeekResult {
  const monday = startOfWeekMon(weekStart);
  const logByDate = new Map(logs.map((l) => [l.date, l]));

  const days = Array.from({ length: 7 }, (_, i): DayResult => {
    const date = addDaysISO(monday, i);
    const opts: DayOptions = {
      isOffDay: isOffDay(date, ctx.off),
      leaveQ: ctx.leaveQByDate?.get(date) ?? 0,
      lunch: ctx.lunch,
      now: ctx.now,
    };
    const log = logByDate.get(date);
    if (log) return computeDay(log, opts);
    return {
      date,
      hasLog: false,
      inProgress: false,
      breakMin: 0,
      workedMin: 0,
      overtimeMin: 0,
      isOffDayWork: false,
      leaveCreditMin: leaveCreditMin(opts.leaveQ),
    };
  });

  const workedMin = days.reduce((total, d) => total + d.workedMin, 0);
  const dailyOvertime = days.reduce((total, d) => total + d.overtimeMin, 0);

  return {
    weekStart: monday,
    days,
    workedMin,
    overtimeMin: Math.max(dailyOvertime, workedMin - WEEK_STANDARD_MIN),
    remainingTo52Min: WEEK_LIMIT_MIN - workedMin,
    warning: workedMin > WEEK_LIMIT_MIN ? 'over' : workedMin >= WEEK_NEAR_MIN ? 'near' : 'none',
  };
}

/** 퇴근 전이고 출근 후 24시간 안인 근무예요. 자정을 넘긴 야간 근무도 포함해요. */
export function isOngoing(log: WorkLog, now: Now): boolean {
  return log.clockOut === '' && endMinutes(log, toMinutes(log.clockIn), now) !== undefined;
}

const QUARTER_LEAVE_MIN = 120;

const toHHmmString = (minutes: number): HHmm =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/** 반반차(2시간) 시각: 오전은 출근 후 2시간, 오후는 퇴근 전 2시간 (SPEC §8.3 "반반차 시각") */
export function quarterLeaveTime(
  workStart: HHmm,
  workEnd: HHmm,
  part: 'am' | 'pm',
): { start: HHmm; end: HHmm } {
  if (part === 'am') {
    const start = toMinutes(workStart);
    return { start: workStart, end: toHHmmString(start + QUARTER_LEAVE_MIN) };
  }
  const end = toMinutes(workEnd);
  return { start: toHHmmString(end - QUARTER_LEAVE_MIN), end: workEnd };
}
