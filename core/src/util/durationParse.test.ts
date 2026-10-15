import {
  parseRelativeAmountMs,
  resolveRelativeWindow,
  signedDurationMs,
  unsignedDurationMs,
} from './durationParse';

describe('durationParse', () => {
  test('parses unsigned combined durations', () => {
    expect(unsignedDurationMs('1h1m')).toBe(3660000);
    expect(unsignedDurationMs('2d4h')).toBe(2 * 86400000 + 4 * 3600000);
    expect(unsignedDurationMs('-1h')).toBeUndefined();
  });

  test('parses signed combined durations', () => {
    expect(signedDurationMs('+1h1m')).toBe(3660000);
    expect(signedDurationMs('-1d2m1s')).toBe(
        -(86400000 + 120000 + 1000));
  });

  test('parseRelativeAmountMs accepts durations or day counts', () => {
    expect(parseRelativeAmountMs('2d')).toBe(2 * 86400000);
    expect(parseRelativeAmountMs('7')).toBe(7 * 86400000);
    expect(parseRelativeAmountMs('nope')).toBeUndefined();
  });

  test('resolveRelativeWindow supports future and past defaults', () => {
    jest.useFakeTimers();
    try {
      const now = new Date('2026-09-17T12:00:00.000Z').getTime();
      jest.setSystemTime(now);
      const future = resolveRelativeWindow(undefined, undefined, 'future');
      expect(future.startMs).toBe(now + 86400000);
      expect(future.endMs).toBe(now + 365 * 86400000);
      const past = resolveRelativeWindow(undefined, undefined, 'past');
      expect(past.endMs).toBe(now - 86400000);
      expect(past.startMs).toBe(now - 365 * 86400000);
    } finally {
      jest.useRealTimers();
    }
  });
});
