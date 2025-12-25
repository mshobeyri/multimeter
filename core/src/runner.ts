import {APIData} from './APIData';
import {yamlToAPI} from './apiParsePack';
import {Type} from './CommonData';
import docHtml from './docHtml';
import docMarkdown from './docMarkdown';
import * as JSer from './JSer';
import { LogLevel } from "./CommonData";
import {FileLoader, GenerateJsOptions, mergeEnv, mergeInputs, RunFileOptions, RunResult} from './runConfig';
import * as testParsePack from './testParsePack';
import { replaceAllRefs } from './variableReplacer';
import {yamlToSuite, splitSuiteGroups} from './suiteParsePack';


export async function generateTestJs(opts: GenerateJsOptions): Promise<string> {
  const {rawText, name, inputs, envVars, fileLoader} = opts;
  // Wire import file loader for CSV/YAML includes
  JSer.setFileLoader(async (p: string) => {
    try {
      const t = await fileLoader(p);
      return typeof t === 'string' ? t : '';
    } catch {
      return '';
    }
  });
  const test =
      testParsePack.yamlToTest ? testParsePack.yamlToTest(rawText) : {} as any;
  let js = await JSer.rootTestToJsfunc({test, name, inputs, envVars});
  // Normalize env tokens in JS if variableReplacer is present on JSer
  const anyJSer: any = JSer as any;
  if (anyJSer.variableReplacer &&
      typeof anyJSer.variableReplacer === 'function') {
    js = anyJSer.variableReplacer(js);
  }
  return js;
}

export async function runGeneratedJs(
    js: string, title: string, logger: (level: LogLevel, msg: string) => void,
    runCode:
        (code: string, title: string,
         lg: (lvl: LogLevel, msg: string) => void) =>
            Promise<void>): Promise<RunResult> {
  const start = Date.now();
  const errors: string[] = [];
  const logs: string[] = [];
  const forward = (level: LogLevel, msg: string) => {
    if (level === 'error') {
      errors.push(msg);
    }
    logs.push(String(msg));
    logger(level, msg);
  };
  try {
    if (!js || !js.trim()) {
      errors.push('Empty JS input');
      return {success: false, durationMs: Date.now() - start, errors, logs};
    }
    await runCode(js, title, forward);
    return {
      success: errors.length === 0,
      durationMs: Date.now() - start,
      errors,
      logs
    };
  } catch (e: any) {
    errors.push(e?.message || String(e));
    return {success: false, durationMs: Date.now() - start, errors, logs};
  }
}

export interface BuildDocOptions {
  title?: string;
  description?: string;
  logo?: string;
  sources?: string[];
  services?: any[];
  format?: 'html'|'md';
}

export function buildDocFromApis(apis: any[], opts: BuildDocOptions): string {
  const {format = 'html', ...rest} = opts || {};
  if (format === 'md') {
    return (docMarkdown as any).buildDocMarkdown(apis, rest);
  }
  return docHtml.buildDocHtml(apis, rest);
}
export interface RunFileResult {
  js: string;
  result: RunResult;
  identifier: string;
  displayName: string;
  docType: Type|null;
  inputsUsed: Record<string, any>;
  envVarsUsed: Record<string, any>;
  exampleName?: string;
  exampleIndex?: number;
}

export interface PreparedRun {
  rawText: string;
  filePath: string;
  baseName: string;
  docType: Type|null;
  envVarsUsed: Record<string, any>;
  inputsUsed: Record<string, any>;
  apiDoc?: APIData;
  exampleName?: string;
  exampleIndex?: number;
}

