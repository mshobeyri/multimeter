import {COLOR_PALETTE, FIRST_NAMES, LAST_NAMES, CITY_LIST, COUNTRY_LIST, EMAIL_DOMAINS, WEEKDAYS, MONTHS} from './RandomResources';

// Internal helper to get random int in range [min, max]
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Returns a random ISO timestamp string (UTC) between the provided years.
 * Defaults span: 2000-2035.
 * @param startYear inclusive lower bound year
 * @param endYear inclusive upper bound year
 */
export function randomISODate(startYear = 2000, endYear = 2035): string {
  if (endYear < startYear) {
    [startYear, endYear] = [endYear, startYear];
  }
  const year = randInt(startYear, endYear);
  const month = randInt(0, 11);  // JS Date month 0-11
  const day = randInt(1, 28);  // keep in 1-28 to avoid month length edge cases
  const hour = randInt(0, 23);
  const minute = randInt(0, 59);
  const second = randInt(0, 59);
  const ms = randInt(0, 999);
  const date = new Date(Date.UTC(year, month, day, hour, minute, second, ms));
  return date.toISOString();
}

/** Simple UUID v4 generator (not cryptographically strong). */
export function randomUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/** Random boolean */
export function randomBoolean(): boolean {
  return Math.random() < 0.5;
}

/** Random integer between 0 and max (default 1000). */
export function randomInt(max = 1000): number {
  return randInt(0, max);
}

/** Random CSS color name from a curated palette. */
export function randomColor(): string {
  return COLOR_PALETTE[randInt(0, COLOR_PALETTE.length - 1)];
}

/** Random 6-digit hex color string like #1a2b3c. */
export function randomHexColor(): string {
  const n = randInt(0, 0xffffff);
  return '#' + n.toString(16).padStart(6, '0');
}

/** Random first name. */
export function randomFirstName(): string {
  return FIRST_NAMES[randInt(0, FIRST_NAMES.length - 1)];
}

/** Random last (family) name. */
export function randomLastName(): string {
  return LAST_NAMES[randInt(0, LAST_NAMES.length - 1)];
}

/** Random full name as "<first> <last>". */
export function randomFullName(): string {
  return `${randomFirstName()} ${randomLastName()}`;
}

/** Random IPv4 address like 203.0.113.42 */
export function randomIP(): string {
  const octet = () => randInt(0, 255);
  return `${octet()}.${octet()}.${octet()}.${octet()}`;
}

/** Random IPv6 address in full form (8 groups of 4 hex digits). */
export function randomIPv6(): string {
  const group = () => randInt(0, 0xffff).toString(16).padStart(4, '0');
  return `${group()}:${group()}:${group()}:${group()}:${group()}:${group()}:${group()}:${group()}`;
}

/** Random city name from a curated list. */
export function randomCity(): string {
  return CITY_LIST[randInt(0, CITY_LIST.length - 1)];
}

/** Random country name from a curated list. */
export function randomCountry(): string {
  return COUNTRY_LIST[randInt(0, COUNTRY_LIST.length - 1)];
}

/** Random phone number in E.164 format like +14155550123 (8-15 digits total after +). */
export function randomPhoneNumber(): string {
  const countryCodes = [1, 44, 49, 33, 34, 39, 61, 64, 81, 82, 86, 91, 351, 352, 353, 354, 358];
  const cc = countryCodes[randInt(0, countryCodes.length - 1)].toString();
  const remainingLen = randInt(Math.max(8 - cc.length, 6), Math.max(15 - cc.length, 7));
  let digits = '';
  for (let i = 0; i < remainingLen; i++) {
    digits += randInt(0, 9).toString();
  }
  return `+${cc}${digits}`;
}

/** Random email address like john.doe42@example.com */
export function randomEmail(): string {
  const first = randomFirstName().toLowerCase().replace(/[^a-z0-9]/g, '');
  const last = randomLastName().toLowerCase().replace(/[^a-z0-9]/g, '');
  const sep = Math.random() < 0.5 ? '.' : '';
  const maybeNum = Math.random() < 0.4 ? randInt(0, 9999).toString() : '';
  const domain = EMAIL_DOMAINS[randInt(0, EMAIL_DOMAINS.length - 1)];
  return `${first}${sep}${last}${maybeNum}@${domain}`;
}

/** Random latitude in range [-90, 90], with up to 6 decimals. */
export function randomLatitude(): number {
  const v = Math.random() * 180 - 90; // -90..90
  return Math.round(v * 1e6) / 1e6;
}

/** Random longitude in range [-180, 180], with up to 6 decimals. */
export function randomLongitude(): number {
  const v = Math.random() * 360 - 180; // -180..180
  return Math.round(v * 1e6) / 1e6;
}

/** Random future date string within [minDaysAhead, maxDaysAhead] (defaults 1..365). */
export function randomDateFuture(minDaysAhead = 1, maxDaysAhead = 365): string {
  if (maxDaysAhead < minDaysAhead) {
    [minDaysAhead, maxDaysAhead] = [maxDaysAhead, minDaysAhead];
  }
  const days = randInt(minDaysAhead, maxDaysAhead);
  const msOffset = days * 24 * 60 * 60 * 1000 + randInt(0, 24*60*60*1000 - 1);
  return new Date(Date.now() + msOffset).toString();
}

/** Random past date string within [minDaysBack, maxDaysBack] (defaults 1..(365*5)). */
export function randomDatePast(minDaysBack = 1, maxDaysBack = 365 * 5): string {
  if (maxDaysBack < minDaysBack) {
    [minDaysBack, maxDaysBack] = [maxDaysBack, minDaysBack];
  }
  const days = randInt(minDaysBack, maxDaysBack);
  const msOffset = days * 24 * 60 * 60 * 1000 + randInt(0, 24*60*60*1000 - 1);
  return new Date(Date.now() - msOffset).toString();
}

/** Random recent date string within the last N days (default 30). */
export function randomDateRecent(maxDaysBack = 30): string {
  const days = randInt(0, Math.max(0, maxDaysBack));
  const msOffset = days * 24 * 60 * 60 * 1000 + randInt(0, 24*60*60*1000 - 1);
  return new Date(Date.now() - msOffset).toString();
}

/** Random weekday name. */
export function randomWeekday(): string {
  return WEEKDAYS[randInt(0, WEEKDAYS.length - 1)];
}

/** Random month name. */
export function randomMonth(): string {
  return MONTHS[randInt(0, MONTHS.length - 1)];
}
