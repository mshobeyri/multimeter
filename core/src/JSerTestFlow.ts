import {indentLines, timeUnitToMs, toInputsParams} from './JSerHelper';
import {Comparison, ComparisonObject, normalizeReportConfig, ReportConfig, ReportLevel, TestData, TestFlowAssert, TestFlowCall, TestFlowCheck, TestFlowCondition, TestFlowLoop, TestFlowRepeat, TestFlowRun, TestFlowStages, TestFlowStep, TestFlowSteps} from './TestData';
import {getTestFlowStepType} from './testParsePack';
import {replaceEnvTokensPlain, toTemplateWithEnvVars} from './variableReplacer';

/** Metadata about an imported file, keyed by import alias. */
export interface CallTitleMeta {
  fileTitle?: string;
  fileName?: string;
}

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

export const conditionalStatementToJSfunc = (check: string): string => {
  // Replace env tokens like e:FOO -> envVariables.FOO
  const normalized = replaceEnvTokens(check);
  const checkParts = normalized.split(' ');
  if (checkParts.length !== 3) {
    return 'true';
  }
  const [actual, operator, rawExpected] = checkParts;
  const expected = unquoteEmpty(rawExpected);
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
      throw new Error(`${check}: Unknown operator: ${operator}`);
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
        const parts = comp.split(' ');
        if (parts.length < 2 || parts.length > 3) {
          throw new Error(`Invalid ${kind} format: ${comp}`);
        }
        const actual = parts[0];
        const operator = parts[1];
        const expected = unquoteEmpty(parts[2] ?? '');
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

export const ifToJSfunc = (condition: TestFlowCondition, callMeta?: Record<string, CallTitleMeta>): string => {
  const cond = typeof condition.if === 'string' ? condition.if : '';
  const conditionStatement = conditionalStatementToJSfunc(cond);
  const thenBlock = flowStepsToJsfunc(condition.steps, true, true, callMeta);
  const elseBlock =
      condition.else ? flowStepsToJsfunc(condition.else, true, true, callMeta) : undefined;

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

export const repeatToJSfunc = (loop: TestFlowRepeat, callMeta?: Record<string, CallTitleMeta>): string => {
  const loopCondition = typeof loop.repeat === 'string' ? loop.repeat.trim() :
                                                          String(loop.repeat);
  const loopBody = flowStepsToJsfunc(loop.steps, true, true, callMeta);

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

export const forToJSfunc = (loop: TestFlowLoop, callMeta?: Record<string, CallTitleMeta>): string => {
  const loopBody = flowStepsToJsfunc(loop.steps, true, true, callMeta);
  return `
for (${loop.for}) {
  ${indentLines(loopBody)}
}`;
};

export const setToJSfunc = (set: Record<string, any>): string => {
  return `${set} = ${set.value};`;
};


const comparisonToJSfunc = (type: 'check'|'assert', comparison: Comparison, useExternalReport: boolean): string => {
  const label = type === 'check' ? 'Check' : 'Assert';
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
  const conditionStatement = conditionalStatementToJSfunc(raw);
  const titlePart = title ? `"${title}" - ` : '';
  const failMessage =
      `${label} ${titlePart}"${raw}" failed, as ${actual} ${operator} ${expected} is false`;
  const successMessage = `${label} ${titlePart}"${raw}" passed`;
  const detailsPart = details ? `\n${details}` : '';
  const finaFaillMsg = `${failMessage}${detailsPart}`;
  const finaSuccessMsg = `${successMessage}`;
  const finalTitle = typeof title === 'string' ? toTemplateWithVars(title) : undefined;
  const finalDetails = typeof details === 'string' ? toTemplateWithVars(details) : undefined;
  const finalActual = typeof actual === 'string' ? toTemplateWithVars(actual) : undefined;
  const finalExpected = typeof expected === 'string' ? toTemplateWithVars(expected) : undefined;
  // Report on success only if level is 'all'
  const reportOnSuccess = reportLevel === 'all';
  // Report on fail unless level is 'none'
  const reportOnFail = reportLevel !== 'none';
  // Log levels follow report policy:
  //   none  → fail: debug, success: trace
  //   fails → fail: error, success: debug
  //   all   → fail: error, success: info
  const failLogFn = reportLevel === 'none' ? 'console.debug' : 'console.error';
  const successLogFn = reportLevel === 'all' ? 'console.log' :
      reportLevel === 'fails' ? 'console.debug' : 'console.trace';
  const throwOnFail = type === 'assert' ? `\n  throw new Error("Assertion failed");` : '';
  return `if (${conditionStatement}) {
  ${successLogFn}(${toTemplateWithVars(finaSuccessMsg)});
  ${reportOnSuccess ? `report_('${type}', ${JSON.stringify(raw)}, ${finalTitle}, ${finalDetails}, true);` : ''}
} else {
  ${failLogFn}(${toTemplateWithVars(finaFaillMsg)});
  ${reportOnFail ? `report_('${type}', ${JSON.stringify(raw)}, ${finalTitle}, ${finalDetails}, false, ${finalActual}, ${finalExpected});` : ''}${throwOnFail}
}\n`;
};

export const checkToJSfunc = (check: Comparison, useExternalReport: boolean): string =>
  comparisonToJSfunc('check', check, useExternalReport);

export const assertToJSfunc = (assert: Comparison, useExternalReport: boolean): string =>
  comparisonToJSfunc('assert', assert, useExternalReport);

/**
 * Build a ComparisonObject from an inline call check/assert comparison,
 * prefixing the actual expression with the call result variable.
 * Uses ${resultVar.field} so the value evaluates at runtime inside template literals.
 */
const transformCallComparison = (
    comp: Comparison, resultVar: string, defaultTitle: string,
    defaultDetails: string, report?: ReportLevel | ReportConfig): ComparisonObject => {
  if (typeof comp === 'string') {
    const parts = comp.split(' ');
    if (parts.length < 2 || parts.length > 3) {
      throw new Error(`Invalid inline check format: ${comp}`);
    }
    const actual = parts[0];
    const operator = parts[1];
    const expected = unquoteEmpty(parts[2] ?? '');
    return {
      actual: `\${${resultVar}.${actual}}`,
      expected,
      operator,
      title: defaultTitle,
      details: defaultDetails,
      report,
    };
  }
  // Object form
  const actualStr = typeof comp.actual === 'string' ? comp.actual : String(comp.actual);
  return {
    actual: `\${${resultVar}.${actualStr}}`,
    expected: comp.expected,
    operator: comp.operator || '==',
    title: comp.title || defaultTitle,
    details: comp.details || defaultDetails,
    report: comp.report || report,
  };
};

const callToJSfunc = (step: TestFlowCall, useExternalReport: boolean, stepIdx: number, callMeta?: Record<string, CallTitleMeta>): string => {
  let inputParams = toInputsParams(step.inputs || {}, ': ');
  if (inputParams.length > 0) {
    inputParams = ' ' + inputParams + ' ';
  }

  const hasInlineChecks = step.check || step.assert;
  const safeName = step.call.replace(/[^a-zA-Z0-9_]/g, '_');
  const resultVar = step.id || (hasInlineChecks ? `_${safeName}_${stepIdx}` : undefined);

  let callExpr = `await ${step.call}({${inputParams}});`;
  if (resultVar) {
    callExpr = `const ${resultVar} = ` + callExpr;
  }

  let result = callExpr;

  if (hasInlineChecks) {
    const meta = callMeta?.[step.call];
    const title = step.title || meta?.fileTitle || step.call || meta?.fileName || step.id || 'call';
    const details = `\${JSON.stringify(${resultVar})}`;

    const processComparisons = (comps: Comparison | Comparison[], type: 'check' | 'assert') => {
      const list = Array.isArray(comps) ? comps : [comps];
      for (const comp of list) {
        const transformed = transformCallComparison(comp, resultVar!, title, details, step.report);
        result += '\ncheckAbort_();\n' + comparisonToJSfunc(type, transformed, useExternalReport);
      }
    };

    if (step.check) {
      processComparisons(step.check, 'check');
    }
    if (step.assert) {
      processComparisons(step.assert, 'assert');
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
    (flow: TestFlowSteps, root: boolean, useExternalReport: boolean = !root, callMeta?: Record<string, CallTitleMeta>): string => {
      return (flow ?? [])
          .map((step: TestFlowStep, idx: number) => {
            let stepJs: string;
            switch (getTestFlowStepType(step)) {
              case 'call':
                stepJs = callToJSfunc(step as TestFlowCall, useExternalReport, idx, callMeta);
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
                stepJs = ifToJSfunc(step as TestFlowCondition, callMeta);
                break;
              case 'repeat':
                stepJs = repeatToJSfunc(step as TestFlowRepeat, callMeta);
                break;
              case 'delay':
                stepJs = delayToJSfunc((step as any).delay);
                break;
              case 'for':
                stepJs = forToJSfunc(step as TestFlowLoop, callMeta);
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
    (flow: TestFlowStages, root: boolean, useExternalReport: boolean = !root, callMeta?: Record<string, CallTitleMeta>): string => {
      if (!flow || flow.length === 0) {
        return '';
      };

      // Map stage name to its code and dependencies
      const stageMap = new Map < string, {
        code: string;
        dependsOn?: string[]
      }
      > ();

      for (const stage of flow) {
        const stageName = stage.id || randomName();
        const dependsOn = Array.isArray(stage.depends_on) ? stage.depends_on :
            stage.depends_on                              ? [stage.depends_on] :
                                                            [];
        // Build stage code with optional early-return condition
        let code = '';
        if (stage.condition && String(stage.condition).trim().length > 0) {
          const cond = conditionalStatementToJSfunc(String(stage.condition));
          code += `if (!(${cond})) {\n  return;\n}\n`;
        }
        code += flowStepsToJsfunc(stage.steps ?? [], root, useExternalReport, callMeta);
        stageMap.set(stageName, {code, dependsOn});
      }

      // Helper to generate code for each stage with dependency handling
      const generated: string[] = [];
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

export const flowToJsFunc = (testData: TestData, root: boolean, useExternalReport: boolean = !root, callMeta?: Record<string, CallTitleMeta>): string => {
  let flow = '';
  if (testData.stages && testData.stages.length > 0) {
    flow += flowStagesToJsfunc(testData.stages, root, useExternalReport, callMeta);
  } else if (testData.steps && testData.steps.length > 0) {
    flow += flowStepsToJsfunc(testData.steps, root, useExternalReport, callMeta);
  }
  return flow;
};