export async function prepareRunFromOptions(
    options: RunFileOptions,
    log: (level: LogLevel, message: string) => void =
        () => {}): Promise<PreparedRun> {
  const {file, fileType, filePath: optFilePath} = options as any;
  const filePath = typeof optFilePath === 'string' && optFilePath ?
      optFilePath :
      (fileType === 'path' ? file : '');
  let rawText = file;
  if (fileType === 'path') {
    try {
      rawText = await options.fileLoader(filePath || file);
    } catch {
      rawText = '';
    }
  }
  const docType = detectDocType(filePath, rawText);
  const envVarsUsed = mergeEnv({
    envvar: options.envvar,
    manualEnvvars: options.manualEnvvars,
  });
  const baseName = basename(filePath || '');
  const manualInputs: Record<string, any> = {...(options.manualInputs || {})};
  const requestedExampleIndex =
      typeof options.exampleIndex === 'number' && options.exampleIndex >= 0 ?
      options.exampleIndex :
      undefined;
    const requestedExampleName =
      typeof options.exampleName === 'string' && options.exampleName.trim() ?
      options.exampleName.trim() :
      undefined;

  if (docType === 'api') {
    const apiDoc = yamlToAPI(rawText);
    const defaultInputs =
        isPlainObject(apiDoc.inputs) ? apiDoc.inputs as Record<string, any>: {};
    const manualInputsForMerge = {...manualInputs};
    const {exampleInputs, resolvedExampleName, resolvedExampleIndex} =
      resolveApiExample(
        apiDoc, requestedExampleIndex, requestedExampleName, log);
    const inputsUsed = mergeInputs({
      defaultInputs,
      exampleInputs,
      manualInputs: manualInputsForMerge,
    });
    return {
      rawText,
      filePath,
      baseName,
      docType,
      envVarsUsed,
      inputsUsed,
      apiDoc,
      exampleName: resolvedExampleName,
      exampleIndex: resolvedExampleIndex,
    };
  }

  if (docType === 'test') {
    const testDoc = testParsePack.yamlToTest ?
        testParsePack.yamlToTest(rawText) :
        {} as any;
    const defaultInputs = isPlainObject(testDoc?.inputs) ?
        testDoc.inputs as Record<string, any>:
        {};
    const inputsUsed = mergeInputs({
      defaultInputs,
      manualInputs,
    });
    return {
      rawText,
      filePath,
      baseName,
      docType,
      envVarsUsed,
      inputsUsed,
    };
  }

  return {
    rawText,
    filePath,
    baseName,
    docType,
    envVarsUsed,
    inputsUsed: manualInputs,
  };
}

