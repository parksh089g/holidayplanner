import Dexie, { type EntityTable } from 'dexie';
import type { Holiday, LeaveEntry, ManualGrant, Profile, WorkLog } from '../core/types';

export const DB_NAME = 'holidayplanner';

/** SPEC §6. 스키마를 바꾸면 version(2)를 추가하고 upgrade에서 변환해요. */
export class HolidayPlannerDB extends Dexie {
  profile!: EntityTable<Profile, 'id'>;
  /** 수동 보정분만 저장 (자동 발생분은 매번 계산) */
  leaveGrants!: EntityTable<ManualGrant, 'id'>;
  leaveEntries!: EntityTable<LeaveEntry, 'id'>;
  workLogs!: EntityTable<WorkLog, 'date'>;
  /** 사용자가 추가한 회사 휴무일(kind 'company')만 저장 */
  holidays!: EntityTable<Holiday, 'date'>;

  constructor(name = DB_NAME) {
    super(name);
    this.version(1).stores({
      profile: 'id',
      leaveGrants: 'id, grantDate',
      leaveEntries: 'id, date, type',
      workLogs: 'date',
      holidays: 'date, kind',
    });
  }
}

export const db = new HolidayPlannerDB();
