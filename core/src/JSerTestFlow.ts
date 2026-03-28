import {indentLines, timeUnitToMs, toInputsParams} from './JSerHelper';
import {Comparison, ComparisonObject, ExpectMap, ExpectValue, normalizeReportConfig, opsList, ReportConfig, ReportLevel, TestData, TestFlowAssert, TestFlowCall, TestFlowCheck, TestFlowCondition, TestFlowLoop, TestFlowRepeat, TestFlowRun, TestFlowStages, TestFlowStep, TestFlowSteps} from './TestData';
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

/**
 * Parse a comparison string "actual operator expected" where the expected
 * part may contain spaces. Only the first two space-delimited tokens (actual
 * and operator) are split; everything after the operator is the expected value.
 */
const parseComparisonParts = (comp: string): { actual: string; operator: string; expected: string } | null => {
  const trimmed = comp.trim();
  const firstSpace = trimmed.indexOf(' ');
  if (firstSpace === -1) {
    return null;
  }
  const actual = trimmed.slice(0, firstSpace);
  const afterActual = trimmed.slice(firstSpace + 1);
  const secondSpace = afterActual.indexOf(' ');
  if (secondSpace === -1) {
    // "actual operator" with no expected value
    return { actual, operator: afterActual, expected: '' };
  }
  const operator = afterActual.slice(0, secondSpace);
  const expected = afterActual.slice(secondSpace + 1);
  return { actual, operator, expected };
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
  switch (operator) {
    case '<':
      return `less_(\`${actual}\`, \`${expected}\`)`;
    case '>':
      return `greater_(\`${actual}\`, \`${expected}\`)`;
    case '<=':
      return `lessOrEqual_(\`${actual}\`, \`${expected}\`)`;
    case '>=':
      return `greaterOrEqual_(\`${actual}\`, \`${expected}\`)`;
    case '==':
      return `equals_(\`${actual}\`, \`${expected}\`)`;
    case '!=':
      return `notEquals_(\`${actual}\`, \`${expected}\`)`;
    case '=@':
      return `isAt_(\`${actual}\`, \`${expected}\`)`;
    case '!@':
      return `isNotAt_(\`${actual}\`, \`${expected}\`)`;
    case '=~':
      return `matches_(\`${actual}\`, \`${expected}\`)`;
    case '!~':
      return `notMatches_(\`${actual}\`, \`${expected}\`)`;
    case '=^':
      return `startsWith_(\`${actual}\`, \`${expected}\`)`;
    case '!^':
      return `notStartsWith_(\`${actual}\`, \`${expected}\`)`;
    case '=$':
      return `endsWith_(\`${actual}\`, \`${expected}\`)`;
    case '!$':
      return `notEndsWith_(\`${actual}\`, \`${expected}\`)`;
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

export const ifToJSfunc = (condition: TestFlowCondition, useExternalReport: boolean, importTitleMap?: Record<string, string>): string => {
  const cond = typeof condition.if === 'string' ? condition.if : '';
  const conditionStatement = conditionalStatementToJSfunc(cond);
  const thenBlock = flowStepsToJsfunc(condition.steps, true, useExternalReport, importTitleMap);
  const elseBlock =
      condition.else ? flowStepsToJsfunc(condition.else, true, useExternalReport, importTitleMap) : undefined;

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

export const repeatToJSfunc = (loop: TestFlowRepeat, useExternalReport: boolean, importTitleMap?: Record<string, string>): string => {
  const loopCondition = typeof loop.repeat === 'string' ? loop.repeat.trim() :
                                                          String(loop.repeat);
  const loopBody = flowStepsToJsfunc(loop.steps, true, useExternalReport, importTitleMap);

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

export const forToJSfunc = (loop: TestFlowLoop, useExternalReport: boolean, importTitleMap?: Record<string, string>): string => {
  const loopBody = flowStepsToJsfunc(loop.steps, true, useExternalReport, importTitleMap);
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
  const finalActual = typeof actual === 'string' ? toTemplateWithVars(actual) : undefined;
  const finalExpected = typeof expected === 'string' ? toTemplateWithVars(expected) : undefined;
  return `check_(${conditionStatement}, '${type}', ${JSON.stringify(raw)}, '${reportLevel}', ${finalTitle}, ${finalDetails}, ${finalActual}, ${finalExpected});\n`;
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
  // Try to match a known operator at the start of the string
  for (const op of opsList) {
    if (trimmed.startsWith(op + ' ') || trimmed === op) {
      const expected = trimmed.slice(op.length).trim();
      return { operator: op, expected: unquoteEmpty(expected) };
    }
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

const callToJSfunc = (step: TestFlowCall, useExternalReport: boolean, stepIdx: number, importTitleMap?: Record<string, string>): string => {
  let inputParams = toInputsParams(step.inputs || {}, ': ');
  if (inputParams.length > 0) {
    inputParams = ' ' + inputParams + ' ';
  }

  const hasExpect = !!step.expect;
  const safeName = step.call.replace(/[^a-zA-Z0-9_]/g, '_');
  const resultVar = step.id || (hasExpect ? `_${safeName}_${stepIdx}` : undefined);

  let callExpr = `await ${step.call}({${inputParams}});`;
  if (resultVar) {
    callExpr = `const ${resultVar} = ` + callExpr;
  }

  let result = callExpr;

  if (hasExpect) {
    const title = step.title || importTitleMap?.[step.call] || step.call || step.id || 'call';
    const details = `\${JSON.stringify(${resultVar})}`;

    for (const [field, val] of Object.entries(step.expect!)) {
      const values = Array.isArray(val) ? val : [val];
      for (const v of values) {
        const transformed = transformExpectEntry(field, v, resultVar!, title, details, step.report);
        result += '\ncheckAbort_();\n' + comparisonToJSfunc('check', transformed, useExternalReport);
      }
    }
  }

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

export const flowStepsToJsfunc =
    (flow: TestFlowSteps, root: boolean, useExternalReport: boolean = !root, importTitleMap?: Record<string, string>): string => {
      return (flow ?? [])
          .map((step: TestFlowStep, idx: number) => {
            let stepJs: string;
            switch (getTestFlowStepType(step)) {
              case 'call':
                stepJs = callToJSfunc(step as TestFlowCall, useExternalReport, idx, importTitleMap);
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
                stepJs = ifToJSfunc(step as TestFlowCondition, useExternalReport, importTitleMap);
                break;
              case 'repeat':
                stepJs = repeatToJSfunc(step as TestFlowRepeat, useExternalReport, importTitleMap);
                break;
              case 'delay':
                stepJs = delayToJSfunc((step as any).delay);
                break;
              case 'for':
                stepJs = forToJSfunc(step as TestFlowLoop, useExternalReport, importTitleMap);
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
                stepJs = setenvToJSfunc((step as any).setenv, root);
                break;
              default:
                stepJs = '';
                break;
            }
            // Inject cooperative abort check before each step so a stopped
            // test run can bail out between steps.
            return stepJs ? `checkAbort_();\n${stepJs}` : stepJs;
          })
          .join('\n');
    };

export const flowStagesToJsfunc =
    (flow: TestFlowStages, root: boolean, useExternalReport: boolean = !root, importTitleMap?: Record<string, string>): string => {
      if (!flow || flow.length === 0) {
        return '';
      };

      // Collect call step IDs from steps (recursively) so they can be
      // hoisted to the outer scope and shared across stages.
      function collectCallIds(steps: TestFlowSteps): string[] {
        const ids: string[] = [];
        for (const step of (steps ?? [])) {
          const s = step as any;
          if (s.call && typeof s.id === 'string' && s.id) {
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
        let stepsCode = flowStepsToJsfunc(stage.steps ?? [], root, useExternalReport, importTitleMap);
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

export const flowToJsFunc = (testData: TestData, root: boolean, useExternalReport: boolean = !root, importTitleMap?: Record<string, string>): string => {
  let flow = '';
  if (testData.stages && testData.stages.length > 0) {
    flow += flowStagesToJsfunc(testData.stages, root, useExternalReport, importTitleMap);
  } else if (testData.steps && testData.steps.length > 0) {
    flow += flowStepsToJsfunc(testData.steps, root, useExternalReport, importTitleMap);
  }
  return flow;
};