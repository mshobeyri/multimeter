import {indentLines, toInputsParams} from './JSerHelper';
import {Comparison, TestData, TestFlowAssert, TestFlowCall, TestFlowCheck, TestFlowCondition, TestFlowLoop, TestFlowRepeat, TestFlowStages, TestFlowStep, TestFlowSteps} from './TestData';
import {getTestFlowStepType} from './testParsePack';

function randomName(): string {
  // Generate a random stage name like "stage_xxxxx"
  return 'stage_' + Math.random().toString(36).substr(2, 8);
}

const replaceEnvTokens = (s: string): string =>
  s.replace(/\be:([A-Za-z_][A-Za-z0-9_]*)\b/g, 'envVariables.$1');

export const conditionalStatementToJSfunc = (check: string): string => {
  // Replace env tokens like e:FOO -> envVariables.FOO
  const normalized = replaceEnvTokens(check);
  const checkParts = normalized.split(' ');
  if (checkParts.length !== 3) {
    return 'true';
  }
  const [left, operator, right] = checkParts;
  switch (operator) {
    case '<':
      return `less(${left}, ${right})`;
    case '>':
      return `greater(${left}, ${right})`;
    case '<=':
      return `lessOrEqual(${left}, ${right})`;
    case '>=':
      return `greaterOrEqual(${left}, ${right})`;
    case '==':
      return `equals(${left}, ${right})`;
    case '!=':
      return `notEquals(${left}, ${right})`;
    case '=@':
      return `isAt(${left}, ${right})`;
    case '!@':
      return `isNotAt(${left}, ${right})`;
    case '=~':
      return `matches(${left}, ${right})`;
    case '!~':
      return `notMatches(${left}, ${right})`;
    case '=^':
      return `startsWith(${left}, ${right})`;
    case '!^':
      return `notStartsWith(${left}, ${right})`;
    case '=$':
      return `endsWith(${left}, ${right})`;
    case '!$':
      return `notEndsWith(${left}, ${right})`;
    default:
      throw new Error(`${check}: Unknown operator: ${operator}`);
  }
};

interface NormalizedComparison {
  left: string;
  operator: string;
  right: string;
  message?: string;
  raw: string;
}

