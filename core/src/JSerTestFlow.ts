import {APIData} from './APIData';
import {apiToJSfunc} from './JSerAPI';
import {indentLines, timeUnitToMs, toInputsParams} from './JSerHelper';
import {Comparison, ComparisonObject, DEFAULT_FUZZY_PERCENT, ExpectMap, ExpectValue, isFuzzyPercentOperator, isFuzzyPercentSelectOperator, normalizeReportConfig, opsList, ReportConfig, ReportLevel, splitCheckOperatorPrefix, TestData, TestFlowAssert, TestFlowCall, TestFlowCheck, TestFlowCondition, TestFlowHttp, TestFlowLoop, TestFlowRepeat, TestFlowRun, TestFlowStages, TestFlowStep, TestFlowSteps} from './TestData';
import {getTestFlowStepType} from './testParsePack';
import {replaceEnvTokensPlain, toTemplateWithEnvVars} from './variableReplacer';

function randomName(): string {
  // Generate a random stage name like "stage_xxxxx"
  return 'stage_' + Math.random().toString(36).substr(2, 8);
}

const replaceEnvTokens = replaceEnvTokensPlain;
const toTemplateWithVars = toTemplateWithEnvVars;

/** Strip empty-string markers: '' and "" both mean empty string in comparison expressions. */
const unquoteEmpty = (s: string): string => {
  const t = s.trim();
  if (t === "''" || t === '""') { return ''; }
  return t;
};

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const comparisonOperatorPattern = [
  '[=!](?:0|[1-9][0-9]?|100)%',
  ...opsList
      .slice()
      .sort((a, b) => b.length - a.length)
      .map(escapeRegExp),
].join('|');

