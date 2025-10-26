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

// Convert a string to lowercase and replace spaces with underscores
export function toLowerUnderscore(input: string): string {
  if (input === undefined || input === null) {
    return '';
  }
  return String(input).replace(/ /g, '_').toLowerCase();
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
      // Use an indirect require so bundlers (webpack 5) don't try to resolve
      // 'fs' for the browser build
      const req = Function('return require')();
      const fs = req('fs');
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

  return `const ${toLowerUnderscore(ctx.name)} = async ({ ${inputParams} } = {}) => {
  const req = {
    url: \`${replaced.url || ''}\`,
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

export const parseCsv = (content: string): Array<Record<string, any>> => {
  let text = (content || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  // Strip BOM if present
  text = text.replace(/^\uFEFF/, '');
  if (!text) {
    return [];
  }
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  if (lines.length === 0) {
    return [];
  }
  if (!lines[0].includes(',') && /:\s*/.test(lines[0])) {
    return [];
  }
  const parseCsvLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current);
    return result;
  };
  const coerce = (v: string): any => {
    const t = (v ?? '').trim();
    if (t === '') {
      return '';
    }
    if (/^\d+(?:\.\d+)?$/.test(t)) {
      return Number(t);
    }
    if (/^(true|false)$/i.test(t)) {
      return t.toLowerCase() === 'true';
    }
    return t;
  };
  const headers = parseCsvLine(lines[0]).map(h => h.trim());
  const rows = lines.slice(1).map(parseCsvLine);
  return rows.filter(r => r.some(c => (c ?? '').trim() !== ''))
      .map(
          cols => Object.fromEntries(
              headers.map((h, i) => [h, coerce(cols[i] ?? '')])));
};

export const importCSVToJSObj =
    async(content: string, name: string): Promise<string> => {
  const arr = parseCsv(content);
  if (arr.length === 0 && (content || '').trim()) {
    console.warn(`CSV import for ${
        name} looks invalid (no commas in header). Skipping.`);
  }
  return `const ${name} = ${JSON.stringify(arr)};`;
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

const replaceEnvTokens = (s: string): string =>
    s.replace(/\be:([A-Za-z_][A-Za-z0-9_]*)\b/g, 'envVariables.$1');

export const conditionalStatementToJSfunc = (check: string): string => {
  // Replace env tokens like e:FOO -> envVariables.FOO
  const normalized = replaceEnvTokens(check);
  const checkParts = normalized.split(' ');
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

export function delayToJSfunc(d: string | number): string {
  const val = typeof d === 'number' ? String(d) : String(d).trim();
  let msExpr = '0';
  const m = val.match(/^(\d+(?:\.\d+)?)(ns|ms|s|m|h)?$/);
  if (m) {
    const num = parseFloat(m[1]);
    const unit = m[2] || 'ms';
    switch (unit) {
      case 'ns': msExpr = String(num / 1e6); break;
      case 'ms': msExpr = String(num); break;
      case 's': msExpr = String(num * 1000); break;
      case 'm': msExpr = String(num * 60 * 1000); break;
      case 'h': msExpr = String(num * 60 * 60 * 1000); break;
      default: msExpr = String(num);
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
           case 'delay':
             return delayToJSfunc((step as any).delay);
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

  let replaced = replaceAllRefs(ctx.test, paramsAsObj, ctx.inputs, {});

  const inputParams = toInputsParams(replaced.inputs || {}, ' = ');

  let flow = '';
  const outputParams = toInputsParams(replaced.outputs || {}, ': ');

  if (replaced.stages && replaced.stages.length > 0) {
    flow += flowStagesToJsfunc(replaced.stages);
  } else if (replaced.steps && replaced.steps.length > 0) {
    flow += flowStepsToJsfunc(replaced.steps);
  }
  return `const ${toLowerUnderscore(ctx.name)} = async ({ ${
      inputParams} } = {}, envVariables = {}) => {
  ${indentLines(importedFuncs)}

  const getEnv = (k) => {
    if (!k) return '';
    if (envVariables && Object.prototype.hasOwnProperty.call(envVariables, k)) return envVariables[k];
    const lower = String(k).toLowerCase();
    const upper = String(k).toUpperCase();
    if (envVariables && Object.prototype.hasOwnProperty.call(envVariables, lower)) return envVariables[lower];
    if (envVariables && Object.prototype.hasOwnProperty.call(envVariables, upper)) return envVariables[upper];
    return '';
  };

  let outputs = { ${outputParams} };

  ${indentLines(flow)}

  return outputs;
};`;
};

export const rootTestToJsfunc = async(ctx: TestContext): Promise<string> => {
  const test = await importTestToJsfunc(ctx);
  const envPretty = JSON.stringify(ctx.envVars || {}, null, 2);
  const full = `${test}\n\nconst envVar = ${envPretty};\nreturn ${toLowerUnderscore(ctx.name)}({}, envVar);`;
  return variableReplacer(full);
};

export const variableReplacer = (full: string): string => {
  const replaceOutside = (s: string) =>
    s
      .replace(/<<\s*e:([A-Za-z0-9_]+)\s*>>/g, 'getEnv("$1")')
      .replace(/<\s*e:([A-Za-z0-9_]+)\s*>/g, 'getEnv("$1")')
      .replace(/\be:\{([A-Za-z0-9_]+)\}/g, 'getEnv("$1")')
      .replace(/\be:([A-Za-z0-9_]+)(?![A-Za-z0-9_])/g, 'getEnv("$1")');

  const replaceInsideTpl = (s: string) =>
    s
      .replace(/<<\s*e:([A-Za-z0-9_]+)\s*>>/g, '${getEnv("$1")}')
      .replace(/<\s*e:([A-Za-z0-9_]+)\s*>/g, '${getEnv("$1")}')
      .replace(/\be:\{([A-Za-z0-9_]+)\}/g, '${getEnv("$1")}')
      .replace(/\be:([A-Za-z0-9_]+)(?![A-Za-z0-9_])/g, '${getEnv("$1")}');

  let out = '';
  let i = 0;
  while (i < full.length) {
    const start = full.indexOf('`', i);
    if (start === -1) {
      out += replaceOutside(full.slice(i));
      break;
    }
    out += replaceOutside(full.slice(i, start));
    const end = full.indexOf('`', start + 1);
    if (end === -1) {
      out += replaceOutside(full.slice(start));
      break;
    }
    const inner = full.slice(start + 1, end);
    out += '`' + replaceInsideTpl(inner) + '`';
    i = end + 1;
  }
  return out;
};

function randomName(): string {
  // Generate a random stage name like "stage_xxxxx"
  return 'stage_' + Math.random().toString(36).substr(2, 8);
}
