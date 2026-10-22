export type EnvVarStampEntry = {
  name?: unknown;
  value?: unknown;
  source?: unknown;
  lastUpdate?: unknown;
};

function stampKey(entry: EnvVarStampEntry|undefined): string|undefined {
  const name = typeof entry?.name === 'string' ? entry.name : '';
  if (!name) {
    return undefined;
  }
  const layer = entry?.source === 'runtime' ? 'runtime' : 'environment';
  return `${name}\0${layer}`;
}

export function asEnvVarList(raw: unknown): EnvVarStampEntry[] {
  if (Array.isArray(raw)) {
    return raw as EnvVarStampEntry[];
  }
  if (raw && typeof raw === 'object') {
    return Object.values(raw as Record<string, EnvVarStampEntry>);
  }
  return [];
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function envValuesEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) {
    return true;
  }
  if (typeof a !== typeof b) {
    return false;
  }
  if (a === null || b === null || typeof a !== 'object') {
    return false;
  }
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/**
 * Stamp `lastUpdate` (epoch ms) on workspace env vars.
 * Keeps the previous stamp when the value is unchanged; otherwise uses `now`.
 */
export function applyEnvVarLastUpdates<T extends EnvVarStampEntry>(
    next: T[],
    previous: unknown,
    now: number = Date.now()): T[] {
  if (!Array.isArray(next)) {
    return [];
  }
  const prevByKey = new Map<string, EnvVarStampEntry>();
  for (const item of asEnvVarList(previous)) {
    const key = stampKey(item);
    if (key) {
      prevByKey.set(key, item);
    }
  }
  return next.map(item => {
    const key = stampKey(item);
    const prev = key ? prevByKey.get(key) : undefined;
    const prevStamp = isFiniteNumber(prev?.lastUpdate) ? prev.lastUpdate : undefined;
    const unchanged = !!prev && envValuesEqual(prev.value, item.value);
    return {
      ...item,
      lastUpdate: unchanged && prevStamp !== undefined ? prevStamp : now,
    };
  });
}
