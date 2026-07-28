import {APIData} from './APIData';
import {apiToJSfunc} from './JSerAPI';
import {durationToJsMsExpr, indentLines, parseDurationString, toInputsParams} from './JSerHelper';
import {Comparison, ComparisonObject, DEFAULT_FUZZY_PERCENT, ExpectMap, ExpectValue, ScalarExpectValue, isFuzzyPercentOperator, isFuzzyPercentSelectOperator, isQuotedExpectLiteral, normalizeReportConfig, opsList, ReportConfig, ReportLevel, splitCheckOperatorPrefix, TestData, TestFlowAssert, TestFlowCall, TestFlowCheck, TestFlowCondition, TestFlowHttp, TestFlowLoop, TestFlowRepeat, TestFlowRun, TestFlowStages, TestFlowStep, TestFlowSteps, unquoteExpectLiteral} from './TestData';
import {getTestFlowStepType} from './testParsePack';
import {DEFAULT_OUTPUT_KEYS} from './outputExtractor';
import {isOmitSentinel, normalizeOmitToNull, OMIT_KEYWORD, OMIT_SENTINEL} from './omitKeyword';
import {replaceEnvTokensPlain, toTemplateWithEnvVars} from './variableReplacer';

function randomName(): string {
  // Generate a random stage name like "stage_xxxxx"
  return 'stage_' + Math.random().toString(36).substr(2, 8);
}

const replaceEnvTokens = replaceEnvTokensPlain;
const toTemplateWithVars = toTemplateWithEnvVars;
const DEFAULT_OUTPUT_KEY_SET = new Set(DEFAULT_OUTPUT_KEYS);

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const comparisonOperatorPattern = [
  '[<>](?:0|[1-9][0-9]?|100)%',
  ...opsList
      .slice()
      .sort((a, b) => b.length - a.length)
      .map(escapeRegExp),
].join('|');

/** Parse a comparison string "actual operator expected" where either side may contain spaces. */
export const parseComparisonParts = (comp: string): { actual: string; operator: string; expected: string } | null => {
  const trimmed = comp.trim();
  const operatorRe = new RegExp(`(?:^|\\s)(${comparisonOperatorPattern})(?=\\s|$)`, 'g');
  let match: RegExpExecArray | null;
  while ((match = operatorRe.exec(trimmed))) {
    const operator = match[1];
    const operatorStart = match.index + match[0].length - operator.length;
    const actual = trimmed.slice(0, operatorStart).trim();
    if (!actual) {
      continue;
    }
    const expected = trimmed.slice(operatorStart + operator.length).trim();
    return { actual, operator, expected };
  }
  return null;
};

const toTemplateArg = (value: string): string => `\`${value}\``;

const toRuntimeArg = (value: string): string => {
  const trimmed = value.trim();
  if (/^\$\{.+\}$/.test(trimmed)) {
    return trimmed.slice(2, -1);
  }
  return toTemplateArg(value);
};

/** Convert a single comparison (no && / ||) into a JS boolean expression. */
const singleComparisonToJSfunc = (check: string): string => {
  const parsed = parseComparisonParts(check);
  if (!parsed) {
    return 'true';
  }
  const { actual, operator } = parsed;
  const expectedRaw = parsed.expected.trim();
  // Bare `omit` (unquoted) is the omit keyword; `"omit"` stays a literal string.
  if (!isQuotedExpectLiteral(expectedRaw) &&
      (expectedRaw === OMIT_KEYWORD || isOmitSentinel(expectedRaw))) {
    if (operator === '==') {
      return `isOmitted_(${toRuntimeArg(actual)})`;
    }
    if (operator === '!=') {
      return `isNotOmitted_(${toRuntimeArg(actual)})`;
    }
  }
  const expected = unquoteExpectLiteral(expectedRaw);
  const actualRuntime = toRuntimeArg(actual);
  const actualTemplate = toTemplateArg(actual);
  const expectedTemplate = toTemplateArg(expected);

  if (isFuzzyPercentOperator(operator) || isFuzzyPercentSelectOperator(operator)) {
    const percent = isFuzzyPercentOperator(operator) ? Number(operator.slice(1, -1)) : DEFAULT_FUZZY_PERCENT;
    const helper = operator.startsWith('<') ? 'notFuzzyMatch_' : 'fuzzyMatch_';
    return `${helper}(${actualTemplate}, ${expectedTemplate}, ${percent})`;
  }
  switch (operator) {
    case '<':
      return `less_(${actualTemplate}, ${expectedTemplate})`;
    case '>':
      return `greater_(${actualTemplate}, ${expectedTemplate})`;
    case '<=':
      return `lessOrEqual_(${actualTemplate}, ${expectedTemplate})`;
    case '>=':
      return `greaterOrEqual_(${actualTemplate}, ${expectedTemplate})`;
    case '==':
      return `equals_(${actualTemplate}, ${expectedTemplate})`;
    case '!=':
      return `notEquals_(${actualTemplate}, ${expectedTemplate})`;
    case '=i':
      return `equalsIgnoreCase_(${actualTemplate}, ${expectedTemplate})`;
    case '!i':
      return `notEqualsIgnoreCase_(${actualTemplate}, ${expectedTemplate})`;
    case '=X':
      return `trimEquals_(${actualTemplate}, ${expectedTemplate})`;
    case '!X':
      return `notTrimEquals_(${actualTemplate}, ${expectedTemplate})`;
    case '=iX':
      return `trimEqualsIgnoreCase_(${actualTemplate}, ${expectedTemplate})`;
    case '!iX':
      return `notTrimEqualsIgnoreCase_(${actualTemplate}, ${expectedTemplate})`;
    case '=@':
      return `isAt_(${actualTemplate}, ${expectedTemplate})`;
    case '!@':
      return `isNotAt_(${actualTemplate}, ${expectedTemplate})`;
    case '=C':
      return `contains_(${actualTemplate}, ${expectedTemplate})`;
    case '!C':
      return `notContains_(${actualTemplate}, ${expectedTemplate})`;
    case '=*':
    case '=~':
      return `matches_(${actualTemplate}, ${expectedTemplate})`;
    case '!*':
    case '!~':
      return `notMatches_(${actualTemplate}, ${expectedTemplate})`;
    case '=^':
      return `startsWith_(${actualTemplate}, ${expectedTemplate})`;
    case '!^':
      return `notStartsWith_(${actualTemplate}, ${expectedTemplate})`;
    case '=$':
      return `endsWith_(${actualTemplate}, ${expectedTemplate})`;
    case '!$':
      return `notEndsWith_(${actualTemplate}, ${expectedTemplate})`;
    case '=#':
      return `lengthEquals_(${actualRuntime}, ${expectedTemplate})`;
    case '!#':
      return `notLengthEquals_(${actualRuntime}, ${expectedTemplate})`;
    case '<#':
      return `lengthLess_(${actualRuntime}, ${expectedTemplate})`;
    case '<=#':
      return `lengthLessOrEqual_(${actualRuntime}, ${expectedTemplate})`;
    case '>#':
      return `lengthGreater_(${actualRuntime}, ${expectedTemplate})`;
    case '>=#':
      return `lengthGreaterOrEqual_(${actualRuntime}, ${expectedTemplate})`;
    default:
      return 'true';
  }
};

