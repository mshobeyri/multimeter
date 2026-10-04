import {CITY_LIST, COLOR_PALETTE, COUNTRY_LIST, EMAIL_DOMAINS, FIRST_NAMES, LAST_NAMES, MONTHS, WEEKDAYS} from './RandomResources';
import {parseRelativeAmountMs, resolveRelativeWindow, unsignedDurationMs} from './durationParse';

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

/** Random integer between 0 and max, or between explicit min and max. */
export function randomInt(minOrMax = 1000, max?: number): number {
  let min = max === undefined ? 0 : minOrMax;
  let upper = max === undefined ? minOrMax : max;
  min = Math.ceil(min);
  upper = Math.floor(upper);
  if (upper < min) {
    [min, upper] = [upper, min];
  }
  return randInt(min, upper);
}

/** Random floating-point number between 0 and max, or explicit min and max. */
export function randomFloat(minOrMax = 1000, max?: number): number {
  let min = max === undefined ? 0 : minOrMax;
  let upper = max === undefined ? minOrMax : max;
  if (upper < min) {
    [min, upper] = [upper, min];
  }
  return min + Math.random() * (upper - min);
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
  return `${group()}:${group()}:${group()}:${group()}:${group()}:${group()}:${
      group()}:${group()}`;
}

/** Random city name from a curated list. */
export function randomCity(): string {
  return CITY_LIST[randInt(0, CITY_LIST.length - 1)];
}

/** Random country name from a curated list. */
export function randomCountry(): string {
  return COUNTRY_LIST[randInt(0, COUNTRY_LIST.length - 1)];
}

/**
 * Random phone number in E.164 format like +14155550123 (8-15 digits total
 * after +).
 */
export function randomPhoneNumber(): string {
  const countryCodes =
      [1, 44, 49, 33, 34, 39, 61, 64, 81, 82, 86, 91, 351, 352, 353, 354, 358];
  const cc = countryCodes[randInt(0, countryCodes.length - 1)].toString();
  const remainingLen =
      randInt(Math.max(8 - cc.length, 6), Math.max(15 - cc.length, 7));
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

const ALPHA = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const ALPHANUMERIC = `${ALPHA}0123456789`;
const PASSWORD_CHARS = `${ALPHANUMERIC}!@#$%^&*_-+=`;
const LOREM_WORDS = [
  'api', 'client', 'cloud', 'data', 'event', 'field', 'gateway', 'input',
  'message', 'network', 'object', 'request', 'response', 'service', 'token',
  'value', 'workflow',
];
const JOB_TITLES = [
  'Backend Engineer', 'Cloud Architect', 'DevOps Engineer',
  'Engineering Manager', 'Integration Engineer', 'Product Manager',
  'QA Engineer', 'Security Engineer', 'Software Engineer',
];
const COMPANY_SUFFIXES = [
  'Labs', 'Systems', 'Technologies', 'Software', 'Solutions', 'Works',
];
const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
  'curl/8.7.1',
  'testlight/1.0',
];

function randomChars(characters: string, length: number): string {
  let value = '';
  for (let index = 0; index < length; index++) {
    value += characters[randInt(0, characters.length - 1)];
  }
  return value;
}

/** Random alphabetic string. */
export function randomString(length = 16): string {
  return randomChars(ALPHA, length);
}

/** Random alpha-numeric string. */
export function randomAlphanumeric(length = 16): string {
  return randomChars(ALPHANUMERIC, length);
}

export function randomUsername(): string {
  return `${randomFirstName().toLowerCase()}.${randomLastName().toLowerCase()}${
      randInt(1, 9999)}`;
}

export function randomPassword(length = 16): string {
  return randomChars(PASSWORD_CHARS, length);
}

export function randomDomain(): string {
  return EMAIL_DOMAINS[randInt(0, EMAIL_DOMAINS.length - 1)];
}

export function randomHostname(): string {
  return `api-${randomAlphanumeric(8).toLowerCase()}.${randomDomain()}`;
}

export function randomUrl(): string {
  return `https://${randomHostname()}/${randomAlphanumeric(10)}`;
}

export function randomMac(): string {
  return Array.from(
      {length: 6},
      () => randInt(0, 255).toString(16).padStart(2, '0')).join(':');
}

export function randomUserAgent(): string {
  return USER_AGENTS[randInt(0, USER_AGENTS.length - 1)];
}

export function randomCompany(): string {
  return `${randomLastName()} ${
      COMPANY_SUFFIXES[randInt(0, COMPANY_SUFFIXES.length - 1)]}`;
}

export function randomJobTitle(): string {
  return JOB_TITLES[randInt(0, JOB_TITLES.length - 1)];
}

export function randomPostalCode(): string {
  return randInt(10000, 99999).toString();
}

export function randomStreetAddress(): string {
  return `${randInt(1, 9999)} ${randomLastName()} Street`;
}

function randomTimestampBetween(startMs: number, endMs: number): number {
  let min = Math.floor(startMs);
  let max = Math.floor(endMs);
  if (max < min) {
    [min, max] = [max, min];
  }
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}

