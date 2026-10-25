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

export const BACKUP_APP = 'holidayplanner';
/** 앱이 읽고 쓰는 백업 버전 (= Dexie 스키마 버전) */
export const BACKUP_SCHEMA_VERSION = 1;

/** SPEC §6 백업 포맷 */
export interface BackupFile {
  app: typeof BACKUP_APP;
  schemaVersion: number;
  /** 로컬 시간대 오프셋을 붙인 ISO 시각 */
  exportedAt: string;
  profile: Profile;
  leaveGrants: ManualGrant[];
  leaveEntries: LeaveEntry[];
  workLogs: WorkLog[];
  customHolidays: Holiday[];
}

const pad = (n: number) => String(n).padStart(2, '0');

/** '2026-10-23T10:00:00+09:00'처럼 로컬 시각과 오프셋 */
export function toOffsetISOString(date: Date): string {
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const abs = Math.abs(offset);
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

/** holidayplanner-backup-YYYYMMDD.json (꼬리표를 붙이면 …-YYYYMMDD-꼬리표.json) */
export function backupFileName(date: ISODate, tag?: string): string {
  return `holidayplanner-backup-${date.split('-').join('')}${tag ? `-${tag}` : ''}.json`;
}

export async function createBackup(now: Date): Promise<BackupFile> {
  return db.transaction(
    'r',
    [db.profile, db.leaveGrants, db.leaveEntries, db.workLogs, db.holidays],
    async () => {
      const profile = await db.profile.get('me');
      if (!profile) throw new ValidationError('프로필이 없어서 내보낼 수 없어요.');
      return {
        app: BACKUP_APP,
        schemaVersion: BACKUP_SCHEMA_VERSION,
        exportedAt: toOffsetISOString(now),
        profile,
        leaveGrants: await db.leaveGrants.orderBy('grantDate').toArray(),
        leaveEntries: await db.leaveEntries.orderBy('date').toArray(),
        workLogs: await db.workLogs.orderBy('date').toArray(),
        customHolidays: await db.holidays.orderBy('date').toArray(),
      };
    },
  );
}

type RawBackup = Record<string, unknown>;

/**
 * 옛 버전 백업을 한 단계씩 올리는 변환기. 키 n은 "버전 n을 n+1로" 바꿔요.
 * 스키마를 바꿀 때(Dexie version(2) 등) 여기에 추가해요.
 */
const MIGRATIONS: Record<number, (data: RawBackup) => RawBackup> = {};

function check(condition: boolean, message: string): asserts condition {
  if (!condition) throw new ValidationError(message);
}

function validateEach<T>(items: unknown[], label: string, validate: (item: T) => void): T[] {
  return items.map((item, i) => {
    try {
      check(typeof item === 'object' && item !== null, '형식이 올바르지 않아요.');
      validate(item as T);
      return item as T;
    } catch (e) {
      const reason = e instanceof Error ? e.message : '형식이 올바르지 않아요.';
      throw new ValidationError(`${label} ${i + 1}번째: ${reason}`);
    }
  });
}

/** 가져올 파일을 검사해요. 버전이 낮으면 변환기를 거치고, 높으면 거부해요 (SPEC §6). */
export function parseBackup(json: unknown): BackupFile {
  check(
    typeof json === 'object' && json !== null && (json as RawBackup).app === BACKUP_APP,
    '연차 플래너 백업 파일이 아니에요.',
  );
  let data = json as RawBackup;
  const version = data.schemaVersion;
  check(
    typeof version === 'number' && Number.isInteger(version),
    '백업 파일 형식이 올바르지 않아요.',
  );
  check(
    version <= BACKUP_SCHEMA_VERSION,
    '더 새로운 버전의 앱에서 만든 백업이에요. 앱을 새로고침해 업데이트한 뒤 다시 가져와 주세요.',
  );
  for (let v = version; v < BACKUP_SCHEMA_VERSION; v++) {
    const migrate = MIGRATIONS[v];
    check(migrate !== undefined, '지원하지 않는 백업 버전이에요.');
    data = { ...migrate(data), schemaVersion: v + 1 };
  }

  check(data.profile !== null && typeof data.profile === 'object', '프로필이 없는 백업이에요.');
  const lists = ['leaveGrants', 'leaveEntries', 'workLogs', 'customHolidays'] as const;
  check(
    typeof data.exportedAt === 'string' && lists.every((key) => Array.isArray(data[key])),
    '백업 파일 형식이 올바르지 않아요.',
  );

  const [profile] = validateEach<Profile>([data.profile], '프로필', validateProfile);
  return {
    app: BACKUP_APP,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: data.exportedAt as string,
    profile,
    leaveGrants: validateEach(data.leaveGrants as unknown[], '수동 보정', validateManualGrant),
    leaveEntries: validateEach(data.leaveEntries as unknown[], '휴가', validateLeaveEntry),
    workLogs: validateEach(data.workLogs as unknown[], '근무 기록', validateWorkLog),
    customHolidays: validateEach(
      data.customHolidays as unknown[],
      '회사 휴무일',
      validateCustomHoliday,
    ),
  };
}

const allTables = () => [db.profile, db.leaveGrants, db.leaveEntries, db.workLogs, db.holidays];

/** 가져오기는 전체 교체만 해요 (병합 없음). 한 트랜잭션이라 실패하면 그대로예요. */
export async function restoreBackup(backup: BackupFile): Promise<void> {
  await db.transaction('rw', allTables(), async () => {
    await Promise.all(allTables().map((t) => t.clear()));
    await db.profile.put(backup.profile);
    await db.leaveGrants.bulkPut(backup.leaveGrants);
    await db.leaveEntries.bulkPut(backup.leaveEntries);
    await db.workLogs.bulkPut(backup.workLogs);
    await db.holidays.bulkPut(backup.customHolidays);
  });
}

/** 설정의 전체 초기화 */
export async function clearAllData(): Promise<void> {
  await db.transaction('rw', allTables(), async () => {
    await Promise.all(allTables().map((t) => t.clear()));
  });
}
