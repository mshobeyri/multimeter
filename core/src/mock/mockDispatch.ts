/**
 * Shared mock HTTP request → response shaping (extension + CLI runners).
 * Keeps Node http.Server I/O outside core while centralizing parse/route/serialize.
 */

import {
  MockRequest,
  MockResponse,
  parseRequestBody,
} from './mockServer';

export function parseMockUrl(urlStr: string): {
  pathname: string;
  query: Record<string, string>;
} {
  const raw = String(urlStr || '/');
  let pathname = raw;
  const query: Record<string, string> = {};
  const qIdx = raw.indexOf('?');
  if (qIdx >= 0) {
    pathname = raw.slice(0, qIdx);
    const searchParams = new URLSearchParams(raw.slice(qIdx + 1));
    searchParams.forEach((v, k) => {
      query[k] = v;
    });
  }
  return {pathname, query};
}

export function serializeMockResponseBody(body: unknown): string {
  if (body === undefined) {
    return '';
  }
  return typeof body === 'string' ? body : JSON.stringify(body);
}

export function resolveMockResponseHeaders(
    headers: Record<string, string>|undefined,
    resolveToken?: (value: string) => string,
    ): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers) {
    return out;
  }
  for (const [k, v] of Object.entries(headers)) {
    out[k] = typeof v === 'string' && resolveToken ? String(resolveToken(v)) : String(v);
  }
  return out;
}

export type MockDispatchResult = {
  status: number;
  headers: Record<string, string>;
  body: string;
  delay: number;
  pathname: string;
  query: Record<string, string>;
};

/**
 * Parse raw HTTP bits, invoke the mock router, and shape the wire response.
 * Throws if the router throws (callers map that to HTTP 500).
 */
export function dispatchMockHttpRequest(
    router: (req: MockRequest) => MockResponse,
    args: {
      method: string;
      url: string;
      headers: Record<string, string>;
      rawBody: string;
      resolveHeaderToken?: (value: string) => string;
    },
    ): MockDispatchResult {
  const {pathname, query} = parseMockUrl(args.url);
  const parsedBody = parseRequestBody(args.rawBody, args.headers);
  const mockReq: MockRequest = {
    method: String(args.method || 'GET').toLowerCase(),
    path: pathname,
    headers: args.headers || {},
    query,
    body: parsedBody,
  };
  const mockRes = router(mockReq);
  return {
    status: mockRes.status,
    headers: resolveMockResponseHeaders(mockRes.headers, args.resolveHeaderToken),
    body: serializeMockResponseBody(mockRes.body),
    delay: typeof mockRes.delay === 'number' && mockRes.delay > 0 ? mockRes.delay : 0,
    pathname,
    query,
  };
}
