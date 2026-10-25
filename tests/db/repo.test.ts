import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import * as repo from '../../src/db/repo';
import { db } from '../../src/db/schema';
import { ValidationError } from '../../src/db/validate';
import { leave, resetDb, sampleProfile, workLog } from './fixtures';

beforeEach(resetDb);

describe('스키마', () => {
  it('SPEC §6의 테이블과 인덱스로 열려요 (version 1)', async () => {
    await db.open();
    expect(db.verno).toBe(1);
    const tables = Object.fromEntries(
      db.tables.map((t) => [
        t.name,
        [t.schema.primKey.name, ...t.schema.indexes.map((i) => i.name)],
      ]),
    );
    expect(tables).toEqual({
      profile: ['id'],
      leaveGrants: ['id', 'grantDate'],
      leaveEntries: ['id', 'date', 'type'],
      workLogs: ['date'],
      holidays: ['date', 'kind'],
    });
  });
});

describe('프로필', () => {
  it('없으면 undefined이고, 저장하면 읽혀요', async () => {
    expect(await repo.getProfile()).toBeUndefined();
    await repo.saveProfile(sampleProfile());
    expect(await repo.getProfile()).toEqual(sampleProfile());
  });

  it('updateProfile은 바꾼 값만 덮어써요', async () => {
    await repo.saveProfile(sampleProfile());
    await repo.updateProfile({ theme: 'dark', workEnd: '19:00' });
    expect(await repo.getProfile()).toEqual(sampleProfile({ theme: 'dark', workEnd: '19:00' }));
  });

  it('프로필이 없으면 updateProfile을 거부해요', async () => {
    await expect(repo.updateProfile({ theme: 'dark' })).rejects.toThrow(ValidationError);
  });

  it('형식이 틀리면 저장하지 않아요', async () => {
    await expect(repo.saveProfile(sampleProfile({ hireDate: '2021-3-2' }))).rejects.toThrow(
      ValidationError,
    );
    await repo.saveProfile(sampleProfile());
    await expect(repo.updateProfile({ workEnd: '08:00' })).rejects.toThrow(ValidationError);
    expect((await repo.getProfile())?.workEnd).toBe('18:00');
  });
});

describe('휴가 기록', () => {
  it('저장·조회·삭제하고 날짜 오름차순으로 돌려줘요', async () => {
    await repo.putLeaveEntry(leave('b', '2026-11-02'));
    await repo.putLeaveEntry(leave('a', '2026-10-30', { quarters: 2, part: 'pm' }));
    expect((await repo.listLeaveEntries()).map((e) => e.id)).toEqual(['a', 'b']);

    await repo.putLeaveEntry(leave('b', '2026-11-02', { type: 'special' }));
    expect((await repo.listLeaveEntries()).find((e) => e.id === 'b')?.type).toBe('special');

    await repo.deleteLeaveEntry('a');
    expect((await repo.listLeaveEntries()).map((e) => e.id)).toEqual(['b']);
  });

  it('기간으로 조회하면 양 끝 날짜를 포함해요', async () => {
    for (const [id, date] of [
      ['1', '2026-10-31'],
      ['2', '2026-11-01'],
      ['3', '2026-11-30'],
      ['4', '2026-12-01'],
    ]) {
      await repo.putLeaveEntry(leave(id, date));
    }
    const nov = await repo.listLeaveEntries({ from: '2026-11-01', to: '2026-11-30' });
    expect(nov.map((e) => e.id).sort()).toEqual(['2', '3']);
  });

  it('addLeaveEntries는 여러 건을 넣고 deleteLeaveEntries로 되돌려요', async () => {
    const plan = [leave('p1', '2026-09-21'), leave('p2', '2026-09-22'), leave('p3', '2026-09-23')];
    await repo.addLeaveEntries(plan);
    expect(await repo.listLeaveEntries()).toHaveLength(3);
    await repo.deleteLeaveEntries(plan.map((e) => e.id));
    expect(await repo.listLeaveEntries()).toEqual([]);
  });

  it('addLeaveEntries는 하나라도 틀리면 아무것도 넣지 않아요', async () => {
    await expect(
      repo.addLeaveEntries([leave('ok', '2026-09-21'), leave('bad', '2026-09-31')]),
    ).rejects.toThrow(ValidationError);
    expect(await repo.listLeaveEntries()).toEqual([]);
  });

  it('addLeaveEntries는 id가 겹치면 전부 취소해요', async () => {
    await repo.putLeaveEntry(leave('dup', '2026-09-20'));
    await expect(
      repo.addLeaveEntries([leave('new', '2026-09-21'), leave('dup', '2026-09-22')]),
    ).rejects.toThrow();
    expect((await repo.listLeaveEntries()).map((e) => e.id)).toEqual(['dup']);
  });
});