export type LogicalJoin = '&&' | '||';

/**
 * Split a condition on top-level `&&` / `||` (whitespace-required).
 * `&&` binds tighter than `||` (standard precedence).
 */
export const parseLogicalCondition = (
  expr: string,
): { clauses: string[]; joins: LogicalJoin[] } => {
  const trimmed = expr.trim();
  if (!trimmed) {
    return { clauses: [], joins: [] };
  }
  // Split OR first (lower precedence), then AND within each OR branch.
  const orParts = trimmed.split(/\s+\|\|\s+/);
  const clauses: string[] = [];
  const joins: LogicalJoin[] = [];
  for (let i = 0; i < orParts.length; i++) {
    const andParts = orParts[i].split(/\s+&&\s+/).map(p => p.trim()).filter(Boolean);
    for (let j = 0; j < andParts.length; j++) {
      if (clauses.length > 0) {
        joins.push(j === 0 ? '||' : '&&');
      }
      clauses.push(andParts[j]);
    }
  }
  return { clauses, joins };
};

export const formatLogicalCondition = (
  clauses: Array<{ actual: string; operator: string; expected: string }>,
  joins: LogicalJoin[],
): string => {
  if (clauses.length === 0) {
    return '';
  }
  let out = `${clauses[0].actual} ${clauses[0].operator} ${clauses[0].expected}`.trim();
  for (let i = 1; i < clauses.length; i++) {
    const join = joins[i - 1] || '&&';
    const c = clauses[i];
    out += ` ${join} ${`${c.actual} ${c.operator} ${c.expected}`.trim()}`;
  }
  return out.trim();
};

export const conditionalStatementToJSfunc = (check: string): string => {
  // Replace env tokens like e:FOO -> envVariables.FOO
  const normalized = replaceEnvTokens(check);
  const { clauses, joins } = parseLogicalCondition(normalized);
  if (clauses.length === 0) {
    return 'true';
  }
  if (clauses.length === 1) {
    return singleComparisonToJSfunc(clauses[0]);
  }
  // Rebuild with standard precedence: group AND chains, join groups with OR.
  const orGroups: string[] = [];
  let currentAnd: string[] = [singleComparisonToJSfunc(clauses[0])];
  for (let i = 0; i < joins.length; i++) {
    const next = singleComparisonToJSfunc(clauses[i + 1]);
    if (joins[i] === '&&') {
      currentAnd.push(next);
    } else {
      orGroups.push(currentAnd.join(' && '));
      currentAnd = [next];
    }
  }
  orGroups.push(currentAnd.join(' && '));
  if (orGroups.length === 1) {
    return orGroups[0];
  }
  return orGroups
    .map(group => (group.includes(' && ') ? `(${group})` : group))
    .join(' || ');
};

interface NormalizedComparison {
  actual: string;
  operator: string;
  expected: ExpectValue;
  title?: string;
  details?: string;
  raw: string;
}

/** Parse the expected side of a comparison string into a typed scalar when possible. */
const parseScalarComparisonExpected = (raw: string): ExpectValue => {
  const trimmed = String(raw ?? '').trim();
  if (trimmed === 'null') {
    return null;
  }
  if (trimmed === 'true') {
    return true;
  }
  if (trimmed === 'false') {
    return false;
  }
  if (trimmed === OMIT_KEYWORD || isOmitSentinel(trimmed)) {
    return OMIT_SENTINEL;
  }
  if (isQuotedExpectLiteral(trimmed)) {
    return unquoteExpectLiteral(trimmed);
  }
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(trimmed)) {
    const num = Number(trimmed);
    if (!Number.isNaN(num)) {
      return num;
    }
  }
  return trimmed;
};

