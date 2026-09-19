import { MONTHS, WEEKDAYS } from './RandomResources';
import {signedDurationMs, unsignedDurationMs} from './durationParse';

function pad2(n: number): string { return n.toString().padStart(2, '0'); }
function pad3(n: number): string { return n.toString().padStart(3, '0'); }

export function currentTime(d = new Date()): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

export function currentDate(d = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function currentDateTime(d = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` +
      `T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

export function currentDateTimeMs(d = new Date()): string {
  return `${currentDateTime(d)}.${pad3(d.getMilliseconds())}`;
}

export function currentUtcTime(d = new Date()): string {
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`;
}

export function currentUtcDate(d = new Date()): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

export function currentUtcDateTime(d = new Date()): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}` +
      `T${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}Z`;
}

export function currentUtcDateTimeMs(d = new Date()): string {
  return d.toISOString();
}

export function currentTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function currentUtcOffset(d = new Date()): string {
  const offsetMinutes = -d.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absolute = Math.abs(offsetMinutes);
  return `${sign}${pad2(Math.floor(absolute / 60))}:${pad2(absolute % 60)}`;
}

/** ISO weekday number: Monday=1, Sunday=7. */
export function currentWeekdayNumber(d = new Date()): number {
  const day = d.getDay();
  return day === 0 ? 7 : day;
}

export function currentDay(d = new Date()): string {
  return WEEKDAYS[d.getDay()];
}

export function currentMonth(d = new Date()): string {
  return MONTHS[d.getMonth()];
}

export function currentYear(d = new Date()): number {
  return d.getFullYear();
}

export function currentEpoch(d = new Date()): number {
  return Math.floor(d.getTime() / 1000);
}

export function currentEpochMs(d = new Date()): number {
  return d.getTime();
}

export function currentCity(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const parts = tz.split('/');
    if (parts.length >= 2) {
      return parts[1].replace(/_/g, ' ');
    }
    if (parts.length === 1 && parts[0]) {
      return parts[0].replace(/_/g, ' ');
    }
  } catch {}
  return 'Unknown';
}

export function currentCountry(): string {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale || '';
    // Try extracting region code (e.g., en-US -> US)
    const match = /-([A-Z]{2})(?:-|$)/.exec(locale) || /_([A-Z]{2})(?:\.|$)/.exec(locale);
    const code = match && match[1] ? match[1] : '';
    if (code) {
      // Try to pretty print the region name if supported
      try {
        // @ts-ignore: DisplayNames may not exist in older engines
        const dn = new (Intl as any).DisplayNames([locale], { type: 'region' });
        const full = dn?.of?.(code);
        if (full && typeof full === 'string') {
          return full;
        }
      } catch {}
      return code;
    }
  } catch {}
  return 'Unknown';
}

export type CurrentTokenGenerator = (date?: Date) => any;

export const CURRENT_TOKEN_MAP: Record<string, CurrentTokenGenerator> = {
  time: currentTime,
  date: currentDate,
  datetime: currentDateTime,
  datetime_ms: currentDateTimeMs,
  utc_time: currentUtcTime,
  utc_date: currentUtcDate,
  utc_datetime: currentUtcDateTime,
  utc_datetime_ms: currentUtcDateTimeMs,
  timezone: currentTimezone,
  utc_offset: currentUtcOffset,
  weekday_number: currentWeekdayNumber,
  day: currentDay,
  month: currentMonth,
  year: currentYear,
  epoch: currentEpoch,
  epoch_ms: currentEpochMs,
  city: currentCity,
  country: currentCountry,
};

export const CURRENT_TOKEN_OFFSET_NAMES = [
  'time',
  'date',
  'datetime',
  'datetime_ms',
  'utc_time',
  'utc_date',
  'utc_datetime',
  'utc_datetime_ms',
  'utc_offset',
  'weekday_number',
  'day',
  'month',
  'year',
  'epoch',
  'epoch_ms',
] as const;

export const CURRENT_FUTURE_PAST_ALIASES: Record<
    string, {base: string, direction: 'future'|'past'}> = {
  time_future: {base: 'time', direction: 'future'},
  time_past: {base: 'time', direction: 'past'},
  utc_time_future: {base: 'utc_time', direction: 'future'},
  utc_time_past: {base: 'utc_time', direction: 'past'},
  date_future: {base: 'date', direction: 'future'},
  date_past: {base: 'date', direction: 'past'},
  utc_date_future: {base: 'utc_date', direction: 'future'},
  utc_date_past: {base: 'utc_date', direction: 'past'},
  datetime_future: {base: 'datetime', direction: 'future'},
  datetime_past: {base: 'datetime', direction: 'past'},
  datetime_ms_future: {base: 'datetime_ms', direction: 'future'},
  datetime_ms_past: {base: 'datetime_ms', direction: 'past'},
  utc_datetime_future: {base: 'utc_datetime', direction: 'future'},
  utc_datetime_past: {base: 'utc_datetime', direction: 'past'},
  utc_datetime_ms_future: {base: 'utc_datetime_ms', direction: 'future'},
  utc_datetime_ms_past: {base: 'utc_datetime_ms', direction: 'past'},
  epoch_future: {base: 'epoch', direction: 'future'},
  epoch_past: {base: 'epoch', direction: 'past'},
  epoch_ms_future: {base: 'epoch_ms', direction: 'future'},
  epoch_ms_past: {base: 'epoch_ms', direction: 'past'},
};

/** Resolve a current token name with an optional signed duration offset. */
export function currentValueForToken(spec: string): any|undefined {
  const match = /^([A-Za-z_][A-Za-z0-9_-]*)(?:\(([^()]*)\))?$/
      .exec(String(spec || '').trim());
  if (!match) {
    return undefined;
  }
  let name = match[1]
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .replace(/[-\s]+/g, '_')
      .toLowerCase();

  const alias = CURRENT_FUTURE_PAST_ALIASES[name];
  if (alias) {
    name = alias.base;
  }

  const generator = CURRENT_TOKEN_MAP[name];
  if (!generator) {
    return undefined;
  }
  if (match[2] === undefined) {
    return generator();
  }
  if (!(CURRENT_TOKEN_OFFSET_NAMES as readonly string[]).includes(name)) {
    return undefined;
  }

  if (alias) {
    const duration = unsignedDurationMs(match[2]);
    if (duration === undefined) {
      return undefined;
    }
    const offset = alias.direction === 'future' ? duration : -duration;
    return generator(new Date(Date.now() + offset));
  }

  const offset = signedDurationMs(match[2]);
  if (offset === undefined) {
    return undefined;
  }
  return generator(new Date(Date.now() + offset));
}
