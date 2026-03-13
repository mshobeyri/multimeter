import {JSONRecord} from './CommonData';
import {resolveRequestedAgainst} from './fileHelper';
import {ImportTracker} from './importTracker';
import {indentLines, toInputsParams, toLowerUnderscore} from './JSerHelper';
import {importsToJsfunc} from './JSerImports';
import {flowToJsFunc} from './JSerTestFlow';
import {TestData} from './TestData';
import {normalizeEnvTokens, replaceAllRefs} from './variableReplacer';

export interface TestContext {
  test: TestData, name: string, inputs: JSONRecord, envVars: JSONRecord,
      /** Optional original file path for resolving imports */
      filePath?: string, importTracker?: ImportTracker,
      /** Project root directory (where multimeter.mmt lives) for +/ imports */
      projectRoot?: string,
      /** 
       * When true, use external report settings for checks/asserts.
       * Set when running from a suite or imported into another test.
       */
      isExternal?: boolean
}


export const testToJsfunc = async(
    ctx: TestContext, root: boolean,
    importTracker: ImportTracker = new ImportTracker()): Promise<string> => {
  if (ctx.test.stages && ctx.test.stages.length > 0 && ctx.test.steps &&
      ctx.test.steps.length > 0) {
    throw new Error(`${ctx.name}: Test cannot have both stages and steps`);
  }

  const aliasMapForThis =
      ctx.importTracker?.getAliasesForImporter(ctx.filePath || '') || {};
  const importsEntries = Object.entries(ctx.test.import ?? {});
  const jsImports = importsEntries
      .map(([key, requested]) => {
        const fromAliasMap = aliasMapForThis[key];
        if (fromAliasMap) {
          return null;
        }
        const requestedPathRaw = typeof requested === 'string' ? requested : '';
        const normalizedRequested = resolveRequestedAgainst(
            ctx.filePath || '', requestedPathRaw, ctx.projectRoot);
        const lower = normalizedRequested.toLowerCase();
        if (lower.endsWith('.js') || lower.endsWith('.cjs') || lower.endsWith('.mjs')) {
          return {
            alias: key,
            resolvedPath: normalizedRequested,
            hoistedName: `${key}_`,
          };
        }
        return null;
      })
      .filter(Boolean) as Array<{alias: string; resolvedPath: string; hoistedName: string}>;

  const jsImportsHoisted = jsImports
      .map(
          x => {
            const p = JSON.stringify(x.resolvedPath);
            return `const ${x.hoistedName} = importJsModule_(
  ${p},
  {
    moduleId: ${p}
  }
);`;
          })
      .join('\n');

  const importsAssignments = importsEntries
      .map(([key, requested]) => {
        const jsImport = jsImports.find(x => x.alias === key);
        if (jsImport) {
          return `const ${key} = await ${jsImport.hoistedName};`;
        }
        const fromAliasMap = aliasMapForThis[key];
        if (fromAliasMap) {
          return `const ${key} = ${fromAliasMap};`;
        }
        const requestedPathRaw = typeof requested === 'string' ? requested : '';
        const normalizedRequested = resolveRequestedAgainst(
            ctx.filePath || '', requestedPathRaw, ctx.projectRoot);
        const fnFromRequested = ctx.importTracker?.getTestFuncName(normalizedRequested);
        if (fnFromRequested) {
          return `const ${key} = ${fnFromRequested};`;
        }
        const base = (requestedPathRaw.split('/').pop() || '').replace(/\.[^.]+$/, '');
        const fnFallback = toLowerUnderscore(base || 'imported');
        return `const ${key} = ${fnFallback};`;
      })
      .join('\n');

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

  // For report settings: use external if not root OR if explicitly marked as external (suite run)
  const useExternalReport = !root || ctx.isExternal === true;

  // Build alias → title map so call steps can display the API/test title
  const importTitleMap: Record<string, string> = {};
  for (const [alias, requested] of importsEntries) {
    const requestedPathRaw = typeof requested === 'string' ? requested : '';
    const resolvedPath = resolveRequestedAgainst(
        ctx.filePath || '', requestedPathRaw, ctx.projectRoot);
    const title = ctx.importTracker?.getFileTitle(resolvedPath);
    if (title) {
      importTitleMap[alias] = title;
    }
  }

  flow += flowToJsFunc(replaced, root, useExternalReport, importTitleMap);

  return `${jsImportsHoisted ? jsImportsHoisted + '\n\n' : ''}const ${toLowerUnderscore(ctx.name)}${root ? '_' : ''} = async ({ ${
      inputParams}} = {}) => {
  ${indentLines(importsAssignments)}\n
  let outputs = {${outputParams}};
  ${indentLines(flow)}
  return outputs;
};\n`;
};

export const variableReplacer = (full: string): string => {
  const replaceOutside = normalizeEnvTokens;

  const replaceInsideTpl = (s: string) => {
    // Normalize to plain references first, then wrap each in ${…}
    const normalized = normalizeEnvTokens(s);
    return normalized.replace(
        /envVariables\.([A-Za-z_][A-Za-z0-9_]*)/g, (m, name, offset, str) => {
          if (offset >= 2 && str[offset - 2] === '$' && str[offset - 1] === '{') {
            return m;
          }
          return '${envVariables.' + name + '}';
        });
  };

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
      await importsToJsfunc(ctx.test.import ?? {}, tracker, ctx.filePath, ctx.projectRoot);

  const test =
      await testToJsfunc({...ctx, importTracker: tracker}, true, tracker);
  const envPretty = JSON.stringify(ctx.envVars || {}, null, 2);

  const full = `const envVariables = ${envPretty};\n\n${importedFuncs}\n${
      test}\nreturn ${toLowerUnderscore(ctx.name)}_({});`;
  return variableReplacer(full);
};
