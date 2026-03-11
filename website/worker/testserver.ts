/**
 * Test Server Worker for test.mmt.dev
 *
 * A simple HTTP test server with various utility endpoints.
 * Useful for testing API calls, assertions, and automation with Multimeter.
 *
 * Endpoints:
 *   GET  /                     → help page listing all endpoints
 *   ANY  /echo                 → echo back request details
 *   GET  /status/:code         → respond with the given HTTP status code
 *   ANY  /delay/:ms            → delay response (max 10000ms)
 *   GET  /headers              → return request headers as JSON
 *   GET  /ip                   → return client IP
 *   ANY  /method/:method       → 200 if request method matches, 405 otherwise
 *   GET  /redirect/:n          → redirect n times (max 20), then return 200
 *   GET  /json                 → sample JSON response
 *   GET  /xml                  → sample XML response
 *   GET  /html                 → sample HTML response
 *   GET  /bytes/:n             → n random bytes (max 100KB)
 *   GET  /auth/basic           → check Basic auth (user: "user", pass: "pass")
 *   GET  /auth/bearer          → check Bearer token (token: "testtoken")
 *   GET  /cookies              → return cookies
 *   GET  /cookies/set?k=v      → set cookies and return them
 *   GET  /cache/:seconds       → respond with Cache-Control max-age
 *   ANY  /anything             → alias for /echo
 */

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    try {
      const route = matchRoute(path);
      if (!route) {
        return jsonResponse({ error: 'Not found', endpoints: endpointList() }, 404);
      }
      return await route(request, url);
    } catch (err) {
      return jsonResponse({ error: 'Internal server error', message: String(err) }, 500);
    }
  },
};

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

type Handler = (request: Request, url: URL) => Promise<Response> | Response;

