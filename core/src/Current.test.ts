import {
  currentCity,
  currentCountry,
  currentDate,
  currentDay,
  currentEpoch,
  currentEpochMs,
  currentMonth,
  currentTime,
  currentUtcDate,
  currentUtcTime,
  currentYear,
  CURRENT_TOKEN_MAP,
} from './Current';

function within(now: number, target: number, windowMs: number): boolean {
  return Math.abs(now - target) <= windowMs;
}

describe('Current tokens', () => {
  test('currentEpochMs and currentEpoch reflect now', () => {
    const now = Date.now();
    const ms = currentEpochMs();
    const sec = currentEpoch();
    expect(typeof ms).toBe('number');
    expect(typeof sec).toBe('number');
    expect(within(now, ms, 10000)).toBe(true); // within 10s cushion
    expect(within(Math.floor(now/1000), sec, 10)).toBe(true); // within 10s
  });

  test('current time/date/day/month/year types', () => {
    expect(typeof currentTime()).toBe('string');
    expect(typeof currentDate()).toBe('string');
    expect(typeof currentDay()).toBe('string');
    expect(typeof currentMonth()).toBe('string');
    expect(typeof currentYear()).toBe('number');
  });

  test('UTC date and time use UTC calendar fields', () => {
    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date('2026-09-16T23:45:12.000-07:00'));
      expect(currentUtcDate()).toBe('2026-09-17');
      expect(currentUtcTime()).toBe('06:45:12');
      expect(CURRENT_TOKEN_MAP.utc_date()).toBe('2026-09-17');
      expect(CURRENT_TOKEN_MAP.utc_time()).toBe('06:45:12');
    } finally {
      jest.useRealTimers();
    }
  });

  test('current city/country return strings (best-effort)', () => {
    const city = currentCity();
    const country = currentCountry();
    expect(typeof city).toBe('string');
    expect(typeof country).toBe('string');
    expect(city.length).toBeGreaterThan(0);
    expect(country.length).toBeGreaterThan(0);
  });

  test('currentCity uses a single-segment timezone', () => {
    const orig = Intl.DateTimeFormat;
    (Intl as any).DateTimeFormat = function() {
      return {resolvedOptions: () => ({timeZone: 'UTC'})};
    };
    try {
      expect(currentCity()).toBe('UTC');
    } finally {
      (Intl as any).DateTimeFormat = orig;
    }
  });

  test('currentCity and currentCountry fall back to Unknown', () => {
    const orig = Intl.DateTimeFormat;
    (Intl as any).DateTimeFormat = function() {
      throw new Error('no intl');
    };
    try {
      expect(currentCity()).toBe('Unknown');
      expect(currentCountry()).toBe('Unknown');
    } finally {
      (Intl as any).DateTimeFormat = orig;
    }
  });

  test('currentCountry returns region code when DisplayNames fails', () => {
    const orig = Intl.DateTimeFormat;
    const origDn = (Intl as any).DisplayNames;
    (Intl as any).DateTimeFormat = function() {
      return {resolvedOptions: () => ({locale: 'en-US'})};
    };
    (Intl as any).DisplayNames = function() {
      throw new Error('no display names');
    };
    try {
      expect(currentCountry()).toBe('US');
    } finally {
      (Intl as any).DateTimeFormat = orig;
      (Intl as any).DisplayNames = origDn;
    }
  });
});
