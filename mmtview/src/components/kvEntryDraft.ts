/** Shared helpers for KV/KSV list editors: local duplicate-key drafts. */

export type KvEntry = [string, string];

/** True when two key/value rows show the same text (order-sensitive). */
export function kvEntriesEqual(a: KvEntry[], b: KvEntry[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i][0] !== b[i][0] || a[i][1] !== b[i][1]) {
      return false;
    }
  }
  return true;
}

/** Indexes whose non-empty key appears more than once (exact string match). */
export function findDuplicateKeyIndexes(entries: KvEntry[]): Set<number> {
  const byKey = new Map<string, number[]>();
  entries.forEach(([key], index) => {
    if (!key.trim()) {
      return;
    }
    const list = byKey.get(key);
    if (list) {
      list.push(index);
    } else {
      byKey.set(key, [index]);
    }
  });
  const dups = new Set<number>();
  byKey.forEach((indexes) => {
    if (indexes.length > 1) {
      indexes.forEach((i) => dups.add(i));
    }
  });
  return dups;
}

/**
 * Build a record for YAML: skip empty keys; if a key is duplicated, keep the
 * first row's value so existing YAML is not wiped while the user is typing.
 */
export function entriesToUniqueRecord<T>(
  entries: KvEntry[],
  mapValue: (display: string) => T,
): Record<string, T> {
  const counts = new Map<string, number>();
  for (const [key] of entries) {
    if (!key.trim()) {
      continue;
    }
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const out: Record<string, T> = {};
  const seen = new Set<string>();
  for (const [key, display] of entries) {
    if (!key.trim()) {
      continue;
    }
    if ((counts.get(key) ?? 0) > 1) {
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
    }
    out[key] = mapValue(display);
  }
  return out;
}
