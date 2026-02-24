import {indentLines, timeUnitToMs, toInputsParams} from './JSerHelper';
import {Comparison, normalizeReportConfig, TestData, TestFlowAssert, TestFlowCall, TestFlowCheck, TestFlowCondition, TestFlowLoop, TestFlowRepeat, TestFlowStages, TestFlowStep, TestFlowSteps} from './TestData';
import {getTestFlowStepType} from './testParsePack';
import {replaceEnvTokensPlain, toTemplateWithEnvVars} from './variableReplacer';

function randomName(): string {
  // Generate a random stage name like "stage_xxxxx"
  return 'stage_' + Math.random().toString(36).substr(2, 8);
}

const replaceEnvTokens = replaceEnvTokensPlain;
const toTemplateWithVars = toTemplateWithEnvVars;

export const conditionalStatementToJSfunc = (check: string): string => {
  // Replace env tokens like e:FOO -> envVariables.FOO
  const normalized = replaceEnvTokens(check);
  const checkParts = normalized.split(' ');
  if (checkParts.length !== 3) {
    return 'true';
  }
  const [actual, operator, expected] = checkParts;
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
        if (parts.length !== 3) {
          throw new Error(`Invalid ${kind} format: ${comp}`);
        }
        const [actual, operator, expected] = parts;
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

export const ifToJSfunc = (condition: TestFlowCondition): string => {
  const cond = typeof condition.if === 'string' ? condition.if : '';
  const conditionStatement = conditionalStatementToJSfunc(cond);
  const thenBlock = flowStepsToJsfunc(condition.steps, true);
  const elseBlock =
      condition.else ? flowStepsToJsfunc(condition.else, true) : undefined;

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

export const repeatToJSfunc = (loop: TestFlowRepeat): string => {
  const loopCondition = typeof loop.repeat === 'string' ? loop.repeat.trim() :
                                                          String(loop.repeat);
  const loopBody = flowStepsToJsfunc(loop.steps, true);

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

export const forToJSfunc = (loop: TestFlowLoop): string => {
  const loopBody = flowStepsToJsfunc(loop.steps, true);
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
  const throwOnFail = type === 'assert' ? `\n  throw new Error("Assertion failed");` : '';
  return `if (${conditionStatement}) {
  console.log(${toTemplateWithVars(finaSuccessMsg)});
  ${reportOnSuccess ? `report_('${type}', ${JSON.stringify(raw)}, ${finalTitle}, ${finalDetails}, true);` : ''}
} else {
  console.error(${toTemplateWithVars(finaFaillMsg)});
  ${reportOnFail ? `report_('${type}', ${JSON.stringify(raw)}, ${finalTitle}, ${finalDetails}, false, ${finalActual}, ${finalExpected});` : ''}${throwOnFail}
}\n`;
};

export const checkToJSfunc = (check: Comparison, useExternalReport: boolean): string =>
  comparisonToJSfunc('check', check, useExternalReport);

export const assertToJSfunc = (assert: Comparison, useExternalReport: boolean): string =>
  comparisonToJSfunc('assert', assert, useExternalReport);

const callToJSfunc = (step: TestFlowCall): string => {
  let inputParams = toInputsParams(step.inputs || {}, ': ');
  if (inputParams.length > 0) {
    inputParams = ' ' + inputParams + ' ';
  }

  let call = `await ${step.call}({${inputParams}});`;
  if (step.id) {
    call = `const ${step.id} = ` + call;
  }

  return call;
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

export const flowStepsToJsfunc =
    (flow: TestFlowSteps, root: boolean, useExternalReport: boolean = !root): string => {
      return (flow ?? [])
          .map((step: TestFlowStep) => {
            let stepJs: string;
            switch (getTestFlowStepType(step)) {
              case 'call':
                stepJs = callToJSfunc(step as TestFlowCall);
                break;
              case 'check':
                stepJs = checkToJSfunc((step as TestFlowCheck).check, useExternalReport);
                break;
              case 'assert':
                stepJs = assertToJSfunc((step as TestFlowAssert).assert, useExternalReport);
                break;
              case 'if':
                stepJs = ifToJSfunc(step as TestFlowCondition);
                break;
              case 'repeat':
                stepJs = repeatToJSfunc(step as TestFlowRepeat);
                break;
              case 'delay':
                stepJs = delayToJSfunc((step as any).delay);
                break;
              case 'for':
                stepJs = forToJSfunc(step as TestFlowLoop);
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
    (flow: TestFlowStages, root: boolean, useExternalReport: boolean = !root): string => {
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
        code += flowStepsToJsfunc(stage.steps ?? [], root, useExternalReport);
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

export const flowToJsFunc = (testData: TestData, root: boolean, useExternalReport: boolean = !root): string => {
  let flow = '';
  if (testData.stages && testData.stages.length > 0) {
    flow += flowStagesToJsfunc(testData.stages, root, useExternalReport);
  } else if (testData.steps && testData.steps.length > 0) {
    flow += flowStepsToJsfunc(testData.steps, root, useExternalReport);
  }
  return flow;
};