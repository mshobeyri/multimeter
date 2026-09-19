import {randomCity, randomColor, randomCountry, randomDateFuture, randomDatePast, randomEmail, randomEpoch, randomEpochFuture, randomEpochFutureMs, randomEpochMs, randomEpochPast, randomEpochPastMs, randomFirstName, randomFullName, randomHexColor, randomIP, randomIPv6, randomLastName, randomLatitude, randomLongitude, randomMonth, randomPhoneNumber, randomWeekday} from './Random';
import * as Random from './Random';
import {FIRST_NAMES, LAST_NAMES} from './RandomResources';

describe('Random color generators', () => {
  const PALETTE = new Set([
    'red',        'orange',    'yellow',    'green',    'blue',     'indigo',
    'violet',     'pink',      'purple',    'brown',    'black',    'white',
    'gray',       'grey',      'cyan',      'magenta',  'lime',     'maroon',
    'navy',       'olive',     'teal',      'silver',   'gold',     'beige',
    'coral',      'fuchsia',   'turquoise', 'salmon',   'plum',     'orchid',
    'khaki',      'crimson',   'azure',     'lavender', 'tan',      'aqua',
    'aquamarine', 'chocolate', 'ivory',     'mint',     'peachpuff'
  ]);

  test('randomHexColor returns #RRGGBB', () => {
    for (let i = 0; i < 10; i++) {
      const hex = randomHexColor();
      expect(/^#[0-9a-fA-F]{6}$/.test(hex)).toBe(true);
    }
  });

  test('randomColor returns a palette member', () => {
    for (let i = 0; i < 10; i++) {
      const c = randomColor();
      expect(typeof c).toBe('string');
      expect(PALETTE.has(c)).toBe(true);
    }
  });
});

describe('Random IP generators', () => {
  test('randomIP returns valid IPv4', () => {
    for (let i = 0; i < 10; i++) {
      const ip = randomIP();
      expect(/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)).toBe(true);
      const parts = ip.split('.').map(Number);
      expect(parts).toHaveLength(4);
      for (const p of parts) {
        expect(Number.isInteger(p)).toBe(true);
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThanOrEqual(255);
      }
    }
  });

  test('randomIPv6 returns 8 x 4-hex groups', () => {
    for (let i = 0; i < 10; i++) {
      const ip6 = randomIPv6();
      expect(/^([0-9a-f]{4}:){7}[0-9a-f]{4}$/.test(ip6)).toBe(true);
    }
  });
});

describe('Random city/country, phone, email, geo', () => {
  test('randomCity returns a non-empty string', () => {
    for (let i = 0; i < 5; i++) {
      const city = randomCity();
      expect(typeof city).toBe('string');
      expect(city.length).toBeGreaterThan(0);
    }
  });

  test('randomCountry returns a non-empty string', () => {
    for (let i = 0; i < 5; i++) {
      const country = randomCountry();
      expect(typeof country).toBe('string');
      expect(country.length).toBeGreaterThan(0);
    }
  });

  test('randomPhoneNumber returns E.164', () => {
    for (let i = 0; i < 10; i++) {
      const phone = randomPhoneNumber();
      expect(/^\+[1-9]\d{7,14}$/.test(phone)).toBe(true);
    }
  });

  test('randomEmail returns email-like string', () => {
    for (let i = 0; i < 10; i++) {
      const email = randomEmail();
      expect(/^[a-z0-9]+\.?[a-z0-9]*\d*@[^@\s]+\.[^@\s]+$/.test(email))
          .toBe(true);
    }
  });

  test('randomLatitude and randomLongitude within ranges', () => {
    for (let i = 0; i < 10; i++) {
      const lat = randomLatitude();
      const lon = randomLongitude();
      expect(typeof lat).toBe('number');
      expect(typeof lon).toBe('number');
      expect(lat).toBeGreaterThanOrEqual(-90);
      expect(lat).toBeLessThanOrEqual(90);
      expect(lon).toBeGreaterThanOrEqual(-180);
      expect(lon).toBeLessThanOrEqual(180);
    }
  });
});

