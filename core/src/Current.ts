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
  day: currentDay,
  month: currentMonth,
  year: currentYear,
  epoch: currentEpoch,
  epoch_ms: currentEpochMs,
  city: currentCity,
  country: currentCountry,
};