/** Parse a comparison string "actual operator expected" where either side may contain spaces. */
const parseComparisonParts = (comp: string): { actual: string; operator: string; expected: string } | null => {
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

export const conditionalStatementToJSfunc = (check: string): string => {
  // Replace env tokens like e:FOO -> envVariables.FOO
  const normalized = replaceEnvTokens(check);
  const parsed = parseComparisonParts(normalized);
  if (!parsed) {
    return 'true';
  }
  const { actual, operator } = parsed;
  const expected = unquoteEmpty(parsed.expected);
  const actualTemplate = toTemplateArg(actual);
  const expectedTemplate = toTemplateArg(expected);
  if (isFuzzyPercentOperator(operator) || isFuzzyPercentSelectOperator(operator)) {
    const percent = isFuzzyPercentOperator(operator) ? Number(operator.slice(1, -1)) : DEFAULT_FUZZY_PERCENT;
    const helper = operator.startsWith('!') ? 'notFuzzyMatch_' : 'fuzzyMatch_';
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
      return `lengthEquals_(${toRuntimeArg(actual)}, ${expectedTemplate})`;
    case '!#':
      return `notLengthEquals_(${toRuntimeArg(actual)}, ${expectedTemplate})`;
    default:
      return 'true';
  }
};

interface NormalizedComparison {
  actual: string;
  operator: string;
  expected: string;
  title?: string;
  details?: string;
  raw: string;
}

const normalizeComparison =
    (comp: Comparison, kind: 'check'|'assert'): NormalizedComparison|null => {
      if (!comp || (typeof comp === 'string' && comp.trim() === '')) {
        return null;
      }
      if (typeof comp === 'string') {
        const raw = comp;
        const parsed = parseComparisonParts(comp);
        if (!parsed) {
          throw new Error(`Invalid ${kind} format: ${comp}`);
        }
        const { actual, operator } = parsed;
        const expected = unquoteEmpty(parsed.expected);
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
      const expectedStr = typeof expected === 'string' ? expected : JSON.stringify(expected, null, 2);
      const raw = `${actualStr} ${operator} ${expectedStr}`;
      const title = typeof (comp as any).title === 'string' ? (comp as any).title : undefined;
      const details = typeof (comp as any).details === 'string' ? (comp as any).details : undefined;
      return {actual: actualStr, operator, expected: expectedStr, raw, title, details};
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

  // Check for time-based repeat
  const timeMatch = loopCondition.match(/^(\d+(?:\.\d+)?)(ns|ms|s|m|h)$/);
  if (timeMatch) {
    const value = parseFloat(timeMatch[1]);
    const unit = timeMatch[2];
    const durationMs = timeUnitToMs(value, unit);
    return `for (const start = Date.now(); Date.now() < start + ${
        durationMs}; ) {
  ${indentLines(loopBody)}
}`;
  }

  // Default: count-based repeat
  return `for (let i = 0; i < ${loopCondition}; i++) {
  ${indentLines(loopBody)}
}`;
};

export function delayToJSfunc(d: string|number): string {
  const val = typeof d === 'number' ? String(d) : String(d).trim();
  let msExpr = '0';
  const m = val.match(/^(\d+(?:\.\d+)?)(ns|ms|s|m|h)?$/);
  if (m) {
    const num = parseFloat(m[1]);
    const unit = m[2] || 'ms';
    msExpr = String(timeUnitToMs(num, unit));
  } else {
    msExpr = `(function(x){
      const s = String(x).trim();
      const mm = s.match(/^(\\d+(?:\\.\\d+)?)(ns|ms|s|m|h)?$/);
      if(!mm) return Number(s)||0;
      const n = parseFloat(mm[1]);
      const u = mm[2]||'ms';
      return u==='ns'? n/1e6 : u==='ms'? n : u==='s'? n*1000 : u==='m'? n*60000 : n*3600000;
    })(${val})`;
  }
  return `await new Promise(r => setTimeout(r, ${msExpr}));`;
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
  const {actual, expected, raw, title, details} = normalized;
  // Determine report level: internal (useExternalReport=false, direct run) vs external (useExternalReport=true, imported or in suite)
  const reportCfg = normalizeReportConfig(
    (comparison && typeof comparison === 'object') ? (comparison as any).report : undefined
  );
  const reportLevel = useExternalReport ? reportCfg.external : reportCfg.internal;
  const conditionStatement = conditionalStatementToJSfunc(raw);
  const finalTitle = typeof title === 'string' ? toTemplateWithVars(title) : undefined;
  const finalDetails = typeof details === 'string' ? toTemplateWithVars(details) : undefined;
  // For actual: if it's a ${...} variable reference, pass the raw JS expression so
  // objects preserve their type; otherwise keep as template literal for plain strings.
  const actualTrimmed = typeof actual === 'string' ? actual.trim() : '';
  const finalActual = actualTrimmed && /^\$\{.+\}$/.test(actualTrimmed)
    ? actualTrimmed.slice(2, -1)
    : (typeof actual === 'string' ? toTemplateWithVars(actual) : undefined);
  const finalExpected = typeof expected === 'string' ? toTemplateWithVars(expected) : undefined;
  // Strip ${...} from comparison display string so UI shows clean field names
  const displayRaw = raw.replace(/\$\{([^}]+)\}/g, '$1');
  return `check_(${conditionStatement}, '${type}', ${JSON.stringify(displayRaw)}, '${reportLevel}', ${finalTitle}, ${finalDetails}, ${finalActual}, ${finalExpected});\n`;
};

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
export const parseExpectValue = (value: ExpectValue): { operator: string; expected: string } => {
  if (typeof value === 'number' || typeof value === 'boolean') {
    return { operator: '==', expected: String(value) };
  }
  const trimmed = String(value).trim();
  const prefixed = splitCheckOperatorPrefix(trimmed);
  if (prefixed) {
    return { operator: prefixed.operator, expected: unquoteEmpty(prefixed.expected) };
  }
  // No operator prefix found → default to equality
  return { operator: '==', expected: trimmed };
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
  const outputs: Record<string, string> = {
    body: 'body',
    headers: 'headers',
    cookies: 'cookies',
    status: 'status',
    duration: 'duration',
  };
  const addMapKeys = (map: ExpectMap | true | undefined) => {
    if (!map || map === true) {
      return;
    }
    for (const key of Object.keys(map)) {
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
  headers: step.headers,
  body: step.body,
});

const appendExpectAndDebugChecks = (
    result: string, step: {expect?: ExpectMap; debug?: ExpectMap | true; report?: ReportLevel | ReportConfig; title?: string; id?: string},
  resultVar: string | undefined, title: string, useExternalReport: boolean,
  actualForField: (resultVar: string, field: string) => string = (rv, field) => `${rv}.${field}`): string => {
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
      const values = Array.isArray(val) ? val : [val];
      for (const v of values) {
        const { operator, expected } = parseExpectValue(v);
        const actualExpr = actualForField(resultVar, field);
        const raw = `\${${actualExpr}} ${operator} ${expected}`;
        const displayComparison = `${field} ${operator} ${expected}`;
        const conditionStatement = conditionalStatementToJSfunc(raw);
        const expectedExpr = typeof expected === 'string' ? toTemplateWithVars(expected) : JSON.stringify(expected);
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
        const values = Array.isArray(val) ? val : [val];
        for (const v of values) {
          const { operator, expected } = parseExpectValue(v);
          const actualExpr = actualForField(resultVar, field);
          const raw = `\${${actualExpr}} ${operator} ${expected}`;
          const displayComparison = `${field} ${operator} ${expected}`;
          const conditionStatement = conditionalStatementToJSfunc(raw);
          const expectedExpr = typeof expected === 'string' ? toTemplateWithVars(expected) : JSON.stringify(expected);
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
  const httpFunction = await apiToJSfunc({api: httpStepToApiData(step), name: httpFunctionName, inputs: {}, envVars: {}}) + '\n';
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
} catch {}`;
  }
  const title = step.title || step.id || `${step.method || 'get'} ${step.http}`;
  result = appendExpectAndDebugChecks(
      result, step, resultVar, title, useExternalReport,
      (rv, field) => `${rv}[${JSON.stringify(field)}]`);
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
      if (!flow || flow.length === 0) {
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
  if (testData.stages && testData.stages.length > 0) {
    flow += await flowStagesToJsfunc(testData.stages, root, useExternalReport, importTitleMap, emitSetenv);
  } else if (testData.steps && testData.steps.length > 0) {
    flow += await flowStepsToJsfunc(testData.steps, root, useExternalReport, importTitleMap, emitSetenv);
  }
  return flow;
};