describe('Random date and calendar generators', () => {
  test('randomDateFuture returns a future date within a year', () => {
    for (let i = 0; i < 5; i++) {
      const s = randomDateFuture();
      const d = new Date(s);
      expect(d.toString()).toBe(s);
      expect(d.getTime()).toBeGreaterThan(Date.now());
      const diffDays = (d.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
      expect(diffDays).toBeLessThanOrEqual(366);  // allow leap year
    }
  });

  test('randomDatePast returns a past date within 5 years', () => {
    for (let i = 0; i < 5; i++) {
      const s = randomDatePast();
      const d = new Date(s);
      expect(d.toString()).toBe(s);
      expect(d.getTime()).toBeLessThan(Date.now());
      const diffDays = (Date.now() - d.getTime()) / (24 * 60 * 60 * 1000);
      expect(diffDays).toBeLessThanOrEqual(365 * 5 + 2);  // small cushion
    }
  });

  test('randomWeekday returns a valid weekday', () => {
    const set = new Set([
      'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday',
      'Saturday'
    ]);
    for (let i = 0; i < 10; i++) {
      expect(set.has(randomWeekday())).toBe(true);
    }
  });

  test('randomMonth returns a valid month', () => {
    const set = new Set([
      'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
      'September', 'October', 'November', 'December'
    ]);
    for (let i = 0; i < 12; i++) {
      expect(set.has(randomMonth())).toBe(true);
    }
  });
});

describe('Random epoch generators', () => {
  test('randomEpoch lies between 2000 and 2035 (seconds)', () => {
    const minSec = Math.floor(Date.UTC(2000, 0, 1, 0, 0, 0, 0) / 1000);
    const maxSec = Math.floor(Date.UTC(2035, 11, 31, 23, 59, 59, 999) / 1000);
    for (let i = 0; i < 5; i++) {
      const s = randomEpoch();
      expect(Number.isInteger(s)).toBe(true);
      expect(s).toBeGreaterThanOrEqual(minSec);
      expect(s).toBeLessThanOrEqual(maxSec);
    }
  });

  test('randomEpochMs lies between 2000 and 2035 (milliseconds)', () => {
    const minMs = Date.UTC(2000, 0, 1, 0, 0, 0, 0);
    const maxMs = Date.UTC(2035, 11, 31, 23, 59, 59, 999);
    for (let i = 0; i < 5; i++) {
      const ms = randomEpochMs();
      expect(typeof ms).toBe('number');
      expect(ms).toBeGreaterThanOrEqual(minMs);
      expect(ms).toBeLessThanOrEqual(maxMs);
    }
  });

  test('randomEpochFuture/_ms are in the future (within ~1 year)', () => {
    for (let i = 0; i < 5; i++) {
      const nowMs = Date.now();
      const s = randomEpochFuture();
      const ms = randomEpochFutureMs();
      expect(s * 1000).toBeGreaterThan(nowMs - 2000);  // small cushion
      expect(ms).toBeGreaterThan(nowMs - 2000);
      const diffDaysS = (s * 1000 - nowMs) / (24 * 60 * 60 * 1000);
      const diffDaysMs = (ms - nowMs) / (24 * 60 * 60 * 1000);
      expect(diffDaysS).toBeLessThanOrEqual(366);
      expect(diffDaysMs).toBeLessThanOrEqual(366);
    }
  });

  test('randomEpochPast/_ms are in the past (within ~5 years)', () => {
    for (let i = 0; i < 5; i++) {
      const nowMs = Date.now();
      const s = randomEpochPast();
      const ms = randomEpochPastMs();
      expect(s * 1000).toBeLessThan(nowMs + 2000);
      expect(ms).toBeLessThan(nowMs + 2000);
      const diffDaysS = (nowMs - s * 1000) / (24 * 60 * 60 * 1000);
      const diffDaysMs = (nowMs - ms) / (24 * 60 * 60 * 1000);
      expect(diffDaysS).toBeLessThanOrEqual(365 * 5 + 2);
      expect(diffDaysMs).toBeLessThanOrEqual(365 * 5 + 2);
    }
  });

});

describe('Random name generators', () => {
  const FIRST = new Set(FIRST_NAMES);
  const LAST = new Set(LAST_NAMES);

  test('randomFirstName returns a known first name', () => {
    for (let i = 0; i < 10; i++) {
      const n = randomFirstName();
      expect(typeof n).toBe('string');
      expect(FIRST.has(n)).toBe(true);
    }
  });

  test('randomLastName returns a known last name', () => {
    for (let i = 0; i < 10; i++) {
      const n = randomLastName();
      expect(typeof n).toBe('string');
      expect(LAST.has(n)).toBe(true);
    }
  });

  test('randomFullName returns "first last"', () => {
    for (let i = 0; i < 10; i++) {
      const n = randomFullName();
      expect(typeof n).toBe('string');
      const [f, l] = n.split(' ');
      expect(FIRST.has(f)).toBe(true);
      expect(LAST.has(l)).toBe(true);
    }
  });
});

describe('Random API data generators', () => {
  test('every registered token generator returns a value', () => {
    for (const [name, generator] of Object.entries(Random.RANDOM_TOKEN_MAP)) {
      expect(generator()).not.toBeUndefined();
      expect(Random.randomValueForToken(name)).not.toBeUndefined();
    }
  });

  test('does not expose deprecated recent token aliases', () => {
    expect(Random.RANDOM_TOKEN_MAP.date_recent).toBeUndefined();
    expect(Random.RANDOM_TOKEN_MAP.epoch_recent).toBeUndefined();
    expect(Random.RANDOM_TOKEN_MAP.epoch_recent_ms).toBeUndefined();
  });

  test('supports parameterized integer, float, and string generators', () => {
    for (let index = 0; index < 20; index++) {
      const integer = Random.randomValueForToken('int(10,20)');
      const float = Random.randomValueForToken('float(-1.5,2.5)');
      expect(integer).toBeGreaterThanOrEqual(10);
      expect(integer).toBeLessThanOrEqual(20);
      expect(float).toBeGreaterThanOrEqual(-1.5);
      expect(float).toBeLessThanOrEqual(2.5);
    }
    expect(Random.randomValueForToken('string(12)')).toMatch(/^[A-Za-z]{12}$/);
    expect(Random.randomValueForToken('alphanumeric(14)'))
        .toMatch(/^[A-Za-z0-9]{14}$/);
    expect(Random.randomValueForToken('password(18)')).toHaveLength(18);
  });

  test('supports absolute epoch and datetime ranges', () => {
    expect(Random.randomValueForToken(
        'epoch(1700000000,1700000000)')).toBe(1700000000);
    expect(Random.randomValueForToken(
        'epoch_ms(1700000000000,1700000000000)')).toBe(1700000000000);
    expect(Random.randomValueForToken(
        'datetime(2026-01-02,2026-01-02)'))
        .toBe('2026-01-02T00:00:00');
    expect(Random.randomValueForToken(
        'utc_datetime(2026-01-02T00:00:00Z,2026-01-02T00:00:00Z)'))
        .toBe('2026-01-02T00:00:00Z');
  });

  test('supports formatted temporal tokens and duration-based future/past', () => {
    jest.useFakeTimers();
    try {
      const now = new Date('2026-09-17T12:00:00.000Z').getTime();
      jest.setSystemTime(now);
      expect(Random.randomValueForToken('time')).toMatch(/^\d{2}:\d{2}:\d{2}$/);
      expect(Random.randomValueForToken('utc_time')).toMatch(/^\d{2}:\d{2}:\d{2}$/);
      expect(Random.randomValueForToken('date')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Random.randomValueForToken('utc_date')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Random.randomValueForToken('utc_datetime_future(2d,2d)'))
          .toBe('2026-09-19T12:00:00Z');
      expect(Random.randomValueForToken('utc_datetime_past(1d,1d)'))
          .toBe('2026-09-16T12:00:00Z');
      expect(Random.randomValueForToken('utc_time_future(1h,1h)'))
          .toBe('13:00:00');
      expect(Random.randomValueForToken('utc_date_future(7,7)'))
          .toBe('2026-09-24');
      expect(Random.randomValueForToken('epoch_future(2,2)'))
          .toBe(Math.floor((now + 2 * 86400000) / 1000));
      expect(Random.randomValueForToken('epoch_past(2d,2d4h)'))
          .toBeGreaterThanOrEqual(
              Math.floor((now - (2 * 86400000 + 4 * 3600000)) / 1000));
      expect(Random.randomValueForToken('epoch_past(2d,2d4h)'))
          .toBeLessThanOrEqual(Math.floor((now - 2 * 86400000) / 1000));
    } finally {
      jest.useRealTimers();
    }
  });

  test('supports past/future day ranges and ranges around now', () => {
    jest.useFakeTimers();
    try {
      const now = new Date('2026-09-17T12:00:00.000Z').getTime();
      jest.setSystemTime(now);
      const future = new Date(
          Random.randomValueForToken('date_future(2,2)')).getTime();
      const past = new Date(
          Random.randomValueForToken('date_past(2,2)')).getTime();
      expect(future).toBeGreaterThanOrEqual(now + 2 * 86400000);
      expect(future).toBeLessThan(now + 3 * 86400000);
      expect(past).toBeLessThanOrEqual(now - 2 * 86400000);
      expect(past).toBeGreaterThan(now - 3 * 86400000);

      const around = new Date(
          Random.randomValueForToken('datetime_now(1h1m)')).getTime();
      const utcAround = new Date(
          Random.randomValueForToken('utc_datetime_now(1h1m)')).getTime();
      expect(around).toBeGreaterThanOrEqual(now - 3660000);
      expect(around).toBeLessThanOrEqual(now + 3660000);
      expect(utcAround).toBeGreaterThanOrEqual(now - 3660000);
      expect(utcAround).toBeLessThanOrEqual(now + 3660000);
      expect(Random.randomValueForToken('utc_datetime_now(1h1m)'))
          .toMatch(/Z$/);
      const epochAround =
          Random.randomValueForToken('epoch_now(1h1m)') * 1000;
      const epochMsAround =
          Random.randomValueForToken('epoch_now_ms(1h1m)');
      expect(epochAround).toBeGreaterThanOrEqual(now - 3661000);
      expect(epochAround).toBeLessThanOrEqual(now + 3661000);
      expect(epochMsAround).toBeGreaterThanOrEqual(now - 3660000);
      expect(epochMsAround).toBeLessThanOrEqual(now + 3660000);

      const randomSpy = jest.spyOn(Math, 'random');
      try {
        randomSpy.mockReturnValue(0);
        expect(new Date(
            Random.randomValueForToken('datetime_now(2h,1d)')).getTime())
            .toBe(now - 2 * 3600000);
        randomSpy.mockReturnValue(0.999999999);
        expect(new Date(
            Random.randomValueForToken('datetime_now(2h,1d)')).getTime())
            .toBe(now + 86400000);

        randomSpy.mockReturnValue(0);
        expect(new Date(
            Random.randomValueForToken('utc_datetime_now(0s,30m)')).getTime())
            .toBe(now);
        randomSpy.mockReturnValue(0.999999999);
        expect(new Date(
            Random.randomValueForToken('utc_datetime_now(0s,30m)')).getTime())
            .toBe(now + 30 * 60 * 1000);

        randomSpy.mockReturnValue(0);
        expect(Random.randomValueForToken('epoch_now(1h,2h)') * 1000)
            .toBe(now - 3600000);
        randomSpy.mockReturnValue(0.999999999);
        expect(Random.randomValueForToken('epoch_now_ms(1h,2h)'))
            .toBe(now + 2 * 3600000);
      } finally {
        randomSpy.mockRestore();
      }
    } finally {
      jest.useRealTimers();
    }
  });

  test('rejects invalid or unsupported parameter lists', () => {
    expect(Random.randomValueForToken('uuid(2)')).toBeUndefined();
    expect(Random.randomValueForToken('int(1.5,2)')).toBeUndefined();
    expect(Random.randomValueForToken('string(-1)')).toBeUndefined();
    expect(Random.randomValueForToken('string(10001)')).toBeUndefined();
    expect(Random.randomValueForToken('int(nope)')).toBeUndefined();
    expect(Random.randomValueForToken(
        'datetime(not-a-date,2026-01-01)')).toBeUndefined();
    expect(Random.randomValueForToken(
        'datetime_now(tomorrow)')).toBeUndefined();
  });

  test('generates network, identity, business, address, and text values', () => {
    expect(Random.randomUsername()).toMatch(/^[a-z]+\.[a-z]+\d+$/);
    expect(Random.randomDomain()).toMatch(/^[^.\s]+\.[^.\s]+$/);
    expect(Random.randomHostname()).toMatch(/^api-[a-z0-9]+\./);
    expect(Random.randomUrl()).toMatch(/^https:\/\//);
    expect(Random.randomMac()).toMatch(/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/);
    expect(Random.randomUserAgent().length).toBeGreaterThan(0);
    expect(Random.randomCompany().length).toBeGreaterThan(0);
    expect(Random.randomJobTitle().length).toBeGreaterThan(0);
    expect(Random.randomPostalCode()).toMatch(/^\d{5}$/);
    expect(Random.randomStreetAddress()).toMatch(/^\d+ .+ Street$/);
    expect(Random.randomDateTime()).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
    expect(Random.randomUtcDateTime()).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    expect(Random.randomWord().length).toBeGreaterThan(0);
    expect(Random.randomSentence()).toMatch(/^[A-Z].+\.$/);
    expect(Random.randomParagraph().split('. ').length)
        .toBeGreaterThanOrEqual(3);
  });
});
