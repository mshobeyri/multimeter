import {JSONValue} from './CommonData';
import {isOmitSentinel} from './omitKeyword';
import {splitCheckOperatorPrefix, unquoteExpectLiteral} from './TestData';
import {
  inputBoxToYamlValue,
  yamlValueToInputBox,
  yamlValueTypeLabel,
} from './yamlValueConvert';

/** UI type chip for expect rows — same labels as Inputs via yamlValueTypeLabel. */
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
  const label = yamlValueTypeLabel(value);
  switch (label) {
    case 'string':
    case 'number':
    case 'boolean':
    case 'null':
    case 'omit':
    case 'array':
    case 'object':
    case 'undefined':
      return label;
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
