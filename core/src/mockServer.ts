import {Format, JSONValue} from './CommonData';
import {MockData, MockEndpoint, MockFallback, MockMatch} from './MockData';

/**
 * Platform-neutral mock request router.
 * No fs, vscode, or Node server imports — only computes responses from MockData.
 */

export interface MockRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  body: any;
}

export interface MockResponse {
  status: number;
  headers: Record<string, string>;
  body: any;
  delay: number;
}

export type TokenResolver = (value: any) => any;

/** Try to match a path pattern (with :params) against an actual path. */
export function matchPath(pattern: string, actualPath: string): Record<string, string> | null {
  // Strip query string from actual path
  const pathOnly = actualPath.split('?')[0];

  const patternParts = pattern.split('/');
  const actualParts = pathOnly.split('/');

  if (patternParts.length !== actualParts.length) {
    return null;
  }

  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    const pp = patternParts[i];
    const ap = actualParts[i];
    if (pp.startsWith(':')) {
      params[pp.slice(1)] = decodeURIComponent(ap);
    } else if (pp !== ap) {
      return null;
    }
  }
  return params;
}

/** Auto-detect format from a body value. */
export function autoDetectFormat(body: any): Format {
  if (body === null || body === undefined) {
    return 'text';
  }
  if (typeof body === 'object') {
    return 'json';
  }
  const s = String(body).trimStart();
  if (s.startsWith('<')) {
    return 'xml';
  }
  return 'text';
}

/** Get Content-Type header for a format. */
export function contentTypeForFormat(format: Format): string {
  switch (format) {
    case 'json': return 'application/json';
    case 'xml': return 'application/xml';
    case 'text': return 'text/plain';
    default: return 'text/plain';
  }
}

/** Deep partial match: does `actual` contain all key-value pairs from `expected`? */
export function partialMatch(expected: Record<string, any>, actual: Record<string, any>): boolean {
  if (!expected || !actual) {
    return false;
  }
  for (const [key, val] of Object.entries(expected)) {
    const actualVal = actual[key];
    if (typeof val === 'object' && val !== null && typeof actualVal === 'object' && actualVal !== null) {
      if (!partialMatch(val, actualVal)) {
        return false;
      }
    } else if (String(val) !== String(actualVal)) {
      return false;
    }
  }
  return true;
}

/** Case-insensitive header match. */
function matchHeaders(expected: Record<string, string>, actual: Record<string, string>): boolean {
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(actual)) {
    lower[k.toLowerCase()] = v;
  }
  for (const [k, v] of Object.entries(expected)) {
    if (lower[k.toLowerCase()] !== v) {
      return false;
    }
  }
  return true;
}

/** Check if a request matches the endpoint's match conditions. */
function matchCondition(match: MockMatch, req: MockRequest): boolean {
  if (match.body) {
    const reqBody = typeof req.body === 'object' ? req.body : {};
    if (!partialMatch(match.body as Record<string, any>, reqBody)) {
      return false;
    }
  }
  if (match.headers) {
    if (!matchHeaders(match.headers, req.headers)) {
      return false;
    }
  }
  if (match.query) {
    if (!partialMatch(match.query, req.query)) {
      return false;
    }
  }
  return true;
}

/** Replace :param references in a value tree with actual path params. */
function replacePathParams(value: any, params: Record<string, string>): any {
  if (typeof value === 'string') {
    // Exact match: ":id" → params.id
    if (value.startsWith(':') && params[value.slice(1)] !== undefined) {
      return params[value.slice(1)];
    }
    // Inline replacement: "user-:id" → "user-42"
    let result = value;
    for (const [k, v] of Object.entries(params)) {
      result = result.replace(new RegExp(`:${k}\\b`, 'g'), v);
    }
    return result;
  }
  if (Array.isArray(value)) {
    return value.map(item => replacePathParams(item, params));
  }
  if (value && typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = replacePathParams(v, params);
    }
    return out;
  }
  return value;
}

/** Serialize body based on format. */
export function serializeBody(body: any, format: Format): string {
  if (body === null || body === undefined) {
    return '';
  }
  if (format === 'json' && typeof body === 'object') {
    return JSON.stringify(body, null, 2);
  }
  return String(body);
}

export interface MatchResult {
  endpoint: MockEndpoint;
  pathParams: Record<string, string>;
}

/**
 * Find the first matching endpoint for a request.
 * Named endpoints are checked first if x-mock-example header is present.
 */
