import {Response} from './NetworkData';

/**
 * Build a webview/API-tester Response from API run outputs (`output_['_']`).
 * Prefers the full HTTP response embedded in `_.details` so duration/status
 * match the network round-trip the finish log uses.
 */
export function buildApiTesterResponse(outputs: unknown): Response|null {
  if (!outputs || typeof outputs !== 'object') {
    return null;
  }
  const meta = (outputs as Record<string, any>)._;
  if (meta && typeof meta.details === 'string') {
    try {
      const parsed = JSON.parse(meta.details);
      const res = parsed?.response;
      if (res && typeof res === 'object') {
        const headers =
            res.headers && typeof res.headers === 'object' ? res.headers : {};
        const fromSetCookie = parseSetCookieHeader(
            headers['set-cookie'] ?? headers['Set-Cookie']);
        const metaCookies =
            meta.cookies && typeof meta.cookies === 'object' ? meta.cookies : {};
        return {
          body: res.body,
          headers,
          cookies: Object.keys(fromSetCookie).length > 0 ? fromSetCookie :
                                                           metaCookies,
          errorMessage: typeof res.statusText === 'string' ? res.statusText : '',
          status: typeof res.status === 'number' ? res.status : -1,
          errorCode: '',
          duration: typeof res.duration === 'number' &&
                  Number.isFinite(res.duration) ?
              Math.round(res.duration) :
              -1,
          warning: typeof res.warning === 'string' ? res.warning : undefined,
        };
      }
    } catch {
      // Fall through to meta fields.
    }
  }
  if (!meta || typeof meta !== 'object') {
    return null;
  }
  return {
    body: meta.body,
    headers: meta.headers && typeof meta.headers === 'object' ? meta.headers :
                                                                {},
    cookies: meta.cookies && typeof meta.cookies === 'object' ? meta.cookies :
                                                                {},
    errorMessage: '',
    status: typeof meta.status === 'number' ? meta.status : -1,
    errorCode: '',
    duration: typeof meta.duration === 'number' && Number.isFinite(meta.duration) ?
        Math.round(meta.duration) :
        -1,
  };
}

export function parseSetCookieHeader(setCookie: string[]|string|undefined):
    Record<string, string> {
  if (!setCookie) {
    return {};
  }
  const arr = Array.isArray(setCookie) ? setCookie : [setCookie];
  const cookies: Record<string, string> = {};
  for (const cookieStr of arr) {
    if (typeof cookieStr !== 'string') {
      continue;
    }
    const [cookiePair] = cookieStr.split(';');
    const eq = cookiePair.indexOf('=');
    if (eq <= 0) {
      continue;
    }
    const key = cookiePair.slice(0, eq).trim();
    const value = cookiePair.slice(eq + 1).trim();
    if (key) {
      cookies[key] = value;
    }
  }
  return cookies;
}
