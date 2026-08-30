import {JSONValue} from './CommonData';
import {Type} from './CommonData';
import {collectInputRefsFromObject, toTemplateValueJs} from './variableReplacer';

export function indentLines(str: string): string {
  return str.split('\n').map(line => '  ' + line).join('\n').slice(2);
}

/**
 * Order input keys so destructuring defaults can reference earlier siblings
 * (`xx = \`asd_${message}\`` needs `message` declared first).
 */
export function orderInputKeysForDefaults(
    inputs: Record<string, JSONValue>): string[] {
  const keys = Object.keys(inputs ?? {});
  const keySet = new Set(keys);
  const deps = new Map<string, string[]>();
  for (const key of keys) {
    const refs = collectInputRefsFromObject(inputs[key])
                     .filter(ref => ref !== key && keySet.has(ref));
    deps.set(key, refs);
  }

  const ordered: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  const visit = (key: string) => {
    if (visited.has(key)) {
      return;
    }
    if (visiting.has(key)) {
      return;
    }
    visiting.add(key);
    for (const dep of deps.get(key) || []) {
      visit(dep);
    }
    visiting.delete(key);
    visited.add(key);
    ordered.push(key);
  };

  for (const key of keys) {
    visit(key);
  }
  return ordered;
}

export const toInputsParams =
    (inputs: Record<string, JSONValue>, operator: string) => {
      const source = inputs ?? {};
      const formattedInputs =
          orderInputKeysForDefaults(source)
              .map(key => {
                const value = source[key];
                let formatted: string;
                if (typeof value === 'string') {
                  formatted = toTemplateValueJs(value);
                } else if (typeof value === 'object') {
                  formatted = JSON.stringify(value);
                } else {
                  formatted = String(value);
                }
                return `${key}${operator}${formatted}`;
              })
              .join(', ');
      return formattedInputs;
    };

export const fileType = (path: string, content: string): Type => {
  if (path.endsWith('.csv')) {
    return 'csv';
  }

  if (path.endsWith('.http') || path.endsWith('.https') || path.endsWith('.bru') || path.endsWith('.bruno')) {
    return 'test';
  }

  if (!path.endsWith('.mmt')) {
    // Spec / HTTP / Bruno UI runs send MMT YAML as rawFile while the path
    // is still the original source (openapi.yaml, collection.json, …).
    return mmtTypeFromYamlPrefix(content);
  }

  if (content.includes('type: api')) {
    return 'api';
  }
  if (content.includes('type: test')) {
    return 'test';
  }
  if (content.includes('type: suite')) {
    return 'suite';
  }
  if (content.includes('type: loadtest')) {
    return 'loadtest';
  }
  if (content.includes('type: env')) {
    return 'env';
  }
  if (content.includes('type: server')) {
    return 'server';
  }
  if (content.includes('type: report')) {
    return 'report';
  }
  return null;
};

function mmtTypeFromYamlPrefix(content: string): Type {
  const match = /^\s*type:\s*(api|test|suite|loadtest|env|server|doc|report)\b/m
      .exec(String(content || ''));
  return (match?.[1] as Type) || null;
}

/** Matches one or more duration tokens such as 1h, 5m, 3s, 500ms. */
export const DURATION_EXPRESSION_RE = /^((?:\d+(?:\.\d+)?)(?:ns|ms|s|m|h))+$/;

const DURATION_TOKEN_RE = /(\d+(?:\.\d+)?)(ns|ms|s|m|h)/g;

/**
 * Convert a numeric value with a time unit suffix to milliseconds.
 * Supported units: ns, ms, s, m, h. Defaults to ms if no unit provided.
 */
export function timeUnitToMs(value: number, unit: string): number {
  switch (unit) {
    case 'ns': return value / 1e6;
    case 'ms': return value;
    case 's':  return value * 1000;
    case 'm':  return value * 60 * 1000;
    case 'h':  return value * 60 * 60 * 1000;
    default:   return value;
  }
}

/**
 * Returns true when a string contains one or more duration unit suffixes.
 * Examples: 2s, 1h5m, 5m3s. Bare numbers and "inf" return false.
 */
export function isDurationExpression(value: string): boolean {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed || trimmed === 'inf') {
    return false;
  }
  return DURATION_EXPRESSION_RE.test(trimmed);
}

