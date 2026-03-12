import {APIData} from './APIData';
import {yamlToAPI} from './apiParsePack';
import {LogLevel} from './CommonData';
import * as JSer from './JSer';
import {isPlainObject, PreparedRun, RunFileResult, runGeneratedJs, sanitizeIdentifier} from './runCommon';
import {FileLoader, mergeInputs, RunFileOptions} from './runConfig';
import {replaceAllRefs} from './variableReplacer';

export interface ResolveExampleResult {
  exampleInputs: Record<string, any>;
  resolvedExampleName?: string;
  resolvedExampleIndex?: number;
}

export function resolveApiExample(
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

export function prepareApiRun(
    rawText: string, manualInputs: Record<string, any>,
    options: {exampleIndex?: number; exampleName?: string},
    log: (level: LogLevel, message: string) => void): Partial<PreparedRun> {
  const apiDoc = yamlToAPI(rawText);
  const defaultInputs =
      isPlainObject(apiDoc.inputs) ? apiDoc.inputs as Record<string, any>: {};
  const manualInputsForMerge = {...manualInputs};
  const requestedExampleIndex =
      typeof options.exampleIndex === 'number' && options.exampleIndex >= 0 ?
      options.exampleIndex :
      undefined;
  const requestedExampleName =
      typeof options.exampleName === 'string' && options.exampleName.trim() ?
      options.exampleName.trim() :
      undefined;
  const {exampleInputs, resolvedExampleName, resolvedExampleIndex} =
      resolveApiExample(
          apiDoc, requestedExampleIndex, requestedExampleName, log);
  const inputsUsed = mergeInputs({
    defaultInputs,
    exampleInputs,
    manualInputs: manualInputsForMerge,
  });
  return {
    title: apiDoc.title,
    inputsUsed,
    apiDoc,
    exampleName: resolvedExampleName,
    exampleIndex: resolvedExampleIndex,
  };
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

export async function generateApiJs(options: GenerateApiJsOptions):
    Promise<string> {
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
  if (opts.exampleName) {
    exampleLabelParts.push(`${opts.exampleName}`);
  }
  if (typeof opts.exampleIndex === 'number' && opts.exampleIndex >= 0) {
    exampleLabelParts.push(`(#${opts.exampleIndex + 1})`);
  }
  const exampleLabel =
      exampleLabelParts.length ? `example: ${exampleLabelParts.join('')}` : '';
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
      `  const __mmt_originalSend = send_;\n` +
      `  send_ = async function(req) {\n` +
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
      `    console.debug(__mmt_formatSection('Request:', __reqLog));\n` +
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
      `      console.debug(__mmt_formatSection('Response:', __resLog));\n` +
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
      `      console.error(__mmt_formatSection('Response:', __errorLog));\n` +
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
      `      console.debug(__mmt_formatSection('Environment:', __mmt_envVars));\n` +
      `    }\n` +
      `    console.log(__mmt_formatSection('Inputs:', __mmt_inputs));\n` +
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
      `    console.log(__mmt_formatSection('Outputs:', __outputLog));\n` +
      `    return result;\n` +
      `  } finally {\n` +
      `    send_ = __mmt_originalSend;\n` +
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
    formatBodyValue
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

export async function executeApi(
    prepared: PreparedRun, options: RunFileOptions,
    preLogs: {level: LogLevel; message: string}[]): Promise<RunFileResult> {
  const {
    docType,
    baseName,
    title,
    envVarsUsed: envVars,
    inputsUsed,
    apiDoc,
    exampleName,
    exampleIndex,
  } = prepared;
  const {fileLoader, jsRunner} = options;

  if (!apiDoc) {
    throw new Error('API document not found in prepared run');
  }

  const exampleLabelParts: string[] = [];
  if (typeof exampleIndex === 'number') {
    exampleLabelParts.push(`#${exampleIndex + 1}`);
  }
  if (exampleName) {
    exampleLabelParts.push(exampleName);
  }
  const exampleLabel =
      exampleLabelParts.length > 0 ? exampleLabelParts.join(' ') : undefined;
  const fileDisplayName = title || baseName;
  const displayName =
      exampleLabel ? `${fileDisplayName} (${exampleLabel})` : fileDisplayName;
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
  const result = await runGeneratedJs(
      'run-api', js, displayName, options.logger, jsRunner, undefined,
      (options as any).id, fileLoader);
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