describe('근무 기록', () => {
  it('날짜가 키라서 같은 날 다시 저장하면 덮어써요', async () => {
    await repo.putWorkLog(workLog('2026-10-23', { clockOut: '' }));
    await repo.putWorkLog(workLog('2026-10-23', { clockOut: '19:30' }));
    expect(await repo.getWorkLog('2026-10-23')).toEqual(
      workLog('2026-10-23', { clockOut: '19:30' }),
    );
  });

  it('기간으로 조회하고 삭제해요', async () => {
    for (const date of ['2026-10-18', '2026-10-19', '2026-10-25', '2026-10-26']) {
      await repo.putWorkLog(workLog(date));
    }
    const week = await repo.listWorkLogs({ from: '2026-10-19', to: '2026-10-25' });
    expect(week.map((l) => l.date)).toEqual(['2026-10-19', '2026-10-25']);
    await repo.deleteWorkLog('2026-10-19');
    expect((await repo.listWorkLogs()).map((l) => l.date)).toEqual([
      '2026-10-18',
      '2026-10-25',
      '2026-10-26',
    ]);
  });

  it('형식이 틀리면 저장하지 않아요', async () => {
    await expect(repo.putWorkLog(workLog('2026-10-23', { clockIn: '9:00' }))).rejects.toThrow(
      ValidationError,
    );
    expect(await repo.listWorkLogs()).toEqual([]);
  });
});

describe('수동 보정', () => {
  it('발생일 순으로 돌려주고 음수(감액)도 저장해요', async () => {
    await repo.putManualGrant({
      id: 'carry',
      grantDate: '2026-03-02',
      expireDate: '2026-06-30',
      quarters: 8,
      memo: '이월',
    });
    await repo.putManualGrant({
      id: 'cut',
      grantDate: '2026-01-01',
      expireDate: '2026-12-31',
      quarters: -4,
      memo: '출근율 감액',
    });
    expect((await repo.listManualGrants()).map((g) => g.id)).toEqual(['cut', 'carry']);
    await repo.deleteManualGrant('cut');
    expect((await repo.listManualGrants()).map((g) => g.id)).toEqual(['carry']);
  });
});

describe('회사 휴무일', () => {
  it('이름 앞뒤 공백을 지우고 저장해요', async () => {
    await repo.putCustomHoliday({ date: '2026-04-15', name: '  창립기념일 ', kind: 'company' });
    expect(await repo.listCustomHolidays()).toEqual([
      { date: '2026-04-15', name: '창립기념일', kind: 'company' },
    ]);
    await repo.deleteCustomHoliday('2026-04-15');
    expect(await repo.listCustomHolidays()).toEqual([]);
  });

  it('회사 휴무일이 아닌 종류는 거부해요', async () => {
    await expect(
      repo.putCustomHoliday({ date: '2026-04-15', name: '가짜 공휴일', kind: 'legal' }),
    ).rejects.toThrow(ValidationError);
  });
});

describe('newId', () => {
  it('겹치지 않는 UUID를 만들어요', () => {
    const ids = new Set(Array.from({ length: 100 }, repo.newId));
    expect(ids.size).toBe(100);
    expect([...ids][0]).toMatch(/^[0-9a-f-]{36}$/);
  });
});
