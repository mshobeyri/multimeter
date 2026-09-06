import {AuthConfig} from './APIData';
import {applyAuthToRequest} from './apiParsePack';

function headerKey(headers: Record<string, string>, name: string): string|undefined {
  const lower = name.toLowerCase();
  return Object.keys(headers).find(k => k.toLowerCase() === lower);
}

function extractSecret(auth: AuthConfig|undefined): string {
  if (!auth || auth === 'none') {
    return '';
  }
  if (auth.type === 'bearer') {
    return String(auth.token || '').trim();
  }
  if (auth.type === 'api-key') {
    return String(auth.value || '').trim();
  }
  if (auth.type === 'basic') {
    return String(auth.password || '').trim();
  }
  return '';
}

/**
 * Build HTTP headers (+ optional query) for a judge engine request.
 * Starts from API-style `auth`, then applies engine-specific header conventions.
 */
export function buildJudgeAuth(
    engine: string,
    auth: AuthConfig|undefined,
    baseHeaders: Record<string, string> = {'Content-Type': 'application/json'},
    ): {headers: Record<string, string>; query?: Record<string, string>} {
  const applied = applyAuthToRequest(auth, {...baseHeaders});
  const headers = {...applied.headers};
  const query = applied.query ? {...applied.query} : undefined;
  const id = String(engine || '').trim().toLowerCase();
  const secret = extractSecret(!auth || auth === 'none' ? undefined : auth);

  if (id === 'anthropic') {
    if (secret && !headerKey(headers, 'x-api-key')) {
      headers['x-api-key'] = secret;
    }
    const authHeader = headerKey(headers, 'authorization');
    if (authHeader && auth && auth !== 'none' && auth.type === 'bearer') {
      delete headers[authHeader];
    }
    if (!headerKey(headers, 'anthropic-version')) {
      headers['anthropic-version'] = '2023-06-01';
    }
  }

  if (id === 'google') {
    if (secret && !headerKey(headers, 'x-goog-api-key')) {
      headers['x-goog-api-key'] = secret;
    }
    const authHeader = headerKey(headers, 'authorization');
    if (authHeader && auth && auth !== 'none' && auth.type === 'bearer') {
      delete headers[authHeader];
    }
  }

  if (id === 'azure-openai') {
    if (secret && !headerKey(headers, 'api-key') && !headerKey(headers, 'authorization')) {
      headers['api-key'] = secret;
    }
  }

  return {headers, query};
}

/** Append query params to a URL (skips empty values). */
export function appendQuery(url: string, query?: Record<string, string>): string {
  if (!query) {
    return url;
  }
  const entries = Object.entries(query).filter(([, v]) => v != null && String(v) !== '');
  if (entries.length === 0) {
    return url;
  }
  const qs = entries
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
  return url.includes('?') ? `${url}&${qs}` : `${url}?${qs}`;
}

export function resolveJudgeBaseUrl(url: string|undefined): string {
  return String(url || '').replace(/\/+$/, '');
}
