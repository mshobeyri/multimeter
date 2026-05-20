import {APIData} from './APIData';
import {Method} from './CommonData';

const DATA_FLAGS = new Set([
  '-d', '--data', '--data-raw', '--data-binary', '--data-ascii', '--data-urlencode',
  '--data-binary-raw', '--json',
]);
const HEADER_FLAGS = new Set(['-H', '--header']);
const FORM_FLAGS = new Set(['-F', '--form', '--form-string']);
const METHOD_FLAGS = new Set(['-X', '--request']);
const URL_FLAGS = new Set(['--url']);
const COOKIE_FLAGS = new Set(['-b', '--cookie', '--cookie-raw']);
const USER_FLAGS = new Set(['-u', '--user']);
const REFERER_FLAGS = new Set(['-e', '--referer']);
const USER_AGENT_FLAGS = new Set(['-A', '--user-agent']);
const GET_FLAGS = new Set(['-G', '--get']);
const HEAD_FLAGS = new Set(['-I', '--head']);
const QUERY_FLAGS = new Set(['--url-query']);
const IGNORED_VALUE_FLAGS = new Set([
  '-o', '--output', '--output-dir', '--connect-timeout', '--max-time', '--proxy', '--proxy-user',
  '--cacert', '--cert', '--key', '--resolve', '--interface', '--limit-rate', '--retry',
]);

type ParsedFlag = {flag: string; value?: string};

function normalizeCurlInput(command: string): string {
  return command
      .replace(/\\\r?\n/g, ' ')
      .replace(/\r\n/g, '\n')
      .trim();
}

export function isCurlCommand(text: string): boolean {
  return /^\s*curl(?:\s|$)/.test(text || '');
}

function tokenizeShell(command: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let quote: 'single' | 'double' | null = null;
  let escaping = false;

  for (let i = 0; i < command.length; i++) {
    const ch = command[i];

    if (escaping) {
      current += ch;
      escaping = false;
      continue;
    }

    if (ch === '\\' && quote !== 'single') {
      escaping = true;
      continue;
    }

    if (quote === 'single') {
      if (ch === "'") {
        quote = null;
      } else {
        current += ch;
      }
      continue;
    }

    if (quote === 'double') {
      if (ch === '"') {
        quote = null;
      } else {
        current += ch;
      }
      continue;
    }

    if (ch === "'") {
      quote = 'single';
      continue;
    }
    if (ch === '"') {
      quote = 'double';
      continue;
    }
    if (/\s/.test(ch)) {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    current += ch;
  }

  if (escaping) {
    current += '\\';
  }
  if (current.length > 0) {
    tokens.push(current);
  }
  return tokens;
}

function splitLongOption(token: string): ParsedFlag | null {
  if (!token.startsWith('--')) {
    return null;
  }
  const eq = token.indexOf('=');
  if (eq < 0) {
    return {flag: token};
  }
  return {flag: token.slice(0, eq), value: token.slice(eq + 1)};
}

function splitShortOption(token: string): ParsedFlag | null {
  if (!token.startsWith('-') || token.startsWith('--') || token.length <= 2) {
    return null;
  }
  const flag = token.slice(0, 2);
  if ([...METHOD_FLAGS, ...HEADER_FLAGS, ...DATA_FLAGS, ...FORM_FLAGS, ...COOKIE_FLAGS, ...USER_FLAGS, ...REFERER_FLAGS, ...USER_AGENT_FLAGS].includes(flag)) {
    return {flag, value: token.slice(2)};
  }
  return null;
}

function normalizeHeaderName(name: string): string {
  return name.trim().toLowerCase();
}

function parseHeader(raw: string): {name: string; value: string} | null {
  const idx = raw.indexOf(':');
  if (idx <= 0) {
    return null;
  }
  return {name: raw.slice(0, idx).trim(), value: raw.slice(idx + 1).trim()};
}

function parseCookies(raw: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const part of raw.split(';')) {
    const trimmed = part.trim();
    if (!trimmed) {
      continue;
    }
    const idx = trimmed.indexOf('=');
    if (idx <= 0) {
      continue;
    }
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (key) {
      cookies[key] = value;
    }
  }
  return cookies;
}