export async function runFile(options: RunFileOptions): Promise<RunFileResult> {
  const {fileLoader, runCode, logger} = options;
  const sinkLogger: (level: LogLevel, msg: string) => void =
      logger ?? (() => {});
  const preLogs: Array<{level: LogLevel; message: string}> = [];
  const note = (level: LogLevel, message: string) => {
    preLogs.push({level, message});
    sinkLogger(level, message);
  };
  const prepared = await prepareRunFromOptions(options, note);
  const {
    docType,
    baseName,
    rawText,
    envVarsUsed: envVars,
    inputsUsed,
    apiDoc,
    exampleName,
    exampleIndex,
  } = prepared;

  if (docType === 'api' && apiDoc) {
    const exampleLabelParts: string[] = [];
    if (typeof exampleIndex === 'number') {
      exampleLabelParts.push(`#${exampleIndex + 1}`);
    }
    if (exampleName) {
      exampleLabelParts.push(exampleName);
    }
    const exampleLabel =
        exampleLabelParts.length > 0 ? exampleLabelParts.join(' ') : undefined;
    const displayName =
        exampleLabel ? `${baseName} (${exampleLabel})` : baseName;
    const identifier = sanitizeIdentifier(
        exampleLabel ? `${baseName}_${exampleLabel}` : baseName);
    const js = await generateApiJs({
      api: apiDoc,
      name: identifier,
      envVars,
      inputs: inputsUsed,
      fileLoader,
      exampleName,
      exampleIndex,
    });
    const result = await runGeneratedJs(js, displayName, sinkLogger, runCode);
    if (preLogs.length) {
      result.logs = [...preLogs.map(l => l.message), ...(result.logs ?? [])];
    }
    return {
      js,
      result,
      identifier,
      displayName,
      docType,
      inputsUsed,
      envVarsUsed: envVars,
      exampleName,
      exampleIndex,
    };
  }

  if (docType === 'test') {
    const identifier = sanitizeIdentifier(baseName);
    const js = await generateTestJs({
      rawText,
      name: identifier,
      inputs: inputsUsed,
      envVars,
      fileLoader,
    });
    const result = await runGeneratedJs(js, baseName, sinkLogger, runCode);
    if (preLogs.length) {
      result.logs = [...preLogs.map(l => l.message), ...(result.logs ?? [])];
    }
    return {
      js,
      result,
      identifier,
      displayName: baseName,
      docType,
      inputsUsed,
      envVarsUsed: envVars,
      exampleName,
      exampleIndex,
    };
  }

  if (docType === 'suite') {
    const suite = yamlToSuite(rawText);
    const mergedInputsUsed = {...(options.manualInputs || {})};

    const groups = splitSuiteGroups(suite.tests);
    const suiteBaseName = baseName;
    const identifier = sanitizeIdentifier(suiteBaseName);

    const allLogs: string[] = [];
    const allErrors: string[] = [];
    const suiteStart = Date.now();

    const suiteLogger = (level: LogLevel, msg: string) => {
      allLogs.push(String(msg));
      if (level === 'error') {
        allErrors.push(String(msg));
      }
      sinkLogger(level, msg);
    };

    suiteLogger('info', `Running suite ${suiteBaseName}...`);
    if (suite.title) {
      suiteLogger('info', `SUITE: ${suite.title}`);
    }

    let overallSuccess = true;
    let hardStop = false;

    for (let gi = 0; gi < groups.length && !hardStop; gi++) {
      const group = groups[gi];
      suiteLogger('info', `SUITE GROUP ${gi + 1}/${groups.length}`);

      const results = await Promise.all(
          group.map(async (entry) => {
            const childFilePath = resolveRelativeTo(entry, prepared.filePath);
            const childRawText = await fileLoader(childFilePath);
            const childDocType = detectDocType(childFilePath, childRawText);
            const display = basename(childFilePath || entry);
            suiteLogger('info', `Running suite item: ${display}`);

            const childRun = await runFile({
              ...options,
              file: childRawText,
              fileType: 'raw',
              filePath: childFilePath,
              manualInputs: mergedInputsUsed,
              logger: suiteLogger,
            } as any);
            return {
              entry,
              filePath: childFilePath,
              docType: childDocType,
              success: !!childRun.result?.success,
              errors: childRun.result?.errors ?? [],
              logs: childRun.result?.logs ?? [],
            };
          }));

      // Determine hard-stop vs soft-fail based on assert vs check.
      // Current test semantics: assert => throws => logged as error with "Assertion ...".
      const groupHadHardFailure = results.some(r =>
        (r.errors || []).some(e => String(e).includes('Assertion ')) ||
        (r.logs || []).some(l => String(l).includes('Assertion ')));
      const groupHadAnyFailure = results.some(r => !r.success);

      if (groupHadAnyFailure) {
        overallSuccess = false;
      }
      if (groupHadHardFailure) {
        hardStop = true;
        suiteLogger('error', `Suite stopped due to assertion failure in group ${gi + 1}.`);
      }
    }

    const durationMs = Date.now() - suiteStart;
    const result: RunResult = {
      success: overallSuccess && !hardStop,
      durationMs,
      errors: allErrors,
      logs: allLogs,
    };
    if (preLogs.length) {
      result.logs = [...preLogs.map(l => l.message), ...(result.logs ?? [])];
    }
    return {
      js: '',
      result,
      identifier,
      displayName: suiteBaseName,
      docType,
      inputsUsed: mergedInputsUsed,
      envVarsUsed: envVars,
    };
  }

  throw new Error('Run is currently supported for test or api documents only.');
}

