/**
 * Pure evaluation of API `test.expect` / `test.require` against run outputs.
 * Same operators and field-access rules as call expect/require.
 */

import type {ApiTestBlock} from './APIData';
import {evaluateExpectValue} from './expectCompare';
import {parseExpectValue} from './JSerTestFlow';
import {isOmitSentinel} from './omitKeyword';
import {DEFAULT_OUTPUT_KEYS} from './outputExtractor';
import type {TestStepStatus} from './runConfig';
import type {ExpectMap, ExpectValue, ScalarExpectValue} from './TestData';
import {splitCheckOperatorPrefix} from './TestData';
import {applyValueAccessor} from './variableReplacer';

const DEFAULT_OUTPUT_KEY_SET = new Set(DEFAULT_OUTPUT_KEYS);

export interface ApiTestExpectItem {
  comparison: string;
  actual?: any;
  expected?: any;
  status: TestStepStatus;
  level: 'expect' | 'require';
}

export interface ApiTestEvalResult {
  items: ApiTestExpectItem[];
  hardFailed: boolean;
  softFailed: boolean;
  /** True when there was at least one expect or require entry. */
  hasChecks: boolean;
}

function isExplicitMultiCheckArray(value: unknown): value is ScalarExpectValue[] {
  return Array.isArray(value) &&
      value.length > 0 &&
      value.every(item => typeof item === 'string' || typeof item === 'number' ||
          typeof item === 'boolean') &&
      value.some(item => typeof item === 'string' && !!splitCheckOperatorPrefix(item.trim()));
}

function expectValueToDisplay(value: ExpectValue): string {
  if (isOmitSentinel(value)) {
    return 'omit';
  }
  if (value === null) {
    return 'omit';
  }
  return typeof value === 'string' ? value : JSON.stringify(value);
}

/**
 * Resolve a call-style output field from an API run result object.
 * Default roots (`status`, `body`, …) fall back to `outputs._` like call codegen.
 */
export function resolveApiOutputField(outputs: Record<string, any> | null | undefined, field: string): any {
  if (!outputs || typeof outputs !== 'object') {
    return undefined;
  }
  const normalized = String(field || '');
  if (!normalized) {
    return outputs;
  }
  const dotIndex = normalized.indexOf('.');
  const root = dotIndex >= 0 ? normalized.slice(0, dotIndex) : normalized;
  const accessor = dotIndex >= 0 ? normalized.slice(dotIndex) : '';
  if (DEFAULT_OUTPUT_KEY_SET.has(root)) {
    const base = Object.prototype.hasOwnProperty.call(outputs, root) ?
        outputs[root] :
        (outputs._ ? outputs._[root] : undefined);
    return accessor ? applyValueAccessor(base, accessor) : base;
  }
  return applyValueAccessor(outputs, `.${normalized}`);
}

function expandMapItems(
    map: ExpectMap | undefined,
    level: 'expect' | 'require',
    outputs: Record<string, any>,
    ): ApiTestExpectItem[] {
  if (!map || typeof map !== 'object') {
    return [];
  }
  const items: ApiTestExpectItem[] = [];
  for (const [field, val] of Object.entries(map)) {
    const values = isExplicitMultiCheckArray(val) ? val : [val];
    for (const v of values) {
      const {operator, expected} = parseExpectValue(v as ExpectValue);
      const actual = resolveApiOutputField(outputs, field);
      const displayExpected = isOmitSentinel(v) ? 'omit' : expectValueToDisplay(expected);
      const comparison = `${field} ${operator} ${displayExpected}`;
      const passed = evaluateExpectValue(actual, v as ExpectValue);
      items.push({
        comparison,
        actual,
        expected,
        status: passed ? 'passed' : 'failed',
        level,
      });
    }
  }
  return items;
}

/**
 * Evaluate API file `test.expect` / `test.require` against extracted outputs.
 * Empty / missing test → no checks (hasChecks false).
 */
export function evaluateApiTest(
    outputs: Record<string, any> | null | undefined,
    test: ApiTestBlock | undefined | null,
    ): ApiTestEvalResult {
  const root = outputs && typeof outputs === 'object' ? outputs : {};
  const soft = expandMapItems(test?.expect, 'expect', root);
  const hard = expandMapItems(test?.require, 'require', root);
  const items = [...soft, ...hard];
  return {
    items,
    hardFailed: hard.some(i => i.status === 'failed'),
    softFailed: soft.some(i => i.status === 'failed'),
    hasChecks: items.length > 0,
  };
}
