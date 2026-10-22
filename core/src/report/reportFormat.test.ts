import {
  formatReportDateTime,
  formatReportNumber,
  formatReportPercent,
  formatReportRelativeTime,
  formatReportTimeRange,
  roundReportNumber,
  roundReportNumbersDeep,
} from './reportFormat';

describe('reportFormat', () => {
  it('rounds and formats numbers', () => {
    expect(roundReportNumber(1.23456)).toBe(1.235);
    expect(roundReportNumber(Number.POSITIVE_INFINITY)).toBe(Number.POSITIVE_INFINITY);
    expect(formatReportNumber(2)).toBe('2');
    expect(formatReportNumber(1.2)).toBe('1.200');
    expect(formatReportNumber(undefined)).toBe('');
    expect(formatReportPercent(0.5)).toBe('50%');
    expect(formatReportPercent(undefined)).toBe('-');
  });

  it('walks nested values when rounding', () => {
    expect(roundReportNumbersDeep({a: 1.23456, b: [2.5, 'x'], c: null})).toEqual({
      a: 1.235,
      b: [2.5, 'x'],
      c: null,
    });
  });

  it('formats timestamps and ranges', () => {
    expect(formatReportDateTime(undefined)).toBe('');
    expect(formatReportDateTime('not-a-date')).toBe('not-a-date');
    expect(formatReportDateTime(0)).toBe('1970-01-01T00:00:00.000Z');
    expect(formatReportTimeRange(0, 1000)).toContain('→');
    expect(formatReportTimeRange(0, undefined)).toBe('1970-01-01T00:00:00.000Z');
    expect(formatReportTimeRange(undefined, undefined)).toBe('');
  });

  it('formats relative times', () => {
    const now = Date.parse('2020-01-02T00:00:00.000Z');
    expect(formatReportRelativeTime(undefined, now)).toBe('');
    expect(formatReportRelativeTime('nope', now)).toBe('nope');
    expect(formatReportRelativeTime(now - 30_000, now)).toBe('now');
    expect(formatReportRelativeTime(now - 90_000, now)).toBe('1m ago');
    expect(formatReportRelativeTime(now - 3_600_000, now)).toBe('1h ago');
    expect(formatReportRelativeTime(now + 3_600_000, now)).toBe('1h from now');
    expect(formatReportRelativeTime(now - 90_000_000, now)).toBe('1d1h ago');
  });
});
