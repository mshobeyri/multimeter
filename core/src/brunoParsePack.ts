import {Method} from './CommonData';
import {TestData, TestFlowHttp, TestFlowStep} from './TestData';
import {validateTestData} from './testParsePack';

const HTTP_METHODS = new Set([
  'get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace',
]);

export interface BrunoParseWarning {
  line: number;
  message: string;
}

export interface BrunoBlock {
  name: string;
  qualifier?: string;
  content: string;
  startLine: number;
}

export interface BrunoDocument {
  blocks: BrunoBlock[];
  warnings: BrunoParseWarning[];
}

export function isBrunoFilePath(filePath: string): boolean {
  return String(filePath || '').toLowerCase().endsWith('.bru');
}

const lineForOffset = (content: string, offset: number): number => {
  return content.slice(0, offset).split('\n').length;
};

export function parseBrunoDocument(content: string): BrunoDocument {
  const source = String(content || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks: BrunoBlock[] = [];
  const warnings: BrunoParseWarning[] = [];
  const blockPattern = /^\s*([A-Za-z][A-Za-z0-9_-]*)(?::([A-Za-z0-9_-]+))?\s*\{/gm;
  let match: RegExpExecArray | null;

  while ((match = blockPattern.exec(source)) !== null) {
    const openIndex = source.indexOf('{', match.index);
    let depth = 0;
    let quote: string | undefined;
    let escaped = false;
    let closeIndex = -1;
    for (let i = openIndex; i < source.length; i++) {
      const char = source[i];
      if (quote) {
        if (escaped) {
          escaped = false;
        } else if (char === '\\') {
          escaped = true;
        } else if (char === quote) {
          quote = undefined;
        }
        continue;
      }
      if (char === '"' || char === "'" || char === '`') {
        quote = char;
        continue;
      }
      if (char === '{') {
        depth++;
      } else if (char === '}') {
        depth--;
        if (depth === 0) {
          closeIndex = i;
          break;
        }
      }
    }

    const startLine = lineForOffset(source, match.index);
    if (closeIndex < 0) {
      warnings.push({line: startLine, message: `Unclosed Bruno block "${match[1]}"`});
      break;
    }

    blocks.push({
      name: (match[1] || '').toLowerCase(),
      qualifier: match[2]?.toLowerCase(),
      content: source.slice(openIndex + 1, closeIndex).trim(),
      startLine,
    });
    blockPattern.lastIndex = closeIndex + 1;
  }

  if (blocks.length === 0 && source.trim()) {
    warnings.push({line: 1, message: 'No Bruno blocks found'});
  }

  return {blocks, warnings};
}

const parseKeyValueBlock = (content: string): Record<string, string> => {
  const result: Record<string, string> = {};
  for (const line of String(content || '').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//') || trimmed.startsWith(';')) {
      continue;
    }
    if (trimmed.startsWith('~')) {
      continue;
    }
    const match = /^([^:\s][^:]*?)\s*:\s*([\s\S]*)$/.exec(trimmed);
    if (!match || !match[1]) {
      continue;
    }
    result[match[1].trim()] = (match[2] || '').trim();
  }
  return result;
};

const firstBlock = (document: BrunoDocument, name: string, qualifier?: string): BrunoBlock | undefined => {
  return document.blocks.find(block => block.name === name && (qualifier === undefined || block.qualifier === qualifier));
};

const blocksByName = (document: BrunoDocument, name: string): BrunoBlock[] => {
  return document.blocks.filter(block => block.name === name);
};

const sanitizeId = (value: string): string => {
  const normalized = String(value || '').trim().replace(/[^A-Za-z0-9_]/g, '_');
  if (!normalized) {
    return 'request';
  }
  return /^[A-Za-z_]/.test(normalized) ? normalized : `request_${normalized}`;
};

const convertVariableReference = (expr: string, variables: Record<string, string>): string => {
  const trimmed = expr.trim();
  const lower = trimmed.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(variables, trimmed)) {
    return variables[trimmed];
  }
  if (lower === '$guid' || lower === '$uuid' || lower === '$randomuuid') {
    return 'r:uuid';
  }
  if (lower === '$timestamp') {
    return 'c:epoch';
  }
  return `<<e:${trimmed.replace(/[^A-Za-z0-9_-]/g, '_')}>>`;
};

