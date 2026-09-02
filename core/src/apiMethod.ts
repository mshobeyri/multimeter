import type {Method} from './CommonData';

/** True when the request carries a non-empty body payload. */
export function hasApiRequestBody(body: unknown): boolean {
  if (body === undefined || body === null) {
    return false;
  }
  if (typeof body === 'string') {
    return body.trim().length > 0;
  }
  if (Array.isArray(body)) {
    return body.length > 0;
  }
  if (typeof body === 'object') {
    return true;
  }
  return true;
}

/**
 * Resolve the HTTP method for an API or test HTTP step.
 * Explicit `method` wins; otherwise POST when a body is present, GET otherwise.
 */
export function resolveApiHttpMethod(
    method: string | undefined | null,
    body?: unknown): Method {
  const trimmed = typeof method === 'string' ? method.trim().toLowerCase() : '';
  if (trimmed) {
    return trimmed as Method;
  }
  return hasApiRequestBody(body) ? 'post' : 'get';
}
