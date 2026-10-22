/** Format HTTP request/response for Multimeter `trace` logs. */

export const HTTP_TRACE_BODY_LIMIT = 16_384;
export const HTTP_TRACE_REDACTED = '[redacted]';

const REDACT_HEADER_NAMES = new Set([
  'authorization',
  'proxy-authorization',
  'x-api-key',
  'api-key',
  'x-goog-api-key',
  'cookie',
  'set-cookie',
]);

const REDACT_QUERY_NAMES = new Set([
  'api-key',
  'key',
  'token',
  'access_token',
]);

export function redactHttpHeaders(
    headers?: Record<string, string>|null,
    ): Record<string, string>|undefined {
  if (!headers) {
    return undefined;
  }
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    out[key] = REDACT_HEADER_NAMES.has(key.toLowerCase()) ?
        HTTP_TRACE_REDACTED :
        String(value);
  }
  return out;
}

export function redactHttpQuery(
    query?: Record<string, string>|null,
    ): Record<string, string>|undefined {
  if (!query) {
    return undefined;
  }
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    out[key] = REDACT_QUERY_NAMES.has(key.toLowerCase()) ?
        HTTP_TRACE_REDACTED :
        String(value);
  }
  return out;
}

export function formatHttpTraceBody(
    body: unknown, limit = HTTP_TRACE_BODY_LIMIT): string {
  if (body == null || body === '') {
    return '';
  }
  let text: string;
  if (typeof body === 'string') {
    text = body;
  } else {
    try {
      text = JSON.stringify(body, null, 2);
    } catch {
      text = String(body);
    }
  }
  if (text.length > limit) {
    return `${text.slice(0, limit)}\n… truncated ${text.length - limit} chars`;
  }
  return text;
}

function appendMap(
    lines: string[], title: string, map?: Record<string, string>): void {
  if (!map || Object.keys(map).length === 0) {
    return;
  }
  lines.push(`  ${title}:`);
  for (const [key, value] of Object.entries(map)) {
    lines.push(`    ${key}: ${value}`);
  }
}

function appendBody(lines: string[], body: unknown): void {
  const text = formatHttpTraceBody(body);
  if (!text) {
    return;
  }
  lines.push('  body:');
  for (const line of text.split('\n')) {
    lines.push(`    ${line}`);
  }
}

export function formatHttpTraceRequest(args: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  body?: unknown;
}): string {
  const method = String(args.method || 'GET').toUpperCase();
  const url = args.url || '';
  const lines = [`Request: ${method} ${url}`];
  appendMap(lines, 'headers', redactHttpHeaders(args.headers));
  appendMap(lines, 'query', redactHttpQuery(args.query));
  appendBody(lines, args.body);
  return lines.join('\n');
}

export function formatHttpTraceResponse(args: {
  status?: number|string;
  durationMs?: number;
  headers?: Record<string, string>;
  body?: unknown;
  error?: string;
}): string {
  if (args.error) {
    return `Response: error - ${args.error}`;
  }
  const status = args.status ?? '?';
  const duration =
      typeof args.durationMs === 'number' && Number.isFinite(args.durationMs) ?
      ` (${args.durationMs}ms)` :
      '';
  const lines = [`Response: ${status}${duration}`];
  appendMap(lines, 'headers', redactHttpHeaders(args.headers));
  appendBody(lines, args.body);
  return lines.join('\n');
}