const expectValueToDisplay = (value: ExpectValue): string => {
  if (isOmitSentinel(value)) {
    return 'omit';
  }
  const normalized = normalizeOmitToNull(value);
  return typeof normalized === 'string' ? normalized : JSON.stringify(normalized);
};

const normalizeComparison =
    (comp: Comparison, kind: 'check'|'assert'): NormalizedComparison|null => {
      if (!comp || (typeof comp === 'string' && comp.trim() === '')) {
        return null;
      }
      if (typeof comp === 'string') {
        const parsed = parseComparisonParts(comp);
        if (!parsed) {
          throw new Error(`Invalid ${kind} format: ${comp}`);
        }
        const { actual, operator } = parsed;
        const expected = parseScalarComparisonExpected(parsed.expected);
        const raw = `${actual} ${operator} ${expectValueToDisplay(expected)}`;
        return {actual, operator, expected, raw};
      }

      const actual: unknown = (comp as any).actual;
      const expected: unknown = (comp as any).expected;
      if (typeof (comp as any) !== 'object' || actual === undefined ||
          expected === undefined) {
        throw new Error(
            `Invalid ${kind} object: "actual" and "expected" are required`);
      }
      const operator = (comp as any).operator || '==';
      const actualStr = typeof actual === 'string' ? actual : JSON.stringify(actual, null, 2);
      const expectedValue = isOmitSentinel(expected)
          ? (expected as ExpectValue)
          : (normalizeOmitToNull(expected) as ExpectValue);
      const expectedStr = expectValueToDisplay(expectedValue);
      const raw = `${actualStr} ${operator} ${expectedStr}`;
      const title = typeof (comp as any).title === 'string' ? (comp as any).title : undefined;
      const details = typeof (comp as any).details === 'string' ? (comp as any).details : undefined;
      return {actual: actualStr, operator, expected: expectedValue, raw, title, details};
    };

export const ifToJSfunc = async (condition: TestFlowCondition, useExternalReport: boolean, importTitleMap?: Record<string, string>): Promise<string> => {
  const cond = typeof condition.if === 'string' ? condition.if : '';
  const conditionStatement = conditionalStatementToJSfunc(cond);
  const thenBlock = await flowStepsToJsfunc(condition.steps, true, useExternalReport, importTitleMap);
  const elseBlock =
      condition.else ? await flowStepsToJsfunc(condition.else, true, useExternalReport, importTitleMap) : undefined;

  if (!elseBlock) {
    return `if (${conditionStatement}) {
  ${indentLines(thenBlock)}
}`;
  } else {
    return `if (${conditionStatement}) {
  ${indentLines(thenBlock)}
} else {
  ${indentLines(elseBlock)}
}`;
  }
};

export const repeatToJSfunc = async (loop: TestFlowRepeat, useExternalReport: boolean, importTitleMap?: Record<string, string>): Promise<string> => {
  const loopCondition = typeof loop.repeat === 'string' ? loop.repeat.trim() :
                                                          String(loop.repeat);
  const loopBody = await flowStepsToJsfunc(loop.steps, true, useExternalReport, importTitleMap);

  const durationMs = parseDurationString(loopCondition);
  if (durationMs !== undefined) {
    return `for (const start = Date.now(); Date.now() < start + ${durationMs}; ) {
  ${indentLines(loopBody)}
}`;
  }

  // Default: count-based repeat
  return `for (let i = 0; i < ${loopCondition}; i++) {
  ${indentLines(loopBody)}
}`;
};

/** Max uninterrupted delay wait so Stop can be observed during long delays. */
export const DELAY_ABORT_CHECK_MS = 2000;

/**
 * Generate an awaitable delay that cooperatively checks abort about every 2s.
 * Short delays still wait once; longer ones are split into ≤2s chunks.
 */
export function delayToJSfunc(d: string|number): string {
  // Use a block so locals don't leak; checkAbort_ is the run-scoped helper
  // injected by jsRunner (correct under parallel suite execution).
  return `{
  let __delayLeft = ${durationToJsMsExpr(d)};
  while (__delayLeft > 0) {
    checkAbort_();
    const __wait = Math.min(__delayLeft, ${DELAY_ABORT_CHECK_MS});
    await new Promise(r => setTimeout(r, __wait));
    __delayLeft -= __wait;
  }
}`;
}

export const forToJSfunc = async (loop: TestFlowLoop, useExternalReport: boolean, importTitleMap?: Record<string, string>): Promise<string> => {
  const loopBody = await flowStepsToJsfunc(loop.steps, true, useExternalReport, importTitleMap);
  // Ensure the loop variable is declared with `const` so it is block-scoped.
  // Without a declaration keyword, `for (x of y)` creates an implicit global,
  // which causes race conditions when tests run in parallel (suite without `then`).
  const loopExpr = /^\s*(const|let|var)\s/.test(loop.for) ? loop.for : `const ${loop.for}`;
  return `
for (${loopExpr}) {
  ${indentLines(loopBody)}
}`;
};

