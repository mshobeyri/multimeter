import { currentTime, currentDate, currentDay, currentMonth, currentYear, currentEpoch, currentEpochMs, currentCity, currentCountry } from './Current';

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

  test('current city/country return strings (best-effort)', () => {
    const city = currentCity();
    const country = currentCountry();
    expect(typeof city).toBe('string');
    expect(typeof country).toBe('string');
    expect(city.length).toBeGreaterThan(0);
    expect(country.length).toBeGreaterThan(0);
  });
});
