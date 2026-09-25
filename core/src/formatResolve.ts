import {httpMethodAllowsRequestBody} from './apiMethod';
import {isBinaryBodyPayload} from './binaryBody';
import {Format, RequestFormat, ResponseFormat} from './CommonData';

export function headerContentType(headers?: Record<string, string>): string {
  if (!headers) {
    return '';
  }
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === 'content-type') {
      return value == null ? '' : String(value);
    }
  }
  return '';
}

/** Map a Content-Type header to a body format, when recognized. */
export function formatFromContentType(contentType: string): Format | undefined {
  const ct = (contentType || '').toLowerCase();
  if (!ct) {
    return undefined;
  }
  if (ct.includes('json')) {
    return 'json';
  }
  if (ct.includes('html')) {
    return 'html';
  }
  if (ct.includes('xml')) {
    return 'xml';
  }
  if (ct.includes('urlencoded') || ct.includes('x-www-form-urlencoded')) {
    return 'urlencoded';
  }
  if (ct.includes('multipart')) {
    return 'multipart';
  }
  if (ct.startsWith('image/')) {
    return 'binary';
  }
  if (ct.includes('octet-stream')) {
    return 'binary';
  }
  if (ct.includes('text/plain')) {
    return 'text';
  }
  return undefined;
}

function bodyToRawString(body: unknown): string {
  if (body === null || body === undefined) {
    return '';
  }
  if (typeof body === 'string') {
    return body;
  }
  if (typeof body === 'object') {
    try {
      return JSON.stringify(body);
    } catch {
      return String(body);
    }
  }
  return String(body);
}

function sniffFormatFromBody(raw: string): Format {
  const trimmed = raw.trimStart();
  if (!trimmed) {
    return 'text';
  }
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      JSON.parse(raw);
      return 'json';
    } catch {
      // fall through
    }
  }
  if (/^<!DOCTYPE\s+html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)) {
    return 'html';
  }
  if (trimmed.startsWith('<')) {
    return 'xml';
  }
  if (/^[^=&\s]+=/.test(trimmed) && trimmed.includes('=') && !trimmed.includes('\n')) {
    return 'urlencoded';
  }
  return 'text';
}

/**
 * Resolve request format: explicit value wins; `auto` uses Content-Type, else `json`.
 * Method only affects `auto` (body-less methods like GET resolve to `none`).
 */
export function resolveRequestFormat(
    declared: RequestFormat,
    headers?: Record<string, string>,
    method?: string,
): Format {
  if (declared !== 'auto') {
    return declared;
  }
  if (method !== undefined && !httpMethodAllowsRequestBody(method)) {
    return 'none';
  }
  return formatFromContentType(headerContentType(headers)) ?? 'json';
}

/**
 * Resolve response display format: Content-Type, else resolved request format, else body sniff.
 */
export function resolveResponseFormat(
    declared: ResponseFormat,
    options: {
      responseHeaders?: Record<string, string>;
      requestFormat?: Format;
      body?: unknown;
    } = {},
): Format {
  if (declared !== 'auto') {
    return declared;
  }
  if (isBinaryBodyPayload(options.body)) {
    return 'binary';
  }
  const fromHeader = formatFromContentType(headerContentType(options.responseHeaders));
  if (fromHeader) {
    return fromHeader;
  }
  if (options.requestFormat && options.requestFormat !== 'none') {
    return options.requestFormat;
  }
  return sniffFormatFromBody(bodyToRawString(options.body));
}
