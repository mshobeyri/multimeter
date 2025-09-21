import {APIData} from './APIData';
import {yamlToAPI} from './apiParsePack';
import {JSONRecord, Type} from './CommonData';
import {formatBody} from './markupConvertor';
import {TestData, TestFlowAssert, TestFlowCall, TestFlowCheck, TestFlowCondition, TestFlowLoop, TestFlowRepeat, TestFlowStage, TestFlowStages, TestFlowStep, TestFlowSteps} from './TestData';
import {getTestFlowStepType, yamlToTest} from './testParsePack';
import {replaceAllRefs} from './variableReplacer';

export function indentLines(str: string): string {
  return str.split('\n').map(line => '  ' + line).join('\n').slice(2);
}

export interface APIContext {
  api: APIData, name: string, inputs: JSONRecord, envVars: JSONRecord
}

export const fileType = (path: string, content: string): Type => {
  if (path.endsWith('.csv')) {
    return 'csv';
  }

  if (!path.endsWith('.mmt')) {
    return null;
  }

  if (content.includes('type: api')) {
    return 'api';
  }
  if (content.includes('type: test')) {
    return 'test';
  }
  if (content.includes('type: var')) {
    return 'var';
  }
  if (content.includes('type: env')) {
    return 'env';
  }
  return null;
};

export type FileLoader = (path: string) => Promise<string>;

declare let window: any;
export let readFile: FileLoader = async (path: string) => {
  if (typeof window === 'undefined' && typeof require !== 'undefined') {
    try {
      const fs = require('fs');
      return fs.readFileSync(path, 'utf8');
    } catch (e) {
      return '';
    }
  }
  return '';
};

// Allow overriding the file loader
export function setFileLoader(loader: FileLoader) {
  readFile = loader;
}

export const importApiToJSfunc = async(ctx: APIContext): Promise<string> => {
  const inputParams =
      Object.entries(ctx.api.inputs ?? {})
          .map(
              ([key, value]) => `${key} = ${
                  typeof value === 'string' ? `"${value}"` : value}`)
          .join(', ');

  const paramsAsObj: Record<string, string> = Object.fromEntries(
      Object.keys(ctx.api.inputs ?? {}).map(key => [key, `\${${key}}`]));

  const extractRules = ctx.api.extract || ctx.api.outputs || {};

  let replaced =
      replaceAllRefs(ctx.api, paramsAsObj, ctx.inputs, ctx.envVars ?? {});

  let formattedBody =
      formatBody(replaced.format || 'json', replaced.body || '', false);

  if (replaced.cookies && Object.keys(replaced.cookies).length > 0) {
    let cookies = Object.entries(replaced.cookies || {})
                      .map(([k, v]) => `${k}=${v}`)
                      .join('; ');
    replaced.headers = replaced.headers || {};
    replaced.headers['Cookie'] = cookies;
  }

  let headers = Object.entries(replaced.headers || {})
                    .map(([k, v]) => `"${k}": \`${v}\``)
                    .join(', ');

  return `const ${ctx.name} = async ({ ${inputParams} } = {}) => {
  const req = {
    url: '${ctx.api.url}',
    protocol: '${ctx.api.protocol}',
    method: '${replaced.method}',
    headers: ${headers ? '{ ' + headers + ' }' : '{}'},
    body: \`${formattedBody}\`
  };
  const res = await send(req);

  const output = extractOutputs(
    {
      type: 'auto',
      body: res?.body,
      headers: res?.headers || {},
      cookies: res?.cookies || {}
    },
    ${indentLines(JSON.stringify(extractRules, null, 2))}
  );

  return output;
};`;
};

export const importCSVToJSObj =
    async(content: string, name: string): Promise<string> => {
  const rows = content.split('\n').map(row => row.split(','));
  const headers = rows[0];
  const jsonArray = rows.slice(1).map(row => {
    return row.reduce((acc, value, index) => {
      acc[headers[index]] = value;
      return acc;
    }, {} as JSONRecord);
  });
  return `const ${name} = ${JSON.stringify(jsonArray, null, 2)};`;
};

