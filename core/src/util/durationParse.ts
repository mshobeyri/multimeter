/** Parse unsigned combined durations such as `1h1m` or `2d4h`. */
export function unsignedDurationMs(value: string): number|undefined {
  const source = String(value || '').trim().toLowerCase();
  if (!source ||
      !/^(?:\d+(?:\.\d+)?(?:ms|s|m|h|d|w))+$/.test(source)) {
    return undefined;
  }
  const units: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
  };
  let total = 0;
  for (const match of source.matchAll(
      /(\d+(?:\.\d+)?)(ms|s|m|h|d|w)/g)) {
    total += Number(match[1]) * units[match[2]];
  }
  return Number.isFinite(total) ? Math.round(total) : undefined;
}

/** Parse signed combined durations such as `+1h1m` or `-1d2m1s`. */
export function signedDurationMs(value: string): number|undefined {
  const source = String(value || '').trim().toLowerCase();
  const match = /^([+-])((?:\d+(?:\.\d+)?(?:ms|s|m|h|d|w))+)$/
      .exec(source);
  if (!match) {
    return undefined;
  }
  const magnitude = unsignedDurationMs(match[2]);
  if (magnitude === undefined) {
    return undefined;
  }
  return match[1] === '-' ? -magnitude : magnitude;
}

/** Parse a duration string or legacy day count for random relative windows. */
export function parseRelativeAmountMs(arg: string): number|undefined {
  const trimmed = String(arg ?? '').trim();
  if (!trimmed) {
    return undefined;
  }
  const asDuration = unsignedDurationMs(trimmed);
  if (asDuration !== undefined) {
    return asDuration;
  }
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed) * 24 * 60 * 60 * 1000;
  }
  return undefined;
}

export type RelativeWindowDirection = 'future'|'past';

export function resolveRelativeWindow(
    minArg: string|undefined,
    maxArg: string|undefined,
    direction: RelativeWindowDirection,
    defaults?: {minMs: number, maxMs: number}): {startMs: number, endMs: number} {
  const now = Date.now();
  const fallbackMin = defaults?.minMs ?? 24 * 60 * 60 * 1000;
  const fallbackMax = defaults?.maxMs ?? 365 * 24 * 60 * 60 * 1000;

  if (minArg === undefined && maxArg === undefined) {
    if (direction === 'future') {
      return {startMs: now + fallbackMin, endMs: now + fallbackMax};
    }
    return {startMs: now - fallbackMax, endMs: now - fallbackMin};
  }

  if (maxArg === undefined) {
    const amount = parseRelativeAmountMs(minArg ?? '');
    if (amount === undefined) {
      return {startMs: now, endMs: now};
    }
    if (direction === 'future') {
      return {startMs: now, endMs: now + amount};
    }
    return {startMs: now - amount, endMs: now};
  }

  const minMs = parseRelativeAmountMs(minArg ?? '');
  const maxMs = parseRelativeAmountMs(maxArg);
  if (minMs === undefined || maxMs === undefined) {
    return {startMs: now, endMs: now};
  }
  const low = Math.min(minMs, maxMs);
  const high = Math.max(minMs, maxMs);
  if (direction === 'future') {
    return {startMs: now + low, endMs: now + high};
  }
  return {startMs: now - high, endMs: now - low};
}
