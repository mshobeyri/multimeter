import * as JSer from './JSer';
import * as testParsePack from './testParsePack';
import docHtml from './docHtml';
import docMarkdown from './docMarkdown';
import {APIData} from './APIData';
import {Type} from './CommonData';
import {yamlToAPI} from './apiParsePack';

export type LogLevel = 'info' | 'warn' | 'error';

export interface RunResult {
  success: boolean;
  durationMs: number;
  errors: string[];
  logs?: string[];
}

export type FileLoader = (path: string) => Promise<string>;

export interface GenerateJsOptions {
  rawText: string;
  name: string;
  inputs: Record<string, any>;
  envVars: Record<string, any>;
  fileLoader: FileLoader; // Responsible for resolving relative imports
}

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
  const test = testParsePack.yamlToTest ? testParsePack.yamlToTest(rawText) : {} as any;
  let js = await JSer.rootTestToJsfunc({test, name, inputs, envVars});
  // Normalize env tokens in JS if variableReplacer is present on JSer
  const anyJSer: any = JSer as any;
  if (anyJSer.variableReplacer && typeof anyJSer.variableReplacer === 'function') {
    js = anyJSer.variableReplacer(js);
  }
  return js;
}

export async function runGeneratedJs(
  js: string,
  title: string,
  logger: (level: LogLevel, msg: string) => void,
  runCode: (code: string, title: string, lg: (lvl: LogLevel, msg: string) => void) => Promise<void>
): Promise<RunResult> {
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
    return {success: errors.length === 0, durationMs: Date.now() - start, errors, logs};
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
  format?: 'html' | 'md';
}

export function buildDocFromApis(apis: any[], opts: BuildDocOptions): string {
  const {format = 'html', ...rest} = opts || {};
  if (format === 'md') {
    return (docMarkdown as any).buildDocMarkdown(apis, rest);
  }
  return docHtml.buildDocHtml(apis, rest);
}

export interface RunFileOptions {
  rawText: string;
  filePath: string;
  inputs?: Record<string, any>;
  envVars?: Record<string, any>;
  fileLoader: FileLoader;
  runCode: (code: string, title: string, logger: (level: LogLevel, msg: string) => void) => Promise<void>;
  logger?: (level: LogLevel, msg: string) => void;
  exampleName?: string;
  exampleIndex?: number;
}

export interface RunFileResult {
  js: string;
  result: RunResult;
  identifier: string;
  displayName: string;
  docType: Type | null;
  inputsUsed: Record<string, any>;
  envVarsUsed: Record<string, any>;
  exampleName?: string;
  exampleIndex?: number;
}

export interface RunFileWithDefaultsOptions {
  filePath: string;
  readText: (path: string) => Promise<string>;
  fileLoader: FileLoader;
  runCode: (code: string, title: string, logger: (level: LogLevel, msg: string) => void) => Promise<void>;
  logger?: (level: LogLevel, msg: string) => void;
  inputs?: Record<string, any>;
  envVars?: Record<string, any>;
  exampleName?: string;
  exampleIndex?: number;
}

