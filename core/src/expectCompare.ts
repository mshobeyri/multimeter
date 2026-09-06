/**
 * Runtime evaluation of check/expect operators (shared by tests and mock match).
 */

import {
  contains_,
  endsWith_,
  equals_,
  equalsAsString_,
  equalsIgnoreCase_,
  fuzzyMatch_,
  greater_,
  greaterOrEqual_,
  isAt_,
  isNotAt_,
  isNotOmitted_,
  isOmitted_,
  lengthEquals_,
  lengthGreater_,
  lengthGreaterOrEqual_,
  lengthLess_,
  lengthLessOrEqual_,
  less_,
  lessOrEqual_,
  matches_,
  notContains_,
  notEndsWith_,
  notEquals_,
  notEqualsAsString_,
  notEqualsIgnoreCase_,
  notFuzzyMatch_,
  notLengthEquals_,
  notMatches_,
  notStartsWith_,
  notTrimEquals_,
  notTrimEqualsIgnoreCase_,
  startsWith_,
  trimEquals_,
  trimEqualsIgnoreCase_,
} from './testHelper';
import {parseExpectValue} from './JSerTestFlow';
import {isFuzzyPercentOperator, isFuzzyPercentSelectOperator, DEFAULT_FUZZY_PERCENT, ExpectValue} from './TestData';
import {isOmitSentinel} from './omitKeyword';
import {applyValueAccessor} from './variableReplacer';

/**
 * Evaluate `actual <op> expected` using the same helpers as generated check/expect code.
 */
export function evaluateComparison(
    actual: any, operator: string, expected: any): boolean {
  if (isOmitSentinel(expected) || expected === null) {
    if (operator === '==') {
      return isOmitted_(actual);
    }
    if (operator === '!=') {
      return isNotOmitted_(actual);
    }
  }

  if (isFuzzyPercentOperator(operator) || isFuzzyPercentSelectOperator(operator)) {
    const percent = isFuzzyPercentOperator(operator)
        ? Number(operator.slice(1, -1))
        : DEFAULT_FUZZY_PERCENT;
    return operator.startsWith('<')
        ? notFuzzyMatch_(actual, expected, percent)
        : fuzzyMatch_(actual, expected, percent);
  }

  switch (operator) {
    case '<':
      return less_(actual, expected);
    case '>':
      return greater_(actual, expected);
    case '<=':
      return lessOrEqual_(actual, expected);
    case '>=':
      return greaterOrEqual_(actual, expected);
    case '==':
      return equals_(actual, expected);
    case '!=':
      return notEquals_(actual, expected);
    case '=i':
      return equalsIgnoreCase_(actual, expected);
    case '!i':
      return notEqualsIgnoreCase_(actual, expected);
    case '=X':
      return trimEquals_(actual, expected);
    case '!X':
      return notTrimEquals_(actual, expected);
    case '=iX':
      return trimEqualsIgnoreCase_(actual, expected);
    case '!iX':
      return notTrimEqualsIgnoreCase_(actual, expected);
    case '=@':
      return isAt_(actual, expected);
    case '!@':
      return isNotAt_(actual, expected);
    case '=C':
      return contains_(actual, expected);
    case '!C':
      return notContains_(actual, expected);
    case '=*':
      return matches_(actual, expected);
    case '!*':
      return notMatches_(actual, expected);
    case '=~':
      return equalsAsString_(actual, expected);
    case '!~':
      return notEqualsAsString_(actual, expected);
    case '=^':
      return startsWith_(actual, expected);
    case '!^':
      return notStartsWith_(actual, expected);
    case '=$':
      return endsWith_(actual, expected);
    case '!$':
      return notEndsWith_(actual, expected);
    case '=#':
      return lengthEquals_(actual, expected);
    case '!#':
      return notLengthEquals_(actual, expected);
    case '<#':
      return lengthLess_(actual, expected);
    case '<=#':
      return lengthLessOrEqual_(actual, expected);
    case '>#':
      return lengthGreater_(actual, expected);
    case '>=#':
      return lengthGreaterOrEqual_(actual, expected);
    default:
      return false;
  }
}

/** Parse an expect/check value and compare against `actual`. */
export function evaluateExpectValue(actual: any, value: ExpectValue): boolean {
  const {operator, expected} = parseExpectValue(value);
  return evaluateComparison(actual, operator, expected);
}

function toAccessor(path: string): string {
  const p = String(path || '');
  if (p.startsWith('.') || p.startsWith('[')) {
    return p;
  }
  return `.${p}`;
}

function isNestedMatchObject(value: unknown): value is Record<string, unknown> {
  return value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      !isOmitSentinel(value);
}

/**
 * Match an expect-style map against a value tree.
 * Keys are dotted paths (`user.name`, `items[0].id`); values use check/expect
 * operators (`!= hi`, `=C token`) or nested maps (same as deep partial ==).
 */
export function matchExpectMap(
    expected: Record<string, any>|undefined|null,
    actual: any,
    options?: {resolvePath?: (path: string, root: any) => any},
): boolean {
  if (!expected || typeof expected !== 'object' || Array.isArray(expected)) {
    return false;
  }
  const resolve = options?.resolvePath ??
      ((path: string, root: any) => applyValueAccessor(root, toAccessor(path)));

  for (const [key, value] of Object.entries(expected)) {
    const atPath = resolve(key, actual);
    if (isNestedMatchObject(value)) {
      if (!matchExpectMap(value, atPath, options)) {
        return false;
      }
      continue;
    }
    if (!evaluateExpectValue(atPath, value as ExpectValue)) {
      return false;
    }
  }
  return true;
}

/** Case-insensitive header map matching (flat keys + operators). */
export function matchHeaderExpectMap(
    expected: Record<string, any>|undefined|null,
    actualHeaders: Record<string, string>|undefined|null,
): boolean {
  if (!expected || typeof expected !== 'object' || Array.isArray(expected)) {
    return false;
  }
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(actualHeaders || {})) {
    lower[k.toLowerCase()] = v;
  }
  return matchExpectMap(expected, actualHeaders || {}, {
    resolvePath: (path) => {
      // Header names are flat; still allow dotted keys if present literally.
      if (Object.prototype.hasOwnProperty.call(actualHeaders || {}, path)) {
        return (actualHeaders as Record<string, string>)[path];
      }
      return lower[path.toLowerCase()];
    },
  });
}