export const importsToJsfunc =
    async(imports: Record<string, string>): Promise<string> => {
  try {
    const results: string[] = [];

    for (const [name, path] of Object.entries(imports)) {
      try {
        const content = await readFile(path);
        const type = fileType(path, content);

        if (type === 'test') {
          const res = await importTestToJsfunc({
            test: yamlToTest(content),
            name,
            inputs: {},
            envVars: {},
          });
          results.push(res);
        } else if (type === 'api') {
          const res = await importApiToJSfunc({
            api: yamlToAPI(content),
            name,
            inputs: {},
            envVars: {},
          });
          results.push(res);
        } else if (type === 'csv') {
          const res = await importCSVToJSObj(content, name);
          results.push(res);
        } else {
          console.warn(`Skipping ${path}: unknown type "${type}"`);
        }
      } catch (innerErr) {
        console.error(`Failed to import ${path}:`, innerErr);
      }
    }

    return results.join('\n');
  } catch (error) {
    console.error('Error importing functions:', error);
    return '';
  }
};

export const conditionalStatementToJSfunc = (check: string): string => {
  const checkParts = check.split(' ');
  if (checkParts.length !== 3) {
    throw new Error(`Invalid check format: ${check}`);
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

export const ifToJSfunc = (condition: TestFlowCondition): string => {
  const conditionStatement = conditionalStatementToJSfunc(condition.if);
  const thenBlock = flowStepsToJsfunc(condition.steps);
  const elseBlock =
      condition.else ? flowStepsToJsfunc(condition.else) : undefined;

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
  const loopBody = flowStepsToJsfunc(loop.steps);

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

export const forToJSfunc = (loop: TestFlowLoop): string => {
  const loopBody = flowStepsToJsfunc(loop.steps);
  return `
for (${loop.for}) {
  ${indentLines(loopBody)}
}`;
};

export const setToJSfunc = (set: Record<string, any>): string => {
  return `${set} = ${set.value};`;
};


export const checkToJSfunc = (check: string): string => {
  const conditionStatement = conditionalStatementToJSfunc(check);
  const checkParts = check.split(' ');
  if (checkParts.length !== 3) {
    throw new Error(`Invalid check format: ${check}`);
  }
  const [left, operator, right] = checkParts;

  return `if (!${conditionStatement}) {
    console.error("Check ${check} failed, as " + JSON.stringify(${left}) + " ${
      operator} " + ${right} + " is false");
}`;
};

export const assertToJSfunc = (assert: string): string => {
  const conditionStatement = conditionalStatementToJSfunc(assert);
  const assertParts = assert.split(' ');
  if (assertParts.length !== 3) {
    throw new Error(`Invalid assert format: ${assert}`);
  }
  const [left, operator, right] = assertParts;

  return `if (!${conditionStatement}) {
    throw new Error("Assertion ${assert} failed, as " + JSON.stringify(${
      left}) + " ${operator} " + ${right}+ " is false");
}`;
};

const toInputsParams = (inputs: Record<string, any>, operator: string) => {
  const formattedInputs =
      Object.entries(inputs ?? {})
          .map(
              ([key, value]) => `${key}${operator}${
                  typeof value === 'string' ? '`' + value + '`' : value}`)
          .join(', ');
  return formattedInputs;
};

export const callToJSfunc = (step: TestFlowCall): string => {
  const inputs = toInputsParams(step.inputs || {}, ': ');

  let call = `await ${step.call}({ ${inputs} });`;
  if (step.id) {
    call = `const ${step.id} = ` + call;
  }

  return call;
};

export const varToJSfunc = (key: string, step: any): string => {
  return Object.entries(step)
      .map(([varName, value]) => {
        return `${key}${varName} = ${value};`;
      })
      .join('\n');
};

export const flowStepsToJsfunc = (flow: TestFlowSteps): string => {
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
          case 'for':
            return forToJSfunc(step as TestFlowLoop);
          case 'js':
            return (step as any).js;
          case 'print':
            return `console.log(\`${(step as any).print}\`);`;
          case 'set':
            return varToJSfunc('', (step as any).set);
          case 'var':
            return varToJSfunc('var ', (step as any).var);
          case 'const':
            return varToJSfunc('const ', (step as any).const);
          case 'let':
            return varToJSfunc('let ', (step as any).let);
          default:
            return '';
        }
      })
      .join('\n');
};

