import {parseCacheExpiryAtMs} from './JSerHelper';

describe('parseCacheExpiryAtMs', () => {
  const now = Date.UTC(2026, 0, 1, 12, 0, 0); // fixed

  it('parses duration relative to now', () => {
    expect(parseCacheExpiryAtMs('5m', now)).toBe(now + 5 * 60 * 1000);
    expect(parseCacheExpiryAtMs('1h5m', now)).toBe(now + (65 * 60 * 1000));
    expect(parseCacheExpiryAtMs('2s', now)).toBe(now + 2000);
  });

  it('parses ISO / standard time text containing colon', () => {
    expect(parseCacheExpiryAtMs('2026-12-31T23:59:59Z', now))
        .toBe(Date.parse('2026-12-31T23:59:59Z'));
  });

  it('parses bare epoch seconds and milliseconds', () => {
    expect(parseCacheExpiryAtMs(1735689600, now)).toBe(1735689600 * 1000);
    expect(parseCacheExpiryAtMs('1735689600', now)).toBe(1735689600 * 1000);
    expect(parseCacheExpiryAtMs(1735689600000, now)).toBe(1735689600000);
  });

  it('returns undefined for invalid values', () => {
    expect(parseCacheExpiryAtMs('', now)).toBeUndefined();
    expect(parseCacheExpiryAtMs('not-a-time', now)).toBeUndefined();
    expect(parseCacheExpiryAtMs(-1, now)).toBeUndefined();
  });
});