const normalizeComparison = (comp: Comparison, kind: 'check'|'assert'): NormalizedComparison | null => {
  if (!comp || (typeof comp === 'string' && comp.trim() === '')) {
    return null;
  }
  if (typeof comp === 'string') {
    const raw = comp;
    const parts = comp.split(' ');
    if (parts.length !== 3) {
      throw new Error(`Invalid ${kind} format: ${comp}`);
    }
    const [left, operator, right] = parts;
    return {left, operator, right, raw};
  }

  const actual: unknown = (comp as any).actual;
  const expected: unknown = (comp as any).expected;
  if (typeof (comp as any) !== 'object' || actual === undefined || expected === undefined) {
    throw new Error(`Invalid ${kind} object: "actual" and "expected" are required`);
  }
  const operator = (comp as any).operator || '==';
  const left = typeof actual === 'string' ? actual : JSON.stringify(actual);
  const right = typeof expected === 'string' ? expected : JSON.stringify(expected);
  const raw = `${left} ${operator} ${right}`;
  const message = typeof (comp as any).message === 'string' ? (comp as any).message : undefined;
  return {left, operator, right, raw, message};
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
    let durationMs = 0;
    switch (unit) {
      case 'ns':
        durationMs = value / 1e6;
        break;
      case 'ms':
        durationMs = value;
        break;
      case 's':
        durationMs = value * 1000;
        break;
      case 'm':
        durationMs = value * 60 * 1000;
        break;
      case 'h':
        durationMs = value * 60 * 60 * 1000;
        break;
    }
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
    switch (unit) {
      case 'ns':
        msExpr = String(num / 1e6);
        break;
      case 'ms':
        msExpr = String(num);
        break;
      case 's':
        msExpr = String(num * 1000);
        break;
      case 'm':
        msExpr = String(num * 60 * 1000);
        break;
      case 'h':
        msExpr = String(num * 60 * 60 * 1000);
        break;
      default:
        msExpr = String(num);
    }
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


export const checkToJSfunc = (check: Comparison): string => {
  const normalized = normalizeComparison(check, 'check');
  if (!normalized) {
    return '';
  }
  const {left, operator, right, raw, message} = normalized;
  const conditionStatement = conditionalStatementToJSfunc(raw);
  const autoMsg = `Check ${raw} failed, as " + JSON.stringify(${left}) + " ${operator} " + ${right} + " is false`;
  const finalMsg = message ? `${message} - ${autoMsg}` : autoMsg;
  const messageLiteral = message ? JSON.stringify(message) : 'undefined';
  return `{
  const __mmtConditionResult = ${conditionStatement};
  __mmtReportCheck(${JSON.stringify(raw)}, ${messageLiteral}, __mmtConditionResult, () => {
    console.error("${finalMsg}");
  });
}`;
};

export const assertToJSfunc = (assert: Comparison): string => {
  const normalized = normalizeComparison(assert, 'assert');
  if (!normalized) {
    return '';
  }
  const {left, operator, right, raw, message} = normalized;
  const conditionStatement = conditionalStatementToJSfunc(raw);
  const autoMsg = `Assertion ${raw} failed, as " + JSON.stringify(${left}) + " ${operator} " + ${right} + " is false`;
  const finalMsg = message ? `${message} - ${autoMsg}` : autoMsg;
  const messageLiteral = message ? JSON.stringify(message) : 'undefined';
  return `{
  const __mmtConditionResult = ${conditionStatement};
  __mmtReportAssert(${JSON.stringify(raw)}, ${messageLiteral}, __mmtConditionResult, () => {
    throw new Error("${finalMsg}");
  });
}`;
};

const callToJSfunc = (step: TestFlowCall): string => {
  let inputParams = toInputsParams(step.inputs || {}, ': ');
  if (inputParams.length > 0) {
    inputParams = ' ' + inputParams + ' ';
  }

  let call = `await imports.${step.call}({${inputParams}});`;
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

export const flowStepsToJsfunc =
    (flow: TestFlowSteps, root: boolean): string => {
      return (flow ?? [])
          .map((step: TestFlowStep) => {
            switch (getTestFlowStepType(step)) {
              case 'call':
                return callToJSfunc(step as TestFlowCall);
              case 'check':
                return checkToJSfunc((step as TestFlowCheck).check);
              case 'assert':
                return assertToJSfunc((step as TestFlowAssert).assert);
              case 'if':
                return ifToJSfunc(step as TestFlowCondition);
              case 'repeat':
                return repeatToJSfunc(step as TestFlowRepeat);
              case 'delay':
                return delayToJSfunc((step as any).delay);
              case 'for':
                return forToJSfunc(step as TestFlowLoop);
              case 'js':
                return (step as any).js;
              case 'print':
                if (root) {
                  return `console.log(\`${(step as any).print}\`);`;
                }
                return `console.debug(\`${(step as any).print}\`);`;
              case 'set':
                return varToJSfunc('', (step as any).set);
              case 'var':
                return varToJSfunc('var ', (step as any).var);
              case 'const':
                return varToJSfunc('const ', (step as any).const);
              case 'let':
                return varToJSfunc('let ', (step as any).let);
              case 'data': {
                const alias = (step as any).data;
                return '';
              }
              default:
                return '';
            }
          })
          .join('\n');
    };

export const flowStagesToJsfunc =
    (flow: TestFlowStages, root: boolean): string => {
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
        code += flowStepsToJsfunc(stage.steps ?? [], root);
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

export const flowToJsFunc = (testData: TestData, root: boolean): string => {
  let flow = '';
  if (testData.stages && testData.stages.length > 0) {
    flow += flowStagesToJsfunc(testData.stages, root);
  } else if (testData.steps && testData.steps.length > 0) {
    flow += flowStepsToJsfunc(testData.steps, root);
  }
  return flow;
};