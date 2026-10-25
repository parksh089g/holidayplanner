import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  BACKUP_SCHEMA_VERSION,
  backupFileName,
  clearAllData,
  createBackup,
  parseBackup,
  restoreBackup,
  toOffsetISOString,
} from '../../src/db/backup';
import * as repo from '../../src/db/repo';
import { ValidationError } from '../../src/db/validate';
import { leave, resetDb, sampleProfile, workLog } from './fixtures';

beforeEach(resetDb);

async function seed() {
  await repo.saveProfile(sampleProfile({ theme: 'dark' }));
  await repo.putManualGrant({
    id: 'carry',
    grantDate: '2026-03-02',
    expireDate: '2026-12-31',
    quarters: 8,
    memo: '이월',
  });
  await repo.putLeaveEntry(leave('a', '2026-10-26'));
  await repo.putLeaveEntry(leave('b', '2026-10-27', { quarters: 2, part: 'pm', memo: '병원' }));
  await repo.putWorkLog(workLog('2026-10-21', { breakMinutes: 30, note: '야근' }));
  await repo.putCustomHoliday({ date: '2026-04-15', name: '창립기념일', kind: 'company' });
}

describe('createBackup (SPEC §6 백업 포맷)', () => {
  it('SPEC 형식으로 모든 데이터를 담아요', async () => {
    await seed();
    const backup = await createBackup(new Date(2026, 9, 23, 10, 0));
    expect(Object.keys(backup)).toEqual([
      'app',
      'schemaVersion',
      'exportedAt',
      'profile',
      'leaveGrants',
      'leaveEntries',
      'workLogs',
      'customHolidays',
    ]);
    expect(backup.app).toBe('holidayplanner');
    expect(backup.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
    expect(backup.exportedAt).toMatch(/^2026-10-23T10:00:00[+-]\d{2}:\d{2}$/);
    expect(backup.profile).toEqual(sampleProfile({ theme: 'dark' }));
    expect(backup.leaveGrants).toHaveLength(1);
    expect(backup.leaveEntries.map((e) => e.id)).toEqual(['a', 'b']);
    expect(backup.workLogs).toEqual([workLog('2026-10-21', { breakMinutes: 30, note: '야근' })]);
    expect(backup.customHolidays).toEqual([
      { date: '2026-04-15', name: '창립기념일', kind: 'company' },
    ]);
  });

  it('파일명은 holidayplanner-backup-YYYYMMDD.json이에요', () => {
    expect(backupFileName('2026-10-23')).toBe('holidayplanner-backup-20261023.json');
    expect(backupFileName('2026-10-23', 'before-import')).toBe(
      'holidayplanner-backup-20261023-before-import.json',
    );
  });

  it('내보낸 시각은 로컬 시간대 오프셋을 붙인 ISO 형식이에요', () => {
    const text = toOffsetISOString(new Date(2026, 0, 2, 3, 4, 5));
    expect(text).toMatch(/^2026-01-02T03:04:05[+-]\d{2}:\d{2}$/);
  });
});

describe('parseBackup', () => {
  it('내보낸 파일을 그대로 다시 읽어요 (JSON 왕복)', async () => {
    await seed();
    const backup = await createBackup(new Date(2026, 9, 23, 10, 0));
    expect(parseBackup(JSON.parse(JSON.stringify(backup)))).toEqual(backup);
  });

  const valid = () => ({
    app: 'holidayplanner',
    schemaVersion: 1,
    exportedAt: '2026-10-23T10:00:00+09:00',
    profile: sampleProfile(),
    leaveGrants: [],
    leaveEntries: [],
    workLogs: [],
    customHolidays: [],
  });

  it.each([
    ['JSON 객체가 아님', 'hello', '연차 플래너 백업 파일이 아니에요.'],
    ['다른 앱 파일', { ...valid(), app: 'other' }, '연차 플래너 백업 파일이 아니에요.'],
    [
      '앱보다 새 버전',
      { ...valid(), schemaVersion: BACKUP_SCHEMA_VERSION + 1 },
      '더 새로운 버전의 앱에서 만든 백업이에요. 앱을 새로고침해 업데이트한 뒤 다시 가져와 주세요.',
    ],
    ['변환할 수 없는 옛 버전', { ...valid(), schemaVersion: 0 }, '지원하지 않는 백업 버전이에요.'],
    ['프로필 없음', { ...valid(), profile: null }, '프로필이 없는 백업이에요.'],
    ['목록이 배열이 아님', { ...valid(), workLogs: {} }, '백업 파일 형식이 올바르지 않아요.'],
  ])('%s이면 거부해요', (_, data, message) => {
    expect(() => parseBackup(data)).toThrow(new ValidationError(message));
  });

  it('기록 하나라도 틀리면 어디가 틀렸는지 알려주고 거부해요', () => {
    const data = { ...valid(), workLogs: [workLog('2026-10-21', { clockIn: '9:00' })] };
    expect(() => parseBackup(data)).toThrow(/근무 기록 1번째: 출근 시각 형식이 올바르지 않아요/);
    const holiday = {
      ...valid(),
      customHolidays: [{ date: '2026-01-01', name: 'x', kind: 'legal' }],
    };
    expect(() => parseBackup(holiday)).toThrow(/회사 휴무일 1번째/);
  });

  it('필요 없는 필드는 버리지 않고 기록 단위로 그대로 둬요 (앞으로 쓸 필드 보존)', () => {
    const data = { ...valid(), leaveEntries: [{ ...leave('x', '2026-10-26'), extra: 1 }] };
    expect(parseBackup(data).leaveEntries[0]).toMatchObject({ id: 'x', extra: 1 });
  });
});

describe('restoreBackup / clearAllData', () => {
  it('가져오기는 전체 교체예요 (병합하지 않아요)', async () => {
    await seed();
    const backup = parseBackup({
      app: 'holidayplanner',
      schemaVersion: 1,
      exportedAt: '2026-10-01T09:00:00+09:00',
      profile: sampleProfile({ hireDate: '2020-01-02' }),
      leaveGrants: [],
      leaveEntries: [leave('only', '2026-11-02')],
      workLogs: [],
      customHolidays: [],
    });
    await restoreBackup(backup);
    expect((await repo.getProfile())?.hireDate).toBe('2020-01-02');
    expect((await repo.listLeaveEntries()).map((e) => e.id)).toEqual(['only']);
    expect(await repo.listManualGrants()).toEqual([]);
    expect(await repo.listWorkLogs()).toEqual([]);
    expect(await repo.listCustomHolidays()).toEqual([]);
  });

  it('전체 초기화는 모든 표를 비워요', async () => {
    await seed();
    await clearAllData();
    expect(await repo.getProfile()).toBeUndefined();
    expect(await repo.listLeaveEntries()).toEqual([]);
    expect(await repo.listWorkLogs()).toEqual([]);
    expect(await repo.listManualGrants()).toEqual([]);
    expect(await repo.listCustomHolidays()).toEqual([]);
  });
});
