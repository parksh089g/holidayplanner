import { describe, expect, it } from 'vitest';
import { addDaysISO } from '../../src/core/date';
import { computeDay, computeWeek, toMinutes } from '../../src/core/worktime';
import type { WorkLog } from '../../src/core/types';

const WEEKDAY = { isOffDay: false, leaveQ: 0 };
const log = (clockIn: string, clockOut: string, extra: Partial<WorkLog> = {}): WorkLog => ({
  date: '2026-10-19',
  clockIn,
  clockOut,
  ...extra,
});

describe('computeDay', () => {
  it('W1: 09:00–18:00은 실근로 480분, 초과 0', () => {
    expect(computeDay(log('09:00', '18:00'), WEEKDAY)).toMatchObject({
      breakMin: 60,
      workedMin: 480,
      overtimeMin: 0,
      isOffDayWork: false,
    });
  });

  it('W2: 08:50–20:30은 휴게 60, 실근로 640, 초과 160', () => {
    expect(computeDay(log('08:50', '20:30'), WEEKDAY)).toMatchObject({
      breakMin: 60,
      workedMin: 640,
      overtimeMin: 160,
    });
  });

  it('W3: 13:30–18:00은 휴게 0, 실근로 270', () => {
    expect(computeDay(log('13:30', '18:00'), WEEKDAY)).toMatchObject({
      breakMin: 0,
      workedMin: 270,
    });
  });

  it('W4: 11:30–12:30, 휴게 미입력이면 점심과 겹친 30분을 차감해요', () => {
    expect(computeDay(log('11:30', '12:30'), WEEKDAY)).toMatchObject({
      breakMin: 30,
      workedMin: 30,
    });
  });

  it('W5: 22:00–02:00은 자정을 넘겨 실근로 240', () => {
    expect(computeDay(log('22:00', '02:00'), WEEKDAY)).toMatchObject({
      breakMin: 0,
      workedMin: 240,
    });
  });

  it('W6: 토요일 10:00–14:00은 휴게 60, 실근로 180, 휴무일 근무, 초과 180', () => {
    expect(
      computeDay(log('10:00', '14:00', { date: '2026-10-24' }), { isOffDay: true, leaveQ: 0 }),
    ).toMatchObject({
      breakMin: 60,
      workedMin: 180,
      isOffDayWork: true,
      overtimeMin: 180,
    });
  });

  it('휴게를 직접 입력하면 점심 자동 차감 대신 그 값을 써요', () => {
    expect(computeDay(log('09:00', '21:00', { breakMinutes: 90 }), WEEKDAY)).toMatchObject({
      breakMin: 90,
      workedMin: 630,
      overtimeMin: 150,
    });
  });

  it('점심시간을 바꿀 수 있어요', () => {
    const lunch = { start: '11:30', end: '12:30' };
    expect(computeDay(log('12:00', '18:00'), { ...WEEKDAY, lunch })).toMatchObject({
      breakMin: 30,
      workedMin: 330,
    });
  });

  it('자정을 넘겨 다음 날 점심까지 일하면 다음 날 점심도 차감해요', () => {
    expect(computeDay(log('20:00', '13:00'), WEEKDAY)).toMatchObject({
      breakMin: 60,
      workedMin: 960,
    });
  });

  it('휴가 인정 시간: 연차 480, 반차 240, 반반차 120', () => {
    expect(computeDay(log('09:00', '18:00'), { isOffDay: false, leaveQ: 4 }).leaveCreditMin).toBe(
      480,
    );
    expect(computeDay(log('14:00', '18:00'), { isOffDay: false, leaveQ: 2 }).leaveCreditMin).toBe(
      240,
    );
    expect(computeDay(log('11:00', '18:00'), { isOffDay: false, leaveQ: 1 }).leaveCreditMin).toBe(
      120,
    );
  });

  it('퇴근 전이면 now까지 근무로 보고 진행 중으로 표시해요', () => {
    expect(computeDay(log('09:00', ''), { ...WEEKDAY, now: '15:30' })).toMatchObject({
      inProgress: true,
      breakMin: 60,
      workedMin: 330,
    });
  });

  it('퇴근 전인데 now가 없으면 근무 0분이에요', () => {
    expect(computeDay(log('09:00', ''), WEEKDAY)).toMatchObject({
      inProgress: true,
      workedMin: 0,
      overtimeMin: 0,
    });
  });

  it('휴게가 근무시간보다 길어도 음수가 되지 않아요', () => {
    expect(computeDay(log('09:00', '09:30', { breakMinutes: 60 }), WEEKDAY).workedMin).toBe(0);
  });
});

