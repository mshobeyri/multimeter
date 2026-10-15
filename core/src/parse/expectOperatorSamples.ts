import {opsList} from '../TestData';

/**
 * Representative expect scalar for each comparison operator (plus common
 * parameterized fuzzy / time forms). Shared by unit tests that assert emit,
 * format, and UI pack keep these unquoted.
 */
export function sampleExpectScalar(op: string): string {
  if (op === '=*' || op === '!*') {
    return `${op} /x/`;
  }
  if (op === '>%' || op === '<%') {
    return `${op} Jon`;
  }
  if (op === '=s~') {
    return '=5s~ 2026-01-01T00:00:00Z';
  }
  if (op === '!s~') {
    return '!5s~ 2026-01-01T00:00:00Z';
  }
  if (op === '>' || op === '>=' || op === '<' || op === '<=' ||
      op === '>#' || op === '>=#' || op === '<#' || op === '<=#' ||
      op === '=#' || op === '!#') {
    return `${op} 2026`;
  }
  return `${op} sample`;
}

/** One sample per opsList entry, then parameterized fuzzy forms. */
export const EXPECT_OPERATOR_SAMPLES: Array<{op: string; value: string}> = [
  ...opsList.map((op) => ({op, value: sampleExpectScalar(op)})),
  {op: '>75%', value: '>75% Jon'},
  {op: '<60%', value: '<60% Jon'},
];
