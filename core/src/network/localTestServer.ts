/**
 * In-process Multimeter test server (same contract as https://test.mmt.dev).
 *
 * Any request whose hostname is `local.mmt.dev` is answered here — no sockets,
 * no DNS, no internet. Shared by the Node network layer and the Cloudflare
 * worker that powers the public test.mmt.dev host.
 */

export const LOCAL_MMT_DEV_HOST = 'local.mmt.dev';
export const PUBLIC_TEST_SERVER_HOST = 'test.mmt.dev';

export interface LocalTestServerRequest {
  method: string;
  /** Absolute URL including origin (may use https://local.mmt.dev). */
  url: string;
  headers: Record<string, string>;
  /** Raw body text (already stringified by the caller when needed). */
  bodyText?: string;
  /** Binary body when Content-Type is octet-stream / multipart parts as bytes. */
  bodyBytes?: Uint8Array;
}

export interface LocalTestServerResponse {
  status: number;
  statusText: string;
  headers: Record<string, string|string[]>;
  /** UTF-8 text or binary payload. */
  body: string|Uint8Array;
}

const STATUS_TEXTS: Record<number, string> = {
  100: 'Continue',
  101: 'Switching Protocols',
  102: 'Processing',
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  204: 'No Content',
  301: 'Moved Permanently',
  302: 'Found',
  303: 'See Other',
  304: 'Not Modified',
  307: 'Temporary Redirect',
  308: 'Permanent Redirect',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  408: 'Request Timeout',
  409: 'Conflict',
  410: 'Gone',
  413: 'Payload Too Large',
  415: 'Unsupported Media Type',
  418: 'I\'m a Teapot',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  501: 'Not Implemented',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
};

const SAMPLE_JSON = {
  id: 1,
  name: 'Multimeter',
  description: 'API testing tool',
  version: '1.0.0',
  tags: ['api', 'testing', 'automation'],
  nested: {
    enabled: true,
    count: 42,
    items: [
      {key: 'alpha', value: 1},
      {key: 'beta', value: 2},
    ],
  },
};

export function isLocalMmtDevHostname(hostname: string|undefined|null): boolean {
  if (!hostname) {
    return false;
  }
  const host = String(hostname).trim().toLowerCase();
  // Strip optional port (URL.hostname usually excludes it already).
  const bare = host.replace(/:\d+$/, '');
  return bare === LOCAL_MMT_DEV_HOST || bare.endsWith(`.${LOCAL_MMT_DEV_HOST}`);
}

export function isLocalMmtDevUrl(url: string|undefined|null): boolean {
  if (!url) {
    return false;
  }
  try {
    return isLocalMmtDevHostname(new URL(String(url)).hostname);
  } catch {
    return false;
  }
}

export type LocalTestServerRequestInfo = {
  method: string;
  url: string;
  path: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  body: string;
};

export type LocalTestServerRequestHook =
    (info: LocalTestServerRequestInfo) => void;

const requestHooks: LocalTestServerRequestHook[] = [];

/** Test helper: observe every local.mmt.dev request (no network I/O). */
export function onLocalTestServerRequest(hook: LocalTestServerRequestHook):
    () => void {
  requestHooks.push(hook);
  return () => {
    const idx = requestHooks.indexOf(hook);
    if (idx >= 0) {
      requestHooks.splice(idx, 1);
    }
  };
}

