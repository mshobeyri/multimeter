import YAML, {isMap, isPair, isScalar, isSeq, YAMLMap, YAMLSeq} from 'yaml';

function isJsScalar(value: unknown): boolean {
  return !value || (typeof value !== 'function' && typeof value !== 'object');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function pairKey(pair: {key: unknown}): string | undefined {
  if (isScalar(pair.key)) {
    return String(pair.key.value);
  }
  return undefined;
}

/**
 * Merge a JS value into an existing YAML AST node.
 *
 * Same model as formatMmtYamlAst: keep map pairs and scalars in place so
 * `#` comments stay stuck to the following key / end of the same line.
 * Only replace a node when the YAML type actually changes (e.g. scalar → map).
 *
 * New map keys are inserted by `Object.keys(next)` order (callers like
 * apiToYaml build that object in canonical field order), so adding `body`
 * lands before `examples` instead of always appending at the end.
 */
export function mergeYamlValue(
    doc: YAML.Document, existing: unknown, next: unknown): unknown {
  if (isMap(existing) && isPlainObject(next)) {
    mergeMap(doc, existing, next);
    return existing;
  }
  if (isSeq(existing) && Array.isArray(next)) {
    mergeSeq(doc, existing, next);
    return existing;
  }
  if (isScalar(existing) && isJsScalar(next)) {
    existing.value = next as string | number | boolean | null;
    return existing;
  }
  return doc.createNode(next);
}

function insertMapKeyInOrder(
    doc: YAML.Document,
    map: YAMLMap,
    key: string,
    value: unknown,
    preferredOrder: string[],
): void {
  const pair = doc.createPair(key, value);
  const keyRank = preferredOrder.indexOf(key);
  if (keyRank < 0) {
    map.items.push(pair);
    return;
  }
  let insertAt = map.items.length;
  for (let i = 0; i < map.items.length; i++) {
    const item = map.items[i];
    if (!isPair(item)) {
      continue;
    }
    const existingKey = pairKey(item);
    if (existingKey === undefined) {
      continue;
    }
    const existingRank = preferredOrder.indexOf(existingKey);
    if (existingRank === -1 || existingRank > keyRank) {
      insertAt = i;
      break;
    }
  }
  map.items.splice(insertAt, 0, pair);
}

function mergeMap(
    doc: YAML.Document, map: YAMLMap, next: Record<string, unknown>): void {
  const preferredOrder = Object.keys(next).filter((key) => next[key] !== undefined);
  const keep = new Set(preferredOrder);
  for (const item of [...map.items]) {
    if (!isPair(item)) {
      continue;
    }
    const key = pairKey(item);
    if (key !== undefined && !keep.has(key)) {
      map.delete(key);
    }
  }
  for (const key of preferredOrder) {
    const nextVal = next[key];
    const existing = map.get(key, true);
    if (existing === undefined) {
      insertMapKeyInOrder(doc, map, key, nextVal, preferredOrder);
      continue;
    }
    const merged = mergeYamlValue(doc, existing, nextVal);
    if (merged !== existing) {
      map.set(key, merged);
    }
  }
}

function mergeSeq(doc: YAML.Document, seq: YAMLSeq, next: unknown[]): void {
  while (seq.items.length > next.length) {
    seq.delete(seq.items.length - 1);
  }
  for (let i = 0; i < next.length; i++) {
    const existing = seq.get(i, true);
    if (existing === undefined) {
      seq.add(doc.createNode(next[i]));
      continue;
    }
    const merged = mergeYamlValue(doc, existing, next[i]);
    if (merged !== existing) {
      seq.set(i, merged);
    }
  }
}

/** Set or merge a document root key, preserving comments on existing nodes. */
export function setYamlRoot(
    doc: YAML.Document, key: string, value: unknown): void {
  if (value === undefined) {
    doc.delete(key);
    return;
  }
  const existing = doc.get(key, true);
  if (existing === undefined || existing === null) {
    doc.set(key, value);
    return;
  }
  const merged = mergeYamlValue(doc, existing, value);
  if (merged !== existing) {
    doc.set(key, merged);
  }
}
