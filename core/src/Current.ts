import { MONTHS, WEEKDAYS } from './RandomResources';

function pad2(n: number): string { return n.toString().padStart(2, '0'); }

export function currentTime(): string {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

export function currentDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function currentDateTime(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` +
      `T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

export function currentUtcTime(): string {
  const d = new Date();
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`;
}

export function currentUtcDate(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

export function currentUtcDateTime(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}` +
      `T${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}Z`;
}

export function currentUtcDateTimeMs(): string {
  return new Date().toISOString();
}

export function currentTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function currentUtcOffset(): string {
  const offsetMinutes = -new Date().getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absolute = Math.abs(offsetMinutes);
  return `${sign}${pad2(Math.floor(absolute / 60))}:${pad2(absolute % 60)}`;
}

/** ISO weekday number: Monday=1, Sunday=7. */
export function currentWeekdayNumber(): number {
  const day = new Date().getDay();
  return day === 0 ? 7 : day;
}

export function currentDay(): string {
  const d = new Date();
  return WEEKDAYS[d.getDay()];
}

export function currentMonth(): string {
  const d = new Date();
  return MONTHS[d.getMonth()];
}

export function currentYear(): number {
  return new Date().getFullYear();
}

export function currentEpoch(): number {
  return Math.floor(Date.now() / 1000);
}

export function currentEpochMs(): number {
  return Date.now();
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

export const CURRENT_TOKEN_MAP: Record<string, () => any> = {
  time: currentTime,
  date: currentDate,
  datetime: currentDateTime,
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