export async function runFile(options: RunFileOptions): Promise<RunFileResult> {
  const {
    rawText,
    filePath,
    fileLoader,
    runCode,
    logger,
  } = options;
  const inputOverrides = options.inputs ?? {};
  const envVars = options.envVars ?? {};
  const docType = detectDocType(filePath, rawText);
  const sinkLogger: (level: LogLevel, msg: string) => void = logger ?? (() => {});
  const preLogs: Array<{level: LogLevel; message: string}> = [];
  const note = (level: LogLevel, message: string) => {
    preLogs.push({level, message});
    sinkLogger(level, message);
  };
  const baseName = basename(filePath);
  const requestedExampleIndex =
      typeof options.exampleIndex === 'number' ? options.exampleIndex : undefined;

  if (docType === 'api') {
    const api = yamlToAPI(rawText);
    const {exampleInputs, resolvedExampleName, resolvedExampleIndex} =
        resolveApiExample(api, options.exampleName, requestedExampleIndex, note);
    const exampleLabelParts: string[] = [];
    if (typeof resolvedExampleIndex === 'number') {
      exampleLabelParts.push(`#${resolvedExampleIndex + 1}`);
    }
    if (resolvedExampleName) {
      exampleLabelParts.push(resolvedExampleName);
    }
    const exampleLabel = exampleLabelParts.length > 0 ? exampleLabelParts.join(' ') : undefined;
    const displayName = exampleLabel ? `${baseName} (${exampleLabel})` : baseName;
    const identifier = sanitizeIdentifier(exampleLabel ? `${baseName}_${exampleLabel}` : baseName);
    const mergedInputs = {
      ...(isPlainObject(api.inputs) ? api.inputs as Record<string, any> : {}),
      ...exampleInputs,
      ...inputOverrides,
    };
    const js = await generateApiJs({
      api,
      name: identifier,
      envVars,
      inputs: mergedInputs,
      fileLoader,
      exampleName: resolvedExampleName,
      exampleIndex: resolvedExampleIndex,
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
      inputsUsed: mergedInputs,
      envVarsUsed: envVars,
      exampleName: resolvedExampleName,
      exampleIndex: resolvedExampleIndex,
    };
  }

  if (docType === 'test') {
    const identifier = sanitizeIdentifier(baseName);
    const test = testParsePack.yamlToTest ? testParsePack.yamlToTest(rawText) : {} as any;
    const defaultInputs = isPlainObject(test?.inputs) ? test.inputs as Record<string, any> : {};
    const mergedInputs = {...defaultInputs, ...inputOverrides};
    const js = await generateTestJs({
      rawText,
      name: identifier,
      inputs: inputOverrides,
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
      inputsUsed: mergedInputs,
      envVarsUsed: envVars,
    };
  }

  throw new Error('Run is currently supported for test or api documents only.');
}

export async function runFileWithDefaults(options: RunFileWithDefaultsOptions): Promise<RunFileResult> {
  const rawText = await options.readText(options.filePath);
  return runFile({
    rawText,
    filePath: options.filePath,
    inputs: options.inputs,
    envVars: options.envVars,
    fileLoader: options.fileLoader,
    runCode: options.runCode,
    logger: options.logger,
    exampleName: options.exampleName,
    exampleIndex: options.exampleIndex,
  });
}

function basename(filePath: string): string {
  if (!filePath) return '';
  const parts = filePath.split(/[/\\]/);
  return parts[parts.length - 1] || filePath;
}

function sanitizeIdentifier(value: string): string {
  if (!value) return '_mmt';
  const replaced = value.replace(/[^a-zA-Z0-9_]/g, '_');
  return /^[A-Za-z_$]/.test(replaced) ? replaced : `_${replaced}`;
}

function detectDocType(filePath: string, rawText: string): Type | null {
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
    api: APIData, requestedName: string | undefined,
    requestedIndex: number | undefined,
    log: (level: LogLevel, message: string) => void): ResolveExampleResult {
  const examples = Array.isArray(api.examples) ? api.examples : [];
  if (examples.length === 0) {
    return {exampleInputs: {}};
  }
  const toResult = (ex: any, idx?: number): ResolveExampleResult => {
    const name = typeof ex?.name === 'string' && ex.name.trim() ? ex.name : undefined;
    const inputs = isPlainObject(ex?.inputs) ? {...ex.inputs as Record<string, any>} : {};
    return {
      exampleInputs: inputs,
      resolvedExampleName: name,
      resolvedExampleIndex: typeof idx === 'number' ? idx : undefined,
    };
  };
  if (typeof requestedIndex === 'number') {
    if (requestedIndex >= 0 && requestedIndex < examples.length) {
      const ex = examples[requestedIndex];
      return toResult(ex, requestedIndex);
    }
    log('warn', `Example #${requestedIndex + 1} not found; using API defaults.`);
  }
  if (requestedName) {
    const matchIndex = examples.findIndex(ex =>
        typeof ex?.name === 'string' && ex.name.toLowerCase() === requestedName.toLowerCase());
    if (matchIndex >= 0) {
      return toResult(examples[matchIndex], matchIndex);
    }
    log('warn', `Example "${requestedName}" not found; using API defaults.`);
  }
  const candidates = examples
                         .map((ex, idx) => ({ex, idx}))
                         .filter(({ex}) => isPlainObject(ex?.inputs) &&
                              Object.keys(ex.inputs || {}).length > 0);
  if (candidates.length === 1) {
    const {ex, idx} = candidates[0];
    const label = typeof ex?.name === 'string' && ex.name.trim() ? ex.name : `#${idx + 1}`;
    log('info', `Using example "${label}" (only example with inputs).`);
    return toResult(ex, idx);
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
  const {api, name, envVars, inputs, fileLoader, exampleName, exampleIndex} = options;
  JSer.setFileLoader(async (p: string) => {
    try {
      const t = await fileLoader(p);
      return typeof t === 'string' ? t : '';
    } catch {
      return '';
    }
  });
  const apiClone: APIData = {...api, inputs: isPlainObject(api.inputs) ? {...api.inputs as Record<string, any>} : api.inputs};
  const funcSource = await JSer.importApiToJSfunc({
    api: apiClone,
    name,
    inputs: {},
    envVars,
  });
  return `${funcSource}\n\n${buildApiRunnerWrapper({name, envVars, inputs, exampleName, exampleIndex})}`;
}

interface ApiRunnerWrapperOptions {
  name: string;
  envVars: Record<string, any>;
  inputs: Record<string, any>;
  exampleName?: string;
  exampleIndex?: number;
}

function buildApiRunnerWrapper(opts: ApiRunnerWrapperOptions): string {
  const envJson = JSON.stringify(opts.envVars ?? {}, null, 2);
  const inputsJson = JSON.stringify(opts.inputs ?? {}, null, 2);
  const exampleLabelParts: string[] = [];
  if (typeof opts.exampleIndex === 'number' && opts.exampleIndex >= 0) {
    exampleLabelParts.push(`#${opts.exampleIndex + 1}`);
  }
  if (opts.exampleName) {
    exampleLabelParts.push(opts.exampleName);
  }
  const exampleLabel = exampleLabelParts.length ? `Example ${exampleLabelParts.join(' ')}` : '';
  const helperFactorySource = indentMultiline(createApiLogHelpers.toString(), '    ');
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
  const exampleLiteral = exampleLabel ? `'${escapeForJsString(exampleLabel)}'` : 'null';
  return `return (async () => {\n` +
      `  const envVar = ${envJson};\n` +
      `  const envVariables = envVar;\n` +
      `  const __mmt_envVars = envVar;\n` +
      `  const __mmt_inputs = ${inputsJson};\n` +
      `  const __mmt_exampleLabel = ${exampleLiteral};\n` +
      helperDestructure + '\n' +
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
      `    console.log('');\n` +
      `    console.log(__mmt_formatSection('REQUEST', __reqLog));\n` +
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
      `      console.log('');\n` +
      `      console.log(__mmt_formatSection('RESPONSE', __resLog));\n` +
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
      `      console.log('');\n` +
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
      `      console.log('');\n` +
      `    }\n` +
      `    if (__mmt_hasEnv) {\n` +
      `      console.log(__mmt_formatSection('ENVIRONMENT', __mmt_envVars));\n` +
      `      console.log('');\n` +
      `    }\n` +
      `    console.log(__mmt_formatSection('INPUTS', __mmt_inputs));\n` +
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
      `    console.log('');\n` +
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
  formatKeyValueObject: (obj: Record<string, any>, indentLevel?: number) => string;
  formatSection: (title: string, obj: Record<string, any>) => string;
  formatDuration: (value: unknown) => ApiLogRawValue;
  formatBodyValue: (body: unknown) => unknown;
}

export function createApiLogHelpers(): ApiLogHelpers {
  function raw(value: unknown): ApiLogRawValue {
    return {__mmt_raw: String(value)};
  }

  function isRaw(value: unknown): value is ApiLogRawValue {
    return !!value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, '__mmt_raw');
  }

  function isPlainObject(value: unknown): value is Record<string, any> {
    return !!value && typeof value === 'object' && !Array.isArray(value) && !isRaw(value);
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

  function formatKeyValueObject(obj: Record<string, any>, indentLevel = 2): string {
    const entries = Object.entries(obj || {});
    const indent = ' '.repeat(indentLevel);
    if (!entries.length) {
      return indent + '{}';
    }
    const maxKeyLen = Math.max(...entries.map(([key]) => key.length));
    return entries.map(([key, value]) => {
      const prefix = indent + key + ':';
      if (isComplex(value)) {
        return prefix + '\n' + formatValue(value, indentLevel + 2);
      }
      const padding = ' '.repeat(Math.max(0, maxKeyLen - key.length) + 2);
      return prefix + padding + formatScalar(value);
    }).join('\n');
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
  return value
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n');
}