function resolveRelativeTo(targetPath: string, baseFilePath: string): string {
  if (!targetPath) {
    return targetPath;
  }
  // Similar behavior to "import": resolve relative paths against base file folder.
  if (targetPath.startsWith('/') || /^[A-Za-z]:[\\/]/.test(targetPath)) {
    return targetPath;
  }
  const base = baseFilePath || '';
  const parts = base.split(/[/\\]/);
  parts.pop();
  const baseDir = parts.join('/');
  const combined = (baseDir ? baseDir + '/' : '') + targetPath;
  const outParts: string[] = [];
  for (const p of combined.split('/')) {
    if (!p || p === '.') {
      continue;
    }
    if (p === '..') {
      outParts.pop();
      continue;
    }
    outParts.push(p);
  }
  return (baseDir.startsWith('/') ? '/' : '') + outParts.join('/');
}

function basename(filePath: string): string {
  if (!filePath) {
    return '';
  }
  const parts = filePath.split(/[/\\]/);
  return parts[parts.length - 1] || filePath;
}

function sanitizeIdentifier(value: string): string {
  if (!value) {
    return '_mmt';
  }
  const replaced = value.replace(/[^a-zA-Z0-9_]/g, '_');
  return /^[A-Za-z_$]/.test(replaced) ? replaced : `_${replaced}`;
}

function detectDocType(filePath: string, rawText: string): Type|null {
  try {
    return JSer.fileType(filePath, rawText);
  } catch {
    return null;
  }
}

