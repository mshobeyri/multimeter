import {Method} from './CommonData';
import {TestData, TestFlowHttp, TestFlowSetEnv, TestFlowStep} from './TestData';
import {validateTestData} from './testParsePack';

const HTTP_METHODS = new Set([
  'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'TRACE',
]);

export interface HttpParseWarning {
  line: number;
  message: string;
}

export interface HttpVariable {
  name: string;
  value: string;
  line: number;
}

export interface HttpRequestBlock {
  separator?: string;
  name?: string;
  title?: string;
  method: Method;
  url: string;
  httpVersion?: string;
  headers: Record<string, string>;
  body?: string;
  preRequestScript?: string;
  responseHandlerScript?: string;
  startLine: number;
  raw: string;
  warnings: HttpParseWarning[];
}

export interface HttpDocument {
  variables: Record<string, string>;
  variableItems: HttpVariable[];
  requests: HttpRequestBlock[];
  warnings: HttpParseWarning[];
}

interface LineInfo {
  text: string;
  line: number;
}

export function isHttpFilePath(filePath: string): boolean {
  const lower = String(filePath || '').toLowerCase();
  return lower.endsWith('.http') || lower.endsWith('.https');
}

const stripInlineComment = (value: string): string => {
  const hash = value.search(/\s#/);
  const slash = value.search(/\s\/\//);
  const positions = [hash, slash].filter(pos => pos >= 0);
  if (positions.length === 0) {
    return value.trim();
  }
  return value.slice(0, Math.min(...positions)).trim();
};

const isCommentLine = (line: string): boolean => /^\s*(#|\/\/|;)\s*/.test(line);

const parseVariableLine = (line: string): {name: string; value: string}|undefined => {
  const match = /^\s*@([A-Za-z_][A-Za-z0-9_.-]*)\s*=\s*(.*)$/.exec(line);
  if (!match || !match[1]) {
    return undefined;
  }
  return {name: match[1], value: stripInlineComment(match[2] || '')};
};

const parseMetadata = (line: string): {key: string; value: string}|undefined => {
  const match = /^\s*(?:#|\/\/)\s*@([A-Za-z][A-Za-z0-9_-]*)\b\s*(.*)$/.exec(line);
  if (!match || !match[1]) {
    return undefined;
  }
  return {key: match[1].toLowerCase(), value: (match[2] || '').trim()};
};

const parseRequestLine = (line: string): {method: Method; url: string; httpVersion?: string}|undefined => {
  const trimmed = line.trim();
  if (!trimmed || isCommentLine(trimmed) || parseVariableLine(trimmed)) {
    return undefined;
  }
  const parts = trimmed.split(/\s+/);
  let method = 'GET';
  let url = '';
  let httpVersion: string | undefined;
  if (parts.length >= 2 && HTTP_METHODS.has(parts[0].toUpperCase())) {
    method = parts[0].toUpperCase();
    url = parts.slice(1).join(' ');
  } else {
    url = trimmed;
  }
  const versionMatch = /\s+(HTTP\/\d(?:\.\d)?|HTTP\/2)\s*$/i.exec(url);
  if (versionMatch && versionMatch[1]) {
    httpVersion = versionMatch[1].toUpperCase();
    url = url.slice(0, versionMatch.index).trim();
  }
  if (!url) {
    return undefined;
  }
  return {method: method.toLowerCase() as Method, url, httpVersion};
};

const splitBlocks = (content: string): Array<{separator?: string; lines: LineInfo[]}> => {
  const rawLines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const blocks: Array<{separator?: string; lines: LineInfo[]}> = [];
  let current: {separator?: string; lines: LineInfo[]} = {lines: []};

  rawLines.forEach((text, index) => {
    if (/^\s*###(?:\s|$)/.test(text)) {
      if (current.lines.length > 0 || current.separator !== undefined) {
        blocks.push(current);
      }
      current = {separator: text.trim(), lines: []};
      return;
    }
    current.lines.push({text, line: index + 1});
  });

  if (current.lines.length > 0 || current.separator !== undefined) {
    blocks.push(current);
  }
  return blocks;
};

const convertPathAccessor = (path: string): string => {
  if (!path) {
    return '';
  }
  const cleaned = path.replace(/^\$\.?/, '').replace(/^\./, '');
  if (!cleaned) {
    return '';
  }
  return cleaned.split('.')
      .filter(Boolean)
      .map(part => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(part) ? `.${part}` : `[${JSON.stringify(part)}]`)
      .join('');
};

const convertRequestReference = (expr: string): string | undefined => {
  const match = /^([A-Za-z_][A-Za-z0-9_-]*)\.response\.(body|headers|cookies|status)(?:\.(.*))?$/.exec(expr);
  if (!match || !match[1] || !match[2]) {
    return undefined;
  }
  const requestName = match[1];
  const area = match[2];
  if (area === 'status') {
    return `\${${requestName}.status}`;
  }
  return `\${${requestName}.${area}${convertPathAccessor(match[3] || '')}}`;
};

const convertVariableReference = (expr: string, variables: Record<string, string>): string => {
  const trimmed = expr.trim();
  const requestReference = convertRequestReference(trimmed);
  if (requestReference) {
    return requestReference;
  }
  if (trimmed.startsWith('$')) {
    const system = trimmed.slice(1).trim();
    const [name] = system.split(/\s+/, 1);
    switch ((name || '').toLowerCase()) {
      case 'guid':
      case 'uuid':
        return 'r:uuid';
      case 'randomint':
        return 'r:int';
      case 'timestamp':
        return 'c:epoch';
      case 'datetime':
      case 'localdatetime':
        return 'c:date';
      case 'processenv':
      case 'dotenv': {
        const envName = system.split(/\s+/).slice(1).join('_').replace(/[^A-Za-z0-9_-]/g, '');
        return envName ? `<<e:${envName}>>` : `<<e:${system}>>`;
      }
      default:
        return `<<e:${system.replace(/[^A-Za-z0-9_-]/g, '_')}>>`;
    }
  }
  if (Object.prototype.hasOwnProperty.call(variables, trimmed)) {
    return variables[trimmed];
  }
  return `<<e:${trimmed}>>`;
};

const convertVariables = (value: string, variables: Record<string, string>): string =>
  String(value ?? '').replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_match, expr: string) =>
    convertVariableReference(expr, variables));

const inferFormat = (headers: Record<string, string>, body?: string): TestFlowHttp['format'] => {
  const contentTypeKey = Object.keys(headers).find(key => key.toLowerCase() === 'content-type');
  const contentType = contentTypeKey ? headers[contentTypeKey].toLowerCase() : '';
  if (contentType.includes('json')) {
    return 'json';
  }
  if (contentType.includes('xml')) {
    return 'xml';
  }
  const trimmed = String(body || '').trim();
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    return 'json';
  }
  if (trimmed.startsWith('<') && trimmed.endsWith('>')) {
    return 'xml';
  }
  return 'text';
};

const toJsonBody = (body: string | undefined): string | object | null | undefined => {
  if (body === undefined) {
    return undefined;
  }
  const trimmed = body.trim();
  if (!trimmed) {
    return undefined;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return body;
  }
};

const responsePathToExpectKey = (path: string): string | undefined => {
  const cleaned = path.trim();
  if (cleaned === 'status') {
    return 'status';
  }
  const match = /^(body|headers|cookies)(.*)$/.exec(cleaned);
  if (!match || !match[1]) {
    return undefined;
  }
  const root = match[1];
  const suffix = match[2] || '';
  const parts: string[] = [];
  const pathPattern = /\.([A-Za-z_$][A-Za-z0-9_$]*)|\[['"]([^'"]+)['"]\]|\[(\d+)\]/g;
  let pathMatch: RegExpExecArray | null;
  while ((pathMatch = pathPattern.exec(suffix)) !== null) {
    parts.push(pathMatch[1] || pathMatch[2] || pathMatch[3]);
  }
  return parts.length > 0 ? `${root}.${parts.join('.')}` : root;
};

const responsePathToResultExpression = (resultId: string, path: string): string | undefined => {
  const key = responsePathToExpectKey(path);
  if (!key) {
    return undefined;
  }
  return `\${${resultId}.${key}}`;
};

const normalizeAssertExpected = (rawValue: string): string => {
  const trimmed = rawValue.trim().replace(/;\s*$/, '');
  const globalGet = /^client\.(?:global|environment)\.get\(\s*(['"])([^'"]+)\1\s*\)$/.exec(trimmed);
  if (globalGet && globalGet[2]) {
    return `<<e:${globalGet[2]}>>`;
  }
  const quoted = /^(['"])([\s\S]*)\1$/.exec(trimmed);
  if (quoted) {
    return quoted[2];
  }
  return trimmed;
};

const addExpectValue = (expect: NonNullable<TestFlowHttp['expect']>, key: string, value: string) => {
  const existing = expect[key];
  if (existing === undefined) {
    expect[key] = value;
  } else if (Array.isArray(existing)) {
    existing.push(value);
  } else {
    expect[key] = [existing, value];
  }
};

const extractResponseScriptExpects = (script: string): TestFlowHttp['expect'] | undefined => {
  const expect: NonNullable<TestFlowHttp['expect']> = {};
  const assertPattern = /client\.assert\(\s*response\.([A-Za-z_$][A-Za-z0-9_$]*(?:(?:\.[A-Za-z_$][A-Za-z0-9_$]*)|(?:\[['"][^'"]+['"]\])|(?:\[\d+\]))*)\s*(===|!==|==|!=|>=|<=|>|<)\s*((?:client\.(?:global|environment)\.get\(\s*['"][^'"]+['"]\s*\))|(?:"[^"]*")|(?:'[^']*')|[^,;)]+(?:\s*\|\|\s*response\.[^,)]+)?)(?:\s*,[\s\S]*?)?\)/g;
  let match: RegExpExecArray | null;
  while ((match = assertPattern.exec(script)) !== null) {
    const key = responsePathToExpectKey(match[1]);
    if (!key) {
      continue;
    }
    if (/\|\||&&/.test(match[3])) {
      continue;
    }
    const operator = match[2] === '===' ? '==' : match[2] === '!==' ? '!=' : match[2];
    const expected = normalizeAssertExpected(match[3]);
    addExpectValue(expect, key, `${operator} ${expected}`);
  }
  return Object.keys(expect).length > 0 ? expect : undefined;
};

const normalizeSetEnvValue = (resultId: string, rawValue: string): any => {
  const trimmed = rawValue.trim().replace(/;\s*$/, '');
  const responseMatch = /^response\.([A-Za-z_$][A-Za-z0-9_$]*(?:(?:\.[A-Za-z_$][A-Za-z0-9_$]*)|(?:\[['"][^'"]+['"]\])|(?:\[\d+\]))*)$/.exec(trimmed);
  if (responseMatch && responseMatch[1]) {
    return responsePathToResultExpression(resultId, responseMatch[1]) || trimmed;
  }
  const quoted = /^(['"])([\s\S]*)\1$/.exec(trimmed);
  if (quoted) {
    return quoted[2];
  }
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }
  if (trimmed === 'true') {
    return true;
  }
  if (trimmed === 'false') {
    return false;
  }
  if (trimmed === 'null') {
    return null;
  }
  return trimmed;
};

const extractResponseScriptSetEnv = (script: string, resultId: string): Record<string, any> | undefined => {
  const setenv: Record<string, any> = {};
  const setPattern = /client\.(?:global|environment)\.set\(\s*(['"])([^'"]+)\1\s*,\s*([^)]+?)\s*\)/g;
  let match: RegExpExecArray | null;
  while ((match = setPattern.exec(script)) !== null) {
    if (!match[2] || !match[3]) {
      continue;
    }
    setenv[match[2]] = normalizeSetEnvValue(resultId, match[3]);
  }
  return Object.keys(setenv).length > 0 ? setenv : undefined;
};

const parseRequestBlock = (
    block: {separator?: string; lines: LineInfo[]},
    variables: Record<string, string>): HttpRequestBlock | undefined => {
  let requestLineIndex = -1;
  let parsedRequestLine: ReturnType<typeof parseRequestLine>;
  let name: string | undefined;
  let title: string | undefined = block.separator ? block.separator.replace(/^\s*###\s*/, '').trim() || undefined : undefined;
  const warnings: HttpParseWarning[] = [];

  for (let i = 0; i < block.lines.length; i++) {
    const line = block.lines[i];
    const metadata = parseMetadata(line.text);
    if (metadata?.key === 'name' && metadata.value) {
      name = metadata.value;
    }
    if ((metadata?.key === 'title' || metadata?.key === 'note') && metadata.value && !title) {
      title = metadata.value;
    }
    const candidate = parseRequestLine(line.text);
    if (candidate) {
      requestLineIndex = i;
      parsedRequestLine = candidate;
      break;
    }
  }

  if (requestLineIndex < 0 || !parsedRequestLine) {
    if (block.lines.some(line => line.text.trim())) {
      warnings.push({line: block.lines[0]?.line || 1, message: 'No HTTP request line found'});
    }
    return undefined;
  }

  const headers: Record<string, string> = {};
  const bodyLines: string[] = [];
  let i = requestLineIndex + 1;
  for (; i < block.lines.length; i++) {
    const line = block.lines[i];
    if (!line.text.trim()) {
      i++;
      break;
    }
    if (isCommentLine(line.text)) {
      continue;
    }
    const headerMatch = /^\s*([^:]+):\s*(.*)$/.exec(line.text);
    if (!headerMatch || !headerMatch[1]) {
      break;
    }
    headers[headerMatch[1].trim()] = convertVariables(headerMatch[2] || '', variables);
  }

  let scriptTarget: 'pre' | 'post' | undefined;
  let scriptLines: string[] = [];
  let preRequestScript: string | undefined;
  let responseHandlerScript: string | undefined;
  const flushScript = () => {
    if (!scriptTarget) {
      return;
    }
    const script = scriptLines.join('\n').replace(/%}\s*$/, '').trim();
    if (scriptTarget === 'pre') {
      preRequestScript = script;
    } else {
      responseHandlerScript = script;
    }
    scriptTarget = undefined;
    scriptLines = [];
  };

  for (; i < block.lines.length; i++) {
    const line = block.lines[i];
    const trimmed = line.text.trim();
    if (/^<\s*\{%/.test(trimmed)) {
      flushScript();
      scriptTarget = 'pre';
      scriptLines = [line.text.replace(/^\s*<\s*\{%\s?/, '')];
      if (/%}\s*$/.test(trimmed)) {
        flushScript();
      }
      continue;
    }
    if (/^>\s*\{%/.test(trimmed)) {
      flushScript();
      scriptTarget = 'post';
      scriptLines = [line.text.replace(/^\s*>\s*\{%\s?/, '')];
      if (/%}\s*$/.test(trimmed)) {
        flushScript();
      }
      continue;
    }
    if (scriptTarget) {
      scriptLines.push(line.text);
      if (/%}\s*$/.test(trimmed)) {
        flushScript();
      }
      continue;
    }
    if (responseHandlerScript && (!trimmed || isCommentLine(line.text))) {
      continue;
    }
    bodyLines.push(line.text);
  }
  flushScript();

  const rawBody = bodyLines.join('\n').trimEnd();
  const body = rawBody ? convertVariables(rawBody, variables) : undefined;
  if (body && /^<\s+\S+/.test(body.trim())) {
    warnings.push({line: block.lines[Math.max(requestLineIndex + 1, 0)]?.line || 1, message: 'File body includes are parsed but not executed natively yet'});
  }
  if (body && /multipart\/form-data/i.test(Object.entries(headers).find(([key]) => key.toLowerCase() === 'content-type')?.[1] || '')) {
    warnings.push({line: block.lines[Math.max(requestLineIndex + 1, 0)]?.line || 1, message: 'Multipart bodies are preserved as raw text in this version'});
  }
  if (preRequestScript) {
    warnings.push({line: block.lines[requestLineIndex]?.line || 1, message: 'Pre-request scripts are preserved but not executed natively yet'});
  }
  if (responseHandlerScript) {
    warnings.push({line: block.lines[requestLineIndex]?.line || 1, message: 'Response handler scripts are preserved but only common tests are mapped in this version'});
  }

  return {
    separator: block.separator,
    name,
    title,
    method: parsedRequestLine.method,
    url: convertVariables(parsedRequestLine.url, variables),
    httpVersion: parsedRequestLine.httpVersion,
    headers,
    body,
    preRequestScript,
    responseHandlerScript,
    startLine: block.lines[requestLineIndex].line,
    raw: block.lines.map(line => line.text).join('\n'),
    warnings,
  };
};

export function parseHttpDocument(content: string): HttpDocument {
  const variableItems: HttpVariable[] = [];
  const variables: Record<string, string> = {};
  const warnings: HttpParseWarning[] = [];
  const blocks = splitBlocks(content || '');

  for (const block of blocks) {
    for (const line of block.lines) {
      const parsed = parseVariableLine(line.text);
      if (!parsed) {
        continue;
      }
      variables[parsed.name] = convertVariables(parsed.value, variables);
      variableItems.push({name: parsed.name, value: variables[parsed.name], line: line.line});
    }
  }

  const requests = blocks
      .map(block => parseRequestBlock(block, variables))
      .filter((request): request is HttpRequestBlock => !!request);

  for (const request of requests) {
    warnings.push(...request.warnings);
  }
  if (requests.length === 0 && String(content || '').trim()) {
    warnings.push({line: 1, message: 'No HTTP requests found'});
  }

  return {variables, variableItems, requests, warnings};
}

const requestToSteps = (request: HttpRequestBlock, index: number): TestFlowStep[] => {
  const id = (request.name || `request_${index + 1}`).replace(/[^A-Za-z0-9_]/g, '_');
  const format = inferFormat(request.headers, request.body);
  const step: TestFlowHttp = {
    http: request.url,
    id,
    title: request.title || request.name,
    method: request.method,
    format,
    report: 'all',
  };
  if (Object.keys(request.headers).length > 0) {
    step.headers = request.headers;
  }
  const body = format === 'json' ? toJsonBody(request.body) : request.body;
  if (body !== undefined) {
    step.body = body;
  }
  if (request.responseHandlerScript) {
    step.expect = extractResponseScriptExpects(request.responseHandlerScript);
  }
  const steps: TestFlowStep[] = [step];
  const setenv = request.responseHandlerScript ? extractResponseScriptSetEnv(request.responseHandlerScript, id) : undefined;
  if (setenv) {
    steps.push({setenv} as TestFlowSetEnv);
  }
  return steps;
};

export function httpToTest(content: string, filePath = ''): TestData {
  const document = parseHttpDocument(content);
  const title = filePath ? filePath.split(/[/\\]/).pop() || 'HTTP test' : 'HTTP test';
  return {
    type: 'test',
    title,
    description: '',
    tags: ['http'],
    inputs: {},
    outputs: {},
    steps: document.requests.flatMap(requestToSteps) as TestFlowStep[],
  };
}

export function httpToTestStrict(content: string, filePath = ''): TestData {
  const test = httpToTest(content, filePath);
  const errors = validateHttpDocument(content).map(warning => `line ${warning.line}: ${warning.message}`);
  const structuralErrors = validateTestData(test);
  if (errors.length > 0 || structuralErrors.length > 0) {
    throw new Error('Invalid HTTP test file:\n' + [...errors, ...structuralErrors].map(e => `  - ${e}`).join('\n'));
  }
  return test;
}

export function validateHttpDocument(content: string): HttpParseWarning[] {
  const document = parseHttpDocument(content);
  const errors: HttpParseWarning[] = [];
  errors.push(...document.warnings.filter(warning => /No HTTP request line|No HTTP requests/.test(warning.message)));
  const seenNames = new Map<string, number>();
  for (const request of document.requests) {
    if (!request.url.trim()) {
      errors.push({line: request.startLine, message: 'Request URL is required'});
    }
    if (request.name) {
      const previous = seenNames.get(request.name);
      if (previous !== undefined) {
        errors.push({line: request.startLine, message: `Duplicate request name "${request.name}" also used on line ${previous}`});
      } else {
        seenNames.set(request.name, request.startLine);
      }
    }
  }
  return errors;
}

const escapeHeaderValue = (value: string): string => String(value ?? '');

const bodyToHttp = (body: string | object | null | undefined): string => {
  if (body === undefined || body === null) {
    return '';
  }
  if (typeof body === 'string') {
    return body;
  }
  return JSON.stringify(body, null, 2);
};

export function testToHttp(test: TestData): string {
  const steps = Array.isArray(test.steps) ? test.steps : [];
  return steps
      .filter((step): step is TestFlowHttp => !!step && typeof step === 'object' && 'http' in step)
      .map((step, index) => {
        const lines: string[] = [];
        lines.push(index === 0 ? '###' : '\n###');
        if (step.id) {
          lines.push(`# @name ${step.id}`);
        }
        if (step.title && step.title !== step.id) {
          lines.push(`# @title ${step.title}`);
        }
        lines.push(`${String(step.method || 'get').toUpperCase()} ${step.http || ''}`);
        for (const [key, value] of Object.entries(step.headers || {})) {
          lines.push(`${key}: ${escapeHeaderValue(value)}`);
        }
        const body = bodyToHttp(step.body);
        if (body) {
          lines.push('');
          lines.push(body);
        }
        return lines.join('\n');
      })
      .join('\n');
}
