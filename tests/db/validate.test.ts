import { describe, expect, it } from 'vitest';
import type { Holiday, ManualGrant } from '../../src/core/types';
import {
  ValidationError,
  isHHmm,
  isISODate,
  validateCustomHoliday,
  validateLeaveEntry,
  validateManualGrant,
  validateProfile,
  validateWorkLog,
} from '../../src/db/validate';
import { leave, sampleProfile, workLog } from './fixtures';

const grant = (overrides: Partial<ManualGrant> = {}): ManualGrant => ({
  id: 'g',
  grantDate: '2026-01-01',
  expireDate: '2026-12-31',
  quarters: 4,
  memo: '',
  ...overrides,
});

const holiday = (overrides: Partial<Holiday> = {}): Holiday => ({
  date: '2026-04-15',
  name: '창립기념일',
  kind: 'company',
  ...overrides,
});

describe('isISODate / isHHmm', () => {
  it.each([
    ['2026-02-28', true],
    ['2026-02-29', false],
    ['2026-2-28', false],
    [20260228, false],
  ])('isISODate(%j) = %s', (v, ok) => expect(isISODate(v)).toBe(ok));

  it.each([
    ['09:00', true],
    ['23:59', true],
    ['24:00', false],
    ['9:00', false],
    ['09:00:00', false],
    [900, false],
  ])('isHHmm(%j) = %s', (v, ok) => expect(isHHmm(v)).toBe(ok));
});

describe('validateProfile', () => {
  it('올바른 프로필은 통과해요', () => {
    expect(() => validateProfile(sampleProfile())).not.toThrow();
  });

  it.each([
    ['입사일', { hireDate: '2021/03/02' }],
    ['출근 시각', { workStart: '9:00' }],
    ['출퇴근 순서', { workStart: '18:00', workEnd: '09:00' }],
    ['점심 순서', { lunchStart: '13:00', lunchEnd: '12:00' }],
    ['테마', { theme: 'blue' }],
    ['온보딩 시각', { onboardedAt: 'yesterday' }],
    ['스키마 버전', { schemaVersion: 2 }],
  ])('%s이 틀리면 거부해요', (_, overrides) => {
    expect(() => validateProfile(sampleProfile(overrides as never))).toThrow(ValidationError);
  });
});

describe('validateManualGrant', () => {
  it('음수(감액)는 통과해요', () => {
    expect(() => validateManualGrant(grant({ quarters: -8 }))).not.toThrow();
  });

  it.each([
    ['id 없음', { id: '' }],
    ['날짜 형식', { grantDate: '2026-13-01' }],
    ['소멸일이 발생일보다 빠름', { grantDate: '2026-06-01', expireDate: '2026-05-31' }],
    ['0일', { quarters: 0 }],
    ['0.25일 단위 아님', { quarters: 1.5 }],
  ])('%s이면 거부해요', (_, overrides) => {
    expect(() => validateManualGrant(grant(overrides))).toThrow(ValidationError);
  });
});

describe('validateLeaveEntry', () => {
  it.each([
    ['연차', {}],
    ['반차 오후', { quarters: 2, part: 'pm' as const }],
    ['반반차 오전', { quarters: 1, part: 'am' as const }],
    ['일괄 차감 임의 값', { quarters: 29, isBulk: true }],
    ['특별휴가', { type: 'special' as const }],
  ])('%s은 통과해요', (_, overrides) => {
    expect(() => validateLeaveEntry(leave('e', '2026-10-30', overrides))).not.toThrow();
  });

  it.each([
    ['날짜 형식', { date: '2026-10-32' }],
    ['유형', { type: 'vacation' }],
    ['0일', { quarters: 0 }],
    ['3 quarter (일괄 아님)', { quarters: 3 }],
    ['연차에 오전·오후 지정', { quarters: 4, part: 'am' }],
    ['오전·오후 값', { quarters: 2, part: 'noon' }],
  ])('%s이 틀리면 거부해요', (_, overrides) => {
    expect(() => validateLeaveEntry(leave('e', '2026-10-30', overrides as never))).toThrow(
      ValidationError,
    );
  });
});

describe('validateWorkLog', () => {
  it.each([
    ['퇴근 기록', {}],
    ['진행 중', { clockOut: '' }],
    ['휴게 직접 입력', { breakMinutes: 90 }],
  ])('%s은 통과해요', (_, overrides) => {
    expect(() => validateWorkLog(workLog('2026-10-23', overrides))).not.toThrow();
  });

  it.each([
    ['출근 시각', { clockIn: '9:00' }],
    ['퇴근 시각', { clockOut: '18:00:00' }],
    ['음수 휴게', { breakMinutes: -10 }],
    ['소수 휴게', { breakMinutes: 30.5 }],
    ['날짜', { date: '20261023' }],
  ])('%s이 틀리면 거부해요', (_, overrides) => {
    expect(() => validateWorkLog(workLog('2026-10-23', overrides))).toThrow(ValidationError);
  });
});

describe('validateCustomHoliday', () => {
  it('회사 휴무일은 통과해요', () => {
    expect(() => validateCustomHoliday(holiday())).not.toThrow();
  });

  it.each([
    ['종류', { kind: 'legal' as const }],
    ['빈 이름', { name: '   ' }],
    ['날짜', { date: '2026-04-31' }],
  ])('%s이 틀리면 거부해요', (_, overrides) => {
    expect(() => validateCustomHoliday(holiday(overrides))).toThrow(ValidationError);
  });
});
