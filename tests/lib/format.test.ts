import { describe, expect, it } from 'vitest';
import { formatDays, formatDotDate, parseDaysToQuarters } from '../../src/lib/format';

describe('formatDotDate', () => {
  it("'2026-03-02' → '2026.03.02'", () => {
    expect(formatDotDate('2026-03-02')).toBe('2026.03.02');
  });
});

describe('formatDays', () => {
  it.each([
    [68, '17'],
    [39, '9.75'],
    [2, '0.5'],
    [1, '0.25'],
    [0, '0'],
    [-4, '-1'],
  ])('%i quarter는 %s일이에요', (q, text) => {
    expect(formatDays(q)).toBe(text);
  });
});

describe('parseDaysToQuarters', () => {
  it.each([
    ['0', 0],
    ['7.25', 29],
    [' 0.5 ', 2],
    ['15', 60],
  ])('%j → %i', (input, q) => {
    expect(parseDaysToQuarters(input)).toBe(q);
  });

  it.each(['', ' ', '-1', '1.1', '0.3', 'abc', 'Infinity'])('%j는 받지 않아요', (input) => {
    expect(parseDaysToQuarters(input)).toBeUndefined();
  });
});