export const setToJSfunc = (set: Record<string, any>): string => {
  return `${set} = ${set.value};`;
};


const comparisonToJSfunc = (type: 'check'|'assert', comparison: Comparison, useExternalReport: boolean): string => {
  const normalized = normalizeComparison(comparison, type);
  if (!normalized) {
    return '';
  }
  const {actual, operator, expected, raw, title, details} = normalized;
  // Determine report level: internal (useExternalReport=false, direct run) vs external (useExternalReport=true, imported or in suite)
  const reportCfg = normalizeReportConfig(
    (comparison && typeof comparison === 'object') ? (comparison as any).report : undefined
  );
  const reportLevel = useExternalReport ? reportCfg.external : reportCfg.internal;
  const actualTrimmed = typeof actual === 'string' ? actual.trim() : '';
  const actualRuntimeExpr = actualTrimmed && /^\$\{.+\}$/.test(actualTrimmed)
    ? normalizeRuntimeActualExpression(actualTrimmed.slice(2, -1))
    : undefined;
  const conditionStatement = actualRuntimeExpr
    ? comparisonFromPartsToJSfunc(actualRuntimeExpr, operator, expected)
    : conditionalStatementToJSfunc(raw);
  const finalTitle = typeof title === 'string' ? toTemplateWithVars(title) : undefined;
  const finalDetails = typeof details === 'string' ? toTemplateWithVars(details) : undefined;
  // For actual: if it's a ${...} variable reference, pass the raw JS expression so
  // objects preserve their type; otherwise keep as template literal for plain strings.
  const finalActual = actualRuntimeExpr
    ? actualRuntimeExpr
    : (typeof actual === 'string' ? toTemplateWithVars(actual) : undefined);
  const finalExpected = isOmitSentinel(expected)
    ? JSON.stringify('omit')
    : expectValueToJs(expected);
  // Strip ${...} from comparison display string so UI shows clean field names
  const displayRaw = raw.replace(/\$\{([^}]+)\}/g, '$1').replace(/__MMT_OMIT_KEYWORD__/g, 'omit');
  return `check_(${conditionStatement}, '${type}', ${JSON.stringify(displayRaw)}, '${reportLevel}', ${finalTitle}, ${finalDetails}, ${finalActual}, ${finalExpected});\n`;
};