export function endpointList(): string[] {
  return [
    'GET  /                     → this help page',
    'ANY  /echo                 → echo back request details (JSON)',
    'ANY  /echo/*               → echo (path preserved)',
    'ANY  /echo/xml             → echo back request details as XML',
    'ANY  /anything             → alias for /echo',
    'GET  /status/:code         → respond with the given HTTP status code (100-599)',
    'ANY  /delay/:ms            → delay response up to 10000ms',
    'GET  /headers              → return request headers as JSON',
    'GET  /ip                   → return client IP address',
    'ANY  /method/:method       → 200 if request method matches, 405 otherwise',
    'GET  /redirect/:n          → redirect n times (max 20), then 200',
    'GET  /json                 → sample JSON response (pretty-printed)',
    'GET  /json-compact         → sample JSON response (compact, application/json)',
    'GET  /xml                  → sample XML response',
    'GET  /html                 → sample HTML response',
    'GET  /bytes/:n             → n random bytes (max 100KB)',
    'GET  /auth/basic           → Basic auth (user:pass)',
    'GET  /auth/bearer          → Bearer token auth (testtoken)',
    'POST /token                → OAuth2 client-credentials style token',
    'GET  /cookies              → return cookies sent',
    'GET  /cookies/set?k=v      → set cookies via query params',
    'GET  /cache/:seconds       → Cache-Control max-age (max 86400)',
    'WS   /ws                   → WebSocket echo (reflects every message back)',
  ];
}

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods':
        'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Max-Age': '86400',
  };
}

function statusTextFor(code: number): string {
  return STATUS_TEXTS[code] || 'Unknown';
}

function jsonResponse(
    data: unknown, status = 200,
    extraHeaders: Record<string, string|string[]> = {},
    options: {compact?: boolean} = {}): LocalTestServerResponse {
  const body =
      options.compact ? JSON.stringify(data) : JSON.stringify(data, null, 2);
  return {
    status,
    statusText: statusTextFor(status),
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
      ...extraHeaders,
    },
    body,
  };
}

function textResponse(
    body: string, status: number, contentType: string,
    extraHeaders: Record<string, string|string[]> = {}): LocalTestServerResponse {
  return {
    status,
    statusText: statusTextFor(status),
    headers: {'Content-Type': contentType, ...corsHeaders(), ...extraHeaders},
    body,
  };
}

function headerMap(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers || {})) {
    const key = k.toLowerCase();
    if (key.startsWith('cf-') || key === 'x-real-ip') {
      continue;
    }
    out[key] = v;
  }
  return out;
}

function getHeader(
    headers: Record<string, string>, name: string): string|undefined {
  const want = name.toLowerCase();
  for (const [k, v] of Object.entries(headers || {})) {
    if (k.toLowerCase() === want) {
      return v;
    }
  }
  return undefined;
}

function queryToObject(url: URL): Record<string, string> {
  const q: Record<string, string> = {};
  url.searchParams.forEach((v, k) => {
    q[k] = v;
  });
  return q;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(Object.assign(new Error('aborted'), {name: 'AbortError'}));
      return;
    }
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const onAbort = () => {
      cleanup();
      reject(Object.assign(new Error('aborted'), {name: 'AbortError'}));
    };
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    };
    signal?.addEventListener('abort', onAbort, {once: true});
  });
}

function decodeBase64(value: string): string {
  if (typeof globalThis.atob === 'function') {
    return globalThis.atob(value);
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return Buffer.from(value, 'base64').toString('utf8');
}

function fillRandomBytes(target: Uint8Array): void {
  const webCrypto = (globalThis as any).crypto;
  if (webCrypto && typeof webCrypto.getRandomValues === 'function') {
    webCrypto.getRandomValues(target);
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const nodeCrypto = require('crypto') as typeof import('crypto');
  nodeCrypto.randomFillSync(target);
}

function parseBodyValue(
    method: string, headers: Record<string, string>,
    bodyText: string|undefined): unknown {
  if (method === 'GET' || method === 'HEAD') {
    return null;
  }
  if (bodyText === undefined || bodyText === '') {
    return null;
  }
  const contentType = getHeader(headers, 'content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(bodyText);
    } catch {
      return bodyText;
    }
  }
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const obj: Record<string, string> = {};
    const params = new URLSearchParams(bodyText);
    params.forEach((v, k) => {
      obj[k] = v;
    });
    return obj;
  }
  // multipart and other types: return raw text (CF worker parses FormData;
  // local callers typically already stringified the wire body).
  return bodyText;
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
}

