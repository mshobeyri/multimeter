import {
  clearGitCurrentSnapshot,
  currentCity,
  currentCountry,
  currentDate,
  currentDateTime,
  currentDateTimeMs,
  currentDay,
  currentEpoch,
  currentEpochMs,
  currentMonth,
  currentTime,
  currentUtcDate,
  currentUtcDateTime,
  currentUtcDateTimeMs,
  currentUtcOffset,
  currentUtcTime,
  currentTimezone,
  currentValueForToken,
  currentWeekdayNumber,
  currentYear,
  CURRENT_TOKEN_MAP,
  currentTokenValueType,
  CURRENT_TOKEN_VALUE_TYPES,
  setGitCurrentSnapshot,
} from './Current';

function within(now: number, target: number, windowMs: number): boolean {
  return Math.abs(now - target) <= windowMs;
}

describe('Current tokens', () => {
  test('every registered current token returns a value', () => {
    for (const generator of Object.values(CURRENT_TOKEN_MAP)) {
      expect(generator()).not.toBeUndefined();
    }
  });

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
      expect(currentUtcDateTime()).toBe('2026-09-17T06:45:12Z');
      expect(currentUtcDateTimeMs()).toBe('2026-09-17T06:45:12.000Z');
      expect(CURRENT_TOKEN_MAP.utc_date()).toBe('2026-09-17');
      expect(CURRENT_TOKEN_MAP.utc_time()).toBe('06:45:12');
      expect(CURRENT_TOKEN_MAP.utc_datetime()).toBe(
          '2026-09-17T06:45:12Z');
      expect(CURRENT_TOKEN_MAP.utc_datetime_ms()).toBe(
          '2026-09-17T06:45:12.000Z');
    } finally {
      jest.useRealTimers();
    }
  });

  test('local datetime combines local calendar date and time', () => {
    jest.useFakeTimers();
    try {
      const instant = new Date('2026-09-17T06:45:12.000Z');
      jest.setSystemTime(instant);
      expect(currentDateTime()).toBe(
          `${currentDate()}T${currentTime()}`);
      expect(CURRENT_TOKEN_MAP.datetime()).toBe(currentDateTime());
    } finally {
      jest.useRealTimers();
    }
  });

  test('timezone helpers return an offset and ISO weekday number', () => {
    expect(currentTimezone().length).toBeGreaterThan(0);
    expect(currentUtcOffset()).toMatch(/^[+-]\d{2}:\d{2}$/);
    expect(currentWeekdayNumber()).toBeGreaterThanOrEqual(1);
    expect(currentWeekdayNumber()).toBeLessThanOrEqual(7);
  });

  test('datetime_ms returns local datetime with milliseconds', () => {
    jest.useFakeTimers();
    try {
      const instant = new Date('2026-09-17T12:34:56.789Z');
      jest.setSystemTime(instant);
      expect(CURRENT_TOKEN_MAP.datetime_ms()).toBe(currentDateTimeMs(instant));
    } finally {
      jest.useRealTimers();
    }
  });

  test('future/past aliases apply unsigned duration offsets', () => {
    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date('2026-09-17T12:00:00.000Z'));
      expect(currentValueForToken('datetime_future(1h)')).toBe(
          currentDateTime(new Date('2026-09-17T13:00:00.000Z')));
      expect(currentValueForToken('utc_datetime_past(2d)')).toBe(
          '2026-09-15T12:00:00Z');
      expect(currentValueForToken('epoch_future(30m)'))
          .toBe(Math.floor(Date.parse('2026-09-17T12:30:00Z') / 1000));
      expect(currentValueForToken('time_past(15m)')).toBe(
          currentTime(new Date('2026-09-17T11:45:00.000Z')));
    } finally {
      jest.useRealTimers();
    }
  });

  test('rejects unsigned durations on signed-offset tokens', () => {
    expect(currentValueForToken('date(1h)')).toBeUndefined();
    expect(currentValueForToken('datetime_future(+1h)')).toBeUndefined();
  });

  test('applies signed combined-duration offsets to temporal tokens', () => {
    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date('2026-09-17T12:00:00.000Z'));
      expect(currentValueForToken('utc_datetime(+1h1m)'))
          .toBe('2026-09-17T13:01:00Z');
      expect(currentValueForToken('utc_datetime_ms(-1d2m1s)'))
          .toBe('2026-09-16T11:57:59.000Z');
      expect(currentValueForToken('epoch(+30m)'))
          .toBe(Math.floor(Date.parse('2026-09-17T12:30:00Z') / 1000));
      expect(currentValueForToken('date(+1d)')).toBe(
          currentDate(new Date('2026-09-18T12:00:00.000Z')));
    } finally {
      jest.useRealTimers();
    }
  });

  test('rejects offsets on locale tokens and unsigned durations', () => {
    expect(currentValueForToken('timezone(+1h)')).toBeUndefined();
    expect(currentValueForToken('city(-1d)')).toBeUndefined();
    expect(currentValueForToken('date(1h)')).toBeUndefined();
    expect(currentValueForToken('date(+tomorrow)')).toBeUndefined();
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

describe('git current tokens', () => {
  afterEach(() => {
    clearGitCurrentSnapshot();
  });

  test('return empty / false when no snapshot is injected', () => {
    expect(currentValueForToken('git_branch')).toBe('');
    expect(currentValueForToken('git_commit')).toBe('');
    expect(currentValueForToken('git_commit_hash')).toBe('');
    expect(currentValueForToken('git_tag')).toBe('');
    expect(currentValueForToken('git_describe')).toBe('');
    expect(currentValueForToken('git_dirty')).toBe(false);
  });

  test('reads injected snapshot and short aliases', () => {
    setGitCurrentSnapshot({
      branch: 'dev',
      commit: 'a4f5e463',
      commitHash: 'a4f5e4630123456789abcdef0123456789abcdef',
      tag: 'v1.0.0',
      describe: 'v1.0.0-1-ga4f5e463',
      dirty: true,
    });
    expect(currentValueForToken('git_branch')).toBe('dev');
    expect(currentValueForToken('branch')).toBe('dev');
    expect(currentValueForToken('git_commit')).toBe('a4f5e463');
    expect(currentValueForToken('commit')).toBe('a4f5e463');
    expect(currentValueForToken('commit_short')).toBe('a4f5e463');
    expect(currentValueForToken('commit_hash_short')).toBe('a4f5e463');
    expect(currentValueForToken('git_commit_hash')).toBe(
        'a4f5e4630123456789abcdef0123456789abcdef');
    expect(currentValueForToken('commit_hash')).toBe(
        'a4f5e4630123456789abcdef0123456789abcdef');
    expect(currentValueForToken('git_tag')).toBe('v1.0.0');
    expect(currentValueForToken('tag')).toBe('v1.0.0');
    expect(currentValueForToken('git_describe')).toBe('v1.0.0-1-ga4f5e463');
    expect(currentValueForToken('git_dirty')).toBe(true);
  });

  test('rejects offsets on git tokens', () => {
    expect(currentValueForToken('git_commit(+1h)')).toBeUndefined();
    expect(currentValueForToken('branch(-1d)')).toBeUndefined();
  });
});

describe('currentTokenValueType metadata', () => {
  test('covers every CURRENT_TOKEN_MAP key and matches sample typeof', () => {
    for (const [name, gen] of Object.entries(CURRENT_TOKEN_MAP)) {
      const declared = currentTokenValueType(name);
      expect(declared).toBeDefined();
      expect(CURRENT_TOKEN_VALUE_TYPES[name]).toBe(declared);
      expect(typeof gen()).toBe(declared);
    }
  });

  test('day/month are strings; epoch/year are numbers', () => {
    expect(currentTokenValueType('day')).toBe('string');
    expect(currentTokenValueType('month')).toBe('string');
    expect(currentTokenValueType('epoch')).toBe('number');
    expect(currentTokenValueType('year')).toBe('number');
    expect(currentTokenValueType('epoch_future')).toBe('number');
  });
});
