import { randomColor, randomHexColor, randomFirstName, randomLastName, randomFullName, randomIP, randomIPv6, randomCity, randomCountry, randomPhoneNumber, randomEmail, randomLatitude, randomLongitude, randomDateFuture, randomDatePast, randomDateRecent, randomWeekday, randomMonth } from './Random';
import { FIRST_NAMES, LAST_NAMES } from './RandomResources';

describe('Random color generators', () => {
  const PALETTE = new Set([
    'red','orange','yellow','green','blue','indigo','violet','pink','purple','brown','black','white',
    'gray','grey','cyan','magenta','lime','maroon','navy','olive','teal','silver','gold','beige',
    'coral','fuchsia','turquoise','salmon','plum','orchid','khaki','crimson','azure','lavender',
    'tan','aqua','aquamarine','chocolate','ivory','mint','peachpuff'
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
      expect(/^[a-z0-9]+\.?[a-z0-9]*\d*@[^@\s]+\.[^@\s]+$/.test(email)).toBe(true);
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
      const diffDays = (d.getTime() - Date.now()) / (24*60*60*1000);
      expect(diffDays).toBeLessThanOrEqual(366); // allow leap year
    }
  });

  test('randomDatePast returns a past date within 5 years', () => {
    for (let i = 0; i < 5; i++) {
      const s = randomDatePast();
      const d = new Date(s);
      expect(d.toString()).toBe(s);
      expect(d.getTime()).toBeLessThan(Date.now());
      const diffDays = (Date.now() - d.getTime()) / (24*60*60*1000);
      expect(diffDays).toBeLessThanOrEqual(365*5 + 2); // small cushion
    }
  });

  test('randomDateRecent returns a date not more than 30 days back', () => {
    for (let i = 0; i < 5; i++) {
      const s = randomDateRecent();
      const d = new Date(s);
      expect(d.toString()).toBe(s);
      const diffDays = (Date.now() - d.getTime()) / (24*60*60*1000);
      expect(diffDays).toBeGreaterThanOrEqual(0);
      expect(diffDays).toBeLessThanOrEqual(31); // cushion
    }
  });

  test('randomWeekday returns a valid weekday', () => {
    const set = new Set(['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']);
    for (let i = 0; i < 10; i++) {
      expect(set.has(randomWeekday())).toBe(true);
    }
  });

  test('randomMonth returns a valid month', () => {
    const set = new Set(['January','February','March','April','May','June','July','August','September','October','November','December']);
    for (let i = 0; i < 12; i++) {
      expect(set.has(randomMonth())).toBe(true);
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