const convertVariables = (value: string, variables: Record<string, string>): string => {
  return String(value ?? '').replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_match, expr: string) =>
    convertVariableReference(expr, variables));
};

const collectVariables = (document: BrunoDocument): Record<string, string> => {
  const variables: Record<string, string> = {};
  for (const block of document.blocks) {
    if (block.name !== 'vars') {
      continue;
    }
    if (block.qualifier === 'post-response') {
      continue;
    }
    for (const [key, value] of Object.entries(parseKeyValueBlock(block.content))) {
      variables[key] = convertVariables(value, variables);
    }
  }
  return variables;
};

const inferFormat = (formatHint: string | undefined, headers: Record<string, string>, body?: string): TestFlowHttp['format'] => {
  const hint = String(formatHint || '').toLowerCase();
  if (hint === 'json' || hint === 'xml' || hint === 'text') {
    return hint;
  }
  const contentTypeKey = Object.keys(headers).find(key => key.toLowerCase() === 'content-type');
  const contentType = contentTypeKey ? headers[contentTypeKey].toLowerCase() : '';
  if (contentType.includes('json')) {
    return 'json';
  }
  if (contentType.includes('xml')) {
    return 'xml';
  }
  const trimmed = String(body || '').trim();
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    return 'json';
  }
  if (trimmed.startsWith('<') && trimmed.endsWith('>')) {
    return 'xml';
  }
  return 'text';
};

const parseBody = (format: TestFlowHttp['format'], body?: string): string | object | null | undefined => {
  if (body === undefined) {
    return undefined;
  }
  const trimmed = body.trim();
  if (!trimmed || trimmed === 'none') {
    return undefined;
  }
  if (format === 'json') {
    try {
      return JSON.parse(trimmed);
    } catch {
      return body;
    }
  }
  return body;
};

const responsePathToExpectKey = (path: string): string | undefined => {
  const normalized = path.replace(/^res(?:ponse)?\./, '');
  if (normalized === 'status' || normalized === 'statusCode') {
    return 'status';
  }
  const match = /^(body|headers|cookies)(.*)$/.exec(normalized);
  if (!match || !match[1]) {
    return undefined;
  }
  const suffix = (match[2] || '').replace(/^\./, '');
  return suffix ? `${match[1]}.${suffix.replace(/\[(\d+)\]/g, '.$1')}` : match[1];
};

const normalizeExpected = (raw: string): string => {
  const trimmed = raw.trim().replace(/;\s*$/, '');
  const quoted = /^(['"])([\s\S]*)\1$/.exec(trimmed);
  return quoted ? quoted[2] : trimmed;
};

const extractTestExpects = (script: string): TestFlowHttp['expect'] | undefined => {
  const expect: NonNullable<TestFlowHttp['expect']> = {};
  const patterns = [
    /expect\(\s*((?:res|response)\.[A-Za-z_$][A-Za-z0-9_$.\[\]]*)\s*\)\.to\.(?:equal|eql)\(\s*([^)]*?)\s*\)/g,
    /expect\(\s*((?:res|response)\.[A-Za-z_$][A-Za-z0-9_$.\[\]]*)\s*\)\.to\.not\.(?:equal|eql)\(\s*([^)]*?)\s*\)/g,
  ];
  patterns.forEach((pattern, patternIndex) => {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(script)) !== null) {
      if (!match[1] || !match[2]) {
        continue;
      }
      const key = responsePathToExpectKey(match[1]);
      if (!key) {
        continue;
      }
      expect[key] = `${patternIndex === 0 ? '==' : '!='} ${normalizeExpected(match[2])}`;
    }
  });
  return Object.keys(expect).length > 0 ? expect : undefined;
};