function matchRoute(path: string): Handler | null {
  // Normalize: strip trailing slash (except root)
  const p = path === '/' ? '/' : path.replace(/\/+$/, '');

  if (p === '/' || p === '') { return handleIndex; }
  if (p === '/echo' || p === '/anything') { return handleEcho; }
  if (p === '/headers') { return handleHeaders; }
  if (p === '/ip') { return handleIp; }
  if (p === '/json') { return handleJson; }
  if (p === '/xml') { return handleXml; }
  if (p === '/html') { return handleHtml; }
  if (p === '/cookies') { return handleCookies; }
  if (p.startsWith('/cookies/set')) { return handleCookiesSet; }
  if (p === '/auth/basic') { return handleAuthBasic; }
  if (p === '/auth/bearer') { return handleAuthBearer; }

  // Parameterised routes
  let m: RegExpMatchArray | null;

  m = p.match(/^\/status\/(\d+)$/);
  if (m) { return (_req, _url) => handleStatus(parseInt(m![1], 10)); }

  m = p.match(/^\/delay\/(\d+)$/);
  if (m) { return (req, url) => handleDelay(req, url, parseInt(m![1], 10)); }

  m = p.match(/^\/method\/(\w+)$/);
  if (m) { return (req) => handleMethod(req, m![1].toUpperCase()); }

  m = p.match(/^\/redirect\/(\d+)$/);
  if (m) { return (_req, url) => handleRedirect(url, parseInt(m![1], 10)); }

  m = p.match(/^\/bytes\/(\d+)$/);
  if (m) { return () => handleBytes(parseInt(m![1], 10)); }

  m = p.match(/^\/cache\/(\d+)$/);
  if (m) { return () => handleCache(parseInt(m![1], 10)); }

  return null;
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

function handleIndex(): Response {
  const help = {
    service: 'Multimeter Test Server',
    url: 'https://test.mmt.dev',
    endpoints: endpointList(),
  };
  return jsonResponse(help, 200);
}

async function handleEcho(request: Request, url: URL): Promise<Response> {
  const body = await parseBody(request);
  const query = queryToObject(url);
  const headers = requestHeaders(request);

  return jsonResponse({
    method: request.method,
    url: request.url,
    path: url.pathname,
    query: Object.keys(query).length > 0 ? query : undefined,
    headers,
    body: body ?? undefined,
    timestamp: new Date().toISOString(),
  });
}

function handleStatus(code: number): Response {
  if (code < 100 || code > 599) {
    return jsonResponse({ error: 'Status code must be between 100 and 599' }, 400);
  }
  const description = STATUS_TEXTS[code] || 'Unknown';
  return jsonResponse({ status: code, description }, code);
}

async function handleDelay(request: Request, url: URL, ms: number): Promise<Response> {
  const clamped = Math.min(Math.max(0, ms), 10000);
  await sleep(clamped);

  const body = await parseBody(request);
  const query = queryToObject(url);

  return jsonResponse({
    delayed: clamped,
    method: request.method,
    query: Object.keys(query).length > 0 ? query : undefined,
    body: body ?? undefined,
    timestamp: new Date().toISOString(),
  });
}

function handleHeaders(request: Request): Response {
  return jsonResponse({ headers: requestHeaders(request) });
}

function handleIp(request: Request): Response {
  const ip = request.headers.get('cf-connecting-ip')
    || request.headers.get('x-forwarded-for')
    || request.headers.get('x-real-ip')
    || 'unknown';
  return jsonResponse({ ip });
}

function handleMethod(request: Request, expected: string): Response {
  if (request.method === expected) {
    return jsonResponse({ ok: true, method: request.method });
  }
  return jsonResponse(
    { ok: false, error: `Expected ${expected}, got ${request.method}` },
    405,
  );
}

function handleRedirect(url: URL, n: number): Response {
  const count = Math.min(Math.max(0, n), 20);
  if (count === 0) {
    return jsonResponse({ redirected: true, message: 'Final destination reached' });
  }
  const next = `${url.origin}/redirect/${count - 1}`;
  return new Response(null, {
    status: 302,
    headers: { Location: next, ...corsHeaders() },
  });
}

function handleJson(): Response {
  return jsonResponse({
    id: 1,
    name: 'Multimeter',
    description: 'API testing tool',
    version: '1.0.0',
    tags: ['api', 'testing', 'automation'],
    nested: {
      enabled: true,
      count: 42,
      items: [
        { key: 'alpha', value: 1 },
        { key: 'beta', value: 2 },
      ],
    },
  });
}

function handleXml(): Response {
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
  return new Response(xml, {
    status: 200,
    headers: { 'Content-Type': 'application/xml', ...corsHeaders() },
  });
}

function handleHtml(): Response {
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
  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', ...corsHeaders() },
  });
}

function handleBytes(n: number): Response {
  const clamped = Math.min(Math.max(0, n), 102400); // max 100KB
  const bytes = new Uint8Array(clamped);
  crypto.getRandomValues(bytes);
  return new Response(bytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(clamped),
      ...corsHeaders(),
    },
  });
}

function handleAuthBasic(request: Request): Response {
  const auth = request.headers.get('authorization') || '';
  if (!auth.startsWith('Basic ')) {
    return jsonResponse(
      { authenticated: false, error: 'Missing Basic auth header' },
      401,
      { 'WWW-Authenticate': 'Basic realm="test"' },
    );
  }
  const decoded = atob(auth.slice(6));
  const [user, pass] = decoded.split(':');
  if (user === 'user' && pass === 'pass') {
    return jsonResponse({ authenticated: true, user });
  }
  return jsonResponse(
    { authenticated: false, error: 'Invalid credentials (expected user:pass)' },
    401,
    { 'WWW-Authenticate': 'Basic realm="test"' },
  );
}

function handleAuthBearer(request: Request): Response {
  const auth = request.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ')) {
    return jsonResponse(
      { authenticated: false, error: 'Missing Bearer token' },
      401,
    );
  }
  const token = auth.slice(7);
  if (token === 'testtoken') {
    return jsonResponse({ authenticated: true, token });
  }
  return jsonResponse(
    { authenticated: false, error: 'Invalid token (expected "testtoken")' },
    401,
  );
}

function handleCookies(request: Request): Response {
  const cookies: Record<string, string> = {};
  const cookieHeader = request.headers.get('cookie') || '';
  if (cookieHeader) {
    for (const pair of cookieHeader.split(';')) {
      const [k, ...v] = pair.split('=');
      if (k) { cookies[k.trim()] = v.join('=').trim(); }
    }
  }
  return jsonResponse({ cookies });
}

