import {displayRuntimeTokensToResolvableText} from './bodyRuntimeTokens';
import {JSONValue} from './CommonData';
import {
  isPlainTokenScalar,
  isTokenLikeScalar,
  wholeAngleTokenPlain,
} from './literalToken';
import {isOmitSentinel} from './omitKeyword';
import {splitCheckOperatorPrefix, unquoteExpectLiteral} from './TestData';
import {
  inputBoxToYamlValue,
  yamlValueToInputBox,
} from './yamlValueConvert';

/** Internal value kind for expect rows (full names). Display via shortValueTypeLabel. */
export type ExpectUiValueKind =
    'string'|'number'|'boolean'|'null'|'omit'|'array'|'object'|'undefined';

/** One row in the call/http expect editor. */
export interface ExpectUiRow {
  field: string;
  op: string;
  expected: string;
  /** True when YAML used an explicit operator prefix (including `== 200`). */
  explicitOperator?: boolean;
  /** Original scalar type for plain `==` values (e.g. YAML `200` vs `"200"`). */
  valueKind?: ExpectUiValueKind;
}

function kindFromYamlValue(value: unknown): ExpectUiValueKind {
  if (value === null) {
    return 'null';
  }
  if (isOmitSentinel(value)) {
    return 'omit';
  }
  if (Array.isArray(value)) {
    return 'array';
  }
  if (value === undefined) {
    return 'undefined';
  }
  switch (typeof value) {
    case 'string':
      return 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'object':
      return 'object';
    default:
      return 'string';
  }
}

export function expectValueToUiRow(field: string, value: unknown): ExpectUiRow {
  if (typeof value === 'string' && !isOmitSentinel(value)) {
    const s = value.trim();
    const prefixed = splitCheckOperatorPrefix(s);
    if (prefixed) {
      return {
        field,
        op: prefixed.operator,
        expected: unquoteExpectLiteral(prefixed.expected),
        explicitOperator: true,
        valueKind: 'string',
      };
    }
  }

  if (typeof value === 'number' || typeof value === 'boolean' ||
      typeof value === 'string' || value === null) {
    return {
      field,
      op: '==',
      expected: yamlValueToInputBox(value as JSONValue),
      explicitOperator: false,
      valueKind: kindFromYamlValue(value),
    };
  }

  return {
    field,
    op: '==',
    expected: yamlValueToInputBox(String(value ?? '')),
    explicitOperator: false,
    valueKind: 'string',
  };
}

/** Plain == values may be null / omit; operator strings stay strings. */
export function uiRowToExpectValue(
    row: ExpectUiRow,
): string|number|boolean|null {
  if (row.op === '==' && !row.explicitOperator) {
    const typed = inputBoxToYamlValue(row.expected);
    if (typeof typed === 'number' || typeof typed === 'boolean' ||
        typeof typed === 'string' || typed === null) {
      return typed;
    }
    return row.expected;
  }
  if (row.op === '==' && row.explicitOperator) {
    return `== ${row.expected}`;
  }
  return `${row.op} ${row.expected}`;
}

export function expectMapToUiRows(map: Record<string, unknown> | undefined): ExpectUiRow[] {
  if (!map || typeof map !== 'object') {
    return [];
  }
  const rows: ExpectUiRow[] = [];
  for (const [field, val] of Object.entries(map)) {
    const values = Array.isArray(val) ? val : [val];
    for (const v of values) {
      rows.push(expectValueToUiRow(field, v));
    }
  }
  return rows;
}

/** Flat UI rows → ExpectMap. Multiple rows on the same field become a YAML list. */
export function uiRowsToExpectMap(rows: ExpectUiRow[]): Record<string, unknown> | undefined {
  if (rows.length === 0) {
    return undefined;
  }
  const map: Record<string, unknown> = {};
  for (const row of rows) {
    const entry = uiRowToExpectValue(row);
    if (map[row.field] !== undefined) {
      if (Array.isArray(map[row.field])) {
        (map[row.field] as unknown[]).push(entry);
      } else {
        map[row.field] = [map[row.field], entry];
      }
    } else {
      map[row.field] = entry;
    }
  }
  return map;
}

export function createEmptyExpectUiRow(field: string): ExpectUiRow {
  return {
    field,
    op: '==',
    expected: '',
    explicitOperator: false,
    valueKind: 'string',
  };
}

/** Infer YAML scalar kind from the expected-value editor text. */
export function detectExpectValueKind(raw: string): ExpectUiValueKind {
  return kindFromYamlValue(inputBoxToYamlValue(raw));
}

/**
 * Whole e:/i:/r:/c:/o: token (`c:day`, `<<c:day>>`, `{{c:day}}`).
 * Mixed text such as `xc:not_a_tokeny` is not a token.
 */
export function wholeExpectTokenPlain(value: string): string|null {
  const text = String(value ?? '').trim();
  if (!text || text.startsWith('"') || text.startsWith('\'')) {
    return null;
  }
  if (isPlainTokenScalar(text)) {
    return text;
  }
  const angle = wholeAngleTokenPlain(text);
  if (angle) {
    return angle;
  }
  if (text.startsWith('{{') && text.endsWith('}}') && isTokenLikeScalar(text)) {
    const inner = text.slice(2, -2).trim().replace(/\s+/g, '');
    if (isPlainTokenScalar(inner)) {
      return inner;
    }
  }
  return null;
}

/**
 * Expect editor display. Whole tokens use `{{prefix:name}}`.
 * Echo text, quoted literals, and operators stay as stored.
 */
export function expectStoredToDisplay(stored: string): string {
  const plain = wholeExpectTokenPlain(stored);
  if (plain) {
    return `{{${plain}}}`;
  }
  return stored;
}

/**
 * Expect editor text → row / YAML text.
 * Whole tokens save as bare `prefix:name`. Other text is kept, including
 * `xc:not_a_tokeny`. `{{token}}` the user typed inside other text becomes
 * `<<token>>`. Bare letters glued to `c:` / `e:` / `i:` / `r:` are not wrapped.
 */
export function expectDisplayToStored(display: string): string {
  const plain = wholeExpectTokenPlain(display);
  if (plain) {
    return plain;
  }
  return displayRuntimeTokensToResolvableText(display);
}

/** True when two expect editor strings are the same YAML value. */
export function expectTextUnchanged(previous: string, next: string): boolean {
  return expectDisplayToStored(previous) === expectDisplayToStored(next);
}

export function applyExpectUiRowChange(
    row: ExpectUiRow,
    part: 'field' | 'op' | 'expected',
    value: string,
): ExpectUiRow {
  if (part === 'field') {
    return {...row, field: value};
  }
  if (part === 'op') {
    return {...row, op: value, explicitOperator: true};
  }
  return {
    ...row,
    expected: value,
    valueKind: detectExpectValueKind(value),
  };
}
