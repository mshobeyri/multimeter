import {JSONRecord} from './CommonData';
import {resolveRequestedAgainst} from './fileHelper';
import {ImportTracker} from './importTracker';
import {indentLines, parseCacheExpiryAtMs, toInputsParams, toLowerUnderscore} from './JSerHelper';
import {importsToJsfuncDetailed} from './JSerImports';
import {flowToJsFunc} from './JSerTestFlow';
import {DEFAULT_OUTPUT_KEYS} from './outputExtractor';
import {TestData} from './TestData';
import {
  normalizeEnvTokens,
  replaceAllRefs,
  replaceOutputTokenRefs,
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

  // Missing i: names stay as the token text (same as unknown r:/c:).
  // The editor already warns; do not fail the run.
  const knownInputNames = new Set(Object.keys(paramsAsObj));

  // Keep `${input}` placeholders in the generated function. Concrete values
  // (including interdependent input defaults) are supplied at the call site
  // via resolveInputsMap — overlaying raw YAML defaults here breaks
  // <<i:other>> composition when those defaults are still e:/i: tokens.
  let replaced = replaceAllRefs(
      ctx.test, paramsAsObj, {}, ctx.envVars ?? {}, new Set(),
      {resolveRuntimeTokens: false});
  // Test-only: o:/<<o:…>> → ${outputs.…}. Do not run on APIs (doc annotations).
  replaced = replaceOutputTokenRefs(replaced);

  let inputParams = toInputsParams(replaced.inputs || {}, ' = ', knownInputNames);
  if (inputParams.length > 0) {
    inputParams += ' ';
  }

  let flow = '';
  let outputParams = toInputsParams(replaced.outputs || {}, ': ', knownInputNames);
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
        const validateOutputMap = (map: Record<string, unknown> | undefined, label: 'expect' | 'require' | 'debug') => {
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
        validateOutputMap(step.require, 'require');
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

  // setenv also applies in imported tests so later steps of the caller see it.
  const emitSetenv = true;
  flow += await flowToJsFunc(
      replaced, root, useExternalReport, importTitleMap, emitSetenv, knownInputNames);

  const fnName = `${toLowerUnderscore(ctx.name)}${root ? '_' : ''}`;
  const cacheSpec = ctx.test.cache;
  const cacheProbe = cacheSpec !== undefined && cacheSpec !== null && cacheSpec !== '' ?
      parseCacheExpiryAtMs(cacheSpec) :
      undefined;
  const useCallCache = typeof cacheProbe === 'number' && Number.isFinite(cacheProbe);
  const cacheTitle = JSON.stringify(ctx.test.title || ctx.name || fnName);
  const cacheSpecLiteral = JSON.stringify(cacheSpec);
  const inputKeys = Object.keys(replaced.inputs || {});
  const resolvedInputsLiteral = inputKeys.length ?
      '{ ' + inputKeys.map(k => `${k}`).join(', ') + ' }' :
      '{}';

  if (useCallCache && !root) {
    // Imported test with cache: key on resolved inputs (after defaults),
    // skip body on hit, store outputs on miss. Expiry is computed at store
    // time so duration values are relative to the miss, not codegen time.
    return `${jsImportsHoisted ? jsImportsHoisted + '\n\n' : ''}const ${fnName} = async (__mmtArgs = {}) => {
  const { ${inputParams} } = __mmtArgs;
  const __mmtResolvedInputs = ${resolvedInputsLiteral};
  const __mmtCacheHit = getTestCallCache_(${cacheTitle}, __mmtResolvedInputs);
  if (__mmtCacheHit !== undefined) {
    return __mmtCacheHit;
  }
  ${indentLines(importsAssignments)}\n
  let outputs = {${outputParams}};
  ${indentLines(flow)}
  setTestCallCache_(${cacheTitle}, __mmtResolvedInputs, outputs, parseCacheExpiryAtMs_(${cacheSpecLiteral}));
  return outputs;
};\n`;
  }

  if (useCallCache && root) {
    // Root / suite-item run always executes (debuggable) but still seeds the
    // in-run cache so later callers in the same hierarchy can hit.
    return `${jsImportsHoisted ? jsImportsHoisted + '\n\n' : ''}const ${fnName} = async ({ ${
        inputParams}} = {}) => {
  const __mmtResolvedInputs = ${resolvedInputsLiteral};
  ${indentLines(importsAssignments)}\n
  let outputs = {${outputParams}};
  ${indentLines(flow)}
  setTestCallCache_(${cacheTitle}, __mmtResolvedInputs, outputs, parseCacheExpiryAtMs_(${cacheSpecLiteral}));
  return outputs;
};\n`;
  }

  return `${jsImportsHoisted ? jsImportsHoisted + '\n\n' : ''}const ${fnName} = async ({ ${
      inputParams}} = {}) => {
  ${indentLines(importsAssignments)}\n
  let outputs = {${outputParams}};
  ${indentLines(flow)}
  return outputs;
};\n`;
};

export const variableReplacer = (full: string): string => {
  const replaceOutside = normalizeEnvTokens;

  // Quoted `"<<token>>"` / `"{{token}}"` and XML-escaped `&lt;&lt;token&gt;&gt;`
  // are already final text. A second scan must not turn them into env or
  // random calls. Unquoted `<<token>>` in the same template still resolves.
  const quotedLiteralSpan =
      /("<<\s*(?:e|i|r|c|o):[^"]*>>"|"\{\{\s*(?:e|i|r|c|o):[^"]*\}\}"|&lt;&lt;\s*(?:e|i|r|c|o):[\s\S]*?&gt;&gt;|%3C%3C\s*(?:e|i|r|c|o):[\s\S]*?%3E%3E|%7B%7B\s*(?:e|i|r|c|o):[\s\S]*?%7D%7D|>\s*\{\{\s*(?:e|i|r|c|o):[^<]*\}\}\s*<)/gi;

  const replaceInsideTpl = (s: string) => {
    const slots: string[] = [];
    const shielded = s.replace(quotedLiteralSpan, (match) => {
      const id = `__MMT_HOLD_${slots.length}__`;
      slots.push(match);
      return id;
    });
    const templated = toTemplateWithEnvVars(shielded);
    let inner = templated.slice(1, -1);
    for (let n = 0; n < slots.length; n++) {
      inner = inner.split(`__MMT_HOLD_${n}__`).join(slots[n]);
    }
    return inner;
  };

  const endOfQuoted = (source: string, start: number): number => {
    const quote = source[start];
    let i = start + 1;
    while (i < source.length) {
      if (source[i] === '\\') {
        i += 2;
        continue;
      }
      if (source[i] === quote) {
        return i + 1;
      }
      i++;
    }
    return source.length;
  };

  let out = '';
  let i = 0;
  while (i < full.length) {
    const startBt = full.indexOf('`', i);
    const startDq = full.indexOf('"', i);
    const startSq = full.indexOf('\'', i);
    const candidates = [startBt, startDq, startSq].filter(n => n >= 0);
    if (candidates.length === 0) {
      out += replaceOutside(full.slice(i));
      break;
    }
    const start = Math.min(...candidates);
    out += replaceOutside(full.slice(i, start));
    if (full[start] === '`') {
      const end = full.indexOf('`', start + 1);
      if (end === -1) {
        out += replaceOutside(full.slice(start));
        break;
      }
      const inner = full.slice(start + 1, end);
      out += '`' + replaceInsideTpl(inner) + '`';
      i = end + 1;
      continue;
    }
    const end = endOfQuoted(full, start);
    out += full.slice(start, end);
    i = end;
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

  // Do not substitute e: at codegen — the process EnvStore supplies values.
  const test = await testToJsfunc(
      {...ctx, envVars: {}, name: rootNameStem, importTracker: tracker}, true,
      tracker);
  const rawInputs = {...(ctx.test.inputs || {}), ...(ctx.inputs || {})};
  const runRoot =
      `return (async () => {\n` +
      `  const __mmtRawInputs = ${JSON.stringify(rawInputs)};\n` +
      `  const __mmtResolvedInputs = typeof resolveInputsMapAsync_ === 'function'\n` +
      `    ? await resolveInputsMapAsync_(__mmtRawInputs, envVariables)\n` +
      `    : resolveInputsMap_(__mmtRawInputs, envVariables);\n` +
      `  return ${rootFuncName}(__mmtResolvedInputs);\n` +
      `})();`;
  const full = `${importedFuncs}\n${test}\n${runRoot}`;
  return variableReplacer(full);
};