function normalizeRuntimeActualExpression(expression: string): string {
  const trimmed = String(expression || '').trim();
  if (!trimmed) {
    return trimmed;
  }
  const dotAccessMatch = trimmed.match(/^([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)(.*)$/);
  if (!dotAccessMatch) {
    return trimmed;
  }
  const [, resultVar, root, rest] = dotAccessMatch;
  if (!DEFAULT_OUTPUT_KEY_SET.has(root)) {
    return trimmed;
  }
  return outputAccessExpression(resultVar, `${root}${rest}`);
}

export const checkToJSfunc = (check: Comparison, useExternalReport: boolean): string =>
  comparisonToJSfunc('check', check, useExternalReport);

export const assertToJSfunc = (assert: Comparison, useExternalReport: boolean): string =>
  comparisonToJSfunc('assert', assert, useExternalReport);

/**
 * Parse a single expect value into operator + expected parts.
 * - String starting with a known operator (e.g. '== 200', '!= 500'): split into operator + expected.
 * - Plain string without operator prefix (e.g. 'hello'): defaults to '==' operator.
 * - Number or boolean: converted to string, defaults to '==' operator.
 */
export const parseExpectValue = (value: ExpectValue): { operator: string; expected: ExpectValue } => {
  if (isOmitSentinel(value)) {
    return {operator: '==', expected: null};
  }
  const normalizedValue = normalizeOmitToNull(value);
  if (normalizedValue === null || Array.isArray(normalizedValue) || typeof normalizedValue === 'object') {
    return { operator: '==', expected: normalizedValue };
  }
  if (typeof normalizedValue === 'number' || typeof normalizedValue === 'boolean') {
    return { operator: '==', expected: normalizedValue };
  }
  const trimmed = String(normalizedValue).trim();
  const prefixed = splitCheckOperatorPrefix(trimmed);
  if (prefixed) {
    const expectedRaw = prefixed.expected.trim();
    if (!isQuotedExpectLiteral(expectedRaw) &&
        (expectedRaw === OMIT_KEYWORD || isOmitSentinel(expectedRaw)) &&
        (prefixed.operator === '==' || prefixed.operator === '!=')) {
      return { operator: prefixed.operator, expected: null };
    }
    return { operator: prefixed.operator, expected: unquoteExpectLiteral(expectedRaw) };
  }
  // No operator prefix found → default to equality
  return { operator: '==', expected: isQuotedExpectLiteral(trimmed) ? unquoteExpectLiteral(trimmed) : trimmed };
};

const isExplicitMultiCheckArray = (value: unknown): value is ScalarExpectValue[] => {
  return Array.isArray(value) &&
      value.length > 0 &&
      value.every(item => typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') &&
      value.some(item => typeof item === 'string' && !!splitCheckOperatorPrefix(item.trim()));
};

const expectValueToJs = (value: ExpectValue): string => {
  const normalized = normalizeOmitToNull(value);
  return typeof normalized === 'string' ? toTemplateWithVars(normalized) : JSON.stringify(normalized);
};

const comparisonFromPartsToJSfunc = (actualExpr: string, operator: string, expected: ExpectValue): string => {
  // Only sentinel / null mean omit. The literal string "omit" (from `"omit"`) compares as text.
  if (isOmitSentinel(expected) || expected === null) {
    switch (operator) {
      case '==':
        return `isOmitted_(${actualExpr})`;
      case '!=':
        return `isNotOmitted_(${actualExpr})`;
      default:
        break;
    }
  }
  const expectedExpr = expectValueToJs(expected);
  if (isFuzzyPercentOperator(operator) || isFuzzyPercentSelectOperator(operator)) {
    const percent = isFuzzyPercentOperator(operator) ? Number(operator.slice(1, -1)) : DEFAULT_FUZZY_PERCENT;
    const helper = operator.startsWith('<') ? 'notFuzzyMatch_' : 'fuzzyMatch_';
    return `${helper}(${actualExpr}, ${expectedExpr}, ${percent})`;
  }
  switch (operator) {
    case '<':
      return `less_(${actualExpr}, ${expectedExpr})`;
    case '>':
      return `greater_(${actualExpr}, ${expectedExpr})`;
    case '<=':
      return `lessOrEqual_(${actualExpr}, ${expectedExpr})`;
    case '>=':
      return `greaterOrEqual_(${actualExpr}, ${expectedExpr})`;
    case '==':
      return `equals_(${actualExpr}, ${expectedExpr})`;
    case '!=':
      return `notEquals_(${actualExpr}, ${expectedExpr})`;
    case '=i':
      return `equalsIgnoreCase_(${actualExpr}, ${expectedExpr})`;
    case '!i':
      return `notEqualsIgnoreCase_(${actualExpr}, ${expectedExpr})`;
    case '=X':
      return `trimEquals_(${actualExpr}, ${expectedExpr})`;
    case '!X':
      return `notTrimEquals_(${actualExpr}, ${expectedExpr})`;
    case '=iX':
      return `trimEqualsIgnoreCase_(${actualExpr}, ${expectedExpr})`;
    case '!iX':
      return `notTrimEqualsIgnoreCase_(${actualExpr}, ${expectedExpr})`;
    case '=@':
      return `isAt_(${actualExpr}, ${expectedExpr})`;
    case '!@':
      return `isNotAt_(${actualExpr}, ${expectedExpr})`;
    case '=C':
      return `contains_(${actualExpr}, ${expectedExpr})`;
    case '!C':
      return `notContains_(${actualExpr}, ${expectedExpr})`;
    case '=*':
    case '=~':
      return `matches_(${actualExpr}, ${expectedExpr})`;
    case '!*':
    case '!~':
      return `notMatches_(${actualExpr}, ${expectedExpr})`;
    case '=^':
      return `startsWith_(${actualExpr}, ${expectedExpr})`;
    case '!^':
      return `notStartsWith_(${actualExpr}, ${expectedExpr})`;
    case '=$':
      return `endsWith_(${actualExpr}, ${expectedExpr})`;
    case '!$':
      return `notEndsWith_(${actualExpr}, ${expectedExpr})`;
    case '=#':
      return `lengthEquals_(${actualExpr}, ${expectedExpr})`;
    case '!#':
      return `notLengthEquals_(${actualExpr}, ${expectedExpr})`;
    case '<#':
      return `lengthLess_(${actualExpr}, ${expectedExpr})`;
    case '<=#':
      return `lengthLessOrEqual_(${actualExpr}, ${expectedExpr})`;
    case '>#':
      return `lengthGreater_(${actualExpr}, ${expectedExpr})`;
    case '>=#':
      return `lengthGreaterOrEqual_(${actualExpr}, ${expectedExpr})`;
    default:
      return 'true';
  }
};

/**
 * Transform a single expect map entry into a ComparisonObject.
 * The field key becomes the actual expression (prefixed with resultVar),
 * and the value is parsed for operator + expected.
 */
const transformExpectEntry = (
    field: string, value: ExpectValue, resultVar: string,
    defaultTitle: string, defaultDetails: string,
    report?: ReportLevel | ReportConfig): ComparisonObject => {
  const { operator, expected } = parseExpectValue(value);
  return {
    actual: `\${${resultVar}.${field}}`,
    expected,
    operator,
    title: defaultTitle,
    details: defaultDetails,
    report,
  };
};

const collectHttpOutputPaths = (step: TestFlowHttp): Record<string, string> => {
  const outputs: Record<string, string> = {};
  const addMapKeys = (map: ExpectMap | true | undefined) => {
    if (!map || map === true) {
      return;
    }
    for (const key of Object.keys(map)) {
      const root = key.split('.', 1)[0];
      if (DEFAULT_OUTPUT_KEY_SET.has(root) || root === '_') {
        continue;
      }
      outputs[key] = key;
    }
  };
  for (const [key, value] of Object.entries(step.outputs || {})) {
    outputs[key] = value;
  }
  addMapKeys(step.expect);
  addMapKeys(step.debug);
  return outputs;
};

const httpStepToApiData = (step: TestFlowHttp): APIData => ({
  type: 'api',
  title: step.title,
  outputs: collectHttpOutputPaths(step),
  url: step.http || '',
  query: step.query,
  protocol: 'http',
  format: step.format,
  method: step.method || 'get',
  timeout: step.timeout,
  headers: step.headers,
  body: step.body,
});

const appendExpectAndDebugChecks = (
    result: string, step: {expect?: ExpectMap; debug?: ExpectMap | true; report?: ReportLevel | ReportConfig; title?: string; id?: string},
  resultVar: string | undefined, title: string, useExternalReport: boolean,
  actualForField: (resultVar: string, field: string) => string = outputAccessExpression): string => {
  if (!resultVar) {
    return result;
  }
  if (step.expect) {
    const details = `\${JSON.stringify(${resultVar})}`;
    const reportCfg = normalizeReportConfig(step.report);
    const reportLevel = useExternalReport ? reportCfg.external : reportCfg.internal;
    const finalTitle = toTemplateWithVars(title);
    const finalDetails = toTemplateWithVars(details);

    const expectItems: string[] = [];
    for (const [field, val] of Object.entries(step.expect)) {
      const values = isExplicitMultiCheckArray(val) ? val : [val];
      for (const v of values) {
        const { operator, expected } = parseExpectValue(v);
        const actualExpr = actualForField(resultVar, field);
        const displayExpected = isOmitSentinel(v) ? 'omit' : expectValueToDisplay(expected);
        const displayComparison = `${field} ${operator} ${displayExpected}`;
        const conditionStatement = comparisonFromPartsToJSfunc(actualExpr, operator, expected);
        const expectedExpr = expectValueToJs(expected);
        expectItems.push(
          `  { passed: ${conditionStatement}, comparison: ${JSON.stringify(displayComparison)}, actual: ${actualExpr}, expected: ${expectedExpr} }`
        );
      }
    }

    result += '\ncheckAbort_();\n';
    result += `checkExpects_([\n${expectItems.join(',\n')}\n], 'check', '${reportLevel}', ${finalTitle}, ${finalDetails});\n`;
  }

  if (step.debug) {
    const details = `\${JSON.stringify(${resultVar})}`;
    const finalTitle = toTemplateWithVars(title);
    const finalDetails = toTemplateWithVars(details);

    if (step.debug === true) {
      result += '\ncheckAbort_();\n';
      result += `checkExpects_(Object.keys(${resultVar}).filter(k => k !== '_').map(k => ({ passed: true, comparison: k + ' = ' + JSON.stringify(${resultVar}[k]), actual: ${resultVar}[k], expected: undefined })), 'debug', 'all', ${finalTitle}, ${finalDetails});\n`;
    } else {
      const debugItems: string[] = [];
      for (const [field, val] of Object.entries(step.debug as Record<string, any>)) {
        const values = isExplicitMultiCheckArray(val) ? val : [val];
        for (const v of values) {
          const { operator, expected } = parseExpectValue(v);
          const actualExpr = actualForField(resultVar, field);
          const displayExpected = isOmitSentinel(v) ? 'omit' : expectValueToDisplay(expected);
          const displayComparison = `${field} ${operator} ${displayExpected}`;
          const conditionStatement = comparisonFromPartsToJSfunc(actualExpr, operator, expected);
          const expectedExpr = expectValueToJs(expected);
          debugItems.push(
            `  { passed: ${conditionStatement}, comparison: ${JSON.stringify(displayComparison)}, actual: ${actualExpr}, expected: ${expectedExpr} }`
          );
        }
      }

      result += '\ncheckAbort_();\n';
      result += `checkExpects_([\n${debugItems.join(',\n')}\n], 'debug', 'all', ${finalTitle}, ${finalDetails});\n`;
    }
  }

  return result;
};

function outputAccessExpression(resultVar: string, field: string): string {
  const normalized = String(field || '');
  if (!normalized) {
    return resultVar;
  }
  const dotIndex = normalized.indexOf('.');
  const root = dotIndex >= 0 ? normalized.slice(0, dotIndex) : normalized;
  const accessor = dotIndex >= 0 ? normalized.slice(dotIndex) : '';
  if (DEFAULT_OUTPUT_KEY_SET.has(root)) {
    const rootLiteral = JSON.stringify(root);
    const base = `(Object.prototype.hasOwnProperty.call(${resultVar}, ${rootLiteral}) ? ${resultVar}[${rootLiteral}] : (${resultVar}._ ? ${resultVar}._[${rootLiteral}] : undefined))`;
    return accessor ? `__mmt_access(${base}, ${JSON.stringify(accessor)})` : base;
  }
  return `${resultVar}.${normalized}`;
}

const callToJSfunc = async (step: TestFlowCall, useExternalReport: boolean, stepIdx: number, importTitleMap?: Record<string, string>): Promise<string> => {
  // Guard against incomplete/partial YAML (e.g. `- call:` while the user is typing)
  // where `step.call` is null/undefined. Emit nothing so code generation doesn't crash.
  if (typeof step.call !== 'string' || !step.call.trim()) {
    return '';
  }
  let inputParams = toInputsParams(step.inputs || {}, ': ');
  if (inputParams.length > 0) {
    inputParams = ' ' + inputParams + ' ';
  }

  const hasExpect = !!step.expect;
  const hasDebug = !!step.debug;
  const callName = step.call || step.title || step.id || 'call';
  const safeName = callName.replace(/[^a-zA-Z0-9_]/g, '_') || 'call';
  const resultVar = step.id || ((hasExpect || hasDebug) ? `_${safeName}_${stepIdx}` : undefined);
  let callExpr = `await ${step.call}({${inputParams}});`;
  if (resultVar) {
    callExpr = `const ${resultVar} = ` + callExpr;
  }

  let result = callExpr;
  const title = step.title || importTitleMap?.[step.call] || step.call || step.id || 'call';
  result = appendExpectAndDebugChecks(result, step, resultVar, title, useExternalReport);

  return result;
};

const httpToJSfunc = async (step: TestFlowHttp, useExternalReport: boolean, stepIdx: number): Promise<string> => {
  if (typeof step.http !== 'string' || !step.http.trim()) {
    return '';
  }
  const hasExpect = !!step.expect;
  const hasDebug = !!step.debug;
  const resultVar = step.id || ((hasExpect || hasDebug) ? `_http_${stepIdx}` : undefined);
  const httpFunctionName = `__http_${stepIdx}`;
  const httpFunction = await apiToJSfunc({
    api: httpStepToApiData(step),
    name: httpFunctionName,
    inputs: {},
    envVars: {},
    reportOutputKeys: Object.keys(step.outputs || {}),
  }) + '\n';
  let callExpr = `await ${httpFunctionName}({});`;
  if (resultVar) {
    callExpr = `const ${resultVar} = ` + callExpr;
  }
  let result = httpFunction + callExpr;
  if (resultVar) {
    result += `
if (!${resultVar}._ || typeof ${resultVar}._ !== 'object') {
  ${resultVar}._ = {};
}
${resultVar}._.stepKind = 'http';
try {
  if (typeof ${resultVar}.body === 'string') {
    ${resultVar}.body = JSON.parse(${resultVar}.body);
  }
  if (${resultVar}._ && typeof ${resultVar}._.body === 'string') {
    ${resultVar}._.body = JSON.parse(${resultVar}._.body);
  }
} catch {}`;
  }
  const title = step.title || step.id || `${step.method || 'get'} ${step.http}`;
  result = appendExpectAndDebugChecks(
      result, step, resultVar, title, useExternalReport);
  return result;
};

const varToJSfunc = (key: string, step: any): string => {
  return Object.entries(step)
      .map(([varName, value]) => {
        if (typeof value === 'string') {
          return `${key}${varName} = \`${value}\`;`;
        } else {
          return `${key}${varName} = ${value};`;
        }
      })
      .join('\n');
};

export const setenvToJSfunc = (setenv: Record<string, any>, root: boolean): string => {
  // setenv only takes effect when running the test directly (root=true),
  // not when imported into another test or suite
  if (!root) {
    return '';
  }
  const entries = Object.entries(setenv || {});
  if (entries.length === 0) {
    return '';
  }
  return entries
      .map(([envKey, outputKeyOrValue]) => {
        const valueExpr = typeof outputKeyOrValue === 'string' ?
            toTemplateWithVars(outputKeyOrValue) :
            JSON.stringify(outputKeyOrValue);
        return `setenv_(${JSON.stringify(envKey)}, ${valueExpr});`;
      })
      .join('\n');
};

export const runToJSfunc = (step: TestFlowRun): string => {
  const alias = step.run;
  if (!alias) {
    return '';
  }
  // startServer_ is a runtime helper that starts the imported server.
  // The alias is a variable that was assigned by the import system:
  // const mock = mock_server_;  // where mock_server_ = "/path/to/server.mmt"
  // So we emit the alias as a variable reference, not a string literal.
  return `await startServer_(${alias});`;
};

export const flowStepsToJsfunc = async (
    flow: TestFlowSteps, root: boolean, useExternalReport: boolean = !root,
  importTitleMap?: Record<string, string>, emitSetenv: boolean = root): Promise<string> => {
      const generated: string[] = [];
      for (let idx = 0; idx < (flow ?? []).length; idx++) {
            const step = (flow ?? [])[idx];
            let stepJs: string;
            switch (getTestFlowStepType(step)) {
              case 'call':
                stepJs = await callToJSfunc(step as TestFlowCall, useExternalReport, idx, importTitleMap);
                break;
              case 'http':
                stepJs = await httpToJSfunc(step as TestFlowHttp, useExternalReport, idx);
                break;
              case 'run':
                stepJs = runToJSfunc(step as TestFlowRun);
                break;
              case 'check':
                stepJs = checkToJSfunc((step as TestFlowCheck).check, useExternalReport);
                break;
              case 'assert':
                stepJs = assertToJSfunc((step as TestFlowAssert).assert, useExternalReport);
                break;
              case 'if':
                stepJs = await ifToJSfunc(step as TestFlowCondition, useExternalReport, importTitleMap);
                break;
              case 'repeat':
                stepJs = await repeatToJSfunc(step as TestFlowRepeat, useExternalReport, importTitleMap);
                break;
              case 'delay':
                stepJs = delayToJSfunc((step as any).delay);
                break;
              case 'for':
                stepJs = await forToJSfunc(step as TestFlowLoop, useExternalReport, importTitleMap);
                break;
              case 'js':
                stepJs = (step as any).js;
                break;
              case 'print':
                if (root) {
                  stepJs = `console.log(\`${(step as any).print}\`);`;
                } else {
                  stepJs = `console.debug(\`${(step as any).print}\`);`;
                }
                break;
              case 'set':
                stepJs = varToJSfunc('', (step as any).set);
                break;
              case 'var':
                stepJs = varToJSfunc('var ', (step as any).var);
                break;
              case 'const':
                stepJs = varToJSfunc('const ', (step as any).const);
                break;
              case 'let':
                stepJs = varToJSfunc('let ', (step as any).let);
                break;
              case 'setenv':
                stepJs = setenvToJSfunc((step as any).setenv, emitSetenv);
                break;
              default:
                stepJs = '';
                break;
            }
            // Inject cooperative abort check before each step so a stopped
            // test run can bail out between steps.
            generated.push(stepJs ? `checkAbort_();\n${stepJs}` : stepJs);
          }
      return generated.join('\n');
    };

export const flowStagesToJsfunc = async (
    flow: TestFlowStages, root: boolean, useExternalReport: boolean = !root,
  importTitleMap?: Record<string, string>, emitSetenv: boolean = root): Promise<string> => {
      if (!Array.isArray(flow) || flow.length === 0) {
        return '';
      };

      // Collect call step IDs from steps (recursively) so they can be
      // hoisted to the outer scope and shared across stages.
      function collectCallIds(steps: TestFlowSteps): string[] {
        const ids: string[] = [];
        for (const step of (steps ?? [])) {
          const s = step as any;
          if ((s.call || s.http) && typeof s.id === 'string' && s.id) {
            ids.push(s.id);
          }
          if (Array.isArray(s.steps)) {
            ids.push(...collectCallIds(s.steps));
          }
          if (Array.isArray(s.else)) {
            ids.push(...collectCallIds(s.else));
          }
        }
        return ids;
      }

      const hoistedIds = new Set<string>();
      for (const stage of flow) {
        for (const id of collectCallIds(stage.steps ?? [])) {
          hoistedIds.add(id);
        }
      }

      // Map stage name to its code and dependencies
      const stageMap = new Map < string, {
        code: string;
        dependsOn?: string[]
      }
      > ();

      for (const stage of flow) {
        const stageName = stage.id || randomName();
        const dependsOn = Array.isArray(stage.after) ? stage.after :
            stage.after                              ? [stage.after] :
                                                            [];
        // Build stage code with optional early-return condition
        let code = '';
        if (stage.condition && String(stage.condition).trim().length > 0) {
          const cond = conditionalStatementToJSfunc(String(stage.condition));
          code += `if (!(${cond})) {\n  return;\n}\n`;
        }
        let stepsCode = await flowStepsToJsfunc(stage.steps ?? [], root, useExternalReport, importTitleMap, emitSetenv);
        // Replace const declarations for hoisted IDs with assignments
        for (const id of hoistedIds) {
          stepsCode = stepsCode.replace(`const ${id} = `, `${id} = `);
        }
        code += stepsCode;
        stageMap.set(stageName, {code, dependsOn});
      }

      // Validate that all `after` dependencies reference existing stage IDs
      const allStageIds = new Set(stageMap.keys());
      for (const [stageName, stage] of stageMap) {
        if (stage.dependsOn) {
          for (const dep of stage.dependsOn) {
            if (!allStageIds.has(dep)) {
              throw new Error(
                  `Stage "${stageName}": after references "${dep}" which is not a valid stage id`);
            }
          }
        }
      }

      // Helper to generate code for each stage with dependency handling
      const generated: string[] = [];

      // Hoist call step IDs to the outer scope so dependent stages can
      // access results from earlier stages (e.g. condition: ${doLogin.status_code} == 200).
      for (const id of hoistedIds) {
        generated.push(`let ${id};`);
      }

      const launched = new Set<string>();
      const processed = new Set<string>();

      function genStage(stageName: string) {
        if (processed.has(stageName)) {
          return;
        }
        const stage = stageMap.get(stageName);
        if (!stage) {
          return;
        }
        // Ensure dependencies are processed first
        if (stage.dependsOn && stage.dependsOn.length > 0) {
          for (const dep of stage.dependsOn) {
            genStage(dep);
          }
          // Wait for dependencies before launching this stage
          generated.push(`await Promise.all([${
              stage.dependsOn.map(dep => `${dep}Promise`).join(', ')}]);`);
        }
        // Launch this stage as a promise
        generated.push(`const ${stageName}Promise = (async () => {${
            indentLines(stage.code)}})();`);
        launched.add(stageName);
        processed.add(stageName);
      }

      // Launch all stages
      for (const stageName of stageMap.keys()) {
        genStage(stageName);
      }

      // Wait for all launched stages to finish
      generated.push(`await Promise.all([${
          Array.from(launched).map(name => `${name}Promise`).join(', ')}]);`);

      return generated.join('\n');
    };

export const flowToJsFunc = async (testData: TestData, root: boolean, useExternalReport: boolean = !root, importTitleMap?: Record<string, string>, emitSetenv: boolean = root): Promise<string> => {
  let flow = '';
  if (Array.isArray(testData.stages) && testData.stages.length > 0) {
    flow += await flowStagesToJsfunc(testData.stages, root, useExternalReport, importTitleMap, emitSetenv);
  } else if (Array.isArray(testData.steps) && testData.steps.length > 0) {
    flow += await flowStepsToJsfunc(testData.steps, root, useExternalReport, importTitleMap, emitSetenv);
  }
  return flow;
};