import type { LeaveEntry, Profile, WorkLog } from '../../src/core/types';
import { db } from '../../src/db/schema';

export const resetDb = () => Promise.all(db.tables.map((t) => t.clear()));

export const sampleProfile = (overrides: Partial<Profile> = {}): Profile => ({
  id: 'me',
  hireDate: '2021-03-02',
  workStart: '09:00',
  workEnd: '18:00',
  lunchStart: '12:00',
  lunchEnd: '13:00',
  theme: 'system',
  onboardedAt: '2026-10-25T10:00:00+09:00',
  schemaVersion: 1,
  ...overrides,
});

export const leave = (
  id: string,
  date: string,
  overrides: Partial<LeaveEntry> = {},
): LeaveEntry => ({ id, date, quarters: 4, type: 'annual', ...overrides });

export const workLog = (date: string, overrides: Partial<WorkLog> = {}): WorkLog => ({
  date,
  clockIn: '09:00',
  clockOut: '18:00',
  ...overrides,
});
