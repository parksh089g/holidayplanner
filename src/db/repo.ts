import type { Holiday, ISODate, LeaveEntry, ManualGrant, Profile, WorkLog } from '../core/types';
import { db } from './schema';
import {
  ValidationError,
  validateCustomHoliday,
  validateLeaveEntry,
  validateManualGrant,
  validateProfile,
  validateWorkLog,
} from './validate';

/** 양 끝 포함 */
export interface DateRange {
  from: ISODate;
  to: ISODate;
}

export const newId = () => crypto.randomUUID();

// ── 프로필 ──

export const getProfile = () => db.profile.get('me');

export async function saveProfile(profile: Profile): Promise<void> {
  validateProfile(profile);
  await db.profile.put(profile);
}

export const ONBOARDING_BULK_MEMO = '앱 사용 전 사용분';

/**
 * 온보딩 완료 (SPEC §8.1, §5.2). 프로필과 "현재 연차 기간에 이미 쓴 연차"를 한 번에 저장해요.
 * 이미 쓴 연차는 오늘 날짜의 일괄 차감 항목(isBulk) 하나로 남겨요. 0이면 만들지 않아요.
 */
export async function completeOnboarding(
  profile: Profile,
  usedQ: number,
  today: ISODate,
): Promise<void> {
  validateProfile(profile);
  if (!Number.isInteger(usedQ) || usedQ < 0) {
    throw new ValidationError('이미 쓴 연차는 0.25일 단위로 0일 이상이어야 해요.');
  }
  const bulk: LeaveEntry | undefined =
    usedQ > 0
      ? {
          id: newId(),
          date: today,
          quarters: usedQ,
          type: 'annual',
          memo: ONBOARDING_BULK_MEMO,
          isBulk: true,
        }
      : undefined;
  if (bulk) validateLeaveEntry(bulk);
  await db.transaction('rw', db.profile, db.leaveEntries, async () => {
    await db.profile.put(profile);
    if (bulk) await db.leaveEntries.put(bulk);
  });
}

export async function updateProfile(changes: Partial<Omit<Profile, 'id'>>): Promise<void> {
  await db.transaction('rw', db.profile, async () => {
    const current = await db.profile.get('me');
    if (!current) throw new ValidationError('프로필이 아직 없어요. 온보딩을 먼저 마쳐 주세요.');
    const next = { ...current, ...changes };
    validateProfile(next);
    await db.profile.put(next);
  });
}

// ── 수동 보정 (SPEC §5.2) ──

export const listManualGrants = () => db.leaveGrants.orderBy('grantDate').toArray();

export async function putManualGrant(grant: ManualGrant): Promise<void> {
  validateManualGrant(grant);
  await db.leaveGrants.put(grant);
}

export const deleteManualGrant = (id: string) => db.leaveGrants.delete(id);

// ── 휴가 기록 ──

export function listLeaveEntries(range?: DateRange): Promise<LeaveEntry[]> {
  if (!range) return db.leaveEntries.orderBy('date').toArray();
  return db.leaveEntries.where('date').between(range.from, range.to, true, true).toArray();
}

export async function putLeaveEntry(entry: LeaveEntry): Promise<void> {
  validateLeaveEntry(entry);
  await db.leaveEntries.put(entry);
}

/** 추천 "계획에 넣기"처럼 여러 건을 한 번에 넣어요. 하나라도 틀리면 아무것도 넣지 않아요. */
export async function addLeaveEntries(entries: LeaveEntry[]): Promise<void> {
  entries.forEach(validateLeaveEntry);
  await db.transaction('rw', db.leaveEntries, () => db.leaveEntries.bulkAdd(entries));
}

export const deleteLeaveEntry = (id: string) => db.leaveEntries.delete(id);

/** "되돌리기"용 */
export const deleteLeaveEntries = (ids: string[]) => db.leaveEntries.bulkDelete(ids);

// ── 근무 기록 ──

export function listWorkLogs(range?: DateRange): Promise<WorkLog[]> {
  if (!range) return db.workLogs.orderBy('date').toArray();
  return db.workLogs.where('date').between(range.from, range.to, true, true).toArray();
}

export const getWorkLog = (date: ISODate) => db.workLogs.get(date);

export async function putWorkLog(log: WorkLog): Promise<void> {
  validateWorkLog(log);
  await db.workLogs.put(log);
}

export const deleteWorkLog = (date: ISODate) => db.workLogs.delete(date);

/** 여러 근무 기록을 한 번에 저장·삭제해요 ("정시로 채우기"와 되돌리기). 하나라도 틀리면 아무것도 바꾸지 않아요. */
export async function replaceWorkLogs(put: WorkLog[], remove: ISODate[]): Promise<void> {
  put.forEach(validateWorkLog);
  await db.transaction('rw', db.workLogs, async () => {
    await db.workLogs.bulkDelete(remove);
    await db.workLogs.bulkPut(put);
  });
}

// ── 회사 휴무일 ──

export const listCustomHolidays = () => db.holidays.orderBy('date').toArray();

export async function putCustomHoliday(holiday: Holiday): Promise<void> {
  validateCustomHoliday(holiday);
  await db.holidays.put({ ...holiday, name: holiday.name.trim() });
}

export const deleteCustomHoliday = (date: ISODate) => db.holidays.delete(date);
