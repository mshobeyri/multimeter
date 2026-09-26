import {
  ACCESSOR_PATH_RE,
  CURRENT_TOKEN_SPEC_RE,
  RANDOM_TOKEN_SPEC_RE,
} from './variableReplacer';

const RUNTIME_TOKEN_IN_STRING_RE = new RegExp(
    [
      `<<\\s*r:${RANDOM_TOKEN_SPEC_RE}${ACCESSOR_PATH_RE}\\s*>>`,
      `<<\\s*c:${CURRENT_TOKEN_SPEC_RE}${ACCESSOR_PATH_RE}\\s*>>`,
      `(?<![A-Za-z0-9_])r:${RANDOM_TOKEN_SPEC_RE}${ACCESSOR_PATH_RE}(?![A-Za-z0-9_])`,
      `(?<![A-Za-z0-9_])c:${CURRENT_TOKEN_SPEC_RE}${ACCESSOR_PATH_RE}(?![A-Za-z0-9_])`,
    ].join('|'),
);

/** True when a string contains an r: or c: token (plain or << >>). */
export function stringContainsRuntimeToken(value: unknown): boolean {
  if (typeof value !== 'string' || !value) {
    return false;
  }
  return RUNTIME_TOKEN_IN_STRING_RE.test(value);
}

export type RuntimeLeaf = {
  /** Object/array path from the structured source body. */
  path: Array<string|number>;
  /** Last path key (for JSON `"key": value` search). */
  key: string|number|undefined;
  /** Resolved value as it appears after token replacement. */
  resolved: unknown;
};

/**
 * Walk YAML source + resolved preview together and collect leaves whose source
 * text contains r:/c: tokens (those preview values refresh on Send).
 */
export function collectRuntimeLeaves(
    source: unknown,
    resolved: unknown,
    path: Array<string|number> = [],
): RuntimeLeaf[] {
  if (typeof source === 'string' && stringContainsRuntimeToken(source)) {
    return [{
      path: [...path],
      key: path.length > 0 ? path[path.length - 1] : undefined,
      resolved,
    }];
  }
  if (Array.isArray(source) && Array.isArray(resolved)) {
    const out: RuntimeLeaf[] = [];
    const n = Math.min(source.length, resolved.length);
    for (let i = 0; i < n; i++) {
      out.push(...collectRuntimeLeaves(source[i], resolved[i], [...path, i]));
    }
    return out;
  }
  if (
    source && typeof source === 'object' && !Array.isArray(source) &&
    resolved && typeof resolved === 'object' && !Array.isArray(resolved)
  ) {
    const out: RuntimeLeaf[] = [];
    const srcObj = source as Record<string, unknown>;
    const resObj = resolved as Record<string, unknown>;
    for (const key of Object.keys(srcObj)) {
      if (!Object.prototype.hasOwnProperty.call(resObj, key)) {
        continue;
      }
      out.push(...collectRuntimeLeaves(srcObj[key], resObj[key], [...path, key]));
    }
    return out;
  }
  return [];
}

/** Map keys whose values contain r:/c: (headers, cookies, query). */
export function runtimeTokenKeys(
    source?: Record<string, unknown>|null,
): Set<string> {
  const keys = new Set<string>();
  if (!source || typeof source !== 'object') {
    return keys;
  }
  for (const [key, value] of Object.entries(source)) {
    if (stringContainsRuntimeToken(value)) {
      keys.add(key);
    }
  }
  return keys;
}

export type TextPositionRange = {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
};

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function jsonSerializedValue(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** Display form of a resolved leaf inside plain (non-JSON) body text. */
function plainSerializedValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value === null || value === undefined) {
    return String(value);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return jsonSerializedValue(value);
}

function indexToPosition(text: string, index: number): {line: number, column: number} {
  let line = 1;
  let column = 1;
  for (let i = 0; i < index && i < text.length; i++) {
    if (text[i] === '\n') {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }
  return {line, column};
}

/**
 * Find display ranges for resolved runtime leaves inside pretty JSON text.
 * Prefers `"key": <value>` when the leaf has a string key; falls back to value search.
 */
export function findRuntimeValueRangesInJson(
    text: string,
    leaves: RuntimeLeaf[],
): TextPositionRange[] {
  if (!text || leaves.length === 0) {
    return [];
  }
  const ranges: TextPositionRange[] = [];
  const used = new Set<string>();

  for (const leaf of leaves) {
    const serialized = jsonSerializedValue(leaf.resolved);
    if (serialized === undefined) {
      continue;
    }
    let matchIndex = -1;
    if (typeof leaf.key === 'string' && leaf.key.length > 0) {
      const keyed = new RegExp(
          `"${escapeRegExp(leaf.key)}"\\s*:\\s*(${escapeRegExp(serialized)})`,
      );
      const m = keyed.exec(text);
      if (m && m.index != null) {
        matchIndex = m.index + m[0].length - m[1].length;
      }
    }
    if (matchIndex < 0) {
      matchIndex = text.indexOf(serialized);
    }
    if (matchIndex < 0) {
      continue;
    }
    const start = indexToPosition(text, matchIndex);
    const end = indexToPosition(text, matchIndex + serialized.length);
    const key = `${start.line}:${start.column}:${end.line}:${end.column}`;
    if (used.has(key)) {
      continue;
    }
    used.add(key);
    ranges.push({
      startLineNumber: start.line,
      startColumn: start.column,
      endLineNumber: end.line,
      endColumn: end.column,
    });
  }
  return ranges;
}

/**
 * Find display ranges for resolved runtime leaves inside plain / XML / urlencoded text.
 * Searches the unquoted string form of each resolved value.
 */
export function findRuntimeValueRangesInPlainText(
    text: string,
    leaves: RuntimeLeaf[],
): TextPositionRange[] {
  if (!text || leaves.length === 0) {
    return [];
  }
  const ranges: TextPositionRange[] = [];
  const used = new Set<string>();

  for (const leaf of leaves) {
    const serialized = plainSerializedValue(leaf.resolved);
    if (!serialized) {
      continue;
    }
    const matchIndex = text.indexOf(serialized);
    if (matchIndex < 0) {
      continue;
    }
    const start = indexToPosition(text, matchIndex);
    const end = indexToPosition(text, matchIndex + serialized.length);
    const key = `${start.line}:${start.column}:${end.line}:${end.column}`;
    if (used.has(key)) {
      continue;
    }
    used.add(key);
    ranges.push({
      startLineNumber: start.line,
      startColumn: start.column,
      endLineNumber: end.line,
      endColumn: end.column,
    });
  }
  return ranges;
}
