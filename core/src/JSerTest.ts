import {JSONRecord} from './CommonData';
import {ImportTracker} from './importTracker';
import {indentLines, toInputsParams, toLowerUnderscore} from './JSerHelper';
import {resolveRequestedAgainst} from './fileHelper';
import {importsToJsfunc} from './JSerImports';
import {flowToJsFunc} from './JSerTestFlow';
import {TestData} from './TestData';
import {replaceAllRefs} from './variableReplacer';

export interface TestContext {
  test: TestData, name: string, inputs: JSONRecord, envVars: JSONRecord,
      /** Optional original file path for resolving imports */
      filePath?: string, importTracker?: ImportTracker
}


export const testToJsfunc = async(
    ctx: TestContext, root: boolean,
    importTracker: ImportTracker = new ImportTracker()): Promise<string> => {
  if (ctx.test.stages && ctx.test.stages.length > 0 && ctx.test.steps &&
      ctx.test.steps.length > 0) {
    throw new Error(`${ctx.name}: Test cannot have both stages and steps`);
  }

  const aliasMap =
      ctx.importTracker?.getAliasesForImporter(ctx.filePath || '') || {};
  const importAliases = Object.keys(ctx.test.import ?? {})
                            .map(key => `${key}: imports.${key}`)
                            .join(', ');

  const importsObjEntries =
      Object.keys(ctx.test.import ?? {})
          .map(key => {
            const fromAliasMap = aliasMap[key];
            if (fromAliasMap) {
              return `  ${key}: ${fromAliasMap}`;
            }

            const requested = (ctx.test.import as any)?.[key];
            const normalizedRequested = typeof requested === 'string' ?
              resolveRequestedAgainst(ctx.filePath, requested) :
              undefined;
            const fnFromRequested = normalizedRequested ?
              ctx.importTracker?.getTestFuncName(normalizedRequested) :
              undefined;
            if (fnFromRequested) {
              return `  ${key}: ${fnFromRequested}`;
            }

            return `  ${key}: ???`;
          })
          .join(',\n');

  const importsObj =
      importsObjEntries ? `const imports = {\n${importsObjEntries}\n};` : '';

  const paramsAsObj: Record<string, string> = Object.fromEntries(
      Object.keys(ctx.test.inputs ?? {}).map(key => [key, `\${${key}}`]));

  let replaced = replaceAllRefs(ctx.test, paramsAsObj, ctx.inputs, {});

  let inputParams = toInputsParams(replaced.inputs || {}, ' = ');
  if (inputParams.length > 0) {
    inputParams += ' ';
  }

  let flow = '';
  let outputParams = toInputsParams(replaced.outputs || {}, ': ');
  if (outputParams.length > 0) {
    outputParams = ' ' + outputParams + ' ';
  }

  flow += flowToJsFunc(replaced, root);

  return `const ${toLowerUnderscore(ctx.name)} = async ({ ${
      inputParams}} = {}) => {
  ${indentLines(importsObj)}
  let outputs = {${outputParams}};
  ${indentLines(flow)}
  return outputs;
};\n`;
};


export const variableReplacer = (full: string): string => {
  const replaceOutside = (s: string) =>
      s.replace(/<<\s*e:([A-Za-z0-9_]+)\s*>>/g, 'envVariables.$1')
          .replace(/<\s*e:([A-Za-z0-9_]+)\s*>/g, 'envVariables.$1')
          .replace(/\be:\{([A-Za-z0-9_]+)\}/g, 'envVariables.$1')
          .replace(/\be:([A-Za-z0-9_]+)(?![A-Za-z0-9_])/g, 'envVariables.$1');

  const replaceInsideTpl = (s: string) =>
      s.replace(/<<\s*e:([A-Za-z0-9_]+)\s*>>/g, '${envVariables.$1}')
          .replace(/<\s*e:([A-Za-z0-9_]+)\s*>/g, '${envVariables.$1}')
          .replace(/\be:\{([A-Za-z0-9_]+)\}/g, '${envVariables.$1}')
          .replace(
              /\be:([A-Za-z0-9_]+)(?![A-Za-z0-9_])/g, '${envVariables.$1}');

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

export const rootTestToJsfunc = async(ctx: TestContext): Promise<string> => {
  const tracker = new ImportTracker();
  let importedFuncs =
      await importsToJsfunc(ctx.test.import ?? {}, tracker, ctx.filePath);

  const test =
      await testToJsfunc({...ctx, importTracker: tracker}, true, tracker);
  const envPretty = JSON.stringify(ctx.envVars || {}, null, 2);

  const full = `const envVariables = ${envPretty};\n\n${importedFuncs}\n${
      test}\nreturn ${toLowerUnderscore(ctx.name)}({});`;
  return variableReplacer(full);
};
