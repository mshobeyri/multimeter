import { splitCheckOperatorPrefix, unquoteExpectLiteral } from './TestData';

export type ExpectUiValueKind = 'string' | 'number' | 'boolean';

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

export function expectValueToUiRow(field: string, value: unknown): ExpectUiRow {
  if (typeof value === 'number') {
    return {
      field,
      op: '==',
      expected: String(value),
      explicitOperator: false,
      valueKind: 'number',
    };
  }
  if (typeof value === 'boolean') {
    return {
      field,
      op: '==',
      expected: String(value),
      explicitOperator: false,
      valueKind: 'boolean',
    };
  }

  const s = String(value ?? '').trim();
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

  return {
    field,
    op: '==',
    expected: unquoteExpectLiteral(s),
    explicitOperator: false,
    valueKind: 'string',
  };
}

export function uiRowToExpectValue(row: ExpectUiRow): string | number | boolean {
  if (row.op === '==' && !row.explicitOperator) {
    if (row.valueKind === 'number') {
      const n = Number(row.expected);
      if (!Number.isNaN(n)) {
        return n;
      }
    }
    if (row.valueKind === 'boolean') {
      return row.expected === 'true';
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

export function applyExpectUiRowChange(
    row: ExpectUiRow,
    part: 'field' | 'op' | 'expected',
    value: string,
): ExpectUiRow {
  if (part === 'field') {
    return { ...row, field: value };
  }
  if (part === 'op') {
    return { ...row, op: value, explicitOperator: true };
  }
  return { ...row, expected: value };
}