const applyAuthHeaders = (headers: Record<string, string>, document: BrunoDocument, authType: string | undefined, variables: Record<string, string>) => {
  const type = String(authType || '').toLowerCase();
  if (!type || type === 'none' || headers.Authorization || headers.authorization) {
    return;
  }
  if (type === 'bearer') {
    const values = parseKeyValueBlock(firstBlock(document, 'auth', 'bearer')?.content || '');
    const token = values.token || values.bearer || '';
    if (token) {
      headers.Authorization = `Bearer ${convertVariables(token, variables)}`;
    }
  }
};

export function brunoToTest(content: string, filePath = ''): TestData {
  const document = parseBrunoDocument(content);
  const variables = collectVariables(document);
  const meta = parseKeyValueBlock(firstBlock(document, 'meta')?.content || '');
  const methodBlock = document.blocks.find(block => HTTP_METHODS.has(block.name));
  const methodInfo = parseKeyValueBlock(methodBlock?.content || '');
  const title = meta.name || (filePath ? filePath.split(/[/\\]/).pop() || 'Bruno request' : 'Bruno request');
  const headers = Object.fromEntries(
      Object.entries(parseKeyValueBlock(firstBlock(document, 'headers')?.content || ''))
          .map(([key, value]) => [key, convertVariables(value, variables)]));

  applyAuthHeaders(headers, document, methodInfo.auth, variables);

  const bodyBlock = blocksByName(document, 'body').find(block => block.qualifier && block.qualifier !== 'none');
  const rawBody = bodyBlock ? convertVariables(bodyBlock.content, variables) : undefined;
  const format = inferFormat(bodyBlock?.qualifier || methodInfo.body, headers, rawBody);
  const step: TestFlowHttp = {
    http: convertVariables(methodInfo.url || '', variables),
    id: sanitizeId(meta.name || 'request'),
    title,
    method: (methodBlock?.name || 'get') as Method,
    format,
    report: 'all',
  };

  const query = Object.fromEntries(
      Object.entries(parseKeyValueBlock(firstBlock(document, 'params', 'query')?.content || ''))
          .map(([key, value]) => [key, convertVariables(value, variables)]));
  if (Object.keys(query).length > 0) {
    step.query = query;
  }
  if (Object.keys(headers).length > 0) {
    step.headers = headers;
  }
  const body = parseBody(format, rawBody);
  if (body !== undefined) {
    step.body = body;
  }
  const testsBlock = firstBlock(document, 'tests');
  if (testsBlock) {
    step.expect = extractTestExpects(testsBlock.content);
  }

  return {
    type: 'test',
    title,
    description: '',
    tags: ['bruno'],
    inputs: {},
    outputs: {},
    steps: methodBlock ? [step] as TestFlowStep[] : [],
  };
}

export function validateBrunoDocument(content: string): BrunoParseWarning[] {
  const document = parseBrunoDocument(content);
  const errors: BrunoParseWarning[] = [...document.warnings];
  const methodBlocks = document.blocks.filter(block => HTTP_METHODS.has(block.name));
  if (methodBlocks.length === 0) {
    errors.push({line: 1, message: 'No Bruno HTTP method block found'});
  }
  if (methodBlocks.length > 1) {
    errors.push({line: methodBlocks[1].startLine, message: 'Only one Bruno HTTP method block is supported per .bru file'});
  }
  const methodInfo = parseKeyValueBlock(methodBlocks[0]?.content || '');
  if (methodBlocks.length > 0 && !methodInfo.url) {
    errors.push({line: methodBlocks[0].startLine, message: 'Request URL is required'});
  }
  return errors;
}

export function brunoToTestStrict(content: string, filePath = ''): TestData {
  const test = brunoToTest(content, filePath);
  const errors = validateBrunoDocument(content).map(warning => `line ${warning.line}: ${warning.message}`);
  const structuralErrors = validateTestData(test);
  if (errors.length > 0 || structuralErrors.length > 0) {
    throw new Error('Invalid Bruno test file:\n' + [...errors, ...structuralErrors].map(e => `  - ${e}`).join('\n'));
  }
  return test;
}