function safeXmlTag(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9_.-]/g, '_');
  if (!cleaned || !/^[A-Za-z_]/.test(cleaned)) {
    return `_${cleaned || 'key'}`;
  }
  return cleaned;
}

function valueToXmlLines(tag: string, value: unknown, depth: number): string[] {
  const pad = '  '.repeat(depth);
  const name = safeXmlTag(tag);
  if (value === null || value === undefined) {
    return [`${pad}<${name}/>`];
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('<') && trimmed.endsWith('>')) {
      return [`${pad}<${name}>`, value, `${pad}</${name}>`];
    }
    return [`${pad}<${name}>${escapeXml(value)}</${name}>`];
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return [`${pad}<${name}>${escapeXml(String(value))}</${name}>`];
  }
  if (Array.isArray(value)) {
    const lines = [`${pad}<${name}>`];
    for (const item of value) {
      lines.push(...valueToXmlLines('item', item, depth + 1));
    }
    lines.push(`${pad}</${name}>`);
    return lines;
  }
  if (typeof value === 'object') {
    const lines = [`${pad}<${name}>`];
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      lines.push(...valueToXmlLines(k, v, depth + 1));
    }
    lines.push(`${pad}</${name}>`);
    return lines;
  }
  return [`${pad}<${name}>${escapeXml(String(value))}</${name}>`];
}

function isEchoPath(path: string): boolean {
  return path === '/echo' || path.startsWith('/echo/') || path === '/anything' ||
      path.startsWith('/anything/') || path === '/parity' ||
      path === '/with-cookie';
}

