import { describe, expect, it } from 'vitest';
import { parseISO } from '../../src/core/date';
import { buildOffDaySet, deriveSubstitutes, isOffDay } from '../../src/core/holidays';
import type { Holiday } from '../../src/core/types';
import { holidayFiles, holidaysOf } from './fixtures';

/** 연도별로 기대하는 대체공휴일. 새 연도 파일을 추가하면 여기에도 추가해요 (CLAUDE.md). */
const EXPECTED_SUBSTITUTES: Record<number, string[]> = {
  // H1
  2026: ['2026-03-02', '2026-05-25', '2026-08-17', '2026-10-05'],
  // H2
  2027: [
    '2027-02-09',
    '2027-05-03',
    '2027-07-19',
    '2027-08-16',
    '2027-10-04',
    '2027-10-11',
    '2027-12-27',
  ],
};

const KINDS = new Set(['legal', 'substitute', 'election', 'temporary', 'company']);

describe('공휴일 데이터 파일', () => {
  it('H1: 모든 연도 파일에 기대 대체공휴일 목록이 있어요', () => {
    expect(holidayFiles.map((f) => f.year)).toEqual(Object.keys(EXPECTED_SUBSTITUTES).map(Number));
  });

  describe.each(holidayFiles)('$year.json', (file) => {
    it('날짜가 그 해의 올바른 ISO 날짜이고 오름차순이에요', () => {
      const dates = file.holidays.map((h) => h.date);
      for (const date of dates) {
        expect(() => parseISO(date)).not.toThrow();
        expect(date.startsWith(`${file.year}-`)).toBe(true);
      }
      expect([...dates].sort()).toEqual(dates);
    });

    it('kind가 정해진 값이고 회사 휴무일은 들어 있지 않아요', () => {
      for (const h of file.holidays) {
        expect(KINDS.has(h.kind)).toBe(true);
        expect(h.kind).not.toBe('company');
        expect(h.name.length).toBeGreaterThan(0);
      }
    });

    it(`H1/H2: substitute 목록이 deriveSubstitutes 결과와 일치해요`, () => {
      const inData = file.holidays
        .filter((h) => h.kind === 'substitute')
        .map(({ date, name }) => ({ date, name }));
      const derived = deriveSubstitutes(file.holidays).map(({ date, name }) => ({ date, name }));
      expect(derived).toEqual(inData);
      expect(inData.map((h) => h.date)).toEqual(EXPECTED_SUBSTITUTES[file.year]);
    });
  });
});

describe('deriveSubstitutes', () => {
  const h = (date: string, name: string, kind: Holiday['kind'] = 'legal'): Holiday => ({
    date,
    name,
    kind,
  });

  it('공휴일끼리 겹치면 다음 첫 비공휴일이 대체공휴일이에요 (2025 어린이날·부처님오신날)', () => {
    const result = deriveSubstitutes([
      h('2025-05-05', '어린이날'),
      h('2025-05-05', '부처님오신날'),
    ]);
    expect(result).toEqual([
      { date: '2025-05-06', name: '대체공휴일(어린이날)', kind: 'substitute' },
    ]);
  });

  it('설날·추석 연휴가 다른 공휴일과 겹치면 연휴 다음 날이 대체공휴일이에요', () => {
    const result = deriveSubstitutes([
      h('2028-10-02', '추석 연휴'),
      h('2028-10-03', '추석'),
      h('2028-10-03', '개천절'),
      h('2028-10-04', '추석 연휴'),
    ]);
    expect(result.map((r) => r.date)).toEqual(['2028-10-05']);
  });

  it('설날·추석 연휴가 토요일과 겹치는 것만으로는 대체하지 않아요 (2026 추석)', () => {
    expect(deriveSubstitutes(holidaysOf(2026).filter((x) => x.name.startsWith('추석')))).toEqual(
      [],
    );
  });

  it('신정·현충일은 주말이어도 대체하지 않아요', () => {
    expect(deriveSubstitutes([h('2022-01-01', '신정'), h('2027-06-06', '현충일')])).toEqual([]);
  });

  it('대체공휴일이 연달아 생기면 서로 겹치지 않게 뒤로 밀어요', () => {
    // 토요일 광복절과 일요일 다른 공휴일이 겹친다고 가정한 가상 데이터
    const result = deriveSubstitutes([
      h('2026-08-15', '광복절'),
      h('2026-08-16', '삼일절'),
      h('2026-08-17', '개천절'),
    ]);
    expect(result.map((r) => r.date)).toEqual(['2026-08-18', '2026-08-19']);
  });

  it('입력에 들어 있는 기존 대체공휴일·회사 휴무일은 무시해요', () => {
    const result = deriveSubstitutes([
      h('2026-03-01', '삼일절'),
      h('2026-03-02', '대체공휴일(삼일절)', 'substitute'),
      h('2026-03-03', '창립기념일', 'company'),
    ]);
    expect(result.map((r) => r.date)).toEqual(['2026-03-02']);
  });

  it('여러 해의 설날을 각각 따로 판정해요', () => {
    const result = deriveSubstitutes(holidaysOf(2026, 2027).filter((x) => x.kind === 'legal'));
    expect(result.map((r) => r.date)).toEqual([
      ...EXPECTED_SUBSTITUTES[2026],
      ...EXPECTED_SUBSTITUTES[2027],
    ]);
  });
});

describe('buildOffDaySet / isOffDay', () => {
  const holidays: Holiday[] = [
    ...holidaysOf(2026),
    { date: '2026-04-15', name: '창립기념일', kind: 'company' },
    { date: '2026-11-11', name: '꺼 둔 회사 휴무일', kind: 'company' },
  ];
  const off = buildOffDaySet(holidays, new Set(['2026-04-15']));

  it('H3: 2026-02-14(토)는 휴무예요', () => {
    expect(isOffDay('2026-02-14', off)).toBe(true);
  });

  it('일요일·공휴일·대체공휴일·선거일은 휴무예요', () => {
    for (const date of ['2026-02-15', '2026-02-17', '2026-03-02', '2026-06-03']) {
      expect(isOffDay(date, off)).toBe(true);
    }
  });

  it('평일은 근무일이에요', () => {
    expect(isOffDay('2026-10-23', off)).toBe(false);
    expect(isOffDay('2026-02-19', off)).toBe(false);
  });

  it('회사 휴무일은 켜 둔 날짜만 휴무예요', () => {
    expect(isOffDay('2026-04-15', off)).toBe(true);
    expect(isOffDay('2026-11-11', off)).toBe(false);
  });
});
