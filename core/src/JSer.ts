import {APIData} from './APIData';
import {yamlToAPI} from './apiParsePack';
import {JSONRecord, Type} from './CommonData';
import {TestData, TestFlowCall, TestFlowCheck, TestFlowCondition, TestFlowLoop, TestFlowRepeat, TestFlowStage, TestFlowStages, TestFlowStep, TestFlowSteps} from './TestData';
import {yamlToTest} from './testParsePack';

export function indentLines(str: string): string {
  return str.split('\n').map(line => '    ' + line).join('\n');
}

export interface APIContext {
  api: APIData, name: string, inputs: JSONRecord, envVars: JSONRecord
}

export const fileType = (content: string): Type => {
  // Implementation for determining the file type
  return 'test';
};

export const readFile = (path: string): string => {
  // Implementation for reading a file
  return '';
};

export const apiToJSfunc = (ctx: APIContext): string => {
  // Prepare input parameter names
  const inputNames = Array.isArray(ctx.api.inputs) ?
      ctx.api.inputs.map((input: any) => input.name) :
      Object.keys(ctx.api.inputs ?? {});
  const inputParams = inputNames.join(', ');

  // Prepare output names
  const extractRules = ctx.api.extract || ctx.api.outputs || {};
  const outputNames = Object.keys(extractRules);

  // Prepare env variable names
  const envVarNames = Array.isArray(ctx.envVars) ?
      ctx.envVars.map((envVar: any) => envVar.name) :
      Object.keys(ctx.envVars ?? {});

  // Generate the function as a string
  return `
async function ${ctx.name}(${inputParams}) {
  const envParameters = {${
      envVarNames
          .map(
              name =>
                  `${name}: (typeof ${name} !== 'undefined' ? ${name} : '')`)
          .join(', ')}};

  const inputs = {${inputNames.map(name => `${name}: ${name}`).join(', ')}};

  let req = replaceAllRefs(api, api.inputs ?? {}, inputs, envParameters);
  req.body = formatBody(req.format || 'json', req.body || '');

  const conn = getConn(req.url, req.protocol);
  const res = await conn.send(req);

  const extractedValues = extractOutputs(
    {
      type: (res?.headers?.['Content-Type'] || res?.headers?.['content-type'] || '').includes('xml') ||
            (res?.body && res.body.startsWith && res.body.startsWith('<')) ? 'xml' : 'json',
      body: res?.body,
      headers: res?.headers || {},
      cookies: res?.cookies || {}
    },
    ${JSON.stringify(extractRules)}
  );

  // Build final outputs object
  const finalOutputs = {};
  ${
      outputNames
          .map(
              name =>
                  `finalOutputs["${name}"] = extractedValues["${name}"] ?? "";`)
          .join('\n  ')}

  return finalOutputs;
}
`;
};

export const importsToJsfunc = (imports: Record<string, string>): string => {
  return Object.entries(imports)
      .map(([name, path]) => {
        let content = readFile(path);
        let type = fileType(content);
        if (type === 'test') {
          return testToJsfunc(
              {test: yamlToTest(content), name, inputs: {}, envVars: {}});
        } else if (type === 'api') {
          return apiToJSfunc(
              {api: yamlToAPI(content), name, inputs: {}, envVars: {}});
        }
      })
      .join('\n');
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
    return `
if (${conditionStatement}) {
${indentLines(thenBlock)}
}
`;
  } else {
    return `
if (${conditionStatement}) {
${indentLines(thenBlock)}
} else {
${indentLines(elseBlock)}
}`;
  }
};

export const repeatToJSfunc = (loop: TestFlowRepeat): string => {
  const loopCondition = loop.repeat;
  const loopBody = flowStepsToJsfunc(loop.steps);
  return `
for (let i = 0; i < ${loopCondition}; i++) {
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


export const checkToJSfunc = (check: string): string => {
  const conditionStatement = conditionalStatementToJSfunc(check);
  return `
if (!${conditionStatement}) {
    throw new Error("Check failed: ${check}");
}`;
};

export const flowStepsToJsfunc = (flow: TestFlowSteps): string => {
  return (flow ?? [])
      .map((step: TestFlowStep) => {
        if (step?.type === 'call') {
          step = step as TestFlowCall;
          return `const ${step.id} = await ${step.target}(${
              step.inputs?.join(', ')});`;
        } else if (step?.type === 'check') {
          step = step as TestFlowCheck;
          return checkToJSfunc(step.check);
        } else if (step?.type === 'if') {
          step = step as TestFlowCondition;
          return ifToJSfunc(step);
        } else if (step?.type === 'repeat') {
          step = step as TestFlowRepeat;
          return repeatToJSfunc(step);
        } else if (step?.type === 'for') {
          step = step as TestFlowLoop;
          return forToJSfunc(step);
        }
        return '';
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

export const testToJsfunc = (ctx: TestContext): string => {
  if (ctx.test.stages && ctx.test.stages.length > 0 && ctx.test.steps &&
      ctx.test.steps.length > 0) {
    throw new Error(`${ctx.name}: Test cannot have both stages and steps`);
  }
  let flow = '';
  if (ctx.test.stages && ctx.test.stages.length > 0) {
    flow = flowStagesToJsfunc(ctx.test.stages ?? []);
  } else if (ctx.test.steps && ctx.test.steps.length > 0) {
    flow = flowStepsToJsfunc(ctx.test.steps ?? []);
  }
  const importedFuncs = importsToJsfunc(ctx.test.import ?? {});
  return `
const ${ctx.name} = async(${Object.keys(ctx.inputs).join(', ')}) => {
${indentLines(importedFuncs)}
${indentLines(flow)}
};

const envParameters = {${
      Object.keys(ctx.envVars).map(name => `${name}: ${name}`).join(', ')}};

const inputs = {${
      Object.keys(ctx.inputs).map(name => `${name}: ${name}`).join(', ')}};
const result = await ${ctx.name}(inputs, envParameters);
return result;
`;
};
function randomName(): string {
  // Generate a random stage name like "stage_xxxxx"
  return 'stage_' + Math.random().toString(36).substr(2, 8);
}