function handleEcho(
    req: LocalTestServerRequest, url: URL,
    asXml: boolean): LocalTestServerResponse {
  const body = parseBodyValue(req.method, req.headers, req.bodyText);
  const query = queryToObject(url);
  const headers = headerMap(req.headers);

  if (asXml) {
    const indent = '  ';
    const lines: string[] = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<echo>',
      `${indent}<method>${escapeXml(req.method)}</method>`,
      `${indent}<url>${escapeXml(req.url)}</url>`,
      `${indent}<path>${escapeXml(url.pathname)}</path>`,
    ];
    if (Object.keys(query).length > 0) {
      lines.push(`${indent}<query>`);
      for (const [k, v] of Object.entries(query)) {
        lines.push(
            `${indent}${indent}<${safeXmlTag(k)}>${escapeXml(v)}</${
                safeXmlTag(k)}>`);
      }
      lines.push(`${indent}</query>`);
    }
    lines.push(`${indent}<headers>`);
    for (const [k, v] of Object.entries(headers)) {
      lines.push(
          `${indent}${indent}<${safeXmlTag(k)}>${escapeXml(v)}</${
              safeXmlTag(k)}>`);
    }
    lines.push(`${indent}</headers>`);
    if (body !== null && body !== undefined) {
      lines.push(...valueToXmlLines('body', body, 1));
    }
    lines.push(
        `${indent}<timestamp>${escapeXml(new Date().toISOString())}</timestamp>`);
    lines.push('</echo>');
    return textResponse(lines.join('\n'), 200, 'application/xml');
  }

  return jsonResponse({
    method: req.method,
    url: req.url,
    path: url.pathname,
    query: Object.keys(query).length > 0 ? query : undefined,
    headers,
    body: body ?? undefined,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Handle one HTTP request for local.mmt.dev / test.mmt.dev semantics.
 * Does not follow redirects — callers may loop on 3xx Location.
 */
export async function handleLocalTestServerHttp(
    req: LocalTestServerRequest,
    options?: {abortSignal?: AbortSignal; serviceHost?: string}):
    Promise<LocalTestServerResponse> {
  const method = (req.method || 'GET').toUpperCase();
  const url = new URL(req.url);
  const pathRaw = url.pathname;
  const path = pathRaw === '/' ? '/' : pathRaw.replace(/\/+$/, '');
  const serviceHost = options?.serviceHost || LOCAL_MMT_DEV_HOST;
  const query = queryToObject(url);
  const headers = headerMap(req.headers);
  const body = req.bodyText ?? '';

  for (const hook of [...requestHooks]) {
    try {
      hook({method, url: req.url, path: pathRaw, query, headers, body});
    } catch {
      // ignore observer errors
    }
  }

  if (method === 'OPTIONS') {
    return {
      status: 204,
      statusText: 'No Content',
      headers: corsHeaders(),
      body: '',
    };
  }

  try {
    if (path === '/' || path === '') {
      return jsonResponse({
        service: 'Multimeter Test Server',
        url: `https://${serviceHost}`,
        endpoints: endpointList(),
      });
    }

    if (path === '/echo/xml') {
      return handleEcho({...req, method}, url, true);
    }
    if (isEchoPath(path)) {
      const echo = handleEcho({...req, method}, url, false);
      // Convenience header for API-tester cookie / method checks.
      echo.headers['X-Echo-Method'] = method;
      if (path === '/with-cookie') {
        echo.headers['Set-Cookie'] =
            ['session=flow-sid; Path=/', 'theme=dark'];
      }
      return echo;
    }
    if (path === '/headers') {
      return jsonResponse({headers: headerMap(req.headers)});
    }
    if (path === '/ip') {
      const ip = getHeader(req.headers, 'cf-connecting-ip') ||
          getHeader(req.headers, 'x-forwarded-for') ||
          getHeader(req.headers, 'x-real-ip') || '127.0.0.1';
      return jsonResponse({ip});
    }
    if (path === '/json') {
      return jsonResponse(SAMPLE_JSON);
    }
    if (path === '/json-compact') {
      return jsonResponse(SAMPLE_JSON, 200, {}, {compact: true});
    }
    if (path === '/xml') {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<root>
  <id>1</id>
  <name>Multimeter</name>
  <description>API testing tool</description>
  <version>1.0.0</version>
  <tags>
    <tag>api</tag>
    <tag>testing</tag>
    <tag>automation</tag>
  </tags>
  <nested enabled="true" count="42">
    <item key="alpha" value="1"/>
    <item key="beta" value="2"/>
  </nested>
</root>`;
      return textResponse(xml, 200, 'application/xml');
    }
    if (path === '/html') {
      const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Test Page</title></head>
<body>
  <h1>Multimeter Test Server</h1>
  <p>This is a sample HTML response for testing.</p>
  <ul>
    <li>Item 1</li>
    <li>Item 2</li>
    <li>Item 3</li>
  </ul>
</body>
</html>`;
      return textResponse(html, 200, 'text/html; charset=utf-8');
    }
    if (path === '/cookies') {
      const cookies: Record<string, string> = {};
      const cookieHeader = getHeader(req.headers, 'cookie') || '';
      if (cookieHeader) {
        for (const pair of cookieHeader.split(';')) {
          const [k, ...v] = pair.split('=');
          if (k) {
            cookies[k.trim()] = v.join('=').trim();
          }
        }
      }
      return jsonResponse({cookies});
    }
    if (path === '/cookies/set' || path.startsWith('/cookies/set')) {
      const cookies: Record<string, string> = {};
      const setCookies: string[] = [];
      url.searchParams.forEach((value, key) => {
        cookies[key] = value;
        setCookies.push(`${key}=${value}; Path=/`);
      });
      return jsonResponse({cookies}, 200, {'Set-Cookie': setCookies});
    }
    if (path === '/auth/basic') {
      const auth = getHeader(req.headers, 'authorization') || '';
      if (!auth.startsWith('Basic ')) {
        return jsonResponse(
            {authenticated: false, error: 'Missing Basic auth header'}, 401, {
              'WWW-Authenticate': 'Basic realm="test"',
            });
      }
      const decoded = decodeBase64(auth.slice(6));
      const [user, pass] = decoded.split(':');
      if (user === 'user' && pass === 'pass') {
        return jsonResponse({authenticated: true, user});
      }
      return jsonResponse(
          {
            authenticated: false,
            error: 'Invalid credentials (expected user:pass)',
          },
          401, {'WWW-Authenticate': 'Basic realm="test"'});
    }
    if (path === '/auth/bearer') {
      const auth = getHeader(req.headers, 'authorization') || '';
      if (!auth.startsWith('Bearer ')) {
        return jsonResponse(
            {authenticated: false, error: 'Missing Bearer token'}, 401);
      }
      const token = auth.slice(7);
      if (token === 'testtoken') {
        return jsonResponse({authenticated: true, token});
      }
      return jsonResponse(
          {authenticated: false, error: 'Invalid token (expected "testtoken")'},
          401);
    }
    if (path === '/token' && (method === 'POST' || method === 'GET')) {
      // Local convenience for OAuth client-credentials demos / unit tests.
      return jsonResponse({
        access_token: 'tok-local',
        token_type: 'Bearer',
        expires_in: 3600,
      });
    }

    let m: RegExpMatchArray|null;

    m = path.match(/^\/status\/(\d+)$/);
    if (m) {
      const code = parseInt(m[1], 10);
      if (code < 100 || code > 599) {
        return jsonResponse(
            {error: 'Status code must be between 100 and 599'}, 400);
      }
      return jsonResponse(
          {status: code, description: statusTextFor(code)}, code);
    }

    m = path.match(/^\/delay\/(\d+)$/);
    if (m) {
      const clamped = Math.min(Math.max(0, parseInt(m[1], 10)), 10000);
      await sleep(clamped, options?.abortSignal);
      const body = parseBodyValue(method, req.headers, req.bodyText);
      const query = queryToObject(url);
      return jsonResponse({
        delayed: clamped,
        method,
        query: Object.keys(query).length > 0 ? query : undefined,
        body: body ?? undefined,
        timestamp: new Date().toISOString(),
      });
    }

    m = path.match(/^\/method\/(\w+)$/);
    if (m) {
      const expected = m[1].toUpperCase();
      if (method === expected) {
        return jsonResponse({ok: true, method});
      }
      return jsonResponse(
          {ok: false, error: `Expected ${expected}, got ${method}`}, 405);
    }

    m = path.match(/^\/redirect\/(\d+)$/);
    if (m) {
      const count = Math.min(Math.max(0, parseInt(m[1], 10)), 20);
      if (count === 0) {
        return jsonResponse(
            {redirected: true, message: 'Final destination reached'});
      }
      const next = `${url.origin}/redirect/${count - 1}`;
      return {
        status: 302,
        statusText: statusTextFor(302),
        headers: {Location: next, ...corsHeaders()},
        body: '',
      };
    }

    m = path.match(/^\/bytes\/(\d+)$/);
    if (m) {
      const clamped = Math.min(Math.max(0, parseInt(m[1], 10)), 102400);
      const bytes = new Uint8Array(clamped);
      fillRandomBytes(bytes);
      return {
        status: 200,
        statusText: 'OK',
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Length': String(clamped),
          ...corsHeaders(),
        },
        body: bytes,
      };
    }

    m = path.match(/^\/cache\/(\d+)$/);
    if (m) {
      const clamped = Math.min(Math.max(0, parseInt(m[1], 10)), 86400);
      return jsonResponse(
          {cache: clamped, message: `Cache-Control set to ${clamped} seconds`},
          200, {'Cache-Control': `public, max-age=${clamped}`});
    }

    return jsonResponse({error: 'Not found', endpoints: endpointList()}, 404);
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw err;
    }
    return jsonResponse(
        {error: 'Internal server error', message: String(err)}, 500);
  }
}

/** Echo a WebSocket text/JSON payload the way test.mmt.dev /ws does. */
export function echoWebSocketMessage(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    return JSON.stringify(parsed);
  } catch {
    return raw;
  }
}