function handleCookiesSet(_request: Request, url: URL): Response {
  const cookies: Record<string, string> = {};
  const setCookies: string[] = [];
  url.searchParams.forEach((value, key) => {
    cookies[key] = value;
    setCookies.push(`${key}=${value}; Path=/`);
  });

  const headers = new Headers({ 'Content-Type': 'application/json', ...corsHeaders() });
  for (const c of setCookies) {
    headers.append('Set-Cookie', c);
  }

  return new Response(JSON.stringify({ cookies }, null, 2), { status: 200, headers });
}

function handleCache(seconds: number): Response {
  const clamped = Math.min(Math.max(0, seconds), 86400); // max 1 day
  return jsonResponse(
    { cache: clamped, message: `Cache-Control set to ${clamped} seconds` },
    200,
    { 'Cache-Control': `public, max-age=${clamped}` },
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonResponse(
  data: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
      ...extraHeaders,
    },
  });
}

async function parseBody(request: Request): Promise<unknown> {
  if (request.method === 'GET' || request.method === 'HEAD') { return null; }

  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try { return await request.json(); } catch { return await request.text(); }
  }
  if (contentType.includes('form')) {
    const fd = await request.formData();
    const obj: Record<string, string> = {};
    fd.forEach((v, k) => { obj[k] = v.toString(); });
    return obj;
  }
  return await request.text();
}

function queryToObject(url: URL): Record<string, string> {
  const q: Record<string, string> = {};
  url.searchParams.forEach((v, k) => { q[k] = v; });
  return q;
}

function requestHeaders(request: Request): Record<string, string> {
  const h: Record<string, string> = {};
  request.headers.forEach((v, k) => {
    if (!k.startsWith('cf-') && k !== 'x-real-ip') {
      h[k] = v;
    }
  });
  return h;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function endpointList(): string[] {
  return [
    'GET  /                     → this help page',
    'ANY  /echo                 → echo back request details',
    'ANY  /anything             → alias for /echo',
    'GET  /status/:code         → respond with the given HTTP status code (100-599)',
    'ANY  /delay/:ms            → delay response up to 10000ms',
    'GET  /headers              → return request headers as JSON',
    'GET  /ip                   → return client IP address',
    'ANY  /method/:method       → 200 if request method matches, 405 otherwise',
    'GET  /redirect/:n          → redirect n times (max 20), then 200',
    'GET  /json                 → sample JSON response',
    'GET  /xml                  → sample XML response',
    'GET  /html                 → sample HTML response',
    'GET  /bytes/:n             → n random bytes (max 100KB)',
    'GET  /auth/basic           → Basic auth (user:pass)',
    'GET  /auth/bearer          → Bearer token auth (testtoken)',
    'GET  /cookies              → return cookies sent',
    'GET  /cookies/set?k=v      → set cookies via query params',
    'GET  /cache/:seconds       → Cache-Control max-age (max 86400)',
  ];
}

// ---------------------------------------------------------------------------
// Common HTTP status text lookup
// ---------------------------------------------------------------------------

const STATUS_TEXTS: Record<number, string> = {
  100: 'Continue', 101: 'Switching Protocols', 102: 'Processing',
  200: 'OK', 201: 'Created', 202: 'Accepted', 204: 'No Content',
  301: 'Moved Permanently', 302: 'Found', 303: 'See Other',
  304: 'Not Modified', 307: 'Temporary Redirect', 308: 'Permanent Redirect',
  400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found',
  405: 'Method Not Allowed', 408: 'Request Timeout', 409: 'Conflict',
  410: 'Gone', 413: 'Payload Too Large', 415: 'Unsupported Media Type',
  418: "I'm a Teapot", 422: 'Unprocessable Entity', 429: 'Too Many Requests',
  500: 'Internal Server Error', 501: 'Not Implemented', 502: 'Bad Gateway',
  503: 'Service Unavailable', 504: 'Gateway Timeout',
};
