import {JSONRecord} from './CommonData';
import {resolveRequestedAgainst} from './fileHelper';
import {ImportTracker} from './importTracker';
import {indentLines, toInputsParams, toLowerUnderscore} from './JSerHelper';
import {importsToJsfuncDetailed} from './JSerImports';
import {flowToJsFunc} from './JSerTestFlow';
import {DEFAULT_OUTPUT_KEYS} from './outputExtractor';
import {TestData} from './TestData';
import {
  collectInputRefsFromObject,
  normalizeEnvTokens,
  replaceAllRefs,
  toTemplateWithEnvVars,
} from './variableReplacer';

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

const SCALAR_DEFAULT_OUTPUT_KEYS = new Set(['status', 'duration']);

function isAllowedOutputKeyReference(outputKey: string, allowedOutputs: Set<string>): boolean {
  if (allowedOutputs.has(outputKey)) {
    return true;
  }
  if (outputKey.startsWith('_.')) {
    const hiddenKey = outputKey.slice(2);
    const dotIdx = hiddenKey.indexOf('.');
    const rootKey = dotIdx >= 0 ? hiddenKey.slice(0, dotIdx) : hiddenKey;
    const hasAccessor = dotIdx >= 0;
    return DEFAULT_OUTPUT_KEYS.includes(rootKey) && (!hasAccessor || !SCALAR_DEFAULT_OUTPUT_KEYS.has(rootKey));
  }
  const dotIdx = outputKey.indexOf('.');
  if (dotIdx > 0 && allowedOutputs.has(outputKey.slice(0, dotIdx))) {
    return true;
  }
  return false;
}


export const testToJsfunc = async(
    ctx: TestContext, root: boolean,
    importTracker: ImportTracker = new ImportTracker()): Promise<string> => {
  if (Array.isArray(ctx.test.stages) && ctx.test.stages.length > 0 &&
      Array.isArray(ctx.test.steps) && ctx.test.steps.length > 0) {
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

  // Validate that all i:xxx references point to declared inputs
  const declaredInputKeys = new Set(Object.keys(paramsAsObj));
  const inputRefs = collectInputRefsFromObject(ctx.test);
  const undefinedRefs = inputRefs.filter(name => !declaredInputKeys.has(name));
  if (undefinedRefs.length > 0) {
    throw new Error(
      `Undefined input(s): ${undefinedRefs.map(r => `"${r}"`).join(', ')}. Define them in the 'inputs' section of the test file.`
    );
  }

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
  // Also build alias → inputKeys map for input validation
  const importTitleMap: Record<string, string> = {};
  const importInputKeysMap: Record<string, Set<string>> = {};
  const importOutputKeysMap: Record<string, Set<string>> = {};
  for (const [alias, requested] of importsEntries) {
    const requestedPathRaw = typeof requested === 'string' ? requested : '';
    const resolvedPath = resolveRequestedAgainst(
        ctx.filePath || '', requestedPathRaw, ctx.projectRoot);
    const title = ctx.importTracker?.getFileTitle(resolvedPath);
    if (title) {
      importTitleMap[alias] = title;
    }
    const inputKeys = ctx.importTracker?.getInputKeys(resolvedPath);
    if (inputKeys) {
      importInputKeysMap[alias] = new Set(inputKeys);
    }
    const outputKeys = ctx.importTracker?.getOutputKeys(resolvedPath);
    if (outputKeys) {
      importOutputKeysMap[alias] = new Set(outputKeys);
    }
  }

  // Validate call step inputs match imported file's defined inputs
  const validateCallContracts = (steps: any[], context: string) => {
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (!step || typeof step !== 'object') { continue; }
      if (step.call && typeof step.call === 'string' && step.inputs && typeof step.inputs === 'object') {
        const allowed = importInputKeysMap[step.call];
        if (allowed) {
          const unknownInputs = Object.keys(step.inputs).filter(k => !allowed.has(k));
          if (unknownInputs.length > 0) {
            throw new Error(
              `${context}[${i}]: call "${step.call}" has undefined input(s): ${unknownInputs.map(k => `"${k}"`).join(', ')}`
            );
          }
        }
      }
      if (step.call && typeof step.call === 'string') {
        const allowedOutputs = importOutputKeysMap[step.call];
        const validateOutputMap = (map: Record<string, unknown> | undefined, label: 'expect' | 'debug') => {
          if (!allowedOutputs || !map || typeof map !== 'object' || Array.isArray(map)) {
            return;
          }
          const unknownOutputs = Object.keys(map).filter(k => !isAllowedOutputKeyReference(k, allowedOutputs));
          if (unknownOutputs.length > 0) {
            throw new Error(
              `${context}[${i}]: call "${step.call}" has undefined output(s) in ${label}: ${unknownOutputs.map(k => `"${k}"`).join(', ')}`
            );
          }
        };
        validateOutputMap(step.expect, 'expect');
        if (step.debug !== true) {
          validateOutputMap(step.debug, 'debug');
        }
      }
      if (Array.isArray(step.steps)) {
        validateCallContracts(step.steps, `${context}[${i}].steps`);
      }
      if (Array.isArray(step.else)) {
        validateCallContracts(step.else, `${context}[${i}].else`);
      }
    }
  };
  const allSteps = Array.isArray(replaced.steps) ? replaced.steps : [];
  const allStages = Array.isArray(replaced.stages) ? replaced.stages : [];
  if (allSteps.length > 0) {
    validateCallContracts(allSteps, 'steps');
  }
  for (const stage of allStages) {
    if (stage && Array.isArray(stage.steps)) {
      validateCallContracts(stage.steps, `stage "${stage.id || '?'}"`);
    }
  }

  const emitSetenv = root || (Array.isArray(ctx.test.tags) && ctx.test.tags.includes('http'));
  flow += await flowToJsFunc(replaced, root, useExternalReport, importTitleMap, emitSetenv);

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
    const templated = toTemplateWithEnvVars(s);
    return templated.slice(1, -1);
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

const chooseRootFunctionName =
    (name: string, usedNames: Set<string>): string => {
      const base = toLowerUnderscore(name) || 'testflow';
      let candidate = `${base}_`;
      let suffix = 1;
      while (usedNames.has(candidate)) {
        candidate = `${base}_${suffix}_`;
        suffix++;
      }
      return candidate;
    };

export const rootTestToJsfunc = async(ctx: TestContext): Promise<string> => {
  const tracker = new ImportTracker();
  const importResult = await importsToJsfuncDetailed(
      ctx.test.import ?? {}, tracker, ctx.filePath, ctx.projectRoot);
  const importedFuncs = importResult.js;
  const usedNames = new Set(Object.values(importResult.functionNameByResolvedPath));
  const rootFuncName = chooseRootFunctionName(ctx.name, usedNames);
  // testToJsfunc appends '_' for root wrappers; pass the stem only.
  const rootNameStem = rootFuncName.endsWith('_') ?
      rootFuncName.slice(0, -1) :
      rootFuncName;

  const test =
      await testToJsfunc({...ctx, name: rootNameStem, importTracker: tracker}, true, tracker);
  const envPretty = JSON.stringify(ctx.envVars || {}, null, 2);

  const full = `const envVariables = ${envPretty};\n\n${importedFuncs}\n${
      test}\nreturn ${rootFuncName}({});`;
  return variableReplacer(full);
};