/**
 * Parse a test `cache` scalar into an absolute expiry timestamp (ms since epoch).
 *
 * Detection order (see AI/sdd/sdd-test-call-cache.md):
 * 1. Duration grammar (`1s`, `5m`, `1h5m`) → `nowMs + duration`
 * 2. String containing `:` → Date.parse (ISO / standard time text)
 * 3. Bare number (or numeric string) → Unix epoch (seconds if &lt; 1e12, else ms)
 */
export function parseCacheExpiryAtMs(
    value: unknown, nowMs: number = Date.now()): number|undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) {
      return undefined;
    }
    return value < 1e12 ? Math.round(value * 1000) : Math.round(value);
  }

  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  if (isDurationExpression(trimmed)) {
    const durationMs = parseDurationString(trimmed);
    if (durationMs === undefined) {
      return undefined;
    }
    return nowMs + durationMs;
  }

  if (trimmed.includes(':')) {
    const parsed = Date.parse(trimmed);
    if (!Number.isFinite(parsed)) {
      return undefined;
    }
    return parsed;
  }

  if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n < 0) {
      return undefined;
    }
    return n < 1e12 ? Math.round(n * 1000) : Math.round(n);
  }

  return undefined;
}

/**
 * Parse a duration string into milliseconds.
 * Supports single and combined unit suffixes: 2s, 1h5m, 5m3s, 1h30m15s.
 * Bare numbers and "inf" return undefined — callers decide how to interpret them.
 */
export function parseDurationString(value: unknown): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) {
      return undefined;
    }
    return Math.round(value);
  }
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim().toLowerCase();
  if (!trimmed || trimmed === 'inf' || !isDurationExpression(trimmed)) {
    return undefined;
  }
  let total = 0;
  const tokenRe = new RegExp(DURATION_TOKEN_RE.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = tokenRe.exec(trimmed)) !== null) {
    const amount = Number(match[1]);
    if (!Number.isFinite(amount) || amount < 0) {
      return undefined;
    }
    total += timeUnitToMs(amount, match[2]);
  }
  return Math.round(total);
}

/** Inline JS helper used when a delay value is only known at runtime. */
export const PARSE_DURATION_JS_FN = `(function __parseDurationMs(v) {
  const s = String(v).trim().toLowerCase();
  if (!s || s === 'inf') return 0;
  if (/^\\d+(?:\\.\\d+)?$/.test(s)) return Number(s) || 0;
  if (!/^((?:\\d+(?:\\.\\d+)?)(?:ns|ms|s|m|h))+$/.test(s)) return Number(s) || 0;
  let total = 0;
  const re = /(\\d+(?:\\.\\d+)?)(ns|ms|s|m|h)/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    const n = parseFloat(m[1]);
    const u = m[2];
    total += u === 'ns' ? n / 1e6 : u === 'ms' ? n : u === 's' ? n * 1000 : u === 'm' ? n * 60000 : n * 3600000;
  }
  return Math.round(total);
})`;

/**
 * Return a JavaScript expression that evaluates to milliseconds for a delay value.
 * Static values are inlined; dynamic/template values use runtime parsing.
 */
export function durationToJsMsExpr(value: string | number): string {
  if (typeof value === 'number') {
    return String(Math.round(value));
  }
  const trimmed = value.trim();
  const parsed = parseDurationString(trimmed);
  if (parsed !== undefined) {
    return String(parsed);
  }
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
    return String(Math.round(Number(trimmed)));
  }
  return `${PARSE_DURATION_JS_FN}(${JSON.stringify(value)})`;
}

/**
 * Normalize a token name: split camelCase, replace hyphens/spaces with
 * underscores, and lowercase everything.
 * e.g. "firstName" → "first_name", "my-token" → "my_token"
 */
export function normalizeTokenName(name: string): string {
  return name
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .replace(/[-\s]+/g, '_')
      .toLowerCase();
}

// Convert a string to a valid JS identifier fragment: lowercase, invalid
// characters replaced with underscores, consecutive underscores collapsed.
export function toLowerUnderscore(input: string): string {
  if (input === undefined || input === null) {
    return '';
  }
  let out = String(input)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_');
  if (!out || /^_+$/.test(out)) {
    return '';
  }
  if (/^[0-9]/.test(out)) {
    out = `_${out}`;
  }
  return out;
}