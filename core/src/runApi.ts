import {APIData} from './APIData';
import {yamlToAPI, yamlToAPIStrict} from './apiParsePack';
import {LogLevel} from './CommonData';
import * as JSer from './JSer';
import {isPlainObject, PreparedRun, RunFileResult, runGeneratedJs, sanitizeIdentifier} from './runCommon';
import {FileLoader, mergeInputs, RunFileOptions} from './runConfig';
import {replaceAllRefs, resolveInputsMap} from './variableReplacer';

export interface ResolveExampleResult {
  exampleInputs: Record<string, any>;
  exampleOutputs?: Record<string, any>;
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
    const outputs = isPlainObject(ex?.outputs) ?
        {...ex.outputs as Record<string, any>} :
        undefined;
    return {
      exampleInputs: inputs,
      exampleOutputs: outputs,
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
  const apiDoc = yamlToAPIStrict(rawText);
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
  const {exampleInputs, exampleOutputs, resolvedExampleName, resolvedExampleIndex} =
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
    exampleOutputs,
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
  exampleOutputs?: Record<string, any>;
  checkTitle?: string;
}

export async function generateApiJs(options: GenerateApiJsOptions):
    Promise<string> {
  const {
    api,
    name,
    envVars,
    inputs,
    fileLoader,
    exampleName,
    exampleIndex,
    exampleOutputs,
    checkTitle,
  } = options;
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
  // Define the API function inside the runner IIFE so it closes over
  // `envVariables` (e: tokens / input defaults resolve correctly).
  return buildApiRunnerWrapper({
    name,
    envVars,
    inputs,
    exampleName,
    exampleIndex,
    exampleOutputs,
    checkTitle,
    apiFunctionSource: funcSource,
  });
}

interface ApiRunnerWrapperOptions {
  name: string;
  envVars: Record<string, any>;
  inputs: Record<string, any>;
  exampleName?: string;
  exampleIndex?: number;
  exampleOutputs?: Record<string, any>;
  checkTitle?: string;
  apiFunctionSource?: string;
}

function buildApiRunnerWrapper(opts: ApiRunnerWrapperOptions): string {
  const resolvedInputs = resolveInputsMap(opts.inputs, opts.envVars ?? {});
  opts = replaceAllRefs(
      {...opts, inputs: resolvedInputs}, {}, resolvedInputs, opts.envVars ?? {});
  const envJson = JSON.stringify(opts.envVars ?? {}, null, 2);
  const inputsJson = JSON.stringify(opts.inputs ?? {}, null, 2);
  const exampleOutputs = isPlainObject(opts.exampleOutputs) ? opts.exampleOutputs : {};
  const exampleOutputsJson = JSON.stringify(exampleOutputs, null, 2);
  const hasExampleOutputs = Object.keys(exampleOutputs).length > 0;
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
      `    formatBodyValue: __mmt_formatBodyValue,\n` +
      `    valuesMatch: __mmt_valuesMatch,\n` +
      `    formatExpects: __mmt_formatExpects\n` +
      `  } = (\n${helperFactorySource}\n  )();`;
  const exampleLiteral =
      exampleLabel ? `'${escapeForJsString(exampleLabel)}'` : 'null';
  const checkTitle = typeof opts.checkTitle === 'string' && opts.checkTitle.trim() ?
      opts.checkTitle.trim() :
      '';
  const checkTitleLiteral =
      checkTitle ? `'${escapeForJsString(checkTitle)}'` : 'null';
  const expectsLogBlock = hasExampleOutputs ?
      `    const __mmt_exampleOutputs = ${exampleOutputsJson};\n` +
          `    const __mmt_checkTitle = ${checkTitleLiteral};\n` +
          `    const __mmt_expects = __mmt_formatExpects(__outputLog, __mmt_exampleOutputs, __mmt_checkTitle);\n` +
          `    for (const __line of __mmt_expects.successLines) {\n` +
          `      console.log(__line);\n` +
          `    }\n` +
          `    for (const __line of __mmt_expects.failLines) {\n` +
          `      console.error(__line);\n` +
          `    }\n` :
      '';
  return `return (async () => {\n` +
      `  const envVar = ${envJson};\n` +
      `  const envVariables = envVar;\n` +
      `  const __mmt_envVars = envVar;\n` +
      `  const __mmt_inputs = ${inputsJson};\n` +
      `  const __mmt_exampleLabel = ${exampleLiteral};\n` + helperDestructure +
      '\n' +
      (opts.apiFunctionSource ?
           `${indentMultiline(opts.apiFunctionSource, '  ')}\n\n` :
           '') +
      `  const __mmt_originalSend = send_;\n` +
      `  send_ = async function(req) {\n` +
      `    const __req = req || {};\n` +
      `    const __maskedHeaders = {};\n` +
      `    for (const [k, v] of Object.entries(__req.headers || {})) {\n` +
      `      const lk = k.toLowerCase();\n` +
      `      if (lk === 'authorization' && typeof v === 'string') {\n` +
      `        const sp = v.indexOf(' ');\n` +
      `        if (sp > 0) {\n` +
      `          const scheme = v.slice(0, sp);\n` +
      `          const cred = v.slice(sp + 1);\n` +
      `          __maskedHeaders[k] = scheme + ' ****' + (cred.length >= 4 ? cred.slice(-4) : '');\n` +
      `        } else {\n` +
      `          __maskedHeaders[k] = '****';\n` +
      `        }\n` +
      `      } else {\n` +
      `        __maskedHeaders[k] = v;\n` +
      `      }\n` +
      `    }\n` +
      `    const __reqLog = {\n` +
      `      url: __mmt_raw(__req.url || ''),\n` +
      `      method: __mmt_raw((__req.method || '').toUpperCase()),\n` +
      `      ...(typeof __req.timeout === 'number' ? { timeout: __mmt_raw(__req.timeout) } : {}),\n` +
      `      protocol: __mmt_raw(__req.protocol || ''),\n` +
      `      headers: __maskedHeaders,\n` +
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
      `      const __warning = __res && typeof __res.warning === 'string' ? __res.warning : '';\n` +
      `      const __resLog = {\n` +
      `        status: __mmt_raw(__status),\n` +
      `        statusText: __statusText,\n` +
      `        duration: __mmt_formatDuration(__duration),\n` +
      `        headers: __headers,\n` +
      `        body: __mmt_formatBodyValue(__body)\n` +
      `      };\n` +
      `      console.debug(__mmt_formatSection('Response:', __resLog));\n` +
      `      if (__warning) {\n` +
      `        console.warn(__warning);\n` +
      `      }\n` +
      `      // Return network failures to the API function so outputs (and the\n` +
      `      // tester Response panel) still receive the response; the wrapper\n` +
      `      // marks the run failed after outputs are built.\n` +
      `      return __res;\n` +
      `    } catch (err) {\n` +
      `      if (err && err.response) {\n` +
      `        const __response = err.response;\n` +
      `        const __warning = err.message ? String(err.message) : 'Server returned an error response';\n` +
      `        const __res = {\n` +
      `          body: typeof __response.data !== 'undefined' ? __response.data : __response.body,\n` +
      `          headers: __response.headers || {},\n` +
      `          status: typeof __response.status === 'number' ? __response.status : -1,\n` +
      `          statusText: __response.statusText || __warning,\n` +
      `          duration: typeof __response.duration === 'number' ? __response.duration : -1,\n` +
      `          warning: __warning\n` +
      `        };\n` +
      `        const __resLog = {\n` +
      `          status: __mmt_raw(__res.status),\n` +
      `          statusText: __res.statusText,\n` +
      `          duration: __mmt_formatDuration(__res.duration),\n` +
      `          headers: __res.headers,\n` +
      `          body: __mmt_formatBodyValue(__res.body)\n` +
      `        };\n` +
      `        console.debug(__mmt_formatSection('Response:', __resLog));\n` +
      `        console.warn(__warning);\n` +
      `        return __res;\n` +
      `      }\n` +
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
      `      delete copy['_'];\n` +
      `      const __reportOutputKeys = Array.isArray(result && result._ && result._.reportOutputKeys) ? result._.reportOutputKeys : null;\n` +
      `      if (__reportOutputKeys) {\n` +
      `        const filtered = {};\n` +
      `        for (const key of __reportOutputKeys) {\n` +
      `          if (typeof key === 'string' && Object.prototype.hasOwnProperty.call(copy, key)) {\n` +
      `            filtered[key] = copy[key];\n` +
      `          }\n` +
      `        }\n` +
      `        return filtered;\n` +
      `      }\n` +
      `      if (typeof copy.response_time === 'number' && Number.isFinite(copy.response_time)) {\n` +
      `        copy.response_time = __mmt_raw(copy.response_time + ' ms');\n` +
      `      }\n` +
      `      return copy;\n` +
      `    })();\n` +
      `    console.log(__mmt_formatSection('Outputs:', __outputLog));\n` +
      expectsLogBlock +
      `    if (result && result._ && typeof result._.status === 'number' && result._.status < 0) {\n` +
      `      let __failMsg = 'Network error';\n` +
      `      try {\n` +
      `        const __details = typeof result._.details === 'string' ? JSON.parse(result._.details) : null;\n` +
      `        const __st = __details && __details.response && __details.response.statusText;\n` +
      `        if (typeof __st === 'string' && __st) { __failMsg = __st; }\n` +
      `      } catch (_e) {}\n` +
      `      const err = new Error(__failMsg);\n` +
      `      err.status = result._.status;\n` +
      `      err.mmtApiOutputs = result;\n` +
      `      throw err;\n` +
      `    }\n` +
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
  valuesMatch: (actual: unknown, expected: unknown) => boolean;
  formatExpects:
      (actualOutputs: Record<string, any>, expectedOutputs: Record<string, any>,
       title?: string|null) => {successLines: string[]; failLines: string[]};
}

export function createApiLogHelpers(): ApiLogHelpers {
  // This factory is serialized with toString() into the generated run code, so
  // it must stay self-contained: no imports are in scope there. `runner.test.ts`
  // guards this copy of the marker against drifting from OMIT_SENTINEL.
  const omitSentinel = '__MMT_OMIT__';
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
    // Unquoted like the YAML keyword, so a missing value reads as `omit` while
    // a literal string value still shows as `"omit"`.
    if (value === omitSentinel) {
      return 'omit';
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
      // Always render as integer milliseconds so the Response log matches
      // the API tester toolbar (e.g. "1234ms", not "1s 234ms").
      const ms = value < 0 ? 0 : Math.round(value);
      return raw(`${ms}ms`);
    }
    return raw('');
  }
  function formatBodyValue(body: unknown): unknown {
    if (body === null || body === undefined || body === '') {
      return '';
    }
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(body)) {
      return `<binary ${body.length} bytes>`;
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
  function unwrapForMatch(value: unknown): unknown {
    return isRaw(value) ? value.__mmt_raw : value;
  }
  function valuesMatch(actual: unknown, expected: unknown): boolean {
    const left = unwrapForMatch(actual);
    const right = unwrapForMatch(expected);
    if (Object.is(left, right)) {
      return true;
    }
    if (left === undefined || right === undefined) {
      return false;
    }
    if (left === null || right === null) {
      return left === right;
    }
    if (typeof left === 'object' || typeof right === 'object') {
      try {
        return JSON.stringify(left) === JSON.stringify(right);
      } catch {
        return false;
      }
    }
    return String(left) === String(right);
  }
  function displayExpectValue(value: unknown): string {
    const restoreOmit = (v: unknown): unknown => {
      if (v === omitSentinel) {
        return 'omit';
      }
      if (Array.isArray(v)) {
        return v.map(restoreOmit);
      }
      if (v && typeof v === 'object' && !isRaw(v)) {
        const out: Record<string, unknown> = {};
        for (const [k, nested] of Object.entries(v as Record<string, unknown>)) {
          out[k] = restoreOmit(nested);
        }
        return out;
      }
      return v;
    };
    const normalized = restoreOmit(unwrapForMatch(value));
    if (normalized === null || normalized === undefined) {
      return String(normalized);
    }
    if (typeof normalized === 'object') {
      try {
        return JSON.stringify(normalized);
      } catch {
        return String(normalized);
      }
    }
    return String(normalized);
  }
  function formatExpects(
      actualOutputs: Record<string, any>,
      expectedOutputs: Record<string, any>,
      title?: string|null):
      {successLines: string[]; failLines: string[]} {
    const expected = expectedOutputs || {};
    const actual = actualOutputs || {};
    const titleText =
        typeof title === 'string' && title.trim() ? title.trim() : '';
    const titlePart = titleText ? `"${titleText}" - ` : '';
    const successLines: string[] = [];
    const failLines: string[] = [];
    for (const key of Object.keys(expected)) {
      const expectedDisplay = displayExpectValue(expected[key]);
      const subject = key + ' == ' + expectedDisplay;
      if (valuesMatch(actual[key], expected[key])) {
        successLines.push('\u2713 Check ' + titlePart + '"' + subject + '"');
      } else {
        failLines.push(
            '\u00D7 Check ' + titlePart + '"' + subject + '" (' +
            displayExpectValue(actual[key]) + ' == ' + expectedDisplay + ')');
      }
    }
    return {successLines, failLines};
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
    valuesMatch,
    formatExpects,
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
    exampleOutputs,
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
  const resolvedInputs = resolveInputsMap(inputsUsed, envVars);
  const js = await generateApiJs({
    api: apiDoc,
    name: identifier,
    envVars,
    inputs: resolvedInputs,
    fileLoader,
    exampleName,
    exampleIndex,
    exampleOutputs,
    checkTitle: fileDisplayName,
  });
  const result = await runGeneratedJs(
      'run-api', js, displayName, options.logger, jsRunner, undefined,
      (options as any).id, fileLoader, undefined, undefined, undefined, undefined,
      prepared.filePath ? prepared.filePath.split(/[/\\]/).slice(0, -1).join('/') : undefined,
      undefined, undefined, undefined, 'API', options.binaryFileLoader);
  if (preLogs.length) {
    result.logs = [...preLogs.map(l => l.message), ...(result.logs ?? [])];
  }
  return {
    js,
    result,
    identifier,
    displayName,
    docType,
    inputsUsed: resolvedInputs,
    envVarsUsed: envVars,
    exampleName,
    exampleIndex,
  };
}