function appendQuery(url: string, params: string[]): string {
  if (params.length === 0) {
    return url;
  }
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${params.join('&')}`;
}

function parseQueryFromUrl(url: string): {url: string; query?: Record<string, string>} {
  const question = url.indexOf('?');
  if (question < 0) {
    return {url};
  }
  const base = url.slice(0, question);
  const queryText = url.slice(question + 1);
  const query: Record<string, string> = {};
  for (const part of queryText.split('&')) {
    if (!part) {
      continue;
    }
    const idx = part.indexOf('=');
    const key = idx >= 0 ? part.slice(0, idx) : part;
    const value = idx >= 0 ? part.slice(idx + 1) : '';
    if (key) {
      query[safeDecodeURIComponent(key)] = safeDecodeURIComponent(value.replace(/\+/g, ' '));
    }
  }
  return Object.keys(query).length > 0 ? {url: base, query} : {url};
}

function ensureCurlDefaultScheme(url: string): string {
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(url)) {
    return url;
  }
  return `http://${url}`;
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function methodFromString(value: string | undefined): Method | undefined {
  const method = (value || '').toLowerCase();
  if (['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'].includes(method)) {
    return method as Method;
  }
  return undefined;
}

function bodyFromData(parts: string[], headers: Record<string, string>): {body?: string | object; format: APIData['format']} {
  if (parts.length === 0) {
    return {format: 'json'};
  }
  const body = parts.join('&');
  const contentType = Object.entries(headers).find(([name]) => normalizeHeaderName(name) === 'content-type')?.[1] || '';
  const looksJson = /(^|;)\s*application\/json\b/i.test(contentType) || /^[\[{]/.test(body.trim());
  if (looksJson) {
    try {
      return {body: JSON.parse(body), format: 'json'};
    } catch {
      return {body, format: 'json'};
    }
  }
  if (/xml/i.test(contentType) || body.trim().startsWith('<')) {
    return {body, format: 'xml'};
  }
  return {body, format: 'text'};
}

function takeValue(tokens: string[], index: number, inlineValue: string | undefined): {value?: string; nextIndex: number} {
  if (inlineValue !== undefined) {
    return {value: inlineValue, nextIndex: index};
  }
  if (index + 1 >= tokens.length) {
    return {nextIndex: index};
  }
  return {value: tokens[index + 1], nextIndex: index + 1};
}

export function curlToAPI(command: string): APIData {
  const normalized = normalizeCurlInput(command);
  if (!isCurlCommand(normalized)) {
    throw new Error('Not a curl command');
  }
  const tokens = tokenizeShell(normalized);
  if (tokens[0] !== 'curl') {
    throw new Error('Not a curl command');
  }

  const headers: Record<string, string> = {};
  const cookies: Record<string, string> = {};
  const dataParts: string[] = [];
  const formParts: string[] = [];
  const urlQueryParts: string[] = [];
  let method: Method | undefined;
  let explicitMethod = false;
  let url = '';
  let useGetWithData = false;
  let auth: APIData['auth'];

  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i];
    const split = splitLongOption(token) || splitShortOption(token);
    const flag = split?.flag || token;
    const inlineValue = split?.value;

    if (URL_FLAGS.has(flag)) {
      const taken = takeValue(tokens, i, inlineValue);
      if (taken.value !== undefined) {
        url = taken.value;
      }
      i = taken.nextIndex;
      continue;
    }
    if (METHOD_FLAGS.has(flag)) {
      const taken = takeValue(tokens, i, inlineValue);
      method = methodFromString(taken.value) || method;
      explicitMethod = !!method;
      i = taken.nextIndex;
      continue;
    }
    if (HEADER_FLAGS.has(flag)) {
      const taken = takeValue(tokens, i, inlineValue);
      const header = taken.value ? parseHeader(taken.value) : null;
      if (header) {
        if (normalizeHeaderName(header.name) === 'cookie') {
          Object.assign(cookies, parseCookies(header.value));
        } else {
          headers[header.name] = header.value;
        }
      }
      i = taken.nextIndex;
      continue;
    }
    if (DATA_FLAGS.has(flag)) {
      const taken = takeValue(tokens, i, inlineValue);
      if (taken.value !== undefined) {
        if (flag === '--json') {
          headers['Content-Type'] = headers['Content-Type'] || 'application/json';
          headers['Accept'] = headers['Accept'] || 'application/json';
        }
        dataParts.push(taken.value);
      }
      i = taken.nextIndex;
      continue;
    }
    if (FORM_FLAGS.has(flag)) {
      const taken = takeValue(tokens, i, inlineValue);
      if (taken.value !== undefined) {
        formParts.push(taken.value);
      }
      i = taken.nextIndex;
      continue;
    }
    if (COOKIE_FLAGS.has(flag)) {
      const taken = takeValue(tokens, i, inlineValue);
      if (taken.value !== undefined) {
        Object.assign(cookies, parseCookies(taken.value));
      }
      i = taken.nextIndex;
      continue;
    }
    if (USER_FLAGS.has(flag)) {
      const taken = takeValue(tokens, i, inlineValue);
      if (taken.value !== undefined) {
        const idx = taken.value.indexOf(':');
        auth = {
          type: 'basic',
          username: idx >= 0 ? taken.value.slice(0, idx) : taken.value,
          password: idx >= 0 ? taken.value.slice(idx + 1) : '',
        };
      }
      i = taken.nextIndex;
      continue;
    }
    if (REFERER_FLAGS.has(flag)) {
      const taken = takeValue(tokens, i, inlineValue);
      if (taken.value !== undefined) {
        headers['Referer'] = taken.value;
      }
      i = taken.nextIndex;
      continue;
    }
    if (USER_AGENT_FLAGS.has(flag)) {
      const taken = takeValue(tokens, i, inlineValue);
      if (taken.value !== undefined) {
        headers['User-Agent'] = taken.value;
      }
      i = taken.nextIndex;
      continue;
    }
    if (GET_FLAGS.has(flag)) {
      useGetWithData = true;
      method = 'get';
      continue;
    }
    if (QUERY_FLAGS.has(flag)) {
      const taken = takeValue(tokens, i, inlineValue);
      if (taken.value !== undefined) {
        urlQueryParts.push(taken.value);
      }
      i = taken.nextIndex;
      continue;
    }
    if (HEAD_FLAGS.has(flag)) {
      method = 'head';
      explicitMethod = true;
      continue;
    }
    if (IGNORED_VALUE_FLAGS.has(flag)) {
      const taken = takeValue(tokens, i, inlineValue);
      i = taken.nextIndex;
      continue;
    }
    if (token.startsWith('-')) {
      continue;
    }
    url = token;
  }

  if (!url) {
    throw new Error('Curl command is missing a URL');
  }

  if (urlQueryParts.length > 0) {
    url = appendQuery(url, urlQueryParts);
  }

  if (!method) {
    method = (dataParts.length > 0 || formParts.length > 0) && !useGetWithData ? 'post' : 'get';
  }

  if (useGetWithData && dataParts.length > 0) {
    url = appendQuery(url, dataParts);
  }

  const parsedUrl = parseQueryFromUrl(ensureCurlDefaultScheme(url));
  const api: APIData = {
    type: 'api',
    url: parsedUrl.url,
    protocol: 'http',
    method,
    format: 'json',
  };

  if (parsedUrl.query) {
    api.query = parsedUrl.query;
  }
  if (Object.keys(headers).length > 0) {
    api.headers = headers;
  }
  if (Object.keys(cookies).length > 0) {
    api.cookies = cookies;
  }
  if (auth) {
    api.auth = auth;
  }

  if (!useGetWithData) {
    const bodyParts = formParts.length > 0 ? formParts : dataParts;
    const body = bodyFromData(bodyParts, headers);
    api.format = body.format;
    if (body.body !== undefined) {
      api.body = body.body;
    }
    if (formParts.length > 0 && !api.headers?.['Content-Type']) {
      api.headers = {...(api.headers || {}), 'Content-Type': 'multipart/form-data'};
      api.format = 'text';
    }
  }

  return api;
}
