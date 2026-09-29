import {JSONValue} from './CommonData';
import {isOmitSentinel, OMIT_SENTINEL} from './omitKeyword';
import {
  isLiteralTokenValue,
  isTokenLikeScalar,
  unwrapLiteralToken,
  wrapLiteralToken,
} from './literalToken';

/**
 * True when a plain string must be YAML-double-quoted so a reparse keeps it as
 * a string (or as literal text) instead of a number / bool / null / omit.
 */
export function needsYamlDoubleQuotes(value: string): boolean {
  if (isLiteralTokenValue(value) || isTokenLikeScalar(value)) {
    return false;
  }
  const lower = value.toLowerCase();
  if (lower === 'true' || lower === 'false' || lower === 'null' ||
      lower === 'omit') {
    return true;
  }
  if (value.trim() !== '' && !Number.isNaN(Number(value))) {
    return true;
  }
  return false;
}

/**
 * YAML / model value → text shown in an input box.
 * Numbers/bools/null/omit stay unquoted; ambiguous strings and quoted token
 * literals keep surrounding `"` so quotes survive the round-trip.
 */
export function yamlValueToInputBox(val: JSONValue | undefined): string {
  if (val === undefined) {
    return '';
  }
  if (val === null) {
    return 'null';
  }
  if (isOmitSentinel(val)) {
    return 'omit';
  }
  if (typeof val === 'string') {
    if (isLiteralTokenValue(val)) {
      return `"${unwrapLiteralToken(val)}"`;
    }
    if (needsYamlDoubleQuotes(val)) {
      return `"${val}"`;
    }
    return val;
  }
  if (typeof val === 'boolean' || typeof val === 'number') {
    return String(val);
  }
  if (typeof val === 'object') {
    return JSON.stringify(val);
  }
  return String(val);
}

/**
 * Input-box text → stored YAML / model value.
 * `"112"` → string `"112"`; `112` → number `112`; bare tokens stay tokens.
 */
export function inputBoxToYamlValue(val: string): JSONValue {
  if (val === null || val === undefined) {
    return '';
  }
  if (typeof val !== 'string') {
    return val;
  }
  const t = val.trim();

  if ((t.startsWith('"') && t.endsWith('"')) ||
      (t.startsWith('\'') && t.endsWith('\''))) {
    const inner = t.slice(1, -1);
    if (isTokenLikeScalar(inner)) {
      return wrapLiteralToken(inner);
    }
    return inner;
  }

  if (t === 'omit') {
    return OMIT_SENTINEL;
  }
  if (t === 'null') {
    return null;
  }
  if (t.toLowerCase() === 'true') {
    return true;
  }
  if (t.toLowerCase() === 'false') {
    return false;
  }
  const num = Number(t);
  if (!Number.isNaN(num) && t !== '') {
    return num;
  }
  if ((t.startsWith('{') && t.endsWith('}')) ||
      (t.startsWith('[') && t.endsWith(']'))) {
    try {
      return JSON.parse(t);
    } catch {
      // Fall through to return as string
    }
  }
  return val;
}

/** Alias kept for existing call sites. */
export const valueToString = yamlValueToInputBox;
/** Alias kept for existing call sites. */
export const stringToValue = inputBoxToYamlValue;