function localDateTime(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${
      pad2(date.getDate())}T${pad2(date.getHours())}:${
      pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

function utcDateTime(date: Date): string {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${
      pad2(date.getUTCDate())}T${pad2(date.getUTCHours())}:${
      pad2(date.getUTCMinutes())}:${pad2(date.getUTCSeconds())}Z`;
}

function parseLocalDateTime(value: string): number {
  const match =
      /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/
          .exec(value);
  if (!match) {
    return Date.parse(value);
  }
  return new Date(
      Number(match[1]), Number(match[2]) - 1, Number(match[3]),
      Number(match[4] || 0), Number(match[5] || 0),
      Number(match[6] || 0)).getTime();
}

function localDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${
      pad2(date.getDate())}`;
}

function utcDate(date: Date): string {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${
      pad2(date.getUTCDate())}`;
}

function localTime(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${
      pad2(date.getSeconds())}`;
}

function utcTime(date: Date): string {
  return `${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}:${
      pad2(date.getUTCSeconds())}`;
}

function randomFormattedBetween(
    startMs: number, endMs: number,
    formatter: (date: Date) => string): string {
  return formatter(new Date(randomTimestampBetween(startMs, endMs)));
}

function randomRelativeFormatted(
    direction: 'future'|'past',
    formatter: (date: Date) => string,
    minArg?: string, maxArg?: string,
    defaults?: {minMs: number, maxMs: number}): string {
  const {startMs, endMs} =
      resolveRelativeWindow(minArg, maxArg, direction, defaults);
  return randomFormattedBetween(startMs, endMs, formatter);
}

export function randomTime(start?: string, end?: string): string {
  if (start !== undefined || end !== undefined) {
    const startMs = parseLocalDateTime(String(start || ''));
    const endMs = parseLocalDateTime(String(end || start || ''));
    if (Number.isFinite(startMs) && Number.isFinite(endMs)) {
      return localTime(new Date(randomTimestampBetween(startMs, endMs)));
    }
  }
  return localTime(new Date(randomISODate()));
}

export function randomUtcTime(start?: string, end?: string): string {
  if (start !== undefined || end !== undefined) {
    const startMs = Date.parse(String(start || ''));
    const endMs = Date.parse(String(end || start || ''));
    if (Number.isFinite(startMs) && Number.isFinite(endMs)) {
      return utcTime(new Date(randomTimestampBetween(startMs, endMs)));
    }
  }
  return utcTime(new Date(randomISODate()));
}

export function randomDate(start?: string, end?: string): string {
  if (start !== undefined || end !== undefined) {
    const startMs = parseLocalDateTime(String(start || ''));
    const endMs = parseLocalDateTime(String(end || start || ''));
    if (Number.isFinite(startMs) && Number.isFinite(endMs)) {
      return localDate(new Date(randomTimestampBetween(startMs, endMs)));
    }
  }
  return localDate(new Date(randomISODate()));
}

export function randomUtcDate(start?: string, end?: string): string {
  if (start !== undefined || end !== undefined) {
    const startMs = Date.parse(String(start || ''));
    const endMs = Date.parse(String(end || start || ''));
    if (Number.isFinite(startMs) && Number.isFinite(endMs)) {
      return utcDate(new Date(randomTimestampBetween(startMs, endMs)));
    }
  }
  return utcDate(new Date(randomISODate()));
}

export function randomDateTime(start?: string, end?: string): string {
  if (start !== undefined || end !== undefined) {
    const startMs = parseLocalDateTime(String(start || ''));
    const endMs = parseLocalDateTime(String(end || start || ''));
    if (Number.isFinite(startMs) && Number.isFinite(endMs)) {
      return localDateTime(
          new Date(randomTimestampBetween(startMs, endMs)));
    }
  }
  return localDateTime(new Date(randomISODate()));
}

export function randomUtcDateTime(start?: string, end?: string): string {
  if (start !== undefined || end !== undefined) {
    const startMs = Date.parse(String(start || ''));
    const endMs = Date.parse(String(end || start || ''));
    if (Number.isFinite(startMs) && Number.isFinite(endMs)) {
      return utcDateTime(
          new Date(randomTimestampBetween(startMs, endMs)));
    }
  }
  return utcDateTime(new Date(randomISODate()));
}

function resolveNowWindow(
    back?: string, forward?: string): {startMs: number, endMs: number} {
  const now = Date.now();
  if (forward === undefined) {
    const offset = unsignedDurationMs(back ?? '1h') ?? 60 * 60 * 1000;
    return {startMs: now - offset, endMs: now + offset};
  }
  const backMs = unsignedDurationMs(String(back ?? '0s') ?? '') ?? 0;
  const forwardMs = unsignedDurationMs(forward);
  if (forwardMs === undefined) {
    return {startMs: now, endMs: now};
  }
  return {startMs: now - backMs, endMs: now + forwardMs};
}

export function randomDateTimeNow(back = '1h', forward?: string): string {
  const {startMs, endMs} = resolveNowWindow(back, forward);
  return localDateTime(new Date(randomTimestampBetween(startMs, endMs)));
}

export function randomUtcDateTimeNow(back = '1h', forward?: string): string {
  const {startMs, endMs} = resolveNowWindow(back, forward);
  return utcDateTime(new Date(randomTimestampBetween(startMs, endMs)));
}

export function randomEpochNow(back = '1h', forward?: string): number {
  const {startMs, endMs} = resolveNowWindow(back, forward);
  return Math.floor(randomTimestampBetween(startMs, endMs) / 1000);
}

export function randomEpochNowMs(back = '1h', forward?: string): number {
  const {startMs, endMs} = resolveNowWindow(back, forward);
  return randomTimestampBetween(startMs, endMs);
}

export function randomWord(): string {
  return LOREM_WORDS[randInt(0, LOREM_WORDS.length - 1)];
}

export function randomSentence(): string {
  const words = Array.from({length: randInt(6, 12)}, randomWord);
  const text = words.join(' ');
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}

export function randomParagraph(): string {
  return Array.from({length: randInt(3, 6)}, randomSentence).join(' ');
}

/** Random latitude in range [-90, 90], with up to 6 decimals. */
export function randomLatitude(): number {
  const v = Math.random() * 180 - 90;  // -90..90
  return Math.round(v * 1e6) / 1e6;
}

/** Random longitude in range [-180, 180], with up to 6 decimals. */
export function randomLongitude(): number {
  const v = Math.random() * 360 - 180;  // -180..180
  return Math.round(v * 1e6) / 1e6;
}

/**
 * Random future date string within a relative window.
 * Accepts day counts or combined durations such as `2d4h`.
 */
export function randomDateFuture(minArg?: string, maxArg?: string): string {
  const {startMs, endMs} = resolveRelativeWindow(minArg, maxArg, 'future');
  return new Date(randomTimestampBetween(startMs, endMs)).toString();
}

/**
 * Random past date string within a relative window.
 * Accepts day counts or combined durations such as `2d4h`.
 */
export function randomDatePast(minArg?: string, maxArg?: string): string {
  const {startMs, endMs} = resolveRelativeWindow(minArg, maxArg, 'past', {
    minMs: 24 * 60 * 60 * 1000,
    maxMs: 365 * 5 * 24 * 60 * 60 * 1000,
  });
  return new Date(randomTimestampBetween(startMs, endMs)).toString();
}

export function randomDateTimeFuture(minArg?: string, maxArg?: string): string {
  return randomRelativeFormatted('future', localDateTime, minArg, maxArg);
}

export function randomDateTimePast(minArg?: string, maxArg?: string): string {
  return randomRelativeFormatted('past', localDateTime, minArg, maxArg, {
    minMs: 24 * 60 * 60 * 1000,
    maxMs: 365 * 5 * 24 * 60 * 60 * 1000,
  });
}

export function randomUtcDateTimeFuture(
    minArg?: string, maxArg?: string): string {
  return randomRelativeFormatted('future', utcDateTime, minArg, maxArg);
}

export function randomUtcDateTimePast(minArg?: string, maxArg?: string): string {
  return randomRelativeFormatted('past', utcDateTime, minArg, maxArg, {
    minMs: 24 * 60 * 60 * 1000,
    maxMs: 365 * 5 * 24 * 60 * 60 * 1000,
  });
}

export function randomTimeFuture(minArg?: string, maxArg?: string): string {
  return randomRelativeFormatted('future', localTime, minArg, maxArg);
}

export function randomTimePast(minArg?: string, maxArg?: string): string {
  return randomRelativeFormatted('past', localTime, minArg, maxArg, {
    minMs: 24 * 60 * 60 * 1000,
    maxMs: 365 * 5 * 24 * 60 * 60 * 1000,
  });
}

export function randomUtcTimeFuture(minArg?: string, maxArg?: string): string {
  return randomRelativeFormatted('future', utcTime, minArg, maxArg);
}

export function randomUtcTimePast(minArg?: string, maxArg?: string): string {
  return randomRelativeFormatted('past', utcTime, minArg, maxArg, {
    minMs: 24 * 60 * 60 * 1000,
    maxMs: 365 * 5 * 24 * 60 * 60 * 1000,
  });
}

export function randomUtcDateFuture(minArg?: string, maxArg?: string): string {
  return randomRelativeFormatted('future', utcDate, minArg, maxArg);
}

export function randomUtcDatePast(minArg?: string, maxArg?: string): string {
  return randomRelativeFormatted('past', utcDate, minArg, maxArg, {
    minMs: 24 * 60 * 60 * 1000,
    maxMs: 365 * 5 * 24 * 60 * 60 * 1000,
  });
}

/** Random weekday name. */
export function randomWeekday(): string {
  return WEEKDAYS[randInt(0, WEEKDAYS.length - 1)];
}

/** Random month name. */
export function randomMonth(): string {
  return MONTHS[randInt(0, MONTHS.length - 1)];
}

export function randomEpoch(minEpoch?: number, maxEpoch?: number): number {
  if (minEpoch !== undefined || maxEpoch !== undefined) {
    return randomInt(
        Math.floor(minEpoch ?? 0),
        Math.floor(maxEpoch ?? minEpoch ?? 0));
  }
  const year = randInt(2000, 2035);
  const month = randInt(0, 11);
  const day = randInt(1, 28);
  const hour = randInt(0, 23);
  const minute = randInt(0, 59);
  const second = randInt(0, 59);
  const d = Date.UTC(year, month, day, hour, minute, second, 0);
  return Math.floor(d / 1000);
}

export function randomEpochMs(
    minEpochMs?: number, maxEpochMs?: number): number {
  if (minEpochMs !== undefined || maxEpochMs !== undefined) {
    return randomInt(
        Math.floor(minEpochMs ?? 0),
        Math.floor(maxEpochMs ?? minEpochMs ?? 0));
  }
  const year = randInt(2000, 2035);
  const month = randInt(0, 11);
  const day = randInt(1, 28);
  const hour = randInt(0, 23);
  const minute = randInt(0, 59);
  const second = randInt(0, 59);
  const ms = randInt(0, 999);
  return Date.UTC(year, month, day, hour, minute, second, ms);
}

export function randomEpochFuture(minArg?: string, maxArg?: string): number {
  const {startMs, endMs} = resolveRelativeWindow(minArg, maxArg, 'future');
  return Math.floor(randomTimestampBetween(startMs, endMs) / 1000);
}

export function randomEpochFutureMs(minArg?: string, maxArg?: string): number {
  const {startMs, endMs} = resolveRelativeWindow(minArg, maxArg, 'future');
  return randomTimestampBetween(startMs, endMs);
}

export function randomEpochPast(minArg?: string, maxArg?: string): number {
  const {startMs, endMs} = resolveRelativeWindow(minArg, maxArg, 'past', {
    minMs: 24 * 60 * 60 * 1000,
    maxMs: 365 * 5 * 24 * 60 * 60 * 1000,
  });
  return Math.floor(randomTimestampBetween(startMs, endMs) / 1000);
}

export function randomEpochPastMs(minArg?: string, maxArg?: string): number {
  const {startMs, endMs} = resolveRelativeWindow(minArg, maxArg, 'past', {
    minMs: 24 * 60 * 60 * 1000,
    maxMs: 365 * 5 * 24 * 60 * 60 * 1000,
  });
  return randomTimestampBetween(startMs, endMs);
}

export type RandomTokenGenerator = (...args: any[]) => any;

export const RANDOM_TOKEN_MAP: Record<string, RandomTokenGenerator> = {
  email: randomEmail,
  ip: randomIP,
  ipv6: randomIPv6,
  city: randomCity,
  country: randomCountry,
  phone: randomPhoneNumber,
  phone_number: randomPhoneNumber,
  float: randomFloat,
  string: randomString,
  alphanumeric: randomAlphanumeric,
  username: randomUsername,
  password: randomPassword,
  url: randomUrl,
  domain: randomDomain,
  hostname: randomHostname,
  mac: randomMac,
  user_agent: randomUserAgent,
  company: randomCompany,
  job_title: randomJobTitle,
  postal_code: randomPostalCode,
  street_address: randomStreetAddress,
  time: randomTime,
  utc_time: randomUtcTime,
  date: randomDate,
  utc_date: randomUtcDate,
  datetime: randomDateTime,
  utc_datetime: randomUtcDateTime,
  datetime_now: randomDateTimeNow,
  utc_datetime_now: randomUtcDateTimeNow,
  datetime_future: randomDateTimeFuture,
  datetime_past: randomDateTimePast,
  utc_datetime_future: randomUtcDateTimeFuture,
  utc_datetime_past: randomUtcDateTimePast,
  time_future: randomTimeFuture,
  time_past: randomTimePast,
  utc_time_future: randomUtcTimeFuture,
  utc_time_past: randomUtcTimePast,
  utc_date_future: randomUtcDateFuture,
  utc_date_past: randomUtcDatePast,
  word: randomWord,
  sentence: randomSentence,
  paragraph: randomParagraph,
  latitude: randomLatitude,
  longitude: randomLongitude,
  date_future: randomDateFuture,
  date_past: randomDatePast,
  epoch: randomEpoch,
  epoch_ms: randomEpochMs,
  epoch_now: randomEpochNow,
  epoch_now_ms: randomEpochNowMs,
  epoch_future: randomEpochFuture,
  epoch_future_ms: randomEpochFutureMs,
  epoch_past: randomEpochPast,
  epoch_past_ms: randomEpochPastMs,
  weekday: randomWeekday,
  month: randomMonth,
  first_name: randomFirstName,
  last_name: randomLastName,
  full_name: randomFullName,
  color: randomColor,
  hex_color: randomHexColor,
  uuid: randomUUID,
  bool: randomBoolean,
  int: randomInt,
};

/** Resolved JS typeof for each random generator (JSON UI quoting / docs). */
export type TokenValueType = 'string'|'number'|'boolean';

const RANDOM_NON_STRING: Record<string, TokenValueType> = {
  int: 'number',
  float: 'number',
  bool: 'boolean',
  latitude: 'number',
  longitude: 'number',
  epoch: 'number',
  epoch_ms: 'number',
  epoch_now: 'number',
  epoch_now_ms: 'number',
  epoch_future: 'number',
  epoch_future_ms: 'number',
  epoch_past: 'number',
  epoch_past_ms: 'number',
};

/** Return type of `r:name` (args ignored). Unknown names → undefined. */
export function randomTokenValueType(name: string): TokenValueType|undefined {
  const key = String(name || '');
  if (!Object.prototype.hasOwnProperty.call(RANDOM_TOKEN_MAP, key)) {
    return undefined;
  }
  return RANDOM_NON_STRING[key] || 'string';
}

/** Every RANDOM_TOKEN_MAP key → value type (for tests / docs sync). */
export const RANDOM_TOKEN_VALUE_TYPES: Record<string, TokenValueType> =
    Object.fromEntries(
        Object.keys(RANDOM_TOKEN_MAP).map(
            (k) => [k, randomTokenValueType(k) as TokenValueType]),
    );

export interface RandomTokenParameterSpec {
  min: number;
  max: number;
  signature: string;
  snippet: string;
  description: string;
  kind: 'number'|'integer'|'length'|'datetime-range'|'duration'|
      'relative-duration';
}

export const RANDOM_TOKEN_PARAMETER_ARITY: Record<
    string, RandomTokenParameterSpec> = {
  int: {
    min: 1, max: 2, signature: 'max|min,max',
    snippet: '${1:0},${2:100}', description: 'inclusive integer range',
    kind: 'integer',
  },
  float: {
    min: 1, max: 2, signature: 'max|min,max',
    snippet: '${1:0},${2:100}', description: 'floating-point range',
    kind: 'number',
  },
  string: {
    min: 1, max: 1, signature: 'length',
    snippet: '${1:16}', description: 'requested string length',
    kind: 'length',
  },
  alphanumeric: {
    min: 1, max: 1, signature: 'length',
    snippet: '${1:16}', description: 'requested alpha-numeric length',
    kind: 'length',
  },
  password: {
    min: 1, max: 1, signature: 'length',
    snippet: '${1:16}', description: 'requested password length',
    kind: 'length',
  },
  epoch: {
    min: 2, max: 2, signature: 'from,to',
    snippet: '${1:1700000000},${2:1800000000}',
    description: 'Unix-second range', kind: 'integer',
  },
  epoch_ms: {
    min: 2, max: 2, signature: 'from,to',
    snippet: '${1:1700000000000},${2:1800000000000}',
    description: 'Unix-millisecond range', kind: 'integer',
  },
  time: {
    min: 2, max: 2, signature: 'from,to',
    snippet: '${1:2026-01-01T00:00:00},${2:2026-12-31T23:59:59}',
    description: 'absolute local date/time range', kind: 'datetime-range',
  },
  utc_time: {
    min: 2, max: 2, signature: 'from,to',
    snippet: '${1:2026-01-01T00:00:00Z},${2:2026-12-31T23:59:59Z}',
    description: 'absolute UTC date/time range', kind: 'datetime-range',
  },
  date: {
    min: 2, max: 2, signature: 'from,to',
    snippet: '${1:2026-01-01},${2:2026-12-31}',
    description: 'absolute local date range', kind: 'datetime-range',
  },
  utc_date: {
    min: 2, max: 2, signature: 'from,to',
    snippet: '${1:2026-01-01},${2:2026-12-31}',
    description: 'absolute UTC date range', kind: 'datetime-range',
  },
  date_future: {
    min: 1, max: 2, signature: 'max|min,max',
    snippet: '${1:1d}|${1:1d},${2:30d}',
    description: 'duration or day count ahead of now',
    kind: 'relative-duration',
  },
  date_past: {
    min: 1, max: 2, signature: 'max|min,max',
    snippet: '${1:1d}|${1:1d},${2:30d}',
    description: 'duration or day count before now',
    kind: 'relative-duration',
  },
  datetime_future: {
    min: 1, max: 2, signature: 'max|min,max',
    snippet: '${1:1d}|${1:1d},${2:30d}',
    description: 'local datetime ahead of now',
    kind: 'relative-duration',
  },
  datetime_past: {
    min: 1, max: 2, signature: 'max|min,max',
    snippet: '${1:1d}|${1:1d},${2:30d}',
    description: 'local datetime before now',
    kind: 'relative-duration',
  },
  utc_datetime_future: {
    min: 1, max: 2, signature: 'max|min,max',
    snippet: '${1:1d}|${1:1d},${2:30d}',
    description: 'UTC datetime ahead of now',
    kind: 'relative-duration',
  },
  utc_datetime_past: {
    min: 1, max: 2, signature: 'max|min,max',
    snippet: '${1:1d}|${1:1d},${2:30d}',
    description: 'UTC datetime before now',
    kind: 'relative-duration',
  },
  time_future: {
    min: 1, max: 2, signature: 'max|min,max',
    snippet: '${1:1d}|${1:1d},${2:30d}',
    description: 'local time ahead of now',
    kind: 'relative-duration',
  },
  time_past: {
    min: 1, max: 2, signature: 'max|min,max',
    snippet: '${1:1d}|${1:1d},${2:30d}',
    description: 'local time before now',
    kind: 'relative-duration',
  },
  utc_time_future: {
    min: 1, max: 2, signature: 'max|min,max',
    snippet: '${1:1d}|${1:1d},${2:30d}',
    description: 'UTC time ahead of now',
    kind: 'relative-duration',
  },
  utc_time_past: {
    min: 1, max: 2, signature: 'max|min,max',
    snippet: '${1:1d}|${1:1d},${2:30d}',
    description: 'UTC time before now',
    kind: 'relative-duration',
  },
  utc_date_future: {
    min: 1, max: 2, signature: 'max|min,max',
    snippet: '${1:1d}|${1:1d},${2:30d}',
    description: 'UTC date ahead of now',
    kind: 'relative-duration',
  },
  utc_date_past: {
    min: 1, max: 2, signature: 'max|min,max',
    snippet: '${1:1d}|${1:1d},${2:30d}',
    description: 'UTC date before now',
    kind: 'relative-duration',
  },
  epoch_future: {
    min: 1, max: 2, signature: 'max|min,max',
    snippet: '${1:1d}|${1:1d},${2:30d}',
    description: 'duration or day count ahead of now',
    kind: 'relative-duration',
  },
  epoch_future_ms: {
    min: 1, max: 2, signature: 'max|min,max',
    snippet: '${1:1d}|${1:1d},${2:30d}',
    description: 'duration or day count ahead of now',
    kind: 'relative-duration',
  },
  epoch_past: {
    min: 1, max: 2, signature: 'max|min,max',
    snippet: '${1:1d}|${1:1d},${2:30d}',
    description: 'duration or day count before now',
    kind: 'relative-duration',
  },
  epoch_past_ms: {
    min: 1, max: 2, signature: 'max|min,max',
    snippet: '${1:1d}|${1:1d},${2:30d}',
    description: 'duration or day count before now',
    kind: 'relative-duration',
  },
  datetime: {
    min: 2, max: 2, signature: 'from,to',
    snippet: '${1:2026-01-01},${2:2026-12-31}',
    description: 'absolute local date/time range', kind: 'datetime-range',
  },
  utc_datetime: {
    min: 2, max: 2, signature: 'from,to',
    snippet: '${1:2026-01-01T00:00:00Z},${2:2026-12-31T23:59:59Z}',
    description: 'absolute UTC date/time range', kind: 'datetime-range',
  },
  datetime_now: {
    min: 1, max: 2, signature: 'range|back,forward',
    snippet: '${1:1h1m}|${1:2h},${2:1d}',
    description: 'symmetric duration around now, or back then forward',
    kind: 'duration',
  },
  utc_datetime_now: {
    min: 1, max: 2, signature: 'range|back,forward',
    snippet: '${1:1h1m}|${1:2h},${2:1d}',
    description: 'symmetric UTC duration around now, or back then forward',
    kind: 'duration',
  },
  epoch_now: {
    min: 1, max: 2, signature: 'range|back,forward',
    snippet: '${1:1h1m}|${1:2h},${2:1d}',
    description: 'symmetric duration around now, or back then forward',
    kind: 'duration',
  },
  epoch_now_ms: {
    min: 1, max: 2, signature: 'range|back,forward',
    snippet: '${1:1h1m}|${1:2h},${2:1d}',
    description: 'symmetric duration around now, or back then forward',
    kind: 'duration',
  },
};

/**
 * Resolve `name` or `name(arg[,arg])`. Invalid parameter lists are
 * rejected so callers can preserve the original token text.
 */
export function randomValueForToken(spec: string): any|undefined {
  const match = /^([A-Za-z_][A-Za-z0-9_-]*)(?:\(([^()]*)\))?$/.exec(
      String(spec || '').trim());
  if (!match) {
    return undefined;
  }
  const name = match[1]
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .replace(/[-\s]+/g, '_')
      .toLowerCase();
  const generator = RANDOM_TOKEN_MAP[name];
  if (!generator) {
    return undefined;
  }
  if (match[2] === undefined) {
    return generator();
  }
  const rawArgs = match[2].split(',').map(value => value.trim());
  const arity = RANDOM_TOKEN_PARAMETER_ARITY[name];
  if (!arity ||
      rawArgs.length < arity.min || rawArgs.length > arity.max) {
    return undefined;
  }
  if (arity.kind === 'datetime-range') {
    if (rawArgs.some(value => !Number.isFinite(Date.parse(value)))) {
      return undefined;
    }
    return generator(...rawArgs);
  }
  if (arity.kind === 'duration') {
    if (rawArgs.length === 1) {
      if (unsignedDurationMs(rawArgs[0]) === undefined) {
        return undefined;
      }
      return generator(rawArgs[0]);
    }
    if (rawArgs.length === 2) {
      if (unsignedDurationMs(rawArgs[0]) === undefined ||
          unsignedDurationMs(rawArgs[1]) === undefined) {
        return undefined;
      }
      return generator(rawArgs[0], rawArgs[1]);
    }
    return undefined;
  }
  if (arity.kind === 'relative-duration') {
    if (rawArgs.length === 1) {
      if (parseRelativeAmountMs(rawArgs[0]) === undefined) {
        return undefined;
      }
      return generator(rawArgs[0]);
    }
    if (rawArgs.length === 2) {
      if (parseRelativeAmountMs(rawArgs[0]) === undefined ||
          parseRelativeAmountMs(rawArgs[1]) === undefined) {
        return undefined;
      }
      return generator(rawArgs[0], rawArgs[1]);
    }
    return undefined;
  }
  if (rawArgs.some(value => !/^-?\d+(?:\.\d+)?$/.test(value))) {
    return undefined;
  }
  const numericArgs = rawArgs.map(Number);
  if ((arity.kind === 'integer' || arity.kind === 'length') &&
      numericArgs.some(value => !Number.isInteger(value))) {
    return undefined;
  }
  if (arity.kind === 'length' &&
      (numericArgs[0] < 0 || numericArgs[0] > 10000)) {
    return undefined;
  }
  return generator(...numericArgs);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function alt(values: readonly string[]): string {
  return values.map(escapeRegExp).join('|');
}

/**
 * Inclusive integer range as a regex source. Wide ranges stay a digit
 * pattern; a second bounds check keeps those exact.
 */
function intRangeSource(min: number, max: number): string {
  if (!Number.isInteger(min) || !Number.isInteger(max)) {
    return '-?\\d+';
  }
  if (max < min) {
    return intRangeSource(max, min);
  }
  if (max - min > 2000) {
    return '-?\\d+';
  }
  const parts: string[] = [];
  if (min < 0) {
    parts.push('-(?:' + positiveIntRangeSource(-Math.min(max, -1), -min) + ')');
  }
  if (min <= 0 && max >= 0) {
    parts.push('0');
  }
  if (max > 0) {
    parts.push(positiveIntRangeSource(Math.max(min, 1), max));
  }
  return parts.join('|');
}

function positiveIntRangeSource(min: number, max: number): string {
  const parts: string[] = [];
  let n = min;
  while (n <= max) {
    let step = 1;
    while (n % (step * 10) === 0 && n + step * 10 - 1 <= max) {
      step *= 10;
    }
    const end = n + step - 1;
    if (step === 1) {
      parts.push(String(n));
    } else {
      const text = String(n);
      const zeros = String(step).length - 1;
      parts.push(text.slice(0, text.length - zeros) + '\\d'.repeat(zeros));
    }
    n = end + 1;
  }
  return parts.join('|');
}

const TIME_SRC = '(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d';
const DATE_SRC = '\\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])';
const DATE_TIME_SRC = `${DATE_SRC}T${TIME_SRC}`;
const NUMBER_SRC = '-?(?:\\d+(?:\\.\\d+)?|\\.\\d+)(?:[eE][+-]?\\d+)?';
const WEEKDAY_ABBR = '(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat)';
const MONTH_ABBR =
    '(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)';
const JS_DATE_SRC =
    `${WEEKDAY_ABBR} ${MONTH_ABBR} [\\d ]\\d \\d{4} ${TIME_SRC} GMT.+`;

function lengthFrom(args: string[] | null, fallback: number): number {
  if (!args || args.length === 0) {
    return fallback;
  }
  const n = Number(args[0]);
  return Number.isInteger(n) && n >= 0 ? n : fallback;
}

function intBounds(args: string[] | null): {min: number, max: number} {
  if (!args || args.length === 0) {
    return {min: 0, max: 1000};
  }
  const first = Number(args[0]);
  const second = args.length > 1 ? Number(args[1]) : undefined;
  let min = second === undefined ? 0 : Math.ceil(first);
  let max = second === undefined ? Math.floor(first) : Math.floor(second);
  if (max < min) {
    const swap = min;
    min = max;
    max = swap;
  }
  return {min, max};
}

function floatBounds(args: string[] | null): {min: number, max: number} {
  if (!args || args.length === 0) {
    return {min: 0, max: 1000};
  }
  const first = Number(args[0]);
  const second = args.length > 1 ? Number(args[1]) : undefined;
  let min = second === undefined ? 0 : first;
  let max = second === undefined ? first : second;
  if (max < min) {
    const swap = min;
    min = max;
    max = swap;
  }
  return {min, max};
}

interface ParsedRandomSpec {
  name: string;
  args: string[] | null;
}

function parseRandomTokenSpec(spec: string): ParsedRandomSpec | undefined {
  const match = /^([A-Za-z_][A-Za-z0-9_-]*)(?:\(([^()]*)\))?$/.exec(
      String(spec || '').trim());
  if (!match || !match[1]) {
    return undefined;
  }
  const name = match[1]
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .replace(/[-\s]+/g, '_')
      .toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(RANDOM_TOKEN_MAP, name)) {
    return undefined;
  }
  if (match[2] === undefined) {
    return {name, args: null};
  }
  const args = match[2].split(',').map(value => value.trim());
  const arity = RANDOM_TOKEN_PARAMETER_ARITY[name];
  if (!arity || args.length < arity.min || args.length > arity.max) {
    return undefined;
  }
  if (arity.kind === 'integer' || arity.kind === 'length' ||
      arity.kind === 'number') {
    if (args.some(value => !/^-?\d+(?:\.\d+)?$/.test(value))) {
      return undefined;
    }
    if ((arity.kind === 'integer' || arity.kind === 'length') &&
        args.some(value => !Number.isInteger(Number(value)))) {
      return undefined;
    }
    if (arity.kind === 'length' &&
        (Number(args[0]) < 0 || Number(args[0]) > 10000)) {
      return undefined;
    }
  }
  return {name, args};
}

function listPattern(name: string, args: string[] | null): string | undefined {
  const domains = alt(EMAIL_DOMAINS);
  const first = alt(FIRST_NAMES);
  const last = alt(LAST_NAMES);
  const firstLocal = alt(
      [...new Set(FIRST_NAMES.map(value =>
        value.toLowerCase().replace(/[^a-z0-9]/g, '')))].filter(Boolean));
  const lastLocal = alt(
      [...new Set(LAST_NAMES.map(value =>
        value.toLowerCase().replace(/[^a-z0-9]/g, '')))].filter(Boolean));
  const firstLower = alt(FIRST_NAMES.map(value => value.toLowerCase()));
  const lastLower = alt(LAST_NAMES.map(value => value.toLowerCase()));
  const words = alt(LOREM_WORDS);
  const sentence =
      `(?:${alt(LOREM_WORDS.map(word => word.charAt(0).toUpperCase() + word.slice(1)))})(?: (?:${words})){5,11}\\.`;
  switch (name) {
    case 'bool':
      return 'true|false';
    case 'uuid':
      return '[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
    case 'hex_color':
      return '#[0-9a-f]{6}';
    case 'color':
      return alt(COLOR_PALETTE);
    case 'weekday':
      return alt(WEEKDAYS);
    case 'month':
      return alt(MONTHS);
    case 'word':
      return words;
    case 'first_name':
      return first;
    case 'last_name':
      return last;
    case 'full_name':
      return `(?:${first}) (?:${last})`;
    case 'city':
      return alt(CITY_LIST);
    case 'country':
      return alt(COUNTRY_LIST);
    case 'domain':
      return domains;
    case 'job_title':
      return alt(JOB_TITLES);
    case 'user_agent':
      return alt(USER_AGENTS);
    case 'company':
      return `(?:${last}) (?:${alt(COMPANY_SUFFIXES)})`;
    case 'email':
      return `(?:${firstLocal})\\.?(?:${lastLocal})\\d{0,4}@(?:${domains})`;
    case 'username':
      return `(?:${firstLower})\\.(?:${lastLower})[1-9]\\d{0,3}`;
    case 'ip':
      return '(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(?:\\.(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}';
    case 'ipv6':
      return '[0-9a-f]{4}(?::[0-9a-f]{4}){7}';
    case 'mac':
      return '[0-9a-f]{2}(?::[0-9a-f]{2}){5}';
    case 'phone':
    case 'phone_number':
      return '\\+\\d{8,15}';
    case 'postal_code':
      return '[1-9]\\d{4}';
    case 'street_address':
      return `[1-9]\\d{0,3} (?:${last}) Street`;
    case 'string':
      return `[A-Za-z]{${lengthFrom(args, 16)}}`;
    case 'alphanumeric':
      return `[A-Za-z0-9]{${lengthFrom(args, 16)}}`;
    case 'password':
      return `[A-Za-z0-9!@#$%^&*_+=-]{${lengthFrom(args, 16)}}`;
    case 'hostname':
      return `api-[a-z0-9]{8}\\.(?:${domains})`;
    case 'url':
      return `https://api-[a-z0-9]{8}\\.(?:${domains})/[A-Za-z0-9]{10}`;
    case 'time':
    case 'utc_time':
    case 'time_future':
    case 'time_past':
    case 'utc_time_future':
    case 'utc_time_past':
      return TIME_SRC;
    case 'date':
    case 'utc_date':
    case 'utc_date_future':
    case 'utc_date_past':
      return DATE_SRC;
    case 'datetime':
    case 'datetime_now':
    case 'datetime_future':
    case 'datetime_past':
      return DATE_TIME_SRC;
    case 'utc_datetime':
    case 'utc_datetime_now':
    case 'utc_datetime_future':
    case 'utc_datetime_past':
      return `${DATE_TIME_SRC}Z`;
    case 'date_future':
    case 'date_past':
      return JS_DATE_SRC;
    case 'sentence':
      return sentence;
    case 'paragraph':
      return `(?:${sentence})(?: (?:${sentence})){2,5}`;
    case 'int': {
      const {min, max} = intBounds(args);
      return intRangeSource(min, max);
    }
    case 'float':
    case 'latitude':
    case 'longitude':
      return NUMBER_SRC;
    case 'epoch':
    case 'epoch_now':
    case 'epoch_future':
    case 'epoch_past':
      return '\\d{9,11}';
    case 'epoch_ms':
    case 'epoch_now_ms':
    case 'epoch_future_ms':
    case 'epoch_past_ms':
      return '\\d{12,14}';
    default:
      return undefined;
  }
}

function numericExpectBounds(
    name: string, args: string[] | null): {min: number, max: number} | undefined {
  if (name === 'int') {
    return intBounds(args);
  }
  if (name === 'float') {
    return floatBounds(args);
  }
  if (name === 'latitude') {
    return {min: -90, max: 90};
  }
  if (name === 'longitude') {
    return {min: -180, max: 180};
  }
  if (name === 'epoch' && args && args.length === 2) {
    return intBounds(args);
  }
  if (name === 'epoch_ms' && args && args.length === 2) {
    return intBounds(args);
  }
  return undefined;
}

/**
 * Regex source (no anchors) for values `r:spec` can produce.
 * Unknown or invalid specs return undefined so the token text stays as text.
 */
export function randomTokenExpectPattern(spec: string): string | undefined {
  const parsed = parseRandomTokenSpec(spec);
  if (!parsed) {
    return undefined;
  }
  return listPattern(parsed.name, parsed.args);
}

/**
 * True when `actual` matches the generator's regex. Undefined when `spec`
 * is not a random token. Numbers and booleans match their text form, which
 * is what headers, query, form, and XML send.
 */
export function valueMatchesRandomToken(spec: string, actual: unknown): boolean | undefined {
  const parsed = parseRandomTokenSpec(spec);
  const source = parsed ? listPattern(parsed.name, parsed.args) : undefined;
  if (!parsed || !source) {
    return undefined;
  }
  if (typeof actual !== 'string' && typeof actual !== 'number' &&
      typeof actual !== 'boolean') {
    return false;
  }
  const text = String(actual);
  if (!new RegExp(`^(?:${source})$`).test(text)) {
    return false;
  }
  const bounds = numericExpectBounds(parsed.name, parsed.args);
  if (!bounds) {
    return true;
  }
  const n = Number(text);
  if (!Number.isFinite(n) || n < bounds.min || n > bounds.max) {
    return false;
  }
  if (parsed.name === 'int' && (!Number.isInteger(n) || text !== String(n))) {
    return false;
  }
  return true;
}