describe('toMinutes', () => {
  it('HH:mm을 0시 기준 분으로 바꿔요', () => {
    expect(toMinutes('00:00')).toBe(0);
    expect(toMinutes('09:05')).toBe(545);
    expect(toMinutes('23:59')).toBe(1439);
  });

  it.each(['9:00', '24:00', '12:60', '', '0900'])('잘못된 시각 %j는 거부해요', (input) => {
    expect(() => toMinutes(input)).toThrow(RangeError);
  });
});

describe('computeWeek', () => {
  const monday = '2026-10-19';
  const weekLogs = (clockIn: string, clockOut: string, count: number): WorkLog[] =>
    Array.from({ length: count }, (_, i) => ({ date: addDaysISO(monday, i), clockIn, clockOut }));

  it('월요일부터 7일을 돌려줘요 (주 중간 날짜를 넣어도 그 주 월요일 기준)', () => {
    const week = computeWeek('2026-10-22', [], { off: new Set() });
    expect(week.weekStart).toBe(monday);
    expect(week.days.map((d) => d.date)).toEqual([
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
    ]);
    expect(week).toMatchObject({ workedMin: 0, overtimeMin: 0, remainingTo52Min: 3120 });
  });

  it('W7: 월–금 각 10시간 실근로면 주 3000분, 연장 600, 52시간까지 120', () => {
    const week = computeWeek(monday, weekLogs('08:00', '19:00', 5), { off: new Set() });
    expect(week).toMatchObject({
      workedMin: 3000,
      overtimeMin: 600,
      remainingTo52Min: 120,
      warning: 'near',
    });
  });

  it('W8: 월–금 각 8시간 + 토 8시간이면 주 2880, 연장 480, near', () => {
    const week = computeWeek(monday, weekLogs('09:00', '18:00', 6), { off: new Set() });
    expect(week).toMatchObject({ workedMin: 2880, overtimeMin: 480, warning: 'near' });
    expect(week.days[5]).toMatchObject({ isOffDayWork: true, overtimeMin: 480 });
  });

  it('52시간을 넘기면 over예요', () => {
    const week = computeWeek(monday, weekLogs('08:00', '20:00', 5), { off: new Set() });
    expect(week).toMatchObject({ workedMin: 3300, remainingTo52Min: -180, warning: 'over' });
  });

  it('48시간 미만이면 none이에요', () => {
    const week = computeWeek(monday, weekLogs('09:00', '18:00', 5), { off: new Set() });
    expect(week).toMatchObject({ workedMin: 2400, overtimeMin: 0, warning: 'none' });
  });

  it('공휴일 근무는 휴무일 근무로 전부 초과예요', () => {
    const week = computeWeek(monday, weekLogs('09:00', '18:00', 1), { off: new Set([monday]) });
    expect(week.days[0]).toMatchObject({ isOffDayWork: true, overtimeMin: 480 });
  });

  it('휴가 인정 시간은 52시간 판정에 넣지 않아요', () => {
    const week = computeWeek(monday, weekLogs('09:00', '18:00', 4), {
      off: new Set(),
      leaveQByDate: new Map([['2026-10-23', 4]]),
    });
    expect(week.workedMin).toBe(1920);
    expect(week.days[4]).toMatchObject({ hasLog: false, workedMin: 0, leaveCreditMin: 480 });
  });

  it('진행 중 기록은 now의 날짜에만 현재 시각을 적용해요', () => {
    const logs: WorkLog[] = [
      { date: '2026-10-21', clockIn: '09:00', clockOut: '' },
      { date: '2026-10-22', clockIn: '09:00', clockOut: '' },
    ];
    const week = computeWeek(monday, logs, {
      off: new Set(),
      now: { date: '2026-10-22', time: '11:00' },
    });
    expect(week.days[2]).toMatchObject({ inProgress: true, workedMin: 0 });
    expect(week.days[3]).toMatchObject({ inProgress: true, workedMin: 120 });
  });
});
