export function roundReportNumber(value: number, digits = 3): number {
  if (!Number.isFinite(value)) {
    return value;
  }
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}

export function formatReportNumber(value: number | undefined, digits = 3): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '';
  }
  const rounded = roundReportNumber(value, digits);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(digits);
}

export function formatReportPercent(value: number | undefined, digits = 3): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '-';
  }
  return `${formatReportNumber(value * 100, digits)}%`;
}

export function roundReportNumbersDeep<T>(value: T, digits = 3): T {
  if (typeof value === 'number') {
    return roundReportNumber(value, digits) as T;
  }
  if (Array.isArray(value)) {
    return value.map(item => roundReportNumbersDeep(item, digits)) as T;
  }
  if (value && typeof value === 'object') {
    const rounded: Record<string, any> = {};
    for (const [key, child] of Object.entries(value as Record<string, any>)) {
      rounded[key] = roundReportNumbersDeep(child, digits);
    }
    return rounded as T;
  }
  return value;
}

export function formatReportDateTime(timestamp?: number | string): string {
  if (timestamp === undefined || timestamp === null || timestamp === '') {
    return '';
  }
  const date = typeof timestamp === 'number' ? new Date(timestamp) : new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return String(timestamp);
  }
  return date.toISOString();
}

export function formatReportRelativeTime(timestamp?: number | string, now = Date.now()): string {
  if (timestamp === undefined || timestamp === null || timestamp === '') {
    return '';
  }
  const date = typeof timestamp === 'number' ? new Date(timestamp) : new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return String(timestamp);
  }
  const diffMs = now - date.getTime();
  const isFuture = diffMs < 0;
  const absoluteMinutes = Math.abs(diffMs) / 60_000;
  if (absoluteMinutes < 1) {
    return 'now';
  }
  const units = [
    {label: 'y', minutes: 60 * 24 * 365},
    {label: 'd', minutes: 60 * 24},
    {label: 'h', minutes: 60},
    {label: 'm', minutes: 1},
  ];
  let remainingMinutes = Math.floor(absoluteMinutes);
  const parts: string[] = [];
  for (const unit of units) {
    if (remainingMinutes < unit.minutes) {
      continue;
    }
    const value = Math.floor(remainingMinutes / unit.minutes);
    remainingMinutes -= value * unit.minutes;
    parts.push(`${value}${unit.label}`);
    if (parts.length === 2) {
      break;
    }
  }
  if (parts.length === 0) {
    return 'now';
  }
  return isFuture ? `${parts.join('')} from now` : `${parts.join('')} ago`;
}

export function formatReportTimeRange(start?: number | string, end?: number | string): string {
  const startText = formatReportDateTime(start);
  const endText = formatReportDateTime(end);
  if (startText && endText) {
    return `${startText} → ${endText}`;
  }
  return startText || endText;
}