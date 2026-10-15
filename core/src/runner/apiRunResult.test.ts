import {buildApiTesterResponse, parseSetCookieHeader} from './apiRunResult';

describe('parseSetCookieHeader', () => {
  it('parses a single Set-Cookie string', () => {
    expect(parseSetCookieHeader('session=abc; Path=/')).toEqual({session: 'abc'});
  });

  it('parses an array of Set-Cookie values', () => {
    expect(parseSetCookieHeader(['a=1', 'b=2; Secure'])).toEqual({a: '1', b: '2'});
  });

  it('returns empty object for missing input', () => {
    expect(parseSetCookieHeader(undefined)).toEqual({});
  });

  it('skips non-string entries and cookies without names', () => {
    expect(parseSetCookieHeader([1 as any, '=novalue', 'ok=1'])).toEqual({ok: '1'});
  });
});

describe('buildApiTesterResponse', () => {
  it('returns null for missing outputs', () => {
    expect(buildApiTesterResponse(undefined)).toBeNull();
    expect(buildApiTesterResponse(null)).toBeNull();
    expect(buildApiTesterResponse({})).toBeNull();
  });

  it('prefers the HTTP response embedded in _.details', () => {
    const response = buildApiTesterResponse({
      _: {
        status: 200,
        duration: 99.7,
        cookies: {fromMeta: 'x'},
        details: JSON.stringify({
          request: {url: 'https://example.com'},
          response: {
            status: 201,
            statusText: 'Created',
            body: '{"ok":true}',
            headers: {
              'content-type': 'application/json',
              'set-cookie': 'token=xyz; Path=/',
            },
            duration: 42.4,
          },
        }),
      },
    });

    expect(response).toEqual({
      body: '{"ok":true}',
      headers: {
        'content-type': 'application/json',
        'set-cookie': 'token=xyz; Path=/',
      },
      cookies: {token: 'xyz'},
      errorMessage: 'Created',
      status: 201,
      errorCode: '',
      duration: 42,
      warning: undefined,
    });
  });

  it('falls back to meta fields when details is missing', () => {
    const response = buildApiTesterResponse({
      _: {
        body: 'hi',
        headers: {a: 'b'},
        cookies: {c: 'd'},
        status: 200,
        duration: 12,
      },
    });

    expect(response).toEqual({
      body: 'hi',
      headers: {a: 'b'},
      cookies: {c: 'd'},
      errorMessage: '',
      status: 200,
      errorCode: '',
      duration: 12,
    });
  });

  it('uses meta cookies when Set-Cookie is absent', () => {
    const response = buildApiTesterResponse({
      _: {
        cookies: {session: '1'},
        details: JSON.stringify({
          response: {
            status: 200,
            body: '',
            headers: {'content-type': 'text/plain'},
            duration: 5,
          },
        }),
      },
    });

    expect(response?.cookies).toEqual({session: '1'});
    expect(response?.duration).toBe(5);
  });

  it('returns null for non-objects and falls back when details is invalid', () => {
    expect(buildApiTesterResponse('x')).toBeNull();
    const broken = buildApiTesterResponse({
      _: {details: '{not-json', status: 418, duration: Number.NaN},
    });
    expect(broken?.status).toBe(418);
    expect(broken?.duration).toBe(-1);
    expect(broken?.headers).toEqual({});
    expect(broken?.cookies).toEqual({});
  });

  it('uses Set-Cookie header case, default status, and warning', () => {
    const response = buildApiTesterResponse({
      _: {
        details: JSON.stringify({
          response: {
            statusText: 1,
            headers: {'Set-Cookie': 'sid=1'},
            duration: Number.NaN,
            warning: 'slow',
          },
        }),
      },
    });
    expect(response?.status).toBe(-1);
    expect(response?.errorMessage).toBe('');
    expect(response?.cookies).toEqual({sid: '1'});
    expect(response?.warning).toBe('slow');
    expect(response?.duration).toBe(-1);
  });
});