function isPlainObject(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

interface ResolveExampleResult {
  exampleInputs: Record<string, any>;
  resolvedExampleName?: string;
  resolvedExampleIndex?: number;
}

function resolveApiExample(
    api: APIData, requestedIndex: number|undefined,
    requestedName: string|undefined,
    log: (level: LogLevel, message: string) => void): ResolveExampleResult {
  const examples = Array.isArray(api.examples) ? api.examples : [];
  if (examples.length === 0) {
    return {exampleInputs: {}};
  }
  const toResult = (ex: any, idx?: number): ResolveExampleResult => {
    const name =
        typeof ex?.name === 'string' && ex.name.trim() ? ex.name : undefined;
    const inputs =
        isPlainObject(ex?.inputs) ? {...ex.inputs as Record<string, any>} : {};
    return {
      exampleInputs: inputs,
      resolvedExampleName: name,
      resolvedExampleIndex: typeof idx === 'number' ? idx : undefined,
    };
  };
  if (requestedName) {
    const target = requestedName.trim().toLowerCase();
    const idx = examples.findIndex(ex => {
      const nm = typeof ex?.name === 'string' ? ex.name.trim() : '';
      return nm.toLowerCase() === target;
    });
    if (idx >= 0) {
      return toResult(examples[idx], idx);
    }
    log('warn', `Example "${requestedName}" not found; using API defaults.`);
  }
  if (typeof requestedIndex === 'number' && requestedIndex >= 0 &&
      Number.isInteger(requestedIndex)) {
    if (requestedIndex < examples.length) {
      const ex = examples[requestedIndex];
      return toResult(ex, requestedIndex);
    }
    log('warn',
        `Example #${requestedIndex + 1} not found; using API defaults.`);
  }

  return {exampleInputs: {}};
}

interface GenerateApiJsOptions {
  api: APIData;
  name: string;
  envVars: Record<string, any>;
  inputs: Record<string, any>;
  fileLoader: FileLoader;
  exampleName?: string;
  exampleIndex?: number;
}

async function generateApiJs(options: GenerateApiJsOptions): Promise<string> {
  const {api, name, envVars, inputs, fileLoader, exampleName, exampleIndex} =
      options;
  JSer.setFileLoader(async (p: string) => {
    try {
      const t = await fileLoader(p);
      return typeof t === 'string' ? t : '';
    } catch {
      return '';
    }
  });
  const apiClone: APIData = {
    ...api,
    inputs: isPlainObject(api.inputs) ? {...api.inputs as Record<string, any>} :
                                        api.inputs
  };
  const funcSource = await JSer.apiToJSfunc({
    api: apiClone,
    name,
    inputs: {},
    envVars,
  });
  return `${funcSource}\n\n${
      buildApiRunnerWrapper(
          {name, envVars, inputs, exampleName, exampleIndex})}`;
}

interface ApiRunnerWrapperOptions {
  name: string;
  envVars: Record<string, any>;
  inputs: Record<string, any>;
  exampleName?: string;
  exampleIndex?: number;
}

function buildApiRunnerWrapper(opts: ApiRunnerWrapperOptions): string {
  opts = replaceAllRefs(opts, {}, opts.inputs, opts.envVars);
  const envJson = JSON.stringify(opts.envVars ?? {}, null, 2);
  const inputsJson = JSON.stringify(opts.inputs ?? {}, null, 2);
  const exampleLabelParts: string[] = [];
  if (typeof opts.exampleIndex === 'number' && opts.exampleIndex >= 0) {
    exampleLabelParts.push(`#${opts.exampleIndex + 1}`);
  }
  if (opts.exampleName) {
    exampleLabelParts.push(opts.exampleName);
  }
  const exampleLabel =
      exampleLabelParts.length ? `Example ${exampleLabelParts.join(' ')}` : '';
  const helperFactorySource =
      indentMultiline(createApiLogHelpers.toString(), '    ');
  const helperDestructure = `  const {\n` +
      `    raw: __mmt_raw,\n` +
      `    isRaw: __mmt_isRaw,\n` +
      `    isPlainObject: __mmt_isPlainObject,\n` +
      `    isComplex: __mmt_isComplex,\n` +
      `    escapeString: __mmt_escapeString,\n` +
      `    formatScalar: __mmt_formatScalar,\n` +
      `    formatValue: __mmt_formatValue,\n` +
      `    formatKeyValueObject: __mmt_formatKeyValueObject,\n` +
      `    formatSection: __mmt_formatSection,\n` +
      `    formatDuration: __mmt_formatDuration,\n` +
      `    formatBodyValue: __mmt_formatBodyValue\n` +
      `  } = (\n${helperFactorySource}\n  )();`;
  const exampleLiteral =
      exampleLabel ? `'${escapeForJsString(exampleLabel)}'` : 'null';
  return `return (async () => {\n` +
      `  const envVar = ${envJson};\n` +
      `  const envVariables = envVar;\n` +
      `  const __mmt_envVars = envVar;\n` +
      `  const __mmt_inputs = ${inputsJson};\n` +
      `  const __mmt_exampleLabel = ${exampleLiteral};\n` + helperDestructure +
      '\n' +
      `  const __mmt_originalSend = send;\n` +
      `  send = async function(req) {\n` +
      `    const __req = req || {};\n` +
      `    const __reqLog = {\n` +
      `      url: __mmt_raw(__req.url || ''),\n` +
      `      method: __mmt_raw((__req.method || '').toUpperCase()),\n` +
      `      protocol: __mmt_raw(__req.protocol || ''),\n` +
      `      headers: __req.headers || {},\n` +
      `      query: __req.query || {},\n` +
      `      cookies: __req.cookies || {},\n` +
      `      body: __mmt_formatBodyValue(__req.body)\n` +
      `    };\n` +
      `    console.debug(__mmt_formatSection('REQUEST', __reqLog));\n` +
      `    try {\n` +
      `      const __res = await __mmt_originalSend(req);\n` +
      `      const __status = __res && typeof __res.status === 'number' ? __res.status : '';\n` +
      `      const __statusText = __res && typeof __res.statusText !== 'undefined' ? __res.statusText : '';\n` +
      `      const __duration = __res && typeof __res.duration === 'number' ? __res.duration : undefined;\n` +
      `      const __headers = (__res && __res.headers) || {};\n` +
      `      const __body = __res && Object.prototype.hasOwnProperty.call(__res, 'body') ? __res.body : undefined;\n` +
      `      const __resLog = {\n` +
      `        status: __mmt_raw(__status),\n` +
      `        statusText: __statusText,\n` +
      `        duration: __mmt_formatDuration(__duration),\n` +
      `        headers: __headers,\n` +
      `        body: __mmt_formatBodyValue(__body)\n` +
      `      };\n` +
      `      console.log(__mmt_formatSection('RESPONSE', __resLog));\n` +
      `      if (typeof __status === 'number' && __status < 0) {\n` +
      `        let err = new Error(__statusText || 'Network error');\n` +
      `        err.status = __status;\n` +
      `        err.statusText = __statusText;\n` +
      `        throw err;\n` +
      `      }\n` +
      `      return __res;\n` +
      `    } catch (err) {\n` +
      `      const __errorLog = {\n` +
      `        message: __mmt_raw(err && err.message ? err.message : String(err))\n` +
      `      };\n` +
      `      if (err && typeof err === 'object') {\n` +
      `        if (typeof err.status === 'number') {\n` +
      `          __errorLog.status = __mmt_raw(err.status);\n` +
      `        }\n` +
      `        if (err.headers && typeof err.headers === 'object') {\n` +
      `          __errorLog.headers = err.headers;\n` +
      `        }\n` +
      `      }\n` +
      `      console.log(__mmt_formatSection('RESPONSE', __errorLog));\n` +
      `      throw err;\n` +
      `    }\n` +
      `  };\n\n` +
      `  try {\n` +
      `    if (__mmt_exampleLabel) {\n` +
      `      console.log('Running ' + __mmt_exampleLabel);\n` +
      `    }\n` +
      `    const __mmt_hasEnv = Object.keys(__mmt_envVars || {}).length > 0;\n` +
      `    if (__mmt_hasEnv || __mmt_exampleLabel) {\n` +
      `    }\n` +
      `    if (__mmt_hasEnv) {\n` +
      `      console.debug(__mmt_formatSection('ENVIRONMENT', __mmt_envVars));\n` +
      `    }\n` +
      `    console.debug(__mmt_formatSection('INPUTS', __mmt_inputs));\n` +
      `    const result = await ${opts.name}({ ...__mmt_inputs });\n` +
      `    const __outputLog = (() => {\n` +
      `      if (result === undefined) {\n` +
      `        return { value: __mmt_raw('undefined') };\n` +
      `      }\n` +
      `      if (result === null) {\n` +
      `        return { value: __mmt_raw('null') };\n` +
      `      }\n` +
      `      if (typeof result !== 'object') {\n` +
      `        return { value: result };\n` +
      `      }\n` +
      `      const copy = { ...result };\n` +
      `      if (typeof copy.response_time === 'number' && Number.isFinite(copy.response_time)) {\n` +
      `        copy.response_time = __mmt_raw(copy.response_time + ' ms');\n` +
      `      }\n` +
      `      return copy;\n` +
      `    })();\n` +
      `    console.log(__mmt_formatSection('OUTPUTS', __outputLog));\n` +
      `    return result;\n` +
      `  } finally {\n` +
      `    send = __mmt_originalSend;\n` +
      `  }\n})();`;
}

export interface ApiLogRawValue {
  __mmt_raw: string;
}

export interface ApiLogHelpers {
  raw: (value: unknown) => ApiLogRawValue;
  isRaw: (value: unknown) => value is ApiLogRawValue;
  isPlainObject: (value: unknown) => value is Record<string, any>;
  isComplex: (value: unknown) => boolean;
  escapeString: (value: unknown) => string;
  formatScalar: (value: unknown) => string;
  formatValue: (value: unknown, indentLevel: number) => string;
  formatKeyValueObject:
      (obj: Record<string, any>, indentLevel?: number) => string;
  formatSection: (title: string, obj: Record<string, any>) => string;
  formatDuration: (value: unknown) => ApiLogRawValue;
  formatBodyValue: (body: unknown) => unknown;
}

export function createApiLogHelpers(): ApiLogHelpers {
  function raw(value: unknown): ApiLogRawValue {
    return {__mmt_raw: String(value)};
  }

  function isRaw(value: unknown): value is ApiLogRawValue {
    return !!value && typeof value === 'object' &&
        Object.prototype.hasOwnProperty.call(value, '__mmt_raw');
  }

  function isPlainObject(value: unknown): value is Record<string, any> {
    return !!value && typeof value === 'object' && !Array.isArray(value) &&
        !isRaw(value);
  }

  function isComplex(value: unknown): boolean {
    return Array.isArray(value) || isPlainObject(value);
  }

  function escapeString(value: unknown): string {
    return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  function formatScalar(value: unknown): string {
    if (isRaw(value)) {
      return value.__mmt_raw;
    }
    if (value === null) {
      return 'null';
    }
    if (typeof value === 'string') {
      return '"' + escapeString(value) + '"';
    }
    if (typeof value === 'number') {
      return Number.isFinite(value) ? String(value) : '"' + String(value) + '"';
    }
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }
    if (typeof value === 'bigint') {
      return value.toString();
    }
    return '"' + escapeString(String(value)) + '"';
  }

  function formatValue(value: unknown, indentLevel: number): string {
    const indent = ' '.repeat(indentLevel);
    if (!isComplex(value)) {
      return indent + formatScalar(value);
    }
    if (Array.isArray(value)) {
      if (!value.length) {
        return indent + '[]';
      }
      const lines = [indent + '['];
      for (const item of value) {
        lines.push(formatValue(item, indentLevel + 2));
      }
      lines.push(indent + ']');
      return lines.join('\n');
    }
    const keys = Object.keys(value || {});
    if (!keys.length) {
      return indent + '{}';
    }
    const maxKeyLen = Math.max(...keys.map(key => key.length));
    const lines = [indent + '{'];
    for (const key of keys) {
      const nested = (value as Record<string, unknown>)[key];
      const keyIndent = ' '.repeat(indentLevel + 2);
      const prefix = keyIndent + key + ':';
      if (isComplex(nested)) {
        lines.push(prefix);
        lines.push(formatValue(nested, indentLevel + 4));
      } else {
        const padding = ' '.repeat(Math.max(0, maxKeyLen - key.length) + 2);
        lines.push(prefix + padding + formatScalar(nested));
      }
    }
    lines.push(indent + '}');
    return lines.join('\n');
  }

  function formatKeyValueObject(
      obj: Record<string, any>, indentLevel = 2): string {
    const entries = Object.entries(obj || {});
    const indent = ' '.repeat(indentLevel);
    if (!entries.length) {
      return indent + '{}';
    }
    const maxKeyLen = Math.max(...entries.map(([key]) => key.length));
    return entries
        .map(([key, value]) => {
          const prefix = indent + key + ':';
          if (isComplex(value)) {
            return prefix + '\n' + formatValue(value, indentLevel + 2);
          }
          const padding = ' '.repeat(Math.max(0, maxKeyLen - key.length) + 2);
          return prefix + padding + formatScalar(value);
        })
        .join('\n');
  }

  function formatSection(title: string, obj: Record<string, any>): string {
    return title + '\n' + formatKeyValueObject(obj);
  }

  function formatDuration(value: unknown): ApiLogRawValue {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return raw(`${value} ms`);
    }
    return raw('');
  }

  function formatBodyValue(body: unknown): unknown {
    if (body === null || body === undefined || body === '') {
      return '';
    }
    if (typeof body === 'string') {
      const trimmed = body.trim();
      if (!trimmed) {
        return '';
      }
      try {
        return JSON.parse(trimmed);
      } catch (err) {
        return trimmed;
      }
    }
    return body;
  }

  return {
    raw,
    isRaw,
    isPlainObject,
    isComplex,
    escapeString,
    formatScalar,
    formatValue,
    formatKeyValueObject,
    formatSection,
    formatDuration,
    formatBodyValue,
  };
}

function indentMultiline(value: string, indent: string): string {
  return value.split('\n').map(line => indent + line).join('\n');
}

function escapeForJsString(value: string): string {
  return value.replace(/\\/g, '\\\\')
      .replace(/'/g, '\\\'')
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n');
}