export const flowStagesToJsfunc = (flow: TestFlowStages): string => {
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
    const dependsOn = Array.isArray(stage.dependencies) ? stage.dependencies :
        stage.dependencies                              ? [stage.dependencies] :
                                                          [];
    const code = flowStepsToJsfunc(stage.steps ?? []);
    stageMap.set(stageName, {code, dependsOn});
  }

  // Helper to generate code for each stage with dependency handling
  const generated: string[] = [];
  const launched = new Set<string>();

  function genStage(stageName: string) {
    if (launched.has(stageName)) {
      return;
    }
    const stage = stageMap.get(stageName);
    if (!stage) {
      return;
    }
    // Generate dependencies first
    if (stage.dependsOn && stage.dependsOn.length > 0) {
      for (const dep of stage.dependsOn) {
        genStage(dep);
      }
      // Wait for dependencies to finish
      generated.push(`await Promise.all([${
          stage.dependsOn.map(dep => `${dep}Promise`).join(', ')}]);`);
    }
    // Launch this stage as a promise
    generated.push(`const ${stageName}Promise = (async () => {\n${
        indentLines(stage.code)}\n})();`);
    launched.add(stageName);
  }

  // Launch all stages
  for (const stageName of stageMap.keys()) {
    genStage(stageName);
  }

  // Wait for all stages to finish
  generated.push(`await Promise.all([${
      Array.from(stageMap.keys())
          .map(name => `${name}Promise`)
          .join(', ')}]);`);

  return generated.join('\n');
};

export interface TestContext {
  test: TestData, name: string, inputs: JSONRecord, envVars: JSONRecord
}

export const importTestToJsfunc = async(ctx: TestContext): Promise<string> => {
  if (ctx.test.stages && ctx.test.stages.length > 0 && ctx.test.steps &&
      ctx.test.steps.length > 0) {
    throw new Error(`${ctx.name}: Test cannot have both stages and steps`);
  }
  let importedFuncs = '// Imported tests and APIs\n';
  importedFuncs += await importsToJsfunc(ctx.test.import ?? {});
  const paramsAsObj: Record<string, string> = Object.fromEntries(
      Object.keys(ctx.test.inputs ?? {}).map(key => [key, `\${${key}}`]));

  let replaced =
      replaceAllRefs(ctx.test, paramsAsObj, ctx.inputs, ctx.envVars ?? {});

  const inputParams = toInputsParams(replaced.inputs || {}, ' = ');

  let flow = '// Test flow\n';
  const outputParams = toInputsParams(replaced.outputs || {}, ': ');

  if (replaced.stages && replaced.stages.length > 0) {
    flow += flowStagesToJsfunc(replaced.stages);
  } else if (replaced.steps && replaced.steps.length > 0) {
    flow += flowStepsToJsfunc(replaced.steps);
  }
  return `const ${ctx.name} = async ({ ${inputParams} } = {}) => {
  ${indentLines(importedFuncs)}

  let outputs = { ${outputParams} };

  ${indentLines(flow)}

  return outputs;
};`;
};

export const rootTestToJsfunc = async(ctx: TestContext): Promise<string> => {
  const test = await importTestToJsfunc(ctx);
  return `let envParameters = {${
      Object.keys(ctx.envVars).map(name => `${name}: ${name}`).join(', ')}};

${test}

return ${ctx.name}();`;
};

function randomName(): string {
  // Generate a random stage name like "stage_xxxxx"
  return 'stage_' + Math.random().toString(36).substr(2, 8);
}