export function findEndpoint(
    endpoints: MockEndpoint[], req: MockRequest): MatchResult | null {
  const method = req.method.toLowerCase();

  // Check x-mock-example header for named endpoint selection
  const exampleName = req.headers['x-mock-example'] || req.headers['X-Mock-Example'];
  if (exampleName) {
    for (const ep of endpoints) {
      if (ep.name !== exampleName) {
        continue;
      }
      if (ep.method && ep.method !== method) {
        continue;
      }
      const params = matchPath(ep.path, req.path);
      if (params !== null) {
        return {endpoint: ep, pathParams: params};
      }
    }
  }

  // Standard first-match
  for (const ep of endpoints) {
    // Method check (skip for reflect-only or ws endpoints without method)
    if (ep.method && ep.method !== method) {
      continue;
    }

    const params = matchPath(ep.path, req.path);
    if (params === null) {
      continue;
    }

    // Match conditions
    if (ep.match && !matchCondition(ep.match, req)) {
      continue;
    }

    return {endpoint: ep, pathParams: params};
  }

  return null;
}

/**
 * Build a MockResponse from a matched endpoint.
 * tokenResolver is called on the body to resolve r:/c:/e: tokens.
 */
export function buildResponse(
    endpoint: MockEndpoint,
    pathParams: Record<string, string>,
    req: MockRequest,
    globalHeaders: Record<string, string> | undefined,
    globalDelay: number,
    tokenResolver?: TokenResolver): MockResponse {
  // Reflect mode: echo back the request
  if (endpoint.reflect) {
    const reflectBody = {
      method: req.method,
      path: req.path,
      headers: req.headers,
      query: req.query,
      body: req.body
    };
    return {
      status: endpoint.status ?? 200,
      headers: {...(globalHeaders || {}), 'content-type': 'application/json'},
      body: JSON.stringify(reflectBody, null, 2),
      delay: endpoint.delay ?? globalDelay
    };
  }

  const format = endpoint.format || autoDetectFormat(endpoint.body);
  let body = endpoint.body;

  // Replace path params in body
  body = replacePathParams(body, pathParams);

  // Resolve tokens (r:, c:, e:)
  if (tokenResolver) {
    body = tokenResolver(body);
  }

  // Serialize
  const serialized = serializeBody(body, format);

  // Merge headers: global < endpoint
  const headers: Record<string, string> = {
    ...(globalHeaders || {}),
    'content-type': contentTypeForFormat(format),
    ...(endpoint.headers || {})
  };

  return {
    status: endpoint.status ?? 200,
    headers,
    body: serialized,
    delay: endpoint.delay ?? globalDelay
  };
}

/**
 * Build a fallback response for unmatched routes.
 */
export function buildFallbackResponse(
    fallback: MockFallback | undefined,
    req: MockRequest,
    globalHeaders: Record<string, string> | undefined,
    globalDelay: number,
    tokenResolver?: TokenResolver): MockResponse {
  if (!fallback) {
    return {
      status: 404,
      headers: {...(globalHeaders || {}), 'content-type': 'application/json'},
      body: JSON.stringify({error: 'Not Found'}),
      delay: globalDelay
    };
  }

  const format = fallback.format || autoDetectFormat(fallback.body);
  let body = fallback.body;

  // Replace :path with the actual unmatched path
  body = replacePathParams(body, {path: req.path});

  if (tokenResolver) {
    body = tokenResolver(body);
  }

  const serialized = serializeBody(body, format);
  const headers: Record<string, string> = {
    ...(globalHeaders || {}),
    'content-type': contentTypeForFormat(format),
    ...(fallback.headers || {})
  };

  return {
    status: fallback.status ?? 404,
    headers,
    body: serialized,
    delay: globalDelay
  };
}

/**
 * Create a router function from MockData.
 * Returns a function that takes a MockRequest and returns a MockResponse.
 */
export function createMockRouter(
    data: MockData,
    tokenResolver?: TokenResolver): (req: MockRequest) => MockResponse {
  return (req: MockRequest): MockResponse => {
    const result = findEndpoint(data.endpoints as MockEndpoint[], req);
    if (result) {
      return buildResponse(
          result.endpoint, result.pathParams, req,
          data.headers, data.delay || 0, tokenResolver);
    }
    return buildFallbackResponse(
        data.fallback, req, data.headers, data.delay || 0, tokenResolver);
  };
}
